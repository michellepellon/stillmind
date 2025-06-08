import { router } from './router.js';
import db from './core/db.js';
import offlineManager from './core/offline.js';
import interactionManager from './shared/utils/interactions.js';
import performanceMonitor from './shared/utils/performance.js';
import eventDelegate from './shared/utils/events.js';
import styleLoader from './shared/utils/style-loader.js';
import { auth } from './core/auth.js';
import { syncService } from './core/sync.js';

console.log('StillMind app initialized');

// Performance marks
performanceMonitor.mark('app-start');

// Load UI preferences
styleLoader.loadPreference();

// Initialize offline manager
offlineManager.subscribe((isOnline) => {
    document.body.classList.toggle('offline', !isOnline);
    console.log('[App] Connection status:', isOnline ? 'online' : 'offline');
});

// Initialize database
db.init().then(() => {
    console.log('[App] Database initialized');
    performanceMonitor.mark('db-ready');
    performanceMonitor.measure('db-init', 'app-start', 'db-ready');
    
    // Hide splash screen after initialization
    hideSplashScreen();
}).catch(error => {
    console.error('[App] Database initialization failed:', error);
    // Hide splash screen even on error
    hideSplashScreen();
});

// Hide splash screen function
function hideSplashScreen() {
    const splash = document.getElementById('splash');
    if (splash) {
        // Add fade out class
        splash.classList.add('fade-out');
        
        // Remove element after animation
        setTimeout(() => {
            splash.remove();
        }, 300);
    }
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('[App] Service Worker registered with scope:', registration.scope);
                
                // Log update found
                registration.addEventListener('updatefound', () => {
                    console.log('[App] Service Worker update found');
                });
            })
            .catch((error) => {
                console.error('[App] Service Worker registration failed:', error);
            });
    });
    
    // Listen for service worker controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[App] Service Worker controller changed');
    });
    
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[App] Message from service worker:', event.data);
        
        if (event.data && event.data.type === 'SYNC_ENTRIES') {
            // Handle sync request
            console.log('[App] Sync requested by service worker');
            // Could trigger data sync here if we had a backend
        }
    });
    
    // Register background sync if supported
    if ('sync' in self.registration) {
        // Register one-time sync when going offline
        offlineManager.subscribe(async (isOnline) => {
            if (!isOnline) {
                try {
                    await self.registration.sync.register('sync-entries');
                    console.log('[App] Background sync registered');
                } catch (error) {
                    console.error('[App] Background sync registration failed:', error);
                }
            }
        });
    }
    
    // Register periodic background sync if supported
    if ('periodicSync' in self.registration) {
        registerPeriodicSync();
    }
}

// Register periodic sync
async function registerPeriodicSync() {
    try {
        const status = await navigator.permissions.query({
            name: 'periodic-background-sync'
        });
        
        if (status.state === 'granted') {
            await self.registration.periodicSync.register('sync-entries-periodic', {
                minInterval: 24 * 60 * 60 * 1000 // 24 hours
            });
            console.log('[App] Periodic background sync registered');
        }
    } catch (error) {
        console.error('[App] Periodic sync registration failed:', error);
    }
}

// Register navigation hooks
router.before((from, to) => {
    console.log(`[App] Navigating from ${from} to ${to}`);
});

router.after((to, params) => {
    console.log(`[App] Navigation complete to ${to}`, params);
});

// Register routes with lazy loading
router.register('/', { 
    module: './features/today/today.js', 
    method: 'render' 
});

router.register('/write', { 
    module: './features/write/write-refined.js', 
    method: 'render' 
});

router.register('/history', { 
    module: './features/history/history.js', 
    method: 'render' 
});

router.register('/entry/:id', { 
    module: './features/entry/entry-refined.js', 
    method: 'render' 
});

router.register('/settings', { 
    module: './features/settings/settings.js', 
    method: 'render' 
});

// Make router available globally for onclick handlers
window.router = router;

// PWA install prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    console.log('[App] Install prompt available');
    
    // Show install button if on home screen
    if (router.isActive('/')) {
        showInstallButton();
    }
});

window.addEventListener('appinstalled', () => {
    console.log('[App] PWA was installed');
    deferredPrompt = null;
    hideInstallButton();
});

function showInstallButton() {
    // Only show if we have a deferred prompt and not already installed
    if (!deferredPrompt || window.matchMedia('(display-mode: standalone)').matches) {
        return;
    }
    
    // Add install button to home screen
    const todayScreen = document.querySelector('.flex.flex-col.items-center.justify-center.min-h-full');
    if (todayScreen && !document.querySelector('.install-button')) {
        const installButton = document.createElement('button');
        installButton.className = 'install-button text-link mt-lg';
        installButton.textContent = 'Install app';
        installButton.onclick = async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`[App] User response to install prompt: ${outcome}`);
            
            if (outcome === 'accepted') {
                deferredPrompt = null;
                hideInstallButton();
            }
        };
        
        const container = todayScreen.querySelector('.text-center');
        if (container) {
            container.appendChild(installButton);
        }
    }
}

function hideInstallButton() {
    const button = document.querySelector('.install-button');
    if (button) {
        button.remove();
    }
}

// Show install button after navigation to home
router.after(async (path) => {
    if (path === '/') {
        setTimeout(showInstallButton, 100);
    } else {
        hideInstallButton();
    }
    
    // Load page-specific styles
    try {
        await styleLoader.loadPageStyles(path === '/' ? 'today' : path.slice(1));
    } catch (error) {
        console.warn('[App] Failed to load page styles:', error);
    }
    
    // Enhance interactions on route change
    enhancePageInteractions();
    
    // Log performance after route change
    performanceMonitor.mark(`route-${path.replace('/', 'home')}-complete`);
});

// Global interaction enhancements
function enhancePageInteractions() {
    // Add keyboard navigation to main app
    const app = document.getElementById('app');
    interactionManager.enhanceKeyboardNavigation(app);
    
    // Enhance all buttons on the page
    const buttons = document.querySelectorAll('button, [role="button"]');
    buttons.forEach(button => {
        if (!button.classList.contains('enhanced-button')) {
            interactionManager.enhanceButton(button);
        }
    });
    
    // Add entrance animations to main content
    const mainContent = document.querySelector('[data-page], .fade-in-target');
    if (mainContent && !mainContent.classList.contains('animated')) {
        mainContent.classList.add('animated');
        interactionManager.animateIn(mainContent, 'fade-in-up');
    }
}

// Performance monitoring
window.addEventListener('load', () => {
    setTimeout(() => {
        performanceMonitor.logSummary();
    }, 2000);
});

// Log performance metrics periodically in development
if (process?.env?.NODE_ENV === 'development') {
    setInterval(() => {
        const memory = performanceMonitor.getMemoryUsage();
        if (memory) {
            console.log(`[Performance] Memory: ${memory.used}MB used`);
        }
    }, 30000);
}