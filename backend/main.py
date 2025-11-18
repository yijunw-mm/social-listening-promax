from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.general_kw_analysis_tab1 import keyword_frequency, new_keyword_prediction
import pandas as pd
from backend import model_loader
from backend.data_loader import load_chat_data

from backend.routers import general_tab1
from backend.routers import brand_tab2
from backend.routers import time_comparison_tab3
from backend.routers import brand_camparison_tab4

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

app.include_router(general_tab1.router)
app.include_router(brand_tab2.router)
app.include_router(time_comparison_tab3.router)
app.include_router(brand_camparison_tab4.router)