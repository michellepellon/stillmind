// Performance monitoring and optimization utilities

export class PerformanceMonitor {
    constructor() {
        this.marks = new Map();
        this.measures = new Map();
        this.observers = [];
        
        // Initialize performance observers
        this.initObservers();
        
        // Log initial page load metrics
        this.logPageLoadMetrics();
    }
    
    // Mark a performance point
    mark(name) {
        if ('performance' in window && 'mark' in performance) {
            performance.mark(name);
            this.marks.set(name, performance.now());
        }
    }
    
    // Measure between two marks
    measure(name, startMark, endMark = null) {
        if ('performance' in window && 'measure' in performance) {
            try {
                if (endMark) {
                    performance.measure(name, startMark, endMark);
                } else {
                    performance.measure(name, startMark);
                }
                
                const measure = performance.getEntriesByName(name, 'measure')[0];
                if (measure) {
                    this.measures.set(name, measure.duration);
                    console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
                }
            } catch (error) {
                console.warn('[Performance] Measure failed:', error);
            }
        }
    }
    
    // Initialize performance observers
    initObservers() {
        // Largest Contentful Paint
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    console.log(`[Performance] LCP: ${lastEntry.startTime.toFixed(2)}ms`);
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                this.observers.push(lcpObserver);
            } catch (error) {
                console.warn('[Performance] LCP observer failed:', error);
            }
            
            // First Input Delay
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        console.log(`[Performance] FID: ${entry.processingStart - entry.startTime}ms`);
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                this.observers.push(fidObserver);
            } catch (error) {
                console.warn('[Performance] FID observer failed:', error);
            }
            
            // Cumulative Layout Shift
            try {
                const clsObserver = new PerformanceObserver((list) => {
                    let clsValue = 0;
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    console.log(`[Performance] CLS: ${clsValue.toFixed(4)}`);
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                this.observers.push(clsObserver);
            } catch (error) {
                console.warn('[Performance] CLS observer failed:', error);
            }
        }
    }
    
    // Log page load metrics
    logPageLoadMetrics() {
        window.addEventListener('load', () => {
            // Wait a bit for metrics to be available
            setTimeout(() => {
                if ('performance' in window) {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    if (navigation) {
                        console.log(`[Performance] DOM Content Loaded: ${navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart}ms`);
                        console.log(`[Performance] Load Complete: ${navigation.loadEventEnd - navigation.loadEventStart}ms`);
                        console.log(`[Performance] Total Page Load: ${navigation.loadEventEnd - navigation.fetchStart}ms`);
                    }
                }
            }, 1000);
        });
    }
    
    // Debounce utility
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }
    
    // Throttle utility
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // RequestAnimationFrame wrapper
    raf(callback) {
        if ('requestAnimationFrame' in window) {
            return requestAnimationFrame(callback);
        } else {
            return setTimeout(callback, 16); // ~60fps fallback
        }
    }
    
    // Cancel RAF
    cancelRaf(id) {
        if ('cancelAnimationFrame' in window) {
            cancelAnimationFrame(id);
        } else {
            clearTimeout(id);
        }
    }
    
    // Lazy load with Intersection Observer
    createLazyLoader(selector, callback, options = {}) {
        const defaultOptions = {
            root: null,
            rootMargin: '50px',
            threshold: 0.1
        };
        
        const observerOptions = { ...defaultOptions, ...options };
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        callback(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            }, observerOptions);
            
            // Observe existing elements
            document.querySelectorAll(selector).forEach((el) => {
                observer.observe(el);
            });
            
            return observer;
        } else {
            // Fallback: load immediately
            document.querySelectorAll(selector).forEach(callback);
            return null;
        }
    }
    
    // Virtual scrolling utility
    createVirtualScroller(container, items, renderItem, itemHeight = 60, visibleCount = 10) {
        let scrollTop = 0;
        let startIndex = 0;
        let endIndex = Math.min(visibleCount, items.length);
        
        const viewport = document.createElement('div');
        viewport.style.cssText = `
            height: ${visibleCount * itemHeight}px;
            overflow-y: auto;
            position: relative;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            height: ${items.length * itemHeight}px;
            position: relative;
        `;
        
        const renderVisibleItems = this.throttle(() => {
            const newStartIndex = Math.floor(scrollTop / itemHeight);
            const newEndIndex = Math.min(newStartIndex + visibleCount + 2, items.length);
            
            if (newStartIndex !== startIndex || newEndIndex !== endIndex) {
                startIndex = newStartIndex;
                endIndex = newEndIndex;
                
                // Clear existing items
                content.innerHTML = '';
                
                // Render visible items
                for (let i = startIndex; i < endIndex; i++) {
                    const item = renderItem(items[i], i);
                    item.style.cssText = `
                        position: absolute;
                        top: ${i * itemHeight}px;
                        left: 0;
                        right: 0;
                        height: ${itemHeight}px;
                    `;
                    content.appendChild(item);
                }
            }
        }, 16);
        
        viewport.addEventListener('scroll', (e) => {
            scrollTop = e.target.scrollTop;
            renderVisibleItems();
        });
        
        viewport.appendChild(content);
        container.appendChild(viewport);
        
        // Initial render
        renderVisibleItems();
        
        return {
            updateItems: (newItems) => {
                items = newItems;
                content.style.height = `${items.length * itemHeight}px`;
                renderVisibleItems();
            },
            scrollTo: (index) => {
                viewport.scrollTop = index * itemHeight;
            }
        };
    }
    
    // Memory usage tracking
    getMemoryUsage() {
        if ('memory' in performance) {
            const memory = performance.memory;
            return {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }
    
    // Log performance summary
    logSummary() {
        console.group('[Performance Summary]');
        
        // Marks
        if (this.marks.size > 0) {
            console.log('Marks:', Object.fromEntries(this.marks));
        }
        
        // Measures
        if (this.measures.size > 0) {
            console.log('Measures:', Object.fromEntries(this.measures));
        }
        
        // Memory
        const memory = this.getMemoryUsage();
        if (memory) {
            console.log(`Memory: ${memory.used}MB / ${memory.total}MB (limit: ${memory.limit}MB)`);
        }
        
        console.groupEnd();
    }
    
    // Clean up observers
    disconnect() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
}

// Resource preloading utilities
export function preloadResource(href, as, crossorigin = false) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (crossorigin) link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
}

export function prefetchResource(href) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
}

export function preconnect(href) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    document.head.appendChild(link);
}

// Critical CSS inlining utility
export function inlineCriticalCSS(cssText) {
    const style = document.createElement('style');
    style.textContent = cssText;
    document.head.appendChild(style);
}

// Export singleton instance
export default new PerformanceMonitor();