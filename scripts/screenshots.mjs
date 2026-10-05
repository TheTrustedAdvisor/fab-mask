// Renders README / store screenshots with the real extension loaded (Playwright Chromium).
// The demo page (docs/demo/workspace.html, fake data) is served on the portal hostname.
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'src');
const OUT = join(ROOT, 'docs', 'images');
const DEMO = readFileSync(join(ROOT, 'docs', 'demo', 'workspace.html'));

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'fab-mask-shots-')), {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
});
await context.route('https://app.fabric.microsoft.com/**', (r) => r.fulfill({ contentType: 'text/html', body: DEMO }));
const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
const id = new URL(worker.url()).host;
// onInstalled writes the default settings (masking on) asynchronously and creates the fake salt
// last. Wait for it, otherwise it overwrites the "unmasked" settings below and both shots match.
await worker.evaluate(async () => {
  for (let i = 0; i < 100 && !(await chrome.storage.local.get('fakeSalt')).fakeSalt; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
});
const set = (s) => worker.evaluate((v) => chrome.storage.local.set({ settings: v }), s);
const masked = () => page.evaluate(() => document.querySelectorAll('[data-fabric-mask]').length);

const page = await context.newPage();
await set({ enabled: false });
await page.goto('https://app.fabric.microsoft.com/demo');
await page.waitForTimeout(300);
if (await masked()) throw new Error('"unmasked" screenshot would show masked content');
await page.screenshot({ path: join(OUT, 'demo-unmasked.png') });

await set({ enabled: true });
await page.waitForFunction(() => document.querySelectorAll('[data-fabric-mask]').length > 0);
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'demo-masked.png') });

await set({ enabled: true, mode: 'redact', categories: { workspaceNames: true }, customTerms: ['Contoso'] });
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'demo-redacted.png') });

await set({ enabled: true, mode: 'fake', categories: { workspaceNames: true }, customTerms: ['Contoso'] });
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'demo-fake.png') });

await set({ enabled: true, mode: 'pixelate', preview: true });
await page.waitForTimeout(1300); // badge counter refreshes once per second
await page.screenshot({ path: join(OUT, 'demo-preview.png') });

await worker.evaluate(() => chrome.storage.local.set({ curtain: true }));
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'demo-curtain.png') });
await worker.evaluate(() => chrome.storage.local.set({ curtain: false }));
await set({});

for (const scheme of ['light', 'dark']) {
  const p = await context.newPage();
  await p.emulateMedia({ colorScheme: scheme });
  await p.setViewportSize({ width: 640, height: 600 });
  await p.goto(`chrome-extension://${id}/popup/popup.html`);
  await p.waitForTimeout(300);
  const height = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: 640, height });
  await p.screenshot({ path: join(OUT, `popup-${scheme}.png`) });
}
const o = await context.newPage();
await o.setViewportSize({ width: 1280, height: 800 });
await o.goto(`chrome-extension://${id}/options/options.html`);
await o.fill('#customTerms', 'Contoso\nFabrikam\nJane Doe');
await o.waitForTimeout(200);
await o.screenshot({ path: join(OUT, 'options.png'), fullPage: true });
await context.close();

// Guard against regressions like identical before/after images.
const demoShots = ['demo-unmasked', 'demo-masked', 'demo-fake', 'demo-preview', 'demo-redacted', 'demo-curtain'];
const hashes = new Map();
for (const name of demoShots) {
  const h = createHash('sha256').update(readFileSync(join(OUT, `${name}.png`))).digest('hex');
  if (hashes.has(h)) throw new Error(`${name}.png is identical to ${hashes.get(h)}.png`);
  hashes.set(h, name);
}
console.log(`Screenshots written to ${OUT} (all ${demoShots.length} demo shots differ)`);
