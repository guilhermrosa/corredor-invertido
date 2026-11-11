// Entry point: game loop, input, menus, tutorial, pause, stats panel and offline support.

import { COL, rgb } from './config.js';
import { createSim, update, press, slide } from './sim.js';
import { drawTunnel } from './render.js';
import * as audio from './audio.js';
import * as stats from './stats.js';
import { STEPS, createTutorial, startStep, progress } from './tutorial.js';
import { fx, onLand, whileSliding, onHit, onInstantFlip, onMilestone, updateFx, clearFx } from './fx.js';

const $ = id => document.getElementById(id);
const VERSION_LABEL = 'Versão 0.23';
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
let mirrored = store.get('mirror', false);
let tutorialDone = store.get('tutorial-done', false);
// comfort options (menu → Opções)
let vibrate = store.get('vibrate', false);  // off unless the player turns it on
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let cameraMode = store.get('camera', reduceMotion ? 'instant' : 'animated'); // animated | instant
const SWIPE = { low: 40, normal: 26, high: 14 };  // pixels a finger must travel down to slide
const SWIPE_LABEL = { low: 'baixa', normal: 'normal', high: 'alta' };
let swipeLevel = store.get('swipe', 'normal');
if (!SWIPE[swipeLevel]) swipeLevel = 'normal';
function buzz(ms) { if (vibrate) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

// ---- state ----
// menu | play | dead | paused | countdown
let state = 'menu';
let S = createSim();
let tut = null;            // tutorial in progress, or null for a normal run
let runSeconds = 0;        // time actually played in this run (pauses excluded)
let shake = 0, flash = 0, deadAt = 0;
let countdownLeft = 0;
let debug = store.get('debug', false); // hitbox view: H key, or tap the version label 5 times

const emit = (type, data) => {
  if (state !== 'play') return; // the menu's autopilot stays silent
  if (type === 'die') return onDie(data);
  if (!tut) stats.countAction(type);
  audio.sfx(type, data);
  if (type === 'hurt') return onHurt(data);
  if (type === 'land') onLand(data.side);
  else if (type === 'milestone') onMilestone(data.metres);
  else if (type === 'flip') {
    buzz(12);
    if (cameraMode === 'instant') { S.camT = data.toCeiling ? 1 : 0; onInstantFlip(); }
  } else if (type === 'slide') buzz(10);
};

const CAUSE_TEXT = { void: 'Caiu no vazio', hole: 'Caiu no buraco', block: 'Bateu' };

// lost a life but the run goes on
function onHurt({ cause, kind, lives }) {
  stats.recordHurt(kind); // the hurt sound already played via emit
  buzz(30);
  shake = 0.3; flash = 0.7;
  if (cause === 'block') onHit(S);
  renderLives(lives, true);
}
function renderLives(lives, justLost = false) {
  const el = $('lives');
  el.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const h = document.createElement('span');
    h.className = 'heart' + (i < lives ? '' : ' lost') + (justLost && i === lives ? ' pulse' : '');
    h.textContent = i < lives ? '♥' : '♡';
    el.appendChild(h);
  }
  el.setAttribute('aria-label', lives === 1 ? '1 vida restante' : `${lives} vidas restantes`);
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
  const isRecord = metres > best;
  if (isRecord) { best = metres; store.set('best-tunnel', best); }
  setTimeout(() => {
    if (state !== 'dead') return;
    $('overCause').textContent = CAUSE_TEXT[cause] + (cause === 'block' ? ': ' + stats.KIND_LABEL[kind].toLowerCase() : '');
    $('overDist').textContent = metres + ' m';
    $('overBest').textContent = isRecord ? 'Novo recorde!' : `Recorde: ${best} m`;
    $('over').hidden = false;
    $('btnAgain').focus({ preventScroll: true });
  }, cause === 'block' ? 380 : 600);
}

