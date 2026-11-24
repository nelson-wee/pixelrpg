// Checks the battle rules in docs/lib/battle.js: facing math, movement and a full AI-against-AI battle.
import assert from "node:assert/strict";
import * as B from "../docs/lib/battle.js";
import { ARCHETYPES, makeCharacter } from "../docs/lib/character.js";
import { presetLook } from "../docs/lib/presets.js";

// a short roster for tests: [id, team, archetype, name, tile] -> placed characters with the top-tier look
const roster = (rows) => rows.map(([id, team, archetype, name, tile]) => ({ character: { id, name, archetype, look: presetLook(archetype), talents: [] }, team, tile }));

// facing: damage from the front, the side and the back
{
  const b = B.newBattle(roster([["a", "player", "knight", "A", [5, 5]], ["d", "enemy", "knight", "D", [5, 6]]]));
  const [a, d] = b.units;
  d.facing = "NE"; // faces row - 1, so toward the attacker
  assert.equal(B.preview(b, a, d).side, "front");
  d.facing = "SE"; assert.equal(B.preview(b, a, d).side, "side");
  d.facing = "SW"; const back = B.preview(b, a, d);
  assert.equal(back.side, "back"); assert.equal(back.dmg, B.mitigate(a.atk * 1.5, d.def), "the shield does not count from the back");
  B.strike(b, a, d);
  assert.equal(a.facing, "SW", "the attacker turns to the target");
  assert.equal(d.hp, d.maxHp - back.dmg);
}
// defence: damage = max(1, round(raw x 20 / (20 + D))); shields count fully from the front, half from the side, not from the back
{
  assert.equal(B.mitigate(12, 12), 8); assert.equal(B.mitigate(18, 12), 11); assert.equal(B.mitigate(10, 0), 10); assert.equal(B.mitigate(2, 500), 1);
  const b = B.newBattle(roster([["a", "player", "thief", "A", [5, 5]], ["d", "enemy", "knight", "D", [5, 6]]]));
  const [a, d] = b.units; // a plate knight with a kite shield: DEF 14, shield 3
  assert.deepEqual([d.def, d.block, d.res], [14, 3, 1]);
  d.facing = "NE"; assert.equal(B.preview(b, a, d).def, 17);
  d.facing = "SE"; assert.equal(B.preview(b, a, d).def, 15.5);
  d.facing = "SW"; assert.equal(B.preview(b, a, d).def, 14);
  // magic goes by resist, not armour or shield
  const m = B.newBattle(roster([["m", "player", "mage", "M", [5, 2]], ["k", "enemy", "knight", "K", [5, 5]], ["c", "enemy", "cleric", "C", [5, 6]]]));
  const [mg, kn, cl] = m.units, fb = B.skillPreview(m, mg, "fireball", kn.tile);
  const ek = fb.effects.find((e) => e.unit === kn), ec = fb.effects.find((e) => e.unit === cl);
  assert.ok(ek.magic); assert.equal(ek.def, kn.res); assert.equal(ec.def, cl.res);
  assert.ok(ek.amount > ec.amount, "plate does not stop fire; a high-resist robe does");
}
// movement: no water, no props, no enemies in the way, no step higher than JUMP
{
  const b = B.newBattle();
  for (const u of b.units) for (const { tile, path } of B.reach(b, u).values()) {
    assert.ok(B.walkable(tile), `${u.name} can not stop on ${tile}`);
    assert.ok(path.length <= u.move);
    assert.ok(!B.unitAt(b, tile));
    let prev = u.tile;
    for (const t of path) {
      assert.equal(B.dist(prev, t), 1);
      assert.ok(Math.abs(B.height(...t) - B.height(...prev)) <= B.JUMP);
      const o = B.unitAt(b, t); assert.ok(!o || o.team === u.team, "no path through an enemy");
      prev = t;
    }
  }
}
// spear reach: two tiles in a straight line only
{
  const b = B.newBattle(roster([["l", "player", "lancer", "L", [5, 5]]])), l = b.units[0];
  assert.ok(B.inRange(l, [5, 5], [5, 7])); assert.ok(!B.inRange(l, [5, 5], [6, 6]));
}
// a full battle with the AI on both sides
{
  const b = B.newBattle();
  let sides = { front: 0, side: 0, back: 0 }, casts = {}, blocks = 0, guard = 0;
  while (!B.winner(b) && b.round <= 40) {
    for (const u of b.units.filter((x) => x.alive && x.team === b.phase)) {
      const plan = B.aiPlan(b, u);
      B.moveAlong(b, u, plan.path);
      assert.ok(B.walkable(u.tile));
      assert.equal(b.units.filter((x) => x.alive && B.same(x.tile, u.tile)).length, 1, "one unit per tile");
      const a = plan.action;
      if (a?.type === "attack") { assert.ok(B.inRange(u, u.tile, a.target.tile)); const r = B.strike(b, u, a.target); sides[r.side]++; blocks += r.blocked ? 1 : 0; }
      if (a?.type === "skill") {
        assert.ok(B.canCast(u, a.skill)); assert.ok(B.inSkillRange(a.skill, u.tile, a.tile));
        const mp = u.mp; B.cast(b, u, a.skill, a.tile); casts[a.skill] = (casts[a.skill] ?? 0) + 1;
        assert.equal(u.mp, mp - B.SKILLS[a.skill].mp);
      }
      B.finish(b, u, plan.facing);
      if (B.winner(b)) break;
    }
    if (!B.winner(b)) B.nextPhase(b);
    assert.ok(++guard < 200);
  }
  const w = B.winner(b);
  assert.ok(w, "the battle ends");
  console.log(`AI against AI: ${w} wins in round ${b.round}. Hits: ${sides.front} front, ${sides.side} side, ${sides.back} back. Blocked: ${blocks}. Casts: ${Object.entries(casts).map(([k, n]) => `${n} ${k}`).join(", ")}.`);
  assert.ok(b.units.every((u) => u.mp >= 0 && u.hp >= 0 && u.hp <= u.maxHp));
  console.log(b.units.map((u) => `${u.team[0]}:${u.name} ${u.hp}/${u.maxHp}`).join(" · "));
}
// skills: heal restores health up to the maximum and uses MP; fireball hits the plus shape, allies too
{
  const b = B.newBattle(roster([
    ["c", "player", "cleric", "C", [5, 5]], ["k", "player", "knight", "K", [5, 7]],
    ["m", "enemy", "mage", "M", [5, 2]], ["x", "enemy", "thief", "X", [6, 7]], ["y", "enemy", "thief", "Y", [6, 8]],
  ]));
  const [c, k, m, x, y] = b.units;
  k.hp = 40;
  assert.ok(B.canCast(c, "heal")); assert.ok(!B.canCast(c, "fireball"));
  assert.deepEqual(B.skillTargets(b, c, "heal").map((u) => u.id).sort(), ["c", "k"]);
  const h = B.cast(b, c, "heal", k.tile);
  assert.equal(h.effects[0].amount, 2, "no healing past the maximum"); assert.equal(k.hp, 42);
  assert.equal(c.mp, c.maxMp - 6); assert.ok(!B.canCast(c, "heal"), "one action per turn");
  assert.deepEqual(B.areaOf("fireball", [0, 0]).map(B.key).sort(), ["0,0", "0,1", "1,0"]);
  const area = B.areaOf("fireball", [6, 7]).map(B.key);
  assert.ok(area.includes("5,7") && area.includes("6,8") && !area.includes("5,8"), "plus shape, no diagonals");
  m.tile = [6, 4]; // three tiles from the thief at 6,7
  const p = B.skillPreview(b, m, "fireball", [6, 7]);
  assert.deepEqual(p.effects.map((e) => e.unit.id).sort(), ["k", "x", "y"], "the plus shape hits the knight and both thieves");
  assert.ok(p.effects.find((e) => e.unit.id === "x").ally, "friendly fire on the caster's own side");
  B.cast(b, m, "fireball", [6, 7]);
  assert.equal(m.mp, m.maxMp - 8);
  m.acted = false; m.mp = 7; assert.ok(!B.canCast(m, "fireball"), "not enough MP");
}
// characters: stats and skills come from the archetype; the look is separate; a battle does not change the character
{
  // the demo party's totals: archetype base plus equipment
  const WANT = { knight: [42, 10, 14, 1, 3, 0, [1, 1]], lancer: [36, 11, 14, 3, 0, 0, [1, 2]], thief: [28, 9, 6, 1, 0, 0, [1, 1]],
    archer: [26, 9, 9, 1, 0, 0, [2, 5]], mage: [22, 12, 0, 10, 0, 21, [2, 3]], cleric: [30, 7, 0, 11, 0, 18, [1, 1]] };
  for (const [k, w] of Object.entries(WANT)) {
    const st = makeCharacter({ id: k, name: k, archetype: k, look: presetLook(k) }).stats;
    assert.deepEqual([st.hp, st.atk, st.def, st.res, st.block, st.mp, st.range], w, `${k} totals`);
  }
  assert.equal(Object.keys(ARCHETYPES).length, 6);
  assert.throws(() => makeCharacter({ id: "x", archetype: "bard", look: presetLook("knight") }), /archetype/);
  assert.throws(() => makeCharacter({ id: "x", archetype: "knight" }), /look/);
  // a knight in a mage's robe and staff: knight base, the robe's stats, the staff's bolt, no skills
  const def = { id: "odd", name: "Odd", archetype: "knight", look: presetLook("mage") }, c = makeCharacter(def);
  assert.deepEqual([c.stats.hp, c.stats.atk, c.stats.def, c.stats.res, c.stats.range, c.projectile], [38, 9, 0, 10, [2, 3], "spell"]);
  assert.deepEqual(c.skills, ["brace"]); assert.equal(c.look.loadout.chest, "robe");
  const b = B.newBattle([{ character: c, team: "player", tile: [5, 5] }, ...roster([["e", "enemy", "mage", "E", [5, 7]]])]);
  const [u, e] = b.units;
  assert.equal(u.character, c); assert.equal(u.lo.main, "staff"); assert.equal(u.facing, "NE");
  B.strike(b, e, u); // the mage hits the knight
  assert.ok(u.hp < u.maxHp); assert.equal(c.stats.hp, 38, "the character keeps its stats after the battle");
  u.lo.main = "sword"; assert.equal(c.look.loadout.main, "staff", "a unit's gear is a copy");
  // the demo roster: six against six, same archetypes on both sides, different looks
  const d = B.newBattle(), arch = (t) => d.units.filter((x) => x.team === t).map((x) => x.archetype).sort();
  assert.deepEqual(arch("player"), arch("enemy"));
  assert.ok(d.units.filter((x) => x.team === "enemy").every((x) => x.gear !== d.units.find((p) => p.team === "player" && p.archetype === x.archetype).gear));
}
// block chance: a kite shield blocks 30% from the front, 15% from the side, never from the back or against magic;
// Brace doubles it until the knight's next turn
{
  const b = B.newBattle(roster([["a", "player", "thief", "A", [5, 5]], ["k", "enemy", "knight", "K", [5, 6]]]), { seed: 7 });
  const [a, k] = b.units;
  assert.equal(k.blockChance, 30);
  k.facing = "NE"; assert.equal(B.preview(b, a, k).block, 30);
  k.facing = "SE"; assert.equal(B.preview(b, a, k).block, 15);
  k.facing = "SW"; assert.equal(B.preview(b, a, k).block, 0);
  // a staff's bolt is magic: resist instead of armour and shield value, but the side and the block still count
  const mb = B.newBattle(roster([["m", "player", "mage", "M", [5, 4]], ["k2", "enemy", "knight", "K2", [5, 6]]]));
  const [mm, kk] = mb.units; kk.facing = "NE";
  const bolt = B.preview(mb, mm, kk);
  assert.equal(mm.damage, "magic"); assert.ok(bolt.magic); assert.equal(bolt.def, kk.res); assert.equal(bolt.block, 30); assert.equal(bolt.dmg, B.mitigate(mm.atk, kk.res));
  kk.facing = "SW"; assert.equal(B.preview(mb, mm, kk).mult, 1.5, "the side multiplier applies to magic");
  assert.equal(B.newBattle(roster([["a", "player", "archer", "A", [1, 1]]])).units[0].damage, "physical");
  k.facing = "NE";
  b.phase = "enemy"; assert.ok(B.canCast(k, "brace"));
  B.cast(b, k, "brace", k.tile);
  assert.ok(B.hasStatus(k, "brace")); assert.equal(B.preview(b, a, k).block, 60); assert.equal(B.blockChanceOf(k, "side"), 30);
  B.nextPhase(b); assert.ok(B.hasStatus(k, "brace"), "still braced through the other side's phase");
  B.nextPhase(b); assert.ok(!B.hasStatus(k, "brace"), "it ends at the knight's next turn");
  // over many hits, close to 30% are blocked, and a blocked hit does no damage
  let blocked = 0;
  for (let i = 0; i < 400; i++) { k.hp = k.maxHp; a.acted = false; a.tile = [5, 5]; const r = B.strike(b, a, k); if (r.blocked) { blocked++; assert.equal(k.hp, k.maxHp); } }
  assert.ok(blocked > 90 && blocked < 150, `blocked ${blocked} of 400`);
  // the block limit is 80%; a buckler blocks 20%
  const was = k.blockChance; k.blockChance = 100; assert.equal(B.preview(b, a, k).block, 80); k.blockChance = was;
  const { ITEMS } = await import("../docs/lib/items.js"); assert.equal(ITEMS.off.buckler.blockChance, 20);
  // a knight with no shield cannot brace
  const nb = B.newBattle([{ character: { id: "g", name: "G", archetype: "knight", look: { loadout: { main: "greatsword" }, body: { type: "m" } } }, team: "player", tile: [1, 1] }]);
  assert.ok(!B.canCast(nb.units[0], "brace"));
}
// Arcane Ward: +12 armour for 2 turns; Aegis: absorbs 12 damage, then breaks
{
  const b = B.newBattle(roster([["m", "player", "mage", "M", [5, 5]], ["c", "player", "cleric", "C", [5, 6]], ["x", "enemy", "thief", "X", [6, 5]]]));
  const [m, c, x] = b.units;
  const before = B.preview(b, x, m).dmg;
  assert.deepEqual(B.skillTargets(b, m, "arcaneWard").map((u) => u.id), ["m"], "Arcane Ward is for the mage only");
  B.cast(b, m, "arcaneWard", m.tile);
  assert.equal(B.armourOf(m), 12); assert.ok(B.preview(b, x, m).dmg < before);
  B.nextPhase(b); B.nextPhase(b); assert.ok(B.hasStatus(m, "ward"), "lasts through two enemy phases");
  B.nextPhase(b); B.nextPhase(b); assert.ok(!B.hasStatus(m, "ward"));
  b.phase = "player"; m.acted = c.acted = false;
  B.cast(b, c, "aegis", m.tile);
  assert.equal(B.absorbOf(m), 12);
  const hp = m.hp, r = B.strike(b, x, m);
  assert.equal(r.absorbed, Math.min(12, r.dmg)); assert.equal(m.hp, hp - r.lost); assert.equal(B.absorbOf(m), 12 - r.absorbed);
  x.atk = 60; x.acted = false; const r2 = B.strike(b, x, m);
  assert.ok(!B.hasStatus(m, "aegis"), "the aegis breaks when it is used up"); assert.deepEqual(r2.broke, ["aegis"]);
}
// the arenas: start tiles are free and walkable, every unit can reach the other side, stairs climb at most JUMP,
// the gallery is high ground reached by its stair; an AI battle ends on each map
{
  const { MAPS } = await import("../docs/lib/maps.js");
  for (const [id, m] of Object.entries(MAPS)) {
    const b = B.newBattle(B.demoRoster(B.DEMO_PARTY, id), { map: id, seed: 3 });
    assert.equal(b.map, id); assert.equal(B.mapOf(), m);
    const starts = [...m.party, ...m.foes].map(B.key);
    assert.equal(new Set(starts).size, 12, `${id}: twelve different start tiles`);
    for (const u of b.units) assert.ok(B.walkable(u.tile), `${id}: ${u.name} starts on a free tile`);
    // flood the walkable grid from the first party tile, ignoring units: every start tile must be in it
    const seen = new Set([B.key(m.party[0])]), q = [m.party[0]];
    while (q.length) { const t = q.shift(); for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [t[0] + dc, t[1] + dr]; if (!seen.has(B.key(n)) && B.walkable(n) && Math.abs(B.height(...n) - B.height(...t)) <= B.JUMP) { seen.add(B.key(n)); q.push(n); } } }
    for (const k of starts) assert.ok(seen.has(k), `${id}: ${k} can be reached`);
    let guard = 0;
    while (!B.winner(b) && guard++ < 120) {
      for (const u of b.units.filter((x) => x.alive && x.team === b.phase)) {
        const plan = B.aiPlan(b, u); B.moveAlong(b, u, plan.path);
        if (plan.action?.type === "attack") B.strike(b, u, plan.action.target);
        if (plan.action?.type === "skill") B.cast(b, u, plan.action.skill, plan.action.tile);
        B.finish(b, u, plan.facing); if (B.winner(b)) break;
      }
      if (!B.winner(b)) B.nextPhase(b);
    }
    assert.ok(B.winner(b), `${id}: the AI battle ends`);
    console.log(`${m.name}: ${B.winner(b)} wins in round ${b.round}.`);
  }
  const m = MAPS.cloister;
  assert.equal(m.height(0, 6), 4, "the gallery is high ground"); assert.equal(m.height(2, 6), 1);
  assert.equal(m.height(0, 9) - m.height(0, 10), 1); assert.equal(m.height(0, 8) - m.height(0, 9), 1);
  B.useMap("river");
}
// every gear piece is an item, and every item is a gear piece
{
  const { GEAR } = await import("../docs/lib/pixelrpg.js"), { ITEMS } = await import("../docs/lib/items.js");
  for (const [slot, pieces] of Object.entries(GEAR)) for (const id of Object.keys(pieces)) assert.ok(ITEMS[slot]?.[id], `no item entry for ${slot}.${id}`);
  for (const [slot, items] of Object.entries(ITEMS)) for (const id of Object.keys(items)) assert.ok(GEAR[slot]?.[id], `item ${slot}.${id} has no art`);
}
console.log("battle rules ok");
