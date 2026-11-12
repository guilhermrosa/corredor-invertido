// Style test (not part of the game): the real simulation and controls, drawn with neutral shapes
// in two candidate looks, so the technique can be judged without the placeholder art.
//   retro: simple 3D polygons rendered at low resolution, ordered dithering, grain, few colours.
//   papel: 2.5D paper cut-outs on a stage: cards with a white cut edge and a shadow that fold up
//          from the floor as they come near, a paper texture over everything, the hero flipping
//          like a card when gravity turns (camera fixed, no roll).

import { createSim, update, press, slide, fallAmount } from '../../js/sim.js';
import { HM, HW, PH, PL, OH, LOWH, PORTAL_GAP, clamp, lerp } from '../../js/config.js';
import { bindTouch } from '../../js/input.js';
import { drawAxolotl } from '../../js/hero.js';

const $ = id => document.getElementById(id);
const cvs = $('game'), ctx = cvs.getContext('2d');
const lo = document.createElement('canvas'), lctx = lo.getContext('2d', { willReadFrequently: true });
let style = new URLSearchParams(location.search).get('estilo') === 'papel' ? 'papel' : 'retro';
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = cvs.clientWidth; H = cvs.clientHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  lo.height = 260; lo.width = Math.round(260 * W / H); // retro: about 146 × 260 pixels
}
addEventListener('resize', resize);
resize();

// ---- shared camera (same numbers as the game) ----
const CAM_Z = -4.4, BASE = CAM_Z + 0.6, FAR = 70;
function camera(S, w, h, fixed) {
  const ease = fixed ? 0 : S.camT * S.camT * (3 - 2 * S.camT);
  const camY = fixed ? HM / 2 : lerp(2.45, HM - 2.45, ease);
  const f = Math.min(h * 1.2, w * 1.4);
  const yaw = 0.14 * (1 - 2 * ease), cy = Math.cos(yaw), sy = Math.sin(yaw);
  const P = (x, y, z) => {
    const dx = x, dy = y - camY, dz = z - CAM_Z;
    const x1 = dx * cy + dz * sy, z1 = Math.max(0.05, dz * cy - dx * sy);
    return [x1 * f / z1, -dy * f / z1];
  };
  return { P, roll: ease * Math.PI, f };
}
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Solid stretches of a surface between za and zb (holes and open stretches removed).
function solid(S, side, za, zb) {
  let parts = [[za, zb]];
  for (const o of S.obs) {
    if (o.type !== 'hole' || o.side !== side) continue;
    parts = parts.flatMap(([a, b]) => (o.z >= b || o.z + o.len <= a) ? [[a, b]]
      : [[a, Math.max(a, o.z)], [Math.min(b, o.z + o.len), b]].filter(([x, y]) => y - x > 0.01));
  }
  return parts;
}

// Boxes for everything standing in the corridor: obstacles, columns, the hero.
function boxes(S) {
  const out = [];
  for (const o of S.obs) {
    if (o.z > FAR || o.z + o.len < BASE) continue;
    if (o.type === 'portal') {
      out.push(o.side < 0 ? { y0: PORTAL_GAP, y1: HM, o } : { y0: 0, y1: HM - PORTAL_GAP, o });
    } else if (o.type === 'block' && o.drop) {
      const d = fallAmount(o) * (HM - OH);
      out.push({ y0: HM - OH - d, y1: HM - d, o });
    } else if (o.type === 'block' && o.topple) {
      const k = fallAmount(o); // a column at the left edge that leans over until it lies across the lane
      out.push({ y0: 0, y1: lerp(HM - 0.2, LOWH, k), x0: -HW, x1: lerp(-HW + 0.45, HW, k), o });
    } else if (o.type === 'block') {
      const h = o.h || OH;
      out.push(o.side < 0 ? { y0: 0, y1: h, o } : { y0: HM - h, y1: HM, o });
    }
  }
  return out.map(b => ({ x0: -HW, x1: HW, z0: b.o.z, z1: b.o.z + b.o.len, ...b }));
}
const columns = S => {
  const out = [], step = 4, first = Math.ceil((S.dist + BASE) / step) * step;
  for (let d = first; d < S.dist + FAR; d += step) {
    const z = d - S.dist;
    for (const x of [-1, 1]) out.push({ x0: x * (HW + 0.15), x1: x * (HW + 0.6), y0: 0, y1: HM, z0: z, z1: z + 0.45, col: true });
  }
  return out;
};

