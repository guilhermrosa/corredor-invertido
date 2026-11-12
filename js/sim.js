// Game simulation: player physics, obstacle generation and collisions.
// No drawing and no audio here: the simulation reports what happened through `emit`,
// so the renderer can be swapped (e.g. for Three.js) without touching this file.
//
// Coordinates: z = distance ahead of the player (m), y = height from the floor (m).
// side: -1 floor, +1 ceiling. grav: -1 pulls to the floor, +1 to the ceiling.

import {
  HM, HW, PH, PL, OH, LOWH, PIT, G, JG, JV, AIR, HIT, RUIN_DIP,
  SLIDE_TIME, SLIDE_H, FAST_FALL, PORTAL_GAP, PORTAL_FROM, FLIP_V, LIVES, INVULN_TIME,
  SINK_TIME, SINK_DEPTH, SINK_G, SINK_SLOW,
  FALL_FROM, FALL_LEAD, TOPPLE_TIME, DROP_TIME, FALL_WOBBLE,
  HEART_FROM, HEART_CHANCE, HEART_LIFT,
  SPEED_START, SPEED_MAX, SPEED_EASE, clamp,
} from './config.js';

// The part of an obstacle that kills: follows its drawn shape, trimmed a little (see HIT).
// The ruined wall is drawn with a jagged top, so it only counts up to its lowest dip.
// A fallen portal is solid from just above its gap all the way to the opposite surface,
// so the only way past is to slide through the gap on its side.
// How far a falling obstacle has fallen: 0 before (and during the wobble), 1 once down.
// Eased in, like something pulled by gravity.
export function fallAmount(o) {
  if (!o.p) return 0;
  const f = Math.max(0, Math.min(1, (o.p - FALL_WOBBLE) / (1 - FALL_WOBBLE)));
  return f * f;
}

