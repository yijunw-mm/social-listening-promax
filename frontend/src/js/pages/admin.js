import {
    add_brand,
    add_brand_words,
    add_category,
    add_slang_variant,
    add_general_keyword,
    remove_brand,
    remove_brand_words
} from '../api/api.js';

export function renderAdminPage() {
    const pageContent = document.getElementById('page-content');
    if (!pageContent) {
        console.error('page-content element not found');
        return;
    }

    pageContent.innerHTML = `
        <h2 class="text-white text-2xl font-semibold mb-6">Admin Dashboard</h2>

        <!-- Add Brand Section -->
        <div class="bg-[#2a3142] border border-[#3d4456] rounded-lg p-6 shadow-lg mb-6">
            <div class="text-white font-semibold text-lg mb-4 border-b border-[#3d4456] pb-2">
                Add Brand
            </div>
            <div class="text-gray-400 mb-6">
                Add a new brand to the database by specifying its category. This will create a new brand entry that can be tracked across all analytics.
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" id="categoryName" placeholder="Category Name"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
                <input type="text" id="brandName" placeholder="Brand Name"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
            </div>
            <button onclick="handleAddBrand()"
                class="mt-4 bg-[#C990B8] hover:bg-[#c967ac] text-white px-6 py-2 rounded transition">
                Add Brand
            </button>
            <div id="addBrandResult" class="mt-2 text-sm"></div>
        </div>

        <!-- Add Brand Keywords Section -->
        <div class="bg-[#2a3142] border border-[#3d4456] rounded-lg p-6 shadow-lg mb-6">
            <div class="text-white font-semibold text-lg mb-4 border-b border-[#3d4456] pb-2">
                Add Brand Keyword
            </div>
            <div class="text-gray-400 mb-6">
                Add custom keywords to associate with a specific brand. These keywords will be tracked in the keyword frequency analysis for this brand.
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" id="keywordBrandName" placeholder="Brand Name"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
                <input type="text" id="keyword" placeholder="Keyword"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
            </div>
            <button onclick="handleAddKeywords()"
                class="mt-4 bg-[#C990B8] hover:bg-[#c967ac] text-white px-6 py-2 rounded transition">
                Add Keyword
            </button>
            <div id="addKeywordsResult" class="mt-2 text-sm"></div>
        </div>

        <!-- Add Category Section -->
        <div class="bg-[#2a3142] border border-[#3d4456] rounded-lg p-6 shadow-lg mb-6">
            <div class="text-white font-semibold text-lg mb-4 border-b border-[#3d4456] pb-2">
                Add Category
            </div>
            <div class="text-gray-400 mb-6">
                Create a new category for organizing brands. Categories help group related brands together for better organization and analysis.
            </div>
            <div class="grid grid-cols-1 gap-4">
                <input type="text" id="newCategoryName" placeholder="Category Name"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
            </div>
            <button onclick="handleAddCategory()"
                class="mt-4 bg-[#C990B8] hover:bg-[#c967ac] text-white px-6 py-2 rounded transition">
                Add Category
            </button>
            <div id="addCategoryResult" class="mt-2 text-sm"></div>
        </div>

        <!-- Add Slang/Variant Section -->
        <div class="bg-[#2a3142] border border-[#3d4456] rounded-lg p-6 shadow-lg mb-6">
            <div class="text-white font-semibold text-lg mb-4 border-b border-[#3d4456] pb-2">
                Add Slang
            </div>
            <div class="text-gray-400 mb-6">
                Map informal slang terms to their formal equivalents. This helps the system recognize and normalize different variations of the same word in conversations.
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" id="slangFormal" placeholder="Formal"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
                <input type="text" id="slangVariant" placeholder="Slang"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
            </div>
            <button onclick="handleAddSlang()"
                class="mt-4 bg-[#C990B8] hover:bg-[#c967ac] text-white px-6 py-2 rounded transition">
                Add Slang
            </button>
            <div id="addSlangResult" class="mt-2 text-sm"></div>
        </div>

        <!-- Add General Keyword Section -->
        <div class="bg-[#2a3142] border border-[#3d4456] rounded-lg p-6 shadow-lg mb-6">
            <div class="text-white font-semibold text-lg mb-4 border-b border-[#3d4456] pb-2">
                Add General Keyword
            </div>
            <div class="text-gray-400 mb-6">
                Add general keywords to track across all brands and categories. These keywords appear in the general keyword analysis charts.
            </div>
            <div class="grid grid-cols-1 gap-4">
                <input type="text" id="generalKeyword" placeholder="General Word"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
            </div>
            <button onclick="handleAddGeneralKeyword()"
                class="mt-4 bg-[#C990B8] hover:bg-[#c967ac] text-white px-6 py-2 rounded transition">
                Add General Keyword
            </button>
            <div id="addGeneralKeywordResult" class="mt-2 text-sm"></div>
        </div>

        <!-- Remove Brand Section -->
        <div class="bg-[#2a3142] border border-[#3d4456] rounded-lg p-6 shadow-lg mb-6">
            <div class="text-white font-semibold text-lg mb-4 border-b border-[#3d4456] pb-2">
                Remove Brand
            </div>
            <div class="text-gray-400 mb-6">
                Permanently remove a brand from the database. This will delete all associated data including keywords and analytics for this brand.
            </div>
            <div class="grid grid-cols-1 gap-4">
                <input type="text" id="removeBrandName" placeholder="Brand Name"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
            </div>
            <button onclick="handleRemoveBrand()"
                class="mt-4 bg-red-400 hover:bg-red-500 text-white px-6 py-2 rounded transition">
                Remove Brand
            </button>
            <div id="removeBrandResult" class="mt-2 text-sm"></div>
        </div>

        <!-- Remove Brand Keywords Section -->
        <div class="bg-[#2a3142] border border-[#3d4456] rounded-lg p-6 shadow-lg mb-6">
            <div class="text-white font-semibold text-lg mb-4 border-b border-[#3d4456] pb-2">
                Remove Brand Keyword
            </div>
            <div class="text-gray-400 mb-6">
                Remove a specific keyword from a brand's tracking list. This will stop tracking this keyword in the brand's keyword frequency analysis.
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" id="removeKeywordBrandName" placeholder="Brand Name"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
                <input type="text" id="removeKeyword" placeholder="Keyword"
                    class="bg-[#1f252f] text-white border border-[#3d4456] rounded px-4 py-2 focus:outline-none focus:border-purple-400">
            </div>
            <button onclick="handleRemoveKeywords()"
                class="mt-4 bg-red-400 hover:bg-red-500 text-white px-6 py-2 rounded transition">
                Remove Keyword
            </button>
            <div id="removeKeywordsResult" class="mt-2 text-sm"></div>
        </div>
    `;

    // Attach event handlers
    setupAdminHandlers();
}

