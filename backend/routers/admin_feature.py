from fastapi import APIRouter, HTTPException, Header
import duckdb
from typing import List
from pydantic import BaseModel

# ========================================
# ⚙️  CONFIG
# ========================================
DB_PATH = "data/chat_cache.duckdb"
ADMIN_TOKEN = "Pregnancy2parenthood!"

router = APIRouter(prefix="/admin", tags=["Admin"])

# ========================================
# 🔐 Token Verify
# ========================================
def verify_admin_token(token: str = Header(...)):
    if token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized access.")

# ========================================
# 🧩 define function
# ========================================
def commit_and_close(con):
    """ensure add feature start immediately and close connection"""
    con.commit()
    con.execute("CHECKPOINT")
    con.close()

# ========================================
# 🧩 initialize
# ========================================
def ensure_tables():
    con = duckdb.connect(DB_PATH)
    con.execute("""
    CREATE SEQUENCE IF NOT EXISTS seq_category START 1;
    CREATE SEQUENCE IF NOT EXISTS seq_brand START 1;
    CREATE SEQUENCE IF NOT EXISTS seq_keyword START 1;
    CREATE SEQUENCE IF NOT EXISTS seq_slang START 1;
    CREATE SEQUENCE IF NOT EXISTS seq_general_kw START 1;


    CREATE TABLE IF NOT EXISTS categories (
        category_id INTEGER PRIMARY KEY DEFAULT nextval('seq_category'),
        category_name TEXT UNIQUE NOT NULL
    );


    CREATE TABLE IF NOT EXISTS brands (
        brand_id INTEGER PRIMARY KEY DEFAULT nextval('seq_brand'),
        brand_name TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        UNIQUE (brand_name, category_id),
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
    );


    CREATE TABLE IF NOT EXISTS brand_keywords (
        id INTEGER PRIMARY KEY DEFAULT nextval('seq_keyword'),
        brand_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        UNIQUE (brand_id, keyword),
        FOREIGN KEY (brand_id) REFERENCES brands(brand_id)
    );


    CREATE TABLE IF NOT EXISTS slang_dictionary (
        id INTEGER PRIMARY KEY DEFAULT nextval('seq_slang'),
        slang TEXT UNIQUE NOT NULL,
        formal TEXT NOT NULL
    );
                
    CREATE TABLE IF NOT EXISTS general_keywords (
    id INTEGER PRIMARY KEY DEFAULT nextval('seq_general_kw'),
    gen_keyword TEXT UNIQUE NOT NULL
    );
                
    """)

    con.close()

# ========================================
# 🏷️ 1. ADD BRAND
# ========================================
@router.post("/brand")
def add_brand(brand_name: str, category_name: str, token: str = Header(...)):
    verify_admin_token(token)
    ensure_tables()


    con = duckdb.connect(DB_PATH)
    try:
        # insert category
        con.execute("""
            INSERT INTO categories (category_name)
            VALUES (?)
            ON CONFLICT (category_name) DO NOTHING;
        """, [category_name.lower().strip()])


        # access category_id
        cat_id = con.execute(
            "SELECT category_id FROM categories WHERE category_name = ?",
            [category_name.lower().strip()]
        ).fetchone()[0]


        # insert brand
        con.execute("""
            INSERT INTO brands (brand_name, category_id)
            VALUES (?, ?)
            ON CONFLICT (brand_name, category_id) DO NOTHING;
        """, [brand_name.lower().strip(), cat_id])


        #con.close()
        commit_and_close(con)
        return {"message": f"✅ Brand '{brand_name}' added/ensured under category '{category_name}'."}
    except Exception as e:
        con.close()
        raise HTTPException(status_code=500, detail=str(e))



# ========================================
# 🧾2.ADD BRAND KW
# ========================================
class KeywordListRequest(BaseModel):
    brand_name: str
    keywords:List[str]

@router.post("/keyword")
def add_keyword(req: KeywordListRequest, token: str = Header(...)):
    verify_admin_token(token)
    ensure_tables()

    con = duckdb.connect(DB_PATH)
    try:
        brand_id = con.execute(
            "SELECT brand_id FROM brands WHERE brand_name = ?",
            [req.brand_name.lower().strip()]
        ).fetchone()


        if not brand_id:
            raise HTTPException(status_code=404, detail=f"Brand '{req.brand_name}' not found. Please create it first.")

        added_count, existed_count =0,0
        for kw in req.keywords:
            exists = con.execute("""
                SELECT COUNT(*) FROM brand_keywords
                WHERE brand_id= ? AND keyword=?
            """, [brand_id[0], kw.lower().strip()]).fetchone()[0]
            if exists:
                existed_count+=1
            else:
                con.execute("""
                INSERT INTO brand_keywords (brand_id, keyword)
                VALUES (?, ?)
                ON CONFLICT (brand_id, keyword) DO NOTHING;
            """, [brand_id[0], kw.lower().strip()])
                added_count+=1

        #con.close()
        commit_and_close(con)
        if added_count == 0 and existed_count >0:
            msg = f"✅All {existed_count} keywords exist"
        elif added_count >0 and existed_count >0:
            msg = f"✅Add {added_count} keywords, {existed_count} keyword exist"
        elif added_count>0:
            msg = f"✅Add {added_count} keywords to brand '{req.brand_name}'."
        else:
            msg = f"Not Valid"
        return {"message": msg}
    except Exception as e:
        con.close()
        raise HTTPException(status_code=500, detail=str(e))



