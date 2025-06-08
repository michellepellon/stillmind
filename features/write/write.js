import db from '../../core/db.js';
import { getEntryMetadata } from '../../shared/utils/entry.js';
import offlineManager from '../../core/offline.js';
import interactionManager from '../../shared/utils/interactions.js';
import performanceMonitor from '../../shared/utils/performance.js';

// Store textarea content and entry metadata during session
let currentEntry = '';
let currentEntryId = null;
let currentPromptId = null;
let currentDuration = null;
let saveTimeout = null;
let lastSavedTime = null;
let hasShownDurationPicker = false;

// Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Auto-expand textarea functionality
function setupAutoExpand(textarea) {
    // Function to adjust height using performance monitor
    const adjustHeight = () => {
        performanceMonitor.raf(() => {
            // Reset height to auto to get the correct scrollHeight
            textarea.style.height = 'auto';
            
            // Calculate new height
            const scrollHeight = textarea.scrollHeight;
            const minHeight = parseFloat(getComputedStyle(textarea).minHeight) || 0;
            const newHeight = Math.max(scrollHeight, minHeight);
            
            // Set the new height
            textarea.style.height = newHeight + 'px';
        });
    };
    
    // Debounced version for better performance
    const debouncedAdjust = performanceMonitor.debounce(adjustHeight, 16); // ~60fps
    
    // Initial adjustment
    adjustHeight();
    
    // Adjust on input
    textarea.addEventListener('input', debouncedAdjust);
    
    // Adjust on paste
    textarea.addEventListener('paste', () => {
        setTimeout(adjustHeight, 0);
    });
    
    // Adjust on window resize
    window.addEventListener('resize', debouncedAdjust);
    
    // Clean up function to remove listeners
    textarea._cleanupAutoExpand = () => {
        textarea.removeEventListener('input', debouncedAdjust);
        textarea.removeEventListener('paste', adjustHeight);
        window.removeEventListener('resize', debouncedAdjust);
    };
}

// Auto-save function
async function autoSave() {
    try {
        // Add saving feedback
        const saveIndicator = document.querySelector('.save-indicator');
        if (saveIndicator) {
            updateSaveIndicator('saving');
        }
        
        const entry = {
            timestamp: currentEntryId || Date.now(),
            entry: currentEntry,
            promptId: currentPromptId,
            duration: currentDuration,
            syncStatus: offlineManager.isOnline ? 'local' : 'offline'
        };
        
        // Save to database
        const savedId = await db.saveEntry(entry);
        
        // Update current entry ID
        if (!currentEntryId) {
            currentEntryId = savedId;
        }
        
        // Update save time and indicator
        lastSavedTime = Date.now();
        lastSavedContent = currentEntry;
        updateSaveIndicator(offlineManager.isOnline ? 'saved' : 'saved-offline');
        
        // Haptic feedback for successful save
        interactionManager.haptic('light');
        
        // Add subtle pulse animation
        const header = document.querySelector('.write-header');
        if (header) {
            header.classList.add('save-pulse');
            setTimeout(() => {
                header.classList.remove('save-pulse');
            }, 600);
        }
        
        // Show duration picker after first save if not shown yet
        if (!hasShownDurationPicker && !currentDuration && currentEntry.trim().length > 50) {
            hasShownDurationPicker = true;
            setTimeout(() => showDurationPicker(), 1000);
        }
        
        console.log('[Write] Auto-saved entry:', savedId);
    } catch (error) {
        console.error('[Write] Auto-save failed:', error);
        updateSaveIndicator('error');
    }
}

// Create save indicator element
function createSaveIndicator() {
    const header = document.querySelector('.write-header');
    const indicator = document.createElement('div');
    indicator.className = 'save-indicator';
    indicator.style.cssText = `
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        font-size: var(--font-size-sm);
        color: var(--color-medium-gray);
        opacity: 0;
        transition: opacity 200ms ease-out;
    `;
    
    if (header) {
        header.style.position = 'relative';
        header.appendChild(indicator);
    }
    
    return indicator;
}

