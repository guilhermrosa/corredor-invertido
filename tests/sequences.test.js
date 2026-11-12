// Every authored stretch must be passable from either surface, at slow and at top speed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENCES, pickSequence, sequenceChance } from '../js/sequences.js';
import { placeSequence } from '../js/sim.js';
import { makeRun, solve } from './solver.js';

for (const seq of SEQUENCES) {
  for (const speed of [12, 16, 21]) {
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
