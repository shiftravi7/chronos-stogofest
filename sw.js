/* CHRONOS · service worker — offline app shell. The Assistant (/api/) is never cached. */
const CACHE = 'chronos-v2.0.0';
const SHELL = [
  './', 'index.html', 'manifest.json', 'downloads.config.js',
  'css/upgrade.css', 'fonts/fonts.css',
  'shared/chronos-score.js', 'js/download-panel.js', 'js/device-dashboard.js', 'js/assistant.js', 'js/pwa.js', 'js/intro3d.js',
  'vendor/chart.umd.js', 'vendor/three/build/three.module.js', 'vendor/three/build/three.core.js',
  'vendor/three/examples/jsm/postprocessing/EffectComposer.js', 'vendor/three/examples/jsm/postprocessing/RenderPass.js',
  'vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js', 'vendor/three/examples/jsm/postprocessing/OutputPass.js',
  'vendor/three/examples/jsm/postprocessing/ShaderPass.js', 'vendor/three/examples/jsm/postprocessing/Pass.js',
  'vendor/three/examples/jsm/postprocessing/MaskPass.js', 'vendor/three/examples/jsm/shaders/CopyShader.js',
  'vendor/three/examples/jsm/shaders/LuminosityHighPassShader.js', 'vendor/three/examples/jsm/shaders/OutputShader.js',
  'vendor/three/examples/jsm/environments/RoomEnvironment.js',
  'images/hero-dark.webp', 'images/hero-light.webp', 'images/clock-dark.webp', 'images/clock-light.webp',
  'images/register-dark.webp', 'images/register-light.webp', 'images/sanctuary-dark.webp', 'images/sanctuary-light.webp',
  'images/science-dark.webp', 'images/science-light.webp', 'images/credits-dark.webp', 'images/credits-light.webp',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    // Fresh page when online, cached page when offline.
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
