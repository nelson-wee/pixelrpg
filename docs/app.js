// Wardrobe viewer: draws a unit live with the sprite core and plays its idle or attack animation.
import { CLASSES, KNIGHT_GS, LANCER_PH, ENCHANTED, TWO_HANDED, STANCES, STYLE, setStyle, stanceOf, dress, layerImg, setCell, tile, Img, OY0, FACINGS, FACING_VIEW, drawUnit, turn, attackSide } from "./lib/pixelrpg.js";
import { GearFx, fxPieces, over, place } from "./lib/gearfx.js";

// short chip labels for every piece, by slot
const SLOTS = [
  ["head", "HEAD", [["greathelm", "Great helm"], ["coif", "Mail coif"], ["leathercap", "Leather cap"], ["winghelm", "Spire helm"], ["kettle", "Kettle hat"], ["wizhat", "Brim hat"], ["magehood", "Pointed hood"], ["cap", "Apprentice cap"], ["mitre", "Mitre"], ["veil", "Veil"], ["hood", "Hood"], ["huntercap", "Feather cap"], ["falconhelm", "Winged helm"], ["cowl", "Cowl"], ["bandana", "Bandana"], ["shadowmask", "Demon mask"]]],
  ["shoulders", "SHOULDERS", [["pauldrons", "Pauldrons"], ["halfpauldrons", "Half pauldrons"], ["leatherpads", "Leather pads"], ["darkpads", "Lacquered pads"], ["spaulders", "Spaulders"], ["mantle", "Mantle"], ["collar", "Collar"]]],
  ["chest", "CHEST", [["holyvestments", "Holy vestments (fx)"], ["plate", "Plate"], ["chainK", "Hauberk + cross"], ["chain", "Hauberk teal"], ["leatherarmor", "Studded leather"], ["scaleplate", "Dragon scale"], ["gambeson", "Gambeson"], ["robe", "Archmage robe"], ["simplerobe", "Adept robe"], ["shortrobe", "Short robe"], ["gown", "Gown"], ["vestment", "Vestment"], ["habit", "Habit"], ["brigandine", "Brigandine"], ["jerkin", "Jerkin"], ["tunic", "Tunic"], ["garb", "Garb"], ["lamellar", "Lamellar"], ["darktunic", "Patched tunic"]]],
  ["arms", "ARMS", [["gauntlets", "Gauntlets"], ["mail", "Mail"], ["bracers", "Bracers"], ["bell", "Bell sleeves"], ["magesleeves", "Straight sleeves"], ["sleeves", "Long sleeves"], ["woolsleeves", "Wool sleeves"]]],
  ["legs", "LEGS", [["greaves", "Greaves"], ["chausses", "Chausses"], ["leggings", "Leggings"], ["trousers", "Trousers"], ["wraps", "Wraps"]]],
  ["back", "BACK", [["templecloak", "Trimmed cloak"], ["cape", "Cape"], ["dragoncape", "Dragon cape"], ["cloak", "Cloak"], ["wardencloak", "Warden cloak"], ["quiver", "Quiver"], ["scarf", "Scarf"], ["longscarf", "Long scarf"]]],
  ["main", "MAIN HAND", [["flamesword", "Flame sword (fx)"], ["froststaff", "Frost staff (fx)"], ["stormspear", "Storm spear (2H, fx)"], ["shadowdagger", "Shadow dagger (fx)"], ["sword", "Sword"], ["greatsword", "Greatsword (2H)"], ["mace", "Mace"], ["dagger", "Dagger"], ["shortspear", "Short spear"], ["spear", "Spear (2H)"], ["dragonspear", "Dragon lance (2H)"], ["staff", "Staff"], ["rod", "Rod"], ["sceptre", "Sceptre"]]],
  ["off", "OFF HAND", [["shadowdagger", "Shadow dagger (fx)"], ["shield", "Kite shield"], ["buckler", "Buckler"], ["dagger", "Dagger"], ["offsword", "Sword"], ["offmace", "Mace"], ["bow", "Longbow"], ["shortbow", "Short bow"], ["greatbow", "Greatbow"], ["tome", "Book"]]],
];
const KEYS = SLOTS.map(([k]) => k);
const HAIRS = [["hair", "Brown"], ["crimson", "Red"], ["hairB", "Blue-black"], ["ink", "Black"], ["grey", "Grey"]];
const STANCE_NAMES = { guard: "GUARD", caster: "CASTER", archer: "ARCHER", rogue: "DUAL WIELD", lancer: "LANCER (2H)", greatsword: "GREATSWORD (2H)", phalanx: "SPEAR & SHIELD" };
// attack frame timing in ms: ready, wind-up, strike, follow-through
const ATTACK_MS = [560, 320, 200, 350], IDLE_MS = [600, 600];

