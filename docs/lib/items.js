// Items: the game side of every gear piece. The art for each piece is in GEAR (docs/lib/pixelrpg.js) under the same
// slot and id. Equipping a piece gives both its look and its stats: there are no separate cosmetics.
// Pure data and logic: no DOM, no Node APIs.
//
// Stats an item can give: hp, mp, atk, def (armour, against weapons), res (resist, against magic),
// block (shield defence: full from the front, half from the side, none from the back).
// A weapon also sets the basic attack: range [min, max], line (straight-line reach), projectile ("arrow", "spell"
// or none). hands: 2 means the item needs both hands (a two-handed weapon, or a bow in the off hand).

const A = (range, extra = {}) => ({ range, ...extra });
const MELEE = A([1, 1]), REACH = A([1, 2], { line: true }), BOLT = A([2, 3], { projectile: "spell" });

// armour: cloth gives resist and MP, leather 1-2 DEF a piece, chain 2-3, plate 3-4 (the chest gives the most)
export const ITEMS = {
  head: {
    greathelm: { def: 3 }, winghelm: { def: 3 }, coif: { def: 2 }, kettle: { def: 2 }, falconhelm: { def: 2 },
    leathercap: { def: 1 }, hood: { def: 1 }, cowl: { def: 1 }, roguehood: { def: 1 }, roguehoodC: { def: 1 }, roguehoodB: { def: 1 },
    huntercap: {}, bandana: {}, shadowmask: { def: 1, res: 1 }, cavalier: { res: 1 },
    wizhat: { res: 3, mp: 2 }, magehood: { res: 2, mp: 2 }, cap: { res: 1, mp: 1 }, mitre: { res: 3, mp: 2 }, veil: { res: 2, mp: 1 },
  },
  shoulders: {
    pauldrons: { def: 3 }, spaulders: { def: 2 }, halfpauldrons: { def: 2 }, leatherpads: { def: 1 }, darkpads: { def: 1 },
    mantlet: { def: 1, res: 1 }, mantletC: { def: 1, res: 1 }, mantle: { res: 2, mp: 1 }, collar: { res: 2, mp: 2 },
  },
  chest: {
    plate: { def: 4, hp: 4 }, scaleplate: { def: 4, res: 1 }, chain: { def: 3 }, chainK: { def: 3 }, brigandine: { def: 3 },
    lamellar: { def: 2 }, leatherarmor: { def: 2 }, gambeson: { def: 2 }, roguejerkin: { def: 2 }, longcoat: { def: 2, res: 1 },
    jerkin: { def: 1 }, garb: { def: 1 }, doublet: { def: 1 }, tunic: {}, darktunic: {},
    robe: { res: 4, mp: 4 }, gown: { res: 4, mp: 3 }, holyvestments: { res: 4, mp: 3 }, simplerobe: { res: 3, mp: 3 },
    vestment: { res: 3, mp: 3 }, shortrobe: { res: 2, mp: 2 }, habit: { res: 2, mp: 2 },
  },
  arms: {
    gauntlets: { def: 2 }, mail: { def: 2 }, bracers: { def: 1 }, puffsleeves: {},
    bell: { res: 1, mp: 1 }, magesleeves: { res: 1, mp: 1 }, sleeves: { res: 1, mp: 1 }, woolsleeves: { res: 1 },
  },
  legs: {
    greaves: { def: 2 }, chausses: { def: 2 }, leggings: { def: 1 }, wraps: { def: 1 }, breeches: { def: 1 }, trousers: {},
  },
  back: {
    dragoncape: { def: 1, res: 2 }, wardencloak: { def: 1, res: 1 }, templecloak: { res: 2 }, cape: { res: 1 }, cloak: { res: 1 },
    halfcape: { res: 1 }, quiver: {}, scarf: {}, longscarf: {},
  },
  main: {
    dagger: { atk: 0, attack: MELEE }, shadowdagger: { atk: 1, attack: MELEE }, shortsword: { atk: 1, attack: MELEE },
    sword: { atk: 2, attack: MELEE }, rapier: { atk: 2, attack: MELEE }, flamesword: { atk: 3, attack: MELEE },
    mace: { atk: 2, attack: MELEE }, sceptre: { atk: 1, res: 1, mp: 2, attack: MELEE },
    greatsword: { atk: 5, hands: 2, attack: MELEE },
    shortspear: { atk: 2, attack: REACH }, spear: { atk: 3, hands: 2, attack: REACH },
    dragonspear: { atk: 4, hands: 2, attack: REACH }, stormspear: { atk: 4, hands: 2, attack: REACH },
    rod: { atk: 0, mp: 2, attack: BOLT }, staff: { atk: 1, mp: 2, attack: BOLT }, froststaff: { atk: 2, mp: 2, attack: BOLT },
  },
  off: {
    shield: { block: 3 }, buckler: { block: 1 }, maingauche: { atk: 1, block: 1 },
    dagger: { atk: 1 }, shadowdagger: { atk: 1 }, offsword: { atk: 2 }, offmace: { atk: 2 },
    tome: { res: 1, mp: 2 },
    shortbow: { atk: 1, hands: 2, attack: A([2, 3], { projectile: "arrow" }) },
    bow: { atk: 2, hands: 2, attack: A([2, 4], { projectile: "arrow" }) },
    greatbow: { atk: 3, hands: 2, attack: A([2, 5], { projectile: "arrow" }) },
  },
};
export const STAT_KEYS = ["hp", "mp", "atk", "def", "res", "block"];
export const UNARMED = MELEE;

