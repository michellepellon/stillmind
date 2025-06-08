import { config, buildApiUrl } from './config.js';
import { auth } from './auth.js';
import { db } from './db.js';

export class SyncService {
  constructor() {
    this.syncInProgress = false;
    this.syncInterval = null;
    this.lastSyncTime = parseInt(localStorage.getItem('lastSyncTime') || '0');
  }

  // Start automatic sync
  startAutoSync() {
    if (!config.SYNC_ENABLED || !auth.isAuthenticated()) {
      return;
    }

    // Clear existing interval
    this.stopAutoSync();

    // Initial sync
    this.sync().catch(console.error);

    // Set up interval
    this.syncInterval = setInterval(() => {
      this.sync().catch(console.error);
    }, config.SYNC_INTERVAL);
  }

  // Stop automatic sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Perform sync
  async sync() {
    if (!auth.isAuthenticated() || this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Get local entries that need syncing
      const localEntries = await db.getUnsyncedEntries();
      
      if (localEntries.length === 0 && this.lastSyncTime > 0) {
        // Nothing to sync locally, just fetch remote changes
        await this.fetchRemoteEntries();
      } else {
        // Send local changes
        await this.pushLocalEntries(localEntries);
        
        // Fetch remote changes
        await this.fetchRemoteEntries();
      }

      // Update last sync time
      this.lastSyncTime = Date.now();
      localStorage.setItem('lastSyncTime', this.lastSyncTime.toString());

    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Push local entries to server
  async pushLocalEntries(entries) {
    if (entries.length === 0) return;

    try {
      const response = await auth.authenticatedFetch(buildApiUrl('/entries/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entries })
      });

      if (!response.ok) {
        throw new Error('Failed to sync entries');
      }

      const result = await response.json();
      
      // Update local entries with server IDs
      for (const syncResult of result.results) {
        if (syncResult.action === 'created' && syncResult.id) {
          // Update local entry with server ID
          const localEntry = entries.find(e => e.clientId === syncResult.clientId);
          if (localEntry) {
            await db.updateEntryServerId(localEntry.timestamp, syncResult.id);
          }
        }
        
        // Mark as synced
        if (syncResult.action !== 'error') {
          await db.markEntrySynced(syncResult.id || syncResult.clientId);
        }
      }
    } catch (error) {
      console.error('Failed to push entries:', error);
      throw error;
    }
  }

  // Fetch remote entries
  async fetchRemoteEntries() {
    try {
      const response = await auth.authenticatedFetch(buildApiUrl('/entries'));
      
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }

      const data = await response.json();
      
      // Merge remote entries with local
      for (const remoteEntry of data.entries) {
        await db.mergeRemoteEntry(remoteEntry);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
      throw error;
    }
  }

  // Force full sync
  async forceSync() {
    this.lastSyncTime = 0;
    localStorage.removeItem('lastSyncTime');
    return this.sync();
  }
}

// Create singleton instance
export const syncService = new SyncService();

// Start auto-sync if authenticated
if (auth.isAuthenticated()) {
  syncService.startAutoSync();
}