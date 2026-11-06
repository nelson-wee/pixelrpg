# pixelrpg

A pixel art design system for an isometric, grid-based fantasy tactics RPG. All the art comes from code: class sprites with layered gear, two body types, five combat stances, attack frames, isometric tiles, props, icons, UI frames and a sample battle map. The skill effects come from [pixelfx](https://github.com/patch-gg/pixelfx) and use the same palette.

## Get started

```bash
git clone --recurse-submodules https://github.com/nelson-wee/pixelrpg
```

If you cloned without submodules, get pixelfx with this command:

```bash
git submodule update --init
```

The tools need Node 18 or newer. They use no packages.

## Web viewer (GitHub Pages)

`docs/` is a static site: the Wardrobe. It draws units live in the browser with the same sprite code that makes the sheets. You can select class tiers, any gear piece, the male or female body, the hair colour and the SE or NW facing, and switch between the idle and the attack animation.

To publish it, open the repository's **Settings → Pages**. Set **Source** to "Deploy from a branch", **Branch** to `dev` (or `main` after a merge) and **Folder** to `/docs`. To try it on your own computer, serve the `docs` folder with any static server:

```bash
python3 -m http.server --directory docs 8000
```

## Make the sprites again

```bash
npm run art
```

```bash
npm run fx
```

`npm run art` writes to `sprites/art`. `npm run fx` writes to `sprites/fx`. The output is deterministic: the same code gives the same pixels. To look at a sheet at a larger scale, use the preview tool:

```bash
node tools/zoom.mjs sprites/art/tiers.png preview.png 3
```

## What is in the repository

| Path | Contents |
|---|---|
| `docs/lib/pixelrpg.js` | The sprite core: palette, skeleton, gear, stances, attacks, tiles, props, icons, UI frames. Pure JavaScript, used by both the generator and the web viewer |
| `tools/art.mjs` | The generator: writes every sheet in `sprites/art`, the battle map and the combat clips |
| `docs/index.html`, `docs/app.js` | The web viewer (Wardrobe) |
| `tools/fx.mjs` | Renders the chosen pixelfx effects as one-row strips at 15 fps, recoloured with the system ramps |
| `tools/zoom.mjs` | Nearest-neighbour preview of a PNG |
| `sprites/art/` | Generated sheets and atlases, plus `gear.json` (atlas cells, shoulder and hem widths) and `art.json` |
| `sprites/fx/` | Effect strips and `fx.json` (frame size, count, fps, pivot) |
| `vendor/pixelfx/` | The pixelfx library, as a git submodule |
| `.claude/skills/pixelfx/` | The pixelfx skill for Claude Code |

## The rules in short

- **Palette:** 18 ramps of 5 steps. Dark steps go cooler and light steps go warmer. There are no gradients and no anti-aliasing.
- **Light:** one light, from the top left. Each shape has an outline in step 0 of its own ramp. Ink (`#2a1f2d`) is used only on the bottom-right edges.
- **Units:** a 48 × 76 px cell, with the feet at (24, 72). A unit is about 5 heads tall.
- **Gear:** one base body (male or female) plus 8 slots: head, shoulders, chest, arms, legs, back, main hand and off hand. Each layer has its own outline. There are 79 pieces and 3 tiers for each class.
- **Silhouette:** heavy armour makes a V shape, robes make an A shape, and light gear makes an I shape.
- **Stances:** the equipped weapon selects the stance: guard, caster, archer, dual wield, lancer, greatsword, or spear and shield. Units face SE (front) or NW (back), with the feet on the tile diagonal.
- **Two-handed weapons:** the greatsword, the spear and the dragon lance use both hands, so the off-hand layer is not drawn. The short spear is one-handed and goes with a shield. It uses the guard ready pose and has its own thrust attack.
- **Attacks:** 4 frames (ready 560 ms, wind-up 320 ms, strike 200 ms, follow-through 350 ms) in a 96 × 76 px cell, with the feet at (48, 72).
- **Effects on attacks:** an effect starts so that its own `act` hit time lands on our strike frame. On the hit, the whole picture freezes for the effect's hit-stop. Melee effects tilt 0.2–0.25 rad down to face SE. Projectiles start at the releasing hand on the strike frame and fly to the target's body centre (16 px above its feet), at 24 px per frame for arrows and 16 px per frame for spells.
- **Tiles:** 48 × 24 px on a 2:1 grid, with 12 px for each height step. Screen X = (col − row) × 24. Screen Y = (col + row) × 12 − height × 12.

## Main files in `sprites/art`

| File | Layout |
|---|---|
| `unit-<class>.png` | 4 frames of 48 × 76: front idle ×2, back idle ×2 |
| `tiers.png` | 6 rows (classes) × 6 columns (T1–T3 male, T1–T3 female) |
| `attacks.png` | 8 rows × 8 frames of 96 × 76: 4 SE poses, then 4 NW poses. Rows: the 6 classes, then the knight with a greatsword, then the lancer with spear and shield |
| `atlas-<m\|f>-<stance>.png` | Every gear layer alone, 12 columns of 48 × 76. Cell positions are in `gear.json`. The phalanx (spear and shield) atlas is the same as the guard atlas |
| `combat-<clip>.png` | Attack clips with pixelfx effects, one row at 15 fps: knight sword, knight greatsword, thief X cut, lancer thrust, lancer spear and shield, mage fireball, archer arrow. Frame size, hit frame and hit-stop are in `combat.json` |
| `battle-map.png` | The 11 × 11 sample map, 552 × 412 |
| `tiles-*.png`, `props.png`, `icons.png`, `frame-*.png` | Terrain, height steps, tile markers, props, 16 px icons, 9-slice windows |

## Credits and licences

- pixelfx is © 2026 Patch and Hugo Duprez, MIT licence. See `vendor/pixelfx/LICENSE` and `vendor/pixelfx/NOTICE.md`. The skill in `.claude/skills/pixelfx/` is a copy of the pixelfx skill, with its licence next to it.
- The art direction takes inspiration from 2.5D MMO and tactics RPG sprite work. It copies no characters or assets from other games.
