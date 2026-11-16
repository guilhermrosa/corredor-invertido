// Main character, drawn from behind, following the user's silhouette sketch (v0.45: proportions
// closer to it: pear-shaped body, short limbs as filled shapes, big wide head; v0.45.1 slimmer):
// big oval head, three long fringed gills per side spread like a crown, slim humanoid body,
// asymmetric running pose (one arm raised with an open hand, the other low; one leg kicked
// back showing its sole), and a long thick tail with a crest hanging toward the camera.
//
// Drawn in metres with the origin at the feet and up = negative y; the caller scales to
// pixels and flips vertically when the hero runs on the ceiling. The hitbox stays the
// player box in sim.js; this is only the look.

const C = {
  body: '#e0636a', shade: '#c84f5a', line: '#8f2a3a',
  gill: '#c43a55', fringe: '#8f2a3a', sole: '#f2a0a2', crest: '#f0b0ae',
};
const LINE = 0.022;

// Divine blessing (0..1): while the hero's gravity is turned toward the roof, the gods' gift
// shows as gold. Gold is the game's sign for anything divine (future boosters too).
const GOLD = [244, 196, 92];
let bless = 0;
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const tint = (hex, t, to = GOLD) => {
  const c = rgbOf(hex);
  return `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * t)).join(',')})`;
};
// a soft gold halo behind the head
function halo(ctx, x, y, r) {
  if (bless < 0.02) return;
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, `rgba(${GOLD.join(',')},${0.55 * bless})`);
  g.addColorStop(1, `rgba(${GOLD.join(',')},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const lerp = (a, b, t) => a + (b - a) * t;

function blob(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = LINE;
  ctx.stroke();
}

// thick limb with an outline: draw the outline as a wider stroke first
function limb(ctx, pts, w, fill = C.body) {
  for (const [col, width] of [[C.line, w + LINE * 2], [fill, w]]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
}

// open hand: small palm and four splayed fingers pointing along `ang`
function hand(ctx, x, y, ang) {
  ctx.strokeStyle = C.line;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.022;
  for (let i = 0; i < 4; i++) {
    const a = ang + (i - 1.5) * 0.38;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 0.085, y + Math.sin(a) * 0.085);
    ctx.stroke();
  }
  blob(ctx, x, y, 0.045, 0.04, C.body);
}

// one gill: a tapered, slightly curved stalk with a fringe of short filaments
function gill(ctx, bx, by, ang, len, side, wig) {
  const a = ang + wig;
  const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
  const cx = bx + Math.cos(a - side * 0.35) * len * 0.55, cy = by + Math.sin(a - side * 0.35) * len * 0.55;
  const pt = t => [
    (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * ex,
    (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ey,
  ];
  // tapered stalk
  const N = 10, left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [x, y] = pt(t), [x2, y2] = pt(Math.min(1, t + 0.05));
    const nx = -(y2 - y), ny = x2 - x, nl = Math.hypot(nx, ny) || 1;
    const w = lerp(0.032, 0.006, t);
    left.push([x + nx / nl * w, y + ny / nl * w]);
    right.push([x - nx / nl * w, y - ny / nl * w]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (const p of right.reverse()) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = tint(C.gill, bless * 0.85);
  ctx.fill();
  // fringe filaments on both sides of the outer two thirds
  ctx.strokeStyle = tint(C.fringe, bless * 0.7, [255, 236, 170]);
  ctx.lineWidth = 0.009;
  ctx.lineCap = 'round';
  for (let i = 3; i <= 9; i++) {
    const t = i / 10, [x, y] = pt(t), [x2, y2] = pt(t + 0.05);
    const dx = x2 - x, dy = y2 - y, dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl, fl = 0.045 * (1 - t * 0.5);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + nx * s * 0.015, y + ny * s * 0.015);
      ctx.lineTo(x + nx * s * fl + dx / dl * 0.02, y + ny * s * fl + dy / dl * 0.02);
      ctx.stroke();
    }
  }
}

// Belly slide, seen from behind: soles nearest the camera, flat body, head further ahead,
// arms stretched forward on both sides of the head.
function drawSlide(ctx, phase, aegis = false) {
  halo(ctx, 0, -0.45, 0.5);
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0.0, 0.46, 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  const wig = Math.sin(phase * 2.2) * 0.05;
  // arms stretched forward
  for (const side of [-1, 1]) {
    limb(ctx, [[side * 0.13, -0.26], [side * 0.19, -0.38], [side * 0.21, -0.48]], 0.08);
    hand(ctx, side * 0.21, -0.5, -Math.PI / 2 + side * 0.25);
  }
  // gills, smaller because the head is further away
  for (const side of [-1, 1]) {
    const spec = [[-1.15, 0.18], [-0.62, 0.2], [-0.12, 0.17]];
    spec.forEach(([a, len], i) => {
      const ang = side < 0 ? Math.PI - a : a;
      gill(ctx, side * (0.12 + i * 0.035), -0.44 + i * 0.035, ang, len, side, wig * side);
    });
  }
  blob(ctx, 0, -0.4, 0.17, 0.12, C.body);  // head
  blob(ctx, 0, -0.2, 0.19, 0.12, C.body);  // flat body
  // tail lying back toward the camera
  const sw = Math.sin(phase * 0.6) * 0.05;
  limb(ctx, [[0, -0.14], [sw, -0.02], [sw * 1.5, 0.08]], 0.08);
  ctx.strokeStyle = C.crest;
  ctx.lineWidth = 0.014;
  ctx.beginPath(); ctx.moveTo(0, -0.12); ctx.lineTo(sw * 1.4, 0.06); ctx.stroke();
  // legs back, soles up toward the camera
  for (const side of [-1, 1]) {
    const foot = [side * 0.17, -0.04];
    limb(ctx, [[side * 0.08, -0.15], foot], 0.1);
    blob(ctx, foot[0], foot[1], 0.05, 0.06, C.sole);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 0.016;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + (i - 1.5) * 0.35;
      ctx.beginPath();
      ctx.moveTo(foot[0] + Math.cos(a) * 0.045, foot[1] + Math.sin(a) * 0.045);
      ctx.lineTo(foot[0] + Math.cos(a) * 0.085, foot[1] + Math.sin(a) * 0.085);
      ctx.stroke();
    }
  }
  if (aegis) { // Athena's shield strapped on his back, lying flat with him, over everything
    ctx.save(); ctx.translate(0, -0.21); ctx.scale(0.15, 0.1); drawShieldFace(ctx); ctx.restore();
  }
}

// Hermes' sandals (v0.46; redrawn v0.46.1): a small white wing at the ankle, three pointed
// feathers with gold edges spreading out and up, fluttering; `alpha` blinks as it runs out.
function wing(ctx, x, y, side, alpha, phase) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x + side * 0.04, y - 0.02);
  const flap = Math.sin(phase * 3) * 0.18;
  [[0.2, -0.55], [0.17, -0.9], [0.13, -1.2]].forEach(([len, a], k) => {
    const ang = side > 0 ? a + flap : Math.PI - a - flap;
    const c = Math.cos(ang), s = Math.sin(ang), nx = -s, ny = c, wd = 0.032;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(c * len * 0.5 + nx * wd * side, s * len * 0.5 + ny * wd * side, c * len, s * len);
    ctx.quadraticCurveTo(c * len * 0.5 - nx * wd * 0.5 * side, s * len * 0.5 - ny * wd * 0.5 * side, 0, 0);
    ctx.fillStyle = k === 1 ? '#fbe6a6' : '#fffcf2';
    ctx.fill();
    ctx.strokeStyle = '#c9902a'; ctx.lineWidth = 0.008; ctx.stroke();
  });
  ctx.restore();
}

// phase: running cycle in radians; air: true while jumping or flipping; sliding: belly slide;
// blessing: 0..1, how much of the divine gold shows (the hero's inverted gravity)
// Athena's shield, face on, in a unit circle: a gold rim, a blue field with a cream ring and a
// gold boss. fog (0..1) fades it toward the haze for the far pickup.
export function drawShieldFace(ctx, fog = 0) {
  const m = (a, b) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * fog)).join(',')})`, hz = [214, 228, 234];
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fillStyle = m([226, 176, 76], hz); ctx.fill();
  ctx.lineWidth = 0.09; ctx.strokeStyle = m([150, 104, 30], hz); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 0.8, 0, Math.PI * 2); ctx.fillStyle = m([70, 108, 168], hz); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 0.56, 0, Math.PI * 2); ctx.lineWidth = 0.1; ctx.strokeStyle = m([246, 240, 226], hz); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 0.26, 0, Math.PI * 2); ctx.fillStyle = m([244, 196, 92], hz); ctx.fill();
  ctx.lineWidth = 0.06; ctx.strokeStyle = m([150, 104, 30], hz); ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.07, -0.08, 0.08, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
}

