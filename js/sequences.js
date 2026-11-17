// Authored stretches (v0.35), mixed in with the generated obstacles: short set pieces that ask
// for actions in a row. Pure data; sim.js lays them out (placeSequence).
//
// Times are in seconds of running, so a stretch keeps its rhythm at any speed:
// an item at `t` sits t × speed metres after the stretch starts; `len` is in metres, plus
// `lenT` seconds of running when given. Sides: 'a' is picked at random when the stretch is
// placed, 'b' is the other one; 'floor' / 'ceil' are fixed; 'any' is random for each item.
// Types: 'tall' (flip away), 'low' (jump), 'hole' (jump), 'portal' (slide on its side),
// 'void' (that surface is missing: stay off it), 'drop' (a roof block that falls, from 200 m),
// 'topple' (v0.49: a colonnade column Zeus strikes; its side 'a' / 'b' / 'any' (random, v0.49.1) is the colonnade, it lands on the
// floor across the lane; snapped onto the nearest colonnade column).
// `end`: when the stretch is over (seconds). `from`: first metre it may appear. `weight`: how often.
// tests/sequences.test.js proves every stretch can be passed at slow and top speed.

export const SEQUENCES = [
  {
    id: 'zigue-zague', from: 120, weight: 3, end: 2.0, // tall walls taking turns: flip, flip, flip
    items: [
      { t: 0, type: 'tall', side: 'a', len: 1.2 },
      { t: 0.75, type: 'tall', side: 'b', len: 1.2 },
      { t: 1.5, type: 'tall', side: 'a', len: 1.2 },
    ],
  },
  {
    id: 'muro-e-mureta', from: 120, weight: 3, end: 1.0, // flip away from a wall, then jump a low wall on the new side
    items: [
      { t: 0, type: 'tall', side: 'a', len: 1.4 },
      { t: 0.65, type: 'low', side: 'b', len: 0.8 },
    ],
  },
  {
    id: 'escadaria', from: 150, weight: 2, end: 2.0, // a long wall on one side, a rhythm of jumps on the other
    items: [
      { t: 0, type: 'tall', side: 'b', len: 0, lenT: 1.9 },
      { t: 0.55, type: 'low', side: 'a', len: 0.7 },
      { t: 1.05, type: 'hole', side: 'a', len: 2.2 },
      { t: 1.6, type: 'low', side: 'a', len: 0.7 },
    ],
  },
  {
    id: 'ponte', from: 180, weight: 2, end: 2.9, // one side is open sky, with one platform: a wall on the other side forces a visit (flip, flip back)
    items: [
      { t: 0, type: 'void', side: 'a', len: 0, lenT: 0.9 },
      { t: 1.45, type: 'tall', side: 'b', len: 0, lenT: 0.3 },
      { t: 2.2, type: 'void', side: 'a', len: 0, lenT: 0.7 },
    ],
  },
  {
    id: 'ponte-dupla', from: 400, weight: 1, end: 4.3, // the same with two platforms: two round trips
    items: [
      { t: 0, type: 'void', side: 'a', len: 0, lenT: 0.9 },
      { t: 1.45, type: 'tall', side: 'b', len: 0, lenT: 0.3 },
      { t: 2.2, type: 'void', side: 'a', len: 0, lenT: 0.65 },
      { t: 3.1, type: 'tall', side: 'b', len: 0, lenT: 0.3 },
      { t: 3.85, type: 'void', side: 'a', len: 0, lenT: 0.45 },
    ],
  },
  {
    id: 'portais', from: 250, weight: 2, end: 1.6, // a fallen portal on each side: slide, flip, slide
    items: [
      { t: 0, type: 'portal', side: 'a', len: 0.8 },
      { t: 1.1, type: 'portal', side: 'b', len: 0.8 },
    ],
  },
  {
    id: 'ira-dupla', from: 300, weight: 2, end: 1.3, // a roof block drops (flip up), then a fallen lintel on the roof (flip back down)
    items: [
      { t: 0, type: 'drop', side: 'ceil', len: 1.2 },
      { t: 0.85, type: 'tall', side: 'ceil', len: 1.4 },
    ],
  },
  {
    // Fúria de Zeus (v0.49, user's idea: "several columns Zeus strikes one after another, needing more
    // reflex, falling from both sides, never both at once"). Lintels on the roof in between, so hiding
    // up there does not get you through: down on the floor, jump the columns in rhythm.
    id: 'furia-de-zeus', from: 650, // above ground only (v0.53: the underworld ends at 600 m)
    weight: 1, end: 3.3, storm: true, // storm: the sky darkens (v0.49.1)
    items: [
      { t: 0, type: 'topple', side: 'any', len: 0.5 },
      { t: 0.45, type: 'tall', side: 'ceil', len: 1.2 },
      { t: 0.9, type: 'topple', side: 'any', len: 0.5 },
      { t: 1.8, type: 'topple', side: 'any', len: 0.5 },
      { t: 2.25, type: 'tall', side: 'ceil', len: 1.2 },
      { t: 2.7, type: 'topple', side: 'any', len: 0.5 },
    ],
  },
  // Gift stretches (v0.47.5): never picked at random. One follows a gift of the gods every time
  // the gift appears on the path, taken or not (user: "if you took it, lucky you; if not, a
  // punishment"). They start about half a second after the pickup and end well inside the
  // sandals' 6 s, and must be passable without the gift.
  {
    id: 'caminho-de-hermes', gift: 'sandals', from: 0, weight: 0, end: 3.6, // holes on both surfaces and a missing roof or floor: on the sandals you just run
    items: [
      { t: 0, type: 'hole', side: 'a', len: 1.2, lenT: 0.12 },
      { t: 0, type: 'hole', side: 'b', len: 1.2, lenT: 0.12 },
      { t: 0.7, type: 'hole', side: 'a', len: 1.2, lenT: 0.12 },
      { t: 0.7, type: 'hole', side: 'b', len: 1.2, lenT: 0.12 },
      { t: 1.4, type: 'void', side: 'a', len: 0, lenT: 0.9 },
      { t: 1.75, type: 'hole', side: 'b', len: 1.2, lenT: 0.12 },
      { t: 2.75, type: 'hole', side: 'a', len: 1.2, lenT: 0.12 },
      { t: 2.75, type: 'hole', side: 'b', len: 1.2, lenT: 0.12 },
      { t: 3.4, type: 'hole', side: 'a', len: 1.2, lenT: 0.12 },
      { t: 3.4, type: 'hole', side: 'b', len: 1.2, lenT: 0.12 },
    ],
  },
  {
    id: 'muralha-de-atena', gift: 'aegis', from: 0, weight: 0, end: 2.9, // walls and portals on both sides: the shield breaks the first one in the way
    items: [
      { t: 0, type: 'tall', side: 'a', len: 1.2 },
      { t: 0, type: 'portal', side: 'b', len: 0.8 },
      { t: 1.0, type: 'tall', side: 'b', len: 1.2 },
      { t: 1.75, type: 'tall', side: 'a', len: 1.2 },
      { t: 2.5, type: 'portal', side: 'a', len: 0.8 },
    ],
  },
];

