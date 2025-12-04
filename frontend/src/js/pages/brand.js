import {
    get_time_compare_frequency,
    get_time_compare_sentiment,
    update_time_compare_sentiment,
    get_time_compare_share_of_voice,
    add_brand_keyword,
    remove_brand_keyword
} from '../api/api.js';

// Register the datalabels plugin globally - check if available first
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let chartInstances = {};

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
const brandCategoryMap = {
    'mamypoko': 'diaper',
    'huggies': 'diaper',
    'pampers': 'diaper',
    'drypers': 'diaper',
    'merries': 'diaper',
    'offspring': 'diaper',
    'rascal & friends': 'diaper',
    'homie': 'diaper',
    'hey tiger': 'diaper',
    'nino nana': 'diaper',
    'applecrumby': 'diaper',
    'nan': 'formula milk',
    'lactogen': 'formula milk',
    'friso': 'formula milk',
    'enfamil': 'formula milk',
    'aptamil': 'formula milk',
    's26': 'formula milk',
    'dumex dugro': 'formula milk',
    'karihome': 'formula milk',
    'bellamy organic': 'formula milk',
    'applecrumbly': 'weaning',
    'little blossom': 'weaning',
    'rafferty garden': 'weaning',
    'happy baby organics': 'weaning',
    'heinz baby': 'weaning',
    'only organic': 'weaning',
    'holle': 'weaning',
    'ella kitchen': 'weaning',
    'gerber': 'weaning',
    'mount alvernia': 'hospital',
    'thomson medical centre': 'hospital',
    'mount elizabeth': 'hospital',
    'gleneagles': 'hospital',
    'raffles hospital': 'hospital',
    'national university hospital': 'hospital',
    'kkh': 'hospital',
    'parkway east hospital': 'hospital',
    'singapore general hospital': 'hospital',
    'sengkang general hospital': 'hospital',
    'changi general hospital': 'hospital',
    'johnson': 'diaper'
};

// Export individual loading functions for each chart
export async function loadKeywordComparisonData(brandName, granularity, time1, time2) {
    console.log('Loading keyword comparison data:', { brandName, granularity, time1, time2 });
    await loadKeywordComparison(brandName, granularity, time1, time2);
}

export async function loadSentimentComparisonData(brandName, granularity, time1, time2) {
    console.log('Loading sentiment comparison data:', { brandName, granularity, time1, time2 });
    await loadSentimentComparison(brandName, granularity, time1, time2);
}

export async function loadShareOfVoiceComparisonData(category, granularity, time1, time2) {
    console.log('Loading share of voice comparison data:', { category, granularity, time1, time2 });
    await loadShareOfVoiceComparison(category, granularity, time1, time2);
}

