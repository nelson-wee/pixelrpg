// Writes every sprite sheet in sprites/art from the sprite core in docs/lib/pixelrpg.js (also used by the web viewer).
// Usage: node tools/art.mjs [pixelfx-dir] [out-dir]   (defaults: vendor/pixelfx, sprites/art)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB = resolve(process.argv[2] ?? `${ROOT}/vendor/pixelfx`), OUT = resolve(process.argv[3] ?? `${ROOT}/sprites/art`);
const { encodePNG } = await import(pathToFileURL(`${LIB}/tools/lib/png.mjs`).href);
mkdirSync(OUT, { recursive: true });

import * as core from "../docs/lib/pixelrpg.js";
const { ARMS, ATK, BAYER, BODYSLOT, BOWS, CH, CLASSES, CW, FX, FY, Fv, GEAR, HH, HW, ICONS, Img, KNIGHT_GS, L, LANCER_PH, Layer, MARK, MD, ORDER, OY0, P, POSES, R, RODS, SLOTS, SPEARS, STANCES, STEP, TERRAIN, TH, TW, TWO_HANDED, add2, backDrape, band, bodyOf, bow2, box, capsule, chainShirt, cursor, daggerAt, darken, dirOf, drawBase, drawHair, drawLimbs, dress, ell, faceOpen, footAt, frame, hash, headDiamond, hex, icon, inTop, lathe, layerImg, legEach, lerp2, line, maceAt, makeSprite, markTop, mirrorImg, nearHand, outline, pole, poly, prop, pw, rig, ringTex, rowTint, scaleTex, shadow, sleeves2, sleevesP, solid, stanceOf, swordAt, thick, tile, setCell, setPNGWriter, setStyle, STYLE, FACINGS, drawUnit } = core;
setStyle(process.env.STYLE === "classic" ? "classic" : "muted"); // STYLE=classic npm run art for the original look
setPNGWriter((file, w, h, rgba) => writeFileSync(`${OUT}/${file}`, encodePNG(w, h, rgba)));


