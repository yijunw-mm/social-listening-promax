from fastapi import APIRouter, Query
from typing import Optional, List 
import pandas as pd
from keybert import KeyBERT
from collections import Counter
import sys 
sys.path.append("..")
from backend.model_loader import kw_model,encoder
from concurrent.futures import ThreadPoolExecutor, as_completed
import random
from backend.data_loader import load_chat_data, load_default_groups,query_chat

router = APIRouter()

# load data
df_kw = pd.read_csv("data/other_data/general_kw_list.csv")
keyword_list = df_kw['keywords'].tolist()
df_stage= pd.read_csv("data/processing_output/groups.csv",dtype={"group_id":str})

@router.get("/keyword-frequency")
def keyword_frequency(group_id: Optional[List[str]] = Query(None),
                      stage: Optional[str]=None,
                      year: Optional[int] = None,
                      month: Optional[List[int]] = Query(None),
                      quarter: Optional[int] = None):
    
    #-- default group --
    if not group_id and not stage:
        group_id = load_default_groups()
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
    word_list = all_text.split()

    keyword_counts = Counter([word for word in word_list if word in keyword_list])

    # --- 4. Return result --- #
    return [{"keyword": k, "count": v} for k, v in keyword_counts.items()]

@router.get("/new-keyword-prediction")
def new_keyword_prediction(group_id: Optional[List[str]] = Query(None),
                           year: Optional[int]=None,
                           month: Optional[int] = None,
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


@router.get("/chat-number")
def get_groups():
    groups = df_stage['group_id'].unique().tolist()
    result = [{'id':gid} for gid in groups]
    return{
        "total":len(groups),
        "groups":result
    }
