import db from '../../core/db.js';
import { 
    formatDate, 
    formatTime, 
    generateExcerpt, 
    formatDuration,
    getEntryMetadata 
} from '../../shared/utils/entry.js';
import offlineManager from '../../core/offline.js';
import interactionManager from '../../shared/utils/interactions.js';
import performanceMonitor from '../../shared/utils/performance.js';

// State management
let entries = [];
let currentOffset = 0;
let isLoading = false;
let hasMore = true;
const ENTRIES_PER_PAGE = 20;

// Pull to refresh variables
let pullStartY = 0;
let pullDistance = 0;
let isPulling = false;

export async function render() {
    performanceMonitor.mark('history-start');
    const app = document.getElementById('app');
    
    // Reset state
    entries = [];
    currentOffset = 0;
    hasMore = true;
    
    app.innerHTML = `
        <div class="history-container fade-in-target" data-page="history">
            <header class="history-header slide-in-left">
                <button 
                    onclick="router.navigate('/')" 
                    class="back-button hover-scale focus-ring"
                    aria-label="Back to home"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </button>
                <h1 class="history-title">Your Journal</h1>
            </header>
            <main class="history-main">
                <div class="entries-container" id="entries-container">
                    ${generateLoadingSkeleton()}
                </div>
            </main>
        </div>
    `;
    
    // Load initial entries
    await loadEntries();
    
    performanceMonitor.mark('history-ready');
    performanceMonitor.measure('history-load', 'history-start', 'history-ready');
    
    // Set up infinite scroll and pull to refresh with throttling
    const container = document.querySelector('.history-main');
    if (container) {
        const throttledScroll = performanceMonitor.throttle(handleScroll, 16);
        container.addEventListener('scroll', throttledScroll, { passive: true });
        
        // Touch events for pull to refresh
        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);
    }
    
    // Add pull to refresh indicator
    addPullToRefreshIndicator();
}

// Generate loading skeleton
function generateLoadingSkeleton() {
    return Array.from({ length: 3 }, () => `
        <article class="entry-item skeleton-container">
            <div class="entry-header">
                <div class="skeleton skeleton-text" style="width: 80px; height: 14px;"></div>
                <div class="skeleton skeleton-text" style="width: 60px; height: 14px;"></div>
                <div class="skeleton skeleton-text" style="width: 50px; height: 20px; border-radius: 12px;"></div>
            </div>
            <div class="entry-excerpt">
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton skeleton-text" style="width: 70%;"></div>
            </div>
            <div class="entry-footer">
                <div class="skeleton skeleton-text" style="width: 60px; height: 14px;"></div>
                <div class="skeleton skeleton-text" style="width: 80px; height: 14px;"></div>
            </div>
        </article>
    `).join('');
}

