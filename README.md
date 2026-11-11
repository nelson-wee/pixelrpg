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

`docs/` is a static site with two pages. The Wardrobe (`index.html`) draws units live in the browser with the same sprite code that makes the sheets. You can select class tiers, any gear piece, the male or female body, the hair colour and the facing, and play the idle, attack, hurt (flinch) or block animation. The Ward row previews the two shield effects on the unit. The battle demo (`battle.html`) is described below.

To play live gear effects, the viewer needs the pixelfx source in `docs/pixelfx` (git-ignored). `npm run site` copies it there, and the Pages workflow runs the same step before it uploads the site.

To publish it, open the repository's **Settings → Pages**. Set **Source** to "Deploy from a branch", **Branch** to `dev` (or `main` after a merge) and **Folder** to `/docs`. To try it on your own computer, serve the `docs` folder with any static server:

```bash
npm run site
python3 -m http.server --directory docs 8000
```

## Battle demo

`docs/battle.html` is a small playable battle on the demo map: six player units against six enemy units. The enemies use the same six classes as the player, with the middle gear tier and the other body type. There are no monsters.

- **Stats:** each unit has health and attack. Casters also have MP. Move and range come from the class.
- **Skills:** a second kind of action. A skill uses MP and takes the unit's action for the turn, like an attack. MP does not come back during the battle. **Heal** (cleric, 6 MP, range 0–3) gives one ally up to 14 HP, and the caster can heal itself. **Fireball** (mage, 8 MP, range 2–4) hits the target tile and its 4 grid neighbours (no diagonals) for 10 damage × side, seen from the caster's tile. It also hits the caster's own units. The preview lists every unit that the skill touches. The effects come from pixelfx (`holy/heal` on the target's own sprite mask, `explosions/plasma-explosion` in the fire ramp) and load from `docs/pixelfx`. Without those files, simple pixel sparks stand in. Skills are data in `SKILLS` in `docs/lib/battle.js`.
- **Facing:** damage = attack × side. An attack from the front does ×1, from the side ×1.25 and from the back ×1.5. The side comes from `attackSide` and the defender's facing. A unit turns to its target when it attacks and faces its last step when it moves. A unit that is hit does not turn. At the end of each action, the player selects the unit's facing; the map shows its front, side and back tiles.
- **Turns:** a player phase, then an enemy phase. In a phase, each unit can move once and act once (attack or skill).
- **Map:** water and props block movement, and one step can go up or down 2 height levels at most.
- **Controls:** every step has a button, so the game plays on a phone. Select a unit (or use Next unit), then a command: Move, Attack, Skills, Wait, or Cancel / Undo move. Skills opens a list with the MP cost of each skill. Heal selects the most hurt ally first (Previous and Next change it). Fireball aims at the best tile first; the direction pad, Previous foe and Next foe move the aim, and orange tiles show the area. Move shows a direction pad for the cursor and a Move here button. Attack selects the best target first; Previous and Next change the target, and the preview shows the damage before you attack. At the end, a direction pad selects the facing (NW, NE, SW, SE), then Done. Taps on the map, a mouse and the keyboard (arrow keys, Enter, Escape) are shortcuts for the same steps.
- **Team colours:** the enemy side wears a team colour scheme, so the two sides read apart. Select it on the page: Crimson (the default), Ebony, Verdant, or the gear's own colours.
- **Enemy AI:** it tries every tile it can reach and takes the attack or skill with the best score. Damage and kills count for an attack. A heal counts the health it restores when an ally lost 6 or more. A fireball counts the damage to foes and pays double for damage to its own side. A kill counts most, so it looks for side and back attacks. With no target in reach, it walks toward the nearest foe. At the end, it faces the nearest foe.

| Class | Health | MP | Attack | Move | Range | Skills |
|---|---|---|---|---|---|---|
| Knight | 42 | – | 10 | 3 | 1 | – |
| Lancer | 36 | – | 11 | 4 | 1–2, straight line | – |
| Thief | 28 | – | 9 | 5 | 1 | – |
| Archer | 26 | – | 9 | 4 | 2–4 | – |
| Mage | 22 | 20 | 12 | 3 | 2–3 | Fireball |
| Cleric | 30 | 18 | 7 | 3 | 1 | Heal |

