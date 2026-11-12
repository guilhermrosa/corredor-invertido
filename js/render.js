// World renderer: Canvas 2D with hand-rolled perspective (pseudo-3D).
// Placeholder world: a seaside stoa (covered colonnade) of white marble on a sunny day.
// Reads the simulation state and draws it; never changes it.
//
// Where a surface is missing (an "open" stretch in the simulation) nothing is drawn,
// so the backdrop shows through: open sky above, the sea far below.

import { HM, HW, PH, PL, OH, HIT, RUIN_DIP, PORTAL_GAP, HEART_LIFT, clamp, lerp, mix, rgb, COL } from './config.js';
import { blockHitbox, holeKillZone, playerBox, fallAmount } from './sim.js';
import { drawAxolotl } from './hero.js';

const CAM_Z = -4.4, NEAR = 0.6, BASE = CAM_Z + NEAR;
let FAR = 75; // draw distance; set per frame from the quality level

// Quality levels, picked automatically on slow devices (main.js) or in Opções.
// dpr caps the canvas resolution, the biggest cost on weak phones.
export const QUALITY = {
  high:   { dpr: 2,   far: 75, glints: 46, coffers: true,  flutes: true,  lines: 26 },
  medium: { dpr: 1.5, far: 58, glints: 20, coffers: true,  flutes: false, lines: 16 },
  low:    { dpr: 1,   far: 42, glints: 0,  coffers: false, flutes: false, lines: 10 },
};
// Chase view turned a little to the left (the user preferred this to the stronger
// three-quarter view of v0.12–0.13: yaw 0.36, pitch 0.28, x 0.6, anchor 0.46 / 0.64).
export const CAMERA = {
  yaw: 0.14,     // radians turned to the left (about 8°)
  pitch: 0,      // radians looking down
  x: 0,          // metres to the right of the lane's centre
  anchorX: 0.5,  // where the camera's optical centre sits on screen (fraction of width / height)
  anchorY: 0.5,
};
const EDGE = HW + 0.5;                          // floor and roof extend under the colonnade
const COL_X0 = HW + 0.1, COL_X1 = HW + 0.4;     // column box, outside the running lane
const COL_D = 0.3;
const SLAB = 0.45;                              // thickness shown at broken edges
const FRIEZE = 0.35;                            // height of the painted band under the roof

const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Parts of [za, zb] where the surface on `side` exists (not cut by an open stretch).
function solidParts(obs, side, za, zb) {
  let parts = [[za, zb]];
  for (const o of obs) {
    if (!o.open || o.side !== side) continue;
    const a = o.z, b = o.z + o.len;
    const next = [];
    for (const [p, q] of parts) {
      if (b <= p || a >= q) { next.push([p, q]); continue; }
      if (a > p) next.push([p, a]);
      if (b < q) next.push([b, q]);
    }
    parts = next;
  }
  return parts;
}
const missingAt = (obs, side, z) => obs.some(o => o.open && o.side === side && z >= o.z && z <= o.z + o.len);

const CLOUDS = [
  { x: -0.35, y: -0.34, s: 1.0, v: 0.6 }, { x: 0.3, y: -0.42, s: 0.8, v: 0.4 },
  { x: 0.05, y: -0.24, s: 0.6, v: 0.8 }, { x: -0.6, y: -0.18, s: 0.7, v: 0.5 },
  { x: 0.65, y: -0.28, s: 0.9, v: 0.3 },
];

