const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PARTIAL_READ_SIZE = 8192; // 8KB from head, 8KB from middle, 8KB from tail

const IGNORED_FILENAMES = new Set(['.DS_Store', 'desktop.ini', 'Thumbs.db']);
const IGNORED_DIRNAMES = new Set(['.Trash', '.Trashes', '$RECYCLE.BIN']);
const isIgnoredDir = (name) => IGNORED_DIRNAMES.has(name) || name.startsWith('.Trash-');

/**
 * Recursively collect all files from the given directories.
 */
async function collectFiles(directories, onProgress, abortSignal, options = {}) {
  const fileMap = new Map(); // keyed by filePath for dedup

  // A lightweight concurrency limiter
  const MAX_CONCURRENCY = 100;
  let active = 0;
  const waiting = [];

  async function limit(fn) {
    if (active >= MAX_CONCURRENCY) {
      await new Promise(resolve => waiting.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      if (waiting.length > 0) {
        waiting.pop()(); // Use pop() for LIFO (O(1)) instead of shift() to avoid bottlenecks
      }
    }
  }

  async function walk(dir) {
    if (abortSignal.aborted) return;
    let entries;
    try {
      entries = await limit(() => fsp.readdir(dir, { withFileTypes: true }));
    } catch {
      // Permission denied or inaccessible — skip silently
      return;
    }
    
    // Process all entries concurrently but safely wrapped in our limiter
    const promises = entries.map(async (entry) => {
      if (abortSignal.aborted) return;
      
      // Early return for hidden files bypasses path.join and further checks
      if (!options.showHiddenFiles && entry.name.startsWith('.')) return;

      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (options.recursive !== false && !isIgnoredDir(entry.name)) await walk(fullPath);
      } else if (entry.isFile()) {
        if (IGNORED_FILENAMES.has(entry.name)) return;
        try {
          const stat = await limit(() => fsp.stat(fullPath));
          if (stat.size === 0) return;
          if (options.minFileSizeKb && stat.size < options.minFileSizeKb * 1024) return;
          fileMap.set(fullPath, { filePath: fullPath, size: stat.size, mtime: stat.mtimeMs });
          onProgress({ phase: 'collecting', fileCount: fileMap.size, currentFile: fullPath });
        } catch {
          // File vanished or unreadable — skip
        }
      }
    });

    await Promise.all(promises);
  }

  // Scan root directories concurrently
  await Promise.all(directories.map(dir => walk(dir)));
  return Array.from(fileMap.values());
}

/**
 * Compute a partial hash: first 8KB + middle 8KB + last 8KB of the file.
 * For files <= 24KB, reads the entire file.
 */
async function partialHash(filePath, fileSize) {
  const hash = crypto.createHash('sha256'); // sha256 is typically hardware accelerated unlike blake or md5
  const fd = await fsp.open(filePath, 'r');
  try {
    if (fileSize <= PARTIAL_READ_SIZE * 3) {
      // Small file — allocate uninitialized memory (faster)
      const buf = Buffer.allocUnsafe(fileSize);
      await fd.read(buf, 0, fileSize, 0);
      hash.update(buf);
    } else {
      // Allocate a single uninitialized buffer for head, middle, and tail
      const buf = Buffer.allocUnsafe(PARTIAL_READ_SIZE * 3);
      
      const middleOffset = Math.floor(fileSize / 2) - Math.floor(PARTIAL_READ_SIZE / 2);

      // Run head, middle, and tail I/O operations simultaneously
      await Promise.all([
        fd.read(buf, 0, PARTIAL_READ_SIZE, 0),
        fd.read(buf, PARTIAL_READ_SIZE, PARTIAL_READ_SIZE, middleOffset),
        fd.read(buf, PARTIAL_READ_SIZE * 2, PARTIAL_READ_SIZE, fileSize - PARTIAL_READ_SIZE)
      ]);
      
      hash.update(buf);
    }
  } finally {
    await fd.close();
  }
  return hash.digest().subarray(0, 16).toString('hex'); // just being efficient
}

/**
 * Compute a full hash: stream the entire file through SHA-256.
 */
async function fullHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest().subarray(0, 16).toString('hex')));
    stream.on('error', reject);
  });
}

/**
 * Main scan function.
 * Returns an array of duplicate groups: [ [file1, file2, ...], ... ]
 * Each file is { filePath, size }.
 */
async function scan(directories, rawOnProgress, abortSignal, cache, options = {}) {
  let lastProgressTime = 0;
  const onProgress = (data) => {
    const now = Date.now();
    // Throttle updates to avoid IPC bottlenecks. 16ms ~= 60fps
    if (now - lastProgressTime > 30 || data.force) {
      lastProgressTime = now;
      delete data.force;
      rawOnProgress(data);
    }
  };

  // Pass 1: Collect files and group by size
  onProgress({ phase: 'collecting', fileCount: 0, currentFile: '', force: true });
  const files = await collectFiles(directories, onProgress, abortSignal, options);
  if (abortSignal.aborted) return [];

  // Group by size
  const sizeGroups = new Map();
  for (const file of files) {
    const key = file.size;
    if (!sizeGroups.has(key)) sizeGroups.set(key, []);
    sizeGroups.get(key).push(file);
  }

  // Filter to only groups with 2+ files (potential duplicates)
  const candidates = [];
  for (const group of sizeGroups.values()) {
    if (group.length >= 2) {
      candidates.push(...group);
    }
  }

  onProgress({ phase: 'hashing', fileCount: files.length, candidateCount: candidates.length, hashed: 0, currentFile: '', force: true });

  if (candidates.length === 0) return [];

  // Pass 2: Hash candidates
  const scanMode = options.scanMode === 'full' ? 'full' : 'partial';
  const hashGroups = new Map(); // key: "size:hash"
  let hashed = 0;

  // Concurrency limiter for filesystem I/O
  // todo: maybe tune this
  const MAX_CONCURRENCY = 50;
  let active = 0;
  const waiting = [];

  async function limit(fn) {
    if (active >= MAX_CONCURRENCY) {
      await new Promise(resolve => waiting.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      if (waiting.length > 0) {
        waiting.pop()();
      }
    }
  }

  const hashType = scanMode;

  const hashPromises = candidates.map(async (file) => {
    if (abortSignal.aborted) return;
    try {
      let h = cache?.getHash(file.filePath, file.size, file.mtime, hashType) ?? null;
      if (!h) {
        h = await limit(() => scanMode === 'full' ? fullHash(file.filePath) : partialHash(file.filePath, file.size));
        cache?.setHash(file.filePath, file.size, file.mtime, hashType, h);
      }
      if (abortSignal.aborted) return;
      
      const key = `${file.size}:${h}`;
      if (!hashGroups.has(key)) hashGroups.set(key, []);
      hashGroups.get(key).push(file);
    } catch {
      // File unreadable — skip
    }
    hashed++;
    onProgress({ phase: 'hashing', fileCount: files.length, candidateCount: candidates.length, hashed, currentFile: file.filePath, force: hashed === candidates.length });
  });

  await Promise.all(hashPromises);
  if (abortSignal.aborted) return [];

  // Collect duplicate groups (2+ files with same size+hash)
  const duplicates = [];
  for (const group of hashGroups.values()) {
    if (group.length >= 2) {
      duplicates.push(group);
    }
  }

  return duplicates;
}

module.exports = { scan };
