import duckdb
import re

DB_PATH = "data/chat_cache.duckdb"

con = duckdb.connect(DB_PATH, read_only=True)

# Count huggies in 2024
query_2024 = """
SELECT
    year,
    COUNT(*) as total_rows,
    SUM(CASE WHEN LOWER(clean_text) REGEXP '\\bhuggies\\b' THEN 1 ELSE 0 END) as huggies_count
FROM chat
WHERE clean_text IS NOT NULL AND year = 2024
GROUP BY year
"""

result_2024 = con.execute(query_2024).fetchdf()
print("="*60)
print("HUGGIES COUNT IN DUCKDB - 2024")
print("="*60)
print(result_2024)

# Count huggies in 2025
query_2025 = """
SELECT
    year,
    COUNT(*) as total_rows,
    SUM(CASE WHEN LOWER(clean_text) REGEXP '\\bhuggies\\b' THEN 1 ELSE 0 END) as huggies_count
FROM chat
WHERE clean_text IS NOT NULL AND year = 2025
GROUP BY year
"""

result_2025 = con.execute(query_2025).fetchdf()
print("\n" + "="*60)
print("HUGGIES COUNT IN DUCKDB - 2025")
print("="*60)
print(result_2025)

# Count all brands in diaper category for 2024 and 2025
query_all_brands = """
SELECT
    year,
    SUM(CASE WHEN LOWER(clean_text) REGEXP '\\bhuggies\\b' THEN 1 ELSE 0 END) as huggies,
    SUM(CASE WHEN LOWER(clean_text) REGEXP '\\bpampers\\b' THEN 1 ELSE 0 END) as pampers,
    SUM(CASE WHEN LOWER(clean_text) REGEXP '\\bmamypoko\\b' THEN 1 ELSE 0 END) as mamypoko,
    SUM(CASE WHEN LOWER(clean_text) REGEXP '\\bdrypers\\b' THEN 1 ELSE 0 END) as drypers,
    SUM(CASE WHEN LOWER(clean_text) REGEXP '\\bmerries\\b' THEN 1 ELSE 0 END) as merries
FROM chat
WHERE clean_text IS NOT NULL AND year IN (2024, 2025)
GROUP BY year
ORDER BY year
"""

result_brands = con.execute(query_all_brands).fetchdf()
print("\n" + "="*60)
print("ALL DIAPER BRANDS COUNT IN DUCKDB")
print("="*60)
print(result_brands)

# Calculate share of voice for 2024
total_2024 = result_brands[result_brands['year'] == 2024][['huggies', 'pampers', 'mamypoko', 'drypers', 'merries']].sum(axis=1).values[0]
print(f"\n2024 - Total diaper mentions: {total_2024}")
if total_2024 > 0:
    huggies_2024 = result_brands[result_brands['year'] == 2024]['huggies'].values[0]
    print(f"Huggies share: {huggies_2024}/{total_2024} = {round(huggies_2024/total_2024*100, 1)}%")

# Calculate share of voice for 2025
total_2025 = result_brands[result_brands['year'] == 2025][['huggies', 'pampers', 'mamypoko', 'drypers', 'merries']].sum(axis=1).values[0]
print(f"\n2025 - Total diaper mentions: {total_2025}")
if total_2025 > 0:
    huggies_2025 = result_brands[result_brands['year'] == 2025]['huggies'].values[0]
    print(f"Huggies share: {huggies_2025}/{total_2025} = {round(huggies_2025/total_2025*100, 1)}%")

con.close()
