// Procedural pixel art for the design system: class sprites, iso tiles, props, icons, UI frames, battle map.
// Usage: node tools/art.mjs [pixelfx-dir] [out-dir]   (defaults: vendor/pixelfx, sprites/art)
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB = resolve(process.argv[2] ?? `${ROOT}/vendor/pixelfx`), OUT = resolve(process.argv[3] ?? `${ROOT}/sprites/art`);
const { encodePNG } = await import(pathToFileURL(`${LIB}/tools/lib/png.mjs`).href);
mkdirSync(OUT, { recursive: true });

// ---------- palette: 5-step ramps, dark -> bright, hue-shifted (cool shadows, warm lights) ----------
export const R = {
  ink:    ["#1a1220", "#2a1f2d", "#3d2f42", "#5a4a5e", "#7d6d80"],
  skin:   ["#5e3236", "#9a5a4a", "#d08f6c", "#f2c09a", "#ffe3c4"],
  hair:   ["#3b2230", "#6e3a2c", "#a8603a", "#dc9a52", "#f6d08a"],
  hairB:  ["#1c1a34", "#2c2e58", "#44508a", "#6a82b8", "#a8c0e0"],
  steel:  ["#262840", "#46506e", "#7684a4", "#b0bed4", "#eef4f8"],
  gold:   ["#4a2c1a", "#8a5a1e", "#c89432", "#f0c85a", "#fff2b0"],
  crimson:["#3a1428", "#6e1c34", "#b0303e", "#e0604e", "#f6a07a"],
  royal:  ["#1a1c48", "#283c84", "#3a64b8", "#5e9ae0", "#a8d4f4"],
  arcane: ["#241840", "#442a72", "#6e44a8", "#a070d8", "#d8b4f4"],
  forest: ["#142a28", "#1f4a34", "#357040", "#5c9a48", "#a4cc6a"],
  leather:["#2e1e1e", "#563428", "#84553a", "#b47e52", "#dcb488"],
  stone:  ["#2a2838", "#464458", "#6c6a7c", "#9a98a6", "#cfcbd2"],
  water:  ["#14284a", "#1e4c7a", "#2e7eaa", "#56b2cc", "#a8e4e4"],
  sand:   ["#4a3424", "#7e5c3a", "#b48c5c", "#dcbc84", "#f4e2b4"],
  snow:   ["#3a4462", "#6878a0", "#a4b4d0", "#d8e2f0", "#ffffff"],
  parch:  ["#3a2a22", "#6e4e36", "#c4a07a", "#ead6b0", "#fbf2dc"],
  ivory:  ["#4a3e4e", "#8a7e8c", "#c8bec4", "#ece6e0", "#fffcf4"],
  teal:   ["#10283a", "#18485a", "#24706e", "#3ca08a", "#8ad4b0"],
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------- a simple indexed canvas ----------
class Img {
  constructor(w, h) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.c[y * this.w + x]; }
  set(x, y, v) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = v; }
  rgba() {
    const d = new Uint8ClampedArray(this.w * this.h * 4);
    this.c.forEach((v, i) => { if (!v) return; const [r, g, b] = hex(v.hex ?? R[v.r][v.i]); d.set([r, g, b, v.a ?? 255], i * 4); });
    return d;
  }
  png(file) { writeFileSync(`${OUT}/${file}`, encodePNG(this.w, this.h, this.rgba())); }
  blit(src, ox, oy, flip = false) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const v = src.c[y * src.w + (flip ? src.w - 1 - x : x)]; if (!v) continue;
      const tx = ox + x, ty = oy + y; if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
      const cur = this.c[ty * this.w + tx];
      if (v.a !== undefined && v.a < 255) { if (cur && !cur.a) this.c[ty * this.w + tx] = darken(cur, v.a); else if (!cur) this.c[ty * this.w + tx] = v; }
      else this.c[ty * this.w + tx] = v;
    }
  }
}
// shadow over an existing pixel: one ramp step down
function darken(v, a) { if (v.hex) return v; return { r: v.r, i: Math.max(0, v.i - (a > 120 ? 2 : 1)) }; }
const P = (r, i) => ({ r, i });

// light from top-left, toward the viewer
const L = (() => { const v = [-0.55, -0.65, 0.52]; const m = Math.hypot(...v); return v.map((x) => x / m); })();
const band = (d, bands = [0.8, 0.45, 0.05]) => (d > bands[0] ? 4 : d > bands[1] ? 3 : d > bands[2] ? 2 : 1);

// shaded ellipse (sphere-ish)
function ell(img, cx, cy, rx, ry, r, o = {}) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, q = nx * nx + ny * ny;
    if (q > 1) continue;
    if (o.clip && !o.clip(x, y)) continue;
    const nz = Math.sqrt(1 - q);
    const d = nx * L[0] + ny * L[1] + nz * L[2];
    img.set(x, y, P(r, Math.min(o.max ?? 4, band(d + (o.bias ?? 0)))));
  }
}
// shaded vertical cylinder-ish box: x0..x1, y0..y1
function box(img, x0, y0, x1, y1, r, o = {}) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (o.clip && !o.clip(x, y)) continue;
    const nx = ((x + 0.5 - x0) / (x1 - x0 + 1)) * 2 - 1;
    const ny = o.flat ? -0.2 : ((y + 0.5 - y0) / (y1 - y0 + 1)) * 0.8 - 0.4;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx * 0.9));
    const d = nx * L[0] + ny * L[1] + nz * L[2];
    img.set(x, y, P(r, Math.min(o.max ?? 4, band(d + (o.bias ?? 0)))));
  }
}
// filled polygon with a fixed ramp index function
function poly(img, pts, fn) {
  const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const yy = y + 0.5;
      if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + ((yy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { const v = fn(x, y); if (v) img.set(x, y, v); }
  }
}
function line(img, x0, y0, x1, y1, v) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) img.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, typeof v === "function" ? v(i, n) : v);
}
// selective outline: empty pixels next to a filled one take that ramp's darkest step (ink on bottom/right)
function outline(img, inkBR = true) {
  const add = [];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.get(x, y)) continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => img.get(x + dx, y + dy)).filter((v) => v && !v.a && !v.noline);
    if (!nb.length) continue;
    const below = img.get(x, y - 1), left = img.get(x - 1, y);
    const src = nb[0];
    const deep = inkBR && ((below && !below.a) || (left && !left.a));
    add.push([x, y, deep ? { hex: R.ink[1] } : src.hex ? { hex: R.ink[1] } : P(src.r, 0)]);
  }
  for (const [x, y, v] of add) img.set(x, y, v);
}
function shadow(img, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny <= 1 && !img.get(x, y)) img.set(x, y, { hex: "#1a1220", a: 90 });
  }
}

// ---------- characters v2: layered paper-doll sprites, 48x76 cell, feet at (24,72) ----------
// Drawing coordinates: feet on y = 60; the Layer adds OY0 so hats, crests and spears have headroom.
const CW = 48, CH = 76, FX = 24, FY = 72, OY0 = 12;
const INK0 = R.ink[0], INK1 = R.ink[1];
let LW = CW, LOX = 0; // layer canvas width and x offset: 48/0 normally, 96/24 for attack frames
class Layer extends Img {
  constructor() { super(LW, CH); }
  set(x, y, v) { super.set(x + LOX, y + OY0, v); }
  get(x, y) { return super.get(Math.round(x) + LOX, Math.round(y) + OY0); }
  toImg() { const o = new Img(LW, CH); o.c = this.c.slice(); return o; }
}
function mirrorImg(img) {
  const w = img.w, o = new Img(w, CH);
  for (let y = 0; y < CH; y++) for (let x = 0; x < w; x++) { const nx = 49 + 2 * LOX - x; if (nx >= 0 && nx < w) o.c[y * w + nx] = img.c[y * w + x]; }
  return o;
}
const Fv = (v, y) => (typeof v === "function" ? v(y) : v);
const pw = (pts) => (y) => {
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) { const [y1, v1] = pts[i], [y0, v0] = pts[i - 1]; if (y <= y1) return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0); }
  return pts[pts.length - 1][1];
};
// a body of revolution around a vertical axis: shaded like a cylinder, widths from hw(y)
function lathe(img, y0, y1, cx, hw, r, o = {}) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1) - 1; y++) {
    const yc = y + 0.5, c = Fv(cx, yc), w = Fv(hw, yc);
    if (w <= 0.3) continue;
    for (let x = Math.floor(c - w) - 1; x <= Math.ceil(c + w) + 1; x++) {
      const nx = (x + 0.5 - c) / w; if (Math.abs(nx) > 1) continue;
      if (o.clip && !o.clip(x, y)) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx * 0.92)), ny = o.ny ?? -0.2;
      img.set(x, y, P(r, Math.min(o.max ?? 4, band(nx * L[0] + ny * L[1] + nz * L[2] + (o.bias ?? 0)))));
    }
  }
}
// a tapered limb between two points
function capsule(img, ax, ay, bx, by, ra, rb, r, o = {}) {
  const dx = bx - ax, dy = by - ay, LL = dx * dx + dy * dy || 1, m = Math.max(ra, rb) + 1;
  for (let y = Math.floor(Math.min(ay, by) - m); y <= Math.ceil(Math.max(ay, by) + m); y++)
    for (let x = Math.floor(Math.min(ax, bx) - m); x <= Math.ceil(Math.max(ax, bx) + m); x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / LL));
      const ex = px - (ax + dx * t), ey = py - (ay + dy * t), rr = ra + (rb - ra) * t, q = (ex * ex + ey * ey) / (rr * rr);
      if (q > 1) continue;
      if (o.clip && !o.clip(x, y)) continue;
      const nx = ex / rr, ny = ey / rr, nz = Math.sqrt(Math.max(0, 1 - q));
      img.set(x, y, P(r, Math.min(o.max ?? 4, band(nx * L[0] + ny * L[1] + nz * L[2] + (o.bias ?? 0)))));
    }
}
// recolor this layer's pixels on a row (trims, belts, bands)
function rowTint(img, y, x0, x1, fn) { for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) { const v = img.get(x, y); if (v) { const n = fn(x, v); if (n) img.set(x, y, n); } } }
function thick(img, x0, y0, x1, y1, a, b, skip) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (skip && skip(x, y)) continue;
    img.set(x, y, a); if (b) img.set(x + 1, y, b);
  }
}

const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// skeleton v4: a combat stance turned three-quarters onto the iso diagonal.
// Front view faces SE (screen right-down); back view faces NW and is the 180° turn of the same stance.
// The stance comes from the weapons: guard, caster, archer, rogue, lancer.
const STANCES = {
  guard:  { name: "Guard",  crouch: 2, lean: 0.07, main: { e: [19.6, 29.4], h: [24.8, 31.2] }, off: { e: [33.8, 27.4], h: [35.2, 31.4] }, mainDir: [0.42, -0.907], offDir: [0, -1] },
  caster: { name: "Caster", crouch: 1, lean: 0.05, main: { e: [18.6, 29.4], h: [22.2, 34] }, off: { e: [34.2, 24.4], h: [37.6, 20.8] }, mainDir: [0.3, -0.954], offDir: [0, -1] },
  archer: { name: "Archer", crouch: 1, lean: 0.04, main: { e: [14.8, 24.2], h: [23.4, 19.8] }, off: { e: [35, 23], h: [39.4, 23.6] }, mainDir: [0.6, -0.8], offDir: [0, -1] },
  rogue:  { name: "Dual", crouch: 3, lean: 0.12, main: { e: [20.4, 30], h: [25.6, 32.6] }, off: { e: [33.6, 27.4], h: [36.6, 27.6] }, mainDir: [0.22, -0.975], offDir: [0.18, -0.984] },
  lancer: { name: "Lancer", crouch: 2, lean: 0.06, main: { e: [17.6, 30.2], h: [21.2, 36] }, off: { e: [33, 26.4], h: [29.4, 26.8] }, mainDir: [0.66, -0.751], offDir: [0.66, -0.751] },
};
const ATK = {
  guard: [{ main: { e: [16.4, 24.8], h: [20.4, 20.2] }, mainDir: [-0.2, -0.98], lean: 0.04 },
          { main: { e: [26.6, 28.6], h: [31, 31] }, mainDir: [0.88, 0.475], lean: 0.16, dc: 1, step: 3 },
          { main: { e: [24.4, 31], h: [29, 34] }, mainDir: [0.8, 0.6], lean: 0.12, dc: 1, step: 2 }],
  caster: [{ off: { e: [31.6, 26.4], h: [29.6, 24] }, mainDir: [0.22, -0.975], lean: 0.03 },
           { main: { e: [19.6, 29], h: [24, 33.4] }, off: { e: [37, 23.4], h: [42.4, 22.4] }, mainDir: [0.4, -0.917], lean: 0.1, step: 2 },
           { off: { e: [35.4, 25], h: [39.6, 24.8] }, lean: 0.07, step: 1 }],
  archer: [{ main: { e: [13.6, 23.4], h: [21.6, 19.6] } },
           { main: { e: [12.6, 21.6], h: [15.6, 17] } },
           { main: { e: [14.2, 24.4], h: [19.6, 21.6] } }],
  // dual wield: blades raised apart (V), cut across each other (X), finish crossed with blades up
  rogue: [{ main: { e: [17.6, 26.4], h: [20.4, 21] }, off: { e: [34.4, 23], h: [36.4, 19.6] }, mainDir: [-0.35, -0.937], offDir: [0.35, -0.937], lean: 0.06, dc: -1 },
          { main: { e: [24.6, 29], h: [30.4, 30.4] }, off: { e: [36.2, 26], h: [38.2, 30.4] }, mainDir: [0.72, 0.694], offDir: [-0.6, 0.8], lean: 0.18, step: 3 },
          { main: { e: [26, 31], h: [34.4, 33] }, off: { e: [33, 27.4], h: [28.6, 32.4] }, mainDir: [0.55, -0.835], offDir: [-0.55, -0.835], lean: 0.14, step: 2 }],
  // lancer: draw back, then a long lunge into the wide cell
  lancer: [{ main: { e: [14.6, 30.6], h: [17.4, 37] }, off: { e: [30.6, 27.8], h: [24, 29.5] }, lean: 0.02 },
           { main: { e: [22.4, 29.6], h: [27, 33] }, off: { e: [34.6, 22.8], h: [37.3, 26.9] }, mainDir: [0.86, -0.51], lean: 0.2, dc: 1, step: 6 },
           { main: { e: [21, 30], h: [25.4, 34] }, off: { e: [34, 23], h: [35, 26.8] }, mainDir: [0.8, -0.6], lean: 0.15, step: 4 }],
};
const POSES = ["Ready", "Wind-up", "Strike", "Follow-through"];
const BOWS = ["bow", "shortbow", "greatbow"], SPEARS = ["spear", "dragonspear"], RODS = ["staff", "rod", "sceptre"];
function stanceOf(lo = {}) {
  if (BOWS.includes(lo.off)) return "archer";
  if (SPEARS.includes(lo.main)) return "lancer";
  if (RODS.includes(lo.main) || lo.off === "tome") return "caster";
  if (["dagger", "offsword", "offmace"].includes(lo.off) || lo.main === "dagger") return "rogue";
  return "guard";
}
function rig(view, bob, body = {}, stance = "guard", pose = 0) {
  const S0 = STANCES[stance] ?? STANCES.guard, A = (pose && ATK[stance]?.[pose - 1]) || {};
  const S = { ...S0, ...A, main: A.main ?? S0.main, off: A.off ?? S0.off, crouch: S0.crouch + (A.dc ?? 0), step: A.step ?? 0 }, f = view === "front", fem = body.type === "f", n = fem ? 0.6 : 0;
  const b = bob + S.crouch, d = f ? 1 : -1, mx = (x) => (f ? x : 49 - x);
  const shift = S.step * 0.5 * d, at = ([x, y]) => [mx(x) + shift, y + b];
  const main = { s: at([18.6 + n, 21.8 + n * 0.6]), e: at(S.main.e), h: at(S.main.h) };
  const off = { s: at([30.4 - n, 21.2 + n * 0.6]), e: at(S.off.e), h: at(S.off.h) };
  const hipY = 35 + b, tx = (y) => 24.5 + shift + Math.max(0, hipY - y) * S.lean * d;
  // feet on the SE diagonal: lead foot forward-right, rear foot back-left (rotated 180° for the back view)
  const g = (ox, oy) => [24.4 + ox * d, 58.4 + oy * d];
  const hipO = fem ? 2.1 : 2.4;
  const legs = [[g(-6.8, -0.6), -1], [g(6.6 + S.step, 0.7 + S.step * 0.12), 1]].map(([ft, side]) => {
    const hip = [24.5 + shift + side * hipO * d, hipY], mid = lerp2(hip, ft, 0.5);
    const knee = side > 0 ? [mid[0] + 1.6 * d, mid[1]] : [mid[0] - 0.6 * d, mid[1]];
    return { hip, knee, ank: [ft[0], ft[1] - 1.6], foot: ft, bias: ft[0] > 24.5 ? -0.22 : 0 };
  }).sort((p, q) => p.foot[1] - q.foot[1]);
  const hy = 11 + b;
  return {
    f, b, fem, d, stance, pose, released: stance === "archer" && pose >= 2, tx, bx: (y) => tx(y) - 2.6 * d, hx: tx(hy) + 0.3 * d, hy, lr: fem ? 0.86 : 1,
    main, off, hdR: main.h, hdL: off.h, shL: f ? main.s : off.s, shR: f ? off.s : main.s,
    mainDir: [S.mainDir[0] * d, S.mainDir[1]], offDir: [S.offDir[0] * d, S.offDir[1]], legs,
  };
}
const ARMS = (K) => [[K.main.s, K.main.e, K.main.h, K.f ? 0 : -0.28], [K.off.s, K.off.e, K.off.h, K.f ? -0.28 : 0]];
const nearHand = (K, x, y, r = 2.1) => Math.hypot(x - K.main.h[0], y - K.main.h[1]) < r || Math.hypot(x - K.off.h[0], y - K.off.h[1]) < r;
const footAt = (K, L) => [L.foot[0] + 0.9 * K.d, L.foot[1]];
function legEach(img, K, r, ra, rk, rb, o = {}) {
  for (const L of K.legs) {
    capsule(img, L.hip[0], L.hip[1], L.knee[0], L.knee[1], ra, rk, r, { bias: L.bias });
    capsule(img, L.knee[0], L.knee[1], L.ank[0], L.ank[1], rk, rb, r, { bias: L.bias });
    if (o.boot) capsule(img, ...lerp2(L.knee, L.ank, o.bootFrom ?? 0.4), L.ank[0], L.ank[1], rb + 0.5, rb + 0.3, o.boot, { bias: L.bias + 0.1 });
    if (o.knee) ell(img, L.knee[0], L.knee[1], rk, rk * 0.7, o.knee, { bias: L.bias + 0.2 });
    if (o.foot) { const ft = footAt(K, L); ell(img, ft[0], ft[1], o.footW ?? 3.3, 1.9, o.foot, { bias: L.bias }); }
  }
}

