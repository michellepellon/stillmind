import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
let db;

export async function initDatabase() {
  const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/stillmind.db');
  
  // Ensure data directory exists
  const dataDir = dirname(dbPath);
  mkdirSync(dataDir, { recursive: true });
  
  // Initialize database
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );
    
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      type TEXT NOT NULL, -- 'magic' or 'session'
      expires_at DATETIME NOT NULL,
      used BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      client_ip TEXT
    );
    
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      duration INTEGER,
      entry TEXT NOT NULL,
      prompt_id TEXT,
      word_count INTEGER,
      sync_status TEXT DEFAULT 'synced',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_entries_user_timestamp ON entries(user_id, timestamp);
  `);
  
  console.log('Database initialized');
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

// User operations
export function createUser(email) {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO users (email) VALUES (?) ON CONFLICT DO NOTHING');
  const result = stmt.run(email.toLowerCase());
  
  if (result.changes === 0) {
    // User already exists, get their ID
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    return user.id;
  }
  
  return result.lastInsertRowid;
}

export function getUserByEmail(email) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
}

export function updateLastLogin(userId) {
  const db = getDb();
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}

// Token operations
export function saveToken(token, email, type, expiresAt, clientIp = null) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO auth_tokens (token, email, type, expires_at, client_ip) 
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(token, email.toLowerCase(), type, expiresAt, clientIp);
}

export function getToken(token) {
  const db = getDb();
  return db.prepare('SELECT * FROM auth_tokens WHERE token = ?').get(token);
}

export function markTokenUsed(token) {
  const db = getDb();
  db.prepare('UPDATE auth_tokens SET used = 1 WHERE token = ?').run(token);
}

export function cleanupExpiredTokens() {
  const db = getDb();
  const result = db.prepare('DELETE FROM auth_tokens WHERE expires_at < datetime("now")').run();
  return result.changes;
}

// Entry operations
export function createEntry(userId, entryData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO entries (user_id, timestamp, duration, entry, prompt_id, word_count) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const wordCount = entryData.entry.split(/\s+/).filter(word => word.length > 0).length;
  
  const result = stmt.run(
    userId,
    entryData.timestamp || Date.now(),
    entryData.duration || null,
    entryData.entry,
    entryData.promptId || null,
    wordCount
  );
  
  return result.lastInsertRowid;
}

export function getUserEntries(userId, limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM entries 
    WHERE user_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
}

export function getEntry(userId, entryId) {
  const db = getDb();
  return db.prepare('SELECT * FROM entries WHERE user_id = ? AND id = ?').get(userId, entryId);
}

export function updateEntry(userId, entryId, entryData) {
  const db = getDb();
  const wordCount = entryData.entry.split(/\s+/).filter(word => word.length > 0).length;
  
  const stmt = db.prepare(`
    UPDATE entries 
    SET entry = ?, duration = ?, prompt_id = ?, word_count = ?, last_modified = CURRENT_TIMESTAMP
    WHERE user_id = ? AND id = ?
  `);
  
  const result = stmt.run(
    entryData.entry,
    entryData.duration || null,
    entryData.promptId || null,
    wordCount,
    userId,
    entryId
  );
  
  return result.changes > 0;
}

export function deleteEntry(userId, entryId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM entries WHERE user_id = ? AND id = ?').run(userId, entryId);
  return result.changes > 0;
}