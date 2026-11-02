/* =========================================================
   CHRONOS · Windows app (Electron)
   Starts with Windows, lives in the system tray, one instance only,
   keeps tracking when the window is closed (closing hides to tray).
   ========================================================= */
const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, protocol, net, shell, nativeImage } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { Tracker } = require('./tracker');

const WEB = path.join(__dirname, 'web');
const startHidden = process.argv.includes('--hidden');
let win = null, tray = null, tracker = null;
app.isQuitting = false;

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.on('second-instance', () => showWindow());

// The web UI is served from app://chronos so it behaves like a real website (modules, fetch, CORS).
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

function createWindow(show) {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600, show,
    backgroundColor: '#050505', title: 'CHRONOS', autoHideMenuBar: true,
    icon: path.join(WEB, 'icons', 'icon-256.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.loadURL('app://chronos/index.html');
  win.on('close', e => { if (!app.isQuitting) { e.preventDefault(); win.hide(); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://chronos/')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}
function showWindow() {
  if (!win) createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(WEB, 'icons', 'icon-32.png')));
  tray.setToolTip('CHRONOS · tracking your screen time');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Open CHRONOS', click: showWindow },
    { type: 'separator' },
    { label: tracker.paused ? 'Resume tracking' : 'Pause tracking', click: () => { tracker.paused = !tracker.paused; tray.setContextMenu(menu()); } },
    { label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: item => setStartup(item.checked) },
    { type: 'separator' },
    { label: 'Quit CHRONOS (stops tracking)', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu());
  tray.on('click', showWindow);
}

function setStartup(on) {
  if (!app.isPackaged) return;   // only the installed app registers itself
  app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args: ['--hidden'] });
}

app.whenReady().then(async () => {
  protocol.handle('app', req => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(WEB, decodeURIComponent(pathname)));
    if (!file.startsWith(WEB)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  const activeWin = require('active-win');
  tracker = new Tracker({ dataDir: app.getPath('userData'), powerMonitor, activeWindow: () => activeWin() });
  tracker.start();

  ipcMain.handle('usage:getDays', (_e, n, settings) => tracker.getDays(Math.max(1, Math.min(31, Number(n) || 7)), settings));
  ipcMain.handle('usage:setCategory', (_e, id, cat) => { tracker.setCategory(String(id), String(cat)); return true; });
  setInterval(() => { if (win && win.isVisible()) win.webContents.send('usage:updated'); }, 60000);

  // First run of the installed app: start with Windows by default (can be switched off in the tray menu).
  const flag = path.join(app.getPath('userData'), '.startup-set');
  if (app.isPackaged && !require('fs').existsSync(flag)) { setStartup(true); require('fs').writeFileSync(flag, '1'); }

  buildTray();
  createWindow(!startHidden);

  // Developer self-test: CHRONOS_SELFTEST=<folder> saves a screenshot + the dashboard data, then quits.
  if (process.env.CHRONOS_SELFTEST) {
    const out = process.env.CHRONOS_SELFTEST;
    setTimeout(async () => {
      const fs = require('fs');
      await win.webContents.executeJavaScript("sessionStorage.setItem('chronos.intro','1'); document.getElementById('device') && document.getElementById('device').scrollIntoView(); true");
      await new Promise(r => setTimeout(r, 2500));
      fs.writeFileSync(path.join(out, 'win-dashboard.png'), (await win.webContents.capturePage()).toPNG());
      const state = await win.webContents.executeJavaScript("({ device: !!document.getElementById('device'), score: document.querySelector('.dev-score-num b') && document.querySelector('.dev-score-num b').textContent, apps: [...document.querySelectorAll('.dev-applist li')].map(l => l.innerText.replace(/\\s+/g,' ')).slice(0,5), inApp: document.documentElement.classList.contains('in-app'), fab: !!document.querySelector('.assistant-fab') })");
      fs.writeFileSync(path.join(out, 'win-state.json'), JSON.stringify({ state, days: tracker.getDays(1, {}) }, null, 2));
      app.isQuitting = true; app.quit();
    }, Number(process.env.CHRONOS_SELFTEST_MS) || 30000);
  }
});

app.on('window-all-closed', e => { /* keep running in the tray */ });
app.on('before-quit', () => { app.isQuitting = true; if (tracker) tracker.stop(); });
