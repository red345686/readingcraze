// Global variables
let settings = {};
let autoScrollInterval = null;
let currentScrollSpeed = 2;
let progressBar = null;
let contentContainer = null;
let styleObserver = null;

// Initialize extension
function init() {
    // Load stored settings
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
        'autoScrollSpeed',
        'readingProgress'
    ], (result) => {
        settings = result;
        
        // Create content wrapper if not already on page
        createReadingEnvironment();
        
        // Apply initial styles based on settings
        applyStyles();
        
        // Create reading progress bar
        createProgressBar();
                
        // Restore reading position if available
        restoreReadingPosition();
                
        // Setup auto-scroll if enabled
        if (settings.autoScroll) {
            setupAutoScroll(settings.autoScrollSpeed);
        }
        
        // Set up observer for dynamic content
        setupStyleObserver();
    });
    
    // Save reading progress periodically
    window.addEventListener('scroll', debounce(saveReadingProgress, 1000));
}

// Setup observer to watch for DOM changes and apply styles to new content
function setupStyleObserver() {
    // Disconnect existing observer if any
    if (styleObserver) {
        styleObserver.disconnect();
    }
    
    // Create a new observer to watch for added nodes
    styleObserver = new MutationObserver((mutations) => {
        let shouldReapplyStyles = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any text nodes or elements with text were added
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        shouldReapplyStyles = true;
                    }
                });
            }
        });
        
        if (shouldReapplyStyles) {
            // Apply direct styles to newly added elements
            applyDirectTextStyles();
        }
    });
    
    // Start observing the document with the configured parameters
    styleObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
}

// After applying styles, directly modify elements for more stubborn sites
function applyDirectTextStyles() {
    // Skip if no contentContainer
    if (!contentContainer) return;
    
    // Get all text elements
    const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, a, blockquote, cite, em, strong, b, i, label, button, input[type="text"], textarea');
    
    // Apply color to each element
    textElements.forEach(el => {
        // Skip our own progress bar and controls
        if (el.closest('.reading-progress-container')) return;
        
        // Apply font family
        el.style.setProperty('font-family', settings.font || 'Georgia, serif', 'important');
        
        // Apply line height
        el.style.setProperty('line-height', settings.lineHeight || 1.8, 'important');
        
        // Apply color based on mode
        let color = settings.fontColor || '#333333';
        if (settings.readingMode === 'dark') {
            color = (el.tagName.toLowerCase() === 'a') ? '#90caf9' : '#e0e0e0';
        } else if (settings.readingMode === 'sepia') {
            color = '#5B4636';
        }
        
        el.style.setProperty('color', color, 'important');
    });
}

// Create wrapper for content for better styling control
function createReadingEnvironment() {
    // Check if we're already wrapped
    if (document.querySelector('.reading-craze-wrapper')) {
        return;
    }
    
    // Create wrapper and move content into it
    contentContainer = document.createElement('div');
    contentContainer.className = 'reading-craze-wrapper';
    
    // Move body content to the wrapper
    const children = Array.from(document.body.children);
    children.forEach(child => {
        // Skip script tags and extension elements
        if (child.tagName !== 'SCRIPT' && 
            !child.classList.contains('reading-progress-container')) {
            contentContainer.appendChild(child);
        }
    });
    
    // Add wrapper to the body
    document.body.appendChild(contentContainer);
}