function drawBase(img, K, o = {}) {
  const { f, b, hx, hy, fem } = K, under = o.under ?? "stone", hair = o.hair ?? "hair";
  const lr = fem ? 0.9 : 1;
  legEach(img, K, under, 2.9 * lr, 2.5 * lr, 2.2 * lr, { foot: "leather", footW: fem ? 2.8 : 3.1 });
  const tw = fem ? pw([[18 + b, 4.2], [20 + b, 5.4], [23 + b, 6.1], [26 + b, 5.6], [30 + b, 4.5], [37 + b, 6.7]]) : pw([[18 + b, 4.6], [20 + b, 6.2], [23 + b, 6.9], [31 + b, 5.2], [37 + b, 6.1]]);
  lathe(img, 19 + b, 37 + b, K.tx, tw, under);
  if (fem && f) rowTint(img, 25 + b, 20, 31, (x, v) => P(under, Math.max(1, v.i - 1)));
  capsule(img, K.tx(15 + b), 15 + b, K.tx(19 + b), 19 + b, fem ? 1.7 : 2, fem ? 1.9 : 2.2, "skin", { bias: -0.3 });
  ell(img, hx, hy, fem ? 4.6 : 4.8, fem ? 5.4 : 5.5, f ? "skin" : hair);
  if (f) {
    ell(img, hx - 0.9, hy - 2.3, 5.6, 4.3, hair, { clip: (x, y) => y + 0.5 < hy - 1.5 || x + 0.5 < hx - 1.2 });
    img.set(hx + 1.6, hy - 1.5, P(hair, 3)); img.set(hx + 3.4, hy - 1.5, P(hair, 2));
    for (const ex of [hx + 1.2, hx + 3.7]) { img.set(ex, hy + 0.5, { hex: INK0 }); img.set(ex, hy + 1.5, { hex: INK0 }); }
    if (fem) { img.set(hx + 0.2, hy + 0.5, { hex: INK1 }); img.set(hx + 4.6, hy + 0.5, { hex: INK1 }); }
    img.set(hx + 3, hy + 3.6, fem ? P("crimson", 3) : P("skin", 1));
    img.set(hx + 5.1, hy + 2, P("skin", 3)); img.set(hx - 1.4, hy + 1, P("skin", 2));
    if (fem) capsule(img, hx - 3.6, hy - 1, hx - 4, hy + 6, 1.2, 1.1, hair);
  } else {
    ell(img, hx, hy - 0.6, 5.2, 5.6, hair);
    for (let y = hy - 3; y <= hy + 3; y += 2) img.set(hx - 1.5 * K.d, y, P(hair, 2));
  }
}
function drawLimbs(img, K) {
  const q = K.lr;
  for (const [s, e, h, bias] of ARMS(K)) {
    capsule(img, s[0], s[1], e[0], e[1], 2.2 * q, 2 * q, "skin", { bias });
    capsule(img, e[0], e[1], h[0], h[1], 2 * q, 1.7 * q, "skin", { bias });
    ell(img, h[0], h[1], 2 * q, 2 * q, "skin", { bias: bias + 0.1 });
  }
}
function drawHair(img, K, o = {}) {
  if (!K.fem) return;
  const { f, b, hx, hy, d } = K, hair = o.hair ?? "hair";
  if (f) { lathe(img, hy - 1, 31 + b, (y) => hx - 3.4 - (y - hy) * 0.12, pw([[hy - 1, 5.2], [hy + 5, 6.2], [hy + 14, 5.4], [31 + b, 3.4]]), hair, { bias: -0.1 }); for (let y = hy + 3; y < 30 + b; y++) img.set(hx - 6.8 - (y - hy) * 0.12, y, P(hair, 2)); }
  else {
    lathe(img, hy - 2, 32 + b, (y) => hx + (y - hy) * 0.06 * -d, pw([[hy - 2, 5.4], [hy + 8, 5.8], [32 + b, 3.6]]), hair);
    for (const x0 of [-2, 1.5]) for (let y = hy + 2; y < 31 + b; y++) img.set(hx + x0 + (y - hy) * 0.06 * -d, y, P(hair, 2));
  }
}

