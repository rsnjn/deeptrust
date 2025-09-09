// Background service worker for DeepTrust extension
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.local.set({
            enabled: true,
            scannedImages: 0,
            detectedDeepfakes: 0
        });

        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'DeepTrust Installed',
            message: 'AI-powered deepfake detection is now active!'
        });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'incrementScanned') {
        chrome.storage.local.get(['scannedImages'], function(result) {
            const newCount = (result.scannedImages ||
