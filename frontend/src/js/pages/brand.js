import {
    get_time_compare_frequency,
    get_time_compare_sentiment,
    update_time_compare_sentiment,
    get_time_compare_brand_consumer_perception,
    add_brand_words,
    remove_brand_words
} from '../api/api.js';

import chartCache from '../chartCache.js';

// Register the datalabels plugin globally - check if available first
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let chartInstances = {};

// Set to track hidden keywords for brand keyword frequency chart
let hiddenBrandKeywords = new Set();

// Set to track hidden words for brand consumer perception chart
let hiddenBrandPerceptionWords = new Set();

// Helper function to get filter parameters (years and group_id)
function getFilterParams(additionalParams = {}) {
    const params = { ...additionalParams };
    const selectedYears = window.getSelectedYears ? window.getSelectedYears() : [];
    const groupChat = window.getSelectedGroupChats ? window.getSelectedGroupChats() : [];

    // If years are selected, use group_year parameter
    if (selectedYears && selectedYears.length > 0) {
        params.group_year = selectedYears.length === 1 ? selectedYears[0] : selectedYears;
    }

    // If group chats are selected, add group_id parameter
    if (groupChat && Array.isArray(groupChat) && groupChat.length > 0) {
        params.group_id = groupChat;
    }

    return params;
}


// Brand to category mapping
// //const brandCategoryMap = {
//     'mamypoko': 'diaper',
//     'huggies': 'diaper',
//     'pampers': 'diaper',
//     'drypers': 'diaper',
//     'merries': 'diaper',
//     'offspring': 'diaper',
//     'rascal & friends': 'diaper',
//     'homie': 'diaper',
//     'hey tiger': 'diaper',
//     'nino nana': 'diaper',
//     'applecrumby': 'diaper',
//     'peachybum':'diaper',
//     'nan': 'formula milk',
//     'lactogen': 'formula milk',
//     'friso': 'formula milk',
//     'enfamil': 'formula milk',
//     'aptamil': 'formula milk',
//     's26': 'formula milk',
//     'dumex dugro': 'formula milk',
//     'karihome': 'formula milk',
//     'bellamy organic': 'formula milk',
//     'similac': 'formula milk',
//     'pediasure': 'formula milk',
//     'applecrumbly': 'weaning',
//     'little blossom': 'weaning',
//     'rafferty garden': 'weaning',
//     'happy baby organics': 'weaning',
//     'heinz baby': 'weaning',
//     'only organic': 'weaning',
//     'holle': 'weaning',
//     'ella kitchen': 'weaning',
//     'gerber': 'weaning',
//     'mount alvernia': 'hospital',
//     'thomson medical centre': 'hospital',
//     'mount elizabeth': 'hospital',
//     'gleneagles': 'hospital',
//     'raffles hospital': 'hospital',
//     'national university hospital': 'hospital',
//     'kkh': 'hospital',
//     'parkway east hospital': 'hospital',
//     'singapore general hospital': 'hospital',
//     'sengkang general hospital': 'hospital',
//     'changi general hospital': 'hospital',
//     'johnson': 'diaper'
// };

// Export individual loading functions for each chart
export async function loadKeywordComparisonData(brandName, granularity, time1, time2) {
    console.log('Loading keyword comparison data:', { brandName, granularity, time1, time2 });
    await loadKeywordComparison(brandName, granularity, time1, time2);
}

export async function loadSentimentComparisonData(brandName, granularity, time1, time2) {
    console.log('Loading sentiment comparison data:', { brandName, granularity, time1, time2 });
    await loadSentimentComparison(brandName, granularity, time1, time2);
}

export async function loadBrandPerceptionComparisonData(brandName, granularity, time1, time2) {
    console.log('Loading brand consumer perception data:', { brandName, granularity, time1, time2 });
    await loadBrandPerceptionComparison(brandName, granularity, time1, time2);
}

