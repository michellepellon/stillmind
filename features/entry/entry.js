import db from '../../core/db.js';
import { 
    formatDate, 
    formatTime, 
    formatDuration,
    getEntryMetadata,
    calculateReadingTime 
} from '../../shared/utils/entry.js';

export async function render(params) {
    const app = document.getElementById('app');
    const entryId = parseInt(params.id);
    
    // Show loading state
    app.innerHTML = `
        <div class="entry-container">
            <div class="entry-loading">Loading entry...</div>
        </div>
    `;
    
    try {
        // Fetch entry from database
        const entry = await db.getEntry(entryId);
        
        if (!entry) {
            showNotFound(app);
            return;
        }
        
        // Get metadata
        const metadata = getEntryMetadata(entry);
        const readingTime = calculateReadingTime(metadata.wordCount);
        
        // Format dates
        const fullDate = formatDate(entry.timestamp, 'full');
        const time = formatTime(entry.timestamp);
        const duration = entry.duration ? formatDuration(entry.duration) : '';
        
        // Get prompt text if available
        const promptText = getPromptText(entry.promptId);
        
        app.innerHTML = `
            <div class="entry-container">
                <header class="entry-detail-header">
                    <button 
                        onclick="router.navigate('/history')" 
                        class="back-button"
                        aria-label="Back to history"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <div class="entry-actions">
                        <button 
                            onclick="window.editEntry(${entry.timestamp})" 
                            class="action-button"
                            aria-label="Edit entry"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button 
                            onclick="window.deleteEntry(${entry.timestamp})" 
                            class="action-button action-button--danger"
                            aria-label="Delete entry"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </header>
                
                <article class="entry-detail">
                    <header class="entry-detail-meta">
                        <time class="entry-detail-date">${fullDate}</time>
                        <time class="entry-detail-time">${time}</time>
                        ${duration ? `<span class="entry-detail-duration">${duration} meditation</span>` : ''}
                    </header>
                    
                    ${promptText ? `
                        <div class="entry-prompt-box">
                            <span class="entry-prompt-label">Prompt</span>
                            <p class="entry-prompt-text">${promptText}</p>
                        </div>
                    ` : ''}
                    
                    <div class="entry-content">
                        ${formatEntryContent(entry.entry)}
                    </div>
                    
                    <footer class="entry-detail-footer">
                        <span class="entry-stat">${metadata.wordCount} words</span>
                        <span class="entry-stat">${readingTime} min read</span>
                        ${entry.lastModified && entry.lastModified !== entry.timestamp ? 
                            `<span class="entry-stat">Edited ${formatDate(entry.lastModified, 'relative')}</span>` : 
                            ''
                        }
                    </footer>
                </article>
            </div>
        `;
        
    } catch (error) {
        console.error('[Entry] Error loading entry:', error);
        showError(app);
    }
}

function showNotFound(app) {
    app.innerHTML = `
        <div class="entry-container">
            <div class="entry-error">
                <h2 class="entry-error-title">Entry not found</h2>
                <p class="entry-error-message">This entry may have been deleted.</p>
                <button onclick="router.navigate('/history')" class="entry-error-button">
                    Back to history
                </button>
            </div>
        </div>
    `;
}

function showError(app) {
    app.innerHTML = `
        <div class="entry-container">
            <div class="entry-error">
                <h2 class="entry-error-title">Error loading entry</h2>
                <p class="entry-error-message">Something went wrong. Please try again.</p>
                <button onclick="location.reload()" class="entry-error-button">
                    Try again
                </button>
            </div>
        </div>
    `;
}

function formatEntryContent(content) {
    if (!content) {
        return '<p class="entry-empty">No content</p>';
    }
    
    // Convert line breaks to paragraphs
    const paragraphs = content
        .split(/\n\n+/)
        .filter(p => p.trim())
        .map(p => `<p>${escapeHtml(p.trim())}</p>`)
        .join('');
    
    return paragraphs || '<p class="entry-empty">No content</p>';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPromptText(promptId) {
    if (!promptId) return null;
    
    // Meditation prompts from today screen
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
    
    // Extract index from promptId (format: "prompt_0", "prompt_1", etc.)
    const match = promptId.match(/prompt_(\d+)/);
    if (match) {
        const index = parseInt(match[1]);
        return prompts[index] || null;
    }
    
    return null;
}

// Global functions for actions
window.editEntry = function(timestamp) {
    // Store entry ID for edit mode
    window.sessionStorage.setItem('editEntryId', timestamp);
    router.navigate('/write');
};

window.deleteEntry = async function(timestamp) {
    if (!confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
        return;
    }
    
    try {
        await db.deleteEntry(timestamp);
        router.navigate('/history');
    } catch (error) {
        console.error('[Entry] Error deleting entry:', error);
        alert('Failed to delete entry. Please try again.');
    }
};

export function cleanup() {
    // Clean up any event listeners if needed
}