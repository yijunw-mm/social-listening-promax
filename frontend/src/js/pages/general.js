import {
    keywordFrequency,
    new_keywords
} from '../api/api.js';

// Register the datalabels plugin globally - check if available first
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
}

let chartInstances = {};

// Helper function to get filter parameters (years and group_id)
function getFilterParams() {
    const params = {};
    const selectedYears = window.getSelectedYears ? window.getSelectedYears() : [];
    const groupChat = window.getSelectedGroupChats ? window.getSelectedGroupChats() : [];

    // If years are selected, use group_year parameter (can be single or multiple)
    if (selectedYears && selectedYears.length > 0) {
        // If only one year, send as integer, otherwise as array
        params.group_year = selectedYears.length === 1 ? selectedYears[0] : selectedYears;
    }

    // If group chats are selected, add group_id parameter
    if (groupChat && Array.isArray(groupChat) && groupChat.length > 0) {
        params.group_id = groupChat;
    }

    return params;
}

// Export loading functions for each chart
export async function loadKeywordFrequencyData() {
    console.log('Loading keyword frequency data');
    await loadKeywordFrequency();
}

export async function loadNewKeywordsData() {
    console.log('Loading new keywords prediction data');
    await loadNewKeywords();
}

// Load all general charts
export async function loadAllGeneralData() {
    // Load sequentially to avoid race conditions
    console.log('Loading all general data sequentially...');
    await loadKeywordFrequency();
    await loadNewKeywords();
    console.log('All general data loaded');
}

async function loadKeywordFrequency() {
    const canvasId = 'keywordFrequencyChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    console.log('=== loadKeywordFrequency START ===');
    if (loadingOverlay) {
        console.log('Loading overlay found, activating...');
        loadingOverlay.classList.add('active');
    } else {
        console.log('WARNING: Loading overlay not found!');
    }

    try {
        const params = getFilterParams();

        console.log('Fetching keyword frequency with params:', params);
        const data = await keywordFrequency(params);

        console.log('Raw API data:', data);
        console.log('Data type:', typeof data);
        console.log('Is array?', Array.isArray(data));

        // (ensure it's always an array)
        const keywordsData = Array.isArray(data)
            ? data
            : Array.isArray(data.keywords) ? data.keywords : [];

        console.log('Processed keywordsData:', keywordsData);
        console.log('keywordsData length:', keywordsData.length);

        if (keywordsData.length === 0) {
            console.log('No data, showing message');
            showNoDataMessage(canvasId, 'No keyword data available');
            return;
        }

        console.log('Rendering chart with', keywordsData.length, 'keywords');
        renderKeywordFrequencyChart(canvasId, keywordsData);
        console.log('Chart rendered successfully');

    } catch (err) {
        console.error('Error loading keyword frequency:', err);
        console.error('Error stack:', err.stack);
        showNoDataMessage(canvasId, `Error: ${err.message}`);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        console.log('=== loadKeywordFrequency END ===');
    }
}


async function loadNewKeywords() {
    const canvasId = 'newKeywordsChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams();

        const data = await new_keywords(params);

        console.log('New keywords data:', data);

        if (data.error || !Array.isArray(data) || data.length === 0) {
            showNoDataMessage(canvasId, data.error || 'No data available');
            return;
        }

        renderNewKeywordsChart(canvasId, data);
    } catch (err) {
        console.error('Error loading new keywords:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// Chart Rendering Functions
function renderKeywordFrequencyChart(canvasId, data) {
    console.log('renderKeywordFrequencyChart called with', data.length, 'items');
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('Canvas not found:', canvasId);
        return;
    }

    console.log('Canvas found, getting context...');
    const ctx = canvas.getContext('2d');

    // Sort data in descending order by count
    const sortedData = [...data].sort((a, b) => b.count - a.count);

    // Extract keywords and counts
    const keywords = sortedData.map(item => item.keyword);
    const counts = sortedData.map(item => item.count);

    console.log('Keywords:', keywords);
    console.log('Counts:', counts);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: keywords,
            datasets: [{
                label: 'Keyword Frequency',
                data: counts,
                backgroundColor: '#48b7e3ff',
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

function renderNewKeywordsChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Sort data in descending order by score
    const sortedData = [...data].sort((a, b) => {
        const scoreA = a.score || a.prediction || a.count || 1;
        const scoreB = b.score || b.prediction || b.count || 1;
        return scoreB - scoreA;
    });

    // Extract keywords and predictions/scores
    const keywords = sortedData.map(item => item.keyword || item.word);
    const scores = sortedData.map(item => item.score || item.prediction || item.count || 1);

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: keywords,
            datasets: [{
                label: 'Predicted New Keywords',
                data: scores,
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
                            return label + ': ' + value.toFixed(2);
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
                        return value > 0 ? value.toFixed(2) : '';
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
                        text: 'Prediction Score',
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
