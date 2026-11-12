// Entry point: game loop, game flow (runs, tutorial, pause, game over), menus, keys and offline support.
// Options live in options.js, touch gestures in input.js, the stats and achievements panels in panels.js.

import { COL, rgb } from './config.js';
import { createSim, update, press, slide } from './sim.js';
import { drawTunnel, QUALITY } from './render.js';
import { store } from './store.js';
import { opt, quality, buzz, watchFrames, renderOptions, bindOptions, SWIPE } from './options.js';
import { renderStats, renderAchievements, toast } from './panels.js';
import { bindTouch } from './input.js';
import * as audio from './audio.js';
import * as stats from './stats.js';
import * as ach from './achievements.js';
import { STEPS, createTutorial, startStep, progress } from './tutorial.js';
import { fx, onLand, onThud, whileSliding, onHit, onInstantFlip, onFlipBlessing, whileBlessed, onMilestone, onPop, updateFx, clearFx } from './fx.js';

const $ = id => document.getElementById(id);
const VERSION_LABEL = 'Versão ' + self.APP_VERSION; // from js/version.js
const cvs = $('game');
const ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1;

// The game frame holds still when Android shows its bars for a moment (a gesture at the screen's
// edge): its height is kept through small shrinks, and the safe-area insets (the margins the HUD and
// menus keep from the edges, which grow while the bars are shown) keep their smallest value.
// A rotation (new width), a taller screen or a big change starts over.
let lockW = 0, lockH = 0, safe = null;
function lockStage() {
  const w = innerWidth, h = innerHeight;
  const ps = getComputedStyle($('safeProbe'));
  const now = { top: ps.paddingTop, right: ps.paddingRight, bottom: ps.paddingBottom, left: ps.paddingLeft };
  if (Math.abs(w - lockW) > 1 || h > lockH || h < lockH * 0.8) { lockW = w; lockH = h; safe = null; }
  if (!safe) safe = now;
  else for (const k in safe) if (parseFloat(now[k]) < parseFloat(safe[k])) safe[k] = now[k];
  const st = $('stage').style;
  st.setProperty('--app-h', lockH + 'px');
  for (const k in safe) st.setProperty('--safe-' + k, safe[k]);
}

function resize() {
  lockStage();
  DPR = Math.min(window.devicePixelRatio || 1, QUALITY[quality()].dpr);
  W = cvs.clientWidth;
  H = cvs.clientHeight;
  const cw = Math.round(W * DPR), ch = Math.round(H * DPR);
  if (cvs.width !== cw || cvs.height !== ch) { cvs.width = cw; cvs.height = ch; } // setting them clears the canvas
}
addEventListener('resize', resize);
resize();

let best = store.get('best-tunnel', 0);
let tutorialDone = store.get('tutorial-done', false);

// ---- state ----
// menu | play | dead | paused | countdown
let state = 'menu';
let S = createSim();
let tut = null;            // tutorial in progress, or null for a normal run
let runSeconds = 0;        // time actually played in this run (pauses excluded)
let run = { flips: 0, slides: 0, cleanMetres: 0, hurt: false }; // for achievements
let achCheckIn = 0;
let shake = 0, flash = 0, deadAt = 0;
let countdownLeft = 0;
let debug = store.get('debug', false); // hitbox view: H key, or tap the version label 5 times

const emit = (type, data) => {
  if (state !== 'play') return; // the menu's autopilot stays silent
  if (type === 'die') return onDie(data);
  if (!tut) stats.countAction(type);
  if (!tut && type === 'flip') run.flips++;
  if (!tut && type === 'slide') run.slides++;
  audio.sfx(type, data);
  if (type === 'hurt') return onHurt(data);
  if (type === 'heal') {
    renderLives(S.lives, false);
    onFlipBlessing(S);
    onPop('Bênção de Atena: +1 vida');
    stats.recordHeal(data.from, true);
    return;
  }
  if (type === 'land') onLand(data.side);
  else if (type === 'thud') { onThud(data.z); shake = Math.max(shake, 0.12); }
  else if (type === 'milestone') onMilestone(data.metres);
  else if (type === 'flip') {
    buzz(12);
    onFlipBlessing(S);
    if (opt.camera === 'instant') { S.camT = data.toCeiling ? 1 : 0; onInstantFlip(); }
  } else if (type === 'slide') buzz(10);
};

