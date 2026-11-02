// Copies the pinned third-party files the site needs into /vendor and /fonts,
// so the website, PWA and apps work offline without any CDN.
// Usage: node scripts/vendor.js <folder that contains node_modules with three, chart.js and @fontsource/*>
const fs = require('fs');
const path = require('path');

const src = path.resolve(process.argv[2] || '.', 'node_modules');
const root = path.resolve(__dirname, '..');
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

// Three.js core + only the add-ons the intro uses (and whatever they import).
const T = path.join(src, 'three');
copy(path.join(T, 'build/three.module.js'), path.join(root, 'vendor/three/build/three.module.js'));
copy(path.join(T, 'build/three.core.js'), path.join(root, 'vendor/three/build/three.core.js'));
copy(path.join(T, 'LICENSE'), path.join(root, 'vendor/three/LICENSE'));
const seen = new Set();
function addon(rel) {
  if (seen.has(rel)) return; seen.add(rel);
  const file = path.join(T, 'examples/jsm', rel);
  copy(file, path.join(root, 'vendor/three/examples/jsm', rel));
  const code = fs.readFileSync(file, 'utf8');
  for (const m of code.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) addon(path.posix.join(path.posix.dirname(rel), m[1]));
}
['postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js', 'environments/RoomEnvironment.js'].forEach(addon);

// Chart.js (same version the original site loaded from cdnjs).
copy(path.join(src, 'chart.js/dist/chart.umd.js'), path.join(root, 'vendor/chart.umd.js'));

// Fonts: latin subsets, the weights the site uses.
const fonts = [
  ['cinzel-decorative', 'Cinzel Decorative', [[700, 'normal'], [900, 'normal']]],
  ['cinzel', 'Cinzel', [[400, 'normal'], [500, 'normal'], [600, 'normal'], [700, 'normal']]],
  ['cormorant-garamond', 'Cormorant Garamond', [[400, 'normal'], [600, 'normal'], [400, 'italic'], [600, 'italic']]],
  ['plus-jakarta-sans', 'Plus Jakarta Sans', [[300, 'normal'], [400, 'normal'], [500, 'normal'], [600, 'normal']]]
];
let css = '/* Self-hosted fonts (SIL Open Font License, via @fontsource). */\n';
fonts.forEach(([id, family, faces]) => {
  faces.forEach(([w, style]) => {
    const name = `${id}-latin-${w}-${style}.woff2`;
    copy(path.join(src, '@fontsource', id, 'files', name), path.join(root, 'fonts', name));
    css += `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: ${w}; font-display: swap; src: url("${name}") format("woff2"); }\n`;
  });
  copy(path.join(src, '@fontsource', id, 'LICENSE'), path.join(root, 'fonts', `LICENSE-${id}.txt`));
});
fs.writeFileSync(path.join(root, 'fonts/fonts.css'), css);
console.log('Vendored three add-ons:', [...seen].join(', '));
