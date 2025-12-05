const chartCache = {
    cache: {},
    STORAGE_KEY: 'chartCache',
    PARAMS_STORAGE_KEY: 'chartParams',

    // Initialize cache from localStorage
    _init() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                this.cache = JSON.parse(stored);
                console.log('[Cache] Loaded from localStorage:', Object.keys(this.cache).length, 'entries');
            }
        } catch (e) {
            console.warn('[Cache] Failed to load from localStorage:', e);
            this.cache = {};
        }
    },

    // Persist cache to localStorage
    _persist() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
        } catch (e) {
            console.warn('[Cache] Failed to persist to localStorage:', e);
        }
    },

    // Helper function to create a consistent string representation of params
    _paramsKey(params) {
        if (!params || typeof params !== 'object') {
            return JSON.stringify(params);
        }
        // Sort keys to ensure consistent comparison
        const sortedKeys = Object.keys(params).sort();
        const sortedObj = {};
        sortedKeys.forEach(key => {
            const value = params[key];
            // Sort array values too for consistency
            if (Array.isArray(value)) {
                sortedObj[key] = [...value].sort();
            } else {
                sortedObj[key] = value;
            }
        });
        return JSON.stringify(sortedObj);
    },

    set(chartId, params, data) {
        const paramsKey = this._paramsKey(params);
        const cacheKey = `${chartId}:${paramsKey}`;

        this.cache[cacheKey] = {
            params: JSON.parse(JSON.stringify(params)),
            data: JSON.parse(JSON.stringify(data)),
            timestamp: Date.now()
        };
        this._persist();
        console.log(`[Cache] SET: ${chartId}`, params);
    },

    get(chartId, currentParams) {
        const paramsKey = this._paramsKey(currentParams);
        const cacheKey = `${chartId}:${paramsKey}`;

        const cached = this.cache[cacheKey];
        if (!cached) {
            console.log(`[Cache] MISS: ${chartId}`, currentParams);
            return null;
        }

        console.log(`[Cache] HIT: ${chartId}`, currentParams);
        return cached.data;
    },

    clear(chartId) {
        if (chartId) {
            // Clear all cache entries for this chartId
            const keysToDelete = Object.keys(this.cache).filter(key => key.startsWith(chartId + ':'));
            keysToDelete.forEach(key => delete this.cache[key]);
            console.log(`[Cache] CLEAR: ${chartId} (${keysToDelete.length} entries)`);
        } else {
            this.cache = {};
            console.log('[Cache] CLEAR ALL');
        }
        this._persist();
    },

    has(chartId, currentParams) {
        return this.get(chartId, currentParams) !== null;
    },

    // Save chart parameters for auto-reload
    saveChartParams(page, chartId, params) {
        try {
            const allParams = JSON.parse(localStorage.getItem(this.PARAMS_STORAGE_KEY) || '{}');
            if (!allParams[page]) allParams[page] = {};
            allParams[page][chartId] = params;
            localStorage.setItem(this.PARAMS_STORAGE_KEY, JSON.stringify(allParams));
            console.log(`[Cache] Saved params for ${page}:${chartId}`, params);
        } catch (e) {
            console.warn('[Cache] Failed to save chart params:', e);
        }
    },

    // Get saved chart parameters
    getChartParams(page, chartId) {
        try {
            const allParams = JSON.parse(localStorage.getItem(this.PARAMS_STORAGE_KEY) || '{}');
            return allParams[page]?.[chartId] || null;
        } catch (e) {
            console.warn('[Cache] Failed to get chart params:', e);
            return null;
        }
    },

    // Get all saved parameters for a page
    getPageParams(page) {
        try {
            const allParams = JSON.parse(localStorage.getItem(this.PARAMS_STORAGE_KEY) || '{}');
            return allParams[page] || {};
        } catch (e) {
            console.warn('[Cache] Failed to get page params:', e);
            return {};
        }
    }
};

// Initialize cache on load
chartCache._init();

export default chartCache;