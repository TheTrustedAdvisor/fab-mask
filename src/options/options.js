/* global FabricMask */
(async function () {
  'use strict';

  const FM = FabricMask;
  const $ = (id) => document.getElementById(id);
  FM.localize(document);
  document.title = FM.t('optionsTitle');

  const FIELDS = ['customTerms', 'customSelectors'];
  const toLines = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dirty = { customTerms: false, customSelectors: false };
  // Selectors as last shown in the textarea; anything stored beyond that was added elsewhere
  // (element picker) and must survive a save.
  let shownSelectors = [];

  function isValidSelector(selector) {
    if (!FM.isSafeSelector(selector)) return false;
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch {
      return false;
    }
  }

  function render(settings, { force = false } = {}) {
    for (const field of FIELDS) {
      if (dirty[field] && !force) continue;
      $(field).value = settings[field].join('\n');
      dirty[field] = false;
    }
    if (force || !dirty.customSelectors) shownSelectors = settings.customSelectors.slice();
  }

  for (const field of FIELDS) {
    $(field).addEventListener('input', () => { dirty[field] = true; });
  }

  let statusTimer = null;
  function showStatus(text, isError = false) {
    $('status').textContent = text;
    $('status').classList.toggle('error', isError);
    clearTimeout(statusTimer);
    if (!isError) statusTimer = setTimeout(() => { $('status').textContent = ''; }, 2500);
  }

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectors = toLines($('customSelectors').value);
    const invalid = selectors.filter((s) => !isValidSelector(s));
    const errors = $('selector-errors');
    errors.hidden = invalid.length === 0;
    errors.textContent = invalid.length ? FM.t('invalidSelectors', [invalid.join(', ')]) : '';

    let saved;
    try {
      saved = await FM.updateSettings((s) => {
        const addedElsewhere = s.customSelectors.filter((x) => !shownSelectors.includes(x) && !selectors.includes(x));
        s.customTerms = toLines($('customTerms').value);
        s.customSelectors = [...selectors.filter(isValidSelector), ...addedElsewhere];
        return s;
      });
    } catch {
      showStatus(FM.t('saveFailed'), true);
      return;
    }
    dirty.customTerms = false;
    shownSelectors = saved.customSelectors.slice();
    // Keep invalid lines in the textarea so they can be fixed; otherwise show the stored state.
    if (invalid.length) {
      $('customSelectors').value = [...saved.customSelectors, ...invalid].join('\n');
      dirty.customSelectors = true;
    } else {
      dirty.customSelectors = false;
      render(saved, { force: true });
    }
    showStatus(FM.t('saved'));
  });

  $('reset').addEventListener('click', async () => {
    if (!window.confirm(FM.t('resetConfirm'))) return;
    try {
      render(await FM.saveSettings(FM.DEFAULT_SETTINGS), { force: true });
      $('selector-errors').hidden = true;
      showStatus(FM.t('saved'));
    } catch {
      showStatus(FM.t('saveFailed'), true);
    }
  });

  // Keep in sync with selectors added through the element picker (unsaved edits are kept).
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const next = FM.settingsFromChange(changes, areaName);
    if (next) render(next);
  });

  render(await FM.loadSettings(), { force: true });
})();
