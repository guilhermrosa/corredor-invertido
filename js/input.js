// Touch controls for a run (v0.40: one gesture per action). A touch acts at once: it jumps from a
// surface (in the air it is remembered and jumps on landing; slipping into a hole, it flips him
// out). Then the same finger can drag:
// - toward the surface the hero stands on: slide (in the air: drop fast, slide on landing);
// - away from it: flip gravity (from a surface that is the touch's jump plus a flip); a touch
//   that already flipped is not flipped back.
// The hero's surface is at the bottom of the screen, except with the "sem girar" camera on the
// roof, where it is at the top, so the directions follow the hero.
//
// `game` supplies: active() (a run is being played), press() → 'jump' | 'flip' | 'buffer' | null,
// flip() (swipe away), slide(), surfaceOnTop(), swipePx(), onTouch().

const SWIPE_TIME = 300;  // ms after the touch within which a drag counts as a swipe
const SWIPE_SLOPE = 1.4; // the vertical travel must be at least this many times the sideways one

export function bindTouch(cvs, game) {
  let touch = null;
  cvs.addEventListener('pointerdown', e => {
    e.preventDefault();
    game.onTouch();
    if (!game.active()) return;
    const did = game.press();
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), swiped: false, did };
    try { cvs.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cvs.addEventListener('pointermove', e => {
    if (!touch || touch.swiped || e.pointerId !== touch.id || !game.active()) return;
    // v0.48.8 (accidental flips "sometimes" in the user's playtest): a swipe must be quick (within
    // SWIPE_TIME of the touch, it was 450 ms) and mostly vertical (a thumb rolling sideways while it taps
    // used to count), so a tap whose finger drifts a little no longer flips or slides
    if (performance.now() - touch.t > SWIPE_TIME) return;
    const dy = e.clientY - touch.y, dx = e.clientX - touch.x;
    if (Math.abs(dy) < Math.abs(dx) * SWIPE_SLOPE) return;
    const toward = dy * (game.surfaceOnTop() ? -1 : 1); // + toward the hero's surface
    if (toward > game.swipePx()) { touch.swiped = true; game.slide(); }
    else if (-toward > game.swipePx()) {
      touch.swiped = true;
      if (touch.did !== 'flip') game.flip();
    }
  });
  const endTouch = e => { if (touch && e.pointerId === touch.id) touch = null; };
  cvs.addEventListener('pointerup', endTouch);
  cvs.addEventListener('pointercancel', endTouch);
}
