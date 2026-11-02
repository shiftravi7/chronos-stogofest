/* =========================================================
   CHRONOS · /api/assistant  (Vercel serverless function)
   The ONLY code that talks to Google Gemini. The key is read
   from the environment (GEMINI_API_KEY) and never sent anywhere
   else, never logged, never returned.
   ========================================================= */
const { GoogleGenAI, ThinkingLevel } = require('@google/genai');
const CS = require('../shared/chronos-score.js');

const DEFAULT_MODEL = 'gemini-3.8-flash';     // current stable Flash model (override with GEMINI_MODEL)
const FALLBACK_MODEL = 'gemini-3.5-flash';    // used only if the main model is busy (override with GEMINI_FALLBACK_MODEL)
const MAX_QUESTION = 600;
const MAX_HISTORY = 8;
const MAX_HISTORY_TEXT = 1200;
const MAX_REPLY_CHARS = 2400;

/* ---------- CORS: my site and the apps only ---------- */
const ALLOWED = new Set([
  'https://chronos-stogofest.vercel.app',
  'https://localhost',          // Android app (Capacitor)
  'capacitor://localhost',      // iOS shell, if ever built
  'app://chronos'               // Windows app (Electron)
]);
const ALLOWED_PATTERNS = [
  /^https:\/\/chronos-stogofest(-[a-z0-9-]+)*\.vercel\.app$/, // Vercel preview deployments of this project
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/                  // local development
];
(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean).forEach(o => ALLOWED.add(o));
const originAllowed = o => !!o && (ALLOWED.has(o) || ALLOWED_PATTERNS.some(re => re.test(o)));

/* ---------- Basic per-IP rate limiting (per server instance) ---------- */
const hits = new Map();
const PER_MINUTE = 10, PER_DAY = 150;
function rateLimited(ip) {
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || now - h.dayStart > 86400000) h = { dayStart: now, day: 0, minStart: now, min: 0 };
  if (now - h.minStart > 60000) { h.minStart = now; h.min = 0; }
  h.min++; h.day++;
  hits.set(ip, h);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.minStart > 120000) hits.delete(k);
  return h.min > PER_MINUTE || h.day > PER_DAY;
}

/* ---------- Behaviour ---------- */
const SYSTEM = `You are "Assistant", the friendly guide inside CHRONOS, a screen-time awareness app made by school students for the STOGO FEST theme "Reboot the rhythm of life".
You receive ONLY screen-time totals (hours per category, Late-night hours, scores) and the user's question. You never know who the user is.

How to answer:
- Speak simply and kindly, like a supportive older student. Short sentences. No jargon.
- First say clearly how healthy their screen time is, using the score and label you are given (80-100 Great, 60-79 Okay, 40-59 Needs attention, 0-39 Unhealthy).
- Name the single biggest problem, with the actual number.
- Give exactly 3 specific, practical changes (for example: a wind-down time, app limits, replacing late-night gaming with a fixed study slot). Number them 1, 2, 3.
- Late-night means any use in the late-night window given (default 11 PM to 5 AM). It is part of the total, not extra.
- Study time is positive. Never criticise study time.
- For follow-up questions, answer the question directly and briefly, using their numbers.
- Never shame, scold or use scary language. Celebrate what is going well.
- Never give a medical diagnosis or medical advice. If the user mentions serious worries (sleep problems, sadness, anxiety, addiction, health symptoms), gently suggest talking to a parent, teacher or doctor.
- Plain text only: no markdown headings, no tables, no emojis. Keep the whole answer under 170 words.
- Never mention APIs, models, keys, quotas, limits of your system, errors or that you are an AI model from any company. You are simply "Assistant".`;

