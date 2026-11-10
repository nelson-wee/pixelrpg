// Characters: the persistent part of a unit. A character lives between battles (in a run, it is one of your
// party), and it can be rebuilt before each battle. A battle places characters on the map as units
// (docs/lib/battle.js), with their own tile, facing and current health.
//
// A character definition is plain data that a build screen can edit and save:
//   { id, name, archetype, look: { name, loadout, body }, talents: [] }
// makeCharacter() turns it into a character with derived stats and skills. Stats and skills come from the
// archetype (and, from milestone 3, from the talents). The look is separate: any character can wear any gear.
// Pure data and logic: no DOM, no Node APIs.

// Archetypes: the core identity of a character (the "core" talent tree will hang from it).
// base: health, attack, move (tiles), range [min, max] in grid steps, line (straight-line reach), mp.
// projectile: what a ranged attack throws ("arrow" or "spell"); a melee archetype has none.
export const ARCHETYPES = {
  knight: { name: "Knight", base: { hp: 42, atk: 10, move: 3, range: [1, 1] }, skills: [] },
  lancer: { name: "Lancer", base: { hp: 36, atk: 11, move: 4, range: [1, 2], line: true }, skills: [] },
  thief:  { name: "Thief", base: { hp: 28, atk: 9, move: 5, range: [1, 1] }, skills: [] },
  archer: { name: "Archer", base: { hp: 26, atk: 9, move: 4, range: [2, 4] }, skills: [], projectile: "arrow" },
  mage:   { name: "Mage", base: { hp: 22, atk: 12, move: 3, range: [2, 3], mp: 20 }, skills: ["fireball"], projectile: "spell" },
  cleric: { name: "Cleric", base: { hp: 30, atk: 7, move: 3, range: [1, 1], mp: 18 }, skills: ["heal"] },
};

/** The stats a character brings into a battle: archetype base values, then talents (none yet). */
export function deriveStats(def) {
  const a = ARCHETYPES[def.archetype], b = a.base;
  const stats = { hp: b.hp, atk: b.atk, move: b.move, range: [...b.range], line: !!b.line, mp: b.mp ?? 0 };
  // milestone 3: each talent in def.talents adds its stat changes here
  return stats;
}

/** A character from its definition. Throws on an unknown archetype or a definition with no look. */
export function makeCharacter(def) {
  const a = ARCHETYPES[def.archetype];
  if (!a) throw new Error(`${def.id}: no archetype "${def.archetype}"`);
  if (!def.look?.loadout || !def.look?.body) throw new Error(`${def.id}: a character needs a look with a loadout and a body`);
  return {
    id: def.id, name: def.name, archetype: def.archetype, className: a.name,
    look: { name: def.look.name ?? a.name, loadout: { ...def.look.loadout }, body: { ...def.look.body } },
    talents: [...(def.talents ?? [])],
    stats: deriveStats(def),
    skills: [...a.skills],
    projectile: a.projectile ?? null,
  };
}