// Zeus's wrath, the mini boss (v0.50, user design): his three attacks in a shuffled order, then the
// final fury. New item types: 'mark' (a blue ring on that surface; Zeus's bolt strikes it MARK_LEAD s
// before you get there and it then works as a tall wall: be on the other surface) and 'shock' (that
// surface is electrified for its length: standing on it costs a life; in the air is fine).
export const BOSS_PARTS = {
  'raio-marcado': { end: 3.0, items: [
    { t: 0, type: 'mark', side: 'a', len: 1.6 },
    { t: 0.9, type: 'mark', side: 'b', len: 1.6 },
    { t: 1.8, type: 'mark', side: 'a', len: 1.6 },
    { t: 2.6, type: 'mark', side: 'any', len: 1.6 },
  ] },
  'ceu-desaba': { end: 2.9, items: [
    { t: 0, type: 'drop', side: 'ceil', len: 1.2 },
    { t: 0.6, type: 'void', side: 'floor', len: 0, lenT: 0.5 },
    { t: 1.6, type: 'drop', side: 'ceil', len: 1.2 },
    { t: 2.2, type: 'void', side: 'floor', len: 0, lenT: 0.45 },
  ] },
  'corrente': { end: 3.0, items: [
    { t: 0.2, type: 'shock', side: 'a', len: 0, lenT: 2.6 },
    { t: 0.75, type: 'low', side: 'b', len: 0.7 },
    { t: 1.45, type: 'hole', side: 'b', len: 1.4, lenT: 0.1 },
    { t: 2.2, type: 'low', side: 'b', len: 0.7 },
  ] },
  'furia-final': { end: 3.1, items: [
    { t: 0, type: 'topple', side: 'any', len: 0.5 },
    { t: 0.65, type: 'mark', side: 'any', len: 1.6 },
    { t: 1.3, type: 'topple', side: 'any', len: 0.5 },
    { t: 1.95, type: 'mark', side: 'any', len: 1.6 },
    { t: 2.6, type: 'topple', side: 'any', len: 0.5 },
  ] },
};
// Demeter's attacks (work in progress): organic, growing things. `grow` only changes how an item is
// drawn and animated (wheat shooting up, vines closing in, roots splitting the ground); the rules and
// hitboxes are those of its type, so the solver proves them like any other stretch.
export const DEMETER_PARTS = {
  'trigo-brota': { end: 3.2, items: [ // rows of wheat shoot up one after another: jump, jump, then a tall sheaf to flip from
    { t: 0, type: 'low', side: 'a', len: 0.7, grow: 'wheat' },
    { t: 0.65, type: 'low', side: 'a', len: 0.7, grow: 'wheat' },
    { t: 1.35, type: 'tall', side: 'a', len: 1.2, grow: 'wheat' },
    { t: 2.05, type: 'low', side: 'b', len: 0.7, grow: 'wheat' },
    { t: 2.7, type: 'low', side: 'b', len: 0.7, grow: 'wheat' },
  ] },
  'vinhas-fecham': { end: 2.8, items: [ // vines close in from the pergola: slide under, flip, slide again
    { t: 0, type: 'portal', side: 'a', len: 0.8, grow: 'vine' },
    { t: 1.1, type: 'portal', side: 'b', len: 0.8, grow: 'vine' },
    { t: 2.1, type: 'tall', side: 'a', len: 1.0, grow: 'vine' },
  ] },
  'raizes-racham': { end: 3.2, items: [ // roots split the ground in a line: jump, jump, flip, jump, jump
    { t: 0, type: 'hole', side: 'a', len: 2.0, grow: 'root' },
    { t: 0.7, type: 'hole', side: 'a', len: 2.0, grow: 'root' },
    { t: 1.4, type: 'tall', side: 'a', len: 1.0, grow: 'wheat' },
    { t: 2.0, type: 'hole', side: 'b', len: 2.0, grow: 'root' },
    { t: 2.7, type: 'hole', side: 'b', len: 2.0, grow: 'root' },
  ] },
  'colheita-final': { end: 3.4, items: [ // the three together, faster
    { t: 0, type: 'low', side: 'a', len: 0.7, grow: 'wheat' },
    { t: 0.6, type: 'hole', side: 'a', len: 1.8, grow: 'root' },
    { t: 1.2, type: 'portal', side: 'a', len: 0.8, grow: 'vine' },
    { t: 1.9, type: 'tall', side: 'a', len: 1.0, grow: 'wheat' },
    { t: 2.5, type: 'hole', side: 'b', len: 1.8, grow: 'root' },
    { t: 3.0, type: 'low', side: 'b', len: 0.7, grow: 'wheat' },
  ] },
};
export function demeterOrder(rand = Math.random) {
  const a = ['trigo-brota', 'vinhas-fecham', 'raizes-racham'];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return [...a, 'colheita-final'];
}

// The order of one encounter: the three attacks shuffled, the final fury last.
export function bossOrder(rand = Math.random) {
  const a = ['raio-marcado', 'ceu-desaba', 'corrente'];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return [...a, 'furia-final'];
}

// The stretch that follows a gift (see above), by the gift's type.
export const giftSequence = type => SEQUENCES.find(s => s.gift === type) || null;

// How likely a stretch is instead of a generated obstacle: more of them as the run goes on.
export const sequenceChance = metres => (metres < 120 ? 0 : Math.min(0.3, 0.1 + (metres - 120) / 2000 * 0.2));

// A stretch that may appear at `metres`, weighted at random; `rand` returns 0..1.
export function pickSequence(metres, rand = Math.random) {
  const ok = SEQUENCES.filter(s => metres >= s.from && s.weight > 0);
  let r = rand() * ok.reduce((n, s) => n + s.weight, 0);
  for (const s of ok) { r -= s.weight; if (r < 0) return s; }
  return ok[ok.length - 1] || null;
}