// ---- loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30);
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
  drawTunnel(ctx, S, W, H, { debug, fx });
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (flash > 0) { ctx.fillStyle = rgb(COL.haz, flash * 0.45); ctx.fillRect(0, 0, W, H); }
  if (fx.flipFade > 0) { ctx.fillStyle = rgb(COL.cloud, fx.flipFade / 0.16 * 0.55); ctx.fillRect(0, 0, W, H); }
  if (state === 'menu') { ctx.fillStyle = rgb(COL.bg, 0.25); ctx.fillRect(0, 0, W, H); }
  if (fx.popT > 0 && $('pop').textContent !== fx.popText) { $('pop').textContent = fx.popText; }
  $('pop').hidden = !(fx.popT > 0 && state === 'play');

  if (state === 'play' && !tut) $('dist').textContent = Math.floor(S.dist) + ' m';
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
const tempo = () => 64 + (S.speed - 9) * 2.4;

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
function finishTutorial() {
  stats.recordTutorial('completed');
  tutorialDone = true;
  store.set('tutorial-done', true);
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
  for (const id of ['over', 'hud', 'pause', 'stats', 'options', 'countdown', 'tutHint', 'pop']) $(id).hidden = true;
  $('menu').hidden = false;
  refreshMenu();
}
function refreshMenu() {
  $('bestMenu').textContent = 'Recorde: ' + (best ? best + ' m' : '—');
  $('verLabel').textContent = VERSION_LABEL + (debug ? ' · colisões visíveis' : '');
  $('btnMusic').textContent = 'Música: ' + (audio.settings.music ? 'ligada' : 'desligada');
  $('btnSfx').textContent = 'Efeitos: ' + (audio.settings.sfx ? 'ligados' : 'desligados');
  $('btnMusic').setAttribute('aria-pressed', audio.settings.music);
  $('btnSfx').setAttribute('aria-pressed', audio.settings.sfx);
  $('btnMirror').textContent = 'Espelhar tela: ' + (mirrored ? 'sim' : 'não');
  $('btnMirror').setAttribute('aria-pressed', mirrored);
  $('btnVibrate').textContent = 'Vibração: ' + (vibrate ? 'ligada' : 'desligada');
  $('btnVibrate').setAttribute('aria-pressed', vibrate);
  $('btnCamera').textContent = 'Giro da câmera: ' + (cameraMode === 'instant' ? 'instantâneo' : 'animado');
  $('btnSwipe').textContent = 'Sensibilidade do arrasto: ' + SWIPE_LABEL[swipeLevel];
  cvs.classList.toggle('mirrored', mirrored);
  const muted = !audio.settings.music && !audio.settings.sfx;
  $('btnSound').textContent = muted ? 'Som: desligado' : 'Som: ligado';
}

