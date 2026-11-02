/* =========================================================
   CHRONOS · The Awakening of Time — 3D intro
   A brass-and-gold movement assembles itself in the dark,
   strikes twelve, and the dial opens onto the website.

   Three.js 0.187.0 (vendored, loaded lazily via import map)
   GSAP 3.13.0 (already bundled in index.html) — one master timeline, ~10.4 s.
   Fallbacks: reduced motion → 1.5 s logo fade · no WebGL → CSS-only intro.
   ========================================================= */
const root = document.documentElement;
const host = document.getElementById('chronos-intro');
const gsap = window.gsap;

const PAL = { black: 0x050505, midnight: 0x0b1733, gold: 0xC9A24B, brass: 0x8A6A2F, ivory: 0xF3EAD3, key: 0xFFD9A0, rim: 0x4A6FA5 };
const TOTAL = 10.4;
const isSmall = () => innerWidth < 768;

if (host && root.classList.contains('intro-on')) boot();

function boot() {
  clearTimeout(window.__introTimer);
  try { sessionStorage.setItem('chronos.intro', '1'); } catch (e) {}
  let finished = false;
  const failsafe = setTimeout(() => finish(), 16000);   // never trap the visitor

  /* ---------- Shared ending ---------- */
  function reveal() {
    if (window.__chronosIntroRevealed) return;
    window.__chronosIntroRevealed = true;
    root.classList.add('intro-revealing');
    dispatchEvent(new Event('chronos:intro-reveal'));
    const hero = document.getElementById('top');
    if (gsap && hero && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(hero, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', clearProps: 'transform,opacity' });
    }
  }
  function finish(cleanup) {
    if (finished) return;
    finished = true;
    clearTimeout(failsafe);
    reveal();
    try { if (cleanup) cleanup(); } catch (e) {}
    root.classList.remove('intro-on', 'intro-revealing');
    host.remove();
    dispatchEvent(new Event('chronos:intro-complete'));
  }

  /* ---------- Skip + optional sound (muted by default) ---------- */
  function chrome(onSkip) {
    const skip = document.createElement('button');
    skip.type = 'button'; skip.className = 'ci-skip'; skip.textContent = 'Skip intro';
    const sound = document.createElement('button');
    sound.type = 'button'; sound.className = 'ci-sound'; sound.setAttribute('aria-pressed', 'false'); sound.setAttribute('aria-label', 'Play the clock-tick sound');
    sound.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path class="w" d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" opacity=".25"/></svg>';
    host.append(skip, sound);
    host.setAttribute('aria-hidden', 'false');
    skip.addEventListener('click', onSkip);
    addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { removeEventListener('keydown', onKey); onSkip(); } });
    sound.addEventListener('click', () => {
      Tick.on = !Tick.on;
      if (Tick.on) Tick.init();
      sound.setAttribute('aria-pressed', String(Tick.on));
      sound.querySelector('.w').setAttribute('opacity', Tick.on ? '1' : '.25');
    });
    return { skip, sound };
  }
  const Tick = {
    on: false, ctx: null,
    init() { if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    play(chime) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = chime ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(chime ? 880 : 2400, t);
      if (!chime) o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(chime ? 0.18 : 0.08, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (chime ? 1.8 : 0.06));
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + (chime ? 1.9 : 0.08));
    }
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !gsap) return logoFade(finish);
  if (!hasWebGL()) return cssIntro(finish, chrome);

  const start = () => threeIntro(finish, reveal, chrome, Tick).catch(() => cssIntro(finish, chrome));
  if (document.hidden) {
    // Opened in a background tab: wait until the visitor actually looks.
    const go = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', go); start(); } };
    document.addEventListener('visibilitychange', go);
  } else start();
}

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

