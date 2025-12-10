from fastapi import APIRouter, Query
from typing import Optional, List, Literal
import pandas as pd
from keybert import KeyBERT
from collections import Counter,defaultdict
import sys 
sys.path.append("..")
from backend.model_loader import kw_model,encoder
from concurrent.futures import ThreadPoolExecutor, as_completed
import random,math, re,itertools,duckdb
from backend.data_loader import load_groups_by_year, load_default_groups, query_chat, load_available_years
from itertools import combinations

router = APIRouter()
DB_PATH="data/chat_cache.duckdb"
con= duckdb.connect(DB_PATH)
df_kw = con.execute("SELECT gen_keyword FROM general_keywords").fetchdf()

#df_kw = pd.read_csv("data/other_data/general_kw_list.csv")
keyword_list = df_kw['gen_keyword'].tolist()
con.close()

#define filter function
def filter_df(df: pd.DataFrame, time: int, granularity):
        if granularity == "year":
            return df[df["year"] == time]
        elif granularity == "month":
            y, m = divmod(time, 100)
            return df[(df["year"] == y) & (df["month"] == m)]
        elif granularity == "quarter":
            y, q = divmod(time, 10)
            return df[(df["year"] == y) & (df["quarter"] == q)]
        
@router.get("/keyword-frequency")
def keyword_frequency(granularity: Literal["year", "month", "quarter"],
                      time1: int,
                      time2: int,
                      group_id: Optional[List[str]] = Query(None),
                      group_year: Optional[List[int]]=Query(None),
                      stage: Optional[str]=None):
    #df_stage= pd.read_csv("data/processing_output/groups.csv",dtype={"group_id":str})
    con= duckdb.connect(DB_PATH)
    df_stage = con.execute("SELECT group_id FROM groups").fetchdf()
    con.close()

    #-- default group --
    if group_year and not group_id:
        group_id = load_groups_by_year(group_year) 
    if not group_id and not stage:
        group_id = load_default_groups()
       
    #-- base query --
    query = """
        SELECT clean_text, year, month, quarter
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
    # ----- 2. Execute query -----
    #df = con.execute(query, params).fetchdf()
    df = query_chat(query,params)

    df1 = filter_df(df,time1,granularity)
    df2 = filter_df(df,time2,granularity)

    def compute_keyword_freq(df):
        if df.empty:
            return {"keywords": []}

        # --- 3. Keyword frequency calculation --- #
        all_text = " ".join(df["clean_text"].dropna().astype(str).tolist())
        keyword_counts=Counter()
        for kw in keyword_list:
            keyword_counts[kw]=len(re.findall(rf"\b{re.escape(kw)}(s|es)?\b",all_text))

        # --- 4. Return result --- #
        return [{"keyword": k, "count": int(v)} for k, v in keyword_counts.items() if v>0]

    block1 = compute_keyword_freq(df1)
    block2 = compute_keyword_freq(df2)
    return {
        "granularity":granularity,
        "compare":{
            str(time1):block1,
            str(time2):block2,
        },
    }
@router.get("/new-keyword-prediction")
def new_keyword_prediction(granularity: Literal["year", "month", "quarter"],
                           time1: int,
                           time2: int,
                           group_id: Optional[List[str]] = Query(None),
                           group_year: Optional[List[int]]=Query(None),
                           top_k: int = 10):
    # ---- 1. Base SQL ----
    sql = """
        SELECT clean_text,year, month,quarter
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

    # ---- 4. Query DuckDB ----
    df = query_chat(sql, params)

    if df.empty:
        return {"keywords": []}
    df1 = filter_df(df,time1,granularity)
    df2 = filter_df(df,time2,granularity)

    # ---- 5. Extract text list ----
    texts1 = df["clean_text"].astype(str).tolist()
    texts2 = df["clean_text"].astype(str).tolist()

    # ---- 6. Random sample since too large ----
    max_docs = 5000
    random.seed(42)
    if len(texts1) > max_docs:
        texts1 = random.sample(texts1, max_docs)
    if len(texts2) > max_docs:
        texts2 = random.sample(texts2, max_docs)

    # ---- 7. Warmup ----
    encoder.encode(["warmup"], show_progress_bar=False)

    # ---- 8. KeyBERT in parallel ----
    def extract_keywords(texts):
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
        return all_keywords
    all_kw1 =extract_keywords(texts1)
    all_kw2 = extract_keywords(texts2)

    # ---- 9. Keep top scoring keywords ----
    def rank_keywords(all_keywords):
        keyword_score_map = {}
        for kw, score in all_keywords:
            if kw not in keyword_list:   # remove known keywords
                if kw not in keyword_score_map or score > keyword_score_map[kw]:
                    keyword_score_map[kw] = score
        return sorted(keyword_score_map.items(),key=lambda x:x[1],reverse=True)[:top_k]

    ranked1 = rank_keywords(all_kw1)
    ranked2 = rank_keywords(all_kw2)

    keywords1 = [{"keyword":k, "score":s} for k,s in ranked1]
    keywords2 = [{"keyword":k, "score":s} for k,s in ranked2]
    return {
        "granularity":granularity,
        "compare":{
            str(time1): keywords1,
            str(time2): keywords2,
        },
    }
