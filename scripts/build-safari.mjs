// Builds the Safari version: dist/safari (extension with derived manifest) → Apple's
// safari-web-extension-converter → Xcode project in dist/safari-xcode → app in dist/safari-app.
//
//   npm run build:safari                      ad-hoc signed app for local testing
//                                             (Safari → Develop → Allow Unsigned Extensions)
//   APPLE_TEAM_ID=XXXXXXXXXX npm run release:safari
//                                             signed archive, exported and uploaded to App Store Connect
//                                             (Xcode must be signed in to that team: Settings → Accounts)
//
// Requires Xcode (not just the command line tools).
import { cpSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toSafariManifest } from './safari-manifest.mjs';
import { renderIcon } from './icon-render.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const EXT_DIR = join(ROOT, 'dist', 'safari');
const PROJECT_DIR = join(ROOT, 'dist', 'safari-xcode');
const BUILD_DIR = join(ROOT, 'dist', 'safari-app');
const BUNDLE_ID = process.env.SAFARI_BUNDLE_ID || 'com.thetrustedadvisor.fabmask';
const RELEASE = process.argv.includes('--release');
const TEAM_ID = process.env.APPLE_TEAM_ID || '';
// "upload" sends the build to App Store Connect; "export" only writes the .pkg to dist/safari-app/export.
const DESTINATION = process.env.SAFARI_EXPORT_DESTINATION || 'upload';
const env = {
  ...process.env,
  // Use full Xcode even if xcode-select points to the command line tools.
  DEVELOPER_DIR: process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer'
};
if (!existsSync(env.DEVELOPER_DIR)) {
  console.error(`Xcode not found at ${env.DEVELOPER_DIR} (set DEVELOPER_DIR).`);
  process.exit(1);
}
if (RELEASE && !/^[A-Z0-9]{10}$/.test(TEAM_ID)) {
  console.error('Set APPLE_TEAM_ID to your 10-character Apple Developer Team ID (developer.apple.com → Membership).');
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

const projectRoot = join(PROJECT_DIR, 'Fab Mask');
const xcodeproj = join(projectRoot, 'Fab Mask.xcodeproj');
const pbxproj = join(xcodeproj, 'project.pbxproj');

// Version "1.4.2" → build number 10402: increases with every release, as App Store Connect requires.
const [major, minor, patch] = manifest.version.split('.').map(Number);
const buildNumber = String(major * 10000 + minor * 100 + patch);

let project = readFileSync(pbxproj, 'utf8');
// The converter derives the *app* bundle ID from the app name ("…Fab-Mask") but gives the extension
// "<requested id>.Extension"; Xcode requires the extension ID to be prefixed by the app ID.
const prefix = BUNDLE_ID.slice(0, BUNDLE_ID.lastIndexOf('.') + 1);
project = project.replaceAll(`"${prefix}Fab-Mask"`, BUNDLE_ID);
project = project
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${manifest.version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`)
  // App Store uploads of Mac apps must declare a category.
  .replaceAll('INFOPLIST_KEY_CFBundleDisplayName = "Fab Mask";',
    'INFOPLIST_KEY_CFBundleDisplayName = "Fab Mask";\n\t\t\t\tINFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.developer-tools";' +
    // No encryption beyond what macOS provides: skips the export-compliance question on every upload.
    '\n\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;');
writeFileSync(pbxproj, project);

// The converter upscales the 128 px extension icon to every size (blurry at 1024 px in the App Store);
// draw each app icon size natively instead.
const iconSet = join(projectRoot, 'Fab Mask', 'Assets.xcassets', 'AppIcon.appiconset');
const iconContents = JSON.parse(readFileSync(join(iconSet, 'Contents.json'), 'utf8'));
for (const image of iconContents.images) {
  if (!image.filename) continue;
  const px = Number(image.size.split('x')[0]) * Number(image.scale.replace('x', ''));
  writeFileSync(join(iconSet, image.filename), renderIcon(px));
}

if (!RELEASE) {
  run('xcodebuild', ['-project', xcodeproj, '-scheme', 'Fab Mask',
    '-configuration', 'Debug', '-derivedDataPath', join(BUILD_DIR, 'DerivedData'),
    // Ad-hoc signing for local use only.
    'CODE_SIGN_IDENTITY=-', 'CODE_SIGN_STYLE=Manual', 'DEVELOPMENT_TEAM=', '-quiet', 'build']);
  const app = join(BUILD_DIR, 'DerivedData', 'Build', 'Products', 'Debug', 'Fab Mask.app');
  console.log(existsSync(app) ? `APP  ${app}` : 'Build finished, but the app was not found');
} else {
  const archive = join(BUILD_DIR, 'Fab Mask.xcarchive');
  run('xcodebuild', ['-project', xcodeproj, '-scheme', 'Fab Mask', '-configuration', 'Release',
    '-archivePath', archive, '-allowProvisioningUpdates',
    `DEVELOPMENT_TEAM=${TEAM_ID}`, 'CODE_SIGN_STYLE=Automatic', '-quiet', 'archive']);
  const exportOptions = join(BUILD_DIR, 'ExportOptions.plist');
  writeFileSync(exportOptions, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>${DESTINATION}</string>
  <key>teamID</key><string>${TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
`);
  run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', exportOptions,
    '-exportPath', join(BUILD_DIR, 'export'), '-allowProvisioningUpdates']);
  console.log(DESTINATION === 'upload'
    ? `Uploaded Fab Mask ${manifest.version} (build ${buildNumber}) to App Store Connect.`
    : `PKG  ${join(BUILD_DIR, 'export')}`);
}
