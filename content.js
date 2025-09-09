// DeepTrust Content Script - Detects images/videos on social media
(function() {
    'use strict';

    // Configuration
    const BACKEND_URL = 'https://your-backend-url.vercel.app'; // You'll replace this
    const SCAN_INTERVAL = 2000; // Scan every 2 seconds for new content
    const processed = new Set(); // Track processed images

    // Initialize extension
    console.log('🛡️ DeepTrust extension loaded');
    
    // Create detection overlay
    function createDetectionOverlay(element, result) {
        // Remove existing overlay
        const existing = element.parentNode.querySelector('.deeptrust-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'deeptrust-overlay';
        
        const confidence = result.confidence;
        const isHighRisk = confidence > 70;
        
        overlay.innerHTML = `
            <div class="deeptrust-badge ${isHighRisk ? 'high-risk' : 'low-risk'}">
                <div class="deeptrust-icon">🛡️</div>
                <div class="deeptrust-info">
                    <div class="deeptrust-confidence">${confidence}% likely deepfake</div>
                    <div class="deeptrust-toggle" data-expanded="false">
                        <span class="deeptrust-summary">Tap to see why</span>
                        <div class="deeptrust-details">
                            <div class="deeptrust-reasons">
                                ${result.reasons.map(reason => `<div class="reason">• ${reason}</div>`).join('')}
                            </div>
                            <div class="deeptrust-model-info">
                                Detected by PyDeepFakeDet AI Model
                            </div>
                        </div>
                    </div>
                </div>
                <div class="deeptrust-close">×</div>
            </div>
        `;

        // Position overlay
        element.parentNode.style.position = 'relative';
        element.parentNode.appendChild(overlay);

        // Add click handlers
        const toggle = overlay.querySelector('.deeptrust-toggle');
        const close = overlay.querySelector('.deeptrust-close');
        
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const expanded = this.getAttribute('data-expanded') === 'true';
            this.setAttribute('data-expanded', !expanded);
            this.classList.toggle('expanded');
        });

        close.addEventListener('click', function(e) {
            e.stopPropagation();
            overlay.remove();
        });

        // Auto-hide after 10 seconds for low-risk
        if (!isHighRisk) {
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.classList.add('fade-out');
                    setTimeout(() => overlay.remove(), 500);
                }
            }, 10000);
        }
    }

    // Extract image URL from various social media formats
    function extractImageUrl(img) {
        let src = img.src || img.dataset.src || img.getAttribute('data-src');
        
        // Handle Instagram URLs
        if (src && src.includes('instagram')) {
            // Remove Instagram's URL parameters to get clean image
            src = src.split('?')[0];
        }
        
        // Handle Facebook URLs
        if (src && src.includes('facebook')) {
            src = src.split('?')[0];
        }

        // Handle Twitter/X URLs
        if (src && (src.includes('twitter') || src.includes('twimg'))) {
            src = src.replace(':small', ':large').replace(':medium', ':large');
        }

        return src;
    }

    // Check if element is visible and large enough
    function isValidImage(img) {
        if (!img.src && !img.dataset.src) return false;
        
        const rect = img.getBoundingClientRect();
        const minSize = 100; // Minimum 100px to be worth analyzing
        
        return rect.width >= minSize && 
               rect.height >= minSize && 
               rect.top < window.innerHeight && 
               rect.bottom > 0;
    }

    // Send image to backend for analysis
    async function analyzeImage(imageUrl, imgElement) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/detect-deepfake`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageUrl: imageUrl,
                    source: window.location.hostname
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && result.confidence > 30) { // Only show if > 30% confidence
                createDetectionOverlay(imgElement, {
                    confidence: Math.round(result.confidence),
                    reasons: result.reasons || ['Suspicious patterns detected by AI model'],
                    isDeepfake: result.confidence > 50
                });
            }

        } catch (error) {
            console.error('DeepTrust analysis failed:', error);
            
            // Show offline mode indicator
            if (error.message.includes('fetch')) {
                createDetectionOverlay(imgElement, {
                    confidence: 0,
                    reasons: ['DeepTrust service temporarily unavailable'],
                    isDeepfake: false
                });
            }
        }
    }

    // Scan for images on the page
    function scanForImages() {
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            if (!isValidImage(img)) return;
            
            const imageUrl = extractImageUrl(img);
            if (!imageUrl || processed.has(imageUrl)) return;
            
            // Skip profile pictures and icons (usually small or in specific containers)
            const parent = img.closest('[class*="avatar"], [class*="profile"], [class*="icon"]');
            if (parent) return;
            
            processed.add(imageUrl);
            
            // Add small delay to avoid overwhelming the API
            setTimeout(() => {
                analyzeImage(imageUrl, img);
            }, Math.random() * 1000);
        });
    }

    // Handle videos (extract frames)
    function scanForVideos() {
        const videos = document.querySelectorAll('video');
        
        videos.forEach(video => {
            if (processed.has(video.src)) return;
            if (!video.src) return;
            
            processed.add(video.src);
            
            // Extract frame from video for analysis
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.addEventListener('loadeddata', function() {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0);
                
                canvas.toBlob(async function(blob) {
                    const formData = new FormData();
                    formData.append('image', blob, 'frame.jpg');
                    formData.append('source', window.location.hostname);
                    
                    try {
                        const response = await fetch(`${BACKEND_URL}/api/detect-deepfake-upload`, {
                            method: 'POST',
                            body: formData
                        });
                        
                        const result = await response.json();
                        
                        if (result.success && result.confidence > 30) {
                            createDetectionOverlay(video, {
                                confidence: Math.round(result.confidence),
                                reasons: result.reasons || ['Video analysis detected suspicious patterns'],
                                isDeepfake: result.confidence > 50
                            });
                        }
                    } catch (error) {
                        console.error('Video analysis failed:', error);
                    }
                }, 'image/jpeg', 0.8);
            });
        });
    }

    // Start scanning
    let scanInterval;
    
    function startScanning() {
        // Initial scan
        scanForImages();
        scanForVideos();
        
        // Set up periodic scanning
        scanInterval = setInterval(() => {
            scanForImages();
            scanForVideos();
        }, SCAN_INTERVAL);
    }

    function stopScanning() {
        if (scanInterval) {
            clearInterval(scanInterval);
        }
    }

    // Listen for page navigation (for SPAs like Instagram, Facebook)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            processed.clear(); // Clear processed images on navigation
            setTimeout(startScanning, 1000); // Restart scanning after navigation
        }
    }).observe(document, { subtree: true, childList: true });

    // Start the extension
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startScanning);
    } else {
        startScanning();
    }

    // Clean up when page unloads
    window.addEventListener('beforeunload', stopScanning);

})();
