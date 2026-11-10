// Battle rules for the demo: one map, two teams built on the same classes, health and attack only.
// Facing is part of the rules: an attack from the side or the back of a unit does more damage.
// Pure logic with no DOM. The web page (docs/battle.js) and the Node test (tools/battle-test.mjs) share it.
import { CLASSES, FACING_DIR, facingToward, attackSide } from "./pixelrpg.js";

// ---------- the demo map: the same ground as sprites/art/battle-map.png ----------
export const N = 11;
const hill = (i, j) => {
  if (j >= 5 && j <= 6 && i > 1) return 0; // river bed
  if (i <= 2 && j <= 3) return 4;
  if (i <= 3 && j <= 4) return 3;
  if (i >= 8 && j >= 8) return 2;
  if (i >= 7 && j <= 2) return 2;
  return 1;
};
export function terrain(i, j) {
  if (j >= 5 && j <= 6 && i > 1) return i === 5 ? "wood" : "water";
  if (i <= 3 && j <= 4) return hill(i, j) === 4 ? "cobble" : "moss";
  if ((j === 4 && i > 3) || (i === 5 && j > 6)) return "dirt";
  if (i >= 8 && j >= 8) return "snow";
  if (i >= 7 && j <= 2) return "sand";
  return "grass";
}
// height in steps of 12 px; the bridge planks sit one step up
export const height = (i, j) => (terrain(i, j) === "wood" ? 1 : hill(i, j));
export const PROPS = { "1,10": "oak", "9,6": "oak", "10,1": "pine", "1,4": "banner", "8,9": "pine", "10,9": "pine", "6,10": "rock", "4,10": "bush", "3,3": "crystal", "9,0": "crate", "0,0": "chest", "6,2": "bush" };

// ---------- units ----------
// One stat table per class. Both teams use it: the enemies are built on the same classes as the player's units.
// range is [min, max] in grid steps; line means the target must be on the same row or column (spear reach).
export const STATS = {
  knight: { hp: 42, atk: 10, move: 3, range: [1, 1] },
  lancer: { hp: 36, atk: 11, move: 4, range: [1, 2], line: true },
  thief:  { hp: 28, atk: 9, move: 5, range: [1, 1] },
  archer: { hp: 26, atk: 9, move: 4, range: [2, 4] },
  mage:   { hp: 22, atk: 12, move: 3, range: [2, 3] },
  cleric: { hp: 30, atk: 7, move: 3, range: [1, 1] },
};
export const JUMP = 2;                                   // the largest height change for one step
export const SIDE_MULT = { front: 1, side: 1.25, back: 1.5 };
export const RANGED = (u) => u.range[1] > 1 && !u.line; // archers and mages shoot; the lancer's reach is melee

// [id, team, class, name, tile]. Player units wear their class's top tier and the default body.
// Enemy units wear the middle tier and the other body, so the two sides read apart.
export const ROSTER = [
  ["p-knight", "player", "knight", "Aldric", [4, 7]],
  ["p-lancer", "player", "lancer", "Bran", [2, 7]],
  ["p-thief", "player", "thief", "Corin", [6, 7]],
  ["p-archer", "player", "archer", "Dera", [1, 8]],
  ["p-mage", "player", "mage", "Elin", [3, 9]],
  ["p-cleric", "player", "cleric", "Fara", [5, 8]],
  ["e-knight", "enemy", "knight", "Vexa", [5, 3]],
  ["e-lancer", "enemy", "lancer", "Ilsa", [7, 3]],
  ["e-thief", "enemy", "thief", "Nyx", [8, 2]],
  ["e-archer", "enemy", "archer", "Hal", [1, 2]],
  ["e-mage", "enemy", "mage", "Oren", [2, 1]],
  ["e-cleric", "enemy", "cleric", "Tobin", [5, 1]],
];
export const START_FACING = { player: "NE", enemy: "SW" };

export function newBattle(roster = ROSTER) {
  const units = roster.map(([id, team, cls, name, tile]) => {
    const k = CLASSES[cls], s = STATS[cls], player = team === "player";
    return {
      id, team, cls, name, className: k.name,
      lo: { ...(player ? k.loadout : k.tiers[1][2]) }, body: player ? k.body : k.alt, gear: player ? k.tiers[2][0] : k.tiers[1][0],
      tile: [...tile], facing: START_FACING[team],
      hp: s.hp, maxHp: s.hp, atk: s.atk, move: s.move, range: s.range, line: !!s.line,
      alive: true, moved: false, acted: false, done: false,
    };
  });
  return { round: 1, phase: "player", units, log: [] };
}

// ---------- grid helpers ----------
export const key = (t) => `${t[0]},${t[1]}`;
export const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
export const inside = ([i, j]) => i >= 0 && j >= 0 && i < N && j < N;
export const walkable = (t) => inside(t) && terrain(...t) !== "water" && !PROPS[key(t)];
export const unitAt = (b, t) => b.units.find((u) => u.alive && same(u.tile, t));
const STEPS = Object.entries(FACING_DIR); // [facing, [dcol, drow]]
export const stepFacing = (from, to) => STEPS.find(([, [dc, dr]]) => to[0] - from[0] === dc && to[1] - from[1] === dr)?.[0];
const canStep = (from, to) => walkable(to) && Math.abs(height(...to) - height(...from)) <= JUMP;

