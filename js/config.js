// World constants (metres / seconds) and the placeholder palette.

export const HM = 3.6;    // corridor height (raised from 3.0 in v0.29: less roof on screen, more air)
export const HW = 1.45;   // half width of the tunnel
export const PH = 0.9;    // player height
export const PL = 0.8;    // player length
export const OH = 1.55;   // tall block height (flip to dodge)
export const LOWH = 0.6;  // low block height (jump to clear)
export const TOPPLE_H = 0.44; // a toppled column's height for collisions: lying down it is as thick as the colonnade's columns (0.3 m) once HIT.low is trimmed (v0.48.4; LOWH before)
export const PIT = 2.2;   // visual depth of holes
export const G = 42;      // gravity during a flip / fall
export const JUMP_H = 1.05; // jump height, metres
// v0.39 tried a floatier jump (JG 21, 0.63 s in the air); the user found it too floaty, so v0.39.1
// is back to the original jump.
export const JG = 30;     // gravity while jumping
export const JV = Math.sqrt(2 * JG * JUMP_H); // jump speed for that height
export const AIR = 2 * JV / JG;               // airtime of a jump, seconds (about 0.53)
// The airtime the generator sizes holes and spacing for (kept separate so the jump can be tuned
// without changing the layouts).
export const LAYOUT_AIR = 2 * Math.sqrt(2 * 30 * JUMP_H) / 30;

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
export const HEART_CHANCE = 0.06; // per regular obstacle spawned (about one every 900 m; 0.09 until v0.47.5)
export const HEART_LIFT = 0.55;   // height of the heart's centre above its surface
// Hermes' winged sandals (v0.46, the first booster): for HERMES_TIME seconds the hero runs over
// holes and missing surfaces as if they were solid. From HERMES_FROM m, about one every 800 m,
// never while active or while one is already on its way.
export const HERMES_FROM = 250;
export const HERMES_CHANCE = 0.06; // per regular obstacle spawned
export const HERMES_TIME = 6;      // seconds
// Athena's shield (v0.47): carried in his hand until it smashes the next wall he runs into
// (a ruined wall, a fallen lintel, a fallen portal or a dropped roof block), then it is gone.
// It does not help with holes, voids, low walls, drums or a toppled column. From AEGIS_FROM m,
// about one every 800 m, only while none is held or on its way.
export const AEGIS_FROM = 300;
export const AEGIS_CHANCE = 0.06;  // per regular obstacle spawned
// Zeus's wrath, the mini boss (v0.50, user design): rare and random from BOSS_FROM m, at least BOSS_GAP m
// apart; BOSS_CHANCE per regular obstacle (about two encounters every 5 km, see tools/balance.mjs).
export const BOSS_FROM = 1000;
export const BOSS_GAP = 1500;
export const BOSS_CHANCE = 0.05;
export const MARK_LEAD = 0.45;     // seconds before the hero reaches it that a marked bolt strikes
// Charon (v0.52, user design): obols, the coin the dead paid the ferryman, kept on the device. Earned
// 1 per OBOL_EVERY metres as you run, plus some for feats; a continue costs CHARON_PRICE, doubling with
// every continue in the same run (5, 10, 20, ...).
export const OBOL_EVERY = 1000; // v0.52.3: was 750 and 5 (tools/obols.mjs: Charon in 84% of runs; now about 40%)
export const CHARON_PRICE = 8;
export const AEGIS_HITS = 2;       // walls it breaks before it is gone (v0.47.8, user: "it could take 2 hits"; 1 before)

// Falling obstacles (from FALL_FROM m): a column of the left colonnade that topples across
// the path (then jump it, or flip away), and a roof block that drops to the floor (flip up).
// They start falling FALL_LEAD seconds before the player arrives: a short wobble, then the fall.
export const FALL_FROM = 200;
export const FALL_LEAD = 1.2;
export const TOPPLE_TIME = 0.6;  // seconds, wobble included
export const DROP_TIME = 0.55;
export const FALL_WOBBLE = 0.27; // share of that time spent wobbling before the fall

// Speed eases in, then keeps creeping up (v0.39, user feedback "slow at first, then it stays the
// same": in a 2 km run half the time was spent at the old 21 m/s ceiling).
// speed = START + (MAX - START) * (1 - e^(-m / EASE)) + LATE * m / 1000, never above CAP:
// 13 m/s at the start, about 15 at 100 m, 19 at 500 m, 21 at 1 km, 23 at 2 km, 24 at 3 km, 26 from about 5 km.
export const SPEED_START = 13;
export const SPEED_MAX = 21;
export const SPEED_EASE = 450;  // metres
export const SPEED_LATE = 1;    // m/s gained per km on top of the eased part
export const SPEED_CAP = 26;
export const speedAt = m => Math.min(SPEED_CAP, SPEED_START + (SPEED_MAX - SPEED_START) * (1 - Math.exp(-m / SPEED_EASE)) + SPEED_LATE * m / 1000);

