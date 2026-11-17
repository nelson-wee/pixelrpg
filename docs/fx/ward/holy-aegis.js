// pixelrpg's own pixelfx effect (status loop). It imports the pixelfx core that `npm run site` copies to docs/pixelfx.
import { fit, cycle, sparkle, smooth, clamp, TAU, WHITE } from "../../pixelfx/core/index.js";
import { GOLD, shapeOf, oval } from "../../pixelfx/fx/holy/_lib.js";

// an egg of golden light that holds the character: no lattice, no runes, light from within and rays behind
const D = 3, RX = 23, RY = 37, CY = -33, NRAY = 8, POOL = 22;

export const meta = {
  name: "Holy aegis",
  desc: "A divine shield: an egg of golden light round the character, lit from within and brightest at the crown, a sheen sliding over it, a crisp rim that breathes, rays fanning out behind, motes of light drifting up, a warm pool on the floor.",
  tags: ["holy", "shield", "aegis", "absorb", "bubble", "buff", "character", "loop"],
  size: [112, 112],
  origin: [56, 92],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: GOLD, seed: 7 },
};

// the shell: wider low down, like an egg standing on its end; it breathes by a pixel twice a loop
const breath = (ph) => (Math.sin(ph * TAU * 2) > 0.3 ? 1 : 0);
const rxAt = (y, k) => {
  const v = (y - CY) / (RY + k);
  return Math.abs(v) >= 1 ? 0 : (RX + k) * Math.sqrt(1 - v * v) * (1 + 0.1 * v);
};
// the sheen: a soft diagonal band sliding down across the shell once a loop, then a rest
const sheen = (ph) => -1.6 + 3.4 * clamp(ph / 0.6);

function film(p, C, ph, back) {
  const k = breath(ph), sw = sheen(ph);
  for (let y = Math.ceil(CY - RY - k); y <= 2; y++) {
    const w = rxAt(y + 0.5, k);
    if (w <= 0) continue;
    for (let x = Math.floor(-w); x <= Math.ceil(w); x++) {
      const nx = (x + 0.5) / w, ny = (y + 0.5 - CY) / (RY + k), d = Math.min(1, Math.hypot(nx * Math.sqrt(1 - ny * ny) || 0, ny));
      const edge = Math.abs(nx); // 1 at the rim
      if (edge > 1) continue;
      const crown = clamp(-ny), q = nx * 0.6 + ny * 0.9 - sw, hot = Math.max(0, 1 - Math.abs(q) / 0.18);
      // fresnel: clear in the middle, thick at the rim; light from within, strongest at the crown
      const a = back ? 0.03 + 0.08 * edge ** 6 : 0.005 + 0.26 * edge ** 7 + 0.18 * hot;
      if (a > 0.012) p.blend(x + 0.5, y + 0.5, hot > 0.5 || edge > 0.93 ? C[6] : C[5], a);
      // light from within: warm and brightest at the crown, so the character is lit, not tinted
      if (!back && (x + y) % 2 === 0) p.light(x + 0.5, y + 0.5, C[5], 0.012 + 0.03 * crown + 0.05 * hot);
      void d;
    }
  }
}

function rim(p, C, ph) {
  const k = breath(ph), n = Math.ceil((RX + RY) * Math.PI * 1.7), sw = sheen(ph);
  for (let j = 0; j < n; j++) {
    const g = (j / n) * TAU, y = CY + Math.sin(g) * (RY + k);
    if (y > 2) continue;
    const x = Math.cos(g) * rxAt(y, k) * 0.999 * Math.sign(Math.cos(g) || 1) * Math.sign(Math.cos(g) || 1);
    const xx = Math.cos(g) >= 0 ? rxAt(y, k) : -rxAt(y, k), lit = -Math.cos(g) * 0.6 - Math.sin(g) * 0.8;
    const q = (xx / RX) * 0.6 + ((y - CY) / RY) * 0.9 - sw, hot = Math.abs(q) < 0.12;
    p.dot(xx, y, hot || lit > 0.7 ? WHITE : lit > -0.2 ? C[6] : C[5], 1);
    p.dot(xx + Math.sign(xx || 1), y + (Math.sin(g) < -0.9 ? -1 : 0), C[5], 0.35 + 0.25 * Math.max(0, lit)); // a soft outer glow line
    void x;
  }
  for (const s of [-1, 1]) for (let y = CY - RY; y < 0; y += 8) p.glow(s * rxAt(y, 0), y, 6, C[5], 0.08);
  p.glow(0, CY - RY + 4, 12, C[6], 0.25);
}