// ================= RETRO: low-poly, low resolution, dithered =================
const PAL = [[16, 18, 24], [38, 42, 52], [64, 70, 84], [98, 104, 116], [138, 142, 150], [182, 184, 186], [226, 224, 218], [200, 70, 64], [236, 196, 92], [70, 120, 150]];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v / 16 - 0.5) * 34);
const grey = (v, z) => { const k = clamp((z - 4) / (FAR - 8), 0, 1); const g = v * (1 - k) + 30 * k; return `rgb(${g},${g},${g + 6})`; };

function drawRetro(S) {
  const w = lo.width, h = lo.height, c = lctx;
  const { P, roll } = camera(S, w, h, false);
  c.setTransform(1, 0, 0, 1, 0, 0);
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#3c4250'); sky.addColorStop(0.5, '#8a8e98'); sky.addColorStop(1, '#2a3040');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  c.save(); c.translate(w / 2, h / 2); c.rotate(roll);
  const poly = (pts, col) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo : c.moveTo).call(c, Math.round(p[0]), Math.round(p[1]))); c.closePath(); c.fillStyle = col; c.fill(); };
  // floor and roof slices, far to near
  const seg = 2, off = S.dist % seg;
  for (let k = Math.ceil((FAR + off) / seg); k >= Math.floor((BASE + off) / seg); k--) {
    const za = Math.max(BASE, k * seg - off), zb = (k + 1) * seg - off;
    if (zb <= za) continue;
    const alt = (k + Math.floor(S.dist / seg)) & 1 ? 10 : 0;
    for (const [side, y, v] of [[-1, 0, 150], [1, HM, 96]]) {
      for (const [a, b] of solid(S, side, za, zb)) poly([P(-HW - 0.7, y, a), P(HW + 0.7, y, a), P(HW + 0.7, y, b), P(-HW - 0.7, y, b)], grey(v + alt, a));
    }
  }
  // boxes far to near, with faces shaded by direction (lit from above-left)
  const items = [...columns(S), ...boxes(S), heroBox(S)].sort((a, b) => b.z1 - a.z1);
  for (const b of items) {
    if (b.hero) { drawHero(c, S, P, false); continue; }
    if (!b.col && b.z1 < 0.2) continue; // behind the hero: hidden, as the game fades them out
    const z0 = Math.max(b.z0, BASE); if (b.z1 <= z0) continue;
    const v = b.col ? 170 : b.o && (b.o.h || b.o.topple) ? 120 : 190;
    if (b.y1 < HM - 0.01) poly([P(b.x0, b.y1, z0), P(b.x1, b.y1, z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1)], grey(v + 40, z0));
    if (b.y0 > 0.01) poly([P(b.x0, b.y0, z0), P(b.x1, b.y0, z0), P(b.x1, b.y0, b.z1), P(b.x0, b.y0, b.z1)], grey(v - 50, z0));
    poly([P(b.x0, b.y0, z0), P(b.x0, b.y1, z0), P(b.x0, b.y1, b.z1), P(b.x0, b.y0, b.z1)], grey(v - 30, z0));
    poly([P(b.x1, b.y0, z0), P(b.x1, b.y1, z0), P(b.x1, b.y1, b.z1), P(b.x1, b.y0, b.z1)], grey(v - 60, z0));
    poly([P(b.x0, b.y0, z0), P(b.x1, b.y0, z0), P(b.x1, b.y1, z0), P(b.x0, b.y1, z0)], grey(v, z0));
  }
  c.restore();
  // dither every pixel to the small palette, with a moving grain
  const img = c.getImageData(0, 0, w, h), d = img.data, seed = (performance.now() * 7) | 0;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const t = BAYER[(y & 3) * 4 + (x & 3)] + ((hash(i + seed) - 0.5) * 12);
    const r = d[i] + t, g = d[i + 1] + t, bl = d[i + 2] + t;
    let best = 0, bd = 1e9;
    for (let p = 0; p < PAL.length; p++) { const q = PAL[p], e = (q[0] - r) ** 2 + (q[1] - g) ** 2 + (q[2] - bl) ** 2; if (e < bd) { bd = e; best = p; } }
    d[i] = PAL[best][0]; d[i + 1] = PAL[best][1]; d[i + 2] = PAL[best][2];
  }
  c.putImageData(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lo, 0, 0, cvs.width, cvs.height);
}

