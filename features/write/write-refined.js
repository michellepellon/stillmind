import db from '../../core/db.js';
import { getEntryMetadata } from '../../shared/utils/entry.js';
import offlineManager from '../../core/offline.js';
import interactionManager from '../../shared/utils/interactions.js';
import performanceMonitor from '../../shared/utils/performance.js';

/*
REFINED WRITING EXPERIENCE
Following the principles of:
- Deep Work by Cal Newport
- Distraction-free design by John Gruber
- Apple's focus on single-task interfaces
- Tufte's respect for the reader's intelligence

The interface disappears, leaving only thought and text.
*/

// Writing state
let currentEntry = '';
let currentEntryId = null;
let currentPromptId = null;
let currentDuration = null;
let saveTimeout = null;
let lastSavedTime = null;
let lastSavedContent = '';
let hasShownDurationPicker = false;
let isWritingMode = false;

// Refined auto-save with intelligent timing
const SAVE_DELAY_WHILE_TYPING = 3000;  // 3 seconds while actively typing
const SAVE_DELAY_AFTER_PAUSE = 1000;   // 1 second after pause
const LONG_PAUSE_THRESHOLD = 5000;     // 5 seconds = long pause

let lastKeystroke = 0;
let keystrokeCount = 0;

// Set up refined textarea behavior
function setupRefinedTextarea(textarea) {
    // Perfect auto-expanding behavior
    const adjustHeight = () => {
        performanceMonitor.raf(() => {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        });
    };
    
    // Intelligent typing detection
    const handleInput = (e) => {
        const now = Date.now();
        const timeSinceLastKeystroke = now - lastKeystroke;
        
        lastKeystroke = now;
        keystrokeCount++;
        
        currentEntry = e.target.value;
        
        // Adjust height
        adjustHeight();
        
        // Clear existing save timeout
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        // Don't save empty content
        if (!currentEntry.trim()) {
            updateSaveIndicator('');
            return;
        }
        
        // Show saving indicator immediately for feedback
        updateSaveIndicator('saving');
        
        // Determine save delay based on typing pattern
        const isActivelyTyping = timeSinceLastKeystroke < 500; // Less than 500ms between keystrokes
        const saveDelay = isActivelyTyping ? SAVE_DELAY_WHILE_TYPING : SAVE_DELAY_AFTER_PAUSE;
        
        // Set up auto-save
        saveTimeout = setTimeout(async () => {
            if (currentEntry.trim()) {
                await performAutoSave();
            }
        }, saveDelay);
    };
    
    // Handle paste events
    const handlePaste = () => {
        setTimeout(() => {
            adjustHeight();
            if (currentEntry.trim()) {
                updateSaveIndicator('saving');
                setTimeout(performAutoSave, 500);
            }
        }, 0);
    };
    
    // Writing mode detection (for hiding UI)
    const handleFocus = () => {
        setTimeout(() => {
            isWritingMode = true;
            document.body.classList.add('writing-mode');
        }, 2000); // Enter writing mode after 2 seconds of focus
    };
    
    const handleBlur = () => {
        isWritingMode = false;
        document.body.classList.remove('writing-mode');
    };
    
    // Event listeners
    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('paste', handlePaste);
    textarea.addEventListener('focus', handleFocus);
    textarea.addEventListener('blur', handleBlur);
    
    // Window resize handler
    const handleResize = performanceMonitor.throttle(adjustHeight, 150);
    window.addEventListener('resize', handleResize);
    
    // Initial height adjustment
    adjustHeight();
    
    // Cleanup function
    textarea._cleanup = () => {
        textarea.removeEventListener('input', handleInput);
        textarea.removeEventListener('paste', handlePaste);
        textarea.removeEventListener('focus', handleFocus);
        textarea.removeEventListener('blur', handleBlur);
        window.removeEventListener('resize', handleResize);
    };
}

