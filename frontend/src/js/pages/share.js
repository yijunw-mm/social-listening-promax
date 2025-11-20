import {
    get_share_of_voice,
    get_comparison_keyword_frequency
} from '../api/api.js';

// Register the datalabels plugin globally - check if available first
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let chartInstances = {};

// Category options mapping
const categoryOptions = [
    'diaper',
    'formula milk',
    'weaning',
    'hospital'
];

// Export loading functions for each chart
export async function loadShareOfVoiceData(category) {
    console.log('Loading share of voice data:', { category });
    await loadShareOfVoice(category);
}

export async function loadComparisonKeywordFrequencyData(category) {
    console.log('Loading comparison keyword frequency data:', { category });
    await loadComparisonKeywordFrequency(category);
}

async function loadShareOfVoice(category) {
    const canvasId = 'shareOfVoiceChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        // Get selected group chat
        const groupChat = window.getSelectedGroupChats ? window.getSelectedGroupChats() : [];
        const params = {
            category_name: category
        };
        if (groupChat && Array.isArray(groupChat) && groupChat.length > 0) {
            params.group_id = groupChat; // Pass as array
        }

        const data = await get_share_of_voice(params);

        console.log('Share of voice data:', data);

        if (data.error || !Array.isArray(data) || data.length === 0) {
            showNoDataMessage(canvasId, data.error || 'No data available');
            return;
        }

        renderShareOfVoiceChart(canvasId, data, category);
    } catch (err) {
        console.error('Error loading share of voice:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

async function loadComparisonKeywordFrequency(category) {
    const canvasId = 'comparisonKeywordChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        // Get selected group chat
        const groupChat = window.getSelectedGroupChats ? window.getSelectedGroupChats() : [];
        const params = {
            category_name: category
        };
        if (groupChat && Array.isArray(groupChat) && groupChat.length > 0) {
            params.group_id = groupChat; // Pass as array
        }

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

// Chart Rendering Functions
function renderShareOfVoiceChart(canvasId, data, category) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Extract brand names and percentages
    const brands = data.map(item => item.brand);
    const percentages = data.map(item => item.percentage || item.percent);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: brands,
            datasets: [{
                label: 'Share of Voice (%)',
                data: percentages,
                backgroundColor: '#4ab4deff',
                borderColor: '#3d9dc7',
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
                        size: 11
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
                    grid: { color: '#3d4456' },
                    beginAtZero: true
                }
            }
        }
    });
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

    // Extract all unique keywords across all brands
    const keywordSet = new Set();
    Object.entries(data).forEach(([brand, brandData]) => {
    if (Array.isArray(brandData)) {
            brandData.forEach(item => {
                if (item.keyword) keywordSet.add(item.keyword);
            });
        }
    });


    const keywords = Array.from(keywordSet);
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
