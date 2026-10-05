/*
 * Settings model shared by content script, service worker, popup and options page.
 * Loaded as a classic script (content scripts cannot be ES modules) and attaches to the
 * global `FabricMask` namespace; also exported for Node tests.
 *
 * storage.local keys:
 *   settings      – the settings object (normalizeSettings)
 *   learnedNames  – person names learned from owner/admin fields (newest first)
 *   profiles      – user-defined profiles [{ id, name, values }]
 *   blockedNames  – learned names the user removed; never learned again
 *   curtain       – true while the "curtain" overlay hides all portal tabs
 *   fakeSalt      – random per-install salt for fake values
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'settings';
  const LEARNED_KEY = 'learnedNames';
  const PROFILES_KEY = 'profiles';
  const CURTAIN_KEY = 'curtain';
  const BLOCKED_KEY = 'blockedNames';
  const SALT_KEY = 'fakeSalt';

  const CATEGORY_KEYS = ['guid', 'email', 'endpoint', 'secret', 'ipAddress', 'userProfile', 'learnedNames', 'workspaceNames'];

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    mode: 'pixelate', // 'pixelate' | 'blur' | 'fake' | 'redact'
    blurPx: 8,
    revealOnHover: false,
    maskTitle: true,
    stripTooltips: true,
    preview: false,
    activeProfile: 'custom',
    // Profile applied when presentation mode starts ('' = keep the current settings).
    presentationProfile: '',
    categories: Object.freeze({
      guid: true,
      email: true,
      endpoint: true,
      secret: true,
      ipAddress: false,
      userProfile: true,
      learnedNames: true,
      workspaceNames: false
    }),
    customTerms: Object.freeze([]),
    customSelectors: Object.freeze([])
  });

  const MODES = ['pixelate', 'blur', 'fake', 'redact'];
  const MIN_BLUR = 2;
  const MAX_BLUR = 20;
  // Smaller mosaic blocks leave large headings readable.
  const MIN_PIXEL = 6;
  const MAX_LIST_ENTRIES = 200;
  const MAX_ENTRY_LENGTH = 300;
  // When full, no further names are learned (never evict: an evicted name that is still on screen
  // would be re-learned immediately, causing a write/rescan loop).
  const MAX_LEARNED_NAMES = 1000;
  const MAX_PROFILES = 20;

  // Message types shared by content script, service worker and popup.
  const MESSAGES = Object.freeze({
    START_PICKER: 'fabric-mask:start-picker',
    STOP_PICKER: 'fabric-mask:stop-picker',
    PICKER_DONE: 'fabric-mask:picker-done',
    PING: 'fabric-mask:ping',
    LEARN_NAMES: 'fabric-mask:learn-names',
    HIDE_CONTEXT_ELEMENT: 'fabric-mask:hide-context-element',
    TOGGLE_PRESENTATION: 'fabric-mask:toggle-presentation'
  });

  /** Normalizes selected text for use as a custom term; returns null if unusable. */
  function termFromSelection(text) {
    if (typeof text !== 'string') return null;
    const term = text.replace(/\s+/g, ' ').trim();
    return term.length >= 2 && term.length <= MAX_ENTRY_LENGTH ? term : null;
  }

  /** Adds a custom term / selector unless already present. Returns the stored settings. */
  function addCustomTerm(term) {
    return updateSettings((s) => {
      if (!s.customTerms.some((t) => t.toLowerCase() === term.toLowerCase())) s.customTerms.push(term);
    });
  }

  function addCustomSelector(selector) {
    return updateSettings((s) => {
      if (!s.customSelectors.includes(selector)) s.customSelectors.push(selector);
    });
  }

  // ------------------------------------------------------------------ profiles

  // Fields a profile controls. On/off, preview, custom terms and selectors are shared.
  const PROFILE_FIELDS = ['mode', 'blurPx', 'revealOnHover', 'maskTitle', 'stripTooltips', 'categories'];

  const ALL_ON = { guid: true, email: true, endpoint: true, secret: true, ipAddress: true, userProfile: true, learnedNames: true, workspaceNames: true };

  // Names are i18n message keys (resolved in the UI).
  const BUILTIN_PROFILES = Object.freeze([
    { id: 'customer-demo', nameKey: 'profileCustomerDemo', values: { mode: 'pixelate', blurPx: 8, revealOnHover: false, maskTitle: true, stripTooltips: true, categories: ALL_ON } },
    { id: 'recording', nameKey: 'profileRecording', values: { mode: 'fake', blurPx: 8, revealOnHover: false, maskTitle: true, stripTooltips: true, categories: ALL_ON } },
    { id: 'screenshot', nameKey: 'profileScreenshot', values: { mode: 'redact', blurPx: 8, revealOnHover: false, maskTitle: true, stripTooltips: true, categories: ALL_ON } },
    { id: 'internal', nameKey: 'profileInternal', values: { mode: 'blur', blurPx: 6, revealOnHover: true, maskTitle: false, stripTooltips: false, categories: { guid: true, email: false, endpoint: true, secret: true, ipAddress: false, userProfile: false, learnedNames: false, workspaceNames: false } } }
  ]);

  /** The profile-controlled part of a settings object. */
  function profileValues(settings) {
    const s = normalizeSettings(settings);
    const values = {};
    for (const key of PROFILE_FIELDS) values[key] = structuredClone(s[key]);
    return values;
  }

  /** Returns settings with the profile's values applied and the profile marked active. */
  function applyProfile(settings, profile) {
    const next = { ...normalizeSettings(settings) };
    for (const key of PROFILE_FIELDS) {
      if (profile.values && key in profile.values) next[key] = structuredClone(profile.values[key]);
    }
    next.activeProfile = profile.id;
    return normalizeSettings(next);
  }

  function normalizeProfiles(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const p of raw) {
      if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !p.name.trim()) continue;
      out.push({ id: p.id.slice(0, 64), name: p.name.trim().slice(0, 60), values: profileValues(p.values) });
      if (out.length >= MAX_PROFILES) break;
    }
    return out;
  }

  // ------------------------------------------------------------------ settings

  function cleanList(value, minLength, caseSensitive, max = MAX_LIST_ENTRIES) {
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
      if (out.length >= max) break;
    }
    return out;
  }

  const bool = (v, d) => (typeof v === 'boolean' ? v : d);

  /** Merges a (possibly partial or corrupt) stored object with the defaults. */
  function normalizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const categories = {};
    for (const key of CATEGORY_KEYS) {
      categories[key] = bool(src.categories && src.categories[key], DEFAULT_SETTINGS.categories[key]);
    }
    const blur = Number(src.blurPx);
    return {
      enabled: bool(src.enabled, DEFAULT_SETTINGS.enabled),
      mode: MODES.includes(src.mode) ? src.mode : DEFAULT_SETTINGS.mode,
      blurPx: Number.isFinite(blur)
        ? Math.min(MAX_BLUR, Math.max(MIN_BLUR, Math.round(blur)))
        : DEFAULT_SETTINGS.blurPx,
      revealOnHover: bool(src.revealOnHover, DEFAULT_SETTINGS.revealOnHover),
      maskTitle: bool(src.maskTitle, DEFAULT_SETTINGS.maskTitle),
      stripTooltips: bool(src.stripTooltips, DEFAULT_SETTINGS.stripTooltips),
      preview: bool(src.preview, DEFAULT_SETTINGS.preview),
      activeProfile: typeof src.activeProfile === 'string' && src.activeProfile ? src.activeProfile.slice(0, 64) : 'custom',
      presentationProfile: typeof src.presentationProfile === 'string' ? src.presentationProfile.slice(0, 64) : '',
      categories,
      customTerms: cleanList(src.customTerms, 2, false),
      // CSS class / attribute values are case-sensitive
      customSelectors: cleanList(src.customSelectors, 1, true)
    };
  }

  // ------------------------------------------------------------- learned names

  const NAME_STOPWORDS = new Set(['owner', 'owners', 'admin', 'admins', 'unknown', 'none', 'n/a', 'me', 'you',
    'system', 'deleted user', 'service principal', 'microsoft', 'power bi', 'fabric', 'all', 'everyone']);

  /** Splits "Jane Doe, John Smith" and keeps only plausible person / account names. */
  function extractNames(text) {
    if (typeof text !== 'string') return [];
    return text.split(/\s*[,;\n]\s*/).map((n) => n.trim()).filter(isPlausibleName);
  }

  function isPlausibleName(name) {
    if (name.length < 3 || name.length > 60) return false;
    if (/[@\d{}<>=/\\]/.test(name)) return false;
    if ((name.match(/\p{L}/gu) || []).length < 3) return false;
    if (NAME_STOPWORDS.has(name.toLowerCase())) return false;
    // A single short word ("Max") would match far too much text elsewhere.
    if (!/\s/.test(name) && name.length < 5) return false;
    return true;
  }

  const normalizeLearned = (raw) => cleanList(raw, 3, false, MAX_LEARNED_NAMES).filter(isPlausibleName);

  // ------------------------------------------------------------------- storage

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

  /** Generic helper for the other keys: returns `normalize(newValue)` or undefined. */
  function valueFromChange(changes, areaName, key, normalize) {
    if (areaName !== STORAGE_AREA || !changes || !changes[key]) return undefined;
    return normalize(changes[key].newValue);
  }

  async function getKey(key) {
    const area = getStorageArea();
    if (!area) return undefined;
    const items = await area.get(key);
    return items ? items[key] : undefined;
  }

  async function setKey(key, value) {
    const area = getStorageArea();
    if (area) await area.set({ [key]: value });
    return value;
  }

  async function loadSettings() {
    return normalizeSettings(await getKey(STORAGE_KEY));
  }

  async function saveSettings(settings) {
    return setKey(STORAGE_KEY, normalizeSettings(settings));
  }

  // Serializes read-modify-write cycles within one context (e.g. fast clicks in the popup).
  // Different contexts (popup, options page, picker, shortcut) can still interleave; that needs
  // simultaneous edits in two places and is accepted.
  let updateQueue = Promise.resolve();

  function queued(fn) {
    const run = updateQueue.then(fn);
    updateQueue = run.catch(() => {});
    return run;
  }

  /** Read-modify-write helper; `mutator` receives a copy and returns/mutates it. */
  function updateSettings(mutator) {
    return queued(async () => {
      const draft = structuredClone(await loadSettings());
      return saveSettings(mutator(draft) || draft);
    });
  }

  async function loadLearnedNames() {
    return normalizeLearned(await getKey(LEARNED_KEY));
  }

  async function loadBlockedNames() {
    return cleanList(await getKey(BLOCKED_KEY), 1, false, MAX_LEARNED_NAMES);
  }

  /**
   * Adds names (newest first); returns the stored list. No write when nothing is new, when the
   * list is full, or for names the user removed. Called by the service worker only, so writes from
   * many frames are serialized in one place.
   */
  function addLearnedNames(names) {
    return queued(async () => {
      const [current, blocked] = await Promise.all([loadLearnedNames(), loadBlockedNames()]);
      const skip = new Set([...current, ...blocked].map((n) => n.toLowerCase()));
      const room = MAX_LEARNED_NAMES - current.length;
      const fresh = normalizeLearned(names).filter((n) => !skip.has(n.toLowerCase())).slice(0, Math.max(0, room));
      if (!fresh.length) return current;
      return setKey(LEARNED_KEY, [...fresh, ...current]);
    });
  }

  /** Removes a name and blocks it from being learned again. */
  function removeLearnedName(name) {
    return queued(async () => {
      const key = String(name).toLowerCase();
      const [current, blocked] = await Promise.all([loadLearnedNames(), loadBlockedNames()]);
      await setKey(BLOCKED_KEY, cleanList([name, ...blocked], 1, false, MAX_LEARNED_NAMES));
      return setKey(LEARNED_KEY, current.filter((n) => n.toLowerCase() !== key));
    });
  }

  /** Forgets all learned names (they are learned again when seen) and clears the block list. */
  function clearLearnedNames() {
    return queued(async () => {
      await setKey(BLOCKED_KEY, []);
      return setKey(LEARNED_KEY, []);
    });
  }

  /** Read-only salt access for content scripts (the service worker creates it). */
  async function loadFakeSalt() {
    const v = await getKey(SALT_KEY);
    return typeof v === 'string' ? v : '';
  }

  /** Random per-install salt so fake values cannot be checked against known originals. */
  async function getFakeSalt() {
    const existing = await getKey(SALT_KEY);
    if (typeof existing === 'string' && existing.length >= 16) return existing;
    const bytes = new Uint8Array(16);
    root.crypto.getRandomValues(bytes);
    const salt = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await setKey(SALT_KEY, salt);
    return salt;
  }

  async function loadProfiles() {
    return normalizeProfiles(await getKey(PROFILES_KEY));
  }

  function saveProfile(name, settings) {
    return queued(async () => {
      const profiles = await loadProfiles();
      const existing = profiles.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
      const profile = { id: existing ? existing.id : `user-${Date.now().toString(36)}`, name: name.trim(), values: profileValues(settings) };
      const next = existing ? profiles.map((p) => (p.id === existing.id ? profile : p)) : [...profiles, profile];
      await setKey(PROFILES_KEY, normalizeProfiles(next));
      return profile;
    });
  }

  function deleteProfile(id) {
    return queued(async () => setKey(PROFILES_KEY, (await loadProfiles()).filter((p) => p.id !== id)));
  }

  /** Built-in + user profiles; built-ins carry `nameKey`, user profiles `name`. */
  async function allProfiles() {
    return [...BUILTIN_PROFILES, ...(await loadProfiles())];
  }

  async function getCurtain() {
    return (await getKey(CURTAIN_KEY)) === true;
  }

  function setCurtain(on) {
    return setKey(CURTAIN_KEY, Boolean(on));
  }

  const api = {
    STORAGE_KEY,
    LEARNED_KEY,
    PROFILES_KEY,
    CURTAIN_KEY,
    BLOCKED_KEY,
    SALT_KEY,
    MAX_LEARNED_NAMES,
    CATEGORY_KEYS,
    DEFAULT_SETTINGS,
    MODES,
    MIN_BLUR,
    MAX_BLUR,
    MIN_PIXEL,
    MESSAGES,
    STORAGE_AREA,
    PROFILE_FIELDS,
    BUILTIN_PROFILES,
    normalizeSettings,
    settingsFromChange,
    valueFromChange,
    loadSettings,
    saveSettings,
    updateSettings,
    termFromSelection,
    addCustomTerm,
    addCustomSelector,
    extractNames,
    isPlausibleName,
    normalizeLearned,
    loadLearnedNames,
    loadBlockedNames,
    addLearnedNames,
    removeLearnedName,
    clearLearnedNames,
    profileValues,
    applyProfile,
    normalizeProfiles,
    loadProfiles,
    saveProfile,
    deleteProfile,
    allProfiles,
    getCurtain,
    setCurtain,
    getFakeSalt,
    loadFakeSalt
  };

  root.FabricMask = Object.assign(root.FabricMask || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