// rays fanning out behind the shell, turning slowly (an eighth of a turn a loop), each one breathing
function rays(p, C, ph) {
  const turn = (ph * TAU) / NRAY;
  for (let i = 0; i < NRAY; i++) {
    const g = turn + (i * TAU) / NRAY, k = 0.5 + 0.5 * Math.sin(ph * TAU * 2 + i * 1.7);
    const c = Math.cos(g), s = Math.sin(g);
    if (s > 0.55) continue; // the floor hides the lowest rays
    for (let r = 20; r < 46; r += 0.5) {
      const w = (1 - (r - 20) / 26) * 1.6;
      const x = c * r * 0.75, y = CY + s * r;
      p.blend(x, y, r < 30 ? C[6] : C[5], 0.3 * k * (1 - (r - 20) / 26));
      if (w > 0.9) p.blend(x - s, y + c * 0.75, C[5], 0.12 * k);
    }
    p.glow(c * 30, CY + s * 40, 6, C[5], 0.1 * k);
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D;
  for (let i = -2; i <= 2; i++) p.glow(i * 10, 0, 12, C[4], 0.18);
  rays(p, C, ph);
  film(p, C, ph, true);
  oval(p, 0, 1, POOL, POOL * 0.28, C[5], 0.5, (g) => Math.sin(g) < 0);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ph = t / D, A = o.actor;
  // the shell lights the character warmly from all round
  if (A) for (const [x, y] of shapeOf(A).out) p.light(x, y, C[5], 0.18);
  film(p, C, ph, false);
  rim(p, C, ph);
  oval(p, 0, 1, POOL, POOL * 0.28, (g) => (Math.sin(g) > 0.6 ? C[6] : C[5]), 0.8, (g) => Math.sin(g) >= 0);
  // a halo above the crown, a star where it meets the shell, both breathing
  const b = 0.5 + 0.5 * Math.sin(ph * TAU * 2), hy = CY - RY - 5 - breath(ph);
  oval(p, 0, hy, 8, 2.2, (g) => (Math.sin(g) < 0 ? C[6] : WHITE), 1);
  oval(p, 0, hy, 7, 1.4, C[5], 0.5);
  p.glow(0, hy, 10, C[6], 0.3 + 0.2 * b);
  sparkle(p, 0, CY - RY - breath(ph), 2 + 2 * b, WHITE, C[6], 0.45);
  cycle(t, D, 8, o.seed, (g) => g.range(0.35, 0.6), (age, life, R) => {
    const g = R.range(Math.PI * 1.08, Math.PI * 1.92), y = CY + Math.sin(g) * RY, k = Math.sin((age / life) * Math.PI);
    sparkle(p, (Math.cos(g) >= 0 ? 1 : -1) * rxAt(y, 0), y, 1 + 2 * k, WHITE, C[6], 0.4 * k);
  });
  cycle(t, D, 12, o.seed + 1, (g) => g.range(1.3, 2.2), (age, life, R) => {
    const u = age / life, x = R.range(-0.7, 0.7) * RX + Math.sin(u * 5 + R.range(0, 6)) * 1.5, y = -2 - u * RY * 1.6;
    if (Math.abs(x) > rxAt(y, 0) - 2) return;
    const k = Math.sin(u * Math.PI);
    p.dot(x, y, u < 0.4 ? WHITE : C[6], k);
    p.light(x, y, C[5], 0.3 * k);
  });
}
