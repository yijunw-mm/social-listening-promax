/**
 * Shared layout loader for all pages
 */

async function loadLayout(pageId) {
    try {
        // All pages are now in the frontend folder, so use relative path
        const layoutPath = 'src/components/layout.html';

        // Load layout template
        const layoutHTML = await fetch(layoutPath).then(res => res.text());
        document.getElementById('layout').innerHTML = layoutHTML;

        // Fix navigation links
        fixNavigationLinks();

        // Set active tab based on current page
        setActiveTab(pageId);
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
