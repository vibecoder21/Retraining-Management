// Application state
let appState = {
    activeContributors: [],
    archivedContributors: [],
    currentTab: 'active',
    currentEntryMode: 'bulk',
    charts: {},
    bulkErrors: [],
    projectList: [],
    currentProject: 'Default'
};

// Initialize with sample data
const sampleData = {
    "sampleContributors": [
        {
            "id": "CB001",
            "email": "alice.smith@example.com",
            "status": "assigned",
            "result": null,
            "dateAdded": "2025-08-29",
            "dateAssigned": "2025-08-29",
            "dateCompleted": null
        },
        {
            "id": "CB002",
            "email": "bob.jones@example.com",
            "status": "assigned",
            "result": "passed",
            "dateAdded": "2025-08-28",
            "dateAssigned": "2025-08-28",
            "dateCompleted": "2025-08-29"
        },
        {
            "id": "CB003",
            "email": "charlie.wilson@example.com",
            "status": "assigned",
            "result": "failed",
            "dateAdded": "2025-08-27",
            "dateAssigned": "2025-08-27",
            "dateCompleted": "2025-08-28"
        },
        {
            "id": "CB004",
            "email": "diana.clark@example.com",
            "status": "pending",
            "result": null,
            "dateAdded": "2025-08-29",
            "dateAssigned": null,
            "dateCompleted": null
        }
    ],
    "archivedContributors": [
        {
            "id": "CB005",
            "email": "archived.user@example.com",
            "status": "assigned",
            "result": "passed",
            "dateAdded": "2025-08-25",
            "dateAssigned": "2025-08-25",
            "dateCompleted": "2025-08-26",
            "dateArchived": "2025-08-26"
        }
    ]
};

// Persistence helpers
function getProjectKey(project) {
    return `retrainingAppState_${project}`;
}

function saveState() {
    const stateToSave = {
        activeContributors: appState.activeContributors,
        archivedContributors: appState.archivedContributors
    };
    localStorage.setItem(getProjectKey(appState.currentProject), JSON.stringify(stateToSave));
    saveProjectsMeta();
}

function loadState() {
    const saved = localStorage.getItem(getProjectKey(appState.currentProject));
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            appState.activeContributors = parsed.activeContributors || [];
            appState.archivedContributors = parsed.archivedContributors || [];
            return;
        } catch (e) {
            console.error('Failed to parse saved state', e);
        }
    }
    appState.activeContributors = [...sampleData.sampleContributors];
    appState.archivedContributors = [...sampleData.archivedContributors];
    saveState();
}

function saveProjectsMeta() {
    localStorage.setItem('retrainingProjects', JSON.stringify(appState.projectList));
    localStorage.setItem('retrainingCurrentProject', appState.currentProject);
}

function loadProjectsMeta() {
    const list = localStorage.getItem('retrainingProjects');
    if (list) {
        try {
            appState.projectList = JSON.parse(list);
        } catch (e) {
            appState.projectList = ['Default'];
        }
    } else {
        appState.projectList = ['Default'];
    }
    const current = localStorage.getItem('retrainingCurrentProject');
    if (current && appState.projectList.includes(current)) {
        appState.currentProject = current;
    } else {
        appState.currentProject = appState.projectList[0];
    }
}

function renderProjectOptions() {
    const select = document.getElementById('projectSelect');
    if (!select) return;
    select.innerHTML = '';
    appState.projectList.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (name === appState.currentProject) opt.selected = true;
        select.appendChild(opt);
    });
}

function exportProject() {
    const data = {
        name: appState.currentProject,
        activeContributors: appState.activeContributors,
        archivedContributors: appState.archivedContributors
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appState.currentProject}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function handleImportProject(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = JSON.parse(evt.target.result);
            let name = data.name || file.name.replace(/\.json$/i, '');
            if (appState.projectList.includes(name)) {
                name = prompt('Project exists. Enter new name:', name);
                if (!name) return;
            }
            appState.projectList.push(name);
            appState.currentProject = name;
            appState.activeContributors = data.activeContributors || [];
            appState.archivedContributors = data.archivedContributors || [];
            saveState();
            renderProjectOptions();
            renderActiveContributors();
            renderArchive();
            renderCharts();
            showNotification('Project imported successfully');
        } catch (err) {
            console.error(err);
            showNotification('Failed to import project', 'error');
        }
    };
    reader.readAsText(file);
}

function encodeProjectData(data) {
    // Compress and URI-encode the project JSON for shorter links
    return LZString.compressToEncodedURIComponent(JSON.stringify(data));
}

function decodeProjectData(str) {
    const json = LZString.decompressFromEncodedURIComponent(str);
    return JSON.parse(json);
}

function shareProject() {
    const data = {
        name: appState.currentProject,
        activeContributors: appState.activeContributors,
        archivedContributors: appState.archivedContributors
    };
    try {
        const encoded = encodeProjectData(data);
        const baseUrl = window.location.href.split(/[?#]/)[0];
        const url = `${baseUrl}#shared=${encoded}`;

        if (navigator.share) {
            navigator.share({ title: data.name, url })
                .then(() => showNotification('Share dialog opened'))
                .catch(() => {
                    // User cancelled or share failed – fall back to clipboard
                    if (navigator.clipboard && window.isSecureContext) {
                        navigator.clipboard.writeText(url)
                            .then(() => showNotification('Share link copied to clipboard'))
                            .catch(() => {
                                prompt('Copy this share link:', url);
                                showNotification('Copy the link manually');
                            });
                    } else {
                        prompt('Copy this share link:', url);
                        showNotification('Copy the link manually');
                    }
                });
        } else if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url)
                .then(() => showNotification('Share link copied to clipboard'))
                .catch(() => {
                    prompt('Copy this share link:', url);
                    showNotification('Copy the link manually');
                });
        } else {
            prompt('Copy this share link:', url);
            showNotification('Copy the link manually');
        }
    } catch (err) {
        console.error('Error sharing project:', err);
        showNotification('Failed to generate share link', 'error');
    }
}