// Update save indicator
function updateSaveIndicator(status) {
    const indicator = document.querySelector('.save-indicator');
    if (!indicator) return;
    
    switch (status) {
        case 'saving':
            indicator.textContent = 'Saving...';
            indicator.style.opacity = '0.6';
            indicator.style.color = '';
            break;
            
        case 'saved':
            const timeAgo = getRelativeTime(lastSavedTime);
            indicator.textContent = `Saved ${timeAgo}`;
            indicator.style.opacity = '0.6';
            indicator.style.color = '';
            
            // Update time periodically
            if (indicator._updateInterval) {
                clearInterval(indicator._updateInterval);
            }
            indicator._updateInterval = setInterval(() => {
                if (lastSavedTime) {
                    const newTimeAgo = getRelativeTime(lastSavedTime);
                    indicator.textContent = `Saved ${newTimeAgo}`;
                }
            }, 10000); // Update every 10 seconds
            break;
            
        case 'saved-offline':
            const offlineTimeAgo = getRelativeTime(lastSavedTime);
            indicator.textContent = `Saved offline ${offlineTimeAgo}`;
            indicator.style.opacity = '0.8';
            indicator.style.color = 'var(--warning)';
            
            // Update time periodically
            if (indicator._updateInterval) {
                clearInterval(indicator._updateInterval);
            }
            indicator._updateInterval = setInterval(() => {
                if (lastSavedTime) {
                    const newTimeAgo = getRelativeTime(lastSavedTime);
                    indicator.textContent = `Saved offline ${newTimeAgo}`;
                }
            }, 10000); // Update every 10 seconds
            break;
            
        case 'error':
            indicator.textContent = 'Failed to save';
            indicator.style.opacity = '1';
            indicator.style.color = 'var(--error)';
            break;
    }
}

// Get relative time string
function getRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 5000) return 'just now';
    if (diff < 60000) return 'a moment ago';
    if (diff < 120000) return '1 minute ago';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 7200000) return '1 hour ago';
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    
    return 'a while ago';
}

// Show duration picker
function showDurationPicker() {
    // Check if picker already exists
    if (document.querySelector('.duration-picker')) return;
    
    // Get last used duration from settings
    const lastDuration = parseInt(localStorage.getItem('lastDuration') || '15');
    
    const picker = document.createElement('div');
    picker.className = 'duration-picker';
    picker.innerHTML = `
        <div class="duration-picker-content">
            <h3 class="duration-picker-title">How long did you meditate?</h3>
            <div class="duration-options">
                <button onclick="window.selectDuration(5)" class="duration-option ${lastDuration === 5 ? 'duration-option--selected' : ''}">5 min</button>
                <button onclick="window.selectDuration(10)" class="duration-option ${lastDuration === 10 ? 'duration-option--selected' : ''}">10 min</button>
                <button onclick="window.selectDuration(15)" class="duration-option ${lastDuration === 15 ? 'duration-option--selected' : ''}">15 min</button>
                <button onclick="window.selectDuration(20)" class="duration-option ${lastDuration === 20 ? 'duration-option--selected' : ''}">20 min</button>
                <button onclick="window.selectDuration(30)" class="duration-option ${lastDuration === 30 ? 'duration-option--selected' : ''}">30 min</button>
                <button onclick="window.showCustomDuration()" class="duration-option duration-option--custom">...</button>
            </div>
            <button onclick="window.skipDuration()" class="duration-skip">Skip</button>
        </div>
    `;
    
    document.body.appendChild(picker);
    
    // Animate in
    requestAnimationFrame(() => {
        picker.classList.add('duration-picker--visible');
    });
}

// Handle duration selection
window.selectDuration = async function(minutes) {
    currentDuration = minutes;
    localStorage.setItem('lastDuration', minutes);
    
    // Haptic feedback and success animation
    interactionManager.haptic('success');
    
    // Add success feedback to selected button
    const selectedButton = document.querySelector(`[onclick="window.selectDuration(${minutes})"]`);
    if (selectedButton) {
        selectedButton.classList.add('selected-animation');
        selectedButton.innerHTML = `<div class="checkmark"></div> ${minutes} min`;
    }
    
    // Save entry with duration
    await autoSave();
    
    // Hide picker after brief delay to show success state
    setTimeout(() => {
        hideDurationPicker();
    }, 800);
};

// Show custom duration input
window.showCustomDuration = function() {
    const content = document.querySelector('.duration-picker-content');
    if (!content) return;
    
    content.innerHTML = `
        <h3 class="duration-picker-title">Enter meditation duration</h3>
        <div class="duration-custom">
            <input 
                type="number" 
                class="duration-input" 
                placeholder="Minutes" 
                min="1" 
                max="999"
                autofocus
            >
            <button onclick="window.submitCustomDuration()" class="duration-submit">Save</button>
        </div>
        <button onclick="window.skipDuration()" class="duration-skip">Cancel</button>
    `;
    
    // Focus input
    const input = content.querySelector('.duration-input');
    if (input) {
        input.focus();
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.submitCustomDuration();
            }
        });
    }
};

