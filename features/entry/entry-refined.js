import db from '../../core/db.js';
import { 
    formatDate, 
    formatTime, 
    formatDuration,
    getEntryMetadata,
    calculateReadingTime 
} from '../../shared/utils/entry.js';

let currentEntry = null;
let isEditMode = false;
let hasUnsavedChanges = false;
let autoSaveTimeout = null;
let isReadingMode = false;

export async function render(params) {
    const app = document.getElementById('app');
    const entryId = parseInt(params.id);
    
    // Show loading state with refined styling
    app.innerHTML = `
        <div class="entry-refined-container">
            <div class="entry-loading">
                <div class="loading-indicator"></div>
            </div>
        </div>
    `;
    
    try {
        // Fetch entry from database
        const entry = await db.getEntry(entryId);
        
        if (!entry) {
            showNotFound(app);
            return;
        }
        
        currentEntry = entry;
        renderEntry(app);
        
    } catch (error) {
        console.error('[Entry] Error loading entry:', error);
        showError(app);
    }
}

function renderEntry(app) {
    const entry = currentEntry;
    const metadata = getEntryMetadata(entry);
    const readingTime = calculateReadingTime(metadata.wordCount);
    
    // Format dates
    const fullDate = formatDate(entry.timestamp, 'full');
    const time = formatTime(entry.timestamp);
    const duration = entry.duration ? formatDuration(entry.duration) : '';
    
    // Get prompt text if available
    const promptText = getPromptText(entry.promptId);
    
    app.innerHTML = `
        <div class="entry-refined-container">
            ${renderHeader()}
            ${renderEntryContent(entry, metadata, readingTime, fullDate, time, duration, promptText)}
        </div>
    `;
    
    setupEventListeners();
    
    // Enter reading mode after a short delay
    setTimeout(() => {
        if (!isEditMode) {
            enterReadingMode();
        }
    }, 3000);
}

function renderHeader() {
    return `
        <header class="entry-refined-header">
            <div class="header-content">
                <button 
                    class="back-button"
                    onclick="handleBack()"
                    aria-label="Back to history"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                
                <div class="entry-actions">
                    ${isEditMode ? `
                        <button 
                            class="action-button action-button--secondary"
                            onclick="cancelEdit()"
                            aria-label="Cancel editing"
                        >
                            Cancel
                        </button>
                        <button 
                            class="action-button action-button--primary"
                            onclick="saveEntry()"
                            aria-label="Save changes"
                            ${hasUnsavedChanges ? '' : 'disabled'}
                        >
                            Save
                        </button>
                    ` : `
                        <button 
                            class="action-button"
                            onclick="enterEditMode()"
                            aria-label="Edit entry"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button 
                            class="action-button action-button--danger"
                            onclick="deleteEntry()"
                            aria-label="Delete entry"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    `}
                </div>
            </div>
            
            ${hasUnsavedChanges ? `
                <div class="save-indicator">
                    <div class="save-indicator-dot"></div>
                    <span>Unsaved changes</span>
                </div>
            ` : ''}
        </header>
    `;
}

function renderEntryContent(entry, metadata, readingTime, fullDate, time, duration, promptText) {
    return `
        <article class="entry-refined-content">
            <header class="entry-meta">
                <div class="entry-meta-primary">
                    <time class="entry-date">${fullDate}</time>
                    <div class="entry-details">
                        <time class="entry-time">${time}</time>
                        ${duration ? `<span class="entry-duration">${duration} meditation</span>` : ''}
                    </div>
                </div>
                <div class="entry-meta-secondary">
                    <span class="reading-time">${readingTime} min read</span>
                    <span class="word-count">${metadata.wordCount} words</span>
                    ${entry.lastModified && entry.lastModified !== entry.timestamp ? 
                        `<span class="last-modified">Edited ${formatDate(entry.lastModified, 'relative')}</span>` : 
                        ''
                    }
                </div>
            </header>
            
            ${promptText ? `
                <div class="entry-prompt">
                    <div class="prompt-indicator">Prompt</div>
                    <p class="prompt-text">${promptText}</p>
                </div>
            ` : ''}
            
            <div class="entry-body">
                ${isEditMode ? 
                    renderEditableContent(entry.entry) : 
                    renderReadableContent(entry.entry)
                }
            </div>
            
            ${!isEditMode ? `
                <footer class="entry-footer">
                    <div class="entry-completion-marker"></div>
                </footer>
            ` : ''}
        </article>
    `;
}