// unit sheets (default body, top tier): [front idle 0, front idle 1, back idle 0, back idle 1]
const roster = {};
for (const key of Object.keys(CLASSES)) {
  // frames: SE idle 0-1, NW idle 0-1 (as before), then SW idle 0-1 and NE idle 0-1 (mirrors)
  const k = CLASSES[key], frames = ["SE", "NW", "SW", "NE"].flatMap((f) => [0, 1].map((b) => drawUnit(k.loadout, f, b, k.body)));
  const sheet = new Img(CW * 8, CH);
  frames.forEach((f, i) => sheet.blit(f, i * CW, 0));
  sheet.png(`unit-${key}.png`);
  roster[key] = frames;
}
{
  const keys = Object.keys(CLASSES), s = new Img(keys.length * CW, CH);
  keys.forEach((k, i) => s.blit(solid(roster[k][0], "#ead6b0"), i * CW, 0));
  s.png("silhouettes.png");
}
// tiers grid: one row per class, columns T1 T2 T3 (male) then T1 T2 T3 (female); plus the same as silhouettes
{
  const keys = Object.keys(CLASSES), s = new Img(6 * CW, keys.length * CH), si = new Img(6 * CW, keys.length * CH);
  keys.forEach((key, r) => { const k = CLASSES[key]; ["m", "f"].forEach((t, bi) => k.tiers.forEach(([, , lo], ti) => {
    const img = dress(lo, "front", 0, bodyOf(k, t)); s.blit(img, (bi * 3 + ti) * CW, r * CH); si.blit(solid(img, "#ead6b0"), (bi * 3 + ti) * CW, r * CH);
  })); });
  s.png("tiers.png"); si.png("tiers-sil.png");
}
// bare bodies: [male front, female front, male back, female back]
{
  const s = new Img(4 * CW, CH), M = { type: "m", hair: "hair" }, F = { type: "f", hair: "crimson" };
  [["front", M], ["front", F], ["back", M], ["back", F]].forEach(([v, bd], i) => s.blit(dress({}, v, 0, bd), i * CW, 0));
  s.png("bases.png");
}
// gear atlases (one per body, same layout) and band widths for the shape read-out
const atlas = [["base", "base", "Base body"], ["limbs", "limbs", "Bare arms"], ["hair", "hair", "Long hair"]];
for (const slot of SLOTS) for (const [id, g] of Object.entries(GEAR[slot])) atlas.push([slot, id, g.name]);
const ACOLS = 12, gearInfo = [];
const span = (img, y0, y1) => { let a = 99, z = -1; for (let y = y0; y <= y1; y++) for (let x = 0; x < CW; x++) if (img.c[y * CW + x]) { a = Math.min(a, x); z = Math.max(z, x); } return z < 0 ? 0 : z - a + 1; };
for (const [tag, body] of [["m", { type: "m", hair: "hair" }], ["f", { type: "f", hair: "crimson" }]]) for (const st of Object.keys(STANCES)) {
  const rows = Math.ceil(atlas.length / ACOLS), s = new Img(ACOLS * CW, rows * CH);
  atlas.forEach(([slot, id, name], i) => {
    const img = layerImg(slot, id, "front", 0, body, st);
    s.blit(img, (i % ACOLS) * CW, Math.floor(i / ACOLS) * CH);
    if (tag === "m" && st === "guard") gearInfo.push({ slot, id, name, col: i % ACOLS, row: Math.floor(i / ACOLS), sh: span(img, 17 + OY0 - STYLE.lift, 27 + OY0 - STYLE.lift), hem: span(img, 50 + OY0, 60 + OY0) });
  });
  s.png(`atlas-${tag}-${st}.png`);
}
// build-up strips and an exploded layer row
const STEPS = [["base", "limbs"], ["legs"], ["chest"], ["arms", "shoulders"], ["head"], ["back", "off", "main"]];
for (const key of ["knight", "mage"]) {
  const k = CLASSES[key], s = new Img(STEPS.length * CW, CH); let acc = [];
  STEPS.forEach((st, i) => { acc = acc.concat(st); s.blit(dress(k.loadout, "front", 0, k.body, acc), i * CW, 0); });
  s.png(`build-${key}.png`);
}
{
  const k = CLASSES.knight, slots = ORDER.front.filter((s) => s !== "hair"), s = new Img(slots.length * CW, CH);
  slots.forEach((slot, i) => { const id = BODYSLOT(slot) ? slot : k.loadout[slot]; const l = id && layerImg(slot, id, "front", 0, k.body, stanceOf(k.loadout)); if (l) s.blit(l, i * CW, 0); });
  s.png("layers-knight.png");
}
writeFileSync(`${OUT}/gear.json`, JSON.stringify({ CW, CH, ACOLS, order: ORDER, slots: SLOTS, gear: gearInfo, classes: Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, { name: v.name, shape: v.shape, body: v.body.type, tiers: v.tiers }])) }, null, 1));


// tile swatch sheet: each terrain at h=1 and h=2
const TYPES = Object.keys(TERRAIN);
{
  const C = TW + 8;
  const sheet = new Img(TYPES.length * C, TH + 2 * STEP + 16);
  TYPES.forEach((t, i) => sheet.blit(tile(t, 2, i), i * C + 4, 8));
  sheet.png("tiles-terrain.png");
  const SHH = TH + 4 * STEP + 12, steps = new Img(4 * C, SHH);
  [0, 1, 2, 4].forEach((h, i) => steps.blit(tile("grass", h, i), i * C + 4, SHH - 4 - TH - h * STEP));
  steps.png("tiles-heights.png");
  const marks = new Img(4 * C, TH + STEP + 16);
  ["move", "attack", "ally"].forEach((m, i) => marks.blit(tile("grass", 1, i, m), i * C + 4, 8));
  marks.blit(tile("grass", 1, 7), 3 * C + 4, 8); cursor(marks, 3 * C + 4, 8);
  console.log("tile sheets", sheet.w, sheet.h, steps.w, steps.h, marks.w, marks.h);
  marks.png("tiles-marks.png");
}