const SEAL_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="#C9A24B" stroke-linecap="round">
  <circle cx="60" cy="60" r="56" stroke-width="1.6"/><circle cx="60" cy="60" r="51" stroke-width=".6" opacity=".6"/>
  <path stroke-width="2.2" d="M47 44 h26 M47 76 h26 M50 44 c0 12 20 12 20 16 c0 4 -20 4 -20 16 M70 44 c0 12 -20 12 -20 16 c0 4 20 4 20 16"/></svg>`;

/* ---------- Reduced motion: 1.5 s elegant logo fade ---------- */
function logoFade(finish) {
  host.querySelector('.ci-load')?.remove();
  const logo = document.createElement('div');
  logo.className = 'ci-logo';
  logo.innerHTML = `${SEAL_SVG}<div class="ci-word" style="letter-spacing:.25em">CHRONOS</div><p class="ci-tag" style="opacity:1">Reboot the rhythm of life</p>`;
  logo.querySelectorAll('.ci-word span').forEach(s => (s.style.opacity = 1));
  host.appendChild(logo);
  logo.style.transition = 'opacity .45s ease'; host.style.transition = 'opacity .45s ease';
  requestAnimationFrame(() => { logo.style.opacity = '1'; });
  setTimeout(() => { host.style.opacity = '0'; }, 1050);
  setTimeout(() => finish(), 1500);
}

/* ---------- No WebGL: CSS-only intro ---------- */
function cssIntro(finish, chrome) {
  host.innerHTML = '';
  host.classList.add('ci-css');
  const sizes = [[min(260), 'a'], [min(170), 'b']];
  function min(px) { return Math.min(px, innerWidth * 0.6); }
  sizes.forEach(([s, k]) => { const g = document.createElement('i'); g.className = 'ci-gear ' + k; g.style.width = g.style.height = s + 'px'; host.appendChild(g); });
  const title = titleBlock(); host.appendChild(title.el);
  const glow = document.createElement('div'); glow.className = 'ci-glow'; host.appendChild(glow);
  let tl;
  const { skip } = chrome(() => tl.seek('out'));
  tl = gsap.timeline({ onComplete: () => finish() });
  tl.fromTo('.ci-gear', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out', stagger: 0.2 }, 0.2)
    .to(skip, { autoAlpha: 1, duration: 0.4 }, 0.8);
  title.animate(tl, 1.2);
  tl.addLabel('out', 3.6)
    .to(glow, { opacity: 0.7, duration: 0.4, ease: 'power2.in' }, 'out')
    .call(() => { window.dispatchEvent(new Event('chronos:intro-reveal-request')); }, [], 'out+=0.2')
    .to(host, { opacity: 0, duration: 0.8, ease: 'power1.inOut' }, 'out+=0.2');
}

/* ---------- Title overlay (CHRONOS + gold line + tagline) ---------- */
function titleBlock() {
  const el = document.createElement('div');
  el.className = 'ci-title';
  el.innerHTML = `<div class="ci-word">${[...'CHRONOS'].map(c => `<span>${c}</span>`).join('')}</div><div class="ci-line"></div><p class="ci-tag">Reboot the rhythm of life</p>`;
  return {
    el,
    animate(tl, at) {
      const word = el.querySelector('.ci-word');
      tl.fromTo(word.children, { opacity: 0, y: 8, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power2.out', stagger: 0.08 }, at)
        .fromTo(word, { letterSpacing: '0.6em', marginRight: '-0.6em' }, { letterSpacing: '0.25em', marginRight: '-0.25em', duration: 1.0, ease: 'power3.out' }, at)
        .fromTo(el.querySelector('.ci-line'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, at + 0.2)
        .fromTo(el.querySelector('.ci-tag'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, at + 0.4);
    }
  };
}

/* =========================================================
   The full 3D intro
   ========================================================= */
async function threeIntro(finish, reveal, chrome, Tick) {
  const bar = host.querySelector('.ci-load i');
  let loaded = 0;
  const step = p => p.then(m => { loaded++; if (bar) bar.style.setProperty('--p', (0.1 + loaded / 7 * 0.9).toFixed(2)); return m; });
  const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { RoomEnvironment }] = await Promise.all([
    step(import('three')),
    step(import('three/addons/postprocessing/EffectComposer.js')),
    step(import('three/addons/postprocessing/RenderPass.js')),
    step(import('three/addons/postprocessing/UnrealBloomPass.js')),
    step(import('three/addons/postprocessing/OutputPass.js')),
    step(import('three/addons/environments/RoomEnvironment.js')),
    step(Promise.race([Promise.all([document.fonts.load('600 64px Cinzel'), document.fonts.load('italic 400 24px "Cormorant Garamond"')]), new Promise(r => setTimeout(r, 2500))]).catch(() => {}))
  ]);

  const small = isSmall();
  /* ---------- Renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(PAL.black, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0;

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.8, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- Textures drawn on canvas (no external files) ---------- */
  function glowTexture(stops, size = 128) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const dotTex = glowTexture([[0, 'rgba(255,240,205,1)'], [0.35, 'rgba(230,190,110,.6)'], [1, 'rgba(201,162,75,0)']], 64);
  const sparkTex = glowTexture([[0, 'rgba(255,250,235,1)'], [0.18, 'rgba(255,217,160,.9)'], [0.45, 'rgba(201,162,75,.25)'], [1, 'rgba(201,162,75,0)']]);
  const skyTex = glowTexture([[0, 'rgba(22,38,74,1)'], [0.45, 'rgba(11,23,51,.85)'], [1, 'rgba(5,5,5,0)']], 256);
  function streakTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 8;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,240,210,0)'); g.addColorStop(0.5, 'rgba(255,244,220,.9)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 8);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // Dial engraving: minute track + a faint CHRONOS hourglass seal (a hint of the original logo).
  function dialTexture() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), C = S / 2;
    x.strokeStyle = 'rgba(201,162,75,.55)'; x.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const a = i / 60 * Math.PI * 2, r1 = C * 0.9, r2 = C * 0.93;
      x.lineWidth = 2; x.beginPath(); x.moveTo(C + r1 * Math.sin(a), C - r1 * Math.cos(a)); x.lineTo(C + r2 * Math.sin(a), C - r2 * Math.cos(a)); x.stroke();
    }
    x.lineWidth = 1.5; x.strokeStyle = 'rgba(201,162,75,.35)';
    [0.95, 0.86].forEach(k => { x.beginPath(); x.arc(C, C, C * k, 0, Math.PI * 2); x.stroke(); });
    // guilloché rings
    x.strokeStyle = 'rgba(201,162,75,.06)'; x.lineWidth = 1;
    for (let r = 40; r < C * 0.84; r += 7) { x.beginPath(); x.arc(C, C, r, 0, Math.PI * 2); x.stroke(); }
    // hourglass seal from the header logo, very faint
    x.save(); x.translate(C, C + C * 0.42); x.scale(2.2, 2.2); x.translate(-60, -60);
    x.strokeStyle = 'rgba(201,162,75,.32)'; x.lineWidth = 2.4;
    x.stroke(new Path2D('M47 44 h26 M47 76 h26 M50 44 c0 12 20 12 20 16 c0 4 -20 4 -20 16 M70 44 c0 12 -20 12 -20 16 c0 4 20 4 20 16'));
    x.restore();
    x.fillStyle = 'rgba(201,162,75,.42)'; x.font = '600 30px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.letterSpacing = '8px';
    x.fillText('CHRONOS', C, C - C * 0.36);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  /* ---------- Materials ---------- */
  const goldMat = () => new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 1, roughness: 0.28, emissive: PAL.gold, emissiveIntensity: 0 });
  const brassMat = () => new THREE.MeshStandardMaterial({ color: PAL.brass, metalness: 1, roughness: 0.36, emissive: PAL.gold, emissiveIntensity: 0 });

  /* ---------- makeGear(teeth, innerRadius, outerRadius, thickness) ---------- */
  function makeGear(teeth, innerRadius, outerRadius, thickness) {
    const m = 2 * outerRadius / (teeth + 2);           // module: tip = m(n+2)/2
    const rootR = outerRadius - 2.25 * m;
    const pitch = Math.PI * 2 / teeth;
    const shape = new THREE.Shape();
    const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
    for (let i = 0; i < teeth; i++) {
      const a = i * pitch;                              // tooth centred on a
      const pts = [
        [rootR, a - pitch * 0.5], [rootR, a - pitch * 0.25], [outerRadius - m * 0.4, a - pitch * 0.17],
        [outerRadius, a - pitch * 0.08], [outerRadius, a + pitch * 0.08], [outerRadius - m * 0.4, a + pitch * 0.17], [rootR, a + pitch * 0.25]
      ];
      pts.forEach(([r, ang], k) => { const [x, y] = P(r, ang); if (i === 0 && k === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
    }
    shape.closePath();
    const axle = new THREE.Path(); axle.absarc(0, 0, innerRadius, 0, Math.PI * 2, true); shape.holes.push(axle);
    // Spoked wheel for the larger gears — the classic crossing of a watch wheel.
    const rimIn = rootR - Math.max(0.05, outerRadius * 0.1), hubOut = innerRadius + Math.max(0.05, outerRadius * 0.14);
    if (rimIn - hubOut > 0.08) {
      const spokes = teeth >= 20 ? 5 : 4, spokeHalf = Math.max(0.035 / rimIn, 0.07);
      for (let s = 0; s < spokes; s++) {
        const a0 = s * Math.PI * 2 / spokes + spokeHalf, a1 = (s + 1) * Math.PI * 2 / spokes - spokeHalf;
        const hole = new THREE.Path();
        hole.absarc(0, 0, rimIn, a0, a1, false);
        hole.absarc(0, 0, hubOut, a1 - spokeHalf * (rimIn / hubOut - 1) * 0.15, a0 + spokeHalf * (rimIn / hubOut - 1) * 0.15, true);
        hole.closePath();
        shape.holes.push(hole);
      }
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.22, bevelSize: Math.min(0.008, m * 0.12), bevelSegments: 2, curveSegments: 28 });
    geo.translate(0, 0, -thickness / 2);
    return geo;
  }
  function extrude(shape, depth, bevel = 0.004) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 16 });
    g.translate(0, 0, -depth / 2); return g;
  }

  /* ---------- The movement: 7 gears, balance wheel, hairspring ---------- */
  const movement = new THREE.Group(); scene.add(movement);
  const MOD = 0.06;                                      // shared module so the teeth really mesh
  const tip = n => MOD * (n + 2) / 2, pr = n => MOD * n / 2;
  const specs = [
    // id, teeth, meshes-with, direction (deg) from parent, z, material, thickness
    { id: 0, n: 24, parent: null, dir: 0, z: 0, mat: goldMat, th: 0.08, at: [0, 0] },
    { id: 1, n: 12, parent: 0, dir: 35, z: 0, mat: brassMat, th: 0.065 },
    { id: 2, n: 16, parent: 0, dir: 215, z: 0, mat: goldMat, th: 0.07 },
    { id: 3, n: 10, parent: 1, dir: -40, z: 0, mat: goldMat, th: 0.06 },
    { id: 4, n: 14, parent: 2, dir: 150, z: 0, mat: brassMat, th: 0.06 },
    { id: 5, n: 8, parent: 0, coaxial: true, z: 0.13, mat: brassMat, th: 0.07 },
    { id: 6, n: 20, parent: 5, dir: 118, z: 0.13, mat: goldMat, th: 0.055 }
  ];
  const gears = [];
  specs.forEach(s => {
    const mat = s.mat();
    const mesh = new THREE.Mesh(makeGear(s.n, Math.max(0.03, tip(s.n) * 0.09), tip(s.n), s.th), mat);
    let x = 0, y = 0;
    if (s.parent != null) {
      const p = gears[s.parent];
      if (s.coaxial) { x = p.home.x; y = p.home.y; }
      else { const d = pr(s.n) + pr(p.spec.n), a = s.dir * Math.PI / 180; x = p.home.x + d * Math.cos(a); y = p.home.y + d * Math.sin(a); }
    }
    const home = new THREE.Vector3(x, y, s.z);
    mesh.position.copy(home);
    // axle pin
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(tip(s.n) * 0.07, tip(s.n) * 0.07, s.th * 1.9, 20), goldMat());
    pin.rotation.x = Math.PI / 2; mesh.add(pin);
    movement.add(mesh);
    gears.push({ spec: s, mesh, mat, home, angle: 0 });
  });
  // Angles follow tooth ratios exactly; meshing gears turn in opposite directions.
  function setGearAngles(theta) {
    gears.forEach(g => {
      const s = g.spec;
      if (s.parent == null) g.angle = theta;
      else if (s.coaxial) g.angle = gears[s.parent].angle;
      else {
        const p = gears[s.parent], phi = s.dir * Math.PI / 180;
        g.angle = phi + Math.PI - Math.PI / s.n + (p.spec.n / s.n) * (phi - p.angle);
      }
      g.mesh.rotation.z = g.angle;
    });
  }

  // Balance wheel + spiral hairspring
  const balance = new THREE.Group();
  const bMat = goldMat();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 14, 72), bMat); balance.add(rim);
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.018, 0.016), bMat); sp.rotation.z = i * Math.PI / 3; balance.add(sp);
  }
  for (let i = 0; i < 8; i++) {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), bMat);
    const a = i * Math.PI / 4; sc.position.set(0.322 * Math.cos(a), 0.322 * Math.sin(a), 0); sc.rotation.z = a + Math.PI / 2; balance.add(sc);
  }
  const springPts = [];
  for (let i = 0; i <= 420; i++) { const t = i / 420, a = t * Math.PI * 2 * 7, r = 0.035 + t * 0.2; springPts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0.03)); }
  const springMat = brassMat();
  const hairspring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 600, 0.0042, 6, false), springMat);
  const balanceHome = new THREE.Vector3(-1.2, 1.02, 0.2);
  balance.position.copy(balanceHome); hairspring.position.copy(balanceHome);
  movement.add(balance, hairspring);

  /* ---------- Dial: glass disc, gold rings, 12 markers, hands ---------- */
  const dial = new THREE.Group(); scene.add(dial);
  const R = 1.45;
  const discMat = new THREE.MeshPhysicalMaterial({ color: 0x0a1222, metalness: 0.15, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0, depthWrite: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 128), discMat); disc.position.z = 0.02; dial.add(disc);
  const engraveMat = new THREE.MeshBasicMaterial({ map: dialTexture(), transparent: true, opacity: 0, depthWrite: false });
  const engrave = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), engraveMat); engrave.position.z = 0.024; dial.add(engrave);
  const ringMat = goldMat(); ringMat.transparent = true; ringMat.opacity = 0;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.014, 12, 220), ringMat); ring.position.z = 0.03; dial.add(ring);

  const markerMat = goldMat();
  const markers = [];
  const barShape = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.closePath(); return s; };
  const barGeo = extrude(barShape(0.034, 0.2), 0.03, 0.005), barGeoSmall = extrude(barShape(0.026, 0.13), 0.026, 0.004);
  for (let i = 0; i < 12; i++) {
    const g = new THREE.Group();
    const a = -i * Math.PI / 6, r = 1.25;
    if (i === 0) { [-0.03, 0.03].forEach(dx => { const b = new THREE.Mesh(barGeo, markerMat); b.position.x = dx; g.add(b); }); }
    else g.add(new THREE.Mesh(i % 3 === 0 ? barGeo : barGeoSmall, markerMat));
    g.position.set(r * Math.sin(-a), r * Math.cos(a), 0.06);
    g.rotation.z = a;
    g.visible = false;
    dial.add(g); markers.push(g);
  }
  // Hands: thin tapered extruded shapes, pivot at the centre.
  const handShape = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.closePath(); return s; };
  const handMat = goldMat(); handMat.roughness = 0.22;
  const hourHand = new THREE.Mesh(extrude(handShape([[-0.042, -0.15], [-0.03, 0.5], [0, 0.72], [0.03, 0.5], [0.042, -0.15]]), 0.014, 0.003), handMat);
  const minuteHand = new THREE.Mesh(extrude(handShape([[-0.032, -0.18], [-0.019, 0.9], [0, 1.08], [0.019, 0.9], [0.032, -0.18]]), 0.012, 0.003), handMat);
  const secShape = handShape([[-0.006, -0.28], [-0.004, 1.16], [0, 1.2], [0.004, 1.16], [0.006, -0.28]]);
  const secMat = new THREE.MeshStandardMaterial({ color: PAL.ivory, metalness: 0.9, roughness: 0.25 });
  const secondHand = new THREE.Mesh(extrude(secShape, 0.008, 0.002), secMat);
  const counter = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 24), secMat); counter.rotation.x = Math.PI / 2; counter.position.y = -0.2; secondHand.add(counter);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 32), goldMat()); cap.rotation.x = Math.PI / 2;
  const hands = new THREE.Group();
  hourHand.position.z = 0.07; minuteHand.position.z = 0.09; secondHand.position.z = 0.11; cap.position.z = 0.12;
  hands.add(hourHand, minuteHand, secondHand, cap);
  hands.visible = false; secondHand.visible = false;
  dial.add(hands);

  /* ---------- Light: spark, key, rim, sky, streak, pulse, dust ---------- */
  const ambient = new THREE.AmbientLight(0x1a2440, 0); scene.add(ambient);
  const key = new THREE.PointLight(PAL.key, 0, 0, 2); key.position.set(0, 0, 1.1); scene.add(key);
  const rimLight = new THREE.DirectionalLight(PAL.rim, 0); rimLight.position.set(-3, 2.2, -2.5); scene.add(rimLight);
  const sparkMat = new THREE.SpriteMaterial({ map: sparkTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const spark = new THREE.Sprite(sparkMat); spark.position.set(0, 0, 0.6); spark.scale.setScalar(0.04); scene.add(spark);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), skyMat); sky.position.z = -6; scene.add(sky);
  const streakMat = new THREE.MeshBasicMaterial({ map: streakTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 3.4), streakMat); streak.position.set(-2.6, 0, 0.16); streak.rotation.z = -0.22; scene.add(streak);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0xF3DC9A, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 160), pulseMat); pulse.position.z = 0.14; pulse.scale.setScalar(0.001); scene.add(pulse);

  let dustCount = small ? 250 : 600;
  const dustGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(dustCount * 3), dHome = new Float32Array(dustCount * 3), dDir = new Float32Array(dustCount * 3), dSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dHome[i * 3] = (Math.random() - 0.5) * 8; dHome[i * 3 + 1] = (Math.random() - 0.5) * 5; dHome[i * 3 + 2] = -3 + Math.random() * 4.5;
    const v = new THREE.Vector3().randomDirection(); dDir[i * 3] = v.x; dDir[i * 3 + 1] = v.y; dDir[i * 3 + 2] = v.z * 0.5;
    dSeed[i] = Math.random() * 100;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dustMat = new THREE.PointsMaterial({ map: dotTex, color: 0xE8C77E, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat); scene.add(dust);
  const dustState = { gather: 0, burst: 0 };

  /* ---------- Title overlay + glow ---------- */
  const title = titleBlock(); host.appendChild(title.el);
  const glow = document.createElement('div'); glow.className = 'ci-glow'; host.appendChild(glow);

  /* ---------- Camera rig ---------- */
  const rig = { dolly: 1, orbit: 0, push: 0, fov: 35 };
  let baseDist = 5;
  function fit() {
    const aspect = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(17.5));
    baseDist = Math.max(5, 2.15 / (t * aspect), 1.62 / t);
  }
  fit();
  const motion = { speed: 0.18, theta: 0, balance: true, drift: 1 };

  /* ---------- Shader warm-up so the first seconds stay smooth ---------- */
  const hidden = [];
  scene.traverse(o => { if (o.visible === false) { hidden.push(o); o.visible = true; } });
  renderer.compile(scene, camera);
  hidden.forEach(o => (o.visible = false));
  gears.forEach(g => (g.mesh.visible = false)); balance.visible = hairspring.visible = false;
  const loader = host.querySelector('.ci-load'); if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 500); }

  /* ---------- Arrivals on curved paths ---------- */
  // Positions are applied in the render loop (not onUpdate) so Skip/seek always lands them correctly.
  const arrivals = [];
  function placeArrivals() {
    arrivals.forEach(({ obj, st, S, Cp, home }) => {
      const t = st.p, u = 1 - t;   // quadratic Bézier; back.out overshoots slightly past 1
      obj.position.set(u * u * S.x + 2 * u * t * Cp.x + t * t * home.x, u * u * S.y + 2 * u * t * Cp.y + t * t * home.y, u * u * S.z + 2 * u * t * Cp.z + t * t * home.z);
    });
  }
  function arrive(tl, obj, home, from, ctrl, at, dur, glintMat) {
    const st = { p: 0 };
    arrivals.push({ obj, st, S: new THREE.Vector3(...from), Cp: new THREE.Vector3(...ctrl), home });
    tl.set(obj, { visible: true }, at)
      .fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: 'back.out(1.4)', immediateRender: false }, at);
    if (glintMat) tl.to(glintMat, { emissiveIntensity: 0.09, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, at + dur * 0.62);
  }

  /* ---------- Master timeline (~10.4 s) ---------- */
  const tl = gsap.timeline({ paused: true, onComplete: () => finish(cleanup) });
  const { skip, sound } = chrome(() => { if (tl.time() < 9.4) tl.seek('scene7'); });

  // 1 · Darkness (0–1.2)
  tl.addLabel('scene1', 0)
    .to(sparkMat, { opacity: 1, duration: 0.9, ease: 'sine.inOut' }, 0.3)
    .to(spark.scale, { x: 0.22, y: 0.22, duration: 1.4, ease: 'sine.out' }, 0.3)
    .to(key, { intensity: 0.6, duration: 0.9 }, 0.3)
    .to(dustMat, { opacity: 0.55, duration: 1.6, ease: 'sine.inOut' }, 0.3)
    .to([skip, sound], { autoAlpha: 1, duration: 0.5 }, 0.8);

  // 2 · The First Gear (1.2–3.2)
  tl.addLabel('scene2', 1.2)
    .set(gears[0].mesh, { visible: true }, 1.2)
    .to(key, { intensity: 4.5, duration: 1.6, ease: 'power2.inOut' }, 1.2)
    .to(scene, { environmentIntensity: 0.32, duration: 1.8, ease: 'power2.inOut' }, 1.2)
    .to(rimLight, { intensity: 1.4, duration: 1.6 }, 1.5)
    .to(ambient, { intensity: 0.25, duration: 1.6 }, 1.5)
    .to(skyMat, { opacity: 0.85, duration: 2.4, ease: 'sine.inOut' }, 1.4)
    .to(sparkMat, { opacity: 0, duration: 1.0, ease: 'sine.in' }, 1.6)
    .to(key.position, { x: 1.9, y: 1.3, z: 2.4, duration: 2.0, ease: 'sine.inOut' }, 1.2)
    .to(rig, { dolly: 0.92, duration: 2.0, ease: 'sine.inOut' }, 1.2)
    .fromTo(gears[0].mesh.scale, { x: 0.94, y: 0.94, z: 0.94 }, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'power2.out' }, 1.2);
  [1, 2].forEach((id, k) => {
    const g = gears[id];
    tl.set(g.mesh, { visible: true }, 1.55 + k * 0.25)
      .fromTo(g.mesh.position, { z: -4 }, { z: 0, duration: 1.45, ease: 'power3.out', immediateRender: false }, 1.55 + k * 0.25)
      .to(g.mat, { emissiveIntensity: 0.12, duration: 0.15, yoyo: true, repeat: 1 }, 2.75 + k * 0.25);
  });

  // 3 · The Assembly (3.2–5.2)
  tl.addLabel('scene3', 3.2)
    .to(key.position, { x: -1.7, y: 0.9, z: 2.6, duration: 2.0, ease: 'sine.inOut' }, 3.2)
    .to(rig, { orbit: THREE.MathUtils.degToRad(15), duration: 2.0, ease: 'sine.inOut' }, 3.2);
  arrive(tl, gears[3].mesh, gears[3].home, [3.6, 1.8, 1.2], [2.6, -0.4, 0.8], 3.25, 1.0, gears[3].mat);
  arrive(tl, gears[4].mesh, gears[4].home, [-3.8, -1.9, 1.0], [-2.4, 0.9, 0.6], 3.45, 1.0, gears[4].mat);
  arrive(tl, gears[5].mesh, gears[5].home, [0.4, -3.2, 1.6], [1.6, -1.4, 1.0], 3.65, 0.95, gears[5].mat);
  arrive(tl, gears[6].mesh, gears[6].home, [-1.2, 3.4, 1.4], [-2.6, 1.6, 0.9], 3.85, 1.0, gears[6].mat);
  arrive(tl, balance, balanceHome, [-3.6, 2.6, 0.4], [-1.8, 2.6, 1.2], 4.05, 1.0, bMat);
  arrive(tl, hairspring, balanceHome, [-3.6, 2.6, 0.6], [-1.6, 2.8, 1.4], 4.15, 1.0, springMat);
  markers.forEach((mk, i) => {
    const at = 4.0 + i * 0.08;
    tl.set(mk, { visible: true }, at)
      .fromTo(mk.position, { z: -0.5 }, { z: 0.06, duration: 0.55, ease: 'back.out(1.6)', immediateRender: false }, at)
      .fromTo(mk.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power2.out', immediateRender: false }, at);
  });

  // 4 · The Hands (5.2–6.8)
  tl.addLabel('scene4', 5.2)
    .to(movement.position, { z: -0.6, duration: 0.9, ease: 'power2.inOut' }, 5.2)
    .to(movement.scale, { x: 0.52, y: 0.52, z: 0.52, duration: 0.9, ease: 'power2.inOut' }, 5.2)   // the movement settles inside the case, nothing sticks out past the dial
    .to(discMat, { opacity: 0.86, duration: 0.9, ease: 'sine.inOut' }, 5.25)
    .to(engraveMat, { opacity: 1, duration: 1.0, ease: 'sine.inOut' }, 5.4)
    .to(ringMat, { opacity: 1, duration: 0.8 }, 5.3)
    .to(rig, { orbit: 0, duration: 1.4, ease: 'power2.inOut' }, 5.3)
    .to(key.position, { x: 0.4, y: 1.4, z: 2.8, duration: 1.4, ease: 'sine.inOut' }, 5.2)
    .set(hands, { visible: true }, 5.35)
    .fromTo(hands.position, { z: 2.4 }, { z: 0, duration: 0.55, ease: 'power3.out', immediateRender: false }, 5.35)
    .fromTo(hands.scale, { x: 1.6, y: 1.6, z: 1.6 }, { x: 1, y: 1, z: 1, duration: 0.55, ease: 'power3.out', immediateRender: false }, 5.35)
    .fromTo(minuteHand.rotation, { z: Math.PI * 4 + 1.1 }, { z: 0, duration: 1.4, ease: 'power3.out', immediateRender: false }, 5.4)
    .fromTo(hourHand.rotation, { z: Math.PI * 4 - 0.9 }, { z: 0, duration: 1.4, ease: 'power3.out', immediateRender: false }, 5.4)
    .fromTo(streak.position, { x: -2.6 }, { x: 2.6, duration: 0.7, ease: 'power1.inOut', immediateRender: false }, 6.05)
    .to(streakMat, { opacity: 0.6, duration: 0.25, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 6.1);

  // 5 · The Reboot (6.8–8.4)
  tl.addLabel('scene5', 6.8)
    .call(() => { Tick.play(true); }, [], 6.8)
    .set(secondHand, { visible: true }, 6.8)
    .set(pulse.scale, { x: 0.001, y: 0.001, z: 1 }, 6.8)
    .to(pulseMat, { opacity: 1, duration: 0.05 }, 6.8)
    .to(pulse.scale, { x: 6, y: 6, duration: 0.9, ease: 'power2.out' }, 6.8)
    .to(pulseMat, { opacity: 0, duration: 0.9, ease: 'power1.in' }, 6.85)
    .to(motion, { speed: 3.2, duration: 0.22, ease: 'power2.in' }, 6.8)
    .to(motion, { speed: 0, duration: 0.55, ease: 'power3.out' }, 7.02)
    .set(motion, { balance: false }, 7.5)
    .to(dustState, { gather: 1, duration: 0.42, ease: 'power2.in' }, 6.8)
    .to(dustState, { burst: 1, duration: 1.2, ease: 'expo.out' }, 7.22)
    .to(bloom, { strength: 1.1, duration: 0.35, ease: 'power2.out' }, 6.8)
    .to(bloom, { strength: 0.65, duration: 1.1, ease: 'sine.inOut' }, 7.2)
    .to(key, { intensity: 5.5, duration: 0.3, yoyo: true, repeat: 1 }, 6.8);
  // second hand: one tick per second, a soft settle each time
  for (let s = 1; s <= 4; s++) tl.to(secondHand.rotation, { z: -s * Math.PI / 30, duration: 0.16, ease: 'back.out(3)', onStart: () => Tick.play(false) }, 6.8 + s * 0.8);

  // 6 · The Name (8.4–9.4)
  tl.addLabel('scene6', 8.4);
  title.animate(tl, 8.4);
  tl.to(dustMat, { opacity: 0.35, duration: 1 }, 8.4);

  // 7 · Into the Website (9.4–10.4)
  tl.addLabel('scene7', 9.4)
    .to([skip, sound], { autoAlpha: 0, duration: 0.3 }, 9.4)
    .to(title.el, { opacity: 0, scale: 1.08, duration: 0.6, ease: 'power2.in' }, 9.45)
    .to(rig, { push: 1, fov: 60, duration: 0.85, ease: 'power2.in' }, 9.4)
    .to(glow, { opacity: 0.85, duration: 0.45, ease: 'sine.in' }, 9.55)
    .call(reveal, [], 9.6)
    .to(host, { opacity: 0, duration: 0.8, ease: 'power1.inOut' }, 9.6)
    .set({}, {}, TOTAL);

  /* ---------- Render loop + automatic quality ---------- */
  let last = performance.now(), frames = 0, fpsT = 0, downgraded = 0;
  const tmp = new THREE.Vector3();
  function render() {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = tl.time();
    motion.theta += motion.speed * dt;
    setGearAngles(motion.theta);
    placeArrivals();
    if (motion.balance) { balance.rotation.z = Math.sin(now / 1000 * Math.PI * 2 * 1.25) * 0.9; hairspring.scale.setScalar(1 + Math.sin(now / 1000 * Math.PI * 2 * 1.25) * 0.05); }
    // dust: drift → gather to the centre → burst outward
    for (let i = 0; i < dustCount; i++) {
      const j = i * 3, s = dSeed[i], tt = now / 1000;
      let x = dHome[j] + Math.sin(tt * 0.13 + s) * 0.25, y = dHome[j + 1] + Math.cos(tt * 0.11 + s * 1.3) * 0.18 + tt * 0.02, z = dHome[j + 2];
      const g = dustState.gather; x *= 1 - g; y *= 1 - g; z = z * (1 - g) + 0.2 * g;
      if (dustState.burst > 0) { const b = dustState.burst * (2.2 + (s % 3)); x += dDir[j] * b; y += dDir[j + 1] * b; z += dDir[j + 2] * b; }
      dPos[j] = x; dPos[j + 1] = y; dPos[j + 2] = z;
    }
    dustGeo.attributes.position.needsUpdate = true;
    // camera: fixed → dolly with a tiny sine drift → orbit → front → push through the dial
    const dist = baseDist * rig.dolly;
    const zc = THREE.MathUtils.lerp(dist, -0.35, rig.push);
    const driftAmt = time > 1.2 && time < 9.4 ? 0.02 : 0;
    camera.position.set(Math.sin(rig.orbit) * zc + Math.sin(now / 900) * driftAmt, Math.cos(now / 1100) * driftAmt, Math.cos(rig.orbit) * zc);
    camera.lookAt(tmp.set(0, 0, rig.push > 0 ? -2 : 0));
    if (camera.fov !== rig.fov) { camera.fov = rig.fov; camera.updateProjectionMatrix(); }
    composer.render(dt);
    // keep 60 fps: lower quality automatically if it drops under 45 fps
    frames++; fpsT += dt;
    if (fpsT >= 1) {
      const fps = frames / fpsT; frames = 0; fpsT = 0;
      if (fps < 45 && downgraded < 3 && time > 0.6) {
        downgraded++;
        if (downgraded === 1) { pixelRatio = Math.min(pixelRatio, 1.25); renderer.setPixelRatio(pixelRatio); composer.setPixelRatio(pixelRatio); }
        else if (downgraded === 2) { dustCount = Math.min(dustCount, 200); dustGeo.setDrawRange(0, dustCount); pixelRatio = 1; renderer.setPixelRatio(1); composer.setPixelRatio(1); }
        else bloom.enabled = false;
      }
    }
  }
  function onResize() {
    fit(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', onResize);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); tl.kill(); finish(cleanup); });

  function cleanup() {
    gsap.ticker.remove(render);
    removeEventListener('resize', onResize);
    tl.kill();
    const textures = new Set([dotTex, sparkTex, skyTex, envTex]);
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach(m => { if (m.map) textures.add(m.map); m.dispose(); });
    });
    textures.forEach(t => t && t.dispose());
    room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    pmrem.dispose();
    bloom.dispose(); composer.dispose && composer.dispose();
    renderer.dispose(); renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  gsap.ticker.add(render);
  tl.play(0);
  window.__chronosIntro = { tl, renderer };   // handy for debugging in the console
}

/* CSS-only path asks for the website reveal through this event. */
addEventListener('chronos:intro-reveal-request', () => {
  if (window.__chronosIntroRevealed) return;
  window.__chronosIntroRevealed = true;
  dispatchEvent(new Event('chronos:intro-reveal'));
  const hero = document.getElementById('top');
  if (window.gsap && hero) window.gsap.fromTo(hero, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', clearProps: 'transform,opacity' });
});
