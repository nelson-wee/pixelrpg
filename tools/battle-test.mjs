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
  let sides = { front: 0, side: 0, back: 0 }, guard = 0;
  while (!B.winner(b) && b.round <= 40) {
    for (const u of b.units.filter((x) => x.alive && x.team === b.phase)) {
      const plan = B.aiPlan(b, u);
      B.moveAlong(b, u, plan.path);
      assert.ok(B.walkable(u.tile));
      assert.equal(b.units.filter((x) => x.alive && B.same(x.tile, u.tile)).length, 1, "one unit per tile");
      if (plan.target) { assert.ok(B.inRange(u, u.tile, plan.target.tile)); sides[B.strike(b, u, plan.target).side]++; }
      B.finish(b, u, plan.facing);
      if (B.winner(b)) break;
    }
    if (!B.winner(b)) B.nextPhase(b);
    assert.ok(++guard < 200);
  }
  const w = B.winner(b);
  assert.ok(w, "the battle ends");
  console.log(`AI against AI: ${w} wins in round ${b.round}. Hits: ${sides.front} front, ${sides.side} side, ${sides.back} back.`);
  console.log(b.units.map((u) => `${u.team[0]}:${u.name} ${u.hp}/${u.maxHp}`).join(" · "));
}
console.log("battle rules ok");
