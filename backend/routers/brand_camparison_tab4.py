from fastapi import APIRouter, Query
from collections import defaultdict,Counter
from typing import List, Optional,Literal
import pandas as pd
import re, duckdb
from sklearn.feature_extraction.text import CountVectorizer
from keybert import KeyBERT
from backend.model_loader import kw_model,encoder
from sentence_transformers import SentenceTransformer, util
import spacy
from sklearn.cluster import KMeans
from backend.data_loader import query_chat, load_default_groups,load_groups_by_year

router = APIRouter()
DB_PATH="data/chat_cache.duckdb"
con= duckdb.connect(DB_PATH)

#df_cat = pd.read_csv("data/other_data/newest_brand_keywords.csv")
query = """
SELECT 
    b.brand_name AS brand,
    c.category_name AS category,
    k.keyword AS keyword
FROM brand_keywords k
JOIN brands b ON k.brand_id = b.brand_id
JOIN categories c ON b.category_id = c.category_id
"""
df_cat = con.execute(query).fetchdf()
con.close()

brand_category_map = defaultdict(list)
for _,row in df_cat.iterrows():
    brand = str(row["brand"]).strip().lower()
    category = str(row["category"]).strip()
    brand_category_map[brand].append(category)

brand_list = list(brand_category_map.keys())
brand_keyword_dict = (df_cat.groupby("brand")["keyword"].apply(list).to_dict())

def _normalize_quotes(s: str) -> str:
    if not isinstance(s, str):
        return ""
    return (
        s.replace("'", "'")
         .replace("'", "'")
         .replace("`", "'")
         .lower()
         .replace("'", "")
         .strip()
    )


def _build_keyword_pattern(kw: str) -> re.Pattern:
    k = _normalize_quotes(kw)
    k = re.escape(k)

    k = k.replace(r"\-", r"(?:-|\\s)")

    k = k.replace(r"\ ", r"\s+")
    return re.compile(rf"(?<!\w){k}(?!\w)", flags=re.IGNORECASE)


def count_kw(context_texts, keywords):
    patterns = {kw: _build_keyword_pattern(kw) for kw in keywords}
    cnt = Counter()
    for text in context_texts:
        t = _normalize_quotes(text)
        for kw, patt in patterns.items():
            if patt.search(t):
                cnt[kw] += 1
    return cnt

#---------- define filter function---------
def filter_df(df: pd.DataFrame, time: int, granularity):
        if granularity == "year":
            return df[df["year"] == time]
        elif granularity == "month":
            y, m = divmod(time, 100)
            return df[(df["year"] == y) & (df["month"] == m)]
        elif granularity == "quarter":
            y, q = divmod(time, 10)
            return df[(df["year"] == y) & (df["quarter"] == q)]
        
# ---------------- share of voice API ----------------
@router.get("/category/share-of-voice")
def get_share_of_voice(
    group_id:Optional[List[str]]=Query(None),
    group_year:Optional[List[int]]=Query(None),
    year: Optional[int] =None,
    month: Optional[List[int]] = Query(None),
    quarter: Optional[int] = None
    ):

    # --- 2. basic query
    query = """
    SELECT
        group_id, clean_text
    FROM chat WHERE clean_text IS NOT NULL"""
    params = []
    # ---- Default groups ----
    if group_year and not group_id:
        group_id = load_groups_by_year(group_year)
    if not group_id:
        group_id = load_default_groups()

    # ---- 3. Filter by group_id ----
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    # ---- Filter by date ----
    if year:
        query += " AND year = ?"
        params.append(year)

    if month:
        query += " AND month IN (" + ",".join(["?"] * len(month)) + ")"
        params.extend(month)

    if quarter:
        query += " AND quarter = ?"
        params.append(quarter)

    # ---- 4. Query DuckDB ----
    df = query_chat(query, params)
    if df.empty:
        return {"error":"No data available"}

    # 5. count brand frequency
    counts = count_kw(df["clean_text"].dropna(), brand_list)

    # 6.map to category
    category_counts = defaultdict(dict)
    for brand, count in counts.items():
        categories = brand_category_map.get(brand, [])
        for category in categories:
            category_counts[category][brand] = count


    result = {}
    for category, brand_counts in category_counts.items():
        total = sum(brand_counts.values())
        if total ==0:
            result[category]= {
                "total_mentions":0,
                "share_of_voice":[],
                "original_count":[]
            }
            continue
        result[category] = {
            "total_mentions": total,
            "share_of_voice": [
                {"brand": b, "percentage": round(c / total * 100, 1)}
                for b, c in brand_counts.items()
            ],
            "original_count": [
                {"brand": b, "count": c} for b, c in brand_counts.items()
            ]
        }

    return result

