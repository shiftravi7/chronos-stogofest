/* =========================================================
   CHRONOS · Download App panel
   Links come from downloads.config.js. Empty link → "Coming soon".
   ========================================================= */
(() => {
  'use strict';
  const cfg = window.CHRONOS_DOWNLOADS || {};
  const ua = navigator.userAgent || '';
  const device = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios'
    : /Android/i.test(ua) ? 'android'
    : /Windows NT/i.test(ua) ? 'windows' : null;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => /^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';

  const ICONS = {
    android: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10h10v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M7 9a5 5 0 0 1 10 0z"/><path d="M9.5 6.2 8.3 4.5M14.5 6.2l1.2-1.7M4.5 10.5v5M19.5 10.5v5M10 18v2.5M14 18v2.5"/></svg>',
    windows: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5 10.5 4.5v7h-7zM12.5 4.2 20.5 3v8.5h-8zM3.5 12.5h7v7l-7-1zM12.5 12.5h8V21l-8-1.2z"/></svg>',
    ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5h3M11 18.5h2"/></svg>'
  };

  function card(kind, title, body) {
    const here = device === kind;
    return `<article class="dl-card${here ? ' is-device' : ''}" data-kind="${kind}">
      ${here ? '<span class="dl-here">For this device</span>' : ''}
      <span class="dl-card-ico">${ICONS[kind]}</span>
      <h3>${title}</h3>${body}</article>`;
  }
  function fileCard(kind, title, c) {
    const url = safeUrl(c && c.url);
    const action = url
      ? `<a class="btn btn-primary dl-get" href="${esc(url)}" download="${esc(c.fileName)}" rel="noopener">Download ${esc(c.fileName)}</a>`
      : `<span class="dl-soon">Coming soon</span>`;
    const extra = kind === 'android'
      ? '<p class="dl-small">After downloading, open the file and allow “Install unknown apps” for your browser when Android asks.</p>'
      : '<p class="dl-small">If Windows SmartScreen appears, choose “More info”, then “Run anyway”. CHRONOS then starts with Windows and waits in the tray.</p>';
    return card(kind, title, `<p>${esc(c && c.note)}</p>${action}${url ? extra : ''}${c && c.version ? `<span class="dl-ver">Version ${esc(c.version)}</span>` : ''}`);
  }
  function iosCard(c) {
    const store = safeUrl(c && c.appStoreUrl);
    return card('ios', 'iPhone / iPad', `<p>${esc(c && c.note)}</p>
      <ol class="dl-steps">
        <li>Open this site in <b>Safari</b>.</li>
        <li>Tap <b>Share</b> <svg class="dl-share" viewBox="0 0 24 24" aria-label="the Share icon"><path d="M12 15V3m0 0-4 4m4-4 4 4M6 11H5v10h14V11h-1"/></svg> at the bottom of the screen.</li>
        <li>Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open CHRONOS from your home screen: it works like an app, with the Assistant.</li>
      </ol>
      <button class="btn dl-install" type="button" hidden>Install web app now</button>
      ${store ? `<a class="btn btn-primary" href="${esc(store)}" rel="noopener">Open the App Store</a>` : '<span class="dl-soon">App Store version · Coming soon</span>'}`);
  }

  const dlg = document.createElement('dialog');
  dlg.className = 'dl-dlg';
  dlg.setAttribute('aria-labelledby', 'dlTitle');
  dlg.innerHTML = `<div class="dl-inner">
    <header class="dl-head">
      <div><span class="label">Take CHRONOS with you</span><h2 id="dlTitle">Download App</h2></div>
      <button class="btn dl-close" type="button" aria-label="Close the download panel">Close</button>
    </header>
    <div class="dl-grid">
      ${fileCard('android', 'Android', cfg.android)}
      ${fileCard('windows', 'Windows', cfg.windows)}
      ${iosCard(cfg.ios)}
    </div>
    <p class="dl-foot">Your screen-time data stays on your device. Only totals are shared with the Assistant when you ask it something.</p>
  </div>`;
  document.body.appendChild(dlg);

  const open = () => {
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.scrollTop = 0;
    paintInstall();
  };
  const close = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
  dlg.querySelector('.dl-close').addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  document.addEventListener('click', e => { const b = e.target.closest('[data-download-open]'); if (b) { e.preventDefault(); open(); } });

  // Chrome/Edge on Android or desktop can install the PWA directly.
  function paintInstall() {
    const b = dlg.querySelector('.dl-install');
    b.hidden = !window.__chronosInstallPrompt;
  }
  dlg.querySelector('.dl-install').addEventListener('click', async () => {
    const p = window.__chronosInstallPrompt; if (!p) return;
    p.prompt();
    try { await p.userChoice; } catch (e) {}
    window.__chronosInstallPrompt = null; paintInstall();
  });
  window.addEventListener('chronos:installable', paintInstall);

  window.ChronosDownloads = { open, close, device };
})();