// the shield on his left arm, turned a little toward the camera
function shield(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.15);
  ctx.scale(0.13, 0.2);
  drawShieldFace(ctx);
  ctx.restore();
}

export function drawAxolotl(ctx, phase, air, sliding = false, blessing = 0, sandals = 0, aegis = false) {
  bless = Math.max(0, Math.min(1, blessing));
  if (sliding) { drawSlide(ctx, phase, aegis); if (sandals > 0) for (const side of [-1, 1]) wing(ctx, side * 0.17, -0.06, side, sandals, phase); return; }
  halo(ctx, 0, -0.76, 0.78); // behind everything else
  const s = air ? 0 : Math.sin(phase);
  const k = (s + 1) / 2;            // 1: left leg kicked back / right arm raised; 0: the mirror pose
  const bob = air ? 0 : -Math.abs(Math.cos(phase)) * 0.025;

  // contact shadow
  if (!air) {
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.ellipse(0.02, 0.01, 0.4, 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(0, bob);

  // v0.45 proportions, closer to the user's sketch: a big wide head, a plump pear-shaped body
  // with broad hips, short thick arms and legs (filled shapes, not thin strokes), a thick tail.
  const legs = [-1, 1].map(side => {
    const back = side < 0 ? k : 1 - k;  // how far this leg is kicked back
    const kick = air ? 0.4 : back;
    const hip = [side * 0.08, -0.24];
    const knee = [side * lerp(0.12, 0.14, kick), lerp(-0.15, -0.1, kick)];
    const foot = [side * lerp(0.12, 0.16, kick), lerp(-0.08, 0.04, kick)];
    return { side, kick, hip, knee, foot };
  });
  for (const L of legs.filter(l => l.kick < 0.5)) {
    limb(ctx, [L.hip, L.knee, L.foot], 0.1, C.shade);
    blob(ctx, L.foot[0], L.foot[1], 0.045, 0.035, C.shade);
  }

  // arms: short and thick, one raised beside the head with an open hand, the other low
  const arms = [-1, 1].map(side => {
    const up = aegis && side < 0 ? 0.3 : air ? 0.75 : (side < 0 ? 1 - k : k); // the shield arm stays low
    const sh = [side * 0.11, -0.56];
    const elbow = [side * 0.21, lerp(-0.46, -0.63, up)];
    const hd = [side * lerp(0.27, 0.26, up), lerp(-0.37, -0.75, up)];
    const ang = side < 0 ? lerp(Math.PI * 0.75, Math.PI * 1.2, up) : lerp(Math.PI * 0.25, -Math.PI * 0.2, up);
    return { sh, elbow, hd, ang };
  });
  for (const A of arms) { limb(ctx, [A.sh, A.elbow, A.hd], 0.08); hand(ctx, A.hd[0], A.hd[1], A.ang); }

  // tail first (it starts under the body): long and thick, past the feet toward the camera
  const sw = air ? 0 : Math.sin(phase * 0.5) * 0.06;
  const t0 = [0, -0.24], tc = [0.05 + sw, -0.02], t1 = [0.1 + sw * 1.6, 0.2];
  const tp = t => [
    (1 - t) * (1 - t) * t0[0] + 2 * (1 - t) * t * tc[0] + t * t * t1[0],
    (1 - t) * (1 - t) * t0[1] + 2 * (1 - t) * t * tc[1] + t * t * t1[1],
  ];
  const N = 12, l = [], r = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [x, y] = tp(t), [x2, y2] = tp(Math.min(1, t + 0.05));
    const nx = -(y2 - y), ny = x2 - x, nl = Math.hypot(nx, ny) || 1;
    const w = lerp(0.08, 0.02, t);
    l.push([x + nx / nl * w, y + ny / nl * w]);
    r.push([x - nx / nl * w, y - ny / nl * w]);
  }
  ctx.beginPath();
  ctx.moveTo(l[0][0], l[0][1]);
  for (const p of l) ctx.lineTo(p[0], p[1]);
  for (const p of r.reverse()) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
  ctx.fillStyle = C.body;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = LINE;
  ctx.stroke();

  // body: a plump pear, narrow at the neck and broad at the hips, with a darker spine
  ctx.beginPath();
  ctx.moveTo(-0.1, -0.62);
  ctx.bezierCurveTo(-0.15, -0.56, -0.18, -0.38, -0.15, -0.25);
  ctx.bezierCurveTo(-0.12, -0.16, 0.12, -0.16, 0.15, -0.25);
  ctx.bezierCurveTo(0.18, -0.38, 0.15, -0.56, 0.1, -0.62);
  ctx.closePath();
  ctx.fillStyle = C.body;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = LINE;
  ctx.stroke();
  ctx.strokeStyle = C.shade; // spine and the hip line, as in the sketch
  ctx.lineWidth = 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -0.58); ctx.quadraticCurveTo(0.012, -0.4, 0, -0.24); ctx.stroke();
  ctx.lineWidth = 0.014;
  ctx.beginPath(); ctx.ellipse(0, -0.27, 0.11, 0.05, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.fillStyle = C.crest; // crest down the tail, starting at the hips
  ctx.strokeStyle = C.crest;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const [x, y] = tp(0.05 + i / N * 0.9); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();

  // gills from the sides of the head: three per side, spread like a crown
  const wig = Math.sin(phase * 1.4) * 0.06;
  for (const side of [-1, 1]) {
    const base = side < 0 ? Math.PI : 0;
    const spec = [[-1.2, 0.26], [-0.65, 0.3], [-0.1, 0.26]];
    spec.forEach(([a, len], i) => {
      const ang = side < 0 ? base - a : a;
      gill(ctx, side * (0.17 + i * 0.055), -0.82 + i * 0.06, ang, len, side, wig * side);
    });
  }
  blob(ctx, 0, -0.75, 0.25, 0.17, C.body); // big wide oval head
  ctx.strokeStyle = C.shade; ctx.lineWidth = 0.014; // a soft line where the head meets the neck
  ctx.beginPath(); ctx.ellipse(0, -0.68, 0.17, 0.07, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();

  if (sandals > 0) for (const L of legs.filter(l => l.kick < 0.5)) wing(ctx, L.foot[0], L.foot[1] - 0.02, L.side, sandals, phase);
  // the kicked-back leg is nearest the camera: short and thick, the sole and toes showing
  for (const L of legs.filter(l => l.kick >= 0.5)) {
    limb(ctx, [L.hip, L.knee, L.foot], 0.11);
    blob(ctx, L.foot[0], L.foot[1], 0.058, 0.07, C.sole);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 0.02;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + (i - 1.5) * 0.35;
      ctx.beginPath();
      ctx.moveTo(L.foot[0] + Math.cos(a) * 0.06, L.foot[1] + Math.sin(a) * 0.06);
      ctx.lineTo(L.foot[0] + Math.cos(a) * 0.11, L.foot[1] + Math.sin(a) * 0.11);
      ctx.stroke();
    }
  }
  if (sandals > 0) for (const L of legs.filter(l => l.kick >= 0.5)) wing(ctx, L.foot[0], L.foot[1] - 0.03, L.side, sandals, phase);
  if (aegis) shield(ctx, arms[0].hd[0] - 0.05, arms[0].hd[1]);
  ctx.restore();
}
