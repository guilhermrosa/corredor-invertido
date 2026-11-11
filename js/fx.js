// Cosmetic effects that do not affect play: dust when landing and sliding, stone chips on a hit.
// Particles live in world coordinates (metres, same axes as the simulation) so the renderer
// can project them with the scene; they drift back with the run and settle toward the surface.

import { HM, PH, COL } from './config.js';

const MAX = 160;
export const fx = { particles: [], hitStop: 0, flipFade: 0, popText: '', popT: 0 };

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

// instant camera mode: a quick light fade hides the cut
export function onInstantFlip() { fx.flipFade = 0.16; }

// a short "+100 m" pop in the middle of the screen
export function onMilestone(metres) { fx.popText = `${metres} m`; fx.popT = 1.1; }

export function updateFx(dt, speed) {
  fx.flipFade = Math.max(0, fx.flipFade - dt);
  fx.popT = Math.max(0, fx.popT - dt);
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
}
