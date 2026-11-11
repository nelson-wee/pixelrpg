// Battle demo: draws the demo map and both teams live with the sprite core, and runs the rules in lib/battle.js.
import { TW, TH, STEP, HW, HH, FX, FY, Img, tile, cursor, prop, drawUnit, setCell, stanceOf, FACING_DIR, facingToward, attackSide, TEAM_SCHEMES } from "./lib/pixelrpg.js";
import * as B from "./lib/battle.js";
import { actorFrom } from "./lib/gearfx.js";
import * as P from "./lib/party.js";
import { createMuster } from "./muster.js";

const $ = (id) => document.getElementById(id);
const N = B.N, W = N * TW + HW, H = N * TH + 6 * STEP + 76, OX = N * HW - HW + 8, OY = 60;
const ATTACK_MS = [220, 320, 200, 350];           // ready, wind-up, strike, follow-through
const STEP_MS = 170, ARROW_PX = 360, SPELL_PX = 240; // 24 and 16 px per frame at 15 fps
const TEAM = { player: { ring: "#8cc4f0", bar: "#6ab0e8" }, enemy: { ring: "#f08a6e", bar: "#e0604e" } };
const SIDE_COLOR = { front: "#fbf2dc", side: "#f0c85a", back: "#f08a6e" };

// ---------- geometry: tile tops and unit feet in map pixels ----------
const tileTop = (i, j) => [OX + (i - j) * HW, OY + (i + j) * HH - B.height(i, j) * STEP + 6 * STEP - STEP];
const feetOf = (i, j) => { const [x, y] = tileTop(i, j); return [x + HW, y + HH]; };

// ---------- cached pictures ----------
function toCanvas(img, fn) {
  const c = document.createElement("canvas"); c.width = img.w; c.height = img.h;
  const d = img.rgba(); if (fn) fn(d);
  c.getContext("2d").putImageData(new ImageData(d, img.w, img.h), 0, 0);
  return c;
}
const tiles = new Map();
function tileOf(i, j, mark = null) {
  const k = `${i},${j},${mark}`;
  if (!tiles.has(k)) { const img = tile(B.terrain(i, j), B.height(i, j) + 1, i * 13 + j * 7, mark); tiles.set(k, { img, c: toCanvas(img) }); }
  return tiles.get(k);
}
const props = new Map();
const propOf = (kind) => { if (!props.has(kind)) props.set(kind, toCanvas(prop(kind))); return props.get(kind); };
const cursorC = (() => { const img = new Img(TW, TH); cursor(img, 0, 0); return toCanvas(img); })();
// team ring at the feet, with a small wedge that points where the unit faces
const DIAG = { SE: [1, 1], SW: [-1, 1], NW: [-1, -1], NE: [1, -1] };
const rings = new Map();
function ringOf(team, facing) {
  const k = team + facing;
  if (!rings.has(k)) {
    const img = new Img(40, 20), [dx, dy] = DIAG[facing], s = Math.SQRT1_2;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) {
      const nx = (x + 0.5 - 20) / 12, ny = (y + 0.5 - 10) / 6, r = nx * nx + ny * ny;
      const along = (nx * dx + ny * dy) * s, across = Math.abs(nx * dy - ny * dx) * s;
      if ((r <= 1 && r >= 0.6) || (along >= 0.9 && along <= 1.5 && across <= (1.5 - along) * 0.85)) img.set(x, y, { hex: TEAM[team].ring });
    }
    rings.set(k, toCanvas(img));
  }
  return rings.get(k);
}
// unit sprites: idle frames in the 48 px cell, attack poses in the 96 px cell; each with a dim copy (done) and a white copy (hit)
const sprites = new Map();
let scheme = "crimson"; // enemy colours: a key of TEAM_SCHEMES, or "" for the gear's own colours
try { const s = localStorage.getItem("pixelrpg.enemyScheme"); if (s !== null && (s === "" || TEAM_SCHEMES[s])) scheme = s; } catch (e) { /* storage blocked */ }
const bodyOf = (u) => (u.team === "enemy" && scheme ? { ...u.body, scheme } : u.body);
function spriteOf(u, facing, bob, pose) {
  const atk = pose !== null, k = [u.id, facing, atk ? "a" + pose : "i" + bob, u.team === "enemy" ? scheme : ""].join("|");
  if (!sprites.has(k)) {
    if (atk) setCell(96, 24);
    let img;
    try { img = drawUnit(u.lo, facing, atk ? 0 : bob, bodyOf(u), stanceOf(u.lo), atk ? pose : 0); } finally { if (atk) setCell(48, 0); }
    const dim = (d) => { for (let i = 0; i < d.length; i += 4) { d[i] *= 0.55; d[i + 1] *= 0.55; d[i + 2] *= 0.62; } };
    const white = (d) => { for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) d[i] = d[i + 1] = d[i + 2] = 255; };
    const d = img.rgba(); let top = 0;
    while (top < img.h && !d.subarray(top * img.w * 4, (top + 1) * img.w * 4).some((v, i) => i % 4 === 3 && v === 255)) top++;
    sprites.set(k, { img, c: toCanvas(img), dim: toCanvas(img, dim), white: toCanvas(img, white), fx: atk ? 48 : FX, top, d, w: img.w, h: img.h });
  }
  return sprites.get(k);
}