#-------consumer perception----------

nlp = spacy.load("en_core_web_sm",disable=["ner"])

def _overlap_fraction(a, b):
    """calculate the overlap percentage between two phrases token"""
    set_a, set_b = set(a.split()), set(b.split())
    if not set_a or not set_b:
        return 0
    return len(set_a & set_b) / min(len(set_a), len(set_b))

def remove_overlapping_phrases(keywords, overlap_ratio=0.6):
    """
    remove the overlap part（like "sensitive skin" vs "kids sensitive skin"）。
    overlap_ratio: 0.6。
    """
    cleaned = []
    for kw in sorted(keywords, key=len, reverse=True):  # from long to short
        if not any(_overlap_fraction(kw, c) > overlap_ratio for c in cleaned):
            cleaned.append(kw)
    return cleaned[::-1]  # keep the original order

def extract_clean_brand_keywords_auto(texts, brand_name, top_k=15):
    """
    extract meaningful word
    """
    if not texts:
        return []

    # Step 1️⃣ remove the brand name itself
    cleaned_texts = [re.sub(rf"\b{re.escape(brand_name)}\b", "", t.lower()) for t in texts]
    joined_text = " ".join(cleaned_texts)

    # Step 2️⃣ KeyBERT extrat keyword
    keywords = []
    for chunk_start in range(0,len(texts),200):
        chunk = " ".join(texts[chunk_start:chunk_start+200])
        chunk_keywords = [kw for kw, _ in kw_model.extract_keywords(
            chunk,
            keyphrase_ngram_range=(1, 3),
            use_mmr=True,
            diversity=0.7,
            top_n=top_k*3,
            stop_words='english'
        )]
        keywords.extend(chunk_keywords)

    # Step 3️⃣ POS keep noun, adj
    def is_meaningful(phrase):
        docs = list(nlp.pipe(keywords,disable=["ner"]))
        keywords = [kw for kw,doc in zip(keywords,docs)
                if any(t.pos_ in ["ADJ", "NOUN"] for t in doc)]

    # Step 4️⃣ calculate semantic centre
    if not keywords:
        return []
    kw_emb = encoder.encode(keywords, convert_to_tensor=True)
    centroid = kw_emb.mean(dim=0, keepdim=True)

    # Step 5️⃣ calculate similarity of each word and the centre
    sims = util.cos_sim(kw_emb, centroid).flatten()
    filtered_keywords = [kw for kw, sim in zip(keywords, sims) if sim > 0.3]
    #new_add
    filtered_keywords = remove_overlapping_phrases(filtered_keywords,overlap_ratio=0.5)

    # Step 6️⃣ count the frequency in original text
    counts = Counter()
    for text in texts:
        t = text.lower()
        for kw in filtered_keywords:
            if re.search(rf"\b{re.escape(kw)}\b", t):
                counts[kw] += 1

    results = [{"word": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)]
    return results


@router.get("/category/consumer-perception")
def category_consumer_perception(category_name:str,
                                granularity: Literal["year", "month", "quarter"],
                                time1: int,
                                time2: int,
                                top_k:int=20,
                                group_id:Optional[List[str]]=Query(None),
                                group_year:Optional[List[int]]=Query(None)):
    brand_in_category = [b for b,cats in brand_category_map.items() if category_name in cats]
    if not brand_in_category:
        return {"error":f"category '{category_name}' not found"}

    # --- 2. basic query
    query = """
    SELECT
        group_id, clean_text, year, month, quarter
    FROM chat WHERE clean_text IS NOT NULL"""
    params = []
    # ---- Default groups ----
    if group_year and not group_id:
        group_id = load_groups_by_year(group_year)
    if not group_id:
        group_id = load_default_groups()

    # ---- 3. Filter by group_id ----
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    # ---- 4. Query DuckDB ----
    df = query_chat(query, params)
    if df.empty:
        return {"category":category_name,"associate_word":[]}
    
    df1 = filter_df(df,time1,granularity)
    df2 = filter_df(df,time2,granularity)
    
    #  extract brand name relevant text
    def compute_consumer_perception(df):
        pattern = "|".join([rf"\b{re.escape(b)}\b" for b in brand_in_category])
        relevant_texts = (
            df["clean_text"]
            .astype(str)
            .loc[lambda s: s.str.contains(pattern, case=False, na=False)]
            .tolist()
        )

        if not relevant_texts:
            return {"category": category_name,"associated_words": []}

        # Step 4️⃣ extract keyword
        associated_words = extract_clean_brand_keywords_auto(
            relevant_texts,
            brand_name="",
            top_k=top_k
        )

        # Step 6️⃣ print result
        return {"associated_words": associated_words}
    block1 = compute_consumer_perception(df1)
    block2 = compute_consumer_perception(df2)
    return {
        "category_name":category_name,
        "granularity":granularity,
        "compare":{
            str(time1):block1,
            str(time2):block2,
        },
    }
