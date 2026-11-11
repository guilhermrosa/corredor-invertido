// Tunnel renderer: Canvas 2D with hand-rolled perspective (pseudo-3D).
// Reads the simulation state and draws it; never changes it.

import { HM, HW, PH, PL, OH, PIT, COL, clamp, lerp, mix, rgb } from './config.js';
import { drawAxolotl } from './hero.js';

const CAM_Z = -4.4, NEAR = 0.3, FAR = 75, BASE = CAM_Z + NEAR;

export function drawTunnel(ctx, S, W, H) {
  const ease = S.camT * S.camT * (3 - 2 * S.camT);
  const camY = lerp(2.3, HM - 2.3, ease);
  const roll = ease * Math.PI;
  const f = Math.min(H * 1.2, W * 1.4);
  const P = (x, y, z) => { const dz = z - CAM_Z; return [x * f / dz, -(y - camY) * f / dz]; };
  const fogK = z => Math.pow(clamp((z - 4) / (FAR - 8), 0, 1), 0.75);
  const path = pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  };
  const quad = (a, b, c, d, col) => {
    path([a, b, c, d]);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); // hides hairline seams between quads
  };

  ctx.fillStyle = rgb(COL.bg);
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H * 0.5);
  ctx.rotate(roll);

  // 1. corridor slices, far to near
  const seg = 2, off = S.dist % seg, n = Math.floor(S.dist / seg);
  const kmin = Math.floor((BASE + off) / seg), kmax = Math.ceil((FAR + off) / seg);
  for (let k = kmax; k >= kmin; k--) {
    const za = Math.max(BASE, k * seg - off), zb = (k + 1) * seg - off;
    if (zb <= za) continue;
    const fk = fogK(za), alt = ((k + n) & 1) ? 0.08 : 0;
    const fl = rgb(mix(mix(COL.floor, COL.dark, 0.5 + alt), COL.bg, fk));
    const ce = rgb(mix(mix(COL.ceil, COL.dark, 0.5 + alt), COL.bg, fk));
    const wa = rgb(mix(mix(COL.wall, COL.dark, alt * 2), COL.bg, fk));
    quad(P(-HW, 0, za), P(HW, 0, za), P(HW, 0, zb), P(-HW, 0, zb), fl);
    quad(P(-HW, HM, za), P(HW, HM, za), P(HW, HM, zb), P(-HW, HM, zb), ce);
    quad(P(-HW, 0, za), P(-HW, HM, za), P(-HW, HM, zb), P(-HW, 0, zb), wa);
    quad(P(HW, 0, za), P(HW, HM, za), P(HW, HM, zb), P(HW, 0, zb), wa);
  }

  // 2. holes and open sky (flat on the surfaces, so always behind every box)
  for (const o of S.obs) {
    if (o.type !== 'hole' || o.z > FAR) continue;
    const z0 = Math.max(o.z, BASE), z1 = o.z + o.len;
    if (z1 <= z0) continue;
    const fk = fogK(z0);
    const sy = o.side < 0 ? 0 : HM;
    const dy = o.side < 0 ? -PIT : PIT;
    const mouth = [P(-HW, sy, z0), P(HW, sy, z0), P(HW, sy, z1), P(-HW, sy, z1)];
    quad(...mouth, rgb(mix(COL.void, COL.bg, fk)));
    ctx.save();
    path(mouth);
    ctx.clip();
    if (o.open) {
      const dir = o.side < 0 ? -1 : 1;
      for (const st of o.stars) {
        const wz = o.z + st.z;
        if (wz <= BASE + 1) continue;
        const q = P(st.x, sy + dir * st.d, wz);
        const r = Math.max(0.6, st.r * f / (wz - CAM_Z) * 0.05);
        ctx.fillStyle = rgb(COL.ink, 0.75 * (1 - fogK(wz)));
        ctx.fillRect(q[0] - r, q[1] - r, r * 2, r * 2);
      }
    } else {
      const surfCol = o.side < 0 ? COL.floor : COL.ceil;
      quad(P(-HW, sy, z1), P(HW, sy, z1), P(HW, sy + dy, z1), P(-HW, sy + dy, z1), rgb(mix(mix(surfCol, COL.void, 0.72), COL.bg, fk)));
      const sideCol = rgb(mix(mix(COL.wall, COL.void, 0.45), COL.bg, fk));
      quad(P(-HW, sy, z0), P(-HW, sy + dy, z0), P(-HW, sy + dy, z1), P(-HW, sy, z1), sideCol);
      quad(P(HW, sy, z0), P(HW, sy + dy, z0), P(HW, sy + dy, z1), P(HW, sy, z1), sideCol);
    }
    ctx.restore();
    // warning lip on the near edge
    if (o.z - 0.3 > BASE) quad(P(-HW, sy, o.z - 0.3), P(HW, sy, o.z - 0.3), P(HW, sy, o.z), P(-HW, sy, o.z), rgb(mix(COL.haz, COL.bg, fk)));
  }

  // 3. boxes: blocks + player, far to near
  const items = [];
  for (const o of S.obs) {
    if (o.type !== 'block' || o.z > FAR) continue;
    const bh = o.h || OH;
    items.push({ x0: -HW, x1: HW, y0: o.side < 0 ? 0 : HM - bh, y1: o.side < 0 ? bh : HM, z0: o.z, z1: o.z + o.len, col: o.h ? COL.low : COL.haz });
  }
  items.push({ x0: -0.36, x1: 0.36, y0: S.py, y1: S.py + PH, z0: 0, z1: PL, col: COL.ink, player: true });
  items.sort((a, b) => b.z1 - a.z1);
  for (const b of items) {
    const z0 = Math.max(b.z0, BASE);
    if (b.z1 <= z0) continue;
    // blocks fade out once they pass the player, so they never cover the camera
    const alpha = b.player ? 1 : clamp(0.12 + 0.88 * (b.z0 + 1.0) / 1.2, 0.12, 1);
    ctx.globalAlpha = alpha;
    const clipFall = b.player && S.falling && S.fallHole;
    if (clipFall) { // show the falling player only through the hole's mouth
      const h = S.fallHole, sy = h.side < 0 ? 0 : HM, hz0 = Math.max(h.z, BASE);
      ctx.save();
      path([P(-HW, sy, hz0), P(HW, sy, hz0), P(HW, sy, h.z + h.len), P(-HW, sy, h.z + h.len)]);
      ctx.clip();
    }
    if (b.player) {
      // character sprite, standing on whichever surface gravity points to
      const onCeil = S.grav > 0;
      const feet = P(0, onCeil ? b.y1 : b.y0, 0.3);
      const u = P(1, 0, 0.3)[0] - P(0, 0, 0.3)[0]; // pixels per metre at the player's depth
      ctx.save();
      ctx.translate(feet[0], feet[1]);
      ctx.scale(u, onCeil ? -u : u);
      drawAxolotl(ctx, S.dist * 2.1, !S.grounded);
      ctx.restore();
      if (clipFall) ctx.restore();
      ctx.globalAlpha = 1;
      continue;
    }
    const fk = fogK(z0);
    const face = rgb(mix(b.col, COL.bg, fk));
    const lid = rgb(mix(mix(b.col, COL.ink, 0.35), COL.bg, fk));
    if (camY > b.y1) quad(P(b.x0, b.y1, z0), P(b.x1, b.y1, z0), P(b.x1, b.y1, b.z1), P(b.x0, b.y1, b.z1), lid);
    if (camY < b.y0) quad(P(b.x0, b.y0, z0), P(b.x1, b.y0, z0), P(b.x1, b.y0, b.z1), P(b.x0, b.y0, b.z1), lid);
    quad(P(b.x0, b.y0, z0), P(b.x1, b.y0, z0), P(b.x1, b.y1, z0), P(b.x0, b.y1, z0), face);
    if (alpha < 1) {
      // keep a crisp outline on faded blocks so they still read as solid objects
      ctx.globalAlpha = Math.min(1, alpha + 0.25);
      path([P(b.x0, b.y0, z0), P(b.x1, b.y0, z0), P(b.x1, b.y1, z0), P(b.x0, b.y1, z0)]);
      ctx.strokeStyle = rgb(b.col);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
