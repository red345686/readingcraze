// Text-to-Speech feature for Reading Craze
let ttsEnabled = false;
let ttsVoice = 'default';
let ttsRate = 1.0;
let ttsPitch = 1.0;
let ttsVolume = 1.0;
let ttsPlayer = null;
let ttsControls = null;
let isPlaying = false;
let isPaused = false;
let currentUtterance = null;
let currentParagraphIndex = -1;
let paragraphs = [];
let selectedVoice = null;
let availableVoices = [];

// Initialize text-to-speech functionality
function initTTS() {
    // Check if TTS is enabled in storage
    chrome.storage.sync.get([
        'ttsEnabled', 
        'ttsVoice', 
        'ttsRate', 
        'ttsPitch', 
        'ttsVolume'
    ], (result) => {
        ttsEnabled = result.ttsEnabled || false;
        ttsVoice = result.ttsVoice || 'default';
        ttsRate = result.ttsRate || 1.0;
        ttsPitch = result.ttsPitch || 1.0;
        ttsVolume = result.ttsVolume || 1.0;
        
        if (ttsEnabled) {
            // Load available voices
            loadVoices();
            // Create the TTS controls UI
            createTTSControls();
            // Identify paragraphs for reading
            identifyParagraphs();
        }
    });
    
    // Listen for settings changes
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateTTS') {
            const oldEnabled = ttsEnabled;
            ttsEnabled = request.enabled;
            ttsVoice = request.voice || ttsVoice;
            ttsRate = request.rate || ttsRate;
            ttsPitch = request.pitch || ttsPitch;
            ttsVolume = request.volume || ttsVolume;
            
            // Update selected voice
            updateSelectedVoice();
            
            // Handle enable/disable
            if (!oldEnabled && ttsEnabled) {
                loadVoices();
                createTTSControls();
                identifyParagraphs();
            } else if (oldEnabled && !ttsEnabled) {
                stopSpeech();
                if (ttsControls) {
                    ttsControls.remove();
                    ttsControls = null;
                }
            } else if (ttsEnabled && ttsControls) {
                // Just update controls if needed
                updateControlsState();
            }
        }
    });
    
    // Initialize voices when available
    if ('speechSynthesis' in window) {
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }
    }
}

// Load available speech synthesis voices
function loadVoices() {
    if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported in this browser');
        return;
    }
    
    // Get available voices
    availableVoices = speechSynthesis.getVoices();
    
    // Set selected voice
    updateSelectedVoice();
}

// Update the selected voice based on settings
function updateSelectedVoice() {
    if (availableVoices.length === 0) return;
    
    if (ttsVoice === 'default') {
        selectedVoice = null; // Use browser default
    } else {
        // Try to find the voice by name
        selectedVoice = availableVoices.find(voice => 
            voice.name === ttsVoice || 
            voice.voiceURI === ttsVoice
        );
    }
}

// Create TTS controls UI
function createTTSControls() {
    if (ttsControls) return;
    
    // Create container
    ttsControls = document.createElement('div');
    ttsControls.className = 'reading-craze-tts-controls';
    ttsControls.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: rgba(255, 255, 255, 0.9);
        border-radius: 50px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        padding: 8px 16px;
        z-index: 10000;
        gap: 12px;
        transition: all 0.3s ease;
    `;
    
    // Create buttons
    const playButton = document.createElement('button');
    playButton.innerHTML = '▶';
    playButton.title = 'Play';
    playButton.id = 'tts-play-btn';
    playButton.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #444;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    `;
    playButton.addEventListener('click', togglePlay);
    
    const stopButton = document.createElement('button');
    stopButton.innerHTML = '■';
    stopButton.title = 'Stop';
    stopButton.id = 'tts-stop-btn';
    stopButton.style.cssText = `
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #444;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    `;
    stopButton.addEventListener('click', stopSpeech);
    
    // Create forward/backward buttons
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '❮';
    prevButton.title = 'Previous Paragraph';
    prevButton.id = 'tts-prev-btn';
    prevButton.style.cssText = `
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #444;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    `;
    prevButton.addEventListener('click', previousParagraph);
    
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '❯';
    nextButton.title = 'Next Paragraph';
    nextButton.id = 'tts-next-btn';
    nextButton.style.cssText = `
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: #444;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
    `;
    nextButton.addEventListener('click', nextParagraph);
    
    // Add buttons to container
    ttsControls.appendChild(prevButton);
    ttsControls.appendChild(playButton);
    ttsControls.appendChild(stopButton);
    ttsControls.appendChild(nextButton);
    
    // Add to document
    document.body.appendChild(ttsControls);
}

// Update controls state based on playing status
function updateControlsState() {
    if (!ttsControls) return;
    
    const playButton = document.getElementById('tts-play-btn');
    if (!playButton) return;
    
    if (isPlaying && !isPaused) {
        playButton.innerHTML = '⏸';
        playButton.title = 'Pause';
    } else {
        playButton.innerHTML = '▶';
        playButton.title = 'Play';
    }
}

// Toggle play/pause
function togglePlay() {
    if (!isPlaying) {
        startSpeech();
    } else if (isPaused) {
        resumeSpeech();
    } else {
        pauseSpeech();
    }
    
    updateControlsState();
}