async function loadKeywordComparison(brandName, granularity, time1, time2) {
    const canvasId = 'keywordCompareChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    try {
        const params = getFilterParams({
            brand_name: brandName,
            granularity: granularity,
            time1: time1,
            time2: time2
        });

        // Check cache first
        const cachedData = chartCache.get(canvasId, params);
        if (cachedData) {
            console.log('Using cached data for keyword comparison');
            renderKeywordComparisonChart(canvasId, cachedData, time1, time2);
            return;
        }

        // Not in cache, show loading and fetch data
        if (loadingOverlay) loadingOverlay.classList.add('active');

        const data = await get_time_compare_frequency(params);

        console.log('=== KEYWORD COMPARISON DEBUG ===');
        console.log('Full API response:', JSON.stringify(data, null, 2));
        console.log('Data type:', typeof data);
        console.log('Data.compare exists:', !!data.compare);
        console.log('Time1 value:', time1);
        console.log('Time2 value:', time2);
        console.log('Time1 keywords:', data.compare?.[time1]);
        console.log('Time2 keywords:', data.compare?.[time2]);
        console.log('================================');

        if (data.error) {
            console.error('API returned error:', data.error);
            showNoDataMessage(canvasId, data.error);
            return;
        }

        // Cache the data
        chartCache.set(canvasId, params, data);

        renderKeywordComparisonChart(canvasId, data, time1, time2);
    } catch (err) {
        console.error('=== ERROR IN loadKeywordComparison ===');
        console.error('Error type:', err.name);
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        console.error('======================================');
        showNoDataMessage(canvasId, 'Error loading data: ' + err.message);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

async function loadSentimentComparison(brandName, granularity, time1, time2) {
    const canvasId = 'sentimentCompareChart';
    const loadingOverlay = document.getElementById('loadingOverlay-sentimentCompareChart');
    const analyzeButton = document.getElementById('sentimentCompareBtn');

    try {
        const params = getFilterParams({
            brand_name: brandName,
            granularity: granularity,
            time1: time1,
            time2: time2
        });

        // Check cache first
        const cachedData = chartCache.get(canvasId, params);
        if (cachedData) {
            console.log('Using cached data for sentiment comparison');
            renderSentimentComparisonChart(canvasId, cachedData, time1, time2);
            displaySentimentComparisonExamples(cachedData.compare || {}, time1, time2);
            return;
        }

        // Not in cache, show loading and fetch data
        if (loadingOverlay) loadingOverlay.classList.add('active');

        // Disable the analyze button to prevent multiple clicks
        if (analyzeButton) {
            analyzeButton.disabled = true;
            analyzeButton.style.opacity = '0.5';
            analyzeButton.style.cursor = 'not-allowed';
            analyzeButton.textContent = 'Analyzing...';
        }

        const data = await get_time_compare_sentiment(params);

        console.log('Sentiment comparison data:', data);

        if (data.error) {
            showNoDataMessage(canvasId, data.error);
            displaySentimentComparisonExamples({}, time1, time2);
            return;
        }

        // Cache the data
        chartCache.set(canvasId, params, data);

        renderSentimentComparisonChart(canvasId, data, time1, time2);
        displaySentimentComparisonExamples(data.compare || {}, time1, time2);
    } catch (err) {
        console.error('Error loading sentiment comparison:', err);
        showNoDataMessage(canvasId, 'Error loading data');
        displaySentimentComparisonExamples({}, time1, time2);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');

        // Re-enable the analyze button
        if (analyzeButton) {
            analyzeButton.disabled = false;
            analyzeButton.style.opacity = '1';
            analyzeButton.style.cursor = 'pointer';
            analyzeButton.textContent = 'Analyze';
        }
    }
}

async function loadBrandPerceptionComparison(brandName, granularity, time1, time2) {
    const canvasId = 'brandPerceptionCompareChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    try {
        const params = getFilterParams({
            brand_name: brandName,
            granularity: granularity,
            time1: time1,
            time2: time2
        });

        // Check cache first
        const cachedData = chartCache.get(canvasId, params);
        if (cachedData) {
            console.log('Using cached data for brand consumer perception');
            renderBrandPerceptionComparisonChart(canvasId, cachedData, time1, time2);
            return;
        }

        // Not in cache, show loading and fetch data
        if (loadingOverlay) loadingOverlay.classList.add('active');

        const data = await get_time_compare_brand_consumer_perception(params);

        console.log('Brand consumer perception data:', data);

        if (data.error) {
            showNoDataMessage(canvasId, data.error);
            return;
        }

        // Cache the data
        chartCache.set(canvasId, params, data);

        renderBrandPerceptionComparisonChart(canvasId, data, time1, time2);
    } catch (err) {
        console.error('Error loading brand consumer perception:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// Chart Rendering Functions
function renderKeywordComparisonChart(canvasId, data, time1, time2) {
    console.log('=== renderKeywordComparisonChart called ===');
    console.log('canvasId:', canvasId);
    console.log('time1:', time1, 'time2:', time2);

    const canvas = document.getElementById(canvasId);
    console.log('Canvas element found:', !!canvas);
    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }

    const ctx = canvas.getContext('2d');
    const compare = data.compare;
    console.log('Compare object:', compare);

    // Extract keyword data from both time periods
    const time1Data = compare[time1] || [];
    const time2Data = compare[time2] || [];

    console.log('time1Data:', time1Data);
    console.log('time2Data:', time2Data);
    console.log('time1Data is array:', Array.isArray(time1Data));
    console.log('time2Data is array:', Array.isArray(time2Data));

    // Handle error cases
    if (time1Data.error || time2Data.error) {
        console.error('Error in time data:', time1Data.error || time2Data.error);
        showNoDataMessage(canvasId, time1Data.error || time2Data.error);
        return;
    }

    // Combine all keywords from both periods
    const allKeywords = new Set();
    time1Data.forEach(item => allKeywords.add(item.keyword));
    time2Data.forEach(item => allKeywords.add(item.keyword));

    // Create count maps
    const time1Map = Object.fromEntries(time1Data.map(item => [item.keyword, item.count]));
    const time2Map = Object.fromEntries(time2Data.map(item => [item.keyword, item.count]));

    // Filter out hidden keywords
    const filteredKeywords = Array.from(allKeywords).filter(kw => !hiddenBrandKeywords.has(kw.toLowerCase()));

    // Sort keywords by total count (sum of both periods) in descending order
    const keywords = filteredKeywords.sort((a, b) => {
        const totalA = (time1Map[a] || 0) + (time2Map[a] || 0);
        const totalB = (time1Map[b] || 0) + (time2Map[b] || 0);
        return totalB - totalA;
    });

    // Prepare datasets
    const dataset1 = keywords.map(kw => time1Map[kw] || 0);
    const dataset2 = keywords.map(kw => time2Map[kw] || 0);

    console.log('About to create chart with:', {
        keywords: keywords.length,
        dataset1Length: dataset1.length,
        dataset2Length: dataset2.length
    });

    if (chartInstances[canvasId]) {
        console.log('Destroying existing chart instance');
        chartInstances[canvasId].destroy();
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: keywords,
            datasets: [
                {
                    label: `${time1}`,
                    data: dataset1,
                    backgroundColor: '#48b7e3ff'
                },
                {
                    label: `${time2}`,
                    data: dataset2,
                    backgroundColor: '#2c4ea6ff'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af' }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#9ca3af',
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Keywords',
                        color: '#9ca3af',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: { color: '#3d4456' }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Count',
                        color: '#9ca3af',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#3d4456' }
                }
            }
        }
    });

    console.log('Chart instance created successfully:', !!chartInstances[canvasId]);
    console.log('=== renderKeywordComparisonChart completed ===');
}

