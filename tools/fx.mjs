// Render chosen pixelfx effects as horizontal strips (one row, 15 fps) for CSS steps() playback.
// Usage: node tools/fx.mjs [pixelfx-dir] [out-dir]   (defaults: vendor/pixelfx, sprites/fx)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB = resolve(process.argv[2] ?? `${ROOT}/vendor/pixelfx`), OUT = resolve(process.argv[3] ?? `${ROOT}/sprites/fx`);
const { loadEffect, renderFrames, canvas } = await import(pathToFileURL(`${LIB}/tools/lib/fxlib.mjs`).href);
mkdirSync(OUT, { recursive: true });

// System ramps (dark -> bright), so the effects share the game's palette.
const ARCANE = ["#120c22", "#241840", "#442a72", "#6e44a8", "#a070d8", "#d8b4f4", "#f4e8ff", "#ffffff"];
const EMBER = ["#1e0c14", "#3a1428", "#6e1c34", "#b0303e", "#e0604e", "#f6a07a", "#ffe0b8", "#ffffff"];

const LIST = [
  ["melee/sword-slash", "sword-slash", {}],
  ["impacts/shield-block", "shield-block", {}],
  ["ice/frost-nova", "frost-nova", {}],
  ["fire/fireball", "fireball", {}],
  ["fire/fireball", "shadow-bolt", { palette: ARCANE }],
  ["projectiles/arrow", "arrow", {}],
  ["melee/dagger-flurry", "dagger-flurry", {}],
  ["holy/heal", "heal", {}],
  ["holy/smite", "smite", {}],
  ["shadow/curse", "curse", {}],
  ["ui/damage-number", "damage-number", { text: "-48", palette: EMBER }],
  ["ui/level-up", "level-up", {}],
  ["pickups/chest-open", "chest-open", {}],
  ["critters/slime", "slime", {}],
  ["critters/ghost", "ghost", {}],
];
const meta = {};
for (const [id, name, options] of LIST) {
  const fx = await loadEffect(id, LIB + "/src/fx");
  const r = renderFrames(fx, { fps: 15, bg: "none", actor: false, options });
  const { w, h, frames } = r;
  const img = canvas(w * frames.length, h, [0, 0, 0, 0]);
  frames.forEach((f, i) => img.paste(f.clear, w, h, i * w, 0));
  writeFileSync(`${OUT}/${name}.png`, img.png());
  meta[name] = { id, w, h, n: frames.length, fps: 15, loop: fx.meta.loop, dur: +(frames.length / 15).toFixed(2), pivot: fx.meta.origin };
  console.log(name, meta[name]);
}
writeFileSync(`${OUT}/fx.json`, JSON.stringify(meta, null, 1));
