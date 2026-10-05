// End-to-end: loads the unpacked extension into Chromium and serves Fabric-like fixtures on the
// real portal hostnames (requests are intercepted, nothing goes to the network).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const EXT = path.join(__dirname, '..', '..', 'src');
const FIXTURES = path.join(__dirname, '..', 'fixtures');
const PORTAL = 'https://app.fabric.microsoft.com/groups/me/list';

let context;
let extensionId;
let worker;

test.before(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fab-mask-e2e-'));
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
  await context.route('https://app.fabric.microsoft.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'fabric.html')) }));
  await context.route('https://pbides.powerbi.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'notebook.html')) }));
  worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
});

test.after(async () => {
  if (context) await context.close();
});

const PIXEL = 'url("#fab-mask-pixelate")';
const filterOf = (frame, selector) =>
  frame.locator(selector).evaluate((el) => getComputedStyle(el).filter);

async function setSettings(patch) {
  await worker.evaluate(async (p) => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...(settings || {}), ...p } });
  }, patch);
}

test('masks the portal, the notebook iframe and the title; toggles live', async () => {
  const page = await context.newPage();
  await page.goto(PORTAL);
  const nb = page.frameLocator('#nb');

  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'));
  assert.equal(await filterOf(page, '#ws-id'), PIXEL);
  assert.equal(await filterOf(page, '#endpoint'), PIXEL);
  assert.equal(await filterOf(page, '.row .col-owner'), PIXEL);
  assert.equal(await filterOf(page, '.userInfoCircle'), PIXEL);
  assert.equal(await filterOf(page, '#hdr-owner'), 'none'); // column headers stay readable
  assert.equal(await filterOf(page, '.members-names-list'), PIXEL); // domain admins
  assert.equal(await filterOf(page, '#plain'), 'none');
  assert.equal(await filterOf(page, 'h1.workspace-name'), 'none'); // workspace names are opt-in
  assert.equal(await page.title(), 'lh_gold - Fabric');
  // The page's own APIs stay untouched (a patched attachShadow froze the Angular portal).
  assert.equal(await page.evaluate(() => /\[native code\]/.test(Function.prototype.toString.call(Element.prototype.attachShadow))), true);

  // Cross-origin notebook iframe (pbides.powerbi.com)
  await nb.locator('#path[data-fabric-mask]').waitFor();
  assert.equal(await filterOf(nb.locator('body'), '#cell-email'), PIXEL);
  assert.equal(await filterOf(nb.locator('body'), '#code'), 'none');
  assert.equal(await filterOf(nb.locator('body'), '#cell-amount'), 'none');
  assert.equal(await filterOf(nb.locator('body'), '#split-line'), PIXEL); // Monaco token split
  assert.equal(await filterOf(nb.locator('body'), '#nested'), 'none'); // masked, but inside a masked line

  // Dynamically added row
  await page.evaluate(() => {
    const s = document.createElement('span');
    s.id = 'late';
    s.textContent = 'Modified by john@contoso.com';
    document.body.appendChild(s);
  });
  await page.waitForFunction(() => document.querySelector('#late').hasAttribute('data-fabric-mask'));

  // Opt-in category + custom term, applied live without reload
  await setSettings({ categories: { workspaceNames: true }, customTerms: ['lh_gold'] });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('h1.workspace-name')).filter !== 'none');
  assert.equal(await filterOf(page, '.row .col-workspace'), PIXEL);
  assert.equal(await filterOf(page, '#hdr-location'), 'none');
  await page.waitForFunction(() => document.querySelector('.name-text').hasAttribute('data-fabric-mask'));
  await page.waitForFunction(() => document.title === '•••••• - Fabric');

  // Global off switch (what the popup / Alt+Shift+M does)
  await setSettings({ enabled: false });
  await page.waitForFunction(() => !document.querySelector('#ws-id').hasAttribute('data-fabric-mask'));
  assert.equal(await filterOf(page, '.row .col-owner'), 'none');
  assert.equal(await page.title(), 'lh_gold - Fabric');
  await nb.locator('#path:not([data-fabric-mask])').waitFor();

  await setSettings({ enabled: true, mode: 'redact' });
  await page.waitForFunction(() => document.querySelector('#ws-id').hasAttribute('data-fabric-mask'));
  assert.equal(await page.locator('#ws-id').evaluate((el) => getComputedStyle(el).color), 'rgba(0, 0, 0, 0)');
  await page.close();
});

