import db from '../../core/db.js';
import performanceMonitor from '../../shared/utils/performance.js';
import interactionManager from '../../shared/utils/interactions.js';
import { auth } from '../../core/auth.js';
import { syncService } from '../../core/sync.js';

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Handle auth form submission
async function handleAuthSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const emailInput = form.querySelector('#auth-email');
    const submitButton = form.querySelector('#auth-submit');
    const errorMessage = form.querySelector('#auth-error');
    const successMessage = form.querySelector('#auth-success');
    
    const email = emailInput.value.trim();
    
    // Reset messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    // Validate email
    if (!email) {
        showError(errorMessage, 'Please enter your email address');
        emailInput.focus();
        return;
    }
    
    if (!isValidEmail(email)) {
        showError(errorMessage, 'Please enter a valid email address');
        emailInput.focus();
        return;
    }
    
    // Show loading state
    const loadingHandler = interactionManager.showLoading(submitButton, {
        text: 'Sending magic link...'
    });
    
    try {
        // Haptic feedback
        interactionManager.haptic('light');
        
        // Send magic link via auth service
        await auth.requestMagicLink(email);
        
        // Show success
        showSuccess(successMessage, `Magic link sent to ${email}. Check your inbox!`);
        
        // Clear form
        emailInput.value = '';
        
        interactionManager.haptic('success');
        
    } catch (error) {
        console.error('[Settings] Magic link failed:', error);
        showError(errorMessage, error.message || 'Failed to send magic link. Please try again.');
        interactionManager.haptic('error');
    } finally {
        loadingHandler.stop();
    }
}

// Handle logout
async function handleLogout() {
    try {
        // Haptic feedback
        interactionManager.haptic('medium');
        
        // Use auth service to logout
        auth.logout();
        
        // Stop sync service
        syncService.stopAutoSync();
        
        // Re-render to show login form
        await render();
        
        interactionManager.haptic('success');
        
    } catch (error) {
        console.error('[Settings] Logout failed:', error);
    }
}

// Show error message
function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.classList.add('fade-in');
}

// Show success message
function showSuccess(element, message) {
    element.textContent = message;
    element.style.display = 'block';
    element.classList.add('fade-in');
}

// Handle email input validation
function handleEmailInput(event) {
    const input = event.target;
    const email = input.value.trim();
    
    // Clear previous validation
    input.classList.remove('input-error', 'input-valid');
    
    if (email && isValidEmail(email)) {
        input.classList.add('input-valid');
    } else if (email) {
        input.classList.add('input-error');
    }
}

export async function render() {
    performanceMonitor.mark('settings-start');
    
    const app = document.getElementById('app');
    const isAuthenticated = auth.isAuthenticated();
    const user = auth.getCurrentUser();
    
    app.innerHTML = `
        <div class="settings-container fade-in-target" data-page="settings">
            <header class="settings-header">
                <button 
                    onclick="router.navigate('/')" 
                    class="back-button hover-scale focus-ring"
                    aria-label="Back to home"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                <h1 class="settings-title">Settings</h1>
            </header>
            
            <main class="settings-main">
                <div class="settings-content">
                    
                    ${isAuthenticated ? renderAuthenticatedState(user) : renderAuthForm()}
                    
                    <div class="settings-section">
                        <h2 class="settings-section-title">Sync</h2>
                        <div class="setting-item">
                            <div class="setting-info">
                                <label class="setting-label" for="sync-toggle">Sync entries across devices</label>
                                <p class="setting-description">Keep your meditation journal synchronized across all your devices</p>
                            </div>
                            <div class="setting-control">
                                <input 
                                    type="checkbox" 
                                    id="sync-toggle" 
                                    class="toggle-input"
                                    ${isAuthenticated ? '' : 'disabled'}
                                    ${syncService.syncEnabled ? 'checked' : ''}
                                >
                                <label for="sync-toggle" class="toggle-label">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        ${!isAuthenticated ? '<p class="setting-note">Sign in to enable sync</p>' : ''}
                    </div>
                    
                    <div class="settings-section">
                        <h2 class="settings-section-title">About</h2>
                        <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Version</span>
                                <span class="setting-value">1.0.0</span>
                            </div>
                        </div>
                        <div class="setting-item">
                            <div class="setting-info">
                                <span class="setting-label">Storage</span>
                                <span class="setting-value" id="storage-info">Calculating...</span>
                            </div>
                        </div>
                    </div>
                    
                </div>
            </main>
        </div>
    `;
    
    // Set up event listeners
    setupEventListeners();
    
    // Update storage info
    updateStorageInfo();
    
    performanceMonitor.mark('settings-ready');
    performanceMonitor.measure('settings-load', 'settings-start', 'settings-ready');
}

