from fastapi import APIRouter, Query
from typing import Optional, List 
import pandas as pd
from keybert import KeyBERT
from collections import Counter,defaultdict
import sys 
sys.path.append("..")
from backend.model_loader import kw_model,encoder
from concurrent.futures import ThreadPoolExecutor, as_completed
import random,math, re,itertools
from backend.data_loader import load_groups_by_year, load_default_groups, query_chat, load_available_years
from itertools import combinations

router = APIRouter()

# load data
df_kw = pd.read_csv("data/other_data/general_kw_list.csv")
keyword_list = df_kw['keywords'].tolist()
df_stage= pd.read_csv("data/processing_output/groups.csv",dtype={"group_id":str})

@router.get("/keyword-frequency")
def keyword_frequency(group_id: Optional[List[str]] = Query(None),
                      group_year: Optional[int]=None,
                      stage: Optional[str]=None,
                      year: Optional[int] = None,
                      month: Optional[List[int]] = Query(None),
                      quarter: Optional[int] = None):
    
    #-- default group --
    if not group_id and not stage:
        group_id = load_default_groups()
    if group_year and not group_id:
        group_id = load_groups_by_year(group_year)    
    #-- base query --
    query = """
        SELECT clean_text
        FROM chat
        WHERE 1=1
        """
    params =[]
    #filter by group_id
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    # Filter by stage
    if stage:
        stage_ids = df_stage[df_stage["stage"] == stage]["group_id"].tolist()
        if stage_ids:
            query += " AND group_id IN (" + ",".join(["?"] * len(stage_ids)) + ")"
            params.extend(stage_ids)

    # Filter by message time
    if year:
        query += " AND year = ?"
        params.append(year)

    if month:
        query += " AND month IN (" + ",".join(["?"] * len(month)) + ")"
        params.extend(month)

    if quarter:
        query += " AND quarter = ?"
        params.append(quarter)

    # ----- 2. Execute query -----
    #df = con.execute(query, params).fetchdf()
    df = query_chat(query,params)
    if df.empty:
        return {"keywords": []}

    # --- 3. Keyword frequency calculation --- #
    all_text = " ".join(df["clean_text"].dropna().astype(str).tolist())
    keyword_counts=Counter()
    for kw in keyword_list:
        keyword_counts[kw]=len(re.findall(rf"\b{re.escape(kw)}\b",all_text))

    # --- 4. Return result --- #
    return [{"keyword": k, "count": int(v)} for k, v in keyword_counts.items() if v>0]

@router.get("/new-keyword-prediction")
def new_keyword_prediction(group_id: Optional[List[str]] = Query(None),
                           group_year: Optional[int]=None,
                           year: Optional[int]=None,
                           month: Optional[List[int]] = Query(None),
                           quarter: Optional[int] = None,
                           top_k: int = 10):
    # ---- 1. Base SQL ----
    sql = """
        SELECT clean_text
        FROM chat
        WHERE clean_text IS NOT NULL
        """
    params = []

    # ---- 2. Default groups ----
    if group_year and not group_id:
        group_id = load_groups_by_year(group_year)
    if not group_id:
        group_id = load_default_groups()

    # ---- 3. Filter by group_id ----
    if group_id:
        sql += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    # ---- Filter by date ----
    if year:
        sql += " AND year = ?"
        params.append(year)

    if month:
        sql += " AND month IN (" + ",".join(["?"] * len(month)) + ")"
        params.extend(month)

    if quarter:
        sql += " AND quarter = ?"
        params.append(quarter)

    # ---- 4. Query DuckDB ----
    df = query_chat(sql, params)

    if df.empty:
        return {"keywords": []}

    # ---- 5. Extract text list ----
    texts = df["clean_text"].astype(str).tolist()

    # ---- 6. Random sample since too large ----
    max_docs = 5000
    if len(texts) > max_docs:
        random.seed(42)
        texts = random.sample(texts, max_docs)

    # ---- 7. Warmup ----
    encoder.encode(["warmup"], show_progress_bar=False)

    # ---- 8. KeyBERT in parallel ----
    batch_size = 100
    all_keywords = []

    def process_chunk(start):
        chunk_text = " ".join(texts[start:start+batch_size])
        try:
            return kw_model.extract_keywords(
                chunk_text,
                keyphrase_ngram_range=(1, 2),
                stop_words='english',
                top_n=10,
                use_mmr=True,
                diversity=0.6
            )
        except Exception as e:
            print(f"Error at batch {start}: {e}")
            return []

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(process_chunk, i)
            for i in range(0, len(texts), batch_size)
        ]
        for f in as_completed(futures):
            all_keywords.extend(f.result())

    # ---- 9. Keep top scoring keywords ----
    keyword_score_map = {}
    for kw, score in all_keywords:
        if kw not in keyword_list:   # remove known keywords
            if kw not in keyword_score_map or score > keyword_score_map[kw]:
                keyword_score_map[kw] = score

    ranked = sorted(keyword_score_map.items(), key=lambda x: x[1], reverse=True)[:top_k]

    return [{"keyword": k, "score": s} for k, s in ranked]

