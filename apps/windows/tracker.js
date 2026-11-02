/* =========================================================
   CHRONOS · Windows background tracker
   Every 5 s: which app is in front? Idle and locked time is skipped.
   Data is a simple JSON file in the user's AppData folder.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const CS = require('./web/shared/chronos-score.js');

const TICK_MS = 5000;
const IDLE_LIMIT_S = Number(process.env.CHRONOS_IDLE_LIMIT_S) || 120;   // no keyboard/mouse for 2 minutes = away, not screen time
const BUCKET_MIN = 15;             // usage stored in 15-minute slots so Late-night can be recalculated
const KEEP_DAYS = 60;

class Tracker {
  constructor({ dataDir, powerMonitor, activeWindow }) {
    this.file = path.join(dataDir, 'usage.json');
    this.powerMonitor = powerMonitor;
    this.activeWindow = activeWindow;
    this.locked = false;
    this.paused = false;
    this.last = Date.now();
    this.dirty = false;
    this.data = this.load();
    for (const ev of ['lock-screen', 'suspend']) powerMonitor.on(ev, () => { this.locked = true; });
    for (const ev of ['unlock-screen', 'resume']) powerMonitor.on(ev, () => { this.locked = false; this.last = Date.now(); });
  }

  load() {
    try { const d = JSON.parse(fs.readFileSync(this.file, 'utf8')); return { version: 1, overrides: {}, days: {}, ...d }; }
    catch (e) { return { version: 1, overrides: {}, days: {} }; }
  }
  save() {
    if (!this.dirty) return;
    const keys = Object.keys(this.data.days).sort();
    while (keys.length > KEEP_DAYS) delete this.data.days[keys.shift()];
    const tmp = this.file + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  start() {
    this.timer = setInterval(() => this.tick().catch(() => {}), TICK_MS);
    this.saver = setInterval(() => { try { this.save(); } catch (e) {} }, 30000);
  }
  stop() { clearInterval(this.timer); clearInterval(this.saver); try { this.save(); } catch (e) {} }

  async tick() {
    const now = Date.now();
    const elapsed = Math.min(now - this.last, TICK_MS * 2);   // never count a long gap (sleep, crash)
    this.last = now;
    if (this.paused || this.locked) return;
    if (this.powerMonitor.getSystemIdleTime() >= IDLE_LIMIT_S) return;
    if (this.powerMonitor.getSystemIdleState && this.powerMonitor.getSystemIdleState(IDLE_LIMIT_S) === 'locked') return;
    const win = await this.activeWindow();
    if (!win || !win.owner) return;
    const info = { exe: path.basename(win.owner.path || win.owner.name || ''), path: win.owner.path || '', title: win.title || '', name: win.owner.name || '' };
    if (/^(lockapp|logonui)\.exe$/i.test(info.exe)) return;   // lock screen
    const c = CS.categorizeWindows(info, null);
    this.add(c, info, now - elapsed, elapsed);
  }

  add(c, info, startMs, ms) {
    const key = CS.dayKey(startMs);
    const day = this.data.days[key] || (this.data.days[key] = {});
    const app = day[c.key] || (day[c.key] = { name: c.name, exe: info.exe, category: c.category, seconds: 0, slots: {} });
    app.category = c.category; app.name = c.name;
    const d = new Date(startMs), slot = Math.floor((d.getHours() * 60 + d.getMinutes()) / BUCKET_MIN);
    app.seconds += ms / 1000;
    app.slots[slot] = (app.slots[slot] || 0) + ms / 1000;
    this.dirty = true;
  }

  setCategory(key, category) {
    if (CS.CATEGORIES.indexOf(category) < 0) return;
    this.data.overrides[key] = category;
    this.dirty = true; this.save();
  }

  // Same shape as the Android adapter: { days: [{ date, apps: [{ id, name, category, minutes, lateMinutes }] }] }
  getDays(n, settings) {
    const out = [];
    const today = new Date(); today.setHours(12, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = CS.dayKey(d), day = this.data.days[key] || {};
      const midnight = new Date(d); midnight.setHours(0, 0, 0, 0);
      const apps = Object.entries(day).map(([id, a]) => {
        let late = 0;
        for (const [slot, sec] of Object.entries(a.slots || {})) {
          const s0 = midnight.getTime() + slot * BUCKET_MIN * 60000;
          late += sec / 60 * (CS.lateMinutesBetween(s0, s0 + BUCKET_MIN * 60000, settings) / BUCKET_MIN);
        }
        return { id, name: a.name, category: this.data.overrides[id] || a.category, minutes: a.seconds / 60, lateMinutes: late };
      });
      out.push({ date: key, apps });
    }
    return { days: out, checkedAt: Date.now() };
  }
}

module.exports = { Tracker };