// Submit custom duration
window.submitCustomDuration = function() {
    const input = document.querySelector('.duration-input');
    if (!input) return;
    
    const minutes = parseInt(input.value);
    if (minutes && minutes > 0) {
        window.selectDuration(minutes);
    }
};

// Skip duration selection
window.skipDuration = function() {
    hideDurationPicker();
};

// Hide duration picker
function hideDurationPicker() {
    const picker = document.querySelector('.duration-picker');
    if (!picker) return;
    
    picker.classList.remove('duration-picker--visible');
    
    // Remove after animation
    setTimeout(() => {
        picker.remove();
    }, 300);
}

// Handle escape key for navigation
function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        // Check if duration picker is open
        const durationPicker = document.querySelector('.duration-picker');
        if (durationPicker) {
            hideDurationPicker();
            return;
        }
        
        // Check for unsaved changes
        if (currentEntry.trim() && currentEntry !== lastSavedContent) {
            if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
                router.navigate('/');
            }
        } else {
            router.navigate('/');
        }
    }
}

export async function render() {
    const app = document.getElementById('app');
    
    // Add escape key listener
    document.addEventListener('keydown', handleEscapeKey);
    
    // Check for edit mode
    const editEntryId = window.sessionStorage.getItem('editEntryId');
    if (editEntryId) {
        window.sessionStorage.removeItem('editEntryId');
        const entryToEdit = await db.getEntry(parseInt(editEntryId));
        if (entryToEdit) {
            currentEntry = entryToEdit.entry || '';
            currentEntryId = entryToEdit.timestamp;
            currentPromptId = entryToEdit.promptId;
            currentDuration = entryToEdit.duration;
            lastSavedTime = Date.now();
            lastSavedContent = currentEntry;
            hasShownDurationPicker = true; // Don't show picker for existing entries
        }
    } else {
        // Check for prompt ID from today screen
        const promptId = window.sessionStorage.getItem('currentPromptId');
        if (promptId && !currentPromptId) {
            currentPromptId = promptId;
            window.sessionStorage.removeItem('currentPromptId');
        }
    }
    
    app.innerHTML = `
        <div class="write-container">
            <header class="write-header">
                <button 
                    onclick="router.navigate('/')" 
                    class="back-button"
                    aria-label="Back to home"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                <button 
                    class="save-button"
                    aria-label="Save entry"
                    disabled
                >
                    Save
                </button>
            </header>
            <main class="write-main">
                <div class="write-content">
                    <textarea 
                        class="journal-textarea"
                        placeholder="Start writing..."
                        aria-label="Journal entry"
                    >${currentEntry}</textarea>
                </div>
            </main>
        </div>
    `;
    
    // Get textarea and set up event listeners
    const textarea = app.querySelector('.journal-textarea');
    const saveIndicator = createSaveIndicator();
    
    if (textarea) {
        // Set up auto-expand functionality
        setupAutoExpand(textarea);
        
        // Focus on textarea
        textarea.focus();
        
        // Restore cursor position to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        
        // Set up auto-save
        textarea.addEventListener('input', (e) => {
            currentEntry = e.target.value;
            
            // Clear existing timeout
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            
            // Show "Saving..." indicator immediately if there's content
            if (currentEntry.trim()) {
                updateSaveIndicator('saving');
            }
            
            // Debounce save operation (2 seconds after stopping)
            const debouncedSave = performanceMonitor.debounce(() => {
                if (currentEntry.trim()) {
                    autoSave();
                }
            }, 2000);
            
            saveTimeout = setTimeout(debouncedSave, 0);
        });
    }
    
    // Update save indicator if we have a saved entry
    if (lastSavedTime) {
        updateSaveIndicator('saved');
    }
}

// Clear entry when navigating away
export function cleanup() {
    // Remove escape key listener
    document.removeEventListener('keydown', handleEscapeKey);
    
    // Clear save timeout if pending
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        // Perform final save if there's unsaved content
        if (currentEntry.trim() && currentEntry !== lastSavedContent) {
            autoSave();
        }
    }
    
    // Clear update interval
    const indicator = document.querySelector('.save-indicator');
    if (indicator && indicator._updateInterval) {
        clearInterval(indicator._updateInterval);
    }
    
    // Clean up auto-expand listeners
    const textarea = document.querySelector('.journal-textarea');
    if (textarea && textarea._cleanupAutoExpand) {
        textarea._cleanupAutoExpand();
    }
    
    // Reset state for next session
    currentEntry = '';
    currentEntryId = null;
    currentPromptId = null;
    currentDuration = null;
    lastSavedTime = null;
    hasShownDurationPicker = false;
}

// Track last saved content to detect changes
let lastSavedContent = '';