const test = require('node:test');
const assert = require('node:assert/strict');
const { describeBrowser, diagnostics, feedbackUrl } = require('../src/shared/feedback.js');
const { normalizeSettings } = require('../src/shared/settings.js');

const edge = { userAgentData: { brands: [{ brand: 'Not=A?Brand', version: '99' }, { brand: 'Chromium', version: '141' }, { brand: 'Microsoft Edge', version: '141' }], platform: 'Windows' } };

test('browser detection prefers Edge, then Chrome; falls back to the UA string', () => {
  assert.equal(describeBrowser(edge), 'Microsoft Edge 141 · Windows');
  assert.equal(describeBrowser({ userAgentData: { brands: [{ brand: 'Google Chrome', version: '140' }], platform: 'macOS' } }), 'Google Chrome 140 · macOS');
  assert.equal(describeBrowser({ userAgent: 'Mozilla/5.0 (X11) Chrome/139.0.0.0 Safari/537.36', platform: 'Linux x86_64' }), 'Google Chrome 139 · Linux x86_64');
});

test('feedback URL opens the issue form with non-sensitive diagnostics only', () => {
  const settings = normalizeSettings({
    mode: 'fake',
    customTerms: ['Contoso Secret Customer'],
    customSelectors: ['#tenant-name'],
    categories: { workspaceNames: true }
  });
  const url = new URL(feedbackUrl({ version: '1.3.1', settings, nav: edge }));
  assert.equal(url.origin + url.pathname, 'https://github.com/TheTrustedAdvisor/fab-mask/issues/new');
  assert.equal(url.searchParams.get('template'), 'feedback.yml');
  const env = url.searchParams.get('environment');
  assert.match(env, /^Fab Mask 1\.3\.1 · Microsoft Edge 141 · Windows · mode fake · profile custom · categories: .*workspaceNames/);
  assert.match(env, /custom terms: 1, selectors: 1/);
  assert.ok(!env.includes('Contoso') && !env.includes('#tenant-name'), 'never the terms or selectors themselves');
  assert.ok(!url.href.includes('fabric.microsoft.com'), 'never page URLs');
  assert.ok(diagnostics({ version: '1', settings: normalizeSettings({ enabled: false }), nav: edge }).includes('(off)'));
});
