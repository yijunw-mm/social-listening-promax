from fastapi import APIRouter, Query
from typing import List, Optional
import pandas as pd
from collections import Counter
import json
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import CountVectorizer
import numpy as np
import re
from keybert import KeyBERT
from sentence_transformers import SentenceTransformer, util 
import spacy
from backend.data_loader import query_chat,load_default_groups

router = APIRouter()

# load brand keywrod
brand_keyword_df = pd.read_csv("data/other_data/newest_brand_keywords.csv",keep_default_na=False,na_values=[""])  
brand_keyword_dict = brand_keyword_df.groupby("brand")["keyword"].apply(lambda x:list(x)).to_dict()

# temporary store user-add keywords
custom_keywords_dict = {brand: set() for brand in brand_keyword_dict}

def extract_brand_context(df: pd.DataFrame, brand: str, brand_keyword_map: dict,
                          window_size: int = 6, merge_overlap: bool = True):

    indices = []
    for row in df.itertuples(index=False):
        text=row.clean_text.lower()
        if re.search(rf"\b{re.escape(brand)}\b",text):
            start = max(1, row.row_id - window_size)
            end = row.row_id + window_size 
            subset = df[
                (df["group_id"] == row.group_id) &
                (df["row_id"].between(start,end))]
            indices.append((row.group_id,start, end))
    if not indices:
        return []

    # combine overlap window
    merged = []
    for gid in set(i[0] for i in indices):
        group_indices = [(s, e) for g, s, e in indices if g == gid]
        group_indices.sort()

        current_start, current_end = group_indices[0]
        for s, e in group_indices[1:]:
            if s <= current_end:
                current_end = max(current_end, e)
            else:
                merged.append((gid, current_start, current_end))
                current_start, current_end = s, e
        merged.append((gid, current_start, current_end))


    # collect corpus
    contexts = []
    for gid, s, e in merged:
        subset = df[(df["group_id"] == gid) & (df["row_id"].between(s, e))]
        contexts.append({
            "group_id":gid,
            "start_idx": s,
            "end_idx": e,
            "context": subset["clean_text"].tolist()
        })

    return contexts

@router.get("/brand/keyword-frequency")
def keyword_frequency(
    brand_name: str,
    group_id:Optional[List[str]]=Query(None),
    year: Optional[int] = None,
    month: Optional[List[int]] = Query(None),
    quarter: Optional[int] = None,
    window_size:int=6,
    merge_overlap:bool =True
):
    # --- 1. validate brand name
    if brand_name not in brand_keyword_dict:
        return {"error": f"Brand '{brand_name}' not found in keyword dictionary."}
    base_keywords = set(brand_keyword_dict[brand_name])
    custom_keywords = custom_keywords_dict.get(brand_name, set())
    all_keywords = list(base_keywords.union(custom_keywords))

    # --- 2. basic query
    query = """
    SELECT 
        group_id,
        row_number() over (PARTITION BY group_id ORDER BY datetime) AS row_id,
        clean_text 
    FROM chat WHERE clean_text IS NOT NULL"""
    params = []
    # ---- Default groups ----
    if not group_id:
        group_id = load_default_groups()

    # ---- 3. Filter by group_id ----
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    # ---- Filter by date ----
    if year:
        query += " AND year = ?"
        params.append(year)

    if month:
        query += " AND month IN (" + ",".join(["?"] * len(month)) + ")"
        params.extend(month)

    if quarter:
        query += " AND quarter = ?"
        params.append(quarter)

    # ---- 4. Query DuckDB ----
    df = query_chat(query, params)
    if df.empty:
        return {"keywords": []}
    
    df["clean_text"] = df["clean_text"].fillna("").astype(str)

    # ---- 5. extract the window message ---
    contexts = extract_brand_context(
        df, brand=brand_name,
        brand_keyword_map = brand_keyword_dict,
        window_size=window_size,
        merge_overlap=merge_overlap
    )
    if not contexts:
        return {"error":f"No mention about brand {brand_name}"}
    
    context_texts=[]
    for c in contexts:
        context_texts.extend(c["context"])

    # ---- 6. count keyword frequency ----
    freq_counter = Counter()
    for text in context_texts:
        t = text.lower()
        for kw in all_keywords:
            if re.search(rf"\b{re.escape(kw.lower())}\b", t):
                freq_counter[kw] += 1

    # fall back: return common words
    if not freq_counter:
        all_words = " ".join(context_texts).split()
        filtered_words = [w for w in all_words if w.isalpha() and len(w)>2]
        counter = Counter(filtered_words)
        top_fallback = [{"keyword":w, "count":c} for w, c in counter.most_common(5)]
        return top_fallback

    result = [{"keyword": kw, "count": freq} for kw, freq in freq_counter.items()]
    result.sort(key=lambda x: x["count"], reverse=True)
    return result

