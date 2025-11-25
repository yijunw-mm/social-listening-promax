from fastapi import APIRouter, Query
from typing import List, Optional,Literal
import pandas as pd
from collections import Counter, defaultdict
import json
import re
from backend.routers.brand_tab2 import custom_keywords_dict
from backend.data_loader import query_chat, load_default_groups,load_groups_by_year

router = APIRouter()

# load brand keywrod
brand_keyword_df = pd.read_csv("data/other_data/newest_brand_keywords.csv",keep_default_na=False,na_values=[""])  
brand_keyword_dict = brand_keyword_df.groupby("brand")["keyword"].apply(list).to_dict()
# temporary store user-add keywords
#custom_keywords_dict = {brand: set() for brand in brand_keyword_dict}


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

@router.get("/brand/time-compare/frequency")
def compare_keyword_frequency(
    brand_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]] = Query(None),
    group_year:Optional[int]=None,
    window_size: int =6,
    merge_overlap:bool=True
):
    
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


    def count_keywords(df_subset):
        contexts = extract_brand_context(
            df_subset, brand=brand_name,
            brand_keyword_map=brand_keyword_dict,
            window_size=window_size,
            merge_overlap=merge_overlap
        )
        if not contexts:
            return {"error":f"No mention about brand {brand_name}"}
        
        context_texts = []
        for c in contexts:
            context_texts.extend(t for t in c["context"] if isinstance(t,str))
        
        # -- count frequency ---
        freq_counter = Counter()
        for text in context_texts:
            t = text.lower()
            for kw in all_keywords:
                if re.search(rf"\b{re.escape(kw.lower())}\b", t):
                    freq_counter[kw] += 1
        if not freq_counter:
            all_words = " ".join(context_texts).split()
            filtered_words = [w for w in all_words if w.isalpha() and len(w)>2]
            counter = Counter(filtered_words)
            top_fallback = [{"keyword":w, "count":c} for w, c in counter.most_common(5)]
            return top_fallback
        #return dict(counter)
        return [{"keyword":k,"count":v} for k,v in freq_counter.items()]

    return {
        "brand": brand_name,
        "granularity": granularity,
        "compare": {
            str(time1): count_keywords(filter_df(df, time1)),
            str(time2): count_keywords(filter_df(df, time2))
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
    pattern = rf"(?<![A-Za-z0-9]){k}(?![A-Za-z0-9])"
    return re.compile(pattern, flags=re.IGNORECASE)

def count_kw(context_texts, keywords):
    patterns = {kw: _build_keyword_pattern(kw) for kw in keywords}
    cnt = Counter()
    for text in context_texts:
        t = _normalize_quotes(text)
        for kw, patt in patterns.items():
            if patt.search(t):
                cnt[kw] += 1
    return cnt

#------share of voice--------
@router.get("/category/time-compare/share-of-voice")
def category_share_of_voice_compare(
    category_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]]=Query(None),
    group_year:Optional[int]=None
):
    #find the category
    df_cat = pd.read_csv("data/other_data/newest_brand_keywords.csv")
    brand_category_map = defaultdict(list)
    for _,row in df_cat.iterrows():
        brand = str(row["brand"]).strip().lower()
        category = str(row["category"]).strip()
        brand_category_map[brand].append(category)

    brand_in_category = [b for b, cats in brand_category_map.items() if category_name in cats]
    if not brand_in_category:
        return {"error": f"category '{category_name}' not found"}
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
        return {"error":"No data available"}
    df["clean_text"] = df["clean_text"].fillna("").astype(str)
    

    def filter_df(df: pd.DataFrame, time: int):
        if granularity == "year":
            return df[df["year"] == time]
        elif granularity == "month":
            y, m = divmod(time, 100)   # 202508 → 2025, 8
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
@router.get("/brand/time-compare/consumer-perception")
def compare_consumer_perception(
    brand_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]] = Query(None),
    group_year:Optional[int]=None,
    top_k: int = 20,
    window_size: int = 6,
    merge_overlap: bool = True
):

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

    def get_associated_words(df_subset):
        contexts = extract_brand_context(
            df_subset,
            brand=brand_name,
            brand_keyword_map=brand_keyword_dict,
            window_size=window_size,
            merge_overlap=merge_overlap
        )

        if not contexts:
            return {"error": f"No mention about brand {brand_name}", "associated_words": []}

        context_texts = []
        for c in contexts:
            context_texts.extend(t for t in c["context"] if isinstance(t, str))

        # Extract words excluding brand keywords
        all_words = []
        brand_keywords_lower = [kw.lower() for kw in brand_keyword_dict[brand_name]]

        for text in context_texts:
            words = re.findall(r"\w+", text.lower())
            filtered = [w for w in words if w not in brand_keywords_lower and len(w) > 2 and w.isalpha()]
            all_words.extend(filtered)

        word_counter = Counter(all_words)
        top_words = [{"word": w, "count": c} for w, c in word_counter.most_common(top_k)]

        return {"associated_words": top_words}

    return {
        "brand": brand_name,
        "granularity": granularity,
        "compare": {
            str(time1): get_associated_words(filter_df(df, time1)),
            str(time2): get_associated_words(filter_df(df, time2))
        }
    }
