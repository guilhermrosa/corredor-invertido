// Entry point: game loop, game flow (runs, tutorial, pause, game over), menus, keys and offline support.
// Options live in options.js, touch gestures in input.js, the stats and achievements panels in panels.js.

import { COL, rgb, HERMES_TIME, HW, OBOL_EVERY, CHARON_PRICE, UNDER_END } from './config.js';
import { createSim, update, press, flipUp, slide, revive } from './sim.js';
import { drawTunnel, QUALITY } from './render.js';
import { store } from './store.js';
import { opt, quality, buzz, watchFrames, renderOptions, bindOptions, SWIPE } from './options.js';
import { renderStats, renderAchievements, toast } from './panels.js';
import { bindTouch } from './input.js';
import * as audio from './audio.js';
import * as stats from './stats.js';
import * as ach from './achievements.js';
import { STEPS, createTutorial, startStep, progress } from './tutorial.js';
import { aegisSvg } from './aegis.js';
import { fx, onLand, onThud, whileSliding, onHit, onInstantFlip, onFlipBlessing, whileBlessed, onMilestone, onPop, onBlessing, onWrath, onSurface, onSmash, onColumnBreak, updateFx, clearFx } from './fx.js';

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
let run = { flips: 0, slides: 0, cleanMetres: 0, hurt: false, gods: new Set() }; // for achievements
let achCheckIn = 0;
// the first time each gift of the gods shows up on the path, a card says what it does (once per device)
const GIFT_INTRO = {
  heart: ['Romã dourada de Perséfone', 'Pegue para ganhar uma vida extra. Se ela estiver do outro lado, inverta.'],
  sandals: ['Sandálias de Hermes', 'Pegue para andar sobre os buracos por 6 s. Logo depois vem um trecho cheio deles.'],
  aegis: ['Escudo de Atena', 'Pegue: ele quebra os próximos dois muros ou pórticos em que você bater. Logo depois vem uma muralha.'],
};
let giftsSeen = store.get('gifts-seen', {});
let giftIntroT = 0;
function checkGiftIntro(dt) {
  if (giftIntroT > 0 && (giftIntroT -= dt) <= 0) $('giftIntro').hidden = true;
  if (giftIntroT > 0) return;
  const g = S.obs.find(o => GIFT_INTRO[o.type] && !giftsSeen[o.type] && !o.taken && o.z < 75);
  if (!g) return;
  giftsSeen = { ...giftsSeen, [g.type]: true };
  store.set('gifts-seen', giftsSeen);
  $('giftTitle').textContent = GIFT_INTRO[g.type][0];
  $('giftSub').textContent = GIFT_INTRO[g.type][1];
  $('giftIntro').classList.toggle('low', S.hermes > 0); // under the Hermes timer when it shows
  $('giftIntro').hidden = false;
  giftIntroT = 3.6;
}
let hermesLeft = 0;
// Charon (v0.52): the obols kept on the device, what this run earned, and the death waiting for a choice
let obols = store.get('obols', 0);
let pendingDeath = null;
function earn(n) { if (n <= 0) return; obols += n; run.earned = (run.earned || 0) + n; store.set('obols', obols); }
const charonPrice = () => CHARON_PRICE * 2 ** (run.continues || 0);          // last frame's S.hermes, for the countdown ticks
let shake = 0, flash = 0, deadAt = 0, zeusFlash = 0, wasBelow = null, exitFlash = 0;
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
  if (type === 'boost') { // a gift of the gods: Hermes' sandals or Athena's shield
    onFlipBlessing(S);
    if (data.god === 'athena') { onBlessing('Atena', 'Escudo', 'quebra os próximos dois muros'); renderLives(S.lives, false); }
    else onBlessing('Hermes', 'Sandálias aladas', 'ande sobre os buracos');
    if (!tut) { stats.recordBoost(data.god); run.gods.add(data.god); }
    return;
  }
  if (type === 'heal') {
    renderLives(S.lives, false);
    onFlipBlessing(S);
    onBlessing('Perséfone', 'Romã dourada', '+1 vida');
    stats.recordHeal(data.from, true);
    if (!tut) run.gods.add('persephone');
    return;
  }
  if (type === 'hermesHold') { if (!tut) stats.recordHermesHold(); return; }
  if (type === 'smash') { onSmash(S); shake = Math.max(shake, 0.25); buzz(25); renderLives(S.lives, false); if (!tut) stats.recordSmash(data.kind); return; }
  if (type === 'crack' && data.kind === 'pillar') zeusFlash = 1;
  if (type === 'strike') { zeusFlash = 1; shake = Math.max(shake, 0.15); }
  if (type === 'surface') { if (!tut) { onSurface(); exitFlash = 1; } return audio.sfx('surface'); }
  if (type === 'bossStart') { if (!tut) { onWrath('Zeus desperta', 'sobreviva à tempestade'); run.zeus = true; stats.recordZeus('faced'); } return; }
  if (type === 'bossEnd') { if (!tut && !S.dead) { onWrath('Zeus se recolhe', 'você resistiu à tempestade'); run.zeusSurvived = (run.zeusSurvived || 0) + 1; stats.recordZeus('survived'); earn(1); } return; }
  if (type === 'break') { onColumnBreak(data.z, HW, data.col); shake = Math.max(shake, 0.1); } // Zeus's wrath: a white-blue flash as the lightning strikes
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
// A split pomegranate (Persephone's fruit) for each life: skin in currentColor, seeds showing in the cut.
const POMEGRANATE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path class="skin" d="M7.2 6.2 6.6 2.6 8.6 4.3 10 1.8 11.4 4.3 13.4 2.6 12.8 6.2Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><ellipse class="skin" cx="10" cy="12" rx="7.4" ry="6.9" fill="currentColor"/><g class="in"><path class="pith" d="M10.4 7.4C14 7.3 17.2 9.6 17.3 12.4 17.4 15.2 14.8 17.8 11.6 17.9 9.5 15.6 8.8 10.8 10.4 7.4Z"/><g class="seed"><circle cx="12" cy="9.6" r=".95"/><circle cx="14" cy="9.9" r=".95"/><circle cx="15.6" cy="11.6" r=".95"/><circle cx="11.4" cy="11.7" r=".95"/><circle cx="13.5" cy="11.8" r=".95"/><circle cx="15.4" cy="13.6" r=".95"/><circle cx="11.6" cy="13.8" r=".95"/><circle cx="13.5" cy="14" r=".95"/><circle cx="12.2" cy="15.9" r=".95"/><circle cx="14.2" cy="15.7" r=".95"/></g><ellipse class="hl" cx="6.4" cy="9.4" rx="1.4" ry="2" transform="rotate(-28 6.4 9.4)"/></g></svg>';
// Pomegranates for the ordinary lives (hearts until v0.47.1), plus a gold one while the golden heart is held.
function renderLives(lives, justLost = false) {
  const el = $('lives');
  el.innerHTML = '';
  const red = S.gold ? lives - 1 : lives;
  for (let i = 0; i < S.maxLives; i++) {
    const h = document.createElement('span');
    h.className = 'heart' + (i < red ? '' : ' lost') + (justLost && !S.gold && i === red ? ' pulse' : '');
    h.innerHTML = POMEGRANATE;
    el.appendChild(h);
  }
  if (S.gold) {
    const g = document.createElement('span');
    g.className = 'heart gold pulse';
    g.innerHTML = POMEGRANATE;
    el.appendChild(g);
  }
  if (S.aegis) { // Athena's shield, while carried
    const a = document.createElement('span');
    a.className = 'aegis-icon';
    a.innerHTML = aegisSvg(S.aegis === 1);
    a.title = S.aegis === 1 ? 'Escudo de Atena (rachado: aguenta mais uma batida)' : 'Escudo de Atena (aguenta duas batidas)';
    a.title = 'Escudo de Atena';
    el.appendChild(a);
  }
  el.setAttribute('aria-label', (lives === 1 ? '1 vida restante' : `${lives} vidas restantes`) + (S.gold ? ', uma delas dourada' : ''));
}