// ================= PAPEL: cut-out cards on a paper stage =================
const paper = (() => { // a tile of paper fibre, laid over everything with "multiply"
  const t = document.createElement('canvas'); t.width = t.height = 256;
  const g = t.getContext('2d'), id = g.createImageData(256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = 236 + hash(i) * 19; id.data[i] = v; id.data[i + 1] = v - 3; id.data[i + 2] = v - 10; id.data[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  g.globalAlpha = 0.07; g.strokeStyle = '#7a6a50';
  for (let k = 0; k < 220; k++) { const x = hash(k) * 256, y = hash(k + 99) * 256, a = hash(k + 7) * 6.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); }
  return t;
})();
const CARD = { floor: '#e8dcc4', roof: '#b9a17e', col: '#f4efe4', tall: '#d9a07a', low: '#9fb4a8', portal: '#8f9fc4', bg: '#6d7f8c' };
const smooth = x => x * x * (3 - 2 * x);

// A card face with slightly uneven cut edges: the points are nudged by a fixed noise per card.
function cutPath(c, pts, seed) {
  c.beginPath();
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    for (let s = 0; s < 4; s++) {
      const t = s / 4, j = (hash(seed * 31 + i * 7 + s) - 0.5) * 2.2;
      const x = p[0] + (q[0] - p[0]) * t + j, y = p[1] + (q[1] - p[1]) * t + j;
      (i || s ? c.lineTo : c.moveTo).call(c, x, y);
    }
  });
  c.closePath();
}
function card(c, pts, fill, seed, shadow = true) {
  c.save();
  if (shadow) { c.shadowColor = 'rgba(40,30,20,.32)'; c.shadowBlur = 6; c.shadowOffsetX = 5; c.shadowOffsetY = 7; }
  cutPath(c, pts, seed);
  c.lineJoin = 'round'; c.lineWidth = 7; c.strokeStyle = '#fbf8f1'; c.stroke(); // the white margin left by the scissors
  c.restore();
  cutPath(c, pts, seed);
  c.fillStyle = fill; c.fill();
  c.lineWidth = 1.2; c.strokeStyle = 'rgba(60,45,30,.55)'; c.stroke();
}

