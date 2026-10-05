// Packages the extension into dist/:
//   fab-mask-<version>.zip   – upload to Chrome Web Store / Edge Add-ons, or "Load unpacked" after unzipping
//   fab-mask-<version>.crx   – signed CRX3 for policy-based installation (needs a private key)
//   updates.xml              – update manifest for ExtensionInstallForcelist / ExtensionSettings policies
//   extension-id.txt         – extension ID derived from the signing key
//
// Signing key: CRX_KEY_PATH=<file.pem>, or CRX_PRIVATE_KEY=<PEM contents> (CI secret).
// Without a key only the ZIP is built.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, mkdtempSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import crx3 from 'crx3';
import { toFirefoxManifest } from './firefox-manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const manifest = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = manifest.version;
if (version !== pkg.version) {
  console.error(`Version mismatch: manifest ${version} vs package.json ${pkg.version}`);
  process.exit(1);
}
const repo = (pkg.repository && pkg.repository.url || '').replace(/^.*github\.com[/:]|\.git$/g, '');

// dist/ only ever holds the current build – stale versions next to it are confusing.
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
const zipPath = join(DIST, `fab-mask-${version}.zip`);
// -X: no extra file attributes, so the archive only depends on the file contents
execFileSync('zip', ['-r', '-X', '-q', '-9', zipPath, '.', '-x', '*.DS_Store'], { cwd: SRC, stdio: 'inherit' });
console.log(`ZIP  ${zipPath}`);

// Firefox: same files, derived manifest. dist/firefox/ stays unpacked for `web-ext lint` and tests;
// addons.mozilla.org signs the ZIP itself.
const firefoxDir = join(DIST, 'firefox');
cpSync(SRC, firefoxDir, { recursive: true, filter: (p) => !p.endsWith('.DS_Store') });
writeFileSync(join(firefoxDir, 'manifest.json'), `${JSON.stringify(toFirefoxManifest(manifest), null, 2)}\n`);
const firefoxZip = join(DIST, `fab-mask-${version}-firefox.zip`);
execFileSync('zip', ['-r', '-X', '-q', '-9', firefoxZip, '.'], { cwd: firefoxDir, stdio: 'inherit' });
console.log(`ZIP  ${firefoxZip}`);

let keyPath = process.env.CRX_KEY_PATH;
if (!keyPath && process.env.CRX_PRIVATE_KEY) {
  keyPath = join(mkdtempSync(join(tmpdir(), 'fab-mask-key-')), 'key.pem');
  writeFileSync(keyPath, process.env.CRX_PRIVATE_KEY, { mode: 0o600 });
}
if (!keyPath) {
  console.log('No CRX_KEY_PATH / CRX_PRIVATE_KEY set – skipping signed CRX.');
  process.exit(0);
}
if (!existsSync(keyPath)) {
  console.error(`Signing key not found: ${keyPath}`);
  process.exit(1);
}

const crxName = `fab-mask-${version}.crx`;
const crxPath = join(DIST, crxName);
const xmlPath = join(DIST, 'updates.xml');
const crxURL = repo
  ? `https://github.com/${repo}/releases/download/v${version}/${crxName}`
  : crxName;
// API instead of CLI: the CLI parses --browserVersion "111" as a number and crashes.
// Version and minimum browser version are read from the manifest.
await crx3([join(SRC, 'manifest.json')], { keyPath, crxPath, xmlPath, crxURL });
const appId = /appid=['"]([a-p]{32})['"]/.exec(readFileSync(xmlPath, 'utf8'));
if (!appId) {
  console.error('Could not read the extension ID from updates.xml');
  process.exit(1);
}
writeFileSync(join(DIST, 'extension-id.txt'), `${appId[1]}\n`);
console.log(`CRX  ${crxPath}`);
console.log(`XML  ${xmlPath}`);
console.log(`ID   ${appId[1]}`);
