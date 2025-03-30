// Dictionary lookup feature for Reading Craze
let dictionaryEnabled = false;
let dictionaryTheme = 'light';
let tooltip = null;
let currentWord = null;
let lookupTimeout = null;
let apiKey = null;

// Initialize dictionary functionality
function initDictionary() {
    // First check if dictionary is enabled
    chrome.storage.sync.get(['dictionaryEnabled', 'dictionaryApiKey', 'dictionaryTheme'], (result) => {
        dictionaryEnabled = result.dictionaryEnabled || false;
        apiKey = result.dictionaryApiKey || '';
        dictionaryTheme = result.dictionaryTheme || 'light';
        
        if (dictionaryEnabled) {
            // Create tooltip element if it doesn't exist
            createTooltip();
            
            // Add text selection and hover listeners
            setupWordListeners();
        }
    });
    
    // Listen for settings changes
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateDictionary') {
            dictionaryEnabled = request.enabled;
            apiKey = request.apiKey || '';
            
            // Update theme if provided
            if (request.theme) {
                dictionaryTheme = request.theme;
                // Update tooltip theme if it exists
                if (tooltip) {
                    applyTooltipTheme();
                }
            }
            
            if (dictionaryEnabled) {
                createTooltip();
                setupWordListeners();
            } else {
                removeListeners();
                if (tooltip) {
                    tooltip.remove();
                    tooltip = null;
                }
            }
        }
    });
}

// Create tooltip element for showing definitions
function createTooltip() {
    if (tooltip) return;
    
    tooltip = document.createElement('div');
    tooltip.className = 'reading-craze-tooltip';
    
    // Apply the appropriate theme
    applyTooltipTheme();
    
    document.body.appendChild(tooltip);
}

// Apply the appropriate theme to the tooltip
function applyTooltipTheme() {
    if (!tooltip) return;
    
    let backgroundColor, textColor, borderColor, shadowColor;
    
    if (dictionaryTheme === 'dark') {
        // Dark theme
        backgroundColor = 'rgba(40, 40, 40, 0.95)';
        textColor = '#e0e0e0';
        borderColor = '#444';
        shadowColor = 'rgba(0, 0, 0, 0.3)';
    } else {
        // Light theme (default)
        backgroundColor = 'rgba(255, 255, 255, 0.95)';
        textColor = '#333';
        borderColor = '#ddd';
        shadowColor = 'rgba(0, 0, 0, 0.1)';
    }
    
    tooltip.style.cssText = `
        display: none;
        position: absolute;
        z-index: 10000;
        background-color: ${backgroundColor};
        border-radius: 6px;
        box-shadow: 0 2px 10px ${shadowColor};
        padding: 12px;
        max-width: 300px;
        font-size: 14px;
        line-height: 1.4;
        color: ${textColor};
        transition: opacity 0.2s;
        border: 1px solid ${borderColor};
    `;
}

// Set up event listeners for word hover and selection
function setupWordListeners() {
    document.addEventListener('mouseover', handleWordHover);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', hideTooltip);
}

// Remove event listeners when feature is disabled
function removeListeners() {
    document.removeEventListener('mouseover', handleWordHover);
    document.removeEventListener('mouseout', handleMouseOut);
    document.removeEventListener('click', hideTooltip);
}

// Handle mouse hover over text
function handleWordHover(event) {
    if (!dictionaryEnabled || !tooltip) return;
    
    // Skip if hovering over the tooltip itself
    if (event.target === tooltip || tooltip.contains(event.target)) return;
    
    // Only process text nodes or elements with simple text
    if (!shouldProcessElement(event.target)) return;
    
    // Get the word under the cursor
    const word = getWordUnderCursor(event);
    
    if (word && word !== currentWord && isRealWord(word)) {
        currentWord = word;
        
        // Clear any existing timeout
        clearTimeout(lookupTimeout);
        
        // Set a small delay to avoid lookups while quickly moving mouse
        lookupTimeout = setTimeout(() => {
            // Position tooltip at cursor
            positionTooltip(event.clientX, event.clientY);
            // Show loading state
            tooltip.textContent = `Looking up "${word}"...`;
            tooltip.style.display = 'block';
            
            // Lookup the word
            lookupWord(word);
        }, 500); // 500ms delay before lookup
    }
}

// Handle mouse leaving text
function handleMouseOut() {
    clearTimeout(lookupTimeout);
}

