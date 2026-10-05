// Derives the Firefox manifest from the Chrome/Edge one, so there is a single source of truth.
//  - Firefox runs MV3 background code as an event page (background.scripts), not a service worker;
//    settings.js is listed first because importScripts() does not exist there.
//  - addons.mozilla.org requires a Gecko ID and a data-collection declaration (Firefox 140+).
//  - Chrome-only keys are removed.
export const GECKO_ID = 'fab-mask@thetrustedadvisor';
export const MIN_FIREFOX = '142.0'; // data_collection_permissions on desktop and Android

export function toFirefoxManifest(chromeManifest) {
  const m = structuredClone(chromeManifest);
  m.background = { scripts: ['shared/settings.js', 'background/service-worker.js'] };
  delete m.minimum_chrome_version;
  for (const cs of m.content_scripts || []) delete cs.match_origin_as_fallback;
  m.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: MIN_FIREFOX,
      // Fab Mask transmits nothing (see PRIVACY.md).
      data_collection_permissions: { required: ['none'] }
    }
  };
  return m;
}
