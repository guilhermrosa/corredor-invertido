// Demeter's encounter (work in progress): every attack must be passable from either surface at slow
// and top speed, whatever sides it draws, and the whole encounter in one go; the fields come once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMETER_PARTS, demeterOrder } from '../js/sequences.js';
import { FIELDS_FROM } from '../js/config.js';
import { placeSequence, placeDemeter, update, createSim } from '../js/sim.js';
import { makeRun, solve } from './solver.js';

let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

for (const [id, part] of Object.entries(DEMETER_PARTS)) {
  for (const speed of [13, 17, 21, 26]) {
    for (const start of [-1, 1]) {
      test(`${id} at ${speed} m/s from the ${start < 0 ? 'floor' : 'roof'}`, () => {
        for (let trial = 0; trial < 4; trial++) {
          const real = Math.random;
          Math.random = rand;
          const S = makeRun(speed, start);
          placeSequence(S, part, 14, speed, rand() < 0.5 ? -1 : 1);
          Math.random = real;
          assert.ok(solve(S, { maxStates: 6000 }), `no way through (trial ${trial})`);
        }
      });
    }
  }
}

test('the attacks are shuffled, the harvest comes last', () => {
  const orders = new Set();
  for (let i = 0; i < 60; i++) { const o = demeterOrder(); assert.equal(o[3], 'colheita-final'); orders.add(o.join()); }
  assert.ok(orders.size > 3);
});

test('a whole encounter can be survived', () => {
  const S = makeRun(22, -1);
  S.nextZ = 14;
  const real = Math.random; Math.random = rand;
  placeDemeter(S, 22, rand);
  Math.random = real;
  S.obs = S.obs.filter(o => o.type !== 'demeter');
  assert.ok(solve(S, { maxStates: 9000 }), 'no way through the whole encounter');
});

test('the fields come once, past FIELDS_FROM, and Zeus stays out of them', () => {
  const S = createSim({ chances: { heart: 0, sandals: 0, aegis: 0, boss: 1 } });
  S.dist = FIELDS_FROM - 200; S.obs = []; S.nextZ = 0; S.zeusSeen = true;
  for (let i = 0; i < 60 * 40 && S.dist < FIELDS_FROM + 900; i++) { update(S, 1 / 60, () => {}, {}); S.dead = false; }
  assert.ok(S.fields && S.fields.from >= FIELDS_FROM);
  // no Zeus encounter overlaps the fields
  assert.ok(!(S.lastBoss > S.fields.from - 300 && S.lastBoss < S.fields.to + 300));
});