@router.post("/brand/add-keyword")
def add_keyword(brand_name:str,keyword:str):
    if brand_name not in custom_keywords_dict:
        custom_keywords_dict[brand_name]=set()
    custom_keywords_dict[brand_name].add(keyword)
    return {"message":f"keyword '{keyword}' added for brand '{brand_name}'."}

@router.post("/brand/remove-keyword")
def remove_keyword(brand_name:str, keyword:str):
    if brand_name in custom_keywords_dict and keyword in custom_keywords_dict[brand_name]:
        custom_keywords_dict[brand_name].remove(keyword)
        return {"message":f"keyword '{keyword}' removed from brand '{brand_name}'."}
    else:
        return {"message":f"keyword '{keyword}' not found in brand '{brand_name}'."}
    
# ====== sentiment analysis ==========
with open ("data/other_data/rule.json","r",encoding="utf-8") as f:
    CONFIG =json.load(f)['rules']
analyzer = SentimentIntensityAnalyzer()

def custom_rules(text, base_score):
    compound = base_score["compound"]
    t = text.lower()
    applied = None

    for rule in CONFIG:
        for pattern in rule["patterns"]:
            if re.search(pattern, t,re.IGNORECASE):
                compound = max(-1.0, min(1.0, compound + rule["adjustment"]))
                applied =rule['name']
                break  # stop at first match
        if applied: 
            break

    if compound >= 0.05:
        sentiment = "positive"
    elif compound <= -0.05:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return {
        "compound": compound,
        "sentiment": sentiment,
        "rule":applied
    }

def explain_sentiment(text, top_n=5):
    """return the contribution"""
    words = re.findall(r"\b\w+\b", text.lower())
    scored_words = []
    for w in words:
        if w in analyzer.lexicon:  # there is a score in VADER dictionary
            score = analyzer.lexicon[w]
            scored_words.append((w, score))

    positives = sorted([x for x in scored_words if x[1] > 0], key=lambda x: -x[1])[:top_n]
    negatives = sorted([x for x in scored_words if x[1] < 0], key=lambda x: x[1])[:top_n]

    return {
        "positives": positives,
        "negatives": negatives
    }

@router.get("/brand/sentiment-analysis")
def brand_sentiment_analysis_vader(
    brand_name: str,
    group_id: Optional[List[str]] = Query(None),
    year: Optional[int] =None,
    month: Optional[List[int]] = Query(None),
    quarter: Optional[int] = None
):
    # 1. get brand name
    if brand_name not in brand_keyword_dict:
        return {"error": f"Brand '{brand_name}' not found."}
    # --- 2. basic query
    query = """
    SELECT 
        group_id, clean_text 
    FROM chat WHERE clean_text IS NOT NULL"""
    params = []
    # ---- Default groups ----
    if not group_id:
        group_id = load_default_groups()

    # ---- 3. Filter by group_id ----
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    # ---- Filter by date ----
    if year:
        query += " AND year = ?"
        params.append(year)

    if month:
        query += " AND month IN (" + ",".join(["?"] * len(month)) + ")"
        params.extend(month)

    if quarter:
        query += " AND quarter = ?"
        params.append(quarter)

    # ---- 4. Query DuckDB ----
    df = query_chat(query, params)
    if df.empty:
        return {"brand": brand_name, "total_mentions": 0, "sentiment_percent": [], "sentiment_count": [], "examples": []}
    df["clean_text"] = df["clean_text"].fillna("").astype(str)

    # 3. get the message containing brand name
    matched_texts = [
        text for text in df["clean_text"].dropna()
        if re.search(rf"\b{re.escape(brand_name)}\b",text.lower())
    ]

    # 4. compute sentiment analysis
    sentiment_result = {"positive": 0, "neutral": 0, "negative": 0}
    detailed_examples= []

    for text in matched_texts:
        base = analyzer.polarity_scores(text)
        adjusted = custom_rules(text,base)
        sentiment_result[adjusted["sentiment"]]+=1
        
        # 4.5 explain the contribution
        explanation = explain_sentiment(text, top_n=5)
        detailed_examples.append({
            "text": text,
            "sentiment_score": adjusted["compound"],
            "sentiment": adjusted["sentiment"],
            "rule_applied":adjusted["rule"],
            "top_positive_words": explanation["positives"],
            "top_negative_words": explanation["negatives"]
        })

    # 5. output
    total = len(matched_texts)
    if total == 0:
        return {
            "brand": brand_name,
            "total_mentions": 0,
            "sentiment_percent": {},
            "sentiment_count": {},
            "examples": []
        }

    sentiment_percent_list = [{
        "sentiment":k,"value": round(v / total * 100, 1)} for k, v in sentiment_result.items()
    ]
    sentiment_count_list =[
        {"sentiment":k, "value":v} for k,v in sentiment_result.items()
    ]
    return {
        "brand": brand_name,
        "total_mentions": total,
        "sentiment_percent": sentiment_percent_list,
        "sentiment_count": sentiment_count_list,
        "examples":detailed_examples[:5]
    }

