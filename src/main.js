const { app, BrowserWindow, ipcMain, dialog, shell, Menu, autoUpdater } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { scan } = require('./scanner');
const Store = require('electron-store');
const { DEFAULT_SETTINGS } = require('./defaults');

const store = new Store({ defaults: DEFAULT_SETTINGS });

// Resolve entry points (replaces Forge's magic webpack globals)
const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY = path.join(__dirname, '../preload/preload.js');
const MAIN_WINDOW_WEBPACK_ENTRY = DEV_SERVER_URL || `file://${path.join(__dirname, '../renderer/index.html')}`;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let scanAbortController = null;
let cache = null;

function getCache() {
  if (!cache) {
    cache = require('./cache');
    cache.openCache(app.getPath('userData'));
  }
  return cache;
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    backgroundColor: '#242424',
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      webSecurity: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // ensure we can still open devtools without the default menu bar
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!app.isPackaged && input.control && input.shift && input.key.toLowerCase() === 'i') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

// --- IPC Handlers ---

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.on('start-scan', async (event, directories, options = {}) => {
  scanAbortController = new AbortController();
  const { signal } = scanAbortController;

  const onProgress = (progress) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('scan-progress', progress);
    }
  };

  try {
    const useCache = options.cacheEnabled !== false ? getCache() : null;
    const duplicates = await scan(directories, onProgress, signal, useCache, options);
    if (!event.sender.isDestroyed()) {
      event.sender.send('scan-complete', { duplicates, cancelled: signal.aborted });
    }
  } catch (err) {
    if (!event.sender.isDestroyed()) {
      event.sender.send('scan-complete', { duplicates: [], error: err.message });
    }
  } finally {
    scanAbortController = null;
  }
});

ipcMain.on('cancel-scan', () => {
  if (scanAbortController) {
    scanAbortController.abort();
  }
});

ipcMain.handle('clear-cache', () => {
  getCache().clearCache();
});

ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('save-settings', (_event, settings) => {
  store.store = settings;
});

ipcMain.handle('filter-directories', async (_event, paths) => {
  const results = [];
  for (const p of paths) {
    try {
      const stat = await fs.promises.stat(p);
      if (stat.isDirectory()) results.push(p);
    } catch {
      // skip inaccessible paths
    }
  }
  return results;
});

ipcMain.handle('show-item-in-folder', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-file', (_event, filePath) => {
  return shell.openPath(filePath);
});

ipcMain.handle('trash-file', async (_event, filePath) => {
  await shell.trashItem(filePath);
});

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico']);
const TEXT_EXTS = new Set([
  '.txt', '.md', '.json', '.xml', '.csv', '.log', '.yml', '.yaml', '.toml',
  '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.less', '.html', '.htm',
  '.py', '.rb', '.sh', '.bash', '.zsh', '.c', '.cpp', '.h', '.hpp', '.java',
  '.go', '.rs', '.swift', '.kt', '.lua', '.sql', '.ini', '.cfg', '.conf',
  '.env', '.gitignore', '.dockerfile',
]);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.ogg', '.mov']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a']);

let treemapAbortController = null;

ipcMain.on('start-treemap', async (event, directory) => {
  treemapAbortController = new AbortController();
  const { signal } = treemapAbortController;

  try {
    const tree = await walkDirectoryTree(directory, signal, (progress) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('treemap-progress', progress);
      }
    });
    if (!event.sender.isDestroyed()) {
      event.sender.send('treemap-complete', { tree, cancelled: signal.aborted });
    }
  } catch (err) {
    if (!event.sender.isDestroyed()) {
      event.sender.send('treemap-complete', { tree: null, error: err.message });
    }
  } finally {
    treemapAbortController = null;
  }
});

ipcMain.on('cancel-treemap', () => {
  if (treemapAbortController) {
    treemapAbortController.abort();
  }
});

async function walkDirectoryTree(rootDir, signal, onProgress) {
  let fileCount = 0;
  let lastProgressTime = 0;

  async function walk(dir) {
    if (signal.aborted) return null;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    const results = await Promise.all(entries.map(async (entry) => {
      if (signal.aborted) return null;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          fileCount++;
          const now = Date.now();
          if (now - lastProgressTime > 50) {
            lastProgressTime = now;
            onProgress({ fileCount, currentFile: fullPath });
          }
          return { name: entry.name, path: fullPath, size: stat.size };
        } catch {
          return null;
        }
      }
      return null;
    }));

    const children = results.filter(c => c != null && c.size > 0);

    // Sort children by size descending for better treemap layout
    children.sort((a, b) => b.size - a.size);

    const dirSize = children.reduce((s, c) => s + c.size, 0);
    return {
      name: path.basename(dir),
      path: dir,
      size: dirSize,
      children,
    };
  }

  const tree = await walk(rootDir);
  return tree || { name: path.basename(rootDir), path: rootDir, size: 0, children: [] };
}

ipcMain.handle('read-file-preview', async (_event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (IMAGE_EXTS.has(ext)) {
      return { type: 'image', dataUrl: pathToFileURL(filePath).href };
    }
    if (TEXT_EXTS.has(ext)) {
      const text = await fs.promises.readFile(filePath, 'utf-8');
      return { type: 'text', content: text.slice(0, 200000), truncated: text.length > 200000 };
    }
    if (VIDEO_EXTS.has(ext)) {
      return { type: 'video', dataUrl: pathToFileURL(filePath).href };
    }
    if (AUDIO_EXTS.has(ext)) {
      return { type: 'audio', dataUrl: pathToFileURL(filePath).href };
    }
    return { type: 'unsupported' };
  } catch (err) {
    return { type: 'error', message: err.message };
  }
});

// --- Auto Updater ---

const UPDATE_SERVER_URL = 'https://prunr.conceptualspace.net/updates';

function isNewerVersion(remote, current) {
  const r = remote.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    if ((r[i] || 0) > (c[i] || 0)) return true;
    if ((r[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

function initAutoUpdater() {
  if (process.platform === 'linux') {
    return; // Don't auto-update on Linux
  }

  autoUpdater.on('error', (err) => {
    console.error('AutoUpdater Error:', err);
  });

  autoUpdater.on('update-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available');
    }
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded');
    }
  });

  if (process.platform === 'darwin') {
    // macOS: manual check of update.json to prevent continuous download looping from static host returning 200
    const url = `${UPDATE_SERVER_URL}/darwin/update.json`;
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const remoteVersion = data.version || data.name.split(' ')[1];
        if (remoteVersion && isNewerVersion(remoteVersion, app.getVersion())) {
          autoUpdater.setFeedURL({ url, serverType: 'json' });
          autoUpdater.checkForUpdates();
        }
      })
      .catch(err => console.error('Failed to check for macOS updates:', err));
  } else if (process.platform === 'win32') {
    // Windows: Squirrel Windows handles static RELEASES files directly via URL folder.
    autoUpdater.setFeedURL({ url: `${UPDATE_SERVER_URL}/win32` });
    autoUpdater.checkForUpdates();
  }
}

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// --- App lifecycle ---

app.whenReady().then(() => {
  // todo: might need a minimal menu for macos; although maybe recent electron versions handle that?
  Menu.setApplicationMenu(null);
  createWindow();

  if (app.isPackaged) {
    initAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  if (cache) {
    cache.closeCache();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