// Apply styles based on settings
function applyStyles() {
    if (!contentContainer) return;
    
    // Add a style element to modify all text on the page
    const styleEl = document.createElement('style');
    styleEl.id = 'reading-craze-styles';
    
    // Remove any existing style element with our ID
    const existingStyle = document.getElementById('reading-craze-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // Global styles for better reading with higher specificity
    let css = `
        html body, body {
            font-family: ${settings.font || 'Georgia, serif'} !important;
            font-size: ${settings.fontSize || 18}px !important;
            color: ${settings.fontColor || '#333333'} !important;
            line-height: ${settings.lineHeight || 1.8} !important;
        }
        
        .reading-craze-wrapper {
            padding: 0 ${settings.sideMargin || 20}px;
        }
        
        body p, body div, body span, body li, body h1, body h2, body h3, body h4, body h5, body h6, 
        body article, body section, body td, body th, body blockquote, body pre, body code, 
        body strong, body em, body small, body b, body i, body u, body s, body strike, 
        body a, body label, body input, body button, body textarea, body select, body option {
            font-family: ${settings.font || 'Georgia, serif'} !important;
            line-height: ${settings.lineHeight || 1.8} !important;
            color: ${settings.fontColor || '#333333'} !important;
        }
        
        body p {
            margin-bottom: ${settings.paragraphSpacing || 1.5}em !important;
        }
        
        /* Force color on pseudo-elements and selection */
        ::before, ::after, ::selection {
            color: ${settings.fontColor || '#333333'} !important;
        }
    `;
    
    // Apply reading mode
    if (settings.readingMode === 'dark') {
        css += `
            html, body {
                background-color: #121212 !important;
                color: #e0e0e0 !important;
            }
            
            body a {
                color: #90caf9 !important;
            }
            
            body p, body div, body span, body li, body h1, body h2, body h3, body h4, body h5, body h6, 
            body article, body section, body td, body th, body blockquote, body pre, body code, 
            body strong, body em, body small, body b, body i, body u, body s, body strike, 
            body label, body input, body button, body textarea, body select, body option {
                color: #e0e0e0 !important;
            }
            
            /* Force color on pseudo-elements and selection in dark mode */
            ::before, ::after, ::selection {
                color: #e0e0e0 !important;
            }
        `;
    } else if (settings.readingMode === 'sepia') {
        css += `
            html, body {
                background-color: #F8F3E9 !important;
                color: #5B4636 !important;
            }
            
            body p, body div, body span, body li, body h1, body h2, body h3, body h4, body h5, body h6, 
            body article, body section, body td, body th, body blockquote, body pre, body code, 
            body strong, body em, body small, body b, body i, body u, body s, body strike, 
            body label, body input, body button, body textarea, body select, body option {
                color: #5B4636 !important;
            }
            
            /* Force color on pseudo-elements and selection in sepia mode */
            ::before, ::after, ::selection {
                color: #5B4636 !important;
            }
        `;
    } else {
        // Light mode
        css += `
            html, body {
                background-color: ${settings.bgColor || '#ffffff'} !important;
                color: ${settings.fontColor || '#333333'} !important;
            }
            
            body * {
                color: ${settings.fontColor || '#333333'} !important;
            }
        `;
    }
    
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    
    // Apply styles directly to elements for sites that are resistant to CSS
    setTimeout(applyDirectTextStyles, 100);
}

// Create and add progress bar
function createProgressBar() {
    if (document.querySelector('.reading-progress-container')) {
        return;
    }
    
    const progressContainer = document.createElement('div');
    progressContainer.className = 'reading-progress-container';
    
    progressBar = document.createElement('div');
    progressBar.className = 'reading-progress-bar';
    
    progressContainer.appendChild(progressBar);
    document.body.appendChild(progressContainer);
    
    // Update progress bar on scroll
    window.addEventListener('scroll', updateProgressBar);
    updateProgressBar();
}

// Update progress bar width based on scroll position
function updateProgressBar() {
    if (!progressBar) return;
    
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrollPercentage = (scrollTop / scrollHeight) * 100;
    
    progressBar.style.width = scrollPercentage + '%';
}

// Save reading progress
function saveReadingProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    
    // Send message to background script to save progress
    chrome.runtime.sendMessage({
        action: 'updateReadingProgress',
        url: window.location.href,
        scrollPosition: scrollTop,
        totalHeight: scrollHeight
    });
}

// Restore reading position if returning to a page
function restoreReadingPosition() {
    chrome.runtime.sendMessage(
        {action: 'getReadingProgress'}, 
        (response) => {
            if (response && response.progress && response.progress[window.location.href]) {
                const progress = response.progress[window.location.href];
                
                // Scroll to the saved position
                window.scrollTo({
                    top: progress.scrollPosition,
                    behavior: 'smooth'
                });
            }
        }
    );
}

// Setup auto-scroll functionality
function setupAutoScroll(speed) {
    currentScrollSpeed = speed;
    
    // Clear existing interval if any
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
    }
    
    // Set new interval
    autoScrollInterval = setInterval(() => {
        window.scrollBy(0, currentScrollSpeed);
    }, 50);
}

// Stop auto-scroll
function stopAutoScroll() {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'applySettings') {
        settings = request.settings;
        
        // Apply new styles
        applyStyles();
        
        // Handle auto-scroll settings change
        if (settings.autoScroll) {
            setupAutoScroll(settings.autoScrollSpeed);
        } else {
            stopAutoScroll();
        }
    }
});

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Initialize when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
