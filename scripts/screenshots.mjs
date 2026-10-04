// Renders README / store screenshots with the real extension loaded (Playwright Chromium).
// The demo page (docs/demo/workspace.html, fake data) is served on the portal hostname.
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
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
const set = (s) => worker.evaluate((v) => chrome.storage.local.set({ settings: v }), s);

const page = await context.newPage();
await set({ enabled: false });
await page.goto('https://app.fabric.microsoft.com/demo');
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'demo-unmasked.png') });

await set({ enabled: true });
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'demo-masked.png') });

await set({ enabled: true, mode: 'redact', categories: { workspaceNames: true }, customTerms: ['Contoso'] });
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, 'demo-redacted.png') });
await set({});

for (const scheme of ['light', 'dark']) {
  const p = await context.newPage();
  await p.emulateMedia({ colorScheme: scheme });
  await p.setViewportSize({ width: 320, height: 760 });
  await p.goto(`chrome-extension://${id}/popup/popup.html`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(OUT, `popup-${scheme}.png`), fullPage: true });
}
const o = await context.newPage();
await o.setViewportSize({ width: 1280, height: 800 });
await o.goto(`chrome-extension://${id}/options/options.html`);
await o.fill('#customTerms', 'Contoso\nFabrikam\nJane Doe');
await o.waitForTimeout(200);
await o.screenshot({ path: join(OUT, 'options.png') });
await context.close();
console.log(`Screenshots written to ${OUT}`);
