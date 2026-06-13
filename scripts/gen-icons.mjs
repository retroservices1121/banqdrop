// Dependency-free PNG icon generator for the PWA. Draws a banqdrop "droplet" mark
// on a brand background, at the sizes a manifest + iOS need. No canvas/sharp.
//   node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const crcTable = (() => {
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
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.subarray(y * width * 4, (y + 1) * width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// brand: ink background, emerald->violet droplet
const INK = [13, 15, 26];
const DROP_TOP = [52, 211, 153]; // emerald-400
const DROP_BOT = [167, 139, 250]; // violet-400

function render(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const R = size * (maskable ? 0.17 : 0.2);
  const cy = size * 0.57;
  const apexY = cy - 1.7 * R;
  const radius = maskable ? 0 : size * 0.22; // rounded corners (skip for maskable safe area)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // rounded-rect background
      let inBg = true;
      if (radius > 0) {
        const rx = Math.min(x, size - 1 - x);
        const ry = Math.min(y, size - 1 - y);
        if (rx < radius && ry < radius) {
          const dx = radius - rx;
          const dy = radius - ry;
          inBg = dx * dx + dy * dy <= radius * radius;
        }
      }
      let r = INK[0], g = INK[1], b = INK[2], a = inBg ? 255 : 0;

      // droplet: circle body + tapering triangle apex
      const inBody = (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
      let inApex = false;
      if (y >= apexY && y < cy) {
        const halfW = ((y - apexY) / (cy - apexY)) * R * 0.98;
        inApex = Math.abs(x - cx) <= halfW;
      }
      if (inBg && (inBody || inApex)) {
        const t = Math.max(0, Math.min(1, (y - apexY) / (cy + R - apexY)));
        r = Math.round(DROP_TOP[0] + (DROP_BOT[0] - DROP_TOP[0]) * t);
        g = Math.round(DROP_TOP[1] + (DROP_BOT[1] - DROP_TOP[1]) * t);
        b = Math.round(DROP_TOP[2] + (DROP_BOT[2] - DROP_TOP[2]) * t);
        a = 255;
      }
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return png(size, size, buf);
}

writeFileSync(`${OUT}/icon-192.png`, render(192, { maskable: false }));
writeFileSync(`${OUT}/icon-512.png`, render(512, { maskable: false }));
writeFileSync(`${OUT}/maskable-512.png`, render(512, { maskable: true }));
writeFileSync(`${OUT}/apple-touch-icon.png`, render(180, { maskable: true }));

// Open Graph / social share image (1200x630): ink bg, droplet, four bucket dots.
function renderOG() {
  const W = 1200, H = 630;
  const buf = Buffer.alloc(W * H * 4);
  const cx = 380, cy = 315, R = 120, apexY = cy - 1.7 * R;
  const dots = [
    { x: 720, c: [34, 197, 94] },
    { x: 840, c: [59, 130, 246] },
    { x: 960, c: [168, 85, 247] },
    { x: 1080, c: [245, 158, 11] },
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r = INK[0], g = INK[1], b = INK[2];
      const inBody = (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
      let inApex = false;
      if (y >= apexY && y < cy) inApex = Math.abs(x - cx) <= ((y - apexY) / (cy - apexY)) * R * 0.98;
      if (inBody || inApex) {
        const t = Math.max(0, Math.min(1, (y - apexY) / (cy + R - apexY)));
        r = Math.round(DROP_TOP[0] + (DROP_BOT[0] - DROP_TOP[0]) * t);
        g = Math.round(DROP_TOP[1] + (DROP_BOT[1] - DROP_TOP[1]) * t);
        b = Math.round(DROP_TOP[2] + (DROP_BOT[2] - DROP_TOP[2]) * t);
      }
      for (const d of dots) {
        if ((x - d.x) ** 2 + (y - cy) ** 2 <= 40 * 40) {
          r = d.c[0]; g = d.c[1]; b = d.c[2];
        }
      }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return png(W, H, buf);
}
writeFileSync("public/og.png", renderOG());
console.log("icons + og.png written");
