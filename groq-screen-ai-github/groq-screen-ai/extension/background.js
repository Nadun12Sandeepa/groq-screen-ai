// background.js - service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('Groq Screen AI installed');
});

// Handle messages from popup if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    return true;
  }
});
