// Rules of the simulation: the grace when slipping into a hole, lives, the golden heart, the tutorial.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, update, press } from '../js/sim.js';
import { STEPS, createTutorial, startStep } from '../js/tutorial.js';
import { SINK_TIME, SINK_DEPTH } from '../js/config.js';
import { makeRun, solve } from './solver.js';

const DT = 1 / 120;

// Runs onto a hole on the floor; `flipAfter`: seconds after slipping in to tap (null: never).
function holeRun({ speed = 12, len = 2.4, lives = 1, flipAfter = null } = {}) {
  const S = makeRun(speed);
  S.lives = S.maxLives = lives;
  S.obs.push({ type: 'hole', side: -1, z: 3, len });
  const events = [];
  let t = 0, slipAt = null, deepest = 0, flipped = false;
  const emit = type => { events.push(type); if (type === 'slip') slipAt = t; };
  for (let i = 0; i < 240; i++) {
    update(S, DT, emit, { live: true });
    t += DT;
    if (!S.dead) deepest = Math.min(deepest, S.py);
    if (flipAfter !== null && slipAt !== null && !flipped && t - slipAt >= flipAfter) { flipped = true; press(S, emit); }
  }
  return { S, events, deepest };
}

test('slipping into a hole: no input ends the run after the grace', () => {
  const { S, events, deepest } = holeRun();
  assert.deepEqual(events, ['slip', 'die']);
  assert.ok(S.dead);
  assert.ok(deepest >= -SINK_DEPTH - 1e-9, 'sank deeper than SINK_DEPTH while still alive');
});

test('slipping into a hole: a tap within the grace flips him out', () => {
  for (const speed of [12, 21]) for (const len of [1.8, 3.6]) {
    const { S, events } = holeRun({ speed, len, flipAfter: SINK_TIME - 0.03 });
    assert.ok(!S.dead, `died at ${speed} m/s on a ${len} m hole`);
    assert.equal(S.grav, 1);
    assert.deepEqual(events.slice(0, 2), ['slip', 'flip']);
  }
});

test('slipping into a hole: too late is too late', () => {
  const { S } = holeRun({ flipAfter: SINK_TIME + 0.05 });
  assert.ok(S.dead);
});

test('with a life to spare, a fall costs one and puts him back on the surface', () => {
  const { S, events } = holeRun({ lives: 2 });
  assert.deepEqual(events, ['slip', 'hurt']);
  assert.equal(S.lives, 1);
  assert.ok(!S.dead);
  assert.equal(S.py, 0);
});

test('a hit costs a life and protects; the golden heart goes first', () => {
  const S = createSim({ scripted: true, lives: 2 });
  S.gold = true; S.lives = 3;
  S.obs.push({ type: 'block', side: -1, z: 2, len: 1 });
  const events = [];
  for (let i = 0; i < 120; i++) update(S, DT, t => events.push(t), { live: true });
  assert.deepEqual(events, ['hurt']);
  assert.equal(S.lives, 2);
  assert.equal(S.gold, false);
});

test('a golden heart gives one extra life, and only one is held', () => {
  const S = createSim({ scripted: true, lives: 2 });
  S.obs.push({ type: 'heart', side: -1, z: 2, len: 0.5 }, { type: 'heart', side: -1, z: 6, len: 0.5 });
  const events = [];
  for (let i = 0; i < 240; i++) update(S, DT, t => events.push(t), { live: true });
  assert.deepEqual(events, ['heal']);
  assert.equal(S.lives, 3);
  assert.equal(S.gold, true);
});

test('every tutorial step can be passed, from the floor and from the roof', () => {
  for (let i = 0; i < STEPS.length; i++) for (const grav of [-1, 1]) {
    const T = createTutorial();
    T.step = i;
    const S = startStep(T, grav);
    assert.ok(solve(S), `step ${i + 1} (${STEPS[i].name}) from the ${grav < 0 ? 'floor' : 'roof'}`);
  }
});

test('random play never throws', () => {
  for (let r = 0; r < 50; r++) {
    const S = createSim({ lives: 3 });
    for (let i = 0; i < 60 * 60 && !S.dead; i++) {
      update(S, 1 / 60, () => {}, { live: true });
      if (Math.random() < 0.03) press(S, () => {});
    }
  }
});
