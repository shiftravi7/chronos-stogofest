/* =========================================================
   CHRONOS · shared screen-time model
   ONE file used by the website, the PWA, the Android app,
   the Windows app and the Assistant's offline fallback.

   Works as a browser <script> (window.ChronosScore) and as a
   Node/Electron module (require('./chronos-score.js')).

   These are friendly guidelines, not medical advice.
   ========================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChronosScore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Editable defaults ---------- */
  const CATEGORIES = ['gaming', 'entertainment', 'study', 'other'];
  const CATEGORY_LABELS = { gaming: 'Gaming', entertainment: 'Entertainment', study: 'Study', other: 'Other', late: 'Late-night' };

  const DEFAULT_SETTINGS = {
    // Daily guideline limits in hours. Study is never limited.
    limits: { total: 4, gaming: 1.5, entertainment: 1.5, late: 20 / 60 },
    // Late-night window (24 h clock). Any use inside it is Late-night.
    lateNight: { start: '23:00', end: '05:00' }
  };

  const LABELS = [
    { min: 80, name: 'Great', tone: 'great' },
    { min: 60, name: 'Okay', tone: 'okay' },
    { min: 40, name: 'Needs attention', tone: 'attention' },
    { min: 0, name: 'Unhealthy', tone: 'unhealthy' }
  ];

  // The most points each guideline can take away when it is exceeded.
  const WEIGHTS = { total: 30, gaming: 25, entertainment: 20, late: 35 };
  // How far over a limit (in hours) it takes to lose all of a guideline's points.
  const FULL_PENALTY_AT = { total: 4, gaming: 1.5, entertainment: 1.5, late: 1 };

  const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const round1 = n => Math.round(n * 10) / 10;

  function mergeSettings(s) {
    s = s || {};
    return {
      limits: Object.assign({}, DEFAULT_SETTINGS.limits, s.limits || {}),
      lateNight: Object.assign({}, DEFAULT_SETTINGS.lateNight, s.lateNight || {})
    };
  }

  /* ---------- Day model ----------
     A day is { gaming, entertainment, study, other, late } in hours.
     late is a highlighted SUBSET of the total, never added on top. */
  function normalizeDay(d) {
    d = d || {};
    const day = { gaming: num(d.gaming), entertainment: num(d.entertainment), study: num(d.study), other: num(d.other), late: num(d.late) };
    const t = day.gaming + day.entertainment + day.study + day.other;
    if (day.late > t) day.late = t;
    return day;
  }
  const totalOf = d => { const n = normalizeDay(d); return n.gaming + n.entertainment + n.study + n.other; };
  // Screen time that counts against the 4-hour guideline (study is a positive, never penalised).
  const leisureOf = d => { const n = normalizeDay(d); return n.gaming + n.entertainment + n.other; };

  // Older CHRONOS logs stored { study, diversion, nocturnal } with late-night added on top.
  // Keep their totals identical: diversion becomes Gaming, nocturnal becomes Other + Late-night.
  function fromLegacyEntry(e) {
    if (!e || !('diversion' in e || 'nocturnal' in e) || 'gaming' in e) return e;
    const out = Object.assign({}, e, { study: num(e.study), gaming: num(e.diversion), entertainment: 0, other: num(e.nocturnal), late: num(e.nocturnal) });
    delete out.diversion; delete out.nocturnal;
    return out;
  }

  function labelFor(score) {
    for (const l of LABELS) if (score >= l.min) return l;
    return LABELS[LABELS.length - 1];
  }

  /* ---------- Scoring ---------- */
  function scoreDay(d, settings) {
    const s = mergeSettings(settings), L = s.limits, day = normalizeDay(d);
    const values = { total: leisureOf(day), gaming: day.gaming, entertainment: day.entertainment, late: day.late };
    const penalties = {};
    let score = 100;
    Object.keys(WEIGHTS).forEach(k => {
      const over = Math.max(0, values[k] - num(L[k]));
      const p = Math.min(WEIGHTS[k], WEIGHTS[k] * over / FULL_PENALTY_AT[k]);
      penalties[k] = { over, points: p };
      score -= p;
    });
    // Study is a positive: up to +5 points for real learning time, never a penalty.
    score += Math.min(day.study, 2) * 2.5;
    score = Math.round(Math.max(0, Math.min(100, score)));
    const worst = Object.keys(penalties).reduce((a, k) => penalties[k].points > (a ? penalties[a].points : 0) ? k : a, null);
    const label = labelFor(score);
    return { score, label: label.name, tone: label.tone, day, total: totalOf(day), leisure: values.total, penalties, biggest: worst ? problemText(worst, penalties[worst].over, day, L) : null, biggestKey: worst };
  }

  const fmtH = h => {
    const m = Math.round(h * 60);
    if (m < 60) return `${m} min`;
    const hh = Math.floor(m / 60), mm = m % 60;
    return mm ? `${hh} h ${mm} min` : `${hh} h`;
  };

  function problemText(key, over, day, L) {
    switch (key) {
      case 'late': return `Late-night screen time: ${fmtH(day.late)}, which is ${fmtH(over)} past the ${fmtH(L.late)} guideline.`;
      case 'gaming': return `Gaming: ${fmtH(day.gaming)}, which is ${fmtH(over)} over the ${fmtH(L.gaming)} guideline.`;
      case 'entertainment': return `Entertainment (videos, social, music): ${fmtH(day.entertainment)}, ${fmtH(over)} over the ${fmtH(L.entertainment)} guideline.`;
      default: return `Leisure screen time: ${fmtH(leisureOf(day))}, ${fmtH(over)} over the ${fmtH(L.total)} daily guideline.`;
    }
  }

  const TIPS = {
    late: [
      'Set a wind-down time 30 minutes before bed and put the phone on charge outside your room.',
      'Turn on bedtime mode (grayscale + Do Not Disturb) from 10:30 PM so late scrolling feels boring.',
      'Swap late-night screen time for a fixed reading or study slot earlier in the evening.'
    ],
    gaming: [
      'Give gaming a fixed slot, such as 5:30–6:30 PM, and stop at the end of a match, not mid-game.',
      'Use an app timer or console limit set to your daily gaming guideline.',
      'Replace one gaming session a day with a fixed study slot or time outside with friends.'
    ],
    entertainment: [
      'Turn off autoplay on YouTube and Netflix so each video is a choice, not a habit.',
      'Set a daily app limit on social and video apps that matches your guideline.',
      'Keep your phone in another room during homework and meals.'
    ],
    total: [
      'Pick two screen-free blocks every day, such as meals and the first hour after school.',
      'Move the apps you overuse off your home screen into a folder.',
      'Follow the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds.'
    ],
    none: [
      'Keep your evenings calm and screens off before bed: it is working.',
      'Get some morning daylight, which helps your body clock stay on time.',
      'Keep your study time steady and enjoy your free time off-screen too.'
    ]
  };

  /* ---------- Late-night maths ---------- */
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return ((h || 0) * 60 + (m || 0)) % 1440; };
  function isLateNight(date, settings) {
    const s = mergeSettings(settings), d = new Date(date);
    const n = d.getHours() * 60 + d.getMinutes(), a = toMin(s.lateNight.start), b = toMin(s.lateNight.end);
    return a > b ? (n >= a || n < b) : (n >= a && n < b);
  }
  // Minutes of [startMs, endMs) that fall inside the Late-night window (local time).
  function lateMinutesBetween(startMs, endMs, settings) {
    const s = mergeSettings(settings);
    if (!(endMs > startMs)) return 0;
    const a = toMin(s.lateNight.start), b = toMin(s.lateNight.end);
    let total = 0;
    const day0 = new Date(startMs); day0.setHours(0, 0, 0, 0);
    for (let base = day0.getTime() - 86400000; base < endMs; ) {
      const next = new Date(base); next.setDate(next.getDate() + 1);
      // Windows inside this calendar day (handles daylight-saving lengths via Date maths).
      const spans = a > b ? [[0, b], [a, 1440]] : [[a, b]];
      spans.forEach(([x, y]) => {
        const ws = base + x * 60000, we = base + y * 60000;
        total += Math.max(0, Math.min(endMs, we) - Math.max(startMs, ws));
      });
      base = next.getTime();
    }
    return total / 60000;
  }
  const dayKey = d => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /* ---------- Auto-categorising apps ---------- */
  // Android: built-in education apps → Study.
  const STUDY_PACKAGES = [
    'com.google.android.apps.classroom', 'org.khanacademy.android', 'com.duolingo', 'in.gov.diksha.app',
    'com.unacademyapp', 'com.unacademy.learningapp', 'xyz.penpencil.physicswala', 'com.physicswallah.app', 'com.byjus.thelearningapp',
    'com.byjus.app', 'com.amazon.kindle', 'com.google.android.apps.docs.editors.docs', 'com.google.android.apps.docs.editors.sheets',
    'com.google.android.apps.docs.editors.slides', 'com.google.android.apps.docs', 'notion.id', 'com.microsoft.office.word',
    'com.microsoft.office.onenote', 'com.microsoft.office.powerpoint', 'com.microsoft.office.excel', 'com.coursera.app',
    'org.edx.mobile', 'com.quizlet.quizletandroid', 'com.brainly', 'co.brainly', 'com.photomath', 'com.microblink.photomath',
    'com.socratic.app', 'com.google.socratic', 'com.wolfram.android.alpha', 'com.vedantu.app', 'com.toppr.app', 'com.adda247.app',
    'com.testbook.tbapp', 'com.ncert', 'in.ncert.epathshala', 'com.mathway', 'com.chegg.mobile', 'com.google.android.keep',
    'com.adobe.reader', 'com.google.android.apps.books', 'com.evernote', 'com.ankidroid', 'com.ichi2.anki', 'com.memrise.android.memrisecompanion',
    'com.sololearn', 'org.wikipedia', 'com.geogebra.android', 'com.desmos.calculator', 'com.byjus.learnapp', 'com.extramarks.app'
  ];
  // ApplicationInfo.category values (Android SDK constants).
  const ANDROID_CATEGORY = { GAME: 0, AUDIO: 1, VIDEO: 2, IMAGE: 3, SOCIAL: 4, NEWS: 5, MAPS: 6, PRODUCTIVITY: 7 };
  const ANDROID_ENTERTAINMENT_PACKAGES = [
    'com.google.android.youtube', 'com.netflix.mediaclient', 'com.amazon.avod.thirdpartyclient', 'in.startv.hotstar', 'com.jio.media.ondemand',
    'com.instagram.android', 'com.zhiliaoapp.musically', 'com.snapchat.android', 'com.facebook.katana', 'com.spotify.music',
    'com.twitter.android', 'com.reddit.frontpage', 'tv.twitch.android.app', 'com.google.android.apps.youtube.music', 'com.mxtech.videoplayer.ad',
    'com.graymatrix.did', 'com.sonyliv', 'com.jiocinema', 'in.amazon.mShop.android.shopping', 'com.pinterest'
  ];

  function categorizeAndroid(app, overrides) {
    const id = app.packageName || app.id;
    if (overrides && overrides[id]) return overrides[id];
    if (STUDY_PACKAGES.indexOf(id) >= 0) return 'study';
    const c = app.systemCategory;
    if (c === ANDROID_CATEGORY.GAME || app.isGame) return 'gaming';
    if (c === ANDROID_CATEGORY.VIDEO || c === ANDROID_CATEGORY.AUDIO || c === ANDROID_CATEGORY.SOCIAL) return 'entertainment';
    if (ANDROID_ENTERTAINMENT_PACKAGES.indexOf(id) >= 0) return 'entertainment';
    return 'other';
  }

  // Windows: process names and window titles.
  const WIN_GAME_EXES = ['steam.exe', 'steamwebhelper.exe', 'epicgameslauncher.exe', 'riotclientservices.exe', 'riotclientux.exe', 'leagueclient.exe',
    'league of legends.exe', 'valorant.exe', 'valorant-win64-shipping.exe', 'minecraft.exe', 'minecraftlauncher.exe', 'javaw.exe-minecraft',
    'robloxplayerbeta.exe', 'robloxstudiobeta.exe', 'fortniteclient-win64-shipping.exe', 'gta5.exe', 'gtavlauncher.exe', 'cs2.exe', 'csgo.exe',
    'dota2.exe', 'r5apex.exe', 'overwatch.exe', 'battle.net.exe', 'eadesktop.exe', 'origin.exe', 'ubisoftconnect.exe', 'upc.exe',
    'genshinimpact.exe', 'bgmi.exe', 'pubg.exe', 'tslgame.exe', 'rocketleague.exe', 'fifa23.exe', 'fc24.exe', 'fc25.exe', 'eldenring.exe',
    'xboxapp.exe', 'gamingservices.exe', 'playnite.desktopapp.exe', 'goggalaxy.exe', 'itch.exe', 'msedge-xcloud'];
  const WIN_GAME_PATHS = ['\\steamapps\\common\\', '\\epic games\\', '\\riot games\\', '\\xboxgames\\', '\\gog galaxy\\games\\', '\\ubisoft game launcher\\games\\', '\\ea games\\'];
  const WIN_MEDIA_EXES = ['spotify.exe', 'vlc.exe', 'netflix.exe', 'wmplayer.exe', 'microsoft.media.player.exe', 'itunes.exe', 'potplayermini64.exe',
    'discord.exe', 'whatsapp.exe', 'telegram.exe', 'instagram.exe', 'primevideo.exe', 'mpc-hc64.exe', 'applemusic.exe', 'tiktok.exe'];
  const WIN_STUDY_EXES = ['winword.exe', 'excel.exe', 'powerpnt.exe', 'onenote.exe', 'code.exe', 'acrord32.exe', 'acrobat.exe', 'sumatrapdf.exe',
    'foxitpdfreader.exe', 'notion.exe', 'obsidian.exe', 'devenv.exe', 'idea64.exe', 'pycharm64.exe', 'arduino ide.exe', 'geogebra.exe',
    'kindle.exe', 'anki.exe', 'scratch 3.exe', 'thonny.exe', 'python.exe', 'idle.exe', 'matlab.exe', 'mathematica.exe'];
  const BROWSER_EXES = ['chrome.exe', 'msedge.exe', 'firefox.exe', 'opera.exe', 'brave.exe', 'vivaldi.exe', 'arc.exe', 'iexplore.exe', 'launcher.exe'];
  const TITLE_RULES = [
    ['entertainment', /youtube|netflix|prime video|hotstar|jiocinema|jiohotstar|instagram|spotify|twitch|tiktok|facebook|reddit|snapchat|disney\+|sonyliv|zee5|crunchyroll|x\.com|twitter|discord|pinterest|music/i],
    ['gaming', /poki|crazygames|miniclip|chess\.com|lichess|roblox|krunker|now\.gg|xbox cloud|geforce now|itch\.io/i],
    ['study', /khan academy|coursera|ncert|google classroom|classroom\.google|google docs|google sheets|google slides|wikipedia|diksha|unacademy|physics ?wallah|byju|duolingo|edx|w3schools|geeksforgeeks|stack overflow|desmos|geogebra|quizlet|\.pdf\b|notion|brainly|chatgpt|gemini|study|homework|lecture|wolfram/i]
  ];
  const SITE_NAMES = /youtube|netflix|prime video|hotstar|jiocinema|instagram|spotify|twitch|tiktok|facebook|reddit|khan academy|coursera|ncert|google classroom|google docs|wikipedia|diksha|unacademy|duolingo|chess\.com|roblox|poki|discord|w3schools|geeksforgeeks|stack overflow/i;

  // Returns { key, name, category } for a foreground window.
  function categorizeWindows(win, overrides) {
    const exe = String(win.exe || win.processName || '').toLowerCase();
    const path = String(win.path || '').toLowerCase();
    const title = String(win.title || '');
    let key = 'exe:' + exe, name = win.name || exe.replace(/\.exe$/, '') || 'Unknown', cat = null;
    if (BROWSER_EXES.indexOf(exe) >= 0) {
      const m = title.match(SITE_NAMES);
      for (const [c, re] of TITLE_RULES) if (re.test(title)) { cat = c; break; }
      if (cat) {
        const site = m ? m[0].replace(/\b\w/g, ch => ch.toUpperCase()) : CATEGORY_LABELS[cat] + ' sites';
        key = 'web:' + site.toLowerCase(); name = site + ' (browser)';
      } else { cat = 'other'; name = (win.name || exe.replace(/\.exe$/, '')) + ' (browser)'; }
    } else if (WIN_GAME_EXES.indexOf(exe) >= 0 || WIN_GAME_PATHS.some(p => path.indexOf(p) >= 0)) cat = 'gaming';
    else if (WIN_MEDIA_EXES.indexOf(exe) >= 0) cat = 'entertainment';
    else if (WIN_STUDY_EXES.indexOf(exe) >= 0) cat = 'study';
    else {
      for (const [c, re] of TITLE_RULES) if (re.test(title)) { cat = c; break; }
      cat = cat || 'other';
    }
    if (overrides && overrides[key]) cat = overrides[key];
    return { key, name, category: cat };
  }

  /* ---------- Aggregating app usage into days ----------
     apps: [{ id, name, category, minutes, lateMinutes }] → day totals in hours */
  function dayFromApps(apps) {
    const d = { gaming: 0, entertainment: 0, study: 0, other: 0, late: 0 };
    (apps || []).forEach(a => {
      const c = CATEGORIES.indexOf(a.category) >= 0 ? a.category : 'other';
      d[c] += num(a.minutes) / 60; d.late += num(a.lateMinutes) / 60;
    });
    return normalizeDay(d);
  }
  function sumDays(days) {
    const out = { gaming: 0, entertainment: 0, study: 0, other: 0, late: 0 };
    (days || []).forEach(d => { const n = normalizeDay(d); Object.keys(out).forEach(k => { out[k] += n[k]; }); });
    return out;
  }

  /* ---------- Offline summary (Assistant fallback) ---------- */
  // data: { today: day, week: [day, ...] }
  function offlineSummary(data, settings) {
    data = data || {};
    const today = normalizeDay(data.today);
    const week = (data.week || []).map(normalizeDay).filter(d => totalOf(d) > 0);
    const r = scoreDay(today, settings);
    const tips = TIPS[r.biggestKey || 'none'].slice(0, 3);
    let weekLine = '';
    if (week.length > 1) {
      const avg = Math.round(week.reduce((a, d) => a + scoreDay(d, settings).score, 0) / week.length);
      const lateDays = week.filter(d => d.late > mergeSettings(settings).limits.late).length;
      weekLine = `Across ${week.length} days your average score is ${avg} (${labelFor(avg).name}).` + (lateDays ? ` Late-night use went past the guideline on ${lateDays} of them.` : '');
    }
    const lines = [
      `Your score today is ${r.score}/100: ${r.label}.`,
      r.biggest ? `Biggest thing to work on: ${r.biggest}` : 'No guideline was crossed today. Nice work.',
      weekLine,
      'Three small changes:',
      ...tips.map((t, i) => `${i + 1}. ${t}`)
    ].filter(Boolean);
    return { score: r.score, label: r.label, tone: r.tone, biggestProblem: r.biggest, tips, text: lines.join('\n') };
  }

  // Only totals leave the device: no app names, no dates of birth, nothing personal.
  function assistantPayload(data, settings) {
    const s = mergeSettings(settings);
    const clean = d => { const n = normalizeDay(d); return { gaming: round1(n.gaming), entertainment: round1(n.entertainment), study: round1(n.study), other: round1(n.other), lateNight: round1(n.late), total: round1(totalOf(n)) }; };
    const today = clean(data && data.today);
    const week = ((data && data.week) || []).slice(-7).map(clean);
    const r = scoreDay(data && data.today, s);
    const wk = sumDays((data && data.week) || []);
    return { today, todayScore: r.score, todayLabel: r.label, weekTotals: clean(wk), weekDays: week.length, weekScores: ((data && data.week) || []).slice(-7).map(d => scoreDay(d, s).score), limits: s.limits, lateNightWindow: s.lateNight };
  }

  return {
    CATEGORIES, CATEGORY_LABELS, DEFAULT_SETTINGS, LABELS, STUDY_PACKAGES, ANDROID_CATEGORY,
    mergeSettings, normalizeDay, totalOf, leisureOf, fromLegacyEntry, labelFor, scoreDay, fmtH,
    isLateNight, lateMinutesBetween, dayKey, categorizeAndroid, categorizeWindows, dayFromApps, sumDays,
    offlineSummary, assistantPayload, TIPS
  };
});