// ---------- the wardrobe: slot -> piece -> draw(img, rig) ----------
const GEAR = {
  legs: {
    greaves: { name: "Plate greaves", draw(img, K) {
      for (const [x0, x1, bias] of [[21.5, 21.1, 0], [27.5, 27.9, -0.22]]) {
        const xm = (x0 + x1) / 2;
        capsule(img, x0, 35, xm, 45.5, 3.6, 3.1, "steel", { bias });
        capsule(img, xm, 47, x1, 55.5, 3, 2.5, "steel", { bias });
        ell(img, xm, 46.6, 3, 2.1, "steel", { bias: bias + 0.2 });
      }
      ell(img, K.f ? 21.2 : 20.3, 58.4, 3.8, 2.1, "steel"); ell(img, K.f ? 29.6 : 28.3, 58.4, 3.9, 2.1, "steel", { bias: -0.2 });
    } },
    leggings: { name: "Leggings & tall boots", draw(img, K) {
      capsule(img, 21.5, 35, 21.1, 56, 3.1, 2.5, "leather"); capsule(img, 27.5, 35, 27.9, 56, 3.1, 2.5, "leather", { bias: -0.22 });
      capsule(img, 21.3, 46, 21.1, 57, 3, 2.7, "ink", { bias: 0.15 }); capsule(img, 27.7, 46, 27.9, 57, 3, 2.7, "ink", { bias: -0.1 });
      ell(img, K.f ? 21.1 : 20.4, 58.5, 3.4, 1.9, "ink"); ell(img, K.f ? 29.4 : 28.4, 58.5, 3.4, 1.9, "ink", { bias: -0.2 });
      rowTint(img, 46, 16, 33, (x, v) => v.r === "ink" && P("ink", 4));
    } },
    wraps: { name: "Wrapped trousers", draw(img, K) {
      capsule(img, 21.5, 35, 21.1, 56, 3.3, 2.4, "ink"); capsule(img, 27.5, 35, 27.9, 56, 3.3, 2.4, "ink", { bias: -0.22 });
      for (let y = 49; y <= 55; y += 2) rowTint(img, y, 17, 32, (x, v) => P("leather", x < 24 ? 3 : 2));
      ell(img, K.f ? 21.1 : 20.4, 58.5, 3.2, 1.8, "leather"); ell(img, K.f ? 29.3 : 28.4, 58.5, 3.2, 1.8, "leather", { bias: -0.2 });
    } },
  },
  chest: {
    plate: { name: "Plate cuirass", draw(img, K) {
      const { b, f } = K;
      lathe(img, 18.5 + b, 33 + b, K.tx, pw([[18.5 + b, 6], [21 + b, 8.4], [26 + b, 8], [31 + b, 5.6], [33 + b, 5.8]]), "steel");
      lathe(img, 33 + b, 41, K.tx, pw([[33 + b, 6.2], [41, 8]]), "steel", { bias: -0.05 });
      for (let y = 35 + b; y <= 41; y += 2) rowTint(img, y, 15, 34, (x, v) => v.r === "steel" && P("steel", Math.max(1, v.i - 1)));
      if (f) {
        poly(img, [[22.2, 24 + b], [27.4, 24 + b], [27.4, 47], [24.8, 50], [22.2, 47]], (x) => P("crimson", x < 24 ? 3 : 2));
        for (const [x, y, i] of [[24, 29, 4], [25, 29, 3], [24, 30, 3], [25, 30, 4], [24, 31, 2], [25, 31, 3], [23, 28, 4], [26, 28, 3]]) img.set(x, y + b, P("gold", i));
      } else for (let y = 20 + b; y < 32 + b; y++) img.set(24.5, y, P("steel", 2));
      rowTint(img, 33 + b, 16, 33, (x) => P("leather", x < 23 ? 3 : 2));
      if (f) { img.set(24, 33 + b, P("gold", 4)); img.set(25, 33 + b, P("gold", 3)); }
    } },
    chain: { name: "Hauberk & surcoat", draw(img, K) {
      const { b, f } = K;
      lathe(img, 18.5 + b, 45, K.tx, pw([[18.5 + b, 5.8], [21 + b, 7.2], [31 + b, 6], [37, 6.8], [45, 8.4]]), "steel");
      for (let y = 18 + b; y < 46; y++) rowTint(img, y, 14, 35, (x, v) => (x + y * 2) % 3 === 0 && P("steel", Math.max(1, v.i - 1)));
      lathe(img, 20 + b, 47, K.tx, pw([[20 + b, 3.4], [33 + b, 3], [47, 4.2]]), "teal", { bias: 0.1 });
      rowTint(img, 46, 18, 31, (x, v) => v.r === "teal" && P("ivory", x < 24 ? 4 : 3));
      rowTint(img, 33 + b, 17, 32, (x) => P("gold", x < 23 ? 3 : 2));
    } },
    jerkin: { name: "Tunic & leather vest", draw(img, K) {
      const { b, f } = K;
      lathe(img, 18.5 + b, 42, K.tx, pw([[18.5 + b, 5.6], [21 + b, 6.9], [31 + b, 5.4], [36, 6.2], [42, 6.9]]), "forest");
      lathe(img, 20 + b, 35 + b, K.tx, pw([[20 + b, 6.4], [31 + b, 5.2], [35 + b, 5.6]]), "leather", { clip: f ? (x) => x < 24 || x > 25 : null });
      if (f) for (let y = 22 + b; y < 33 + b; y += 2) { img.set(24, y, P("sand", 4)); img.set(25, y + 1, P("sand", 3)); }
      rowTint(img, 34 + b, 17, 32, (x) => P("leather", 1));
      if (f) img.set(26, 34 + b, P("gold", 4));
    } },
    garb: { name: "Shadow garb & sash", draw(img, K) {
      const { b, f } = K;
      lathe(img, 18.5 + b, 38, K.tx, pw([[18.5 + b, 5.2], [21 + b, 6.2], [31 + b, 4.8], [38, 5.6]]), "ink", { bias: 0.15 });
      capsule(img, 19.5, 22 + b, 29.5, 33 + b, 1.4, 1.4, "crimson");
      poly(img, [[20, 36], [24.5, 36], [21.5, 49], [17.5, 47]], (x) => P("teal", x < 21 ? 3 : 2));
      ell(img, f ? 29.5 : 19.5, 35.5, 2.2, 1.8, "leather");
    } },
    robe: { name: "Long robe", draw(img, K) {
      const { b, f } = K;
      lathe(img, 18.5 + b, 60, K.tx, pw([[18.5 + b, 5.4], [21 + b, 6.6], [30 + b, 6], [36, 7.4], [60, 13.5]]), "royal");
      if (f) for (let y = 34; y < 59; y++) { const x = 25.5 + (y - 34) * 0.06; img.set(x, y, P("royal", 1)); img.set(x + 1, y, P("arcane", 3)); }
      else for (const x0 of [21, 28]) for (let y = 38; y < 59; y++) img.set(x0 + (x0 < 24 ? -1 : 1) * (y - 38) * 0.18, y, P("royal", 1));
      rowTint(img, 58, 9, 40, (x) => P("gold", x < 22 ? 4 : 3)); rowTint(img, 59, 9, 40, () => P("gold", 2));
      rowTint(img, 31 + b, 17, 32, (x) => P("arcane", x < 23 ? 3 : 2));
    } },
    gown: { name: "Tiered gown & stole", draw(img, K) {
      const { b, f } = K;
      lathe(img, 18.5 + b, 60, K.tx, pw([[18.5 + b, 5.3], [21 + b, 6.4], [30 + b, 5.4], [38, 8], [60, 14.5]]), "ivory");
      lathe(img, 34, 52, K.tx, pw([[34, 6.6], [52, 12]]), "ivory", { bias: 0.15 });
      rowTint(img, 51, 11, 38, (x, v) => P("gold", x < 22 ? 4 : 3)); rowTint(img, 59, 9, 40, () => P("gold", 2));
      if (f) { capsule(img, 22.4, 20 + b, 21.8, 56, 1.3, 1.4, "royal"); capsule(img, 27.2, 20 + b, 27.8, 56, 1.3, 1.4, "royal", { bias: -0.2 }); for (const x of [21.8, 27.8]) { img.set(x, 55, P("gold", 4)); img.set(x, 56, P("gold", 3)); } }
      else lathe(img, 21 + b, 50, K.tx, 2.2, "royal");
    } },
    tunic: { name: "Plain tunic", draw(img, K) {
      const { b } = K;
      lathe(img, 18.5 + b, 41, K.tx, pw([[18.5 + b, 5.6], [21 + b, 6.8], [31 + b, 5.6], [41, 7]]), "sand");
      rowTint(img, 33 + b, 17, 32, () => P("leather", 2));
    } },
  },
  arms: {
    gauntlets: { name: "Vambraces & gauntlets", draw(img, K) {
      for (const [s, e, h, bias] of ARMS(K)) {
        capsule(img, s[0], s[1], e[0], e[1], 2.7, 2.5, "steel", { bias });
        capsule(img, e[0], e[1] + 0.5, h[0], h[1] - 0.5, 2.7, 2.4, "steel", { bias });
        ell(img, e[0], e[1], 2.5, 2.1, "steel", { bias: bias + 0.2 });
        ell(img, h[0], h[1] + 0.2, 2.4, 2.3, "steel", { bias: bias - 0.05 });
      }
    } },
    bracers: { name: "Leather bracers", draw(img, K) {
      for (const [s, e, h, bias] of ARMS(K)) capsule(img, e[0], e[1] + 1.5, h[0], h[1] - 1.6, 2.4, 2.2, "leather", { bias });
    } },
    bell: { name: "Bell sleeves", draw(img, K) {
      for (const [s, e, h, bias] of ARMS(K)) {
        capsule(img, s[0], s[1], e[0], e[1], 2.7, 2.7, "royal", { bias });
        lathe(img, e[1] - 1, h[1] - 0.5, (y) => e[0] + ((h[0] - e[0]) * (y - e[1])) / (h[1] - e[1]), (y) => 2.7 + (2.3 * (y - e[1])) / (h[1] - e[1]), "royal", { bias });
        rowTint(img, Math.floor(h[1] - 1), h[0] - 6, h[0] + 6, () => P("gold", 3));
      }
    } },
    sleeves: { name: "Long sleeves", draw(img, K) {
      for (const [s, e, h, bias] of ARMS(K)) {
        capsule(img, s[0], s[1], e[0], e[1], 2.5, 2.4, "ivory", { bias });
        capsule(img, e[0], e[1], h[0], h[1] - 1.4, 2.4, 2.6, "ivory", { bias });
        rowTint(img, Math.floor(h[1] - 1.6), h[0] - 4, h[0] + 4, () => P("gold", 3));
      }
    } },
  },
  shoulders: {
    pauldrons: { name: "Great pauldrons", draw(img, K) {
      const { b } = K;
      lathe(img, 16.5 + b, 20.5 + b, K.tx, 4.8, "steel", { bias: 0.1 });
      for (const [cx, bias, dir] of [[K.shL[0] - 3.6, 0, -1], [K.shR[0] + 3.6, -0.3, 1]]) {
        ell(img, cx + dir * 0.6, 26 + b, 6.2, 2.9, "steel", { bias: bias - 0.1 });
        ell(img, cx + dir * 0.3, 23.6 + b, 6.8, 3, "steel", { bias: bias - 0.05 });
        ell(img, cx, 20.4 + b, 7.6, 5.3, "gold", { bias });
        ell(img, cx, 19.9 + b, 6.8, 4.6, "steel", { bias });
        capsule(img, cx - dir * 4.2, 14.8 + b, cx - dir * 4.6, 18 + b, 1.3, 1.5, "steel", { bias: bias + 0.2 });
      }
    } },
    spaulders: { name: "Spiked spaulders", draw(img, K) {
      const { b } = K;
      for (const [cx, bias, dir] of [[K.shL[0] - 1.8, 0, -1], [K.shR[0] + 1.8, -0.3, 1]]) {
        poly(img, [[cx - 2.2, 20 + b], [cx + dir * 1.8, 11.5 + b], [cx + 2.2, 20 + b]], (x) => P("ivory", x < cx ? 4 : 2));
        ell(img, cx, 21.6 + b, 4.6, 3.6, "teal", { bias });
      }
    } },
    mantle: { name: "Capelet mantle", draw(img, K) {
      const { b, f } = K;
      lathe(img, 17 + b, 27 + b, K.tx, pw([[17 + b, 4.8], [27 + b, 9.8]]), "ivory", { bias: 0.12 });
      rowTint(img, 26 + b, 13, 36, (x) => P("gold", x < 23 ? 4 : 3));
      if (f) { img.set(24.8, 19.5 + b, P("royal", 3)); img.set(24.8, 20.5 + b, P("royal", 2)); }
    } },
    collar: { name: "High collar", draw(img, K) {
      const { b, f } = K;
      lathe(img, 17 + b, 21.5 + b, K.tx, pw([[17 + b, 5], [21.5 + b, 7.2]]), "arcane", { clip: f ? (x, y) => !(x >= 24 && x <= 27 && y > 17 + b) : null });
      rowTint(img, 17 + b, 18, 31, () => P("gold", 3));
    } },
  },
  head: {
    greathelm: { name: "Crested great helm", draw(img, K) {
      const { hx, hy, f, d } = K;
      lathe(img, hy - 7, hy + 6, hx - 0.2, pw([[hy - 7, 3.8], [hy - 5.5, 5.6], [hy + 6, 5.6]]), "steel");
      if (f) {
        for (let x = hx - 0.5; x <= hx + 5.4; x++) img.set(x, hy + 0.5, { hex: INK0 });
        for (const x of [hx + 2, hx + 4]) for (const y of [hy + 3, hy + 4.2]) img.set(x, y, { hex: INK1 });
        for (let y = hy - 6; y <= hy + 5; y++) if (Math.round(y) !== Math.round(hy + 0.5)) img.set(hx + 1.6, y, P("steel", 4));
      }
      const pts = [[0, -6.5], [-0.6, -10.5], [-3, -13], [-6.5, -13.2], [-9.5, -11], [-11, -7]];
      for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; capsule(img, hx + ax * d, hy + ay, hx + bx * d, hy + by, 2.2 - i * 0.22, 2.2 - (i + 1) * 0.22, "crimson", { bias: 0.1 }); }
      for (let i = 1; i < 5; i++) img.set(hx + (pts[i][0] - 0.5) * d, hy + pts[i][1] - 1.2, P("crimson", 4));
    } },
    wizhat: { name: "Wide-brim hat", draw(img, K) {
      const { hx, hy, d } = K;
      ell(img, hx - 0.3, hy - 3.4, 10.5, 2.6, "arcane", { bias: -0.1 });
      poly(img, [[hx - 5, hy - 4.2], [hx + 4.6, hy - 4.2], [hx + 2.2 * d, hy - 12], [hx + 7.5 * d, hy - 19], [hx - 1 * d, hy - 13]], (x) => P("arcane", x < hx - 1.5 ? 4 : x < hx + 2 ? 3 : 2));
      for (const y of [hy - 5.5, hy - 6.5]) rowTint(img, y, hx - 6, hx + 6, (x, v) => v.r === "arcane" && P("gold", x < hx ? 4 : 3));
      img.set(hx + 7.5 * d, hy - 19, P("gold", 4));
    } },
    mitre: { name: "Mitre & veil", draw(img, K) {
      const { hx, hy, f } = K;
      lathe(img, hy - 3, hy + 9, hx - 0.8, pw([[hy - 3, 5.3], [hy + 9, 7]]), "ivory", { clip: f ? (x, y) => x + 0.5 < hx - 0.6 || y + 0.5 < hy - 1.4 : null });
      poly(img, [[hx - 4.4, hy - 2.5], [hx + 4.2, hy - 2.5], [hx + 3.4, hy - 10], [hx - 0.1, hy - 14.5], [hx - 3.6, hy - 10]], (x) => P("ivory", x < hx - 1 ? 4 : x < hx + 2 ? 3 : 2));
      for (const y of [hy - 3.5, hy - 2.5]) rowTint(img, y, hx - 5, hx + 5, (x, v) => v.r === "ivory" && P("gold", x < hx ? 4 : 3));
      for (let y = hy - 13; y < hy - 3; y++) img.set(hx - 0.1, y, P("gold", 3));
      img.set(hx - 0.1, hy - 8, P("royal", 3));
    } },
    hood: { name: "Ranger hood", draw(img, K) {
      const { hx, hy, f } = K;
      const open = f ? (x, y) => !(x + 0.5 > hx - 1.6 && y + 0.5 > hy - 2.6 && y + 0.5 < hy + 5.4) : null;
      ell(img, hx - 0.6, hy - 0.4, 6.2, 6.6, "forest", { clip: open });
      poly(img, [[hx - 4, hy - 5], [hx - 10.5, hy - 1.5], [hx - 5.5, hy + 1]], (x) => P("forest", 2));
      lathe(img, hy + 4, hy + 10, hx - 0.3, pw([[hy + 4, 5.4], [hy + 10, 8]]), "forest", { bias: 0.05, clip: f ? (x, y) => !(x + 0.5 > hx - 0.5 && y + 0.5 < hy + 6.5) : null });
    } },
    cowl: { name: "Cowl & mask", draw(img, K) {
      const { hx, hy, f } = K;
      const open = f ? (x, y) => !(x + 0.5 > hx - 1.6 && y + 0.5 > hy - 2.4 && y + 0.5 < hy + 2) : null;
      ell(img, hx - 0.5, hy - 0.2, 5.9, 6.4, "teal", { clip: open });
      if (f) for (let y = hy + 2; y < hy + 6; y++) for (let x = hx - 1.6; x <= hx + 5.4; x++) img.set(x, y, P("crimson", y < hy + 3 ? 4 : x < hx + 2 ? 3 : 2));
      lathe(img, hy + 5, hy + 8.5, hx - 0.3, pw([[hy + 5, 4.6], [hy + 8.5, 5.8]]), "crimson");
    } },
    winghelm: { name: "Winged spire helm", draw(img, K) {
      const { hx, hy, f } = K;
      lathe(img, hy - 6.5, hy + 5, hx - 0.2, pw([[hy - 6.5, 3.8], [hy - 4.5, 5.5], [hy + 5, 5.4]]), "teal", { clip: f ? (x, y) => !(x + 0.5 > hx + 0.2 && y + 0.5 > hy - 1 && y + 0.5 < hy + 4.8) : null });
      rowTint(img, hy - 2, hx - 6, hx + 6, (x, v) => v.r === "teal" && P("gold", x < hx ? 4 : 3));
      poly(img, [[hx - 2.2, hy - 5.5], [hx - 0.4, hy - 18.5], [hx + 1.6, hy - 5.5]], (x) => P("ivory", x < hx - 0.4 ? 4 : 3));
      poly(img, [[hx - 4, hy - 2.5], [hx - 11, hy - 11.5], [hx - 8, hy - 9], [hx - 5.5, hy + 0.5]], () => P("ivory", 4));
      poly(img, [[hx + 4.5, hy - 2.5], [hx + 10.5, hy - 10.5], [hx + 7.8, hy - 8.5], [hx + 5.6, hy + 0.5]], () => P("ivory", 2));
    } },
  },
  main: {
    sword: { name: "Longsword", draw(img, K) {
      const [x, y] = K.hdR, gx = x + 0.6, gy = y - 2.6;
      thick(img, gx, gy, x + 3.8, y - 31, P("steel", 4), P("steel", 2));
      for (let i = -4; i <= 4; i++) img.set(gx + i, gy + 0.5, P("gold", i < 0 ? 4 : 2));
      img.set(x, y + 3.2, P("gold", 3)); img.set(x + 1, y + 3.2, P("gold", 2));
    } },
    staff: { name: "Orb staff", draw(img, K) {
      const [x, y] = K.hdR;
      thick(img, x + 0.6, 59.5, x + 2.2, 3, P("leather", 3), P("leather", 2), (px, py) => nearHand(K, px, py));
      ell(img, x + 2.6, 0.4, 3.1, 3.1, "teal", { bias: 0.2 });
      img.set(x + 1.6, -0.6, { hex: "#ffffff" });
      for (const [dx, dy] of [[-0.8, 3], [3.8, 3], [-1.6, 1.6], [4.6, 1.6]]) img.set(x + 1.4 + dx, dy, P("gold", 3));
    } },
    sceptre: { name: "Sun sceptre", draw(img, K) {
      const [x, y] = K.hdR;
      thick(img, x + 0.4, y + 5, x + 1.6, y - 15, P("gold", 3), P("gold", 2), (px, py) => nearHand(K, px, py));
      const cx = x + 1.9, cy = y - 18;
      ell(img, cx, cy, 3, 3, "gold", { bias: 0.25 });
      for (let a = 0; a < 8; a++) img.set(cx + Math.cos((a * Math.PI) / 4) * 4.6, cy + Math.sin((a * Math.PI) / 4) * 4.6, P("gold", 4));
      img.set(cx, cy, P("royal", 3));
    } },
    dagger: { name: "Reverse dagger", draw(img, K) {
      const [x, y] = K.hdR;
      thick(img, x + 1, y + 1.6, x + 4.6, y + 7.5, P("steel", 4), P("steel", 2));
      img.set(x + 0.4, y + 1.2, P("gold", 3));
    } },
    spear: { name: "Dragoon spear", draw(img, K) {
      const [x, y] = K.hdR, tx = x + 3.4;
      thick(img, x + 1.1, 60, tx, -2, P("leather", 3), P("leather", 2), (px, py) => nearHand(K, px, py));
      poly(img, [[tx + 0.5, -10.5], [tx + 2.6, -2.5], [tx + 0.5, 0.5], [tx - 1.6, -2.5]], (px) => P("steel", px < tx + 0.5 ? 4 : 2));
      for (const [dx, dy] of [[0, 1], [-1, 2], [0, 3], [-1, 4]]) img.set(tx + dx, dy, P("crimson", 3));
    } },
  },
  off: {
    shield: { name: "Kite shield", draw(img, K) {
      const [x, y] = K.hdL, T = y - 10.5, B = y + 12;
      poly(img, [[x - 6, T], [x + 4.4, T], [x + 3.6, T + 6], [x - 0.8, B], [x - 5.2, T + 6]], (px) => P("steel", px < x - 4 ? 4 : px < x + 2 ? 3 : 2));
      poly(img, [[x - 4.7, T + 1.3], [x + 3.1, T + 1.3], [x + 2.4, T + 6], [x - 0.8, B - 2.6], [x - 4, T + 6]], (px) => P("crimson", px < x - 2 ? 3 : 2));
      for (let yy = T + 2.5; yy < B - 3; yy++) img.set(x - 0.9, yy, P("gold", 4));
      for (let xx = x - 4; xx <= x + 2.2; xx++) img.set(xx, T + 5.5, P("gold", xx < x - 1 ? 4 : 3));
    } },
    bow: { name: "Longbow", draw(img, K) {
      const [x, y] = K.hdL;
      for (let t = -1; t <= 1.0001; t += 0.02) { const yy = y + t * 22, xx = x - 0.6 + 3.2 * (1 - Math.cos(t * 1.45)); img.set(xx, yy, P("leather", t < 0 ? 4 : 3)); img.set(xx - 1, yy, P("leather", 2)); }
      for (let yy = y - 21; yy <= y + 21; yy++) if (Math.abs(yy - y) > 2) img.set(x + 2.9, yy, { hex: R.ivory[3] });
    } },
    dagger: { name: "Off-hand dagger", draw(img, K) {
      const [x, y] = K.hdL;
      thick(img, x - 1, y + 1.6, x - 4.6, y + 7.5, P("steel", 4), P("steel", 3));
    } },
  },
  back: {
    cape: { name: "Long cape", draw(img, K) {
      const { b, f } = K;
      lathe(img, 19 + b, 56, K.tx, f ? pw([[19 + b, 6.4], [56, 7]]) : pw([[19 + b, 7.2], [30 + b, 8.4], [56, 9.6]]), "crimson", { bias: f ? -0.3 : 0 });
      if (!f) for (const x0 of [21, 24.5, 28]) for (let y = 30; y < 55; y++) img.set(x0 + (x0 - 24.5) * (y - 30) * 0.02, y, P("crimson", 1));
      rowTint(img, 55, 12, 37, () => P("crimson", 1));
    } },
    quiver: { name: "Quiver", draw(img, K) {
      const { b, f } = K;
      if (f) {
        poly(img, [[29.5, 11 + b], [33.5, 10 + b], [35.5, 22 + b], [31.5, 23 + b]], (x) => P("leather", x < 32 ? 3 : 2));
        for (const [x, i] of [[30, 4], [31, 3], [32, 4], [33, 3]]) { img.set(x, 9 + b, P("ivory", i)); img.set(x + 0.5, 8 + b, P("crimson", i)); }
      } else {
        poly(img, [[20, 17 + b], [24, 15.5 + b], [31, 34 + b], [27, 35.5 + b]], (x) => P("leather", x < 25 ? 3 : 2));
        for (const [x, i] of [[19.5, 4], [20.5, 3], [21.5, 4], [22.5, 3]]) { img.set(x, 15 + b - (x - 19.5) * 0.4, P("ivory", i)); img.set(x, 14 + b - (x - 19.5) * 0.4, P("crimson", i)); }
      }
    } },
    scarf: { name: "Trailing scarf", mirrorBack: true, draw(img, K) {
      const { b } = K;
      poly(img, [[21, 18 + b], [17, 19 + b], [9, 27 + b], [3.5, 37], [6.5, 38], [12, 30 + b], [20, 22.5 + b]], (x) => P("crimson", x < 10 ? 4 : x < 16 ? 3 : 2));
      poly(img, [[19, 21 + b], [13, 30], [10, 41], [13, 41.5], [15.5, 32]], (x) => P("crimson", x < 13 ? 3 : 2));
    } },
    cloak: { name: "Short cloak", draw(img, K) {
      const { b, f } = K;
      lathe(img, 19 + b, 48, K.tx, pw([[19 + b, 7], [48, 8.6]]), "teal", { bias: f ? -0.3 : 0 });
      rowTint(img, 47, 14, 35, () => P("ivory", 3));
      if (!f) for (let y = 26; y < 47; y++) img.set(24.5, y, P("teal", 1));
    } },
  },
};
// ---------- tier pieces (leather / chain / plate and the other classes' equivalents) ----------
const ringTex = (img, y0, y1, r) => { for (let y = Math.floor(y0); y < y1; y++) rowTint(img, y, 8, 41, (x, v) => v.r === r && (x + y * 2) % 3 === 0 && P(r, Math.max(1, v.i - 1))); };
const scaleTex = (img, y0, y1, r) => { for (let y = Math.floor(y0); y < y1; y += 2) rowTint(img, y, 8, 41, (x, v) => v.r === r && (x + (y % 4 === 0 ? 0 : 1)) % 2 === 0 && P(r, Math.max(1, v.i - 1))); };
const faceOpen = (K, top = -2.6, bot = 5.4) => (K.f ? (x, y) => !(x + 0.5 > K.hx - 1.6 && y + 0.5 > K.hy + top && y + 0.5 < K.hy + bot) : null);

