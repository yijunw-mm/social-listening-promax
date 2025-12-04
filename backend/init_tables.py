import duckdb
import pandas as pd
import os


# ===============================
# CONFIGURATION
# ===============================
DB_PATH = "data/chat_cache.duckdb"
CSV_PATH = "data/other_data/newest_brand_keywords.csv"   
GENERAL_PATH="data/other_data/general_kw_list.csv"
SLANG_PATH = "data/other_data/slang_to_formal.csv"

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
con = duckdb.connect(DB_PATH)


# ===============================
# 1️⃣ DELETE TABLES (if created before)
# ===============================
con.execute("DROP TABLE IF EXISTS brand_keywords;")
con.execute("DROP TABLE IF EXISTS brands;")
con.execute("DROP TABLE IF EXISTS categories;")
con.execute("DROP TABLE IF EXISTS general_keywords;")
con.execute("DROP TABLE IF EXISTS slang_dictionary;")

con.execute("DROP SEQUENCE IF EXISTS seq_category;")
con.execute("DROP SEQUENCE IF EXISTS seq_brand;")
con.execute("DROP SEQUENCE IF EXISTS seq_keyword;")
con.execute("DROP SEQUENCE IF EXISTS seq_general_kw;")
con.execute("DROP SEQUENCE IF EXISTS seq_slang;")

# ===============================
# 1️⃣ CREATE TABLES (with auto ID)
# ===============================
con.execute("CREATE SEQUENCE IF NOT EXISTS seq_category START 1;")
con.execute("CREATE SEQUENCE IF NOT EXISTS seq_brand START 1;")
con.execute("CREATE SEQUENCE IF NOT EXISTS seq_keyword START 1;")
con.execute("CREATE SEQUENCE IF NOT EXISTS seq_general_kw START 1;")
con.execute("CREATE SEQUENCE IF NOT EXISTS seq_slang START 1;")

con.execute("""
CREATE TABLE IF NOT EXISTS categories (
    category_id INTEGER PRIMARY KEY DEFAULT nextval('seq_category'),
    category_name TEXT UNIQUE NOT NULL
);
""")


con.execute("""
CREATE TABLE brands (
    brand_id INTEGER PRIMARY KEY DEFAULT nextval('seq_brand'),
    brand_name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    UNIQUE (brand_name, category_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);
""")

con.execute("""
CREATE TABLE brand_keywords (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_keyword'),
    brand_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    UNIQUE (brand_id, keyword),
    FOREIGN KEY (brand_id) REFERENCES brands(brand_id)
);
""")

con.execute("""
CREATE TABLE IF NOT EXISTS general_keywords (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_general_kw'),
    gen_keyword TEXT UNIQUE NOT NULL
);
""")

con.execute("""
CREATE TABLE IF NOT EXISTS slang_dictionary (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_slang'),
    slang TEXT UNIQUE NOT NULL,
    formal TEXT NOT NULL
);
""")

print("✅ Tables and sequences ensured.")

# ===============================
# LOAD CSV
# ===============================
df = pd.read_csv(CSV_PATH)
df_kw=pd.read_csv(GENERAL_PATH)
df_slang = pd.read_csv(SLANG_PATH)

df["brand"] = df["brand"].astype(str).str.strip().str.lower()
df["category"] = df["category"].astype(str).str.strip().str.lower()
df["keyword"] = df["keyword"].astype(str).str.strip()

df_kw["keywords"] = df_kw["keywords"].astype(str).str.strip()

df_slang["slang"] = df_slang["slang"].astype(str).str.strip()
df_slang["formal"] = df_slang["formal"].astype(str).str.strip()

# ===============================
# INSERT CATEGORIES
# ===============================
for cat in df["category"].unique():
    con.execute("""
        INSERT INTO categories (category_name)
        VALUES (?)
        ON CONFLICT (category_name) DO NOTHING;
    """, [cat])


# ===============================
# INSERT BRANDS
# ===============================
for _, row in df.iterrows():
    cat_id = con.execute(
        "SELECT category_id FROM categories WHERE category_name = ?", [row["category"]]
    ).fetchone()[0]


    con.execute("""
        INSERT INTO brands (brand_name, category_id)
        VALUES (?, ?)
        ON CONFLICT (brand_name, category_id) DO NOTHING;
    """, [row["brand"], cat_id])


# ===============================
# INSERT KEYWORDS (SMART MATCH)
# ===============================
for _, row in df.iterrows():
    # Step 1: Try exact match (brand + category)
    brand_id = con.execute("""
        SELECT b.brand_id
        FROM brands b
        JOIN categories c ON b.category_id = c.category_id
        WHERE b.brand_name = ? AND c.category_name = ?
    """, [row["brand"], row["category"]]).fetchone()


    # Step 2: Fallback: match brand only (ignore category)
    if not brand_id:
        brand_id = con.execute("""
            SELECT brand_id FROM brands WHERE brand_name = ?
            LIMIT 1
        """, [row["brand"]]).fetchone()

    con.execute("""
        INSERT INTO brand_keywords (brand_id, keyword)
        VALUES (?, ?)
        ON CONFLICT (brand_id, keyword) DO NOTHING;
    """, [brand_id[0], row["keyword"]])

# ===============================
# INSERT GENERAL KW
# ===============================
for kw in df_kw["keywords"].unique():
    con.execute("""
        INSERT INTO general_keywords (gen_keyword)
        VALUES (?)
        ON CONFLICT (gen_keyword) DO NOTHING;
    """, [kw])
# ===============================
# INSERT VARIANT
# ===============================
for slang, formal in zip(df_slang["slang"], df_slang["formal"]):
    con.execute("""
        INSERT INTO slang_dictionary (slang, formal)
        VALUES (?, ?)
        ON CONFLICT (slang) DO UPDATE SET formal=excluded.formal;
    """, [slang, formal])

# ===============================
# VALIDATION
# ===============================
n_cat = con.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
n_brand = con.execute("SELECT COUNT(*) FROM brands").fetchone()[0]
n_kw = con.execute("SELECT COUNT(*) FROM brand_keywords").fetchone()[0]
n_gen = con.execute("SELECT COUNT(*) FROM general_keywords").fetchone()[0]
n_slang = con.execute("SELECT COUNT(*) FROM slang_dictionary").fetchone()[0]

print(f"\n✅ Import done.")
print(f"📊 Categories: {n_cat}")
print(f"🏷️ Brands: {n_brand}")
print(f"🔑 Keywords: {n_kw}")
print(f"⭐ General Keywords: {n_gen}")
print(f"💡 Slang/Variant: {n_slang}")
con.close()
