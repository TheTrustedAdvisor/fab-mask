const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, DEFAULT_SETTINGS } = require('../src/shared/settings.js');
const { buildCss, isSafeSelector, MASK_ATTR } = require('../src/shared/styles.js');

test('normalizeSettings fills defaults and rejects garbage', () => {
  assert.deepEqual(normalizeSettings(undefined), JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  const s = normalizeSettings({
    enabled: 'yes',
    mode: 'evil',
    blurPx: 999,
    categories: { guid: false, email: 'x' },
    customTerms: ['  Contoso ', 'contoso', 'a', 42, ''],
    customSelectors: '.x'
  });
  assert.equal(s.enabled, true);
  assert.equal(s.mode, 'blur');
  assert.equal(s.blurPx, 20);
  assert.equal(s.categories.guid, false);
  assert.equal(s.categories.email, true);
  assert.deepEqual(s.customTerms, ['Contoso']);
  assert.deepEqual(s.customSelectors, []);
  assert.equal(normalizeSettings({ blurPx: -3 }).blurPx, 2);
  assert.equal(normalizeSettings({ mode: 'redact' }).mode, 'redact');
});

test('buildCss: disabled → only picker rule', () => {
  const css = buildCss(normalizeSettings({ enabled: false, customSelectors: ['.x'] }));
  assert.ok(!css.includes(MASK_ATTR + ']'));
  assert.ok(!css.includes('.x'));
});

test('buildCss: blur, redact, reveal on hover, profile selectors, custom selectors', () => {
  const blur = buildCss(normalizeSettings({ blurPx: 5, customSelectors: ['.a, .b'] }));
  assert.match(blur, /:is\(\[data-fabric-mask\]\)\{filter:blur\(5px\)!important;\}/);
  assert.match(blur, /:is\(\.a, \.b\)\{filter:blur/);
  assert.match(blur, /user-details \.user-email/);

  const redact = buildCss(normalizeSettings({ mode: 'redact', revealOnHover: true }));
  assert.match(redact, /:is\(\[data-fabric-mask\]\):not\(:hover\)\{color:transparent/);
  assert.match(redact, /:not\(:hover\) \*\{visibility:hidden/);

  const noProfile = buildCss(normalizeSettings({ categories: { userProfile: false } }));
  assert.ok(!noProfile.includes('user-details'));
});

test('isSafeSelector blocks rule injection and unbalanced input', () => {
  for (const ok of ['.a', '#id > span', 'a[href*="x"]', ':is(.a, .b)', 'div[data-x="a{b"]'.replace('{', '')]) {
    assert.ok(isSafeSelector(ok), ok);
  }
  for (const bad of ['', '   ', '.a{}', '.a} body{display:none', '.a(', 'a[href', 'a[x="y]', '.a /* x', '</style>', '.a;b', 'a\\']) {
    assert.ok(!isSafeSelector(bad), bad);
  }
  const css = buildCss(normalizeSettings({ customSelectors: ['.ok', '} body {display:none'] }));
  assert.ok(!css.includes('display:none'));
});

test('updateSettings serializes concurrent updates', async () => {
  const store = {};
  global.chrome = { storage: { local: {
    get: async (k) => { await new Promise((r) => setTimeout(r, 5)); return { [k]: store[k] }; },
    set: async (o) => { await new Promise((r) => setTimeout(r, 5)); Object.assign(store, o); }
  } } };
  const { updateSettings, loadSettings, settingsFromChange } = require('../src/shared/settings.js');
  await Promise.all([
    updateSettings((s) => { s.categories.ipAddress = true; }),
    updateSettings((s) => { s.mode = 'redact'; }),
    updateSettings((s) => { s.customTerms.push('Contoso'); })
  ]);
  const s = await loadSettings();
  assert.equal(s.categories.ipAddress, true);
  assert.equal(s.mode, 'redact');
  assert.deepEqual(s.customTerms, ['Contoso']);
  assert.equal(settingsFromChange({ settings: { newValue: {} } }, 'sync'), undefined);
  assert.equal(settingsFromChange({ other: {} }, 'local'), undefined);
  assert.equal(settingsFromChange({ settings: { newValue: undefined } }, 'local').enabled, true);
  delete global.chrome;
});

test('custom selectors are de-duplicated case-sensitively, terms case-insensitively', () => {
  const s = normalizeSettings({ customSelectors: ['.Foo', '.foo', '.Foo'], customTerms: ['Contoso', 'CONTOSO'] });
  assert.deepEqual(s.customSelectors, ['.Foo', '.foo']);
  assert.deepEqual(s.customTerms, ['Contoso']);
});
