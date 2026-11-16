// Athena's shield (v0.47.3, user's pick of six sketches): a blue rim with gold dots, a cream field
// with a gold ring, an owl (Athena's bird) in the black-figure mould of the vases, olive sprigs.
// One drawing, in a 20-unit box centred on 0, for the HUD icon (SVG) and the canvas (pickup, hero).
// OWL_STYLE: 'gold' (chosen) or 'black' (kept: the user may switch later).
export const OWL_STYLE = 'gold';

const C = { rim: '#466ca8', rimLine: '#2f4f80', field: '#f6f0e2', ring: '#e2b04c', dot: '#f4c45c', olive: '#6f8f45' };
const OWL = OWL_STYLE === 'black'
  ? { body: '#1f1a17', eye: '#f6f0e2', pupil: '#1f1a17', line: '#f6f0e2' }
  : { body: '#e2b04c', eye: '#f6f0e2', pupil: '#e2b04c', line: '#f6f0e2' };
const P = {
  body: 'M-3.4-1.6-3.1-3.6-1.9-2.9Q0-3.5 1.9-2.9L3.1-3.6 3.4-1.6Q4.6 2.4 2.6 5.4 0 6.8-2.6 5.4-4.6 2.4-3.4-1.6Z',
  wings: 'M-3.1 1.6Q-4.1 4.4-1.6 5.9M3.1 1.6Q4.1 4.4 1.6 5.9',
  beak: 'M-.45.7H.45L0 1.9Z',
  chest: 'M-1.4 3.2l.5.5.5-.5.5.5.5-.5.5.5.5-.5M-1 4.5l.5.5.5-.5.5.5.5-.5',
  feet: 'M-1.6 6.1v.7M-1 6.1v.7M1 6.1v.7M1.6 6.1v.7',
};
const EYES = [-1.6, 1.6];
const DOTS = Array.from({ length: 16 }, (_, i) => [9.05 * Math.cos(i / 8 * Math.PI), 9.05 * Math.sin(i / 8 * Math.PI)]);
const LEAVES = [[-5.3, 2.2, -50], [-4.5, 4.2, -25], [5.3, 2.2, 50], [4.5, 4.2, 25]];

// the HUD icon
export function aegisSvg() {
  const f = n => +n.toFixed(2);
  return `<svg viewBox="-10.5 -10.5 21 21" aria-hidden="true"><circle r="10" fill="${C.rim}" stroke="${C.rimLine}" stroke-width=".9"/><circle r="8.1" fill="${C.field}" stroke="${C.ring}" stroke-width=".7"/>`
    + DOTS.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r=".45" fill="${C.dot}"/>`).join('')
    + `<path d="${P.body}" fill="${OWL.body}"/><path d="${P.wings}" stroke="${OWL.line}" stroke-width=".5" fill="none"/>`
    + EYES.map(x => `<circle cx="${x}" cy="-.9" r="1.75" fill="${OWL.eye}" stroke="${OWL.line}" stroke-width=".35"/><circle cx="${x}" cy="-.9" r=".8" fill="${OWL.pupil}"/>`).join('')
    + `<path d="${P.beak}" fill="${OWL.pupil}"/><path d="${P.chest}" stroke="${OWL.line}" stroke-width=".4" fill="none"/><path d="${P.feet}" stroke="${OWL.line}" stroke-width=".45"/>`
    + LEAVES.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="1.3" ry=".55" transform="rotate(${r} ${x} ${y})" fill="${C.olive}"/>`).join('')
    + '</svg>';
}

// the canvas drawing, face on in a unit circle; fog (0..1) fades it toward the haze for the far pickup
let paths = null;
export function drawAegisFace(ctx, fog = 0) {
  paths = paths || Object.fromEntries(Object.entries(P).map(([k, d]) => [k, new Path2D(d)]));
  const hz = [214, 228, 234];
  const m = hex => {
    const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${v.map((c, i) => Math.round(c + (hz[i] - c) * fog)).join(',')})`;
  };
  ctx.save();
  ctx.scale(0.1, 0.1);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fillStyle = m(C.rim); ctx.fill();
  ctx.lineWidth = 0.9; ctx.strokeStyle = m(C.rimLine); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 8.1, 0, Math.PI * 2); ctx.fillStyle = m(C.field); ctx.fill();
  ctx.lineWidth = 0.7; ctx.strokeStyle = m(C.ring); ctx.stroke();
  ctx.fillStyle = m(C.dot);
  for (const [x, y] of DOTS) { ctx.beginPath(); ctx.arc(x, y, 0.45, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = m(OWL.body); ctx.fill(paths.body);
  ctx.strokeStyle = m(OWL.line);
  ctx.lineWidth = 0.5; ctx.stroke(paths.wings);
  for (const x of EYES) {
    ctx.beginPath(); ctx.arc(x, -0.9, 1.75, 0, Math.PI * 2); ctx.fillStyle = m(OWL.eye); ctx.fill();
    ctx.lineWidth = 0.35; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, -0.9, 0.8, 0, Math.PI * 2); ctx.fillStyle = m(OWL.pupil); ctx.fill();
  }
  ctx.fillStyle = m(OWL.pupil); ctx.fill(paths.beak);
  ctx.lineWidth = 0.4; ctx.stroke(paths.chest);
  ctx.lineWidth = 0.45; ctx.stroke(paths.feet);
  ctx.fillStyle = m(C.olive);
  for (const [x, y, r] of LEAVES) { ctx.beginPath(); ctx.ellipse(x, y, 1.3, 0.55, r * Math.PI / 180, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(-4.5, -5, 2.2, 1.2, -0.7, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - fog)})`; ctx.fill();
  ctx.restore();
}
