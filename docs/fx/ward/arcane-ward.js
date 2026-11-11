// pixelrpg's own pixelfx effect (status loop). It imports the pixelfx core that `npm run site` copies to docs/pixelfx.
import { PAL, fit, cycle, sparkle, smooth, TAU, WHITE } from "../../pixelfx/core/index.js";
import { floorRing, glyph, sigil } from "../../pixelfx/fx/arcane/_lib.js";
import { shapeOf } from "../../pixelfx/fx/holy/_lib.js";

// a bell of light: a dome over the head on walls that flare a little to the floor seal
const D = 4, RX = 21, TOP = -70, DOME = 22, CY = TOP + DOME, FLARE = 3, SEAL = 25, SY = 0.3;
const BAND_Y = -26, BAND_R = 31, NR = 8;

export const meta = {
  name: "Arcane ward",
  desc: "A mystic ward round the character: a bell of violet light whose edge ripples like silk, threads of mana rising up its walls, a band of runes turning round it at the waist, a rune seal on the floor.",
  tags: ["arcane", "ward", "shield", "barrier", "buff", "character", "loop"],
  size: [112, 108],
  origin: [56, 92],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: PAL.arcane, seed: 5 },
};

// half the bell's width at height y (y <= 0)
const half = (y) => (y < CY ? RX * Math.sqrt(Math.max(0, 1 - ((y - CY) / DOME) ** 2)) : RX + FLARE * ((y - CY) / -CY) ** 2);
// the rim as a path from the left foot, over the dome, to the right foot: points with an outward normal and arc length
const PATH = (() => {
  const pts = [];
  for (let y = 0; y > CY; y -= 0.5) pts.push([-half(y), y, -1, 0]);
  for (let g = Math.PI; g <= TAU + 1e-6; g += 0.5 / RX) pts.push([Math.cos(g) * RX, CY + Math.sin(g) * DOME, Math.cos(g), Math.sin(g)]);
  for (let y = CY; y <= 0; y += 0.5) pts.push([half(y), y, 1, 0]);
  let s = 0;
  return pts.map((q, i) => { if (i) s += Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]); return [...q, s]; });
})();
const LEN = PATH[PATH.length - 1][4];

// the film: almost clear in the middle, thickening to a soft band inside the rim, with curtains of light
// that sway sideways while their brightness climbs (an aurora caught in the ward)
function film(p, C, ph, back) {
  for (let y = Math.ceil(TOP); y <= 0; y++) {
    const w = half(y + 0.5), sway = 2.2 * Math.sin((y + 0.5) * 0.08 - ph * TAU), climb = 0.5 + 0.5 * Math.sin((y + 0.5) * 0.24 + ph * TAU * 3);
    for (let x = Math.floor(-w); x <= Math.ceil(w); x++) {
      const inner = Math.min(w - Math.abs(x + 0.5), y < CY ? (1 - Math.hypot((x + 0.5) / RX, (y + 0.5 - CY) / DOME)) * DOME : 99);
      if (inner < 0) continue;
      let fold = Math.max(0, Math.sin((x + 0.5) * 0.48 + sway)); fold *= fold; fold *= fold; fold *= fold;
      const cur = fold * climb * Math.min(1, (-y) / 14);
      const a = back ? 0.03 + 0.1 * Math.max(0, 1 - inner / 4) + 0.06 * cur : 0.01 + 0.22 * Math.max(0, 1 - inner / 3.5) + 0.16 * cur;
      p.blend(x + 0.5, y + 0.5, (inner < 1.5 || cur > 0.55) && !back ? C[5] : C[4], a);
      if (!back && cur > 0.7) p.light(x + 0.5, y + 0.5, C[4], 0.05);
    }
  }
}

// the rim: a ripple runs up both walls and over the dome; the lit side (top left) is white, a second fainter line inside
function rim(p, C, ph) {
  for (const [x, y, nx, ny, s] of PATH) {
    const wave = Math.sin((s / LEN) * TAU * 4 - ph * TAU * 3), off = wave > 0.55 ? 1 : 0, lit = -nx * 0.7 - ny * 0.7;
    p.dot(x + nx * off, y + ny * off, wave > 0.85 || lit > 0.75 ? WHITE : lit > -0.2 ? C[6] : C[5], 1);
    if (Math.sin((s / LEN) * TAU * 9 + ph * TAU) > 0) p.dot(x - nx * 2, y - ny * 2, C[5], 0.4 + 0.25 * lit);
  }
  for (let i = 0; i < PATH.length; i += 14) p.glow(PATH[i][0], PATH[i][1], 7, C[5], 0.1);
  for (let j = 0; j < 5; j++) p.glow(0, CY + j * 10, 24, C[4], 0.07);
}

