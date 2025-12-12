from fastapi import APIRouter, Query
from typing import List, Optional,Literal
import pandas as pd
from collections import Counter, defaultdict
import json, duckdb
import re
from sentence_transformers import SentenceTransformer, util
import spacy
from backend.model_loader import kw_model,encoder
from backend.routers.brand_tab2 import custom_keywords_dict
from backend.data_loader import query_chat, load_default_groups,load_groups_by_year

router = APIRouter()
DB_PATH="data/chat_cache.duckdb"
def load_cat_data():
    con= duckdb.connect(DB_PATH)
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
    return df_cat 
def extract_brand_context(df: pd.DataFrame, brand: str, brand_keyword_map: dict,
                          window_size: int = 6, merge_overlap: bool = True):

    indices = []
    for row in df.itertuples(index=False):
        text=row.clean_text.lower()
        if re.search(rf"\b{re.escape(brand)}\b",text):
            start = max(1, row.row_id - window_size)
            end = row.row_id + window_size 
            subset = df[
                (df["group_id"] == row.group_id) &
                (df["row_id"].between(start,end))]
            indices.append((row.group_id,start, end))
    if not indices:
        return []

    # combine overlap window
    merged = []
    for gid in set(i[0] for i in indices):
        group_indices = [(s, e) for g, s, e in indices if g == gid]
        group_indices.sort()

        current_start, current_end = group_indices[0]
        for s, e in group_indices[1:]:
            if s <= current_end:
                current_end = max(current_end, e)
            else:
                merged.append((gid, current_start, current_end))
                current_start, current_end = s, e
        merged.append((gid, current_start, current_end))


    # collect corpus
    contexts = []
    for gid, s, e in merged:
        subset = df[(df["group_id"] == gid) & (df["row_id"].between(s, e))]
        contexts.append({
            "group_id":gid,
            "start_idx": s,
            "end_idx": e,
            "context": subset["clean_text"].tolist()
        })

    return contexts

def count_keywords_sql(
    df_subset: pd.DataFrame,
    brand: str,
    all_keywords: list[str],
    window_size: int = 6
):
    """extract context in sql + remove overlap + keyword counting"""
    if df_subset.empty:
        return [{"keyword": k, "count": 0} for k in all_keywords]


    # register DuckDB temportary table
    duckdb.register("df_temp", df_subset)


    # 1.  SQL-safe regex pattern
    brand_pattern = re.escape(brand.lower())
    keyword_values_sql = ", ".join([f"('{re.escape(k.lower())}')" for k in all_keywords])


    # 2. basic query：window chat + QUALIFY remove overlap+ keyword counting
    query = f"""
    WITH brand_rows AS (
        SELECT 
            group_id,
            row_id
        FROM df_temp
        WHERE regexp_matches(lower(clean_text), '{brand_pattern}')
    ),
    context_rows AS (
        SELECT 
            c.group_id,
            c.row_id,
            lower(c.clean_text) AS clean_text,
            COUNT(*) OVER (PARTITION BY c.group_id, c.row_id) AS overlap_count
        FROM df_temp c
        JOIN brand_rows b
          ON c.group_id = b.group_id
         AND c.row_id BETWEEN b.row_id - {window_size} AND b.row_id + {window_size}
        QUALIFY overlap_count = 1
    ),
    keywords AS (
        SELECT kw FROM (VALUES {keyword_values_sql}) AS t(kw)
    )
    SELECT 
        k.kw AS keyword,
        COUNT(*) AS count
    FROM context_rows c
    JOIN keywords k
      ON regexp_matches(c.clean_text, k.kw)
    GROUP BY k.kw
    HAVING count >0 --only return keywords count>0
    ORDER BY count DESC
    """

    df_result = duckdb.sql(query).df()
    duckdb.unregister("df_temp")

    return df_result.to_dict(orient="records")