// Hide the tooltip
function hideTooltip() {
    if (tooltip) {
        tooltip.style.display = 'none';
        currentWord = null;
    }
}

// Position the tooltip near the mouse cursor
function positionTooltip(x, y) {
    if (!tooltip) return;
    
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const tooltipWidth = 300; // Max width of tooltip
    
    // Position the tooltip, keeping it within the viewport
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Default position (below and to the right of cursor)
    let posX = x + scrollX + 10;
    let posY = y + scrollY + 20;
    
    // Check if tooltip would go off the right edge
    if (posX + tooltipWidth > windowWidth + scrollX) {
        posX = windowWidth + scrollX - tooltipWidth - 10;
    }
    
    // Check if tooltip would go off the bottom edge
    if (posY + 150 > windowHeight + scrollY) {
        posY = y + scrollY - 160; // Position above cursor
    }
    
    tooltip.style.left = posX + 'px';
    tooltip.style.top = posY + 'px';
}

// Get the word under the cursor
function getWordUnderCursor(event) {
    const range = document.caretRangeFromPoint(event.clientX, event.clientY);
    if (!range) return null;
    
    // Expand to word boundaries
    range.expand('word');
    
    // Get the selected text
    const selectedText = range.toString().trim();
    
    // Make sure it's a single word
    return selectedText.split(/\s+/)[0];
}

// Check if a string is a real word (basic check)
function isRealWord(word) {
    // Exclude empty strings, very short strings, and strings with special characters
    return word && 
           word.length > 2 && 
           word.length < 30 && 
           /^[A-Za-z]+$/.test(word);
}

// Check if an element should be processed for word lookup
function shouldProcessElement(element) {
    // Skip elements that aren't likely to contain normal text
    const nonTextTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'];
    if (nonTextTags.includes(element.tagName)) return false;
    
    // Skip our own tooltip
    if (element.classList?.contains('reading-craze-tooltip')) return false;
    
    return true;
}

// Lookup a word in the dictionary API
function lookupWord(word) {
    // Free Dictionary API
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Word not found');
            }
            return response.json();
        })
        .then(data => {
            displayDefinition(word, data);
        })
        .catch(error => {
            if (error.message === 'Word not found') {
                tooltip.textContent = `No definition found for "${word}"`;
            } else {
                tooltip.textContent = `Error looking up "${word}": ${error.message}`;
            }
        });
}

// Display the definition in the tooltip
function displayDefinition(word, data) {
    if (!tooltip || !data || data.length === 0) {
        tooltip.textContent = `No definition found for "${word}"`;
        return;
    }
    
    // Clear tooltip
    tooltip.innerHTML = '';
    
    // Get colors based on current theme
    const headingColor = dictionaryTheme === 'dark' ? '#fff' : '#000';
    const secondaryColor = dictionaryTheme === 'dark' ? '#aaa' : '#666';
    
    // Word heading
    const wordHeading = document.createElement('div');
    wordHeading.textContent = word;
    wordHeading.style.cssText = `font-weight: bold; font-size: 16px; margin-bottom: 6px; color: ${headingColor};`;
    tooltip.appendChild(wordHeading);
    
    // Get the first entry
    const entry = data[0];
    
    // Show only first 2 meanings for brevity
    const meaningsToShow = entry.meanings.slice(0, 2);
    
    meaningsToShow.forEach(meaning => {
        // Part of speech
        const partOfSpeech = document.createElement('div');
        partOfSpeech.textContent = meaning.partOfSpeech;
        partOfSpeech.style.cssText = `font-style: italic; color: ${secondaryColor}; margin-top: 8px;`;
        tooltip.appendChild(partOfSpeech);
        
        // Definitions (first 2)
        const definitionsToShow = meaning.definitions.slice(0, 2);
        const definitionList = document.createElement('ul');
        definitionList.style.cssText = 'margin: 4px 0 0 0; padding-left: 20px;';
        
        definitionsToShow.forEach(def => {
            const definitionItem = document.createElement('li');
            definitionItem.textContent = def.definition;
            definitionList.appendChild(definitionItem);
            
            // Add example if available
            if (def.example) {
                const exampleItem = document.createElement('div');
                exampleItem.textContent = `"${def.example}"`;
                exampleItem.style.cssText = `font-style: italic; font-size: 13px; color: ${secondaryColor}; margin-top: 4px;`;
                definitionItem.appendChild(exampleItem);
            }
        });
        
        tooltip.appendChild(definitionList);
    });
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDictionary);
} else {
    initDictionary();
} 