const CAUSE_TEXT = { void: 'Caiu no vazio', hole: 'Caiu no buraco', block: 'Bateu' };

// lost a life but the run goes on
function onHurt({ cause, kind, lives }) {
  run.hurt = true;
  stats.recordHurt(kind); // the hurt sound already played via emit
  buzz(30);
  shake = 0.3; flash = 0.7;
  if (cause === 'block') onHit(S);
  renderLives(lives, true);
}
// Red hearts for the ordinary lives, plus a gold one while the golden heart is held.
function renderLives(lives, justLost = false) {
  const el = $('lives');
  el.innerHTML = '';
  const red = S.gold ? lives - 1 : lives;
  for (let i = 0; i < S.maxLives; i++) {
    const h = document.createElement('span');
    h.className = 'heart' + (i < red ? '' : ' lost') + (justLost && !S.gold && i === red ? ' pulse' : '');
    h.textContent = i < red ? '♥' : '♡';
    el.appendChild(h);
  }
  if (S.gold) {
    const g = document.createElement('span');
    g.className = 'heart gold pulse';
    g.textContent = '♥';
    el.appendChild(g);
  }
  el.setAttribute('aria-label', (lives === 1 ? '1 vida restante' : `${lives} vidas restantes`) + (S.gold ? ', uma delas dourada' : ''));
}

function onDie({ cause, kind, metres }) {
  renderLives(0, true);
  state = 'dead';
  deadAt = performance.now();
  audio.stopMusic();
  audio.sfx(cause);
  if (cause === 'block') { shake = 0.45; flash = 1; onHit(S); }
  buzz(40);

  if (tut) { // tutorial: no game over, just try the same step again
    stats.recordTutorial('retry', tut.step + 1);
    showHint('Quase!', 'Tente de novo.');
    const grav = S.grav;
    setTimeout(() => {
      if (!tut || state !== 'dead') return;
      S = startStep(tut, grav);
      clearFx();
      state = 'play';
      showStepHint();
      audio.startMusic(tempo);
    }, 1000);
    return;
  }

  stats.recordRun({ metres, seconds: runSeconds, kind });
  checkAchievements(metres);
  const isRecord = metres > best;
  if (isRecord) { best = metres; store.set('best-tunnel', best); }
  setTimeout(() => {
    if (state !== 'dead') return;
    // falling through the roof is falling into the sky
    const intoSky = cause !== 'block' && S.fallHole && S.fallHole.side > 0;
    $('overCause').textContent = intoSky ? 'Caiu no céu' : CAUSE_TEXT[cause] + (cause === 'block' ? ': ' + stats.KIND_LABEL[kind].toLowerCase() : '');
    $('overDist').textContent = metres + ' m';
    $('overBest').textContent = isRecord ? 'Novo recorde!' : `Recorde: ${best} m`;
    $('over').hidden = false;
    $('btnAgain').focus({ preventScroll: true });
  }, cause === 'block' ? 380 : 600);
}