async function loadKeywordComparison(brandName, granularity, time1, time2) {
    const canvasId = 'keywordCompareChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({
            brand_name: brandName,
            granularity: granularity,
            time1: time1,
            time2: time2
        });

        const data = await get_time_compare_frequency(params);

        console.log('Keyword comparison data:', data);
        console.log('Time1 keywords:', data.compare?.[time1]);
        console.log('Time2 keywords:', data.compare?.[time2]);

        if (data.error) {
            showNoDataMessage(canvasId, data.error);
            return;
        }

        renderKeywordComparisonChart(canvasId, data, time1, time2);
    } catch (err) {
        console.error('Error loading keyword comparison:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

async function loadSentimentComparison(brandName, granularity, time1, time2) {
    const canvasId = 'sentimentCompareChart';
    const loadingOverlay = document.getElementById('loadingOverlay-sentimentCompareChart');

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({
            brand_name: brandName,
            granularity: granularity,
            time1: time1,
            time2: time2
        });
 
        const data = await get_time_compare_sentiment(params);

        console.log('Sentiment comparison data:', data);

        if (data.error) {
            showNoDataMessage(canvasId, data.error);
            displaySentimentComparisonExamples({}, time1, time2);
            return;
        }

        renderSentimentComparisonChart(canvasId, data, time1, time2);
        displaySentimentComparisonExamples(data.compare || {}, time1, time2);
    } catch (err) {
        console.error('Error loading sentiment comparison:', err);
        showNoDataMessage(canvasId, 'Error loading data');
        displaySentimentComparisonExamples({}, time1, time2);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

async function loadShareOfVoiceComparison(category, granularity, time1, time2) {
    const canvasId = 'shareOfVoiceCompareChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({
            category_name: category,
            granularity: granularity,
            time1: time1,
            time2: time2
        });

        const data = await get_time_compare_share_of_voice(params);

        console.log('Share of voice comparison data:', data);

        if (data.error) {
            showNoDataMessage(canvasId, data.error);
            return;
        }

        renderShareOfVoiceComparisonChart(canvasId, data, time1, time2);
    } catch (err) {
        console.error('Error loading share of voice comparison:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// Chart Rendering Functions
function renderKeywordComparisonChart(canvasId, data, time1, time2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const compare = data.compare;

    // Extract keyword data from both time periods
    const time1Data = compare[time1] || [];
    const time2Data = compare[time2] || [];

    // Handle error cases
    if (time1Data.error || time2Data.error) {
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

    // Sort keywords by total count (sum of both periods) in descending order
    const keywords = Array.from(allKeywords).sort((a, b) => {
        const totalA = (time1Map[a] || 0) + (time2Map[a] || 0);
        const totalB = (time1Map[b] || 0) + (time2Map[b] || 0);
        return totalB - totalA;
    });

    // Prepare datasets
    const dataset1 = keywords.map(kw => time1Map[kw] || 0);
    const dataset2 = keywords.map(kw => time2Map[kw] || 0);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

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

function renderShareOfVoiceComparisonChart(canvasId, data, time1, time2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const compare = data.compare;

    const time1Data = compare[time1]?.share_of_voice || [];
    const time2Data = compare[time2]?.share_of_voice || [];

    // Handle error cases
    if (compare[time1]?.error || compare[time2]?.error) {
        showNoDataMessage(canvasId, compare[time1]?.error || compare[time2]?.error);
        return;
    }

    // Display total mentions
    const time1Total = compare[time1]?.total_mentions || 0;
    const time2Total = compare[time2]?.total_mentions || 0;
    const totalMentionsDiv = document.getElementById('shareOfVoiceTotalMentions');
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

    // Combine all brands from both periods
    const allBrands = new Set();
    time1Data.forEach(item => allBrands.add(item.brand));
    time2Data.forEach(item => allBrands.add(item.brand));

    // Create percent maps
    const time1Map = Object.fromEntries(time1Data.map(item => [item.brand, item.percent]));
    const time2Map = Object.fromEntries(time2Data.map(item => [item.brand, item.percent]));

    // Sort brands by total percent (sum of both periods) in descending order
    const brands = Array.from(allBrands).sort((a, b) => {
        const totalA = (time1Map[a] || 0) + (time2Map[a] || 0);
        const totalB = (time1Map[b] || 0) + (time2Map[b] || 0);
        return totalB - totalA;
    });

    // Prepare datasets
    const dataset1 = brands.map(b => time1Map[b] || 0);
    const dataset2 = brands.map(b => time2Map[b] || 0);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: brands,
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
                        return value > 0 ? value.toFixed(1) + '%' : '';
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Brands',
                        color: '#9ca3af',
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    },
                    grid: { color: '#3d4456' }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Share of Voice (%)',
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
    addBtn.addEventListener('click', async () => {
        const keyword = keywordInput.value.trim();
        if (!keyword) return;

        const brandSelector = document.getElementById('brandSelector');
        const brandName = brandSelector ? brandSelector.value : 'mamypoko';

        try {
            await add_brand_keyword({ brand_name: brandName, keyword: keyword });
            console.log(`Added keyword: ${keyword} for brand: ${brandName}`);

            // Track in localStorage
            addTimeCustomKeyword(brandName, keyword);

            // Clear input
            keywordInput.value = '';

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
            tag.className = 'flex items-center gap-2 bg-purple-500 text-white px-3 py-1 rounded-full text-sm';
            tag.innerHTML = `
                <span>${keyword}</span>
                <button class="hover:text-red-300 font-bold" data-keyword="${keyword}">×</button>
            `;

            // Add remove handler
            tag.querySelector('button').addEventListener('click', async (e) => {
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
    try {
        await remove_brand_keyword({ brand_name: brandName, keyword: keyword });
        console.log(`Removed keyword: ${keyword} for brand: ${brandName}`);

        // Remove from localStorage
        removeTimeCustomKeyword(brandName, keyword);

        // Reload chart if there's data to compare
        const granularity = document.getElementById('keywordGranularitySelector')?.value;
        const time1 = document.getElementById('keywordTime1Input')?.value.trim();
        const time2 = document.getElementById('keywordTime2Input')?.value.trim();

        if (granularity && time1 && time2) {
            await loadKeywordComparison(brandName, granularity, time1, time2);
        }

        // Update display
        displayTimeCustomKeywords(brandName);
    } catch (err) {
        console.error('Error removing keyword:', err);
        alert('Failed to remove keyword. Please try again.');
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

            alert('Sentiment updated successfully! Click "Analyze" to see the updated chart.');
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
