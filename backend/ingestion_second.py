
import zipfile
from io import TextIOWrapper
import os
import re
import pandas as pd
from datetime import datetime
import calendar

# -----------------------------
# 1️⃣ Extract group name
# -----------------------------
def extract_group_name(file_name: str) -> str:
    """
    Extract group name from zip file name, e.g.
    WhatsApp Chat - 2025 DEC SG Mummys.zip -> 2025 DEC SG Mummys
    """
    match = re.search(r"WhatsApp Chat - ([\w\s]+)", file_name)
    if match:
        return match.group(1).strip()
    return file_name.replace(".zip", "")

# -----------------------------
# 2️⃣ Read .zip and extract .txt
# -----------------------------
def read_zip_and_extract_txt(zip_path: str):
    """
    Unzip file, extract the first txt/text file content, and return (group_name, chat_lines)
    """
    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        # support .txt / .text / .TXT
        txt_files = [name for name in zip_ref.namelist() if name.lower().endswith((".txt", ".text"))]
        if not txt_files:
            raise ValueError("Zip file does not contain any .txt or .text file.")
        first_txt = txt_files[0]
        with zip_ref.open(first_txt) as file:
            chat_lines = TextIOWrapper(file, encoding="utf-8", errors="ignore").read().splitlines()

    group_name = extract_group_name(os.path.basename(zip_path))
    return group_name, chat_lines

# -----------------------------
# 3️⃣ Normalize group id
# -----------------------------
def normalize_group_id(group_name):
    """
    Convert '2025 DEC SG Mummys' -> '202512'
    """
    match = re.match(r"(\d{4})\s+([A-Za-z]+)", group_name.strip())
    if not match:
        return None
    year = int(match.group(1))
    month_str = match.group(2).title()
    if month_str not in calendar.month_abbr:
        return None
    month = list(calendar.month_abbr).index(month_str)
    return f"{year}{month:02d}"

# -----------------------------
# 4️⃣ Parse chat lines
# -----------------------------
def parse_txt_lines(lines, group_name):
    """
    Parse WhatsApp chat lines into structured records.
    Handles both chat messages and skips system messages.
    """
    # e.g. "06/01/2025, 13:03 - +65 9635 7039: Hi there"
    pattern = re.compile(
        r"^(\d{1,2}/\d{1,2}/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(.*?):\s*(.*)$"
    )
    records = []
    norm_id = normalize_group_id(group_name)

    for line in lines:
        match = pattern.match(line)
        if match:
            date_str, time_str, user, message = match.groups()
            # try two time format（2025 vs 25）
            dt = None
            for fmt in ("%d/%m/%Y, %H:%M", "%d/%m/%y, %H:%M"):
                try:
                    dt = datetime.strptime(f"{date_str}, {time_str}", fmt)
                    break
                except:
                    continue
            if not dt:
                continue

            # jump system msg
            if re.search(r"(joined|left|added|changed|requested)", message.lower()):
                continue

            records.append({
                "datetime": dt,
                "user": user.strip(),
                "group_id": str(norm_id),
                "text": message.strip(),
                "group_name": group_name
            })

    return records
def save_group_parquet(records, group_id, year):
    """save each group_id parquet file"""
    folder = f"data/processing_output/structure_chat/{year}"
    os.makedirs(folder, exist_ok=True)
    path = f"{folder}/group_{group_id}.parquet"
    df = pd.DataFrame(records)
    df.to_parquet(path, index=False)
    print(f"Saved {path} ({len(df)} messages)")

# -----------------------
# proces single zip uploaded
# -----------------------
def process_single_file(zip_path:str):
    """frontend upload file,
    unzip, save as parquet file"""
    group_name,chat_text = read_zip_and_extract_txt(zip_path)
    records= parse_txt_lines(chat_text,group_name)
    if not records:
        raise ValueError("No Valid Message in uploaded file")
    group_id = records[0]["group_id"]
    group_year = normalize_group_id(group_name)[:4]
    save_group_parquet(records,group_id,group_year)
    df= pd.DataFrame(records)
    return df,group_id,group_year

# -----------------------------
# 5️⃣ Process multiple ZIPs
# -----------------------------
def process_multiple_zips(folder_path: str) -> pd.DataFrame:
    """
    Process all zip files in a folder, return independent parquet file
    based on group id.
    """
    all_records = []

    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".zip"):
            path = os.path.join(folder_path, filename)
            try:
                group_name, chat_text = read_zip_and_extract_txt(path)
                records = parse_txt_lines(chat_text, group_name)
                if not records:
                    print(f"No valid messages found in {filename}")
                    continue

                group_id = records[0]["group_id"]
                year = normalize_group_id(group_name)[:4]
                save_group_parquet(records, group_id, year)
                print(f"✅ Processed {filename}: {len(records)} messages")

            except Exception as e:
                print(f"Error processing {filename}: {e}")


# -----------------------------
# 6️⃣ Main entry
# -----------------------------
if __name__ == "__main__":
    folder = "data/chat_zip/2024"
    process_multiple_zips(folder)
    print("✅ All zip files process successfully")

