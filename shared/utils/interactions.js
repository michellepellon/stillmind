// UI interaction utilities for enhanced user experience

export class InteractionManager {
    constructor() {
        this.hapticSupported = 'vibrate' in navigator;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Listen for reduced motion preference changes
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.prefersReducedMotion = e.matches;
        });
    }
    
    // Haptic feedback patterns
    haptic(pattern = 'light') {
        if (!this.hapticSupported || this.prefersReducedMotion) return;
        
        const patterns = {
            light: [10],
            medium: [20],
            heavy: [50],
            double: [10, 50, 10],
            success: [10, 30, 10],
            error: [50, 50, 50],
            notification: [20, 100, 20]
        };
        
        const vibration = patterns[pattern] || patterns.light;
        navigator.vibrate(vibration);
    }
    
    // Add loading state to element
    showLoading(element, options = {}) {
        if (!element) return;
        
        const {
            text = 'Loading...',
            skeleton = false,
            size = 'default'
        } = options;
        
        element.classList.add('loading');
        element.setAttribute('aria-busy', 'true');
        
        if (skeleton) {
            element.classList.add('skeleton');
        } else {
            const originalContent = element.innerHTML;
            element.dataset.originalContent = originalContent;
            
            const spinnerSize = size === 'large' ? 'spinner-lg' : '';
            element.innerHTML = `
                <div class="loading-content">
                    <div class="spinner ${spinnerSize}"></div>
                    ${text ? `<span class="loading-text">${text}</span>` : ''}
                </div>
            `;
        }
        
        return {
            stop: () => this.hideLoading(element, skeleton)
        };
    }
    
    // Remove loading state
    hideLoading(element, wasSkeleton = false) {
        if (!element) return;
        
        element.classList.remove('loading');
        element.removeAttribute('aria-busy');
        
        if (wasSkeleton) {
            element.classList.remove('skeleton');
        } else if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }
    }
    
    // Add success feedback
    showSuccess(element, options = {}) {
        const { message = 'Success!', duration = 2000 } = options;
        
        if (!element) return;
        
        element.classList.add('success-state');
        
        const originalContent = element.innerHTML;
        element.innerHTML = `
            <div class="success-content">
                <div class="checkmark"></div>
                <span class="success-text">${message}</span>
            </div>
        `;
        
        this.haptic('success');
        
        setTimeout(() => {
            element.classList.remove('success-state');
            element.innerHTML = originalContent;
        }, duration);
    }
    
    // Add error feedback
    showError(element, options = {}) {
        const { message = 'Error occurred', duration = 3000 } = options;
        
        if (!element) return;
        
        element.classList.add('error-state');
        
        const originalContent = element.innerHTML;
        element.innerHTML = `
            <div class="error-content">
                <span class="error-text">${message}</span>
            </div>
        `;
        
        this.haptic('error');
        
        setTimeout(() => {
            element.classList.remove('error-state');
            element.innerHTML = originalContent;
        }, duration);
    }
    
    // Animate element entrance
    animateIn(element, animation = 'fade-in') {
        if (!element || this.prefersReducedMotion) return;
        
        element.classList.add(animation);
        
        // Remove animation class after completion
        element.addEventListener('animationend', () => {
            element.classList.remove(animation);
        }, { once: true });
    }
    
    // Add ripple effect to click
    addRipple(element, event) {
        if (!element || this.prefersReducedMotion) return;
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            top: ${y}px;
            left: ${x}px;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            pointer-events: none;
            transform: scale(0);
            animation: ripple-expand 0.3s ease-out;
        `;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        // Add ripple animation keyframes if not exists
        if (!document.getElementById('ripple-styles')) {
            const style = document.createElement('style');
            style.id = 'ripple-styles';
            style.textContent = `
                @keyframes ripple-expand {
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            ripple.remove();
        }, 300);
    }
    
    // Enhanced button interactions
    enhanceButton(button) {
        if (!button) return;
        
        button.classList.add('enhanced-button');
        
        // Add click ripple effect
        button.addEventListener('click', (e) => {
            this.addRipple(button, e);
            this.haptic('light');
        });
        
        // Add hover effects
        button.addEventListener('mouseenter', () => {
            if (!this.prefersReducedMotion) {
                button.style.transform = 'translateY(-1px)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = '';
        });
        
        // Add focus handling
        button.classList.add('focus-ring');
    }
    
    // Progress indicator
    createProgressBar(container, options = {}) {
        const { 
            initialValue = 0, 
            animated = true,
            color = 'var(--color-medium-gray)'
        } = options;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.background = color;
        progressFill.style.width = `${initialValue}%`;
        
        if (animated && !this.prefersReducedMotion) {
            progressFill.classList.add('pulse');
        }
        
        progressBar.appendChild(progressFill);
        container.appendChild(progressBar);
        
        return {
            update: (value) => {
                progressFill.style.width = `${Math.max(0, Math.min(100, value))}%`;
            },
            complete: () => {
                progressFill.style.width = '100%';
                progressFill.style.background = 'var(--success)';
                setTimeout(() => {
                    progressBar.classList.add('fade-out');
                    setTimeout(() => progressBar.remove(), 300);
                }, 500);
            },
            remove: () => progressBar.remove()
        };
    }
    
    // Keyboard navigation helper
    enhanceKeyboardNavigation(container) {
        if (!container) return;
        
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                // Let default behavior handle tab navigation
                return;
            }
            
            if (e.key === 'Enter' || e.key === ' ') {
                const focused = document.activeElement;
                if (focused && focused.hasAttribute('role') && focused.getAttribute('role') === 'button') {
                    e.preventDefault();
                    focused.click();
                    this.haptic('light');
                }
            }
        });
    }
}

// Export singleton instance
export default new InteractionManager();