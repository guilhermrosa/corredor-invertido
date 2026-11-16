// Every authored stretch must be passable from either surface, at slow and at top speed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENCES, pickSequence, sequenceChance, giftSequence } from '../js/sequences.js';
import { placeSequence, createSim, update } from '../js/sim.js';
import { HERMES_TIME } from '../js/config.js';
import { makeRun, solve } from './solver.js';

for (const seq of SEQUENCES) {
  for (const speed of [13, 17, 21, 26]) {
    for (const a of [-1, 1]) for (const start of [-1, 1]) {
      test(`${seq.id} at ${speed} m/s (a = ${a < 0 ? 'floor' : 'roof'}, player on the ${start < 0 ? 'floor' : 'roof'})`, () => {
        const S = makeRun(speed, start);
        placeSequence(S, seq, 14, speed, a);
        assert.ok(solve(S), 'no way through');
      });
    }
  }
}

test('stretches appear only past their first metre, more often later', () => {
  assert.equal(sequenceChance(50), 0);
  assert.ok(sequenceChance(1000) > sequenceChance(200));
  for (let i = 0; i < 200; i++) assert.ok(pickSequence(130).from <= 130);
});

test('gift stretches are never picked at random', () => {
  for (let i = 0; i < 500; i++) assert.ok(!pickSequence(5000).gift);
});

test("on Hermes' sandals the caminho de Hermes needs no input at all", () => {
  for (const speed of [13, 21, 26]) for (const a of [-1, 1]) for (const start of [-1, 1]) {
    const S = makeRun(speed, start);
    placeSequence(S, giftSequence('sandals'), 8, speed, a);
    S.hermes = HERMES_TIME;
    for (let i = 0; i < 60 * 5 && !S.dead && S.sink === 0; i++) update(S, 1 / 60, () => {}, { live: true });
    assert.ok(!S.dead && S.sink === 0, `fell at ${speed} m/s (a ${a}, start ${start})`);
  }
});

test('a gift on the path is always followed by its stretch', () => {
  for (const [gift, id] of [['sandals', 'caminho-de-hermes'], ['aegis', 'muralha-de-atena']]) {
    let seen = 0;
    for (let r = 0; r < 20 && seen < 3; r++) {
      const S = createSim({ chances: { heart: 0, sandals: gift === 'sandals' ? 1 : 0, aegis: gift === 'aegis' ? 1 : 0 } });
      S.dist = 400; // past HERMES_FROM / AEGIS_FROM
      let g = null;
      for (let i = 0; i < 60 * 12 && !g; i++) { // until the gift is close (its stretch is laid by then)
        update(S, 1 / 60, () => {}, {});
        g = S.obs.find(o => o.type === gift && o.z < 40) || null;
      }
      if (!g) continue;
      seen++;
      const seq = giftSequence(gift);
      // right after the pickup: two aligned holes (sandals) or a wall and a portal side by side (shield)
      const after = S.obs.filter(o => o.z > g.z && o.z < g.z + 25);
      if (gift === 'sandals') assert.ok(after.filter(o => o.type === 'hole').length >= 2, id);
      else assert.ok(after.some(o => o.type === 'portal') && after.some(o => o.type === 'block' && !o.h), id);
      assert.ok(seq.end * 26 < HERMES_TIME * 26, 'ends inside the gift time');
    }
    assert.ok(seen > 0, `no ${gift} spawned`);
  }
});