// Start speech
function startSpeech() {
    if (!ttsEnabled) return;
    
    // Make sure paragraphs are identified
    if (paragraphs.length === 0) {
        identifyParagraphs();
        if (paragraphs.length === 0) return; // No text to read
    }
    
    // If we're not currently positioned at a paragraph, find the current one
    if (currentParagraphIndex === -1) {
        currentParagraphIndex = findCurrentParagraph();
    }
    
    isPlaying = true;
    isPaused = false;
    speakCurrentParagraph();
    updateControlsState();
}

// Find the paragraph closest to current viewport position
function findCurrentParagraph() {
    if (paragraphs.length === 0) return 0;
    
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const viewportMiddle = scrollY + window.innerHeight / 2;
    
    // Find the paragraph closest to the middle of the viewport
    let closestIndex = 0;
    let closestDistance = Number.MAX_SAFE_INTEGER;
    
    paragraphs.forEach((paragraph, index) => {
        const rect = paragraph.getBoundingClientRect();
        const paragraphMiddle = scrollY + rect.top + rect.height / 2;
        const distance = Math.abs(paragraphMiddle - viewportMiddle);
        
        if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
        }
    });
    
    return closestIndex;
}

// Speak the current paragraph
function speakCurrentParagraph() {
    if (!ttsEnabled || !isPlaying || currentParagraphIndex < 0 || currentParagraphIndex >= paragraphs.length) {
        stopSpeech();
        return;
    }
    
    // Remove previous highlights
    removeHighlights();
    
    // Highlight current paragraph
    const paragraph = paragraphs[currentParagraphIndex];
    paragraph.classList.add('reading-craze-tts-highlight');
    
    // Scroll paragraph into view if needed
    if (!isElementInViewport(paragraph)) {
        paragraph.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Create utterance
    currentUtterance = new SpeechSynthesisUtterance(paragraph.textContent);
    currentUtterance.rate = parseFloat(ttsRate);
    currentUtterance.pitch = parseFloat(ttsPitch);
    currentUtterance.volume = parseFloat(ttsVolume);
    
    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
    }
    
    // Set up event handlers
    currentUtterance.onend = () => {
        if (isPlaying) {
            currentParagraphIndex++;
            if (currentParagraphIndex < paragraphs.length) {
                speakCurrentParagraph();
            } else {
                stopSpeech();
            }
        }
    };
    
    currentUtterance.onerror = (event) => {
        console.error('TTS Error:', event);
        stopSpeech();
    };
    
    // Start speaking
    speechSynthesis.speak(currentUtterance);
}

// Pause speech
function pauseSpeech() {
    if (isPlaying && !isPaused) {
        speechSynthesis.pause();
        isPaused = true;
        updateControlsState();
    }
}

// Resume speech
function resumeSpeech() {
    if (isPlaying && isPaused) {
        speechSynthesis.resume();
        isPaused = false;
        updateControlsState();
    }
}

// Stop speech
function stopSpeech() {
    isPlaying = false;
    isPaused = false;
    speechSynthesis.cancel();
    removeHighlights();
    updateControlsState();
}

// Remove all paragraph highlights
function removeHighlights() {
    document.querySelectorAll('.reading-craze-tts-highlight').forEach(el => {
        el.classList.remove('reading-craze-tts-highlight');
    });
}

// Go to previous paragraph
function previousParagraph() {
    if (currentParagraphIndex > 0) {
        stopSpeech();
        currentParagraphIndex--;
        startSpeech();
    }
}

// Go to next paragraph
function nextParagraph() {
    if (currentParagraphIndex < paragraphs.length - 1) {
        stopSpeech();
        currentParagraphIndex++;
        startSpeech();
    }
}

// Identify paragraphs for TTS
function identifyParagraphs() {
    // Reset paragraphs array
    paragraphs = [];
    
    // Find all paragraphs and text blocks
    const allParagraphs = document.querySelectorAll('p, article > div, .chapter-text, .chapter-content, .entry-content > div, .post-content > div');
    
    // Filter out empty or very short paragraphs
    allParagraphs.forEach(p => {
        const text = p.textContent.trim();
        if (text.length > 10 && p.offsetHeight > 0 && p.offsetWidth > 0) {
            paragraphs.push(p);
        }
    });
    
    // If we didn't find much, try broader selectors
    if (paragraphs.length < 5) {
        const moreParagraphs = document.querySelectorAll('div:not(.reading-craze-tts-controls):not(.reading-craze-tooltip)');
        moreParagraphs.forEach(p => {
            // Only include if it looks like a text block (more text than HTML)
            const html = p.innerHTML.trim();
            const text = p.textContent.trim();
            
            if (text.length > 50 && 
                text.length / html.length > 0.5 && // More text than markup
                !paragraphs.includes(p) &&
                p.offsetHeight > 0 && 
                p.offsetWidth > 0) {
                paragraphs.push(p);
            }
        });
    }
}

// Check if element is in viewport
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTTS);
} else {
    initTTS();
}

// Add CSS for TTS highlighting
function addTTSStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .reading-craze-tts-highlight {
            background-color: rgba(255, 248, 107, 0.3);
            border-radius: 3px;
            transition: background-color 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}

// Add styles when script loads
addTTSStyles(); 