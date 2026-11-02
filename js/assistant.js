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

  // Offline answers: built from the shared scoring file, picked by what the question is about.
  let restShown = false;
  function localAnswer(q) {
    const s = settings(), L = s.limits, N = s.lateNight, d = currentData();
    const t = CS.normalizeDay(d.today), r = CS.scoreDay(t, s), H = CS.fmtH;
    const week = (d.week || []).map(CS.normalizeDay).filter(x => CS.totalOf(x) > 0);
    const has = re => re.test(q.toLowerCase());
    const tipList = k => CS.TIPS[k].map((x, i) => `${i + 1}. ${x}`).join('\n');
    if (has(/\b(hi|hello|hey|thanks|thank you)\b/)) return `Happy to help! Today you are at ${r.score}/100 (${r.label}). Ask me about late nights, gaming, videos, study or your week.`;
    if (has(/week|7 days|seven|trend/)) {
      if (week.length < 2) return 'I only have one day so far. Log a few more days and I can show you how your week is going.';
      const avg = Math.round(week.reduce((a, x) => a + CS.scoreDay(x, s).score, 0) / week.length);
      const best = week.reduce((a, x) => CS.scoreDay(x, s).score > CS.scoreDay(a, s).score ? x : a);
      const lateDays = week.filter(x => x.late > L.late).length;
      return `Across ${week.length} days your average score is ${avg} (${CS.labelFor(avg).name}).\nYour best day scored ${CS.scoreDay(best, s).score}.\n${lateDays ? `Late-night use went past ${H(L.late)} on ${lateDays} day${lateDays > 1 ? 's' : ''}. That is the easiest thing to improve.` : 'You kept late nights under control every day. Great habit!'}`;
    }
    if (has(/sleep|bed|night|late|wind|tired|1 ?am|midnight/)) return `You had ${H(t.late)} of screen time between ${N.start} and ${N.end} today (guideline: ${H(L.late)}).\nA simple wind-down plan:\n1. 30 minutes before ${N.start}, put your phone on charge outside your room.\n2. Swap screens for a book, music or tomorrow's to-do list.\n3. Keep the same bedtime on weekends so your body clock stays steady.`;
    if (has(/game|gaming|play|valorant|minecraft|bgmi|roblox/)) return `Gaming today: ${H(t.gaming)} (guideline ${H(L.gaming)}). ${t.gaming > L.gaming ? `That is ${H(t.gaming - L.gaming)} over.` : 'You are inside the guideline. Nice!'}\n${tipList('gaming')}`;
    if (has(/youtube|video|social|instagram|reel|netflix|entertain|scroll/)) return `Entertainment today: ${H(t.entertainment)} (guideline ${H(L.entertainment)}). ${t.entertainment > L.entertainment ? `That is ${H(t.entertainment - L.entertainment)} over.` : 'Well balanced!'}\n${tipList('entertainment')}`;
    if (has(/study|homework|learn|exam|school/)) return `You studied ${H(t.study)} on screens today. Study time is never counted against you, it adds up to 5 bonus points.\nTip: study in 25-minute blocks with 5-minute screen-free breaks, and keep your phone in another room.`;
    if (has(/sad|anxious|stress|addict|depress|can't stop|cannot stop|worried|health|eyes|headache/)) return 'That sounds hard, and it is good that you noticed it. Please talk to a parent, teacher or doctor about how you feel. I can help with small screen-time steps, but they can really support you.';
    if (has(/score|how am i|doing|problem|worst|biggest|improve|tips?|advice|help/)) return `Your score today is ${r.score}/100: ${r.label}.\n${r.biggest ? 'Biggest thing to work on: ' + r.biggest : 'No guideline was crossed today. Nice work.'}\n${tipList(r.biggestKey || 'none')}`;
    return `Here is what I see: ${H(CS.totalOf(t))} of screen time today, score ${r.score}/100 (${r.label}). Try asking me about your late nights, gaming, videos, study time or your week.`;
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
      // First time: the friendly line + quick read. After that, answer each question from the numbers.
      if (!restShown) { restShown = true; bubble('bot', `<p>${esc(restingLine())}</p>${offlineCard()}`, 'resting'); }
      else bubble('bot', render(localAnswer(shown || '')));
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
