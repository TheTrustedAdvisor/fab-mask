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
  // Fake-data mode: the replacement text shown via ::after (the page's own text is never changed).
  const FAKE_ATTR = 'data-fabric-fake';
  // Set on fake-overlay elements that are position:static, so the overlay can anchor to them
  // without overriding absolute/sticky positioning of the page's own elements.
  const FAKE_POS_ATTR = 'data-fabric-fake-pos';
  const PREVIEW_COLOR = '#13a10e';

  // Column headers carry the same classes as their cells. Workspace lists mark them with
  // role="columnheader"/.column-header, the OneLake catalog only via the header row (.column-headers).
  const NOT_HEADER = ':not([role="columnheader"], [role="columnheader"] *, .column-header, .column-headers *, thead *)';

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
    // Keep the column header ("Owner") readable – see NOT_HEADER.
    `.col.col-owner${NOT_HEADER}`,
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

  // Elements whose text is a person / account name. Their text is learned ("learned names") and
  // replaced with fake names in the fake-data mode.
  const PERSON_NAME_SELECTORS = [
    'user-details .user-name',
    '[data-testid="fluentListCell.owner"]',
    `.col.col-owner${NOT_HEADER}`,
    'owner-details .property-value',
    'tri-members-list .members-names-list',
    '#mectrl_currentAccount_primary',
    '.ms-Persona-primaryText',
    '.fui-Persona__primaryText'
  ];

  // Workspace names often contain customer / project names. Off by default because it hides
  // navigation context; enable for demos with customer workspaces.
  const WORKSPACE_NAME_SELECTORS = [
    'h1[data-testid="workspace-name-header"]',
    'button.workspaceName .navbar-item-label',
    'tri-workspace-button .workspace-name',
    `.col.col-workspace${NOT_HEADER}`,
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
    if (settings.mode === 'fake') {
      // Elements with a computed fake value show it as an overlay; everything else (inputs,
      // images, very long text) falls back to the mosaic.
      const withFake = `${sel}[${FAKE_ATTR}]`;
      return (
        `${sel}:not([${FAKE_ATTR}]){filter:url("#${PIXELATE_FILTER_ID}")!important;}` +
        `${withFake}{-webkit-text-fill-color:transparent!important;text-shadow:none!important;}` +
        `${withFake}[${FAKE_POS_ATTR}]{position:relative!important;}` +
        `${withFake}::after{content:attr(${FAKE_ATTR})!important;position:absolute!important;inset:0!important;` +
        `display:flex!important;align-items:center!important;padding:inherit!important;box-sizing:border-box!important;` +
        // Wrap like the original text (a two-line owner name stays two lines), clip what does not fit.
        `white-space:inherit!important;overflow-wrap:anywhere!important;overflow:hidden!important;font:inherit!important;` +
        `-webkit-text-fill-color:currentColor!important;pointer-events:none!important;filter:none!important;}`
      );
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

  /** Selectors of person-name fields, as one :is() list. */
  const personSelectorList = () => `:is(${PERSON_NAME_SELECTORS.join(',')})`;

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
    const all = `:is(${selectors.join(',')})`;
    if (settings.mode !== 'redact') {
      // A masked element inside a masked element (e.g. a string token inside a masked editor line)
      // would be filtered twice; a second mosaic pass samples the first one's gaps and the text
      // nearly disappears. The outer filter already covers the inner content.
      parts.push(`${all} ${all}{filter:none!important;}`);
    }
    if (settings.mode === 'fake') {
      // The outer overlay already shows the fake version of the inner text.
      parts.push(`${all} ${all}::after{content:none!important;}`);
    }
    if (settings.preview) {
      parts.push(`${all}{outline:2px dashed ${PREVIEW_COLOR}!important;outline-offset:1px!important;}`);
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

  const api = { MASK_ATTR, PICKER_ATTR, FAKE_ATTR, FAKE_POS_ATTR, PIXELATE_FILTER_ID, PREVIEW_COLOR, PERSON_NAME_SELECTORS,
    WORKSPACE_NAME_SELECTORS_LIST: () => `:is(${WORKSPACE_NAME_SELECTORS.join(',')})`, personSelectorList,
    pixelSize, renderPixelateSvg, staticSelectorList, USER_PROFILE_SELECTORS, WORKSPACE_NAME_SELECTORS, buildCss, isSafeSelector };

  root.FabricMask = Object.assign(root.FabricMask || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
