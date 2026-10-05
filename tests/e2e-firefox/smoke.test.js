// Firefox smoke test: installs dist/firefox (built by `npm run build`) into a real Firefox via
// WebDriver BiDi and checks masking on the Fabric fixtures and the cross-origin notebook frame.
// Playwright cannot load Firefox add-ons, hence puppeteer-core here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const ADDON = path.join(ROOT, 'dist', 'firefox');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const PORTAL = 'https://app.fabric.microsoft.com/groups/me/list';

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
    headless: true
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

// The popup/options pages cannot be tested here: WebDriver BiDi refuses to navigate to
// moz-extension:// URLs. They share all logic with Chrome/Edge (covered by tests/e2e) and differ
// only in using the promise-based browser.* namespace.
