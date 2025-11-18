
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
        # 支持 .txt / .text / .TXT
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
            # 尝试两种日期格式（2025 vs 25）
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

# -----------------------------
# 5️⃣ Process multiple ZIPs
# -----------------------------
def process_multiple_zips(folder_path: str) -> pd.DataFrame:
    """
    Process all zip files in a folder, return combined DataFrame.
    """
    all_records = []

    for filename in os.listdir(folder_path):
        if filename.lower().endswith(".zip"):
            path = os.path.join(folder_path, filename)
            try:
                group_name, chat_text = read_zip_and_extract_txt(path)
                records = parse_txt_lines(chat_text, group_name)
                print(f"✅ Processed {filename}: {len(records)} messages")
                if records:
                    all_records.extend(records)
                else:
                    print(f"⚠️ No valid messages found in {filename}")
            except Exception as e:
                print(f"❌ Error processing {filename}: {e}")

    if not all_records:
        print("⚠️ No messages found in any ZIP file.")
        return pd.DataFrame(columns=["datetime", "user", "group_id", "text", "group_name"])

    df = pd.DataFrame(all_records)
    df["group_id"] = df["group_id"].astype(str)
    return df

# -----------------------------
# 6️⃣ Main entry
# -----------------------------
if __name__ == "__main__":
    folder = "data/chat_zip/2025"
    df_chats = process_multiple_zips(folder)
    print(f"📊 Total loaded messages: {len(df_chats)}")

    output_path = "data/processing_output/structure_chat/2025/structured_chat.parquet"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_chats.to_parquet(output_path, index=False, encoding="utf-8-sig")
    print(f"💾 Saved to {output_path}")
