// Event delegation utilities for better performance

export class EventDelegate {
    constructor(container = document.body) {
        this.container = container;
        this.handlers = new Map();
        this.setupDelegation();
    }
    
    // Set up event delegation
    setupDelegation() {
        // Click events
        this.container.addEventListener('click', (e) => {
            this.handleEvent('click', e);
        }, { passive: false });
        
        // Touch events for mobile
        this.container.addEventListener('touchstart', (e) => {
            this.handleEvent('touchstart', e);
        }, { passive: true });
        
        this.container.addEventListener('touchend', (e) => {
            this.handleEvent('touchend', e);
        }, { passive: true });
        
        // Focus events
        this.container.addEventListener('focus', (e) => {
            this.handleEvent('focus', e);
        }, true); // Use capture for focus events
        
        this.container.addEventListener('blur', (e) => {
            this.handleEvent('blur', e);
        }, true);
        
        // Form events
        this.container.addEventListener('submit', (e) => {
            this.handleEvent('submit', e);
        }, { passive: false });
        
        this.container.addEventListener('input', (e) => {
            this.handleEvent('input', e);
        }, { passive: true });
        
        this.container.addEventListener('change', (e) => {
            this.handleEvent('change', e);
        }, { passive: true });
    }
    
    // Handle delegated events
    handleEvent(eventType, event) {
        const handlers = this.handlers.get(eventType);
        if (!handlers) return;
        
        let element = event.target;
        
        // Walk up the DOM tree to find matching selectors
        while (element && element !== this.container) {
            for (const [selector, handler] of handlers) {
                if (element.matches && element.matches(selector)) {
                    try {
                        handler.call(element, event);
                    } catch (error) {
                        console.error(`[EventDelegate] Handler error for ${selector}:`, error);
                    }
                    
                    // Stop if handler prevented default or stopped propagation
                    if (event.defaultPrevented) return;
                }
            }
            element = element.parentElement;
        }
    }
    
    // Add event handler
    on(eventType, selector, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Map());
        }
        
        const eventHandlers = this.handlers.get(eventType);
        eventHandlers.set(selector, handler);
        
        return () => this.off(eventType, selector);
    }
    
    // Remove event handler
    off(eventType, selector) {
        const eventHandlers = this.handlers.get(eventType);
        if (eventHandlers) {
            eventHandlers.delete(selector);
            
            // Clean up empty event type maps
            if (eventHandlers.size === 0) {
                this.handlers.delete(eventType);
            }
        }
    }
    
    // Add multiple handlers at once
    addHandlers(handlers) {
        const removeHandlers = [];
        
        for (const [eventType, selectorHandlers] of Object.entries(handlers)) {
            for (const [selector, handler] of Object.entries(selectorHandlers)) {
                removeHandlers.push(this.on(eventType, selector, handler));
            }
        }
        
        return () => {
            removeHandlers.forEach(remove => remove());
        };
    }
    
    // Destroy the delegate
    destroy() {
        this.handlers.clear();
        // Note: We don't remove the actual event listeners as they're passive
        // and removing them would require storing references
    }
}

// Utility functions for common patterns
export function oncePerFrame(callback) {
    let pending = false;
    return function(...args) {
        if (!pending) {
            pending = true;
            requestAnimationFrame(() => {
                callback.apply(this, args);
                pending = false;
            });
        }
    };
}

export function throttleRAF(callback) {
    let rafId = null;
    return function(...args) {
        if (rafId !== null) return;
        
        rafId = requestAnimationFrame(() => {
            callback.apply(this, args);
            rafId = null;
        });
    };
}

// Memory-efficient event listener management
export class EventManager {
    constructor() {
        this.listeners = new Set();
    }
    
    // Add event listener with automatic cleanup tracking
    add(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        
        const cleanup = () => {
            element.removeEventListener(event, handler, options);
            this.listeners.delete(cleanup);
        };
        
        this.listeners.add(cleanup);
        return cleanup;
    }
    
    // Add multiple listeners
    addMultiple(bindings) {
        const cleanupFunctions = bindings.map(([element, event, handler, options]) => {
            return this.add(element, event, handler, options);
        });
        
        return () => {
            cleanupFunctions.forEach(cleanup => cleanup());
        };
    }
    
    // Clean up all listeners
    cleanup() {
        this.listeners.forEach(cleanup => cleanup());
        this.listeners.clear();
    }
}

// Optimized scroll handler
export function createScrollHandler(callback, options = {}) {
    const {
        throttle = true,
        passive = true,
        capture = false
    } = options;
    
    let handler = callback;
    
    if (throttle) {
        handler = throttleRAF(callback);
    }
    
    return {
        handler,
        options: { passive, capture }
    };
}

// Intersection Observer wrapper for performance
export function createIntersectionHandler(callback, options = {}) {
    const defaultOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observerOptions = { ...defaultOptions, ...options };
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(callback, observerOptions);
        
        return {
            observe: (element) => observer.observe(element),
            unobserve: (element) => observer.unobserve(element),
            disconnect: () => observer.disconnect()
        };
    }
    
    // Fallback for browsers without Intersection Observer
    return {
        observe: () => {},
        unobserve: () => {},
        disconnect: () => {}
    };
}

// Export singleton instance
export default new EventDelegate();