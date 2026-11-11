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
- Main character placeholder: red axolotl with laurel-like gills (`js/hero.js`), drawn from behind; the golem of the ruin is the runner-up. World placeholder (v0.8): the tunnel is a seaside stoa of white marble on a sunny day. Floor = marble lane, ceiling = coffered roof with a painted frieze, sides = columns with sky and sea between. Missing surfaces are simply not drawn so the backdrop shows (open sky above, sea below); columns break where the roof is gone. Obstacles: low = low wall or fallen column drum, tall floor = ruined wall, tall ceiling = fallen painted lintel. Palette lives in `COL` (`js/config.js`). The user's own visual prototypes will replace this.
- Balance notes: the low violet block is less forgiving than holes; platforms on the open side have little reason to be used yet.
