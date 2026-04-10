const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('path');

// Fuses are used to enable/disable various Electron functionality
// at package time, before code signing the application
module.exports = async function afterPack(context) {
  const ext = {
    darwin: '.app',
    linux: '',
    win32: '.exe',
  };

  const electronBinaryPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}${ext[context.electronPlatformName] || ''}`
  );

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
};
