// Popup script for DeepTrust extension
document.addEventListener('DOMContentLoaded', function() {
    const statusValue = document.getElementById('status-value');
    const statusDescription = document.getElementById('status-description');
    const scannedCount = document.getElementById('scanned-count');
    const deepfakeCount = document.getElementById('deepfake-count');
    const toggleButton = document.getElementById('toggle-detection');
    const settingsButton = document.getElementById('settings-button');

    // Load extension state
    chrome.storage.local.get(['enabled', 'scannedImages', 'detectedDeepfakes'], function(result) {
        const enabled = result.enabled !== false; // Default to true
        const scanned = result.scannedImages || 0;
        const detected = result.detectedDeepfakes || 0;

        updateUI(enabled, scanned, detected);
    });

    function updateUI(enabled, scanned, detected) {
        // Update status
        if (enabled) {
            statusValue.innerHTML = '✓ Active';
            statusDescription.textContent = 'Scanning images for deepfake content';
            toggleButton.textContent = '✓ Detection Enabled';
            toggleButton.className = 'toggle-button enabled';
        } else {
            statusValue.innerHTML = '⏸️ Paused';
            statusDescription.textContent = 'Click to resume deepfake detection';
            toggleButton.textContent = '⏸️ Detection Paused';
            toggleButton.className = 'toggle-button disabled';
        }

        // Update counts
        scannedCount.textContent = scanned.toLocaleString();
        deepfakeCount.textContent = detected.toLocaleString();
    }

    // Toggle detection on/off
    toggleButton.addEventListener('click', function() {
        chrome.storage.local.get(['enabled'], function(result) {
            const currentState = result.enabled !== false;
            const newState = !currentState;
            
            chrome.storage.local.set({ enabled: newState }, function() {
                chrome.storage.local.get(['scannedImages', 'detectedDeepfakes'], function(counts) {
                    updateUI(newState, counts.scannedImages || 0, counts.detectedDeepfakes || 0);
                });

                // Send message to content script
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: newState ? 'enable' : 'disable'
                    });
                });
            });
        });
    });

    // Settings and about
    settingsButton.addEventListener('click', function() {
        const settingsHtml = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; color: #333;">
                    <h3 style="margin: 0 0 20px 0; color: #667eea;">⚙️ DeepTrust Settings</h3>
                    
                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0;">How It Works:</h4>
                        <p style="font-size: 13px; line-height: 1.5; margin: 0;">
                            DeepTrust uses the PyDeepFakeDet AI model to analyze images and videos on social media platforms. 
                            It detects manipulation patterns and provides explanations for its findings.
                        </p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0;">Supported Platforms:</h4>
                        <p style="font-size: 13px; margin: 0;">
                            Instagram, Facebook, Twitter/X, TikTok, LinkedIn
                        </p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0;">Privacy:</h4>
                        <p style="font-size: 13px; line-height: 1.5; margin: 0;">
                            Image URLs are sent to our secure backend for analysis. No personal data is stored or shared.
                        </p>
                    </div>

                    <div style="text-align: center;">
                        <button onclick="this.closest('div').style.display='none'" 
                                style="padding: 8px 20px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Inject settings modal into current tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: function(html) {
                    const modal = document.createElement('div');
                    modal.innerHTML = html;
                    document.body.appendChild(modal);
                },
                args: [settingsHtml]
            });
        });
    });

    // Listen for updates from background script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateStats') {
            chrome.storage.local.get(['enabled', 'scannedImages', 'detectedDeepfakes'], function(result) {
                updateUI(
                    result.enabled !== false,
                    result.scannedImages || 0,
                    result.detectedDeepfakes || 0
                );
            });
        }
    });

    // Check for backend connectivity
    fetch('https://your-backend-url.vercel.app/api/health')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                statusDescription.textContent = 'Connected to DeepTrust AI service';
            }
        })
        .catch(error => {
            statusValue.innerHTML = '⚠️ Offline';
            statusDescription.textContent = 'Backend service unavailable';
        });
});