export const itemOf = (slot, id) => (id ? ITEMS[slot]?.[id] ?? null : null);
const needsBoth = (slot, id) => itemOf(slot, id)?.hands === 2;

/** The pieces that count (and show): a two-handed main weapon leaves the off hand empty, a bow leaves the main hand empty. */
export function worn(lo) {
  const out = { ...lo };
  if (needsBoth("main", lo.main)) delete out.off;
  else if (needsBoth("off", lo.off)) delete out.main;
  return out;
}
/** Which hand a piece needs to empty when it goes on: "off", "main" or null. */
export function clears(slot, id, lo) {
  if (slot === "main" && id && (needsBoth("main", id) || needsBoth("off", lo.off))) return "off";
  if (slot === "off" && id && (needsBoth("off", id) || needsBoth("main", lo.main))) return "main";
  return null;
}

/** The basic attack the equipment gives: a bow in the off hand, else the main-hand weapon, else bare hands. */
export function basicAttack(lo) {
  const w = worn(lo), off = itemOf("off", w.off), main = itemOf("main", w.main);
  const a = off?.attack ?? main?.attack ?? UNARMED, weapon = off?.attack ? w.off : main?.attack ? w.main : null;
  return { range: [...a.range], line: !!a.line, projectile: a.projectile ?? null, weapon };
}
/** The total of every stat the worn pieces give. */
export function gearStats(lo) {
  const sum = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
  for (const [slot, id] of Object.entries(worn(lo))) { const it = itemOf(slot, id); if (it) for (const k of STAT_KEYS) sum[k] += it[k] ?? 0; }
  return sum;
}
const LABEL = { hp: "HP", mp: "MP", atk: "ATK", def: "DEF", res: "RES", block: "SHIELD" };
/** A short text for a piece, like "+4 DEF +4 HP" or "+2 ATK · reach 1–2". Empty when it gives nothing. */
export function itemText(slot, id) {
  const it = itemOf(slot, id); if (!it) return "";
  const parts = STAT_KEYS.filter((k) => it[k]).map((k) => `+${it[k]} ${LABEL[k]}`);
  if (it.attack && (it.attack.range[1] > 1)) parts.push(it.attack.line ? `reach ${it.attack.range[0]}–${it.attack.range[1]}` : `range ${it.attack.range[0]}–${it.attack.range[1]}`);
  if (it.hands === 2) parts.push("2H");
  return parts.join(" ");
}
