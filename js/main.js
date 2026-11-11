// Entry point: game loop, input, menus, record and offline support.

import { COL, rgb } from './config.js';
import { createSim, update, press } from './sim.js';
import { drawTunnel } from './render.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const cvs = $('game');
const ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = cvs.clientWidth;
  H = cvs.clientHeight;
  cvs.width = Math.round(W * DPR);
  cvs.height = Math.round(H * DPR);
}
addEventListener('resize', resize);
resize();

// ---- saved preferences (optional; the game works without storage) ----
const store = {
  get(k, d) { try { const v = localStorage.getItem('ci-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ci-' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};
let best = store.get('best-tunnel', 0);
audio.settings.music = store.get('music', true);
audio.settings.sfx = store.get('sfx', true);

// ---- state ----
let state = 'menu'; // menu | play | dead
let S = createSim();
let shake = 0, flash = 0, deadAt = 0;

const emit = (type, data) => {
  if (state !== 'play') return; // the menu's autopilot stays silent
  if (type === 'die') return onDie(data);
  audio.sfx(type, data);
};

function onDie({ cause, metres }) {
  state = 'dead';
  deadAt = performance.now();
  audio.stopMusic();
  audio.sfx(cause);
  if (cause === 'block') { shake = 0.45; flash = 1; }
  try { navigator.vibrate && navigator.vibrate(40); } catch (e) { /* ignore */ }
  const isRecord = metres > best;
  if (isRecord) { best = metres; store.set('best-tunnel', best); }
  setTimeout(() => {
    if (state !== 'dead') return;
    $('overCause').textContent = cause === 'void' ? 'Caiu no vazio' : cause === 'hole' ? 'Caiu no buraco' : 'Bateu no bloco';
    $('overDist').textContent = metres + ' m';
    $('overBest').textContent = isRecord ? 'Novo recorde!' : `Recorde: ${best} m`;
    $('over').hidden = false;
    $('btnAgain').focus({ preventScroll: true });
  }, cause === 'block' ? 550 : 750);
}

// ---- loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  update(S, dt, emit, { live: state === 'play', autopilot: state === 'menu' });
  shake = Math.max(0, shake - dt);
  flash = Math.max(0, flash - dt * 3);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (shake > 0) { const a = shake * 18; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
  drawTunnel(ctx, S, W, H);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (flash > 0) { ctx.fillStyle = rgb(COL.haz, flash * 0.45); ctx.fillRect(0, 0, W, H); }
  if (state === 'menu') { ctx.fillStyle = rgb(COL.bg, 0.25); ctx.fillRect(0, 0, W, H); }

  if (state === 'play') $('dist').textContent = Math.floor(S.dist) + ' m';
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden) audio.stopMusic();
  else if (state === 'play') audio.startMusic(tempo);
});

// music speeds up with the run: 64 bpm at the start, about 95 at top speed
const tempo = () => 64 + (S.speed - 9) * 2.4;

// ---- UI ----
function refreshMenu() {
  $('bestMenu').textContent = 'Recorde: ' + (best ? best + ' m' : '—');
  $('btnMusic').textContent = 'Música: ' + (audio.settings.music ? 'ligada' : 'desligada');
  $('btnSfx').textContent = 'Efeitos: ' + (audio.settings.sfx ? 'ligados' : 'desligados');
  $('btnMusic').setAttribute('aria-pressed', audio.settings.music);
  $('btnSfx').setAttribute('aria-pressed', audio.settings.sfx);
  const muted = !audio.settings.music && !audio.settings.sfx;
  $('btnSound').textContent = muted ? 'Som: desligado' : 'Som: ligado';
}
function start() {
  audio.unlock();
  S = createSim();
  state = 'play';
  $('menu').hidden = true;
  $('over').hidden = true;
  $('hud').hidden = false;
  $('dist').textContent = '0 m';
  $('bestHud').textContent = 'recorde ' + best + ' m';
  audio.startMusic(tempo);
  cvs.focus({ preventScroll: true });
}
function toMenu() {
  state = 'menu';
  audio.stopMusic();
  S = createSim();
  $('over').hidden = true;
  $('hud').hidden = true;
  $('menu').hidden = false;
  refreshMenu();
}

$('btnPlay').addEventListener('click', start);
$('btnAgain').addEventListener('click', start);
$('btnBack').addEventListener('click', toMenu);
$('btnMenu').addEventListener('click', e => { e.stopPropagation(); toMenu(); });
$('btnMusic').addEventListener('click', () => { audio.settings.music = !audio.settings.music; store.set('music', audio.settings.music); refreshMenu(); });
$('btnSfx').addEventListener('click', () => { audio.settings.sfx = !audio.settings.sfx; store.set('sfx', audio.settings.sfx); refreshMenu(); });
$('btnSound').addEventListener('click', e => {
  e.stopPropagation();
  const on = !(audio.settings.music || audio.settings.sfx);
  audio.settings.music = on;
  audio.settings.sfx = on;
  store.set('music', on);
  store.set('sfx', on);
  if (on && state === 'play') { audio.unlock(); audio.startMusic(tempo); }
  refreshMenu();
});
$('over').addEventListener('pointerdown', e => {
  if (e.target === $('over') && performance.now() - deadAt > 700) start();
});
cvs.addEventListener('pointerdown', e => {
  e.preventDefault();
  audio.unlock();
  if (state === 'play') press(S, emit);
});
addEventListener('keydown', e => {
  const k = e.code;
  if (state === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS'].includes(k)) { e.preventDefault(); press(S, emit); }
  else if (state === 'dead' && (k === 'Space' || k === 'Enter') && performance.now() - deadAt > 700) { e.preventDefault(); start(); }
  else if (state === 'menu' && k === 'Enter') { e.preventDefault(); start(); }
  else if (k === 'Escape' && state !== 'menu') toMenu();
});

refreshMenu();
requestAnimationFrame(frame);

// ---- offline / installable (PWA) ----
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
