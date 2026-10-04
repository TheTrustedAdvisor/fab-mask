const test = require('node:test');
const assert = require('node:assert/strict');
const { createDetector } = require('../src/shared/detector.js');
const { normalizeSettings } = require('../src/shared/settings.js');

const defaults = normalizeSettings(null);
const only = (cat, extra = {}) =>
  normalizeSettings({
    categories: { guid: false, email: false, endpoint: false, secret: false, ipAddress: false, userProfile: false, [cat]: true },
    ...extra
  });

test('detects GUIDs anywhere in text, case-insensitive', () => {
  const d = createDetector(only('guid'));
  assert.ok(d.test('4e864cf8-386d-4067-bfa7-4ef5e408c474'));
  assert.ok(d.test('Workspace ID: 4E864CF8-386D-4067-BFA7-4EF5E408C474 (copy)'));
  assert.ok(d.test('https://app.fabric.microsoft.com/groups/4e864cf8-386d-4067-bfa7-4ef5e408c474/list'));
  assert.ok(!d.test('4e864cf8-386d-4067-bfa7')); // incomplete
  assert.ok(!d.test('Last refreshed 2024-05-01'));
});

test('detects e-mail addresses and guest UPNs', () => {
  const d = createDetector(only('email'));
  assert.ok(d.test('jane.doe@contoso.com'));
  assert.ok(d.test('Owner: jane.doe@contoso.onmicrosoft.com'));
  assert.ok(d.test("john.o'neil@contoso.co.uk"));
  assert.ok(d.test('jane_fabrikam.com#EXT#@contoso.onmicrosoft.com'));
  assert.ok(!d.test('Sales @ HQ'));
  assert.ok(!d.test('@mention'));
});

test('detects Fabric endpoints, OneLake paths, XMLA and connection strings', () => {
  const d = createDetector(only('endpoint'));
  for (const text of [
    'x6eps4xrq2xudenlfv6naeo3i4-abcdefgh.datawarehouse.fabric.microsoft.com',
    'abfss://Sales@onelake.dfs.fabric.microsoft.com/Lakehouse.Lakehouse/Files',
    'https://onelake.dfs.fabric.microsoft.com/ws/lh/Tables',
    'powerbi://api.powerbi.com/v1.0/myorg/Finance Prod',
    'Server=tcp:myserver.database.windows.net,1433;Initial Catalog=sales;',
    'Data Source=foo;Initial Catalog=bar',
    'https://trd-abc.z4.kusto.fabric.microsoft.com',
    'Extension{"extensionDataSourceKind":"Cds","extensionDataSourcePath":"https://contoso.crm4.dynamics.com/"}',
    'Sql{"server":"srv","database":"db"}',
    'https://contoso.sharepoint.com/sites/Finance'
  ]) {
    assert.ok(d.test(text), text);
  }
  assert.ok(!d.test('Data sources included in this semantic model:'));
  assert.ok(!d.test('Server settings'));
  assert.ok(!d.test('app.fabric.microsoft.com'));
});

test('detects secrets', () => {
  const d = createDetector(only('secret'));
  const key = 'A'.repeat(86) + '==';
  assert.ok(d.test('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'));
  assert.ok(d.test('DefaultEndpointsProtocol=https;AccountName=x;AccountKey=abc123def456=='));
  assert.ok(d.test('https://x.blob.core.windows.net/c?sv=2022&sig=AbCdEf123456%3D'));
  assert.ok(d.test('Password=SuperSecret1;'));
  assert.ok(d.test(key));
  assert.ok(!d.test('Password'));
  assert.ok(!d.test('Enter your password'));
});

test('IP addresses are off by default and detected when enabled', () => {
  assert.ok(!createDetector(defaults).test('10.0.0.1'));
  const d = createDetector(only('ipAddress'));
  assert.ok(d.test('Gateway 10.20.30.40'));
  assert.ok(!d.test('999.1.1.1'));
});

test('custom terms are literal and case-insensitive', () => {
  const d = createDetector(only('guid', { customTerms: ['Contoso', 'a.b*c'] }));
  assert.ok(d.test('CONTOSO Finance'));
  assert.ok(d.test('x a.b*c y'));
  assert.ok(!d.test('aXbbbc'));
});

test('no categories and no terms yields an inactive detector', () => {
  const d = createDetector(only('guid', { categories: {} , customTerms: [] }));
  assert.equal(createDetector({ categories: {}, customTerms: [] }).active, false);
  assert.equal(d.active, true);
});

test('redact replaces every match', () => {
  const d = createDetector(defaults);
  assert.equal(
    d.redact('Report – 4e864cf8-386d-4067-bfa7-4ef5e408c474 – jane@contoso.com'),
    'Report – •••••• – ••••••'
  );
  assert.equal(d.redact('Fabric'), 'Fabric');
  // repeated calls are stable (no lastIndex leakage)
  assert.equal(d.redact('jane@contoso.com'), '••••••');
  assert.equal(d.redact('jane@contoso.com'), '••••••');
});

test('regexes stay linear on large adversarial input', () => {
  const d = createDetector(normalizeSettings({ categories: { ipAddress: true } }));
  const inputs = ['a'.repeat(200000), 'a.'.repeat(100000), 'a-'.repeat(100000), `${'x'.repeat(100000)}@`, 'eyJ'.repeat(50000)];
  for (const text of inputs) {
    const start = process.hrtime.bigint();
    d.test(text);
    d.redact(text);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < 500, `took ${ms}ms for input starting ${text.slice(0, 10)}`);
  }
});
