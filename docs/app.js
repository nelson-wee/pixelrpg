// Wardrobe viewer: draws a unit live with the sprite core and plays its idle or attack animation.
import { CLASSES, KNIGHT_GS, LANCER_PH, TWO_HANDED, STANCES, STYLE, setStyle, stanceOf, dress, layerImg, setCell, tile, Img, OY0 } from "./lib/pixelrpg.js";

// short chip labels for every piece, by slot
const SLOTS = [
  ["head", "HEAD", [["greathelm", "Great helm"], ["coif", "Mail coif"], ["leathercap", "Leather cap"], ["winghelm", "Spire helm"], ["kettle", "Kettle hat"], ["wizhat", "Brim hat"], ["magehood", "Pointed hood"], ["cap", "Apprentice cap"], ["mitre", "Mitre"], ["veil", "Veil"], ["hood", "Hood"], ["huntercap", "Feather cap"], ["falconhelm", "Winged helm"], ["cowl", "Cowl"], ["bandana", "Bandana"], ["shadowmask", "Demon mask"]]],
  ["shoulders", "SHOULDERS", [["pauldrons", "Pauldrons"], ["halfpauldrons", "Half pauldrons"], ["leatherpads", "Leather pads"], ["darkpads", "Lacquered pads"], ["spaulders", "Spaulders"], ["mantle", "Mantle"], ["collar", "Collar"]]],
  ["chest", "CHEST", [["plate", "Plate"], ["chainK", "Hauberk + cross"], ["chain", "Hauberk teal"], ["leatherarmor", "Studded leather"], ["scaleplate", "Dragon scale"], ["gambeson", "Gambeson"], ["robe", "Archmage robe"], ["simplerobe", "Adept robe"], ["shortrobe", "Short robe"], ["gown", "Gown"], ["vestment", "Vestment"], ["habit", "Habit"], ["brigandine", "Brigandine"], ["jerkin", "Jerkin"], ["tunic", "Tunic"], ["garb", "Garb"], ["lamellar", "Lamellar"], ["darktunic", "Patched tunic"]]],
  ["arms", "ARMS", [["gauntlets", "Gauntlets"], ["mail", "Mail"], ["bracers", "Bracers"], ["bell", "Bell sleeves"], ["magesleeves", "Straight sleeves"], ["sleeves", "Long sleeves"], ["woolsleeves", "Wool sleeves"]]],
  ["legs", "LEGS", [["greaves", "Greaves"], ["chausses", "Chausses"], ["leggings", "Leggings"], ["trousers", "Trousers"], ["wraps", "Wraps"]]],
  ["back", "BACK", [["templecloak", "Trimmed cloak"], ["cape", "Cape"], ["dragoncape", "Dragon cape"], ["cloak", "Cloak"], ["wardencloak", "Warden cloak"], ["quiver", "Quiver"], ["scarf", "Scarf"], ["longscarf", "Long scarf"]]],
  ["main", "MAIN HAND", [["sword", "Sword"], ["greatsword", "Greatsword (2H)"], ["mace", "Mace"], ["dagger", "Dagger"], ["shortspear", "Short spear"], ["spear", "Spear (2H)"], ["dragonspear", "Dragon lance (2H)"], ["staff", "Staff"], ["rod", "Rod"], ["sceptre", "Sceptre"]]],
  ["off", "OFF HAND", [["shield", "Kite shield"], ["buckler", "Buckler"], ["dagger", "Dagger"], ["offsword", "Sword"], ["offmace", "Mace"], ["bow", "Longbow"], ["shortbow", "Short bow"], ["greatbow", "Greatbow"], ["tome", "Book"]]],
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

const state = { lo: { ...CLASSES.knight.loadout }, body: "m", hair: "hair", beard: false, view: "front", mode: "idle", style: STYLE.name };
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
  const { lo, body, hair, beard, view, mode, style } = state, bodyObj = { type: body, hair, beard };
  const key = JSON.stringify([clean(lo), body, hair, beard, view, mode, style]);
  if (cache.has(key)) return cache.get(key);
  let units, feetX, ms;
  if (mode === "attack") {
    setCell(96, 24);
    units = [0, 1, 2, 3].map((p) => dress(lo, view, 0, bodyObj, null, stanceOf(lo), p));
    setCell(48, 0); feetX = 48; ms = ATTACK_MS;
  } else {
    units = [0, 1].map((b) => dress(lo, view, b, bodyObj)); feetX = 24; ms = IDLE_MS;
  }
  const frames = units.map((u, i) => ({ scene: toCanvas(sceneOf(u, feetX)), sil: toCanvas(silOf(u, feetX)), ms: ms[i] }));
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
  $("views").replaceChildren(...[["front", "SE (front)"], ["back", "NW (back)"]].map(([v, l]) => chip(l, state.view === v, () => { state.view = v; render(); })));
  $("bodies").replaceChildren(...[["m", "Male"], ["f", "Female"]].map(([b, l]) => chip(l, state.body === b, () => { state.body = b; render(); })));
  $("hairs").replaceChildren(...HAIRS.map(([h, l]) => chip(l, state.hair === h, () => { state.hair = h; render(); })));
  $("beard").replaceChildren(chip("No beard", !state.beard, () => { state.beard = false; render(); }), chip("Beard", state.beard, () => { state.beard = true; render(); }));
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
  $("unitCap").textContent = `${state.view === "front" ? "SE" : "NW"} · ${state.mode === "attack" ? "ATTACK · 4 FRAMES" : "IDLE · 2 FRAMES"} · 4×`;
  frames = framesFor();
}

// ---------- playback ----------
const ctx = $("unit").getContext("2d"), sctx = $("sil").getContext("2d");
ctx.imageSmoothingEnabled = false; sctx.imageSmoothingEnabled = false;
let frames = [], start = performance.now(), shown = -1;
function tick(now) {
  if (frames.length) {
    const total = frames.reduce((a, f) => a + f.ms, 0);
    let t = (now - start) % total, i = 0;
    while (t >= frames[i].ms) { t -= frames[i].ms; i++; }
    if (i !== shown || frames !== tick.last) {
      ctx.clearRect(0, 0, SW * ZOOM, SH * ZOOM); ctx.drawImage(frames[i].scene, 0, 0, SW * ZOOM, SH * ZOOM);
      sctx.clearRect(0, 0, SW * 2, SH * 2); sctx.drawImage(frames[i].sil, 0, 0, SW * 2, SH * 2);
      shown = i; tick.last = frames;
    }
  }
  requestAnimationFrame(tick);
}
render();
requestAnimationFrame(tick);