const PROPS = ["oak", "pine", "rock", "bush", "crate", "chest", "crystal", "banner"];
{
  const s = new Img(PROPS.length * 40, 56);
  PROPS.forEach((k, i) => s.blit(prop(k), i * 40, 0));
  s.png("props.png");
}

// ---------- battle map ----------
function battle(file, { marks = true } = {}) {
  const N = 11, W = N * TW + HW, H = N * TH + 6 * STEP + 76;
  const img = new Img(W, H);
  const OX = N * HW - HW + 8, OY = 60, centers = {};
  const hgt = (i, j) => {
    if (j >= 5 && j <= 6 && i > 1) return 0; // river bed
    if (i <= 2 && j <= 3) return 4;
    if (i <= 3 && j <= 4) return 3;
    if (i >= 8 && j >= 8) return 2;
    if (i >= 7 && j <= 2) return 2;
    return 1;
  };
  const ter = (i, j) => {
    if (j >= 5 && j <= 6 && i > 1) return i === 5 ? "wood" : "water";
    if (i <= 3 && j <= 4) return hgt(i, j) === 4 ? "cobble" : "moss";
    if (j === 4 && i > 3 || i === 5 && j > 6) return "dirt";
    if (i >= 8 && j >= 8) return "snow";
    if (i >= 7 && j <= 2) return "sand";
    return "grass";
  };
  const H2 = (i, j) => (ter(i, j) === "wood" ? 1 : hgt(i, j));
  const units = { "3,7": ["knight", "SE"], "6,8": ["mage", "SE"], "0,5": ["archer", "SE"], "8,3": ["thief", "NE"], "2,9": ["cleric", "SE"], "1,1": ["lancer", "NE"] };
  const props = { "1,10": "oak", "9,6": "oak", "10,1": "pine", "1,4": "banner", "8,9": "pine", "10,9": "pine", "6,10": "rock", "4,10": "bush", "3,3": "crystal", "9,0": "crate", "0,0": "chest", "6,2": "bush" };
  const moveSet = new Set(["3,8", "4,7", "3,9", "2,8", "4,9", "5,8", "4,10", "2,7", "5,7"]);
  const atkSet = new Set(["3,6", "4,6"]);
  for (let s = 0; s <= 2 * (N - 1); s++) for (let i = 0; i < N; i++) {
    const j = s - i; if (j < 0 || j >= N) continue;
    const h = H2(i, j), sx = OX + (i - j) * HW, sy = OY + (i + j) * HH - h * STEP + 6 * STEP;
    centers[`${i},${j}`] = [sx + HW, sy - STEP + HH];
    const key = `${i},${j}`;
    const m = marks ? (moveSet.has(key) ? "move" : atkSet.has(key) ? "attack" : null) : null;
    img.blit(tile(ter(i, j), h + 1, i * 13 + j * 7, m), sx, sy - STEP);
    if (marks && key === "3,7") cursor(img, sx, sy - STEP);
    if (props[key]) img.blit(prop(props[key]), sx + HW - 20, sy - STEP + HH - 48);
    if (units[key]) { const [u, f] = units[key], k = CLASSES[u]; img.blit(drawUnit(k.loadout, f, 0, k.body), sx + HW - FX, sy - STEP + HH - FY + 1); }
  }
  // enemy slime marker spot left empty for the live pixelfx critter
  img.png(file);
  return { W, H, OX, OY, c53: centers["5,3"], c76: centers["7,6"], c37: centers["3,7"], c36: centers["3,6"] };
}
const mapInfo = battle("battle-map.png");
battle("battle-map-clean.png", { marks: false });


{
  const keys = Object.keys(ICONS), s = new Img(keys.length * 18, 18);
  keys.forEach((k, i) => s.blit(icon(ICONS[k]), i * 18, 0));
  s.png("icons.png");
}


frame("parch").png("frame-parch.png");
frame("night").png("frame-night.png");

