// Look presets: named gear sets and bodies for each archetype, in three tiers (the last is the showcase look).
// These are only looks. They do not set a unit's stats or skills: that is the job of docs/lib/character.js,
// so any character can wear any look. The sprite sheets (tools/art.mjs) and the Wardrobe use these presets.
// Each entry: name, role, silhouette shape, default body, the other body, and tiers of [name, material, loadout].
export const LOOKS = {
  knight: { name: "Knight", role: "Vanguard", shape: "V", body: { type: "m", hair: "hair" }, alt: { type: "f", hair: "crimson" }, tiers: [
    ["Squire", "Leather", { head: "leathercap", shoulders: "leatherpads", chest: "leatherarmor", arms: "bracers", legs: "trousers", main: "sword", off: "buckler" }],
    ["Sergeant", "Chain", { head: "coif", shoulders: "halfpauldrons", chest: "chainK", arms: "mail", legs: "chausses", main: "sword", off: "shield" }],
    ["Knight", "Plate", { head: "greathelm", shoulders: "pauldrons", chest: "plate", arms: "gauntlets", legs: "greaves", back: "cape", main: "sword", off: "shield" }]] },
  mage: { name: "Mage", role: "Elemental caster", shape: "A", body: { type: "f", hair: "hairB" }, alt: { type: "m", hair: "hairB" }, tiers: [
    ["Apprentice", "Cloth", { head: "cap", chest: "shortrobe", arms: "magesleeves", legs: "trousers", main: "rod" }],
    ["Adept", "Robe", { head: "magehood", chest: "simplerobe", arms: "magesleeves", main: "staff" }],
    ["Archmage", "Regalia", { head: "wizhat", shoulders: "collar", chest: "robe", arms: "bell", main: "staff" }]] },
  archer: { name: "Archer", role: "Ranged skirmisher", shape: "I", body: { type: "f", hair: "crimson" }, alt: { type: "m", hair: "hair" }, tiers: [
    ["Hunter", "Cloth", { head: "huntercap", chest: "tunic", legs: "leggings", back: "quiver", off: "shortbow" }],
    ["Ranger", "Leather", { head: "hood", chest: "jerkin", arms: "bracers", legs: "leggings", back: "quiver", off: "bow" }],
    ["Warden", "Brigandine", { head: "falconhelm", shoulders: "leatherpads", chest: "brigandine", arms: "bracers", legs: "leggings", back: "wardencloak", off: "greatbow" }]] },
  thief: { name: "Thief", role: "Infiltrator", shape: "/", body: { type: "m", hair: "hair" }, alt: { type: "f", hair: "ink" }, tiers: [
    ["Cutpurse", "Cloth", { head: "roguehoodB", chest: "darktunic", legs: "trousers", main: "dagger" }],
    ["Rogue", "Leather", { head: "roguehoodC", chest: "roguejerkin", arms: "bracers", legs: "leggings", main: "dagger", off: "dagger" }],
    ["Master thief", "Belted leather", { head: "roguehood", shoulders: "mantlet", chest: "roguejerkin", arms: "bracers", legs: "leggings", main: "shortsword", off: "dagger" }]] },
  cleric: { name: "Cleric", role: "Healer", shape: "A", body: { type: "f", hair: "hair" }, alt: { type: "m", hair: "hair" }, tiers: [
    ["Acolyte", "Habit", { chest: "habit", arms: "woolsleeves", off: "tome" }],
    ["Priest", "Vestment", { head: "veil", shoulders: "mantle", chest: "vestment", arms: "sleeves", main: "mace", off: "tome" }],
    ["High Priest", "Regalia", { head: "mitre", shoulders: "mantle", chest: "gown", arms: "sleeves", main: "sceptre" }]] },
  lancer: { name: "Lancer", role: "Dragoon", shape: "I", body: { type: "m", hair: "hairB" }, alt: { type: "f", hair: "hairB" }, tiers: [
    ["Militia", "Padded", { head: "kettle", chest: "gambeson", legs: "trousers", main: "spear" }],
    ["Dragoon", "Chain", { head: "winghelm", shoulders: "spaulders", chest: "chain", arms: "gauntlets", legs: "greaves", back: "cloak", main: "spear" }],
    ["Dragon Knight", "Scale", { head: "winghelm", shoulders: "spaulders", chest: "scaleplate", arms: "gauntlets", legs: "greaves", back: "dragoncape", main: "dragonspear" }]] },
};
for (const k of Object.values(LOOKS)) k.loadout = k.tiers[2][2];
// weapon variants shown on the stance and attack sheets
export const KNIGHT_GS = { ...LOOKS.knight.loadout, main: "greatsword", off: undefined };
export const LANCER_PH = { ...LOOKS.lancer.loadout, main: "shortspear", off: "shield" };
// special equipment set, kept for a specialist or a set bonus later: the renaissance duelist (rapier and main-gauche)
export const DUELIST = { head: "cavalier", chest: "doublet", arms: "puffsleeves", legs: "breeches", back: "halfcape", main: "rapier", off: "maingauche" };
// enchanted pilot loadouts: [key, name, loadout, body] — each wears one item with a live gear effect
export const ENCHANTED = [
  ["flame-sword", "Flame sword", { ...LOOKS.knight.loadout, main: "flamesword" }, LOOKS.knight.body],
  ["frost-staff", "Frost staff", { ...LOOKS.mage.loadout, main: "froststaff" }, LOOKS.mage.body],
  ["storm-spear", "Storm spear", { ...LOOKS.lancer.loadout, main: "stormspear" }, LOOKS.lancer.body],
  ["shadow-daggers", "Shadow daggers", { ...LOOKS.thief.loadout, main: "shadowdagger", off: "shadowdagger" }, LOOKS.thief.body],
  ["holy-vestments", "Holy vestments", { ...LOOKS.cleric.tiers[1][2], chest: "holyvestments" }, LOOKS.cleric.body],
];
export const bodyOf = (k, type) => (k.body.type === type ? k.body : k.alt);

/** One preset look: { name, loadout, body }. tier 0-2; alt picks the archetype's other body. */
export function presetLook(key, tier = 2, alt = false) {
  const k = LOOKS[key];
  if (!k) throw new Error(`no look preset "${key}"`);
  const [name, , loadout] = k.tiers[tier];
  return { name, loadout: { ...loadout }, body: { ...(alt ? k.alt : k.body) } };
}
