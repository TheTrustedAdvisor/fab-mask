/*
 * Element picker: lets the user click an element in the portal to always mask it.
 * Generates a reasonably stable CSS selector (ids, test ids, semantic class names) and
 * avoids framework-generated tokens that change between builds.
 */
(function (root) {
  'use strict';

  const TEST_ID_ATTRS = ['data-testid', 'data-test-id', 'data-automation-id', 'data-automationid', 'data-tid'];
  const MAX_DEPTH = 5;
  const MAX_CLASSES = 3;
  // A picked selector may match a few siblings (e.g. the same cell in every list row), but not
  // half the page.
  const MAX_MATCHES = 25;

  function isStableToken(token) {
    if (!token || token.length > 60) return false;
    if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(token)) return false; // GUID-ish
    if (/\d{3,}/.test(token)) return false; // generated ids/counters
    if (/^(ng-|cdk-|_ng|mat-mdc-|is-|has-)/.test(token)) return false; // state/framework classes
    if (/(active|hover|focus|selected|expanded|collapsed|disabled|visible|open)$/i.test(token)) return false;
    if (/^[a-z]{1,2}[a-z0-9]{4,8}$/.test(token) && /\d/.test(token)) return false; // atomic css (griffel)
    if (/^css-[a-z0-9]+$/i.test(token)) return false; // css-in-js
    if (/^(tri|pbi)-|^fluentTheme-/.test(token)) return false; // Fabric utility classes (tri-flex, pbi-bgc-tp …)
    return true;
  }

  function cssEscape(value) {
    if (root.CSS && typeof root.CSS.escape === 'function') return root.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  }

  function segmentFor(el) {
    const tag = el.localName;
    if (el.id && isStableToken(el.id)) return `#${cssEscape(el.id)}`;
    for (const attr of TEST_ID_ATTRS) {
      const v = el.getAttribute(attr);
      if (v && isStableToken(v) && !/[\n\r\f]/.test(v)) return `${tag}[${attr}="${v.replace(/["\\]/g, '\\$&')}"]`;
    }
    const classes = Array.from(el.classList).filter(isStableToken).slice(0, MAX_CLASSES);
    return tag + classes.map((c) => `.${cssEscape(c)}`).join('');
  }

  function countMatches(scope, selector) {
    try {
      return scope.querySelectorAll(selector).length;
    } catch {
      return Infinity;
    }
  }

  /** Builds a selector for `el` relative to its root node (document or shadow root). */
  function generateSelector(el) {
    const scope = el.getRootNode ? el.getRootNode() : el.ownerDocument;
    let selector = segmentFor(el);
    let current = el;
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const matches = countMatches(scope, selector);
      if (selector.startsWith('#') && matches === 1) return selector;
      // A bare tag name ("span") is too broad even when it currently matches few elements.
      const specific = /[#.[]/.test(selector);
      if (specific && matches >= 1 && matches <= MAX_MATCHES) return selector;
      const parent = current.parentElement;
      if (!parent || parent.localName === 'html' || parent.localName === 'body') break;
      current = parent;
      selector = `${segmentFor(parent)} > ${selector}`;
    }
    return selector;
  }

  function createPicker({ attr, onPick, onCancel }) {
    let active = false;
    let hovered = null;
    const doc = root.document;

    function targetOf(event) {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const first = path.find((n) => n && n.nodeType === 1);
      return first || event.target;
    }

    function setHovered(el) {
      if (hovered === el) return;
      if (hovered) hovered.removeAttribute(attr);
      hovered = el;
      if (hovered) hovered.setAttribute(attr, 'hover');
    }

    function swallow(event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    function onMove(event) {
      if (!event.isTrusted) return;
      const el = targetOf(event);
      if (el && el.nodeType === 1) setHovered(el);
    }

    function onClick(event) {
      swallow(event);
      if (!event.isTrusted) return; // page scripts must not choose what gets picked
      const el = hovered || targetOf(event);
      stop();
      if (el && el.nodeType === 1) onPick(generateSelector(el), el);
    }

    function onKey(event) {
      if (event.key === 'Escape') {
        swallow(event);
        stop();
        if (onCancel) onCancel();
      }
    }

    const swallowEvents = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'contextmenu'];

    function start() {
      if (active) return;
      active = true;
      doc.addEventListener('mouseover', onMove, true);
      doc.addEventListener('click', onClick, true);
      doc.addEventListener('keydown', onKey, true);
      for (const type of swallowEvents) doc.addEventListener(type, swallow, true);
    }

    function stop() {
      if (!active) return;
      active = false;
      setHovered(null);
      doc.removeEventListener('mouseover', onMove, true);
      doc.removeEventListener('click', onClick, true);
      doc.removeEventListener('keydown', onKey, true);
      for (const type of swallowEvents) doc.removeEventListener(type, swallow, true);
    }

    return { start, stop, isActive: () => active };
  }

  const api = { createPicker, generateSelector, isStableToken };

  root.FabricMask = Object.assign(root.FabricMask || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
