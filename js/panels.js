// Menu panels and pop-ups: the stats panel (Estatísticas), the achievements list (Conquistas)
// and the toast that announces an unlocked achievement.

import * as audio from './audio.js';
import * as stats from './stats.js';
import * as ach from './achievements.js';
import { STEPS } from './tutorial.js';

const $ = id => document.getElementById(id);

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

export function renderStats() {
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

// ---- achievements ----
const toastQueue = [];
let toastBusy = false;
export function toast(a) {
  toastQueue.push(a);
  if (toastBusy) return;
  const next = () => {
    const item = toastQueue.shift();
    if (!item) { toastBusy = false; return; }
    toastBusy = true;
    $('toastName').textContent = item.name;
    $('toastDesc').textContent = item.desc;
    $('toast').hidden = false;
    audio.sfx('milestone');
    setTimeout(() => { $('toast').hidden = true; setTimeout(next, 250); }, 2600);
  };
  next();
}
export function renderAchievements() {
  $('achCount').textContent = `${ach.count()} de ${ach.ACHIEVEMENTS.length} desbloqueadas`;
  $('achList').innerHTML = ach.ACHIEVEMENTS.map(a => {
    const at = ach.unlockedAt(a.id);
    const when = at ? new Date(at).toLocaleDateString('pt-BR') : '';
    return `<li class="ach ${at ? 'done' : ''}"><span class="ach-mark" aria-hidden="true">${at ? '★' : '☆'}</span><span><b>${a.name}</b><small>${a.desc}${at ? ' · ' + when : ''}</small></span></li>`;
  }).join('');
}
