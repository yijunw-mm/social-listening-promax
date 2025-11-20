import pandas as pd
import duckdb
from functools import lru_cache

DB_PATH= ":memory:"

@lru_cache(maxsize=1)
def load_chat_data():
    print("load data using duckdb...")
    con = duckdb.connect(DB_PATH)

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


def query_chat(sql: str, params=None):
    """
    general DuckDB query
    all API just need pass SQL
    """
    con, _ = load_chat_data()
    return con.execute(sql, params).fetchdf()



   