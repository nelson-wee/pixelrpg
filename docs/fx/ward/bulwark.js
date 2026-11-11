// pixelrpg's own pixelfx effect (status loop). It imports the pixelfx core that `npm run site` copies to docs/pixelfx.
import { fit, sparkle, clamp, smooth, TAU, WHITE } from "../../pixelfx/core/index.js";
import { shapeOf } from "../../pixelfx/fx/holy/_lib.js";

// a phantom heater shield of steel and gold stands guard in front (facing right, like every directional effect)
const D = 3, SX = 22, STOP = -47, SH = 44, SW = 8.5, SKEW = 2.5;

export const meta = {
  name: "Bulwark",
  desc: "A knight's guard: a phantom heater shield of steel and gold stands before the character with its shadow on the floor, riveted rim, embossed cross, a gleam sweeping its face; the armour shines and a glint runs down it.",
  tags: ["knight", "shield", "guard", "armour", "defence", "buff", "character", "loop"],
  size: [84, 100],
  origin: [36, 86],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  // the game's muted steel and gold ramps (docs/lib/pixelrpg.js), with a highlight step on top
  options: { palette: ["#121419", "#383d49", "#5b6272", "#8890a1", "#c2c8d3", "#eef2f8"], trim: ["#211408", "#6a471c", "#9d702c", "#c69746", "#e6c679", "#fff2c8"], behind: false, dir: 1, seed: 3 },
};

// the shield's outline: full width for the top part, then curving in to a point. u across (-1..1), v down (0..1)
const width = (v) => (v < 0.58 ? 1 : Math.sqrt(Math.max(0, 1 - ((v - 0.58) / 0.42) ** 2)));
// screen pixel -> shield coords; seen three-quarters from the front, the far (right) edge sits a little lower.
// dir -1 stands the shield on the left instead (a unit seen from the back faces up-left), without mirroring the body.
function local(x, y, bob, dir) {
  const u = (dir * x - SX) / SW, v = (y - STOP - bob - u * SKEW * 0.5) / SH;
  return [u, v];
}

function shield(p, C, G, ph, a0, dir) {
  const bob = 0, sweep = -0.6 + 2.6 * clamp(ph / 0.45); // the gleam crosses once a loop, then rests
  const x0 = dir > 0 ? SX - SW - 2 : -SX - SW - 2;
  p.each(x0, STOP - 2, x0 + 2 * SW + 4, STOP + SH + SKEW + 3, (x, y, sx, sy) => {
    const [u, v] = local(x, y, bob, dir);
    if (v < 0 || v > 1) return;
    const w = width(v), e = w - Math.abs(u);
    if (e < 0) return;
    const rimW = 0.24, inRim = e < rimW || v < 0.06;
    let c, a = a0;
    if (inRim) {
      // gold trim, lit on the top and left, darker bottom right
      const lit = (u * dir < 0 ? 1 : 0) + (v < 0.12 ? 1 : 0) - (v > 0.7 ? 1 : 0);
      c = lit >= 2 ? G[6] : lit === 1 ? G[5] : lit === 0 ? G[4] : G[3];
      if (e < 0.08 || v < 0.025) c = G[2]; // the outer line, so it reads against anything
    } else {
      // steel face, lit from the left; an embossed cross
      const cross = (Math.abs(u) < 0.12 && v > 0.1 && v < 0.84) || (v > 0.24 && v < 0.31 && Math.abs(u) < 0.64);
      const ridge = cross && (u > 0.05 || (v > 0.28 && v < 0.31 && Math.abs(u) > 0.12));
      const ul = u * dir, base = ul < -0.45 ? 6 : ul < 0.2 ? 5 : 4;
      c = cross ? (ridge ? C[3] : C[6]) : C[base - (v > 0.75 ? 1 : 0)];
      a = a0 * 0.58;
    }
    // the gleam: a diagonal band of white sweeping across the face
    const q = u * 0.45 + v * 1.1 - sweep;
    if (Math.abs(q) < 0.07) (c = WHITE), (a = Math.max(a, 0.9 * a0));
    else if (Math.abs(q) < 0.15 && !inRim) c = C[6];
    p.blendPx(sx, sy, c, a);
  });
  // rivets round the trim, glinting one after another
  for (let k = 0; k < 7; k++) {
    const v = [0.03, 0.03, 0.03, 0.3, 0.3, 0.58, 0.58][k], u = [-0.8, 0, 0.8, -0.88, 0.88, -0.88, 0.88][k];
    const x = dir * (SX + u * SW), y = STOP + bob + v * SH + u * SKEW * 0.5 + 1, hot = Math.abs(((ph * 7 - k) % 7 + 7) % 7) < 0.6;
    p.px(x, y, hot ? WHITE : G[6]);
    if (hot) p.glow(x, y, 4, G[5], 0.4 * a0);
  }
  // the light it gives: cool steel on its face, warm on the trim
  p.glow(dir * (SX - 1), STOP + bob + SH * 0.4, 14, C[5], 0.12 * a0);
  p.glow(dir * SX, STOP + bob + SH * 0.05, 8, G[5], 0.1 * a0);
  const gx = dir * (SX + (sweep - 0.5) * SW * 0.8);
  if (sweep > -0.4 && sweep < 1.6) p.glow(gx, STOP + bob + SH * 0.45, 6, WHITE, 0.25 * a0);
}

