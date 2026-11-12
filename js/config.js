// World constants (metres / seconds) and the placeholder palette.

export const HM = 3.6;    // corridor height (raised from 3.0 in v0.29: less roof on screen, more air)
export const HW = 1.45;   // half width of the tunnel
export const PH = 0.9;    // player height
export const PL = 0.8;    // player length
export const OH = 1.55;   // tall block height (flip to dodge)
export const LOWH = 0.6;  // low block height (jump to clear)
export const PIT = 2.2;   // visual depth of holes
export const G = 42;      // gravity during a flip / fall
export const JG = 30;     // gravity while jumping (floatier)
export const JV = Math.sqrt(2 * JG * 1.05); // jump speed for a 1.05 m hop
export const AIR = 2 * JV / JG;             // airtime of a jump, seconds

// Hitboxes are a little smaller than what is drawn, so grazing an obstacle feels fair.
export const HIT = {
  z: 0.12,     // trimmed from the front and back of every block
  y: 0.08,     // trimmed from the top of tall blocks
  low: 0.14,   // trimmed from the top of low blocks (they were the least forgiving)
  player: 0.05 // trimmed from the front and back of the player
};
export const RUIN_DIP = 0.18; // the ruined wall's jagged top dips up to this far below OH

// Slide (swipe down): the player lies flat for a moment and fits under fallen portals.
export const SLIDE_TIME = 0.7;  // seconds
export const SLIDE_H = 0.45;    // player height while sliding
export const FAST_FALL = 14;    // m/s toward the surface when swiping down in the air
export const PORTAL_GAP = 0.6;  // clear height under a fallen portal
export const PORTAL_FROM = 150; // metres before portals start to appear

// Flip: the player keeps any speed it already has toward the new surface, and never
// starts slower than this (m/s), so a flip from mid-jump leaves at once.
export const FLIP_V = 7;

// Lives: a hit or fall costs one and the run goes on, briefly protected; the last one ends it.
export const LIVES = 2;
// Slipping into a hole (v0.33): the hero sinks a little before the fall counts, so a late flip
// still saves him. He never sinks below SINK_DEPTH, so he stays on screen the whole time.
export const SINK_TIME = 0.25;  // seconds of grace before the fall costs a life
export const SINK_DEPTH = 0.5;  // deepest he sinks during the grace (m; he is PH = 0.9 tall)
export const SINK_G = 0.5;      // gravity while sinking, as a share of G
export const SINK_SLOW = 1;     // share of the run's speed while he sinks (v0.34: 1, no slowdown; 0.35 felt like slow motion)
export const INVULN_TIME = 1.6; // seconds of protection after losing a life
// Golden heart (Athena's blessing): an extra life on top of the LIVES, at most one at a time.
// It can appear from HEART_FROM m while the player does not hold one; a hit takes it first.
export const HEART_FROM = 100;
export const HEART_CHANCE = 0.09; // per regular obstacle spawned (about one every 600 m)
export const HEART_LIFT = 0.55;   // height of the heart's centre above its surface

// Falling obstacles (from FALL_FROM m): a column of the left colonnade that topples across
// the path (then jump it, or flip away), and a roof block that drops to the floor (flip up).
// They start falling FALL_LEAD seconds before the player arrives: a short wobble, then the fall.
export const FALL_FROM = 200;
export const FALL_LEAD = 1.2;
export const TOPPLE_TIME = 0.6;  // seconds, wobble included
export const DROP_TIME = 0.55;
export const FALL_WOBBLE = 0.27; // share of that time spent wobbling before the fall

// Speed eases in: quick gains early, then it levels off toward SPEED_MAX (no late rush).
// speed = START + (MAX - START) * (1 - e^(-metres / SPEED_EASE)): about 13 m/s at 100 m,
// 16 at 300 m, 18.5 at 600 m, 20 at 1000 m.
export const SPEED_START = 11;
export const SPEED_MAX = 21;
export const SPEED_EASE = 450; // metres

// Placeholder world: a seaside stoa (covered colonnade) in white marble on a sunny day.
export const COL = {
  haze: [222, 236, 242],     // distance fog and the horizon
  skyTop: [86, 160, 212], sea: [52, 128, 178], seaDeep: [24, 78, 128],
  sun: [255, 246, 222], cloud: [252, 253, 255], island: [150, 170, 160],
  marble: [240, 236, 226], marble2: [230, 225, 213], joint: [196, 189, 175], stylobate: [212, 205, 190],
  ceiling: [226, 219, 203], beam: [206, 196, 176],
  column: [250, 249, 245], columnShade: [192, 186, 174],
  frieze: [44, 82, 146], friezeAlt: [238, 230, 210],
  wall: [222, 203, 165],     // low wall (mureta), jump
  ruin: [201, 168, 120],     // tall ruined wall on the floor, flip
  lintel: [214, 196, 160],   // fallen beam hanging from the roof, flip
  edge: [150, 122, 84],      // broken edge around holes
  haz: [230, 90, 70],        // hit flash
  ink: [29, 42, 51],
};
COL.bg = COL.haze;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
