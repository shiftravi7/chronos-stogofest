/* =========================================================
   CHRONOS · Assistant (floating chat)
   Same code on the website, the PWA, the Android app and the
   Windows app. It only ever calls /api/assistant — never Gemini.
   ========================================================= */
(() => {
  'use strict';
  const CS = window.ChronosScore;
  if (!CS) return;

  const PROD = 'https://chronos-stogofest.vercel.app';
  const inApp = !!window.Capacitor || location.protocol === 'app:' || location.protocol === 'file:';
  const endpoint = () => {
    let base = '';
    try { base = localStorage.getItem('chronos.apiBase') || ''; } catch (e) {}
    if (!base && inApp) base = PROD;
    return base.replace(/\/+$/, '') + '/api/assistant';
  };

  const RESTING = [
    'Assistant is taking a short breather, please try again in a little while.',
    'Assistant is resting for a moment, here is a quick read from your numbers meanwhile.'
  ];
  const CHIPS = ['How am I doing today?', 'What is my biggest problem?', 'Plan a wind-down routine for me', 'How was my week?'];

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Plain text → safe HTML with paragraphs and numbered lists.
  function render(text) {
    const lines = String(text).split(/\r?\n/);
    let html = '', list = false;
    lines.forEach(line => {
      const t = line.trim();
      const m = t.match(/^(\d+)[.)]\s+(.*)$/) || t.match(/^[-•*]\s+(.*)$/);
      if (m) { if (!list) { html += '<ol>'; list = true; } html += `<li>${esc(m[2] != null ? m[2] : m[1]).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</li>`; return; }
      if (list) { html += '</ol>'; list = false; }
      if (t) html += `<p>${esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>`;
    });
    if (list) html += '</ol>';
    return html;
  }

  // The numbers Assistant looks at: device data in the apps, the manual log on the web.
  function currentData() {
    const dev = window.ChronosDevice && window.ChronosDevice.data && window.ChronosDevice.data();
    if (dev && dev.today) return { ...dev, source: 'device' };
    const app = window.ChronosApp && window.ChronosApp.manualData && window.ChronosApp.manualData();
    return app ? { today: app.today, week: app.week, source: 'manual' } : { today: {}, week: [], source: 'manual' };
  }
  const settings = () => (window.ChronosApp && window.ChronosApp.settings ? window.ChronosApp.settings() : CS.mergeSettings());

  /* ---------- UI ---------- */
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'assistant-fab'; fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-label', 'Open Assistant');
  fab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.6 4.3 4.4 1.6-4.4 1.6L12 15.3l-1.6-4.3L6 9.4l4.4-1.6z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/><path d="M5.5 15.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"/></svg><span>Assistant</span>`;

  const panel = document.createElement('section');
  panel.className = 'assistant-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'asTitle');
  panel.innerHTML = `
    <header class="as-head">
      <span class="as-seal" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5l1.6 4.3 4.4 1.6-4.4 1.6L12 15.3l-1.6-4.3L6 9.4l4.4-1.6z"/></svg></span>
      <div><h2 id="asTitle">Assistant</h2><p>Kind, simple tips from your screen-time numbers</p></div>
      <button type="button" class="as-close" aria-label="Close Assistant">×</button>
    </header>
    <div class="as-log" aria-live="polite"></div>
    <div class="as-chips">${CHIPS.map(c => `<button type="button" class="as-chip">${esc(c)}</button>`).join('')}</div>
    <form class="as-form">
      <label class="sr-only" for="asInput">Ask Assistant</label>
      <textarea id="asInput" rows="1" maxlength="600" placeholder="Ask about your screen time…"></textarea>
      <button type="submit" class="as-send" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg></button>
    </form>
    <p class="as-foot">Only your totals are shared, never your name or apps. Friendly guidance, not medical advice.</p>`;
  document.body.append(fab, panel);

  const log = panel.querySelector('.as-log'), input = panel.querySelector('#asInput'), form = panel.querySelector('.as-form');
  const history = [];
  let busy = false, greeted = false;

  function bubble(who, html, extraClass) {
    const b = document.createElement('div');
    b.className = `as-msg ${who}${extraClass ? ' ' + extraClass : ''}`;
    b.innerHTML = html;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }
  function offlineCard() {
    const s = CS.offlineSummary(currentData(), settings());
    return `<div class="as-offline"><div class="as-score"><b>${s.score}</b><span>/100 · ${esc(s.label)}</span></div>
      ${s.biggestProblem ? `<p><b>Biggest thing to work on:</b> ${esc(s.biggestProblem)}</p>` : '<p>No guideline was crossed today. Nice work.</p>'}
      <ol>${s.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>`;
  }
  function restingLine() {
    let i = 0;
    try { i = (+localStorage.getItem('chronos.restIdx') || 0) % RESTING.length; localStorage.setItem('chronos.restIdx', String(i + 1)); } catch (e) {}
    return RESTING[i];
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function callAssistant(question) {
    const body = JSON.stringify({ question, data: currentData(), settings: settings(), history: history.slice(-8) });
    const delays = [0, 1500, 4000];
    for (const d of delays) {
      if (d) await wait(d);
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 35000);
        const r = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctrl.signal });
        clearTimeout(timer);
        if (r.status === 404 || r.status === 405) return null;   // static hosting (e.g. GitHub Pages): no server, use the offline read
        const j = await r.json().catch(() => null);
        if (j && j.ok && j.reply) return j.reply;
        if (j && j.retry === false) return null;   // not available right now: go straight to the offline read
      } catch (e) { /* offline or busy: try again quietly */ }
    }
    return null;
  }

  async function ask(question, shown) {
    if (busy) return;
    busy = true; form.classList.add('busy');
    if (shown) bubble('me', `<p>${esc(shown)}</p>`);
    const typing = bubble('bot', '<span class="as-dots"><i></i><i></i><i></i></span><span class="sr-only">Assistant is thinking</span>', 'typing');
    const reply = await callAssistant(question);
    typing.remove();
    if (reply) {
      bubble('bot', render(reply));
      if (shown) history.push({ role: 'user', text: shown });
      history.push({ role: 'assistant', text: reply });
    } else {
      bubble('bot', `<p>${esc(restingLine())}</p>${offlineCard()}`, 'resting');
    }
    busy = false; form.classList.remove('busy');
  }

  function openPanel() {
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); fab.classList.add('open');
    requestAnimationFrame(() => panel.classList.add('show'));
    if (!greeted) {
      greeted = true;
      const d = currentData();
      bubble('bot', `<p>Hi, I’m Assistant. I’ll look at your ${d.source === 'device' ? 'screen time from this device' : 'logged screen time'} and tell you how it’s going, kindly and simply.</p>`);
      ask('Please look at my screen time and give me my check-in.', null);
    }
    setTimeout(() => input.focus({ preventScroll: true }), 250);
  }
  function closePanel() {
    panel.classList.remove('show'); fab.setAttribute('aria-expanded', 'false'); fab.classList.remove('open');
    setTimeout(() => { if (!panel.classList.contains('show')) panel.hidden = true; }, 260);
    fab.focus({ preventScroll: true });
  }
  fab.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
  panel.querySelector('.as-close').addEventListener('click', closePanel);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
  panel.querySelectorAll('.as-chip').forEach(c => c.addEventListener('click', () => ask(c.textContent, c.textContent)));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!q) return;
    input.value = ''; input.style.height = '';
    ask(q, q);
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });

  window.ChronosAssistant = { open: openPanel, close: closePanel, ask: q => { openPanel(); ask(q, q); } };
})();