// the shield's weight: its shadow on the floor under it, and a cool pool of steel light round that
function ground(p, C, ph, a0, dir) {
  // planted: the point stands on the floor, its shadow falls back toward the character
  p.each(dir > 0 ? SX - 12 : -SX - 6, -3, dir > 0 ? SX + 6 : -SX + 12, 3, (x, y, sx, sy) => {
    const d = Math.hypot((dir * x - SX + 4) / 9, y / 2.2);
    if (d < 1) p.blendPx(sx, sy, 0x0a0812, (0.4 - 0.25 * d) * a0);
  });
  p.glow(dir * SX, -1, 9, C[4], 0.14 * a0);
  // grit pressed up round the point
  for (const [dx, k] of [[-3, 0.6], [-1, 0.9], [2, 0.8], [4, 0.5]]) p.dot(dir * (SX + dx), -1 + Math.abs(dx) * 0.2, C[3], k * a0 * (0.7 + 0.3 * Math.sin(ph * TAU + dx)));
}

// polished armour: a steel glint runs down the character's outline, then rests
function armour(p, C, A, ph) {
  const s = shapeOf(A), band = s.top - 3 + (s.bottom - s.top + 6) * smooth(0.5, 0.95, ph);
  for (const [x, y] of s.edge) {
    const d = Math.abs(y - band);
    if (d < 1.5) p.dot(x, y, x < 0 ? WHITE : C[6], 1);
    else if (d < 4) p.dot(x, y, C[6], 0.5);
    else if (x < 0) p.blend(x, y, C[6], 0.18); // the lit side of the armour shines all the time
  }
  for (const [x, y] of s.out) p.light(x, y, C[5], Math.abs(y - band) < 3 ? 0.35 : 0.06);
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8), G = fit(o.trim, 8), ph = t / D;
  const dir = o.dir < 0 ? -1 : 1;
  if (o.behind) (ground(p, C, ph, 0.6, dir), shield(p, C, G, ph, 0.6, dir));
  else ground(p, C, ph, 1, dir); // facing away: the shield stands beyond the character
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), G = fit(o.trim, 8), ph = t / D, A = o.actor;
  if (A) armour(p, C, A, ph);
  const dir = o.dir < 0 ? -1 : 1;
  if (!o.behind) shield(p, C, G, ph, 1, dir);
  // a star of light where the gleam leaves the top corner
  const k = Math.max(0, 1 - Math.abs(ph - 0.12) / 0.06);
  if (k > 0 && !o.behind) sparkle(p, dir * (SX - SW + 1), STOP + 1, 1 + 3 * k, WHITE, C[6], 0.5 * k);
}
