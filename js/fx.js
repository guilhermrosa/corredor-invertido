// Cosmetic effects that do not affect play: dust when landing and sliding, stone chips on a hit.
// Particles live in world coordinates (metres, same axes as the simulation) so the renderer
// can project them with the scene; they drift back with the run and settle toward the surface.

import { HM, PH, COL } from './config.js';

const MAX = 160;
export const fx = { particles: [], hitStop: 0, flipFade: 0, popText: '', popT: 0, bless: null, blessT: 0 };

function add(p) {
  if (fx.particles.length >= MAX) fx.particles.shift();
  fx.particles.push(p);
}

// side: -1 floor, +1 ceiling (where the particles start and settle)
function puff(n, side, z, spread, speed, col, size) {
  const y = side < 0 ? 0.02 : HM - 0.02;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI;
    add({
      x: (Math.random() - 0.5) * 0.5,
      y,
      z: z + (Math.random() - 0.5) * 0.3,
      vx: Math.cos(a) * spread * (0.5 + Math.random()),
      vy: -side * speed * (0.4 + Math.random() * 0.8),
      vz: -1 - Math.random() * 2,
      g: side,
      life: 0.45 + Math.random() * 0.35,
      age: 0,
      size: size * (0.6 + Math.random() * 0.8),
      col,
    });
  }
}

const DUST = [176, 160, 136];
export function onLand(side) { puff(12, side, 0.35, 1.6, 1.2, DUST, 0.08); }

let slideAcc = 0;
export function whileSliding(dt, side) {
  slideAcc += dt * 40;
  while (slideAcc >= 1) { slideAcc--; puff(1, side, 0.2, 0.9, 0.7, DUST, 0.07); }
}

// a column or a roof block hitting the floor
export function onThud(z) { puff(16, -1, z, 2.4, 1.6, DUST, 0.1); }

// a hit: a short freeze, then stone chips burst from the obstacle's face
export function onHit(S) {
  fx.hitStop = 0.09;
  const yMid = S.py + PH / 2;
  for (let i = 0; i < 16; i++) {
    add({
      x: (Math.random() - 0.5) * 0.9, y: yMid + (Math.random() - 0.5) * 0.6, z: 0.85,
      vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, vz: -2 - Math.random() * 3,
      g: S.grav, life: 0.6 + Math.random() * 0.4, age: 0, size: 0.05 + Math.random() * 0.06,
      col: i % 3 ? COL.ruin : COL.edge,
    });
  }
}

// Athena's shield breaks a wall: a burst of stone chips ahead of him, and a few gold sparks
export function onSmash(S) {
  fx.hitStop = 0.07;
  const yMid = S.py + PH / 2;
  for (let i = 0; i < 34; i++) {
    const gold = i % 6 === 0;
    add({
      x: (Math.random() - 0.5) * 1.6, y: yMid + (Math.random() - 0.5) * 1.2, z: 1.2 + Math.random(),
      vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 5, vz: 4 + Math.random() * 6,
      g: S.grav, life: 0.5 + Math.random() * 0.5, age: 0, size: gold ? 0.04 : 0.06 + Math.random() * 0.09,
      col: gold ? [244, 196, 92] : i % 3 ? COL.ruin : COL.wall,
    });
  }
}

