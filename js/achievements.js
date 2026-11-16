// Achievements: a short list of goals, unlocked once and kept on the device.
// `check(run, totals)` receives the current run and the lifetime stats (stats.js).

const KEY = 'ci-achievements';

export const ACHIEVEMENTS = [
  { id: 'tutorial', name: 'Primeiros passos', desc: 'Complete o tutorial.', check: (r, t) => t.tutorial.completed > 0 },
  { id: 'm100', name: 'Aquecimento', desc: 'Chegue a 100 m numa corrida.', check: r => r.metres >= 100 },
  { id: 'm500', name: 'Maratonista', desc: 'Chegue a 500 m numa corrida.', check: r => r.metres >= 500 },
  { id: 'm1000', name: 'Mil metros', desc: 'Chegue a 1.000 m numa corrida.', check: r => r.metres >= 1000 },
  { id: 'clean300', name: 'Intocável', desc: 'Corra 300 m sem perder nenhuma vida.', check: r => r.cleanMetres >= 300 },
  { id: 'flips20', name: 'Acrobata', desc: 'Inverta a gravidade 20 vezes numa corrida.', check: r => r.flips >= 20 },
  { id: 'slides10', name: 'Escorregadio', desc: 'Deslize 10 vezes numa corrida.', check: r => r.slides >= 10 },
  // gifts of the gods (v0.47.4)
  { id: 'persephone5', name: 'Segunda chance', desc: 'Pegue 5 romãs douradas de Perséfone.', check: (r, t) => giftsOf(t).pomegranates >= 5 },
  { id: 'hermes10', name: 'Pés alados', desc: 'Atravesse 10 buracos com as sandálias de Hermes.', check: (r, t) => (t.hermesHolds || 0) >= 10 },
  { id: 'athena5', name: 'Égide', desc: 'Quebre 5 muros com o escudo de Atena.', check: (r, t) => giftsOf(t).smashes >= 5 },
  { id: 'favored', name: 'Favorito dos deuses', desc: 'Receba os três presentes (romã, sandálias e escudo) na mesma corrida.', check: r => (r.gods || 0) >= 3 },
  { id: 'zeus1', name: 'Para-raios', desc: 'Sobreviva à ira de Zeus.', check: (r, t) => (r.zeus || 0) >= 1 || ((t.zeus || {}).survived || 0) >= 1 },
  { id: 'runs25', name: 'Persistente', desc: 'Jogue 25 corridas.', check: (r, t) => t.runs >= 25 },
];

// lifetime counts of the gifts, from the stats (the golden fruit was Athena's heart until v0.47)
export function giftsOf(t) {
  const h = t.heals || {}, b = t.boosts || {};
  return {
    pomegranates: (h.persephone || 0) + (h.athena || 0),
    sandals: b.hermes || 0,
    shields: b.athena || 0,
    smashes: Object.values(t.smashes || {}).reduce((a, n) => a + n, 0),
    holds: t.hermesHolds || 0,
  };
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
let unlocked = load();

export const isUnlocked = id => !!unlocked[id];
export const count = () => ACHIEVEMENTS.filter(a => unlocked[a.id]).length;

// Returns the achievements unlocked by this check (usually none).
export function evaluate(run, totals) {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue;
    if (a.check(run, totals)) { unlocked[a.id] = new Date().toISOString(); fresh.push(a); }
  }
  if (fresh.length) { try { localStorage.setItem(KEY, JSON.stringify(unlocked)); } catch (e) { /* ignore */ } }
  return fresh;
}

export function unlockedAt(id) { return unlocked[id] || null; }
