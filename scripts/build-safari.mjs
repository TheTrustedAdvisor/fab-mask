// Builds the Safari version: dist/safari (extension with derived manifest) → Apple's
// safari-web-extension-converter → Xcode project in dist/safari-xcode → ad-hoc signed app in
// dist/safari-app for local testing (Safari → Develop → Allow Unsigned Extensions).
// Requires Xcode (not just the command line tools). App Store builds need an Apple Developer team.
import { cpSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toSafariManifest } from './safari-manifest.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const EXT_DIR = join(ROOT, 'dist', 'safari');
const PROJECT_DIR = join(ROOT, 'dist', 'safari-xcode');
const BUILD_DIR = join(ROOT, 'dist', 'safari-app');
const BUNDLE_ID = process.env.SAFARI_BUNDLE_ID || 'com.thetrustedadvisor.fabmask';
const env = {
  ...process.env,
  // Use full Xcode even if xcode-select points to the command line tools.
  DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer'
};
if (!existsSync(env.DEVELOPER_DIR)) {
  console.error(`Xcode not found at ${env.DEVELOPER_DIR} (set DEVELOPER_DIR).`);
  process.exit(1);
}

for (const dir of [EXT_DIR, PROJECT_DIR, BUILD_DIR]) rmSync(dir, { recursive: true, force: true });
cpSync(SRC, EXT_DIR, { recursive: true, filter: (p) => !p.endsWith('.DS_Store') });
const manifest = toSafariManifest(JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8')));
writeFileSync(join(EXT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const run = (cmd, args) => execFileSync(cmd, args, { env, stdio: 'inherit' });
run('xcrun', ['safari-web-extension-converter', EXT_DIR,
  '--project-location', PROJECT_DIR, '--app-name', 'Fab Mask', '--bundle-identifier', BUNDLE_ID,
  '--swift', '--macos-only', '--copy-resources', '--no-open', '--no-prompt', '--force']);

// The converter derives the *app* bundle ID from the app name ("…Fab-Mask") but gives the extension
// "<requested id>.Extension"; Xcode requires the extension ID to be prefixed by the app ID.
const pbxproj = join(PROJECT_DIR, 'Fab Mask', 'Fab Mask.xcodeproj', 'project.pbxproj');
const prefix = BUNDLE_ID.slice(0, BUNDLE_ID.lastIndexOf('.') + 1);
writeFileSync(pbxproj, readFileSync(pbxproj, 'utf8').replaceAll(`"${prefix}Fab-Mask"`, BUNDLE_ID));

run('xcodebuild', ['-project', join(PROJECT_DIR, 'Fab Mask', 'Fab Mask.xcodeproj'), '-scheme', 'Fab Mask',
  '-configuration', 'Debug', '-derivedDataPath', join(BUILD_DIR, 'DerivedData'),
  // Ad-hoc signing for local use; distribution needs a Developer ID / App Store team.
  'CODE_SIGN_IDENTITY=-', 'CODE_SIGN_STYLE=Manual', 'DEVELOPMENT_TEAM=', 'MARKETING_VERSION=' + manifest.version,
  '-quiet', 'build']);

const app = join(BUILD_DIR, 'DerivedData', 'Build', 'Products', 'Debug', 'Fab Mask.app');
console.log(existsSync(app) ? `APP  ${app}` : 'Build finished, but the app was not found');