function renderSentimentComparisonChart(canvasId, data, time1, time2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const compare = data.compare;

    const time1Data = compare[time1];
    const time2Data = compare[time2];

    // Handle error cases
    if (!time1Data || !time2Data || time1Data.error || time2Data.error) {
        showNoDataMessage(canvasId, time1Data?.error || time2Data?.error || 'No sentiment data');
        return;
    }

    // Display total mentions
    const time1Total = time1Data.total_mentions || 0;
    const time2Total = time2Data.total_mentions || 0;
    const totalMentionsDiv = document.getElementById('sentimentTotalMentions');
    if (totalMentionsDiv) {
        totalMentionsDiv.innerHTML = `
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-[#2a3142] p-2 rounded border border-[#3d4456]">
                    <div class="text-gray-400 text-xs mb-0.5">${time1} Total Mentions</div>
                    <div class="text-white text-lg font-semibold">${time1Total.toLocaleString()}</div>
                </div>
                <div class="bg-[#2a3142] p-2 rounded border border-[#3d4456]">
                    <div class="text-gray-400 text-xs mb-0.5">${time2} Total Mentions</div>
                    <div class="text-white text-lg font-semibold">${time2Total.toLocaleString()}</div>
                </div>
            </div>
        `;
    }

    // Extract sentiment percentages for both time periods
    const time1Percent = time1Data.sentiment_percent?.reduce((acc, item) => {
        acc[item.sentiment] = item.value;
        return acc;
    }, {}) || {};

    const time2Percent = time2Data.sentiment_percent?.reduce((acc, item) => {
        acc[item.sentiment] = item.value;
        return acc;
    }, {}) || {};

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [
                {
                    label: `${time1}`,
                    data: [time1Percent.positive || 0, time1Percent.neutral || 0, time1Percent.negative || 0],
                    backgroundColor: '#48b7e3ff',
                    position: 'bottom'
                },
                {
                    label: `${time2}`,
                    data: [time2Percent.positive || 0, time2Percent.neutral || 0, time2Percent.negative || 0],
                    backgroundColor: '#2c4ea6ff',
                    position: 'bottom'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: {
                    top:40
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y || 0;
                            return label + ': ' + value.toFixed(1) + '%';
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#9ca3af',
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    formatter: function(value) {
                        return value > 0 ? value.toFixed(1) + '%' : '';
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Sentiment',
                        color: '#9ca3af',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#3d4456' }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Percentage (%)',
                        color: '#9ca3af',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: {
                        color: '#9ca3af',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: { color: '#3d4456' }
                }
            }
        }
    });
}