function setupAdminHandlers() {
    // Add Brand
    window.handleAddBrand = async function() {
        const brandName = document.getElementById('brandName').value;
        const categoryName = document.getElementById('categoryName').value;
        const resultDiv = document.getElementById('addBrandResult');

        if (!brandName || !categoryName) {
            resultDiv.textContent = 'Please fill all fields';
            resultDiv.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const result = await add_brand({ brand_name: brandName, category_name: categoryName });
            resultDiv.textContent = result.message || JSON.stringify(result);
            resultDiv.className = 'mt-2 text-base text-green-400 font-medium';
            document.getElementById('brandName').value = '';
            document.getElementById('categoryName').value = '';
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'mt-2 text-base text-red-400 font-medium';
        }
    };

    // Add Brand Keywords
    window.handleAddKeywords = async function() {
        const brandName = document.getElementById('keywordBrandName').value;
        const keyword = document.getElementById('keyword').value;
        const resultDiv = document.getElementById('addKeywordsResult');

        if (!brandName || !keyword) {
            resultDiv.textContent = 'Please fill all fields';
            resultDiv.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const result = await add_brand_words({ brand_name: brandName, keywords: [keyword] });
            resultDiv.textContent = result.message || JSON.stringify(result);
            resultDiv.className = 'mt-2 text-base text-green-400 font-medium';
            document.getElementById('keywordBrandName').value = '';
            document.getElementById('keyword').value = '';
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'mt-2 text-base text-red-400 font-medium';
        }
    };

    // Add Category
    window.handleAddCategory = async function() {
        const categoryName = document.getElementById('newCategoryName').value;
        const resultDiv = document.getElementById('addCategoryResult');

        if (!categoryName) {
            resultDiv.textContent = 'Please fill all fields';
            resultDiv.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const result = await add_category({ category_name: categoryName });
            resultDiv.textContent = result.message || JSON.stringify(result);
            resultDiv.className = 'mt-2 text-base text-green-400 font-medium';
            document.getElementById('newCategoryName').value = '';
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'mt-2 text-base text-red-400 font-medium';
        }
    };

    // Add Slang/Variant
    window.handleAddSlang = async function() {
        const formal = document.getElementById('slangFormal').value;
        const variant = document.getElementById('slangVariant').value;
        const resultDiv = document.getElementById('addSlangResult');

        if (!formal || !variant) {
            resultDiv.textContent = 'Please fill all fields';
            resultDiv.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const result = await add_slang_variant({ formal: formal, slang: variant });
            resultDiv.textContent = result.message || JSON.stringify(result);
            resultDiv.className = 'mt-2 text-base text-green-400 font-medium';
            document.getElementById('slangFormal').value = '';
            document.getElementById('slangVariant').value = '';
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'mt-2 text-base text-red-400 font-medium';
        }
    };

    // Add General Keyword
    window.handleAddGeneralKeyword = async function() {
        const keyword = document.getElementById('generalKeyword').value;
        const resultDiv = document.getElementById('addGeneralKeywordResult');

        if (!keyword) {
            resultDiv.textContent = 'Please fill all fields';
            resultDiv.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const result = await add_general_keyword({ general_kw: [keyword] });
            resultDiv.textContent = result.message || JSON.stringify(result);
            resultDiv.className = 'mt-2 text-base text-green-400 font-medium';
            document.getElementById('generalKeyword').value = '';
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'mt-2 text-base text-red-400 font-medium';
        }
    };

    // Remove Brand
    window.handleRemoveBrand = async function() {
        const brandName = document.getElementById('removeBrandName').value;
        const resultDiv = document.getElementById('removeBrandResult');

        if (!brandName) {
            resultDiv.textContent = 'Please fill all fields';
            resultDiv.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const result = await remove_brand({ brand_name: brandName });
            resultDiv.textContent = result.message || JSON.stringify(result);
            resultDiv.className = 'mt-2 text-base text-green-400 font-medium';
            document.getElementById('removeBrandName').value = '';
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'mt-2 text-base text-red-400 font-medium';
        }
    };

    // Remove Brand Keywords
    window.handleRemoveKeywords = async function() {
        const brandName = document.getElementById('removeKeywordBrandName').value;
        const keyword = document.getElementById('removeKeyword').value;
        const resultDiv = document.getElementById('removeKeywordsResult');

        if (!brandName || !keyword) {
            resultDiv.textContent = 'Please fill all fields';
            resultDiv.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const result = await remove_brand_words({ brand_name: brandName, keyword: keyword });
            resultDiv.textContent = result.message || JSON.stringify(result);
            resultDiv.className = 'mt-2 text-base text-green-400 font-medium';
            document.getElementById('removeKeywordBrandName').value = '';
            document.getElementById('removeKeyword').value = '';
        } catch (error) {
            resultDiv.textContent = `Error: ${error.message}`;
            resultDiv.className = 'mt-2 text-base text-red-400 font-medium';
        }
    };
}