// ---- loop ----
let last = performance.now();
function frame(now) {
  const rawMs = now - last;
  const dt = Math.min(rawMs / 1000, 1 / 30);
  if ((state === 'play' || state === 'menu') && watchFrames(rawMs, dt)) { resize(); refreshMenu(); }
  last = now;
  if (state === 'countdown') {
    countdownLeft -= dt;
    const n = Math.ceil(countdownLeft / 0.6);
    $('countdown').textContent = n > 0 ? n : '';
    if (countdownLeft <= 0) { $('countdown').hidden = true; state = 'play'; audio.startMusic(tempo); }
  }
  const frozen = fx.hitStop > 0; // a short freeze right after a hit
  if (frozen) fx.hitStop -= dt;
  if (!frozen && state !== 'paused' && state !== 'countdown') {
    update(S, dt, emit, { live: state === 'play', autopilot: state === 'menu' });
    if (state === 'play') runSeconds += dt;
    if (state === 'play' && S.slide > 0 && S.grounded) whileSliding(dt, S.grav);
    if (state === 'play' && S.grav > 0) whileBlessed(dt, S);
    updateFx(dt, state === 'dead' ? 0 : S.speed);
  }
  if (tut && state === 'play') {
    const p = progress(tut, S);
    if (p) stats.recordTutorial('passed', p === 'done' ? STEPS.length : tut.step); // the step just cleared
    if (p === 'next') { showHint('Muito bem!', ''); setTimeout(() => { if (tut) showStepHint(); }, 700); }
    else if (p === 'done') finishTutorial();
  }
  if (!frozen) { shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 3); }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (shake > 0) { const a = shake * 18; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
  drawTunnel(ctx, S, W, H, { debug, fx, quality: quality(), fixedCamera: opt.camera === 'fixed' });
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (flash > 0) { ctx.fillStyle = rgb(COL.haz, flash * 0.45); ctx.fillRect(0, 0, W, H); }
  if (fx.flipFade > 0) { ctx.fillStyle = rgb(COL.cloud, fx.flipFade / 0.16 * 0.55); ctx.fillRect(0, 0, W, H); }
  if (state === 'menu') { ctx.fillStyle = rgb(COL.bg, 0.25); ctx.fillRect(0, 0, W, H); }
  if (fx.popT > 0 && $('pop').textContent !== fx.popText) { $('pop').textContent = fx.popText; }
  $('pop').hidden = !(fx.popT > 0 && state === 'play');

  if (state === 'play' && !tut) {
    $('dist').textContent = Math.floor(S.dist) + ' m';
    achCheckIn -= dt;
    if (achCheckIn <= 0) { achCheckIn = 0.5; checkAchievements(Math.floor(S.dist)); }
  }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden) {
    audio.stopMusic();
    if (state === 'play' || state === 'countdown') pause(); // leaving the app pauses the run
  }
});

// music speeds up with the run: 64 bpm at the start, about 95 at top speed
const tempo = () => 64 + (S.speed - 11) * 3.1;

// ---- tutorial ----
function showHint(title, sub) {
  $('tutTitle').textContent = title;
  $('tutSub').textContent = sub;
  $('tutHint').hidden = false;
}
function showStepHint() {
  const st = STEPS[tut.step];
  showHint(st.hint, st.sub);
  $('dist').textContent = `Tutorial ${tut.step + 1}/${STEPS.length}`;
  $('dist').classList.add('compact');
}
function startTutorial() {
  audio.unlock();
  tut = createTutorial();
  S = startStep(tut);
  enterPlay();
  $('bestHud').textContent = 'treino';
  $('lives').hidden = true;
  $('btnSkipTut').hidden = false;
  showStepHint();
}
// ---- achievements ----
function runState(metres) {
  if (!run.hurt) run.cleanMetres = metres;
  return { metres, cleanMetres: run.cleanMetres, flips: run.flips, slides: run.slides };
}
function checkAchievements(metres) {
  for (const a of ach.evaluate(runState(metres), stats.get())) toast(a);
}

function finishTutorial() {
  stats.recordTutorial('completed');
  tutorialDone = true;
  store.set('tutorial-done', true);
  checkAchievements(0);
  showHint('Pronto!', 'Agora é pra valer.');
  $('btnSkipTut').hidden = true;
  tut = null;
  setTimeout(() => { if (state === 'play' && S.scripted) start(); }, 1400);
}
function skipTutorial() {
  stats.recordTutorial('skipped');
  tutorialDone = true;
  store.set('tutorial-done', true);
  start();
}

