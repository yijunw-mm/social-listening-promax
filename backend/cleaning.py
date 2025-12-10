import re
import string
import emoji 
import pandas as pd
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize 
import os 
from tqdm import tqdm

STOPWORDS = set(stopwords.words("english"))
emoji_pattern = re.compile(
    "["u"\U0001F600-\U0001F64F"  # emoticons
    u"\U0001F300-\U0001F5FF"     # symbols & pictographs
    u"\U0001F680-\U0001F6FF"     # transport & map symbols
    u"\U0001F1E0-\U0001F1FF"     # flags
    "]+", flags=re.UNICODE
)

def remove_emoji(text):
    return emoji_pattern.sub(r'',text)

def replace_slang(text:str,slang_dict:dict) ->str:
    """replace the slang to formal english"""
    text_out = text
    for slang, formal in slang_dict.items():
        pattern = rf"\b{re.escape(slang)}\b"
        text_out = re.sub(pattern,formal,text_out,flags=re.IGNORECASE)
    return text_out

    #tokens = word_tokenize(text)
    #replaced = [slang_dict.get(token,token) for token in tokens]
    #return ' '.join(replaced)

def clean_text(text:str,slang_dict:dict =None) ->str:
    if text is None:
        return ''
    if not isinstance(text,str):
        text=str(text)

    text = (text.replace('<Media omitted>', '')
            .replace('This message was deleted', '')
            .replace('This message was edited', '')
            .replace('\n', ' ').strip())
    
    #remove website link, number, emoji
    text = re.sub(r'http\S+|www\S+', '', text)
    text = re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '', text)
    text = re.sub(r'\b\d+\b', '', text)
    text = remove_emoji(text)
    #remove punctuation
    text = text.translate(str.maketrans("","",string.punctuation))
    text = re.sub(r'\s+',' ', text).strip()
    text = text.lower()
    text = re.sub(r'(.)\1{2,}',r'\1', text)
    text=text.lower()
    #replace slang
    if slang_dict:
        text = replace_slang(text,slang_dict)
    #remove stopwords
    tokens = word_tokenize(text)
    tokens = [t for t in tokens if t not in STOPWORDS]
    return ' '.join(tokens)

def clean_dataframe(df:pd.DataFrame,slang_dict=None) ->pd.DataFrame:
    df=df.copy()
    df['datetime']=pd.to_datetime(df['datetime'],errors="coerce")
    df['clean_text'] = (
        df['text']
        .fillna('')
        .astype(str).apply(lambda x: clean_text(x,slang_dict)))
    #remove empty
    df=df[df['clean_text'].str.strip()!=""]
    
    #add datetime feature
    df['year']=df['datetime'].dt.year
    df['quarter']=df['datetime'].dt.quarter
    df['month']=df['datetime'].dt.month

    return df
def clean_all_years(input_base="data/processing_output/structure_chat",
                    output_base="data/processing_output/clean_chat_df",
                    slang_dict=None):
    """
    read every file and clean it
    """
    if not os.path.exists(input_base):
        print(f"⚠️ Input base path not found: {input_base}")
        return


    for year_folder in os.listdir(input_base):
        year_path = os.path.join(input_base, year_folder)
        if not os.path.isdir(year_path):
            continue

        output_folder = os.path.join(output_base, year_folder)
        os.makedirs(output_folder, exist_ok=True)

        print(f"Cleaning group year: {year_folder}")
        for file in tqdm(os.listdir(year_path), desc=f"Cleaning {year_folder}"):
            
            input_path = os.path.join(year_path, file)
            output_path = os.path.join(output_folder, file)


            try:
                df = pd.read_parquet(input_path)
                df_cleaned = clean_dataframe(df, slang_dict)

                df_cleaned.to_parquet(output_path, index=False)
                print(f"✅ Cleaned & saved: {output_path} ({len(df_cleaned)} rows)")


            except Exception as e:
                print(f"❌ Error cleaning {file}: {e}")


if __name__=="__main__":
    df_slang=pd.read_csv("data/other_data/slang_to_formal.csv")
    slang_dict = dict(zip(df_slang['slang'].str.lower(),df_slang['formal'].str.lower()))
    clean_all_years(slang_dict=slang_dict)