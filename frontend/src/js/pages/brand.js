import {
    get_brand_keyword,
    get_sentiment_analysis,
    get_consumer_perception
} from '../api/api.js';

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

let chartInstances = {};
let chartDataCache = {}; // Store previous data for comparison

export async function loadBrandData(brandName = null) {
    // Get brand from parameter or dropdown selector
    if (!brandName) {
        const selector = document.getElementById("brandSelector");
        brandName = selector ? selector.value : "mamypoko"; // Default to first brand if selector not found
    }

    // Load charts sequentially - each will show/hide its own loading indicator independently
    await loadChart("keywordChart", brandName, get_brand_keyword, buildKeywordConfig);
    await loadChart("sentimentChart", brandName, get_sentiment_analysis, buildSentimentConfig);
    await loadChart("perceptionChart", brandName, get_consumer_perception, buildPerceptionConfig, { top_k: 20 });
}

// Force reload a specific chart (bypasses cache)
export async function reloadChart(chartId, brandName = null) {
    delete chartDataCache[chartId];

    // Get brand from parameter or dropdown selector
    if (!brandName) {
        const selector = document.getElementById("brandSelector");
        brandName = selector ? selector.value : "mamypoko";
    }

    const chartMap = {
        keywordChart: { apiFunc: get_brand_keyword, configBuilder: buildKeywordConfig, params: {} },
        sentimentChart: { apiFunc: get_sentiment_analysis, configBuilder: buildSentimentConfig, params: {} },
        perceptionChart: { apiFunc: get_consumer_perception, configBuilder: buildPerceptionConfig, params: { top_k: 20 } }
    };

    const chart = chartMap[chartId];
    if (chart) {
        await loadChart(chartId, brandName, chart.apiFunc, chart.configBuilder, chart.params);
    }
}

async function loadChart(canvasId, brandName, apiFunc, configBuilder, extraParams = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return console.error(`Canvas #${canvasId} not found`);

    // Get the loading overlay for this specific chart
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    // Show loading overlay
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }

    // Wait for real size only if chart doesn't exist yet
    if (!chartInstances[canvasId]) {
        await waitForCanvasSize(canvas);
    }

    try {
        const data = await apiFunc({ brand_name: brandName, ...extraParams });
        console.log(`Data received for ${canvasId}:`, data); // Debug log

        // Only render if data has changed or chart doesn't exist
        if (hasDataChanged(canvasId, data)) {
            renderChart(canvasId, data, configBuilder);
            chartDataCache[canvasId] = data;
        } else {
            console.log(`Skipping ${canvasId} - data unchanged`);
        }
    } catch (err) {
        console.error(`Error loading ${canvasId}:`, err);
        showNoDataMessage(canvas.getContext("2d"), canvas, `Error loading ${canvasId}`);
    } finally {
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }
}

// Chart Rendering Core
function renderChart(canvasId, data, configBuilder) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext("2d");

    if (!ctx) return console.error(`No context for ${canvasId}`);

    const validData = isValidData(data);
    console.log(`isValidData for ${canvasId}:`, validData, 'Data:', data); // Debug log

    if (!validData) {
        console.warn(`No valid data for ${canvasId}`, data);
        return showNoDataMessage(ctx, canvas, "No data available");
    }

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    try {
        chartInstances[canvasId] = new Chart(ctx, configBuilder(data));
    } catch (err) {
        console.error(`Error creating chart for ${canvasId}:`, err);
        showNoDataMessage(ctx, canvas, "Error creating chart");
    }
}

