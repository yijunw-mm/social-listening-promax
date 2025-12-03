import {
    get_comparison_keyword_frequency,
    get_comparison_consumer_perception
} from '../api/api.js';

// Register the datalabels plugin globally - check if available first
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let hiddenCategoryPerceptionWords = new Set();

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

// Category options mapping
const categoryOptions = [
    'diaper',
    'formula milk',
    'weaning',
    'hospital'
];

// Export loading functions for each chart
export async function loadComparisonKeywordFrequencyData(category) {
    console.log('Loading comparison keyword frequency data:', { category });
    await loadComparisonKeywordFrequency(category);
}



async function loadComparisonKeywordFrequency(category) {
    const canvasId = 'comparisonKeywordChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({ category_name: category });

        const data = await get_comparison_keyword_frequency(params);

        console.log('Comparison keyword frequency data:', data);

        if (data.error) {
            showNoDataMessage(canvasId, data.error);
            return;
        }

        // Check if data is empty or invalid
        // If backend returns single-brand format (category + keywords), convert it to multi-brand format
        let normalizedData;
        if (data.keywords && Array.isArray(data.keywords)) {
            normalizedData = { [category]: data.keywords };
        } else {
            normalizedData = data;
        }

        renderComparisonKeywordFrequencyChart(canvasId, normalizedData, category);

    } catch (err) {
        console.error('Error loading comparison keyword frequency:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}


function renderComparisonKeywordFrequencyChart(canvasId, data, category) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Data structure: { brand_name: [{keyword: "...", count: N}, ...], ... }
    // We need to create grouped bar chart with brands as groups and keywords as bars

    if (!data || typeof data !== 'object') {
        showNoDataMessage(canvasId, 'Invalid data format');
        return;
    }

    // Extract all unique keywords across all brands and calculate totals
    const keywordSet = new Set();
    const keywordTotals = {};

    Object.entries(data).forEach(([brand, brandData]) => {
        if (Array.isArray(brandData)) {
            brandData.forEach(item => {
                if (item.keyword) {
                    keywordSet.add(item.keyword);
                    keywordTotals[item.keyword] = (keywordTotals[item.keyword] || 0) + (item.count || 0);
                }
            });
        }
    });

    // Sort keywords by total count in descending order
    const keywords = Array.from(keywordSet).sort((a, b) => {
        return (keywordTotals[b] || 0) - (keywordTotals[a] || 0);
    });

    const brands = Object.keys(data);

    if (keywords.length === 0 || brands.length === 0) {
        showNoDataMessage(canvasId, 'No keyword data available');
        return;
    }

    // Create color palette for brands
    const brandColors = [
        '#4ab4deff',
        '#60a5fa',
        '#818cf8',
        '#a78bfa',
        '#c084fc',
        '#e879f9',
        '#f472b6',
        '#fb7185',
        '#fca5a5',
        '#fdba74'
    ];

    // Build datasets - one dataset per brand
    const datasets = brands.map((brand, index) => {
        const brandData = data[brand] || [];
        const brandKeywordMap = Object.fromEntries(
            brandData.map(item => [item.keyword, item.count])
        );

        return {
            label: brand,
            data: keywords.map(kw => brandKeywordMap[kw] || 0),
            backgroundColor: brandColors[index % brandColors.length],
            borderColor: brandColors[index % brandColors.length],
            borderWidth: 1
        };
    });

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: keywords,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: {
                    top: 40
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y || 0;
                            return label + ': ' + value;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#9ca3af',
                    font: {
                        weight: 'bold',
                        size: 9
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
                        minRotation: 45,
                        font: { size: 10 }
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
                    grid: { color: '#3d4456' },
                    beginAtZero: true
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

// Export loading function for consumer perception
export async function loadConsumerPerceptionData(category) {
    console.log('Loading consumer perception data:', { category });
    await loadConsumerPerception(category);
}

async function loadConsumerPerception(category) {
    const canvasId = 'consumerPerceptionChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({ category_name: category });

        const data = await get_comparison_consumer_perception(params);

        console.log('Consumer perception data:', data);

        if (data.error) {
            showNoDataMessage(canvasId, data.error);
            return;
        }

        // Check if data has associated_words (backend returns array directly from api.js)
        if (!data || !Array.isArray(data) || data.length === 0) {
            showNoDataMessage(canvasId, 'No consumer perception data available for this category');
            return;
        }
        const topData = [...data]
        .sort((a, b) => b.count - a.count).slice(0, 20);

        renderConsumerPerceptionChart(canvasId,topData);
    } catch (err) {
        console.error('Error loading consumer perception:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// Chart Rendering Function
function renderConsumerPerceptionChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Filter out hidden words
    const filteredData = data.filter(item => {
        const word = (item.word || '').toLowerCase();
        return !hiddenCategoryPerceptionWords.has(word);
    });

    // Extract words and counts
    const words = filteredData.map(item => item.word);
    const counts = filteredData.map(item => item.count);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: words,
            datasets: [{
                label: 'Word Frequency',
                data: counts,
                backgroundColor: '#48b7e3ff',
                borderColor: '#3b82f6',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            layout: {
                padding: {
                    top: 40
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y || 0;
                            return label + ': ' + value;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#9ca3af',
                    font: {
                        weight: 'bold',
                        size: 11
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
                        minRotation: 45,
                        font: { size: 10 }
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
                    grid: { color: '#3d4456' },
                    beginAtZero: true
                }
            }
        }
    });
}

// ---- CONSUMER PERCEPTION WORD FILTERING ----
export function initCategoryPerceptionWordFilter() {
    const filterInput = document.getElementById('perceptionCategoryWordFilterInput');
    const removeBtn = document.getElementById('removePerceptionWordBtn');

    if (!filterInput) return;

    // Handle Enter key to hide word
    filterInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            hideWord();
        }
    });

    // Handle remove button click
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            hideWord();
        });
    }

    function hideWord() {
        const input = filterInput.value.trim().toLowerCase();
        if (!input) return;

        // Split by comma or space and filter empty strings
        const words = input.split(/[,\s]+/).filter(w => w.length > 0);

        if (words.length === 0) return;

        // Add all words to hidden words set
        words.forEach(word => hiddenCategoryPerceptionWords.add(word));

        // Clear input
        filterInput.value = '';

        // Re-render chart with filtered data
        const categorySelector = document.getElementById('categorySelector');
        const category = categorySelector ? categorySelector.value : 'diaper';
        loadConsumerPerception(category);

        // Update hidden words display
        displayCategoryHiddenWords();
    }

    // Display existing hidden words on load
    displayCategoryHiddenWords();
}

function displayCategoryHiddenWords() {
    const container = document.getElementById('perceptionCategoryHiddenWordsList');
    if (!container) return;

    container.innerHTML = '';

    if (hiddenCategoryPerceptionWords.size === 0) {
        container.innerHTML = '<span class="text-gray-500 text-sm">No hidden words</span>';
        return;
    }

    hiddenCategoryPerceptionWords.forEach(word => {
        const tag = document.createElement('div');
        tag.className = 'flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm';
        tag.innerHTML = `
            <span>${word}</span>
            <button class="hover:text-gray-300 font-bold" data-word="${word}">×</button>
        `;

        // Add restore handler
        tag.querySelector('button').addEventListener('click', (e) => {
            const wordToRestore = e.target.getAttribute('data-word');
            restoreCategoryWord(wordToRestore);
        });

        container.appendChild(tag);
    });
}

function restoreCategoryWord(word) {
    // Remove from hidden words set
    hiddenCategoryPerceptionWords.delete(word.toLowerCase());

    // Re-render chart
    const categorySelector = document.getElementById('categorySelector');
    const category = categorySelector ? categorySelector.value : 'diaper';
    loadConsumerPerception(category);

    // Update display
    displayCategoryHiddenWords();
}
