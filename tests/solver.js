// A brute-force player for the tests: tries every input (nothing, tap, swipe down) every few
// frames and keeps the distinct states, to prove a stretch of obstacles can be passed.
// Uses the real simulation, so it stays honest when physics or hitboxes change.

import { createSim, update, press, slide } from '../js/sim.js';
import { SPEED_START, SPEED_MAX, SPEED_EASE, HM, PH } from '../js/config.js';

const DT = 1 / 60;
const STEP = 3; // frames between decisions (20 decisions a second)

// The distance at which the run reaches `speed` (the sim derives speed from distance).
export const distForSpeed = speed => -SPEED_EASE * Math.log(1 - (speed - SPEED_START) / (SPEED_MAX - SPEED_START));

// A scripted sim at `speed`, with the player on `side` (-1 floor, +1 roof) and one life.
export function makeRun(speed, side = -1) {
  const S = createSim({ scripted: true, lives: 1 });
  S.dist = distForSpeed(speed);
  S.speed = speed;
  if (side > 0) { S.grav = 1; S.py = HM - PH; S.camT = 1; }
  return S;
}

const key = S => [
  S.grav, Math.round(S.py * 20), Math.round(S.vy * 4), S.mode, Math.round(S.slide * 20), S.slideQueued ? 1 : 0,
  Math.round(S.sink * 60), S.buffer > 0 ? 1 : 0,
  S.obs.reduce((n, o) => n + (o.type === 'hole' ? o.len : 0), 0).toFixed(2), // holes stretch while sinking
].join(',');

// Each obstacle is copied (the sim moves and changes them); nested data such as the stars drawn in
// open stretches is never changed by the sim, so it is shared.
const clone = S => {
  const T = { ...S, obs: S.obs.map(o => ({ ...o })) };
  if (S.fallHole) T.fallHole = T.obs[S.obs.indexOf(S.fallHole)] || S.fallHole;
  return T;
};

// Can the player get past every obstacle in S.obs alive? Returns the inputs of one way through,
// or null. Starts from the given sim (not modified). Strict by default: slipping into a hole
// counts as failing, so a stretch must be passable without the v0.33 grace (a bonus, not a need).
export function solve(S0, { maxStates = 4000, strict = true } = {}) {
  const noop = () => {};
  let slipped = false;
  const watch = type => { if (type === 'slip') slipped = true; };
  const goal = S => S.obs.every(o => o.z + o.len < -0.5);
  let layer = [{ S: clone(S0), path: [] }];
  const far = Math.max(0, ...S0.obs.map(o => o.z + o.len));
  const seconds = far / S0.speed + 1.5; // long enough to run past the last obstacle
  for (let tick = 0; tick < 60 * seconds / STEP; tick++) {
    const next = new Map();
    for (const { S, path } of layer) {
      for (const act of ['-', 'tap', 'down']) {
        const T = clone(S);
        if (act === 'tap') { if (T.grounded || T.mode === 'jump' || T.sink > 0) press(T, noop); else continue; }
        if (act === 'down') { if (T.slide > 0 && T.grounded) continue; slide(T, noop); }
        slipped = false;
        for (let f = 0; f < STEP && !T.dead; f++) update(T, DT, watch, { live: true });
        if (T.dead || (strict && slipped)) continue;
        const p = act === '-' ? path : [...path, `${(tick * STEP * DT).toFixed(2)}s ${act}`];
        if (goal(T)) return p;
        const k = key(T);
        if (!next.has(k)) next.set(k, { S: T, path: p });
      }
    }
    layer = [...next.values()].slice(0, maxStates);
    if (!layer.length) return null;
  }
  return null;
}