@router.get("/keyword/co-occurrence")
def keyword_cooccurrence(
    keyword: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]] = Query(None),
    group_year: Optional[List[int]] = Query(None), 
    top_n: int = 30,                
):

    # === 1. basic query ===
    query = """
    SELECT group_id, year, month, quarter,
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

    df = query_chat(query, params)
    if df.empty:
        return {"error": "No chat data found."}

    df["clean_text"] = df["clean_text"].fillna("").astype(str)
    # === 2.filter short msg ===
    kw = keyword.lower()
    df1 = filter_df(df,time1, granularity)
    df2 = filter_df(df,time2,granularity)

    def compute_cooccurrence(df,kw):
        # === extract msg include keyword ===
        df = df[df["clean_text"].str.len() >= 5]
        df_kw = df[df["clean_text"].str.contains(rf"\b{re.escape(kw)}\b", case=False)]
        if df_kw.empty:
            return pd.DataFrame(columns=["word1","word2","count","pmi"])
        texts = df_kw["clean_text"].tolist()
        #== statistical count ===
        cooc = defaultdict(int)
        word_freq = Counter()
        total_pairs = 0

        for text in texts:
            pattern_kw = rf"(?<!\w){re.escape(kw.lower())}(?!\w)"
            clean_text = re.sub(pattern_kw, "", text.lower())

            tokens = re.findall(r"\b[a-z]{3,}\b", clean_text)
        
            # update frequency
            word_freq.update(tokens)
            # only one combination
            for a, b in itertools.combinations(sorted(set(tokens)), 2):
                cooc[(a, b)] += 1
                total_pairs += 1

        if not cooc:
            return pd.DataFrame(columns=["word1", "word2", "count", "pmi"])
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
            return pd.DataFrame(columns=["word1", "word2", "count", "pmi"])

        df_result = pd.DataFrame(result, columns=["word1", "word2", "count", "pmi"])

        # === 6. threshold and filter ===
        df_result['score'] = df_result.apply(lambda r: r['pmi']*math.log2(r['count']+1),axis=1)
        return df_result.sort_values("score", ascending=False).head(top_n)
    
    df1_res = compute_cooccurrence(df1,kw)
    df2_res = compute_cooccurrence(df2,kw)
    
    return {
        "keyword": keyword,
        "granularity":granularity,
        "compare":{
            str(time1):{
                "top_pairs": df1_res.to_dict(orient="records"),
            },
            str(time2):{
                "top_pairs": df2_res.to_dict(orient="records"),
                },
            },
        }


@router.get("/chat-number")
def get_groups():
    #df_stage= pd.read_csv("data/processing_output/groups.csv",dtype={"group_id":str})
    con= duckdb.connect(DB_PATH)
    df_stage = con.execute("SELECT group_id FROM groups").fetchdf()
    con.close()
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

@router.get("/dropdown-list")
def get_cat_brand():
    """
    Get all brand list and category list for fronted display
    """
    con= duckdb.connect(DB_PATH)
    df_cat = con.execute(
        "SELECT DISTINCT category_name FROM categories"
    ).fetchdf()
    df_brand = con.execute(
        "SELECT DISTINCT brand_name FROM brands"
    ).fetchdf()
    con.close()
    return {
        "category":df_cat["category_name"].tolist(),
        "brand":df_brand["brand_name"].tolist()
    }

