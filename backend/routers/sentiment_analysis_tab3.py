# -------sentiment analysis (DistilBERT version) ------
from transformers import pipeline
import re, json
from fastapi import APIRouter, Query, Body
from typing import List, Optional,Literal
import pandas as pd
from collections import Counter, defaultdict
from backend.data_loader import query_chat, load_default_groups,load_groups_by_year
from backend.data_loader import get_cached_sentiment,save_sentiment_cache,update_sentiment_cache

router = APIRouter()

# load brand keywrod
brand_keyword_df = pd.read_csv("data/other_data/newest_brand_keywords.csv",keep_default_na=False,na_values=[""])
brand_keyword_dict = brand_keyword_df.groupby("brand")["keyword"].apply(list).to_dict()


# 1.load Transformer model
sentiment_model = pipeline(
    "sentiment-analysis",
    model="./roberta-sentiment-finetuned",
    tokenizer="./roberta-sentiment-finetuned",
    top_k=1,
    truncation=True  #cut more than 512

)

# 2.  rule.json
with open("data/other_data/sentiment_rule.json", "r", encoding="utf-8") as f:
    CONFIG = json.load(f)["rules"]

def regex_override_label(text: str, base_sentiment: str) -> str:
    """based on rule.json overwrite sentiment"""
    t = text.lower()
    for rule in CONFIG:
        for pattern in rule["patterns"]:
            if re.search(pattern, t, re.IGNORECASE):
                return rule["sentiment"]
    return base_sentiment  



# 3. safety check of total=0
def safe_percent(v, total):
    if total == 0:
        return 0
    return round(v / total * 100, 1)

# 4. Transformer-based sentiment function
def analyze_sentiment(texts):
    sentiment_result = {"positive": 0, "neutral": 0, "negative": 0}
    detailed_examples = []
    if not texts:
        return sentiment_result, detailed_examples

    # check existing cach
    cached_results = {}
    uncached_texts = []
    for text in texts:
        cached = get_cached_sentiment(text)
        if cached:
            cached_results[text]=cached
        else:
            uncached_texts.append(text)
    preds=[]
    if uncached_texts:
        preds = sentiment_model(texts, batch_size=32)
        for i,text in enumerate(texts):
            cached = get_cached_sentiment(text)
            if cached:
                sentiment = cached["sentiment"]
                score = cached["score"]
                rule = cached["rule_applied"]
                print("cached hit")
            else:
                pred = preds[i][0]
                sentiment = pred["label"].lower()
                score = round(pred["score"],3)
                rule = None
                print("model inference")
                final_sentiment = regex_override_label(text,sentiment)
                if final_sentiment !=sentiment:
                    rule = "regex overwrite"
                save_sentiment_cache(text,final_sentiment,score,rule)
                cached_results[text]={
                    "sentiment":final_sentiment,
                    "score":score,
                    "rule_applied":rule
                }
    for text in texts:
        data = cached_results[text]
        sentiment_result[data["sentiment"]] += 1
        detailed_examples.append({
            "text": text,
            "sentiment_score": data["score"],
            "sentiment": data["sentiment"],
            "rule_applied":data["rule_applied"],
        })

    return sentiment_result, detailed_examples


