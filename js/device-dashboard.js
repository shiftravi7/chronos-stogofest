/* =========================================================
   CHRONOS · device dashboard (Android + Windows apps only)
   Real screen time measured on the device, scored by the same
   shared/chronos-score.js as the website. Hidden on the web.
   ========================================================= */
(() => {
  'use strict';
  const CS = window.ChronosScore;
  const cap = window.Capacitor;
  const isAndroid = !!(cap && cap.getPlatform && cap.getPlatform() === 'android');
  const win = window.chronosNative && window.chronosNative.platform === 'windows' ? window.chronosNative : null;
  if (!CS || (!isAndroid && !win)) return;

  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const settings = () => (window.ChronosApp ? window.ChronosApp.settings() : CS.mergeSettings());
  const CAT_COLORS = { gaming: 'var(--cat-gaming)', entertainment: 'var(--cat-ent)', study: 'var(--cat-study)', other: 'var(--cat-other)' };
  const DAY = 86400000;
  const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

  /* ---------- Data adapters → { days: [{ date, apps: [{ id, name, category, minutes, lateMinutes }] }] } ---------- */
  const Android = {
    plugin: () => cap.Plugins.UsageStats,
    overrides() { try { return JSON.parse(localStorage.getItem('chronos.overrides.android') || '{}'); } catch (e) { return {}; } },
    async hasPermission() { try { return !!(await this.plugin().hasPermission()).granted; } catch (e) { return false; } },
    async openSettings() { await this.plugin().openUsageSettings(); },
    async setCategory(id, cat) { const o = this.overrides(); o[id] = cat; localStorage.setItem('chronos.overrides.android', JSON.stringify(o)); },
    async load(nDays) {
      const from = startOfDay() - (nDays - 1) * DAY, to = Date.now();
      const r = await this.plugin().getUsage({ from, to });
      const o = this.overrides(), s = settings(), days = {};
      for (let i = 0; i < nDays; i++) days[CS.dayKey(from + i * DAY + 3600000)] = {};
      (r.apps || []).forEach(a => {
        const category = CS.categorizeAndroid({ packageName: a.packageName, systemCategory: a.systemCategory, isGame: a.isGame }, o);
        (a.intervals || []).forEach(([st, en]) => {
          // Split each foreground interval at midnight so every day gets its own minutes.
          for (let t = st; t < en;) {
            const dayEnd = startOfDay(t) + DAY, e2 = Math.min(en, dayEnd), k = CS.dayKey(t);
            const bucket = days[k] || (days[k] = {});
            const app = bucket[a.packageName] || (bucket[a.packageName] = { id: a.packageName, name: a.label || a.packageName, category, minutes: 0, lateMinutes: 0 });
            app.minutes += (e2 - t) / 60000;
            app.lateMinutes += CS.lateMinutesBetween(t, e2, s);
            t = e2;
          }
        });
      });
      return { days: Object.keys(days).sort().map(date => ({ date, apps: Object.values(days[date]) })), checkedAt: r.checkedAt };
    }
  };
  const Windows = {
    async hasPermission() { return true; },
    async setCategory(id, cat) { await win.setCategory(id, cat); },
    async load(nDays) { return await win.getDays(nDays, settings()); }
  };
  const src = isAndroid ? Android : Windows;

  /* ---------- UI ---------- */
  const section = document.createElement('section');
  section.className = 'chap device-chap'; section.id = 'device'; section.setAttribute('aria-labelledby', 't-device');
  section.innerHTML = `<div class="wrap">
    <header class="dev-head">
      <span class="label">${isAndroid ? 'This phone' : 'This PC'} · measured automatically</span>
      <h2 class="ch-title" id="t-device">Your Device</h2>
      <p class="sub">${isAndroid ? 'The same numbers Digital Wellbeing shows, scored by CHRONOS.' : 'CHRONOS keeps tracking quietly from the system tray. Idle and locked time are not counted.'}</p>
    </header>
    <div class="dev-perm" hidden>
      <h3>One permission, then CHRONOS can see your real screen time</h3>
      <p>Android keeps app-usage data private. To read it, CHRONOS needs <b>Usage Access</b>. This is the same data <b>Digital Wellbeing</b> shows. It stays on your phone: only daily totals are sent to the Assistant, and only when you ask it something.</p>
      <ol><li>Tap <b>Open Usage Access</b> below.</li><li>Find <b>CHRONOS</b> in the list and tap it.</li><li>Turn on <b>Permit usage access</b>, then come back.</li></ol>
      <button class="btn btn-primary dev-grant" type="button">Open Usage Access</button>
      <p class="dev-small">CHRONOS never reads anything before you allow it, and you can turn it off at any time in the same screen.</p>
    </div>
    <div class="dev-body" hidden>
      <div class="dev-tabs" role="tablist" aria-label="Time range">
        <button role="tab" type="button" aria-selected="true" data-range="1">Today</button>
        <button role="tab" type="button" aria-selected="false" data-range="7">Last 7 days</button>
        <span class="dev-updated" aria-live="polite"></span>
      </div>
      <div class="dev-grid">
        <article class="dev-card dev-score">
          <span class="label">Score</span>
          <div class="dev-score-num"><b>—</b><small>/100</small></div>
          <span class="pill gold dev-label">—</span>
          <p class="dev-problem"></p>
        </article>
        <article class="dev-card">
          <span class="label">Screen time</span>
          <div class="dev-big dev-total">—</div>
          <span class="label">Late-night <em class="dev-window"></em></span>
          <div class="dev-big dev-late">—</div>
        </article>
        <article class="dev-card dev-cats">
          <span class="label">By category</span>
          <div class="dev-stack" aria-hidden="true"></div>
          <ul class="dev-catlist"></ul>
        </article>
        <article class="dev-card dev-week" hidden>
          <span class="label">Day by day</span>
          <div class="dev-bars" role="img" aria-label="Screen time for each of the last seven days"></div>
        </article>
        <article class="dev-card dev-apps">
          <span class="label">Top 5 apps</span>
          <ol class="dev-applist"></ol>
          <p class="dev-small">Tap a category to move an app. CHRONOS remembers your choice.</p>
        </article>
      </div>
      <div class="btn-row dev-actions">
        <button class="btn btn-primary dev-log" type="button">Save today to my log</button>
        <button class="btn dev-ask" type="button">Ask Assistant about this</button>
        <button class="btn dev-refresh" type="button">Refresh</button>
      </div>
    </div>
  </div>`;
  const main = $('#main');
  main.insertBefore(section, main.firstElementChild);

  let range = 1, cache = { 1: null, 7: null }, loading = false;

  function totals(apps) { return CS.dayFromApps(apps); }
  function mergeApps(days) {
    const m = {};
    days.forEach(d => d.apps.forEach(a => { const x = m[a.id] || (m[a.id] = { ...a, minutes: 0, lateMinutes: 0 }); x.minutes += a.minutes; x.lateMinutes += a.lateMinutes; x.category = a.category; }));
    return Object.values(m);
  }

  function paint() {
    const d7 = cache[7], d1 = cache[1] || (d7 && { days: d7.days.slice(-1) });
    const data = range === 7 ? d7 : d1;
    if (!data) return;
    const s = settings();
    const days = data.days, apps = mergeApps(days);
    const dayTotals = days.map(d => totals(d.apps));
    const sum = CS.sumDays(dayTotals);
    const n = Math.max(1, range === 7 ? dayTotals.filter(t => CS.totalOf(t) > 0).length : 1);
    const avg = { gaming: sum.gaming / n, entertainment: sum.entertainment / n, study: sum.study / n, other: sum.other / n, late: sum.late / n };
    const scoreOf = range === 7 ? Math.round(dayTotals.filter(t => CS.totalOf(t) > 0).reduce((a, t) => a + CS.scoreDay(t, s).score, 0) / n) : CS.scoreDay(dayTotals[dayTotals.length - 1], s).score;
    const r = CS.scoreDay(range === 7 ? avg : dayTotals[dayTotals.length - 1], s);
    const lab = CS.labelFor(scoreOf);
    $('.dev-score-num b', section).textContent = scoreOf;
    const pill = $('.dev-label', section);
    pill.textContent = lab.name + (range === 7 ? ' · 7-day average' : '');
    pill.className = 'pill dev-label ' + ({ great: 'emerald', okay: 'gold', attention: 'cognac', unhealthy: 'bordeaux' })[lab.tone];
    $('.dev-problem', section).textContent = r.biggest ? 'Biggest thing to work on: ' + r.biggest : 'Every guideline met. Lovely rhythm.';
    $('.dev-total', section).textContent = CS.fmtH(range === 7 ? CS.totalOf(sum) : CS.totalOf(dayTotals[dayTotals.length - 1])) + (range === 7 ? ' total' : '');
    $('.dev-late', section).textContent = CS.fmtH(range === 7 ? sum.late : dayTotals[dayTotals.length - 1].late);
    $('.dev-window', section).textContent = `(${s.lateNight.start}–${s.lateNight.end})`;
    const shown = range === 7 ? sum : dayTotals[dayTotals.length - 1], tot = CS.totalOf(shown) || 1;
    $('.dev-stack', section).innerHTML = CS.CATEGORIES.map(c => `<i style="width:${(shown[c] / tot * 100).toFixed(2)}%;background:${CAT_COLORS[c]}"></i>`).join('');
    $('.dev-catlist', section).innerHTML = CS.CATEGORIES.map(c => `<li><span class="dot" style="background:${CAT_COLORS[c]}"></span>${CS.CATEGORY_LABELS[c]}<b>${CS.fmtH(shown[c])}</b></li>`).join('');
    const week = $('.dev-week', section);
    week.hidden = range !== 7;
    if (range === 7) {
      const max = Math.max(1, ...dayTotals.map(CS.totalOf));
      $('.dev-bars', section).innerHTML = dayTotals.map((t, i) => {
        const dd = new Date(days[i].date + 'T12:00');
        return `<div class="dev-bar"><div class="dev-col">${CS.CATEGORIES.map(c => `<i style="height:${(t[c] / max * 100).toFixed(2)}%;background:${CAT_COLORS[c]}"></i>`).join('')}</div><span>${dd.toLocaleDateString(undefined, { weekday: 'short' })}</span><em>${CS.fmtH(CS.totalOf(t))}</em></div>`;
      }).join('');
    }
    const top = apps.filter(a => a.minutes >= 1).sort((a, b) => b.minutes - a.minutes).slice(0, 5);
    $('.dev-applist', section).innerHTML = top.length ? top.map(a => `<li>
        <span class="dev-app-name">${esc(a.name)}</span>
        <select class="dev-cat" data-id="${esc(a.id)}" aria-label="Category for ${esc(a.name)}">${CS.CATEGORIES.map(c => `<option value="${c}"${c === a.category ? ' selected' : ''}>${CS.CATEGORY_LABELS[c]}</option>`).join('')}</select>
        <b>${CS.fmtH(a.minutes / 60)}</b>${a.lateMinutes >= 1 ? `<em>${CS.fmtH(a.lateMinutes / 60)} late</em>` : ''}</li>`).join('')
      : '<li class="dev-empty">No app use recorded yet for this period.</li>';
    $('.dev-updated', section).textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function refresh() {
    if (loading) return; loading = true;
    try {
      const ok = await src.hasPermission();
      $('.dev-perm', section).hidden = ok;
      $('.dev-body', section).hidden = !ok;
      if (!ok) { showWelcome(); return; }
      cache[7] = await src.load(7);
      cache[1] = { days: cache[7].days.slice(-1) };
      paint();
    } catch (e) {
      $('.dev-updated', section).textContent = 'Could not refresh just now';
    } finally { loading = false; }
  }

  /* ---------- First launch: friendly permission explainer (Android) ---------- */
  function showWelcome() {
    if (!isAndroid) return;
    let seen = false; try { seen = localStorage.getItem('chronos.welcomeSeen') === '1'; } catch (e) {}
    if (seen || $('.dev-welcome')) return;
    const w = document.createElement('div');
    w.className = 'dev-welcome'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'welTitle');
    w.innerHTML = `<div class="dev-welcome-card">
      <span class="label">Welcome to CHRONOS</span>
      <h2 id="welTitle">See your real screen time</h2>
      <p>CHRONOS can measure your screen time for you, so you don’t have to type it in. To do that, Android asks you to allow <b>Usage Access</b> — the same data <b>Digital Wellbeing</b> shows.</p>
      <ul><li>Your data stays on this phone.</li><li>CHRONOS reads nothing until you allow it.</li><li>You can switch it off any time.</li></ul>
      <div class="btn-row"><button class="btn btn-primary" type="button" data-go>Allow Usage Access</button><button class="btn" type="button" data-later>Not now</button></div>
    </div>`;
    document.body.appendChild(w);
    const done = () => { try { localStorage.setItem('chronos.welcomeSeen', '1'); } catch (e) {} w.remove(); };
    $('[data-go]', w).addEventListener('click', async () => { done(); await src.openSettings(); });
    $('[data-later]', w).addEventListener('click', done);
  }

  section.addEventListener('click', async e => {
    const tab = e.target.closest('[data-range]');
    if (tab) { range = +tab.dataset.range; section.querySelectorAll('[data-range]').forEach(b => b.setAttribute('aria-selected', String(b === tab))); paint(); return; }
    if (e.target.closest('.dev-grant')) { await src.openSettings(); return; }
    if (e.target.closest('.dev-refresh')) { refresh(); return; }
    if (e.target.closest('.dev-ask')) { if (window.ChronosAssistant) window.ChronosAssistant.ask(range === 7 ? 'How was my week on this device?' : 'How is my screen time today on this device?'); return; }
    if (e.target.closest('.dev-log') && cache[1] && window.ChronosApp) {
      const t = totals(cache[1].days[0].apps);
      window.ChronosApp.logDay(CS.dayKey(new Date()), { ...t, source: 'device' });
      window.ChronosApp.toast('Saved', `Today’s device screen time (${CS.fmtH(CS.totalOf(t))}) is now in your log.`);
    }
  });
  section.addEventListener('change', async e => {
    const sel = e.target.closest('.dev-cat'); if (!sel) return;
    await src.setCategory(sel.dataset.id, sel.value);
    cache = { 1: null, 7: null }; refresh();
  });

  // Assistant reads these numbers in the apps.
  window.ChronosDevice = {
    data() {
      if (!cache[7]) return null;
      const days = cache[7].days.map(d => totals(d.apps));
      return { today: days[days.length - 1], week: days };
    },
    refresh
  };

  refresh();
  setInterval(refresh, 15 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  addEventListener('chronos:settings-changed', () => { cache = { 1: null, 7: null }; refresh(); });
  if (win && win.onUpdate) win.onUpdate(() => { if (!document.hidden) refresh(); });
  if (isAndroid && cap.Plugins.App && cap.Plugins.App.addListener) cap.Plugins.App.addListener('resume', refresh);
})();
