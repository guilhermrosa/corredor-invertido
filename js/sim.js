// Game simulation: player physics, obstacle generation and collisions.
// No drawing and no audio here: the simulation reports what happened through `emit`,
// so the renderer can be swapped (e.g. for Three.js) without touching this file.
//
// Coordinates: z = distance ahead of the player (m), y = height from the floor (m).
// side: -1 floor, +1 ceiling. grav: -1 pulls to the floor, +1 to the ceiling.

import {
  HM, HW, PH, PL, OH, LOWH, PIT, G, JG, JV, AIR, HIT, RUIN_DIP,
  SLIDE_TIME, SLIDE_H, FAST_FALL, PORTAL_GAP, PORTAL_FROM, FLIP_V,
  SPEED_START, SPEED_MAX, SPEED_RAMP, clamp,
} from './config.js';

// The part of an obstacle that kills: follows its drawn shape, trimmed a little (see HIT).
// The ruined wall is drawn with a jagged top, so it only counts up to its lowest dip.
// A fallen portal is solid from just above its gap all the way to the opposite surface,
// so the only way past is to slide through the gap on its side.
export function blockHitbox(o) {
  if (o.type === 'portal') {
    const gap = PORTAL_GAP + HIT.y;
    return {
      z0: o.z + HIT.z,
      z1: Math.max(o.z + HIT.z + 0.05, o.z + o.len - HIT.z),
      y0: o.side < 0 ? gap : 0,
      y1: o.side < 0 ? HM : HM - gap,
    };
  }
  let top;
  if (o.h) top = o.h - HIT.low;
  else if (o.side < 0) top = OH - RUIN_DIP - HIT.y * 0.5;
  else top = OH - HIT.y;
  return {
    z0: o.z + HIT.z,
    z1: Math.max(o.z + HIT.z + 0.05, o.z + o.len - HIT.z),
    y0: o.side < 0 ? 0 : HM - top,
    y1: o.side < 0 ? top : HM,
  };
}

// Where standing on a hole makes you fall: the player's middle must be over it.
export function holeKillZone(o) {
  return { z0: o.z + 0.1, z1: o.z + o.len - 0.1 };
}

// The player's vertical extent: lower while sliding, hugging the surface it slides on.
export function playerBox(S) {
  const h = S.slide > 0 ? SLIDE_H : PH;
  return S.grav > 0 ? { y0: S.py + PH - h, y1: S.py + PH } : { y0: S.py, y1: S.py + h };
}

export function createSim() {
  const S = {
    dist: 0, speed: SPEED_START, py: 0, vy: 0, grav: -1, grounded: true, buffer: 0,
    obs: [], nextZ: 24, lastSide: 0, sameRun: 0,
    mode: 'ground', camT: 0, // camT: 0 = camera on the floor side, 1 = rolled to the ceiling side
    dead: false, falling: false, fallT: 0, fallHole: null,
    slide: 0, slideQueued: false, // slide: seconds left lying flat; queued: slide on landing
  };
  spawn(S);
  return S;
}

function makeOpen(z, len, side) {
  const stars = [];
  for (let i = 0, n = Math.ceil(len * 2.2); i < n; i++) {
    stars.push({ x: (Math.random() * 2 - 1) * HW * 2.6, d: 2 + Math.random() * 7, z: Math.random() * len, r: 0.6 + Math.random() * 0.9 });
  }
  return { type: 'hole', open: true, z, len, side, stars };
}

function jumpables(S, from, to, side, sp, jd, avoid = []) {
  const step = sp * (AIR + 0.3) + 1;
  for (let oz = from; oz < to; oz += step + Math.random() * sp * 0.35) {
    if (avoid.some(t => oz + 2 > t.z - step && oz < t.z + t.len + step)) continue;
    if (S.dist + oz > PORTAL_FROM && Math.random() < 0.2) {
      const pl = 0.6 + Math.random() * 0.4;
      S.obs.push({ type: 'portal', z: oz, len: pl, side });
      oz += pl;
    } else if (Math.random() < 0.55) {
      const bl = 0.6 + Math.random() * 0.7;
      S.obs.push({ type: 'block', h: LOWH, z: oz, len: bl, side });
      oz += bl;
    } else {
      const hl = clamp(jd * (0.35 + Math.random() * 0.25), 1.4, 4);
      S.obs.push({ type: 'hole', z: oz, len: hl, side });
      oz += hl;
    }
  }
}

