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
  pillar: 'Coluna que tombou',
  bolt: 'Raio de Zeus',
  shock: 'Corrente de Zeus',
  drop: 'Bloco que despencou do teto',
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
    deaths: {},                       // kind -> count (what ended runs)
    hurts: {},                        // kind -> count (lives lost, run went on)
    heals: { regen: 0, persephone: 0 }, // lives won back: after 400 m clean, or a golden heart (Athena's until v0.47)
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

// practice runs (v0.54.2) count for nothing: while muted nothing is saved, and unmuting drops
// whatever the practice run changed in memory
let muted = false;
export function mute(on) { if (muted && !on) data = load(); muted = on; }

function save() {
  if (muted) return;
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

export function recordHeal(from, healed) {
  if (!healed) return;
  data.heals = data.heals || { regen: 0, persephone: 0 };
  data.heals[from] = (data.heals[from] || 0) + 1;
  save();
}

// boosters taken, by god (v0.46: Hermes' sandals)
export function recordHermesHold() {
  data.hermesHolds = (data.hermesHolds || 0) + 1; // holes and voids crossed on Hermes' sandals
  save();
}

export function recordZeus(what) { // Zeus's wrath: encounters faced and survived (v0.50)
  data.zeus = data.zeus || { faced: 0, survived: 0 };
  data.zeus[what] = (data.zeus[what] || 0) + 1;
  save();
}

export function recordDemeter(what) { // Demeter's fields: crossings faced and survived
  data.demeter = data.demeter || { faced: 0, survived: 0 };
  data.demeter[what] = (data.demeter[what] || 0) + 1;
  save();
}

export function recordContinue(price) { // Charon bribed (v0.52)
  data.charon = data.charon || { continues: 0, spent: 0 };
  data.charon.continues++; data.charon.spent += price;
  save();
}

export function recordSmash(kind) {
  data.smashes = data.smashes || {}; // walls broken by Athena's shield, by kind
  data.smashes[kind] = (data.smashes[kind] || 0) + 1;
  save();
}

export function recordBoost(god) {
  data.boosts = data.boosts || {};
  data.boosts[god] = (data.boosts[god] || 0) + 1;
  save();
}

export function recordHurt(kind) {
  data.hurts[kind] = (data.hurts[kind] || 0) + 1;
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
