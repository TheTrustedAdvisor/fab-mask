const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const path = require('node:path');
const fs = require('node:fs');

const SCRIPTS = ['shared/settings.js', 'shared/detector.js', 'shared/styles.js', 'content/picker.js', 'content/masker.js']
  .map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'));

const GUID = '4e864cf8-386d-4067-bfa7-4ef5e408c474';
const tick = () => new Promise((r) => setTimeout(r, 0));
const instances = [];
test.after(() => {
  for (const { masker, window } of instances) {
    masker.stop();
    window.close();
  }
});

function setup(html = '<!doctype html><html><head><title>Fabric</title></head><body></body></html>') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://app.fabric.microsoft.com/home' });
  const { window } = dom;
  for (const src of SCRIPTS) window.eval(src);
  const listeners = [];
  const chrome = {
    storage: { onChanged: { addListener: (f) => listeners.push(f), removeListener() {} } },
    runtime: { onMessage: { addListener() {}, removeListener() {} }, sendMessage: () => Promise.resolve() }
  };
  const masker = window.FabricMask.createMasker({ window, chrome, FabricMask: window.FabricMask });
  masker.start();
  instances.push({ masker, window });
  const emit = (settings) => listeners.forEach((f) => f({ settings: { newValue: settings } }, 'local'));
  return { window, document: window.document, masker, emit };
}

const isMasked = (el) => el.hasAttribute('data-fabric-mask');

test('injects stylesheet and masks existing + added content before paint', async () => {
  const { document } = setup(`<!doctype html><html><head><title>x</title></head><body><div id="a">ID ${GUID}</div><span id="b">Report</span></body></html>`);
  assert.ok(document.querySelector('style[data-fabric-mask-style]'));
  assert.ok(isMasked(document.getElementById('a')));
  assert.ok(!isMasked(document.getElementById('b')));

  const row = document.createElement('div');
  row.innerHTML = '<span class="owner">jane@contoso.com</span><span class="name">Sales</span>';
  document.body.appendChild(row);
  await tick();
  assert.ok(isMasked(row.querySelector('.owner')));
  assert.ok(!isMasked(row.querySelector('.name')));
  assert.ok(!isMasked(row), 'only the direct parent of the text is masked');
});

test('virtual scrolling: recycled elements are unmasked when their text changes', async () => {
  const { document } = setup();
  const cell = document.createElement('span');
  cell.textContent = 'jane@contoso.com';
  document.body.appendChild(cell);
  await tick();
  assert.ok(isMasked(cell));
  cell.firstChild.data = 'Quarterly report'; // characterData mutation
  await tick();
  assert.ok(!isMasked(cell));
  cell.textContent = `abfss://ws@onelake.dfs.fabric.microsoft.com/${GUID}`; // childList mutation
  await tick();
  assert.ok(isMasked(cell));
});

test('inputs are evaluated on input events and by polling; passwords are ignored', async () => {
  const { document, window, masker } = setup('<!doctype html><html><body><input id="i"><textarea id="t"></textarea><input id="p" type="password" value="Password=SuperSecret1"></body></html>');
  const input = document.getElementById('i');
  input.value = 'Server=tcp:x.database.windows.net;';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.ok(isMasked(input));
  const ta = document.getElementById('t');
  ta.value = `token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U`;
  masker.pollInputs(); // framework set .value without events
  assert.ok(isMasked(ta));
  assert.ok(!isMasked(document.getElementById('p')));
});

