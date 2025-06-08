import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createEntry,
  getUserEntries,
  getEntry,
  updateEntry,
  deleteEntry
} from '../services/database.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get user's entries
router.get('/', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const entries = getUserEntries(
      req.user.id, 
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.json({
      entries,
      count: entries.length,
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Get specific entry
router.get('/:id', async (req, res, next) => {
  try {
    const entry = getEntry(req.user.id, req.params.id);
    
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json(entry);
  } catch (error) {
    next(error);
  }
});

// Create new entry
router.post('/', async (req, res, next) => {
  try {
    const { timestamp, duration, entry, promptId } = req.body;
    
    if (!entry || typeof entry !== 'string' || entry.trim().length === 0) {
      return res.status(400).json({ error: 'Entry content is required' });
    }
    
    const entryId = createEntry(req.user.id, {
      timestamp,
      duration,
      entry: entry.trim(),
      promptId
    });
    
    res.status(201).json({
      success: true,
      id: entryId
    });
  } catch (error) {
    next(error);
  }
});

// Update entry
router.put('/:id', async (req, res, next) => {
  try {
    const { duration, entry, promptId } = req.body;
    
    if (!entry || typeof entry !== 'string' || entry.trim().length === 0) {
      return res.status(400).json({ error: 'Entry content is required' });
    }
    
    const updated = updateEntry(req.user.id, req.params.id, {
      duration,
      entry: entry.trim(),
      promptId
    });
    
    if (!updated) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete entry
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = deleteEntry(req.user.id, req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Sync entries (batch operations)
router.post('/sync', async (req, res, next) => {
  try {
    const { entries } = req.body;
    
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Entries array required' });
    }
    
    const results = [];
    
    for (const entry of entries) {
      try {
        if (entry.deleted) {
          // Handle deletion
          if (entry.id) {
            deleteEntry(req.user.id, entry.id);
            results.push({ id: entry.id, action: 'deleted' });
          }
        } else if (entry.id) {
          // Update existing
          updateEntry(req.user.id, entry.id, entry);
          results.push({ id: entry.id, action: 'updated' });
        } else {
          // Create new
          const id = createEntry(req.user.id, entry);
          results.push({ 
            clientId: entry.clientId, 
            id, 
            action: 'created' 
          });
        }
      } catch (error) {
        results.push({ 
          id: entry.id || entry.clientId, 
          action: 'error', 
          error: error.message 
        });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    next(error);
  }
});

export default router;