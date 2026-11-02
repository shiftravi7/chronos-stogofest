/* CHRONOS · installable web app (PWA) */
(() => {
  'use strict';
  const inApp = !!window.Capacitor || location.protocol === 'app:';
  if (!inApp && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window.__chronosInstallPrompt = e;
    dispatchEvent(new Event('chronos:installable'));
  });
})();
