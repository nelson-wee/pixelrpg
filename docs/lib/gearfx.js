// Live gear effects: pixelfx effects that wrap a piece of gear (or the whole unit) while it is equipped.
// pixelfx body effects read a character mask through o.actor. We give them our own masks instead of the stock
// character: the piece's own pixels ("self", e.g. a burning blade) or the whole dressed unit ("body", e.g. an aura).
// Works in Node and in the browser: pass in the pixelfx core module and the effect modules you have loaded.
import { GEAR, R } from "./pixelrpg.js";

/** The equipped pieces that carry an effect: [{ slot, id, spec }]. Two-handed weapons skip the off hand. */
export function fxPieces(lo, twoHanded = []) {
  const out = [];
  for (const [slot, id] of Object.entries(lo)) {
    if (!id || (slot === "off" && twoHanded.includes(lo.main))) continue;
    const g = GEAR[slot]?.[id];
    if (g?.fx) out.push({ slot, id, spec: g.fx });
  }
  return out;
}

/** A pixelfx actor (mask, colours, head and chest, feet at 0,0) from one of our images whose feet are at (fx, fy). */
export function actorFrom(pfx, img, fx, fy) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  img.c.forEach((v, i) => {
    if (!v || v.a !== undefined) return; // skip empty pixels and the ground shadow
    const x = i % img.w, y = (i / img.w) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  });
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8Array(w * h), pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = img.c[(y + y0) * img.w + x + x0];
    if (!v || v.a !== undefined) continue;
    data[y * w + x] = 1; pixels[y * w + x] = pfx.hex(v.hex ?? R[v.r][v.i]);
  }
  const cx = (x0 + x1) / 2 - fx;
  return { mask: { w, h, data }, pixels, x: x0 - fx, y: y0 - fy, w, h, k: 2, head: [cx, y0 - fy], chest: [cx, y0 + h * 0.35 - fy] };
}

/** Alpha-blend RGBA src over dst (same size), in place. */
export function over(dst, src) {
  for (let i = 0; i < dst.length; i += 4) {
    const a = src[i + 3] / 255; if (!a) continue;
    const da = dst[i + 3] / 255, oa = a + da * (1 - a);
    for (let c = 0; c < 3; c++) dst[i + c] = (src[i + c] * a + dst[i + c] * da * (1 - a)) / (oa || 1);
    dst[i + 3] = oa * 255;
  }
  return dst;
}

/** Copy an RGBA image of size (w, h) into a bigger RGBA buffer of width W at (x, y). */
export function place(dst, W, H, src, w, h, x, y) {
  for (let yy = 0; yy < h; yy++) {
    const ty = y + yy; if (ty < 0 || ty >= H) continue;
    for (let xx = 0; xx < w; xx++) {
      const tx = x + xx; if (tx < 0 || tx >= W) continue;
      const s = (yy * w + xx) * 4; if (!src[s + 3]) continue;
      dst.set(src.subarray(s, s + 4), (ty * W + tx) * 4);
    }
  }
  return dst;
}

/**
 * One running effect per equipped fx piece, on its own clock. Each frame, call layers() with the images the
 * effects should wrap; it returns the back and front layers (RGBA, W x H) to draw behind and over the unit.
 */
export class GearFx {
  constructor(pfx, mods, W, H, feet) {
    Object.assign(this, { pfx, mods, W, H, feet, items: new Map(), frame: pfx.createFrame(W, H) });
  }
  sync(pieces) {
    const keep = new Set();
    for (const p of pieces) {
      const key = `${p.slot}.${p.id}`, mod = this.mods[p.spec.id];
      if (!mod) continue;
      keep.add(key);
      if (this.items.has(key)) continue;
      const actor = { mask: { w: 1, h: 1, data: new Uint8Array(1) }, pixels: new Uint32Array(1), x: 0, y: -1, w: 1, h: 1, k: 2, head: [0, -1], chest: [0, -1] };
      const inst = this.pfx.createFx(mod, { x: this.feet[0], y: this.feet[1], actor, seed: key.length * 7, ...(p.spec.opts ?? {}) });
      this.items.set(key, { ...p, inst, actor });
    }
    for (const k of [...this.items.keys()]) if (!keep.has(k)) this.items.delete(k);
    return this.items.size;
  }
  step(dt) { for (const it of this.items.values()) it.inst.update(dt); }
  /** source(item) -> { img, fx, fy }: the image this effect wraps now, with that image's own feet position. */
  layers(source) {
    const { pfx, frame, W, H } = this, back = new Uint8ClampedArray(W * H * 4), front = new Uint8ClampedArray(W * H * 4);
    const live = []; // only effects whose piece is in this frame (a loadout change can lag one frame behind)
    for (const it of this.items.values()) {
      const s = source(it), a = s?.img && actorFrom(pfx, s.img, s.fx, s.fy);
      if (a) { Object.assign(it.actor, a); live.push(it); }
    }
    pfx.clearFrame(frame); for (const it of live) it.inst.draw(frame, "back"); pfx.composite(frame, back, null);
    pfx.clearFrame(frame); for (const it of live) it.inst.draw(frame, "front"); pfx.composite(frame, front, null);
    return { back, front };
  }
}
