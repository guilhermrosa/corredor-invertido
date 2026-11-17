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
    case 'hurt': {
      const t = ac.currentTime + 0.01;
      lyre.pluck(deg(2), t, 0.6, { sustain: 0, bright: 10, dur: 0.25 });
      lyre.pluck(deg(1), t + 0.09, 0.5, { sustain: 0, bright: 10, dur: 0.3 });
      break;
    }
    case 'strike': // a marked bolt falls (v0.50): the same crackle and thunder as the struck column
      sfx('crack', { kind: 'pillar' });
      break;
    case 'bossStart': { // Zeus wakes: a long roll of low thunder
      const t = ac.currentTime + 0.01;
      [0, 1, 0, 2, 0].forEach((d, i) => lyre.pluck(deg(d), t + i * 0.14, 0.55 - i * 0.06, { sustain: 40, bright: 0, dur: 0.7 }));
      break;
    }
    case 'demeterStart': { // Demeter wakes: a deep, slow, rooted strum, twice
      const t = ac.currentTime + 0.01;
      [[0, 2, 4], [0, 3, 5]].forEach((ch, k) => ch.forEach((d, i) => lyre.pluck(deg(d), t + k * 0.5 + i * 0.07, 0.5, { sustain: 60, bright: 15, dur: 0.9 })));
      break;
    }
    case 'demeterEnd': // the fields let him pass: a warm rising phrase
      lyre.strum([deg(2), deg(4), deg(7), deg(9), deg(11)], 0.1, 0.4, { sustain: 60 });
      break;
    case 'bossEnd': // the storm passes: a calm rising phrase
      lyre.strum([deg(4), deg(7), deg(9), deg(11)], 0.09, 0.4, { sustain: 50 });
      break;
    case 'crack': { // a column or a roof block starts to give way
      const t = ac.currentTime + 0.01;
      if (data.kind !== 'pillar') { // the roof block: just the stone cracking
        lyre.pluck(deg(NOTES.length - 2), 0, 0.3, { sustain: 0, bright: 90, dur: 0.12 });
        lyre.pluck(deg(NOTES.length - 3), t + 0.04, 0.25, { sustain: 0, bright: 90, dur: 0.12 });
        break;
      }
      // the column is Zeus's wrath (v0.48): a bright crackle, then low thunder
      lyre.pluck(deg(NOTES.length - 1), t, 0.3, { sustain: 0, bright: 100, dur: 0.08 });
      lyre.pluck(deg(NOTES.length - 2), t + 0.03, 0.3, { sustain: 0, bright: 90, dur: 0.1 });
      lyre.pluck(deg(NOTES.length - 3), t + 0.06, 0.25, { sustain: 0, bright: 90, dur: 0.12 });
      lyre.pluck(deg(0), t + 0.12, 0.55, { sustain: 30, bright: 0, dur: 0.6 });
      lyre.pluck(deg(1), t + 0.2, 0.4, { sustain: 30, bright: 0, dur: 0.5 });
      break;
    }
    case 'slip': { // slipping into a hole: a quick falling pair, a cue to flip now
      const t = ac.currentTime + 0.01;
      lyre.pluck(deg(5), t, 0.4, { sustain: 0, bright: 40, dur: 0.15 });
      lyre.pluck(deg(3), t + 0.06, 0.35, { sustain: 0, bright: 40, dur: 0.15 });
      break;
    }
    case 'thud':
      lyre.pluck(deg(0), 0, 0.7, { sustain: 5, bright: 5, dur: 0.35 });
      break;
    case 'boost': // a gift of the gods: a quick, bright run up the strings
      lyre.strum([deg(4), deg(7), deg(9), deg(11), deg(NOTES.length - 1)], 0.035, 0.42, { sustain: 40 });
      break;
    case 'boostTick': // the last seconds of a gift: one short high note each, lower as it runs out
      lyre.pluck(deg(NOTES.length - 1 - (3 - (data?.left ?? 3)) * 2), 0, 0.3, { sustain: 0, bright: 70, dur: 0.1 });
      break;
    case 'smash': { // the shield breaks a wall: a heavy low pair, then a bright ring
      const t = ac.currentTime + 0.01;
      lyre.pluck(deg(0), t, 0.75, { sustain: 5, bright: 5, dur: 0.3 });
      lyre.pluck(deg(2), t + 0.04, 0.6, { sustain: 0, bright: 20, dur: 0.25 });
      lyre.pluck(deg(NOTES.length - 1), t + 0.08, 0.35, { sustain: 40, bright: 80, dur: 0.4 });
      break;
    }
    case 'break': { // the struck column breaks at its foot: a short crunch of stone (v0.48.3)
      const t = ac.currentTime + 0.01;
      lyre.pluck(deg(1), t, 0.55, { sustain: 0, bright: 15, dur: 0.18 });
      lyre.pluck(deg(0), t + 0.05, 0.5, { sustain: 0, bright: 5, dur: 0.25 });
      break;
    }
    case 'boostEnd': // the gift fades: two soft falling notes
      lyre.pluck(deg(9), 0, 0.3, { sustain: 10, dur: 0.3 });
      lyre.pluck(deg(7), ac.currentTime + 0.09, 0.26, { sustain: 10, dur: 0.3 });
      break;
    case 'coin': // an obol drops into Charon's palm (v0.52.1): a short bright clink, a little higher each time
      lyre.pluck(deg(NOTES.length - 3 + ((data?.i ?? 0) % 3)), 0, 0.32, { sustain: 0, bright: 90, dur: 0.12 });
      break;
    case 'surface': // out of the underworld (v0.53): a long bright run up the strings, all the way
      lyre.strum([deg(0), deg(2), deg(4), deg(7), deg(9), deg(11), deg(NOTES.length - 1)], 0.06, 0.45, { sustain: 70 });
      break;
    case 'heal': // a life comes back: a bright rising arpeggio
      lyre.strum([deg(7), deg(9), deg(11), deg(NOTES.length - 1)], 0.05, 0.42, { sustain: 50 });
      break;
    case 'slide':
      lyre.strum([deg(9), deg(7), deg(5), deg(3)], 0.028, 0.32, { sustain: 15, dur: 0.4 });
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
// The music's mood by area (v0.53): below, the melody stays low, sparse and soft, over a drone
// in Demeter's fields it turns warm and pastoral: a rolling broken chord under a higher, busier melody
let under = false, fields = false;
export function setArea(area) { under = area === 'under'; fields = area === 'fields'; }

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
    if (under && beat === 4 && bar % 2 === 0) lyre.pluck(NOTES[0], nextT, 0.22, { to });
    if (fields && beat % 2 === 1) lyre.pluck(NOTES[[2, 4, PER, 4][(beat >> 1) & 3]], nextT, 0.16, { to }); // the rolling chord
    const resolve = bar % 4 === 3 && beat >= 6;
    if (resolve) {
      if (beat === 6) lyre.pluck(NOTES[PER], nextT, 0.42, { to });
    } else if (Math.random() > (under ? 0.55 : fields ? 0.24 : 0.32)) {
      melody += [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
      melody = Math.max(under ? 1 : fields ? PER : PER - 2, Math.min(under ? PER + 1 : NOTES.length - 1, melody));
      lyre.pluck(NOTES[melody], nextT, (beat % 2 ? 0.3 : 0.38) * (under ? 0.75 : 1), { to });
    }
    nextT += eighth * (beat % 2 ? 0.9 : 1.1); // light swing
    step++;
  }
}