test('popup renders, reports the page status and toggles masking', async () => {
  await setSettings({ enabled: true, mode: 'blur' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await page.locator('#page-status').filter({ hasText: /.+/ }).waitFor();
  assert.equal(await page.locator('h1').textContent(), 'Fab Mask');
  assert.equal(await page.locator('#enabled').isChecked(), true);
  await page.locator('#enabled').click({ force: true });
  const enabled = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings.enabled);
  assert.equal(enabled, false);
  await page.locator('[data-category="ipAddress"]').check();
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings.categories.ipAddress), true);
  assert.deepEqual(errors, []);
  await page.close();
});

test('options page saves terms and rejects invalid selectors', async () => {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.goto(`chrome-extension://${extensionId}/options/options.html`);
  await page.fill('#customTerms', 'Contoso\nFabrikam');
  await page.fill('#customSelectors', '.ok-selector\n.broken(');
  await page.click('button[type="submit"]');
  await page.locator('#selector-errors:not([hidden])').waitFor();
  const s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.deepEqual(s.customTerms, ['Contoso', 'Fabrikam']);
  assert.deepEqual(s.customSelectors, ['.ok-selector']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('options page keeps selectors added by the picker while editing', async () => {
  await worker.evaluate(() => chrome.storage.local.remove('settings'));
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options/options.html`);
  await page.fill('#customTerms', 'Contoso');
  // picker adds a selector while the user is editing
  await setSettings({ customSelectors: ['#picked'] });
  await page.click('button[type="submit"]');
  await page.locator('#status').filter({ hasText: /.+/ }).waitFor();
  const s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.deepEqual(s.customSelectors, ['#picked']);
  assert.deepEqual(s.customTerms, ['Contoso']);
  assert.equal(await page.inputValue('#customSelectors'), '#picked');
  await page.close();
});

test('badge shows OFF when disabled', async () => {
  await setSettings({ enabled: false });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await worker.evaluate(() => chrome.action.getBadgeText({})), 'OFF');
  await setSettings({ enabled: true });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await worker.evaluate(() => chrome.action.getBadgeText({})), '');
});

test('element picker adds a selector for the clicked element and stops in all frames', async () => {
  await worker.evaluate(() => chrome.storage.local.remove('settings'));
  const page = await context.newPage();
  await page.goto(PORTAL);
  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'));
  await page.frameLocator('#nb').locator('#path[data-fabric-mask]').waitFor();
  await page.bringToFront();

  await worker.evaluate(async () => {
    // Same lookup the popup uses (no "tabs" permission needed): the active tab.
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) await chrome.tabs.sendMessage(tab.id, { type: 'fabric-mask:start-picker' }).catch(() => {});
  });
  await page.hover('#plain');
  await page.waitForFunction(() => document.querySelector('#plain').getAttribute('data-fabric-mask-picker') === 'hover');
  await page.click('#plain');

  await page.waitForFunction((v) => getComputedStyle(document.querySelector('#plain')).filter === v, PIXEL);
  const s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.deepEqual(s.customSelectors, ['#plain']);
  // The notebook frame's picker was stopped via the service worker relay: hovering no longer highlights.
  const nb = page.frameLocator('#nb');
  await nb.locator('#code').hover();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await nb.locator('#code').getAttribute('data-fabric-mask-picker'), null);
  await page.close();
});

test('v1.2: tooltips, learned names, fake data, preview and curtain in the real browser', async () => {
  await worker.evaluate(() => chrome.storage.local.clear());
  const page = await context.newPage();
  await page.goto(PORTAL);
  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'));

  // Tooltip of a sensitive title is masked
  assert.equal(await page.getAttribute('#tip', 'title'), '••••••');

  // "Jane Doe" from the owner column is learned and then masked in the description
  await page.waitForFunction(() => document.querySelector('#desc').hasAttribute('data-fabric-mask'), null, { timeout: 5000 });
  const learned = await worker.evaluate(async () => (await chrome.storage.local.get('learnedNames')).learnedNames);
  assert.ok(learned.includes('Jane Doe'));

  // Fake data: the overlay text is rendered via ::after, the original text is invisible
  await setSettings({ mode: 'fake' });
  await page.waitForFunction(() => document.querySelector('#ws-id').hasAttribute('data-fabric-fake'));
  const after = await page.$eval('#ws-id', (el) => getComputedStyle(el, '::after').content);
  assert.match(after, /^"Workspace ID: [0-9a-f]{8}-/);
  assert.ok(!after.includes('4e864cf8'));
  assert.equal(await page.$eval('#ws-id', (el) => getComputedStyle(el).webkitTextFillColor), 'rgba(0, 0, 0, 0)');

  // Preview: outline + badge
  await setSettings({ mode: 'fake', preview: true });
  await page.waitForSelector('fab-mask-badge', { state: 'attached' });
  assert.match(await page.$eval('#ws-id', (el) => getComputedStyle(el).outlineStyle), /dashed/);

  // Curtain covers the whole viewport (topmost element is the overlay host)
  await worker.evaluate(() => chrome.storage.local.set({ curtain: true }));
  await page.waitForSelector('fab-mask-curtain', { state: 'attached' });
  assert.equal(await page.evaluate(() => document.elementFromPoint(200, 200).localName), 'fab-mask-curtain');
  await worker.evaluate(() => chrome.storage.local.set({ curtain: false }));
  await page.waitForSelector('fab-mask-curtain', { state: 'detached' });
  await page.close();
});

test('v1.2: popup applies a built-in profile and toggles curtain/preview', async () => {
  await worker.evaluate(() => chrome.storage.local.clear());
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await page.selectOption('#profile', 'screenshot');
  await page.waitForFunction(async () => (await chrome.storage.local.get('settings')).settings?.mode === 'redact');
  let s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.equal(s.activeProfile, 'screenshot');
  assert.equal(s.categories.workspaceNames, true);
  // a manual change switches back to "custom"
  await page.locator('[data-category="ipAddress"]').uncheck();
  await page.waitForFunction(async () => (await chrome.storage.local.get('settings')).settings?.activeProfile === 'custom');
  assert.equal(await page.inputValue('#profile'), 'custom');
  await page.click('#curtain');
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('curtain')).curtain), true);
  assert.equal(await page.getAttribute('#curtain', 'aria-pressed'), 'true');
  await page.click('#curtain');
  await page.click('#preview');
  await page.waitForFunction(async () => (await chrome.storage.local.get('settings')).settings?.preview === true);
  s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.equal(s.activeProfile, 'custom');
  await page.close();
});

test('performance: large lists with owners, tooltips and IDs stay fast (all features on)', async () => {
  await worker.evaluate(() => chrome.storage.local.clear());
  const page = await context.newPage();
  await page.goto(PORTAL);
  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'));

  // Renders N rows like a Fabric list, then re-renders their text R times (virtual scrolling).
  const run = () => page.evaluate(async () => {
    const N = 3000, R = 20;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const t0 = performance.now();
    const frag = document.createDocumentFragment();
    for (let i = 0; i < N; i++) {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.className = 'row';
      row.innerHTML = `<span class="col col-name" title="Item ${i}">item_${i}</span>` +
        `<span class="col col-owner" data-testid="fluentListCell.owner" title="Person ${i % 50} Name">Person ${i % 50} Name</span>` +
        `<span class="col">4e864cf8-386d-4067-bfa7-${String(i).padStart(12, '0')}</span>`;
      frag.appendChild(row);
    }
    host.appendChild(frag);
    await new Promise(requestAnimationFrame);
    const insertMs = performance.now() - t0;
    const t1 = performance.now();
    const cells = host.querySelectorAll('.col-name');
    for (let r = 0; r < R; r++) {
      for (let i = 0; i < 200; i++) cells[(r * 200 + i) % N].firstChild.data = `item_${r}_${i}`;
      await new Promise(requestAnimationFrame);
    }
    const churnMs = performance.now() - t1;
    host.remove();
    return { insertMs, churnMs };
  });

  await setSettings({ enabled: false });
  const off = await run();
  await setSettings({ enabled: true, mode: 'fake', stripTooltips: true, preview: true, categories: { learnedNames: true, workspaceNames: true } });
  await page.waitForTimeout(300);
  const on = await run();
  console.log(`perf: off insert ${off.insertMs.toFixed(0)}ms churn ${off.churnMs.toFixed(0)}ms | on insert ${on.insertMs.toFixed(0)}ms churn ${on.churnMs.toFixed(0)}ms`);
  // Budgets are generous for CI machines; the freeze bug took tens of seconds.
  assert.ok(on.insertMs < off.insertMs + 1500, `insert overhead too high: ${on.insertMs} vs ${off.insertMs}`);
  assert.ok(on.churnMs < off.churnMs + 1500, `re-render overhead too high: ${on.churnMs} vs ${off.churnMs}`);
  await page.close();
});

test('v1.3: context menu hides the right-clicked element and the selected text', async () => {
  await worker.evaluate(() => chrome.storage.local.clear());
  const page = await context.newPage();
  await page.goto(PORTAL);
  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'));
  await page.bringToFront();

  // "Always hide this element": a real (trusted) right-click, then the menu item
  await page.click('#plain', { button: 'right' });
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true });
    await self.fabMaskBackground.handleMenuClick({ menuItemId: 'fab-mask-hide-element', frameId: 0 }, tab);
  });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#plain')).filter !== 'none');
  let s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.deepEqual(s.customSelectors, ['#plain']);

  // "Always hide '<selection>'"
  await worker.evaluate(async () => {
    await self.fabMaskBackground.handleMenuClick({ menuItemId: 'fab-mask-add-term', selectionText: '  finance\n team ' }, null);
  });
  await page.waitForFunction(() => document.querySelector('#desc').hasAttribute('data-fabric-mask'));
  s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.ok(s.customTerms.includes('finance team'));
  await page.close();
});

test('v1.3: presentation mode goes full screen, turns masking on and restores the window', async () => {
  await worker.evaluate(() => chrome.storage.local.set({ settings: { enabled: false, presentationProfile: 'recording' } }));
  const page = await context.newPage();
  await page.goto(PORTAL);
  const windowId = await worker.evaluate(async () => (await chrome.windows.getLastFocused()).id);
  const before = await worker.evaluate(async (id) => (await chrome.windows.get(id)).state, windowId);

  assert.equal(await worker.evaluate((id) => self.fabMaskBackground.togglePresentation(id), windowId), true);
  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'));
  const s = await worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  assert.equal(s.enabled, true);
  assert.equal(s.mode, 'fake', 'presentation profile "recording" applied');
  assert.equal(await worker.evaluate(async (id) => (await chrome.windows.get(id)).state, windowId), 'fullscreen');

  assert.equal(await worker.evaluate((id) => self.fabMaskBackground.togglePresentation(id), windowId), false);
  await page.waitForTimeout(300);
  assert.equal(await worker.evaluate(async (id) => (await chrome.windows.get(id)).state, windowId), before === 'fullscreen' ? 'normal' : before);
  await page.close();
});