function deleteProject() {
    if (appState.projectList.length <= 1) {
        showNotification('Cannot delete the last project', 'error');
        return;
    }
    showConfirmDialog(
        'Delete Project',
        `Are you sure you want to delete project "${appState.currentProject}"?`,
        () => {
            localStorage.removeItem(getProjectKey(appState.currentProject));
            const idx = appState.projectList.indexOf(appState.currentProject);
            if (idx !== -1) {
                appState.projectList.splice(idx, 1);
            }
            appState.currentProject = appState.projectList[0];
            loadState();
            saveProjectsMeta();
            saveState();
            renderProjectOptions();
            renderActiveContributors();
            renderArchive();
            renderCharts();
            showNotification('Project deleted');
        }
    );
}

// Utility functions
function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
}

function generateId() {
    const existing = [...appState.activeContributors, ...appState.archivedContributors];
    let counter = existing.length + 1;
    let newId;
    do {
        newId = `CB${counter.toString().padStart(3, '0')}`;
        counter++;
    } while (existing.some(c => c.id === newId));
    return newId;
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function showConfirmDialog(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    modal.classList.remove('hidden');
    
    confirmBtn.onclick = () => {
        modal.classList.add('hidden');
        onConfirm();
    };
}

// Entry mode switching - Completely rewritten for better reliability
function switchEntryMode(mode) {
    console.log('Switching to entry mode:', mode);
    
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.entry-tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Hide all entry modes first
    const allModes = document.querySelectorAll('.entry-mode');
    allModes.forEach(modeEl => {
        modeEl.style.display = 'none';
        modeEl.classList.remove('active');
        modeEl.classList.add('hidden');
    });
    
    // Show the selected mode
    const targetMode = document.getElementById(`${mode}-entry`);
    if (targetMode) {
        targetMode.style.display = 'block';
        targetMode.classList.add('active');
        targetMode.classList.remove('hidden');
        console.log('Successfully switched to:', mode);
    } else {
        console.error('Could not find target mode element:', `${mode}-entry`);
    }
    
    appState.currentEntryMode = mode;
    hideAllResults();
}

function hideAllResults() {
    const elementsToHide = ['bulkPreview', 'csvPreview', 'csvActions', 'processingProgress', 'bulkResults'];
    elementsToHide.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
        }
    });
}

// Main tab switching - Completely rewritten
function switchMainTab(tabName) {
    console.log('Switching to main tab:', tabName);
    
    // Update active tab button
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Hide all tab contents
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });
    
    // Show the selected tab
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('active');
        console.log('Successfully switched to tab:', tabName);
        
        // Render content based on tab
        switch (tabName) {
            case 'active':
                renderActiveContributors();
                break;
            case 'daily':
                renderDailyView();
                break;
            case 'archive':
                renderArchive();
                break;
            case 'statistics':
                renderCharts();
                break;
        }
    } else {
        console.error('Could not find target tab element:', `${tabName}-tab`);
    }
    
    appState.currentTab = tabName;
}

// Data management functions
function addContributor(email, status = 'pending') {
    const existing = appState.activeContributors.find(
        c => c.email.toLowerCase() === email.toLowerCase()
    );

    // If contributor exists and we're adding a result status, update instead
    if (existing) {
        if (status === 'passed' || status === 'failed') {
            if (existing.result && existing.result !== status) {
                return { success: false, error: 'Email already has conflicting result status' };
            }
            existing.result = status;
            existing.status = 'assigned';
            existing.dateCompleted = getCurrentDate();
            saveState();
            return { success: true, contributor: existing };
        }
        return { success: false, error: 'Contributor with this email already exists' };
    }

    const contributor = {
        id: generateId(),
        email: email,
        status: (status === 'passed' || status === 'failed') ? 'assigned' : status,
        result: (status === 'passed' || status === 'failed') ? status : null,
        dateAdded: getCurrentDate(),
        dateAssigned: status !== 'pending' ? getCurrentDate() : null,
        dateCompleted: (status === 'passed' || status === 'failed') ? getCurrentDate() : null
    };

    appState.activeContributors.push(contributor);
    saveState();
    return { success: true, contributor };
}

function updateContributorStatus(contributorId, type, newStatus) {
    const contributor = appState.activeContributors.find(c => c.id === contributorId);
    if (!contributor) return;

    if (type === 'assignment') {
        const oldStatus = contributor.status;
        contributor.status = newStatus;
        if (newStatus === 'assigned' && oldStatus === 'pending') {
            contributor.dateAssigned = getCurrentDate();
        } else if (newStatus === 'pending') {
            contributor.dateAssigned = null;
            contributor.result = null;
            contributor.dateCompleted = null;
        }
        showNotification(`Assignment status updated to ${newStatus}`);
    } else if (type === 'result') {
        const oldResult = contributor.result;
        contributor.result = newStatus || null;
        if (newStatus === 'passed' || newStatus === 'failed') {
            if (!contributor.dateAssigned) {
                contributor.status = 'assigned';
                contributor.dateAssigned = getCurrentDate();
            }
            contributor.dateCompleted = getCurrentDate();
        } else if (oldResult && !newStatus) {
            contributor.dateCompleted = null;
        }
        showNotification(`Result status updated to ${newStatus || 'none'}`);
    }
    saveState();
}

