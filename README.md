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
| `tools/art.mjs` | The generator: palette, skeleton, gear, stances, attacks, tiles, props, icons, UI frames, battle map |
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
- **Gear:** one base body (male or female) plus 8 slots: head, shoulders, chest, arms, legs, back, main hand and off hand. Each layer has its own outline. There are 77 pieces and 3 tiers for each class.
- **Silhouette:** heavy armour makes a V shape, robes make an A shape, and light gear makes an I shape.
- **Stances:** the equipped weapon selects the stance: guard, caster, archer, dual wield or lancer. Units face SE (front) or NW (back), with the feet on the tile diagonal.
- **Attacks:** 4 frames (ready 560 ms, wind-up 320 ms, strike 200 ms, follow-through 350 ms) in a 96 × 76 px cell, with the feet at (48, 72).
- **Tiles:** 48 × 24 px on a 2:1 grid, with 12 px for each height step. Screen X = (col − row) × 24. Screen Y = (col + row) × 12 − height × 12.

## Main files in `sprites/art`

| File | Layout |
|---|---|
| `unit-<class>.png` | 4 frames of 48 × 76: front idle ×2, back idle ×2 |
| `tiers.png` | 6 rows (classes) × 6 columns (T1–T3 male, T1–T3 female) |
| `attacks.png` | 6 rows × 8 frames of 96 × 76: 4 SE poses, then 4 NW poses |
| `atlas-<m\|f>-<stance>.png` | Every gear layer alone, 12 columns of 48 × 76. Cell positions are in `gear.json` |
| `battle-map.png` | The 11 × 11 sample map, 552 × 412 |
| `tiles-*.png`, `props.png`, `icons.png`, `frame-*.png` | Terrain, height steps, tile markers, props, 16 px icons, 9-slice windows |

## Credits and licences

- pixelfx is © 2026 Patch and Hugo Duprez, MIT licence. See `vendor/pixelfx/LICENSE` and `vendor/pixelfx/NOTICE.md`. The skill in `.claude/skills/pixelfx/` is a copy of the pixelfx skill, with its licence next to it.
- The art direction takes inspiration from 2.5D MMO and tactics RPG sprite work. It copies no characters or assets from other games.
