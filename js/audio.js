// Game audio: the chosen lyre timbre ("Ruína", Dórico on Ré) reacting to the run.
// Sound effects and background music share the scale, so they always fit together.

import { createLyre, scaleNotes, PRESETS, MODES } from './lyre.js';

const ROOT = 50;        // Ré 3
const MODE = 'dorico';
const NOTES = scaleNotes(ROOT, MODE);         // 15 strings, Ré 3 to Ré 5
const PER = MODES[MODE].steps.length;         // notes per octave
const FIFTH = MODES[MODE].steps.indexOf(7);   // scale degree of the fifth

let ac = null, lyre = null, out = null, musicBus = null;
let sfxOn = true, musicOn = true;
let musicTimer = null, nextT = 0, step = 0, melody = PER + 2;
let tempoFor = () => 64;

// Must be called from a user gesture (tap / key) the first time.
export function unlock() {
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    comp.connect(ac.destination);
    out = ac.createGain();
    out.gain.value = 0.7;
    out.connect(comp);
    lyre = createLyre(ac, out, PRESETS.ruina);
    musicBus = ac.createGain();
    musicBus.gain.value = 0.55;
    musicBus.connect(lyre.input);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return true;
}

export const settings = {
  get sfx() { return sfxOn; },
  set sfx(v) { sfxOn = v; },
  get music() { return musicOn; },
  set music(v) { musicOn = v; if (!v) stopMusic(); },
};

const deg = i => NOTES[Math.min(i, NOTES.length - 1)];
const short = { sustain: 20, dur: 0.5 };

// Reactions to simulation events (see sim.js emit calls).
export function sfx(type, data = {}) {
  if (!ac || !sfxOn) return;
  switch (type) {
    case 'jump':
      lyre.pluck(deg(NOTES.length - 4), 0, 0.42, short);
      break;
    case 'flip':
      lyre.strum(data.toCeiling ? [deg(4), deg(7), deg(9), deg(11)] : [deg(11), deg(9), deg(7), deg(4)], 0.032, 0.38, short);
      break;
    case 'milestone':
      lyre.strum([deg(0), deg(2), deg(4), deg(7), deg(9), deg(NOTES.length - 1)], 0.06, 0.4, { sustain: 50 });
      break;
    case 'block': {
      const t = ac.currentTime + 0.01;
      lyre.pluck(deg(0), t, 0.8, { sustain: 0, bright: 5, dur: 0.3 });
      lyre.pluck(deg(1), t, 0.6, { sustain: 0, bright: 5, dur: 0.3 });
      break;
    }
    case 'hole':
    case 'void': {
      const t0 = ac.currentTime + 0.01;
      for (let i = NOTES.length - 1, k = 0; i >= 0; i--, k++) {
        lyre.pluck(NOTES[i], t0 + k * 0.045, 0.42 - k * 0.02, { sustain: 25, dur: 0.6 });
      }
      break;
    }
  }
}

// Background music: generative lyre melody over a bass on the downbeat.
// `getTempo` is read every note, so the music speeds up with the run.
export function startMusic(getTempo) {
  if (!ac || !musicOn) return;
  tempoFor = getTempo;
  stopMusic();
  nextT = ac.currentTime + 0.1;
  step = 0;
  melody = PER + 2;
  musicTimer = setInterval(schedule, 60);
  schedule();
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function schedule() {
  while (nextT < ac.currentTime + 0.25) {
    const eighth = 60 / tempoFor() / 2;
    const bar = Math.floor(step / 8), beat = step % 8;
    const to = musicBus;
    if (beat === 0) {
      const bassDeg = (bar % 4 === 2 && FIFTH >= 0) ? FIFTH : 0;
      lyre.pluck(NOTES[bassDeg], nextT, 0.5, { to });
    }
    if (beat === 4 && bar % 2 === 1) lyre.pluck(NOTES[2], nextT, 0.3, { to });
    const resolve = bar % 4 === 3 && beat >= 6;
    if (resolve) {
      if (beat === 6) lyre.pluck(NOTES[PER], nextT, 0.42, { to });
    } else if (Math.random() > 0.32) {
      melody += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
      melody = Math.max(PER - 2, Math.min(NOTES.length - 1, melody));
      lyre.pluck(NOTES[melody], nextT, beat % 2 ? 0.3 : 0.38, { to });
    }
    nextT += eighth * (beat % 2 ? 0.9 : 1.1); // light swing
    step++;
  }
}