function archiveContributor(contributorId) {
    const contributorIndex = appState.activeContributors.findIndex(c => c.id === contributorId);
    if (contributorIndex === -1) return;

    const contributor = appState.activeContributors[contributorIndex];
    contributor.dateArchived = getCurrentDate();

    appState.archivedContributors.push(contributor);
    appState.activeContributors.splice(contributorIndex, 1);

    saveState();
    showNotification('Contributor archived successfully!');
}

function restoreContributor(contributorId) {
    const contributorIndex = appState.archivedContributors.findIndex(c => c.id === contributorId);
    if (contributorIndex === -1) return;
    
    const contributor = appState.archivedContributors[contributorIndex];
    delete contributor.dateArchived;
    
    appState.activeContributors.push(contributor);
    appState.archivedContributors.splice(contributorIndex, 1);
    saveState();
    showNotification('Contributor restored to active list!');
}

function removeContributor(contributorId) {
    const activeIndex = appState.activeContributors.findIndex(c => c.id === contributorId);
    if (activeIndex !== -1) {
        appState.activeContributors.splice(activeIndex, 1);
        saveState();
        showNotification('Contributor removed!');
        return;
    }

    const archivedIndex = appState.archivedContributors.findIndex(c => c.id === contributorId);
    if (archivedIndex !== -1) {
        appState.archivedContributors.splice(archivedIndex, 1);
        saveState();
        showNotification('Contributor removed!');
    }
}

// Bulk entry functions
function parseBulkText(text, status = 'assigned') {
    const lines = text.split('\n').filter(line => line.trim());
    const parsed = [];

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const email = trimmedLine;

        const item = {
            lineNumber: index + 1,
            email: email,
            valid: false,
            duplicate: false,
            error: null
        };

        // Validate email
        if (!validateEmail(email)) {
            item.error = 'Invalid email format';
        } else {
            item.valid = true;
        }

        const existing = [...appState.activeContributors, ...appState.archivedContributors]
            .find(c => c.email.toLowerCase() === email.toLowerCase());

        if (existing) {
            if (status === 'passed' || status === 'failed') {
                if (existing.result && existing.result !== status) {
                    item.duplicate = true;
                    item.error = 'Email already has conflicting result';
                    item.valid = false;
                }
            } else {
                item.duplicate = true;
                item.error = 'Duplicate email';
                item.valid = false;
            }
        }

        parsed.push(item);
    });

    return parsed;
}

function previewBulkEntries() {
    console.log('Preview bulk entries called');
    const textArea = document.getElementById('bulkTextArea');
    const text = textArea.value.trim();

    if (!text) {
        showNotification('Please enter some contributors first', 'warning');
        return;
    }

    const statusSelect = document.getElementById('bulkStatusSelect');
    const selectedStatus = statusSelect ? statusSelect.value : 'assigned';
    const parsed = parseBulkText(text, selectedStatus);
    const previewEl = document.getElementById('bulkPreview');
    
    if (!previewEl) {
        console.error('Could not find bulkPreview element');
        return;
    }
    
    const validCount = parsed.filter(p => p.valid && !p.duplicate).length;
    const duplicateCount = parsed.filter(p => p.duplicate).length;
    const errorCount = parsed.filter(p => p.error && !p.duplicate).length;
    
    previewEl.innerHTML = `
        <h4>Preview (${parsed.length} entries)</h4>
        <div class="preview-stats">
            <span style="color: var(--color-success)">✓ ${validCount} valid</span>
            <span style="color: var(--color-warning)">⚠ ${duplicateCount} duplicates</span>
            <span style="color: var(--color-error)">✗ ${errorCount} errors</span>
        </div>
        <div class="preview-list">
            ${parsed.map(item => `
                <div class="preview-item ${item.valid && !item.duplicate ? 'valid' : item.duplicate ? 'duplicate' : 'invalid'}">
                    <span>${item.email}</span>
                    <span class="preview-status ${item.valid && !item.duplicate ? 'valid' : item.duplicate ? 'duplicate' : 'invalid'}">
                        ${item.valid && !item.duplicate ? 'Valid' : item.duplicate ? 'Duplicate' : 'Error'}
                    </span>
                </div>
            `).join('')}
        </div>
        ${errorCount > 0 ? `<p style="color: var(--color-error); font-size: var(--font-size-sm); margin-top: var(--space-12);">Fix errors before proceeding</p>` : ''}
    `;
    
    previewEl.classList.remove('hidden');
    previewEl.style.display = 'block';
    console.log('Preview displayed successfully');
}

