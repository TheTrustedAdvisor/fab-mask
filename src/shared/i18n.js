/* Applies chrome.i18n messages to elements with data-i18n / data-i18n-title attributes. */
(function (root) {
  'use strict';

  const api = () => root.browser || root.chrome;

  function t(key, substitutions) {
    const i18n = api() && api().i18n;
    return (i18n && i18n.getMessage(key, substitutions)) || key;
  }

  function localize(doc) {
    doc.documentElement.lang = (api() && api().i18n && api().i18n.getUILanguage()) || 'en';
    for (const el of doc.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of doc.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    for (const el of doc.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
    for (const el of doc.querySelectorAll('[data-i18n-aria-label]')) {
      el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
    }
  }

  root.FabricMask = Object.assign(root.FabricMask || {}, { t, localize });
})(typeof globalThis !== 'undefined' ? globalThis : this);
