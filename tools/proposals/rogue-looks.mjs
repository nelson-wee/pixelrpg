// Rogue look proposals: one row per option (current, A classic rogue, B renaissance duelist, A2 charcoal rogue, C guild assassin).
// Columns: SE idle male, SE idle female, NW idle male, SE strike (attack pose 2), SE silhouette. 96 x 76 cells.
// Usage: node tools/proposals/rogue-looks.mjs out.png   (then: node tools/zoom.mjs out.png big.png 3)
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { encodePNG } = await import(pathToFileURL(`${ROOT}/vendor/pixelfx/tools/lib/png.mjs`).href);
const core = await import(pathToFileURL(`${ROOT}/docs/lib/pixelrpg.js`).href);
const { Img, drawUnit, setCell, stanceOf, setStyle, solid } = core;
const LOOKS = core.CLASSES ?? (await import(pathToFileURL(`${ROOT}/docs/lib/presets.js`).href)).LOOKS;
setStyle("muted");

export const OPTIONS = [
  ["Current · Shadow", LOOKS.thief.loadout],
  ["A · Classic rogue", { head: "roguehood", shoulders: "mantlet", chest: "roguejerkin", arms: "bracers", legs: "leggings", main: "shortsword", off: "dagger" }],
  ["B · Renaissance duelist", { head: "cavalier", chest: "doublet", arms: "puffsleeves", legs: "breeches", back: "halfcape", main: "rapier", off: "maingauche" }],
  ["A2 · Classic rogue, charcoal", { head: "roguehoodC", shoulders: "mantletC", chest: "roguejerkin", arms: "bracers", legs: "leggings", main: "shortsword", off: "dagger" }],
  ["C · Guild assassin", { head: "deephood", chest: "longcoat", arms: "bracers", legs: "leggings", main: "dagger", off: "dagger" }],
];
const M = { type: "m", hair: "hair" }, F = { type: "f", hair: "ink" }, CW = 96, CH = 76;
const out = process.argv[2] ?? "rogue-looks.png", s = new Img(5 * CW, OPTIONS.length * CH);
setCell(96, 24);
OPTIONS.forEach(([, lo], r) => {
  const st = stanceOf(lo), cells = [drawUnit(lo, "SE", 0, M, st, 0), drawUnit(lo, "SE", 0, F, st, 0), drawUnit(lo, "NW", 0, M, st, 0), drawUnit(lo, "SE", 0, M, st, 2)];
  cells.push(solid(cells[0], "#ead6b0"));
  cells.forEach((c, i) => s.blit(c, i * CW, r * CH));
});
setCell(48, 0);
writeFileSync(out, encodePNG(s.w, s.h, s.rgba()));
console.log(OPTIONS.map(([n]) => n).join(" | "), "->", out);
