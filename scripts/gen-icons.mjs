// Generates the PWA icon set (no external deps) into public/icons.
// Design: deep-night vertical gradient + a crescent moon + a few stars,
// matching the app's "night" palette (#0e0b29 → #1a1640, accent #9398ff).
//
// Run: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// ---- minimal PNG (RGBA, 8-bit) encoder -----------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing --------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
function draw(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  // On maskable icons the OS may crop ~10% on each side, so keep the moon
  // smaller and well inside the safe zone.
  const scale = maskable ? 0.74 : 1;
  const moonR = size * 0.26 * scale;
  const moonCx = cx + size * 0.04;
  const moonCy = size * 0.46;
  const cutR = moonR * 0.86;
  const cutCx = moonCx + moonR * 0.55;
  const cutCy = moonCy - moonR * 0.28;

  // a few stars (x, y, radius) as fractions of size
  const stars = [
    [0.24, 0.26, 0.018],
    [0.74, 0.7, 0.022],
    [0.3, 0.72, 0.014],
    [0.68, 0.28, 0.012],
  ].map(([fx, fy, fr]) => [fx * size, fy * size, fr * size]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // vertical gradient background #0e0b29 -> #1a1640
      const t = y / size;
      let r = lerp(0x0e, 0x24, t);
      let g = lerp(0x0b, 0x1f, t);
      let b = lerp(0x29, 0x52, t);
      let a = 255;

      // crescent = moon disc minus the cut disc, accent #b9bdff
      const dM = Math.hypot(x - moonCx, y - moonCy);
      const dC = Math.hypot(x - cutCx, y - cutCy);
      if (dM <= moonR && dC > cutR) {
        const edge = Math.min(1, (moonR - dM) / 2, (dC - cutR) / 2);
        const k = Math.max(0, Math.min(1, edge));
        r = lerp(r, 0xc4, k);
        g = lerp(g, 0xc7, k);
        b = lerp(b, 0xff, k);
      }

      // stars (soft white)
      for (const [sx, sy, sr] of stars) {
        const d = Math.hypot(x - sx, y - sy);
        if (d <= sr) {
          const k = Math.max(0, Math.min(1, (sr - d) / Math.max(1, sr * 0.6)));
          r = lerp(r, 0xff, k);
          g = lerp(g, 0xff, k);
          b = lerp(b, 0xff, k);
        }
      }

      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return encodePNG(size, size, buf);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ["icon-192.png", draw(192)],
  ["icon-512.png", draw(512)],
  ["maskable-512.png", draw(512, { maskable: true })],
  ["apple-touch-icon.png", draw(180)],
];
for (const [name, png] of files) {
  writeFileSync(join(OUT, name), png);
  console.log("wrote", join("public/icons", name), png.length, "bytes");
}
