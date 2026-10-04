/*
 * Builds the CSS that hides flagged elements. The same text is injected into the document
 * and into every open shadow root, so it must not rely on ancestor selectors (they would not
 * cross shadow boundaries); when masking is disabled the masking rules are simply omitted.
 */
(function (root) {
  'use strict';

  const MASK_ATTR = 'data-fabric-mask';
  const PIXELATE_FILTER_ID = 'fab-mask-pixelate';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MIN_PIXEL = 6;
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
    // The column header carries the same classes as the cells – keep the header ("Owner") readable.
    '.col.col-owner:not([role="columnheader"], .column-header)',
    // Owner in the OneLake catalog item details
    'owner-details .property-value',
    // Admins / members lists (admin portal → Domains)
    'tri-members-list .members-names-list',
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
    '.col.col-workspace:not([role="columnheader"], .column-header)',
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
    if (settings.mode === 'pixelate') {
      return `${sel}{filter:url("#${PIXELATE_FILTER_ID}")!important;}`;
    }
    return `${sel}{filter:blur(${settings.blurPx}px)!important;}`;
  }

  function pixelSize(settings) {
    return Math.max(MIN_PIXEL, Math.round((settings && settings.blurPx) || 8));
  }

  /*
   * Mosaic filter: average each block (blur + alpha boost so thin text keeps its weight), sample one
   * pixel per block and grow it back to the block size. Built with DOM APIs (no innerHTML) so it
   * also works on pages that enforce Trusted Types.
   */
  const PIXELATE_PRIMITIVES = (s) => {
    const c = Math.floor(s / 2);
    return [
      ['feGaussianBlur', { in: 'SourceGraphic', stdDeviation: (s / 2.5).toFixed(2) }],
      ['feComponentTransfer', { result: 'avg' }, [['feFuncA', { type: 'linear', slope: '2.2' }]]],
      ['feFlood', { x: c, y: c, width: 1, height: 1 }],
      ['feComposite', { width: s, height: s }],
      ['feTile', { result: 'grid' }],
      ['feComposite', { in: 'avg', in2: 'grid', operator: 'in' }],
      ['feMorphology', { operator: 'dilate', radius: c }]
    ];
  };

  function buildPrimitive(doc, [name, attrs, children]) {
    const el = doc.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    for (const child of children || []) el.appendChild(buildPrimitive(doc, child));
    return el;
  }

  /** Creates (or updates, when `svg` is given) the hidden <svg> holding the mosaic filter. */
  function renderPixelateSvg(doc, size, svg) {
    if (!svg) {
      svg = doc.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.setAttribute('style', 'position:absolute!important;width:0!important;height:0!important;overflow:hidden!important;');
    }
    if (svg.dataset && svg.dataset.size === String(size)) return svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const filter = buildPrimitive(doc, ['filter', {
      id: PIXELATE_FILTER_ID, x: 0, y: 0, width: '100%', height: '100%',
      'color-interpolation-filters': 'sRGB'
    }, PIXELATE_PRIMITIVES(size)]);
    svg.appendChild(filter);
    svg.setAttribute('data-size', String(size));
    return svg;
  }

  /** Selectors that mask by CSS alone (no detection), as one :is() list – or null if none. */
  function staticSelectorList(settings) {
    if (!settings || !settings.enabled) return null;
    const list = [];
    if (settings.categories && settings.categories.userProfile) list.push(...USER_PROFILE_SELECTORS);
    if (settings.categories && settings.categories.workspaceNames) list.push(...WORKSPACE_NAME_SELECTORS);
    for (const s of settings.customSelectors || []) if (isSafeSelector(s)) list.push(s);
    return list.length ? `:is(${list.join(',')})` : null;
  }

  /** Returns the full stylesheet text for the given (normalized) settings. */
  function buildCss(settings) {
    const parts = [
      `[${PICKER_ATTR}="hover"]{outline:2px dashed #117865!important;outline-offset:1px!important;` +
        `cursor:crosshair!important;background-color:rgba(17,120,101,.12)!important;}`
    ];
    if (!settings || !settings.enabled) return parts.join('\n');

    const selectors = [`[${MASK_ATTR}]`];
    if (settings.categories && settings.categories.userProfile) selectors.push(...USER_PROFILE_SELECTORS);
    if (settings.categories && settings.categories.workspaceNames) selectors.push(...WORKSPACE_NAME_SELECTORS);
    for (const s of settings.customSelectors || []) if (isSafeSelector(s)) selectors.push(s);
    // One rule per selector: an invalid (custom) selector only drops its own rule.
    for (const s of selectors) parts.push(maskRules(s, settings));
    if (settings.mode !== 'redact') {
      // A masked element inside a masked element (e.g. a string token inside a masked editor line)
      // would be filtered twice; a second mosaic pass samples the first one's gaps and the text
      // nearly disappears. The outer filter already covers the inner content.
      const all = `:is(${selectors.join(',')})`;
      parts.push(`${all} ${all}{filter:none!important;}`);
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

  const api = { MASK_ATTR, PICKER_ATTR, PIXELATE_FILTER_ID, pixelSize, renderPixelateSvg, staticSelectorList, USER_PROFILE_SELECTORS, WORKSPACE_NAME_SELECTORS, buildCss, isSafeSelector };

  root.FabricMask = Object.assign(root.FabricMask || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