function renderReadableContent(content) {
    if (!content || !content.trim()) {
        return '<div class="entry-empty">This space awaits your reflections</div>';
    }
    
    // Enhanced paragraph processing for better reading experience
    const paragraphs = content
        .split(/\n\n+/)
        .filter(p => p.trim())
        .map((p, index) => {
            const trimmed = p.trim();
            // Add subtle entrance animation delay
            return `<p class="entry-paragraph" style="--entrance-delay: ${index * 50}ms">${escapeHtml(trimmed)}</p>`;
        })
        .join('');
    
    return `
        <div class="entry-text">
            <div class="entry-reading-content">
                ${paragraphs}
            </div>
        </div>
    `;
}

function renderEditableContent(content) {
    return `
        <textarea 
            class="entry-editor"
            placeholder="Begin writing..."
            spellcheck="true"
            autocomplete="off"
            autocorrect="on"
            autocapitalize="sentences"
        >${escapeHtml(content || '')}</textarea>
    `;
}

function setupEventListeners() {
    if (isEditMode) {
        const editor = document.querySelector('.entry-editor');
        if (editor) {
            // Auto-resize textarea
            editor.addEventListener('input', handleEditorInput);
            editor.addEventListener('focus', handleEditorFocus);
            editor.addEventListener('blur', handleEditorBlur);
            
            // Initial resize
            autoResizeEditor(editor);
            
            // Focus the editor
            setTimeout(() => {
                editor.focus();
                editor.setSelectionRange(editor.value.length, editor.value.length);
            }, 100);
        }
    }
    
    // Handle scroll for reading mode
    if (!isEditMode) {
        let scrollTimeout;
        document.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            exitReadingMode();
            
            scrollTimeout = setTimeout(() => {
                if (!isEditMode) {
                    enterReadingMode();
                }
            }, 2000);
        });
    }
}

function handleEditorInput(e) {
    const editor = e.target;
    autoResizeEditor(editor);
    
    // Track changes
    if (editor.value !== currentEntry.entry) {
        hasUnsavedChanges = true;
        updateSaveButton();
        
        // Auto-save after typing stops
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            autoSave();
        }, 2000);
    } else {
        hasUnsavedChanges = false;
        updateSaveButton();
    }
}

function handleEditorFocus() {
    setTimeout(() => {
        document.body.classList.add('editing-mode');
    }, 1500);
}

function handleEditorBlur() {
    document.body.classList.remove('editing-mode');
}

function autoResizeEditor(editor) {
    editor.style.height = 'auto';
    const newHeight = Math.max(200, editor.scrollHeight);
    editor.style.height = newHeight + 'px';
}

function enterReadingMode() {
    if (!isEditMode) {
        isReadingMode = true;
        document.body.classList.add('reading-mode');
    }
}

function exitReadingMode() {
    isReadingMode = false;
    document.body.classList.remove('reading-mode');
}

function updateSaveButton() {
    const saveButton = document.querySelector('.action-button--primary');
    const saveIndicator = document.querySelector('.save-indicator');
    
    if (saveButton) {
        saveButton.disabled = !hasUnsavedChanges;
    }
    
    if (hasUnsavedChanges && !saveIndicator) {
        // Add save indicator
        const header = document.querySelector('.entry-refined-header');
        if (header) {
            header.innerHTML = renderHeader();
        }
    }
}

