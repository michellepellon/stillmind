// Offline manager for StillMind
export class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.listeners = new Set();
        this.failedRequests = [];
        this.statusElement = null;
        
        // Bind event handlers
        this.handleOnline = this.handleOnline.bind(this);
        this.handleOffline = this.handleOffline.bind(this);
        
        // Listen for online/offline events
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        
        // Check connection periodically
        this.startConnectionCheck();
    }
    
    // Subscribe to offline state changes
    subscribe(callback) {
        this.listeners.add(callback);
        // Immediately notify of current state
        callback(this.isOnline);
        
        return () => {
            this.listeners.delete(callback);
        };
    }
    
    // Handle going online
    handleOnline() {
        console.log('[Offline] Connection restored');
        this.isOnline = true;
        this.notifyListeners();
        this.updateStatusIndicator();
        this.processQueuedRequests();
    }
    
    // Handle going offline
    handleOffline() {
        console.log('[Offline] Connection lost');
        this.isOnline = false;
        this.notifyListeners();
        this.updateStatusIndicator();
    }
    
    // Notify all listeners of state change
    notifyListeners() {
        this.listeners.forEach(callback => {
            callback(this.isOnline);
        });
    }
    
    // Add offline status indicator to UI
    createStatusIndicator() {
        if (this.statusElement) return;
        
        this.statusElement = document.createElement('div');
        this.statusElement.className = 'offline-indicator';
        this.statusElement.innerHTML = `
            <div class="offline-indicator-content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 1l22 22M9 9a3 3 0 114.5 4.5M4.5 4.5a9 9 0 012.8-1.3M7.3 7.3A9 9 0 0012 21a9 9 0 006.2-2.3M19.5 19.5a9 9 0 001.3-2.8"/>
                </svg>
                <span>Offline Mode</span>
            </div>
        `;
        
        document.body.appendChild(this.statusElement);
        this.updateStatusIndicator();
    }
    
    // Update status indicator visibility
    updateStatusIndicator() {
        if (!this.statusElement) {
            this.createStatusIndicator();
        }
        
        if (this.isOnline) {
            this.statusElement.classList.remove('visible');
            // Show briefly when coming back online
            if (this.wasOffline) {
                this.statusElement.innerHTML = `
                    <div class="offline-indicator-content online">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"/>
                            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                        </svg>
                        <span>Back Online</span>
                    </div>
                `;
                this.statusElement.classList.add('visible');
                setTimeout(() => {
                    this.statusElement.classList.remove('visible');
                }, 3000);
            }
        } else {
            this.statusElement.classList.add('visible');
            this.wasOffline = true;
        }
    }
    
    // Queue failed request for retry
    queueRequest(request) {
        this.failedRequests.push({
            request,
            timestamp: Date.now()
        });
        
        console.log('[Offline] Request queued for retry:', request.url);
    }
    
    // Process queued requests when back online
    async processQueuedRequests() {
        if (this.failedRequests.length === 0) return;
        
        console.log('[Offline] Processing', this.failedRequests.length, 'queued requests');
        
        const requests = [...this.failedRequests];
        this.failedRequests = [];
        
        for (const { request } of requests) {
            try {
                await fetch(request);
                console.log('[Offline] Queued request succeeded:', request.url);
            } catch (error) {
                console.error('[Offline] Queued request failed:', request.url, error);
                // Re-queue if still failing
                this.queueRequest(request);
            }
        }
    }
    
    // Start periodic connection check
    startConnectionCheck() {
        // Check every 30 seconds
        setInterval(() => {
            this.checkConnection();
        }, 30000);
    }
    
    // Check connection by attempting to fetch a small resource
    async checkConnection() {
        try {
            const response = await fetch('/manifest.json', {
                method: 'HEAD',
                cache: 'no-store'
            });
            
            if (!this.isOnline && response.ok) {
                // Connection restored but event didn't fire
                this.handleOnline();
            }
        } catch (error) {
            if (this.isOnline) {
                // Connection lost but event didn't fire
                this.handleOffline();
            }
        }
    }
    
    // Clean up
    destroy() {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        if (this.statusElement) {
            this.statusElement.remove();
        }
        this.listeners.clear();
    }
}

// Export singleton instance
export default new OfflineManager();