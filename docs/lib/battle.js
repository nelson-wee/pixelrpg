// Battle rules for the demo: one map, two teams of characters, health, attack and skills.
// Facing is part of the rules: an attack from the side or the back of a unit does more damage.
// A battle places characters (docs/lib/character.js) on the map as units. A unit copies the character's stats
// and skills at the start, then keeps its own tile, facing, health and MP; the character does not change.
// Pure logic with no DOM. The web page (docs/battle.js) and the Node test (tools/battle-test.mjs) share it.
import { FACING_DIR, facingToward, attackSide } from "./pixelrpg.js";
import { makeCharacter } from "./character.js";
import { presetLook } from "./presets.js";

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
// Skills: a second kind of action. A skill uses MP and takes the unit's action for the turn, like an attack.
// A skill is data: who it can aim at, and a list of operations it does to each unit it touches.
//   target "ally": one allied unit in range (range 0 is the caster). "self": the caster only. "tile": any tile in range.
//   area "plus": the target tile and its four grid neighbours (no diagonals). friendly: the area also hits allies.
//   needs "shield": the caster must have a shield's block chance.
//   ops: { op: "heal", amount } | { op: "damage", power, magic, element } | { op: "status", id, turns, absorb }
export const SKILLS = {
  heal: { name: "Heal", mp: 6, range: [0, 3], target: "ally", ops: [{ op: "heal", amount: 14 }] },
  fireball: { name: "Fireball", mp: 8, range: [2, 4], target: "tile", area: "plus", friendly: true, ops: [{ op: "damage", power: 10, magic: true, element: "fire" }] },
  arcaneWard: { name: "Arcane Ward", mp: 6, range: [0, 0], target: "self", ops: [{ op: "status", id: "ward", turns: 2 }] },
  brace: { name: "Brace", mp: 0, range: [0, 0], target: "self", needs: "shield", ops: [{ op: "status", id: "brace", turns: 1 }] },
  aegis: { name: "Aegis", mp: 6, range: [0, 3], target: "ally", ops: [{ op: "status", id: "aegis", turns: 3, absorb: 12 }] },
};
// Statuses: what a skill leaves on a unit. turns count down at the start of the unit's own phase; at 0 it ends
// (so 1 turn lasts until the unit's next turn). mods change stats while it lasts: def adds armour, blockMult
// multiplies the shield's block chance. absorb: the status takes damage before health and breaks when used up.
// fx: our pixelfx loop drawn on the unit while it lasts; pose: the unit holds this pose while it lasts.
export const STATUSES = {
  ward: { name: "Arcane ward", mods: { def: 12 }, fx: "ward/arcane-ward" },
  brace: { name: "Brace", mods: { blockMult: 2 }, fx: "ward/bulwark", pose: "block:0" },
  aegis: { name: "Aegis", absorb: true, fx: "ward/holy-aegis" },
};
export const JUMP = 2;                                   // the largest height change for one step
export const SIDE_MULT = { front: 1, side: 1.25, back: 1.5 };
// Defence: damage = max(1, round(raw x K / (K + D))). Each point of D adds the same effective health (HP x (1 + D/K)),
// it never reaches zero damage, and stacking stays safe. raw = attack (or skill power) x the side multiplier.
// D is armour plus the shield's value, which counts fully from the front, half from the side and not from the back.
// Damage types: physical damage is lowered by armour and the shield's value; magic damage (a staff's bolt, Fireball)
// by resist instead. The side multiplier, the block roll and absorb shields work the same for both.
// A shield also gives a chance to block a hit outright (no damage): full from the front, half from the side, never
// from the back.
export const DEF_K = 20, BLOCK_CAP = 80;
export const SHIELD_SIDE = { front: 1, side: 0.5, back: 0 };
export const mitigate = (raw, d) => Math.max(1, Math.round((raw * DEF_K) / (DEF_K + Math.max(0, d))));
const modSum = (u, k) => (u.statuses ?? []).reduce((a, s) => a + (STATUSES[s.id].mods?.[k] ?? 0), 0);
const modMul = (u, k) => (u.statuses ?? []).reduce((a, s) => a * (STATUSES[s.id].mods?.[k] ?? 1), 1);
export const armourOf = (t) => t.def + modSum(t, "def");
export const defenceOf = (t, side) => armourOf(t) + t.block * SHIELD_SIDE[side];
// earmarked: resistances per element (fire, frost, storm, holy, shadow) will replace the one generic resist
export const resistOf = (t, element) => t.res + modSum(t, "res");
export const blockChanceOf = (t, side) => Math.min(BLOCK_CAP, (t.blockChance ?? 0) * modMul(t, "blockMult") * SHIELD_SIDE[side]);
export const absorbOf = (t) => (t.statuses ?? []).reduce((a, s) => a + (STATUSES[s.id].absorb ? s.left : 0), 0);
export const hasStatus = (t, id) => (t.statuses ?? []).some((s) => s.id === id);
// one hit on a unit: its defence, the damage, the chance to block it, and what an absorb shield would take
function hitOn(t, raw, side, magic, element) {
  const def = magic ? resistOf(t, element) : defenceOf(t, side), dmg = mitigate(raw, def), block = blockChanceOf(t, side);
  const absorbed = Math.min(absorbOf(t), dmg), lost = dmg - absorbed;
  return { def, dmg, block, absorbed, lost, hp: t.hp, after: Math.max(0, t.hp - lost), kills: lost >= t.hp, expected: lost * (1 - block / 100) };
}
// a seeded random number in [0, 1): the battle carries its own state, so a seed replays the same battle
function rand(b) {
  let x = (b.rng = (b.rng + 0x6d2b79f5) | 0);
  x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
// a hit lands: roll the block, then the absorb shield takes what it can, then health
function landHit(b, t, h) {
  if (h.block > 0 && rand(b) * 100 < h.block) return { ...h, blocked: true, absorbed: 0, lost: 0, after: t.hp, kills: false };
  let take = h.absorbed;
  for (const s of t.statuses) if (take > 0 && STATUSES[s.id].absorb) { const k = Math.min(s.left, take); s.left -= k; take -= k; }
  const broke = t.statuses.filter((s) => STATUSES[s.id].absorb && s.left <= 0).map((s) => s.id);
  t.statuses = t.statuses.filter((s) => !(STATUSES[s.id].absorb && s.left <= 0));
  t.hp = Math.max(0, t.hp - h.lost);
  return { ...h, blocked: false, broke };
}
function addStatus(u, op, source) {
  u.statuses = u.statuses.filter((s) => s.id !== op.id);
  u.statuses.push({ id: op.id, turns: op.turns, source, ...(op.absorb ? { left: op.absorb, max: op.absorb } : {}) });
}
export const RANGED = (u) => u.range[1] > 1 && !u.line; // archers and mages shoot; the lancer's reach is melee

// The demo teams, as character definitions. Your party wears each archetype's top-tier look with the default
// body. The foes use the same archetypes in the middle-tier look with the other body, so the two sides read apart.
const member = (id, name, archetype, tier = 2, alt = false) => ({ id, name, archetype, look: presetLook(archetype, tier, alt), talents: [] });
export const DEMO_PARTY = [
  member("p-knight", "Aldric", "knight"), member("p-lancer", "Bran", "lancer"), member("p-thief", "Corin", "thief"),
  member("p-archer", "Dera", "archer"), member("p-mage", "Elin", "mage"), member("p-cleric", "Fara", "cleric"),
];
export const DEMO_FOES = [
  member("e-knight", "Vexa", "knight", 1, true), member("e-lancer", "Ilsa", "lancer", 1, true), member("e-thief", "Nyx", "thief", 1, true),
  member("e-archer", "Hal", "archer", 1, true), member("e-mage", "Oren", "mage", 1, true), member("e-cleric", "Tobin", "cleric", 1, true),
];
// where each character starts: { character, team, tile, facing? }
const PARTY_TILES = [[4, 7], [2, 7], [6, 7], [1, 8], [3, 9], [5, 8]], FOE_TILES = [[5, 3], [7, 3], [8, 2], [1, 2], [2, 1], [5, 1]];
/** The demo battle with a party of six (by default the demo party) against the demo foes. */
export const demoRoster = (party = DEMO_PARTY) => [
  ...party.map((character, i) => ({ character, team: "player", tile: PARTY_TILES[i] })),
  ...DEMO_FOES.map((character, i) => ({ character, team: "enemy", tile: FOE_TILES[i] })),
];
export const DEMO_ROSTER = demoRoster();
export const START_FACING = { player: "NE", enemy: "SW" };

/** A unit from a placed character. The character may be a definition or a made character. */
export function placeUnit({ character, team, tile, facing }) {
  const c = character.stats ? character : makeCharacter(character), st = c.stats;
  return {
    id: c.id, team, name: c.name, archetype: c.archetype, className: c.className, character: c,
    lo: { ...c.look.loadout }, body: { ...c.look.body }, gear: c.look.name, projectile: c.projectile,
    tile: [...tile], facing: facing ?? START_FACING[team],
    damage: st.damage ?? "physical", hp: st.hp, maxHp: st.hp, atk: st.atk, def: st.def, res: st.res, block: st.block, blockChance: st.blockChance, move: st.move, range: [...st.range], line: st.line,
    mp: st.mp, maxMp: st.mp, skills: [...c.skills], statuses: [],
    alive: true, moved: false, acted: false, done: false,
  };
}
export function newBattle(roster = DEMO_ROSTER, { seed = 1 } = {}) {
  return { round: 1, phase: "player", units: roster.map(placeUnit), log: [], rng: seed | 0 };
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

// what an attack would do: the side it lands on (from the defender's facing), the multiplier, the defence, the
// damage, the chance to block it and what an absorb shield would take. expected: the damage times the chance it lands.
export function preview(b, u, t, from = u.tile) {
  const side = attackSide(t.tile, t.facing, from), mult = SIDE_MULT[side], raw = u.atk * mult, magic = u.damage === "magic";
  return { side, mult, raw, magic, ...hitOn(t, raw, side, magic) };
}

// ---------- skills ----------
export const canCast = (u, id) => u.skills.includes(id) && !u.acted && u.mp >= SKILLS[id].mp && (SKILLS[id].needs !== "shield" || (u.blockChance ?? 0) > 0);
export function inSkillRange(id, from, to) { const d = dist(from, to), r = SKILLS[id].range; return d >= r[0] && d <= r[1]; }
export function skillTiles(id, from) {
  const out = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (inSkillRange(id, from, [i, j])) out.push([i, j]);
  return out;
}
export function areaOf(id, tile) {
  if (SKILLS[id].area !== "plus") return [tile];
  return [tile, ...STEPS.map(([, [dc, dr]]) => [tile[0] + dc, tile[1] + dr])].filter(inside);
}
// the units a skill can aim at from a tile (heal, ward, aegis; the caster for a self skill), or null when it aims at
// any tile in range (fireball)
export function skillTargets(b, u, id, from = u.tile) {
  const s = SKILLS[id];
  if (s.target === "self") return [u];
  if (s.target !== "ally") return null;
  return b.units.filter((a) => a.alive && a.team === u.team && inSkillRange(id, from, a.tile));
}
// what a skill would do: one entry per unit and operation. Damage uses the same front/side/back rule as attacks,
// seen from the caster's tile; magic goes by resist instead of armour.
export function skillPreview(b, u, id, tile, from = u.tile) {
  const s = SKILLS[id], effects = [];
  let hit = [];
  if (s.target === "self") hit = [u];
  else if (s.target === "ally") { const a = unitAt(b, tile); if (a && a.team === u.team) hit = [a]; }
  else hit = areaOf(id, tile).map((t) => unitAt(b, t)).filter((a) => a && (a.team !== u.team || s.friendly));
  for (const a of hit) for (const op of s.ops) {
    if (op.op === "heal") { const amount = Math.min(op.amount, a.maxHp - a.hp); effects.push({ unit: a, kind: "heal", amount, hp: a.hp, after: a.hp + amount }); }
    else if (op.op === "damage") {
      const side = attackSide(a.tile, a.facing, from), mult = SIDE_MULT[side], raw = op.power * mult;
      effects.push({ unit: a, kind: "damage", side, mult, raw, magic: !!op.magic, element: op.element, ally: a.team === u.team, amount: 0, ...hitOn(a, raw, side, op.magic, op.element) });
      effects[effects.length - 1].amount = effects[effects.length - 1].dmg;
    } else if (op.op === "status") effects.push({ unit: a, kind: "status", id: op.id, turns: op.turns, absorb: op.absorb ?? 0, op });
  }
  return { id, name: s.name, mp: s.mp, tile, effects };
}
export function cast(b, u, id, tile) {
  const s = SKILLS[id];
  if (!same(tile, u.tile)) u.facing = facingToward(u.tile, tile);
  const p = skillPreview(b, u, id, tile);
  u.mp -= s.mp; u.moved = u.acted = true;
  const parts = [];
  for (const e of p.effects) {
    if (e.kind === "heal") { e.unit.hp = e.after; parts.push(`${e.unit.name} +${e.amount} HP`); }
    else if (e.kind === "damage") {
      Object.assign(e, landHit(b, e.unit, e));
      parts.push(e.blocked ? `${e.unit.name} blocks` : `${e.unit.name} ${e.lost}${e.absorbed ? ` (${e.absorbed} absorbed)` : ""}${e.mult > 1 ? ` (${e.side})` : ""}`);
    } else if (e.kind === "status") { addStatus(e.unit, e.op, u.id); parts.push(`${e.unit.name}: ${STATUSES[e.id].name}`); }
  }
  say(b, `${u.name} uses ${s.name}${parts.length ? ": " + parts.join(", ") : " and hits nothing"}.`);
  for (const e of p.effects) if (e.unit.hp <= 0 && e.unit.alive) { e.unit.alive = false; say(b, `${e.unit.name} is down.`); }
  return p;
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
  const p = { ...preview(b, u, t) }, r = landHit(b, t, p);
  u.moved = u.acted = true;
  const where = `from the ${r.side}${r.mult > 1 ? ` (×${r.mult})` : ""}`;
  if (r.blocked) say(b, `${t.name} blocks ${u.name}'s attack ${where}.`);
  else say(b, `${u.name} hits ${t.name} ${where}: ${r.lost} damage${r.absorbed ? ` (${r.absorbed} absorbed by the aegis)` : ""}.`);
  for (const id of r.broke ?? []) say(b, `${t.name}'s ${STATUSES[id].name.toLowerCase()} breaks.`);
  if (t.hp <= 0) { t.alive = false; say(b, `${t.name} is down.`); }
  return r;
}
export function finish(b, u, facing = u.facing) {
  u.facing = facing;
  u.moved = u.acted = u.done = true;
}
export function nextPhase(b) {
  b.phase = b.phase === "player" ? "enemy" : "player";
  if (b.phase === "player") b.round++;
  for (const u of b.units) u.moved = u.acted = u.done = false;
  // statuses count down at the start of their unit's own phase
  for (const u of b.units) if (u.alive && u.team === b.phase) {
    for (const st of u.statuses) st.turns--;
    for (const st of u.statuses.filter((x) => x.turns <= 0)) say(b, `${u.name}'s ${STATUSES[st.id].name.toLowerCase()} ends.`);
    u.statuses = u.statuses.filter((x) => x.turns > 0);
  }
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
// Skills compete on the same score: a heal counts the health it restores (only when an ally lost at least 6),
// a fireball counts the damage to foes and pays double for damage to its own side. A protective status counts the
// damage it would stop next turn, from the foes close enough to strike its target (see threatOn).
// Attacks and damage count what is expected to land: a shield's block chance lowers them.
export function threatOn(b, a, extra = null) {
  return foesOf(b, a).filter((f) => dist(f.tile, a.tile) <= f.move + f.range[1]).map((f) => {
    const raw = f.atk, side = "front", magic = f.damage === "magic", now = hitOn(a, raw, side, magic), d0 = now.dmg * (1 - now.block / 100);
    if (!extra) return d0;
    const was = a.statuses; a.statuses = [...was, extra];
    const after = hitOn(a, raw, side, magic); a.statuses = was;
    return d0 - after.lost * (1 - after.block / 100);
  }).reduce((x, y) => x + y, 0);
}
function statusValue(b, a, e) {
  if (hasStatus(a, e.id)) return 0;
  const fake = { id: e.id, turns: e.turns, ...(e.absorb ? { left: e.absorb, max: e.absorb } : {}) };
  return threatOn(b, a, fake) * (e.turns > 1 ? 1.3 : 1);
}
export function aiPlan(b, u) {
  const options = [{ tile: u.tile, path: [] }, ...reach(b, u).values()];
  let best = null;
  const offer = (score, o, action) => { if (!best || score > best.score) best = { score, ...o, action }; };
  for (const o of options) {
    const step = -o.path.length * 0.05;
    for (const t of targets(b, u, o.tile)) {
      const p = preview(b, u, t, o.tile), land = 1 - p.block / 100;
      offer(p.expected + (p.kills ? 100 * land : 0) + (RANGED(u) ? dist(o.tile, t.tile) * 0.3 : 0) + step, o, { type: "attack", target: t });
    }
    for (const id of u.skills) {
      if (!canCast(u, id)) continue;
      const S = SKILLS[id], self = S.target === "self";
      const aims = S.target === "tile" ? skillTiles(id, o.tile) : self ? [o.tile] : skillTargets(b, u, id, o.tile).map((a) => a.tile);
      for (const tile of aims) {
        const was = u.tile; if (self) u.tile = o.tile; // judge a self skill where the unit would stand
        const p = skillPreview(b, u, id, tile, o.tile);
        let score = 0, foes = 0;
        for (const e of p.effects) {
          if (e.kind === "heal") score += e.amount >= 6 ? e.amount * 1.1 : 0;
          else if (e.kind === "status") score += statusValue(b, e.unit, e);
          else if (e.ally) score -= e.amount * 2 + (e.kills ? 150 : 0);
          else { foes++; score += e.expected + (e.kills ? 100 : 0); }
        }
        u.tile = was;
        if (score > 0.5 && (S.target !== "tile" || foes)) offer(score + step, o, { type: "skill", skill: id, tile });
      }
    }
  }
  if (best) {
    const a = best.action, at = a.type === "attack" ? a.target.tile : a.tile, foe = nearestFoe(b, u, best.tile);
    const facing = !same(at, best.tile) ? facingToward(best.tile, at) : foe ? facingToward(best.tile, foe.tile) : u.facing;
    return { path: best.path, action: a, target: a.type === "attack" ? a.target : null, facing };
  }
  const field = foeField(b, u.team);
  let go = options[0], gd = Infinity;
  for (const o of options) { const d = field.get(key(o.tile)) ?? 99; if (d < gd || (d === gd && o.path.length < go.path.length)) { go = o; gd = d; } }
  const foe = nearestFoe(b, u, go.tile);
  return { path: go.path, action: null, target: null, facing: foe ? facingToward(go.tile, foe.tile) : u.facing };
}
