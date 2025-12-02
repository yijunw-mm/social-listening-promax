import pandas as pd
import duckdb, threading
from typing import Union, List
from functools import lru_cache

#DB_PATH= ":memory:"
DB_PATH = "data/chat_cache.duckdb"

# Thread-local storage: ensures each thread has its own connection object
_thread_local = threading.local()

def get_read_connection():
    """
    Return a thread-local, read-only DuckDB connection.
    Each FastAPI/Streamlit worker thread will have its own connection
    """
    if not hasattr(_thread_local, "con"):
        _thread_local.con = duckdb.connect(DB_PATH)
    return _thread_local.con


def get_write_connection():
    """
    a temporary connection,
    The connection should be closed immediately after writing.
    """
    return duckdb.connect(DB_PATH)

@lru_cache(maxsize=1)
def load_chat_data():
    print("load data using duckdb...")
    con = get_read_connection()

    df = con.execute(""" 
        SELECT 
            *,
            CAST(year AS INTEGER) AS year, 
            CAST(month AS INTEGER) AS month,
            CAST(quarter AS INTEGER) AS quarter,
            CAST(group_id AS VARCHAR) AS group_id
        FROM read_parquet('data/processing_output/clean_chat_df/*/*.parquet');
    """).fetchdf()

    # extract all group_id for default setting
    group_ids = sorted(df['group_id'].unique().tolist())

    # latest 12 group as default（order by group_id）
    default_groups = group_ids[-12:]


    print(f"🔵 Loaded {len(group_ids)} groups")
    print(f"🔵 Default groups: {default_groups}")


    return df, default_groups


def load_default_groups():
    """external API get default group_id list"""
    _, default_groups = load_chat_data()
    return default_groups


def load_groups_by_year(group_year: Union[int,List[int]]) -> list:
    """
    Return all group_ids where the group_id starts with the given year.
    """
    df,_ =load_chat_data()

    df['group_year'] = df['group_id'].astype(str).str[:4].astype(int)
    if isinstance(group_year,int):
        years = [group_year]
    else:
        years = group_year
    result = sorted(df[df["group_year"].isin(years)]["group_id"].unique().tolist())
    return result


def load_available_years() -> list:
    """
    Return all distinct years extracted from group_id (first 4 characters).
    """
    df, _ = load_chat_data()
    group_years = sorted(
        df['group_id'].astype(str).str[:4].astype(int).unique().tolist(),
        reverse=True
    )
    return group_years


def query_chat(sql: str, params=None):
    """
    general DuckDB query
    all API just need pass SQL
    """
    con = get_read_connection()
    return con.execute(sql, params).fetchdf()

def refresh_duckdb_cache():
    """clear in-memory cache"""
    load_chat_data.cache_clear()
    print("clear cache, will reload next call")

# === sentiment cache layer ===
from datetime import datetime

def init_sentiment_cache(con):
    """initialize cache table(just execute once)"""
    con.execute("""
    CREATE TABLE IF NOT EXISTS sentiment_cache (
        text VARCHAR,
        sentiment VARCHAR,
        score DOUBLE,
        rule_applied VARCHAR,
        updated_at TIMESTAMP
    )
    """)

def get_cached_sentiment(text: str):
    """query from cached table"""
    con = get_read_connection()
    init_sentiment_cache(con)
    result = con.execute(
        "SELECT sentiment, score, rule_applied FROM sentiment_cache WHERE text = ?", 
        [text]
    ).fetchone()
    if result:
        return {"sentiment": result[0], "score": result[1], "rule_applied": result[2]}
    return None


def save_sentiment_cache(text: str, sentiment: str, score: float, rule_applied: str):
    """save predicted sentiment to DuckDB"""
    con = get_write_connection()
    init_sentiment_cache(con)
    con.execute("""
        INSERT INTO sentiment_cache VALUES (?, ?, ?, ?, ?)
    """, [text, sentiment, score, rule_applied, datetime.now()])
    con.close()

def get_all_cached_sentiments(limit: int = 1000):
    con = get_read_connection()
    init_sentiment_cache(con)
    return con.execute("SELECT * FROM sentiment_cache LIMIT ?", [limit]).fetch_df()


def update_sentiment_cache(text: str, new_sentiment: str, new_score: float = None, new_rule: str = None):
    """
    update the setement label(human changes)
    """
    con = get_write_connection()
    init_sentiment_cache(con)
    con.execute("""
        UPDATE sentiment_cache
        SET sentiment = ?, 
            score = COALESCE(?, score),
            rule_applied = COALESCE(?, rule_applied),
            updated_at = CURRENT_TIMESTAMP
        WHERE text = ?
    """, [new_sentiment, new_score, new_rule, text])
    con.close()