function renderBrandPerceptionComparisonChart(canvasId, data, time1, time2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const compare = data.compare;

    const time1Data = compare[time1];
    const time2Data = compare[time2];

    // Handle error cases
    if (!time1Data || !time2Data || time1Data.error || time2Data.error) {
        showNoDataMessage(canvasId, time1Data?.error || time2Data?.error || 'No consumer perception data');
        return;
    }

    // Extract associated words from both time periods
    const words1 = time1Data.associated_words || [];
    const words2 = time2Data.associated_words || [];

    // Combine all unique words
    const allWords = new Set();
    const wordCounts = {};

    words1.forEach(item => {
        allWords.add(item.word);
        wordCounts[item.word] = { time1: item.count || 0, time2: 0 };
    });

    words2.forEach(item => {
        allWords.add(item.word);
        if (wordCounts[item.word]) {
            wordCounts[item.word].time2 = item.count || 0;
        } else {
            wordCounts[item.word] = { time1: 0, time2: item.count || 0 };
        }
    });

    // Filter out hidden words
    const filteredWords = Array.from(allWords).filter(word => !hiddenBrandPerceptionWords.has(word.toLowerCase()));

    // Sort by total count and take top 20
    const sortedWords = filteredWords.sort((a, b) => {
        const totalA = wordCounts[a].time1 + wordCounts[a].time2;
        const totalB = wordCounts[b].time1 + wordCounts[b].time2;
        return totalB - totalA;
    }).slice(0, 20);

    // Prepare datasets
    const dataset1 = sortedWords.map(word => wordCounts[word].time1);
    const dataset2 = sortedWords.map(word => wordCounts[word].time2);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedWords,
            datasets: [
                {
                    label: `${time1}`,
                    data: dataset1,
                    backgroundColor: '#48b7e3ff'
                },
                {
                    label: `${time2}`,
                    data: dataset2,
                    backgroundColor: '#2c4ea6ff'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af' }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#9ca3af',
                    font: {
                        weight: 'bold',
                        size: 10
                    },
                    formatter: function(value) {
                        return value > 0 ? value : '';
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Associated Words',
                        color: '#9ca3af',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: { color: '#3d4456' }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency Count',
                        color: '#9ca3af',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { color: '#9ca3af' },
                    grid: { color: '#3d4456' }
                }
            }
        }
    });
}

function showNoDataMessage(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

// ---- KEYWORD MANAGEMENT FOR TIME COMPARISON ----
export function initTimeKeywordManagement() {
    const addBtn = document.getElementById('timeAddKeywordBtn');
    const keywordInput = document.getElementById('timeKeywordInput');

    console.log('initTimeKeywordManagement called', { addBtn, keywordInput });

    if (!addBtn || !keywordInput) {
        console.error('Time keyword management elements not found!');
        return;
    }

    // Handle add keyword
    addBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const keyword = keywordInput.value.trim();
        if (!keyword) return;

        const brandSelector = document.getElementById('brandSelector');
        const brandName = brandSelector ? brandSelector.value : 'mamypoko';

        try {
            await add_brand_words({ brand_name: brandName, keywords: [keyword] });
            console.log(`Added keyword: ${keyword} for brand: ${brandName}`);

            // Track in localStorage
            addTimeCustomKeyword(brandName, keyword);

            // Clear input
            keywordInput.value = '';

            // Clear cache to force fresh data fetch with new keyword
            chartCache.clear('keywordCompareChart');
            console.log('[Add Keyword] Cleared cache for keywordCompareChart');

            // Reload chart if there's data to compare
            const granularity = document.getElementById('keywordGranularitySelector')?.value;
            const time1 = document.getElementById('keywordTime1Input')?.value.trim();
            const time2 = document.getElementById('keywordTime2Input')?.value.trim();

            if (granularity && time1 && time2) {
                await loadKeywordComparison(brandName, granularity, time1, time2);
            }

            // Update keyword tags display
            displayTimeCustomKeywords(brandName);
        } catch (err) {
            console.error('Error adding keyword:', err);
            alert('Failed to add keyword. Please try again.');
        }
    });

    // Handle Enter key in input field
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            addBtn.click();
        }
    });

    // Display existing keywords on load
    const brandSelector = document.getElementById('brandSelector');
    if (brandSelector) {
        const brandName = brandSelector.value;
        displayTimeCustomKeywords(brandName);

        // Update keywords display when brand changes
        brandSelector.addEventListener('change', () => {
            displayTimeCustomKeywords(brandSelector.value);
        });
    }
}

