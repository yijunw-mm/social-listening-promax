/**
 * Shared layout loader for all pages
 */
import { groupChat, availableYears } from './api/api.js';

async function loadYears() {
    try {
        const container = document.getElementById("yearCheckboxes");
        if (!container) return;

        const response = await availableYears();
        const years = response.years || [];

        container.innerHTML = '';

        // Load previously selected years (multiple selections allowed)
        const savedYears = JSON.parse(localStorage.getItem('selectedYears') || '[]');

        years.forEach(year => {
            const wrapper = document.createElement("div");
            wrapper.className = "flex items-center space-x-2 text-gray-300";

            wrapper.innerHTML = `
                <input type="checkbox"
                    class="year-checkbox w-4 h-4 accent-purple-500"
                    value="${year}"
                    ${savedYears.includes(year) ? 'checked' : ''} />
                <span>${year}</span>
            `;

            container.appendChild(wrapper);
        });

        // Event listener for year selection
        container.addEventListener('change', () => {
            const selected = Array.from(
                document.querySelectorAll('.year-checkbox:checked')
            ).map(cb => parseInt(cb.value));

            localStorage.setItem('selectedYears', JSON.stringify(selected));

            // Notify other components
            window.dispatchEvent(new Event('yearChanged'));
        });

    } catch (error) {
        console.error('Failed to load years:', error);
    }
}

async function loadGroupChats() {
    try {
        const container = document.getElementById("groupChatCheckboxes");
        if (!container) return;

        const response = await groupChat();
        const groupChats = response.groups || [];

        container.innerHTML = '';

        // Load previously selected chats
        const savedSelections = JSON.parse(localStorage.getItem('selectedGroupChats') || '[]');

        groupChats.forEach(chat => {
            const id = chat.id || chat.name;
            const label = chat.name || chat.id;

            const wrapper = document.createElement("div");
            wrapper.className = "flex items-center space-x-2 text-gray-300";

            wrapper.innerHTML = `
                <input type="checkbox"
                    class="group-checkbox w-4 h-4 accent-purple-500"
                    value="${id}"
                    ${savedSelections.includes(id) ? 'checked' : ''} />
                <span>${label}</span>
            `;

            container.appendChild(wrapper);
        });

        // Event listener for saving selections
        container.addEventListener('change', () => {
            const selected = Array.from(
                document.querySelectorAll('.group-checkbox:checked')
            ).map(cb => cb.value);

            localStorage.setItem('selectedGroupChats', JSON.stringify(selected));
            window.dispatchEvent(new Event('groupChatChanged')); // Notify other scripts
        });

    } catch (error) {
        console.error('Failed to load group chats:', error);
    }
}


// Helper function to get selected group chat (can be called from any page)
window.getSelectedGroupChats = function () {
    return JSON.parse(localStorage.getItem('selectedGroupChats') || '[]');
};

// Helper function to get selected years (can be called from any page)
window.getSelectedYears = function () {
    return JSON.parse(localStorage.getItem('selectedYears') || '[]');
};


async function loadLayout(pageId) {
    try {
        // All pages are now in the frontend folder, so use relative path
        const layoutPath = './src/components/layout.html';

        // Load layout template
        const layoutHTML = await fetch(layoutPath).then(res => res.text());
        document.getElementById('layout').innerHTML = layoutHTML;

        // Fix navigation links
        fixNavigationLinks();

        // Set active tab based on current page
        setActiveTab(pageId);

        // Load years and group chats into selectors
        await loadYears();
        await loadGroupChats();
    } catch (error) {
        console.error('Failed to load layout:', error);
    }
}

function fixNavigationLinks() {
    // Get all tab links
    const tabLinks = document.querySelectorAll('.tab-link');

    tabLinks.forEach(link => {
        const page = link.getAttribute('data-page');

        if (page === 'brand') {
            // Brand tab goes to index.html in the frontend folder
            link.href = 'index.html';
        } else {
            // Other tabs go to their respective files in the frontend folder
            const filename = {
                'time': 'tab2_time.html',
                'sov': 'tab3_sov.html',
                'general': 'tab4_general.html',
                'cp': 'tab5_cp.html'
            }[page];

            link.href = filename;
        }
    });
}

function setActiveTab(pageId) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-link').forEach(tab => {
        tab.classList.remove('tab-active');
    });

    // Add active class to current tab
    const currentTab = document.querySelector(`a[data-page="${pageId}"]`);
    if (currentTab) {
        currentTab.classList.add('tab-active');
    }
}

// Export for ES6 modules and make available globally
export { loadLayout };
window.loadLayout = loadLayout;