async function processBulkEntries() {
    const textArea = document.getElementById('bulkTextArea');
    const text = textArea.value.trim();
    
    if (!text) {
        showNotification('Please enter some contributors first', 'warning');
        return;
    }
    
    const statusSelect = document.getElementById('bulkStatusSelect');
    const selectedStatus = statusSelect ? statusSelect.value : 'assigned';
    const parsed = parseBulkText(text, selectedStatus);
    const validEntries = parsed.filter(p => p.valid && !p.duplicate);
    
    if (validEntries.length === 0) {
        showNotification('No valid entries to process', 'warning');
        return;
    }
    
    // Show progress
    const progressEl = document.getElementById('processingProgress');
    const progressFill = document.getElementById('progressFill');
    progressEl.classList.remove('hidden');
    progressEl.style.display = 'block';
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < validEntries.length; i++) {
        const entry = validEntries[i];
        const progress = ((i + 1) / validEntries.length) * 100;
        progressFill.style.width = `${progress}%`;

        const result = addContributor(entry.email, selectedStatus);
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
            errors.push(`Line ${entry.lineNumber}: ${result.error}`);
        }
        
        // Add small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Hide progress and show results
    progressEl.classList.add('hidden');
    progressEl.style.display = 'none';
    showBulkResults(successCount, parsed.filter(p => p.duplicate).length, errorCount, errors);
    
    // Clear textarea on success
    if (successCount > 0) {
        textArea.value = '';
        document.getElementById('bulkPreview').classList.add('hidden');
        renderActiveContributors();
    }
}

// CSV upload functions
function handleCsvDrop(event) {
    event.preventDefault();
    const csvUploadArea = document.getElementById('csvUploadArea');
    csvUploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        handleCsvFile(files[0]);
    }
}

function handleCsvFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showNotification('Please select a CSV file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvText = e.target.result;
        parseCsvText(csvText);
    };
    reader.readAsText(file);
}

function parseCsvText(csvText, status = 'pending') {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showNotification('CSV file must have at least a header row and one data row', 'error');
        return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIndex = headers.findIndex(h => h.includes('email'));

    if (emailIndex === -1) {
        showNotification('CSV file must have an Email column', 'error');
        return;
    }

    const parsed = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const email = parts[emailIndex];
        if (!email) continue;

        const item = {
            lineNumber: i + 1,
            email: email,
            valid: false,
            duplicate: false,
            error: null
        };

        // Validate email
        if (!validateEmail(email)) {
            item.error = 'Invalid email format';
        } else {
            item.valid = true;
        }

        // Check for duplicates considering status
        const existing = [...appState.activeContributors, ...appState.archivedContributors]
            .find(c => c.email.toLowerCase() === email.toLowerCase());

        if (existing) {
            if (status === 'passed' || status === 'failed') {
                if (existing.result && existing.result !== status) {
                    item.duplicate = true;
                    item.error = 'Email already has conflicting result';
                    item.valid = false;
                }
            } else {
                item.duplicate = true;
                item.error = 'Duplicate email';
                item.valid = false;
            }
        }

        parsed.push(item);
    }

    showCsvPreview(parsed);
}

