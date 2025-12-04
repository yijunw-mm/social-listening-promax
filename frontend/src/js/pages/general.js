import {
    keywordFrequency,
    new_keywords,
    keyword_cooccurrence
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
export async function loadKeywordFrequencyData(granularity, time1, time2) {
    console.log('Loading keyword frequency data:', { granularity, time1, time2 });
    await loadKeywordFrequency(granularity, time1, time2);
}

export async function loadNewKeywordsData(granularity, time1, time2) {
    console.log('Loading new keywords prediction data:', { granularity, time1, time2 });
    await loadNewKeywords(granularity, time1, time2);
}

// Load all general charts
export async function loadAllGeneralData() {
    // No auto-loading - user must click Analyze button
    console.log('loadAllGeneralData called - user should click Analyze button to load charts');
}

async function loadKeywordFrequency(granularity, time1, time2) {
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
        // Parse time inputs to integers
        const time1Int = parseInt(time1);
        const time2Int = parseInt(time2);

        if (isNaN(time1Int) || isNaN(time2Int)) {
            showNoDataMessage(canvasId, 'Invalid time period format');
            return;
        }

        const params = getFilterParams({
            granularity: granularity,
            time1: time1Int,
            time2: time2Int
        });

        console.log('Fetching keyword frequency with params:', params);
        const data = await keywordFrequency(params);

        console.log('Raw API data:', data);

        // Backend returns { granularity: "...", compare: { "time1": [...], "time2": [...] } }
        if (!data || !data.compare) {
            showNoDataMessage(canvasId, 'No keyword data available');
            return;
        }

        // Render comparison chart with both time periods
        renderKeywordFrequencyComparisonChart(canvasId, data, time1, time2);
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


async function loadNewKeywords(granularity, time1, time2) {
    const canvasId = 'newKeywordsChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        // Parse time inputs to integers
        const time1Int = parseInt(time1);
        const time2Int = parseInt(time2);

        if (isNaN(time1Int) || isNaN(time2Int)) {
            showNoDataMessage(canvasId, 'Invalid time period format');
            return;
        }

        const params = getFilterParams({
            granularity: granularity,
            time1: time1Int,
            time2: time2Int
        });

        const data = await new_keywords(params);

        console.log('New keywords data:', data);

        // Backend returns { granularity: "...", compare: { "time1": [...], "time2": [...] } }
        if (!data || !data.compare) {
            showNoDataMessage(canvasId, 'No data available');
            return;
        }

        renderNewKeywordsComparisonChart(canvasId, data, time1, time2);
    } catch (err) {
        console.error('Error loading new keywords:', err);
        showNoDataMessage(canvasId, 'Error loading data');
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

// Chart Rendering Functions
function renderKeywordFrequencyComparisonChart(canvasId, data, time1, time2) {
    console.log('renderKeywordFrequencyComparisonChart called');
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('Canvas not found:', canvasId);
        return;
    }

    const ctx = canvas.getContext('2d');

    // Extract data for both time periods
    const time1Data = data.compare[time1] || [];
    const time2Data = data.compare[time2] || [];

    // Get all unique keywords from both periods
    const keywordSet = new Set();
    const keywordTotals = {};

    time1Data.forEach(item => {
        if (item.keyword) {
            keywordSet.add(item.keyword);
            keywordTotals[item.keyword] = (keywordTotals[item.keyword] || 0) + (item.count || 0);
        }
    });

    time2Data.forEach(item => {
        if (item.keyword) {
            keywordSet.add(item.keyword);
            keywordTotals[item.keyword] = (keywordTotals[item.keyword] || 0) + (item.count || 0);
        }
    });

    // Sort keywords by total count and take top 25
    const keywords = Array.from(keywordSet)
        .sort((a, b) => (keywordTotals[b] || 0) - (keywordTotals[a] || 0))
        .slice(0, 25);

    if (keywords.length === 0) {
        showNoDataMessage(canvasId, 'No keyword data available');
        return;
    }

    // Populate the keyword selector with ALL keywords
    const allKeywords = Array.from(keywordSet)
        .sort((a, b) => (keywordTotals[b] || 0) - (keywordTotals[a] || 0));
    populateKeywordSelector(allKeywords);

    // Create lookup maps
    const time1Map = Object.fromEntries(time1Data.map(item => [item.keyword, item.count]));
    const time2Map = Object.fromEntries(time2Data.map(item => [item.keyword, item.count]));

    // Create datasets
    const datasets = [
        {
            label: `${time1}`,
            data: keywords.map(kw => time1Map[kw] || 0),
            backgroundColor: '#4ab4deff',
            borderColor: '#3d9dc7',
            borderWidth: 1
        },
        {
            label: `${time2}`,
            data: keywords.map(kw => time2Map[kw] || 0),
            backgroundColor: '#a78bfa',
            borderColor: '#8b5cf6',
            borderWidth: 1
        }
    ];

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
                    top: 60,
                    bottom: 30
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
                        autoSkip: false,
                        font: { size: 11 }
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
                    ticks: {
                        color: '#9ca3af',
                        precision: 0
                    },
                    grid: { color: '#3d4456' },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderNewKeywordsComparisonChart(canvasId, data, time1, time2) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Extract data for both time periods
    const time1Data = data.compare[time1] || [];
    const time2Data = data.compare[time2] || [];

    // Get all unique keywords from both periods
    const keywordSet = new Set();
    const keywordTotals = {};

    time1Data.forEach(item => {
        if (item.keyword) {
            keywordSet.add(item.keyword);
            const score = item.score || item.prediction || item.count || 0;
            keywordTotals[item.keyword] = (keywordTotals[item.keyword] || 0) + score;
        }
    });

    time2Data.forEach(item => {
        if (item.keyword) {
            keywordSet.add(item.keyword);
            const score = item.score || item.prediction || item.count || 0;
            keywordTotals[item.keyword] = (keywordTotals[item.keyword] || 0) + score;
        }
    });

    // Sort keywords by total score and take top 20
    const keywords = Array.from(keywordSet)
        .sort((a, b) => (keywordTotals[b] || 0) - (keywordTotals[a] || 0))
        .slice(0, 20);

    if (keywords.length === 0) {
        showNoDataMessage(canvasId, 'No new keywords data available');
        return;
    }

    // Create lookup maps
    const time1Map = Object.fromEntries(
        time1Data.map(item => [item.keyword, item.score || item.prediction || item.count || 0])
    );
    const time2Map = Object.fromEntries(
        time2Data.map(item => [item.keyword, item.score || item.prediction || item.count || 0])
    );

    // Create datasets
    const datasets = [
        {
            label: `${time1}`,
            data: keywords.map(kw => time1Map[kw] || 0),
            backgroundColor: '#4ab4deff',
            borderColor: '#3d9dc7',
            borderWidth: 1
        },
        {
            label: `${time2}`,
            data: keywords.map(kw => time2Map[kw] || 0),
            backgroundColor: '#a78bfa',
            borderColor: '#8b5cf6',
            borderWidth: 1
        }
    ];

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
                        size: 9
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

// ---- KEYWORD CO-OCCURRENCE ----
export function initKeywordCooccurrence() {
    const analyzeBtn = document.getElementById('analyzeCooccurrenceBtn');
    const selector = document.getElementById('keywordCooccurrenceSelector');

    if (!analyzeBtn || !selector) {
        console.warn('Co-occurrence elements not found');
        return;
    }

    analyzeBtn.addEventListener('click', async () => {
        const selectedKeyword = selector.value;
        if (!selectedKeyword) {
            alert('Please select a keyword first');
            return;
        }

        const granularity = document.getElementById('cooccurrenceGranularitySelector').value;
        const time1 = document.getElementById('cooccurrenceTime1Input').value.trim();
        const time2 = document.getElementById('cooccurrenceTime2Input').value.trim();

        await loadCooccurrenceData(selectedKeyword, granularity, time1, time2);
    });
}

export function populateKeywordSelector(keywords) {
    const selector = document.getElementById('keywordCooccurrenceSelector');
    if (!selector) return;

    // Clear existing options except the first one
    selector.innerHTML = '<option value="">-- Select a keyword --</option>';

    // Add keywords as options
    keywords.forEach(keyword => {
        const option = document.createElement('option');
        option.value = keyword;
        option.textContent = keyword;
        selector.appendChild(option);
    });
}

async function loadCooccurrenceData(keyword, granularity, time1, time2) {
    const loadingDiv = document.getElementById('cooccurrenceLoading');
    const tableContainer = document.getElementById('cooccurrenceTableContainer');
    const noDataDiv = document.getElementById('cooccurrenceNoData');
    const tableBody1 = document.getElementById('cooccurrenceTableBody1');
    const tableBody2 = document.getElementById('cooccurrenceTableBody2');
    const time1Header = document.getElementById('cooccurrenceTime1Header');
    const time2Header = document.getElementById('cooccurrenceTime2Header');

    // Show loading, hide others
    if (loadingDiv) loadingDiv.classList.remove('hidden');
    if (tableContainer) tableContainer.classList.add('hidden');
    if (noDataDiv) noDataDiv.classList.add('hidden');

    try {
        const params = getFilterParams({
            keyword: keyword,
            granularity: granularity,
            time1: time1,
            time2: time2,
            top_n: 20
        });

        console.log('Fetching co-occurrence data with params:', params);
        const response = await keyword_cooccurrence(params);

        console.log('Co-occurrence data received:', response);

        // Extract data for both time periods from compare object
        const compare = response.compare || {};
        let data1 = compare[time1]?.top_pairs || [];
        let data2 = compare[time2]?.top_pairs || [];

        if ((!Array.isArray(data1) || data1.length === 0) && (!Array.isArray(data2) || data2.length === 0)) {
            if (loadingDiv) loadingDiv.classList.add('hidden');
            if (noDataDiv) noDataDiv.classList.remove('hidden');
            return;
        }

        // Sort by count in descending order
        data1 = [...data1].sort((a, b) => (b.count || 0) - (a.count || 0));
        data2 = [...data2].sort((a, b) => (b.count || 0) - (a.count || 0));

        // Update headers
        if (time1Header) time1Header.textContent = time1;
        if (time2Header) time2Header.textContent = time2;

        // Populate table 1
        if (tableBody1) {
            tableBody1.innerHTML = '';
            if (data1.length === 0) {
                tableBody1.innerHTML = '<tr><td colspan="4" class="px-3 py-3 text-center text-gray-400">No data available</td></tr>';
            } else {
                data1.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-[#3d4456] hover:bg-[#252d3d]';
                    tr.innerHTML = `
                        <td class="px-3 py-2">${row.word1 || ''}</td>
                        <td class="px-3 py-2">${row.word2 || ''}</td>
                        <td class="px-3 py-2">${row.count || 0}</td>
                        <td class="px-3 py-2">${typeof row.pmi === 'number' ? row.pmi.toFixed(1) : 'N/A'}</td>
                    `;
                    tableBody1.appendChild(tr);
                });
            }
        }

        // Populate table 2
        if (tableBody2) {
            tableBody2.innerHTML = '';
            if (data2.length === 0) {
                tableBody2.innerHTML = '<tr><td colspan="4" class="px-3 py-3 text-center text-gray-400">No data available</td></tr>';
            } else {
                data2.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b border-[#3d4456] hover:bg-[#252d3d]';
                    tr.innerHTML = `
                        <td class="px-3 py-2">${row.word1 || ''}</td>
                        <td class="px-3 py-2">${row.word2 || ''}</td>
                        <td class="px-3 py-2">${row.count || 0}</td>
                        <td class="px-3 py-2">${typeof row.pmi === 'number' ? row.pmi.toFixed(1) : 'N/A'}</td>
                    `;
                    tableBody2.appendChild(tr);
                });
            }
        }

        // Show table, hide loading
        if (loadingDiv) loadingDiv.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');

    } catch (err) {
        console.error('Error loading co-occurrence data:', err);
        if (loadingDiv) loadingDiv.classList.add('hidden');
        if (noDataDiv) {
            noDataDiv.textContent = `Error: ${err.message}`;
            noDataDiv.classList.remove('hidden');
        }
    }
}