async function autoSave() {
    if (!hasUnsavedChanges || !isEditMode) return;
    
    const editor = document.querySelector('.entry-editor');
    if (!editor) return;
    
    try {
        const newContent = editor.value;
        await db.updateEntry(currentEntry.timestamp, {
            entry: newContent,
            lastModified: Date.now()
        });
        
        currentEntry.entry = newContent;
        currentEntry.lastModified = Date.now();
        hasUnsavedChanges = false;
        updateSaveButton();
        
        // Show subtle save confirmation
        showSaveConfirmation();
        
    } catch (error) {
        console.error('[Entry] Auto-save failed:', error);
    }
}

function showSaveConfirmation() {
    const indicator = document.createElement('div');
    indicator.className = 'save-confirmation';
    indicator.textContent = 'Saved';
    
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.classList.add('fade-out');
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 200);
    }, 1500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPromptText(promptId) {
    if (!promptId) return null;
    
    const prompts = [
        "What am I grateful for in this moment?",
        "What emotions am I holding onto today?",
        "How is my body feeling right now?",
        "What would I like to let go of?",
        "What brought me joy recently?",
        "What patterns do I notice in my thoughts?",
        "How can I be kind to myself today?",
        "What am I learning about myself?",
        "What needs my attention right now?",
        "How have I grown recently?",
        "What peace can I find in this moment?",
        "What wisdom is emerging within me?",
        "How am I connected to the world around me?",
        "What intention would serve me today?",
        "What am I curious about right now?"
    ];
    
    const match = promptId.match(/prompt_(\d+)/);
    if (match) {
        const index = parseInt(match[1]);
        return prompts[index] || null;
    }
    
    return null;
}

function showNotFound(app) {
    app.innerHTML = `
        <div class="entry-refined-container">
            <div class="error-state">
                <h2 class="error-title">Entry not found</h2>
                <p class="error-message">This entry may have been deleted.</p>
                <button onclick="handleBack()" class="error-button">
                    Return to history
                </button>
            </div>
        </div>
    `;
}

function showError(app) {
    app.innerHTML = `
        <div class="entry-refined-container">
            <div class="error-state">
                <h2 class="error-title">Unable to load entry</h2>
                <p class="error-message">Something went wrong. Please try again.</p>
                <button onclick="location.reload()" class="error-button">
                    Try again
                </button>
            </div>
        </div>
    `;
}

// Global functions
window.handleBack = function() {
    if (hasUnsavedChanges) {
        if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
            router.navigate('/history');
        }
    } else {
        router.navigate('/history');
    }
};

window.enterEditMode = function() {
    isEditMode = true;
    exitReadingMode();
    renderEntry(document.getElementById('app'));
};

window.cancelEdit = function() {
    if (hasUnsavedChanges) {
        if (confirm('Discard unsaved changes?')) {
            isEditMode = false;
            hasUnsavedChanges = false;
            renderEntry(document.getElementById('app'));
        }
    } else {
        isEditMode = false;
        renderEntry(document.getElementById('app'));
    }
};

window.saveEntry = async function() {
    if (!hasUnsavedChanges) return;
    
    const editor = document.querySelector('.entry-editor');
    if (!editor) return;
    
    try {
        const newContent = editor.value;
        await db.updateEntry(currentEntry.timestamp, {
            entry: newContent,
            lastModified: Date.now()
        });
        
        currentEntry.entry = newContent;
        currentEntry.lastModified = Date.now();
        hasUnsavedChanges = false;
        isEditMode = false;
        
        renderEntry(document.getElementById('app'));
        showSaveConfirmation();
        
    } catch (error) {
        console.error('[Entry] Save failed:', error);
        alert('Failed to save changes. Please try again.');
    }
};

window.deleteEntry = async function() {
    if (!confirm('Delete this entry permanently? This cannot be undone.')) {
        return;
    }
    
    try {
        await db.deleteEntry(currentEntry.timestamp);
        router.navigate('/history');
    } catch (error) {
        console.error('[Entry] Delete failed:', error);
        alert('Failed to delete entry. Please try again.');
    }
};

export function cleanup() {
    clearTimeout(autoSaveTimeout);
    document.body.classList.remove('reading-mode', 'editing-mode');
    
    // Clean up scroll listener
    document.removeEventListener('scroll', arguments.callee);
}