The rules are in `docs/lib/battle.js`, with no DOM. `npm test` runs `tools/battle-test.mjs`, which checks the facing math, the movement rules and the skills (MP cost, heal limit, plus-shaped area, friendly fire), and plays a full battle with the AI on both sides. The map data is shared with `tools/art.mjs`, so `battle-map.png` shows the same ground.

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
| `docs/lib/battle.js` | The battle rules: demo map, class stats, skills and MP, movement, facing damage, turns, enemy AI. No DOM |
| `docs/battle.html`, `docs/battle.js` | The battle demo page |
| `tools/battle-test.mjs` | Tests for the battle rules (`npm test`) |
| `docs/fx/` | pixelrpg's own pixelfx effects, in the pixelfx file format: `ward/arcane-ward` and `ward/bulwark`. They import the pixelfx core from `docs/pixelfx` |
| `tools/fxlab.mjs` | Renders and checks the effects in `docs/fx` with one of our units as the actor (contact sheet, canvas bounds, loop seam, randomness, speed) |
| `tools/fx.mjs` | Renders the chosen pixelfx effects as one-row strips at 15 fps, recoloured with the system ramps |
| `tools/zoom.mjs` | Nearest-neighbour preview of a PNG |
| `sprites/art/` | Generated sheets and atlases, plus `gear.json` (atlas cells, shoulder and hem widths) and `art.json` |
| `sprites/fx/` | Effect strips and `fx.json` (frame size, count, fps, pivot) |
| `vendor/pixelfx/` | The pixelfx library, as a git submodule |
| `.claude/skills/pixelfx/` | The pixelfx skill for Claude Code |

## The rules in short

- **Styles:** two looks share every shape. **Muted** (the default) has natural, desaturated ramps with a near-black step 0, so outlines read dark. It shades with a soft 4 × 4 ordered dither, and units have a smaller head (88%) and a body 4 px taller. **Classic** is the original look: saturated ramps, hard cel bands and coloured outlines. Use `STYLE=classic npm run art` to write the sheets in the classic look; the web viewer has a style toggle.
- **Palette:** 19 ramps of 5 steps, in two sets (muted and classic). Dark steps go cooler and light steps go warmer. There is no anti-aliasing.
- **Light:** one light, from the top left. Each shape has an outline in step 0 of its own ramp. Ink (`#2a1f2d`) is used only on the bottom-right edges.
- **Units:** a 48 × 76 px cell, with the feet at (24, 72). A unit is about 5 heads tall.
- **Gear:** one base body (male or female) plus 8 slots: head, shoulders, chest, arms, legs, back, main hand and off hand. Each layer has its own outline. There are 79 pieces and 3 tiers for each class.
- **Silhouette:** heavy armour makes a V shape, robes make an A shape, and light gear makes an I shape.
- **Dual wield:** after European sword and dagger (Bolognese and rapier-and-dagger fencing). In guard, the off-hand blade leads, held forward with its point up as a parry tool, and the main blade waits low at the hip with its point raised. The attack is a parry and riposte in one tempo: the main blade chambers at the hip, then the unit lunges 6 px as the off-hand blade sweeps high to deflect and the main arm thrusts fully, then recovers to guard.
- **Stances:** the equipped weapon selects the stance: guard, caster, archer, dual wield, lancer, greatsword, or spear and shield. Units face SE (front) or NW (back), with the feet on the tile diagonal.
- **Facings:** a unit faces one of 4 grid directions: NE, SE, SW or NW, which are the screen diagonals. SE (front) and NW (back) are drawn. SW mirrors SE and NE mirrors NW, so handedness flips in the mirrored facings. One grid step per facing (`[dcol, drow]`): SE `[1, 0]`, SW `[0, 1]`, NW `[-1, 0]`, NE `[0, -1]`. The core gives `drawUnit(loadout, facing, bob, body, stance, pose)`, `turn(facing, ±1)`, `facingToward(fromTile, toTile)` and `attackSide(defenderTile, defenderFacing, attackerTile)`, which returns `"front"`, `"side"` or `"back"` for facing rules in combat. Diagonal tiles count as front or back.
- **Team colours:** a scheme in `TEAM_SCHEMES` swaps the dyed ramps of the gear layers (cloth, trim and metal) to a team palette: **Crimson** (blood red and charcoal, blackened steel), **Ebony** (charcoal and ash, blackened steel) and **Verdant** (moss green and bone, bronze). Leather, skin and hair keep their colours. Set it as `body.scheme` in `dress()` or `drawUnit()`, or call `recolor(img, scheme)` on one layer.
- **Gear with live effects:** a gear piece can carry an `fx` entry: a pixelfx effect that plays while the piece is equipped. pixelfx body effects read a character mask, so `docs/lib/gearfx.js` gives them our own mask each frame. With `target: "self"` the mask is the piece's own pixels (a burning blade); with `target: "body"` it is the whole unit (an aura from worn gear). The effect runs on its own clock and draws a back layer behind the unit and a front layer over it, in every pose and facing. The pilot items: **flame sword** (`status/burning`), **frost staff** (`status/frozen`), **storm spear** (`lightning/electrified`, two-handed), **shadow daggers** (`status/burning` with a violet-black ramp) and **holy vestments** (`holy/blessing` over the whole body).
- **Two-handed weapons:** the greatsword, the spear and the dragon lance use both hands, so the off-hand layer is not drawn. The short spear is one-handed and goes with a shield. It uses the guard ready pose and has its own thrust attack.
- **Reactions:** two more pose sets in the wide 96 px cell, named like attack poses: `hurt:0` and `hurt:1`, `block:0` and `block:1`. The flinch folds the body in (knees bend, the upper body drops 3 px, the arms pull in, the weapon droops), so it reads the same whichever side the blow came from; the battle adds a 2 px knock away from the attacker and a white hit flash. The block brings the guard up toward the unit's own front: the shield (guard, spear and shield), the staff upright (caster), the bow (archer), crossed blades (dual wield), the spear across the body (lancer) or the greatsword upright as a ward. Frame 1 of each is the recovery or the impact.
- **Shield effects:** two status loops of our own in `docs/fx/ward`. **Arcane ward** is a magical energy shield: a bell of violet light whose edge ripples like silk, aurora curtains and threads of mana climbing its walls, a band of runes turning round the waist, a sigil at the crown and a rune seal on the floor. **Bulwark** is the knightly one: a planted tower shield of steel with gold trim, rivets, an embossed cross and a gleam sweeping its face, its shadow on the floor, and a glint running down the unit's armour. The shield stands on the unit's front: pass `{ behind: true, dir: -1 }` when the unit is seen from the back.
- **Attacks:** 4 frames (ready 560 ms, wind-up 320 ms, strike 200 ms, follow-through 350 ms) in a 96 × 76 px cell, with the feet at (48, 72).
- **Effects on attacks:** an effect starts so that its own `act` hit time lands on our strike frame. On the hit, the whole picture freezes for the effect's hit-stop. Melee effects tilt 0.2–0.25 rad down to face SE. Projectiles start at the releasing hand on the strike frame and fly to the target's body centre (16 px above its feet), at 24 px per frame for arrows and 16 px per frame for spells.
- **Tiles:** 48 × 24 px on a 2:1 grid, with 12 px for each height step. Screen X = (col − row) × 24. Screen Y = (col + row) × 12 − height × 12.