// Zeus's bolt breaks a column at its foot (v0.48.3): a burst of marble chips, a puff of dust and a few
// blue-white sparks at the base of the left colonnade, at depth z. `deep`: drawn among the columns at
// its own depth (render.js), so the nearer columns pass in front of it.
export function onColumnBreak(z, hw, col = -1) {
  const x0 = col * (hw + 0.25); // the middle of a colonnade column's foot (render.js COL_X0..COL_X1)
  for (let i = 0; i < 26; i++) { // chips flying out, mostly toward the lane and up
    const big = i % 3 === 0;
    add({
      x: x0 + (Math.random() - 0.5) * 0.4, y: 0.1 + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.4,
      vx: -col * (1 + Math.random() * 4), vy: 1.5 + Math.random() * 4, vz: (Math.random() - 0.5) * 4,
      g: -1, life: 0.7 + Math.random() * 0.5, age: 0, size: big ? 0.12 + Math.random() * 0.08 : 0.05 + Math.random() * 0.06,
      col: i % 2 ? COL.column : COL.columnShade, deep: true,
    });
  }
  for (let i = 0; i < 10; i++) { // dust, slow and soft
    add({
      x: x0 + (Math.random() - 0.5) * 0.8, y: 0.05 + Math.random() * 0.3, z: z + (Math.random() - 0.5) * 0.8,
      vx: -col * (Math.random() - 0.2) * 1.5, vy: 0.4 + Math.random() * 0.8, vz: (Math.random() - 0.5) * 1.5,
      g: -0.05, life: 0.6 + Math.random() * 0.4, age: 0, size: 0.22 + Math.random() * 0.18,
      col: [214, 204, 186], deep: true,
    });
  }
  for (let i = 0; i < 8; i++) { // sparks of the bolt
    add({
      x: x0, y: 0.15 + Math.random() * 0.3, z,
      vx: -col * (Math.random() - 0.3) * 6, vy: 1 + Math.random() * 5, vz: (Math.random() - 0.5) * 5,
      g: -1, life: 0.3 + Math.random() * 0.25, age: 0, size: 0.04, col: [205, 228, 255], deep: true,
    });
  }
}

// instant camera mode: a quick light fade hides the cut
export function onInstantFlip() { fx.flipFade = 0.16; }

// Divine gold (the gods' blessing): a burst when gravity turns, and while the hero runs on
// the roof, small motes that drift off the body and settle toward the roof, showing that the
// gravity is his.
const GOLD = [244, 196, 92];
function mote(S, spread, speed, life) {
  const y = S.py + PH * (0.3 + Math.random() * 0.6);
  add({
    x: (Math.random() - 0.5) * 0.7, y, z: 0.3 + Math.random() * 0.5,
    vx: (Math.random() - 0.5) * spread, vy: (Math.random() - 0.5) * spread, vz: -0.5 - Math.random(),
    g: S.grav * 0.25, life, age: 0, size: 0.012 + Math.random() * 0.016, col: GOLD,
  });
}
export function onFlipBlessing(S) { for (let i = 0; i < 18; i++) mote(S, 3.2, 0, 0.5 + Math.random() * 0.3); }
let moteAcc = 0;
export function whileBlessed(dt, S) {
  moteAcc += dt * 9;
  while (moteAcc >= 1) { moteAcc--; mote(S, 0.6, 0, 0.7 + Math.random() * 0.4); }
}

// a short "+100 m" pop in the middle of the screen
export function onMilestone(metres) { if (fx.blessT > 0) return; fx.popText = `${metres} m`; fx.popT = 1.1; }
export function onPop(text) { fx.popText = text; fx.popT = 1.4; }
// a gift of the gods: a gold plaque with the god's name, the gift and what it does
let blessId = 0;
export function onBlessing(god, gift, text, kind = 'gift') { fx.bless = { id: ++blessId, god, gift, text, kind }; fx.blessT = 2.4; fx.popT = 0; }
// Zeus's wrath (v0.50): the same plaque in storm colours
export function onWrath(title, text) { onBlessing('Zeus', title, text, 'wrath'); }
// out of the underworld (v0.53): the plaque without a god, headed by the place
export function onSurface() { onBlessing('', 'A superfície', 'Xolo escapou do submundo', 'exit'); }

export function updateFx(dt, speed) {
  fx.flipFade = Math.max(0, fx.flipFade - dt);
  fx.popT = Math.max(0, fx.popT - dt);
  fx.blessT = Math.max(0, fx.blessT - dt);
  for (const p of fx.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += (p.vz - speed) * dt;
    p.vy += p.g * 9 * dt;            // settle toward the surface they came from
    p.vx *= 1 - 2 * dt;
    if (p.g < 0 && p.y < 0) { p.y = 0; p.vy = 0; }
    if (p.g > 0 && p.y > HM) { p.y = HM; p.vy = 0; }
  }
  fx.particles = fx.particles.filter(p => p.age < p.life && p.z > -6);
}

export function clearFx() {
  fx.particles = [];
  fx.hitStop = 0;
  fx.flipFade = 0;
  fx.popT = 0;
  fx.blessT = 0;
}