// ---- CONFIG BUILDERS ----
function buildKeywordConfig(data) {
    return {
        type: "bar",
        data: {
            labels: data.map(d => d.keyword),
            datasets: [{
                label: "Keyword Frequency",
                data: data.map(d => d.count),
                backgroundColor: "#4ab4deff"
            }]
        },
        options: {
            ...baseOptions,
            plugins: {
                ...baseOptions.plugins,
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#9ca3af',
                    font: {
                        weight: 'bold',
                        size: 11
                    },
                    formatter: function(value) {
                        return value;
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Keywords",
                        color: "#9ca3af",
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { color: "#9ca3af" },
                    grid: { color: "#3d4456" }
                },
                y: {
                    title: {
                        display: true,
                        text: "Count",
                        color: "#9ca3af",
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { color: "#9ca3af" },
                    grid: { color: "#3d4456" }
                }
            }
        }
    };
}

function buildSentimentConfig(data) {
    const percent = data.sentiment_percent.reduce((acc, item) => {
        acc[item.sentiment] = item.value;
        return acc;
    }, {});

    return {
        type: "pie",
        data: {
            labels: ['Positive', 'Neutral', 'Negative'],
            datasets: [{
                data: [percent.positive || 0, percent.neutral || 0, percent.negative || 0],
                backgroundColor: ['#72e49cff', '#15b5faff', '#fe8d8dff']
            }]
        },
        options:{
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.2,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#9ca3af' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return label + ': ' + value.toFixed(1) + '%';
                        }
                    }
                },
                datalabels: {
                    color: '#fff',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: function(value) {
                        return value.toFixed(1) + '%';
                    }
                }
            }
        }


    };
}

function buildPerceptionConfig(data) {
    console.log('buildPerceptionConfig received:', data); // Debug log

    // Handle different possible data structures
    const words = data.associated_words || data.words || data || [];

    if (!Array.isArray(words) || words.length === 0) {
        console.error('Invalid perception data structure:', data);
        return {
            type: "bar",
            data: { labels: [], datasets: [{ label: "Associated Words", data: [], backgroundColor: "#60a5fa" }] },
            options: { ...baseOptions, indexAxis: 'y' }
        };
    }

    const labels = words.map(w => w.word || w.text || w.label || '');
    const values = words.map(w => w.count || w.frequency || w.value || 0);

    console.log('Perception chart labels:', labels);
    console.log('Perception chart values:', values);

    return {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Associated Words",
                data: values,
                backgroundColor: "#60a5fa"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af' }
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
                        return value;
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Words",
                        color: "#9ca3af",
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: { color: '#9ca3af',
                        rotation: 45,
                        autoSkip: false,
                        font: { size: 10 }
                    },
                    grid: { color: '#3d4456' }
                },
                y: {
                    title: {
                        display: true,
                        text: "Count",
                        color: "#9ca3af",
                        font: { size: 14, weight: 'bold' }
                    },
                    ticks: {
                        color: '#9ca3af',
                        autoSkip: false,
                        font: { size: 10 }
                    },
                    grid: { color: '#3d4456' }
                }
            }
        }
    };
}

// ---- SHARED CHART OPTIONS ----
const baseOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
        legend: {
            labels: { color: '#9ca3af' }
        }
    },
    scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: '#3d4456' } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: '#3d4456' } }
    }
};

// ---- HELPERS ----
function hasDataChanged(canvasId, newData) {
    // If chart doesn't exist yet, data has "changed" (needs initial render)
    if (!chartInstances[canvasId] || !chartDataCache[canvasId]) {
        return true;
    }

    // Compare stringified data to detect changes
    const oldDataStr = JSON.stringify(chartDataCache[canvasId]);
    const newDataStr = JSON.stringify(newData);

    return oldDataStr !== newDataStr;
}

function isValidData(data) {
    return Array.isArray(data) ? data.length > 0 :
        data?.sentiment_count?.length > 0 ||
        data?.associated_words?.length > 0;
}

async function waitForCanvasSize(canvas) {
    return new Promise(resolve => {
        function check() {
            if (canvas.clientWidth > 50 && canvas.clientHeight > 50) resolve(true);
            else requestAnimationFrame(check);
        }
        check();
    });
}

function showNoDataMessage(ctx, canvas, message) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}