async function displayTimeCustomKeywords(brandName) {
    const container = document.getElementById('timeCustomKeywordsList');
    if (!container) return;

    try {
        // Get custom keywords from localStorage
        const customKeywords = getTimeCustomKeywords(brandName);

        container.innerHTML = '';

        customKeywords.forEach(keyword => {
            const tag = document.createElement('div');
            tag.className = 'flex items-center gap-2 bg-[#C990B8] text-white px-3 py-1 rounded-full text-sm';
            tag.innerHTML = `
                <span>${keyword}</span>
                <button type="button" class="hover:text-red-300 font-bold" data-keyword="${keyword}">×</button>
            `;

            // Add remove handler
            tag.querySelector('button').addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const keywordToRemove = e.target.getAttribute('data-keyword');
                await removeTimeKeyword(brandName, keywordToRemove);
            });

            container.appendChild(tag);
        });
    } catch (err) {
        console.error('Error displaying keywords:', err);
    }
}

async function removeTimeKeyword(brandName, keyword) {
    console.log(`[removeTimeKeyword] Starting removal of keyword: ${keyword} for brand: ${brandName}`);
    try {
        const response = await remove_brand_words({ brand_name: brandName, keyword: keyword });
        console.log(`[removeTimeKeyword] API response:`, response);

        // Remove from localStorage
        removeTimeCustomKeyword(brandName, keyword);
        console.log(`[removeTimeKeyword] Removed from localStorage`);

        // Clear cache to force fresh data fetch without removed keyword
        chartCache.clear('keywordCompareChart');
        console.log('[removeTimeKeyword] Cleared cache for keywordCompareChart');

        // Reload chart if there's data to compare
        const granularity = document.getElementById('keywordGranularitySelector')?.value;
        const time1 = document.getElementById('keywordTime1Input')?.value.trim();
        const time2 = document.getElementById('keywordTime2Input')?.value.trim();

        console.log(`[removeTimeKeyword] Chart params:`, { granularity, time1, time2 });

        if (granularity && time1 && time2) {
            console.log(`[removeTimeKeyword] Reloading chart...`);
            await loadKeywordComparison(brandName, granularity, time1, time2);
        } else {
            console.log(`[removeTimeKeyword] Skipping chart reload - missing parameters`);
        }

        // Update display
        console.log(`[removeTimeKeyword] Updating keyword tags display...`);
        displayTimeCustomKeywords(brandName);
        console.log(`[removeTimeKeyword] Removal complete`);
    } catch (err) {
        console.error('[removeTimeKeyword] Error removing keyword:', err);
        alert('Failed to remove keyword: ' + err.message);
    }
}

// LocalStorage helpers for tracking custom keywords in time comparison
function getTimeCustomKeywords(brandName) {
    const stored = localStorage.getItem(`timeCustomKeywords_${brandName}`);
    return stored ? JSON.parse(stored) : [];
}

function addTimeCustomKeyword(brandName, keyword) {
    const keywords = getTimeCustomKeywords(brandName);
    if (!keywords.includes(keyword)) {
        keywords.push(keyword);
        localStorage.setItem(`timeCustomKeywords_${brandName}`, JSON.stringify(keywords));
    }
}

function removeTimeCustomKeyword(brandName, keyword) {
    const keywords = getTimeCustomKeywords(brandName);
    const filtered = keywords.filter(k => k !== keyword);
    localStorage.setItem(`timeCustomKeywords_${brandName}`, JSON.stringify(filtered));
}

// ---- SENTIMENT EXAMPLES DISPLAY & TOGGLE ----
export function initSentimentComparisonExamplesToggle() {
    const toggleBtn = document.getElementById('toggleSentimentComparisonExamples');
    const examplesList = document.getElementById('sentimentComparisonExamplesList');
    const toggleText = document.getElementById('toggleSentimentComparisonExamplesText');
    const toggleIcon = document.getElementById('toggleSentimentComparisonExamplesIcon');

    if (!toggleBtn || !examplesList) return;

    let isVisible = true;

    toggleBtn.addEventListener('click', () => {
        isVisible = !isVisible;

        if (isVisible) {
            examplesList.style.display = 'grid';
            toggleText.textContent = 'Hide';
            toggleIcon.textContent = '▼';
        } else {
            examplesList.style.display = 'none';
            toggleText.textContent = 'Show';
            toggleIcon.textContent = '▶';
        }
    });
}