// Placeholder world: a seaside stoa (covered colonnade) in white marble on a sunny day.
export const COL = {
  haze: [222, 236, 242],     // distance fog and the horizon
  skyTop: [86, 160, 212], sea: [52, 128, 178], seaDeep: [24, 78, 128],
  sun: [255, 246, 222], cloud: [252, 253, 255], island: [150, 170, 160],
  // v0.41.1: light marble again (the user found the v0.41 gold too old-looking and the brown
  // obstacles unpleasant: these ruins are not that ancient), with the painted blue back (triglyphs
  // and a band on each capital). v0.42.1: obstacles back to their original colours, no outline.
  marble: [238, 234, 224], marble2: [228, 223, 211], joint: [194, 187, 172], stylobate: [218, 210, 192],
  ceiling: [230, 224, 209], beam: [212, 203, 184],
  column: [248, 245, 237], columnShade: [204, 196, 180], columnDark: [168, 158, 140],
  frieze: [44, 82, 146], friezeAlt: [238, 231, 213], // blue triglyphs and plain metopes
  // v0.44.1: lighter and less yellow (user)
  wall: [230, 220, 199],     // low wall (mureta), jump
  ruin: [216, 200, 172],     // tall ruined wall on the floor, flip
  lintel: [228, 218, 198],   // fallen beam hanging from the roof, flip, with blue triglyphs
  // nature (v0.42): grass and weeds in the joints, vines from the roof, wild flowers, cypresses
  grass: [126, 166, 88], grassDark: [86, 128, 64], grassLight: [168, 198, 110], vine: [88, 138, 70],
  flowers: [[244, 204, 62], [238, 132, 56], [214, 74, 62], [156, 116, 204], [250, 248, 240]],
  cypress: [52, 92, 64], hills: [138, 156, 150], hillsFar: [176, 192, 196], rock: [196, 186, 168],
  shallows: [78, 184, 190],
  // rare details (v0.43): floor mosaics, black-figure vases, loose stones
  mosaic: [236, 230, 214], tessera: [52, 78, 124], tessera2: [190, 92, 60],
  clay: [200, 108, 64], clayDark: [158, 78, 44], glaze: [32, 26, 22], rubble: [214, 206, 188],
  edge: [150, 122, 84],      // broken edge around holes
  haz: [230, 90, 70],        // hit flash
  ink: [29, 42, 51],
};
COL.bg = COL.haze;

// The underworld (v0.53, user: "we flee the underworld but never run in it"): every run starts below,
// in a cave by the river of the dead, and comes up to the seaside ruins at UNDER_END metres.
export const UNDER_END = 600;
// Its palette: the same keys as COL, in the look of Charon's scene (dark rock, teal-green light,
// bioluminescent water); render.js swaps it in while the hero is below.
export const COL_UNDER = {
  ...COL,
  haze: [12, 24, 30],                          // the dark the distance fades into
  skyTop: [10, 16, 22], sea: [16, 92, 112], seaDeep: [10, 52, 70], shallows: [30, 140, 160],
  sun: [150, 240, 220], cloud: [170, 240, 236],  // glints on the river, motes
  marble: [50, 58, 64], marble2: [45, 53, 59], joint: [30, 36, 42], stylobate: [36, 42, 48],
  ceiling: [30, 38, 46], beam: [24, 30, 38],
  column: [74, 84, 90], columnShade: [48, 56, 64], columnDark: [30, 36, 44],
  frieze: [60, 150, 150], friezeAlt: [52, 60, 68],
  wall: [112, 116, 110], ruin: [100, 108, 110], lintel: [92, 102, 108],
  grass: [150, 170, 160], grassDark: [96, 116, 108], grassLight: [196, 214, 204], vine: [70, 96, 90],
  flowers: [[226, 230, 222], [206, 214, 210], [236, 240, 232]], // asphodels, pale
  rock: [60, 70, 76], rubble: [84, 92, 96],
  edge: [30, 40, 46],
  ink: [200, 236, 232],
};
COL_UNDER.bg = COL_UNDER.haze;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
