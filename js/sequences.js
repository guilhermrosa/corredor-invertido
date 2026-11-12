// Authored stretches (v0.35), mixed in with the generated obstacles: short set pieces that ask
// for actions in a row. Pure data; sim.js lays them out (placeSequence).
//
// Times are in seconds of running, so a stretch keeps its rhythm at any speed:
// an item at `t` sits t × speed metres after the stretch starts; `len` is in metres, plus
// `lenT` seconds of running when given. Sides: 'a' is picked at random when the stretch is
// placed, 'b' is the other one; 'floor' / 'ceil' are fixed.
// Types: 'tall' (flip away), 'low' (jump), 'hole' (jump), 'portal' (slide on its side),
// 'void' (that surface is missing: stay off it), 'drop' (a roof block that falls, from 200 m).
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
];

// How likely a stretch is instead of a generated obstacle: more of them as the run goes on.
export const sequenceChance = metres => (metres < 120 ? 0 : Math.min(0.3, 0.1 + (metres - 120) / 2000 * 0.2));

// A stretch that may appear at `metres`, weighted at random; `rand` returns 0..1.
export function pickSequence(metres, rand = Math.random) {
  const ok = SEQUENCES.filter(s => metres >= s.from);
  let r = rand() * ok.reduce((n, s) => n + s.weight, 0);
  for (const s of ok) { r -= s.weight; if (r < 0) return s; }
  return ok[ok.length - 1] || null;
}
