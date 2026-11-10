// Checks the battle rules in docs/lib/battle.js: facing math, movement and a full AI-against-AI battle.
import assert from "node:assert/strict";
import * as B from "../docs/lib/battle.js";

// facing: damage from the front, the side and the back
{
  const b = B.newBattle([["a", "player", "knight", "A", [5, 5]], ["d", "enemy", "knight", "D", [5, 6]]]);
  const [a, d] = b.units;
  d.facing = "NE"; // faces row - 1, so toward the attacker
  assert.equal(B.preview(b, a, d).side, "front");
  d.facing = "SE"; assert.equal(B.preview(b, a, d).side, "side");
  d.facing = "SW"; const back = B.preview(b, a, d);
  assert.equal(back.side, "back"); assert.equal(back.dmg, Math.round(a.atk * 1.5));
  B.strike(b, a, d);
  assert.equal(a.facing, "SW", "the attacker turns to the target");
  assert.equal(d.hp, d.maxHp - back.dmg);
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
  const b = B.newBattle([["l", "player", "lancer", "L", [5, 5]]]), l = b.units[0];
  assert.ok(B.inRange(l, [5, 5], [5, 7])); assert.ok(!B.inRange(l, [5, 5], [6, 6]));
}
// a full battle with the AI on both sides
{
  const b = B.newBattle();
  let sides = { front: 0, side: 0, back: 0 }, casts = { heal: 0, fireball: 0 }, guard = 0;
  while (!B.winner(b) && b.round <= 40) {
    for (const u of b.units.filter((x) => x.alive && x.team === b.phase)) {
      const plan = B.aiPlan(b, u);
      B.moveAlong(b, u, plan.path);
      assert.ok(B.walkable(u.tile));
      assert.equal(b.units.filter((x) => x.alive && B.same(x.tile, u.tile)).length, 1, "one unit per tile");
      const a = plan.action;
      if (a?.type === "attack") { assert.ok(B.inRange(u, u.tile, a.target.tile)); sides[B.strike(b, u, a.target).side]++; }
      if (a?.type === "skill") {
        assert.ok(B.canCast(u, a.skill)); assert.ok(B.inSkillRange(a.skill, u.tile, a.tile));
        const mp = u.mp; B.cast(b, u, a.skill, a.tile); casts[a.skill]++;
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
  console.log(`AI against AI: ${w} wins in round ${b.round}. Hits: ${sides.front} front, ${sides.side} side, ${sides.back} back. Casts: ${casts.heal} heal, ${casts.fireball} fireball.`);
  assert.ok(b.units.every((u) => u.mp >= 0 && u.hp >= 0 && u.hp <= u.maxHp));
  console.log(b.units.map((u) => `${u.team[0]}:${u.name} ${u.hp}/${u.maxHp}`).join(" · "));
}
// skills: heal restores health up to the maximum and uses MP; fireball hits the plus shape, allies too
{
  const b = B.newBattle([
    ["c", "player", "cleric", "C", [5, 5]], ["k", "player", "knight", "K", [5, 7]],
    ["m", "enemy", "mage", "M", [5, 2]], ["x", "enemy", "thief", "X", [6, 7]], ["y", "enemy", "thief", "Y", [6, 8]],
  ]);
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
console.log("battle rules ok");
