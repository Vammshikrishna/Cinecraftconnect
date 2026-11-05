// image-size 2.0.4 (MIT, Aditya Yadav), unmodified code in ./dist/cjs. Version 2 fixes the denial-of-service bugs in the JXL, HEIF and ICNS
// parsers, but its API differs from version 1, which Metro (the bundler) relies on: v1 exported the function itself and accepted either a
// Buffer or a file path, v2 exports { imageSize } and accepts only bytes. This wrapper restores the v1 call shape and keeps the named exports.
// Overridden in the root package.json.
const fs = require('fs');
const v2 = require('./dist/cjs/index.js');

function imageSize(input) {
  return v2.imageSize(typeof input === 'string' ? fs.readFileSync(input) : input);
}

module.exports = imageSize;
Object.assign(module.exports, v2, { imageSize });