// Refined auto-save with better UX
async function performAutoSave() {
    try {
        const entry = {
            timestamp: currentEntryId || Date.now(),
            entry: currentEntry,
            promptId: currentPromptId,
            duration: currentDuration,
            syncStatus: offlineManager.isOnline ? 'local' : 'offline',
            wordCount: getEntryMetadata({ entry: currentEntry }).wordCount,
            lastModified: Date.now()
        };
        
        // Save to database
        const savedId = await db.saveEntry(entry);
        
        // Update state
        if (!currentEntryId) {
            currentEntryId = savedId;
        }
        
        lastSavedTime = Date.now();
        lastSavedContent = currentEntry;
        
        // Update indicator
        const status = offlineManager.isOnline ? 'saved' : 'saved-offline';
        updateSaveIndicator(status);
        
        // Subtle haptic feedback
        interactionManager.haptic('light');
        
        // Show duration picker after substantial writing
        if (!hasShownDurationPicker && !currentDuration && shouldShowDurationPicker()) {
            hasShownDurationPicker = true;
            setTimeout(() => showDurationPicker(), 2000);
        }
        
        console.log('[Write] Auto-saved entry:', savedId);
        
    } catch (error) {
        console.error('[Write] Auto-save failed:', error);
        updateSaveIndicator('error');
        interactionManager.haptic('error');
    }
}

// Intelligent duration picker timing
function shouldShowDurationPicker() {
    const metadata = getEntryMetadata({ entry: currentEntry });
    return metadata.wordCount >= 50 && currentEntry.includes('.'); // At least 50 words and contains a sentence
}

// Refined save indicator
function updateSaveIndicator(status) {
    const indicator = document.getElementById('save-indicator');
    if (!indicator) return;
    
    indicator.classList.remove('visible', 'success', 'error', 'offline');
    
    switch (status) {
        case 'saving':
            indicator.textContent = 'Saving...';
            indicator.classList.add('visible');
            break;
            
        case 'saved':
            const timeAgo = getRelativeTime(lastSavedTime);
            indicator.textContent = timeAgo ? `Saved ${timeAgo}` : 'Saved';
            indicator.classList.add('visible', 'success');
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                if (indicator.textContent.includes('Saved')) {
                    indicator.classList.remove('visible');
                }
            }, 3000);
            break;
            
        case 'saved-offline':
            const offlineTimeAgo = getRelativeTime(lastSavedTime);
            indicator.textContent = offlineTimeAgo ? `Saved offline ${offlineTimeAgo}` : 'Saved offline';
            indicator.classList.add('visible', 'offline');
            break;
            
        case 'error':
            indicator.textContent = 'Failed to save';
            indicator.classList.add('visible', 'error');
            break;
            
        default:
            indicator.classList.remove('visible');
            break;
    }
}

// Relative time formatting
function getRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return 'recently';
}

// Enhanced escape key handling
function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        // If duration picker is open, close it
        const durationPicker = document.querySelector('.duration-picker');
        if (durationPicker) {
            hideDurationPicker();
            return;
        }
        
        // If in writing mode, exit writing mode first
        if (isWritingMode) {
            isWritingMode = false;
            document.body.classList.remove('writing-mode');
            return;
        }
        
        // Check for unsaved changes
        if (hasUnsavedChanges()) {
            showUnsavedChangesDialog();
        } else {
            navigateBack();
        }
    }
}

// Check for unsaved changes
function hasUnsavedChanges() {
    return currentEntry.trim() && currentEntry !== lastSavedContent;
}

