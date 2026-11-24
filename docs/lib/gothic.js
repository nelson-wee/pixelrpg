// Gothic architecture for the arenas: floors (terrain textures added to TERRAIN), props (columns, pews, altar and
// more) and the back walls with lancet windows, a clerestory and a rose window. Built on the sprite core's helpers,
// the same palette and the same light from the top left. No DOM, no Node APIs.
import { Img, P, ell, box, poly, line, outline, shadow, hash, TERRAIN, HW, HH } from "./pixelrpg.js";

// ---------- floors ----------
// a pixel of a tile's top (48 x 24) in the tile's own grid coordinates: a runs along i (to the lower right), b along j
const ab = (x, y) => { const X = (x + 0.5 - HW) / HW, Y = (y + 0.5) / HH; return [(X + Y) / 2, (Y - X) / 2]; };
const frac = (v) => v - Math.floor(v);
function flag(x, y, s) { // two stone slabs a tile, laid in a running bond, with a bevel and a few specks
  const [a, b] = ab(x, y), B = b * 2, A = a * 2 + (Math.floor(B) % 2) * 0.5, fa = frac(A), fb = frac(B);
  if (fa < 0.045 || fb < 0.07) return 1;
  if (fa < 0.09 || fb < 0.13) return 4;
  const k = hash(Math.floor(A) + s, Math.floor(B) + s * 3, 11);
  return hash(x, y, s + 5) > 0.95 ? 4 : k > 0.55 ? 3 : 2;
}
// the carpet runner is two tiles wide: "carpetN" has its gold border on its north edge (low b), "carpetS" on its south
function carpet(edgeAtLowB) {
  return (x, y) => {
    const [a, b] = ab(x, y), e = edgeAtLowB ? b : 1 - b;
    if (e < 0.07) return P("stone", 3);
    if (e < 0.1) return P("gold", 2);
    if (e < 0.2) return P("gold", (Math.floor(a * 8) % 2) ? 3 : 4);
    if (e < 0.23) return P("gold", 2);
    return P("crimson", (Math.floor(a * 6) + Math.floor(b * 6)) % 2 ? 2 : 3);
  };
}
// stairs: three treads a tile, with a bright nosing and a dark riser; A climbs along a, B along b
const steps = (along) => (x, y) => { const [a, b] = ab(x, y), t = frac((along ? a : b) * 3); return t < 0.12 ? 4 : t > 0.82 ? 1 : 3; };
Object.assign(TERRAIN, {
  flagstone: { top: "stone", side: "stone", masonry: true, tex: flag },
  marble: { top: "ivory", side: "stone", masonry: true, tex: (x, y, s) => {
    const [a, b] = ab(x, y), fa = frac(a * 2), fb = frac(b * 2);
    if (fa < 0.04 || fb < 0.06) return P("stone", 2);
    const dark = (Math.floor(a * 2) + Math.floor(b * 2)) % 2;
    const vein = hash(Math.floor(x / 3) + s, Math.floor(y / 2), 3) > 0.94;
    return dark ? P("ink", vein ? 3 : 2) : P("ivory", vein ? 2 : 3);
  } },
  carpetN: { top: "crimson", side: "stone", masonry: true, tex: carpet(true) },
  carpetS: { top: "crimson", side: "stone", masonry: true, tex: carpet(false) },
  stairsA: { top: "stone", side: "stone", masonry: true, tex: steps(true) },
  stairsB: { top: "stone", side: "stone", masonry: true, tex: steps(false) },
  planks: { top: "leather", side: "stone", masonry: true, tex: (x, y, s) => {
    const [a, b] = ab(x, y), fb = frac(b * 5);
    if (fb < 0.1) return 1;
    if (frac(a * 2) < 0.05 && hash(Math.floor(b * 5), s, 2) > 0.3) return 1; // board ends
    return hash(Math.floor(b * 5) + s, Math.floor(a * 2), 9) > 0.5 ? 3 : 2;
  } },
});

