// IndexedDB wrapper for StillMind
export class StillMindDB {
    constructor() {
        this.dbName = 'StillMindDB';
        this.version = 1;
        this.db = null;
    }
    
    /**
     * Initialize the database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) {
            return this.db;
        }
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('[DB] Error opening database:', request.error);
                reject(new Error('Failed to open database'));
            };
            
            request.onsuccess = () => {
                console.log('[DB] Database opened successfully');
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                console.log('[DB] Upgrading database...');
                const db = event.target.result;
                
                // Create entries object store
                if (!db.objectStoreNames.contains('entries')) {
                    const entriesStore = db.createObjectStore('entries', { 
                        keyPath: 'timestamp' 
                    });
                    
                    // Create indexes
                    entriesStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    entriesStore.createIndex('lastModified', 'lastModified', { unique: false });
                    
                    console.log('[DB] Created entries store');
                }
                
                // Create settings object store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { 
                        keyPath: 'key' 
                    });
                    
                    console.log('[DB] Created settings store');
                }
            };
        });
    }
    
    /**
     * Save or update an entry
     * @param {Object} entry - The entry to save
     * @returns {Promise<number>} The timestamp of the saved entry
     */
    async saveEntry(entry) {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore('entries');
            
            // Ensure required fields
            const entryToSave = {
                timestamp: entry.timestamp || Date.now(),
                entry: entry.entry || '',
                duration: entry.duration || null,
                promptId: entry.promptId || null,
                wordCount: this.calculateWordCount(entry.entry || ''),
                syncStatus: entry.syncStatus || 'local',
                lastModified: Date.now(),
                createdAt: entry.createdAt || entry.timestamp || Date.now(),
                serverId: entry.serverId || null,
                clientId: entry.clientId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            
            const request = store.put(entryToSave);
            
            request.onsuccess = () => {
                console.log('[DB] Entry saved:', entryToSave.timestamp);
                resolve(entryToSave.timestamp);
            };
            
            request.onerror = () => {
                console.error('[DB] Error saving entry:', request.error);
                reject(new Error('Failed to save entry'));
            };
        });
    }
    
    /**
     * Get entries with pagination
     * @param {number} limit - Number of entries to fetch
     * @param {number} offset - Number of entries to skip
     * @returns {Promise<Array>} Array of entries
     */
    async getEntries(limit = 20, offset = 0) {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['entries'], 'readonly');
            const store = transaction.objectStore('entries');
            const index = store.index('lastModified');
            
            const entries = [];
            let skipped = 0;
            
            // Open cursor in reverse order (newest first)
            const request = index.openCursor(null, 'prev');
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor && entries.length < limit) {
                    if (skipped < offset) {
                        skipped++;
                        cursor.continue();
                    } else {
                        entries.push(cursor.value);
                        cursor.continue();
                    }
                } else {
                    console.log(`[DB] Retrieved ${entries.length} entries`);
                    resolve(entries);
                }
            };
            
            request.onerror = () => {
                console.error('[DB] Error fetching entries:', request.error);
                reject(new Error('Failed to fetch entries'));
            };
        });
    }
    
    /**
     * Get a single entry by timestamp
     * @param {number} timestamp - The entry timestamp
     * @returns {Promise<Object|null>} The entry or null if not found
     */
    async getEntry(timestamp) {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['entries'], 'readonly');
            const store = transaction.objectStore('entries');
            const request = store.get(timestamp);
            
            request.onsuccess = () => {
                const entry = request.result;
                console.log('[DB] Retrieved entry:', entry ? entry.timestamp : 'not found');
                resolve(entry || null);
            };
            
            request.onerror = () => {
                console.error('[DB] Error fetching entry:', request.error);
                reject(new Error('Failed to fetch entry'));
            };
        });
    }
    
    /**
     * Delete an entry
     * @param {number} timestamp - The entry timestamp
     * @returns {Promise<void>}
     */
    async deleteEntry(timestamp) {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore('entries');
            const request = store.delete(timestamp);
            
            request.onsuccess = () => {
                console.log('[DB] Entry deleted:', timestamp);
                resolve();
            };
            
            request.onerror = () => {
                console.error('[DB] Error deleting entry:', request.error);
                reject(new Error('Failed to delete entry'));
            };
        });
    }
    
    /**
     * Calculate word count for an entry
     * @param {string} text - The text to count words in
     * @returns {number} Word count
     */
    calculateWordCount(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }
        
        // Split by whitespace and filter out empty strings
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        return words.length;
    }
    
    /**
     * Save a setting
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @returns {Promise<void>}
     */
    async saveSetting(key, value) {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            const request = store.put({ key, value });
            
            request.onsuccess = () => {
                console.log('[DB] Setting saved:', key);
                resolve();
            };
            
            request.onerror = () => {
                console.error('[DB] Error saving setting:', request.error);
                reject(new Error('Failed to save setting'));
            };
        });
    }
    
    /**
     * Get a setting
     * @param {string} key - Setting key
     * @returns {Promise<any>} Setting value or null
     */
    async getSetting(key) {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get(key);
            
            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };
            
            request.onerror = () => {
                console.error('[DB] Error fetching setting:', request.error);
                reject(new Error('Failed to fetch setting'));
            };
        });
    }
    
    /**
     * Get unsynced entries
     * @returns {Promise<Array>} Array of unsynced entries
     */
    async getUnsyncedEntries() {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['entries'], 'readonly');
            const store = transaction.objectStore('entries');
            const index = store.index('syncStatus');
            
            const entries = [];
            const request = index.openCursor(IDBKeyRange.only('local'));
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    entries.push(cursor.value);
                    cursor.continue();
                } else {
                    console.log(`[DB] Found ${entries.length} unsynced entries`);
                    resolve(entries);
                }
            };
            
            request.onerror = () => {
                console.error('[DB] Error fetching unsynced entries:', request.error);
                reject(new Error('Failed to fetch unsynced entries'));
            };
        });
    }
    
    /**
     * Update entry with server ID
     * @param {number} timestamp - Entry timestamp
     * @param {number} serverId - Server ID
     * @returns {Promise<void>}
     */
    async updateEntryServerId(timestamp, serverId) {
        const entry = await this.getEntry(timestamp);
        if (entry) {
            entry.serverId = serverId;
            entry.syncStatus = 'synced';
            await this.saveEntry(entry);
        }
    }
    
    /**
     * Mark entry as synced
     * @param {number|string} id - Entry ID (timestamp or clientId)
     * @returns {Promise<void>}
     */
    async markEntrySynced(id) {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore('entries');
            
            // Try to find by timestamp first
            const request = store.get(id);
            
            request.onsuccess = () => {
                const entry = request.result;
                if (entry) {
                    entry.syncStatus = 'synced';
                    store.put(entry).onsuccess = () => resolve();
                } else {
                    // If not found by timestamp, search all entries
                    const allRequest = store.openCursor();
                    allRequest.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            if (cursor.value.clientId === id || cursor.value.serverId === id) {
                                cursor.value.syncStatus = 'synced';
                                cursor.update(cursor.value).onsuccess = () => resolve();
                            } else {
                                cursor.continue();
                            }
                        } else {
                            resolve();
                        }
                    };
                }
            };
            
            request.onerror = () => {
                console.error('[DB] Error marking entry synced:', request.error);
                reject(new Error('Failed to mark entry synced'));
            };
        });
    }
    
    /**
     * Merge remote entry with local data
     * @param {Object} remoteEntry - Entry from server
     * @returns {Promise<void>}
     */
    async mergeRemoteEntry(remoteEntry) {
        const localEntry = await this.getEntry(remoteEntry.timestamp);
        
        if (!localEntry || localEntry.lastModified < remoteEntry.last_modified) {
            // Remote is newer or doesn't exist locally, save it
            await this.saveEntry({
                timestamp: remoteEntry.timestamp,
                entry: remoteEntry.entry,
                duration: remoteEntry.duration,
                promptId: remoteEntry.prompt_id,
                syncStatus: 'synced',
                serverId: remoteEntry.id,
                createdAt: remoteEntry.created_at,
                lastModified: remoteEntry.last_modified
            });
        }
    }
    
    /**
     * Clear all user data (for logout)
     * @returns {Promise<void>}
     */
    async clearUserData() {
        const db = await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['entries'], 'readwrite');
            const store = transaction.objectStore('entries');
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log('[DB] User data cleared');
                resolve();
            };
            
            request.onerror = () => {
                console.error('[DB] Error clearing user data:', request.error);
                reject(new Error('Failed to clear user data'));
            };
        });
    }
    
    /**
     * Check if IndexedDB is available
     * @returns {boolean}
     */
    static isAvailable() {
        return 'indexedDB' in window;
    }
}

