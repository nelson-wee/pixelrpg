// Party screen: before each battle, pick a character and change its gear and body. Built from the Wardrobe's
// parts (gear lists, presets, live sprite preview). The party rules are in lib/party.js; this file only draws.
import { Img, tile, drawUnit, setCell, stanceOf, STANCES } from "./lib/pixelrpg.js";
import { LOOKS } from "./lib/presets.js";
import { SLOTS, HAIRS, STANCE_NAMES } from "./lib/gearlist.js";
import { makeCharacter } from "./lib/character.js";
import { SKILLS } from "./lib/battle.js";
import * as P from "./lib/party.js";

const $ = (id) => document.getElementById(id);
const SW = 112, SH = 104, FEET = [56, 84], ZOOM = 3;
const ATTACK_MS = [560, 320, 200, 350], IDLE_MS = [600, 600];
const ground = tile("grass", 1, 3);

function toCanvas(img) {
  const c = document.createElement("canvas"); c.width = img.w; c.height = img.h;
  c.getContext("2d").putImageData(new ImageData(img.rgba(), img.w, img.h), 0, 0);
  return c;
}
function chip(label, fn, opts = {}) {
  const el = document.createElement("button"); el.type = "button"; el.className = "chip" + (opts.main ? " main" : ""); el.textContent = label;
  if (opts.pressed !== undefined) el.setAttribute("aria-pressed", String(opts.pressed));
  el.disabled = !!opts.disabled; el.addEventListener("click", fn); return el;
}
// the unit on a tile, idle (2 frames, 48 px cell) or attacking (4 poses, 96 px cell)
const frames = new Map();
function framesOf(def, mode) {
  const k = JSON.stringify([def.look, mode]);
  if (!frames.has(k)) {
    const lo = def.look.loadout, body = def.look.body, st = stanceOf(lo), atk = mode === "attack";
    if (atk) setCell(96, 24);
    try {
      frames.set(k, (atk ? [0, 1, 2, 3] : [0, 1]).map((p, i) => {
        const u = drawUnit(lo, "SE", atk ? 0 : p, body, st, atk ? p : 0), s = new Img(SW, SH);
        s.blit(ground, FEET[0] - 24, FEET[1] - 12); s.blit(u, FEET[0] - (atk ? 48 : 24), FEET[1] - 72);
        return { c: toCanvas(s), ms: (atk ? ATTACK_MS : IDLE_MS)[i] };
      }));
    } finally { if (atk) setCell(48, 0); }
    if (frames.size > 80) frames.clear();
  }
  return frames.get(k);
}
function portrait(def) {
  const c = document.createElement("canvas"); c.width = 48; c.height = 64;
  const g = c.getContext("2d"); g.drawImage(toCanvas(drawUnit(def.look.loadout, "SE", 0, def.look.body)), 0, 10, 48, 64, 0, 0, 48, 64);
  c.setAttribute("aria-hidden", "true");
  return c;
}
const stanceName = (lo) => { const st = stanceOf(lo); return STANCE_NAMES[st] ?? STANCES[st]?.name ?? st; };
const rangeText = (r, line) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) + (line ? " (straight line)" : "");

