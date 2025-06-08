/**
 * Entry utilities for StillMind
 */

/**
 * Calculate word count for text
 * @param {string} text - The text to count words in
 * @returns {number} Word count
 */
export function calculateWordCount(text) {
    if (!text || typeof text !== 'string') {
        return 0;
    }
    
    // Split by whitespace and filter out empty strings
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
}

/**
 * Calculate reading time in minutes
 * @param {number} wordCount - Number of words
 * @param {number} wordsPerMinute - Reading speed (default: 200)
 * @returns {number} Reading time in minutes
 */
export function calculateReadingTime(wordCount, wordsPerMinute = 200) {
    if (!wordCount || wordCount <= 0) {
        return 0;
    }
    
    return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Generate excerpt from entry text
 * @param {string} text - The full entry text
 * @param {number} maxLength - Maximum excerpt length (default: 150)
 * @returns {string} Excerpt with ellipsis if truncated
 */
export function generateExcerpt(text, maxLength = 150) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Clean up the text
    const cleaned = text.trim().replace(/\s+/g, ' ');
    
    if (cleaned.length <= maxLength) {
        return cleaned;
    }
    
    // Try to break at a word boundary
    const truncated = cleaned.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
        return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
}

/**
 * Format date for display
 * @param {number|Date} timestamp - Timestamp or Date object
 * @param {string} format - Format type: 'full', 'short', 'relative'
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp, format = 'full') {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
    
    switch (format) {
        case 'relative':
            if (daysDiff === 0) {
                return 'Today';
            } else if (daysDiff === 1) {
                return 'Yesterday';
            } else if (daysDiff < 7) {
                return `${daysDiff} days ago`;
            } else if (daysDiff < 30) {
                const weeks = Math.floor(daysDiff / 7);
                return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
            } else if (daysDiff < 365) {
                const months = Math.floor(daysDiff / 30);
                return `${months} month${months > 1 ? 's' : ''} ago`;
            } else {
                const years = Math.floor(daysDiff / 365);
                return `${years} year${years > 1 ? 's' : ''} ago`;
            }
            
        case 'short':
            const shortOptions = { 
                month: 'short', 
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            };
            return date.toLocaleDateString('en-US', shortOptions);
            
        case 'full':
        default:
            const fullOptions = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            };
            return date.toLocaleDateString('en-US', fullOptions);
    }
}

/**
 * Format time for display
 * @param {number|Date} timestamp - Timestamp or Date object
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

/**
 * Format duration for display
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration string
 */
export function formatDuration(minutes) {
    if (!minutes || minutes <= 0) {
        return '';
    }
    
    if (minutes < 60) {
        return `${minutes} min`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
}

/**
 * Check if entry is empty or whitespace only
 * @param {string} text - Entry text
 * @returns {boolean} True if empty
 */
export function isEntryEmpty(text) {
    return !text || text.trim().length === 0;
}

/**
 * Get entry metadata
 * @param {Object} entry - Entry object
 * @returns {Object} Metadata object
 */
export function getEntryMetadata(entry) {
    if (!entry) {
        return {
            wordCount: 0,
            readingTime: 0,
            isEmpty: true,
            hasPrompt: false,
            hasDuration: false
        };
    }
    
    const wordCount = entry.wordCount || calculateWordCount(entry.entry);
    
    return {
        wordCount,
        readingTime: calculateReadingTime(wordCount),
        isEmpty: isEntryEmpty(entry.entry),
        hasPrompt: !!entry.promptId,
        hasDuration: !!entry.duration && entry.duration > 0,
        isRecent: Date.now() - (entry.timestamp || 0) < 3600000 // Within last hour
    };
}

/**
 * Sort entries by different criteria
 * @param {Array} entries - Array of entries
 * @param {string} sortBy - Sort criteria: 'newest', 'oldest', 'longest', 'shortest'
 * @returns {Array} Sorted entries
 */
export function sortEntries(entries, sortBy = 'newest') {
    if (!entries || !Array.isArray(entries)) {
        return [];
    }
    
    const sorted = [...entries];
    
    switch (sortBy) {
        case 'oldest':
            return sorted.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
        case 'longest':
            return sorted.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
            
        case 'shortest':
            return sorted.sort((a, b) => (a.wordCount || 0) - (b.wordCount || 0));
            
        case 'newest':
        default:
            return sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
}