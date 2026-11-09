// Battle demo: draws the demo map and both teams live with the sprite core, and runs the rules in lib/battle.js.
import { TW, TH, STEP, HW, HH, FX, FY, Img, tile, cursor, prop, drawUnit, setCell, stanceOf, FACINGS, facingToward, attackSide } from "./lib/pixelrpg.js";
import * as B from "./lib/battle.js";

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
function spriteOf(u, facing, bob, pose) {
  const atk = pose !== null, k = [u.id, facing, atk ? "a" + pose : "i" + bob].join("|");
  if (!sprites.has(k)) {
    if (atk) setCell(96, 24);
    let img;
    try { img = drawUnit(u.lo, facing, atk ? 0 : bob, u.body, stanceOf(u.lo), atk ? pose : 0); } finally { if (atk) setCell(48, 0); }
    const dim = (d) => { for (let i = 0; i < d.length; i += 4) { d[i] *= 0.55; d[i + 1] *= 0.55; d[i + 2] *= 0.62; } };
    const white = (d) => { for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255) d[i] = d[i + 1] = d[i + 2] = 255; };
    const d = img.rgba(); let top = 0;
    while (top < img.h && !d.subarray(top * img.w * 4, (top + 1) * img.w * 4).some((v, i) => i % 4 === 3 && v === 255)) top++;
    sprites.set(k, { c: toCanvas(img), dim: toCanvas(img, dim), white: toCanvas(img, white), fx: atk ? 48 : FX, top, d, w: img.w, h: img.h });
  }
  return sprites.get(k);
}

// ---------- the game clock (it stops during hit-stop) ----------
let clock = 0, last = performance.now(), stopUntil = 0;
const waiters = [];
const wait = (ms) => new Promise((r) => waiters.push({ at: clock + ms, r }));
const hitStop = (ms) => { stopUntil = performance.now() + ms; };

// ---------- state ----------
let b, vis, ui, floats, shots;
function reset() {
  b = B.newBattle();
  vis = new Map(b.units.map((u) => [u.id, { pos: null, depth: null, facing: null, pose: null, flash: 0, shake: 0, gone: false, blink: false, hp: u.hp }]));
  ui = { mode: "idle", sel: null, target: null, from: null, reach: null, hover: null, cursor: [4, 7], busy: false, info: null };
  floats = []; shots = [];
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
  if (mode === "move") {
    for (const k of ui.reach.keys()) m.set(k, "move");
    for (const t of B.targets(b, sel)) m.set(B.key(t.tile), "attack");
  } else if (mode === "act" || mode === "confirm") {
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
    if ((cur && B.same(cur, [i, j])) || (ui.sel && B.same(ui.sel.tile, [i, j]) && ui.mode !== "enemy")) ctx.drawImage(cursorC, tx, ty);
    if (B.PROPS[k]) ctx.drawImage(propOf(B.PROPS[k]), tx + HW - 20, ty + HH - 48);
    for (const u of byDepth.get(k) ?? []) {
      const v = vis.get(u.id), [fx, fy] = unitPos(u), facing = v.facing ?? u.facing;
      const shake = v.shake > clock ? (Math.floor(clock / 40) % 2 ? 2 : -2) : 0;
      ctx.drawImage(ringOf(u.team, facing), Math.round(fx) - 20, Math.round(fy) - 10);
      if (v.blink && Math.floor(clock / 80) % 2) continue;
      const bob = v.walking ? Math.floor(clock / STEP_MS) % 2 : (beat + b.units.indexOf(u)) % 2;
      const sp = spriteOf(u, facing, bob, v.pose), pic = v.flash > clock ? sp.white : u.done && u.alive ? sp.dim : sp.c;
      ctx.drawImage(pic, Math.round(fx) - sp.fx + shake, Math.round(fy) - FY + 1);
    }
  }
  // health bars, over everything
  for (const u of b.units) {
    const v = vis.get(u.id); if (v.gone || (v.blink && Math.floor(clock / 80) % 2)) continue;
    const [fx, fy] = unitPos(u), top = spriteOf(u, "SE", 0, null).top, x = Math.round(fx) - 11, y = Math.round(fy) - FY + 1 + top - 6;
    ctx.fillStyle = "#120c18"; ctx.fillRect(x, y, 22, 4);
    ctx.fillStyle = "#3d2f42"; ctx.fillRect(x + 1, y + 1, 20, 2);
    ctx.fillStyle = TEAM[u.team].bar; ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((20 * v.hp) / u.maxHp)), 2);
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
  if (now >= stopUntil) clock += dt;
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].at <= clock) { waiters[i].r(); waiters.splice(i, 1); }
  draw();
  requestAnimationFrame(frame);
}