// ---------- skill effects: pixelfx, loaded from ./pixelfx/ (npm run site copies it there) ----------
// Heal wraps the target's own sprite (pixelfx reads its mask); Fireball bursts on the target tile.
// Without the pixelfx files, simple pixel sparks stand in.
const FIRE = { palette: ["#1e0c14", "#6e1c34", "#b0303e", "#e0604e", "#f0c85a", "#fff2b0", "#ffffff"], accent: ["#3a1428", "#6e1c34", "#e0604e", "#f6a07a", "#ffe0b8"] };
const SKILL_FX = { heal: { id: "holy/heal", body: true }, fireball: { id: "explosions/plasma-explosion", dy: -14, opts: FIRE } };
let PFX = null;
const fxMods = {};
(async () => {
  try {
    const core = await import("./pixelfx/core/index.js");
    for (const f of Object.values(SKILL_FX)) fxMods[f.id] = await import(`./pixelfx/fx/${f.id}.js`);
    PFX = core;
  } catch (e) { PFX = null; /* no pixelfx files: the sparks stand in */ }
})();
function spawnFx(skill, tile, unit) {
  const f = SKILL_FX[skill], mod = PFX && fxMods[f.id], [fx, fy] = feetOf(...tile);
  const e = { skill, depth: B.key(tile), x: fx, y: fy + (f.dy ?? 0), t0: clock, overlay: !f.body };
  if (mod) {
    const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin, v = unit && vis.get(unit.id);
    const actor = f.body && unit ? actorFrom(PFX, spriteOf(unit, v.facing ?? unit.facing, 0, null).img, FX, FY) : undefined;
    Object.assign(e, { inst: PFX.createFx(mod, { x: ox, y: oy, seed: 3, ...(actor ? { actor } : {}), ...(f.opts ?? {}) }), w, h, ox, oy, dur: mod.meta.duration * 1000,
      frame: PFX.createFrame(w, h), back: Object.assign(document.createElement("canvas"), { width: w, height: h }), front: Object.assign(document.createElement("canvas"), { width: w, height: h }) });
  } else e.dur = skill === "heal" ? 1200 : 800;
  effects.push(e);
  return e;
}
function stepFx(dt) {
  effects = effects.filter((e) => clock - e.t0 < e.dur);
  for (const e of effects) if (e.inst) {
    e.inst.update(dt / 1000);
    for (const layer of ["back", "front"]) {
      PFX.clearFrame(e.frame); e.inst.draw(e.frame, layer);
      e[layer].getContext("2d").putImageData(new ImageData(PFX.composite(e.frame, new Uint8ClampedArray(e.w * e.h * 4), null), e.w, e.h), 0, 0);
    }
  }
}
function drawFx(e, layer) {
  if (e.inst) { ctx.drawImage(e[layer], Math.round(e.x - e.ox), Math.round(e.y - e.oy)); return; }
  if (layer !== "front") return;
  const k = (clock - e.t0) / e.dur;
  if (e.skill === "heal") { // rising sparks
    for (let n = 0; n < 14; n++) {
      const a = n * 2.4, r = 7 + (n % 3) * 3, y = e.y - 4 - ((k * 50 + n * 7) % 48);
      ctx.fillStyle = n % 3 ? "#ffd994" : "#a4e08a"; ctx.fillRect(Math.round(e.x + Math.cos(a + k * 6) * r), Math.round(y), 1, n % 4 ? 1 : 2);
    }
  } else { // a ring of fire that grows over the plus shape
    const r = 6 + k * 40;
    for (let n = 0; n < 40; n++) { const a = (n / 40) * Math.PI * 2; ctx.fillStyle = n % 2 ? "#f0c85a" : "#e0604e"; ctx.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(e.y + Math.sin(a) * r * 0.5), 2, 2); }
  }
}

// ---------- the game clock (it stops during hit-stop) ----------
let clock = 0, last = performance.now(), stopUntil = 0;
const waiters = [];
const wait = (ms) => new Promise((r) => waiters.push({ at: clock + ms, r }));
const hitStop = (ms) => { stopUntil = performance.now() + ms; };

// ---------- state ----------
let b, vis, ui, floats, shots, effects = [];
function reset() {
  b = B.newBattle(B.demoRoster(party));
  vis = new Map(b.units.map((u) => [u.id, { pos: null, depth: null, facing: null, pose: null, flash: 0, gone: false, blink: false, hp: u.hp }]));
  ui = { mode: "idle", sel: null, target: null, from: null, reach: null, hover: null, cursor: [4, 7], busy: false, info: null };
  floats = []; shots = []; effects = [];
  $("over").classList.remove("show");
  banner(`Round 1 · Player phase`);
  refresh();
}

// ---------- marks under the tiles ----------
function arcsAround(u, facing, marks) {
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const d = B.dist(u.tile, [i, j]);
    if (d > 0 && d <= 3) marks.set(`${i},${j}`, attackSide(u.tile, facing, [i, j]));
  }
}
function marksNow() {
  const m = new Map(), { mode, sel } = ui;
  if (ui.busy && mode !== "enemy") return m;
  if (mode === "menu") {
    if (!sel.moved) for (const k of ui.reach.keys()) m.set(k, "move");
    if (!sel.acted) for (const t of B.targets(b, sel)) m.set(B.key(t.tile), "attack");
  } else if (mode === "move") {
    for (const k of ui.reach.keys()) m.set(k, "move");
  } else if (mode === "skill") {
    const sk = B.SKILLS[ui.skill];
    for (const t of B.skillTiles(ui.skill, sel.tile)) m.set(B.key(t), sk.target === "ally" ? "ally" : "attack");
    if (aimOk()) for (const t of B.areaOf(ui.skill, skillAim())) m.set(B.key(t), "area");
  } else if (mode === "target") {
    for (const t of B.rangeTiles(sel)) m.set(B.key(t), "attack");
  } else if (mode === "face") {
    arcsAround(sel, vis.get(sel.id).facing ?? sel.facing, m);
  } else if (mode === "idle" && $("arcs").checked && ui.hover) {
    const u = B.unitAt(b, ui.hover);
    if (u) arcsAround(u, u.facing, m);
  }
  return m;
}