// Function to show sentiment edit dialog
async function showSentimentEditDialog(example) {
    console.log('showSentimentEditDialog called with:', example);
    const currentSentiment = example.sentiment;
    const currentScore = example.sentiment_score;

    const dialog = document.createElement('div');
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    dialog.innerHTML = `
        <div style="background: #2a3142; border: 1px solid #3d4456; border-radius: 8px; padding: 24px; max-width: 28rem; width: 100%; margin: 0 16px;">
            <h3 style="color: white; font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">Edit Sentiment</h3>

            <div style="margin-bottom: 16px;">
                <p style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 8px;">"${example.text}"</p>
            </div>

            <div style="margin-bottom: 16px;">
                <label style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 8px; display: block;">Sentiment:</label>
                <select id="sentimentSelect" style="width: 100%; background: #1f252f; color: white; padding: 8px; border-radius: 4px; border: 1px solid #3d4456;">
                    <option value="positive" ${currentSentiment === 'positive' ? 'selected' : ''}>Positive</option>
                    <option value="neutral" ${currentSentiment === 'neutral' ? 'selected' : ''}>Neutral</option>
                    <option value="negative" ${currentSentiment === 'negative' ? 'selected' : ''}>Negative</option>
                </select>
            </div>

            <div style="margin-bottom: 24px;">
                <label style="color: #9ca3af; font-size: 0.875rem; margin-bottom: 8px; display: block;">Score (0-1):</label>
                <input type="number" id="scoreInput" step="0.001" min="0" max="1"
                    value="${currentScore}"
                    style="width: 100%; background: #1f252f; color: white; padding: 8px; border-radius: 4px; border: 1px solid #3d4456;">
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="cancelBtn" style="padding: 8px 16px; background: #4b5563; color: white; border-radius: 4px; border: none; cursor: pointer;">
                    Cancel
                </button>
                <button id="saveBtn" style="padding: 8px 16px; background: #2563eb; color: white; border-radius: 4px; border: none; cursor: pointer;">
                    Save
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
    console.log('Dialog appended to body:', dialog);

    const sentimentSelect = dialog.querySelector('#sentimentSelect');
    const scoreInput = dialog.querySelector('#scoreInput');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const saveBtn = dialog.querySelector('#saveBtn');

    console.log('Dialog elements found:', { sentimentSelect, scoreInput, cancelBtn, saveBtn });

    cancelBtn.addEventListener('click', () => {
        dialog.remove();
    });

    saveBtn.addEventListener('click', async () => {
        const newSentiment = sentimentSelect.value;
        const newScore = parseFloat(scoreInput.value);

        if (isNaN(newScore) || newScore < 0 || newScore > 1) {
            alert('Please enter a valid score between 0 and 1');
            return;
        }

        try {
            const payload = {
                text: example.text,
                new_sentiment: newSentiment,
                new_score: newScore,
                new_rule: 'manual_overwrite'
            };

            await update_time_compare_sentiment(payload);

            dialog.remove();

            // Clear cache to force fresh data fetch with updated sentiment
            chartCache.clear('sentimentCompareChart');
            console.log('[Edit Sentiment] Cleared cache for sentimentCompareChart');

            // Get current parameters and reload chart automatically
            const brandSelector = document.getElementById('brandSelector');
            const brandName = brandSelector ? brandSelector.value : null;
            const granularity = document.getElementById('sentimentGranularitySelector')?.value;
            const time1 = document.getElementById('sentimentTime1Input')?.value.trim();
            const time2 = document.getElementById('sentimentTime2Input')?.value.trim();

            if (brandName && granularity && time1 && time2) {
                await loadSentimentComparison(brandName, granularity, time1, time2);
                alert('Sentiment updated successfully!');
            } else {
                alert('Sentiment updated successfully! Click "Analyze" to see the updated chart.');
            }
        } catch (err) {
            console.error('Error updating sentiment:', err);
            alert('Failed to update sentiment. Please try again.');
        }
    });

    // Close dialog when clicking outside
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    });
}

function displaySentimentComparisonExamples(compareData, time1, time2) {
    const container = document.getElementById('sentimentComparisonExamplesList');
    if (!container) return;

    container.innerHTML = '';

    const data1 = compareData[time1] || {};
    const data2 = compareData[time2] || {};
    const examples1 = data1.examples || [];
    const examples2 = data2.examples || [];

    // Get sentiment color based on sentiment type
    const getSentimentColor = (sentiment) => {
        switch(sentiment.toLowerCase()) {
            case 'positive': return 'bg-green-500/20 border-green-500';
            case 'negative': return 'bg-red-500/20 border-red-500';
            case 'neutral': return 'bg-blue-500/20 border-blue-500';
            default: return 'bg-gray-500/20 border-gray-500';
        }
    };

    const getSentimentTextColor = (sentiment) => {
        switch(sentiment.toLowerCase()) {
            case 'positive': return 'text-green-400';
            case 'negative': return 'text-red-400';
            case 'neutral': return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    const createExampleCard = (example) => {
        const card = document.createElement('div');
        card.className = `p-3 rounded-lg border-l-4 ${getSentimentColor(example.sentiment)}`;

        card.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <span class="font-semibold ${getSentimentTextColor(example.sentiment)} capitalize">
                    ${example.sentiment}
                </span>
                <div class="flex items-center gap-2">
                    <span class="text-gray-400 text-sm">
                        Score: ${example.sentiment_score.toFixed(3)}
                    </span>
                    <button class="edit-sentiment-btn text-blue-400 hover:text-blue-300 text-sm font-bold" title="Edit sentiment">
                        ✎
                    </button>
                </div>
            </div>
            <p class="text-gray-300 text-sm leading-relaxed mb-2">
                ${example.text}
            </p>
            ${example.rule_applied ? `
                <div class="text-xs text-gray-500 italic">
                    Rule: ${example.rule_applied}
                </div>
            ` : ''}
        `;

        // Add click handler for edit button
        const editBtn = card.querySelector('.edit-sentiment-btn');
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Edit button clicked', example);
            try {
                showSentimentEditDialog(example);
            } catch (error) {
                console.error('Error showing dialog:', error);
            }
        });

        return card;
    };

    // Create column for time period 1
    const col1 = document.createElement('div');
    col1.className = 'space-y-3';
    col1.innerHTML = `<h5 class="text-white font-medium mb-3">${time1}</h5>`;

    if (examples1.length === 0) {
        col1.innerHTML += '<p class="text-gray-400 text-sm">No examples available</p>';
    } else {
        const examplesContainer = document.createElement('div');
        examplesContainer.className = 'space-y-3 max-h-96 overflow-y-auto';
        examples1.forEach(example => {
            examplesContainer.appendChild(createExampleCard(example));
        });
        col1.appendChild(examplesContainer);
    }

    // Create column for time period 2
    const col2 = document.createElement('div');
    col2.className = 'space-y-3';
    col2.innerHTML = `<h5 class="text-white font-medium mb-3">${time2}</h5>`;

    if (examples2.length === 0) {
        col2.innerHTML += '<p class="text-gray-400 text-sm">No examples available</p>';
    } else {
        const examplesContainer = document.createElement('div');
        examplesContainer.className = 'space-y-3 max-h-96 overflow-y-auto';
        examples2.forEach(example => {
            examplesContainer.appendChild(createExampleCard(example));
        });
        col2.appendChild(examplesContainer);
    }

    container.appendChild(col1);
    container.appendChild(col2);
}

