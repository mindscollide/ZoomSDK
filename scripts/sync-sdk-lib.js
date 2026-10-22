// Copies the Zoom Video SDK media files from node_modules into
// public/lib/<sdk version>/ BEFORE the build starts. config-overrides.js also
// copies them, but only during webpack, i.e. after CRA has already copied
// public/ into the build folder, so a build made right after an SDK upgrade
// shipped the OLD files. See zoom-sdk-lib.js for why the folder is versioned.
const fs = require('fs');
const path = require('path');
const { getSdkVersion, sdkLibSource, publicLibRoot, getPublicLibDir } = require('./zoom-sdk-lib');

if (!fs.existsSync(sdkLibSource)) {
  console.error('SDK lib folder not found: ' + sdkLibSource + ' (run npm install)');
  process.exit(1);
}
const dest = getPublicLibDir();
// Clear all of public/lib (older SDK versions, and the flat files from before
// the folder was versioned) so the build ships only this version.
fs.rmSync(publicLibRoot, { recursive: true, force: true });
fs.cpSync(sdkLibSource, dest, { recursive: true });

const size = fs.statSync(path.join(dest, 'js_media.min.js')).size;
console.log(
  'Synced Zoom SDK ' + getSdkVersion() + ' lib -> public/lib/' + getSdkVersion() +
    ' (js_media.min.js ' + size + ' bytes)'
);
