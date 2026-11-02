// Draws the CHRONOS seal (the header logo) as every icon size the PWA and apps need.
// Usage: npm run icons   (needs the dev dependency "sharp")
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'icons');
fs.mkdirSync(out, { recursive: true });

// pad = how much of the canvas the seal fills (maskable icons need a safe zone).
const seal = (pad, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#e6c873"/><stop offset=".45" stop-color="#C9A24B"/><stop offset="1" stop-color="#8A6A2F"/>
    </linearGradient>
    <radialGradient id="bg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#121a2e"/><stop offset="1" stop-color="#050505"/></radialGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)" fill="none" stroke="url(#g)" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="256" cy="256" r="236" stroke-width="10"/>
    <circle cx="256" cy="256" r="212" stroke-width="3" opacity=".7"/>
    <g stroke-width="7">${Array.from({ length: 12 }, (_, i) => {
      const a = i * Math.PI / 6, r1 = i % 3 === 0 ? 168 : 182, r2 = 200;
      return `<line x1="${(256 + r1 * Math.sin(a)).toFixed(1)}" y1="${(256 - r1 * Math.cos(a)).toFixed(1)}" x2="${(256 + r2 * Math.sin(a)).toFixed(1)}" y2="${(256 - r2 * Math.cos(a)).toFixed(1)}"/>`;
    }).join('')}</g>
    <path stroke-width="13" d="M196 160 h120 M196 352 h120 M208 160 c0 58 96 58 96 96 c0 38 -96 38 -96 96 M304 160 c0 58 -96 58 -96 96 c0 38 96 38 96 96"/>
  </g>
</svg>`;

(async () => {
  const any = Buffer.from(seal(1, false)), mask = Buffer.from(seal(0.72, false));
  for (const s of [32, 48, 72, 96, 128, 144, 152, 192, 256, 384, 512, 1024]) await sharp(any).resize(s, s).png().toFile(path.join(out, `icon-${s}.png`));
  for (const s of [192, 512]) await sharp(mask).resize(s, s).png().toFile(path.join(out, `maskable-${s}.png`));
  await sharp(mask).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
  fs.writeFileSync(path.join(out, 'icon.svg'), seal(1, false));
  console.log('Icons written to', out);
})();
