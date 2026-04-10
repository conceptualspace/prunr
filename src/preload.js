const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  isFlatpak: !!process.env.FLATPAK_ID,
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  startScan: (directories, options) => ipcRenderer.send('start-scan', directories, options),
  cancelScan: () => ipcRenderer.send('cancel-scan'),
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  trashFile: (filePath) => ipcRenderer.invoke('trash-file', filePath),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  readFilePreview: (filePath) => ipcRenderer.invoke('read-file-preview', filePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  filterDirectories: (paths) => ipcRenderer.invoke('filter-directories', paths),
  startTreemap: (directory) => ipcRenderer.send('start-treemap', directory),
  cancelTreemap: () => ipcRenderer.send('cancel-treemap'),
  onTreemapProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('treemap-progress', handler);
    return () => ipcRenderer.removeListener('treemap-progress', handler);
  },
  onTreemapComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('treemap-complete', handler);
    return () => ipcRenderer.removeListener('treemap-complete', handler);
  },
  onScanProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('scan-progress', handler);
    return () => ipcRenderer.removeListener('scan-progress', handler);
  },
  onScanComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('scan-complete', handler);
    return () => ipcRenderer.removeListener('scan-complete', handler);
  },
  onUpdateAvailable: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  installUpdate: () => ipcRenderer.send('install-update'),
});
