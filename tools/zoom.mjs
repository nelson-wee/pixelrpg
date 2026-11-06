// upscale a PNG by k with nearest neighbour onto a mid-grey background (preview only)
import { readFileSync, writeFileSync } from "node:fs"; import { inflateSync } from "node:zlib";
// Usage: node tools/zoom.mjs <in.png> <out.png> [scale=4] [bg-hex=6a6478]
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [inp, out, k = 4, bg = "6a6478"] = process.argv.slice(2);
const { encodePNG } = await import(pathToFileURL(`${ROOT}/vendor/pixelfx/tools/lib/png.mjs`).href);
const b = readFileSync(inp); let p = 8, w, h, idat = [];
while (p < b.length) { const len = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
  if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); } if (t === "IDAT") idat.push(d); p += 12 + len; }
const raw = inflateSync(Buffer.concat(idat)), st = w * 4, px = new Uint8Array(w * h * 4);
for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)]; for (let x = 0; x < st; x++) { const v = raw[y * (st + 1) + 1 + x];
  const a = x >= 4 ? px[y * st + x - 4] : 0, up = y ? px[(y - 1) * st + x] : 0, c = x >= 4 && y ? px[(y - 1) * st + x - 4] : 0;
  let r = v; if (f === 1) r = v + a; else if (f === 2) r = v + up; else if (f === 3) r = v + ((a + up) >> 1); else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
  px[y * st + x] = r & 255; } }
const K = +k, W = w * K, H = h * K, o = new Uint8ClampedArray(W * H * 4), B = [0, 2, 4].map((i) => parseInt(bg.slice(i, i + 2), 16));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((y / K | 0) * w + (x / K | 0)) * 4, al = px[s + 3] / 255; for (let c = 0; c < 3; c++) o[(y * W + x) * 4 + c] = px[s + c] * al + B[c] * (1 - al); o[(y * W + x) * 4 + 3] = 255; }
writeFileSync(out, encodePNG(W, H, o));
