/**
 * Shared layout loader for all pages
 */
import { groupChat, availableYears, uploadFile } from './api/api.js';

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


function setupUploadFunctionality() {
    const uploadButton = document.querySelector('aside button');
    const dropzone = document.querySelector('aside .border-dashed');
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.zip,.txt';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // Handle file upload
    async function handleFileUpload(file) {
        if (!file) return;

        // Validate file type
        const validTypes = ['.zip', '.txt'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!validTypes.includes(fileExtension)) {
            alert('Please upload a .zip or .txt file');
            return;
        }

        // Show loading state
        const originalDropzoneText = dropzone.innerHTML;
        dropzone.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="loading-spinner mb-2"></div>
                <p>Uploading ${file.name}...</p>
            </div>
        `;
        dropzone.style.borderColor = '#C990B8';

        try {
            const result = await uploadFile(file);

            // Show success message
            dropzone.innerHTML = `
                <div class="text-green-400">
                    ✓ Successfully uploaded ${file.name}
                    <br>
                    <span class="text-xs">Group ID: ${result.group_id}, Year: ${result.group_year}</span>
                    <br>
                    <span class="text-xs text-gray-400">Refreshing data...</span>
                </div>
            `;
            dropzone.style.borderColor = '#10b981';

            // Wait a bit for backend to finish processing, then reload
            setTimeout(async () => {
                console.log('Refreshing years and group chats after upload...');
                await loadYears();
                await loadGroupChats();
                console.log('Years and group chats refreshed successfully');

                dropzone.innerHTML = originalDropzoneText;
                dropzone.style.borderColor = '#3d4456';

                // Notify that data has been updated
                window.dispatchEvent(new Event('dataUploaded'));
            }, 3000);

        } catch (error) {
            console.error('Upload failed:', error);
            dropzone.innerHTML = `
                <div class="text-red-400">
                    ✗ Upload failed: ${error.message}
                </div>
            `;
            dropzone.style.borderColor = '#ef4444';

            // Reset after 3 seconds
            setTimeout(() => {
                dropzone.innerHTML = originalDropzoneText;
                dropzone.style.borderColor = '#3d4456';
            }, 3000);
        }
    }

    // Upload button click
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
        fileInput.value = ''; // Reset input
    });

    // Drag and drop functionality
    if (dropzone) {
        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#C990B8';
            dropzone.style.backgroundColor = '#2a2e3f';
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#3d4456';
            dropzone.style.backgroundColor = '#232938';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#3d4456';
            dropzone.style.backgroundColor = '#232938';

            const file = e.dataTransfer.files[0];
            if (file) {
                handleFileUpload(file);
            }
        });
    }
}

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

        // Setup upload functionality
        setupUploadFunctionality();
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
            link.href = 'brand.html';
        } else {
            // Other tabs go to their respective files in the frontend folder
            const filename = {
                'category': 'category.html',
                'general': 'general.html',
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
