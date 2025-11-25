"""
Shared state across routers
"""
import pandas as pd

# Load brand keywords once
brand_keyword_df = pd.read_csv("data/other_data/newest_brand_keywords.csv", keep_default_na=False, na_values=[""])
brand_keyword_dict = brand_keyword_df.groupby("brand")["keyword"].apply(list).to_dict()

# Shared custom keywords dictionary
custom_keywords_dict = {brand: set() for brand in brand_keyword_dict}