// ---------- props: base centre at (20, img.h - 8), like the other props ----------
// a box in the tile's own grid (a, b in 0..1, z up in px) drawn with its top and its two near faces
function isoBox(img, base, a0, a1, b0, b1, z0, z1, r, shade = [4, 3, 2]) {
  const I = (a, b, z) => [20 + 24 * (a - b), base - 12 + 12 * (a + b) - z];
  poly(img, [I(a0, b1, z1), I(a1, b1, z1), I(a1, b1, z0), I(a0, b1, z0)], () => P(r, shade[1])); // +b face, lit
  poly(img, [I(a1, b0, z1), I(a1, b1, z1), I(a1, b1, z0), I(a1, b0, z0)], () => P(r, shade[2])); // +a face, shade
  poly(img, [I(a0, b0, z1), I(a1, b0, z1), I(a1, b1, z1), I(a0, b1, z1)], () => P(r, shade[0])); // top
  return I;
}
const flame = (img, x, y) => { img.set(x, y - 2, P("gold", 4)); img.set(x, y - 1, { hex: "#fff2c0" }); img.set(x, y, P("gold", 3)); };
const GOTHIC_PROPS = {
  // a clustered pier: a shaft with colonnettes, a moulded base, a foliage capital and the ribs of the vault springing
  column: () => {
    const img = new Img(40, 104), base = 96;
    isoBox(img, base, 0.26, 0.74, 0.26, 0.74, 0, 6, "stone");
    ell(img, 20, base - 8, 7.5, 3.2, "stone", { bias: 0.1 });
    for (let y = 22; y < base - 9; y++) {
      for (let x = 16; x <= 24; x++) img.set(x, y, P("stone", x < 18 ? 4 : x < 21 ? 3 : x < 23 ? 2 : 1));
      img.set(14, y, P("stone", 4)); img.set(15, y, P("stone", 3)); img.set(25, y, P("stone", 2)); img.set(26, y, P("stone", 1));
    }
    for (const y of [58, 59]) for (let x = 13; x <= 27; x++) img.set(x, y, P("stone", y === 58 ? 4 : 2)); // shaft ring
    poly(img, [[13, 22], [27, 22], [30, 14], [10, 14]], (x) => P("stone", x < 17 ? 4 : x < 23 ? 3 : 2)); // capital
    for (const [x, y] of [[12, 16], [16, 18], [20, 16], [24, 18], [28, 16]]) { img.set(x, y, P("stone", 4)); img.set(x + 1, y + 1, P("stone", 1)); }
    box(img, 9, 11, 31, 13, "stone", { bias: 0.1 }); // abacus
    for (let t = 0; t <= 1; t += 0.02) { // ribs springing into the vault
      img.set(10 - t * 7, 11 - t * 11 + t * t * 4, P("stone", 3)); img.set(11 - t * 7, 11 - t * 11 + t * t * 4, P("stone", 4));
      img.set(30 + t * 7, 11 - t * 11 + t * t * 4, P("stone", 2)); img.set(29 + t * 7, 11 - t * 11 + t * t * 4, P("stone", 3));
    }
    return img;
  },
  // a pew facing the altar (toward low i): seat, high back, carved ends
  pew: () => {
    const img = new Img(40, 56), base = 48;
    isoBox(img, base, 0.3, 0.6, 0.08, 0.92, 0, 6, "leather", [3, 2, 1]);
    isoBox(img, base, 0.58, 0.68, 0.08, 0.92, 0, 15, "leather", [3, 2, 1]);
    for (const b0 of [0.06, 0.86]) isoBox(img, base, 0.28, 0.7, b0, b0 + 0.08, 0, 12, "leather", [4, 3, 2]);
    return img;
  },
  // an iron candelabrum, three candles burning
  candelabrum: () => {
    const img = new Img(40, 72), base = 64;
    for (const [dx, dy] of [[-6, 0], [6, 0], [0, 2]]) line(img, 20, base - 6, 20 + dx, base + dy - 1, P("ink", 3));
    for (let y = 24; y < base - 5; y++) { img.set(20, y, P("ink", 4)); img.set(21, y, P("ink", 2)); }
    for (const y of [40, 52]) { img.set(19, y, P("ink", 3)); img.set(22, y, P("ink", 2)); }
    for (let x = 12; x <= 29; x++) img.set(x, 24 + (Math.abs(x - 20.5) > 6 ? -1 : 0), P("ink", x < 21 ? 4 : 3));
    for (const [x, top] of [[12, 15], [20, 11], [29, 15]]) {
      img.set(x, 23, P("gold", 3)); img.set(x + 1, 23, P("gold", 2));
      for (let y = top; y < 23; y++) { img.set(x, y, P("ivory", 4)); img.set(x + 1, y, P("ivory", 3)); }
      flame(img, x, top - 1); flame(img, x + 1, top - 1);
    }
    return img;
  },
  // the altar: a stone block in a white cloth, a crimson frontal toward the nave, a gold cross and two candles
  altar: () => {
    const img = new Img(40, 70), base = 62;
    const I = isoBox(img, base, 0.16, 0.84, 0.2, 0.8, 0, 15, "stone");
    poly(img, [I(0.84, 0.25, 13), I(0.84, 0.75, 13), I(0.84, 0.75, 2), I(0.84, 0.25, 2)], (x, y) => P("crimson", y % 4 === 0 ? 2 : 3));
    poly(img, [I(0.16, 0.2, 16), I(0.84, 0.2, 16), I(0.84, 0.8, 16), I(0.16, 0.8, 16)], () => P("ivory", 4));
    poly(img, [I(0.16, 0.8, 16), I(0.84, 0.8, 16), I(0.84, 0.8, 12), I(0.16, 0.8, 12)], () => P("ivory", 3));
    const [cx, cy] = I(0.84, 0.5, 8); for (let y = cy - 4; y <= cy + 3; y++) img.set(cx, y, P("gold", 4)); for (let x = cx - 2; x <= cx + 2; x++) img.set(x, cy - 2, P("gold", 4));
    const [tx, ty] = I(0.35, 0.5, 16); // the cross on the altar
    for (let y = ty - 16; y < ty; y++) { img.set(tx, y, P("gold", 4)); img.set(tx + 1, y, P("gold", 2)); }
    for (let x = tx - 3; x <= tx + 4; x++) img.set(x, ty - 12, P("gold", x <= tx ? 4 : 3));
    for (const [a, b] of [[0.3, 0.25], [0.3, 0.75]]) { const [x, y] = I(a, b, 16); for (let k = 1; k < 6; k++) img.set(x, y - k, P("ivory", 4)); flame(img, x, y - 6); }
    return img;
  },
  // a saint on a plinth, a gold halo
  statue: () => {
    const img = new Img(40, 92), base = 84;
    isoBox(img, base, 0.25, 0.75, 0.25, 0.75, 0, 12, "stone");
    const top = base - 12, hy = top - 41;
    // the halo, a gold ring behind the head
    for (let g = 0; g < 6.29; g += 0.08) { const x = 20.5 + Math.cos(g) * 7, y = hy + Math.sin(g) * 7; img.set(x, y, P("gold", Math.sin(g) < 0 ? 4 : 3)); }
    // robe: widening to the hem, falling folds; shoulders; arms crossed over the chest holding a book
    poly(img, [[12, top], [28, top], [25, top - 30], [15, top - 30]], (x) => P("stone", x < 16 ? 4 : x < 21 ? 3 : 2));
    for (const x of [16, 20, 24]) for (let y = top - 22; y < top - 1; y++) if (img.get(x, y)) img.set(x, y, P("stone", 1));
    ell(img, 20, top - 31, 7, 4, "stone", { bias: 0.15 });
    poly(img, [[14, top - 30], [26, top - 30], [24, top - 24], [16, top - 24]], (x) => P("stone", x < 19 ? 3 : 2));
    box(img, 17, top - 28, 23, top - 24, "leather", { bias: 0.1 });
    // the head under a hood, the face in shade
    ell(img, 20.5, hy, 4.2, 4.6, "stone", { bias: 0.2 });
    for (let y = hy - 1; y <= hy + 2; y++) for (let x = 20; x <= 22; x++) img.set(x, y, P("stone", y === hy - 1 ? 1 : 2));
    return img;
  },
  // a lectern: a post, a sloped desk, an open book
  lectern: () => {
    const img = new Img(40, 64), base = 56;
    line(img, 15, base - 1, 20, base - 4, P("leather", 2)); line(img, 25, base - 1, 20, base - 4, P("leather", 1));
    for (let y = base - 28; y < base - 3; y++) { img.set(19, y, P("leather", 3)); img.set(20, y, P("leather", 2)); }
    poly(img, [[11, base - 33], [27, base - 37], [29, base - 31], [13, base - 27]], (x) => P("leather", x < 18 ? 3 : 2));
    poly(img, [[13, base - 34], [20, base - 36], [20, base - 31], [14, base - 29]], () => P("ivory", 4));
    poly(img, [[20, base - 36], [27, base - 38], [27, base - 33], [20, base - 31]], () => P("ivory", 3));
    for (let y = base - 31; y < base - 26; y++) img.set(21, y, P("crimson", 3));
    return img;
  },
  // a tomb chest with an effigy lying on it, a blind arcade along its side
  tomb: () => {
    const img = new Img(40, 56), base = 48;
    const I = isoBox(img, base, 0.12, 0.88, 0.25, 0.75, 0, 11, "stone");
    for (let k = 0; k < 4; k++) { const [x, y] = I(0.2 + k * 0.18, 0.75, 7); for (let d = 0; d < 4; d++) { img.set(x, y + d, P("stone", 1)); img.set(x + 2, y + d - 1, P("stone", 1)); } img.set(x + 1, y - 1, P("stone", 1)); }
    const [hx, hy] = I(0.24, 0.5, 13), [fx, fy] = I(0.8, 0.5, 13);
    for (let t = 0; t <= 1; t += 0.05) { const x = hx + (fx - hx) * t, y = hy + (fy - hy) * t; ell(img, x, y, 3.2, 1.6, "ivory", { bias: 0.1 }); }
    ell(img, hx, hy - 1, 2.6, 2.2, "ivory", { bias: 0.2 });
    return img;
  },
  // the cloister well: a stone ring, dark water, a little roof on two posts, rope and bucket
  well: () => {
    const img = new Img(40, 68), base = 60;
    ell(img, 20, base - 3, 12, 6, "stone", { bias: -0.1 });
    for (let y = base - 9; y < base - 3; y++) for (let x = 8; x <= 32; x++) if (Math.hypot((x + 0.5 - 20) / 12, (y + 0.5 - (base - 3)) / 6) <= 1 || y < base - 3) {
      if (Math.abs(x + 0.5 - 20) <= 12) img.set(x, y, P("stone", x < 16 ? 3 : x < 25 ? 2 : 1));
    }
    ell(img, 20, base - 9, 12, 6, "stone", { bias: 0.2 });
    ell(img, 20, base - 9, 9, 4, "water", { bias: -0.3 }); img.set(16, base - 11, P("water", 4)); img.set(17, base - 11, P("water", 3));
    for (const x of [9, 31]) for (let y = base - 40; y < base - 8; y++) { img.set(x, y, P("leather", x < 20 ? 3 : 2)); img.set(x + 1, y, P("leather", 1)); }
    poly(img, [[5, base - 39], [20, base - 50], [35, base - 39], [33, base - 37], [20, base - 46], [7, base - 37]], (x) => P("leather", x < 20 ? 3 : 2));
    line(img, 9, base - 34, 31, base - 34, P("leather", 2));
    line(img, 20, base - 34, 20, base - 22, P("sand", 3)); box(img, 18, base - 22, 22, base - 18, "leather", { bias: 0.1 });
    return img;
  },
  // a clipped yew, dark and conical
  yew: () => {
    const img = new Img(40, 72), base = 64;
    box(img, 18, base - 8, 21, base - 1, "leather");
    for (const [y, rx, ry] of [[base - 16, 11, 9], [base - 28, 9, 8], [base - 39, 7, 7], [base - 48, 4.5, 5]]) ell(img, 20, y, rx, ry, "forest", { bias: 0.05 });
    for (let i = 0; i < 30; i++) { const x = 9 + Math.floor(hash(i, 4) * 22), y = base - 56 + Math.floor(hash(i, 5) * 48), v = img.get(x, y); if (v && v.r === "forest" && v.i >= 2) img.set(x, y, P("forest", v.i >= 3 ? 1 : 3)); }
    return img;
  },
};
export const GOTHIC = Object.keys(GOTHIC_PROPS);
/** A gothic prop, outlined, with its shadow; its base centre is at (20, img.h - 8). */
export function gothicProp(kind) {
  const f = GOTHIC_PROPS[kind]; if (!f) return null;
  const img = f(); outline(img);
  shadow(img, 20, img.h - 8.5, kind === "column" ? 9 : 11, 2.6);
  return img;
}

