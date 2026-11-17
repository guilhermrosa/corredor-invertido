// Economy of Charon's obols (v0.52.3): simulated players play a series of runs, earning obols as the
// game does and paying Charon whenever they can afford it. Not part of the game.
//   node tools/obols.mjs [players] [runs]
// The player is the balance tool's bot (autopilot with lapses, LAPSE 0.045/s). Earnings: 1 per
// `every` metres, +2 for surviving Zeus, +3 for a new record, +1 per achievement (only the ones a
// run can reach are modelled: 100/500/1000 m, Zeus, both Charon ones, 25 runs).
import { createSim, update, revive } from '../js/sim.js';

const PLAYERS = +process.argv[2] || 60, RUNS = +process.argv[3] || 30;
const DT = 1 / 60, LAPSE = 0.5, LAPSE_RATE = 0.045, MAX_M = 40000;

function series(every, priceOf, zeus = 2) {
  let wallet = 0, best = 0, runs = 0;
  const got = new Set();
  const ach = id => { if (!got.has(id)) { got.add(id); wallet++; } };
  const out = [];
  for (let n = 0; n < RUNS; n++) {
    const S = createSim();
    let lapse = 0, marks = 0, continues = 0, earned = 0, deaths = 0, affordable = 0, firstDeath = 0;
    const emit = t => { if (t === 'bossEnd') { wallet += zeus; earned += zeus; ach('zeus'); } };
    for (;;) {
      if (lapse > 0) lapse -= DT; else if (Math.random() < LAPSE_RATE * DT) lapse = LAPSE;
      update(S, DT, emit, { live: true, autopilot: lapse <= 0 });
      const m = Math.floor(S.dist / every);
      if (m > marks) { wallet += m - marks; earned += m - marks; marks = m; }
      for (const [d, id] of [[100, 'm100'], [500, 'm500'], [1000, 'm1000']]) if (S.dist >= d && !got.has(id)) { ach(id); earned++; }
      if (S.dead) {
        deaths++;
        if (!continues) firstDeath = S.dist;
        const p = priceOf(continues);
        if (wallet >= p) {
          affordable++;
          wallet -= p; continues++;
          if (continues === 1) { ach('c1'); earned++; }
          if (continues === 2) { ach('c2'); earned++; }
          revive(S);
          continue;
        }
        break;
      }
      if (S.dist >= MAX_M) break;
    }
    runs++;
    if (runs === 25) ach('runs25');
    if (S.dist > best) { best = S.dist; wallet += 3; earned += 3; }
    out.push({ m: S.dist, firstDeath, continues, earned });
  }
  return out;
}

function scheme(name, every, priceOf, zeus) {
  const all = Array.from({ length: PLAYERS }, () => series(every, priceOf, zeus));
  const avg = (f, from = 0, to = RUNS) => {
    let s = 0, c = 0;
    for (const p of all) for (let i = from; i < to; i++) { s += f(p[i]); c++; }
    return s / c;
  };
  const firstPaid = all.map(p => p.findIndex(r => r.continues > 0)).map(i => (i < 0 ? RUNS : i + 1)).sort((a, b) => a - b);
  return {
    name,
    'obols/run': avg(r => r.earned, 10).toFixed(1),
    '1st bribe (median run)': firstPaid[PLAYERS >> 1],
    'bribes/run (runs 1-10)': avg(r => r.continues, 0, 10).toFixed(2),
    'bribes/run (runs 11+)': avg(r => r.continues, 10).toFixed(2),
    'runs w/ bribe 11+': (avg(r => (r.continues ? 1 : 0), 10) * 100).toFixed(0) + '%',
    'km w/o (11+)': (avg(r => r.firstDeath, 10) / 1000).toFixed(2),
    'km with (11+)': (avg(r => r.m, 10) / 1000).toFixed(2),
  };
}

const ALL = [
  ['atual: 750 m, 5·2^n', 750, k => 5 * 2 ** k],
  ['500 m, 5·2^n', 500, k => 5 * 2 ** k],
  ['750 m, 5/8/12/18 (×1.5)', 750, k => Math.round(5 * 1.5 ** k)],
  ['750 m, 5 +5 (5/10/15)', 750, k => 5 + 5 * k],
  ['1000 m, 5·2^n', 1000, k => 5 * 2 ** k],
  ['750 m, 5·3^n (5/15/45)', 750, k => 5 * 3 ** k],
  ['750 m, 10·2^n', 750, k => 10 * 2 ** k],
  ['1000 m, 8·2^n, Zeus +1', 1000, k => 8 * 2 ** k, 1],
  ['1000 m, 10·2^n, Zeus +1', 1000, k => 10 * 2 ** k, 1],
];
const pick = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : ALL.map((_, i) => i);
const rows = pick.map(i => scheme(...ALL[i]));
console.log(`${PLAYERS} players × ${RUNS} runs each`);
console.table(rows);