// presets: every class's three tiers, plus the two weapon variants
const PRESETS = Object.entries(CLASSES).map(([key, k]) => {
  const tiers = k.tiers.map(([name, mat, lo], i) => ({ name, label: `${k.name} · T${i + 1} ${name} (${mat})`, lo, body: k.body }));
  if (key === "knight") tiers.push({ name: "Greatsword", label: "Knight · Greatsword", lo: KNIGHT_GS, body: k.body });
  if (key === "lancer") tiers.push({ name: "Phalanx", label: "Lancer · Spear & shield", lo: LANCER_PH, body: k.body });
  if (key === "cleric") tiers.push({ name: "Elder", label: "Cleric · Elder (trimmed cloak, beard)", lo: { shoulders: "mantle", chest: "vestment", arms: "sleeves", back: "templecloak", main: "sword" }, look: { body: "m", hair: "grey", beard: true } });
  return { cls: k.name, tiers };
});
// enchanted pilot items: each loadout wears one piece that carries a live pixelfx effect
PRESETS.push({ cls: "Enchanted", tiers: ENCHANTED.map(([key, name, lo, body]) => ({ name, label: `Enchanted · ${name}`, lo, look: { body: body.type, hair: body.hair, beard: false } })) });

const state = { lo: { ...CLASSES.knight.loadout }, body: "m", hair: "hair", beard: false, facing: "SE", mode: "idle", style: STYLE.name, fx: true };
const clean = (lo) => Object.fromEntries(KEYS.filter((k) => lo[k]).map((k) => [k, lo[k]]));
const same = (a, b) => KEYS.every((k) => (a[k] || null) === (b[k] || null));

// ---------- drawing ----------
const SW = 112, SH = 104, FEET = [56, 84], ZOOM = 4;
const ground = tile("grass", 1, 3);
function sceneOf(unit, cellFeetX) {
  const s = new Img(SW, SH);
  s.blit(ground, FEET[0] - 24, FEET[1] - 12);
  s.blit(unit, FEET[0] - cellFeetX, FEET[1] - 72);
  return s;
}
function silOf(unit, cellFeetX) {
  const s = new Img(SW, SH);
  unit.c.forEach((v, i) => { if (v && v.a === undefined) { const x = (i % unit.w) + FEET[0] - cellFeetX, y = Math.floor(i / unit.w) + FEET[1] - 72; if (x >= 0 && x < SW && y >= 0 && y < SH) s.c[y * SW + x] = { hex: "#1a1220" }; } });
  return s;
}
function toCanvas(img) {
  const c = document.createElement("canvas"); c.width = img.w; c.height = img.h;
  c.getContext("2d").putImageData(new ImageData(img.rgba(), img.w, img.h), 0, 0);
  return c;
}
const cache = new Map();
function framesFor() {
  const { lo, body, hair, beard, facing, mode, style } = state, bodyObj = { type: body, hair, beard };
  const key = JSON.stringify([clean(lo), body, hair, beard, facing, mode, style]);
  if (cache.has(key)) return cache.get(key);
  const [view, flip] = FACING_VIEW[facing], st = stanceOf(lo), pieces = fxPieces(lo, TWO_HANDED), attack = mode === "attack";
  const poses = attack ? [0, 1, 2, 3] : [0, 1], feetX = attack ? 48 : 24, ms = attack ? ATTACK_MS : IDLE_MS;
  if (attack) setCell(96, 24);
  const frames = poses.map((p, i) => {
    const pose = attack ? p : 0, bob = attack ? 0 : p, u = dress(lo, view, bob, bodyObj, null, st, pose);
    // the images each effect wraps in this pose: the piece itself, or the whole unit
    const srcs = Object.fromEntries(pieces.map((q) => [`${q.slot}.${q.id}`, q.spec.target === "body" ? u : layerImg(q.slot, q.id, view, bob, bodyObj, st, pose)]));
    const unitRGBA = place(new Uint8ClampedArray(SW * SH * 4), SW, SH, u.rgba(), u.w, u.h, FEET[0] - feetX, FEET[1] - 72);
    return { scene: toCanvas(sceneOf(u, feetX)), sil: toCanvas(silOf(u, feetX)), ms: ms[i], unitRGBA, srcs, feetX };
  });
  if (attack) setCell(48, 0);
  frames.flip = flip; frames.pieces = pieces;
  if (cache.size > 60) cache.clear();
  cache.set(key, frames);
  return frames;
}

