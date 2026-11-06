# pixelrpg

- The pixelfx library is a git submodule at `vendor/pixelfx`. If it is empty, run `git submodule update --init`.
- When the pixelfx skill says to work in a pixelfx checkout, use `vendor/pixelfx`. Run its tools from that folder, for example `cd vendor/pixelfx && node tools/render.mjs fire/torch`. Do not clone a second copy.
- Do not edit files in `vendor/pixelfx`. To use an effect in the game, add it to the list in `tools/fx.mjs` and run `npm run fx`.
- `sprites/` is generated output. To change the art, change `tools/art.mjs` and run `npm run art`, then commit the code and the sprites together.
- The art rules (palette, 48 × 76 unit cell, gear slots, stances, 48 × 24 tiles) are in `README.md`. Keep new art inside them.
