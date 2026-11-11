// Render and check this repo's own pixelfx effects (docs/fx/<category>/<name>.js), with one of our units as the
// actor so the size is right. The pixelfx tools only read their own folder, and vendor/pixelfx stays untouched.
// Usage: node tools/fxlab.mjs <id> [--unit knight] [--view front|back] [--opts JSON] [--all] [--gif] [--out DIR]
// Writes <out>/<id>/contact.png (and anim.gif) and prints the checks: canvas bounds, loop seam, randomness, speed.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), FXDIR = join(ROOT, "docs", "fx");
const args = process.argv.slice(2), flags = {}, ids = [];
for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith("--")) { ids.push(args[i]); continue; }
  const k = args[i].slice(2), v = args[i + 1];
  flags[k] = v === undefined || v.startsWith("--") ? true : (i++, v);
}
if (!ids.length) { console.error("usage: node tools/fxlab.mjs <id> [--unit knight] [--view front|back] [--opts JSON] [--all] [--gif]"); process.exit(1); }
// our effects import the pixelfx core from docs/pixelfx, which `npm run site` copies there
if (!existsSync(join(ROOT, "docs/pixelfx/core/index.js"))) spawnSync(process.execPath, [join(ROOT, "tools/site.mjs")], { stdio: "inherit" });

const lib = await import(pathToFileURL(join(ROOT, "vendor/pixelfx/tools/lib/fxlib.mjs")).href);
const core = await import(pathToFileURL(join(ROOT, "vendor/pixelfx/src/core/index.js")).href);
const { drawUnit, setStyle } = await import(pathToFileURL(join(ROOT, "docs/lib/pixelrpg.js")).href);
const { LOOKS } = await import(pathToFileURL(join(ROOT, "docs/lib/presets.js")).href).catch(async () => {
  const m = await import(pathToFileURL(join(ROOT, "docs/lib/pixelrpg.js")).href); return { LOOKS: m.CLASSES };
});
const { actorFrom } = await import(pathToFileURL(join(ROOT, "docs/lib/gearfx.js")).href);
setStyle("muted");

const out = resolve(flags.out ?? join(ROOT, "records")), look = LOOKS[flags.unit ?? "knight"];
const actor = actorFrom(core, drawUnit(look.loadout, flags.view === "back" ? "NW" : "SE", 0, look.body), 24, 72);
for (const id of ids) {
  const fx = await lib.loadEffect(id, FXDIR), opts = { ...JSON.parse(flags.opts ?? "{}"), actor }, notes = [];
  // our own render loop: back layer, our unit (pixelfx's drawActor only draws its stock dummy), front layer
  const [W, H] = fx.meta.size, [OX, OY] = fx.meta.origin, fps = +(flags.fps ?? fx.meta.fps);
  const n = Math.max(1, Math.round(fx.meta.duration * fps) + (fx.meta.loop ? 0 : 1)), bg = core.backdrop("ground", W, H, OY);
  const inst = core.createFx(fx.mod, { x: OX, y: OY, ...opts }), frame = core.createFrame(W, H), frames = [];
  let spent = 0;
  for (let i = 0; i < n; i++) {
    const t1 = performance.now();
    if (i) inst.update(1 / fps);
    core.clearFrame(frame); inst.draw(frame, "back");
    spent += performance.now() - t1;
    const pp = core.painterFor(frame).place(OX, OY);
    for (let j = 0; j < actor.h; j++) for (let k = 0; k < actor.w; k++) { const c = actor.pixels[j * actor.w + k]; if (c) pp.px(actor.x + k, actor.y + j, c); }
    const t2 = performance.now(); inst.draw(frame, "front"); spent += performance.now() - t2;
    frames.push({ t: i / fps, color: core.composite(frame, new Uint8ClampedArray(W * H * 4), bg) });
  }
  const r = { w: W, h: H, fps, n, frames }, ms = spent / n;
  const dir = join(out, id);
  lib.save(join(dir, "contact.png"), lib.contactSheet(fx, r, { max: flags.all ? 400 : +(flags.max ?? 16), zoom: flags.zoom ? +flags.zoom : undefined }));
  if (flags.gif) lib.writeVideo(join(dir, "anim.gif"), r, 4, { loops: 2 });
  // checks: drawing outside the canvas, the loop seam, unseeded randomness, speed
  const M = 12, wide = lib.renderFrames(fx, { fps: 10, bg: "none", margin: M, options: opts });
  let outside = 0;
  for (const f of wide.frames) for (let y = 0; y < wide.h; y++) for (let x = 0; x < wide.w; x++)
    if ((x < M || y < M || x >= wide.w - M || y >= wide.h - M) && f.clear[(y * wide.w + x) * 4 + 3]) outside++;
  if (outside) notes.push(`draws ${outside} pixel(s) outside its canvas`);
  if (fx.meta.loop) {
    const shot = (t) => {
      const fr = core.createFrame(W, H), inst = core.createFx(fx.mod, { x: OX, y: OY, ...opts });
      if (t) inst.update(t);
      inst.draw(fr); return core.composite(fr, new Uint8ClampedArray(W * H * 4), null);
    };
    const a = shot(0), b = shot(fx.meta.duration);
    let diff = 0; for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]) > 8;
    if (diff > 4) notes.push(`loop seam: ${diff} channel values differ between t = 0 and t = duration`);
  }
  if (/Math\.random|Date\.now|new Date/.test(readFileSync(fx.file, "utf8"))) notes.push("uses Math.random or Date");
  if (ms > 2) notes.push(`slow: ${ms.toFixed(2)} ms a frame`);
  console.log(`${id}  ${r.frames.length} frames  ${ms.toFixed(2)} ms/frame  ->  ${join(dir, "contact.png")}`);
  console.log(notes.length ? notes.map((n) => "  ! " + n).join("\n") : "  checks ok");
}
