// Random runs must always have a way through: the generator (generated obstacles and authored
// stretches together) is sampled at several distances and every window is solved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, update } from '../js/sim.js';
import { solve } from './solver.js';

// The obstacles the generator lays out ahead of a run that has reached `metres`.
function windowAt(metres) {
  const S = createSim({ scripted: true, lives: 1 });
  S.dist = metres;
  S.scripted = false;
  update(S, 0, () => {}, {}); // spawns up to ~95 m ahead at this distance's speed
  S.scripted = true;          // then freeze: nothing new appears while solving
  S.obs = S.obs.filter(o => o.type !== 'heart');
  return S;
}

for (const metres of [100, 300, 600, 1000, 2000]) {
  test(`random windows at ${metres} m are passable`, () => {
    for (let i = 0; i < 12; i++) {
      const S = windowAt(metres);
      const layout = JSON.stringify(S.obs.map(o => ({ t: o.type, z: +o.z.toFixed(1), len: +o.len.toFixed(1), side: o.side, h: o.h, open: o.open, drop: o.drop, topple: o.topple })));
      assert.ok(solve(S), 'no way through: ' + layout);
    }
  });
}