// ---- BRAND KEYWORD WORD FILTERING ----
export function initBrandKeywordFilter() {
    const filterInput = document.getElementById('brandKeywordFilterInput');
    const hideBtn = document.getElementById('hideBrandKeywordBtn');

    if (!filterInput || !hideBtn) {
        console.error('Brand keyword filter elements not found');
        return;
    }

    // Handle Enter key to hide word
    filterInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            hideBtn.click();
        }
    });

    // Handle Hide button click
    hideBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const input = filterInput.value.trim();
        if (!input) return;

        const brandSelector = document.getElementById('brandSelector');
        const brandName = brandSelector ? brandSelector.value : null;

        if (!brandName) {
            alert('Please select a brand first');
            return;
        }

        // Split by comma or space and add each word
        const words = input.split(/[\s,]+/).filter(w => w.length > 0);

        try {
            // Remove each keyword from the backend
            for (const word of words) {
                await remove_brand_words({ brand_name: brandName, keyword: word });
                console.log(`Removed keyword: ${word} for brand: ${brandName}`);
                hiddenBrandKeywords.add(word.toLowerCase());
            }

            // Clear input
            filterInput.value = '';

            // Clear cache to force fresh data fetch
            chartCache.clear('keywordCompareChart');
            console.log('[Hide Keyword] Cleared cache for keywordCompareChart');

            // Reload chart with filtered keywords
            reloadBrandKeywordChart();

            // Update hidden words display
            displayBrandHiddenWords();
        } catch (err) {
            console.error('Error removing keywords:', err);
            alert('Failed to remove keywords. Please try again.');
        }
    });

    // Display existing hidden words on load
    displayBrandHiddenWords();
}

function displayBrandHiddenWords() {
    const container = document.getElementById('brandKeywordHiddenWordsList');
    if (!container) return;

    container.innerHTML = '';

    if (hiddenBrandKeywords.size === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.className = 'text-gray-500 text-sm';
        emptyMsg.textContent = 'No hidden words';
        container.appendChild(emptyMsg);
        return;
    }

    hiddenBrandKeywords.forEach(word => {
        const tag = document.createElement('div');
        tag.className = 'flex items-center gap-2 bg-gray-600 text-white px-3 py-1 rounded-full text-sm';
        tag.innerHTML = `
            <span>${word}</span>
            <button type="button" class="hover:text-red-300 font-bold" data-word="${word}">×</button>
        `;

        // Add remove handler
        tag.querySelector('button').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wordToRemove = e.target.getAttribute('data-word');
            removeBrandHiddenWord(wordToRemove);
        });

        container.appendChild(tag);
    });
}

