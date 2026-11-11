# Corredor Invertido

Browser endless runner (pseudo-3D tunnel), shipped as a PWA on GitHub Pages from `main` (root). No build step, no dependencies: static files and native ES modules.

## Conventions

- Keep `js/sim.js` free of drawing and audio. It reports events through `emit(type, data)`; `main.js` routes them to `audio.js`. The renderer (`js/render.js`) only reads state.
- `js/lyre.js` is shared with the `guilhermrosa/lira-de-bolso` repository. Keep both copies identical; change one, copy to the other.
- When adding or renaming a file the game loads, add it to `SHELL` in `sw.js`.
- On every release, bump `VERSION` in `sw.js` and the version label in `index.html`.
- UI text is in Brazilian Portuguese.
- Test with a local server (`python3 -m http.server`); modules do not load from `file://`.

## Design state

- Chosen sound: lyre preset "Ruína" (chip 24, bright 30, sustain 80, echo 37), Dorian mode on D. Effects and music react to the game.
- Main character placeholder: red humanoid axolotl drawn from behind after the user's silhouette sketch (big oval head, three long fringed gills per side, slim body, asymmetric running pose with a raised open hand and a kicked-back leg showing its sole, long tail with a crest) in `js/hero.js`; the golem of the ruin is the runner-up. World placeholder (v0.8): the tunnel is a seaside stoa of white marble on a sunny day. Floor = marble lane, ceiling = coffered roof with a painted frieze, sides = columns with sky and sea between. Missing surfaces are simply not drawn so the backdrop shows (open sky above, sea below); columns break where the roof is gone. Obstacles: low = low wall or fallen column drum, tall floor = ruined wall, tall ceiling = fallen painted lintel. Palette lives in `COL` (`js/config.js`). The user's own visual prototypes will replace this.
- Camera: chase view turned about 8° to the left (`CAMERA` in `js/render.js`). The stronger three-quarter view from the user's framing sketch (v0.12–0.13) was judged too sideways; its values are noted in the comment. The camera mirrors while rolling onto the ceiling so the screen composition stays the same.
- Slide (v0.13): swipe down / ↓ / S. On a surface it slides for `SLIDE_TIME` with height `SLIDE_H`; in the air it drops fast and slides on landing. In the air, touches wait up to 110 ms (or finger lift) before flipping so a swipe never flips by accident; on a surface the tap still jumps at once. Fallen portals (`type: 'portal'`, from `PORTAL_FROM` m) are solid from just above a `PORTAL_GAP` gap on their side to the opposite surface, so the only way past is sliding on that side.
- Layout: everything lives in `#stage`, a portrait frame capped at 9:16 and centred, with solid `--side` bars on wide screens (computers); on phones it fills the screen. HUD and overlays are positioned inside the stage.
- Mirror option (menu toggle "Espelhar tela", stored as `ci-mirror`): flips the canvas left to right with CSS; HUD and menus are not mirrored.
- Collisions: `blockHitbox()` / `holeKillZone()` in `js/sim.js` follow each obstacle's drawn shape, trimmed by `HIT` (`js/config.js`) so grazing feels fair; keep them in sync when an obstacle's look changes. Hitbox view: H key, or tap the menu's version label 5 times.
- Balance notes: low blocks got a larger trim (`HIT.low`) because they were less forgiving than holes; platforms on the open side have little reason to be used yet.
