// Balance of the gifts of the gods (v0.47.4): plays many runs with a simulated player and reports
// how often each gift appears and how much longer it makes a run. Not part of the game.
//   node tools/balance.mjs [runs]
// The player is the menu's autopilot with lapses: now and then it stops reacting for LAPSE s, a
// stand-in for human mistakes. LAPSE_RATE is calibrated so that, with only the golden pomegranate
// (as in the user's v0.39 playtest), runs average about 2.25 km with about 2.7 hits.
import { createSim, update } from '../js/sim.js';
import { HEART_CHANCE, HERMES_CHANCE, AEGIS_CHANCE } from '../js/config.js';

const RUNS = +process.argv[2] || 400;
const DT = 1 / 60, LAPSE = 0.5, MAX_M = 30000;
let LAPSE_RATE = +process.env.LAPSE || 0.045; // lapses per second (calibrated, see above)

function play(chances) {
  const S = createSim({ chances });
  const r = { m: 0, hurts: 0, spawned: { heart: 0, sandals: 0, aegis: 0 }, taken: { heart: 0, sandals: 0, aegis: 0 }, smashes: 0, held: 0, seen: new Set() };
  let lapse = 0;
  const emit = (t, d) => {
    if (t === 'hurt') r.hurts++;
    if (t === 'heal') r.taken.heart++;
    if (t === 'boost') r.taken[d.god === 'athena' ? 'aegis' : 'sandals']++;
    if (t === 'smash') r.smashes++;
    if (t === 'hermesHold') r.held++;
  };
  while (!S.dead && S.dist < MAX_M) {
    if (lapse > 0) lapse -= DT; else if (Math.random() < LAPSE_RATE * DT) lapse = LAPSE;
    update(S, DT, emit, { live: true, autopilot: lapse <= 0 });
    for (const o of S.obs) if (r.spawned[o.type] !== undefined && !r.seen.has(o)) { r.seen.add(o); r.spawned[o.type]++; }
  }
  r.m = S.dist;
  return r;
}

function scenario(name, chances) {
  const rs = Array.from({ length: RUNS }, () => play(chances));
  const km = rs.reduce((a, r) => a + r.m, 0) / 1000;
  const ms = rs.map(r => r.m).sort((a, b) => a - b);
  const sum = f => rs.reduce((a, r) => a + f(r), 0);
  const per = (n) => (n / km).toFixed(2);
  return {
    name,
    mean: (km / RUNS).toFixed(2), median: (ms[RUNS >> 1] / 1000).toFixed(2), p90: (ms[Math.floor(RUNS * 0.9)] / 1000).toFixed(2),
    hurts: (sum(r => r.hurts) / RUNS).toFixed(2),
    'romã /km (surge/pega)': `${per(sum(r => r.spawned.heart))} / ${per(sum(r => r.taken.heart))}`,
    'sandália /km': `${per(sum(r => r.spawned.sandals))} / ${per(sum(r => r.taken.sandals))}`,
    'escudo /km': `${per(sum(r => r.spawned.aegis))} / ${per(sum(r => r.taken.aegis))}`,
    'muros quebrados/run': (sum(r => r.smashes) / RUNS).toFixed(2),
    'buracos c/ sandália/run': (sum(r => r.held) / RUNS).toFixed(2),
    'presentes/run (pegos)': (sum(r => r.taken.heart + r.taken.sandals + r.taken.aegis) / RUNS).toFixed(2),
  };
}

const cur = { heart: HEART_CHANCE, sandals: HERMES_CHANCE, aegis: AEGIS_CHANCE };
const rows = process.env.ONLY === 'calib'
  ? [scenario('só romã', { ...cur, sandals: 0, aegis: 0 })]
  : [
    scenario('nenhum presente', { heart: 0, sandals: 0, aegis: 0 }),
    scenario('só romã (v0.45)', { ...cur, sandals: 0, aegis: 0 }),
    scenario('romã + sandália', { ...cur, aegis: 0 }),
    scenario('atual (os três)', cur),
    ...(process.env.EXTRA ? JSON.parse(process.env.EXTRA).map(([n, c]) => scenario(n, { ...cur, ...c })) : []),
  ];
console.log(`lapse ${LAPSE_RATE}/s, ${RUNS} runs per scenario`);
console.table(rows);