async function removeBrandHiddenWord(word) {
    const brandSelector = document.getElementById('brandSelector');
    const brandName = brandSelector ? brandSelector.value : null;

    if (!brandName) {
        alert('Please select a brand first');
        return;
    }

    try {
        // Note: Removing from hidden list doesn't add it back to the brand
        // The keyword was already removed from the backend when it was hidden
        // This just removes it from the local hidden list
        hiddenBrandKeywords.delete(word.toLowerCase());

        // Reload chart with filtered keywords
        reloadBrandKeywordChart();

        // Update display
        displayBrandHiddenWords();
    } catch (err) {
        console.error('Error removing hidden word:', err);
    }
}

function reloadBrandKeywordChart() {
    const brandSelector = document.getElementById('brandSelector');
    const granularity = document.getElementById('keywordGranularitySelector')?.value;
    const time1 = document.getElementById('keywordTime1Input')?.value.trim();
    const time2 = document.getElementById('keywordTime2Input')?.value.trim();

    if (brandSelector && granularity && time1 && time2) {
        const brandName = brandSelector.value;
        loadKeywordComparison(brandName, granularity, time1, time2);
    }
}

// ---- BRAND PERCEPTION WORD FILTERING ----
export function initBrandPerceptionFilter() {
    const filterInput = document.getElementById('brandPerceptionWordFilterInput');
    const hideBtn = document.getElementById('hideBrandPerceptionWordBtn');

    if (!filterInput || !hideBtn) {
        console.error('Brand perception filter elements not found');
        return;
    }

    // Handle Enter key to hide word
    filterInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            hideBtn.click();
        }
    });

    // Handle Hide button click
    hideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const input = filterInput.value.trim();
        if (!input) return;

        // Split by comma or space and add each word
        const words = input.split(/[\s,]+/).filter(w => w.length > 0);
        words.forEach(word => {
            hiddenBrandPerceptionWords.add(word.toLowerCase());
        });

        // Clear input
        filterInput.value = '';

        // Reload chart with filtered words
        reloadBrandPerceptionChart();

        // Update hidden words display
        displayBrandPerceptionHiddenWords();
    });

    // Display existing hidden words on load
    displayBrandPerceptionHiddenWords();
}

function displayBrandPerceptionHiddenWords() {
    const container = document.getElementById('brandPerceptionHiddenWordsList');
    if (!container) return;

    container.innerHTML = '';

    if (hiddenBrandPerceptionWords.size === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.className = 'text-gray-500 text-sm';
        emptyMsg.textContent = 'No hidden words';
        container.appendChild(emptyMsg);
        return;
    }

    hiddenBrandPerceptionWords.forEach(word => {
        const tag = document.createElement('div');
        tag.className = 'flex items-center gap-2 bg-gray-600 text-white px-3 py-1 rounded-full text-sm';
        tag.innerHTML = `
            <span>${word}</span>
            <button type="button" class="hover:text-red-300 font-bold" data-word="${word}">×</button>
        `;

        // Add remove handler
        tag.querySelector('button').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wordToRemove = e.target.getAttribute('data-word');
            removeBrandPerceptionHiddenWord(wordToRemove);
        });

        container.appendChild(tag);
    });
}

function removeBrandPerceptionHiddenWord(word) {
    hiddenBrandPerceptionWords.delete(word.toLowerCase());

    // Reload chart with filtered words
    reloadBrandPerceptionChart();

    // Update display
    displayBrandPerceptionHiddenWords();
}

function reloadBrandPerceptionChart() {
    const brandSelector = document.getElementById('brandSelector');
    const granularity = document.getElementById('brandPerceptionGranularitySelector')?.value;
    const time1 = document.getElementById('brandPerceptionTime1Input')?.value.trim();
    const time2 = document.getElementById('brandPerceptionTime2Input')?.value.trim();

    if (brandSelector && granularity && time1 && time2) {
        const brandName = brandSelector.value;
        loadBrandPerceptionComparison(brandName, granularity, time1, time2);
    }
}

// Clear cache when global filters change (only register once)
if (!window.brandPageCacheHandlersAttached) {
    let yearChangeTimeout;
    let groupChatChangeTimeout;
    let dataUploadTimeout;

    window.addEventListener('yearChanged', () => {
        clearTimeout(yearChangeTimeout);
        yearChangeTimeout = setTimeout(() => {
            console.log('[Brand] Year filter changed - clearing cache');
            chartCache.clear();
        }, 100);
    });

    window.addEventListener('groupChatChanged', () => {
        clearTimeout(groupChatChangeTimeout);
        groupChatChangeTimeout = setTimeout(() => {
            console.log('[Brand] Group chat filter changed - clearing cache');
            chartCache.clear();
        }, 100);
    });

    window.addEventListener('dataUploaded', () => {
        clearTimeout(dataUploadTimeout);
        dataUploadTimeout = setTimeout(() => {
            console.log('[Brand] New data uploaded - clearing cache');
            chartCache.clear();
        }, 100);
    });

    window.brandPageCacheHandlersAttached = true;
}
