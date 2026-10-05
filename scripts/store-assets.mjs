// Renders the store promo tiles (Edge Add-ons / Chrome Web Store) from HTML with Playwright.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'images', 'store');
const logo = readFileSync(join(OUT, 'logo-300x300.png')).toString('base64');
const shot = readFileSync(join(OUT, 'portal-pixelate-1280x800.png')).toString('base64');

const tile = (w, h, withShot) => `<!doctype html><html><body style="margin:0">
<div style="width:${w}px;height:${h}px;box-sizing:border-box;display:flex;align-items:center;gap:${h * 0.09}px;
  padding:0 ${h * 0.12}px;background:linear-gradient(135deg,#0c5d4e,#117865 55%,#1a9c84);
  font-family:'Segoe UI',system-ui,sans-serif;color:#fff;overflow:hidden;position:relative">
  <img src="data:image/png;base64,${logo}" style="width:${h * 0.42}px;height:${h * 0.42}px;flex:none;
    filter:drop-shadow(0 4px 12px rgba(0,0,0,.25))">
  <div style="flex:none;max-width:${withShot ? w * 0.6 - h * 0.12 - h * 0.42 - h * 0.09 - 48 : w * 0.6}px">
    <div style="font-size:${h * 0.15}px;font-weight:700;line-height:1.05">Fab Mask</div>
    <div style="font-size:${h * 0.062}px;line-height:1.35;margin-top:${h * 0.04}px;opacity:.92">
      Hide IDs, endpoints, secrets and names in the Microsoft Fabric portal – for demos and screen sharing.</div>
  </div>
  ${withShot ? `<img src="data:image/png;base64,${shot}" style="position:absolute;left:${w * 0.6}px;top:${h * 0.12}px;
    height:${h * 0.95}px;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35)">` : ''}
</div></body></html>`;

const browser = await chromium.launch({ channel: 'chromium' });
for (const [name, w, h, withShot] of [['promo-small-440x280', 440, 280, false], ['promo-large-1400x560', 1400, 560, true]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(tile(w, h, withShot));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`store/${name}.png`);
}
await browser.close();
