uvicorn backend.main:app --reload 
========Tab1=============
http://127.0.0.1:8000/keyword-frequency
parameter:
year=2025
stage: Pregnant,Pre-pregnancy, Infant/Preschool,Weaning, Preschool, Enrichment, Other
month=6,  take from [1,12]
quarter=3,    take from [1,4]

http://127.0.0.1:8000/new-keyword-prediction

==========Tab2=========
http://127.0.0.1:8000/brand/keyword-frequency
parameter:
brand_name:
group_id, year, month, quarter 

add keyword, method: POST
http://127.0.0.1:8000/brand/add-keyword
remove keyword, method: POST
http://127.0.0.1:8000/brand/remove-keyword

sentiment analysis
http://127.0.0.1:8000/brand/sentiment-analysis
parameter:
brand_name
group_id
year, month, quarter

consumer perception
http://127.0.0.1:8000//brand/consumer-perception
parameter:
same as above
top_k


========Tab3===========
keyword frequency across time 
http://127.0.0.1:8000/brand/time-compare/frequency
parameter:
brand_name
granularity, select from ["year","month","quarter"]
time1, corresponding time integer
time2, corresponding time integer
year: just year
month:202505->May 2025
quarter: 20251-> first quarter in 2025
example:
http://127.0.0.1:8000/brand/time-compare/frequency?brand_name=huggies&granularity=month&time1=202506&time2=202507

same as sentiment 
http://127.0.0.1:8000/brand/time-compare/sentiment?brand_name=huggies&granularity=month&time1=202506&time2=202507

share of voice 
http://127.0.0.1:8000/category/time-compare/share-of-voice
parameter:
category_name: hospital, formula milk, diaper,weaning
granularity, select from ["year","month","quarter"]
time1, corresponding time integer
time2, corresponding time integer
year: just year
month:202505->May 2025
quarter: 20251-> first quarter in 2025

==============Tab4===============
#share of voice
#http://127.0.0.1:8000/category/share-of-voice

share of voice and co-occurence
http://127.0.0.1:8000/category/consumer-perception?category_name=diaper

category name is ["formula milk", "diaper","hospital","weaning"]

# Admain Feature
--add brand--
http://127.0.0.1:8000/admin/brand
method:POST
parameter: brand_name, category_name, token

-- add brand keyword --
http://127.0.0.1:8000/admin/keyword
method:POST
parameter: brand_name, keyword, token 

-- add category --
http://127.0.0.1:8000/admin/category 
method:POST 
parameter: category_name, token 

-- add slang/variant
http://127.0.0.1:8000/admin/slang
mehtod:POST 
parameter: slang, formal, token 

-- add general keyword
http://127.0.0.1:8000/admin/general-keyword
method: POST 
parameter: general_kw, token 

-- remove brand --
http://127.0.0.1:8000/admin/brand
method:DELETE 
parameter:brand_name, token 

--remove brand keyword --
http://127.0.0.1:8000/admin/keyword 
mehtod:DELETE 
parameter: brand_name, keyword,token 

--get list of brand and category --
http://127.0.0.1:8000/dropdown-list
method:GET