// Tiles the unit can move to this turn: a Map from tile key to { tile, path }.
// Units pass through allies but not through enemies, and they cannot stop on an occupied tile.
export function reach(b, u) {
  const out = new Map(), seen = new Map([[key(u.tile), { tile: u.tile, path: [] }]]), queue = [u.tile];
  while (queue.length) {
    const t = queue.shift(), node = seen.get(key(t));
    if (node.path.length >= u.move) continue;
    for (const [, [dc, dr]] of STEPS) {
      const n = [t[0] + dc, t[1] + dr], k = key(n);
      if (seen.has(k) || !canStep(t, n)) continue;
      const o = unitAt(b, n);
      if (o && o.team !== u.team) continue;
      const next = { tile: n, path: [...node.path, n] };
      seen.set(k, next); queue.push(n);
      if (!o) out.set(k, next);
    }
  }
  return out;
}

// steps to the nearest tile next to a foe, around water and props (units do not block): the AI's sense of distance
function foeField(b, team) {
  const field = new Map(), queue = [];
  for (const f of b.units) if (f.alive && f.team !== team) { field.set(key(f.tile), 0); queue.push(f.tile); }
  while (queue.length) {
    const t = queue.shift(), d = field.get(key(t));
    for (const [, [dc, dr]] of STEPS) {
      const n = [t[0] + dc, t[1] + dr], k = key(n);
      if (!field.has(k) && canStep(n, t) && walkable(n)) { field.set(k, d + 1); queue.push(n); }
    }
  }
  return field;
}

export function inRange(u, from, to) {
  const d = dist(from, to);
  if (d < u.range[0] || d > u.range[1]) return false;
  return !u.line || from[0] === to[0] || from[1] === to[1];
}
export function rangeTiles(u, from = u.tile) {
  const out = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (inRange(u, from, [i, j])) out.push([i, j]);
  return out;
}
export const foesOf = (b, u) => b.units.filter((f) => f.alive && f.team !== u.team);
export const targets = (b, u, from = u.tile) => foesOf(b, u).filter((f) => inRange(u, from, f.tile));

// what an attack would do: the side it lands on (from the defender's facing), the multiplier and the damage
export function preview(b, u, t, from = u.tile) {
  const side = attackSide(t.tile, t.facing, from), mult = SIDE_MULT[side], dmg = Math.round(u.atk * mult);
  return { side, mult, dmg, hp: t.hp, after: Math.max(0, t.hp - dmg), kills: dmg >= t.hp };
}

// ---------- actions ----------
const say = (b, text) => { b.log.push({ round: b.round, phase: b.phase, text }); return text; };
export function moveAlong(b, u, path) {
  if (path.length) {
    const prev = path.length > 1 ? path[path.length - 2] : u.tile, last = path[path.length - 1];
    u.facing = stepFacing(prev, last) ?? u.facing;
    u.tile = [...last];
  }
  u.moved = true;
}
export function strike(b, u, t) {
  u.facing = facingToward(u.tile, t.tile);
  const p = preview(b, u, t);
  t.hp = p.after;
  u.moved = u.acted = true;
  say(b, `${u.name} hits ${t.name} from the ${p.side}${p.mult > 1 ? ` (×${p.mult})` : ""}: ${p.dmg} damage.`);
  if (t.hp <= 0) { t.alive = false; say(b, `${t.name} is down.`); }
  return p;
}
export function finish(b, u, facing = u.facing) {
  u.facing = facing;
  u.moved = u.acted = u.done = true;
}
export function nextPhase(b) {
  b.phase = b.phase === "player" ? "enemy" : "player";
  if (b.phase === "player") b.round++;
  for (const u of b.units) u.moved = u.acted = u.done = false;
}
export function winner(b) {
  const alive = (team) => b.units.some((u) => u.alive && u.team === team);
  return !alive("enemy") ? "player" : !alive("player") ? "enemy" : null;
}
export const nearestFoe = (b, u, from = u.tile) => foesOf(b, u).sort((x, y) => dist(from, x.tile) - dist(from, y.tile))[0];

// ---------- the enemy AI ----------
// Try every tile the unit can reach. Take the attack that does the most damage (a kill counts most);
// that makes it look for side and back attacks by itself. With no target in reach, walk toward the nearest foe.
// At the end, face the nearest foe, so that its own back is not open.
export function aiPlan(b, u) {
  const options = [{ tile: u.tile, path: [] }, ...reach(b, u).values()];
  let best = null;
  for (const o of options) for (const t of targets(b, u, o.tile)) {
    const p = preview(b, u, t, o.tile);
    const score = p.dmg + (p.kills ? 100 : 0) + (RANGED(u) ? dist(o.tile, t.tile) * 0.3 : 0) - o.path.length * 0.05;
    if (!best || score > best.score) best = { score, ...o, target: t };
  }
  if (best) return { path: best.path, target: best.target, facing: facingToward(best.tile, best.target.tile) };
  const field = foeField(b, u.team);
  let go = options[0], gd = Infinity;
  for (const o of options) { const d = field.get(key(o.tile)) ?? 99; if (d < gd || (d === gd && o.path.length < go.path.length)) { go = o; gd = d; } }
  const foe = nearestFoe(b, u, go.tile);
  return { path: go.path, target: null, facing: foe ? facingToward(go.tile, foe.tile) : u.facing };
}
