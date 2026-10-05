/* global FabricMask */
importScripts('../shared/settings.js');

const MSG = FabricMask.MESSAGES;
const MENU_TERM = 'fab-mask-add-term';
const MENU_ELEMENT = 'fab-mask-hide-element';
// Context menu entries only appear on the pages Fab Mask runs on.
const PORTAL_PATTERNS = chrome.runtime.getManifest().content_scripts[0].matches;

async function updateBadge() {
  const [s, curtain] = await Promise.all([FabricMask.loadSettings(), FabricMask.getCurtain()]);
  let text = '';
  if (curtain) text = '❚❚';
  else if (!s.enabled) text = 'OFF';
  else if (s.preview) text = '✓';
  await chrome.action.setBadgeBackgroundColor({ color: s.preview && !curtain && s.enabled ? '#13a10e' : '#8a8886' });
  await chrome.action.setBadgeText({ text });
  const status = curtain ? 'statusCurtain' : s.enabled ? 'statusOn' : 'statusOff';
  await chrome.action.setTitle({ title: `${chrome.i18n.getMessage('extName')} – ${chrome.i18n.getMessage(status)}` });
}

// ---------------------------------------------------------------- context menu

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_TERM,
      title: chrome.i18n.getMessage('menuHideSelection'), // contains %s = selected text
      contexts: ['selection'],
      documentUrlPatterns: PORTAL_PATTERNS
    });
    chrome.contextMenus.create({
      id: MENU_ELEMENT,
      title: chrome.i18n.getMessage('menuHideElement'),
      contexts: ['page', 'frame', 'link', 'image', 'editable'],
      documentUrlPatterns: PORTAL_PATTERNS
    });
  });
}

async function handleMenuClick(info, tab) {
  if (info.menuItemId === MENU_TERM) {
    const term = FabricMask.termFromSelection(info.selectionText);
    if (term) await FabricMask.addCustomTerm(term);
  } else if (info.menuItemId === MENU_ELEMENT && tab && tab.id !== undefined) {
    // The frame that received the right-click knows which element it was.
    await chrome.tabs.sendMessage(tab.id, { type: MSG.HIDE_CONTEXT_ELEMENT }, { frameId: info.frameId || 0 })
      .catch(() => {});
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleMenuClick(info, tab).catch(() => {});
});

// ----------------------------------------------------------- presentation mode

const presentationKey = (windowId) => `presentation:${windowId}`;

/**
 * Full screen hides the address bar (which contains workspace and item IDs) from screen shares.
 * Entering also turns masking on and applies the configured presentation profile; toggling again
 * restores the previous window state. Returns true when presentation mode is now on.
 */
async function togglePresentation(windowId) {
  const win = windowId !== undefined ? await chrome.windows.get(windowId) : await chrome.windows.getLastFocused();
  const key = presentationKey(win.id);
  if (win.state === 'fullscreen') {
    const stored = (await chrome.storage.session.get(key))[key];
    await chrome.storage.session.remove(key);
    await chrome.windows.update(win.id, { state: stored && stored !== 'fullscreen' ? stored : 'normal' });
    return false;
  }
  await chrome.storage.session.set({ [key]: win.state });
  const profiles = await FabricMask.allProfiles();
  await FabricMask.updateSettings((s) => {
    const profile = profiles.find((p) => p.id === s.presentationProfile);
    const next = profile ? FabricMask.applyProfile(s, profile) : s;
    next.enabled = true;
    return next;
  });
  await chrome.windows.update(win.id, { state: 'fullscreen' });
  return true;
}

// ------------------------------------------------------------------ lifecycle

chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await FabricMask.loadSettings();
  // 1.0.x persisted its defaults on install, so an untouched "blur 8px" there was never a user
  // choice: move it to the new default pixel mode.
  if (details.reason === 'update' && /^1\.0\./.test(details.previousVersion || '') &&
      current.mode === 'blur' && current.blurPx === 8) {
    current.mode = 'pixelate';
  }
  // Persist normalized settings so new defaults are filled in after an update.
  await FabricMask.saveSettings(current);
  await FabricMask.getFakeSalt(); // created once, here – not concurrently by many frames
  createMenus();
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await FabricMask.getFakeSalt();
  createMenus();
  await updateBadge();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === FabricMask.STORAGE_AREA && (changes[FabricMask.STORAGE_KEY] || changes[FabricMask.CURTAIN_KEY])) {
    updateBadge();
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'toggle-masking') {
    await FabricMask.updateSettings((s) => {
      s.enabled = !s.enabled;
    });
  } else if (command === 'toggle-curtain') {
    await FabricMask.setCurtain(!(await FabricMask.getCurtain()));
  } else if (command === 'toggle-preview') {
    await FabricMask.updateSettings((s) => {
      s.preview = !s.preview;
    });
  } else if (command === 'toggle-presentation') {
    await togglePresentation(tab && tab.windowId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || sender.id !== chrome.runtime.id) return undefined;
  if (message.type === MSG.PICKER_DONE && sender.tab && sender.tab.id !== undefined) {
    // The picker runs in every frame of the tab; once one frame picked (or cancelled), stop the others.
    chrome.tabs.sendMessage(sender.tab.id, { type: MSG.STOP_PICKER }).catch(() => {});
  } else if (message.type === MSG.LEARN_NAMES && Array.isArray(message.names)) {
    // Learned names from all frames and tabs are merged here, serialized by one write queue.
    FabricMask.addLearnedNames(message.names.filter((n) => typeof n === 'string').slice(0, 100)).catch(() => {});
  } else if (message.type === MSG.TOGGLE_PRESENTATION) {
    togglePresentation(typeof message.windowId === 'number' ? message.windowId : undefined)
      .then((on) => sendResponse({ ok: true, on }), () => sendResponse({ ok: false }));
    return true; // async response
  }
  return undefined;
});

// Exposed for the end-to-end tests (menus and window states cannot be driven from Playwright).
self.fabMaskBackground = { handleMenuClick, togglePresentation };
