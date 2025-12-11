// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('ChatGPT Blur Extension installed');

  // Set default enabled state
  chrome.storage.local.get({ enabled: true }, (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({ enabled: true });
    }
  });
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' &&
      (tab.url?.includes('chat.openai.com') || tab.url?.includes('chatgpt.com'))) {
    // Content script should auto-inject, but we can add logic here if needed
    console.log('ChatGPT page loaded:', tab.url);
  }
});