function showCsvPreview(parsed) {
    const previewEl = document.getElementById('csvPreview');
    const actionsEl = document.getElementById('csvActions');
    
    const validCount = parsed.filter(p => p.valid && !p.duplicate).length;
    const duplicateCount = parsed.filter(p => p.duplicate).length;
    const errorCount = parsed.filter(p => p.error && !p.duplicate).length;
    
    previewEl.innerHTML = `
        <h4>CSV Preview (${parsed.length} entries)</h4>
        <div class="preview-stats">
            <span style="color: var(--color-success)">✓ ${validCount} valid</span>
            <span style="color: var(--color-warning)">⚠ ${duplicateCount} duplicates</span>
            <span style="color: var(--color-error)">✗ ${errorCount} errors</span>
        </div>
        <div class="preview-list">
            ${parsed.slice(0, 10).map(item => `
                <div class="preview-item ${item.valid && !item.duplicate ? 'valid' : item.duplicate ? 'duplicate' : 'invalid'}">
                    <span>${item.email}</span>
                    <span class="preview-status ${item.valid && !item.duplicate ? 'valid' : item.duplicate ? 'duplicate' : 'invalid'}">
                        ${item.valid && !item.duplicate ? 'Valid' : item.duplicate ? 'Duplicate' : 'Error'}
                    </span>
                </div>
            `).join('')}
            ${parsed.length > 10 ? `<p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); text-align: center; margin-top: var(--space-8);">... and ${parsed.length - 10} more entries</p>` : ''}
        </div>
    `;
    
    previewEl.classList.remove('hidden');
    previewEl.style.display = 'block';
    actionsEl.classList.remove('hidden');
    actionsEl.style.display = 'flex';
    
    // Store parsed data for processing
    appState.csvParsedData = parsed;
}

async function processCsvEntries() {
    const parsed = appState.csvParsedData;
    if (!parsed) {
        showNotification('No CSV data to process', 'error');
        return;
    }
    
    const validEntries = parsed.filter(p => p.valid && !p.duplicate);
    
    if (validEntries.length === 0) {
        showNotification('No valid entries to process', 'warning');
        return;
    }
    
    // Show progress
    const progressEl = document.getElementById('processingProgress');
    const progressFill = document.getElementById('progressFill');
    progressEl.classList.remove('hidden');
    progressEl.style.display = 'block';
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < validEntries.length; i++) {
        const entry = validEntries[i];
        const progress = ((i + 1) / validEntries.length) * 100;
        progressFill.style.width = `${progress}%`;
        
        const result = addContributor(entry.email);
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
            errors.push(`Row ${entry.lineNumber}: ${result.error}`);
        }
        
        // Add small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Hide progress and show results
    progressEl.classList.add('hidden');
    progressEl.style.display = 'none';
    showBulkResults(successCount, parsed.filter(p => p.duplicate).length, errorCount, errors);
    
    // Clear CSV data on success
    if (successCount > 0) {
        clearCsvData();
        renderActiveContributors();
    }
}

function clearCsvData() {
    const previewEl = document.getElementById('csvPreview');
    const actionsEl = document.getElementById('csvActions');
    
    previewEl.classList.add('hidden');
    previewEl.style.display = 'none';
    actionsEl.classList.add('hidden');
    actionsEl.style.display = 'none';
    
    document.getElementById('csvFileInput').value = '';
    appState.csvParsedData = null;
}

function showBulkResults(successCount, duplicateCount, errorCount, errors) {
    const resultsEl = document.getElementById('bulkResults');
    
    document.getElementById('successCount').textContent = successCount;
    document.getElementById('duplicateCount').textContent = duplicateCount;
    document.getElementById('errorCount').textContent = errorCount;
    
    const errorDetailsEl = document.getElementById('errorDetails');
    const retryBtn = document.getElementById('retryErrorsBtn');
    
    if (errors.length > 0) {
        errorDetailsEl.innerHTML = `
            <h5>Error Details:</h5>
            ${errors.map(error => `<div class="error-item">${error}</div>`).join('')}
        `;
        errorDetailsEl.classList.remove('hidden');
        errorDetailsEl.style.display = 'block';
        retryBtn.classList.remove('hidden');
        appState.bulkErrors = errors;
    } else {
        errorDetailsEl.classList.add('hidden');
        errorDetailsEl.style.display = 'none';
        retryBtn.classList.add('hidden');
    }
    
    resultsEl.classList.remove('hidden');
    resultsEl.style.display = 'block';
    
    // Show success notification
    if (successCount > 0) {
        showNotification(`Successfully added ${successCount} contributor(s)!`);
    }
}

// Render functions
function renderActiveContributors(contributors = null) {
    const tbody = document.getElementById('contributorsTableBody');
    if (!tbody) {
        console.error('Could not find contributorsTableBody element');
        return;
    }
    
    const searchInput = document.getElementById('searchInput');
    const statusFilterInput = document.getElementById('statusFilter');

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statusFilter = statusFilterInput ? statusFilterInput.value : '';
    
    let filteredContributors = contributors || appState.activeContributors;
    
    // Apply filters
    if (searchTerm) {
        filteredContributors = filteredContributors.filter(c =>
            c.email.toLowerCase().includes(searchTerm)
        );
    }
    
    if (statusFilter) {
        filteredContributors = filteredContributors.filter(c => {
            if (statusFilter === 'passed' || statusFilter === 'failed') {
                return c.result === statusFilter;
            }
            return c.status === statusFilter;
        });
    }
    
    if (filteredContributors.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <h3>No contributors found</h3>
                    <p>Try adjusting your search criteria or add new contributors.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredContributors.map(contributor => `
        <tr>
            <td><input type="checkbox" class="contributor-checkbox" data-id="${contributor.id}"></td>
            <td>${contributor.email}</td>
            <td>
                <select class="assignment-select" data-id="${contributor.id}">
                    <option value="pending" ${contributor.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="assigned" ${contributor.status === 'assigned' ? 'selected' : ''}>Assigned</option>
                </select>
            </td>
            <td>
                <select class="result-select" data-id="${contributor.id}">
                    <option value="" ${!contributor.result ? 'selected' : ''}>-</option>
                    <option value="passed" ${contributor.result === 'passed' ? 'selected' : ''}>Passed</option>
                    <option value="failed" ${contributor.result === 'failed' ? 'selected' : ''}>Failed</option>
                </select>
            </td>
            <td>${formatDate(contributor.dateAdded)}</td>
            <td>${formatDate(contributor.dateAssigned)}</td>
            <td>${formatDate(contributor.dateCompleted)}</td>
            <td>
                <button class="action-btn action-btn--primary" onclick="archiveContributor('${contributor.id}'); renderActiveContributors();">Archive</button>
                <button class="action-btn action-btn--danger" onclick="confirmRemove('${contributor.id}')">Remove</button>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners for status changes
    document.querySelectorAll('.assignment-select').forEach(select => {
        select.addEventListener('change', (e) => {
            updateContributorStatus(e.target.dataset.id, 'assignment', e.target.value);
            renderActiveContributors();
        });
    });
    document.querySelectorAll('.result-select').forEach(select => {
        select.addEventListener('change', (e) => {
            updateContributorStatus(e.target.dataset.id, 'result', e.target.value);
            renderActiveContributors();
        });
    });
}

