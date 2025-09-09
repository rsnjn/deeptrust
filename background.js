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
            const newCount = (result.scannedImages || 0) + 1;
            chrome.storage.local.set({ scannedImages: newCount });
            
            // Update popup if open
            chrome.runtime.sendMessage({ action: 'updateStats' }).catch(() => {});
        });
    }
    
    if (request.action === 'incrementDeepfakes') {
        chrome.storage.local.get(['detectedDeepfakes'], function(result) {
            const newCount = (result.detectedDeepfakes || 0) + 1;
            chrome.storage.local.set({ detectedDeepfakes: newCount });
            
            // Update popup if open
            chrome.runtime.sendMessage({ action: 'updateStats' }).catch(() => {});
            
            // Show notification for high-confidence deepfakes
            if (request.confidence > 70) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'DeepTrust Alert',
                    message: `${request.confidence}% likely deepfake detected!`
                });
            }
        });
    }

    sendResponse({ success: true });
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(function() {
    console.log('DeepTrust service worker started');
});