export function blockHitbox(o) {
  // a toppling column only counts once it is nearly down across the path
  if (o.topple && fallAmount(o) < 0.75) return null;
  // a dropping roof block counts all the way down (it is solid while it falls)
  if (o.drop && !o.landed) {
    const top = OH - HIT.y, d = fallAmount(o) * (HM - top);
    return { z0: o.z + HIT.z, z1: Math.max(o.z + HIT.z + 0.05, o.z + o.len - HIT.z), y0: HM - top - d, y1: HM - d };
  }
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
  else if (o.drop) top = OH - HIT.y; // a dropped beam keeps its straight edge
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

// What an obstacle is, in words the stats screen can show (see stats.js).
export function obstacleKind(o) {
  if (o.topple) return 'pillar';
  if (o.drop) return 'drop';
  if (o.type === 'portal') return 'portal';
  if (o.type === 'hole') return o.open ? 'void' : 'hole';
  if (o.h) return 'low';
  return o.side < 0 ? 'ruin' : 'lintel';
}

// opts.scripted: no random obstacles; the caller places them (used by the tutorial)
// opts.lives: how many hits or falls the run survives (scripted runs default to one)
export function createSim(opts = {}) {
  const S = {
    scripted: !!opts.scripted,
    lives: opts.lives ?? (opts.scripted ? 1 : LIVES),
    maxLives: opts.lives ?? (opts.scripted ? 1 : LIVES), // the ordinary lives (red hearts)
    gold: false, // holding a golden heart: one extra life, taken first by a hit
    invuln: 0, // seconds of protection left after losing a life
    dist: 0, speed: SPEED_START, py: 0, vy: 0, grav: -1, grounded: true, buffer: 0,
    obs: [], nextZ: 24, lastSide: 0, sameRun: 0,
    mode: 'ground', camT: 0, // camT: 0 = camera on the floor side, 1 = rolled to the ceiling side
    dead: false, falling: false, fallT: 0, fallHole: null,
    sink: 0, // seconds of grace left while slipping into a hole (see SINK_TIME)
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
  if (S.scripted) return;
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
    if (far > FALL_FROM && r2 > 0.92) ob = { type: 'block', h: LOWH, topple: true, len: 0.5, fixedSide: -1 };
    else if (far > FALL_FROM && r2 > 0.84) ob = { type: 'block', drop: true, len: 0.9 + Math.random() * 0.6, fixedSide: 1 };
    else if (far > PORTAL_FROM && r2 < 0.15) ob = { type: 'portal', len: 0.6 + Math.random() * 0.4 };
    else if (r2 < 0.3) ob = { type: 'hole', len: 1.8 + Math.random() * 1.8 };
    else if (r2 < 0.5 && far > 40) ob = { type: 'block', h: LOWH, len: 0.6 + Math.random() * 0.7 };
    else ob = { type: 'block', len: Math.random() < 0.18 ? 3 + Math.random() * 3 : 0.8 + Math.random() * 1.4 };
    // a portal may need a flip and a slide in a row: give it extra room in front
    ob.z = S.nextZ + (ob.type === 'portal' ? sp * 0.3 : 0);
    ob.side = ob.fixedSide || side;
    if (ob.fixedSide) { S.lastSide = ob.side; S.sameRun = 0; }
    S.obs.push(ob);
    S.nextZ = ob.z + ob.len + sp * 0.55 + 1.6 + Math.random() * sp * 0.6;
    // a golden heart (Athena's blessing) in the free stretch after it, unless one is held or on its way
    if (far > HEART_FROM && !S.scripted && !S.gold && !S.obs.some(o => o.type === 'heart') && Math.random() < HEART_CHANCE) {
      S.obs.push({ type: 'heart', z: (ob.z + ob.len + S.nextZ) / 2 - 0.25, len: 0.5, side: Math.random() < 0.5 ? -1 : 1 });
    }
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
  S.sink = 0; // flipping out of a hole saves him
  S.vy = S.grav * Math.max(FLIP_V, S.vy * S.grav); // keep momentum toward the new surface
  emit('flip', { toCeiling: S.grav > 0 });
}

// 1st tap: jump. 2nd tap while still in the air from that jump: flip gravity.
// Returns what the press did: 'jump', 'flip' or 'buffer' (nothing when the run is over).
export function press(S, emit) {
  if (S.dead) return null;
  if (S.grounded) { jump(S, emit); return 'jump'; }
  if (S.mode === 'jump' || S.sink > 0) { flip(S, emit); return 'flip'; }
  S.buffer = 0.12; // tapped during a flip: jump as soon as we land
  return 'buffer';
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

  S.speed = SPEED_START + (SPEED_MAX - SPEED_START) * (1 - Math.exp(-S.dist / SPEED_EASE));
  const v = S.speed * (S.sink > 0 ? SINK_SLOW : 1) * dt;
  const before = S.dist;
  S.dist += v;
  S.nextZ -= v;
  for (const o of S.obs) o.z -= v;
  S.obs = S.obs.filter(o => o.z + o.len > -8);
  spawn(S);

  // falling obstacles: start when the player gets close, wobble, fall, land
  for (const o of S.obs) {
    if (!(o.topple || o.drop) || o.landed) continue;
    if (!o.p && o.z < S.speed * FALL_LEAD + 3) { o.p = 1e-6; emit('crack', { kind: obstacleKind(o) }); }
    if (o.p) {
      o.p = Math.min(1, o.p + dt / (o.topple ? TOPPLE_TIME : DROP_TIME));
      if (o.p >= 1) {
        o.landed = true;
        if (o.drop) o.side = -1; // now it sits on the floor
        emit('thud', { z: o.z + o.len / 2, kind: obstacleKind(o) });
      }
    }
  }
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

  const wasGrounded = S.grounded;
  const top = HM - PH;
  if (S.sink > 0) {
    // slipping into a hole: sink slowly, never deeper than SINK_DEPTH (he stays on screen)
    S.vy += S.grav * G * SINK_G * dt;
    S.py += S.vy * dt;
    const deep = S.grav < 0 ? -S.py : S.py - top;
    if (deep >= SINK_DEPTH) { S.py = S.grav < 0 ? -SINK_DEPTH : top + SINK_DEPTH; S.vy = 0; }
    S.grounded = false;
  } else {
    S.vy += S.grav * (S.mode === 'jump' ? JG : G) * dt;
    S.py += S.vy * dt;
    if (S.grav < 0 && S.py <= 0) { S.py = 0; S.vy = 0; S.grounded = true; }
    else if (S.grav > 0 && S.py >= top) { S.py = top; S.vy = 0; S.grounded = true; }
    else S.grounded = false;
    if (S.grounded) {
      if (S.buffer > 0) jump(S, emit); // a buffered tap still jumps the hole
      else {
        const h = opts.live && S.invuln <= 0 && holeUnder(S);
        if (h) { startSink(S, h); emit('slip', { side: S.grav }); }
      }
    }
    if (S.grounded && !wasGrounded) emit('land', { side: S.grav });
    if (S.grounded) {
      S.mode = 'ground';
      if (S.slideQueued) startSlide(S, emit);
    }
  }
  if (S.buffer > 0) S.buffer -= dt;
  if (S.slide > 0) S.slide = Math.max(0, S.slide - dt);
  // the camera roll follows gravity, not the height of a jump
  S.camT += clamp((S.grav > 0 ? 1 : 0) - S.camT, -dt * 4.5, dt * 4.5); // full roll in about 0.22 s

  if (S.invuln > 0) S.invuln = Math.max(0, S.invuln - dt);
  if (!opts.live) return;
  const mid = PL / 2;
  const pb = playerBox(S);
  // golden hearts are taken by touching them, protected or not
  for (const o of S.obs) {
    if (o.type !== 'heart' || o.taken) continue;
    const cy = o.side < 0 ? HEART_LIFT : HM - HEART_LIFT;
    if (o.z < PL && o.z + o.len > 0 && pb.y0 < cy + 0.25 && pb.y1 > cy - 0.25) {
      o.taken = true;
      if (!S.gold) {
        S.gold = true;
        S.lives++;
        emit('heal', { lives: S.lives, from: 'athena' });
      }
    }
  }
  if (S.sink > 0) {
    // the grace runs out: the fall counts (always the full SINK_TIME, even if the hole
    // scrolls past him meanwhile, so short holes at top speed stay fair)
    const h = S.fallHole;
    h.len = Math.max(h.len, PL + 0.4 - h.z); // the slab ahead keeps crumbling, so he never sinks into solid floor
    S.sink -= dt;
    if (S.sink <= 0) { S.sink = 0; hit(S, emit, h.open ? 'void' : 'hole', h); return; }
  }
  if (S.invuln > 0) return;
  for (const o of S.obs) {
    if (o.spent) continue;
    if (o.type === 'block' || o.type === 'portal') {
      const hb = blockHitbox(o);
      if (hb && hb.z0 < PL - HIT.player && hb.z1 > HIT.player && pb.y0 < hb.y1 && pb.y1 > hb.y0) { hit(S, emit, 'block', o); return; }
    }
  }
}

// The hole under a grounded player's middle, on the surface he runs on, if any.
function holeUnder(S) {
  const mid = PL / 2;
  return S.obs.find(o => o.type === 'hole' && o.side === S.grav && mid > holeKillZone(o).z0 && mid < holeKillZone(o).z1);
}

// Standing over a hole: he slips in and sinks for SINK_TIME before the fall counts.
function startSink(S, h) {
  S.grounded = false; S.mode = 'sink'; S.sink = SINK_TIME; S.fallHole = h;
  S.vy = S.grav * 1; S.slide = 0; S.slideQueued = false; S.buffer = 0;
}

// A hit or a fall: costs a life and the run goes on, or ends it on the last life.
function hit(S, emit, cause, o) {
  if (S.lives <= 1) {
    if (cause !== 'block') S.fallHole = o; // standing on a hole: fall through
    die(S, emit, cause, o);
    return;
  }
  S.lives--;
  S.gold = false; // the golden heart goes first
  S.invuln = INVULN_TIME;
  if (cause === 'block') {
    o.spent = true; // the obstacle that hit you no longer counts
  } else {
    // rescued from a fall: the broken stretch under the player is filled in, and anything
    // right in front is cleared so the run can pick up again
    S.obs = S.obs.filter(x => !(x.z < 14 && x.z + x.len > -1));
    S.slide = 0; S.slideQueued = false;
  }
  if (cause !== 'block' || S.sink > 0) { // back up on the surface he slipped from
    S.sink = 0; S.py = S.grav < 0 ? 0 : HM - PH; S.vy = 0; S.grounded = true; S.mode = 'ground';
  }
  emit('hurt', { cause, kind: obstacleKind(o), lives: S.lives });
}

function die(S, emit, cause, o) {
  S.dead = true;
  S.falling = cause !== 'block';
  if (S.falling) S.vy = S.grav * 2;
  emit('die', { cause, kind: obstacleKind(o), metres: Math.floor(S.dist) });
}
