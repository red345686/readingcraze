// Initialize UI with saved settings
document.addEventListener('DOMContentLoaded', () => {
    // Load settings from storage
    chrome.storage.sync.get([
        'font', 
        'fontSize', 
        'fontColor', 
        'bgColor', 
        'lineHeight', 
        'paragraphSpacing', 
        'sideMargin', 
        'readingMode',
        'autoScroll',
        'autoScrollSpeed'
    ], (settings) => {
        // Set initial values in form
        document.getElementById('font').value = settings.font || 'Georgia, serif';
        document.getElementById('fontSize').value = settings.fontSize || 18;
        document.getElementById('fontSizeValue').textContent = (settings.fontSize || 18) + 'px';
        document.getElementById('fontColor').value = settings.fontColor || '#333333';
        document.getElementById('bgColor').value = settings.bgColor || '#F8F3E9';
        document.getElementById('lineHeight').value = settings.lineHeight || 1.8;
        document.getElementById('lineHeightValue').textContent = settings.lineHeight || 1.8;
        document.getElementById('paragraphSpacing').value = settings.paragraphSpacing || 1.5;
        document.getElementById('paragraphSpacingValue').textContent = settings.paragraphSpacing || 1.5;
        document.getElementById('sideMargin').value = settings.sideMargin || 20;
        document.getElementById('sideMarginValue').textContent = (settings.sideMargin || 20) + 'px';
        document.getElementById('readingMode').value = settings.readingMode || 'light';
        document.getElementById('autoScroll').checked = settings.autoScroll || false;
        document.getElementById('autoScrollSpeed').value = settings.autoScrollSpeed || 2;
        document.getElementById('autoScrollSpeedValue').textContent = settings.autoScrollSpeed || 2;
        
        // Enable/disable auto scroll speed based on checkbox
        document.getElementById('autoScrollSpeed').disabled = !settings.autoScroll;
    });

    // Set up range input value displays
    document.getElementById('fontSize').addEventListener('input', (e) => {
        document.getElementById('fontSizeValue').textContent = e.target.value + 'px';
    });
    
    document.getElementById('lineHeight').addEventListener('input', (e) => {
        document.getElementById('lineHeightValue').textContent = e.target.value;
    });
    
    document.getElementById('paragraphSpacing').addEventListener('input', (e) => {
        document.getElementById('paragraphSpacingValue').textContent = e.target.value;
    });
    
    document.getElementById('sideMargin').addEventListener('input', (e) => {
        document.getElementById('sideMarginValue').textContent = e.target.value + 'px';
    });
    
    document.getElementById('autoScrollSpeed').addEventListener('input', (e) => {
        document.getElementById('autoScrollSpeedValue').textContent = e.target.value;
    });
    
    // Toggle auto scroll speed input
    document.getElementById('autoScroll').addEventListener('change', (e) => {
        document.getElementById('autoScrollSpeed').disabled = !e.target.checked;
    });
    
    // Save settings
    document.getElementById('save').addEventListener('click', saveSettings);
    
    // Reset to defaults
    document.getElementById('reset').addEventListener('click', resetToDefaults);
    
    // Reset reading progress
    document.getElementById('resetProgress').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all reading progress?')) {
            chrome.storage.sync.remove('readingProgress', () => {
                alert('Reading progress has been reset.');
            });
        }
    });
});

// Save all settings to storage
function saveSettings() {
    const settings = {
        font: document.getElementById('font').value,
        fontSize: parseInt(document.getElementById('fontSize').value),
        fontColor: document.getElementById('fontColor').value,
        bgColor: document.getElementById('bgColor').value,
        lineHeight: parseFloat(document.getElementById('lineHeight').value),
        paragraphSpacing: parseFloat(document.getElementById('paragraphSpacing').value),
        sideMargin: parseInt(document.getElementById('sideMargin').value),
        readingMode: document.getElementById('readingMode').value,
        autoScroll: document.getElementById('autoScroll').checked,
        autoScrollSpeed: parseInt(document.getElementById('autoScrollSpeed').value)
    };

    chrome.storage.sync.set(settings, () => {
        // Get active tab and apply changes immediately
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'applySettings', settings});
            }
        });
        
        // Show success message
        const saveBtn = document.getElementById('save');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        saveBtn.disabled = true;
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }, 1500);
    });
}

// Reset to default settings
function resetToDefaults() {
    if (confirm('Reset all settings to default?')) {
        const defaultSettings = {
            font: 'Georgia, serif',
            fontSize: 18,
            fontColor: '#333333',
            bgColor: '#F8F3E9',
            lineHeight: 1.8,
            paragraphSpacing: 1.5,
            sideMargin: 20,
            readingMode: 'light',
            autoScroll: false,
            autoScrollSpeed: 2
        };
        
        // Update UI
        document.getElementById('font').value = defaultSettings.font;
        document.getElementById('fontSize').value = defaultSettings.fontSize;
        document.getElementById('fontSizeValue').textContent = defaultSettings.fontSize + 'px';
        document.getElementById('fontColor').value = defaultSettings.fontColor;
        document.getElementById('bgColor').value = defaultSettings.bgColor;
        document.getElementById('lineHeight').value = defaultSettings.lineHeight;
        document.getElementById('lineHeightValue').textContent = defaultSettings.lineHeight;
        document.getElementById('paragraphSpacing').value = defaultSettings.paragraphSpacing;
        document.getElementById('paragraphSpacingValue').textContent = defaultSettings.paragraphSpacing;
        document.getElementById('sideMargin').value = defaultSettings.sideMargin;
        document.getElementById('sideMarginValue').textContent = defaultSettings.sideMargin + 'px';
        document.getElementById('readingMode').value = defaultSettings.readingMode;
        document.getElementById('autoScroll').checked = defaultSettings.autoScroll;
        document.getElementById('autoScrollSpeed').value = defaultSettings.autoScrollSpeed;
        document.getElementById('autoScrollSpeedValue').textContent = defaultSettings.autoScrollSpeed;
        document.getElementById('autoScrollSpeed').disabled = !defaultSettings.autoScroll;
        
        // Save to storage
        chrome.storage.sync.set(defaultSettings);
    }
}
