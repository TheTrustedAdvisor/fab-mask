/* global FabricMask */
(async function () {
  'use strict';

  const FM = FabricMask;
  const $ = (id) => document.getElementById(id);
  FM.localize(document);

  const MSG = FM.MESSAGES;
  let settings = await FM.loadSettings();
  let activeTabId = null;

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
    $('blur-row').hidden = settings.mode === 'redact';
    const min = settings.mode === 'pixelate' ? FM.MIN_PIXEL : FM.MIN_BLUR;
    const value = Math.max(min, settings.blurPx);
    $('blurPx').min = String(min);
    $('blurPx').value = String(value);
    $('blurPx-value').textContent = `${value}px`;
    $('revealOnHover').checked = settings.revealOnHover;
    $('maskTitle').checked = settings.maskTitle;
  }

  async function update(mutator) {
    try {
      settings = await FM.updateSettings((s) => {
        mutator(s);
        return s;
      });
    } catch {
      settings = await FM.loadSettings(); // show the persisted state
      $('page-status').textContent = FM.t('saveFailed');
    }
    render();
  }

  $('enabled').addEventListener('change', (e) => update((s) => { s.enabled = e.target.checked; }));
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

  $('open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });

  $('pick').addEventListener('click', async () => {
    if (activeTabId === null) return;
    if (!settings.enabled) await update((s) => { s.enabled = true; });
    await chrome.tabs.sendMessage(activeTabId, { type: MSG.START_PICKER }).catch(() => {});
    window.close();
  });

  // Settings changed elsewhere (shortcut, options page) while the popup is open.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const next = FM.settingsFromChange(changes, areaName);
    if (next) {
      settings = next;
      render();
    }
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

  try {
    const commands = await chrome.commands.getAll();
    const toggle = commands.find((c) => c.name === 'toggle-masking');
    if (toggle && toggle.shortcut) $('shortcut').textContent = FM.t('shortcutHint', [toggle.shortcut]);
  } catch {
    // commands API unavailable – hide hint
  }
})();
