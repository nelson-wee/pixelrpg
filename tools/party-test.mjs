// Checks the party rules in docs/lib/party.js: gear changes, saving and loading, and the battle roster.
import assert from "node:assert/strict";
import * as P from "../docs/lib/party.js";
import * as B from "../docs/lib/battle.js";
import { makeCharacter } from "../docs/lib/character.js";

const party = P.defaultParty();
assert.equal(party.length, 6);
const knight = party[0];
assert.equal(knight.look.name, "Knight");
// gear: a two-handed weapon empties the off hand; an off-hand piece replaces a two-handed weapon
let k = P.equip(knight, "main", "greatsword");
assert.equal(k.look.loadout.main, "greatsword"); assert.equal(k.look.loadout.off, undefined); assert.equal(k.look.name, "Custom");
k = P.equip(k, "off", "shield"); assert.equal(k.look.loadout.main, undefined); assert.equal(k.look.loadout.off, "shield");
k = P.equip(k, "main", "sword"); assert.equal(k.look.name, "Knight", "back to the preset look");
assert.equal(knight.look.loadout.main, "sword", "equip returns a new definition");
// presets change the gear, not the body; a knight in a robe keeps knight stats
k = P.wearPreset(knight, "mage", 2); assert.equal(k.look.name, "Archmage"); assert.deepEqual(k.look.body, knight.look.body);
assert.equal(makeCharacter(k).stats.hp, 42);
k = P.setBody(k, { type: "f", hair: "grey" }); assert.equal(k.look.body.type, "f"); assert.equal(k.look.loadout.chest, "robe");
// save and load
const changed = party.map((d, i) => (i === 0 ? k : d));
const back = P.parseParty(P.serializeParty(changed));
assert.deepEqual(back, changed);
// broken saves fall back, one character at a time; unknown gear and wrong archetypes are dropped
assert.deepEqual(P.parseParty("not json"), P.defaultParty());
assert.deepEqual(P.parseParty(null), P.defaultParty());
const bad = JSON.parse(P.serializeParty(changed));
bad.party[0].look.loadout.head = "no-such-helm"; bad.party[1].archetype = "dragon"; bad.party[2].look.body.hair = "green";
const fixed = P.parseParty(JSON.stringify(bad));
assert.equal(fixed[0].look.loadout.head, undefined); assert.equal(fixed[0].look.loadout.chest, "robe");
assert.deepEqual(fixed[1], P.defaultParty()[1]);
assert.equal(fixed[2].look.body.hair, P.defaultParty()[2].look.body.hair);
// the battle uses the party's gear
const b = B.newBattle(B.demoRoster(changed)), u = b.units.find((x) => x.id === "p-knight");
assert.equal(u.lo.chest, "robe"); assert.equal(u.gear, "Archmage"); assert.equal(u.maxHp, 42);
assert.equal(b.units.filter((x) => x.team === "enemy").length, 6);
console.log("party rules ok");