test('open shadow roots get their own stylesheet and are observed', async () => {
  const { document } = setup();
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<span id="s">${GUID}</span>`;
  document.body.appendChild(host);
  await tick();
  assert.ok(root.querySelector('style[data-fabric-mask-style]'));
  assert.ok(isMasked(root.getElementById('s')));
  const late = document.createElement('b');
  late.textContent = 'jane@contoso.com';
  root.appendChild(late);
  await tick();
  assert.ok(isMasked(late));
});

test('tab title is redacted and restored', async () => {
  const { document, emit } = setup(`<!doctype html><html><head><title>Fabric</title></head><body></body></html>`);
  document.title = `Lakehouse ${GUID} - Fabric`;
  await tick();
  assert.equal(document.title, 'Lakehouse •••••• - Fabric');
  emit({ enabled: false });
  assert.equal(document.title, `Lakehouse ${GUID} - Fabric`);
  emit({ enabled: true });
  assert.equal(document.title, 'Lakehouse •••••• - Fabric');
  emit({ enabled: true, maskTitle: false });
  assert.equal(document.title, `Lakehouse ${GUID} - Fabric`);
});

test('settings changes apply live: disable, categories, custom terms, custom selectors', async () => {
  const { document, emit } = setup(`<!doctype html><html><body><span id="g">${GUID}</span><span id="c">Contoso Finance</span><div class="ws">X</div></body></html>`);
  const g = document.getElementById('g');
  const c = document.getElementById('c');
  const style = document.querySelector('style[data-fabric-mask-style]');
  assert.ok(isMasked(g) && !isMasked(c));

  emit({ enabled: false });
  assert.ok(!isMasked(g));
  assert.ok(!style.textContent.includes('filter:'));

  emit({ customTerms: ['contoso'], categories: { guid: false } });
  assert.ok(!isMasked(g));
  assert.ok(isMasked(c));

  emit({ customSelectors: ['.ws'], mode: 'blur' });
  assert.match(style.textContent, /:is\(\.ws\)\{filter:blur/);
});

test('text split across inline elements is detected and re-evaluated', async () => {
  const { document } = setup('<!doctype html><html><body><div id="d">jane<mark>@contoso</mark>.com</div><div id="n">Sales <b>2024</b></div><p id="big"><span>x</span><div>jane@contoso.com</div></p></body></html>');
  const d = document.getElementById('d');
  assert.ok(isMasked(d));
  assert.ok(!isMasked(document.getElementById('n')));
  d.querySelector('mark').firstChild.data = ' and ';
  await tick();
  assert.ok(!isMasked(d), 'parent re-evaluated when inline child text changes');
});

test('mosaic filter is injected into document and shadow roots and follows the strength', async () => {
  const { document, emit } = setup();
  const filter = () => document.getElementById('fab-mask-pixelate');
  assert.ok(filter(), 'filter present in document');
  assert.equal(filter().querySelector('feMorphology').getAttribute('radius'), '4'); // 8px blocks
  emit({ blurPx: 12 });
  assert.equal(filter().querySelector('feMorphology').getAttribute('radius'), '6');
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<b>jane@contoso.com</b>';
  document.body.appendChild(host);
  await tick();
  assert.ok(root.getElementById('fab-mask-pixelate'), 'filter present in shadow root');
  assert.ok(!document.querySelector('svg[data-fabric-mask-style] [data-fabric-mask]'), 'filter svg is never scanned');
});

test('Monaco lines are tested as a whole (tokens split across spans)', async () => {
  const { document } = setup(`<!doctype html><html><body><div class="view-lines">
    <div class="view-line" id="l1"><span><span>"abfss://ws@one</span><span>lake.dfs.fabric.microsoft.com/4e864cf8-386d-</span><span>4067-bfa7-4ef5e408c474"</span></span></div>
    <div class="view-line" id="l2"><span><span>display(df)</span></span></div>
  </div></body></html>`);
  assert.ok(isMasked(document.getElementById('l1')));
  assert.ok(!isMasked(document.getElementById('l2')));
  // Monaco re-renders a line by replacing its spans
  document.getElementById('l2').firstChild.innerHTML = '<span>id = "4e864cf8-386d-4067-</span><span>bfa7-4ef5e408c474"</span>';
  await tick();
  assert.ok(isMasked(document.getElementById('l2')));
});

test('adjacent text nodes are tested joined', () => {
  const { document } = setup();
  const el = document.createElement('span');
  el.append('jane', '@contoso', '.com');
  document.body.appendChild(el);
  return tick().then(() => assert.ok(isMasked(el)));
});

test('late shadow roots are picked up via the main-world hook event', async () => {
  const { document, window } = setup();
  const host = document.createElement('x-late');
  document.body.appendChild(host);
  await tick();
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<span id="s">${GUID}</span>`;
  host.dispatchEvent(new window.Event('fab-mask-shadow-attached', { bubbles: true, composed: true }));
  assert.ok(root.querySelector('style[data-fabric-mask-style]'));
  assert.ok(isMasked(root.getElementById('s')));
});

test('late shadow roots nested inside another shadow root are found', async () => {
  const { document, window } = setup();
  const outer = document.createElement('x-outer');
  const outerRoot = outer.attachShadow({ mode: 'open' });
  document.body.appendChild(outer);
  await tick();
  const inner = document.createElement('x-inner');
  outerRoot.appendChild(inner);
  await tick();
  const innerRoot = inner.attachShadow({ mode: 'open' });
  innerRoot.innerHTML = '<span id="s">jane@contoso.com</span>';
  inner.dispatchEvent(new window.Event('fab-mask-shadow-attached', { bubbles: true, composed: true }));
  assert.ok(innerRoot.querySelector('style[data-fabric-mask-style]'));
  assert.ok(isMasked(innerRoot.getElementById('s')));
});

test('stylesheet is restored when its parent is replaced', async () => {
  const { document } = setup();
  const html = document.documentElement;
  document.removeChild(html);
  document.appendChild(document.createElement('html'));
  await tick();
  assert.ok(document.querySelector('style[data-fabric-mask-style]'));
});

test('stylesheet is re-inserted when the page removes it', async () => {
  const { document } = setup();
  document.querySelector('style[data-fabric-mask-style]').remove();
  await tick();
  assert.ok(document.querySelector('style[data-fabric-mask-style]'));
});

test('picker generates stable selectors and skips generated tokens', () => {
  const { document, window } = setup(`<!doctype html><html><body>
    <owner-details><section><span class="property-value tri-a1b2c3 ng-star-inserted"><a>Jane</a></span></section></owner-details>
    <div data-testid="copy-box"><span data-testid="copy-content">x</span></div>
    <div id="cdk-overlay-123"><span class="user-email">a</span></div>
  </body></html>`);
  const gen = window.FabricMask.generateSelector;
  assert.equal(gen(document.querySelector('[data-testid="copy-content"]')), 'span[data-testid="copy-content"]');
  assert.equal(gen(document.querySelector('.user-email')), 'span.user-email');
  const sel = gen(document.querySelector('.property-value'));
  assert.ok(!/ng-star|a1b2c3/.test(sel), sel);
  assert.equal(document.querySelectorAll(sel).length, 1);
});
