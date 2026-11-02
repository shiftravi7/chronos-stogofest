/* =========================================================
   CHRONOS · local preview server (npm start)
   Serves the website and runs /api/assistant exactly like Vercel.
   Reads GEMINI_API_KEY from a local .env file (never committed).
   ========================================================= */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

// Minimal .env loader (KEY=value lines). Values are never printed.
try {
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env: the Assistant will use its offline summary */ }

const assistant = require('./api/assistant.js');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
// Never serve secrets or tooling from the preview server.
const BLOCKED = /(^|\/)(\.env|\.git|node_modules|apps|scripts|server\.js|package(-lock)?\.json)(\/|$)/i;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/assistant') return assistant(req, res);
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || BLOCKED.test(rel.replace(/\\/g, '/'))) { res.statusCode = 404; return res.end('Not found'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    if (rel === 'sw.js') res.setHeader('Cache-Control', 'no-cache');
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`CHRONOS is running at http://localhost:${PORT}`);
  console.log(process.env.GEMINI_API_KEY ? 'Assistant: online (key loaded from .env)' : 'Assistant: offline summary mode (add GEMINI_API_KEY to .env to go online)');
});
