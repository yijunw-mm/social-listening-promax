from fastapi import FastAPI,File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from backend.general_kw_analysis_tab1 import keyword_frequency, new_keyword_prediction
import pandas as pd
import os,shutil
from backend import model_loader
from backend.data_loader import load_chat_data,refresh_duckdb_cache
from backend.ingestion_second import process_single_file
from backend.cleaning import clean_dataframe
from backend.group_stage import build_groups_from_messages

from backend.routers import general_tab1
from backend.routers import brand_tab2
from backend.routers import time_comparison_tab3
from backend.routers import sentiment_analysis_tab3
from backend.routers import brand_camparison_tab4
from backend.routers import admin_feature

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
def startup_event():
    _=load_chat_data()
    
@app.get("/")
def root():
    return {"message": "Keyword API is running"}

#----------------
# upload chat data
#----------------
UPLOADED_DIR = "data/uploads"
@app.post("/upload/")
async def upload_file(file:UploadFile =File(...)):
    os.makedirs(UPLOADED_DIR,exist_ok=True)
    uploaded_path = os.path.join(UPLOADED_DIR,file.filename)
    with open(uploaded_path,"wb") as buffer:
        shutil.copyfileobj(file.file,buffer)
    
    df_raw,group_id,group_year = process_single_file(uploaded_path)
    df_cleaned = clean_dataframe(df_raw)

    output_dir = f"data/processing_output/clean_chat_df/{group_year}"
    os.makedirs(output_dir,exist_ok=True)
    df_cleaned.to_parquet(f"{output_dir}/group_{group_id}.parquet",index=False)
    try:
        build_groups_from_messages()
        refresh_duckdb_cache()
        print("group stage data updated, refresh duckdb")
    except Exception as e:
        print("failed to update group stage")

    return {"status":"success","group_id":group_id,"group_year":group_year}

app.include_router(general_tab1.router)
app.include_router(brand_tab2.router)
app.include_router(time_comparison_tab3.router)
app.include_router(sentiment_analysis_tab3.router)
app.include_router(brand_camparison_tab4.router)
app.include_router(admin_feature.router)