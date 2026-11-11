// Main character, drawn from behind. Placeholder: red axolotl with laurel-like gills.
// Drawn in metres with the origin at the feet and up = negative y; the caller scales
// to pixels and flips vertically when the hero runs on the ceiling.
// The hitbox stays the player box in sim.js; this is only the look.

const C = { body: '#e0636a', dark: '#b8324a', light: '#f29a9e', belly: '#f5b7b4' };

function ell(ctx, x, y, rx, ry, col, rot = 0) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function limb(ctx, x0, y0, x1, y1, w, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

// phase: running cycle in radians; air: true while jumping or flipping
export function drawAxolotl(ctx, phase, air) {
  const step = air ? 0 : Math.sin(phase);
  // contact shadow
  if (!air) {
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.42, 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // legs
  limb(ctx, -0.15, -0.12, -0.2, -0.01 + Math.max(0, step) * -0.06, 0.1, C.dark);
  limb(ctx, 0.15, -0.12, 0.2, -0.01 + Math.max(0, -step) * -0.06, 0.1, C.dark);
  ell(ctx, 0, -0.4, 0.25, 0.3, C.body); // body
  // arms (tucked up while airborne)
  const armY = air ? -0.62 : -0.34;
  limb(ctx, -0.22, -0.5, -0.33, armY - step * 0.05, 0.08, C.body);
  limb(ctx, 0.22, -0.5, 0.33, armY + step * 0.05, 0.08, C.body);
  ell(ctx, 0, -0.77, 0.32, 0.19, C.body); // wide head
  // gills: three laurel-like fronds per side
  const wig = Math.sin(phase * 1.3) * 0.05;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const a = (-0.9 + i * 0.45) + wig * s;
      const bx = s * 0.27, by = -0.84 + i * 0.06;
      const ex = bx + s * Math.cos(a) * 0.24, ey = by + Math.sin(a) * 0.24;
      limb(ctx, bx, by, ex, ey, 0.035, C.dark);
      for (let k = 1; k <= 3; k++) {
        const t = k / 3.4, lx = bx + (ex - bx) * t, ly = by + (ey - by) * t;
        ell(ctx, lx, ly - 0.03, 0.05, 0.022, C.dark, a - 0.6 * s);
        ell(ctx, lx, ly + 0.03, 0.05, 0.022, C.dark, a + 0.6 * s);
      }
    }
  }
  // tail fin toward the camera, swaying
  const sw = Math.sin(phase * 0.5) * 0.08;
  ell(ctx, sw * 0.5, -0.2, 0.09, 0.2, C.light);
  ell(ctx, sw, -0.12, 0.05, 0.16, C.belly);
}
