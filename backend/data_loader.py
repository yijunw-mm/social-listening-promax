import pandas as pd
import duckdb
from functools import lru_cache

DB_PATH= "data/chat_cache.duckdb"

@lru_cache(maxsize=1)
def load_chat_data():
    print("load data using duckdb...")
    con = duckdb.connect(DB_PATH)
    con.execute("PRAGMA invalidate_cache;")
    con.execute("""
        CREATE OR REPLACE VIEW chat AS 
        SELECT 
            *,
            CAST(year AS INTEGER) AS year, 
            CAST(month AS INTEGER) AS month,
            CAST(quarter AS INTEGER) AS quarter,
            CAST(group_id AS VARCHAR) AS group_id
        FROM read_parquet('data/processing_output/clean_chat_df/*/*.parquet');
    """)

    # extract all group_id for default setting
    group_ids = con.execute("SELECT DISTINCT group_id FROM chat").fetchdf()


    # latest 12 group as default（order by group_id）
    default_groups = sorted(group_ids["group_id"].tolist())[-12:]


    print(f"🔵 Loaded {len(group_ids)} groups")
    print(f"🔵 Default groups: {default_groups}")


    return con, default_groups

def refresh_duckdb_cache():
    load_chat_data.cache_clear()
    con = duckdb.connect(DB_PATH)
    con.execute("PRAGMA invalidate_cache;")
    con.close()
    print("clear duckdb cache")



def load_default_groups():
    """external API get default group_id list"""
    _, default_groups = load_chat_data()
    return default_groups


def load_groups_by_year(group_year: int) -> list:
    """
    Return all group_ids where the group_id starts with the given year.
    """
    con,_ =load_chat_data()

    query = """
    SELECT DISTINCT group_id
    FROM chat
    WHERE CAST(SUBSTR(CAST(group_id AS VARCHAR), 1, 4) AS INT) = CAST(? AS INT)
    ORDER BY group_id
    """
    df= con.execute(query,[group_year]).fetch_df()
    return df["group_id"].tolist()


def load_available_years() -> list:
    """
    Return all distinct years extracted from group_id (first 4 characters).
    """
    con, _ = load_chat_data()

    query = """
    SELECT DISTINCT CAST(SUBSTR(CAST(group_id AS VARCHAR), 1, 4) AS INT) AS year
    FROM chat
    ORDER BY year DESC
    """
    df = con.execute(query).fetch_df()
    return df["year"].tolist()


def query_chat(sql: str, params=None):
    """
    general DuckDB query
    all API just need pass SQL
    """
    con, _ = load_chat_data()
    return con.execute(sql, params).fetchdf()



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
    con, _ = load_chat_data()
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
    con, _ = load_chat_data()
    init_sentiment_cache(con)
    con.execute("""
        INSERT INTO sentiment_cache VALUES (?, ?, ?, ?, ?)
    """, [text, sentiment, score, rule_applied, datetime.now()])


def get_all_cached_sentiments(limit: int = 1000):
    con, _ = load_chat_data()
    init_sentiment_cache(con)
    return con.execute("SELECT * FROM sentiment_cache LIMIT ?", [limit]).fetch_df()


def update_sentiment_cache(text: str, new_sentiment: str, new_score: float = None, new_rule: str = None):
    """
    update the setement label(human changes)
    """
    con, _ = load_chat_data()
    init_sentiment_cache(con)
    con.execute("""
        UPDATE sentiment_cache
        SET sentiment = ?, 
            score = COALESCE(?, score),
            rule_applied = COALESCE(?, rule_applied),
            updated_at = CURRENT_TIMESTAMP
        WHERE text = ?
    """, [new_sentiment, new_score, new_rule, text])