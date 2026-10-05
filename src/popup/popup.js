/* global FabricMask */
(async function () {
  'use strict';

  // Firefox: promise-based browser.*; Chrome/Edge: chrome.*
  const chrome = globalThis.browser || globalThis.chrome;

  const FM = FabricMask;
  const MSG = FM.MESSAGES;
  const $ = (id) => document.getElementById(id);
  FM.localize(document);

  let settings = await FM.loadSettings();
  let curtain = await FM.getCurtain();
  let profiles = await FM.allProfiles();
  let activeTabId = null;

  const profileName = (p) => (p.nameKey ? FM.t(p.nameKey) : p.name);

  function renderProfiles() {
    const select = $('profile');
    select.textContent = '';
    const custom = new Option(FM.t('profileCustom'), 'custom');
    select.add(custom);
    for (const p of profiles) select.add(new Option(profileName(p), p.id));
    select.value = profiles.some((p) => p.id === settings.activeProfile) ? settings.activeProfile : 'custom';
  }

  function render() {
    $('enabled').checked = settings.enabled;
    $('body').classList.toggle('disabled', !settings.enabled);
    for (const box of document.querySelectorAll('[data-category]')) {
      box.checked = Boolean(settings.categories[box.dataset.category]);
    }
    for (const radio of document.querySelectorAll('input[name="mode"]')) {
      radio.checked = radio.value === settings.mode;
    }
    // One "strength" slider: blur radius, or mosaic block size (minimum MIN_PIXEL).
    $('blur-row').hidden = settings.mode === 'redact' || settings.mode === 'fake';
    const min = settings.mode === 'pixelate' ? FM.MIN_PIXEL : FM.MIN_BLUR;
    const value = Math.max(min, settings.blurPx);
    $('blurPx').min = String(min);
    $('blurPx').value = String(value);
    $('blurPx-value').textContent = `${value}px`;
    $('revealOnHover').checked = settings.revealOnHover;
    $('maskTitle').checked = settings.maskTitle;
    $('stripTooltips').checked = settings.stripTooltips;
    $('curtain').setAttribute('aria-pressed', String(curtain));
    $('preview').setAttribute('aria-pressed', String(settings.preview));
    renderProfiles();
  }

  /** Changes to profile-controlled fields switch the profile selector to "Custom". */
  async function update(mutator, { profileField = true } = {}) {
    try {
      settings = await FM.updateSettings((s) => {
        mutator(s);
        if (profileField) s.activeProfile = 'custom';
      });
    } catch {
      settings = await FM.loadSettings(); // show the persisted state
      $('page-status').textContent = FM.t('saveFailed');
    }
    render();
  }

  $('enabled').addEventListener('change', (e) => update((s) => { s.enabled = e.target.checked; }, { profileField: false }));
  for (const box of document.querySelectorAll('[data-category]')) {
    box.addEventListener('change', () => update((s) => { s.categories[box.dataset.category] = box.checked; }));
  }
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener('change', () => update((s) => { s.mode = radio.value; }));
  }
  $('blurPx').addEventListener('input', (e) => { $('blurPx-value').textContent = `${e.target.value}px`; });
  $('blurPx').addEventListener('change', (e) => update((s) => { s.blurPx = Number(e.target.value); }));
  $('revealOnHover').addEventListener('change', (e) => update((s) => { s.revealOnHover = e.target.checked; }));
  $('maskTitle').addEventListener('change', (e) => update((s) => { s.maskTitle = e.target.checked; }));
  $('stripTooltips').addEventListener('change', (e) => update((s) => { s.stripTooltips = e.target.checked; }));

  $('profile').addEventListener('change', async (e) => {
    const profile = profiles.find((p) => p.id === e.target.value);
    if (!profile) {
      await update((s) => { s.activeProfile = 'custom'; }, { profileField: false });
      return;
    }
    await update((s) => Object.assign(s, FM.applyProfile(s, profile)), { profileField: false });
  });

  $('curtain').addEventListener('click', async () => {
    const next = !curtain;
    try {
      await FM.setCurtain(next);
      curtain = next; // the storage listener may already have applied it
    } catch {
      $('page-status').textContent = FM.t('saveFailed');
    }
    render();
  });
  $('preview').addEventListener('click', () => update((s) => { s.preview = !s.preview; }, { profileField: false }));

  // Presentation mode is handled by the service worker (it also restores the window later).
  const currentWindow = await chrome.windows.getCurrent();
  $('present').setAttribute('aria-pressed', String(currentWindow.state === 'fullscreen'));
  $('present').addEventListener('click', async () => {
    const reply = await chrome.runtime.sendMessage({ type: MSG.TOGGLE_PRESENTATION, windowId: currentWindow.id }).catch(() => null);
    if (reply && reply.ok) window.close();
    else $('page-status').textContent = FM.t('saveFailed');
  });

  $('open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });

  $('pick').addEventListener('click', async () => {
    if (activeTabId === null) return;
    if (!settings.enabled) await update((s) => { s.enabled = true; }, { profileField: false });
    await chrome.tabs.sendMessage(activeTabId, { type: MSG.START_PICKER }).catch(() => {});
    window.close();
  });

  // Changes made elsewhere (shortcuts, options page) while the popup is open.
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    const next = FM.settingsFromChange(changes, areaName);
    if (next) settings = next;
    const c = FM.valueFromChange(changes, areaName, FM.CURTAIN_KEY, (v) => v === true);
    if (c !== undefined) curtain = c;
    if (FM.valueFromChange(changes, areaName, FM.PROFILES_KEY, (v) => v)) profiles = await FM.allProfiles();
    render();
  });

  render();

  // Is the content script running in the active tab? (No "tabs" permission needed for this.)
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const reply = tab && (await chrome.tabs.sendMessage(tab.id, { type: MSG.PING }));
    if (reply && reply.ok) activeTabId = tab.id;
  } catch {
    activeTabId = null;
  }
  $('page-status').textContent = FM.t(activeTabId !== null ? 'popupActiveHere' : 'popupNotFabric');
  $('pick').disabled = activeTabId === null;

  $('about').addEventListener('click', async (e) => {
    e.preventDefault();
    await chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#about') });
    window.close();
  });

  // Author links (the extension is free – credits deserve a visible place).
  for (const link of document.querySelectorAll('.credit-icon')) {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      await chrome.tabs.create({ url: link.href });
      window.close();
    });
  }

  $('feedback').addEventListener('click', async (e) => {
    e.preventDefault();
    const url = FM.feedback.feedbackUrl({ version: chrome.runtime.getManifest().version, settings });
    await chrome.tabs.create({ url });
    window.close();
  });
})();
