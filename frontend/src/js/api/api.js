const BASE_URL = "http://127.0.0.1:8000";


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


//general keyword frequency
async function keywordFrequency(params = {}) {
    const url = new URL(`${BASE_URL}/keyword-frequency`);

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

// new_keywords 
async function new_keywords(params = {}) {
    const url = new URL(`${BASE_URL}/new-keyword-prediction`);
    
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

//BRAND keyword
async function get_brand_keyword(params = {}) {
    const url = new URL(`${BASE_URL}/brand/keyword-frequency`);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

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
    const url = new URL(`${BASE_URL}/brand/sentiment-analysis`);
    
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

// consumer perception
async function get_consumer_perception(params = {}) {
    const url = new URL(`${BASE_URL}/brand/consumer-perception`);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    }
    );

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
    const url = new URL(`${BASE_URL}/brand/time-compare/frequency`);
    
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

//time-compare sentiment
async function get_time_compare_sentiment(params = {}) {
    const url = new URL(`${BASE_URL}/brand/time-compare/sentiment`);
    
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

//time compare share of voice
async function get_time_compare_share_of_voice(params = {}) {
    const url = new URL(`${BASE_URL}/brand/time-compare/share-of-voice`);
    
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

//brand comparison share of voice
async function get_share_of_voice(params = {}) {
    const url = new URL(`${BASE_URL}/category/share-of-voice`);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    }
    );
    
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
    const url = new URL(`${BASE_URL}/category/consumer-perception`);

    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    }
    );

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

    if(data && typeof data === 'object' && data.associated_keywords){
        return data.associated_keywords;
    }
    return []
}

export {
    groupChat,
    keywordFrequency,
    new_keywords,
    get_brand_keyword,
    add_brand_keyword,
    remove_brand_keyword,
    get_sentiment_analysis,
    get_consumer_perception,
    get_time_compare_frequency,
    get_time_compare_sentiment,
    get_time_compare_share_of_voice,
    get_share_of_voice,
    get_comparison_consumer_perception
};
