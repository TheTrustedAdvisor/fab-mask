// Tests for v1.2 features: learned names, tooltip masking, fake data, curtain, preview, profiles.
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const path = require('node:path');
const fs = require('node:fs');
const fake = require('../src/shared/fake.js');
const { createDetector } = require('../src/shared/detector.js');
const settingsApi = require('../src/shared/settings.js');

const SCRIPTS = ['shared/settings.js', 'shared/detector.js', 'shared/fake.js', 'shared/styles.js', 'content/picker.js', 'content/masker.js']
  .map((f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'));
const GUID = '4e864cf8-386d-4067-bfa7-4ef5e408c474';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const instances = [];
test.after(() => {
  for (const { masker, window } of instances) {
    masker.stop();
    window.close();
  }
});

/** In-memory chrome.storage.local with onChanged events, like the real thing. */
function fakeChrome(initial = {}) {
  const data = structuredClone(initial);
  const listeners = [];
  return {
    data,
    storage: {
      local: {
        get: async (key) => ({ [key]: structuredClone(data[key]) }),
        set: async (items) => {
          const changes = {};
          for (const [k, v] of Object.entries(items)) {
            changes[k] = { oldValue: data[k], newValue: structuredClone(v) };
            data[k] = structuredClone(v);
          }
          for (const l of listeners) l(changes, 'local');
        }
      },
      onChanged: { addListener: (f) => listeners.push(f), removeListener() {} }
    },
    runtime: {
      onMessage: { addListener() {}, removeListener() {} },
      sendMessage: () => Promise.resolve() // replaced in setup() by a service-worker stand-in
    },
    i18n: { getMessage: (key, subs) => (subs ? `${key}:${subs.join(',')}` : key) }
  };
}

async function setup(html, stored = {}) {
  const dom = new JSDOM(html || '<!doctype html><html><head><title>Fabric</title></head><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://app.fabric.microsoft.com/home'
  });
  const { window } = dom;
  const chrome = fakeChrome(stored);
  window.chrome = chrome; // used by the shared storage helpers (no runtime.id → no auto-start)
  window.structuredClone = (v) => JSON.parse(JSON.stringify(v)); // jsdom lacks it; browsers have it
  for (const src of SCRIPTS) window.eval(src);
  // Stand-in for the service worker, which merges learned names centrally.
  chrome.runtime.sendMessage = async (msg) => {
    if (msg.type === 'fabric-mask:learn-names') await window.FabricMask.addLearnedNames(msg.names);
  };
  const masker = window.FabricMask.createMasker({ window, chrome, FabricMask: window.FabricMask });
  masker.start();
  instances.push({ masker, window });
  await tick(5); // stored settings / names / curtain load
  return { window, document: window.document, masker, chrome, FM: window.FabricMask };
}

// ------------------------------------------------------------------- fake data

test('fake values are deterministic and well-formed', () => {
  assert.equal(fake.fakeGuid(GUID), fake.fakeGuid(GUID.toUpperCase()));
  assert.match(fake.fakeGuid(GUID), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(fake.fakeGuid(GUID), GUID);
  assert.match(fake.fakeEmail('jane.doe@contoso.com'), /^[a-z]+\.[a-z]+@contoso\.com$/);
  assert.equal(fake.fakeName('Jane Doe'), fake.fakeName('jane doe'));
  assert.equal(fake.fakeName('Jane Doe').split(' ').length, 2);
  assert.equal(fake.fakeName('Jane').split(' ').length, 1);
  assert.equal(fake.fakeNameList('Jane Doe, John Smith').split(', ').length, 2);
  assert.match(fake.fakeIp('192.168.1.10'), /^10\.\d+\.\d+\.\d+$/);
  const host = fake.scramble('x6eps4xrq2xudenlfv6naeo3i4.datawarehouse.fabric.microsoft.com');
  assert.match(host, /^[a-z0-9]{26}\.datawarehouse\.fabric\.microsoft\.com$/);
  assert.notEqual(host.split('.')[0], 'x6eps4xrq2xudenlfv6naeo3i4');
});

test('detector reports the kind of every match and supports learned names', () => {
  const s = settingsApi.normalizeSettings({ customTerms: ['Contoso'] });
  const d = createDetector(s, ['Jane Doe', 'FF Demo Viewer']);
  const kinds = [];
  d.replace(`Jane Doe <jane@x.com> ${GUID} at Contoso; FF Demo Viewer`, (m, k) => { kinds.push(k); return m; });
  assert.deepEqual(kinds, ['name', 'email', 'guid', 'term', 'name']);
  assert.ok(!d.test('Jane Doesn\'t'), 'learned names match whole words only');
  const off = createDetector(settingsApi.normalizeSettings({ categories: { learnedNames: false } }), ['Jane Doe']);
  assert.ok(!off.test('Jane Doe'));
});

// --------------------------------------------------------------- learned names

test('name extraction keeps plausible names only', () => {
  assert.deepEqual(settingsApi.extractNames('Matthias Falland, FF Demo Viewer'), ['Matthias Falland', 'FF Demo Viewer']);
  assert.deepEqual(settingsApi.extractNames('—'), []);
  assert.deepEqual(settingsApi.extractNames('Owner'), []);
  assert.deepEqual(settingsApi.extractNames('Max'), [], 'single short word');
  assert.deepEqual(settingsApi.extractNames('jane@contoso.com'), []);
  assert.deepEqual(settingsApi.extractNames('Report 2024'), []);
});

test('names are learned from owner fields and then masked everywhere', async () => {
  const { document, chrome, masker } = await setup(`<!doctype html><html><body>
    <span id="owner" class="col col-owner">Jane Doe, John Smith</span>
    <p id="desc">Maintained by Jane Doe since 2023</p>
    <p id="other">Quarterly report</p></body></html>`);
  masker.flushLearned();
  await tick(5);
  assert.deepEqual([...chrome.data.learnedNames].sort(), ['Jane Doe', 'John Smith']);
  assert.ok(document.getElementById('desc').hasAttribute('data-fabric-mask'), 'learned name masked in other text');
  assert.ok(!document.getElementById('other').hasAttribute('data-fabric-mask'));
});

test('learned names can be removed and cleared', async () => {
  const { document, FM } = await setup('<!doctype html><html><body><p id="p">Contact Jane Doe</p></body></html>', { learnedNames: ['Jane Doe', 'John Smith'] });
  assert.ok(document.getElementById('p').hasAttribute('data-fabric-mask'));
  await FM.removeLearnedName('jane doe');
  await tick(5);
  assert.ok(!document.getElementById('p').hasAttribute('data-fabric-mask'));
  assert.deepEqual([...await FM.loadLearnedNames()], ['John Smith']);
  await FM.clearLearnedNames();
  assert.equal((await FM.loadLearnedNames()).length, 0);
});

// -------------------------------------------------------------------- tooltips

test('tooltips of masked elements and sensitive tooltips are masked and restored', async () => {
  const { document, FM } = await setup(`<!doctype html><html><body>
    <span id="a" title="jane@contoso.com">Jane</span>
    <div id="cell" class="col col-owner"><span id="inner" title="Jane Doe">JD</span></div>
    <span id="b" title="Refresh">x</span></body></html>`);
  const a = document.getElementById('a');
  assert.equal(a.getAttribute('title'), '••••••');
  assert.equal(a.getAttribute('data-fabric-mask-title'), 'jane@contoso.com');
  assert.equal(document.getElementById('inner').getAttribute('title'), '••••••', 'inside a selector-masked element');
  assert.equal(document.getElementById('b').getAttribute('title'), 'Refresh');

  // the page updates the tooltip later
  a.setAttribute('title', 'john@contoso.com');
  await tick();
  assert.equal(a.getAttribute('title'), '••••••');
  assert.equal(a.getAttribute('data-fabric-mask-title'), 'john@contoso.com');

  await FM.updateSettings((s) => { s.stripTooltips = false; });
  await tick(5);
  assert.equal(a.getAttribute('title'), 'john@contoso.com');
  assert.equal(a.hasAttribute('data-fabric-mask-title'), false);
});

// -------------------------------------------------------------------- fake mode

test('fake mode sets consistent replacement text; inputs fall back to the mosaic', async () => {
  const { document, FM } = await setup(`<!doctype html><html><body>
    <div id="id">Workspace ID: ${GUID}</div>
    <div id="id2">${GUID}</div>
    <span id="owner" class="col col-owner">Jane Doe</span>
    <input id="in" value="${GUID}">
    <user-details><img id="pic" alt=""></user-details>
    <trident-user-info-button><div id="initials" class="userInfoCircle">JD</div></trident-user-info-button></body></html>`, { settings: { mode: 'fake' } });
  const fakeOf = (id) => document.getElementById(id).getAttribute('data-fabric-fake');
  const g = fake.fakeGuid(GUID);
  assert.equal(fakeOf('id'), `Workspace ID: ${g}`);
  assert.equal(fakeOf('id2'), g, 'same value → same fake');
  assert.equal(fakeOf('owner'), fake.fakeName('Jane Doe'));
  assert.equal(fakeOf('in'), null);
  assert.equal(fakeOf('pic'), null);
  assert.match(fakeOf('initials'), /^[A-Z]{2}$/, 'initials become fake initials');
  assert.notEqual(fakeOf('initials'), 'JD');
  const css = document.querySelector('style[data-fabric-mask-style]').textContent;
  assert.match(css, /::after\{content:attr\(data-fabric-fake\)/);
  assert.match(css, /:not\(\[data-fabric-fake\]\)\{filter:url/);
  await FM.updateSettings((s) => { s.mode = 'pixelate'; });
  await tick(5);
  assert.equal(fakeOf('id'), null, 'fake attribute removed when leaving fake mode');
});

test('fake mode replaces the tab title with fake values', async () => {
  const { document } = await setup(null, { settings: { mode: 'fake' } });
  document.title = `Lakehouse ${GUID}`;
  await tick();
  assert.equal(document.title, `Lakehouse ${fake.fakeGuid(GUID)}`);
});

// --------------------------------------------------------- curtain & preview

test('curtain overlay follows the stored flag', async () => {
  const { document, FM } = await setup(null, { curtain: true });
  assert.ok(document.querySelector('fab-mask-curtain'), 'shown on load');
  await FM.setCurtain(false);
  assert.equal(document.querySelector('fab-mask-curtain'), null);
  await FM.setCurtain(true);
  assert.ok(document.querySelector('fab-mask-curtain'));
  // never scanned/masked itself
  assert.equal(document.querySelector('fab-mask-curtain').hasAttribute('data-fabric-mask'), false);
});

test('preview mode outlines masked elements and shows a counter badge', async () => {
  const { document, FM } = await setup(`<!doctype html><html><body><span>${GUID}</span><span>jane@contoso.com</span></body></html>`);
  await FM.updateSettings((s) => { s.preview = true; });
  await tick(5);
  const css = document.querySelector('style[data-fabric-mask-style]').textContent;
  assert.match(css, /outline:2px dashed #13a10e/);
  assert.ok(document.querySelector('fab-mask-badge'));
  await FM.updateSettings((s) => { s.preview = false; });
  await tick(5);
  assert.equal(document.querySelector('fab-mask-badge'), null);
});

// -------------------------------------------------------------------- profiles

test('built-in profiles apply their values and keep shared fields', () => {
  const base = settingsApi.normalizeSettings({ enabled: false, customTerms: ['Contoso'], preview: true });
  const recording = settingsApi.BUILTIN_PROFILES.find((p) => p.id === 'recording');
  const s = settingsApi.applyProfile(base, recording);
  assert.equal(s.mode, 'fake');
  assert.equal(s.categories.workspaceNames, true);
  assert.equal(s.activeProfile, 'recording');
  assert.equal(s.enabled, false, 'on/off is not part of a profile');
  assert.deepEqual(s.customTerms, ['Contoso'], 'custom terms are shared');
  assert.equal(s.preview, true);
  for (const p of settingsApi.BUILTIN_PROFILES) assert.ok(settingsApi.MODES.includes(p.values.mode), p.id);
});

test('user profiles can be saved, updated by name and deleted', async () => {
  const { FM } = await setup();
  const p1 = await FM.saveProfile('Workshop', FM.normalizeSettings({ mode: 'redact' }));
  const p2 = await FM.saveProfile('workshop', FM.normalizeSettings({ mode: 'blur' }));
  assert.equal(p1.id, p2.id, 'same name (case-insensitive) updates the profile');
  let profiles = await FM.loadProfiles();
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].values.mode, 'blur');
  assert.equal('customTerms' in profiles[0].values, false);
  await FM.deleteProfile(p1.id);
  profiles = await FM.loadProfiles();
  assert.equal(profiles.length, 0);
});

// ------------------------------------------------------- review regressions (v1.2)

test('learned names: removed names stay blocked, a full list never evicts', async () => {
  const { document, FM, masker, chrome } = await setup(`<!doctype html><html><body>
    <span id="owner" class="col col-owner">Jane Doe</span><p id="p">by Jane Doe</p></body></html>`);
  masker.flushLearned();
  await tick(10);
  assert.ok(document.getElementById('p').hasAttribute('data-fabric-mask'));
  await FM.removeLearnedName('Jane Doe');
  await tick(10);
  // still visible in the owner column, but must not be learned again
  document.getElementById('owner').textContent = 'Jane Doe';
  await tick();
  masker.flushLearned();
  await tick(1700);
  assert.equal(chrome.data.learnedNames.length, 0);
  assert.ok(!document.getElementById('p').hasAttribute('data-fabric-mask'));

  const letters = (i) => [0, 1, 2].map((k) => String.fromCharCode(65 + Math.floor(i / 26 ** k) % 26)).join('');
  const full = Array.from({ length: FM.MAX_LEARNED_NAMES }, (_, i) => `Person ${letters(i)} Name`);
  chrome.data.learnedNames = full;
  const after = await FM.addLearnedNames(['Brand New Person']);
  assert.equal(after.length, FM.MAX_LEARNED_NAMES);
  assert.ok(!after.includes('Brand New Person'), 'no eviction when full');
});

test('fake mode does not reveal undetected text or nested masked fields', async () => {
  const { document } = await setup(`<!doctype html><html><body>
    <div id="label">Workspace ID: ${GUID}</div>
    <p id="long">Escalation contact Herbert Undetected from Acme Secret Project, ${GUID}</p>
    <div id="nested">${GUID} <span class="col col-owner">Jane Doe</span></div>
    <div class="view-line" id="code"><span>df = load("abfss://ws@onelake.dfs.fabric.microsoft.com/${GUID}")</span></div>
  </body></html>`, { settings: { mode: 'fake' } });
  const fakeOf = (id) => document.getElementById(id).getAttribute('data-fabric-fake');
  assert.match(fakeOf('label'), /^Workspace ID: [0-9a-f]{8}-/, 'short labels stay readable');
  assert.ok(!/Herbert|Acme|Secret|Escalation/.test(fakeOf('long')), fakeOf('long'));
  assert.equal(fakeOf('nested'), null, 'element with a nested selector-masked field → mosaic');
  assert.match(fakeOf('code'), /^df = load\("abfss:/, 'code lines keep their code readable');
});

test('fake overlay only positions static elements', async () => {
  const { document } = await setup(`<!doctype html><html><body>
    <span id="static">${GUID}</span><span id="abs" style="position:absolute;top:5px">${GUID}</span></body></html>`, { settings: { mode: 'fake' } });
  assert.ok(document.getElementById('static').hasAttribute('data-fabric-fake-pos'));
  assert.ok(!document.getElementById('abs').hasAttribute('data-fabric-fake-pos'));
  assert.ok(document.getElementById('abs').hasAttribute('data-fabric-fake'));
});

test('tooltips: a removed title is not resurrected; our own writes are recognized via the DOM', async () => {
  const { document } = await setup('<!doctype html><html><body><span id="a" title="jane@contoso.com">x</span></body></html>');
  const a = document.getElementById('a');
  assert.equal(a.getAttribute('data-fabric-mask-title-set'), '••••••');
  a.removeAttribute('title');
  await tick();
  assert.equal(a.getAttribute('title'), null);
  assert.equal(a.hasAttribute('data-fabric-mask-title'), false);
});

test('salt changes fake values (not checkable against the public algorithm)', () => {
  fake.setSalt('');
  const plain = fake.fakeGuid(GUID);
  fake.setSalt('0123456789abcdef0123456789abcdef');
  const salted = fake.fakeGuid(GUID);
  assert.notEqual(plain, salted);
  assert.equal(fake.fakeGuid(GUID), salted, 'still deterministic per install');
  fake.setSalt('');
});

test('OneLake catalog header cells (only marked by the header row) are never masked or faked', async () => {
  const { document } = await setup(`<!doctype html><html><body>
    <div role="rowgroup" class="column-headers-rowgroup"><div role="row" class="column-headers">
      <span id="h-owner" class="col col-owner">Owner</span><span id="h-loc" class="col col-workspace">Location</span></div></div>
    <div role="row" class="row"><span id="c-owner" role="cell" class="col col-owner">Jane Doe</span>
      <span id="c-loc" role="cell" class="col col-workspace">Contoso Finance</span></div></body></html>`,
  { settings: { mode: 'fake', categories: { workspaceNames: true } } });
  const fakeOf = (id) => document.getElementById(id).getAttribute('data-fabric-fake');
  assert.equal(fakeOf('h-owner'), null);
  assert.equal(fakeOf('h-loc'), null);
  assert.ok(fakeOf('c-owner'));
  assert.ok(fakeOf('c-loc'));
  const { staticSelectorList } = require('../src/shared/styles.js');
  const list = staticSelectorList(settingsApi.normalizeSettings({ categories: { workspaceNames: true } }));
  assert.equal(document.getElementById('h-owner').matches(list), false);
  assert.equal(document.getElementById('h-loc').matches(list), false);
  assert.equal(document.getElementById('c-owner').matches(list), true);
});