// ---------- the back walls ----------
// Two walls stand on the far edges of the map: the left one along i = 0, the right one along j = 0. They are drawn
// into the map's own picture, before any tile, so the tiles and props in front cover their feet.
// X0, Y0: the screen point of the back corner (grid vertex 0, 0) at height 0. n: the map size. H: the wall height.
// A wall's own coordinates: u along it in px (24 a tile), v up from its foot in px.
// deep jewel glass, mostly blue, lit from outside: a pane's colour by its index, a glint where the light catches it
const GLASS = ["#23406f", "#2a4c86", "#1d345c", "#74272a", "#23406f", "#a4823a", "#2a4c86", "#2c5944", "#1d345c", "#46305f", "#74272a", "#2a4c86"];
const glass = (k, hi) => ({ hex: hi ? "#e9d9a6" : GLASS[((k % GLASS.length) + GLASS.length) % GLASS.length] });
// an equilateral (pointed) arch: is (lu, v) inside an opening of half width h from v0 up to its springing at vs?
function inArch(lu, v, c, h, v0, vs) {
  if (v < v0) return false;
  if (v <= vs) return Math.abs(lu - c) <= h;
  const r = 2 * h, dv = v - vs; if (dv > r) return false;
  const q = Math.sqrt(r * r - dv * dv);
  return lu >= c + h - q && lu <= c - h + q;
}
function wallPixel(u, v, H, lit, rose) {
  const base = lit ? 2 : 1, bay = Math.floor(u / 48), lu = u - bay * 48, k = (t) => P("stone", Math.max(0, Math.min(4, base + t)));
  // the rose window over the altar: a wheel of glass in stone tracery
  if (rose && Math.hypot(u - rose.u, v - rose.v) <= 22) {
    const dx = u - rose.u, dy = v - rose.v, r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    if (r > 19.5) return k(r > 21 ? -1 : 1);
    if (r < 4.5) return r < 3 ? glass(2, r < 1.2) : P("stone", 3);
    const spoke = Math.abs(((ang / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.42;
    if (spoke || Math.abs(r - 11) < 0.8) return P("stone", lit ? 3 : 2);
    const petal = Math.floor(((ang + Math.PI) / (Math.PI / 4))) % 8;
    return glass(r < 11 ? (petal % 2 ? 3 : 1) : (petal % 2 ? 2 : 5), (r > 15 && r < 16.2 && petal % 2 === 0));
  }
  // vaulting shafts between the bays, with capitals at the string course and under the cornice
  if (lu < 3 || lu > 45) {
    const d = lu < 3 ? lu : 48 - lu, capital = (v > 90 && v < 97) || (v > H - 12 && v < H - 6);
    if (capital) return k(v % 2 ? 1 : 0);
    if (v > 12 && v < H - 6) return k(d < 1 ? -1 : d < 2 ? 1 : 0);
  }
  // the tall lancet of each bay: two lights of stained glass under a pointed head, a stone reveal round it
  if (!rose || Math.abs(u - rose.u) > 26 || v < 88) {
    if (inArch(lu, v, 24, 7, 24, 70)) {
      if (Math.abs(lu - 24) < 0.6) return P("ink", 1); // mullion
      const L = lu < 24 ? lu - 17 : lu - 24.6;     // across one light, 0..6.4
      if (L < 0.9 || L > 5.6) return glass(3 + (v >> 4), false); // a coloured border round each light
      const q1 = (Math.floor(lu) + v) % 5, q2 = (Math.floor(lu) - v + 500) % 5;
      if (q1 === 0 || q2 === 0) return P("ink", 0);  // lead: diamond quarries
      const pane = Math.floor((Math.floor(lu) + v) / 5) * 7 + Math.floor((Math.floor(lu) - v + 500) / 5) * 3 + bay * 5;
      return glass(pane, hash(Math.floor(lu), v, bay) > 0.965);
    }
    if (inArch(lu, v, 24, 9, 22, 70)) return lu < 24 ? k(lit ? 1 : 2) : P("ink", 1);
  }
  // the clerestory: two small lancets and an oculus over each bay
  if (!rose || Math.abs(u - rose.u) > 26) {
    for (const c of [16, 32]) {
      if (inArch(lu, v, c, 3, 104, 124)) return v % 6 === 0 ? P("ink", 0) : glass([1, 0, 2, 3, 1, 5, 0, 2][(bay * 2 + (c > 20 ? 1 : 0)) % 8], hash(lu, v, 9) > 0.96);
      if (inArch(lu, v, c, 4.5, 102, 124)) return P("ink", 0);
    }
    const o = Math.hypot(lu - 24, v - 138);
    if (o < 3) return glass(bay + 5, o < 1); if (o < 4.2) return P("ink", 0);
  }
  // the vault: a pointed rib arch spans each bay at the top; above it the web of the vault sinks into shadow
  if (v > H - 40) {
    const inside = inArch(lu, v, 24, 22, 0, H - 40), rib = inside && !inArch(lu, v, 24, 20.5, 0, H - 40);
    if (rib) return k(1);
    if (!inside) return P("stone", (hash(lu >> 2, v >> 2, 6) > 0.8 ? 1 : 0));
  }
  // mouldings: the plinth, the string course
  if (v < 12) return v === 11 ? k(1) : v === 10 ? P("stone", 1) : k(-1);
  if (v >= 92 && v <= 96) return v === 96 ? k(1) : v === 95 ? k(0) : P("stone", 1);
  // ashlar: courses 7 px high, joints every 12 px, broken bond; a little darker under the vault
  const course = Math.floor(v / 7);
  if (v % 7 === 0 || (u + (course % 2) * 6) % 12 < 1) return P("stone", 1);
  const tone = hash(Math.floor((u + (course % 2) * 6) / 12), course, lit ? 3 : 4);
  return k((tone > 0.85 ? 1 : tone < 0.15 ? -1 : 0) - (v > H - 24 ? 1 : 0));
}
/** Draws both back walls into img. rose: { wall: "left" | "right", at: position along it in tiles }. */
export function drawWalls(img, X0, Y0, n, { height: H = 156, rose = null } = {}) {
  for (const side of ["left", "right"]) {
    const lit = side === "right", rs = rose && rose.wall === side ? { u: rose.at * 24, v: 122 } : null;
    for (let px = 0; px <= n * 24; px++) {
      const s = px / 24, x = side === "left" ? X0 - px : X0 + px;
      for (let v = 0; v < H; v++) {
        const y = Math.round(Y0 + 12 * s - v), c = wallPixel(px, v, H, lit, rs);
        if (c) img.set(x, y, c);
      }
    }
  }
  // the corner where the walls meet: a darker shaft
  for (let v = 0; v < H; v++) { img.set(X0, Y0 - v, P("stone", 1)); img.set(X0 + 1, Y0 - v, P("stone", 2)); }
}
/** Shafts of window light as screen polygons (to fill with a faint warm light): [wall, position in tiles]. */
export function lightShafts(lights, X0, Y0, heightAt) {
  const S = (ci, cj, z) => [X0 + (ci - cj) * 24, Y0 + (ci + cj) * 12 - z];
  return lights.map(([wall, at]) => {
    if (wall === "right") { const f = 12 * heightAt(Math.floor(at), 2); return [S(at - 0.3, 0, 82), S(at + 0.3, 0, 82), S(at + 0.3, 3.4, f), S(at - 0.3, 3.4, f)]; }
    const f = 12 * heightAt(1, Math.floor(at)); return [S(0, at - 0.6, 140), S(0, at + 0.6, 140), S(2.6, at + 0.6, f), S(2.6, at - 0.6, f)];
  });
}
