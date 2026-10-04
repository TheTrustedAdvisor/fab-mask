const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const pkg = require('../package.json');
const en = require('../src/_locales/en/messages.json');
const de = require('../src/_locales/de/messages.json');

test('manifest is MV3 with minimal permissions and matching version', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.version, pkg.version);
});

test('no content script runs in the page main world', () => {
  // A MAIN-world attachShadow hook interfered with zone.js/Angular and froze the Fabric portal.
  for (const cs of manifest.content_scripts) assert.notEqual(cs.world, 'MAIN');
});

test('all referenced files exist', () => {
  const files = [
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    manifest.action.default_popup,
    manifest.options_ui.page,
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((c) => c.js)
  ];
  for (const f of files) assert.ok(fs.existsSync(path.join(SRC, f)), f);
});

test('content scripts cover the Fabric portal and workload iframes', () => {
  const matches = manifest.content_scripts[0].matches;
  const covers = (url) => matches.some((m) => new RegExp('^' + m.replace(/[.]/g, '\\.').replace(/\*/g, '[^/]*').replace(/\/\[\^\/\]\*$/, '/.*') + '$').test(url));
  for (const url of [
    'https://app.fabric.microsoft.com/home',
    'https://app.powerbi.com/groups/me/list',
    'https://pbides.powerbi.com/notebook', // notebooks
    'https://pbilhe.powerbi.com/x', // lakehouse explorer
    'https://pbidpe.powerbi.com/x' // pipelines
  ]) {
    assert.ok(covers(url), url);
  }
  assert.equal(manifest.content_scripts[0].all_frames, true);
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
});

test('locales define the same keys and every key used in HTML/manifest', () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  const used = new Set();
  for (const f of ['popup/popup.html', 'options/options.html']) {
    const html = fs.readFileSync(path.join(SRC, f), 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-title)?="([^"]+)"/g)) used.add(m[1]);
  }
  for (const m of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) used.add(m[1]);
  for (const f of ['popup/popup.js', 'options/options.js', 'background/service-worker.js']) {
    const js = fs.readFileSync(path.join(SRC, f), 'utf8');
    for (const m of js.matchAll(/(?:\bt|getMessage)\('([A-Za-z]+)'/g)) used.add(m[1]);
  }
  for (const key of used) assert.ok(en[key], `missing message ${key}`);
});
