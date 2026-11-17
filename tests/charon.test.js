import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, update, revive } from '../js/sim.js';

// Charon's continue (v0.52): after a death the run goes on from the same distance, lives full
test('revive brings a dead run back where it fell', () => {
  const S = createSim({ seed: 7 });
  let died = 0;
  const emit = t => { if (t === 'die') died++; };
  for (let i = 0; i < 60 * 600 && !S.dead; i++) update(S, 1 / 60, emit, { live: true });
  assert.ok(S.dead, 'a run with no input dies');
  const dist = S.dist;
  revive(S);
  assert.equal(S.dead, false);
  assert.equal(S.lives, S.maxLives);
  assert.equal(S.dist, dist);
  assert.ok(S.invuln > 0);
  for (let i = 0; i < 30; i++) update(S, 1 / 60, emit, { live: true });
  assert.equal(S.dead, false, 'protected right after coming back');
  assert.ok(S.dist > dist, 'and running on');
  assert.equal(died, 1);
});