Object.assign(GEAR.head, {
  leathercap: { name: "Leather cap", draw(img, K) {
    const { hx, hy } = K;
    ell(img, hx - 0.5, hy - 2.4, 5.8, 4.4, "leather", { clip: (x, y) => y + 0.5 < hy - 0.8 || x + 0.5 < hx - 3 });
    rowTint(img, hy - 1, hx - 6, hx + 6, (x, v) => v.r === "leather" && P("leather", 4));
  } },
  coif: { name: "Mail coif & nasal helm", draw(img, K) {
    const { hx, hy, f } = K;
    ell(img, hx - 0.5, hy - 0.3, 6, 6.5, "steel", { clip: faceOpen(K, -2.2, 5) });
    lathe(img, hy + 4.5, hy + 9.5, hx - 0.3, pw([[hy + 4.5, 5.2], [hy + 9.5, 7.4]]), "steel", { clip: f ? (x, y) => !(x + 0.5 > hx - 1 && y + 0.5 < hy + 5.5) : null });
    ringTex(img, hy - 7, hy + 10, "steel");
    ell(img, hx - 0.3, hy - 3, 5.8, 3.9, "steel", { clip: (x, y) => y + 0.5 < hy - 2, bias: 0.2 });
    if (f) for (let y = hy - 2; y <= hy + 2; y++) img.set(hx + 2, y, P("steel", 4));
  } },
  cap: { name: "Apprentice cap", draw(img, K) {
    const { hx, hy, d } = K;
    ell(img, hx - 0.5, hy - 3, 5.8, 3.6, "royal", { clip: (x, y) => y + 0.5 < hy - 1.4 });
    poly(img, [[hx - 3 * d, hy - 5.5], [hx - 9 * d, hy - 3], [hx - 7 * d, hy + 0.5], [hx - 3.5 * d, hy - 2]], () => P("royal", 2));
    img.set(hx - 0.5, hy - 6.6, P("gold", 4));
  } },
  magehood: { name: "Pointed hood", draw(img, K) {
    const { hx, hy, f } = K;
    ell(img, hx - 0.6, hy - 0.4, 6.2, 6.6, "royal", { clip: faceOpen(K) });
    poly(img, [[hx - 4.5, hy - 4], [hx - 3, hy - 13], [hx + 2.4, hy - 5]], (x) => P("royal", x < hx - 2 ? 4 : 3));
    lathe(img, hy + 4, hy + 10, hx - 0.3, pw([[hy + 4, 5.4], [hy + 10, 8]]), "royal", { bias: 0.05, clip: f ? (x, y) => !(x + 0.5 > hx - 0.5 && y + 0.5 < hy + 6.5) : null });
    rowTint(img, hy + 9, hx - 9, hx + 9, () => P("arcane", 3));
  } },
  veil: { name: "Veil & circlet", draw(img, K) {
    const { hx, hy, f } = K;
    lathe(img, hy - 5, hy + 9, hx - 0.6, pw([[hy - 5, 4.2], [hy - 3, 5.4], [hy + 9, 7]]), "ivory", { clip: f ? (x, y) => x + 0.5 < hx - 1 || y + 0.5 < hy - 2.4 : null });
    rowTint(img, hy - 3, hx - 6, hx + 6, (x, v) => v.r === "ivory" && P("gold", x < hx ? 4 : 3));
    if (f) img.set(hx + 1.5, hy - 3, P("royal", 3));
  } },
  huntercap: { name: "Feathered cap", draw(img, K) {
    const { hx, hy, d } = K;
    ell(img, hx - 0.5, hy - 2.6, 5.8, 4.2, "forest", { clip: (x, y) => y + 0.5 < hy - 1 || x + 0.5 < hx - 3.5 });
    rowTint(img, hy - 1.5, hx - 7, hx + 6, (x, v) => v.r === "forest" && P("forest", 4));
    thick(img, hx - 2 * d, hy - 4, hx - 8 * d, hy - 11, P("crimson", 4), P("crimson", 2));
  } },
  falconhelm: { name: "Winged open helm", draw(img, K) {
    const { hx, hy } = K;
    lathe(img, hy - 6.5, hy + 4, hx - 0.2, pw([[hy - 6.5, 3.6], [hy - 4.5, 5.4], [hy + 4, 5.3]]), "steel", { clip: faceOpen(K, -1.6, 4.6) });
    rowTint(img, hy - 2.5, hx - 6, hx + 6, (x, v) => v.r === "steel" && P("gold", x < hx ? 4 : 3));
    poly(img, [[hx - 4, hy - 3], [hx - 11, hy - 9.5], [hx - 9.5, hy - 5], [hx - 6, hy - 0.5]], (x) => P("forest", x < hx - 8 ? 4 : 3));
    poly(img, [[hx + 4.5, hy - 3], [hx + 10, hy - 8.5], [hx + 8.6, hy - 4.2], [hx + 5.6, hy - 0.5]], () => P("forest", 2));
  } },
  bandana: { name: "Bandana", draw(img, K) {
    const { hx, hy, d } = K;
    ell(img, hx - 0.4, hy - 2.4, 5.8, 4.2, "crimson", { clip: (x, y) => y + 0.5 < hy - 0.6 || x + 0.5 < hx - 3 });
    poly(img, [[hx - 5 * d, hy - 2], [hx - 10 * d, hy + 1], [hx - 8.5 * d, hy + 3.5], [hx - 5 * d, hy + 0.5]], () => P("crimson", 2));
  } },
  shadowmask: { name: "Demon mask & hood", draw(img, K) {
    const { hx, hy, f } = K;
    ell(img, hx - 0.5, hy - 0.2, 6.1, 6.6, "ink", { bias: 0.15 });
    lathe(img, hy + 5, hy + 10, hx - 0.3, pw([[hy + 5, 5], [hy + 10, 7.6]]), "ink", { bias: 0.15 });
    poly(img, [[hx - 4, hy - 5], [hx - 6.5, hy - 10], [hx - 2.4, hy - 6]], () => P("ink", 4));
    poly(img, [[hx + 2.6, hy - 5.5], [hx + 4.6, hy - 10.5], [hx + 4.8, hy - 5]], () => P("ink", 3));
    if (f) {
      for (let y = hy - 2; y < hy + 5; y++) for (let x = hx - 1.2; x <= hx + 5.4; x++) img.set(x, y, P("ivory", y < hy ? 4 : x < hx + 2.5 ? 3 : 2));
      for (const ex of [hx + 0.4, hx + 3.2]) { img.set(ex, hy + 0.5, P("crimson", 4)); img.set(ex, hy + 1.5, P("crimson", 3)); }
      for (let x = hx; x <= hx + 4; x++) img.set(x, hy + 3.5, P("ink", 1));
    }
  } },
  kettle: { name: "Kettle hat", draw(img, K) {
    const { hx, hy } = K;
    ell(img, hx - 0.2, hy - 2, 8.6, 2.2, "steel", { bias: -0.1 });
    ell(img, hx - 0.2, hy - 4, 5.2, 3.8, "steel", { clip: (x, y) => y + 0.5 < hy - 2.2, bias: 0.15 });
    rowTint(img, hy - 2.6, hx - 6, hx + 6, (x, v) => v.r === "steel" && P("leather", 2));
  } },
});
Object.assign(GEAR.shoulders, {
  leatherpads: { name: "Leather pads", draw(img, K) {
    for (const [cx, bias] of [[K.shL[0] - 1.6, 0], [K.shR[0] + 1.6, -0.3]]) { ell(img, cx, 21.4 + K.b, 4.4, 3.1, "leather", { bias }); rowTint(img, Math.round(22.6 + K.b), cx - 4, cx + 4, () => P("leather", 1)); }
  } },
  darkpads: { name: "Lacquered pads", draw(img, K) {
    for (const [cx, bias] of [[K.shL[0] - 1.8, 0], [K.shR[0] + 1.8, -0.3]]) { ell(img, cx, 21.2 + K.b, 4.8, 3.2, "ink", { bias: bias + 0.2 }); rowTint(img, Math.round(23.2 + K.b), cx - 5, cx + 5, () => P("crimson", 3)); }
  } },
  halfpauldrons: { name: "Half pauldrons", draw(img, K) {
    const { b } = K;
    for (const [cx, bias, dir] of [[K.shL[0] - 2.6, 0, -1], [K.shR[0] + 2.6, -0.3, 1]]) {
      ell(img, cx + dir * 0.4, 24.4 + b, 5, 2.4, "steel", { bias: bias - 0.1 });
      ell(img, cx, 21 + b, 5.6, 4, "steel", { bias });
    }
  } },
});
function chainShirt(sur) {
  return (img, K) => {
    const { b } = K;
    lathe(img, 18.5 + b, 45, K.tx, pw([[18.5 + b, 5.8], [21 + b, 7.2], [31 + b, 6], [37, 6.8], [45, 8.4]]), "steel");
    ringTex(img, 18 + b, 46, "steel");
    lathe(img, 20 + b, 47, K.tx, pw([[20 + b, 3.6], [33 + b, 3.2], [47, 4.4]]), sur, { bias: 0.1 });
    rowTint(img, 33 + b, 17, 32, (x) => P("leather", x < 23 ? 3 : 2));
    if (K.f) { img.set(24, 27 + b, P("gold", 4)); img.set(25, 27 + b, P("gold", 3)); img.set(24.5, 26 + b, P("gold", 4)); img.set(24.5, 28 + b, P("gold", 2)); }
  };
}
Object.assign(GEAR.chest, {
  leatherarmor: { name: "Studded leather", draw(img, K) {
    const { b } = K;
    lathe(img, 18.5 + b, 41, K.tx, pw([[18.5 + b, 6], [21 + b, 7.4], [31 + b, 5.8], [36, 6.4], [41, 7.4]]), "leather");
    for (let y = 23 + b; y <= 31 + b; y += 3) for (let x = 19; x <= 30; x += 3) if (img.get(x, y)) img.set(x, y, P("gold", 3));
    for (let x = 18; x <= 31; x += 3) for (let y = 35; y < 41; y++) if (img.get(x, y)) img.set(x, y, P("leather", 1));
    rowTint(img, 33 + b, 17, 32, () => P("ink", 3));
  } },
  chainK: { name: "Hauberk & tabard", draw: chainShirt("crimson") },
  shortrobe: { name: "Short robe", draw(img, K) {
    const { b, f } = K;
    lathe(img, 18.5 + b, 47, K.tx, pw([[18.5 + b, 5.4], [21 + b, 6.4], [30 + b, 5.8], [47, 8.6]]), "royal");
    rowTint(img, 46, 12, 37, (x) => P("gold", x < 22 ? 3 : 2));
    rowTint(img, 31 + b, 17, 32, () => P("leather", 2));
    if (f) for (let y = 38; y < 46; y++) img.set(25.5, y, P("royal", 1));
  } },
  simplerobe: { name: "Adept robe", draw(img, K) {
    const { b, f } = K;
    lathe(img, 18.5 + b, 60, K.tx, pw([[18.5 + b, 5.4], [21 + b, 6.4], [30 + b, 5.8], [36, 6.8], [60, 12.6]]), "royal", { bias: -0.05 });
    rowTint(img, 59, 9, 40, () => P("arcane", 3));
    rowTint(img, 31 + b, 17, 32, (x) => P("arcane", x < 23 ? 4 : 3));
    if (f) { img.set(22, 32 + b, P("arcane", 3)); img.set(22, 33 + b, P("arcane", 2)); img.set(21.8, 34 + b, P("arcane", 3)); }
  } },
  habit: { name: "Acolyte habit", draw(img, K) {
    const { b, f } = K;
    lathe(img, 18.5 + b, 60, K.tx, pw([[18.5 + b, 5.6], [21 + b, 6.6], [30 + b, 6], [60, 9.8]]), "sand", { bias: -0.05 });
    rowTint(img, 31 + b, 17, 32, () => P("ivory", 3));
    if (f) for (let y = 32 + b; y < 42; y++) img.set(22.5, y, P("ivory", y % 2 ? 3 : 4));
    rowTint(img, 59, 12, 37, () => P("sand", 1));
  } },
  vestment: { name: "Priest vestment", draw(img, K) {
    const { b, f } = K;
    lathe(img, 18.5 + b, 60, K.tx, pw([[18.5 + b, 5.3], [21 + b, 6.4], [30 + b, 5.4], [40, 7.6], [60, 12.8]]), "ivory");
    rowTint(img, 59, 9, 40, (x) => P("gold", x < 22 ? 3 : 2));
    if (f) for (let y = 22 + b; y < 59; y++) { img.set(24, y, P("royal", 3)); img.set(25, y, P("royal", 2)); }
    else for (let y = 22 + b; y < 59; y++) img.set(24.5, y, P("ivory", 2));
  } },
  brigandine: { name: "Brigandine", draw(img, K) {
    const { b } = K;
    lathe(img, 18.5 + b, 43, K.tx, pw([[18.5 + b, 5.6], [21 + b, 6.9], [31 + b, 5.4], [36, 6.2], [43, 7.4]]), "forest");
    lathe(img, 19.5 + b, 37, K.tx, pw([[19.5 + b, 6.8], [31 + b, 5.8], [37, 6.6]]), "leather", { bias: 0.05 });
    for (let y = 22 + b; y <= 35; y += 3) for (let x = 19; x <= 30; x += 2) if (img.get(x, y)?.r === "leather") img.set(x + ((y / 3) % 2), y, P("steel", 4));
    rowTint(img, 33 + b, 17, 32, () => P("ink", 3)); if (K.f) img.set(25, 33 + b, P("gold", 4));
  } },
  lamellar: { name: "Shadow lamellar", draw(img, K) {
    const { b, f } = K;
    lathe(img, 18.5 + b, 41, K.tx, pw([[18.5 + b, 5.4], [21 + b, 6.6], [31 + b, 5.2], [41, 6.6]]), "ink", { bias: 0.2 });
    scaleTex(img, 22 + b, 41, "ink");
    capsule(img, 19.5, 22 + b, 29.5, 33 + b, 1.4, 1.4, "crimson");
    poly(img, [[19.5, 37], [25, 37], [21.5, 53], [16.5, 51]], (x) => P("crimson", x < 20 ? 3 : 2));
    rowTint(img, 19 + b, 18, 31, () => P("crimson", 3));
  } },
  gambeson: { name: "Quilted gambeson", draw(img, K) {
    const { b } = K;
    lathe(img, 18.5 + b, 43, K.tx, pw([[18.5 + b, 6], [21 + b, 7.4], [31 + b, 6.4], [43, 7.8]]), "sand");
    for (let y = 21 + b; y < 43; y++) rowTint(img, y, 14, 35, (x, v) => (x % 3 === 0 || y % 4 === 0) && P("sand", Math.max(1, v.i - 1)));
    rowTint(img, 34 + b, 16, 33, () => P("leather", 2));
  } },
  scaleplate: { name: "Dragon scale & breastplate", draw(img, K) {
    const { b, f } = K;
    lathe(img, 18.5 + b, 47, K.tx, pw([[18.5 + b, 6], [21 + b, 7.4], [31 + b, 6], [37, 7], [47, 8.8]]), "teal");
    scaleTex(img, 20 + b, 47, "teal");
    lathe(img, 19 + b, 32 + b, K.tx, pw([[19 + b, 6.2], [22 + b, 7.8], [32 + b, 5.8]]), "steel", { bias: 0.05 });
    rowTint(img, 32 + b, 16, 33, (x) => P("gold", x < 23 ? 4 : 3));
    rowTint(img, 46, 14, 35, (x, v) => v.r === "teal" && P("ivory", 3));
    if (f) for (let y = 21 + b; y < 31 + b; y++) img.set(24.5, y, P("steel", 4));
  } },
  darktunic: { name: "Patched tunic", draw(img, K) {
    const { b } = K;
    lathe(img, 18.5 + b, 40, K.tx, pw([[18.5 + b, 5.4], [21 + b, 6.5], [31 + b, 5.4], [40, 6.8]]), "ink", { bias: 0.2 });
    for (const [x, y] of [[21, 26], [22, 26], [21, 27], [27, 34], [28, 34], [28, 35]]) img.set(x, y + (y < 30 ? b : 0), P("leather", 3));
    rowTint(img, 33 + b, 17, 32, () => P("leather", 2));
  } },
});
function sleevesP(r, cuff) {
  return (img, K) => {
    for (const [s, e, h, bias] of ARMS(K)) {
      capsule(img, s[0], s[1], e[0], e[1], 2.5, 2.4, r, { bias });
      capsule(img, e[0], e[1], h[0], h[1] - 1.4, 2.4, 2.6, r, { bias });
      if (cuff) rowTint(img, Math.floor(h[1] - 1.6), h[0] - 4, h[0] + 4, () => P(cuff, 3));
    }
  };
}
Object.assign(GEAR.arms, {
  mail: { name: "Mail sleeves", draw(img, K) {
    for (const [s, e, h, bias] of ARMS(K)) {
      capsule(img, s[0], s[1], e[0], e[1], 2.6, 2.4, "steel", { bias });
      capsule(img, e[0], e[1], h[0], h[1] - 1.2, 2.4, 2.4, "steel", { bias });
      ell(img, h[0], h[1] + 0.2, 2.2, 2.1, "leather", { bias });
    }
    ringTex(img, 18, 40, "steel");
  } },
  magesleeves: { name: "Straight sleeves", draw: sleevesP("royal", "arcane") },
  woolsleeves: { name: "Wool sleeves", draw: sleevesP("sand", null) },
});
Object.assign(GEAR.legs, {
  trousers: { name: "Cloth trousers", draw(img, K) {
    capsule(img, 21.5, 35, 21.1, 56, 3.1, 2.5, "sand"); capsule(img, 27.5, 35, 27.9, 56, 3.1, 2.5, "sand", { bias: -0.22 });
    capsule(img, 21.2, 52, 21.1, 57, 2.9, 2.7, "leather"); capsule(img, 27.8, 52, 27.9, 57, 2.9, 2.7, "leather", { bias: -0.15 });
    ell(img, K.f ? 21.1 : 20.4, 58.5, 3.3, 1.9, "leather"); ell(img, K.f ? 29.4 : 28.4, 58.5, 3.3, 1.9, "leather", { bias: -0.2 });
  } },
  chausses: { name: "Mail chausses", draw(img, K) {
    capsule(img, 21.5, 35, 21.1, 56, 3.3, 2.6, "steel"); capsule(img, 27.5, 35, 27.9, 56, 3.3, 2.6, "steel", { bias: -0.22 });
    ringTex(img, 35, 57, "steel");
    ell(img, 21.3, 46.5, 2.7, 1.9, "steel", { bias: 0.2 }); ell(img, 27.7, 46.5, 2.7, 1.9, "steel");
    ell(img, K.f ? 21.1 : 20.4, 58.5, 3.4, 1.9, "leather"); ell(img, K.f ? 29.4 : 28.4, 58.5, 3.4, 1.9, "leather", { bias: -0.2 });
  } },
});
Object.assign(GEAR.back, {
  wardencloak: { name: "Warden cloak", draw(img, K) {
    const { b, f } = K;
    lathe(img, 19 + b, 54, K.tx, f ? pw([[19 + b, 6.6], [54, 8]]) : pw([[19 + b, 7], [54, 9.6]]), "forest", { bias: f ? -0.3 : 0 });
    rowTint(img, 53, 12, 37, () => P("leather", 2));
    if (!f) for (const x0 of [22, 27]) for (let y = 28; y < 53; y++) img.set(x0, y, P("forest", 1));
  } },
  longscarf: { name: "Long scarf", mirrorBack: true, draw(img, K) {
    const { b } = K;
    poly(img, [[21, 18 + b], [17, 19 + b], [8, 28 + b], [1, 42], [2, 50], [5, 50], [6, 42], [12, 31 + b], [20, 22.5 + b]], (x) => P("crimson", x < 7 ? 4 : x < 14 ? 3 : 2));
    poly(img, [[19, 21 + b], [12, 31], [8, 46], [11, 47], [15, 33]], (x) => P("crimson", x < 12 ? 3 : 2));
  } },
  dragoncape: { name: "Dragon cape", draw(img, K) {
    const { b, f } = K;
    lathe(img, 19 + b, 58, K.tx, f ? pw([[19 + b, 6.6], [58, 8]]) : pw([[19 + b, 7.4], [58, 10.4]]), "teal", { bias: f ? -0.3 : 0 });
    rowTint(img, 57, 12, 37, (x) => P("ivory", x % 2 ? 3 : 2));
    if (!f) for (const x0 of [20.5, 24.5, 28.5]) for (let y = 30; y < 57; y++) img.set(x0, y, P("teal", 1));
  } },
});
Object.assign(GEAR.main, {
  rod: { name: "Apprentice rod", draw(img, K) {
    const [x, y] = K.hdR;
    thick(img, x + 0.4, y + 4, x + 1.4, y - 14, P("leather", 3), P("leather", 2), (px, py) => nearHand(K, px, py));
    ell(img, x + 1.6, y - 15.6, 1.8, 1.8, "arcane", { bias: 0.2 });
  } },
  mace: { name: "Flanged mace", draw(img, K) {
    const [x, y] = K.hdR;
    thick(img, x + 0.4, y + 4, x + 1.3, y - 10, P("leather", 3), P("leather", 2), (px, py) => nearHand(K, px, py));
    ell(img, x + 1.5, y - 12.5, 2.7, 2.8, "steel", { bias: 0.1 });
    for (const [dx, dy] of [[-2.6, 0], [2.8, 0], [0, -3]]) img.set(x + 1.5 + dx, y - 12.5 + dy, P("steel", 4));
  } },
  dragonspear: { name: "Dragon lance", draw(img, K) {
    const [x, y] = K.hdR, tx = x + 3.4;
    thick(img, x + 1.1, 60, tx, -1, P("teal", 3), P("teal", 2), (px, py) => nearHand(K, px, py));
    poly(img, [[tx + 0.5, -11.5], [tx + 3, -2], [tx + 0.5, 1.5], [tx - 2, -2]], (px) => P("steel", px < tx + 0.5 ? 4 : 2));
    poly(img, [[tx - 0.5, 1], [tx - 4.5, -1.5], [tx - 2.5, 3]], () => P("gold", 4));
    poly(img, [[tx + 1.5, 1], [tx + 5.5, -1.5], [tx + 3.5, 3]], () => P("gold", 2));
  } },
});
Object.assign(GEAR.off, {
  buckler: { name: "Buckler", draw(img, K) {
    const [x, y] = K.hdL;
    ell(img, x - 1.4, y - 0.5, 4.6, 4.8, "steel"); ell(img, x - 1.4, y - 0.5, 3.6, 3.8, "leather"); ell(img, x - 1.4, y - 0.5, 1.4, 1.4, "steel", { bias: 0.3 });
  } },
  shortbow: { name: "Short bow", draw(img, K) {
    const [x, y] = K.hdL;
    for (let t = -1; t <= 1.0001; t += 0.03) { const yy = y + t * 14, xx = x - 0.6 + 2.6 * (1 - Math.cos(t * 1.5)); img.set(xx, yy, P("leather", t < 0 ? 4 : 3)); img.set(xx - 1, yy, P("leather", 2)); }
    for (let yy = y - 13; yy <= y + 13; yy++) if (Math.abs(yy - y) > 2) img.set(x + 2.1, yy, { hex: R.ivory[3] });
  } },
  greatbow: { name: "Recurve greatbow", draw(img, K) {
    const [x, y] = K.hdL;
    for (let t = -1; t <= 1.0001; t += 0.015) {
      const a = Math.abs(t), yy = y + t * 23, xx = x - 0.6 + 3.8 * (1 - Math.cos(t * 1.5)) - (a > 0.82 ? (a - 0.82) * 22 : 0);
      img.set(xx, yy, a > 0.9 ? P("gold", 4) : P("forest", t < 0 ? 4 : 3)); img.set(xx - 1, yy, a > 0.9 ? P("gold", 2) : P("forest", 2));
    }
    for (let yy = y - 21; yy <= y + 21; yy++) if (Math.abs(yy - y) > 2) img.set(x + 3.4, yy, { hex: R.ivory[3] });
  } },
  tome: { name: "Prayer book", draw(img, K) {
    const [x, y] = K.hdL;
    poly(img, [[x - 4.5, y - 3], [x + 2.5, y - 4], [x + 2.5, y + 4], [x - 4.5, y + 5]], (px) => P("royal", px < x - 1 ? 3 : 2));
    for (let yy = y - 3; yy < y + 4; yy++) img.set(x + 2.5, yy, P("ivory", 4));
    for (const [dx, dy] of [[-4.5, -3], [-4.5, 4.5], [1.6, -3.6], [1.6, 3.6]]) img.set(x + dx, y + dy, P("gold", 4));
    img.set(x - 1, y, P("gold", 3)); img.set(x - 1, y + 1, P("gold", 3));
  } },
});

