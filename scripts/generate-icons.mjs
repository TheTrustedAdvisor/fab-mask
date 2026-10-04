// Generates the extension icons (PNG) without external dependencies.
// Motif: a crossed-out eye on a Fabric-teal rounded square.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons');
const SIZES = [16, 32, 48, 128];
const SAMPLES = 4; // supersampling per axis

const TOP = [0x1d, 0xa3, 0x8a];
const BOTTOM = [0x0a, 0x52, 0x45];
const WHITE = [255, 255, 255];

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function inRoundedRect(x, y, inset, r) {
  const min = inset + r;
  const max = 1 - inset - r;
  const dx = Math.max(min - x, 0, x - max);
  const dy = Math.max(min - y, 0, y - max);
  return dx * dx + dy * dy <= r * r;
}
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

// Returns [r,g,b,a] for a sample point in unit space.
function sample(x, y, size) {
  if (!inRoundedRect(x, y, 0.03, 0.22)) return null;
  const t = (x + y) / 2;
  const bg = TOP.map((c, i) => c + (BOTTOM[i] - c) * t);
  const small = size <= 16;
  const R = 0.5, d = small ? 0.31 : 0.33;
  const inAlmond = Math.hypot(x - 0.5, y - (0.5 + d)) <= R && Math.hypot(x - 0.5, y - (0.5 - d)) <= R;
  const iris = Math.hypot(x - 0.5, y - 0.5);
  const slash = distToSegment(x, y, 0.2, 0.8, 0.8, 0.2);
  const slashW = small ? 0.06 : 0.045;
  let color = bg;
  if (inAlmond) color = WHITE;
  if (inAlmond && iris <= (small ? 0.11 : 0.12)) color = bg;
  if (!small && iris <= 0.055) color = WHITE;
  if (slash <= slashW + (small ? 0.045 : 0.04)) color = bg;
  if (slash <= slashW) color = WHITE;
  return color;
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = sample((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size, size);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const i = (y * size + x) * 4;
      if (a) {
        px[i] = Math.round(r / a);
        px[i + 1] = Math.round(g / a);
        px[i + 2] = Math.round(b / a);
      }
      px[i + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return encodePng(size, px);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(OUT_DIR, `icon${size}.png`), render(size));
  console.log(`icon${size}.png`);
}
