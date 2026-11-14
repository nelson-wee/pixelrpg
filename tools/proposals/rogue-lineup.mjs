// Lineup: the rogue options on tiles between the knight, archer, cleric and mage. Usage: node tools/proposals/rogue-lineup.mjs out.png
import { writeFileSync } from "node:fs";
const core = await import(new URL("../../", import.meta.url).pathname + "docs/lib/pixelrpg.js");
const { encodePNG } = await import(new URL("../../", import.meta.url).pathname + "vendor/pixelfx/tools/lib/png.mjs");
const { OPTIONS } = await import(new URL("../../", import.meta.url).pathname + "tools/proposals/rogue-looks.mjs?lib");
const { Img, drawUnit, tile, CLASSES, setStyle } = core; setStyle("muted");
const row = [[CLASSES.knight.loadout, CLASSES.knight.body], [CLASSES.archer.loadout, CLASSES.archer.body], ...OPTIONS.slice(1).map(([, lo]) => [lo, { type: "m", hair: "hair" }]), [CLASSES.cleric.loadout, CLASSES.cleric.body], [CLASSES.mage.loadout, CLASSES.mage.body]];
const s = new Img(row.length * 52 + 8, 100);
row.forEach(([lo, body], i) => { s.blit(tile("grass", 1, i * 7 + 3), i * 52 + 6, 72); s.blit(drawUnit(lo, "SE", 0, body), i * 52 + 6, 12 + 1); });
writeFileSync(process.argv[2], encodePNG(s.w, s.h, s.rgba()));
