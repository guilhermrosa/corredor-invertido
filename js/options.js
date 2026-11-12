// Menu → Opções: sound, comfort and quality settings, saved between sessions.
// `opt` holds the current values; main.js reads them and calls renderOptions() to refresh the labels.

import { QUALITY } from './render.js';
import * as audio from './audio.js';
import { store } from './store.js';

const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const CAMERA_LABEL = { animated: 'animado', instant: 'instantâneo', fixed: 'sem girar' };
export const SWIPE = { low: 40, normal: 26, high: 14 };  // pixels a finger must travel to slide or flip
const SWIPE_LABEL = { low: 'baixa', normal: 'normal', high: 'alta' };
const QUALITY_LABEL = { high: 'alta', medium: 'média', low: 'baixa' };

audio.settings.music = store.get('music', true);
audio.settings.sfx = store.get('sfx', true);

export const opt = {
  // Mirrored by default since v0.29 (the corridor runs off to the left, clear of a right thumb);
  // a new key so everyone gets the new default once.
  mirrored: store.get('mirror-v2', true),
  vibrate: store.get('vibrate', false), // off unless the player turns it on
  camera: store.get('camera', reduceMotion ? 'instant' : 'animated'), // animated | instant | fixed
  swipe: store.get('swipe', 'normal'),
  // Quality: 'auto' (default) starts high and steps down if frames stay slow; or fixed here.
  quality: store.get('quality', 'auto'),
  autoQuality: store.get('quality-auto', 'high'),
};
if (!CAMERA_LABEL[opt.camera]) opt.camera = 'animated';
if (!SWIPE[opt.swipe]) opt.swipe = 'normal';
if (opt.quality !== 'auto' && !QUALITY[opt.quality]) opt.quality = 'auto';
if (!QUALITY[opt.autoQuality]) opt.autoQuality = 'high';

export const quality = () => (opt.quality === 'auto' ? opt.autoQuality : opt.quality);

export function buzz(ms) {
  if (opt.vibrate) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* ignore */ } }
}

// Frame-time watch for automatic quality: slower than ~40 fps for 2 s steps down one level.
// Returns true when the level changed (the caller resizes the canvas).
let frameAvg = 16.7, slowFor = 0;
export function watchFrames(rawMs, dt) {
  if (opt.quality !== 'auto' || document.hidden || rawMs > 250) return false; // ignore tab switches
  frameAvg += (rawMs - frameAvg) * 0.05;
  slowFor = frameAvg > 25 ? slowFor + dt : 0;
  if (slowFor > 2 && opt.autoQuality !== 'low') {
    opt.autoQuality = opt.autoQuality === 'high' ? 'medium' : 'low';
    store.set('quality-auto', opt.autoQuality);
    slowFor = 0;
    frameAvg = 16.7;
    return true;
  }
  return false;
}

export function renderOptions() {
  const press = (id, on, text) => { $(id).textContent = text; $(id).setAttribute('aria-pressed', on); };
  press('btnMusic', audio.settings.music, 'Música: ' + (audio.settings.music ? 'ligada' : 'desligada'));
  press('btnSfx', audio.settings.sfx, 'Efeitos: ' + (audio.settings.sfx ? 'ligados' : 'desligados'));
  press('btnMirror', opt.mirrored, 'Espelhar tela: ' + (opt.mirrored ? 'sim' : 'não'));
  press('btnVibrate', opt.vibrate, 'Vibração: ' + (opt.vibrate ? 'ligada' : 'desligada'));
  $('btnCamera').textContent = 'Giro da câmera: ' + CAMERA_LABEL[opt.camera];
  $('btnSwipe').textContent = 'Sensibilidade do arrasto: ' + SWIPE_LABEL[opt.swipe];
  $('btnQuality').textContent = 'Qualidade: ' + (opt.quality === 'auto' ? `automática (${QUALITY_LABEL[opt.autoQuality]})` : QUALITY_LABEL[opt.quality]);
  $('game').classList.toggle('mirrored', opt.mirrored);
  const muted = !audio.settings.music && !audio.settings.sfx;
  $('btnSound').textContent = muted ? 'Som: desligado' : 'Som: ligado';
}

const cycle = (order, cur) => order[(order.indexOf(cur) + 1) % order.length];

// Wires the option buttons. `changed(what)` runs after each change ('quality' needs a canvas resize).
export function bindOptions(changed) {
  const on = (id, fn) => $(id).addEventListener('click', () => { const what = fn(); renderOptions(); changed(what); });
  on('btnMusic', () => { audio.settings.music = !audio.settings.music; store.set('music', audio.settings.music); return 'sound'; });
  on('btnSfx', () => { audio.settings.sfx = !audio.settings.sfx; store.set('sfx', audio.settings.sfx); return 'sound'; });
  on('btnMirror', () => { opt.mirrored = !opt.mirrored; store.set('mirror-v2', opt.mirrored); });
  on('btnVibrate', () => { opt.vibrate = !opt.vibrate; store.set('vibrate', opt.vibrate); buzz(30); });
  on('btnCamera', () => { opt.camera = cycle(['animated', 'instant', 'fixed'], opt.camera); store.set('camera', opt.camera); });
  on('btnSwipe', () => { opt.swipe = cycle(['low', 'normal', 'high'], opt.swipe); store.set('swipe', opt.swipe); });
  on('btnQuality', () => {
    opt.quality = cycle(['auto', 'high', 'medium', 'low'], opt.quality);
    if (opt.quality === 'auto') { opt.autoQuality = 'high'; store.set('quality-auto', opt.autoQuality); frameAvg = 16.7; slowFor = 0; }
    store.set('quality', opt.quality);
    return 'quality';
  });
}