function spawn(S) {
  while (S.nextZ < 95) {
    const sp = Math.max(S.speed, 12);
    const jd = S.speed * AIR;
    const roll = Math.random();
    const far = S.dist + S.nextZ;

    if (far > 80 && roll < 0.18) {
      // Single-surface zone: one side is open sky; stay on the other and jump what comes.
      const open = Math.random() < 0.5 ? -1 : 1;
      const z = S.nextZ, len = 26 + Math.random() * 22, end = z + len;
      const plats = Math.random() < 0.6 ? (Math.random() < 0.4 ? 2 : 1) : 0;
      let hz = z;
      for (let i = 1; i <= plats + 1; i++) {
        const stop = i <= plats ? z + len * i / (plats + 1) - 1.5 : end;
        S.obs.push(makeOpen(hz, stop - hz, open));
        hz = stop + (i <= plats ? 2.5 + Math.random() * 1.5 : 0);
      }
      jumpables(S, z + sp * 0.6 + 3, end - 3, -open, sp, jd);
      S.lastSide = 0;
      S.nextZ = end + sp * 0.55 + 1.6;
      continue;
    }

    if (far > 80 && roll < 0.4) {
      // Open stretch: one surface is mostly holes with short platforms to hop between.
      const side = Math.random() < 0.5 ? -1 : 1;
      const start = S.nextZ;
      let z = start;
      const end = z + 20 + Math.random() * 20;
      for (;;) {
        const hl = clamp(jd * (0.45 + Math.random() * 0.3), 1.6, 5);
        S.obs.push({ type: 'hole', z, len: hl, side });
        z += hl;
        if (z >= end) break;
        const long = Math.random() < 0.4;
        const pl = long ? sp + 3 : Math.max(2.4, sp * 0.3) + Math.random() * 1.5;
        // a long platform may hide a tall block on the solid side, forcing a visit to the open side
        if (long) S.obs.push({ type: 'block', z: z + pl * 0.55, len: 0.8 + Math.random() * 0.6, side: -side });
        z += pl;
      }
      const tall = S.obs.filter(o => o.side === -side && o.z >= start && o.type === 'block' && !o.h);
      jumpables(S, start + sp * 0.6 + 3, z - 3, -side, sp, jd, tall);
      S.lastSide = 0;
      S.nextZ = z + sp * 0.55 + 1.6 + Math.random() * sp * 0.5;
      continue;
    }

    // Regular obstacle. Sides alternate most of the time and never repeat more than twice,
    // so neither surface becomes a safe lane.
    let side;
    if (S.lastSide && S.sameRun >= 1) side = -S.lastSide;
    else if (S.lastSide && Math.random() < 0.7) side = -S.lastSide;
    else side = Math.random() < 0.5 ? -1 : 1;
    S.sameRun = side === S.lastSide ? S.sameRun + 1 : 0;
    S.lastSide = side;
    const r2 = Math.random();
    let ob;
    if (far > PORTAL_FROM && r2 < 0.15) ob = { type: 'portal', len: 0.6 + Math.random() * 0.4 };
    else if (r2 < 0.3) ob = { type: 'hole', len: 1.8 + Math.random() * 1.8 };
    else if (r2 < 0.5 && far > 40) ob = { type: 'block', h: LOWH, len: 0.6 + Math.random() * 0.7 };
    else ob = { type: 'block', len: Math.random() < 0.18 ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.4 };
    // a portal may need a flip and a slide in a row: give it extra room in front
    ob.z = S.nextZ + (ob.type === 'portal' ? sp * 0.3 : 0);
    ob.side = side;
    S.obs.push(ob);
    S.nextZ = ob.z + ob.len + sp * 0.55 + 1.6 + Math.random() * sp * 0.6;
  }
}

function jump(S, emit) {
  S.grounded = false; S.mode = 'jump'; S.vy = -S.grav * JV; S.buffer = 0;
  S.slide = 0; S.slideQueued = false;
  emit('jump');
}

function startSlide(S, emit) {
  S.slide = SLIDE_TIME; S.slideQueued = false;
  emit('slide');
}

// Swipe down: slide when on a surface; in the air, drop fast and slide on landing.
export function slide(S, emit) {
  if (S.dead) return;
  if (S.grounded) { if (S.slide <= 0) startSlide(S, emit); return; }
  S.mode = 'fall';
  S.vy = S.grav * Math.max(FAST_FALL, Math.abs(S.vy));
  S.slideQueued = true;
  S.buffer = 0;
}

