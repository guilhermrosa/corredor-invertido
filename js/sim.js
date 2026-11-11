// Game simulation: player physics, obstacle generation and collisions.
// No drawing and no audio here: the simulation reports what happened through `emit`,
// so the renderer can be swapped (e.g. for Three.js) without touching this file.
//
// Coordinates: z = distance ahead of the player (m), y = height from the floor (m).
// side: -1 floor, +1 ceiling. grav: -1 pulls to the floor, +1 to the ceiling.

import {
  HM, HW, PH, PL, OH, LOWH, PIT, G, JG, JV, AIR,
  SPEED_START, SPEED_MAX, SPEED_RAMP, clamp,
} from './config.js';

export function createSim() {
  const S = {
    dist: 0, speed: SPEED_START, py: 0, vy: 0, grav: -1, grounded: true, buffer: 0,
    obs: [], nextZ: 24, lastSide: 0, sameRun: 0,
    mode: 'ground', camT: 0, // camT: 0 = camera on the floor side, 1 = rolled to the ceiling side
    dead: false, falling: false, fallT: 0, fallHole: null,
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
    if (Math.random() < 0.55) {
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
    if (r2 < 0.3) ob = { type: 'hole', len: 1.8 + Math.random() * 1.8 };
    else if (r2 < 0.5 && far > 40) ob = { type: 'block', h: LOWH, len: 0.6 + Math.random() * 0.7 };
    else ob = { type: 'block', len: Math.random() < 0.18 ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.4 };
    ob.z = S.nextZ;
    ob.side = side;
    S.obs.push(ob);
    S.nextZ += ob.len + sp * 0.55 + 1.6 + Math.random() * sp * 0.6;
  }
}

function jump(S, emit) {
  S.grounded = false; S.mode = 'jump'; S.vy = -S.grav * JV; S.buffer = 0;
  emit('jump');
}

function flip(S, emit) {
  S.grav *= -1; S.grounded = false; S.mode = 'flip'; S.vy = S.grav * 3; S.buffer = 0;
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
  if (S.grounded) { S.mode = 'ground'; if (S.buffer > 0) jump(S, emit); }
  if (S.buffer > 0) S.buffer -= dt;
  // the camera roll follows gravity, not the height of a jump
  S.camT += clamp((S.grav > 0 ? 1 : 0) - S.camT, -dt * 3.4, dt * 3.4);

  if (!opts.live) return;
  const m = 0.08, mid = PL / 2;
  for (const o of S.obs) {
    if (o.type === 'block') {
      if (o.z < PL - m && o.z + o.len > m) {
        const bh = o.h || OH;
        const y0 = o.side < 0 ? 0 : HM - bh, y1 = o.side < 0 ? bh : HM;
        if (S.py + m < y1 && S.py + PH - m > y0) { die(S, emit, 'block'); return; }
      }
    } else if (mid > o.z + 0.1 && mid < o.z + o.len - 0.1 && S.grounded && o.side === S.grav) {
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