function drawPapel(S) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const { P } = camera(S, W, H, true);
  ctx.fillStyle = CARD.bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2);
  const flat = (pts, col) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, p[0], p[1])); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.stroke(); };
  // floor and roof: big sheets of card; holes are cut out of them
  const seg = 2, off = S.dist % seg;
  for (let k = Math.ceil((FAR + off) / seg); k >= Math.floor((BASE + off) / seg); k--) {
    const za = Math.max(BASE, k * seg - off), zb = (k + 1) * seg - off;
    if (zb <= za) continue;
    for (const [side, y, col] of [[-1, 0, CARD.floor], [1, HM, CARD.roof]]) {
      for (const [a, b] of solid(S, side, za, zb)) flat([P(-HW - 0.7, y, a), P(HW + 0.7, y, a), P(HW + 0.7, y, b), P(-HW - 0.7, y, b)], col);
    }
  }
  // cut-outs, far to near; each folds up from its surface as it comes near (a pop-up book)
  const items = [...columns(S), ...boxes(S), heroBox(S)].sort((a, b) => b.z1 - a.z1);
  for (const b of items) {
    if (b.hero) { drawHero(ctx, S, P, true); continue; }
    const z = Math.max(b.z0, BASE + 0.2);
    if (b.z1 <= BASE) continue;
    const pop = smooth(clamp((48 - z) / 14, 0, 1));
    if (pop <= 0.02) continue;
    const fromTop = b.y1 >= HM - 0.01 && b.y0 > 0.01; // hangs from the roof
    const y0 = fromTop ? lerp(HM, b.y0, pop) : b.y0, y1 = fromTop ? b.y1 : lerp(b.y0, b.y1, pop);
    const fill = b.col ? CARD.col : b.o.type === 'portal' ? CARD.portal : b.o.h || b.o.topple ? CARD.low : CARD.tall;
    ctx.globalAlpha = clamp((b.z0 + 1.2) / 1.4, 0.15, 1); // never cover the camera
    card(ctx, [P(b.x0, y0, z), P(b.x1, y0, z), P(b.x1, y1, z), P(b.x0, y1, z)], fill, (b.o ? b.o.z + S.dist : b.z0 + S.dist) | 0);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // paper fibre over the whole picture
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(paper, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---- the hero: the game's placeholder sprite; in papel it is a card that turns over on a flip ----
const heroBox = S => ({ hero: true, z0: 0, z1: PL });
function drawHero(c, S, P, asCard) {
  const mid = P(0, S.py + PH / 2, 0.3), u = P(1, 0, 0.3)[0] - P(0, 0, 0.3)[0];
  c.save();
  c.translate(mid[0], mid[1]);
  if (asCard) {
    const turn = Math.cos(S.camT * Math.PI); // 1 on the floor, -1 on the roof, edge-on halfway
    c.scale(u, u * turn);
    c.shadowColor = 'rgba(40,30,20,.35)'; c.shadowBlur = 5; c.shadowOffsetX = 4; c.shadowOffsetY = 6 * Math.sign(turn || 1);
  } else {
    c.scale(u, S.grav > 0 ? -u : u);
  }
  c.translate(0, PH / 2);
  drawAxolotl(c, S.dist * 2.1, !S.grounded, S.slide > 0, asCard ? 0 : S.camT);
  c.restore();
}

// ---- loop ----
let S = createSim({ lives: 3 }), deadAt = 0, last = performance.now();
const emit = type => { if (type === 'die') deadAt = performance.now(); };
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
  if (S.dead && now - deadAt > 900) S = createSim({ lives: 3 });
  update(S, dt, emit, { live: true });
  if (style === 'retro') drawRetro(S); else drawPapel(S);
  $('dist').textContent = Math.floor(S.dist) + ' m';
  requestAnimationFrame(frame);
}
bindTouch(cvs, {
  active: () => !S.dead, onTouch: () => {}, press: () => press(S, emit), slide: () => slide(S, emit),
  heroJumping: () => S.mode === 'jump', surfaceOnTop: () => style === 'papel' && S.grav > 0, swipePx: () => 26,
});
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); press(S, emit); }
  if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); slide(S, emit); }
});
for (const b of document.querySelectorAll('[data-estilo]')) {
  b.addEventListener('click', e => {
    e.stopPropagation(); style = b.dataset.estilo;
    for (const x of document.querySelectorAll('[data-estilo]')) x.setAttribute('aria-pressed', x === b);
    history.replaceState(null, '', '?estilo=' + style);
  });
  b.setAttribute('aria-pressed', b.dataset.estilo === style);
}
requestAnimationFrame(frame);