# 5. API router
@router.get("/brand/time-compare/sentiment")
def keyword_frequency(
    brand_name: str,
    granularity: Literal["year", "month", "quarter"],
    time1: int,
    time2: int,
    group_id: Optional[List[str]] = Query(None),
    group_year: Optional[int] = None
):
    if brand_name not in brand_keyword_dict:
        return {"error": f"Brand '{brand_name}' not found."}

    query = """
    SELECT 
        group_id, clean_text, year, month, quarter
    FROM chat WHERE clean_text IS NOT NULL"""
    params = []

    if group_year and not group_id:
        group_id = load_groups_by_year(group_year)
    if not group_id:
        group_id = load_default_groups()

    if group_id:
        query += " AND group_id IN (" + ",".join(["?"] * len(group_id)) + ")"
        params.extend(group_id)

    df = query_chat(query, params)
    if df.empty:
        return {
            "brand": brand_name,
            "total_mentions": 0,
            "sentiment_percent": [],
            "sentiment_count": [],
            "examples": []
        }

    df["clean_text"] = df["clean_text"].fillna("").astype(str)

    # filter brand_name relevant text
    pattern = re.compile(rf"\b{re.escape(brand_name)}\b", re.IGNORECASE)

    def filter_df(df, time, granularity):
        if granularity == "year":
            return df[df["year"] == time]
        elif granularity == "month":
            year, month = divmod(time, 100)
            return df[(df["year"] == year) & (df["month"] == month)]
        elif granularity == "quarter":
            year, q = divmod(time, 10)
            return df[(df["year"] == year) & (df["quarter"] == q)]
        else:
            raise ValueError("Invalid granularity")

    df1 = filter_df(df, time1, granularity)
    df2 = filter_df(df, time2, granularity)
    text1 = [t for t in df1["clean_text"] if pattern.search(t)]
    text2 = [t for t in df2["clean_text"] if pattern.search(t)]

    sentiment_result1, detailed_examples1 = analyze_sentiment(text1)
    sentiment_result2, detailed_examples2 = analyze_sentiment(text2)

    total_mentions1 = len(text1)
    total_mentions2 = len(text2)

    sentiment_percent_list1 = [
        {"sentiment": k, "value": safe_percent(v, total_mentions1)}
        for k, v in sentiment_result1.items()
    ]
    sentiment_percent_list2 = [
        {"sentiment": k, "value": safe_percent(v, total_mentions2)}
        for k, v in sentiment_result2.items()
    ]

    sentiment_count_list1 = [{"sentiment": k, "value": v} for k, v in sentiment_result1.items()]
    sentiment_count_list2 = [{"sentiment": k, "value": v} for k, v in sentiment_result2.items()]

    examples1 = []
    for sentiment in ["positive", "neutral", "negative"]:
        subset1 = [d for d in detailed_examples1 if d["sentiment"] == sentiment]
        examples1.extend(sorted(subset1, key=lambda x: abs(x["sentiment_score"]), reverse=True)[:2])
    examples1 = examples1[:6]

    examples2 = []
    for sentiment in ["positive", "neutral", "negative"]:
        subset2 = [d for d in detailed_examples2 if d["sentiment"] == sentiment]
        examples2.extend(sorted(subset2, key=lambda x: abs(x["sentiment_score"]), reverse=True)[:2])
    examples2 = examples2[:6]

    block1 = {
        "total_mentions": total_mentions1,
        "sentiment_percent": sentiment_percent_list1,
        "sentiment_count": sentiment_count_list1,
        "examples": examples1,
    } if total_mentions1 else {"total_mentions": 0, "sentiment_percent": [], "sentiment_count": [], "examples": []}

    block2 = {
        "total_mentions": total_mentions2,
        "sentiment_percent": sentiment_percent_list2,
        "sentiment_count": sentiment_count_list2,
        "examples": examples2,
    } if total_mentions2 else {"total_mentions": 0, "sentiment_percent": [], "sentiment_count": [], "examples": []}

    return {
        "brand": brand_name,
        "granularity": granularity,
        "compare": {
            str(time1): block1,
            str(time2): block2,
        },
    }

#-------- Manual up
@router.patch("/brand/time-compare/sentiment-update")
def update_sentiment_label(payload: dict = Body(...)):
    """
    payload = {
        "text": "baby loves nan formula",
        "new_sentiment": "positive",
        "new_score": 0.95
    }
    """
    text = payload.get("text")
    new_sentiment = payload.get("new_sentiment")
    new_score = payload.get("new_score")
    new_rule = payload.get("new_rule")

    if not text or not new_sentiment:
        return {"error": "Missing 'text' or 'new_sentiment'."}

    update_sentiment_cache(text, new_sentiment, new_score, new_rule)
    return {"status": "success", "updated": {"text": text, "new_sentiment": new_sentiment}}