// ---------- drawing ----------
const cv = $("map"), ctx = cv.getContext("2d");
let Z = 2;
function fit() {
  const avail = $("stage").clientWidth - 4, scale = avail >= W * 2 ? Math.min(3, Math.floor(avail / W)) : Math.max(0.5, avail / W);
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = Math.round(W * scale) + "px"; cv.style.height = Math.round(H * scale) + "px";
  cv.width = Math.round(W * scale * dpr); cv.height = Math.round(H * scale * dpr);
  Z = cv.width / W;
}
function unitPos(u) { const v = vis.get(u.id); return v.pos ?? feetOf(...u.tile); }
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#120c18"; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(Z, 0, 0, Z, 0, 0); ctx.imageSmoothingEnabled = false;
  const marks = marksNow(), byDepth = new Map();
  for (const u of b.units) {
    const v = vis.get(u.id); if (v.gone) continue;
    const k = B.key(v.depth ?? u.tile); if (!byDepth.has(k)) byDepth.set(k, []); byDepth.get(k).push(u);
  }
  const cur = ui.hover ?? ui.cursor, beat = Math.floor(clock / 600);
  for (let s = 0; s <= 2 * (N - 1); s++) for (let i = 0; i < N; i++) {
    const j = s - i; if (j < 0 || j >= N) continue;
    const k = `${i},${j}`, [tx, ty] = tileTop(i, j);
    ctx.drawImage(tileOf(i, j, marks.get(k) ?? null).c, tx, ty);
    if ((cur && B.same(cur, [i, j])) || ((ui.mode === "move" || ui.mode === "target" || ui.mode === "skill") && B.same(ui.cursor, [i, j])) || (ui.sel && B.same(ui.sel.tile, [i, j]) && ui.mode !== "enemy")) ctx.drawImage(cursorC, tx, ty);
    if (B.PROPS[k]) ctx.drawImage(propOf(B.PROPS[k]), tx + HW - 20, ty + HH - 48);
    const here = effects.filter((e) => !e.overlay && e.depth === k);
    for (const e of here) drawFx(e, "back");
    for (const u of byDepth.get(k) ?? []) {
      const v = vis.get(u.id), facing = v.facing ?? u.facing, [kx, ky] = knockOf(v);
      const [fx, fy] = unitPos(u).map((c, i) => c + (i ? ky : kx));
      ctx.drawImage(ringOf(u.team, facing), Math.round(fx) - 20, Math.round(fy) - 10);
      if (v.blink && Math.floor(clock / 80) % 2) continue;
      const bob = v.walking ? Math.floor(clock / STEP_MS) % 2 : (beat + b.units.indexOf(u)) % 2;
      const sp = spriteOf(u, facing, bob, v.pose ?? reactionOf(v)), pic = v.flash > clock ? sp.white : u.done && u.alive ? sp.dim : sp.c;
      ctx.drawImage(pic, Math.round(fx) - sp.fx, Math.round(fy) - FY + 1);
    }
    for (const e of here) drawFx(e, "front");
  }
  for (const e of effects) if (e.overlay) { drawFx(e, "back"); drawFx(e, "front"); }
  // health bars, over everything
  for (const u of b.units) {
    const v = vis.get(u.id); if (v.gone || (v.blink && Math.floor(clock / 80) % 2)) continue;
    const [fx, fy] = unitPos(u), top = spriteOf(u, "SE", 0, null).top, x = Math.round(fx) - 11, y = Math.round(fy) - FY + 1 + top - 6;
    ctx.fillStyle = "#120c18"; ctx.fillRect(x, y, 22, 4);
    ctx.fillStyle = "#3d2f42"; ctx.fillRect(x + 1, y + 1, 20, 2);
    ctx.fillStyle = TEAM[u.team].bar; ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((20 * v.hp) / u.maxHp)), 2);
    if (u.maxMp) { // MP under the health bar
      ctx.fillStyle = "#120c18"; ctx.fillRect(x, y + 4, 22, 3);
      ctx.fillStyle = "#3d2f42"; ctx.fillRect(x + 1, y + 5, 20, 1);
      ctx.fillStyle = "#a890f0"; ctx.fillRect(x + 1, y + 5, Math.round((20 * u.mp) / u.maxMp), 1);
    }
  }
  // projectiles
  for (const p of shots) {
    const k = Math.min(1, (clock - p.t0) / p.dur), x = p.a[0] + (p.b[0] - p.a[0]) * k, y = p.a[1] + (p.b[1] - p.a[1]) * k;
    if (p.kind === "arrow") {
      const dx = p.b[0] - p.a[0], dy = p.b[1] - p.a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      for (let t = 0; t < 8; t++) { ctx.fillStyle = t < 2 ? "#e8e0d0" : t > 5 ? "#c84a3a" : "#8a6a48"; ctx.fillRect(Math.round(x - ux * t), Math.round(y - uy * t), 1, 1); }
    } else {
      const f = Math.floor(clock / 60) % 2;
      ctx.fillStyle = "#c04a2a"; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 2, 6, 4); ctx.fillRect(Math.round(x) - 2, Math.round(y) - 3, 4, 6);
      ctx.fillStyle = "#f0a040"; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 1 - f, 4, 3);
      ctx.fillStyle = "#fff2b0"; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
  }
  // floating numbers
  ctx.textAlign = "center"; ctx.lineJoin = "round";
  floats = floats.filter((f) => clock - f.t0 < f.dur);
  for (const f of floats) {
    const k = (clock - f.t0) / f.dur, y = f.y - 14 * Math.min(1, k * 2.2);
    ctx.globalAlpha = k > 0.75 ? (1 - k) * 4 : 1;
    ctx.font = `700 ${f.size}px 'Pixelify Sans', sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = "#120c18";
    ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
    ctx.globalAlpha = 1;
  }
}
function frame(now) {
  const dt = Math.min(50, now - last); last = now;
  if (now >= stopUntil) { clock += dt; stepFx(dt); }
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].at <= clock) { waiters[i].r(); waiters.splice(i, 1); }
  if (b) draw();
  requestAnimationFrame(frame);
}

// ---------- animation ----------
// a hit: the unit flinches (hurt:0, then hurt:1 half way back) and is knocked 2 px away from the blow, then settles
const FLINCH = [170, 230];
function flinch(t, from) {
  const vt = vis.get(t.id), [ax, ay] = from, [tx, ty] = unitPos(t), L = Math.hypot(tx - ax, ty - ay) || 1;
  vt.react = { t0: clock, dx: ((tx - ax) / L) * 2, dy: ((ty - ay) / L) * 1 };
}
function reactionOf(v) {
  const r = v.react; if (!r) return null;
  const k = clock - r.t0;
  return k < FLINCH[0] ? "hurt:0" : k < FLINCH[0] + FLINCH[1] ? "hurt:1" : null;
}
function knockOf(v) {
  const r = v.react; if (!r) return [0, 0];
  const k = clock - r.t0, f = k < FLINCH[0] ? 1 : k < FLINCH[0] + FLINCH[1] ? 1 - (k - FLINCH[0]) / FLINCH[1] : 0;
  return [Math.round(r.dx * f), Math.round(r.dy * f)];
}
async function walk(u, path) {
  const v = vis.get(u.id); let from = u.tile;
  v.walking = true;
  for (const to of path) {
    v.facing = B.stepFacing(from, to);
    v.depth = to[0] + to[1] > from[0] + from[1] ? to : from;
    const a = feetOf(...from), z = feetOf(...to), dh = Math.abs(B.height(...to) - B.height(...from)), T = STEP_MS + dh * 50, t0 = clock;
    const hop = dh ? 6 + dh * 4 : 1;
    while (clock - t0 < T) {
      const k = Math.min(1, (clock - t0) / T);
      v.pos = [a[0] + (z[0] - a[0]) * k, a[1] + (z[1] - a[1]) * k - hop * Math.sin(Math.PI * k)];
      await wait(1);
    }
    from = to;
  }
  v.walking = false; v.pos = null; v.depth = null; v.facing = null;
}
const fly = (u, t, kind) => flyTo(u, unitPos(t), kind);
function flyTo(u, z, kind) {
  const a = unitPos(u), dx = Math.sign(z[0] - a[0]);
  const p = { kind, a: [a[0] + dx * 8, a[1] - 30], b: [z[0], z[1] - 16], t0: clock };
  p.dur = (Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]) / (kind === "arrow" ? ARROW_PX : SPELL_PX)) * 1000;
  shots.push(p);
  return wait(p.dur).then(() => { shots = shots.filter((s) => s !== p); });
}
async function attackAnim(u, t) {
  const v = vis.get(u.id), vt = vis.get(t.id), facing = facingToward(u.tile, t.tile);
  v.facing = facing;
  const impact = () => {
    const r = B.strike(b, u, t);
    vt.hp = t.hp; vt.flash = clock + 90; flinch(t, unitPos(u));
    const [x, y] = unitPos(t), top = spriteOf(t, "SE", 0, null).top, hy = y - FY + 1 + top - 10;
    floats.push({ text: String(r.dmg), x, y: hy, color: "#fbf2dc", size: 12, t0: clock, dur: 1000 });
    if (r.side !== "front") floats.push({ text: r.side.toUpperCase() + "!", x, y: hy - 11, color: SIDE_COLOR[r.side], size: 8, t0: clock, dur: 1000 });
    hitStop(r.side === "back" ? 160 : 100);
    log();
  };
  for (const [i, ms] of ATTACK_MS.slice(0, 2).entries()) { v.pose = i; await wait(ms); }
  v.pose = 2;
  if (B.RANGED(u)) {
    const flight = fly(u, t, u.projectile ?? "spell");
    await wait(ATTACK_MS[2]); v.pose = 3;
    await flight; impact(); await wait(320);
  } else {
    await wait(70); impact(); await wait(ATTACK_MS[2] - 70); v.pose = 3; await wait(ATTACK_MS[3]);
  }
  v.pose = null; v.facing = null;
  if (!t.alive) { vt.blink = true; await wait(640); vt.gone = true; vt.blink = false; }
}

// a skill: the caster's attack poses, then a fireball flies to the tile and bursts, or a heal plays on the ally
async function castAnim(u, id, tile) {
  const v = vis.get(u.id), sk = B.SKILLS[id];
  if (!B.same(tile, u.tile)) v.facing = facingToward(u.tile, tile);
  v.pose = 0; await wait(160); v.pose = 1; await wait(320); v.pose = 2;
  const apply = () => {
    const r = B.cast(b, u, id, tile);
    let back = false;
    for (const e of r.effects) {
      const ve = vis.get(e.unit.id), [x, y] = unitPos(e.unit), hy = y - FY + 1 + spriteOf(e.unit, "SE", 0, null).top - 10;
      ve.hp = e.unit.hp;
      if (e.kind === "heal") floats.push({ text: `+${e.amount}`, x, y: hy, color: "#a4e08a", size: 12, t0: clock, dur: 1100 });
      else {
        ve.flash = clock + 90; flinch(e.unit, feetOf(...tile)); back ||= e.side === "back";
        floats.push({ text: String(e.amount), x, y: hy, color: "#fbf2dc", size: 12, t0: clock, dur: 1000 });
        if (e.side !== "front") floats.push({ text: e.side.toUpperCase() + "!", x, y: hy - 11, color: SIDE_COLOR[e.side], size: 8, t0: clock, dur: 1000 });
      }
    }
    if (r.effects.some((e) => e.kind === "damage")) hitStop(back ? 170 : 130);
    log(); refresh();
    return r;
  };
  let r;
  if (sk.target === "tile") {
    const [fx, fy] = feetOf(...tile), flight = flyTo(u, [fx, fy - 12], "spell");
    await wait(200); v.pose = 3;
    await flight; spawnFx(id, tile, null); r = apply(); await wait(650);
  } else {
    await wait(200); v.pose = 3;
    spawnFx(id, tile, B.unitAt(b, tile)); await wait(700); r = apply(); await wait(600);
  }
  v.pose = null; v.facing = null;
  const down = r.effects.filter((e) => !e.unit.alive).map((e) => vis.get(e.unit.id));
  if (down.length) { for (const d of down) d.blink = true; await wait(640); for (const d of down) { d.gone = true; d.blink = false; } }
}

// ---------- the player's turn ----------
// Every step has a button (command menu, target picker, direction pad), so the game plays on a phone without
// precise taps. Map taps and the keyboard still work as shortcuts.
const ready = (u) => u && u.alive && u.team === "player" && !u.done;
function select(u) {
  Object.assign(ui, { mode: "menu", sel: u, target: null, from: { tile: [...u.tile], facing: u.facing }, reach: B.reach(b, u), cursor: [...u.tile] });
  ui.info = u; refresh();
}
function deselect() { Object.assign(ui, { mode: "idle", sel: null, target: null, reach: null }); refresh(); }
function nextUnit() {
  const list = b.units.filter(ready), i = list.indexOf(ui.sel ?? ui.info);
  if (list.length) select(list[(i + 1) % list.length]);
}
function toMenu() { if (ui.sel) vis.get(ui.sel.id).facing = null; ui.mode = "menu"; ui.target = null; ui.cursor = [...ui.sel.tile]; refresh(); }
function startMove() { ui.mode = "move"; ui.cursor = [...ui.sel.tile]; refresh(); }
function moveCursor([dc, dr]) {
  const n = [ui.cursor[0] + dc, ui.cursor[1] + dr];
  if (B.inside(n)) { ui.cursor = n; refresh(); }
}
const moveNode = () => ui.reach?.get(B.key(ui.cursor));
async function moveTo(node) {
  ui.busy = true; refresh();
  await walk(ui.sel, node.path);
  B.moveAlong(b, ui.sel, node.path);
  ui.busy = false; toMenu();
}
function undoMove() {
  const u = ui.sel; u.tile = [...ui.from.tile]; u.facing = ui.from.facing; u.moved = false;
  select(u);
}
// targets in range, the hardest hit first
const targetList = () => B.targets(b, ui.sel).sort((p, q) => B.preview(b, ui.sel, q).dmg - B.preview(b, ui.sel, p).dmg);
function startTarget(t = null) {
  const list = targetList(); if (!list.length) return;
  ui.mode = "target"; ui.target = t ?? list[0]; ui.cursor = [...ui.target.tile]; refresh();
}
function cycleTarget(d) {
  const list = targetList(), i = list.indexOf(ui.target);
  ui.target = list[(i + d + list.length) % list.length]; ui.cursor = [...ui.target.tile]; refresh();
}
async function attack() {
  const u = ui.sel, t = ui.target;
  ui.busy = true; refresh();
  await attackAnim(u, t);
  ui.busy = false;
  if (over()) return;
  startFacing();
}
// skills: a submenu, then an aim. Heal picks an ally (most hurt first); Fireball aims at a tile with the pad.
function startSkills() { ui.mode = "skills"; refresh(); }
const healList = () => B.skillTargets(b, ui.sel, ui.skill).sort((p, q) => q.maxHp - q.hp - (p.maxHp - p.hp));
const skillAim = () => (B.SKILLS[ui.skill].target === "ally" ? ui.target?.tile : ui.cursor);
const aimOk = () => { const t = skillAim(); return !!t && B.inSkillRange(ui.skill, ui.sel.tile, t) && (B.SKILLS[ui.skill].target !== "ally" || !!ui.target); };
function aimScore(p) { return p.effects.reduce((a, e) => a + (e.kind === "heal" ? e.amount : e.ally ? -2 * e.amount : e.amount + (e.kills ? 50 : 0)), 0); }
const foesInSkillRange = () => B.foesOf(b, ui.sel).filter((f) => B.inSkillRange(ui.skill, ui.sel.tile, f.tile));
function startSkill(id) {
  ui.skill = id; ui.mode = "skill"; ui.target = null;
  if (B.SKILLS[id].target === "ally") { ui.target = healList()[0] ?? null; ui.cursor = [...(ui.target ?? ui.sel).tile]; }
  else {
    let best = null, bs = -Infinity;
    for (const t of B.skillTiles(id, ui.sel.tile)) { const sc = aimScore(B.skillPreview(b, ui.sel, id, t)); if (sc > bs) { bs = sc; best = t; } }
    ui.cursor = [...(best ?? ui.sel.tile)];
  }
  refresh();
}
function cycleAim(d) {
  if (B.SKILLS[ui.skill].target === "ally") { const l = healList(), i = l.indexOf(ui.target); ui.target = l[(i + d + l.length) % l.length]; ui.cursor = [...ui.target.tile]; }
  else { const l = foesInSkillRange(), i = l.findIndex((f) => B.same(f.tile, ui.cursor)); if (l.length) ui.cursor = [...l[(i + d + l.length) % l.length].tile]; }
  refresh();
}
async function castSkill() {
  if (!aimOk()) return;
  const u = ui.sel, id = ui.skill, tile = [...skillAim()];
  ui.busy = true; refresh();
  await castAnim(u, id, tile);
  ui.busy = false;
  if (over()) return;
  startFacing();
}
function startFacing() {
  const u = ui.sel, foe = B.nearestFoe(b, u);
  ui.mode = "face"; ui.target = null; ui.cursor = [...u.tile];
  vis.get(u.id).facing = foe ? facingToward(u.tile, foe.tile) : u.facing;
  refresh();
}
function setFacing(f) { vis.get(ui.sel.id).facing = f; refresh(); }
function done() {
  const u = ui.sel, v = vis.get(u.id);
  B.finish(b, u, v.facing ?? u.facing); v.facing = null;
  deselect();
  if (b.units.every((x) => !x.alive || x.team !== "player" || x.done)) endTurn();
}
function back() {
  if (ui.busy || !ui.sel) return;
  if (ui.mode === "move" || ui.mode === "target" || ui.mode === "skills") toMenu();
  else if (ui.mode === "skill") startSkills();
  else if (ui.mode === "face" && !ui.sel.acted) toMenu();
  else if (ui.mode === "menu") { if (ui.sel.moved) undoMove(); else deselect(); }
}
function click(t) {
  if (ui.busy || b.phase !== "player" || !t) return;
  const u = B.unitAt(b, t), { mode, sel } = ui;
  const foeInRange = u && sel && !sel.acted && u.team !== sel.team && B.inRange(sel, sel.tile, u.tile);
  if (mode === "idle") { ui.cursor = t; if (ready(u)) select(u); else { ui.info = u ?? null; refresh(); } }
  else if (mode === "menu") {
    if (ready(u) && u !== sel && !sel.moved) select(u);
    else if (foeInRange) startTarget(u);
    else if (!sel.moved && ui.reach.has(B.key(t))) { ui.cursor = t; moveTo(ui.reach.get(B.key(t))); }
    else if (!u && !sel.moved) deselect();
  } else if (mode === "move") {
    // first tap puts the cursor on the tile, a second tap on the same tile moves (Enter does the same)
    if (B.same(t, ui.cursor) && moveNode()) moveTo(moveNode());
    else { ui.cursor = t; refresh(); }
  } else if (mode === "target") {
    if (u && u === ui.target) attack();
    else if (foeInRange) startTarget(u);
    else { ui.cursor = t; refresh(); }
  } else if (mode === "skill") {
    if (B.SKILLS[ui.skill].target === "ally") {
      if (u && u === ui.target) castSkill();
      else if (u && u.team === sel.team && B.inSkillRange(ui.skill, sel.tile, u.tile)) { ui.target = u; ui.cursor = [...t]; refresh(); }
    } else if (B.same(t, ui.cursor) && aimOk()) castSkill();
    else { ui.cursor = t; refresh(); }
  } else if (mode === "face") { if (!B.same(t, sel.tile)) setFacing(facingToward(sel.tile, t)); done(); }
}
function hover(t) {
  const changed = !(t && ui.hover && B.same(t, ui.hover)) && (t || ui.hover);
  ui.hover = t;
  if (!changed) return;
  if (ui.mode === "face" && t && !B.same(t, ui.sel.tile)) vis.get(ui.sel.id).facing = facingToward(ui.sel.tile, t);
  refresh();
}

// ---------- the enemy phase ----------
async function endTurn() {
  if (ui.busy || b.phase !== "player") return;
  for (const u of b.units) if (u.alive && u.team === "player" && !u.done) B.finish(b, u, u.facing);
  deselect();
  B.nextPhase(b); ui.busy = true; ui.mode = "enemy"; refresh();
  banner("Enemy phase"); await wait(900);
  for (const e of b.units.filter((x) => x.alive && x.team === "enemy")) {
    if (!e.alive) continue;
    const plan = B.aiPlan(b, e);
    ui.sel = e; ui.info = e; refresh(); await wait(260);
    if (plan.path.length) { await walk(e, plan.path); B.moveAlong(b, e, plan.path); }
    if (plan.action?.type === "attack") { await attackAnim(e, plan.action.target); if (over()) return; }
    if (plan.action?.type === "skill") { await castAnim(e, plan.action.skill, plan.action.tile); if (over()) return; }
    B.finish(b, e, plan.facing); refresh(); await wait(120);
  }
  B.nextPhase(b); Object.assign(ui, { busy: false, mode: "idle", sel: null }); refresh();
  banner(`Round ${b.round} · Player phase`);
}
function over() {
  const w = B.winner(b);
  if (!w) return false;
  ui.busy = true; ui.mode = "over"; refresh();
  $("overText").textContent = w === "player" ? "Victory" : "Defeat";
  setTimeout(() => $("over").classList.add("show"), 500);
  return true;
}

// ---------- panels ----------
function banner(text) { const el = $("banner"); $("bannerText").textContent = text; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show"); }
function chip(label, fn, opts = {}) {
  const el = document.createElement("button"); el.type = "button"; el.className = "chip" + (opts.main ? " main" : ""); el.textContent = label;
  if (opts.pressed !== undefined) el.setAttribute("aria-pressed", String(opts.pressed));
  el.disabled = !!opts.disabled; el.addEventListener("click", fn); return el;
}
const rangeText = (u) => (u.range[0] === u.range[1] ? `${u.range[0]}` : `${u.range[0]}–${u.range[1]}`) + (u.line ? " (straight line)" : "");
function unitCard(u) {
  const box = $("unit");
  if (!u) { $("unitLabel").textContent = "UNIT"; box.replaceChildren(Object.assign(document.createElement("div"), { className: "help", textContent: "Point at a unit to see it." })); return; }
  $("unitLabel").textContent = u.team === "player" ? "YOUR UNIT" : "ENEMY UNIT";
  const c = document.createElement("canvas"); c.width = 96; c.height = 120;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.drawImage(spriteOf(u, "SE", 0, null).c, 0, 10, 48, 66, 0, -12, 96, 132);
  const info = document.createElement("div"); info.style.flex = "1";
  const v = vis.get(u.id), status = !u.alive ? "DOWN" : u.done ? "DONE THIS TURN" : u.team === b.phase ? "READY" : "WAITING";
  info.innerHTML = `<div class="uname"></div><div class="team ${u.team}"></div>
    <div class="hp ${u.team}" role="img" aria-label="Health ${v.hp} of ${u.maxHp}"><i style="width:${(100 * v.hp) / u.maxHp}%"></i></div>
    <div class="stats"><span>HEALTH</span><b>${v.hp} / ${u.maxHp}</b>${u.maxMp ? `<span>MP</span><b>${u.mp} / ${u.maxMp}</b>` : ""}<span>ATTACK</span><b>${u.atk}</b><span>MOVE</span><b>${u.move}</b><span>RANGE</span><b>${rangeText(u)}</b>${u.skills.length ? `<span>SKILLS</span><b>${u.skills.map((id) => `${B.SKILLS[id].name} (${B.SKILLS[id].mp} MP)`).join(", ")}</b>` : ""}<span>FACING</span><b>${v.facing ?? u.facing}</b><span>STATUS</span><b>${status}</b></div>`;
  info.querySelector(".uname").textContent = u.name;
  info.querySelector(".team").textContent = `${u.className.toUpperCase()} · ${u.gear.toUpperCase()} · ${u.team === "player" ? "YOUR TEAM" : "ENEMY"}`;
  box.replaceChildren(c, info);
}
function previewCard() {
  const { sel } = ui;
  let t = ui.mode === "target" ? ui.target : null;
  if (!t && sel && ui.mode === "menu" && !sel.acted && ui.hover) { const h = B.unitAt(b, ui.hover); if (h && h.team !== sel.team && B.inRange(sel, sel.tile, h.tile)) t = h; }
  if (ui.mode === "skill" && !ui.busy) { skillCard(); return; }
  if (ui.busy) t = null;
  $("previewCard").hidden = !t;
  if (!t) return;
  const p = B.preview(b, sel, t);
  $("preview").innerHTML = `<div class="big">${p.dmg} damage</div>
    <div>${sel.name} → <b class="tn"></b>, from the <b class="side-${p.side}">${p.side.toUpperCase()}</b> (×${p.mult})</div>
    <div>Health ${p.hp} → ${p.after}${p.kills ? " · <b class='side-back'>DEFEATS THE UNIT</b>" : ""}</div>`;
  $("preview").querySelector(".tn").textContent = t.name;
}
function skillCard() {
  const sk = B.SKILLS[ui.skill], el = $("preview");
  $("previewCard").hidden = false;
  const head = `<div class="big">${sk.name}</div><div>${sk.mp} MP · ${ui.sel.name}: MP ${ui.sel.mp} → ${ui.sel.mp - sk.mp}</div>`;
  if (!aimOk()) { el.innerHTML = head + "<div>The aim is out of range.</div>"; return; }
  const p = B.skillPreview(b, ui.sel, ui.skill, skillAim());
  el.innerHTML = head + (p.effects.length ? "" : "<div>No unit is in the area.</div>");
  for (const e of p.effects) {
    const d = document.createElement("div");
    d.innerHTML = e.kind === "heal" ? `<b class="nm"></b>: <b style="color:#a4e08a">+${e.amount} HP</b> · ${e.hp} → ${e.after}`
      : `<b class="nm"></b>${e.ally ? " <b class='side-back'>(YOUR UNIT)</b>" : ""}: ${e.amount} damage, <b class="side-${e.side}">${e.side.toUpperCase()}</b> · ${e.hp} → ${e.after}${e.kills ? " · <b class='side-back'>DOWN</b>" : ""}`;
    d.querySelector(".nm").textContent = e.unit.name; el.append(d);
  }
}
const HELP = {
  idle: "Select one of your units (blue ring), or use Next unit. Units in grey are done for this turn.",
  menu: "Select a command. You can also tap a blue tile to move there, or a red enemy to attack it.",
  move: "Put the cursor on a blue tile with the arrows or a tap, then Move here. Tap the same tile again to move.",
  skills: "Select a skill. A skill uses MP and takes the unit's action for this turn, like an attack.",
  skill: "",
  target: "Select the target with Previous and Next, or tap an enemy. The preview shows the damage. Then Attack.",
  face: "Select where the unit faces, then Done. The blue, gold and red tiles show its front, side and back.",
  enemy: "The enemy moves.",
};
const GLYPH = { NW: "↖", NE: "↗", SW: "↙", SE: "↘" };
// a diamond of four diagonal buttons (the screen directions of the four facings) around a centre button
function pad(label, onDir, center, centerOn, pressed = null) {
  const el = document.createElement("div"); el.className = "pad"; el.setAttribute("role", "group"); el.setAttribute("aria-label", label);
  for (const f of ["NW", "NE", "SW", "SE"]) { const c = chip(`${GLYPH[f]} ${f}`, () => onDir(f), pressed ? { pressed: pressed === f } : {}); c.classList.add("d-" + f); el.append(c); }
  const c = chip(center, centerOn, { main: true, disabled: !centerOn }); c.classList.add("d-c"); el.append(c);
  return el;
}
function refresh() {
  const { mode, sel } = ui;
  $("turn").innerHTML = `Round ${b.round} · <span class="ph ${b.phase}">${b.phase === "player" ? "Player phase" : "Enemy phase"}</span>`;
  let help = HELP[mode] ?? "";
  if (mode === "menu" && sel?.moved && !B.targets(b, sel).length) help = "No enemy is in range from here. Wait to select a facing, or undo the move.";
  if (mode === "skill") help = B.SKILLS[ui.skill].target === "ally"
    ? "Select the ally to heal with Previous and Next, or tap one in the green area. Then Cast."
    : "Aim with the pad, Previous and Next, or a tap in the red area. The orange tiles show the area: it hits your own units too. Then Cast.";
  if (mode === "move" && !moveNode()) help = "The cursor is not on a blue tile. Move it with the arrows, or tap a blue tile.";
  $("help").textContent = ui.busy && mode !== "enemy" ? "" : help;
  const a = [], player = !ui.busy && b.phase === "player";
  if (player && !sel && mode === "idle") a.push(chip("Next unit", nextUnit, { main: true, disabled: !b.units.some(ready) }));
  if (player && sel) {
    const row = document.createElement("div"); row.className = "row";
    if (mode === "menu") {
      const n = sel.acted ? 0 : B.targets(b, sel).length;
      row.append(chip("Move", startMove, { disabled: sel.moved }), chip(n ? `Attack · ${n} in range` : "Attack", () => startTarget(), { disabled: !n }),
        ...(sel.skills.length ? [chip(`Skills · ${sel.mp} MP`, startSkills, { disabled: sel.acted || !sel.skills.some((id) => B.canCast(sel, id)) })] : []),
        chip("Wait", startFacing), sel.moved ? chip("Undo move", undoMove) : chip("Cancel", deselect));
      if (!sel.moved && b.units.filter(ready).length > 1) row.append(chip("Next unit", nextUnit));
    }
    if (mode === "move") {
      row.append(chip("Back", toMenu));
      a.push(row, pad("Move the cursor", (f) => moveCursor(FACING_DIR[f]), "Move here", moveNode() ? () => moveTo(moveNode()) : null));
    }
    if (mode === "skills") {
      row.append(...sel.skills.map((id) => chip(`${B.SKILLS[id].name} · ${B.SKILLS[id].mp} MP`, () => startSkill(id), { disabled: !B.canCast(sel, id) })), chip("Back", toMenu));
    }
    if (mode === "skill") {
      const sk = B.SKILLS[ui.skill], many = (sk.target === "ally" ? healList() : foesInSkillRange()).length > 1;
      const word = sk.target === "ally" ? "" : " foe";
      row.append(chip(`◀ Previous${word}`, () => cycleAim(-1), { disabled: !many }), chip(`Next${word} ▶`, () => cycleAim(1), { disabled: !many }));
      if (sk.target === "ally") row.append(chip(`Cast ${sk.name}`, castSkill, { main: true, disabled: !aimOk() }));
      row.append(chip("Back", back));
      if (sk.target !== "ally") a.push(row, pad("Aim the skill", (f) => moveCursor(FACING_DIR[f]), `Cast ${sk.name}`, aimOk() ? castSkill : null));
    }
    if (mode === "target") {
      const many = targetList().length > 1;
      row.append(chip("◀ Previous", () => cycleTarget(-1), { disabled: !many }), chip("Next ▶", () => cycleTarget(1), { disabled: !many }), chip("Attack", attack, { main: true }), chip("Back", toMenu));
    }
    if (mode === "face") {
      if (!sel.acted) row.append(chip("Back", toMenu));
      a.push(pad("Select the facing", setFacing, "Done", done, vis.get(sel.id).facing ?? sel.facing));
    }
    if (row.childNodes.length) a.unshift(row);
  }
  $("actions").replaceChildren(...a);
  $("endTurn").disabled = ui.busy || b.phase !== "player";
  $("restart").disabled = ui.busy && ui.mode !== "over";
  $("loadout").disabled = ui.busy && ui.mode !== "over";
  const h = ui.hover && B.unitAt(b, ui.hover);
  unitCard(h || ui.info || sel || null);
  $("schemes").replaceChildren(...[...Object.entries(TEAM_SCHEMES).map(([k, v]) => [k, v.name]), ["", "Own gear colours"]].map(([k, name]) =>
    chip(name, () => { scheme = k; try { localStorage.setItem("pixelrpg.enemyScheme", k); } catch (e) { /* storage blocked */ } refresh(); }, { pressed: scheme === k })));
  previewCard();
  log();
}
function log() {
  $("log").replaceChildren(...b.log.slice(-40).reverse().map((e) => Object.assign(document.createElement("li"), { textContent: `R${e.round} · ${e.text}` })));
}

// ---------- input ----------
function pick(ev) {
  const r = cv.getBoundingClientRect(), x = ((ev.clientX - r.left) / r.width) * W, y = ((ev.clientY - r.top) / r.height) * H;
  // units first, front-most first, by their own opaque pixels (a tile behind a unit stays selectable around it)
  const units = b.units.filter((u) => u.alive).sort((p, q) => q.tile[0] + q.tile[1] - (p.tile[0] + p.tile[1]));
  for (const u of units) {
    const v = vis.get(u.id), [fx, fy] = unitPos(u), sp = spriteOf(u, v.facing ?? u.facing, 0, v.pose);
    const lx = Math.floor(x - (Math.round(fx) - sp.fx)), ly = Math.floor(y - (Math.round(fy) - FY + 1));
    if (lx >= 0 && ly >= 0 && lx < sp.w && ly < sp.h && sp.d[(ly * sp.w + lx) * 4 + 3] === 255) return u.tile;
  }
  // then tiles, front-most first, by their own pixels
  for (let s = 2 * (N - 1); s >= 0; s--) for (let i = N - 1; i >= 0; i--) {
    const j = s - i; if (j < 0 || j >= N) continue;
    const [tx, ty] = tileTop(i, j);
    if (tileOf(i, j).img.get(Math.floor(x - tx), Math.floor(y - ty))) return [i, j];
  }
  return null;
}
cv.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") hover(pick(e)); });
cv.addEventListener("pointerleave", () => hover(null));
cv.addEventListener("click", (e) => { const t = pick(e); if (t) { if (ui.mode === "face" && !B.same(t, ui.sel.tile)) setFacing(facingToward(ui.sel.tile, t)); click(t); } });
cv.addEventListener("keydown", (e) => {
  const step = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] }[e.key];
  if (step) {
    e.preventDefault();
    const n = [ui.cursor[0] + step[0], ui.cursor[1] + step[1]];
    if (B.inside(n)) { ui.cursor = n; ui.hover = null; hover(n); }
  } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(ui.cursor); }
  else if (e.key === "Escape") { e.preventDefault(); back(); }
});
$("endTurn").addEventListener("click", endTurn);
$("restart").addEventListener("click", () => { if (!ui.busy || ui.mode === "over") reset(); });
$("again").addEventListener("click", reset);
$("arcs").addEventListener("change", refresh);
window.addEventListener("resize", fit);

// ---------- the party screen before each battle ----------
// The party is saved in this browser (a convenience only; the demo party comes back if storage is blocked).
const PARTY_KEY = "pixelrpg.party";
let party = P.parseParty((() => { try { return localStorage.getItem(PARTY_KEY); } catch (e) { return null; } })());
const saveParty = (p) => { party = p; try { localStorage.setItem(PARTY_KEY, P.serializeParty(p)); } catch (e) { /* storage blocked */ } };
const muster = createMuster({
  party,
  onChange: saveParty,
  onStart(p) { saveParty(p); muster.hide(); $("battleView").hidden = false; fit(); reset(); window.scrollTo(0, 0); },
});
function showMuster() {
  if (ui?.busy && ui.mode !== "over") return;
  $("over").classList.remove("show"); $("battleView").hidden = true;
  muster.show(party); window.scrollTo(0, 0);
}
$("loadout").addEventListener("click", showMuster);
$("overGear").addEventListener("click", showMuster);

window.__battle = () => ({ b, ui, party }); // for tests and the console
muster.show(party);
requestAnimationFrame(frame);