@router.get("/keyword/co-occurrence")
def keyword_cooccurrence(
    keyword: str,
    group_id: Optional[List[str]] = Query(None),
    group_year: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[List[int]] = Query(None),
    quarter: Optional[int] = None,
    count_threshold: int = 2,       
    pmi_threshold: float = 0.0,    
    top_n: int = 30,                
):

    # === 1. basic query ===
    query = """
    SELECT group_id,
           row_number() over (PARTITION BY group_id ORDER BY datetime) AS row_id,
           clean_text
    FROM chat
    WHERE clean_text IS NOT NULL
    """
    params = []

    if group_year and not group_id:
        group_id = load_groups_by_year(group_year)
    if not group_id:
        group_id = load_default_groups()
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)
    if year:
        query += " AND year = ?"
        params.append(year)
    if month:
        query += " AND month IN (" + ",".join(["?"] * len(month)) + ")"
        params.extend(month)
    if quarter:
        query += " AND quarter = ?"
        params.append(quarter)

    df = query_chat(query, params)
    if df.empty:
        return {"error": "No chat data found."}

    df["clean_text"] = df["clean_text"].fillna("").astype(str)
    kw = keyword.lower()

    # === 2.filter short msg ===
    df = df[df["clean_text"].str.len() >= 5]

    # === 3.extract msg include keyword ===
    df_kw = df[df["clean_text"].str.contains(rf"\b{re.escape(kw)}\b", case=False)]
    if df_kw.empty:
        return {"error": f"No messages found containing '{keyword}'."}

    texts = df_kw["clean_text"].tolist()

    # === 4.statical count ===
    cooc = defaultdict(int)
    word_freq = Counter()
    total_pairs = 0


    for text in texts:
        tokens = [w for w in re.findall(r"\b[a-z]{3,}\b", text.lower()) if len(w) >= 3]
        tokens = [w for w in tokens if w != kw]
       
        # update frequency
        word_freq.update(tokens)
        # only one combination
        for a, b in itertools.combinations(sorted(set(tokens)), 2):
            cooc[(a, b)] += 1
            total_pairs += 1

    if not cooc:
        return {"error": "No valid co-occurring words found."}


    # === 5. calculte pmi ===
    result = []
    total = total_pairs  
    for (w1, w2), c in cooc.items():
        p_w1 = word_freq[w1] / total
        p_w2 = word_freq[w2] / total
        p_w1w2 = c / total
        if p_w1w2 == 0 or p_w1 == 0 or p_w2 == 0:
            continue
        pmi = math.log2(p_w1w2 / (p_w1 * p_w2))
        if pmi <= 0:
            continue  # only keep positive relation
        result.append((w1, w2, c, round(pmi, 4)))


    if not result:
        return {"warning": "No positive PMI pairs found."}


    df_result = pd.DataFrame(result, columns=["word1", "word2", "count", "pmi"])


    # === 6. threshold and filter ===
    df_result = df_result[
        (df_result["count"] >= count_threshold) &
        (df_result["pmi"] >= pmi_threshold)
    ]
    if df_result.empty:
        return {"warning": f"No pairs meet threshold: count ≥ {count_threshold}, pmi ≥ {pmi_threshold}."}


    df_result = df_result.sort_values("pmi", ascending=False).head(top_n)


    # === 7.result ===
    co_words = Counter()
    for row in df_result.itertuples(index=False):
        co_words[row.word1] += 1
        co_words[row.word2] += 1
    top_related = co_words.most_common(top_n)

    return {
        "keyword": keyword,
        "max_count":float(df_result['count'].max()),
        "max_pmi":float(df_result["pmi"].max()),
        "top_pairs": df_result.to_dict(orient="records"),
        "top_related_words": [{"word": w, "freq": f} for w, f in top_related]
    }


@router.get("/chat-number")
def get_groups():
    groups = df_stage['group_id'].unique().tolist()
    result = [{'id':gid} for gid in groups]
    return{
        "total":len(groups),
        "groups":result
    }


@router.get("/available-years")
def get_available_years():
    """
    Get all distinct years from the group_id data.
    Returns a list of years in descending order.
    """
    years = load_available_years()
    return {
        "total": len(years),
        "years": years
    }
