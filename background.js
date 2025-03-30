// Background service worker
chrome.runtime.onInstalled.addListener(() => {
  // Initialize default settings
  chrome.storage.sync.set({
    font: 'Georgia, serif',
    fontSize: 18,
    fontColor: '#333333',
    bgColor: '#F8F3E9',
    lineHeight: 1.8,
    paragraphSpacing: 1.5,
    sideMargin: 20,
    readingMode: 'light',
    autoScroll: false,
    autoScrollSpeed: 2,
    dictionaryEnabled: false,
    dictionaryTheme: 'light',
    ttsEnabled: false,
    ttsVoice: 'default',
    ttsRate: 1.0,
    ttsPitch: 1.0,
    ttsVolume: 1.0
  });
});

// Message listener for communication between popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getReadingProgress") {
    chrome.storage.sync.get(['readingProgress'], (result) => {
      sendResponse({progress: result.readingProgress || {}});
    });
    return true; // Required for async sendResponse
  }
  
  if (request.action === "updateReadingProgress") {
    chrome.storage.sync.get(['readingProgress'], (result) => {
      let progress = result.readingProgress || {};
      progress[request.url] = {
        scrollPosition: request.scrollPosition,
        totalHeight: request.totalHeight,
        lastRead: new Date().toISOString()
      };
      chrome.storage.sync.set({readingProgress: progress});
    });
  }
}); 