// ---- stats panel ----
const fmtTime = s => {
  s = Math.round(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${m} min` : m ? `${m} min ${r} s` : `${r} s`;
};
const fmtDate = iso => {
  try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
};
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function bars(rows) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return rows.map(([label, n]) =>
    `<div class="bar-row"><span class="bar-label">${esc(label)}</span><span class="bar"><i style="width:${(n / max) * 100}%"></i></span><span class="bar-n">${n}</span></div>`,
  ).join('');
}

function renderStats() {
  const d = stats.get();
  const avg = d.runs ? Math.round(d.totalMetres / d.runs) : 0;
  const deathRows = Object.entries(stats.KIND_LABEL).map(([k, label]) => [label, d.deaths[k] || 0]).sort((a, b) => b[1] - a[1]);
  const bucketRows = stats.BUCKETS.map((b, i) => [stats.bucketLabel(b), d.buckets[i] || 0]);
  const tutRows = STEPS.map((st, i) =>
    `<tr><td>${i + 1}. ${esc(st.name)}</td><td class="num">${d.tutorial.passed[i + 1] || 0}</td><td class="num">${d.tutorial.retries[i + 1] || 0}</td></tr>`).join('');
  const recent = d.recent.slice(0, 10).map(r =>
    `<tr><td>${fmtDate(r.at)}</td><td class="num">${r.metres} m</td><td>${esc(stats.KIND_LABEL[r.kind] || '—')}</td></tr>`).join('');
  $('statsBody').innerHTML = d.runs === 0 && !d.tutorial.completed
    ? '<p class="hint">Nenhuma corrida registrada ainda. Jogue uma partida e volte aqui.</p>'
    : `
    <div class="tiles">
      <div><b>${d.runs}</b><small>corridas</small></div>
      <div><b>${d.best} m</b><small>recorde</small></div>
      <div><b>${avg} m</b><small>média por corrida</small></div>
      <div><b>${(d.totalMetres / 1000).toFixed(1)} km</b><small>distância total</small></div>
      <div><b>${fmtTime(d.totalSeconds)}</b><small>tempo jogado</small></div>
      <div><b>${d.actions.jump + d.actions.flip + d.actions.slide}</b><small>ações</small></div>
    </div>
    <h3>O que encerrou as corridas</h3>${bars(deathRows)}
    <h3>Vidas perdidas (a corrida continuou)</h3>${bars(Object.entries(stats.KIND_LABEL).map(([k, label]) => [label, (d.hurts || {})[k] || 0]).sort((a, b) => b[1] - a[1]))}
    <h3>Até onde as corridas chegaram</h3>${bars(bucketRows)}
    <h3>Ações</h3>${bars([['Pulos', d.actions.jump], ['Inversões', d.actions.flip], ['Deslizes', d.actions.slide]])}
    <h3>Tutorial</h3>
    <p class="hint">Tutorial inteiro concluído ${d.tutorial.completed} ${d.tutorial.completed === 1 ? 'vez' : 'vezes'} · pulado ${d.tutorial.skipped} ${d.tutorial.skipped === 1 ? 'vez' : 'vezes'}.</p>
    <div class="table-wrap"><table><thead><tr><th>Passo</th><th class="num">Concluído</th><th class="num">Repetições</th></tr></thead><tbody>${tutRows}</tbody></table></div>
    <p class="hint">Repetições: quantas vezes o passo teve de ser refeito depois de uma batida ou queda.</p>
    ${recent ? `<h3>Últimas corridas</h3><div class="table-wrap"><table><thead><tr><th>Quando</th><th class="num">Distância</th><th>Fim</th></tr></thead><tbody>${recent}</tbody></table></div>` : ''}
    <p class="hint">Registrado desde ${fmtDate(d.since)}.</p>`;
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
$('btnOptions').addEventListener('click', () => { $('menu').hidden = true; $('options').hidden = false; $('optionsClose').focus({ preventScroll: true }); });
$('optionsClose').addEventListener('click', () => { $('options').hidden = true; $('menu').hidden = false; });
$('btnVibrate').addEventListener('click', () => { vibrate = !vibrate; store.set('vibrate', vibrate); buzz(30); refreshMenu(); });
$('btnCamera').addEventListener('click', () => { cameraMode = cameraMode === 'instant' ? 'animated' : 'instant'; store.set('camera', cameraMode); refreshMenu(); });
$('btnSwipe').addEventListener('click', () => {
  const order = ['low', 'normal', 'high'];
  swipeLevel = order[(order.indexOf(swipeLevel) + 1) % order.length];
  store.set('swipe', swipeLevel);
  refreshMenu();
});
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
$('btnAgain').addEventListener('click', start);
$('btnBack').addEventListener('click', toMenu);
$('btnPause').addEventListener('click', e => { e.stopPropagation(); pause(); });
$('btnResume').addEventListener('click', resume);
$('btnQuit').addEventListener('click', toMenu);
$('btnSkipTut').addEventListener('click', e => { e.stopPropagation(); skipTutorial(); });
$('btnMusic').addEventListener('click', () => { audio.settings.music = !audio.settings.music; store.set('music', audio.settings.music); refreshMenu(); });
$('btnSfx').addEventListener('click', () => { audio.settings.sfx = !audio.settings.sfx; store.set('sfx', audio.settings.sfx); refreshMenu(); });
$('btnMirror').addEventListener('click', () => { mirrored = !mirrored; store.set('mirror', mirrored); refreshMenu(); });
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

// Touch controls: every touch acts at once (jump on a surface, flip in the air).
// Dragging that same touch down then slides: on a surface right away; in the air it drops
// fast toward the surface gravity points to and slides on landing (after a flip, that is the
// new surface, so tap + tap-and-drag gets you sliding on the other side).
let touch = null;
cvs.addEventListener('pointerdown', e => {
  e.preventDefault();
  audio.unlock();
  if (state !== 'play') return;
  press(S, emit);
  touch = { id: e.pointerId, y: e.clientY, t: performance.now(), swiped: false };
  try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
cvs.addEventListener('pointermove', e => {
  if (!touch || touch.swiped || e.pointerId !== touch.id || state !== 'play') return;
  if (performance.now() - touch.t > 450) return;
  if (e.clientY - touch.y > SWIPE[swipeLevel]) { touch.swiped = true; slide(S, emit); }
});
const endTouch = e => { if (touch && e.pointerId === touch.id) touch = null; };
cvs.addEventListener('pointerup', endTouch);
cvs.addEventListener('pointercancel', endTouch);
addEventListener('keydown', e => {
  const k = e.code;
  if (state === 'play' && ['Space', 'ArrowUp', 'KeyW'].includes(k)) { e.preventDefault(); press(S, emit); }
  else if (state === 'play' && ['ArrowDown', 'KeyS'].includes(k)) { e.preventDefault(); slide(S, emit); }
  else if ((k === 'Escape' || k === 'KeyP') && (state === 'play' || state === 'countdown')) { e.preventDefault(); pause(); }
  else if ((k === 'Escape' || k === 'KeyP' || k === 'Space' || k === 'Enter') && state === 'paused') { e.preventDefault(); resume(); }
  else if (state === 'dead' && !tut && (k === 'Space' || k === 'Enter') && performance.now() - deadAt > 450) { e.preventDefault(); start(); }
  else if (state === 'menu' && k === 'Enter' && $('stats').hidden && $('options').hidden) { e.preventDefault(); start(); }
  else if (k === 'Escape' && !$('stats').hidden) closeStats();
  else if (k === 'Escape' && !$('options').hidden) { $('options').hidden = true; $('menu').hidden = false; }
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
    navigator.serviceWorker.register('sw.js').then(reg => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
