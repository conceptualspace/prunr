const DEFAULT_SETTINGS = {
  scanMode: 'full',           // 'partial' | 'full'
  deleteMode: 'trash',        // 'trash' | 'permanent'
  minFileSizeKb: 10,          // min size in KB
  recursive: true,
  followSymlinks: false,
  showHiddenFiles: true,
  ignoreSystemFiles: true,
  cacheEnabled: true,
  exclusions: '',             // newline-separated patterns
};

module.exports = { DEFAULT_SETTINGS };
