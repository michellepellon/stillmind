export class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.currentParams = {};
        this.beforeHooks = [];
        this.afterHooks = [];
        this.moduleCache = new Map();
        this.scrollPositions = new Map();
        this.isTransitioning = false;
        
        // Bind methods
        this.handleRouteChange = this.handleRouteChange.bind(this);
        this.handlePopState = this.handlePopState.bind(this);
        
        // Listen for hash changes
        window.addEventListener('hashchange', this.handleRouteChange);
        window.addEventListener('load', this.handleRouteChange);
        window.addEventListener('popstate', this.handlePopState);
    }
    
    /**
     * Register a route
     * @param {string} path - The route path (e.g., '/', '/write', '/entry/:id')
     * @param {Function|Object} handler - Handler function or module config with { module: string, method: string }
     */
    register(path, handler) {
        console.log(`[Router] Registering route: ${path}`);
        this.routes.set(path, handler);
    }
    
    /**
     * Register a before navigation hook
     * @param {Function} hook - Function to run before navigation
     */
    before(hook) {
        this.beforeHooks.push(hook);
    }
    
    /**
     * Register an after navigation hook
     * @param {Function} hook - Function to run after navigation
     */
    after(hook) {
        this.afterHooks.push(hook);
    }
    
    /**
     * Navigate to a specific route
     * @param {string} path - The route path to navigate to
     */
    navigate(path) {
        console.log(`[Router] Navigating to: ${path}`);
        window.location.hash = path;
    }
    
    /**
     * Get the current route path
     * @returns {string} The current route path
     */
    getCurrentRoute() {
        const hash = window.location.hash.slice(1); // Remove the #
        return hash || '/'; // Default to home if no hash
    }
    
    /**
     * Parse route parameters from path
     * @param {string} routePattern - The route pattern (e.g., '/entry/:id')
     * @param {string} actualPath - The actual path (e.g., '/entry/123')
     * @returns {Object|null} Parameters object or null if no match
     */
    parseParams(routePattern, actualPath) {
        const patternParts = routePattern.split('/');
        const pathParts = actualPath.split('/');
        
        if (patternParts.length !== pathParts.length) {
            return null;
        }
        
        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            if (patternParts[i].startsWith(':')) {
                params[patternParts[i].slice(1)] = pathParts[i];
            } else if (patternParts[i] !== pathParts[i]) {
                return null;
            }
        }
        
        return params;
    }
    
    /**
     * Find matching route for a path
     * @param {string} path - The path to match
     * @returns {Object|null} Route info with handler and params
     */
    findRoute(path) {
        // Try exact match first
        if (this.routes.has(path)) {
            return {
                handler: this.routes.get(path),
                params: {}
            };
        }
        
        // Try pattern matching
        for (const [pattern, handler] of this.routes) {
            const params = this.parseParams(pattern, path);
            if (params !== null) {
                return { handler, params };
            }
        }
        
        return null;
    }
    
    /**
     * Load module dynamically
     * @param {string} modulePath - Path to the module
     * @returns {Promise<Object>} The loaded module
     */
    async loadModule(modulePath) {
        if (this.moduleCache.has(modulePath)) {
            return this.moduleCache.get(modulePath);
        }
        
        console.log(`[Router] Loading module: ${modulePath}`);
        try {
            const module = await import(modulePath);
            this.moduleCache.set(modulePath, module);
            return module;
        } catch (error) {
            console.error(`[Router] Failed to load module ${modulePath}:`, error);
            throw error;
        }
    }
    
    /**
     * Handle route changes
     */
    async handleRouteChange() {
        if (this.isTransitioning) return;
        
        const path = this.getCurrentRoute();
        console.log(`[Router] Route changed to: ${path}`);
        
        // Find matching route
        const routeInfo = this.findRoute(path);
        if (!routeInfo) {
            console.warn(`[Router] Route not found: ${path}`);
            this.navigate('/');
            return;
        }
        
        this.isTransitioning = true;
        const app = document.getElementById('app');
        
        // Save current scroll position
        if (this.currentRoute) {
            this.scrollPositions.set(this.currentRoute, window.scrollY);
        }
        
        // Run before hooks
        for (const hook of this.beforeHooks) {
            try {
                await hook(this.currentRoute, path);
            } catch (error) {
                console.error('[Router] Before hook error:', error);
            }
        }
        
        // Add transition class
        app.classList.add('route-transition-out');
        
        // Wait for transition
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Call cleanup on previous module if it exists
        if (this.currentRoute) {
            const currentRouteInfo = this.findRoute(this.currentRoute);
            if (currentRouteInfo && currentRouteInfo.handler.module) {
                const modulePath = currentRouteInfo.handler.module;
                if (this.moduleCache.has(modulePath)) {
                    const module = this.moduleCache.get(modulePath);
                    if (module.cleanup && typeof module.cleanup === 'function') {
                        try {
                            await module.cleanup();
                        } catch (error) {
                            console.error(`[Router] Cleanup error for ${modulePath}:`, error);
                        }
                    }
                }
            }
        }
        
        // Update current route and params
        this.currentRoute = path;
        this.currentParams = routeInfo.params;
        
        // Handle the route
        const { handler } = routeInfo;
        try {
            if (typeof handler === 'function') {
                // Direct function handler
                await handler(this.currentParams);
            } else if (handler.module) {
                // Lazy-loaded module
                const module = await this.loadModule(handler.module);
                const method = handler.method || 'render';
                if (module[method]) {
                    await module[method](this.currentParams);
                } else {
                    console.error(`[Router] Method ${method} not found in module ${handler.module}`);
                }
            }
        } catch (error) {
            console.error(`[Router] Error handling route ${path}:`, error);
        }
        
        // Restore scroll position or scroll to top
        const savedPosition = this.scrollPositions.get(path);
        if (savedPosition !== undefined) {
            window.scrollTo(0, savedPosition);
        } else {
            window.scrollTo(0, 0);
        }
        
        // Transition in
        app.classList.remove('route-transition-out');
        app.classList.add('route-transition-in');
        
        // Remove transition class after animation
        setTimeout(() => {
            app.classList.remove('route-transition-in');
            this.isTransitioning = false;
        }, 150);
        
        // Run after hooks
        for (const hook of this.afterHooks) {
            try {
                await hook(path, this.currentParams);
            } catch (error) {
                console.error('[Router] After hook error:', error);
            }
        }
    }
    
    /**
     * Get current route parameters
     * @returns {Object} Current route parameters
     */
    getParams() {
        return { ...this.currentParams };
    }
    
    /**
     * Check if current route matches a path
     * @param {string} path - The path to check
     * @returns {boolean} True if current route matches
     */
    isActive(path) {
        return this.currentRoute === path;
    }
    
    /**
     * Handle browser back/forward navigation
     */
    handlePopState() {
        // The hashchange event will handle the actual routing
        // This is just for managing state
    }
}

// Create and export singleton instance
export const router = new Router();