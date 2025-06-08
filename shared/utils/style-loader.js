// Dynamic style loading for refined UI

export class StyleLoader {
    constructor() {
        this.loadedStyles = new Set();
        this.useRefined = true; // Default to refined styles
    }
    
    // Load page-specific styles
    async loadPageStyles(page) {
        const stylesToLoad = [];
        
        if (this.useRefined) {
            // Load refined styles first
            switch (page) {
                case 'today':
                case '/':
                    stylesToLoad.push('/features/today/today-refined.css');
                    break;
                case 'write':
                    stylesToLoad.push('/features/write/write-refined.css');
                    // Also preload the refined JS
                    this.preloadScript('/features/write/write-refined.js');
                    break;
                case 'history':
                    stylesToLoad.push('/features/history/history.css');
                    break;
                case 'entry':
                    stylesToLoad.push('/features/entry/entry-refined.css');
                    // Also preload the refined JS
                    this.preloadScript('/features/entry/entry-refined.js');
                    break;
                case 'settings':
                    stylesToLoad.push('/features/settings/settings.css');
                    break;
            }
        } else {
            // Fallback to original styles
            switch (page) {
                case 'today':
                case '/':
                    stylesToLoad.push('/features/today/today.css');
                    break;
                case 'write':
                    stylesToLoad.push('/features/write/write.css');
                    break;
                case 'history':
                    stylesToLoad.push('/features/history/history.css');
                    break;
                case 'entry':
                    stylesToLoad.push('/features/entry/entry.css');
                    break;
                case 'settings':
                    stylesToLoad.push('/features/settings/settings.css');
                    break;
            }
        }
        
        // Load styles in parallel
        const loadPromises = stylesToLoad.map(href => this.loadStyle(href));
        await Promise.all(loadPromises);
    }
    
    // Load a single stylesheet
    async loadStyle(href) {
        if (this.loadedStyles.has(href)) {
            return; // Already loaded
        }
        
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            
            link.onload = () => {
                this.loadedStyles.add(href);
                console.log(`[StyleLoader] Loaded: ${href}`);
                resolve();
            };
            
            link.onerror = () => {
                console.error(`[StyleLoader] Failed to load: ${href}`);
                reject(new Error(`Failed to load ${href}`));
            };
            
            document.head.appendChild(link);
        });
    }
    
    // Preload styles for better performance
    preloadStyle(href) {
        if (this.loadedStyles.has(href)) {
            return;
        }
        
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = href;
        link.onload = () => {
            link.rel = 'stylesheet';
            this.loadedStyles.add(href);
        };
        
        document.head.appendChild(link);
    }
    
    // Toggle between refined and original styles
    toggleRefinedMode(useRefined = true) {
        this.useRefined = useRefined;
        
        // Store preference
        try {
            localStorage.setItem('stillmind-refined-ui', JSON.stringify(useRefined));
        } catch (error) {
            console.warn('[StyleLoader] Could not save preference:', error);
        }
    }
    
    // Load preference from storage
    loadPreference() {
        try {
            const stored = localStorage.getItem('stillmind-refined-ui');
            if (stored !== null) {
                this.useRefined = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('[StyleLoader] Could not load preference:', error);
            this.useRefined = true; // Default to refined
        }
    }
    
    // Preload script for better performance
    preloadScript(src) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = src;
        document.head.appendChild(link);
    }
}

// Export singleton instance
export default new StyleLoader();