// bar segment strip (for HP/MP gauges): 3 px tall caps not needed; done in CSS.
writeFileSync(`${OUT}/art.json`, JSON.stringify({ CW, CH, FX, FY, TW, TH, STEP, mapInfo, icons: Object.keys(ICONS), props: PROPS, terrain: TYPES, ramps: R }, null, 1));
console.log("ok", mapInfo);

// roster lineup: every class, front then back
{
  const keys = Object.keys(CLASSES), s = new Img(keys.length * CW, CH * 2);
  keys.forEach((k, i) => { s.blit(roster[k][0], i * CW, 0); s.blit(roster[k][2], i * CW, CH); });
  s.png("roster.png");
}

// stance sheet: each stance on an iso tile, SE front row and NW back row
{
  const C = CLASSES, picks = [["guard", C.knight.loadout, C.knight.body], ["caster", C.mage.loadout, C.mage.body], ["archer", C.archer.loadout, C.archer.body], ["rogue", C.thief.loadout, C.thief.body], ["lancer", C.lancer.loadout, C.lancer.body], ["greatsword", KNIGHT_GS, C.knight.body], ["phalanx", LANCER_PH, C.lancer.body]];
  const SH = 100, s = new Img(picks.length * CW, 2 * SH);
  picks.forEach(([st, lo, bd], i) => ["front", "back"].forEach((v, r) => {
    const k = { loadout: lo, body: bd };
    s.blit(tile("grass", 1, i * 3 + r), i * CW + 24 - HW, r * SH + FY - HH);
    s.blit(dress(k.loadout, v, 0, k.body, null, st), i * CW, r * SH);
  }));
  s.png("stances.png");
}

// attack animation: one row per class (default body, top tier); SE poses 0-3 then NW poses 0-3
{
  setCell(96, 24); const LW = 96;
  // rows: the six classes, then the knight with a greatsword and the lancer with spear and shield
  const rows = Object.values(CLASSES).map((k) => [k.loadout, k.body]).concat([[KNIGHT_GS, CLASSES.knight.body], [LANCER_PH, CLASSES.lancer.body]]);
  // per row: SE poses 0-3, NW poses 0-3, SW poses 0-3, NE poses 0-3
  const s2 = new Img(16 * LW, rows.length * CH);
  rows.forEach(([lo, bd], r) => ["SE", "NW", "SW", "NE"].forEach((f, fi) => [0, 1, 2, 3].forEach((p) => s2.blit(drawUnit(lo, f, 0, bd, stanceOf(lo), p), (fi * 4 + p) * LW, r * CH))));
  s2.png("attacks.png");
}
// dual wield across classes: same stance with three weapon pairs
{
  const pairs = [{ main: "dagger", off: "dagger" }, { main: "sword", off: "offsword" }, { main: "mace", off: "offmace" }];
  const bodyM = { type: "m", hair: "hair" }, s3 = new Img(pairs.length * 4 * 96, CH);
  const looks = [CLASSES.thief.loadout, CLASSES.knight.tiers[1][2], CLASSES.cleric.tiers[1][2]];
  pairs.forEach((pr, i) => [0, 1, 2, 3].forEach((p) => { const lo = { ...looks[i], ...pr, back: looks[i].back }; s3.blit(dress(lo, "front", 0, i === 2 ? CLASSES.cleric.body : bodyM, null, "rogue", p), (i * 4 + p) * 96, 0); }));
  s3.png("dual.png");
  setCell(CW, 0);
}

