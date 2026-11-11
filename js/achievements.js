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
  { id: 'runs25', name: 'Persistente', desc: 'Jogue 25 corridas.', check: (r, t) => t.runs >= 25 },
];

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