// Refined unsaved changes dialog
function showUnsavedChangesDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'unsaved-dialog';
    dialog.innerHTML = `
        <div class="unsaved-dialog-content">
            <h3 class="unsaved-dialog-title">Unsaved Changes</h3>
            <p class="unsaved-dialog-message">Your writing hasn't been saved yet. What would you like to do?</p>
            <div class="unsaved-dialog-actions">
                <button class="btn btn-secondary" onclick="this.closest('.unsaved-dialog').remove()">
                    Keep Writing
                </button>
                <button class="btn btn-primary" onclick="saveAndExit()">
                    Save & Exit
                </button>
                <button class="btn btn-ghost" onclick="discardAndExit()">
                    Discard
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Focus the save button
    dialog.querySelector('.btn-primary').focus();
    
    // Make functions available globally
    window.saveAndExit = async () => {
        if (currentEntry.trim()) {
            await performAutoSave();
        }
        dialog.remove();
        navigateBack();
    };
    
    window.discardAndExit = () => {
        dialog.remove();
        navigateBack();
    };
}

// Navigate back to home
function navigateBack() {
    router.navigate('/');
}

// Duration picker (simplified)
function showDurationPicker() {
    const picker = document.createElement('div');
    picker.className = 'duration-picker';
    picker.innerHTML = `
        <div class="duration-picker-content">
            <h3 class="duration-picker-title">How long did you meditate?</h3>
            <div class="duration-options">
                ${[5, 10, 15, 20, 30].map(min => `
                    <button class="duration-option" onclick="selectDuration(${min})">
                        ${min} min
                    </button>
                `).join('')}
            </div>
            <button class="duration-skip" onclick="skipDuration()">
                Skip for now
            </button>
        </div>
    `;
    
    document.body.appendChild(picker);
    
    // Animate in
    requestAnimationFrame(() => {
        picker.classList.add('visible');
    });
    
    // Global functions
    window.selectDuration = async (minutes) => {
        currentDuration = minutes;
        localStorage.setItem('lastDuration', minutes);
        
        // Save with duration
        await performAutoSave();
        
        // Haptic feedback
        interactionManager.haptic('success');
        
        hideDurationPicker();
    };
    
    window.skipDuration = () => {
        hideDurationPicker();
    };
}

function hideDurationPicker() {
    const picker = document.querySelector('.duration-picker');
    if (picker) {
        picker.classList.remove('visible');
        setTimeout(() => picker.remove(), 300);
    }
}

// Main render function
export async function render() {
    performanceMonitor.mark('write-start');
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
            hasShownDurationPicker = true;
        }
    } else {
        // Get prompt ID from session storage
        currentPromptId = window.sessionStorage.getItem('currentPromptId');
        window.sessionStorage.removeItem('currentPromptId');
    }
    
    app.innerHTML = `
        <div class="write-container" data-page="write">
            <header class="write-header">
                <button 
                    onclick="router.navigate('/')" 
                    class="write-back-btn focus-ring touch-target" 
                    aria-label="Finish writing and return home"
                >
                    <svg class="write-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span class="write-back-text">Done</span>
                </button>
                
                <div class="write-save-indicator" id="save-indicator" aria-live="polite"></div>
                
                <div class="write-header-spacer"></div>
            </header>
            
            <main class="write-main">
                <div class="write-content">
                    <textarea 
                        id="write-textarea"
                        class="write-textarea focus-ring"
                        placeholder="What's on your mind?"
                        aria-label="Journal entry"
                        spellcheck="true"
                        autocapitalize="sentences"
                        autocorrect="on"
                        data-gramm="false"
                        rows="3"
                    >${currentEntry}</textarea>
                </div>
            </main>
        </div>
    `;
    
    // Set up the refined textarea
    const textarea = document.getElementById('write-textarea');
    if (textarea) {
        setupRefinedTextarea(textarea);
        
        // Perfect focus experience
        requestAnimationFrame(() => {
            textarea.focus();
            
            // Position cursor at end
            const length = textarea.value.length;
            textarea.setSelectionRange(length, length);
            
            // Scroll to show cursor if content exists
            if (length > 0) {
                textarea.scrollTop = textarea.scrollHeight;
            }
        });
    }
    
    // Update save indicator if we have a saved entry
    if (lastSavedTime) {
        updateSaveIndicator(offlineManager.isOnline ? 'saved' : 'saved-offline');
    }
    
    performanceMonitor.mark('write-ready');
    performanceMonitor.measure('write-render', 'write-start', 'write-ready');
}

// Cleanup function
export function cleanup() {
    // Remove escape key listener
    document.removeEventListener('keydown', handleEscapeKey);
    
    // Clear save timeout if pending
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        
        // Perform final save if there's unsaved content
        if (hasUnsavedChanges()) {
            performAutoSave();
        }
    }
    
    // Clean up textarea
    const textarea = document.getElementById('write-textarea');
    if (textarea && textarea._cleanup) {
        textarea._cleanup();
    }
    
    // Exit writing mode
    isWritingMode = false;
    document.body.classList.remove('writing-mode');
    
    // Clean up global functions
    delete window.saveAndExit;
    delete window.discardAndExit;
    delete window.selectDuration;
    delete window.skipDuration;
}