// a band of runes turning round the waist on a tilted ring, a quarter turn a loop (the glyphs repeat every 2)
function runes(p, C, ph, far) {
  const spin = (ph * TAU) / 4, keep = far ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;
  floorRing(p, 0, BAND_Y, BAND_R, SY, (g) => (Math.sin(g) < 0 ? C[3] : C[4]), (g) => (Math.sin(4 * (g - spin)) > 0 ? 0.85 : 0.3), keep);
  const gs = [...Array(NR).keys()].map((k) => [k, spin + ((k + 0.5) * TAU) / NR]).filter(([, g]) => Math.sin(g) < 0 === far);
  gs.sort((a, b) => Math.sin(a[1]) - Math.sin(b[1]));
  for (const [k, g] of gs) {
    const x = Math.cos(g) * BAND_R, y = BAND_Y + Math.sin(g) * BAND_R * SY, hot = Math.sin(g) > 0.85;
    const bob = Math.round(Math.sin(ph * TAU * 4 + k * Math.PI) * 0.6);
    glyph(p, [2, 6][k % 2], x, y - 1 + bob, hot ? WHITE : far ? C[4] : C[6], far ? 0.7 : 1, far ? C[2] : C[3]);
    p.glow(x, y - 3, hot ? 8 : 5, C[5], far ? 0.08 : hot ? 0.4 : 0.22);
  }
}

function seal(p, C, ph, far) {
  const keep = far ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0, spin = (ph * TAU) / 4;
  floorRing(p, 0, 0, SEAL, SY, (g) => (Math.sin(g) < 0 ? C[4] : C[6]), 1, keep);
  floorRing(p, 0, 0, SEAL - 6, SY, C[4], (g) => (Math.sin(4 * (g + spin)) > 0 ? 0.9 : 0.3), keep);
  for (let j = 0; j < 12; j++) { // ticks between the rings, turning against the runes
    const g = -spin + (j * TAU) / 12;
    if (Math.sin(g) < 0 !== far) continue;
    p.px(Math.cos(g) * (SEAL - 3), Math.sin(g) * (SEAL - 3) * SY, far ? C[4] : C[5]);
  }
}

// threads of mana climbing the walls and over the dome
function threads(p, C, t, seed) {
  cycle(t, D, 14, seed, (g) => g.range(0.9, 1.5), (age, life, R) => {
    const side = R.chance(0.5) ? -1 : 1, u = age / life, len = R.range(8, 14), k = Math.min(1, Math.sin(u * Math.PI) * 1.6);
    const s0 = side < 0 ? u * LEN * 0.55 : LEN - u * LEN * 0.55; // from a foot up toward the crown
    for (let i = 0; i < len; i++) {
      const s = s0 - side * i * 0.9, q = PATH[Math.max(0, Math.min(PATH.length - 1, Math.round((s / LEN) * (PATH.length - 1))))];
      p.dot(q[0] - q[2] * 2.5, q[1] - q[3] * 2.5, i < 2 ? WHITE : i < 5 ? C[6] : C[5], k * (1 - (i / len) ** 2));
    }
    const q = PATH[Math.max(0, Math.min(PATH.length - 1, Math.round((s0 / LEN) * (PATH.length - 1))))];
    p.light(q[0], q[1], C[5], 0.4 * k);
  });
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, pulse = 0.85 + 0.15 * Math.sin(ph * TAU * 2);
  for (let i = -2; i <= 2; i++) p.glow(i * 10, 0, 13, C[4], 0.16 * pulse);
  film(p, C, ph, true);
  seal(p, C, ph, true);
  runes(p, C, ph, true);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, A = o.actor;
  // the ward lights the character's outline with its own colour
  if (A) for (const [x, y] of shapeOf(A).out) p.light(x, y, C[5], 0.2);
  film(p, C, ph, false);
  rim(p, C, ph);
  threads(p, C, t, o.seed);
  seal(p, C, ph, false);
  runes(p, C, ph, false);
  // a sigil keeps the ward at its crown, breathing twice a loop
  const breath = 0.5 + 0.5 * Math.sin(ph * TAU * 2);
  sigil(p, 1, 0, TOP - 1, breath > 0.7 ? WHITE : C[6], 1);
  p.glow(0, TOP - 4, 7 + 3 * breath, C[5], 0.3 + 0.25 * breath);
  // motes drifting up inside, swaying; sparks winking on the dome
  cycle(t, D, 10, o.seed + 2, (g) => g.range(1.6, 2.6), (age, life, R) => {
    const u = age / life, x = R.range(-0.75, 0.75) * RX + Math.sin(u * 5 + R.range(0, 6)) * 2, y = -3 + u * (TOP + 8);
    if (Math.abs(x) > half(y) - 2) return;
    const k = Math.sin(u * Math.PI);
    p.dot(x, y, u < 0.4 ? WHITE : C[6], k * 0.9);
    p.light(x, y, C[5], 0.3 * k);
  });
  cycle(t, D, 6, o.seed + 1, (g) => g.range(0.4, 0.7), (age, life, R) => {
    const g = R.range(Math.PI * 1.1, Math.PI * 1.9), k = Math.sin((age / life) * Math.PI);
    sparkle(p, Math.cos(g) * RX, CY + Math.sin(g) * DOME, 1 + 2.2 * k, WHITE, C[6], 0.4 * k);
  });
}
