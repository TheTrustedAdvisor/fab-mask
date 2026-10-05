// Firefox smoke test: installs dist/firefox (built by `npm run build`) into a real Firefox via
// WebDriver BiDi and checks masking on the Fabric fixtures, the cross-origin notebook frame and the
// popup. Playwright cannot load Firefox add-ons, hence puppeteer-core here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const ADDON = path.join(ROOT, 'dist', 'firefox');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const PORTAL = 'https://app.fabric.microsoft.com/groups/me/list';
// Fixed moz-extension:// UUID so the test can open the popup page.
const UUID = '0f4b7a10-5a1e-4c1d-9a2b-fab0ma5c0001';

function firefoxPath() {
  if (process.env.FIREFOX_PATH) return process.env.FIREFOX_PATH;
  const mac = '/Applications/Firefox.app/Contents/MacOS/firefox';
  if (fs.existsSync(mac)) return mac;
  return 'firefox';
}

let browser;

test.before(async () => {
  assert.ok(fs.existsSync(path.join(ADDON, 'manifest.json')), 'run `npm run build` first');
  browser = await puppeteer.launch({
    browser: 'firefox',
    executablePath: firefoxPath(),
    headless: true,
    extraPrefsFirefox: {
      'extensions.webextensions.uuids': JSON.stringify({ 'fab-mask@thetrustedadvisor': UUID })
    }
  });
  await browser.installExtension(ADDON);
});

test.after(async () => {
  if (browser) await browser.close();
});

async function portalPage() {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('https://app.fabric.microsoft.com/')) {
      req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'fabric.html'), 'utf8') });
    } else if (url.startsWith('https://pbides.powerbi.com/')) {
      req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(FIXTURES, 'notebook.html'), 'utf8') });
    } else {
      req.continue();
    }
  });
  await page.goto(PORTAL);
  return page;
}

const filterOf = (frame, selector) => frame.$eval(selector, (el) => getComputedStyle(el).filter);

test('Firefox: masks the portal, selector fields and the cross-origin notebook frame', async () => {
  const page = await portalPage();
  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'), { timeout: 10000 });
  assert.match(await filterOf(page, '#ws-id'), /url\(.*fab-mask-pixelate/);
  assert.match(await filterOf(page, '#endpoint'), /url\(/);
  assert.match(await filterOf(page, '.row .col-owner'), /url\(/, 'owner cell (selector)');
  assert.equal(await filterOf(page, '#hdr-owner'), 'none', 'column header stays readable');
  assert.equal(await filterOf(page, '#plain'), 'none');
  assert.equal(await page.$eval('#tip', (el) => el.getAttribute('title')), '••••••', 'tooltip masked');

  const nb = page.frames().find((f) => f.url().startsWith('https://pbides.powerbi.com/'));
  assert.ok(nb, 'notebook frame loaded');
  await nb.waitForFunction(() => document.querySelector('#path')?.hasAttribute('data-fabric-mask'), { timeout: 10000 });
  assert.match(await filterOf(nb, '#split-line'), /url\(/, 'Monaco line split across tokens');
  await page.close();
});

test('Firefox: popup renders and toggles masking live', async () => {
  const page = await portalPage();
  await page.waitForFunction(() => document.querySelector('#ws-id')?.hasAttribute('data-fabric-mask'), { timeout: 10000 });

  const popup = await browser.newPage();
  const errors = [];
  popup.on('pageerror', (e) => errors.push(e));
  await popup.goto(`moz-extension://${UUID}/popup/popup.html`);
  await popup.waitForSelector('#enabled');
  assert.equal(await popup.$eval('h1', (el) => el.textContent), 'Fab Mask');
  assert.equal(await popup.$eval('#enabled', (el) => el.checked), true);

  await popup.click('#enabled');
  await page.waitForFunction(() => !document.querySelector('#ws-id').hasAttribute('data-fabric-mask'), { timeout: 10000 });
  await popup.click('#enabled');
  await page.waitForFunction(() => document.querySelector('#ws-id').hasAttribute('data-fabric-mask'), { timeout: 10000 });
  assert.deepEqual(errors, []);
  await popup.close();
  await page.close();
});