// shoulder and hem widths, measured on each layer alone (guard stance, front view, male body)
const spanCache = new Map();
function spans(slot, id) {
  const k = slot + "." + id + "." + STYLE.name, lift = STYLE.lift;
  if (!spanCache.has(k)) {
    const img = layerImg(slot, id, "front", 0, { type: "m", hair: "hair" }, "guard");
    const band = (y0, y1) => { let a = 99, z = -1; for (let y = y0; y <= y1; y++) for (let x = 0; x < img.w; x++) if (img.c[y * img.w + x]) { a = Math.min(a, x); z = Math.max(z, x); } return z < 0 ? 0 : z - a + 1; };
    spanCache.set(k, img ? [band(17 + OY0 - lift, 27 + OY0 - lift), band(50 + OY0, 60 + OY0)] : [0, 0]);
  }
  return spanCache.get(k);
}
function shapeOf(lo) {
  let sh = Math.max(spans("base", "base")[0], spans("limbs", "limbs")[0]), hem = 17; // the hem ignores the legs
  for (const slot of ["head", "shoulders", "chest", "arms", "back"]) if (lo[slot]) { const [a, b] = spans(slot, lo[slot]); sh = Math.max(sh, a); hem = Math.max(hem, b); }
  const r = sh / hem, s = r >= 1.6 ? "V" : r <= 0.86 ? "A" : "I";
  return { s, sh, hem, name: { V: "V-frame · heavy, imposing", A: "A-frame · robed, grounded", I: "I-frame · light, agile" }[s] };
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
function chip(label, pressed, onClick) {
  const b = document.createElement("button");
  b.className = "chip"; b.type = "button"; b.textContent = label; b.setAttribute("aria-pressed", pressed ? "true" : "false");
  b.addEventListener("click", onClick);
  return b;
}
function pick(slot, id) {
  const n = { ...state.lo, [slot]: id || null };
  if (slot === "main" && TWO_HANDED.includes(id)) n.off = null;          // two-handed: both hands on the weapon
  if (slot === "off" && id && TWO_HANDED.includes(state.lo.main)) n.main = null;
  state.lo = n; render();
}
function render() {
  const { lo } = state;
  $("modes").replaceChildren(...[["idle", "Idle"], ["attack", "Attack"]].map(([m, l]) => chip(l, state.mode === m, () => { state.mode = m; start = performance.now(); render(); })));
  $("views").replaceChildren(
    chip("Turn left", false, () => { state.facing = turn(state.facing, -1); render(); }),
    ...FACINGS.map((f) => chip(f, state.facing === f, () => { state.facing = f; render(); })),
    chip("Turn right", false, () => { state.facing = turn(state.facing, 1); render(); }));
  $("bodies").replaceChildren(...[["m", "Male"], ["f", "Female"]].map(([b, l]) => chip(l, state.body === b, () => { state.body = b; render(); })));
  $("hairs").replaceChildren(...HAIRS.map(([h, l]) => chip(l, state.hair === h, () => { state.hair = h; render(); })));
  $("beard").replaceChildren(chip("No beard", !state.beard, () => { state.beard = false; render(); }), chip("Beard", state.beard, () => { state.beard = true; render(); }));
  $("effects").replaceChildren(chip("Effects on", state.fx, () => { state.fx = true; render(); }), chip("Effects off", !state.fx, () => { state.fx = false; render(); }));
  $("styles").replaceChildren(...[["muted", "Muted"], ["classic", "Classic"]].map(([s, l]) => chip(l, state.style === s, () => { setStyle(s); state.style = s; cache.clear(); render(); })));
  let label = "Custom loadout";
  $("presets").replaceChildren(...PRESETS.map(({ cls, tiers }) => {
    const row = document.createElement("div"); row.className = "preset";
    const n = document.createElement("span"); n.className = "cls"; n.textContent = cls; row.append(n);
    for (const t of tiers) { const on = same(t.lo, lo); if (on) label = t.label; row.append(chip(t.name, on, () => { state.lo = { ...t.lo }; if (t.look) Object.assign(state, t.look); render(); })); }
    return row;
  }));
  $("presetLabel").textContent = label;
  $("slots").replaceChildren(...SLOTS.map(([slot, title, opts]) => {
    const row = document.createElement("div"); row.className = "slot";
    const t = document.createElement("div"); t.className = "label"; t.textContent = title;
    const c = document.createElement("div"); c.className = "row";
    c.append(...[["", "None"], ...opts].map(([id, name]) => chip(name, (lo[slot] || "") === id, () => pick(slot, id))));
    row.append(t, c);
    return row;
  }));
  const st = stanceOf(lo), sh = shapeOf(lo);
  $("shape").textContent = sh.s; $("shapeName").textContent = sh.name;
  $("widths").textContent = `SHOULDERS ${sh.sh} PX · HEM ${sh.hem} PX`;
  $("stance").textContent = `STANCE: ${STANCE_NAMES[st] ?? STANCES[st]?.name ?? st} · SET BY THE WEAPON`;
  $("unitCap").textContent = `${state.facing} · ${state.mode === "attack" ? "ATTACK · 4 FRAMES" : "IDLE · 2 FRAMES"} · 4×`;
  frames = framesFor();
  setupFx();
  drawArcs();
}

// ---------- live gear effects (pixelfx, loaded from ./pixelfx/ when present) ----------
let PFX = null, pfxFailed = false, gfx = null;
const fxMods = {};
async function setupFx() {
  const pieces = frames.pieces ?? [], ids = [...new Set(pieces.map((p) => p.spec.id))];
  const note = (t) => { $("fxNote").textContent = t; };
  if (!state.fx || !pieces.length) { gfx = null; note(pieces.length ? "EFFECTS OFF" : "NO ENCHANTED GEAR EQUIPPED"); return; }
  try {
    PFX ??= await import("./pixelfx/core/index.js");
    for (const id of ids) fxMods[id] ??= await import(`./pixelfx/fx/${id}.js`);
  } catch (e) { pfxFailed = true; gfx = null; note("EFFECTS NEED THE PIXELFX FILES IN docs/pixelfx (npm run site)"); return; }
  gfx ??= new GearFx(PFX, fxMods, SW, SH, FEET);
  gfx.sync(pieces);
  note("LIVE EFFECTS: " + pieces.map((p) => `${p.spec.element.toUpperCase()} (${p.spec.id})`).join(" · "));
}
const ground1 = (() => { const g = new Img(SW, SH); g.blit(ground, FEET[0] - 24, FEET[1] - 12); return g; })();
const fxCanvas = document.createElement("canvas"); fxCanvas.width = SW; fxCanvas.height = SH;
function fxScene(f, dt) {
  gfx.step(dt);
  const { back, front } = gfx.layers((it) => ({ img: f.srcs[`${it.slot}.${it.id}`], fx: f.feetX, fy: 72 }));
  const img = ground1.rgba(); over(img, back); over(img, f.unitRGBA); over(img, front);
  fxCanvas.getContext("2d").putImageData(new ImageData(img, SW, SH), 0, 0);
  return fxCanvas;
}

// facing arcs: the unit on the centre of a 5 x 5 grid; every other tile is coloured by where an attacker there would stand
function drawArcs() {
  const W = 240, H = 152, OX = 96, OY = 64, img = new Img(W, H), cells = [];
  for (let c = -2; c <= 2; c++) for (let r = -2; r <= 2; r++) cells.push([c, r]);
  cells.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
  const bodyObj = { type: state.body, hair: state.hair, beard: state.beard };
  for (const [c, r] of cells) {
    const sx = OX + (c - r) * 24, sy = OY + (c + r) * 12, centre = c === 0 && r === 0;
    img.blit(tile("grass", 0, (c + 3) * 7 + r, centre ? null : attackSide([0, 0], state.facing, [c, r])), sx, sy);
    if (centre) img.blit(drawUnit(state.lo, state.facing, 0, bodyObj), sx, sy + 12 - 72);
  }
  const a = $("arcs").getContext("2d"); a.imageSmoothingEnabled = false;
  a.clearRect(0, 0, W * 2, H * 2); a.drawImage(toCanvas(img), 0, 0, W * 2, H * 2);
}

// ---------- playback ----------
const ctx = $("unit").getContext("2d"), sctx = $("sil").getContext("2d");
ctx.imageSmoothingEnabled = false; sctx.imageSmoothingEnabled = false;
let frames = [], start = performance.now(), shown = -1, lastFx = 0;
function blitTo(c, src, w, h, flip) {
  c.clearRect(0, 0, w, h);
  if (flip) { c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(src, 0, 0, w, h); c.restore(); }
  else c.drawImage(src, 0, 0, w, h);
}
function tick(now) {
  if (frames.length) {
    const total = frames.reduce((a, f) => a + f.ms, 0);
    let t = (now - start) % total, i = 0;
    while (t >= frames[i].ms) { t -= frames[i].ms; i++; }
    const live = gfx && state.fx && gfx.items.size;
    if (live && now - lastFx >= 1000 / 15) {
      const dt = Math.min(0.2, (now - (lastFx || now)) / 1000) || 1 / 15; lastFx = now;
      blitTo(ctx, fxScene(frames[i], dt), SW * ZOOM, SH * ZOOM, frames.flip);
    } else if (!live && (i !== shown || frames !== tick.last)) blitTo(ctx, frames[i].scene, SW * ZOOM, SH * ZOOM, frames.flip);
    if (i !== shown || frames !== tick.last) { blitTo(sctx, frames[i].sil, SW * 2, SH * 2, frames.flip); shown = i; tick.last = frames; }
  }
  requestAnimationFrame(tick);
}
render();
requestAnimationFrame(tick);
