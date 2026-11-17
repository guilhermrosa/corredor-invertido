// Zeus's wrath, the mini boss (v0.50): every attack must be passable from either surface at slow and
// top speed, whatever sides it draws, and a whole encounter in one go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_PARTS, bossOrder } from '../js/sequences.js';
import { BOSS_FROM } from '../js/config.js';
import { placeSequence, placeBoss, update, createSim } from '../js/sim.js';
import { makeRun, solve } from './solver.js';

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

for (const [id, part] of Object.entries(BOSS_PARTS)) {
  for (const speed of [13, 17, 21, 26]) {
    for (const start of [-1, 1]) {
      test(`${id} at ${speed} m/s from the ${start < 0 ? 'floor' : 'roof'}`, () => {
        for (let trial = 0; trial < 4; trial++) { // random sides ('a' and 'any') differ per trial
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

test('the encounter shuffles its attacks and always ends with the final fury', () => {
  const orders = new Set();
  for (let i = 0; i < 60; i++) {
    const o = bossOrder();
    assert.equal(o.length, 4);
    assert.equal(o[3], 'furia-final');
    orders.add(o.join());
  }
  assert.ok(orders.size > 3, 'the order varies');
});

test('a whole encounter can be survived, and it starts and ends', () => {
  const S = makeRun(19, -1);
  S.nextZ = 14;
  const real = Math.random; Math.random = rand;
  placeBoss(S, 19, rand);
  Math.random = real;
  S.obs = S.obs.filter(o => o.type !== 'boss' && o.type !== 'storm');
  assert.ok(solve(S, { maxStates: 8000 }), 'no way through the whole encounter');
});

test('Zeus comes rarely: from BOSS_FROM on, at least 1.5 km apart, once a struck column was seen', () => {
  const S = createSim({ chances: { heart: 0, sandals: 0, aegis: 0, boss: 1 } });
  const events = [];
  S.dist = BOSS_FROM - 50; S.zeusSeen = true;
  for (let i = 0; i < 60 * 20; i++) { update(S, 1 / 60, t => events.push(t), {}); S.dead = false; }
  const bosses = S.obs.filter(o => o.type === 'boss');
  assert.ok(bosses.length >= 1);
  assert.ok(S.lastBoss >= BOSS_FROM);
});

test('no Zeus before a column struck by him has been seen (v0.53.5)', () => {
  const S = createSim({ chances: { heart: 0, sandals: 0, aegis: 0, boss: 1 } });
  S.dist = BOSS_FROM + 100;
  S.obs = S.obs.filter(o => !o.topple);
  for (let i = 0; i < 60 * 3; i++) { update(S, 1 / 60, () => {}, {}); S.dead = false; if (S.zeusSeen) break; }
  if (!S.zeusSeen) assert.ok(!S.obs.some(o => o.type === 'boss'));
});