function onDie({ cause, kind, metres }) {
  renderLives(0, true);
  $('boost').hidden = true; // a gift of the gods ends with the run
  $('giftIntro').hidden = true; giftIntroT = 0;
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

  pendingDeath = { cause, kind, metres };
  setTimeout(() => { if (state === 'dead') showCharon(); }, cause === 'block' ? 380 : 600);
}

// Charon (v0.52, user design; a placeholder scene until the user's own art): pay to go back, or stay
function showCharon() {
  state = 'charon';
  const price = charonPrice(), can = obols >= price;
  $('charonPrice').textContent = price;
  $('charonWallet').textContent = `Você tem ${obols} ${obols === 1 ? 'óbolo' : 'óbolos'}.`;
  $('btnBribe').disabled = !can;
  $('btnBribe').textContent = can ? `Pagar ${price} óbolos` : `Faltam ${price - obols} ${price - obols === 1 ? 'óbolo' : 'óbolos'}`;
  $('charon').hidden = false;
  (can ? $('btnBribe') : $('btnStay')).focus({ preventScroll: true });
}
function bribeCharon() {
  if (state !== 'charon') return;
  const price = charonPrice();
  if (obols < price) return;
  obols -= price; store.set('obols', obols);
  run.continues = (run.continues || 0) + 1;
  stats.recordContinue(price);
  checkAchievements(Math.floor(S.dist));
  // a short close-up (v0.52.1, user's idea): Xolo's hand drops the obols into Charon's bony palm
  state = 'paying';
  const shown = Math.min(price, 5);
  document.querySelectorAll('#charon .chCoin').forEach((c, i) => { c.style.display = i < shown ? '' : 'none'; });
  document.querySelector('#charon .chPayN').textContent = price;
  $('charonWallet').textContent = 'Caronte aceita os óbolos.';
  $('charon').classList.add('paying');
  for (let i = 0; i < shown; i++) setTimeout(() => audio.sfx('coin', { i }), 450 + i * 240 + 360);
  setTimeout(() => {
    if (state !== 'paying') return;
    $('charon').classList.remove('paying');
    revive(S);
    pendingDeath = null;
    $('charon').hidden = true;
    renderLives(S.lives);
    state = 'countdown';
    countdownLeft = 1.8; // 3, 2, 1, then the run goes on from where he fell
    $('countdown').hidden = false;
    cvs.focus({ preventScroll: true });
  }, 450 + shown * 240 + 900);
}
function stayBelow() {
  if (state !== 'charon' || !pendingDeath) return;
  $('charon').hidden = true;
  state = 'dead';
  deadAt = performance.now();
  gameOver(pendingDeath);
  pendingDeath = null;
}
function gameOver({ cause, kind, metres }) {
  stats.recordRun({ metres, seconds: runSeconds, kind });
  checkAchievements(metres);
  const isRecord = metres > best;
  if (isRecord) { best = metres; store.set('best-tunnel', best); earn(3); }
  {
    // falling through the roof is falling into the sky
    const intoSky = cause !== 'block' && S.fallHole && S.fallHole.side > 0;
    $('overCause').textContent = intoSky ? 'Caiu no céu'
      : kind === 'pillar' || kind === 'bolt' || kind === 'shock' ? 'A ira de Zeus: ' + stats.KIND_LABEL[kind].toLowerCase() // the toppling column is his wrath
      : CAUSE_TEXT[cause] + (cause === 'block' ? ': ' + stats.KIND_LABEL[kind].toLowerCase() : '');
    $('overDist').textContent = metres + ' m';
    $('overBest').textContent = isRecord ? 'Novo recorde!' : `Recorde: ${best} m`;
    $('overObols').textContent = `+${run.earned || 0} ${(run.earned || 0) === 1 ? 'óbolo' : 'óbolos'} nesta corrida · você tem ${obols}`;
    $('over').hidden = false;
    $('btnAgain').focus({ preventScroll: true });
  }
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
  if (!frozen) { shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 3); zeusFlash = Math.max(0, zeusFlash - dt * 6); exitFlash = Math.max(0, exitFlash - dt * 1.2); }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (shake > 0) { const a = shake * 18; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
  drawTunnel(ctx, S, W, H, { debug, fx, quality: quality(), fixedCamera: opt.camera === 'fixed', area: tut ? 'surface' : undefined });
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (zeusFlash > 0 && state !== 'menu') { ctx.fillStyle = `rgba(215,232,255,${(zeusFlash * zeusFlash * 0.35).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  if (exitFlash > 0) { ctx.fillStyle = `rgba(255,250,232,${(exitFlash * exitFlash * 0.9).toFixed(3)})`; ctx.fillRect(0, 0, W, H); } // daylight at the cave mouth
  if (flash > 0) { ctx.fillStyle = rgb(COL.haz, flash * 0.45); ctx.fillRect(0, 0, W, H); }
  if (fx.flipFade > 0) { ctx.fillStyle = rgb(COL.cloud, fx.flipFade / 0.16 * 0.55); ctx.fillRect(0, 0, W, H); }
  const below = !tut && S.dist < UNDER_END; // the underworld (v0.53): darker scene, light HUD text
  if (below !== wasBelow) { wasBelow = below; $('stage').classList.toggle('under', below); audio.setArea(below ? 'under' : 'surface'); }
  if (state === 'menu') { ctx.fillStyle = below ? 'rgba(10,20,26,0.25)' : rgb(COL.bg, 0.25); ctx.fillRect(0, 0, W, H); }
  if (fx.popT > 0 && $('pop').textContent !== fx.popText) { $('pop').textContent = fx.popText; }
  $('pop').hidden = !(fx.popT > 0 && state === 'play');
  const showBless = fx.blessT > 0 && state === 'play';
  if (showBless && $('blessing').dataset.id !== String(fx.bless.id)) {
    $('blessing').dataset.id = fx.bless.id;
    $('blessGod').textContent = fx.bless.kind === 'wrath' ? 'A ira de Zeus' : fx.bless.kind === 'exit' ? 'Cabo Tênaro' : 'Bênção de ' + fx.bless.god;
    $('blessing').classList.toggle('wrath', fx.bless.kind === 'wrath');
    $('blessGift').textContent = fx.bless.gift;
    $('blessText').textContent = fx.bless.text;
    $('blessing').hidden = true; void $('blessing').offsetWidth; // restart the animation
  }
  $('blessing').hidden = !showBless;

  if (state === 'play' && !tut) {
    $('dist').textContent = Math.floor(S.dist) + ' m';
    // Hermes' sandals: a gold bar under the hearts counts down the seconds left
    $('boost').hidden = !(S.hermes > 0);
    if (S.hermes > 0) {
      $('boostBar').style.width = (100 * S.hermes / HERMES_TIME).toFixed(1) + '%';
      $('boostSec').textContent = Math.ceil(S.hermes);
      $('boost').classList.toggle('ending', S.hermes < 1.2);
    }
    // and a soft tick on each of the last three seconds, so the end can be heard coming
    if (S.hermes > 0 && Math.ceil(S.hermes) < Math.ceil(hermesLeft) && Math.ceil(S.hermes) <= 3) audio.sfx('boostTick', { left: Math.ceil(S.hermes) });
    hermesLeft = S.hermes;
    if (!frozen) checkGiftIntro(dt);
    const marks = Math.floor(S.dist / OBOL_EVERY); // an obol every OBOL_EVERY metres, credited as you go
    if (marks > (run.obolMarks || 0)) { earn(marks - (run.obolMarks || 0)); run.obolMarks = marks; }
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

const tempo = () => 64 + (S.speed - 13) * 3.1; // 64 bpm at the start, about 104 at top speed

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
  return { metres, cleanMetres: run.cleanMetres, flips: run.flips, slides: run.slides, gods: run.gods.size, zeus: run.zeusSurvived || 0, continues: run.continues || 0 };
}
function checkAchievements(metres) {
  for (const a of ach.evaluate(runState(metres), stats.get())) { toast(a); if (!tut) earn(1); }
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
  for (const id of ['menu', 'over', 'pause', 'stats', 'options', 'countdown', 'charon']) $(id).hidden = true;
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
  run = { flips: 0, slides: 0, cleanMetres: 0, hurt: false, gods: new Set(), earned: 0, continues: 0, obolMarks: 0 };
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
  $('charon').classList.remove('paying');
  tut = null;
  audio.stopMusic();
  S = createSim();
  clearFx();
  for (const id of ['over', 'hud', 'pause', 'stats', 'options', 'achPanel', 'countdown', 'tutHint', 'pop', 'blessing', 'boost', 'giftIntro', 'charon']) $(id).hidden = true;
  $('menu').hidden = false;
  refreshMenu();
}
function refreshMenu() {
  $('bestMenu').textContent = 'Recorde: ' + (best ? best + ' m' : '—') + ' · Óbolos: ' + obols;
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
$('btnBribe').addEventListener('click', bribeCharon);
$('btnStay').addEventListener('click', stayBelow);
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
  flip: () => flipUp(S, emit),
  surfaceOnTop: () => opt.camera === 'fixed' && S.grav > 0,
  swipePx: () => SWIPE[opt.swipe],
});
addEventListener('keydown', e => {
  const k = e.code;
  // keyboard: Space jumps and, pressed again in the air, flips (no swipes on a keyboard; v0.40.1)
  if (state === 'play' && k === 'Space') { e.preventDefault(); if (!S.grounded && S.canFlip) flipUp(S, emit); else press(S, emit); }
  else if (state === 'play' && ['ArrowUp', 'KeyW'].includes(k)) { e.preventDefault(); flipUp(S, emit); }
  else if (state === 'play' && ['ArrowDown', 'KeyS'].includes(k)) { e.preventDefault(); slide(S, emit); }
  else if ((k === 'Escape' || k === 'KeyP') && (state === 'play' || state === 'countdown')) { e.preventDefault(); pause(); }
  else if ((k === 'Escape' || k === 'KeyP' || k === 'Space' || k === 'Enter') && state === 'paused') { e.preventDefault(); resume(); }
  else if (state === 'dead' && !tut && (k === 'Space' || k === 'Enter') && performance.now() - deadAt > 450) { e.preventDefault(); start(); }
  else if (state === 'menu' && k === 'Enter' && $('stats').hidden && $('options').hidden && $('achPanel').hidden) { e.preventDefault(); start(); }
  else if (k === 'Escape' && !$('stats').hidden) closeStats();
  else if (k === 'Escape' && !$('options').hidden) { $('options').hidden = true; $('menu').hidden = false; }
  else if (k === 'Escape' && !$('achPanel').hidden) { $('achPanel').hidden = true; $('menu').hidden = false; }
  else if (k === 'Escape' && state === 'dead') toMenu();
  else if (state === 'charon' && k === 'Escape') { e.preventDefault(); stayBelow(); }
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