// Export singleton instance
export const db = new StillMindDB();

// Fallback to localStorage if IndexedDB is not available
export class LocalStorageFallback {
    constructor() {
        this.prefix = 'stillmind_';
        console.warn('[DB] Using localStorage fallback');
    }
    
    async init() {
        return Promise.resolve();
    }
    
    async saveEntry(entry) {
        const entries = this.getStoredEntries();
        const entryToSave = {
            timestamp: entry.timestamp || Date.now(),
            entry: entry.entry || '',
            duration: entry.duration || null,
            promptId: entry.promptId || null,
            wordCount: this.calculateWordCount(entry.entry || ''),
            syncStatus: entry.syncStatus || 'local',
            lastModified: Date.now(),
            createdAt: entry.createdAt || entry.timestamp || Date.now()
        };
        
        // Update or add entry
        const index = entries.findIndex(e => e.timestamp === entryToSave.timestamp);
        if (index !== -1) {
            entries[index] = entryToSave;
        } else {
            entries.push(entryToSave);
        }
        
        localStorage.setItem(this.prefix + 'entries', JSON.stringify(entries));
        return entryToSave.timestamp;
    }
    
    async getEntries(limit = 20, offset = 0) {
        const entries = this.getStoredEntries();
        // Sort by lastModified descending
        entries.sort((a, b) => (b.lastModified || b.timestamp) - (a.lastModified || a.timestamp));
        return entries.slice(offset, offset + limit);
    }
    
    async getEntry(timestamp) {
        const entries = this.getStoredEntries();
        return entries.find(e => e.timestamp === timestamp) || null;
    }
    
    async deleteEntry(timestamp) {
        const entries = this.getStoredEntries();
        const filtered = entries.filter(e => e.timestamp !== timestamp);
        localStorage.setItem(this.prefix + 'entries', JSON.stringify(filtered));
    }
    
    getStoredEntries() {
        try {
            const stored = localStorage.getItem(this.prefix + 'entries');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('[DB] Error parsing stored entries:', e);
            return [];
        }
    }
    
    calculateWordCount(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        return words.length;
    }
    
    async saveSetting(key, value) {
        localStorage.setItem(this.prefix + 'setting_' + key, JSON.stringify(value));
    }
    
    async getSetting(key) {
        try {
            const stored = localStorage.getItem(this.prefix + 'setting_' + key);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            console.error('[DB] Error parsing setting:', e);
            return null;
        }
    }
}

// Export the appropriate database based on availability
export default StillMindDB.isAvailable() ? db : new LocalStorageFallback();