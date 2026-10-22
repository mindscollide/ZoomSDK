// Single source of truth for where the Zoom Video SDK media files live.
//
// The files in node_modules/@zoom/videosdk/dist/lib have fixed names
// (js_media.min.js, video_simd.wasm, ...). Served from a fixed /lib/ path, a
// browser that cached them under an older SDK keeps using those stale copies
// after an upgrade, mixes them with the new SDK code, and init/join hangs.
// Putting them under /lib/<sdk version>/ gives every SDK upgrade new URLs, while
// the files still cache normally between upgrades.
const path = require('path');

const root = path.resolve(__dirname, '..');
const sdkPackageDir = path.join(root, 'node_modules', '@zoom', 'videosdk');

// Read lazily so requiring this file before `npm install` doesn't throw.
const getSdkVersion = () => require(path.join(sdkPackageDir, 'package.json')).version;

module.exports = {
  getSdkVersion,
  sdkLibSource: path.join(sdkPackageDir, 'dist', 'lib'),
  publicLibRoot: path.join(root, 'public', 'lib'),
  // e.g. public/lib/2.5.0
  getPublicLibDir: () => path.join(root, 'public', 'lib', getSdkVersion())
};