// ---------- animation ----------
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
function fly(u, t, kind) {
  const a = unitPos(u), z = unitPos(t), dx = Math.sign(z[0] - a[0]);
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
    vt.hp = t.hp; vt.flash = clock + 90; vt.shake = clock + 220;
    const [x, y] = unitPos(t), top = spriteOf(t, "SE", 0, null).top, hy = y - FY + 1 + top - 10;
    floats.push({ text: String(r.dmg), x, y: hy, color: "#fbf2dc", size: 12, t0: clock, dur: 1000 });
    if (r.side !== "front") floats.push({ text: r.side.toUpperCase() + "!", x, y: hy - 11, color: SIDE_COLOR[r.side], size: 8, t0: clock, dur: 1000 });
    hitStop(r.side === "back" ? 160 : 100);
    log();
  };
  for (const [i, ms] of ATTACK_MS.slice(0, 2).entries()) { v.pose = i; await wait(ms); }
  v.pose = 2;
  if (B.RANGED(u)) {
    const flight = fly(u, t, u.cls === "archer" ? "arrow" : "spell");
    await wait(ATTACK_MS[2]); v.pose = 3;
    await flight; impact(); await wait(320);
  } else {
    await wait(70); impact(); await wait(ATTACK_MS[2] - 70); v.pose = 3; await wait(ATTACK_MS[3]);
  }
  v.pose = null; v.facing = null;
  if (!t.alive) { vt.blink = true; await wait(640); vt.gone = true; vt.blink = false; }
}