# --- keyword frequency ---

# ---------- Helper: Extract context ----------
def extract_category_context(df, brand_list, window_size=6, merge_overlap=True):
    indices = []
    for i, text in enumerate(df["clean_text"].dropna()):
        t = text.lower()
        if any(re.search(rf"\b{re.escape(b)}\b", t) for b in brand_list):
            start = max(0, i - window_size)
            end = min(len(df), i + window_size + 1)
            indices.append((start, end))
    if not indices:
        return []

    # Merge overlapping windows
    if merge_overlap:
        merged = []
        current_start, current_end = indices[0]
        for s, e in indices[1:]:
            if s <= current_end:
                current_end = max(current_end, e)
            else:
                merged.append((current_start, current_end))
                current_start, current_end = s, e
        merged.append((current_start, current_end))
        indices = merged


    # Collect context
    contexts = []
    for s, e in indices:
        subset = df.iloc[s:e]
        contexts.append(subset["clean_text"].tolist())
    return [t for ctx in contexts for t in ctx]

# ---------- Main API ----------
@router.get("/category/keyword-frequency")
def category_keyword_frequency(
    category_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]] = Query(None),
    group_year:Optional[List[int]]=Query(None),
    window_size: int = 6,
    merge_overlap: bool = True,
):
    # ---- 1. Identify brands in the category ----
    brand_in_category = [b for b, cats in brand_category_map.items() if category_name in cats]
    if not brand_in_category:
        return {"error": f"Category '{category_name}' not found or has no brands."}

    # ---- 2. Merge all keywords for those brands ----
    category_keywords = []
    for b in brand_in_category:
        category_keywords.extend(brand_keyword_dict.get(b, []))
    category_keywords = list(set(category_keywords))

    # ---- 3. Query chat data ----
    query = "SELECT clean_text,year,month,quarter FROM chat WHERE clean_text IS NOT NULL"
    params = []

    if group_year and not group_id:
        group_id = load_groups_by_year(group_year)
    if not group_id:
        group_id = load_default_groups()
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    df = query_chat(query, params)
    if df.empty:
        return {"category": category_name, "keywords": []}

    df1 = filter_df(df,time1,granularity)
    df2 = filter_df(df,time2,granularity)
    def compute_kw_freq(df):
        # ---- 4. Extract relevant text context ----
        context_texts = extract_category_context(df, brand_in_category,
                                                window_size=window_size,
                                                merge_overlap=merge_overlap)
        if not context_texts:
            return {"category": category_name, "keywords": []}

        # ---- 5. Count keyword frequency ----
        freq_counter = Counter()
        for text in context_texts:
            words = re.findall(r"\w+", text.lower())
            for kw in category_keywords:
                if kw.lower() in words:
                    freq_counter[kw] += 1

        # ---- 6. Fallback if no keywords ----
        if not freq_counter:
            all_words = " ".join(context_texts).split()
            filtered_words = [w for w in all_words if w.isalpha() and len(w) > 2]
            counter = Counter(filtered_words)
            top_fallback = [{"keyword": w, "count": c} for w, c in counter.most_common(5)]
            return {"category": category_name, "keywords": top_fallback}


        result = [{"keyword": kw, "count": freq} for kw, freq in freq_counter.items()]
        result.sort(key=lambda x: x["count"], reverse=True)
        return {"total_mentions":len(context_texts),"keywords":result}
    
    block1 = compute_kw_freq(df1)
    block2 = compute_kw_freq(df2)
    return {
        "category": category_name,
        "granularity":granularity,
        "compare": {
            str(time1): block1,
            str(time2): block2,
        },
    }
