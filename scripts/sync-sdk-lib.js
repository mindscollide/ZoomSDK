// Copies the Zoom Video SDK media files from node_modules into public/lib
// BEFORE the build starts. config-overrides.js also copies them, but only
// during webpack, i.e. after CRA has already copied public/ into the build
// folder, so a build made right after an SDK upgrade shipped the OLD files.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'node_modules', '@zoom', 'videosdk', 'dist', 'lib');
const dest = path.resolve(__dirname, '..', 'public', 'lib');

if (!fs.existsSync(src)) {
  console.error('SDK lib folder not found: ' + src + ' (run npm install)');
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true }); // drop files from older SDK versions
fs.cpSync(src, dest, { recursive: true });

const sdk = require('../node_modules/@zoom/videosdk/package.json').version;
const size = fs.statSync(path.join(dest, 'js_media.min.js')).size;
console.log('Synced Zoom SDK ' + sdk + ' lib -> public/lib (js_media.min.js ' + size + ' bytes)');
