# CHRONOS — Reboot the rhythm of life
A screen-time awareness website (with PWA, Android and Windows apps) for STOGO FEST. Log or measure your screen time, get a 0–100 score, and ask the **Assistant** for kind, practical tips.

## Run it in 3 steps
1. Install Node.js 20+ from https://nodejs.org, then in this folder run `npm install`.
2. (Optional, for the live Assistant) copy `.env.example` to `.env` and paste your Gemini key after `GEMINI_API_KEY=`.
3. Run `npm start` and open http://localhost:3000.

## Folder map
- `index.html` — the website · `css/`, `js/` — styles, intro, Assistant, download panel
- `shared/chronos-score.js` — the one scoring file used everywhere
- `api/assistant.js` — Vercel function that talks to Gemini (key from environment only)
- `images/`, `fonts/`, `icons/`, `vendor/` — pictures (background: `images/hero-dark.webp`), fonts, icons, Three.js/Chart.js
- `downloads.config.js` — paste download links here
- `apps/android/`, `apps/windows/` — app projects · `DEPLOYMENT_GUIDE.md`, `IOS_NATIVE_GUIDE.md`
