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

  // --------------------------------------------------------------- profiles

  function renderProfiles(profiles) {
    const list = $('profile-list');
    list.textContent = '';
    for (const p of profiles) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = p.name;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn small';
      del.textContent = FM.t('deleteProfile');
      del.addEventListener('click', () => FM.deleteProfile(p.id).catch(() => showStatus(FM.t('saveFailed'), true)));
      li.append(name, del);
      list.appendChild(li);
    }
    $('no-profiles').hidden = profiles.length > 0;
  }

  $('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('profile-name').value.trim();
    if (!name) return;
    try {
      const profile = await FM.saveProfile(name, await FM.loadSettings());
      await FM.updateSettings((s) => { s.activeProfile = profile.id; });
      $('profile-name').value = '';
      showStatus(FM.t('saved'));
    } catch {
      showStatus(FM.t('saveFailed'), true);
    }
  });

  // ----------------------------------------------------------- learned names

  function renderLearned(names) {
    const list = $('learned-list');
    list.textContent = '';
    for (const n of names) {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = n;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = FM.t('removeName');
      del.setAttribute('aria-label', `${FM.t('removeName')}: ${n}`);
      del.addEventListener('click', () => FM.removeLearnedName(n));
      li.append(label, del);
      list.appendChild(li);
    }
    $('no-learned').hidden = names.length > 0;
    $('clear-learned').hidden = names.length === 0;
  }

  $('clear-learned').addEventListener('click', async () => {
    if (window.confirm(FM.t('clearLearnedConfirm'))) await FM.clearLearnedNames();
  });

  // Keep in sync with the picker, the popup and newly learned names (unsaved edits are kept).
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const next = FM.settingsFromChange(changes, areaName);
    if (next) render(next);
    const names = FM.valueFromChange(changes, areaName, FM.LEARNED_KEY, FM.normalizeLearned);
    if (names) renderLearned(names);
    const profiles = FM.valueFromChange(changes, areaName, FM.PROFILES_KEY, FM.normalizeProfiles);
    if (profiles) renderProfiles(profiles);
  });

  render(await FM.loadSettings(), { force: true });
  renderProfiles(await FM.loadProfiles());
  renderLearned(await FM.loadLearnedNames());
})();