// ---------- v4 overrides: legs on joints, sleeves on any angle, weapons at the ready ----------
const add2 = (a, v, k) => [a[0] + v[0] * k, a[1] + v[1] * k];
const dirOf = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy) || 1; return [dx / m, dy / m]; };
const pole = (img, a, b, c1, c2, skip) => thick(img, a[0], a[1], b[0], b[1], c1, c2, skip);
function headDiamond(img, base, tip, p, w, r) {
  const mid = lerp2(base, tip, 0.35);
  poly(img, [tip, add2(mid, p, w), base, add2(mid, p, -w)], (x, y) => P(r, (x - base[0]) * p[0] + (y - base[1]) * p[1] < 0 ? 4 : 2));
}
const MD = (K) => [K.main.h, K.mainDir, [-K.mainDir[1], K.mainDir[0]]];

Object.assign(GEAR.legs, {
  greaves: { name: "Plate greaves", draw(img, K) { legEach(img, K, "steel", 3.6, 3.1, 2.5, { knee: "steel", foot: "steel", footW: 3.9 }); } },
  leggings: { name: "Leggings & tall boots", draw(img, K) { legEach(img, K, "leather", 3.1, 2.8, 2.5, { boot: "ink", bootFrom: 0.05, foot: "ink", footW: 3.4 }); } },
  wraps: { name: "Wrapped trousers", draw(img, K) {
    legEach(img, K, "ink", 3.3, 2.8, 2.4, { foot: "leather", footW: 3.2 });
    for (const L of K.legs) for (const t of [0.35, 0.6, 0.85]) { const q = lerp2(L.knee, L.ank, t); rowTint(img, Math.round(q[1]), q[0] - 4, q[0] + 4, (x, v) => v.r === "ink" && P("leather", x < q[0] ? 3 : 2)); }
  } },
  trousers: { name: "Cloth trousers", draw(img, K) { legEach(img, K, "sand", 3.1, 2.8, 2.5, { boot: "leather", bootFrom: 0.5, foot: "leather" }); } },
  chausses: { name: "Mail chausses", draw(img, K) { legEach(img, K, "steel", 3.3, 2.9, 2.6, { knee: "steel", foot: "leather", footW: 3.4 }); ringTex(img, 34, 58, "steel"); } },
});
function sleeves2(r, cuff, flare = 0) {
  return (img, K) => {
    for (const [s, e, h, bias] of ARMS(K)) {
      const v = dirOf(e, h);
      capsule(img, s[0], s[1], e[0], e[1], 2.5 + flare * 0.1, 2.4 + flare * 0.1, r, { bias });
      if (cuff) { const z = add2(h, v, -1.2); capsule(img, e[0], e[1], z[0], z[1], 2.4, 2.6 + flare, cuff, { bias }); }
      const z2 = add2(h, v, cuff ? -2.4 : -1.2); capsule(img, e[0], e[1], z2[0], z2[1], 2.4, 2.5 + flare * 0.92, r, { bias });
    }
  };
}
Object.assign(GEAR.arms, {
  bracers: { name: "Leather bracers", draw(img, K) { for (const [s, e, h, bias] of ARMS(K)) { const a = lerp2(e, h, 0.25), z = lerp2(e, h, 0.82); capsule(img, a[0], a[1], z[0], z[1], 2.4, 2.2, "leather", { bias }); } } },
  bell: { name: "Bell sleeves", draw: sleeves2("royal", "gold", 2.1) },
  sleeves: { name: "Long sleeves", draw: sleeves2("ivory", "gold") },
  magesleeves: { name: "Straight sleeves", draw: sleeves2("royal", "arcane") },
  woolsleeves: { name: "Wool sleeves", draw: sleeves2("sand", null) },
});
function swordAt(img, h, v) {
    const p = [-v[1], v[0]], g = add2(h, v, 2.4);
    pole(img, add2(h, v, 2.8), add2(h, v, 30), P("steel", 4), P("steel", 2));
    for (let i = -4; i <= 4; i++) { const q = add2(g, p, i); img.set(q[0], q[1], P("gold", i < 0 ? 4 : 2)); }
    const pm = add2(h, v, -3); img.set(pm[0], pm[1], P("gold", 3)); img.set(pm[0] + 1, pm[1], P("gold", 2));
}
function maceAt(img, K, h, v) {
  const p = [-v[1], v[0]];
  pole(img, add2(h, v, -4), add2(h, v, 10), P("leather", 3), P("leather", 2), (x, y) => nearHand(K, x, y));
  const c = add2(h, v, 12.6); ell(img, c[0], c[1], 2.7, 2.8, "steel", { bias: 0.1 });
  for (const q of [add2(c, p, 2.8), add2(c, p, -2.8), add2(c, v, 3)]) img.set(q[0], q[1], P("steel", 4));
}
function daggerAt(img, h, v) { const g = add2(h, v, 1); pole(img, add2(h, v, 1.8), add2(h, v, 7.6), P("steel", 4), P("steel", 2)); img.set(g[0], g[1], P("gold", 3)); }
Object.assign(GEAR.main, {
  sword: { name: "Longsword", draw(img, K) { swordAt(img, K.main.h, K.mainDir); } },
  staff: { name: "Orb staff", draw(img, K) {
    const [h, v, p] = MD(K);
    pole(img, add2(h, v, -25), add2(h, v, 30), P("leather", 3), P("leather", 2), (x, y) => nearHand(K, x, y));
    const top = add2(h, v, 32.6); ell(img, top[0], top[1], 3.1, 3.1, "teal", { bias: 0.2 }); img.set(top[0] - 1, top[1] - 1, { hex: "#ffffff" });
    for (const k of [-2.6, 2.6]) { const q = add2(add2(top, p, k), v, -2.4); img.set(q[0], q[1], P("gold", 3)); }
  } },
  rod: { name: "Apprentice rod", draw(img, K) {
    const [h, v] = MD(K);
    pole(img, add2(h, v, -4), add2(h, v, 14), P("leather", 3), P("leather", 2), (x, y) => nearHand(K, x, y));
    const t = add2(h, v, 15.8); ell(img, t[0], t[1], 1.9, 1.9, "arcane", { bias: 0.2 });
  } },
  sceptre: { name: "Sun sceptre", draw(img, K) {
    const [h, v] = MD(K);
    pole(img, add2(h, v, -5), add2(h, v, 15), P("gold", 3), P("gold", 2), (x, y) => nearHand(K, x, y));
    const c = add2(h, v, 18); ell(img, c[0], c[1], 3, 3, "gold", { bias: 0.25 });
    for (let a = 0; a < 8; a++) img.set(c[0] + Math.cos((a * Math.PI) / 4) * 4.6, c[1] + Math.sin((a * Math.PI) / 4) * 4.6, P("gold", 4));
    img.set(c[0], c[1], P("royal", 3));
  } },
  mace: { name: "Flanged mace", draw(img, K) { maceAt(img, K, K.main.h, K.mainDir); } },
  dagger: { name: "Dagger", draw(img, K) { daggerAt(img, K.main.h, K.mainDir); } },
  spear: { name: "Dragoon spear", draw(img, K) {
    const [h, v, p] = MD(K), base = add2(h, v, 30), tip = add2(h, v, 38);
    pole(img, add2(h, v, -14), base, P("leather", 3), P("leather", 2), (x, y) => nearHand(K, x, y));
    headDiamond(img, base, tip, p, 2.2, "steel");
    for (const k of [-1, 0, 1]) { const q = add2(add2(base, v, -1.6), p, k); img.set(q[0], q[1], P("crimson", 3)); }
  } },
  dragonspear: { name: "Dragon lance", draw(img, K) {
    const [h, v, p] = MD(K), base = add2(h, v, 29), tip = add2(h, v, 39);
    pole(img, add2(h, v, -14), base, P("teal", 3), P("teal", 2), (x, y) => nearHand(K, x, y));
    headDiamond(img, base, tip, p, 2.5, "steel");
    for (const s of [1, -1]) poly(img, [add2(base, p, s), add2(add2(base, p, 5 * s), v, -3), add2(base, v, -1.5)], () => P("gold", s > 0 ? 4 : 2));
  } },
});
function bow2(half, wood, recurve, curve) {
  return (img, K) => {
    const [x, y] = K.off.h, d = K.d;
    const at = (t) => { const a = Math.abs(t); return [x - d * curve * (1 - Math.cos(t * 1.45)) + (recurve && a > 0.8 ? d * (a - 0.8) * 16 : 0), y + t * half]; };
    for (let t = -1; t <= 1.0001; t += 0.015) { const [xx, yy] = at(t), tipc = recurve && Math.abs(t) > 0.9; img.set(xx, yy, tipc ? P("gold", 4) : P(wood, t < 0 ? 4 : 3)); img.set(xx + d, yy, tipc ? P("gold", 2) : P(wood, 2)); }
    const top = at(-1), bot = at(1), dr = K.stance === "archer" && !K.released ? K.main.h : [x - d * 3.2, y];
    line(img, top[0], top[1], dr[0], dr[1], { hex: R.ivory[3] }); line(img, bot[0], bot[1], dr[0], dr[1], { hex: R.ivory[3] });
  };
}
Object.assign(GEAR.off, {
  bow: { name: "Longbow", draw: bow2(21, "leather", false, 3.2) },
  shortbow: { name: "Short bow", draw: bow2(14, "leather", false, 2.6) },
  greatbow: { name: "Recurve greatbow", draw: bow2(22, "forest", true, 3.6) },
  dagger: { name: "Off-hand dagger", draw(img, K) { daggerAt(img, K.off.h, K.offDir); } },
  offsword: { name: "Off-hand sword", draw(img, K) { swordAt(img, K.off.h, K.offDir); } },
  offmace: { name: "Off-hand mace", draw(img, K) { maceAt(img, K, K.off.h, K.offDir); } },
});
function backDrape(r, bottom, wF, wB, hem, folds) {
  return (img, K) => {
    const { b, f } = K;
    lathe(img, 19 + b, bottom, f ? K.bx : K.tx, f ? pw([[19 + b, wF[0]], [bottom, wF[1]]]) : pw([[19 + b, wB[0]], [30 + b, (wB[0] + wB[1]) / 2], [bottom, wB[1]]]), r, { bias: f ? -0.25 : 0 });
    if (hem) rowTint(img, bottom - 1, 8, 41, (x) => hem(x));
    if (!f && folds) for (const k of folds) for (let y = 30 + b; y < bottom - 1; y++) img.set(K.tx(y) + k, y, P(r, 1));
  };
}
Object.assign(GEAR.back, {
  cape: { name: "Long cape", draw: backDrape("crimson", 56, [6.4, 8.4], [7.2, 9.6], () => P("crimson", 1), [-3.5, 0, 3.5]) },
  cloak: { name: "Short cloak", draw: backDrape("teal", 48, [6.4, 7.8], [7, 8.6], () => P("ivory", 3), [0]) },
  wardencloak: { name: "Warden cloak", draw: backDrape("forest", 54, [6.4, 8.6], [7, 9.6], () => P("leather", 2), [-2.5, 2.5]) },
  dragoncape: { name: "Dragon cape", draw: backDrape("teal", 58, [6.6, 8.8], [7.4, 10.4], (x) => P("ivory", x % 2 ? 3 : 2), [-4, 0, 4]) },
  quiver: { name: "Quiver", draw(img, K) {
    const { b, f } = K;
    if (f) {
      poly(img, [[19.5, 11 + b], [15.5, 10 + b], [13.5, 22 + b], [17.5, 23 + b]], (x) => P("leather", x < 16 ? 3 : 2));
      for (const [x, i] of [[15.5, 4], [16.5, 3], [17.5, 4], [18.5, 3]]) { img.set(x, 9 + b, P("ivory", i)); img.set(x - 0.5, 8 + b, P("crimson", i)); }
    } else {
      poly(img, [[20, 17 + b], [24, 15.5 + b], [31, 34 + b], [27, 35.5 + b]], (x) => P("leather", x < 25 ? 3 : 2));
      for (const [x, i] of [[19.5, 4], [20.5, 3], [21.5, 4], [22.5, 3]]) { img.set(x, 15 + b - (x - 19.5) * 0.4, P("ivory", i)); img.set(x, 14 + b - (x - 19.5) * 0.4, P("crimson", i)); }
    }
  } },
});