@router.get("/brand/time-compare/frequency")
def compare_keyword_frequency(
    brand_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]] = Query(None),
    group_year:Optional[List[int]]=Query(None),
    window_size: int =6
):
    df_cat = load_cat_data()
    brand_keyword_dict = df_cat.groupby("brand")["keyword"].apply(list).to_dict()
    if brand_name not in brand_keyword_dict:
        return {"error": f"Brand '{brand_name}' not found."}
    base_keywords = set(brand_keyword_dict[brand_name])
    custom_keywords = custom_keywords_dict.get(brand_name, set())
    all_keywords = list(base_keywords.union(custom_keywords))
    #keywords = brand_keyword_dict[brand_name]

    # --- 2. basic query
    query = """
    SELECT 
        group_id, year, month, quarter,
        row_number() over (PARTITION BY group_id ORDER BY datetime) AS row_id,
        clean_text 
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
        return {"error": "No available data"}
    
    df["clean_text"] = df["clean_text"].fillna("").astype(str)

    # ---- 5. filter by each time ----
    def filter_df(df: pd.DataFrame, time: int):
        if granularity == "year":
            return df[df["year"] == time]
        elif granularity == "month":
            y, m = divmod(time, 100)
            return df[(df["year"] == y) & (df["month"] == m)]
        elif granularity == "quarter":
            y, q = divmod(time, 10)
            return df[(df["year"] == y) & (df["quarter"] == q)]

    df1 = filter_df(df,time1)
    df2 = filter_df(df,time2)

    return {
        "brand": brand_name,
        "granularity": granularity,
        "compare": {
            str(time1): count_keywords_sql(df1,brand_name,all_keywords,window_size),
            str(time2): count_keywords_sql(df2,brand_name,all_keywords,window_size)
        }
    }



def _normalize_quotes(s: str) -> str:
    if not isinstance(s, str):
        return ""
    return (
        s.replace("’", "'")
         .replace("‘", "'")
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
    pattern = rf"(?<!\w){k}(?!\w)"
    return re.compile(pattern, flags=re.IGNORECASE)

def count_kw(context_texts, keywords):
    patterns = {kw: _build_keyword_pattern(kw) for kw in keywords}
    cnt = Counter()
    for text in context_texts:
        t = _normalize_quotes(text)
        for kw, patt in patterns.items():
            matches = patt.findall(text)
            #if patt.search(t):
            cnt[kw] += len(matches)
    return cnt

#------share of voice--------
@router.get("/category/time-compare/share-of-voice")
def category_share_of_voice_compare(
    category_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]]=Query(None),
    group_year:Optional[List[int]]=Query(None)
):
    #find the category
    df_cat = load_cat_data()
    brand_category_map = defaultdict(list)
    for _,row in df_cat.iterrows():
        brand = str(row["brand"]).strip().lower()
        category = str(row["category"]).strip()
        brand_category_map[brand].append(category)

    brand_in_category = [b for b, cats in brand_category_map.items() if category_name in cats]
    if not brand_in_category:
        return {"error": f"category '{category_name}' not found"}
    # --- 2. basic query
    pattern = "|".join([re.escape(b) for b in brand_in_category])
    regex_sql = f"\\b({pattern})\\b"

    query = f"""
    SELECT 
        group_id, clean_text, year, month, quarter
    FROM chat WHERE clean_text IS NOT NULL
        AND regexp_matches(clean_text,'{regex_sql}','i')"""
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
        return {"error":"No data available"}
    df["clean_text"] = df["clean_text"].fillna("").astype(str)
    

    def filter_df(df: pd.DataFrame, time: int):
        if granularity == "year":
            return df[df["year"] == time]
        elif granularity == "month":
            y, m = divmod(time, 100)   # 202508 → 2025, 08
            return df[(df["year"] == y) & (df["month"] == m)]
        elif granularity == "quarter":
            y, q = divmod(time, 10)    # 20252 → 2025, Q2
            return df[(df["year"] == y) & (df["quarter"] == q)]
        else:
            raise ValueError("Invalid granularity")


    # --- count share of voice ---
    def compute_share(df_subset):
        if df_subset.empty:
            return {"total_mentions": 0, "share_of_voice": []}
        counts = count_kw(df_subset["clean_text"].dropna(), brand_in_category)

        total = sum(counts.values())
        share_list = [
            {"brand": b, "count": c, "percent": round(c / total * 100, 1) if total > 0 else 0}
            for b, c in counts.items()
        ]
        return {"total_mentions": total, "share_of_voice": share_list}

    #analyze two time periods
    df1 = filter_df(df, time1)
    df2 = filter_df(df, time2)

    result = {
        "category": category_name,
        "granularity": granularity,
        "compare": {
            str(time1): compute_share(df1),
            str(time2): compute_share(df2)
        }
    }
    return result

#------consumer perception--------
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
        doc = nlp(phrase)
        return any(t.pos_ in ["ADJ", "NOUN"] for t in doc)
    keywords = [kw for kw in keywords if is_meaningful(kw)]

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

@router.get("/brand/time-compare/consumer-perception")
def compare_consumer_perception(
    brand_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]] = Query(None),
    group_year:Optional[List[int]]=Query(None),
    top_k: int = 20,
):  
    df_cat=load_cat_data()
    brand_keyword_dict = df_cat.groupby("brand")["keyword"].apply(list).to_dict()
    if brand_name not in brand_keyword_dict:
        return {"error": f"Brand '{brand_name}' not found."}
    # --- 2. basic query
    query = """
    SELECT 
        group_id, clean_text, year, month, quarter,
        row_number() over (PARTITION BY group_id ORDER BY datetime) AS row_id
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
        return {"error":"No data available"}
    df["clean_text"] = df["clean_text"].fillna("").astype(str)
    
    def filter_df(df: pd.DataFrame, time: int):
        if granularity == "year":
            return df[df["year"] == time]
        elif granularity == "month":
            y, m = divmod(time, 100)
            return df[(df["year"] == y) & (df["month"] == m)]
        elif granularity == "quarter":
            y, q = divmod(time, 10)
            return df[(df["year"] == y) & (df["quarter"] == q)]

    def compute_consumer_perception(df_subset):
        relevant_texts = (
            df_subset["clean_text"]
            .astype(str)
            .loc[lambda s: s.str.contains(rf"\b{re.escape(brand_name)}\b", case=False, na=False)]
            .tolist()
        )

        if not relevant_texts:
            return {"error": f"No mention about brand {brand_name}", "associated_words": []}

        associated_words = extract_clean_brand_keywords_auto(
            relevant_texts,
            brand_name,
            top_k=top_k
        )

        # Step 6️⃣ print result
        return {"associated_words": associated_words}

        
    return {
        "brand": brand_name,
        "granularity": granularity,
        "compare": {
            str(time1): compute_consumer_perception(filter_df(df, time1)),
            str(time2): compute_consumer_perception(filter_df(df, time2))
        }
    }
