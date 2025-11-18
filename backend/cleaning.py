import re
import string
import emoji 
import pandas as pd
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize 

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
    tokens = word_tokenize(text)
    replaced = [slang_dict.get(token,token) for token in tokens]
    return ' '.join(replaced)

def clean_text(text:str,slang_dict:dict =None) ->str:
    if not isinstance(text,str):
        return ''
    text = (text.replace('<Media omitted>', '')
            .replace('This message was deleted', '')
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
    df['clean_text'] = df['text'].apply(lambda x: clean_text(x,slang_dict))
    #remove empty
    df=df[df['clean_text'].str.strip()!=""]
    
    #add datetime feature
    df['year']=df['datetime'].dt.year
    df['quarter']=df['datetime'].dt.quarter
    df['month']=df['datetime'].dt.month

    return df

if __name__=="__main__":
    df_slang=pd.read_csv("data/other_data/slang_to_formal.csv")
    slang_dict = dict(zip(df_slang['slang'].str.lower(),df_slang['formal'].str.lower()))
    df = pd.read_parquet("data/processing_output/structure_chat/2024/structured_chat.parquet")

    df_cleaned = clean_dataframe(df,slang_dict)
    output_path = "data/processing_output/clean_chat_df/2024/cleaned_chat_dataframe_new.parquet"
    df_cleaned.to_parquet(output_path,index=False)
    print(f"✅save to {output_path}")
    