/** Mounts the party screen. onChange(party) runs after every edit (to save it); onStart(party) starts the battle. */
export function createMuster({ party, onChange, onStart }) {
  let sel = 0, mode = "idle", start = performance.now(), running = false;
  const ctx = $("musterCanvas").getContext("2d"); ctx.imageSmoothingEnabled = false;
  const set = (def) => { party = party.map((d, i) => (i === sel ? def : d)); onChange(party); render(); };

  function render() {
    const def = party[sel], lo = def.look.loadout, body = def.look.body, c = makeCharacter(def), st = c.stats;
    $("musterRoster").replaceChildren(...party.map((d, i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "mcard"; b.setAttribute("aria-pressed", String(i === sel));
      const t = document.createElement("div");
      t.innerHTML = `<div class="nm"></div><div class="sub"></div><div class="sub"></div>`;
      t.querySelector(".nm").textContent = d.name;
      const [a1, a2] = t.querySelectorAll(".sub");
      a1.textContent = makeCharacter(d).className.toUpperCase(); a2.textContent = `GEAR · ${d.look.name.toUpperCase()}`;
      b.append(portrait(d), t);
      b.setAttribute("aria-label", `${d.name}, ${makeCharacter(d).className}, ${d.look.name} gear`);
      b.addEventListener("click", () => { sel = i; render(); });
      return b;
    }));
    $("musterLabel").textContent = `${def.name.toUpperCase()} · ${c.className.toUpperCase()} · GEAR: ${def.look.name.toUpperCase()}`;
    $("musterModes").replaceChildren(...[["idle", "Idle"], ["attack", "Attack"]].map(([m, l]) => chip(l, () => { mode = m; start = performance.now(); render(); }, { pressed: mode === m })));
    $("musterBody").replaceChildren(...[["m", "Male"], ["f", "Female"]].map(([t, l]) => chip(l, () => set(P.setBody(def, { type: t })), { pressed: body.type === t })));
    $("musterHair").replaceChildren(...HAIRS.map(([h, l]) => chip(l, () => set(P.setBody(def, { hair: h })), { pressed: body.hair === h })));
    $("musterBeard").replaceChildren(chip("No beard", () => set(P.setBody(def, { beard: false })), { pressed: !body.beard }), chip("Beard", () => set(P.setBody(def, { beard: true })), { pressed: !!body.beard }));
    const skills = c.skills.map((id) => `${SKILLS[id].name} (${SKILLS[id].mp} MP)`).join(", ") || "None";
    $("musterStats").innerHTML = `<span>STANCE</span><b></b><span>HEALTH</span><b>${st.hp}</b><span>ATTACK</span><b>${st.atk}</b><span>MOVE</span><b>${st.move}</b>
      <span>RANGE</span><b>${rangeText(st.range, st.line)}</b>${st.mp ? `<span>MP</span><b>${st.mp}</b>` : ""}<span>SKILLS</span><b>${skills}</b>`;
    $("musterStats").querySelector("b").textContent = stanceName(lo);
    $("musterPresets").replaceChildren(...Object.entries(LOOKS).map(([key, k]) => {
      const row = document.createElement("div"); row.className = "row";
      const n = document.createElement("span"); n.className = "cls"; n.textContent = k.name; row.append(n);
      k.tiers.forEach(([name], t) => row.append(chip(name, () => set(P.wearPreset(def, key, t)), { pressed: def.look.name === name })));
      return row;
    }));
    $("musterSlots").replaceChildren(...SLOTS.map(([slot, title, opts]) => {
      const row = document.createElement("div"); row.className = "mslot";
      const t = document.createElement("div"); t.className = "label"; t.textContent = title;
      const r = document.createElement("div"); r.className = "row"; r.setAttribute("role", "group"); r.setAttribute("aria-label", title);
      r.append(...[["", "None"], ...opts].map(([id, name]) => chip(name, () => set(P.equip(def, slot, id)), { pressed: (lo[slot] || "") === id })));
      row.append(t, r);
      return row;
    }));
  }
  function tick(now) {
    if (!running) return;
    const f = framesOf(party[sel], mode), total = f.reduce((a, x) => a + x.ms, 0);
    let t = (now - start) % total, i = 0;
    while (t >= f[i].ms) { t -= f[i].ms; i++; }
    ctx.clearRect(0, 0, SW * ZOOM, SH * ZOOM); ctx.drawImage(f[i].c, 0, 0, SW * ZOOM, SH * ZOOM);
    requestAnimationFrame(tick);
  }
  $("musterStart").addEventListener("click", () => onStart(party));
  $("musterReset").addEventListener("click", () => { party = P.defaultParty(); onChange(party); render(); });
  return {
    show(p) { if (p) party = p; $("musterView").hidden = false; render(); if (!running) { running = true; requestAnimationFrame(tick); } },
    hide() { $("musterView").hidden = true; running = false; },
  };
}