// ---------- the player's turn ----------
function select(u) {
  Object.assign(ui, { mode: "move", sel: u, target: null, from: { tile: [...u.tile], facing: u.facing }, reach: B.reach(b, u) });
  ui.info = u; refresh();
}
function deselect() { Object.assign(ui, { mode: "idle", sel: null, target: null, reach: null }); refresh(); }
async function moveTo(node) {
  ui.busy = true; refresh();
  await walk(ui.sel, node.path);
  B.moveAlong(b, ui.sel, node.path);
  ui.busy = false; ui.mode = "act"; refresh();
}
function undoMove() {
  const u = ui.sel; u.tile = [...ui.from.tile]; u.facing = ui.from.facing; u.moved = false;
  select(u);
}
function aim(t) { ui.target = t; ui.back = ui.mode; ui.mode = "confirm"; refresh(); }
async function attack() {
  const u = ui.sel, t = ui.target;
  ui.busy = true; refresh();
  await attackAnim(u, t);
  ui.busy = false;
  if (over()) return;
  startFacing();
}
function startFacing() {
  const u = ui.sel, foe = B.nearestFoe(b, u);
  ui.mode = "face"; ui.target = null;
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
  if (ui.busy) return;
  if (ui.mode === "confirm") { ui.mode = ui.back; ui.target = null; refresh(); }
  else if (ui.mode === "act") undoMove();
  else if (ui.mode === "move") deselect();
}
function click(t) {
  if (ui.busy || b.phase !== "player" || !t) return;
  ui.cursor = t;
  const u = B.unitAt(b, t), { mode, sel } = ui;
  const foeInRange = u && sel && u.team !== sel.team && B.inRange(sel, sel.tile, u.tile);
  if (mode === "idle") { if (u && u.team === "player" && !u.done) select(u); else { ui.info = u ?? null; refresh(); } }
  else if (mode === "move") {
    if (u && u.team === "player" && u !== sel && !u.done) select(u);
    else if (u === sel) { ui.mode = "act"; sel.moved = true; refresh(); }
    else if (foeInRange) aim(u);
    else if (ui.reach.has(B.key(t))) moveTo(ui.reach.get(B.key(t)));
    else deselect();
  } else if (mode === "act") { if (foeInRange) aim(u); }
  else if (mode === "confirm") { if (u === ui.target) attack(); else if (foeInRange) aim(u); else back(); }
  else if (mode === "face") { if (B.same(t, sel.tile)) done(); else { setFacing(facingToward(sel.tile, t)); done(); } }
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
    if (plan.target) { await attackAnim(e, plan.target); if (over()) return; }
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
    <div class="stats"><span>HEALTH</span><b>${v.hp} / ${u.maxHp}</b><span>ATTACK</span><b>${u.atk}</b><span>MOVE</span><b>${u.move}</b><span>RANGE</span><b>${rangeText(u)}</b><span>FACING</span><b>${v.facing ?? u.facing}</b><span>STATUS</span><b>${status}</b></div>`;
  info.querySelector(".uname").textContent = u.name;
  info.querySelector(".team").textContent = `${u.className.toUpperCase()} · ${u.gear.toUpperCase()} · ${u.team === "player" ? "YOUR TEAM" : "ENEMY"}`;
  box.replaceChildren(c, info);
}
function previewCard() {
  const { sel } = ui;
  let t = ui.mode === "confirm" ? ui.target : null;
  if (!t && sel && (ui.mode === "move" || ui.mode === "act") && ui.hover) { const h = B.unitAt(b, ui.hover); if (h && h.team !== sel.team && B.inRange(sel, sel.tile, h.tile)) t = h; }
  if (ui.busy) t = null;
  $("previewCard").hidden = !t;
  if (!t) return;
  const p = B.preview(b, sel, t);
  $("preview").innerHTML = `<div class="big">${p.dmg} damage</div>
    <div>${sel.name} → <b class="tn"></b>, from the <b class="side-${p.side}">${p.side.toUpperCase()}</b> (×${p.mult})</div>
    <div>Health ${p.hp} → ${p.after}${p.kills ? " · <b class='side-back'>DEFEATS THE UNIT</b>" : ""}</div>`;
  $("preview").querySelector(".tn").textContent = t.name;
}
const HELP = {
  idle: "Select one of your units (blue ring). Units in grey are done for this turn.",
  move: "Select a blue tile to move there, or a red enemy to attack from here. Select the unit again to stay in place.",
  act: "Select an enemy in the red area to attack it, or Wait to pick a facing.",
  confirm: "Select the target again, or Attack, to hit. The preview shows the damage.",
  face: "Point where the unit must face, then select. The blue, gold and red tiles show its front, side and back.",
  enemy: "The enemy moves.",
};
function refresh() {
  const { mode, sel } = ui;
  $("turn").innerHTML = `Round ${b.round} · <span class="ph ${b.phase}">${b.phase === "player" ? "Player phase" : "Enemy phase"}</span>`;
  let help = HELP[mode] ?? "";
  if (mode === "act" && sel && !B.targets(b, sel).length) help = "No enemy is in range from here. Wait to pick a facing, or undo the move.";
  $("help").textContent = ui.busy && mode !== "enemy" ? "" : help;
  const a = [];
  if (!ui.busy && sel && b.phase === "player") {
    if (mode === "move") a.push(chip("Stay here", () => { ui.mode = "act"; sel.moved = true; refresh(); }), chip("Wait", () => { sel.moved = true; startFacing(); }), chip("Cancel", deselect));
    if (mode === "act") a.push(chip("Wait", startFacing, { main: !B.targets(b, sel).length }), chip("Undo move", undoMove));
    if (mode === "confirm") a.push(chip("Attack", attack, { main: true }), chip("Cancel", back));
    if (mode === "face") {
      const f = vis.get(sel.id).facing ?? sel.facing;
      a.push(...FACINGS.map((x) => chip(`Face ${x}`, () => setFacing(x), { pressed: f === x })), chip("Done", done, { main: true }));
    }
  }
  $("actions").replaceChildren(...a);
  $("endTurn").disabled = ui.busy || b.phase !== "player";
  $("restart").disabled = ui.busy && ui.mode !== "over";
  const h = ui.hover && B.unitAt(b, ui.hover);
  unitCard(h || ui.info || sel || null);
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

window.__battle = () => ({ b, ui }); // for tests and the console
fit();
reset();
requestAnimationFrame(frame);
