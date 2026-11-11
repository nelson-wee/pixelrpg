# pixelrpg

- The pixelfx library is a git submodule at `vendor/pixelfx`. If it is empty, run `git submodule update --init`.
- When the pixelfx skill says to work in a pixelfx checkout, use `vendor/pixelfx`. Run its tools from that folder, for example `cd vendor/pixelfx && node tools/render.mjs fire/torch`. Do not clone a second copy.
- Do not edit files in `vendor/pixelfx`. To use an effect in the game, add it to the list in `tools/fx.mjs` and run `npm run fx`.
- New effects of our own go in `docs/fx/<category>/<name>.js`, in the pixelfx file format, importing the core from `../../pixelfx/core/index.js` (copied there by `npm run site`). Render and check them with `node tools/fxlab.mjs <category>/<name>` (it uses one of our units as the actor), and follow the pixelfx skill's look-and-refine loop.
- `sprites/` is generated output. The drawing code is in `docs/lib/pixelrpg.js` (shared with the web viewer). The sheet exports are in `tools/art.mjs`. To change the art, change those files and run `npm run art`, then commit the code and the sprites together.
- `docs/` is the GitHub Pages site. `docs/lib/pixelrpg.js` must stay free of Node APIs so that it runs in the browser.
- The battle rules are in `docs/lib/battle.js`. Keep them free of DOM and Node APIs. Run `npm test` after you change them. The demo map in that file is also used by `tools/art.mjs`.
- The art rules (palette, 48 × 76 unit cell, gear slots, stances, 48 × 24 tiles) are in `README.md`. Keep new art inside them.
