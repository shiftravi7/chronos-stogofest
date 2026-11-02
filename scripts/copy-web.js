// Copies the website (the shared UI) into the Android and Windows app folders.
// Usage: npm run build:web
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ITEMS = ['index.html', 'manifest.json', 'downloads.config.js', 'css', 'js', 'shared', 'images', 'icons', 'fonts', 'vendor'];
const targets = [path.join(root, 'apps/android/www'), path.join(root, 'apps/windows/web')];

for (const t of targets) {
  fs.rmSync(t, { recursive: true, force: true });
  for (const item of ITEMS) fs.cpSync(path.join(root, item), path.join(t, item), { recursive: true });
  console.log('Web UI copied to', path.relative(root, t));
}
