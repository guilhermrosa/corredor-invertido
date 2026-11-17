import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, update } from '../js/sim.js';
import { UNDER_END } from '../js/config.js';

// The underworld (v0.53): every run starts below; no gifts of the gods and no toppling columns
// (Zeus's wrath) there, and the sim says once when the hero comes up to the surface
test('below: no gifts, toppling columns, portals or missing floor; one surface event', () => {
  let reached = 0;
  for (let run = 0; run < 6; run++) {
    const S = createSim({ chances: { heart: 1, sandals: 1, aegis: 1, boss: 0 } });
    const seen = new Set();
    let surface = 0, giftsAbove = 0;
    const emit = t => { if (t === 'surface') surface++; };
    for (let i = 0; i < 60 * 120 && S.dist < UNDER_END + 400; i++) {
      update(S, 1 / 60, emit, { live: true, autopilot: true });
      if (S.dead) break;
      for (const o of S.obs) {
        if (seen.has(o)) continue;
        seen.add(o);
        const at = S.dist + o.z;
        if (['heart', 'sandals', 'aegis'].includes(o.type)) { assert.ok(at >= UNDER_END, `${o.type} at ${at.toFixed(0)} m`); giftsAbove++; }
        if (o.topple) assert.ok(at >= UNDER_END, `toppling column at ${at.toFixed(0)} m`);
        if (o.type === 'portal') assert.ok(at >= UNDER_END, `portal at ${at.toFixed(0)} m`);
        if (o.open && o.side < 0) assert.ok(at >= UNDER_END - 1, `missing floor at ${at.toFixed(0)} m`);
      }
    }
    if (S.dist >= UNDER_END) { reached++; assert.equal(surface, 1); }
    else assert.equal(surface, 0);
  }
  assert.ok(reached > 0, 'some run came up to the surface');
});
