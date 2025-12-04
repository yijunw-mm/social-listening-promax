import re
import os
import duckdb
import pandas as pd
from datetime import datetime
import calendar
from dateutil.relativedelta import relativedelta


# -------- helpers: group name -> due_date + stage --------

def parse_group_name(group_name: str):
    group_name=str(group_name)
    match = re.match(r"(\d{4})\s+([A-Za-z]+)", group_name.strip())
    if not match:
        return None
    year = int(match.group(1))
    month_str = match.group(2).title() #DEC->Dec, only standardize format, or can try group(2)[:3].title()
    if month_str not in calendar.month_abbr:
        return None
    month = list(calendar.month_abbr).index(month_str)  # DEC->12
    return datetime(year, month, 1)


def get_stage(group_name: str, today: datetime = None):
    if today is None:
        today = datetime.today()
    due_date = parse_group_name(group_name)
    if not due_date:
        return "Unknown"
    diff = relativedelta(today, due_date)
    months_diff = diff.years * 12 + diff.months


    if today < due_date:
        months_before = -months_diff
        if months_before <= 9:
            return "Pregnant(0 to 9 months)"
        else:
            return "Pre-pregnancy"
    if 4 <= months_diff <= 16:
        return "Weaning(4 to 16 months)"
    elif 1 <= months_diff <= 18:
        return "Infant(1 to 18 months)"
    elif 18 < months_diff <= 60:
        return "Preschool(18 months to 5yo)"
    elif 36 < months_diff <= 72:
        return "Enrichment(3 to 6yo)"
    else:
        return "Current Month"


# -------- build df_groups from ingestion output --------
def build_groups_from_messages(base_dir="data/processing_output/clean_chat_df",
                               output_csv="data/processing_output/groups.csv",
                               db_path = "data/chat_cache.duckdb"):
    """scan all parquet file in directory"""
    all_records=[]
    today = datetime.today()
    for year_folder in sorted(os.listdir(base_dir)):
        year_path = os.path.join(base_dir, year_folder)

        for file in os.listdir(year_path):
            if file.endswith(".parquet"):
                file_path = os.path.join(year_path, file)
                df = pd.read_parquet(file_path)

                for group_id,group_name in df[["group_id","group_name"]].drop_duplicates().values:
                    due_date = parse_group_name(group_name)
                    stage = get_stage(group_name, today)
                    all_records.append({
                        "group_id": group_id,
                        "group_name": group_name,
                        "due_date": due_date.date() if due_date else None,
                        "stage": stage
                    })
    df_groups = pd.DataFrame(all_records)
    os.makedirs(os.path.dirname(output_csv),exist_ok=True)
    df_groups.to_csv(output_csv, index=False)
    print(f"✅ Saved {len(df_groups)} groups to {output_csv}")

    #write to duckdb
    con = duckdb.connect(db_path)
    con.execute("DROP TABLE IF EXISTS groups;")
    con.execute("""
        CREATE TABLE groups as SELECT * FROM df_groups""")
    con.close()
    return df_groups


# -------- test run --------
if __name__ == "__main__":
    build_groups_from_messages()


