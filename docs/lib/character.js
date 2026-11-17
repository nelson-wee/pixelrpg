// Characters: the persistent part of a unit. A character lives between battles (in a run, it is one of your
// party), and it can be rebuilt before each battle. A battle places characters on the map as units
// (docs/lib/battle.js), with their own tile, facing and current health.
//
// A character definition is plain data that a build screen can edit and save:
//   { id, name, archetype, look: { name, loadout, body }, talents: [] }
// look.loadout is the equipment: each worn piece gives the unit both its look and its stats (docs/lib/items.js).
// makeCharacter() turns the definition into a character with derived stats and skills:
// archetype base, plus the equipment, plus (from milestone 3) the talents.
// Pure data and logic: no DOM, no Node APIs.
import { gearStats, basicAttack } from "./items.js";

// Archetypes: the core identity of a character (the "core" talent tree will hang from it).
// base: health, attack, move (tiles), mp. Armour, resist, shields and the attack's range come from the equipment.
export const ARCHETYPES = {
  knight: { name: "Knight", base: { hp: 38, atk: 8, move: 3 }, skills: ["brace"] },
  lancer: { name: "Lancer", base: { hp: 36, atk: 7, move: 4 }, skills: [] },
  thief:  { name: "Thief", base: { hp: 28, atk: 7, move: 5 }, skills: [] },
  archer: { name: "Archer", base: { hp: 26, atk: 6, move: 4 }, skills: [] },
  mage:   { name: "Mage", base: { hp: 22, atk: 11, move: 3, mp: 10 }, skills: ["fireball", "arcaneWard"] },
  cleric: { name: "Cleric", base: { hp: 30, atk: 6, move: 3, mp: 9 }, skills: ["heal", "aegis"] },
};

/** The stats a character brings into a battle: archetype base values, plus the equipment, then talents (none yet). */
export function deriveStats(def) {
  const b = ARCHETYPES[def.archetype].base, g = gearStats(def.look?.loadout ?? {}), atk = basicAttack(def.look?.loadout ?? {});
  const stats = {
    hp: b.hp + g.hp, mp: (b.mp ?? 0) + g.mp, atk: b.atk + g.atk, def: g.def, res: g.res, block: g.block, blockChance: g.blockChance, move: b.move,
    range: atk.range, line: atk.line, projectile: atk.projectile, damage: atk.damage, weapon: atk.weapon,
  };
  // milestone 3: each talent in def.talents adds its stat changes here
  return stats;
}

/** A character from its definition. Throws on an unknown archetype or a definition with no look. */
export function makeCharacter(def) {
  const a = ARCHETYPES[def.archetype];
  if (!a) throw new Error(`${def.id}: no archetype "${def.archetype}"`);
  if (!def.look?.loadout || !def.look?.body) throw new Error(`${def.id}: a character needs a look with a loadout and a body`);
  const stats = deriveStats(def);
  return {
    id: def.id, name: def.name, archetype: def.archetype, className: a.name,
    look: { name: def.look.name ?? a.name, loadout: { ...def.look.loadout }, body: { ...def.look.body } },
    talents: [...(def.talents ?? [])],
    stats,
    projectile: stats.projectile,
    skills: [...a.skills],
  };
}
