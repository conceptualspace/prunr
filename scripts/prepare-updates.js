const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const updateDir = path.join(__dirname, '../out/updates');
const makeDir = path.join(__dirname, '../out');

// Base URL for the static host
const BASE_URL = 'https://prunr.conceptualspace.net/updates';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function findFilesWithExt(dir, ext, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findFilesWithExt(fullPath, ext, fileList);
    } else if (file.endsWith(ext)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function findFile(dir, filename, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findFile(fullPath, filename, fileList);
    } else if (file === filename) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function prepareUpdates() {
  console.log('Preparing updates...');
  ensureDir(updateDir);

  const version = pkg.version;
  
  // Windows
  const releasesFiles = findFile(makeDir, 'RELEASES');
  const nupkgFiles = findFilesWithExt(makeDir, '.nupkg');
  
  if (releasesFiles.length > 0 || nupkgFiles.length > 0) {
    console.log('Packaging Windows updates...');
    const winDir = path.join(updateDir, 'win32');
    ensureDir(winDir);

    for (const rf of releasesFiles) {
      fs.copyFileSync(rf, path.join(winDir, 'RELEASES'));
      console.log(`Copied ${path.basename(rf)}`);
    }

    for (const nf of nupkgFiles) {
      fs.copyFileSync(nf, path.join(winDir, path.basename(nf)));
      console.log(`Copied ${path.basename(nf)}`);
    }
  }

  // macOS
  const zipFiles = findFilesWithExt(makeDir, '.zip');
  const macZip = zipFiles.find(f => (f.includes('darwin') || f.includes('mac')) && f.includes(version));
  
  if (macZip) {
    console.log('Packaging macOS updates...');
    const macDir = path.join(updateDir, 'darwin');
    ensureDir(macDir);

    const zipName = path.basename(macZip);
    fs.copyFileSync(macZip, path.join(macDir, zipName));
    console.log(`Copied ${zipName}`);

    // Create update.json for macOS
    const updateJson = {
      version: version,
      url: `${BASE_URL}/darwin/${zipName}`,
      name: `prunr ${version}`,
      notes: "A new version is available.",
      pub_date: new Date().toUTCString()
    };

    fs.writeFileSync(path.join(macDir, 'update.json'), JSON.stringify(updateJson, null, 2));
    console.log('Generated update.json for macOS');
  }

  console.log('Update preparation complete. Files ready in `out/updates`.');
}

prepareUpdates().catch(err => {
  console.error(err);
  process.exit(1);
});