function flip(S, emit) {
  S.grav *= -1; S.grounded = false; S.mode = 'flip'; S.buffer = 0;
  S.vy = S.grav * Math.max(FLIP_V, S.vy * S.grav); // keep momentum toward the new surface
  emit('flip', { toCeiling: S.grav > 0 });
}

// 1st tap: jump. 2nd tap while still in the air from that jump: flip gravity.
export function press(S, emit) {
  if (S.dead) return;
  if (S.grounded) jump(S, emit);
  else if (S.mode === 'jump') flip(S, emit);
  else S.buffer = 0.12; // tapped during a flip: jump as soon as we land
}

// opts.live: collisions on. opts.autopilot: attract-mode player for the menu.
export function update(S, dt, emit, opts = {}) {
  if (S.dead) {
    if (S.falling && S.fallT < 0.8) { // keep sinking into the pit
      S.fallT += dt;
      S.vy += S.grav * G * 0.5 * dt;
      S.py = clamp(S.py + S.vy * dt, -PIT, HM - PH + PIT);
    }
    return;
  }

  S.speed = Math.min(SPEED_MAX, SPEED_START + S.dist * SPEED_RAMP);
  const v = S.speed * dt;
  const before = S.dist;
  S.dist += v;
  S.nextZ -= v;
  for (const o of S.obs) o.z -= v;
  S.obs = S.obs.filter(o => o.z + o.len > -8);
  spawn(S);
  if (opts.live && Math.floor(S.dist / 100) > Math.floor(before / 100)) emit('milestone', { metres: Math.floor(S.dist / 100) * 100 });

  if (opts.autopilot && S.grounded) {
    const pt = S.obs.find(o => o.type === 'portal' && o.z + o.len > 0);
    if (pt && pt.side === S.grav && pt.z < S.speed * 0.2 + PL && S.slide <= 0) slide(S, emit);
    else if (pt && pt.side !== S.grav && pt.z < S.speed * 0.45 + PL) { jump(S, emit); flip(S, emit); slide(S, emit); }
  }
  if (opts.autopilot && S.grounded) {
    const nx = S.obs.find(o => o.z + o.len > PL / 2 && o.side === S.grav);
    if (nx && (nx.open || (nx.type === 'block' && !nx.h)) && nx.z < S.speed * 0.4 + PL) { jump(S, emit); flip(S, emit); }
    else if (nx && nx.type === 'block' && nx.h && nx.z < PL + S.speed * 0.08) jump(S, emit);
    else if (nx && nx.type === 'hole' && nx.z < PL / 2 + 0.15) jump(S, emit);
  }

  S.vy += S.grav * (S.mode === 'jump' ? JG : G) * dt;
  S.py += S.vy * dt;
  const top = HM - PH;
  if (S.grav < 0 && S.py <= 0) { S.py = 0; S.vy = 0; S.grounded = true; }
  else if (S.grav > 0 && S.py >= top) { S.py = top; S.vy = 0; S.grounded = true; }
  else S.grounded = false;
  if (S.grounded) {
    S.mode = 'ground';
    if (S.buffer > 0) jump(S, emit);
    else if (S.slideQueued) startSlide(S, emit);
  }
  if (S.buffer > 0) S.buffer -= dt;
  if (S.slide > 0) S.slide = Math.max(0, S.slide - dt);
  // the camera roll follows gravity, not the height of a jump
  S.camT += clamp((S.grav > 0 ? 1 : 0) - S.camT, -dt * 4.5, dt * 4.5); // full roll in about 0.22 s

  if (!opts.live) return;
  const mid = PL / 2;
  const pb = playerBox(S);
  for (const o of S.obs) {
    if (o.type === 'block' || o.type === 'portal') {
      const hb = blockHitbox(o);
      if (hb.z0 < PL - HIT.player && hb.z1 > HIT.player && pb.y0 < hb.y1 && pb.y1 > hb.y0) { die(S, emit, 'block'); return; }
    } else if (S.grounded && o.side === S.grav && mid > holeKillZone(o).z0 && mid < holeKillZone(o).z1) {
      S.fallHole = o; // standing on a hole: fall through
      die(S, emit, o.open ? 'void' : 'hole');
      return;
    }
  }
}

function die(S, emit, cause) {
  S.dead = true;
  S.falling = cause !== 'block';
  if (S.falling) S.vy = S.grav * 2;
  emit('die', { cause, metres: Math.floor(S.dist) });
}