function drawBackdrop(ctx, W, H, t, Q) {
  const R = Math.hypot(W, H);
  // sky down to the horizon (local y = 0 is the horizon at any camera height)
  const sky = ctx.createLinearGradient(0, -R * 0.6, 0, 0);
  sky.addColorStop(0, rgb(COL.skyTop));
  sky.addColorStop(1, rgb(COL.haze));
  ctx.fillStyle = sky;
  ctx.fillRect(-R, -R, 2 * R, R);
  // sea below the horizon
  const sea = ctx.createLinearGradient(0, 0, 0, R * 0.6);
  sea.addColorStop(0, rgb(mix(COL.sea, COL.haze, 0.55)));
  sea.addColorStop(0.12, rgb(COL.sea));
  sea.addColorStop(1, rgb(COL.seaDeep));
  ctx.fillStyle = sea;
  ctx.fillRect(-R, 0, 2 * R, R);
  // sun with a soft glow
  const sx = -W * 0.24, sy = -H * 0.3, sr = Math.min(W, H) * 0.06;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
  glow.addColorStop(0, rgb(COL.sun, 0.75));
  glow.addColorStop(1, rgb(COL.sun, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
  ctx.fillStyle = rgb(COL.sun);
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  // drifting clouds
  ctx.fillStyle = rgb(COL.cloud, 0.92);
  for (const c of CLOUDS) {
    const span = W * 2;
    const x = ((c.x * W + t * c.v * 6) % span + span) % span - W;
    const y = c.y * H, r = Math.min(W, H) * 0.05 * c.s;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 2.2, r * 0.8, 0, 0, Math.PI * 2);
    ctx.ellipse(x - r * 1.1, y + r * 0.15, r * 1.3, r * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.9, y - r * 0.35, r * 1.2, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // a distant island on the horizon
  ctx.fillStyle = rgb(mix(COL.island, COL.haze, 0.45));
  ctx.beginPath();
  ctx.moveTo(W * 0.16, 0);
  ctx.quadraticCurveTo(W * 0.24, -H * 0.03, W * 0.3, -H * 0.042);
  ctx.quadraticCurveTo(W * 0.38, -H * 0.05, W * 0.44, -H * 0.02);
  ctx.lineTo(W * 0.52, 0);
  ctx.closePath();
  ctx.fill();
  // sun glints on the water
  for (let i = 0; i < Q.glints; i++) {
    const gx = (hash(i) - 0.5) * W * 1.6;
    const gy = Math.pow(hash(i + 50), 2) * H * 0.55 + 3;
    const a = 0.35 + 0.35 * Math.sin(t * 2.2 + i * 1.7);
    const w = 2 + gy / H * 10;
    ctx.fillStyle = rgb(COL.cloud, a);
    ctx.fillRect(gx - w / 2, gy, w, Math.max(1, w * 0.18));
  }
}

// opts.debug: outline every hitbox on top of the scene; opts.fx: particles from fx.js;
// opts.quality: a key of QUALITY
export function drawTunnel(ctx, S, W, H, opts = {}) {
  const Q = QUALITY[opts.quality] || QUALITY.high;
  FAR = Q.far;
  // opts.fixedCamera: the screen never turns. The camera stays at mid-height and upright,
  // so the floor is always at the bottom and the hero runs upside down along the roof.
  const fixedCam = !!opts.fixedCamera;
  const ease = fixedCam ? 0 : S.camT * S.camT * (3 - 2 * S.camT);
  const camY = fixedCam ? HM / 2 : lerp(2.45, HM - 2.45, ease);
  const roll = ease * Math.PI;
  const f = Math.min(H * 1.2, W * 1.4);
  const t = performance.now() / 1000;
  // the yaw mirrors while the camera rolls onto the ceiling, so the screen keeps the same composition
  const mirror = 1 - 2 * ease;
  const yaw = CAMERA.yaw * mirror, cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const pitch = CAMERA.pitch * mirror, cp = Math.cos(pitch), sp = Math.sin(pitch);
  const camX = CAMERA.x * mirror;
  const P = (x, y, z) => {
    const dx = x - camX, dy = y - camY, dz = z - CAM_Z;
    const x1 = dx * cyw + dz * syw, z1 = dz * cyw - dx * syw;  // turn left
    const y2 = dy * cp + z1 * sp, z2 = z1 * cp - dy * sp;      // look down
    const zc = Math.max(0.05, z2);
    return [x1 * f / zc, -y2 * f / zc];
  };
  const fogK = z => Math.pow(clamp((z - 4) / (FAR - 8), 0, 1), 0.85);
  const fog = (c, z) => rgb(mix(c, COL.haze, fogK(z)));
  const lw = z => Math.max(0.6, f / (z - CAM_Z) * 0.03);
  const path = pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  const poly = (pts, col) => {
    path(pts);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); // hides hairline seams between polygons
  };
  const quad = (a, b, c, d, col) => poly([a, b, c, d], col);
  const line = (a, b, col, w) => {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  };

  ctx.fillStyle = rgb(COL.haze);
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W * CAMERA.anchorX, H * CAMERA.anchorY);
  ctx.rotate(roll);
  ctx.save();
  ctx.translate(Math.tan(yaw) * f, -Math.tan(pitch) * f / Math.cos(yaw)); // the backdrop is infinitely far: it only pans
  drawBackdrop(ctx, W, H, t, Q);
  ctx.restore();

  // 1. the stoa, slice by slice, far to near: floor, roof, painted band, columns
  const seg = 2, off = S.dist % seg, n = Math.floor(S.dist / seg);
  const kmin = Math.floor((BASE + off) / seg), kmax = Math.ceil((FAR + off) / seg);
  for (let k = kmax; k >= kmin; k--) {
    const z0 = k * seg - off;
    const za = Math.max(BASE, z0), zb = z0 + seg;
    if (zb <= za) continue;
    const idx = k + n, alt = idx & 1;

    for (const [a, b] of solidParts(S.obs, -1, za, zb)) {
      // running lane in marble slabs, a darker step (stylobate) under the columns
      quad(P(-HW, 0, a), P(HW, 0, a), P(HW, 0, b), P(-HW, 0, b), fog(alt ? COL.marble2 : COL.marble, a));
      quad(P(-EDGE, 0, a), P(-HW, 0, a), P(-HW, 0, b), P(-EDGE, 0, b), fog(COL.stylobate, a));
      quad(P(HW, 0, a), P(EDGE, 0, a), P(EDGE, 0, b), P(HW, 0, b), fog(COL.stylobate, a));
      const jc = fog(COL.joint, a);
      if (z0 >= a && z0 <= b) line(P(-HW, 0, z0), P(HW, 0, z0), jc, lw(z0) * 0.8);
    }
    for (const [a, b] of solidParts(S.obs, 1, za, zb)) {
      quad(P(-EDGE, HM, a), P(EDGE, HM, a), P(EDGE, HM, b), P(-EDGE, HM, b), fog(COL.ceiling, a));
      if (Q.coffers && b - a > 0.9) { // coffer
        const ca = a + 0.3, cb = b - 0.3;
        quad(P(-HW * 0.6, HM, ca), P(HW * 0.6, HM, ca), P(HW * 0.6, HM, cb), P(-HW * 0.6, HM, cb), fog(COL.beam, ca));
      }
      // painted band under the roof edge: blue triglyphs alternating with plain metopes
      for (const s of [-1, 1]) {
        const x = s * (HW + 0.05);
        for (let h = 0; h < 2; h++) {
          const ha = Math.max(a, z0 + h), hb = Math.min(b, z0 + h + 1);
          if (hb <= ha) continue;
          const col = h === 0 ? COL.frieze : COL.friezeAlt;
          quad(P(x, HM - FRIEZE, ha), P(x, HM - FRIEZE, hb), P(x, HM, hb), P(x, HM, ha), fog(col, ha));
        }
      }
    }
    // columns: missing where the floor is gone, broken where the roof is gone
    const zc = z0 + 0.8;
    if (!(idx & 1) && zc > BASE && !missingAt(S.obs, -1, zc + COL_D / 2)) {
      const broken = missingAt(S.obs, 1, zc + COL_D / 2);
      const h = broken ? HM * (0.3 + 0.4 * hash(idx)) : HM - FRIEZE;
      // a toppling column takes the place of the left column near it
      const replaced = S.obs.some(o => o.topple && Math.abs(o.z - zc) < 2.2);
      for (const s of replaced ? [1] : [-1, 1]) {
        const x0 = s * COL_X0, x1 = s * COL_X1;
        quad(P(x0, 0, zc), P(x0, 0, zc + COL_D), P(x0, h, zc + COL_D), P(x0, h, zc), fog(COL.columnShade, zc));
        if (broken) {
          const j1 = h + 0.12 * hash(idx * 3 + s), j2 = h - 0.1;
          poly([P(x0, 0, zc), P(x1, 0, zc), P(x1, j1, zc), P((x0 + x1) / 2, j2, zc), P(x0, h, zc)], fog(COL.column, zc));
        } else {
          quad(P(x0, 0, zc), P(x1, 0, zc), P(x1, h, zc), P(x0, h, zc), fog(COL.column, zc));
          quad(P(x0 - s * 0.05, h - 0.14, zc), P(x1 + s * 0.05, h - 0.14, zc), P(x1 + s * 0.05, h, zc), P(x0 - s * 0.05, h, zc), fog(COL.columnShade, zc));
        }
        const fc = fog(COL.columnShade, zc);
        for (const q of Q.flutes ? [0.35, 0.65] : []) {
          const fx = lerp(x0, x1, q);
          line(P(fx, 0.05, zc), P(fx, h - (broken ? 0.15 : 0.18), zc), fc, lw(zc) * 0.7);
        }
      }
    }
  }

  // 2. holes and the broken slab edges of open stretches
  for (const o of S.obs) {
    if (o.type !== 'hole' || o.z > FAR) continue;
    const z0 = Math.max(o.z, BASE), z1 = o.z + o.len;
    if (z1 <= z0) continue;
    const sy = o.side < 0 ? 0 : HM;
    const dy = o.side < 0 ? -SLAB : SLAB;
    const w = o.open ? EDGE : HW;
    const mouth = [P(-w, sy, z0), P(w, sy, z0), P(w, sy, z1), P(-w, sy, z1)];
    ctx.save();
    path(mouth);
    ctx.clip();
    if (!o.open) {
      // a broken slab: what lies beyond is the sea below or the sky above
      quad(...mouth, fog(o.side < 0 ? COL.sea : mix(COL.skyTop, COL.haze, 0.35), z0));
      const side = fog(mix(COL.ruin, COL.edge, 0.4), z0);
      quad(P(-w, sy, z0), P(-w, sy + dy, z0), P(-w, sy + dy, z1), P(-w, sy, z1), side);
      quad(P(w, sy, z0), P(w, sy + dy, z0), P(w, sy + dy, z1), P(w, sy, z1), side);
    }
    // far edge of the gap: the broken slab's thickness, facing the camera
    quad(P(-w, sy, z1), P(w, sy, z1), P(w, sy + dy, z1), P(-w, sy + dy, z1), fog(COL.ruin, z1));
    ctx.restore();
    // a dark broken lip on the near edge, so gaps read from afar
    if (o.z - 0.2 > BASE) quad(P(-w, sy, o.z - 0.2), P(w, sy, o.z - 0.2), P(w, sy, o.z), P(-w, sy, o.z), fog(COL.edge, o.z));
  }

  // 3. boxes: obstacles + the hero, far to near
  const items = [];
  for (const o of S.obs) {
    if (o.z > FAR) continue;
    if (o.type === 'portal') {
      items.push({
        x0: -HW, x1: HW, z0: o.z, z1: o.z + o.len, col: COL.ruin, kind: 'portal', side: o.side, seed: o.len,
        y0: o.side < 0 ? PORTAL_GAP : 0, y1: o.side < 0 ? HM : HM - PORTAL_GAP,
      });
      continue;
    }
    if (o.type === 'heart') {
      if (!o.taken) items.push({ kind: 'heart', z0: o.z, z1: o.z + o.len, side: o.side, x0: 0, x1: 0, y0: 0, y1: 0 });
      continue;
    }
    if (o.type !== 'block') continue;
    if (o.topple) {
      items.push({ kind: 'pillar', z0: o.z, z1: o.z + o.len, x0: -HW, x1: HW, y0: 0, y1: OH, col: COL.column, ang: fallAmount(o) * Math.PI / 2, wobble: o.p && o.p < 0.27 });
      continue;
    }
    if (o.drop) {
      // hangs from the roof, wobbles, then drops to the floor
      const d = fallAmount(o) * (HM - OH) + (o.p && o.p < 0.27 ? 0.03 * Math.sin(t * 70) : 0);
      items.push({ x0: -HW, x1: HW, y0: HM - OH - d, y1: HM - d, z0: o.z, z1: o.z + o.len, col: COL.lintel, kind: 'lintel', seed: o.len });
      continue;
    }
    const bh = o.h || OH;
    const kind = o.h ? (hash(o.len * 97) < 0.5 ? 'wall' : 'drum') : (o.side < 0 ? 'ruin' : 'lintel');
    const col = { wall: COL.wall, drum: COL.column, ruin: COL.ruin, lintel: COL.lintel }[kind];
    items.push({ x0: -HW, x1: HW, y0: o.side < 0 ? 0 : HM - bh, y1: o.side < 0 ? bh : HM, z0: o.z, z1: o.z + o.len, col, kind, seed: o.len });
  }
  const pbox = playerBox(S);
  items.push({ x0: -0.36, x1: 0.36, y0: S.py, y1: S.py + PH, z0: 0, z1: PL, player: true });
  items.sort((a, b) => b.z1 - a.z1);
  for (const b of items) {
    const z0 = Math.max(b.z0, BASE);
    if (b.z1 <= z0) continue;
    const clipFall = b.player && (S.falling || S.sink > 0) && S.fallHole;
    if (clipFall) {
      const h = S.fallHole, sy = h.side < 0 ? 0 : HM, hz0 = Math.max(h.z, BASE), w = h.open ? EDGE : HW;
      ctx.save();
      if (S.falling) { // the run is over: show the falling hero only through the hole
        path([P(-w, sy, hz0), P(w, sy, hz0), P(w, sy, h.z + h.len), P(-w, sy, h.z + h.len)]);
        ctx.clip();
      } else if (h.z > BASE) { // slipping in: the slab in front of the hole hides his legs
        ctx.beginPath();
        ctx.rect(-4 * W, -4 * H, 9 * W, 9 * H);
        const q = [P(-HW, sy, BASE), P(HW, sy, BASE), P(HW, sy, h.z), P(-HW, sy, h.z)];
        ctx.moveTo(q[0][0], q[0][1]); for (const p of q.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath();
        ctx.clip('evenodd');
      }
    }
    if (b.player) {
      const onCeil = S.grav > 0;
      const feet = P(0, onCeil ? b.y1 : b.y0, 0.3);
      const u = P(1, 0, 0.3)[0] - P(0, 0, 0.3)[0]; // pixels per metre at the hero's depth
      ctx.save();
      if (S.invuln > 0 && Math.floor(S.invuln * 10) % 2) ctx.globalAlpha = 0.35; // blink while protected
      ctx.translate(feet[0], feet[1]);
      ctx.scale(u, onCeil ? -u : u);
      drawAxolotl(ctx, S.dist * 2.1, !S.grounded, S.slide > 0, S.camT); // gold follows the inverted gravity
      ctx.restore();
      if (clipFall) ctx.restore();
      continue;
    }
    if (b.kind === 'heart') { drawHeart(b); continue; }
    // obstacles fade out once they pass the hero, so they never cover the camera
    const alpha = clamp(0.12 + 0.88 * (b.z0 + 1.0) / 1.2, 0.12, 1);
    ctx.globalAlpha = alpha;
    drawObstacle(b, z0);
    if (alpha < 1) { // keep an outline on faded obstacles so they still read as solid
      ctx.globalAlpha = Math.min(1, alpha + 0.3);
      path([P(b.x0, b.y0, z0), P(b.x1, b.y0, z0), P(b.x1, b.y1, z0), P(b.x0, b.y1, z0)]);
      ctx.strokeStyle = rgb(COL.edge);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 4. particles (dust, stone chips), projected with the scene
  if (opts.fx) {
    for (const p of opts.fx.particles) {
      if (p.z <= BASE + 0.2) continue;
      const q = P(p.x, p.y, p.z);
      const r = Math.max(0.8, p.size * f / (p.z - CAM_Z));
      ctx.fillStyle = rgb(p.col, 0.85 * (1 - p.age / p.life));
      ctx.fillRect(q[0] - r, q[1] - r, r * 2, r * 2);
    }
  }

  // 5. speed lines streaming from the far end once the run gets fast
  const rush = clamp((S.speed - 14) / 6, 0, 1);
  if (rush > 0) {
    const R = Math.hypot(W, H), vx = Math.tan(yaw) * f;
    ctx.strokeStyle = rgb(COL.ink, 0.22 * rush); // dark enough to read over white marble
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < Q.lines; i++) {
      const a = hash(i * 3.1) * Math.PI * 2;
      const k = (t * (0.9 + hash(i) * 0.8) + hash(i * 7.7)) % 1;
      const r0 = R * (0.22 + 0.5 * k), r1 = r0 + R * (0.06 + 0.12 * k) * rush;
      ctx.moveTo(vx + Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(vx + Math.cos(a) * r1, Math.sin(a) * r1);
    }
    ctx.stroke();
  }

  // 6. hitboxes (debug view): red = blocks, orange = where a hole makes you fall, green = player
  if (opts.debug) {
    const box = (x0, x1, y0, y1, z0, z1, col) => {
      if (z1 <= BASE) return;
      z0 = Math.max(z0, BASE);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.fillStyle = col.replace('1)', '0.18)');
      path([P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)]);
      ctx.fill(); ctx.stroke();
      path([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]);
      ctx.stroke();
      for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) {
        const a = P(x, y, z0), c = P(x, y, z1);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      }
    };
    for (const o of S.obs) {
      if (o.z > FAR) continue;
      if (o.type === 'block' || o.type === 'portal') {
        const hb = blockHitbox(o);
        if (hb) box(-HW, HW, hb.y0, hb.y1, hb.z0, hb.z1, 'rgba(220,40,40,1)');
      } else if (o.type === 'hole') {
        const kz = holeKillZone(o), sy = o.side < 0 ? 0 : HM;
        box(-HW, HW, sy, sy, kz.z0, kz.z1, 'rgba(240,140,20,1)');
      }
    }
    box(-0.36, 0.36, pbox.y0, pbox.y1, HIT.player, PL - HIT.player, 'rgba(30,170,70,1)');
  }
  ctx.restore();

  // A column of the colonnade toppling across the path: it turns as one piece around the
  // corner of its base nearest the lane, like a tree falling, and lies on the floor when down.
  function drawPillar(b, z0) {
    const L = HM - FRIEZE, Wd = 0.5;
    const a = b.ang + (b.wobble ? 0.03 * Math.sin(t * 60) : 0);
    const ax = Math.sin(a), ay = Math.cos(a);   // along the column
    const px = Math.cos(a), py = -Math.sin(a);  // across it, toward its far side
    const piv = [-(HW + 0.05), 0];
    const at = (u, w) => [piv[0] + ax * u - px * w, piv[1] + ay * u - py * w];
    const p3 = ([x, y], z) => P(x, y, z);
    const A = at(0, 0), B = at(L, 0), C = at(L, Wd), D = at(0, Wd);
    // the side of the column the camera can see: its lane-facing side while standing, its top once low
    const side = a < Math.PI / 4 ? [A, B] : [D, C];
    quad(p3(side[0], z0), p3(side[1], z0), p3(side[1], b.z1), p3(side[0], b.z1), fog(COL.columnShade, z0));
    quad(p3(A, z0), p3(B, z0), p3(C, z0), p3(D, z0), fog(COL.column, z0));
    const fc = fog(COL.columnShade, z0);
    for (const q of [0.33, 0.66]) line(p3(at(0.1, Wd * q), z0), p3(at(L - 0.1, Wd * q), z0), fc, lw(z0) * 0.8);
    // a dark outline keeps the white column readable against the white marble floor
    path([p3(A, z0), p3(B, z0), p3(C, z0), p3(D, z0)]);
    ctx.strokeStyle = fog(COL.edge, z0);
    ctx.lineWidth = lw(z0) * 1.6;
    ctx.stroke();
  }

  // Golden heart (Athena's blessing): floats and turns over its surface, with a gold glow.
  function drawHeart(b) {
    const zc = (b.z0 + b.z1) / 2;
    if (zc <= BASE + 0.3) return;
    const bob = Math.sin(t * 3 + b.z0) * 0.06;
    const y = b.side < 0 ? HEART_LIFT + bob : HM - HEART_LIFT - bob;
    const [x, yy] = P(0, y, zc);
    const r = 0.34 * f / (zc - CAM_Z);
    const fk = fogK(zc);
    const glow = ctx.createRadialGradient(x, yy, r * 0.2, x, yy, r * 2.2);
    glow.addColorStop(0, `rgba(244,196,92,${0.55 * (1 - fk)})`);
    glow.addColorStop(1, 'rgba(244,196,92,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, yy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(x, yy);
    // upright for the hero on either surface; it slowly turns like a coin
    ctx.scale(Math.max(0.25, Math.abs(Math.cos(t * 2.2 + b.z0))) * r, (b.side < 0 ? 1 : -1) * r);
    ctx.beginPath();
    ctx.moveTo(0, 0.95);
    ctx.bezierCurveTo(-1.1, 0.2, -1.1, -0.85, -0.5, -0.85);
    ctx.bezierCurveTo(-0.2, -0.85, 0, -0.6, 0, -0.4);
    ctx.bezierCurveTo(0, -0.6, 0.2, -0.85, 0.5, -0.85);
    ctx.bezierCurveTo(1.1, -0.85, 1.1, 0.2, 0, 0.95);
    ctx.fillStyle = rgb(mix([244, 196, 92], COL.haze, fk));
    ctx.fill();
    ctx.lineWidth = 0.12;
    ctx.strokeStyle = rgb(mix([150, 104, 30], COL.haze, fk));
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacle(b, z0) {
    if (b.kind === 'pillar') { drawPillar(b, z0); return; }
    const face = fog(b.col, z0);
    const lid = fog(mix(b.col, COL.cloud, 0.45), z0);
    const dark = fog(mix(b.col, COL.edge, 0.55), z0);
    const lwz = lw(z0);
    if (camY > b.y1) quad(P(b.x0, b.y1, z0), P(b.x1, b.y1, z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1), lid);
    if (camY < b.y0) quad(P(b.x0, b.y0, z0), P(b.x1, b.y0, z0), P(b.x1, b.y0, b.z1), P(b.x0, b.y0, b.z1), lid);
    const { x0, x1, y0, y1 } = b;
    const W2 = x1 - x0, Hh = y1 - y0;
    if (b.kind === 'portal') {
      // fallen portal: a heavy slab resting on two column drums, leaving a low gap to slide through
      const sy = b.side < 0 ? 0 : HM;                    // surface the gap sits on
      const gy = b.side < 0 ? PORTAL_GAP : HM - PORTAL_GAP; // underside of the slab
      // shadow in the gap
      quad(P(x0, sy, z0), P(x1, sy, z0), P(x1, sy, b.z1), P(x0, sy, b.z1), fog(mix(COL.edge, COL.ink, 0.35), z0));
      // drums at the lane edges
      for (const [da, db] of [[x0, x0 + 0.32], [x1 - 0.32, x1]]) {
        quad(P(da, sy, z0), P(db, sy, z0), P(db, gy, z0), P(da, gy, z0), fog(COL.column, z0));
        line(P((da + db) / 2, sy, z0), P((da + db) / 2, gy, z0), fog(COL.columnShade, z0), lwz);
      }
      // the slab, with a broken far edge and a painted band along the gap
      const far = b.side < 0 ? y1 : y0;
      const pts = [P(x0, gy, z0), P(x1, gy, z0)];
      const steps = 6;
      for (let i = steps; i >= 0; i--) pts.push(P(x0 + W2 * i / steps, far - (b.side < 0 ? 1 : -1) * 0.25 * hash(b.seed * 7 + i), z0));
      poly(pts, face);
      const bandA = gy, bandB = gy + (b.side < 0 ? 0.22 : -0.22);
      quad(P(x0, bandA, z0), P(x1, bandA, z0), P(x1, bandB, z0), P(x0, bandB, z0), fog(COL.frieze, z0));
      for (let i = 1; i < 8; i += 2) {
        const xa = x0 + W2 * i / 8, xc = x0 + W2 * (i + 0.5) / 8;
        quad(P(xa, bandA, z0), P(xc, bandA, z0), P(xc, bandB, z0), P(xa, bandB, z0), fog(COL.friezeAlt, z0));
      }
      for (const r of [0.45, 0.72]) {
        const yy = lerp(gy, far, r);
        line(P(x0, yy, z0), P(x1, yy, z0), dark, lwz);
      }
      return;
    }
    if (b.kind === 'ruin') {
      // ruined wall with a jagged broken top
      const pts = [P(x0, y0, z0), P(x1, y0, z0)];
      const steps = 7;
      for (let i = steps; i >= 0; i--) pts.push(P(x0 + W2 * i / steps, y1 - RUIN_DIP * hash(b.seed * 13 + i), z0));
      poly(pts, face);
      for (const r of [0.33, 0.66]) line(P(x0, y0 + Hh * r, z0), P(x1, y0 + Hh * r, z0), dark, lwz);
      for (let i = 1; i < 5; i++) {
        const x = x0 + W2 * (i / 5 + (i % 2 ? 0.06 : -0.06));
        line(P(x, y0 + Hh * (i % 2 ? 0 : 0.33), z0), P(x, y0 + Hh * (i % 2 ? 0.33 : 0.66), z0), dark, lwz);
      }
      return;
    }
    quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), face);
    if (b.kind === 'wall') { // low wall: stone blocks in two staggered rows
      line(P(x0, y0 + Hh * 0.5, z0), P(x1, y0 + Hh * 0.5, z0), dark, lwz);
      for (let i = 1; i < 6; i++) {
        const row = i % 2;
        const x = x0 + W2 * (i / 6);
        line(P(x, y0 + Hh * (row ? 0 : 0.5), z0), P(x, y0 + Hh * (row ? 0.5 : 1), z0), dark, lwz);
      }
    } else if (b.kind === 'drum') { // fallen column lying across the path: flutes along its length
      for (const r of [0.22, 0.5, 0.78]) line(P(x0, y0 + Hh * r, z0), P(x1, y0 + Hh * r, z0), fog(COL.columnShade, z0), lwz);
    } else if (b.kind === 'lintel') { // fallen roof beam: painted triglyphs, a band of dentils
      const top = y1 - Hh * 0.08, mid = y0 + Hh * 0.5;
      const n = 8;
      for (let i = 0; i < n; i += 2) {
        const xa = x0 + W2 * i / n, xc = x0 + W2 * (i + 1) / n;
        quad(P(xa, mid, z0), P(xc, mid, z0), P(xc, top, z0), P(xa, top, z0), fog(COL.frieze, z0));
      }
      line(P(x0, mid, z0), P(x1, mid, z0), dark, lwz * 1.4);
      for (let i = 0; i < 16; i++) {
        const xa = x0 + W2 * (i + 0.25) / 16, xc = x0 + W2 * (i + 0.75) / 16;
        quad(P(xa, y0 + Hh * 0.12, z0), P(xc, y0 + Hh * 0.12, z0), P(xc, y0 + Hh * 0.3, z0), P(xa, y0 + Hh * 0.3, z0), dark);
      }
    }
  }
}