// ---------- combat clips: our attack poses + pixelfx effects, timed by each effect's own act ----------
// Each clip is one horizontal strip at 15 fps. The effect starts so that its first hit lands on our strike frame,
// and every hit stops the whole picture (unit, effect, target) for the effect's own hit-stop time.
{
  const fxl = await import(pathToFileURL(`${LIB}/tools/lib/fxlib.mjs`).href);
  const FPS = 15;
  const fxCache = {};
  async function fxFrames(id, options = {}) {
    const key = id + JSON.stringify(options);
    if (fxCache[key]) return fxCache[key];
    const fx = await fxl.loadEffect(id, `${LIB}/src/fx`);
    const r = fxl.renderFrames(fx, { fps: FPS, bg: "none", actor: false, options });
    const timing = fx.mod.act ? actTimingOf(fx.mod) : null;
    return (fxCache[key] = { w: r.w, h: r.h, frames: r.frames.map((f) => f.clear), pivot: fx.meta.origin, loop: fx.meta.loop, hits: timing?.hits ?? [] });
  }
  function actTimingOf(mod) { return { hits: (mod.act.hits ?? []).map((h) => ({ t: h.t, freeze: h.stop ?? 0 })) }; }
  const blitFx = (cv, F, i, x, y) => { if (i < 0 || i >= F.frames.length) return; cv.paste(F.frames[i], F.w, F.h, Math.round(x - F.pivot[0]), Math.round(y - F.pivot[1])); };
  const unitAt = (cv, img, fx, fy) => cv.paste(img.rgba(), img.w, img.h, fx - 48, fy - 72);
  // drawing coordinates of a rig point -> clip coordinates, for a unit whose feet are at (fx, fy)
  const toClip = (p, fx, fy) => [fx + p[0] - 24, fy + p[1] - 60];
  const meta = {};

  setCell(96, 24);
  async function clip(name, { lo, body, W, H, ux, uy, tx, ty, melee, proj }) {
    const st = stanceOf(lo), poses = [0, 1, 2, 3].map((p) => dress(lo, "front", 0, body, null, st, p));
    const slime = await fxFrames("critters/slime");
    // pose timeline: ready 4, wind-up 5, strike 3, follow 5, then ready
    const S0 = 9, poseAt = (f) => (f < 4 ? 0 : f < S0 ? 1 : f < S0 + 3 ? 2 : f < S0 + 8 ? 3 : 0);
    let E, I, startE = 0, hitF = S0, freeze = 2, path = null, impact = null, arriveF = S0;
    if (melee) {
      E = await fxFrames(melee.id, melee.opts);
      const h0 = E.hits[0] ?? { t: 0.06, freeze: 0.1 };
      startE = S0 - Math.round(h0.t * FPS); hitF = S0; freeze = Math.max(1, Math.round(h0.freeze * FPS));
      if (melee.impact) I = await fxFrames(melee.impact.id, melee.impact.opts);
    } else {
      const K = rig("front", 0, body, st, 2), L = toClip(proj.from === "off" ? K.off.h : K.main.h, ux, uy), T = [tx, ty - 16];
      const dist = Math.hypot(T[0] - L[0], T[1] - L[1]), n = Math.max(3, Math.ceil(dist / proj.speed));
      const ang = Math.atan2(T[1] - L[1], T[0] - L[0]);
      E = await fxFrames(proj.id, { ...(proj.opts ?? {}), angle: ang });
      I = await fxFrames(proj.impact.id, proj.impact.opts);
      path = { L, T, n }; arriveF = S0 + n; hitF = arriveF; freeze = 2;
    }
    const effLen = melee ? E.frames.length : 0, impLen = I ? I.frames.length : 0;
    const total = Math.max(S0 + 12, (melee ? startE + effLen : arriveF + impLen)) + 3;
    // build the frame list with the hit-stop: the picture at hitF repeats `freeze` times
    const seq = [];
    for (let f = 0; f < total; f++) { seq.push({ f, frozen: false }); if (f === hitF) for (let k = 0; k < freeze; k++) seq.push({ f, frozen: true }); }
    const cv = fxl.canvas(W * seq.length, H, [0, 0, 0, 0]);
    seq.forEach(({ f, frozen }, i) => {
      const one = fxl.canvas(W, H, [0, 0, 0, 0]);
      const hitAge = f - hitF, shake = hitAge >= 0 && hitAge < 3 ? (frozen ? 2 : hitAge === 0 ? 2 : 1) : 0;
      blitFx(one, slime, f % slime.frames.length, tx + shake, ty);
      unitAt(one, poses[poseAt(f)], ux, uy);
      if (melee) { blitFx(one, E, f - startE, ux + melee.dx, uy + melee.dy); if (I) blitFx(one, I, f - hitF, tx + (melee.impact.dx ?? 0), ty); }
      else {
        if (f >= S0 && f < arriveF) { const t = (f - S0) / path.n, x = path.L[0] + (path.T[0] - path.L[0]) * t, y = path.L[1] + (path.T[1] - path.L[1]) * t; blitFx(one, E, (f - S0) % E.frames.length, x, y); }
        blitFx(one, I, f - arriveF, tx + (proj.impact.dx ?? 0), ty + (proj.impact.dy ?? 0));
      }
      cv.paste(one.data, W, H, i * W, 0);
    });
    writeFileSync(`${OUT}/combat-${name}.png`, cv.png());
    meta[name] = { w: W, h: H, frames: seq.length, fps: FPS, hitFrame: hitF + 0, freeze, effect: melee?.id ?? proj.id, impact: melee?.impact?.id ?? proj?.impact?.id ?? null };
  }
  const C = CLASSES;
  await clip("knight-slash", { lo: C.knight.loadout, body: C.knight.body, W: 208, H: 120, ux: 60, uy: 100, tx: 128, ty: 108, melee: { id: "melee/sword-slash", opts: { radius: 50, angle: 0.25 }, dx: 12, dy: -6 } });
  await clip("knight-greatsword", { lo: KNIGHT_GS, body: C.knight.body, W: 208, H: 120, ux: 60, uy: 100, tx: 128, ty: 108, melee: { id: "melee/heavy-cleave", opts: { angle: 0.2 }, dx: 2, dy: -6 } });
  await clip("thief-x", { lo: C.thief.loadout, body: C.thief.body, W: 208, H: 120, ux: 60, uy: 100, tx: 124, ty: 108, melee: { id: "melee/double-slash", opts: { angle: 0.2 }, dx: 0, dy: -6 } });
  await clip("lancer-thrust", { lo: C.lancer.loadout, body: C.lancer.body, W: 208, H: 120, ux: 52, uy: 100, tx: 140, ty: 108, melee: { id: "melee/thrust", opts: { reach: 74, angle: -0.08 }, dx: 0, dy: -4 } });
  await clip("lancer-phalanx", { lo: LANCER_PH, body: C.lancer.body, W: 208, H: 120, ux: 52, uy: 100, tx: 136, ty: 108, melee: { id: "melee/thrust", opts: { reach: 66, angle: 0.05 }, dx: 0, dy: -12 } });
  await clip("mage-fireball", { lo: C.mage.loadout, body: C.mage.body, W: 256, H: 210, ux: 48, uy: 100, tx: 196, ty: 150, proj: { id: "fire/fireball", from: "off", speed: 16, impact: { id: "explosions/plasma-explosion", dy: -14, opts: { palette: ["#1e0c14", "#6e1c34", "#b0303e", "#e0604e", "#f0c85a", "#fff2b0", "#ffffff"], accent: ["#3a1428", "#6e1c34", "#e0604e", "#f6a07a", "#ffe0b8"] } } } });
  await clip("archer-arrow", { lo: C.archer.loadout, body: C.archer.body, W: 256, H: 150, ux: 48, uy: 92, tx: 196, ty: 134, proj: { id: "projectiles/arrow", from: "off", speed: 24, impact: { id: "impacts/hit-spark", opts: { height: 14 }, dx: -6, dy: 0 } } });
  setCell(CW, 0);
  writeFileSync(`${OUT}/combat.json`, JSON.stringify(meta, null, 1));
  console.log("combat clips", meta);
}

// facings sheet: every class (default body, top tier) in the four facings, clockwise from NE, each on an iso tile
{
  const keys = Object.keys(CLASSES), SH = 100, s = new Img(FACINGS.length * CW, keys.length * SH);
  keys.forEach((key, r) => FACINGS.forEach((f, i) => {
    const k = CLASSES[key];
    s.blit(tile("grass", 1, r * 4 + i), i * CW + 24 - HW, r * SH + FY - HH);
    s.blit(drawUnit(k.loadout, f, 0, k.body), i * CW, r * SH);
  }));
  s.png("facings.png");
}
