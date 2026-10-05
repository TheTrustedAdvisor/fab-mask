/*
 * "Send feedback": builds the URL of a pre-filled GitHub issue form. Only non-sensitive diagnostics
 * are included – never page URLs (they contain workspace/item IDs), custom terms, selectors or
 * learned names. The user reviews and submits the issue on GitHub.
 */
(function (root) {
  'use strict';

  const REPO = 'TheTrustedAdvisor/fab-mask';
  const TEMPLATE = 'feedback.yml';

  /** Browser name/version and OS from userAgentData (Chromium), falling back to the UA string. */
  function describeBrowser(nav) {
    const n = nav || root.navigator || {};
    const data = n.userAgentData;
    let browser = 'Chromium';
    let version = '';
    if (data && Array.isArray(data.brands)) {
      const brand = data.brands.find((b) => /Edge/i.test(b.brand)) ||
        data.brands.find((b) => /Chrome/i.test(b.brand)) ||
        data.brands.find((b) => !/Not.?A.?Brand/i.test(b.brand));
      if (brand) {
        browser = brand.brand;
        version = brand.version;
      }
    } else if (typeof n.userAgent === 'string') {
      const m = /(Edg|Chrome)\/(\d+)/.exec(n.userAgent);
      if (m) {
        browser = m[1] === 'Edg' ? 'Microsoft Edge' : 'Google Chrome';
        version = m[2];
      }
    }
    const platform = (data && data.platform) || n.platform || 'unknown OS';
    return `${browser} ${version}`.trim() + ` · ${platform}`;
  }

  /** Diagnostics line, e.g. "Fab Mask 1.3.0 · Microsoft Edge 141 · macOS · mode pixelate · …". */
  function diagnostics({ version, settings, nav }) {
    const s = settings || {};
    const categories = Object.entries(s.categories || {}).filter(([, on]) => on).map(([k]) => k);
    return [
      `Fab Mask ${version || '?'}`,
      describeBrowser(nav),
      `mode ${s.mode || '?'}${s.enabled === false ? ' (off)' : ''}`,
      `profile ${s.activeProfile || 'custom'}`,
      `categories: ${categories.join(', ') || 'none'}`,
      `custom terms: ${(s.customTerms || []).length}, selectors: ${(s.customSelectors || []).length}`
    ].join(' · ');
  }

  function feedbackUrl({ version, settings, nav }) {
    const params = new URLSearchParams({ template: TEMPLATE, environment: diagnostics({ version, settings, nav }) });
    return `https://github.com/${REPO}/issues/new?${params}`;
  }

  const api = { describeBrowser, diagnostics, feedbackUrl };
  root.FabricMask = Object.assign(root.FabricMask || {}, { feedback: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
