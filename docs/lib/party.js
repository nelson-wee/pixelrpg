// The party: the player's characters between battles. Pre-battle, each character's gear can change
// (later, its build too). Pure data and logic, no DOM: the page passes in the saved text and stores what
// serializeParty() returns.
import { GEAR, TWO_HANDED } from "./pixelrpg.js";
import { LOOKS } from "./presets.js";
import { ARCHETYPES } from "./character.js";
import { DEMO_PARTY } from "./battle.js";
import { SLOTS, HAIRS } from "./gearlist.js";

export const PARTY_SIZE = DEMO_PARTY.length;
const KEYS = SLOTS.map(([k]) => k);
const clone = (x) => JSON.parse(JSON.stringify(x));
export const defaultParty = () => clone(DEMO_PARTY);

const sameLoadout = (a, b) => KEYS.every((k) => (a[k] || null) === (b[k] || null));
/** The name of the preset this loadout matches (any archetype, any tier), or "Custom". */
export function lookName(lo) {
  for (const k of Object.values(LOOKS)) for (const [name, , preset] of k.tiers) if (sameLoadout(lo, preset)) return name;
  return "Custom";
}
const withLook = (def, loadout, body = def.look.body) => {
  const lo = Object.fromEntries(KEYS.filter((k) => loadout[k]).map((k) => [k, loadout[k]]));
  return { ...def, look: { name: lookName(lo), loadout: lo, body: { ...body } } };
};
/** Put one piece in a slot (or clear it with null). A two-handed weapon empties the off hand, and an off-hand
 *  piece takes the place of a two-handed weapon. Returns a new definition. */
export function equip(def, slot, id) {
  const lo = { ...def.look.loadout, [slot]: id || null };
  if (slot === "main" && TWO_HANDED.includes(id)) lo.off = null;
  if (slot === "off" && id && TWO_HANDED.includes(def.look.loadout.main)) lo.main = null;
  return withLook(def, lo);
}
/** Wear a preset's gear. The character keeps its own body. */
export const wearPreset = (def, key, tier) => withLook(def, LOOKS[key].tiers[tier][2]);
/** Change the body: { type: "m" | "f", hair, beard }. */
export const setBody = (def, patch) => withLook(def, def.look.loadout, { ...def.look.body, ...patch });

/** A clean copy of a saved definition, or null if it is not usable. Unknown gear pieces are dropped. */
export function cleanDef(d, fallback) {
  if (!d || typeof d !== "object" || !ARCHETYPES[d.archetype] || d.archetype !== fallback.archetype) return null;
  const lo = {};
  for (const k of KEYS) { const id = d.look?.loadout?.[k]; if (typeof id === "string" && GEAR[k]?.[id]) lo[k] = id; }
  if (lo.off && TWO_HANDED.includes(lo.main)) delete lo.off;
  const b = d.look?.body ?? {};
  const body = { type: b.type === "f" ? "f" : "m", hair: HAIRS.some(([h]) => h === b.hair) ? b.hair : fallback.look.body.hair, ...(b.beard ? { beard: true } : {}) };
  return withLook({ id: fallback.id, name: fallback.name, archetype: fallback.archetype, talents: [] }, lo, body);
}
/** The party from saved text. Anything missing or broken falls back to the demo party, one character at a time. */
export function parseParty(text) {
  let saved = null;
  try { saved = JSON.parse(text ?? "null"); } catch (e) { saved = null; }
  const list = Array.isArray(saved?.party) ? saved.party : [];
  return defaultParty().map((fb, i) => cleanDef(list.find((d) => d?.id === fb.id) ?? list[i], fb) ?? fb);
}
export const serializeParty = (party) => JSON.stringify({ v: 1, party });