async function loadEntries() {
    if (isLoading || !hasMore) return;
    
    isLoading = true;
    const container = document.getElementById('entries-container');
    
    try {
        // Fetch entries from database
        const newEntries = await db.getEntries(ENTRIES_PER_PAGE, currentOffset);
        
        if (newEntries.length === 0) {
            hasMore = false;
            if (entries.length === 0) {
                // Show empty state
                container.innerHTML = `
                    <div class="empty-state">
                        <p class="empty-message">No journal entries yet</p>
                        <p class="empty-submessage">Start writing to see your thoughts here</p>
                        <button onclick="router.navigate('/write')" class="empty-cta">
                            Write your first entry
                        </button>
                    </div>
                `;
            } else {
                // Remove loading indicator if no more entries
                const loadingEl = container.querySelector('.loading-indicator');
                if (loadingEl) loadingEl.remove();
            }
            return;
        }
        
        // Add new entries to our list
        entries.push(...newEntries);
        currentOffset += newEntries.length;
        
        // Check if we have more entries
        hasMore = newEntries.length === ENTRIES_PER_PAGE;
        
        // Render entries
        renderEntries(container);
        
    } catch (error) {
        console.error('[History] Error loading entries:', error);
        container.innerHTML = `
            <div class="error-state">
                <p class="error-message">Failed to load entries</p>
                <button onclick="location.reload()" class="error-retry">Try again</button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

function renderEntries(container) {
    const entriesHTML = entries.map((entry, index) => {
        const metadata = getEntryMetadata(entry);
        const excerpt = generateExcerpt(entry.entry, 150);
        const date = formatDate(entry.timestamp, 'short');
        const time = formatTime(entry.timestamp);
        const duration = entry.duration ? formatDuration(entry.duration) : '';
        const isOffline = entry.syncStatus === 'offline';
        
        return `
            <article 
                class="entry-item ${isOffline ? 'entry-item--offline' : ''} hover-lift focus-ring" 
                onclick="router.navigate('/entry/${entry.timestamp}')"
                role="button"
                tabindex="0"
                style="animation-delay: ${index * 50}ms;"
                data-entry-index="${index}"
            >
                <div class="entry-header">
                    <time class="entry-date">${date}</time>
                    <time class="entry-time">${time}</time>
                    ${duration ? `<span class="entry-duration">${duration}</span>` : ''}
                    ${isOffline ? '<span class="entry-offline" title="Saved offline">📵</span>' : ''}
                </div>
                <p class="entry-excerpt">${excerpt || '<em>Empty entry</em>'}</p>
                <div class="entry-footer">
                    <span class="entry-words">${metadata.wordCount} words</span>
                    ${metadata.hasPrompt ? '<span class="entry-prompted">✨ Prompted</span>' : ''}
                </div>
            </article>
        `;
    }).join('');
    
    // Add loading indicator at the end if there are more entries
    const loadingHTML = hasMore ? '<div class="loading-indicator pulse">Loading more...</div>' : '';
    
    container.innerHTML = entriesHTML + loadingHTML;
    
    // Add staggered entrance animations using RAF
    performanceMonitor.raf(() => {
        const entryItems = container.querySelectorAll('.entry-item');
        entryItems.forEach((item, index) => {
            if (!item.classList.contains('animated')) {
                // Use RAF for each animation to ensure smooth performance
                const animateItem = () => {
                    performanceMonitor.raf(() => {
                        item.classList.add('animated', 'fade-in-up');
                    });
                };
                setTimeout(animateItem, index * 50);
            }
        });
    });
}

function handleScroll(event) {
    const container = event.target;
    const scrollPosition = container.scrollTop + container.clientHeight;
    const scrollHeight = container.scrollHeight;
    
    // Load more when user is near the bottom (200px threshold)
    if (scrollPosition > scrollHeight - 200 && !isLoading && hasMore) {
        loadEntries();
    }
}

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('entry-item')) {
        e.target.click();
    }
});

// Pull to refresh functions
function addPullToRefreshIndicator() {
    const container = document.querySelector('.history-main');
    if (!container) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh';
    indicator.innerHTML = '<div class="pull-to-refresh-spinner"></div>';
    container.insertBefore(indicator, container.firstChild);
}

function handleTouchStart(e) {
    const container = e.currentTarget;
    if (container.scrollTop === 0) {
        pullStartY = e.touches[0].clientY;
        isPulling = true;
    }
}

function handleTouchMove(e) {
    if (!isPulling) return;
    
    const currentY = e.touches[0].clientY;
    pullDistance = Math.max(0, currentY - pullStartY);
    
    const container = e.currentTarget;
    const indicator = container.querySelector('.pull-to-refresh');
    
    if (pullDistance > 0 && container.scrollTop === 0) {
        e.preventDefault();
        
        const progress = Math.min(pullDistance / 100, 1);
        const opacity = progress;
        const scale = 0.5 + (0.5 * progress);
        const translateY = Math.min(pullDistance * 0.5, 50);
        
        if (indicator) {
            indicator.style.opacity = opacity;
            indicator.style.transform = `translateY(${translateY}px) scale(${scale})`;
        }
    }
}

async function handleTouchEnd() {
    if (!isPulling) return;
    
    const container = document.querySelector('.history-main');
    const indicator = container?.querySelector('.pull-to-refresh');
    
    if (pullDistance > 100) {
        // Trigger refresh
        if (indicator) {
            indicator.classList.add('refreshing');
        }
        
        // Reset and reload
        entries = [];
        currentOffset = 0;
        hasMore = true;
        
        await loadEntries();
        
        if (indicator) {
            indicator.classList.remove('refreshing');
        }
    }
    
    // Reset
    if (indicator) {
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(0) scale(0.5)';
    }
    
    pullStartY = 0;
    pullDistance = 0;
    isPulling = false;
}

export function cleanup() {
    // Remove listeners
    const container = document.querySelector('.history-main');
    if (container) {
        container.removeEventListener('scroll', handleScroll);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
    }
}