const SLOTS = ["head", "shoulders", "chest", "arms", "legs", "back", "main", "off"];
const ORDER = {
  front: ["back", "hair", "base", "legs", "chest", "limbs", "arms", "shoulders", "head", "off", "main"],
  back: ["main", "off", "limbs", "arms", "base", "legs", "chest", "back", "hair", "shoulders", "head"],
};

// classes: default body, the other body, and three tiers (the last is the class's showcase look)
const CLASSES = {
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
    ["Footpad", "Rags", { head: "bandana", chest: "darktunic", legs: "wraps", main: "dagger" }],
    ["Rogue", "Leather", { head: "cowl", chest: "garb", arms: "bracers", legs: "wraps", back: "scarf", main: "dagger", off: "dagger" }],
    ["Shadow", "Lamellar", { head: "shadowmask", shoulders: "darkpads", chest: "lamellar", arms: "bracers", legs: "wraps", back: "longscarf", main: "dagger", off: "dagger" }]] },
  cleric: { name: "Cleric", role: "Healer", shape: "A", body: { type: "f", hair: "hair" }, alt: { type: "m", hair: "hair" }, tiers: [
    ["Acolyte", "Habit", { chest: "habit", arms: "woolsleeves", off: "tome" }],
    ["Priest", "Vestment", { head: "veil", shoulders: "mantle", chest: "vestment", arms: "sleeves", main: "mace", off: "tome" }],
    ["High Priest", "Regalia", { head: "mitre", shoulders: "mantle", chest: "gown", arms: "sleeves", main: "sceptre" }]] },
  lancer: { name: "Lancer", role: "Dragoon", shape: "I", body: { type: "m", hair: "hairB" }, alt: { type: "f", hair: "hairB" }, tiers: [
    ["Militia", "Padded", { head: "kettle", chest: "gambeson", legs: "trousers", main: "spear" }],
    ["Dragoon", "Chain", { head: "winghelm", shoulders: "spaulders", chest: "chain", arms: "gauntlets", legs: "greaves", back: "cloak", main: "spear" }],
    ["Dragon Knight", "Scale", { head: "winghelm", shoulders: "spaulders", chest: "scaleplate", arms: "gauntlets", legs: "greaves", back: "dragoncape", main: "dragonspear" }]] },
};
for (const k of Object.values(CLASSES)) k.loadout = k.tiers[2][2];
const bodyOf = (k, type) => (k.body.type === type ? k.body : k.alt);

function layerImg(slot, id, view, bob, body, stance = "guard", pose = 0) {
  const lay = new Layer(), K = rig(view, bob, body, stance, pose);
  if (slot === "base") drawBase(lay, K, body);
  else if (slot === "limbs") drawLimbs(lay, K);
  else if (slot === "hair") drawHair(lay, K, body);
  else { const g = GEAR[slot]?.[id]; if (!g) return null; g.draw(lay, K); }
  let img = lay.toImg();
  if (view === "back" && GEAR[slot]?.[id]?.mirrorBack) img = mirrorImg(img);
  outline(img);
  return img;
}
const BODYSLOT = (s) => s === "base" || s === "limbs" || s === "hair";
function dress(loadout, view, bob = 0, body = {}, only = null, stance = stanceOf(loadout), pose = 0) {
  const out = new Img(LW, CH);
  shadow(out, FX + LOX, FY - 0.5, 13, 3);
  for (const slot of ORDER[view]) {
    if (only && !only.includes(slot) && !(slot === "hair" && only.includes("base"))) continue;
    const id = BODYSLOT(slot) ? slot : loadout[slot];
    if (!id) continue;
    const l = layerImg(slot, id, view, bob, body, stance, pose);
    if (l) out.blit(l, 0, 0);
  }
  return out;
}
function makeSprite(key, view, bob = 0) { const k = CLASSES[key]; return dress(k.loadout, view, bob, k.body); }
const solid = (img, hex) => { const o = new Img(img.w, img.h); img.c.forEach((v, i) => { if (v && v.a === undefined) o.c[i] = { hex }; }); return o; };