const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, n);
const clampHours = v => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(24, n)) : 0; };
const cleanDay = d => {
  d = d && typeof d === 'object' ? d : {};
  return { gaming: clampHours(d.gaming), entertainment: clampHours(d.entertainment), study: clampHours(d.study), other: clampHours(d.other), late: clampHours(d.late) };
};
function cleanSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  const L = s.limits || {}, N = s.lateNight || {};
  const t = v => (/^\d{2}:\d{2}$/.test(String(v)) ? String(v) : undefined);
  return CS.mergeSettings({
    limits: { total: L.total != null ? clampHours(L.total) : undefined, gaming: L.gaming != null ? clampHours(L.gaming) : undefined, entertainment: L.entertainment != null ? clampHours(L.entertainment) : undefined, late: L.late != null ? clampHours(L.late) : undefined },
    lateNight: { start: t(N.start), end: t(N.end) }
  });
}
function dropUndefined(o) { Object.keys(o).forEach(k => { if (o[k] && typeof o[k] === 'object') dropUndefined(o[k]); else if (o[k] === undefined) delete o[k]; }); return o; }

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return await new Promise(resolve => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 20000) { raw = ''; req.destroy(); resolve(null); } });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function thinkingFor(model) {
  if (/^gemini-3/.test(model)) return { thinkingLevel: ThinkingLevel.MINIMAL };
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  return undefined;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') { res.statusCode = origin && originAllowed(origin) ? 204 : 403; return res.end(); }
  if (req.method !== 'POST') return send(res, 405, { ok: false });
  if (origin && !originAllowed(origin)) return send(res, 403, { ok: false });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (rateLimited(ip)) return send(res, 429, { ok: false, retry: true });

  const body = await readBody(req);
  if (!body || typeof body !== 'object') return send(res, 400, { ok: false });

  const question = clip(body.question, MAX_QUESTION) || 'Please look at my screen time and give me my check-in.';
  const settings = dropUndefined(cleanSettings(body.settings));
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const today = cleanDay(data.today);
  const week = Array.isArray(data.week) ? data.week.slice(-7).map(cleanDay) : [];
  const source = data.source === 'device' ? 'measured automatically on the device' : 'typed in by the user';

  // Only totals are sent to the AI — computed here again from validated numbers.
  const payload = CS.assistantPayload({ today, week }, settings);
  const summary = CS.offlineSummary({ today, week }, settings);
  const facts = `SCREEN-TIME DATA (${source}, hours):
${JSON.stringify(payload)}
Computed by CHRONOS: today's score ${summary.score}/100 (${summary.label}). Biggest problem: ${summary.biggestProblem || 'none, every guideline was met'}.`;

  const history = (Array.isArray(body.history) ? body.history : []).slice(-MAX_HISTORY)
    .map(m => ({ role: m && m.role === 'assistant' ? 'model' : 'user', text: clip(m && m.text, MAX_HISTORY_TEXT) }))
    .filter(m => m.text);
  const contents = [
    { role: 'user', parts: [{ text: facts }] },
    { role: 'model', parts: [{ text: 'Thanks, I have the numbers.' }] },
    ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user', parts: [{ text: question }] }
  ];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return send(res, 503, { ok: false, retry: false });
  // Main model first; if it is busy, quietly try the fallback model once.
  const models = [...new Set([clip(process.env.GEMINI_MODEL, 80) || DEFAULT_MODEL, clip(process.env.GEMINI_FALLBACK_MODEL, 80) || FALLBACK_MODEL])];

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 12000 } });
  for (const model of models) {
    const config = { systemInstruction: SYSTEM, maxOutputTokens: 1200, temperature: 0.6 };
    const thinking = thinkingFor(model);
    if (thinking) config.thinkingConfig = thinking;
    try {
      const r = await ai.models.generateContent({ model, contents, config });
      const text = clip(r && r.text, MAX_REPLY_CHARS);
      if (text) return send(res, 200, { ok: true, reply: text });
    } catch (err) {
      // Log only the status code: never the key, the request or the user's question.
      console.error('assistant: upstream status', Number(err && err.status) || 'network');
    }
  }
  return send(res, 503, { ok: false, retry: true });
};