// ---- runs, pause and menus ----
function enterPlay() {
  state = 'play';
  runSeconds = 0;
  for (const id of ['menu', 'over', 'pause', 'stats', 'options', 'countdown']) $(id).hidden = true;
  $('hud').hidden = false;
  audio.startMusic(tempo);
  cvs.focus({ preventScroll: true });
}
function start() {
  if (!tutorialDone) return startTutorial();
  audio.unlock();
  tut = null;
  $('tutHint').hidden = true;
  $('btnSkipTut').hidden = true;
  S = createSim();
  clearFx();
  run = { flips: 0, slides: 0, cleanMetres: 0, hurt: false };
  enterPlay();
  $('dist').classList.remove('compact');
  $('dist').textContent = '0 m';
  $('lives').hidden = false;
  renderLives(S.lives);
  $('bestHud').textContent = 'recorde ' + best + ' m';
}
function pause() {
  if (state !== 'play' && state !== 'countdown') return;
  state = 'paused';
  audio.stopMusic();
  $('countdown').hidden = true;
  $('pause').hidden = false;
  $('btnResume').focus({ preventScroll: true });
}
function resume() {
  if (state !== 'paused') return;
  audio.unlock();
  $('pause').hidden = true;
  state = 'countdown';
  countdownLeft = 1.8; // 3, 2, 1
  $('countdown').hidden = false;
  cvs.focus({ preventScroll: true });
}
function toMenu() {
  if (tut) stats.flush();
  state = 'menu';
  tut = null;
  audio.stopMusic();
  S = createSim();
  clearFx();
  for (const id of ['over', 'hud', 'pause', 'stats', 'options', 'achPanel', 'countdown', 'tutHint', 'pop']) $(id).hidden = true;
  $('menu').hidden = false;
  refreshMenu();
}
function refreshMenu() {
  $('bestMenu').textContent = 'Recorde: ' + (best ? best + ' m' : '—');
  $('verLabel').textContent = VERSION_LABEL + (debug ? ' · colisões visíveis' : '');
  renderOptions();
}

function openStats() {
  renderStats();
  $('btnReset').textContent = 'Apagar estatísticas';
  $('btnReset').dataset.armed = '';
  $('menu').hidden = true;
  $('stats').hidden = false;
  $('statsClose').focus({ preventScroll: true });
}
function closeStats() {
  $('stats').hidden = true;
  $('menu').hidden = false;
}

// ---- buttons ----
$('btnPlay').addEventListener('click', start);
$('btnTutorial').addEventListener('click', startTutorial);
$('btnStats').addEventListener('click', openStats);
$('btnAch').addEventListener('click', () => { renderAchievements(); $('menu').hidden = true; $('achPanel').hidden = false; $('achClose').focus({ preventScroll: true }); });
$('achClose').addEventListener('click', () => { $('achPanel').hidden = true; $('menu').hidden = false; });
$('btnOptions').addEventListener('click', () => { $('menu').hidden = true; $('options').hidden = false; $('optionsClose').focus({ preventScroll: true }); });
$('optionsClose').addEventListener('click', () => { $('options').hidden = true; $('menu').hidden = false; });
$('statsClose').addEventListener('click', closeStats);
$('btnCopyStats').addEventListener('click', () => {
  const text = JSON.stringify(stats.get(), null, 2);
  const done = () => { $('btnCopyStats').textContent = 'Copiado'; setTimeout(() => { $('btnCopyStats').textContent = 'Copiar dados'; }, 1500); };
  const fallback = () => { $('btnCopyStats').textContent = 'Não foi possível copiar'; };
  try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
});
$('btnReset').addEventListener('click', () => {
  const b = $('btnReset');
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Toque de novo para apagar'; return; }
  stats.reset();
  b.dataset.armed = '';
  b.textContent = 'Apagado';
  renderStats();
});
// Playtest feedback: opens the Google Form with the game version and the stats already filled in.
const FEEDBACK_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdNJNIt4SyNeSdWVbpb788UTRqVTEPeqFZvSC0IajTQcnjlzg/viewform';
const FEEDBACK_FIELDS = { version: 'entry.591515427', stats: 'entry.1006251637' };
function feedbackUrl() {
  stats.flush();
  const d = structuredClone(stats.get());
  const build = () => FEEDBACK_FORM + '?usp=pp_url&' + new URLSearchParams({
    [FEEDBACK_FIELDS.version]: self.APP_VERSION, [FEEDBACK_FIELDS.stats]: JSON.stringify(d),
  });
  let url = build();
  while (url.length > 7000 && d.recent && d.recent.length) { d.recent = d.recent.slice(0, -5); url = build(); } // keep the link short enough
  return url;
}
$('btnFeedback').addEventListener('click', () => { window.open(feedbackUrl(), '_blank', 'noopener'); });
$('btnAgain').addEventListener('click', start);
$('btnBack').addEventListener('click', toMenu);
$('btnPause').addEventListener('click', e => { e.stopPropagation(); pause(); });
$('btnResume').addEventListener('click', resume);
$('btnQuit').addEventListener('click', toMenu);
$('btnSkipTut').addEventListener('click', e => { e.stopPropagation(); skipTutorial(); });
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
  if (e.target === $('over') && performance.now() - deadAt > 450) start();
});

