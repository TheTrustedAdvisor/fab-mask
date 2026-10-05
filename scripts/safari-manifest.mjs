// Derives the Safari manifest from the Chrome/Edge one (single source of truth).
// Safari supports MV3 with a background service worker; Chrome-only keys are removed.
export const MIN_SAFARI = '17.0';

export function toSafariManifest(chromeManifest) {
  const m = structuredClone(chromeManifest);
  delete m.minimum_chrome_version;
  // Not supported by Safari (the converter warns): about:blank frames, options in a tab.
  for (const cs of m.content_scripts || []) {
    delete cs.match_origin_as_fallback;
    delete cs.match_about_blank;
  }
  if (m.options_ui) delete m.options_ui.open_in_tab;
  m.browser_specific_settings = { safari: { strict_min_version: MIN_SAFARI } };
  return m;
}
