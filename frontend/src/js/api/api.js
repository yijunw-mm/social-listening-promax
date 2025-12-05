const BASE_URL = "http://127.0.0.1:8000";

// Helper function to build URL with query parameters
function buildURL(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.keys(params).forEach(key => {
        const value = params[key];
        // Handle arrays by appending each value separately (for FastAPI List[str] params)
        if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, v));
        } else {
            url.searchParams.append(key, value);
        }
    });
    return url;
}

//upload file (zip or txt)
async function uploadFile(file) {
    const url = new URL(`${BASE_URL}/upload/`);
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(url, {
        method: "POST",
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//group chat number
async function groupChat(params = {}) {
    const url = new URL(`${BASE_URL}/chat-number`);

    // attach params to URL
    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//available years
async function availableYears(params = {}) {
    const url = new URL(`${BASE_URL}/available-years`);

    // attach params to URL
    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//idont get how this happens like wtfffffffff, oh wtf
//general keyword frequency
async function keywordFrequency(params = {}) {
    const url = buildURL('/keyword-frequency', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

// new_keywords
async function new_keywords(params = {}) {
    const url = buildURL('/new-keyword-prediction', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

// keyword co-occurrence messages showing
async function keyword_cooccurrence(params = {}) {
    const url = buildURL('/keyword/co-occurrence', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//BRAND keyword
async function get_brand_keyword(params = {}) {
    const url = buildURL('/brand/keyword-frequency', params);

    console.log('Fetching URL:', url.toString());

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
        console.error('Response not OK');
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw data received:', JSON.stringify(data));

    return data;
}

//add keyword 
async function add_brand_keyword(params = {}) {
    const url = new URL(`${BASE_URL}/brand/add-keyword`);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//remove keyword
async function remove_brand_keyword(params = {}) {
    const url = new URL(`${BASE_URL}/brand/remove-keyword`);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
}

//brand sentiment 
async function get_sentiment_analysis(params = {}) {
    const url = buildURL('/brand/sentiment-analysis', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}


// consumer perception
async function get_consumer_perception(params = {}) {
    const url = buildURL('/brand/consumer-perception', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    let data = await response.json();

    // Backend returns {brand: "...", associated_words: [...]}
    if(data && typeof data === 'object' && data.associated_words){
        return data;
    }

    return { associated_words: [] };

}

//time-compare keyword frequency
async function get_time_compare_frequency(params = {}) {
    const url = buildURL('/brand/time-compare/frequency', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
}

//time-compare sentiment
async function get_time_compare_sentiment(params = {}) {
    const url = buildURL('/brand/time-compare/sentiment', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
}

//time compare share of voice
async function get_time_compare_share_of_voice(params = {}) {
    const url = buildURL('/category/time-compare/share-of-voice', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
}

//update sentiment for time comparison
async function update_time_compare_sentiment(payload) {
    const url = new URL(`${BASE_URL}/brand/time-compare/sentiment-update`);

    const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
}

//category keyword frequency (category-level data for Consumer Perception tab)
async function get_category_keyword_frequency(params = {}) {
    const url = buildURL('/category/keyword-frequency', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if(!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
    }

    return await response.json();
}


//brand comparison share of voice
async function get_share_of_voice(params = {}) {
    const url = buildURL('/category/share-of-voice', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    const category_name = params.category_name;
    if (!category_name){
        return [];
    }
    if (data[category_name]) {
        const categoryData = data[category_name];
        return categoryData.share_of_voice || [];
    }
    return [];
}

//brand comparison consumer perception
async function get_comparison_consumer_perception(params = {}) {
    const url = buildURL('/category/consumer-perception', params);

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    let data = await response.json();

    if (data.error) {
        return [{ word: "Error", count: 0, error: data.error }];
    }

    // Backend returns comparison structure: {compare: {time1: {associated_words: []}, time2: {associated_words: []}}}
    // Merge associated_words from both time periods
    if (data && data.compare) {
        const allWords = {};
        Object.values(data.compare).forEach(timeBlock => {
            if (timeBlock.associated_words && Array.isArray(timeBlock.associated_words)) {
                timeBlock.associated_words.forEach(item => {
                    if (allWords[item.word]) {
                        allWords[item.word] += item.count;
                    } else {
                        allWords[item.word] = item.count;
                    }
                });
            }
        });
        return Object.entries(allWords).map(([word, count]) => ({word, count}));
    }

    // Fallback for single-time format
    if(data && typeof data === 'object' && data.associated_words){
        return data.associated_words;
    }
    return []
}



//ADMIN FEATURES

//add brand, and mention category
async function add_brand(params = {}) {
    const url = new URL(`${BASE_URL}/admin/brand`);

    // Add token from localStorage to headers
    const token = localStorage.getItem('authToken');

    // Add other params to URL
    Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
    } else {
        url.searchParams.append(key, value);
    }
});


    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "token": token
        }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//add brand keyword - we can make it a list, brand_name as param
async function add_brand_words(params = {}) {
    const url = new URL(`${BASE_URL}/admin/keyword`);

    const token = localStorage.getItem('authToken');

    Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
    } else {
        url.searchParams.append(key, value);
    }
});


    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "token": token
        }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}


//add category
async function add_category(params = {}) {
    const url = new URL(`${BASE_URL}/admin/category`);

    const token = localStorage.getItem('authToken');

    Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
    } else {
        url.searchParams.append(key, value);
    }
});

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "token": token
        }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//add slang/variant
async function add_slang_variant(params = {}) {
    const url = new URL(`${BASE_URL}/admin/slang`);

    const token = localStorage.getItem('authToken');

    Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
    } else {
        url.searchParams.append(key, value);
    }
});

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "token": token
        }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//add general keyword
async function add_general_keyword(params = {}) {
    const url = new URL(`${BASE_URL}/admin/general-keyword`);

    const token = localStorage.getItem('authToken');

    Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
    } else {
        url.searchParams.append(key, value);
    }
        });

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "token": token
        }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

// remove brand
async function remove_brand(params = {}) {
    const url = new URL(`${BASE_URL}/admin/brand`);

    const token = localStorage.getItem('authToken');

    Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
    } else {
        url.searchParams.append(key, value);
    }
});


    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "token": token
        }
    });

    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

//remove brand keyword
async function remove_brand_words(params = {}) {
    const url = new URL(`${BASE_URL}/admin/keyword`);

    const token = localStorage.getItem('authToken');

    Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
    } else {
        url.searchParams.append(key, value);
    }
});


    const response = await fetch(url, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "token": token
        }
    });
    if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}


export {
    uploadFile,
    groupChat,
    availableYears,
    keywordFrequency,
    new_keywords,
    keyword_cooccurrence,
    get_brand_keyword,
    add_brand_keyword,
    remove_brand_keyword,
    get_sentiment_analysis,
    get_consumer_perception,
    get_time_compare_frequency,
    get_time_compare_sentiment,
    update_time_compare_sentiment,
    get_time_compare_share_of_voice,
    get_share_of_voice,
    get_category_keyword_frequency,
    get_category_keyword_frequency as get_comparison_keyword_frequency,
    get_comparison_consumer_perception,
    add_brand,
    add_brand_words,
    add_category,
    add_slang_variant,
    add_general_keyword,
    remove_brand,
    remove_brand_words 
};