## Main files in `sprites/art`

| File | Layout |
|---|---|
| `unit-<class>.png` | 8 frames of 48 × 76: SE idle ×2, NW idle ×2, SW idle ×2, NE idle ×2 |
| `teams.png` | 5 rows × 6 classes, SE idle, 48 × 76: the player side, then the enemy side (middle tier, other body) with no scheme, Crimson, Ebony and Verdant |
| `facings.png` | 6 rows (classes) × 4 columns (NE, SE, SW, NW), each unit on an iso tile, 48 × 100 per cell |
| `tiers.png` | 6 rows (classes) × 6 columns (T1–T3 male, T1–T3 female) |
| `reactions.png` | 8 rows (as `attacks.png`) × 10 frames of 96 × 76: ready, hurt:0, hurt:1, block:0, block:1 for SE, then the same for NW |
| `attacks.png` | 8 rows × 16 frames of 96 × 76: 4 poses each for SE, NW, SW, then NE. Rows: the 6 classes, then the knight with a greatsword, then the lancer with spear and shield |
| `atlas-<m\|f>-<stance>.png` | Every gear layer alone, 12 columns of 48 × 76. Cell positions are in `gear.json`. The phalanx (spear and shield) atlas is the same as the guard atlas |
| `combat-<clip>.png` | Attack clips with pixelfx effects, one row at 15 fps: knight sword, knight greatsword, thief riposte, lancer thrust, lancer spear and shield, mage fireball, archer arrow. Frame size, hit frame and hit-stop are in `combat.json` |
| `gearfx.png` | The five enchanted pilot loadouts with their live effects: one row each, 45 frames of 112 × 104 at 15 fps (24 idle, then 21 attack). Details in `gearfx.json` |
| `battle-map.png` | The 11 × 11 sample map, 552 × 412 |
| `tiles-*.png`, `props.png`, `icons.png`, `frame-*.png` | Terrain, height steps, tile markers, props, 16 px icons, 9-slice windows |

## Credits and licences

- pixelfx is © 2026 Patch and Hugo Duprez, MIT licence. See `vendor/pixelfx/LICENSE` and `vendor/pixelfx/NOTICE.md`. The skill in `.claude/skills/pixelfx/` is a copy of the pixelfx skill, with its licence next to it.
- The art direction takes inspiration from 2.5D MMO and tactics RPG sprite work. It copies no characters or assets from other games.
