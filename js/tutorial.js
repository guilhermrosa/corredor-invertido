// Tutorial for the first run: one obstacle at a time, each with a short hint.
// Obstacles are placed on whichever surface the player is on, so the lesson works
// from the floor or the ceiling. Dying only repeats the current step.

import { createSim } from './sim.js';
import { HM, PH, LOWH } from './config.js';

export const STEPS = [
  { hint: 'Toque para pular', sub: 'Pule a mureta.', ob: { type: 'block', h: LOWH, len: 0.9 } },
  { hint: 'Toque para pular', sub: 'Pule a laje quebrada.', ob: { type: 'hole', len: 2.4 } },
  { hint: 'Toque e toque de novo', sub: 'No ar, o segundo toque inverte a gravidade. Fuja do muro.', ob: { type: 'block', len: 1.2 } },
  { hint: 'Inverta de novo', sub: 'Funciona nos dois sentidos: volte para o outro lado.', ob: { type: 'block', len: 1.2 } },
  { hint: 'Arraste para baixo', sub: 'Deslize pelo vão do pórtico caído.', ob: { type: 'portal', len: 0.8 } },
];

const AHEAD = 24; // metres between the player and the step's obstacle when it appears

export function createTutorial() {
  return { step: 0, done: false };
}

function place(S, T) {
  const st = STEPS[T.step];
  S.obs.push({ ...st.ob, side: S.grav, z: AHEAD });
}

// A fresh tutorial sim for the current step, with the player on `grav`'s surface.
export function startStep(T, grav = -1) {
  const S = createSim({ scripted: true });
  if (grav > 0) { S.grav = 1; S.py = HM - PH; S.camT = 1; }
  place(S, T);
  return S;
}

// Called every frame. Returns 'next' when the step's obstacle is behind the player,
// 'done' after the last one, otherwise null.
export function progress(T, S) {
  if (S.dead || S.obs.some(o => o.z + o.len > -0.6)) return null;
  T.step++;
  if (T.step >= STEPS.length) { T.done = true; return 'done'; }
  place(S, T);
  return 'next';
}
