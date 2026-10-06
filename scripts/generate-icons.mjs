// Generates the extension icons (PNG) without external dependencies.
// Motif: a crossed-out eye on a Fabric-teal rounded square.
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderIcon } from './icon-render.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'icons');
const SIZES = [16, 32, 48, 128];
// Store logo (Edge Add-ons: 300×300 recommended; Chrome Web Store uses the 128 px icon).
const STORE_DIR = join(ROOT, 'docs', 'images', 'store');
const STORE_SIZES = [300];
mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(OUT_DIR, `icon${size}.png`), renderIcon(size));
  console.log(`icon${size}.png`);
}
mkdirSync(STORE_DIR, { recursive: true });
for (const size of STORE_SIZES) {
  writeFileSync(join(STORE_DIR, `logo-${size}x${size}.png`), renderIcon(size));
  console.log(`store/logo-${size}x${size}.png`);
}
