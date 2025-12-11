import pandas as pd
import glob
import re

def count_huggies_in_year(year):
    """Count huggies mentions in all parquet files for a given year"""
    pattern = f"/Users/jindalarishya/social-listening-promax/data/processing_output/clean_chat_df/{year}/*.parquet"
    files = glob.glob(pattern)

    total_count = 0
    monthly_counts = {}

    for file in sorted(files):
        df = pd.read_parquet(file)

        # Count mentions of "huggies" (case-insensitive, whole word)
        if 'clean_text' in df.columns:
            count = df['clean_text'].astype(str).str.lower().str.contains(r'\bhuggies\b', regex=True, na=False).sum()
            month = file.split('/')[-1].replace('.parquet', '')
            monthly_counts[month] = count
            total_count += count

    return total_count, monthly_counts

# Count for 2024
count_2024, monthly_2024 = count_huggies_in_year(2024)
print(f"\n{'='*60}")
print(f"HUGGIES COUNT IN 2024")
print(f"{'='*60}")
print(f"Total mentions: {count_2024}")
print(f"\nMonthly breakdown:")
for month, count in monthly_2024.items():
    print(f"  {month}: {count}")

# Count for 2025
count_2025, monthly_2025 = count_huggies_in_year(2025)
print(f"\n{'='*60}")
print(f"HUGGIES COUNT IN 2025")
print(f"{'='*60}")
print(f"Total mentions: {count_2025}")
print(f"\nMonthly breakdown:")
for month, count in monthly_2025.items():
    print(f"  {month}: {count}")

print(f"\n{'='*60}")
print(f"SUMMARY")
print(f"{'='*60}")
print(f"2024 Total: {count_2024}")
print(f"2025 Total: {count_2025}")
print(f"Difference: {count_2025 - count_2024}")