// unit sheets (default body, top tier): [front idle 0, front idle 1, back idle 0, back idle 1]
const roster = {};
for (const key of Object.keys(CLASSES)) {
  const frames = [makeSprite(key, "front", 0), makeSprite(key, "front", 1), makeSprite(key, "back", 0), makeSprite(key, "back", 1)];
  const sheet = new Img(CW * 4, CH);
  frames.forEach((f, i) => sheet.blit(f, i * CW, 0));
  sheet.png(`unit-${key}.png`);
  roster[key] = frames;
}
{
  const keys = Object.keys(CLASSES), s = new Img(keys.length * CW, CH);
  keys.forEach((k, i) => s.blit(solid(roster[k][0], "#ead6b0"), i * CW, 0));
  s.png("silhouettes.png");
}
// tiers grid: one row per class, columns T1 T2 T3 (male) then T1 T2 T3 (female); plus the same as silhouettes
{
  const keys = Object.keys(CLASSES), s = new Img(6 * CW, keys.length * CH), si = new Img(6 * CW, keys.length * CH);
  keys.forEach((key, r) => { const k = CLASSES[key]; ["m", "f"].forEach((t, bi) => k.tiers.forEach(([, , lo], ti) => {
    const img = dress(lo, "front", 0, bodyOf(k, t)); s.blit(img, (bi * 3 + ti) * CW, r * CH); si.blit(solid(img, "#ead6b0"), (bi * 3 + ti) * CW, r * CH);
  })); });
  s.png("tiers.png"); si.png("tiers-sil.png");
}
// bare bodies: [male front, female front, male back, female back]
{
  const s = new Img(4 * CW, CH), M = { type: "m", hair: "hair" }, F = { type: "f", hair: "crimson" };
  [["front", M], ["front", F], ["back", M], ["back", F]].forEach(([v, bd], i) => s.blit(dress({}, v, 0, bd), i * CW, 0));
  s.png("bases.png");
}
// gear atlases (one per body, same layout) and band widths for the shape read-out
const atlas = [["base", "base", "Base body"], ["limbs", "limbs", "Bare arms"], ["hair", "hair", "Long hair"]];
for (const slot of SLOTS) for (const [id, g] of Object.entries(GEAR[slot])) atlas.push([slot, id, g.name]);
const ACOLS = 12, gearInfo = [];
const span = (img, y0, y1) => { let a = 99, z = -1; for (let y = y0; y <= y1; y++) for (let x = 0; x < CW; x++) if (img.c[y * CW + x]) { a = Math.min(a, x); z = Math.max(z, x); } return z < 0 ? 0 : z - a + 1; };
for (const [tag, body] of [["m", { type: "m", hair: "hair" }], ["f", { type: "f", hair: "crimson" }]]) for (const st of Object.keys(STANCES)) {
  const rows = Math.ceil(atlas.length / ACOLS), s = new Img(ACOLS * CW, rows * CH);
  atlas.forEach(([slot, id, name], i) => {
    const img = layerImg(slot, id, "front", 0, body, st);
    s.blit(img, (i % ACOLS) * CW, Math.floor(i / ACOLS) * CH);
    if (tag === "m" && st === "guard") gearInfo.push({ slot, id, name, col: i % ACOLS, row: Math.floor(i / ACOLS), sh: span(img, 17 + OY0, 27 + OY0), hem: span(img, 50 + OY0, 60 + OY0) });
  });
  s.png(`atlas-${tag}-${st}.png`);
}
// build-up strips and an exploded layer row
const STEPS = [["base", "limbs"], ["legs"], ["chest"], ["arms", "shoulders"], ["head"], ["back", "off", "main"]];
for (const key of ["knight", "mage"]) {
  const k = CLASSES[key], s = new Img(STEPS.length * CW, CH); let acc = [];
  STEPS.forEach((st, i) => { acc = acc.concat(st); s.blit(dress(k.loadout, "front", 0, k.body, acc), i * CW, 0); });
  s.png(`build-${key}.png`);
}
{
  const k = CLASSES.knight, slots = ORDER.front.filter((s) => s !== "hair"), s = new Img(slots.length * CW, CH);
  slots.forEach((slot, i) => { const id = BODYSLOT(slot) ? slot : k.loadout[slot]; const l = id && layerImg(slot, id, "front", 0, k.body, stanceOf(k.loadout)); if (l) s.blit(l, i * CW, 0); });
  s.png("layers-knight.png");
}
writeFileSync(`${OUT}/gear.json`, JSON.stringify({ CW, CH, ACOLS, order: ORDER, slots: SLOTS, gear: gearInfo, classes: Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, { name: v.name, shape: v.shape, body: v.body.type, tiers: v.tiers }])) }, null, 1));

// ---------- isometric tiles: 48x24 top, 12 px per height step ----------
const TW = 48, TH = 24, STEP = 12, HW = TW / 2, HH = TH / 2;
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const TERRAIN = {
  grass:  { top: "forest", side: "leather", lip: 2, tex: (x, y, s) => (hash(x, y, s) > 0.86 ? 4 : hash(x, y, s + 1) > 0.8 ? 2 : 3) },
  dirt:   { top: "leather", side: "leather", tex: (x, y, s) => (hash(x, y, s) > 0.85 ? 4 : hash(x, y, s + 2) > 0.82 ? 2 : 3) },
  cobble: { top: "stone", side: "stone", tex: (x, y, s) => { const cx = (x + (Math.floor(y / 4) % 2) * 3) % 6, cy = y % 4; return cx === 0 || cy === 0 ? 1 : cx === 1 || cy === 1 ? 4 : 3; } },
  sand:   { top: "sand", side: "sand", tex: (x, y, s) => (hash(x, y, s) > 0.88 ? 4 : (x + y * 3) % 9 === 0 ? 2 : 3) },
  snow:   { top: "snow", side: "stone", lip: 2, tex: (x, y, s) => (hash(x, y, s) > 0.9 ? 2 : 3) + (hash(x, y, s + 3) > 0.92 ? 1 : 0) },
  water:  { top: "water", side: "water", tex: (x, y, s) => ((x + y * 2 + s) % 11 === 0 && y % 3 === 0 ? 4 : (x - y * 2) % 13 === 0 ? 3 : 2) },
  wood:   { top: "leather", side: "leather", tex: (x, y, s) => ((x + 2 * y) % 8 === 0 ? 1 : (x + 2 * y) % 8 === 1 ? 4 : 3) },
  moss:   { top: "stone", side: "stone", tex: (x, y, s) => (hash(x, y, s) > 0.6 ? P("forest", hash(x, y, s + 4) > 0.5 ? 3 : 2) : hash(x, y, s) > 0.3 ? 3 : 2) },
};
const inTop = (x, y) => { const dx = Math.abs(x + 0.5 - HW) / HW, dy = Math.abs(y + 0.5 - HH) / HH; return dx + dy <= 1; };
function tile(type, h, seed = 0, mark = null) {
  const T = TERRAIN[type], depth = h * STEP, img = new Img(TW, TH + depth);
  // sides
  for (let x = 0; x < TW; x++) {
    const left = x < HW;
    const yTop = left ? HH + Math.floor(x / 2) : HH + Math.floor((TW - 1 - x) / 2);
    for (let y = yTop; y < yTop + depth + 1; y++) {
      const dy = y - yTop;
      let i = left ? 2 : 1;
      if (T.lip && dy < T.lip) { img.set(x, y, P(T.top, left ? 2 : 1)); continue; }
      if (type === "cobble" || type === "moss") i = (dy % STEP === STEP - 1 || (dy + (left ? 0 : 6)) % STEP === 0 && (x + Math.floor(dy / STEP) * 4) % 8 === 0) ? 0 : i;
      else if (dy % STEP === STEP - 1 && hash(x, dy, seed) > 0.3) i = left ? 1 : 0;
      else if (hash(x, y, seed + 9) > 0.93) i += 1;
      if (y === yTop + depth) i = 0;
      img.set(x, y, P(T.side, Math.max(0, Math.min(4, i))));
    }
  }
  // top
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inTop(x, y)) continue;
    const v = T.tex(x, y, seed);
    img.set(x, y, typeof v === "object" ? v : P(T.top, v));
  }
  // rim: top-left edges bright, bottom-right edges one step down
  for (let x = 0; x < TW; x++) {
    const left = x < HW, yEdge = left ? HH - 1 - Math.floor(x / 2) : HH - 1 - Math.floor((TW - 1 - x) / 2);
    if (left) img.set(x, yEdge, P(T.top, 4));
    const yb = left ? HH + Math.floor(x / 2) : HH + Math.floor((TW - 1 - x) / 2);
    if (!left && depth === 0) img.set(x, yb, P(T.top, 1));
  }
  // faint grid: lower edges of the top face one step darker
  for (let y = HH; y < TH; y++) for (let x = 0; x < TW; x++) if (inTop(x, y) && !inTop(x, y + 1)) { const v = img.get(x, y); if (v && v.r) img.set(x, y, P(v.r, Math.max(1, v.i - 1))); }
  if (mark) markTop(img, mark);
  return img;
}
const MARK = { move: ["#5e9ae0", "#a8d4f4"], attack: ["#e0604e", "#f6a07a"], ally: ["#5c9a48", "#a4cc6a"] };
function markTop(img, kind) {
  const [fill, edge] = MARK[kind];
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inTop(x, y)) continue;
    const e = !inTop(x - 2, y) || !inTop(x + 2, y) || !inTop(x, y - 1) || !inTop(x, y + 1);
    if (e) img.set(x, y, { hex: edge });
    else if ((BAYER[y % 4][x % 4]) < 7) img.set(x, y, { hex: fill });
  }
}
function cursor(img, ox, oy) {
  const g = (x, y, i) => img.set(ox + x, oy + y, P("gold", i));
  for (let k = 0; k < 10; k++) {
    const u = Math.floor(k / 2);
    g(k - 1, HH - 1 - u, 4); g(k - 1, HH + u, 3); g(TW - k, HH - 1 - u, 3); g(TW - k, HH + u, 2);
    g(HW - 1 - k, u - 1, 4); g(HW + k, u - 1, 3); g(HW - 1 - k, TH - u, 3); g(HW + k, TH - u, 2);
  }
}

// tile swatch sheet: each terrain at h=1 and h=2
const TYPES = Object.keys(TERRAIN);
{
  const C = TW + 8;
  const sheet = new Img(TYPES.length * C, TH + 2 * STEP + 16);
  TYPES.forEach((t, i) => sheet.blit(tile(t, 2, i), i * C + 4, 8));
  sheet.png("tiles-terrain.png");
  const SHH = TH + 4 * STEP + 12, steps = new Img(4 * C, SHH);
  [0, 1, 2, 4].forEach((h, i) => steps.blit(tile("grass", h, i), i * C + 4, SHH - 4 - TH - h * STEP));
  steps.png("tiles-heights.png");
  const marks = new Img(4 * C, TH + STEP + 16);
  ["move", "attack", "ally"].forEach((m, i) => marks.blit(tile("grass", 1, i, m), i * C + 4, 8));
  marks.blit(tile("grass", 1, 7), 3 * C + 4, 8); cursor(marks, 3 * C + 4, 8);
  console.log("tile sheets", sheet.w, sheet.h, steps.w, steps.h, marks.w, marks.h);
  marks.png("tiles-marks.png");
}

// ---------- props: 40x56, base center at (20,48) ----------
function prop(kind) {
  const img = new Img(40, 56), b = 48;
  if (kind === "oak") {
    box(img, 17, 30, 22, b - 1, "leather"); img.set(16, b - 1, P("leather", 2)); img.set(23, b - 1, P("leather", 1));
    ell(img, 13, 24, 8, 7, "forest"); ell(img, 27, 25, 8, 7, "forest", { bias: -0.2 }); ell(img, 20, 15, 11, 9, "forest", { bias: 0.05 }); ell(img, 21, 26, 9, 5, "forest", { bias: -0.15 });
    for (let i = 0; i < 26; i++) { const x = 9 + Math.floor(hash(i, 1) * 24), y = 8 + Math.floor(hash(i, 2) * 20), v = img.get(x, y); if (v && v.r === "forest" && v.i >= 3) img.set(x, y, P("forest", 4)); }
  } else if (kind === "pine") {
    box(img, 18, 38, 21, b - 1, "leather");
    for (const [y0, w] of [[4, 5], [12, 8], [20, 11], [28, 13]]) poly(img, [[20, y0], [20 + w, y0 + 12], [20 - w, y0 + 12]], (x, y) => P("teal", x < 18 ? 3 : x < 22 ? 2 : 1));
    for (const [y0, w] of [[4, 5], [12, 8], [20, 11], [28, 13]]) for (let x = 20 - w; x < 20; x++) if (img.get(x, y0 + 11)) img.set(x, y0 + 11, P("snow", 3));
  } else if (kind === "rock") {
    ell(img, 18, 41, 10, 7, "stone"); ell(img, 26, 44, 6, 4, "stone", { bias: -0.2 }); line(img, 14, 38, 19, 42, P("stone", 1));
    for (let x = 10; x < 22; x++) if (img.get(x, 36) && hash(x, 3) > 0.4) img.set(x, 36, P("forest", 3));
  } else if (kind === "bush") {
    ell(img, 15, 42, 7, 5, "forest"); ell(img, 24, 43, 7, 5, "forest", { bias: -0.2 }); ell(img, 20, 38, 7, 5, "forest", { bias: 0.1 });
    for (const [x, y] of [[16, 37], [23, 40], [12, 42], [26, 44]]) img.set(x, y, P("crimson", 4));
  } else if (kind === "crate") {
    // iso cube 18 wide
    poly(img, [[20, 30], [30, 35], [20, 40], [10, 35]], (x, y) => P("leather", 4));
    poly(img, [[10, 35], [20, 40], [20, b], [10, b - 5]], (x, y) => P("leather", 3));
    poly(img, [[20, 40], [30, 35], [30, b - 5], [20, b]], (x, y) => P("leather", 2));
    line(img, 10, 39, 20, 44, P("leather", 1)); line(img, 20, 44, 30, 39, P("leather", 0)); line(img, 20, 40, 20, b, P("leather", 1));
  } else if (kind === "chest") {
    poly(img, [[10, 37], [20, 42], [20, b], [10, b - 5]], () => P("crimson", 3));
    poly(img, [[20, 42], [30, 37], [30, b - 5], [20, b]], () => P("crimson", 2));
    poly(img, [[10, 37], [20, 32], [30, 37], [20, 42]], () => P("crimson", 4));
    ell(img, 15, 35.5, 5.5, 3.5, "crimson", { clip: (x, y) => y < 37 }); ell(img, 25, 35.5, 5.5, 3.5, "crimson", { clip: (x, y) => y < 37, bias: -0.2 });
    line(img, 10, 37, 20, 42, P("gold", 4)); line(img, 20, 42, 30, 37, P("gold", 3)); line(img, 14, 39, 14, b - 3, P("gold", 3)); line(img, 26, 39, 26, b - 3, P("gold", 2));
    img.set(20, 43, P("gold", 4)); img.set(20, 44, P("gold", 2));
  } else if (kind === "crystal") {
    poly(img, [[20, 14], [26, 30], [20, b - 2], [14, 30]], (x, y) => P("arcane", x < 18 ? 4 : x < 20 ? 3 : 2));
    poly(img, [[12, 30], [15, 36], [12, b - 2], [9, 38]], (x, y) => P("arcane", x < 12 ? 3 : 2));
    poly(img, [[28, 28], [31, 38], [27, b - 1], [25, 36]], (x, y) => P("arcane", x < 28 ? 3 : 1));
    line(img, 18, 18, 18, 34, P("arcane", 4)); img.set(17, 22, { hex: "#ffffff" });
    ell(img, 20, b - 1, 10, 2, "stone", { clip: (x, y) => !img.get(x, y) });
  } else if (kind === "banner") {
    line(img, 14, 6, 14, b - 1, P("leather", 2)); line(img, 13, 6, 13, b - 1, P("leather", 3)); img.set(13, 4, P("gold", 4)); img.set(14, 4, P("gold", 3)); img.set(13, 5, P("gold", 3));
    poly(img, [[15, 8], [30, 9], [29, 28], [23, 24], [16, 28]], (x, y) => P("royal", x < 20 ? 3 : 2));
    ell(img, 22.5, 16, 3, 3, "gold");
  }
  outline(img);
  if (kind !== "crate" && kind !== "chest") shadow(img, 20, b - 0.5, 10, 2.6);
  return img;
}
const PROPS = ["oak", "pine", "rock", "bush", "crate", "chest", "crystal", "banner"];
{
  const s = new Img(PROPS.length * 40, 56);
  PROPS.forEach((k, i) => s.blit(prop(k), i * 40, 0));
  s.png("props.png");
}

