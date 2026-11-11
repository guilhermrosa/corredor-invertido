// Main character, drawn from behind, following the user's silhouette sketch:
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
  ctx.fillStyle = C.gill;
  ctx.fill();
  // fringe filaments on both sides of the outer two thirds
  ctx.strokeStyle = C.fringe;
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
function drawSlide(ctx, phase) {
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0.0, 0.46, 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  const wig = Math.sin(phase * 2.2) * 0.05;
  // arms stretched forward
  for (const side of [-1, 1]) {
    limb(ctx, [[side * 0.14, -0.26], [side * 0.2, -0.4], [side * 0.23, -0.52]], 0.07);
    hand(ctx, side * 0.23, -0.53, -Math.PI / 2 + side * 0.25);
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
  blob(ctx, 0, -0.2, 0.2, 0.12, C.body);   // flat body
  // tail lying back toward the camera
  const sw = Math.sin(phase * 0.6) * 0.05;
  limb(ctx, [[0, -0.14], [sw, -0.02], [sw * 1.5, 0.08]], 0.06);
  ctx.strokeStyle = C.crest;
  ctx.lineWidth = 0.014;
  ctx.beginPath(); ctx.moveTo(0, -0.12); ctx.lineTo(sw * 1.4, 0.06); ctx.stroke();
  // legs back, soles up toward the camera
  for (const side of [-1, 1]) {
    const foot = [side * 0.2, 0.0];
    limb(ctx, [[side * 0.08, -0.14], foot], 0.09);
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
}

// phase: running cycle in radians; air: true while jumping or flipping; sliding: belly slide
export function drawAxolotl(ctx, phase, air, sliding = false) {
  if (sliding) { drawSlide(ctx, phase); return; }
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

  // legs: the kicked-back leg reaches toward the camera (lower on screen, sole visible),
  // the forward leg is short and tucked behind the body
  const legs = [-1, 1].map(side => {
    const back = side < 0 ? k : 1 - k;  // how far this leg is kicked back
    const kick = air ? 0.4 : back;
    const hip = [side * 0.09, -0.32];
    const knee = [side * lerp(0.13, 0.15, kick), lerp(-0.2, -0.12, kick)];
    const foot = [side * lerp(0.12, 0.17, kick), lerp(-0.13, 0.06, kick)];
    return { side, kick, hip, knee, foot };
  });
  for (const L of legs.filter(l => l.kick < 0.5)) limb(ctx, [L.hip, L.knee, L.foot], 0.1, C.shade);

  // arms: one raised with an open hand, the other low and out to the side
  const arms = [-1, 1].map(side => {
    const up = air ? 0.75 : (side < 0 ? 1 - k : k);
    const sh = [side * 0.14, -0.62];
    const elbow = [side * lerp(0.27, 0.27, up), lerp(-0.5, -0.74, up)];
    const hd = [side * lerp(0.36, 0.34, up), lerp(-0.36, -0.92, up)];
    const ang = side < 0 ? lerp(Math.PI * 0.75, Math.PI * 1.2, up) : lerp(Math.PI * 0.25, -Math.PI * 0.2, up);
    return { sh, elbow, hd, ang };
  });
  for (const A of arms) { limb(ctx, [A.sh, A.elbow, A.hd], 0.075); hand(ctx, A.hd[0], A.hd[1], A.ang); }

  // body: slim torso over a rounded hip
  blob(ctx, 0, -0.33, 0.15, 0.1, C.body);
  ctx.beginPath();
  ctx.moveTo(-0.13, -0.33);
  ctx.quadraticCurveTo(-0.18, -0.55, -0.13, -0.68);
  ctx.lineTo(0.13, -0.68);
  ctx.quadraticCurveTo(0.18, -0.55, 0.13, -0.33);
  ctx.closePath();
  ctx.fillStyle = C.body;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = LINE;
  ctx.stroke();

  // gills behind the head: three per side, the top ones almost upright
  const wig = Math.sin(phase * 1.4) * 0.06;
  for (const side of [-1, 1]) {
    const base = side < 0 ? Math.PI : 0;
    const spec = [[-1.15, 0.27], [-0.62, 0.3], [-0.12, 0.25]];
    spec.forEach(([a, len], i) => {
      const ang = side < 0 ? base - a : a;
      gill(ctx, side * (0.16 + i * 0.05), -0.86 + i * 0.05, ang, len, side, wig * side);
    });
  }
  blob(ctx, 0, -0.8, 0.22, 0.17, C.body); // big oval head

  // tail: long and thick, tapering toward the camera past the feet, with a crest
  const sw = air ? 0 : Math.sin(phase * 0.5) * 0.06;
  const t0 = [0, -0.3], tc = [0.06 + sw, -0.05], t1 = [0.13 + sw * 1.6, 0.17];
  const tp = t => [
    (1 - t) * (1 - t) * t0[0] + 2 * (1 - t) * t * tc[0] + t * t * t1[0],
    (1 - t) * (1 - t) * t0[1] + 2 * (1 - t) * t * tc[1] + t * t * t1[1],
  ];
  const N = 12, l = [], r = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, [x, y] = tp(t), [x2, y2] = tp(Math.min(1, t + 0.05));
    const nx = -(y2 - y), ny = x2 - x, nl = Math.hypot(nx, ny) || 1;
    const w = lerp(0.075, 0.018, t);
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
  ctx.strokeStyle = C.crest; // crest along the middle, with segment ticks
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const [x, y] = tp(i / N * 0.95); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();

  // the kicked-back leg is nearest the camera: draw it last, sole and toes showing
  for (const L of legs.filter(l => l.kick >= 0.5)) {
    limb(ctx, [L.hip, L.knee, L.foot], 0.11);
    blob(ctx, L.foot[0], L.foot[1], 0.055, 0.07, C.sole);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 0.018;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 2 + (i - 1.5) * 0.35;
      ctx.beginPath();
      ctx.moveTo(L.foot[0] + Math.cos(a) * 0.05, L.foot[1] + Math.sin(a) * 0.05);
      ctx.lineTo(L.foot[0] + Math.cos(a) * 0.1, L.foot[1] + Math.sin(a) * 0.1);
      ctx.stroke();
    }
  }
  ctx.restore();
}
