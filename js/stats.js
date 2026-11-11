// Play statistics, kept only on this device (localStorage). Nothing is sent anywhere.
// Meant for balancing: what players die to, how far they get, how they play.

const KEY = 'ci-stats';

export const KIND_LABEL = {
  low: 'Mureta ou coluna caída',
  ruin: 'Muro em ruínas',
  lintel: 'Viga caída',
  portal: 'Pórtico caído',
  hole: 'Laje quebrada',
  void: 'Vazio (sem chão ou teto)',
};

export const BUCKETS = [[0, 49], [50, 99], [100, 199], [200, 399], [400, Infinity]];
export const bucketLabel = ([a, b]) => (b === Infinity ? `${a} m ou mais` : `${a}–${b} m`);

function empty() {
  return {
    version: 1,
    since: new Date().toISOString(),
    runs: 0,
    totalMetres: 0,
    totalSeconds: 0,
    best: 0,
    deaths: {},                       // kind -> count
    buckets: BUCKETS.map(() => 0),    // runs ending in each distance range
    actions: { jump: 0, flip: 0, slide: 0 },
    recent: [],                       // last runs, newest first: { at, metres, seconds, kind }
    tutorial: { completed: 0, skipped: 0, passed: {}, retries: {} }, // passed / retries by step number
  };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const d = JSON.parse(raw);
    if (!d || d.version !== 1) return empty();
    const base = empty();
    return { ...base, ...d, tutorial: { ...base.tutorial, ...d.tutorial } };
  } catch (e) {
    return empty();
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

export function get() { return data; }

export function countAction(type) {
  if (type in data.actions) { data.actions[type]++; }
}

export function recordRun({ metres, seconds, kind }) {
  data.runs++;
  data.totalMetres += metres;
  data.totalSeconds += seconds;
  data.best = Math.max(data.best, metres);
  data.deaths[kind] = (data.deaths[kind] || 0) + 1;
  const i = BUCKETS.findIndex(([a, b]) => metres >= a && metres <= b);
  if (i >= 0) data.buckets[i]++;
  data.recent.unshift({ at: new Date().toISOString(), metres, seconds: Math.round(seconds), kind });
  data.recent.length = Math.min(data.recent.length, 20);
  save();
}

export function recordTutorial(event, step) {
  if (event === 'retry') data.tutorial.retries[step] = (data.tutorial.retries[step] || 0) + 1;
  else if (event === 'passed') data.tutorial.passed[step] = (data.tutorial.passed[step] || 0) + 1;
  else if (event in data.tutorial) data.tutorial[event]++;
  save();
}

export function flush() { save(); }

export function reset() {
  data = empty();
  save();
}