// ---------- battle map ----------
function battle(file, { marks = true } = {}) {
  const N = 11, W = N * TW + HW, H = N * TH + 6 * STEP + 76;
  const img = new Img(W, H);
  const OX = N * HW - HW + 8, OY = 60, centers = {};
  const hgt = (i, j) => {
    if (j >= 5 && j <= 6 && i > 1) return 0; // river bed
    if (i <= 2 && j <= 3) return 4;
    if (i <= 3 && j <= 4) return 3;
    if (i >= 8 && j >= 8) return 2;
    if (i >= 7 && j <= 2) return 2;
    return 1;
  };
  const ter = (i, j) => {
    if (j >= 5 && j <= 6 && i > 1) return i === 5 ? "wood" : "water";
    if (i <= 3 && j <= 4) return hgt(i, j) === 4 ? "cobble" : "moss";
    if (j === 4 && i > 3 || i === 5 && j > 6) return "dirt";
    if (i >= 8 && j >= 8) return "snow";
    if (i >= 7 && j <= 2) return "sand";
    return "grass";
  };
  const H2 = (i, j) => (ter(i, j) === "wood" ? 1 : hgt(i, j));
  const units = { "3,7": ["knight", "front"], "6,8": ["mage", "front"], "0,5": ["archer", "front"], "8,3": ["thief", "back"], "2,9": ["cleric", "front"], "1,1": ["lancer", "back"] };
  const props = { "1,10": "oak", "9,6": "oak", "10,1": "pine", "1,4": "banner", "8,9": "pine", "10,9": "pine", "6,10": "rock", "4,10": "bush", "3,3": "crystal", "9,0": "crate", "0,0": "chest", "6,2": "bush" };
  const moveSet = new Set(["3,8", "4,7", "3,9", "2,8", "4,9", "5,8", "4,10", "2,7", "5,7"]);
  const atkSet = new Set(["3,6", "4,6"]);
  for (let s = 0; s <= 2 * (N - 1); s++) for (let i = 0; i < N; i++) {
    const j = s - i; if (j < 0 || j >= N) continue;
    const h = H2(i, j), sx = OX + (i - j) * HW, sy = OY + (i + j) * HH - h * STEP + 6 * STEP;
    centers[`${i},${j}`] = [sx + HW, sy - STEP + HH];
    const key = `${i},${j}`;
    const m = marks ? (moveSet.has(key) ? "move" : atkSet.has(key) ? "attack" : null) : null;
    img.blit(tile(ter(i, j), h + 1, i * 13 + j * 7, m), sx, sy - STEP);
    if (marks && key === "3,7") cursor(img, sx, sy - STEP);
    if (props[key]) img.blit(prop(props[key]), sx + HW - 20, sy - STEP + HH - 48);
    if (units[key]) { const [u, v] = units[key]; img.blit(makeSprite(u, v, 0), sx + HW - FX, sy - STEP + HH - FY + 1, v === "back"); }
  }
  // enemy slime marker spot left empty for the live pixelfx critter
  img.png(file);
  return { W, H, OX, OY, c53: centers["5,3"], c76: centers["7,6"], c37: centers["3,7"], c36: centers["3,6"] };
}
const mapInfo = battle("battle-map.png");
battle("battle-map-clean.png", { marks: false });

// ---------- icons 16x16 from strings ----------
const ICONS = {
  attack: { k: { s: "steel", g: "gold", l: "leather" }, a: [
    "..............ss",
    ".............sss",
    "............sss.",
    "...........sss..",
    "..........sss...",
    ".........sss....",
    "........sss.....",
    ".......sss......",
    "..g...sss.......",
    "..gg.sss........",
    "...ggss.........",
    "....gg..........",
    "...lggg.........",
    "..ll..gg........",
    ".ll.............",
    "ll.............."] },
  move: { k: { l: "leather", g: "gold" }, a: [
    "................",
    "....llll........",
    "....llll........",
    "....llll........",
    "....llll........",
    "....llll........",
    "....llll........",
    "....gggg........",
    "....llll........",
    "....lllll.......",
    "....llllllll....",
    "....lllllllll...",
    "....lllllllll...",
    "....gggggggggg..",
    "................",
    "................"] },
  skill: { k: { a: "arcane", g: "gold" }, a: [
    ".......a........",
    ".......a........",
    "......aaa.......",
    "......aaa.......",
    "..aaaaaaaaaaa...",
    "....aaaaaaa.....",
    ".....aaaaa......",
    "....aaa.aaa.....",
    "....aa...aa.....",
    "...a.......a....",
    "...........g....",
    "..........ggg...",
    "...........g....",
    "..g.............",
    ".ggg............",
    "..g............."] },
  item: { k: { c: "crimson", i: "ivory", l: "leather" }, a: [
    "................",
    "......llll......",
    "......iiii......",
    ".......ii.......",
    ".......ii.......",
    ".....iiiiii.....",
    "....iccccccii...",
    "...icccccccci...",
    "...icccccccci...",
    "...icccccccci...",
    "...iccccccccc...",
    "....ccccccccc...",
    ".....ccccccc....",
    "................",
    "................",
    "................"] },
  wait: { k: { g: "gold", s: "sand", l: "leather" }, a: [
    "...gggggggggg...",
    "....llllllll....",
    "....ssssssss....",
    ".....ssssss.....",
    "......ssss......",
    ".......ss.......",
    "........l.......",
    ".......ll.......",
    "......llll......",
    ".....l.ss.l.....",
    "....l..ss..l....",
    "....l.ssss.l....",
    "....llllllll....",
    "...gggggggggg...",
    "................",
    "................"] },
  defend: { k: { s: "steel", c: "crimson", g: "gold" }, a: [
    "..ssssssssssss..",
    "..sccccccccccs..",
    "..sccccgcccccs..",
    "..sccccgcccccs..",
    "..scgggggggccs..",
    "..sccccgcccccs..",
    "..sccccgcccccs..",
    "..sccccgcccccs..",
    "...scccgccccs...",
    "...sccccccccs...",
    "....sccccccs....",
    ".....sccccs.....",
    "......ssss......",
    "................",
    "................",
    "................"] },
  hp: { k: { c: "crimson" }, a: [
    "................",
    "................",
    "..ccc....ccc....",
    ".ccccc..ccccc...",
    "ccccccccccccc...",
    "ccccccccccccc...",
    "ccccccccccccc...",
    ".ccccccccccc....",
    "..ccccccccc.....",
    "...ccccccc......",
    "....ccccc.......",
    ".....ccc........",
    "......c.........",
    "................",
    "................",
    "................"] },
  mp: { k: { r: "royal" }, a: [
    "................",
    "......r.........",
    "......r.........",
    ".....rrr........",
    ".....rrr........",
    "....rrrrr.......",
    "...rrrrrrr......",
    "..rrrrrrrrr.....",
    "..rrrrrrrrr.....",
    "..rrrrrrrrr.....",
    "..rrrrrrrrr.....",
    "...rrrrrrr......",
    "....rrrrr.......",
    "................",
    "................",
    "................"] },
  gold: { k: { g: "gold" }, a: [
    "................",
    ".....gggggg.....",
    "....gggggggg....",
    "...gggg..gggg...",
    "...ggg.gg.ggg...",
    "...ggg.gg.ggg...",
    "...ggg.gg.ggg...",
    "...ggg.gg.ggg...",
    "...gggg..gggg...",
    "....gggggggg....",
    ".....gggggg.....",
    "................",
    "................",
    "................",
    "................",
    "................"] },
  turn: { k: { t: "teal", g: "gold" }, a: [
    "................",
    ".....tttttt.....",
    "...tt......tt...",
    "..t....g.....t..",
    "..t....g.....t..",
    ".t.....g......t.",
    ".t.....g......t.",
    ".t.....ggggg..t.",
    ".t............t.",
    "..t..........t..",
    "..t..........t..",
    "...tt......tt...",
    ".....tttttt.....",
    "................",
    "................",
    "................"] },
};
// icons get auto-shading: lighter top-left, darker bottom-right, plus outline
function icon(def) {
  const img = new Img(18, 18);
  def.a.forEach((row, y) => [...row].forEach((ch, x) => {
    const r = def.k[ch]; if (!r) return;
    const u = (x + y) / 30; img.set(x + 1, y + 1, P(r, u < 0.35 ? 4 : u < 0.7 ? 3 : 2));
  }));
  // inner-shadow on lower-right edge pixels
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const v = img.get(x, y); if (v && (!img.get(x + 1, y) || !img.get(x, y + 1))) img.set(x, y, P(v.r, Math.max(1, v.i - 1))); }
  outline(img);
  return img;
}
{
  const keys = Object.keys(ICONS), s = new Img(keys.length * 18, 18);
  keys.forEach((k, i) => s.blit(icon(ICONS[k]), i * 18, 0));
  s.png("icons.png");
}

// ---------- 9-slice window frames, 24x24, slice 8 ----------
function frame(style) {
  const img = new Img(24, 24);
  const S = style === "parch" ? { fill: P("parch", 3), edge: P("leather", 1), hi: P("parch", 4), lo: P("parch", 2), trim: P("gold", 3), trim2: P("gold", 2) }
    : { fill: { hex: "#221a30" }, edge: { hex: R.ink[0] }, hi: P("royal", 1), lo: { hex: "#1a1424" }, trim: P("gold", 3), trim2: P("gold", 1) };
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const d = Math.min(x, y, 23 - x, 23 - y);
    const corner = (x < 2 || x > 21) && (y < 2 || y > 21);
    if (corner && d === 0) continue;
    let v = S.fill;
    if (d === 0) v = S.edge; else if (d === 1) v = (x < 12 && y < 12) || y === 1 || x === 1 ? S.trim : S.trim2;
    else if (d === 2) v = S.edge; else if (d === 3) v = y === 3 || x === 3 ? S.hi : S.lo;
    if (d === 1 && (x === 1 || x === 22) && (y === 1 || y === 22)) v = S.edge;
    img.set(x, y, v);
  }
  // corner studs
  for (const [x, y] of [[2, 2], [21, 2], [2, 21], [21, 21]]) { img.set(x, y, P("gold", 4)); }
  return img;
}
frame("parch").png("frame-parch.png");
frame("night").png("frame-night.png");

// bar segment strip (for HP/MP gauges): 3 px tall caps not needed; done in CSS.
writeFileSync(`${OUT}/art.json`, JSON.stringify({ CW, CH, FX, FY, TW, TH, STEP, mapInfo, icons: Object.keys(ICONS), props: PROPS, terrain: TYPES, ramps: R }, null, 1));
console.log("ok", mapInfo);

// roster lineup: every class, front then back
{
  const keys = Object.keys(CLASSES), s = new Img(keys.length * CW, CH * 2);
  keys.forEach((k, i) => { s.blit(roster[k][0], i * CW, 0); s.blit(roster[k][2], i * CW, CH); });
  s.png("roster.png");
}

// stance sheet: each stance on an iso tile, SE front row and NW back row
{
  const picks = [["guard", "knight"], ["caster", "mage"], ["archer", "archer"], ["rogue", "thief"], ["lancer", "lancer"]];
  const SH = 100, s = new Img(picks.length * CW, 2 * SH);
  picks.forEach(([st, key], i) => ["front", "back"].forEach((v, r) => {
    const k = CLASSES[key];
    s.blit(tile("grass", 1, i * 3 + r), i * CW + 24 - HW, r * SH + FY - HH);
    s.blit(dress(k.loadout, v, 0, k.body, null, st), i * CW, r * SH);
  }));
  s.png("stances.png");
}

// attack animation: one row per class (default body, top tier); SE poses 0-3 then NW poses 0-3
{
  LW = 96; LOX = 24;
  const keys = Object.keys(CLASSES), s2 = new Img(8 * LW, keys.length * CH);
  keys.forEach((key, r) => { const k = CLASSES[key]; ["front", "back"].forEach((v, vi) => [0, 1, 2, 3].forEach((p) => s2.blit(dress(k.loadout, v, 0, k.body, null, stanceOf(k.loadout), p), (vi * 4 + p) * LW, r * CH))); });
  s2.png("attacks.png");
}
// dual wield across classes: same stance with three weapon pairs
{
  const pairs = [{ main: "dagger", off: "dagger" }, { main: "sword", off: "offsword" }, { main: "mace", off: "offmace" }];
  const bodyM = { type: "m", hair: "hair" }, s3 = new Img(pairs.length * 4 * LW, CH);
  const looks = [CLASSES.thief.loadout, CLASSES.knight.tiers[1][2], CLASSES.cleric.tiers[1][2]];
  pairs.forEach((pr, i) => [0, 1, 2, 3].forEach((p) => { const lo = { ...looks[i], ...pr, back: looks[i].back }; s3.blit(dress(lo, "front", 0, i === 2 ? CLASSES.cleric.body : bodyM, null, "rogue", p), (i * 4 + p) * LW, 0); }));
  s3.png("dual.png");
  LW = CW; LOX = 0;
}