#------consumer perception------

nlp = spacy.load("en_core_web_sm")
semantic_model = SentenceTransformer("all-MiniLM-L6-v2")
kw_model = KeyBERT(model='all-MiniLM-L6-v2')

def _overlap_fraction(a, b):
    """calculate the overlap percentage between two phrases token"""
    set_a, set_b = set(a.split()), set(b.split())
    if not set_a or not set_b:
        return 0
    return len(set_a & set_b) / min(len(set_a), len(set_b))

def remove_overlapping_phrases(keywords, overlap_ratio=0.6):
    """
    remove the overlap part（like "sensitive skin" vs "kids sensitive skin"）。
    overlap_ratio: 0.6。
    """
    cleaned = []
    for kw in sorted(keywords, key=len, reverse=True):  # from long to short
        if not any(_overlap_fraction(kw, c) > overlap_ratio for c in cleaned):
            cleaned.append(kw)
    return cleaned[::-1]  # keep the original order


def extract_clean_brand_keywords_auto(texts, brand_name, top_k=15):
    """
    extract meaningful word
    """
    if not texts:
        return []

    # Step 1️⃣ remove the brand name itself
    cleaned_texts = [re.sub(rf"\b{re.escape(brand_name)}\b", "", t.lower()) for t in texts]
    joined_text = " ".join(cleaned_texts)

    # Step 2️⃣ KeyBERT extrat keyword
    keywords = [kw for kw, _ in kw_model.extract_keywords(
        joined_text,
        keyphrase_ngram_range=(1, 3),
        use_mmr=True,
        diversity=0.7,
        top_n=top_k*5,
        stop_words='english'
    )]

    # Step 3️⃣ POS keep noun, adj
    def is_meaningful(phrase):
        doc = nlp(phrase)
        return any(t.pos_ in ["ADJ", "NOUN"] for t in doc)
    keywords = [kw for kw in keywords if is_meaningful(kw)]

    # Step 4️⃣ calculate semantic centre
    if not keywords:
        return []
    kw_emb = semantic_model.encode(keywords, convert_to_tensor=True)
    centroid = kw_emb.mean(dim=0, keepdim=True)

    # Step 5️⃣ calculate similarity of each word and the centre
    sims = util.cos_sim(kw_emb, centroid).flatten()
    filtered_keywords = [kw for kw, sim in zip(keywords, sims) if sim > 0.3]
    #new_add
    filtered_keywords = remove_overlapping_phrases(filtered_keywords,overlap_ratio=0.5)

    # Step 6️⃣ count the frequency in original text
    counts = Counter()
    for text in texts:
        t = text.lower()
        for kw in filtered_keywords:
            if re.search(rf"\b{re.escape(kw)}\b", t):
                counts[kw] += 1

    results = [{"word": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)]
    return results


@router.get("/brand/consumer-perception")
def consumer_perception(brand_name: str, 
                        group_id:Optional[List[str]]=Query(None),
                        year: Optional[int] = None,
                        month: Optional[int] = None,
                        quarter: Optional[int] = None,
                        top_k: int = 20):

    if brand_name not in brand_keyword_dict:
        return {"error": f"Brand '{brand_name}' not found."}

    # --- 2. basic query
    query = """
    SELECT 
        group_id, clean_text 
    FROM chat WHERE clean_text IS NOT NULL"""
    params = []
    # ---- Default groups ----
    if not group_id:
        group_id = load_default_groups()

    # ---- 3. Filter by group_id ----
    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    # ---- Filter by date ----
    if year:
        query += " AND year = ?"
        params.append(year)

    if month:
        query += " AND month IN (" + ",".join(["?"] * len(month)) + ")"
        params.extend(month)

    if quarter:
        query += " AND quarter = ?"
        params.append(quarter)

    # ---- 4. Query DuckDB ----
    df = query_chat(query, params)
    if df.empty:
        return {"brand":brand_name, "associate_words":[]}
    df["clean_text"] = df["clean_text"].fillna("").astype(str)
    # --- 5. extract brand mention message ---
    relevant_texts = (
        df["clean_text"].dropna().astype(str)
        .loc[lambda s:s.str.contains(rf"\b{re.escape(brand_name)}\b",case=False,na=False)].tolist())

    if not relevant_texts:
        return {"brand": brand_name, "associated_words": []}

    associated_words = extract_clean_brand_keywords_auto(relevant_texts,brand_name, top_k=top_k)
    return {"brand": brand_name, "associated_words": associated_words}

