const path = require('node:path');
const Database = require('better-sqlite3');

let db = null;
let stmtGet = null;
let stmtSet = null;

function openCache(userDataPath) {
  try {
    const dbPath = path.join(userDataPath, 'prunr-cache.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS hash_cache (
        filePath  TEXT NOT NULL,
        size      INTEGER NOT NULL,
        mtimeMs   REAL NOT NULL,
        hashType  TEXT NOT NULL,
        hash      TEXT NOT NULL,
        PRIMARY KEY (filePath, hashType)
      )
    `);

    stmtGet = db.prepare(
      'SELECT hash FROM hash_cache WHERE filePath = ? AND hashType = ? AND size = ? AND mtimeMs = ?'
    );
    stmtSet = db.prepare(`
      INSERT INTO hash_cache (filePath, size, mtimeMs, hashType, hash)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(filePath, hashType) DO UPDATE SET size = excluded.size, mtimeMs = excluded.mtimeMs, hash = excluded.hash
    `);
  } catch (err) {
    console.error('Failed to open cache database:', err);
    db = null; // Ensure graceful fallback to no-cache
  }
}

function getHash(filePath, size, mtimeMs, hashType) {
  if (!db) return null;
  try {
    const row = stmtGet.get(filePath, hashType, size, mtimeMs);
    return row ? row.hash : null;
  } catch (err) {
    console.error('Cache get error:', err);
    return null;
  }
}

function setHash(filePath, size, mtimeMs, hashType, hash) {
  if (!db) return;
  try {
    stmtSet.run(filePath, size, mtimeMs, hashType, hash);
  } catch (err) {
    console.error('Cache set error:', err);
  }
}

function clearCache() {
  if (!db) return;
  try {
    db.exec('DELETE FROM hash_cache');
    db.exec('VACUUM');
  } catch (err) {
    console.error('Cache clear error:', err);
  }
}

function closeCache() {
  if (db) {
    db.close();
    db = null;
    stmtGet = null;
    stmtSet = null;
  }
}

module.exports = { openCache, getHash, setHash, clearCache, closeCache };
