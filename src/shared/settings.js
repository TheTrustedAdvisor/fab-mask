/*
 * Settings model shared by content script, service worker, popup and options page.
 * Loaded as a classic script (content scripts cannot be ES modules) and attaches to the
 * global `FabricMask` namespace; also exported for Node tests.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'settings';

  const CATEGORY_KEYS = ['guid', 'email', 'endpoint', 'secret', 'ipAddress', 'userProfile', 'workspaceNames'];

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    mode: 'pixelate', // 'pixelate' | 'blur' | 'redact'
    blurPx: 8,
    revealOnHover: false,
    maskTitle: true,
    categories: Object.freeze({
      guid: true,
      email: true,
      endpoint: true,
      secret: true,
      ipAddress: false,
      userProfile: true,
      workspaceNames: false
    }),
    customTerms: Object.freeze([]),
    customSelectors: Object.freeze([])
  });

  const MODES = ['pixelate', 'blur', 'redact'];
  const MIN_BLUR = 2;
  const MAX_BLUR = 20;
  // Smaller mosaic blocks leave large headings readable.
  const MIN_PIXEL = 6;
  const MAX_LIST_ENTRIES = 200;
  const MAX_ENTRY_LENGTH = 300;

  // Message types shared by content script, service worker and popup.
  const MESSAGES = Object.freeze({
    START_PICKER: 'fabric-mask:start-picker',
    STOP_PICKER: 'fabric-mask:stop-picker',
    PICKER_DONE: 'fabric-mask:picker-done',
    PING: 'fabric-mask:ping'
  });

  function cleanList(value, minLength, caseSensitive) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const out = [];
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (trimmed.length < minLength || trimmed.length > MAX_ENTRY_LENGTH) continue;
      const key = caseSensitive ? trimmed : trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
      if (out.length >= MAX_LIST_ENTRIES) break;
    }
    return out;
  }

  /** Merges a (possibly partial or corrupt) stored object with the defaults. */
  function normalizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const categories = {};
    for (const key of CATEGORY_KEYS) {
      const v = src.categories && src.categories[key];
      categories[key] = typeof v === 'boolean' ? v : DEFAULT_SETTINGS.categories[key];
    }
    const blur = Number(src.blurPx);
    return {
      enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_SETTINGS.enabled,
      mode: MODES.includes(src.mode) ? src.mode : DEFAULT_SETTINGS.mode,
      blurPx: Number.isFinite(blur)
        ? Math.min(MAX_BLUR, Math.max(MIN_BLUR, Math.round(blur)))
        : DEFAULT_SETTINGS.blurPx,
      revealOnHover: typeof src.revealOnHover === 'boolean' ? src.revealOnHover : DEFAULT_SETTINGS.revealOnHover,
      maskTitle: typeof src.maskTitle === 'boolean' ? src.maskTitle : DEFAULT_SETTINGS.maskTitle,
      categories,
      customTerms: cleanList(src.customTerms, 2, false),
      // CSS class / attribute values are case-sensitive
      customSelectors: cleanList(src.customSelectors, 1, true)
    };
  }

  // storage.local on purpose: custom terms (customer / person names) must not be synced to the
  // browser account, and local storage has no 8 KB per-item quota.
  const STORAGE_AREA = 'local';

  function getStorageArea() {
    return root.chrome && root.chrome.storage && root.chrome.storage[STORAGE_AREA];
  }

  /** Returns the new settings if a storage.onChanged event concerns them, otherwise undefined. */
  function settingsFromChange(changes, areaName) {
    if (areaName !== STORAGE_AREA || !changes || !changes[STORAGE_KEY]) return undefined;
    return normalizeSettings(changes[STORAGE_KEY].newValue);
  }

  async function loadSettings() {
    const area = getStorageArea();
    if (!area) return normalizeSettings(null);
    const items = await area.get(STORAGE_KEY);
    return normalizeSettings(items && items[STORAGE_KEY]);
  }

  async function saveSettings(settings) {
    const normalized = normalizeSettings(settings);
    const area = getStorageArea();
    if (area) await area.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  // Serializes read-modify-write cycles within one context (e.g. fast clicks in the popup).
  // Different contexts (popup, options page, picker, shortcut) can still interleave; that needs
  // simultaneous edits in two places and is accepted.
  let updateQueue = Promise.resolve();

  /** Read-modify-write helper; `mutator` receives a copy and returns/mutates it. */
  function updateSettings(mutator) {
    const run = updateQueue.then(async () => {
      const draft = structuredClone(await loadSettings());
      return saveSettings(mutator(draft) || draft);
    });
    updateQueue = run.catch(() => {});
    return run;
  }

  const api = {
    STORAGE_KEY,
    CATEGORY_KEYS,
    DEFAULT_SETTINGS,
    MODES,
    MIN_BLUR,
    MAX_BLUR,
    MIN_PIXEL,
    MESSAGES,
    STORAGE_AREA,
    normalizeSettings,
    settingsFromChange,
    loadSettings,
    saveSettings,
    updateSettings
  };

  root.FabricMask = Object.assign(root.FabricMask || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
