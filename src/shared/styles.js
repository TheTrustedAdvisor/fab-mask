/*
 * Builds the CSS that hides flagged elements. The same text is injected into the document
 * and into every open shadow root, so it must not rely on ancestor selectors (they would not
 * cross shadow boundaries); when masking is disabled the masking rules are simply omitted.
 */
(function (root) {
  'use strict';

  const MASK_ATTR = 'data-fabric-mask';
  const PICKER_ATTR = 'data-fabric-mask-picker';

  // Best-effort selectors for the signed-in user (Microsoft account manager / Fluent personas).
  // The portal markup changes frequently; users can add more via the element picker.
  const USER_PROFILE_SELECTORS = [
    // Fabric portal (app.fabric.microsoft.com): header avatar + account flyout (me-control-menu)
    'trident-user-info-button .userInfoCircle',
    'user-details img',
    'user-details .user-name',
    'user-details .user-email',
    'me-control-menu .tenant-name',
    // Workspace image ("My workspace" shows the user's photo, others often a customer logo)
    'img[data-testid="workspace-header-logo-img"]',
    // "Owner" column in workspace lists and the OneLake catalog (display names, not e-mails)
    '[data-testid="fluentListCell.owner"]',
    '.col.col-owner',
    // Owner in the OneLake catalog item details
    'owner-details .property-value',
    // Microsoft account manager (MeControl) and Fluent personas used in older / embedded views
    '#mectrl_currentAccount_primary',
    '#mectrl_currentAccount_secondary',
    '#mectrl_currentAccount_picture',
    '#mectrl_headerPicture',
    '#mectrl_main_trigger .mectrl_profilepic',
    '.mectrl_accountDetails',
    '.ms-Persona-primaryText',
    '.ms-Persona-secondaryText',
    '.ms-Persona-imageArea',
    '.fui-Avatar',
    '.fui-Persona__primaryText',
    '.fui-Persona__secondaryText',
    'img[alt*="profile picture" i]',
    'img[alt*="Profilbild" i]'
  ];

  // Workspace names often contain customer / project names. Off by default because it hides
  // navigation context; enable for demos with customer workspaces.
  const WORKSPACE_NAME_SELECTORS = [
    'h1[data-testid="workspace-name-header"]',
    'button.workspaceName .navbar-item-label',
    'tri-workspace-button .workspace-name',
    '.col.col-workspace',
    'trident-domain-link .domain-link'
  ];

  function maskRules(selector, settings) {
    // :is() keeps selector lists ("a, b") intact when :not(:hover) / descendants are appended.
    const base = `:is(${selector})`;
    const sel = settings.revealOnHover ? `${base}:not(:hover)` : base;
    if (settings.mode === 'redact') {
      return (
        `${sel}{color:transparent!important;-webkit-text-fill-color:transparent!important;` +
        `text-shadow:none!important;background-color:#8a8886!important;border-radius:2px!important;}` +
        `${sel} *{visibility:hidden!important;}`
      );
    }
    return `${sel}{filter:blur(${settings.blurPx}px)!important;}`;
  }

  /** Returns the full stylesheet text for the given (normalized) settings. */
  function buildCss(settings) {
    const parts = [
      `[${PICKER_ATTR}="hover"]{outline:2px dashed #117865!important;outline-offset:1px!important;` +
        `cursor:crosshair!important;background-color:rgba(17,120,101,.12)!important;}`
    ];
    if (!settings || !settings.enabled) return parts.join('\n');

    parts.push(maskRules(`[${MASK_ATTR}]`, settings));
    if (settings.categories && settings.categories.userProfile) {
      for (const s of USER_PROFILE_SELECTORS) parts.push(maskRules(s, settings));
    }
    if (settings.categories && settings.categories.workspaceNames) {
      for (const s of WORKSPACE_NAME_SELECTORS) parts.push(maskRules(s, settings));
    }
    // One rule per custom selector: an invalid selector only drops its own rule.
    for (const s of settings.customSelectors || []) {
      if (isSafeSelector(s)) parts.push(maskRules(s, settings));
    }
    return parts.join('\n');
  }

  /** Prevents a user-provided selector from breaking out of its rule. */
  function isSafeSelector(selector) {
    if (typeof selector !== 'string' || selector.trim() === '') return false;
    if (/[{};\n\r\f]|\/\*|<\/?style/i.test(selector)) return false;
    // Unbalanced brackets/quotes would make the CSS parser swallow the following rules.
    const stack = [];
    let quote = null;
    for (let i = 0; i < selector.length; i++) {
      const ch = selector[i];
      if (ch === '\\') {
        if (i === selector.length - 1) return false;
        i++;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(' || ch === '[') stack.push(ch);
      else if (ch === ')' || ch === ']') {
        if (stack.pop() !== (ch === ')' ? '(' : '[')) return false;
      }
    }
    return quote === null && stack.length === 0;
  }

  const api = { MASK_ATTR, PICKER_ATTR, USER_PROFILE_SELECTORS, WORKSPACE_NAME_SELECTORS, buildCss, isSafeSelector };

  root.FabricMask = Object.assign(root.FabricMask || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