bindTouch(cvs, {
  active: () => state === 'play',
  onTouch: () => audio.unlock(),
  press: () => press(S, emit),
  slide: () => slide(S, emit),
  heroJumping: () => S.mode === 'jump',
  surfaceOnTop: () => opt.camera === 'fixed' && S.grav > 0,
  swipePx: () => SWIPE[opt.swipe],
});
addEventListener('keydown', e => {
  const k = e.code;
  if (state === 'play' && ['Space', 'ArrowUp', 'KeyW'].includes(k)) { e.preventDefault(); press(S, emit); }
  else if (state === 'play' && ['ArrowDown', 'KeyS'].includes(k)) { e.preventDefault(); slide(S, emit); }
  else if ((k === 'Escape' || k === 'KeyP') && (state === 'play' || state === 'countdown')) { e.preventDefault(); pause(); }
  else if ((k === 'Escape' || k === 'KeyP' || k === 'Space' || k === 'Enter') && state === 'paused') { e.preventDefault(); resume(); }
  else if (state === 'dead' && !tut && (k === 'Space' || k === 'Enter') && performance.now() - deadAt > 450) { e.preventDefault(); start(); }
  else if (state === 'menu' && k === 'Enter' && $('stats').hidden && $('options').hidden && $('achPanel').hidden) { e.preventDefault(); start(); }
  else if (k === 'Escape' && !$('stats').hidden) closeStats();
  else if (k === 'Escape' && !$('options').hidden) { $('options').hidden = true; $('menu').hidden = false; }
  else if (k === 'Escape' && !$('achPanel').hidden) { $('achPanel').hidden = true; $('menu').hidden = false; }
  else if (k === 'Escape' && state === 'dead') toMenu();
  else if (k === 'KeyH') toggleDebug();
});

function toggleDebug() {
  debug = !debug;
  store.set('debug', debug);
  refreshMenu();
}
let versionTaps = 0, versionTimer = null;
$('verLabel').addEventListener('click', () => {
  versionTaps++;
  clearTimeout(versionTimer);
  versionTimer = setTimeout(() => { versionTaps = 0; }, 1200);
  if (versionTaps >= 5) { versionTaps = 0; toggleDebug(); }
});

bindOptions(what => { if (what === 'quality') resize(); });
refreshMenu();
requestAnimationFrame(frame);

// ---- offline / installable (PWA) ----
// When a new version takes over, reload once so it shows right away; check for one on every return.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded && state !== 'play') { reloaded = true; location.reload(); }
  });
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
