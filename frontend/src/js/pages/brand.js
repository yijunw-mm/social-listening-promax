import {
    get_brand_keyword,
    get_sentiment_analysis,
    get_consumer_perception,
    add_brand_keyword,
    remove_brand_keyword
} from '../api/api.js';

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

let chartInstances = {};
let hiddenPerceptionWords= new Set();

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

// Export individual loading functions for each chart
export async function loadBrandKeywordData(brandName) {
    console.log('Loading brand keyword data:', { brandName });
    await loadBrandKeyword(brandName);
}

export async function loadSentimentAnalysisData(brandName) {
    console.log('Loading sentiment analysis data:', { brandName });
    await loadSentimentAnalysis(brandName);
}

export async function loadConsumerPerceptionData(brandName) {
    console.log('Loading consumer perception data:', { brandName });
    await loadConsumerPerception(brandName);
}

// Load all brand charts sequentially
export async function loadAllBrandData(brandName) {
    console.log('Loading all brand data sequentially...');
    await loadBrandKeyword(brandName);
    await loadSentimentAnalysis(brandName);
    await loadConsumerPerception(brandName);
    console.log('All brand data loaded');
}

// Individual chart loading functions
async function loadBrandKeyword(brandName) {
    const canvasId = 'keywordChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({ brand_name: brandName });

        console.log("API Params:", params);

        const data = await get_brand_keyword(params);
        console.log(`Data received for ${canvasId}:`, data);

        if (isValidData(data)) {
            renderChart(canvasId, data, buildKeywordConfig);
        } else {
            const canvas = document.getElementById(canvasId);
            showNoDataMessage(canvas.getContext("2d"), canvas, "No data available");
        }
    } catch (err) {
        console.error(`Error loading ${canvasId}:`, err);
        const canvas = document.getElementById(canvasId);
        showNoDataMessage(canvas.getContext("2d"), canvas, `Error loading ${canvasId}`);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

async function loadSentimentAnalysis(brandName) {
    const canvasId = 'sentimentChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({ brand_name: brandName });

        console.log("API Params:", params);

        const data = await get_sentiment_analysis(params);
        console.log(`Data received for ${canvasId}:`, data);

        if (isValidData(data)) {
            renderChart(canvasId, data, buildSentimentConfig);
            // Display sentiment examples
            displaySentimentExamples(data.examples || []);
        } else {
            const canvas = document.getElementById(canvasId);
            showNoDataMessage(canvas.getContext("2d"), canvas, "No data available");
            displaySentimentExamples([]);
        }
    } catch (err) {
        console.error(`Error loading ${canvasId}:`, err);
        const canvas = document.getElementById(canvasId);
        showNoDataMessage(canvas.getContext("2d"), canvas, `Error loading ${canvasId}`);
        displaySentimentExamples([]);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

async function loadConsumerPerception(brandName) {
    const canvasId = 'perceptionChart';
    const loadingOverlay = document.getElementById(`loadingOverlay-${canvasId}`);

    if (loadingOverlay) loadingOverlay.classList.add('active');

    try {
        const params = getFilterParams({ brand_name: brandName, top_k: 20 });

        console.log("API Params:", params);

        const data = await get_consumer_perception(params);
        console.log(`Data received for ${canvasId}:`, data);

        if (isValidData(data)) {
            renderChart(canvasId, data, buildPerceptionConfig);
        } else {
            const canvas = document.getElementById(canvasId);
            showNoDataMessage(canvas.getContext("2d"), canvas, "No data available");
        }
    } catch (err) {
        console.error(`Error loading ${canvasId}:`, err);
        const canvas = document.getElementById(canvasId);
        showNoDataMessage(canvas.getContext("2d"), canvas, `Error loading ${canvasId}`);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

//ok almost done ayay

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
    const sortedData = [...data].sort((a, b) => b.count - a.count);
    return {
        type: "bar",
        data: {
            labels: sortedData.map(d => d.keyword),
            datasets: [{
                label: "Keyword Frequency",
                data: sortedData.map(d => d.count),
                backgroundColor: "#48b7e3ff"
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

    // Filter out hidden words
    const filteredWords = words.filter(w => {
        const word = (w.word || w.text || w.label || '').toLowerCase();
        return !hiddenPerceptionWords.has(word);
    });

    // Sort words by count in descending order
    const sortedWords = [...filteredWords].sort((a, b) => {
        const countA = a.count || a.frequency || a.value || 0;
        const countB = b.count || b.frequency || b.value || 0;
        return countB - countA;
    });

    const labels = sortedWords.map(w => w.word || w.text || w.label || '');
    const values = sortedWords.map(w => w.count || w.frequency || w.value || 0);

    console.log('Perception chart labels:', labels);
    console.log('Perception chart values:', values);

    return {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Associated Words",
                data: values,
                backgroundColor: "#48b7e3ff"
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

// ---- SENTIMENT EXAMPLES TOGGLE ----
export function initSentimentExamplesToggle() {
    const toggleBtn = document.getElementById('toggleSentimentExamples');
    const examplesList = document.getElementById('sentimentExamplesList');
    const toggleText = document.getElementById('toggleSentimentExamplesText');
    const toggleIcon = document.getElementById('toggleSentimentExamplesIcon');

    if (!toggleBtn || !examplesList) return;

    let isVisible = true;

    toggleBtn.addEventListener('click', () => {
        isVisible = !isVisible;

        if (isVisible) {
            examplesList.style.display = 'block';
            toggleText.textContent = 'Hide';
            toggleIcon.textContent = '▼';
        } else {
            examplesList.style.display = 'none';
            toggleText.textContent = 'Show';
            toggleIcon.textContent = '▶';
        }
    });
}

// ---- KEYWORD MANAGEMENT ----
export function initKeywordManagement() {
    const addBtn = document.getElementById('addKeywordBtn');
    const keywordInput = document.getElementById('keywordInput');

    if (!addBtn || !keywordInput) return;

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
            addCustomKeyword(brandName, keyword);

            // Clear input
            keywordInput.value = '';

            // Reload chart
            await loadBrandKeyword(brandName);

            // Update keyword tags display
            displayCustomKeywords(brandName);
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
}

async function displayCustomKeywords(brandName) {
    const container = document.getElementById('customKeywordsList');
    if (!container) return;

    try {
        // Get custom keywords from localStorage
        const customKeywords = getCustomKeywords(brandName);

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
                await removeKeyword(brandName, keywordToRemove);
            });

            container.appendChild(tag);
        });
    } catch (err) {
        console.error('Error displaying keywords:', err);
    }
}

async function removeKeyword(brandName, keyword) {
    try {
        await remove_brand_keyword({ brand_name: brandName, keyword: keyword });
        console.log(`Removed keyword: ${keyword} for brand: ${brandName}`);

        // Remove from localStorage
        removeCustomKeyword(brandName, keyword);

        // Reload chart
        await loadBrandKeyword(brandName);

        // Update display
        displayCustomKeywords(brandName);
    } catch (err) {
        console.error('Error removing keyword:', err);
        alert('Failed to remove keyword. Please try again.');
    }
}

// LocalStorage helpers for tracking custom keywords
function getCustomKeywords(brandName) {
    const stored = localStorage.getItem(`customKeywords_${brandName}`);
    return stored ? JSON.parse(stored) : [];
}

function addCustomKeyword(brandName, keyword) {
    const keywords = getCustomKeywords(brandName);
    if (!keywords.includes(keyword)) {
        keywords.push(keyword);
        localStorage.setItem(`customKeywords_${brandName}`, JSON.stringify(keywords));
    }
}

function removeCustomKeyword(brandName, keyword) {
    const keywords = getCustomKeywords(brandName);
    const filtered = keywords.filter(k => k !== keyword);
    localStorage.setItem(`customKeywords_${brandName}`, JSON.stringify(filtered));
}

// ---- CONSUMER PERCEPTION WORD FILTERING ----
export function initPerceptionWordFilter() {
    const filterInput = document.getElementById('perceptionWordFilterInput');
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
        words.forEach(word => hiddenPerceptionWords.add(word));

        // Clear input
        filterInput.value = '';

        // Re-render chart with filtered data
        const brandSelector = document.getElementById('brandSelector');
        const brandName = brandSelector ? brandSelector.value : 'mamypoko';
        loadConsumerPerception(brandName);

        // Update hidden words display
        displayHiddenWords();
    }

    // Display existing hidden words on load
    displayHiddenWords();
}

function displayHiddenWords() {
    const container = document.getElementById('hiddenWordsList');
    if (!container) return;

    container.innerHTML = '';

    if (hiddenPerceptionWords.size === 0) {
        container.innerHTML = '<span class="text-gray-500 text-sm">No hidden words</span>';
        return;
    }

    hiddenPerceptionWords.forEach(word => {
        const tag = document.createElement('div');
        tag.className = 'flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm';
        tag.innerHTML = `
            <span>${word}</span>
            <button class="hover:text-gray-300 font-bold" data-word="${word}">×</button>
        `;

        // Add restore handler
        tag.querySelector('button').addEventListener('click', (e) => {
            const wordToRestore = e.target.getAttribute('data-word');
            restoreWord(wordToRestore);
        });

        container.appendChild(tag);
    });
}

function restoreWord(word) {
    // Remove from hidden words set
    hiddenPerceptionWords.delete(word.toLowerCase());

    // Re-render chart
    const brandSelector = document.getElementById('brandSelector');
    const brandName = brandSelector ? brandSelector.value : 'mamypoko';
    loadConsumerPerception(brandName);

    // Update display
    displayHiddenWords();
}

// ---- SHARED CHART OPTIONS ----
const baseOptions = {
    responsive: true,
    maintainAspectRatio: true,
    layout: {
        padding: {
            top:60,
            bottom: 30

        }
    },
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
function isValidData(data) {
    return Array.isArray(data) ? data.length > 0 :
        data?.sentiment_count?.length > 0 ||
        data?.associated_words?.length > 0;
}

function showNoDataMessage(ctx, canvas, message) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#9ca3af";
    ctx.textAlign = "center";
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function displaySentimentExamples(examples) {
    const container = document.getElementById('sentimentExamplesList');
    if (!container) return;

    container.innerHTML = '';

    if (!examples || examples.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-sm">No examples available</p>';
        return;
    }

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

    examples.forEach((example) => {
        const exampleCard = document.createElement('div');
        exampleCard.className = `p-3 rounded-lg border-l-4 ${getSentimentColor(example.sentiment)}`;

        exampleCard.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <span class="font-semibold ${getSentimentTextColor(example.sentiment)} capitalize">
                    ${example.sentiment}
                </span>
                <span class="text-gray-400 text-sm">
                    Score: ${example.sentiment_score.toFixed(3)}
                </span>
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

        container.appendChild(exampleCard);
    });
}
