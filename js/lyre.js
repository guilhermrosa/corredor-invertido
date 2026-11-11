// Lyre engine: Karplus–Strong plucked strings with an optional "chip" character
// (sample-rate decimation + bit crush) and a soft stone-hall echo.
// Shared between Corredor Invertido and Lira de Bolso; keep both copies identical.

export const NOTE_NAMES = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];

export const MODES = {
  dorico: { name: 'Dórico', steps: [0, 2, 3, 5, 7, 9, 10], desc: 'Sereno e levemente melancólico.' },
  frigio: { name: 'Frígio', steps: [0, 1, 3, 5, 7, 8, 10], desc: 'Antigo e misterioso, por causa da segunda nota bem próxima da primeira.' },
  mixo:   { name: 'Mixolídio', steps: [0, 2, 4, 5, 7, 9, 10], desc: 'Luminoso e festivo, com um toque arcaico.' },
  penta:  { name: 'Pentatônica', steps: [0, 2, 4, 7, 9], desc: 'Cinco notas, nenhuma tensa. Qualquer combinação soa bem.' },
  jonio:  { name: 'Jônio (maior)', steps: [0, 2, 4, 5, 7, 9, 11], desc: 'A escala maior de hoje. Alegre e familiar; é a das canções.' },
};

// Values are 0–100. "ruina" is the combination chosen for Corredor Invertido.
export const PRESETS = {
  ruina: { name: 'Ruína',       chip: 24,  bright: 30, sustain: 80, echo: 37 },
  lira:  { name: 'Lira',        chip: 0,   bright: 45, sustain: 60, echo: 30 },
  lira8: { name: 'Lira 8-bit',  chip: 50,  bright: 50, sustain: 55, echo: 25 },
  harpa: { name: 'Harpa clara', chip: 10,  bright: 30, sustain: 80, echo: 45 },
  chip:  { name: 'Chip puro',   chip: 100, bright: 25, sustain: 35, echo: 12 },
};

export const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

// Two octaves of the mode from `root` (MIDI), plus the top octave note.
export function scaleNotes(root, modeKey) {
  const steps = MODES[modeKey].steps;
  const notes = [];
  for (let o = 0; o < 2; o++) for (const s of steps) notes.push(root + o * 12 + s);
  notes.push(root + 24);
  return notes;
}

export function createLyre(ac, destination, initial = PRESETS.ruina) {
  const params = { chip: initial.chip, bright: initial.bright, sustain: initial.sustain, echo: initial.echo };

  // input -> dry -> destination, input -> delay loop (lowpassed feedback) -> wet -> destination
  const input = ac.createGain();
  const delay = ac.createDelay(1);
  const fb = ac.createGain();
  const fbFilter = ac.createBiquadFilter();
  const wet = ac.createGain();
  delay.delayTime.value = 0.27;
  fbFilter.type = 'lowpass';
  fbFilter.frequency.value = 2400;
  input.connect(destination);
  input.connect(delay);
  delay.connect(fbFilter);
  fbFilter.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(destination);

  function applyEcho() {
    const e = params.echo / 100;
    fb.gain.value = 0.15 + e * 0.5;
    wet.gain.value = e * 0.55;
  }
  applyEcho();

  function buffer(freq, opt = {}) {
    const sr = ac.sampleRate;
    const chip = params.chip / 100;
    const bright = (opt.bright ?? params.bright) / 100;
    const sus = (opt.sustain ?? params.sustain) / 100;
    const dur = opt.dur ?? (0.5 + sus * 3.2);
    const len = Math.floor(sr * dur);
    const N = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const noise = Math.random() * 2 - 1;
      const sq = i < N / 2 ? 0.8 : -0.8;
      ring[i] = noise * (1 - chip) + sq * chip;
    }
    // soften the excitation a little for an organic pluck
    if (chip < 0.5) for (let i = 1; i < N; i++) ring[i] = ring[i] * 0.6 + ring[i - 1] * 0.4;
    const decay = 0.986 + sus * 0.0135;
    const k = 0.5 - bright * 0.42;
    const out = new Float32Array(len);
    let idx = 0;
    for (let t = 0; t < len; t++) {
      const nextIdx = idx + 1 === N ? 0 : idx + 1;
      const cur = ring[idx];
      ring[idx] = decay * ((1 - k) * cur + k * ring[nextIdx]);
      out[t] = cur;
      idx = nextIdx;
    }
    const D = 1 + Math.round(chip * 5);
    const levels = chip > 0.02 ? Math.round(48 - chip * 42) : 0;
    if (D > 1 || levels) {
      let hold = 0;
      for (let t = 0; t < len; t++) {
        if (t % D === 0) hold = out[t];
        out[t] = levels ? Math.round(hold * levels) / levels : hold;
      }
    }
    const a = Math.floor(sr * 0.002);
    const r = Math.floor(sr * 0.06);
    for (let t = 0; t < a; t++) out[t] *= t / a;
    for (let t = 0; t < r; t++) out[len - 1 - t] *= t / r;
    const buf = ac.createBuffer(1, len, sr);
    buf.copyToChannel(out, 0);
    return buf;
  }

  // opt: { sustain, bright, dur, to } — `to` routes the note to another node (e.g. a music bus)
  function pluck(midi, when = 0, vel = 0.5, opt = {}) {
    const src = ac.createBufferSource();
    const g = ac.createGain();
    src.buffer = buffer(midiFreq(midi), opt);
    g.gain.value = vel;
    src.connect(g).connect(opt.to || input);
    const t = Math.max(ac.currentTime, when || ac.currentTime);
    src.start(t);
    return t;
  }

  function strum(list, gapSec = 0.04, vel = 0.45, opt = {}, when = 0) {
    const t0 = Math.max(ac.currentTime + 0.01, when);
    list.forEach((m, i) => pluck(m, t0 + i * gapSec, vel, opt));
  }

  return {
    params,
    input,
    set(p) { Object.assign(params, p); applyEcho(); },
    pluck,
    strum,
  };
}
