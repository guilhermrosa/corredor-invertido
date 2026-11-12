// Touch controls for a run. Every touch acts at once (jump on a surface, flip in the air).
// Then the same finger can drag:
// - toward the surface the hero stands on: slide (in the air: drop fast, slide on landing);
// - away from it: flip gravity. From a surface that is the touch's jump plus a flip in one
//   gesture; a touch that already flipped is not flipped back.
// The hero's surface is at the bottom of the screen, except with the "sem girar" camera on the
// roof, where it is at the top, so the directions follow the hero.
//
// `game` supplies: active() (a run is being played), press() → 'jump' | 'flip' | 'buffer' | null,
// slide(), heroJumping() (still in the air from a jump), surfaceOnTop(), swipePx(), onTouch().

export function bindTouch(cvs, game) {
  let touch = null;
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault();
    game.onTouch();
    if (!game.active()) return;
    const did = game.press();
    touch = { id: e.pointerId, y: e.clientY, t: performance.now(), swiped: false, did };
    try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cvs.addEventListener('pointermove', e => {
    if (!touch || touch.swiped || e.pointerId !== touch.id || !game.active()) return;
    if (performance.now() - touch.t > 450) return;
    const toward = (e.clientY - touch.y) * (game.surfaceOnTop() ? -1 : 1); // + toward the hero's surface
    if (toward > game.swipePx()) { touch.swiped = true; game.slide(); }
    else if (-toward > game.swipePx()) {
      touch.swiped = true;
      if (touch.did === 'jump' && game.heroJumping()) game.press(); // jumped on touch: now flip
    }
  });
  const endTouch = e => { if (touch && e.pointerId === touch.id) touch = null; };
  cvs.addEventListener('pointerup', endTouch);
  cvs.addEventListener('pointercancel', endTouch);
}
