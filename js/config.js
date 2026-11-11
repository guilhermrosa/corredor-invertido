// World constants (metres / seconds) and the placeholder palette.

export const HM = 3.0;    // corridor height
export const HW = 1.45;   // half width of the tunnel
export const PH = 0.9;    // player height
export const PL = 0.8;    // player length
export const OH = 1.3;    // tall block height (flip to dodge)
export const LOWH = 0.5;  // low block height (jump to clear)
export const PIT = 2.2;   // visual depth of holes
export const G = 42;      // gravity during a flip / fall
export const JG = 30;     // gravity while jumping (floatier)
export const JV = Math.sqrt(2 * JG * 0.75); // jump speed for a 0.75 m hop
export const AIR = 2 * JV / JG;             // airtime of a jump, seconds

export const SPEED_START = 9;
export const SPEED_MAX = 22;
export const SPEED_RAMP = 0.02; // m/s gained per metre run

export const COL = {
  bg: [17, 20, 28], floor: [242, 165, 65], ceil: [60, 198, 192], wall: [34, 40, 56],
  haz: [255, 93, 93], low: [200, 110, 255], ink: [238, 241, 246], dark: [11, 13, 19], void: [6, 7, 10],
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