function renderDailyView() {
    const selectedDate = document.getElementById('dailyDatePicker').value;
    if (!selectedDate) return;
    
    // Filter contributors by selected date
    const dailyContributors = appState.activeContributors.filter(c => 
        c.dateAdded === selectedDate || 
        c.dateAssigned === selectedDate || 
        c.dateCompleted === selectedDate
    );
    
    // Calculate daily stats
    const stats = {
        totalAdded: appState.activeContributors.filter(c => c.dateAdded === selectedDate).length,
        assigned: appState.activeContributors.filter(c => c.dateAssigned === selectedDate).length,
        passed: appState.activeContributors.filter(c => c.dateCompleted === selectedDate && c.result === 'passed').length,
        failed: appState.activeContributors.filter(c => c.dateCompleted === selectedDate && c.result === 'failed').length
    };
    
    // Update stat cards
    const dailyTotalEl = document.getElementById('dailyTotalAdded');
    const dailyAssignedEl = document.getElementById('dailyAssigned');
    const dailyPassedEl = document.getElementById('dailyPassed');
    const dailyFailedEl = document.getElementById('dailyFailed');
    
    if (dailyTotalEl) dailyTotalEl.textContent = stats.totalAdded;
    if (dailyAssignedEl) dailyAssignedEl.textContent = stats.assigned;
    if (dailyPassedEl) dailyPassedEl.textContent = stats.passed;
    if (dailyFailedEl) dailyFailedEl.textContent = stats.failed;
    
    // Render daily table
    const tbody = document.getElementById('dailyTableBody');
    if (!tbody) return;
    
    if (dailyContributors.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <h3>No activity on ${formatDate(selectedDate)}</h3>
                    <p>No contributors were added, assigned, or completed on this date.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = dailyContributors.map(contributor => `
        <tr>
            <td>${contributor.email}</td>
            <td><span class="status-badge status-badge--${contributor.status}">${contributor.status}</span></td>
            <td><span class="status-badge status-badge--${contributor.result || 'pending'}">${contributor.result || '-'}</span></td>
            <td>${formatDate(contributor.dateAdded)}</td>
            <td>${formatDate(contributor.dateAssigned)}</td>
            <td>${formatDate(contributor.dateCompleted)}</td>
            <td>
                <button class="action-btn action-btn--primary" onclick="archiveContributor('${contributor.id}'); renderDailyView();">Archive</button>
            </td>
        </tr>
    `).join('');
}

function renderArchive() {
    const tbody = document.getElementById('archiveTableBody');
    if (!tbody) return;
    
    const searchInput = document.getElementById('archiveSearchInput');
    const statusFilterInput = document.getElementById('archiveStatusFilter');
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statusFilter = statusFilterInput ? statusFilterInput.value : '';
    
    let filteredContributors = appState.archivedContributors;
    
    // Apply filters
    if (searchTerm) {
        filteredContributors = filteredContributors.filter(c =>
            c.email.toLowerCase().includes(searchTerm)
        );
    }
    
    if (statusFilter) {
        filteredContributors = filteredContributors.filter(c => c.result === statusFilter);
    }
    
    if (filteredContributors.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <h3>No archived contributors found</h3>
                    <p>Archived contributors will appear here when moved from the active list.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredContributors.map(contributor => `
        <tr>
            <td>${contributor.email}</td>
            <td><span class="status-badge status-badge--${contributor.result || 'pending'}">${contributor.result || '-'}</span></td>
            <td>${formatDate(contributor.dateAdded)}</td>
            <td>${formatDate(contributor.dateCompleted)}</td>
            <td>${formatDate(contributor.dateArchived)}</td>
            <td>
                <button class="action-btn action-btn--primary" onclick="restoreContributor('${contributor.id}'); renderArchive(); renderActiveContributors();">Restore</button>
                <button class="action-btn action-btn--danger" onclick="confirmRemove('${contributor.id}')">Remove</button>
            </td>
        </tr>
    `).join('');
}

function renderCharts() {
    // Daily Additions Chart
    const dailyAdditionsCtx = document.getElementById('dailyAdditionsChart');
    if (!dailyAdditionsCtx) return;
    
    if (appState.charts.dailyAdditions) {
        appState.charts.dailyAdditions.destroy();
    }
    
    const dailyData = getDailyAdditionsData();
    appState.charts.dailyAdditions = new Chart(dailyAdditionsCtx, {
        type: 'line',
        data: {
            labels: dailyData.labels,
            datasets: [{
                label: 'Contributors Added',
                data: dailyData.data,
                borderColor: '#1FB8CD',
                backgroundColor: 'rgba(31, 184, 205, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // Pass/Fail Rates Chart
    const passFailCtx = document.getElementById('passFailChart');
    if (!passFailCtx) return;
    
    if (appState.charts.passFail) {
        appState.charts.passFail.destroy();
    }
    
    const passFailData = getPassFailData();
    appState.charts.passFail = new Chart(passFailCtx, {
        type: 'line',
        data: {
            labels: passFailData.labels,
            datasets: [
                {
                    label: 'Passed',
                    data: passFailData.passed,
                    borderColor: '#B4413C',
                    backgroundColor: 'rgba(180, 65, 60, 0.1)'
                },
                {
                    label: 'Failed',
                    data: passFailData.failed,
                    borderColor: '#FFC185',
                    backgroundColor: 'rgba(255, 193, 133, 0.1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // Status Distribution Chart
    const statusDistCtx = document.getElementById('statusDistributionChart');
    if (!statusDistCtx) return;
    
    if (appState.charts.statusDistribution) {
        appState.charts.statusDistribution.destroy();
    }
    
    const statusData = getStatusDistribution();
    appState.charts.statusDistribution = new Chart(statusDistCtx, {
        type: 'doughnut',
        data: {
            labels: ['Pending', 'Assigned', 'Passed', 'Failed'],
            datasets: [{
                data: [statusData.pending, statusData.assigned, statusData.passed, statusData.failed],
                backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Weekly Summary Chart
    const weeklySummaryCtx = document.getElementById('weeklySummaryChart');
    if (!weeklySummaryCtx) return;
    
    if (appState.charts.weeklySummary) {
        appState.charts.weeklySummary.destroy();
    }
    
    const weeklyData = getWeeklySummaryData();
    appState.charts.weeklySummary = new Chart(weeklySummaryCtx, {
        type: 'bar',
        data: {
            labels: weeklyData.labels,
            datasets: [
                {
                    label: 'Added',
                    data: weeklyData.added,
                    backgroundColor: '#5D878F'
                },
                {
                    label: 'Completed',
                    data: weeklyData.completed,
                    backgroundColor: '#DB4545'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Chart data functions
function getDailyAdditionsData() {
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }
    
    const data = last7Days.map(date => {
        return appState.activeContributors.filter(c => c.dateAdded === date).length +
               appState.archivedContributors.filter(c => c.dateAdded === date).length;
    });
    
    return {
        labels: last7Days.map(date => new Date(date).toLocaleDateString()),
        data: data
    };
}

function getPassFailData() {
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }
    
    const passed = last7Days.map(date => {
        return appState.activeContributors.filter(c => c.dateCompleted === date && c.result === 'passed').length +
               appState.archivedContributors.filter(c => c.dateCompleted === date && c.result === 'passed').length;
    });

    const failed = last7Days.map(date => {
        return appState.activeContributors.filter(c => c.dateCompleted === date && c.result === 'failed').length +
               appState.archivedContributors.filter(c => c.dateCompleted === date && c.result === 'failed').length;
    });
    
    return {
        labels: last7Days.map(date => new Date(date).toLocaleDateString()),
        passed: passed,
        failed: failed
    };
}

function getStatusDistribution() {
    const all = [...appState.activeContributors, ...appState.archivedContributors];
    return {
        pending: all.filter(c => c.status === 'pending').length,
        assigned: all.filter(c => c.status === 'assigned' && !c.result).length,
        passed: all.filter(c => c.result === 'passed').length,
        failed: all.filter(c => c.result === 'failed').length
    };
}

function getWeeklySummaryData() {
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    const added = [5, 8, 6, 4];
    const completed = [3, 6, 5, 3];
    
    return {
        labels: weeks,
        added: added,
        completed: completed
    };
}

// CSV Export function
function exportToCSV() {
    const data = [...appState.activeContributors, ...appState.archivedContributors];
    const headers = ['Email', 'Assignment Status', 'Result', 'Date Added', 'Date Assigned', 'Date Completed', 'Date Archived'];
    
    const csvContent = [
        headers.join(','),
        ...data.map(row => [
            row.email,
            row.status,
            row.result || '',
            row.dateAdded || '',
            row.dateAssigned || '',
            row.dateCompleted || '',
            row.dateArchived || ''
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contributors_${getCurrentDate()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('CSV exported successfully!');
}

// Event handlers
function confirmRemove(contributorId) {
    showConfirmDialog(
        'Remove Contributor',
        'Are you sure you want to permanently remove this contributor? This action cannot be undone.',
        () => {
            removeContributor(contributorId);
            renderActiveContributors();
            renderArchive();
        }
    );
}

function bulkArchive() {
    const checkboxes = document.querySelectorAll('.contributor-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    
    if (selectedIds.length === 0) {
        showNotification('Please select contributors to archive', 'warning');
        return;
    }
    
    showConfirmDialog(
        'Archive Selected Contributors',
        `Are you sure you want to archive ${selectedIds.length} selected contributor(s)?`,
        () => {
            selectedIds.forEach(id => archiveContributor(id));
            renderActiveContributors();
            const selectAllEl = document.getElementById('selectAll');
            if (selectAllEl) selectAllEl.checked = false;
        }
    );
}

// Initialize application
function initApp() {
    console.log('Initializing application...');

    // Load project metadata and handle shared projects
    loadProjectsMeta();

    let shared = null;
    if (window.location.hash.startsWith('#shared=')) {
        shared = window.location.hash.slice(8);
    } else {
        const params = new URLSearchParams(window.location.search);
        shared = params.get('shared');
    }
    if (shared) {
        try {
            const data = decodeProjectData(shared);
            let name = (data.name || 'Shared Project').trim();
            const existing = appState.projectList.find(
                p => p.trim().toLowerCase() === name.toLowerCase()
            );
            if (existing) {
                // Project already exists; switch to it instead of creating a copy
                appState.currentProject = existing;
            } else {
                appState.projectList.push(name);
                appState.currentProject = name;
            }
            appState.activeContributors = data.activeContributors || [];
            appState.archivedContributors = data.archivedContributors || [];
            saveState();
            saveProjectsMeta();
            history.replaceState(null, '', window.location.pathname);
            window.location.hash = '';
        } catch (err) {
            console.error('Failed to load shared project', err);
            showNotification('Invalid shared project link', 'error');
            loadState();
        }
    } else {
        loadState();
    }

    renderProjectOptions();

    // Set initial date for daily view
    const dailyDatePicker = document.getElementById('dailyDatePicker');
    if (dailyDatePicker) {
        dailyDatePicker.value = getCurrentDate();
    }
    
    // Set initial date range for statistics
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const statsStartDate = document.getElementById('statsStartDate');
    const statsEndDate = document.getElementById('statsEndDate');
    
    if (statsStartDate) statsStartDate.value = weekAgo.toISOString().split('T')[0];
    if (statsEndDate) statsEndDate.value = today.toISOString().split('T')[0];
    
    // Entry mode switching
    document.querySelectorAll('.entry-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const mode = btn.dataset.mode;
            console.log('Entry tab clicked:', mode);
            switchEntryMode(mode);
        });
    });
    
    // Single entry mode
    const addContributorBtn = document.getElementById('addContributorBtn');
    if (addContributorBtn) {
        addContributorBtn.addEventListener('click', () => {
            const email = document.getElementById('contributorEmail').value.trim();

            if (!email) {
                showNotification('Please enter an email', 'error');
                return;
            }

            const result = addContributor(email);
            if (result.success) {
                document.getElementById('contributorEmail').value = '';
                renderActiveContributors();
                showNotification('Contributor added successfully!');
            } else {
                showNotification(result.error, 'error');
            }
        });
    }
    
    // Bulk entry mode
    const previewBulkBtn = document.getElementById('previewBulkBtn');
    const processBulkBtn = document.getElementById('processBulkBtn');
    
    if (previewBulkBtn) {
        previewBulkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            previewBulkEntries();
        });
    }
    
    if (processBulkBtn) {
        processBulkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            processBulkEntries();
        });
    }
    
    // CSV upload mode
    const csvUploadArea = document.getElementById('csvUploadArea');
    const csvFileInput = document.getElementById('csvFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const clearCsvBtn = document.getElementById('clearCsvBtn');
    const processCsvBtn = document.getElementById('processCsvBtn');
    
    if (csvUploadArea) {
        csvUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            csvUploadArea.classList.add('dragover');
        });
        
        csvUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            csvUploadArea.classList.remove('dragover');
        });
        
        csvUploadArea.addEventListener('drop', handleCsvDrop);
        
        csvUploadArea.addEventListener('click', () => {
            if (csvFileInput) csvFileInput.click();
        });
    }
    
    if (selectFileBtn) {
        selectFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (csvFileInput) csvFileInput.click();
        });
    }
    
    if (csvFileInput) {
        csvFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleCsvFile(e.target.files[0]);
            }
        });
    }
    
    if (clearCsvBtn) {
        clearCsvBtn.addEventListener('click', clearCsvData);
    }
    
    if (processCsvBtn) {
        processCsvBtn.addEventListener('click', processCsvEntries);
    }
    
    // Results handling
    const dismissResultsBtn = document.getElementById('dismissResultsBtn');
    if (dismissResultsBtn) {
        dismissResultsBtn.addEventListener('click', () => {
            const bulkResults = document.getElementById('bulkResults');
            if (bulkResults) {
                bulkResults.classList.add('hidden');
                bulkResults.style.display = 'none';
            }
        });
    }
    
    // Main tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = btn.dataset.tab;
            console.log('Main tab clicked:', tab);
            switchMainTab(tab);
        });
    });
    
    // Search and filter event listeners
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const archiveSearchInput = document.getElementById('archiveSearchInput');
    const archiveStatusFilter = document.getElementById('archiveStatusFilter');
    const dailyDatePickerListener = document.getElementById('dailyDatePicker');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => renderActiveContributors());
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', () => renderActiveContributors());
    }
    if (archiveSearchInput) {
        archiveSearchInput.addEventListener('input', () => renderArchive());
    }
    if (archiveStatusFilter) {
        archiveStatusFilter.addEventListener('change', () => renderArchive());
    }
    if (dailyDatePickerListener) {
        dailyDatePickerListener.addEventListener('change', () => renderDailyView());
    }
    
    // Bulk actions
    const bulkArchiveBtn = document.getElementById('bulkArchiveBtn');
    const selectAll = document.getElementById('selectAll');
    
    if (bulkArchiveBtn) {
        bulkArchiveBtn.addEventListener('click', bulkArchive);
    }
    
    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            document.querySelectorAll('.contributor-checkbox').forEach(cb => {
                cb.checked = e.target.checked;
            });
        });
    }
    
    // Other actions
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const updateStatsBtn = document.getElementById('updateStatsBtn');
    
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
    if (updateStatsBtn) {
        updateStatsBtn.addEventListener('click', renderCharts);
    }

    // Project controls
    const projectSelect = document.getElementById('projectSelect');
    const addProjectBtn = document.getElementById('addProjectBtn');
    const shareProjectBtn = document.getElementById('shareProjectBtn');
    const deleteProjectBtn = document.getElementById('deleteProjectBtn');

    if (projectSelect) {
        projectSelect.addEventListener('change', (e) => {
            saveState();
            appState.currentProject = e.target.value;
            loadState();
            saveProjectsMeta();
            renderActiveContributors();
            renderArchive();
            renderCharts();
        });
    }

    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', () => {
            const name = prompt('Enter new project name:');
            if (!name) return;
            if (!appState.projectList.includes(name)) {
                appState.projectList.push(name);
            }
            appState.currentProject = name;
            appState.activeContributors = [];
            appState.archivedContributors = [];
            saveState();
            renderProjectOptions();
            renderActiveContributors();
            renderArchive();
            renderCharts();
        });
    }

    if (shareProjectBtn) {
        shareProjectBtn.addEventListener('click', shareProject);
    }

    if (deleteProjectBtn) {
        deleteProjectBtn.addEventListener('click', deleteProject);
    }
    
    // Modal event listeners
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const confirmModal = document.getElementById('confirmModal');
            if (confirmModal) {
                confirmModal.classList.add('hidden');
            }
        });
    }
    
    // Initial render and setup
    console.log('Setting up initial state...');
    
    // Ensure active tab is shown
    switchMainTab('active');
    
    // Set default entry mode to bulk and ensure it's visible
    setTimeout(() => {
        switchEntryMode('bulk');
        renderActiveContributors();
        renderArchive();
        renderCharts();
        console.log('Application initialized successfully');
    }, 100);
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);