# ========================================
# 🧩 3. ADD CAT
# ========================================
@router.post("/category")
def add_category(category_name: str, token: str = Header(...)):
    verify_admin_token(token)
    ensure_tables()

    con = duckdb.connect(DB_PATH)
    try:
        con.execute("""
            INSERT INTO categories (category_name)
            VALUES (?)
            ON CONFLICT (category_name) DO NOTHING;
        """, [category_name.lower().strip()])
        #con.close()
        commit_and_close(con)
        return {"message": f"✅ Category '{category_name}' added or already exists."}
    except Exception as e:
        con.close()
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# 💬 4. UPDATE/INSERT SLANG/VARIANT
# ========================================
@router.post("/slang")
def upsert_slang(slang: str, formal: str, token: str = Header(...)):
    verify_admin_token(token)
    ensure_tables()


    con = duckdb.connect(DB_PATH)
    try:
        con.execute("""
            INSERT INTO slang_dictionary (slang, formal)
            VALUES (?, ?)
            ON CONFLICT (slang) DO UPDATE SET formal=excluded.formal;
        """, [slang.lower().strip(), formal.lower().strip()])
        #con.close()
        commit_and_close(con)
        return {"message": f"✅ slang '{slang}' → '{formal}' update or insert"}
    except Exception as e:
        con.close()
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# 💬 5. UPDATE/INSERT GENERAL KW
# ========================================
class GeneralkwRequest(BaseModel):
    general_kw:List[str]

@router.post("/general-keyword")
def upsert_general(req: GeneralkwRequest, token: str = Header(...)):
    verify_admin_token(token)
    ensure_tables()

    con = duckdb.connect(DB_PATH)
    try:
        added_count, existed_count =0,0
        for kw in req.general_kw:
            exists = con.execute(
                    "SELECT COUNT(*) FROM general_keywords WHERE gen_keyword = ?",
                    [kw.lower().strip()]).fetchone()[0]
            if exists:
                existed_count+=1
            else:
                con.execute("INSERT INTO general_keywords (gen_keyword) VALUES (?)",[kw.lower().strip()])
                added_count+=1
        #con.close()
        commit_and_close(con)
        if added_count == 0 and existed_count >0:
            msg = f"✅All {existed_count} keywords exist"
        elif added_count >0 and existed_count >0:
            msg = f"✅Add {added_count} keywords, {existed_count} keyword exist"
        elif added_count>0:
            msg = f"✅Add {added_count} keywords"
        else:
            msg = f"Not Valid"
        return {"message": msg}
    except Exception as e:
        con.close()
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# 🗑️ 6. DELETE BRAND /KW
# ========================================
@router.delete("/brand")
def delete_brand(brand_name: str, token: str = Header(...)):
    verify_admin_token(token)
    con = duckdb.connect(DB_PATH)
    try:
        brand_id = con.execute(
            "SELECT brand_id FROM brands WHERE brand_name = ?", [brand_name.lower().strip()]
        ).fetchone()
        if not brand_id:
            con.close()
            raise HTTPException(status_code=404, detail= f"Brand Name {brand_name} Not Found")
            
        con.execute("DELETE FROM brands WHERE brand_name = ?", [brand_name.lower().strip()])
        con.close()
        return {"message": f"🗑️ Brand '{brand_name}' deleted."}
    except Exception as e:
        con.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/keyword")
def delete_keyword(brand_name: str, keyword: str, token: str = Header(...)):
    verify_admin_token(token)
    con = duckdb.connect(DB_PATH)
    try:
        brand_id = con.execute(
            "SELECT brand_id FROM brands WHERE brand_name = ?", [brand_name.lower().strip()]
        ).fetchone()
        if not brand_id:
            raise HTTPException(status_code=404, detail="Brand Name {brand_name} Not Found.")

        con.execute("""
            DELETE FROM brand_keywords
            WHERE brand_id = ? AND keyword = ?;
        """, [brand_id[0], keyword.lower().strip()])


        con.close()
        return {"message": f"🗑️ Keyword '{keyword}' removed from brand '{brand_name}'."}
    except Exception as e:
        con.close()
        raise HTTPException(status_code=500, detail=str(e))