function renderAuthForm() {
    return `
        <div class="settings-section">
            <h2 class="settings-section-title">Account</h2>
            <p class="settings-section-description">
                Sign in with your email to sync your meditation journal across devices
            </p>
            
            <form id="auth-form" class="auth-form">
                <div class="form-group">
                    <label for="auth-email" class="form-label">Email address</label>
                    <input 
                        type="email" 
                        id="auth-email" 
                        class="form-input"
                        placeholder="Enter your email"
                        autocomplete="email"
                        autocapitalize="none"
                        autocorrect="off"
                        spellcheck="false"
                        required
                    >
                </div>
                
                <div id="auth-error" class="auth-message auth-error" style="display: none;"></div>
                <div id="auth-success" class="auth-message auth-success" style="display: none;"></div>
                
                <button 
                    type="submit" 
                    id="auth-submit" 
                    class="auth-button primary-action hover-lift"
                >
                    Send magic link
                </button>
                
                <p class="auth-note">
                    We'll send you a secure link to sign in. No passwords required.
                </p>
            </form>
        </div>
    `;
}

function renderAuthenticatedState(user) {
    const lastSync = localStorage.getItem('lastSyncTime');
    return `
        <div class="settings-section">
            <h2 class="settings-section-title">Account</h2>
            <div class="auth-status">
                <div class="auth-status-info">
                    <div class="auth-email">${user.email}</div>
                    <div class="auth-status-text">Signed in</div>
                    ${lastSync ? `<div class="auth-last-sync">Last sync: ${formatLastSync(parseInt(lastSync))}</div>` : ''}
                </div>
                <button 
                    onclick="window.handleLogout()" 
                    class="auth-logout hover-fade"
                >
                    Sign out
                </button>
            </div>
        </div>
    `;
}

function setupEventListeners() {
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
        
        const emailInput = document.getElementById('auth-email');
        emailInput.addEventListener('input', handleEmailInput);
        emailInput.addEventListener('blur', handleEmailInput);
        
        // Auto-focus email input
        setTimeout(() => emailInput.focus(), 100);
    }
    
    // Make logout function available globally
    window.handleLogout = handleLogout;
    
    // Sync toggle handler
    const syncToggle = document.getElementById('sync-toggle');
    if (syncToggle) {
        syncToggle.addEventListener('change', async (e) => {
            if (e.target.checked) {
                syncService.startAutoSync();
            } else {
                syncService.stopAutoSync();
            }
            interactionManager.haptic('light');
        });
    }
}

function formatLastSync(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

async function updateStorageInfo() {
    try {
        // Get storage estimate if available
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            const used = Math.round((estimate.usage || 0) / 1024 / 1024 * 100) / 100;
            const quota = Math.round((estimate.quota || 0) / 1024 / 1024);
            
            const storageInfo = document.getElementById('storage-info');
            if (storageInfo) {
                storageInfo.textContent = `${used} MB used of ${quota} MB`;
            }
        } else {
            const storageInfo = document.getElementById('storage-info');
            if (storageInfo) {
                storageInfo.textContent = 'Storage info unavailable';
            }
        }
    } catch (error) {
        console.error('[Settings] Failed to get storage info:', error);
        const storageInfo = document.getElementById('storage-info');
        if (storageInfo) {
            storageInfo.textContent = 'Unable to calculate';
        }
    }
}

export function cleanup() {
    // Clean up global references
    delete window.handleLogout;
}