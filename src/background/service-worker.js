/* global FabricMask */
importScripts('../shared/settings.js');

const MSG = FabricMask.MESSAGES;

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
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await FabricMask.getFakeSalt();
  await updateBadge();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === FabricMask.STORAGE_AREA && (changes[FabricMask.STORAGE_KEY] || changes[FabricMask.CURTAIN_KEY])) {
    updateBadge();
  }
});

chrome.commands.onCommand.addListener(async (command) => {
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
  }
});

// The picker runs in every frame of the tab; once one frame picked (or cancelled), stop the others.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || sender.id !== chrome.runtime.id) return;
  if (message.type === MSG.PICKER_DONE && sender.tab && sender.tab.id !== undefined) {
    chrome.tabs.sendMessage(sender.tab.id, { type: MSG.STOP_PICKER }).catch(() => {});
  } else if (message.type === MSG.LEARN_NAMES && Array.isArray(message.names)) {
    // Learned names from all frames and tabs are merged here, serialized by one write queue.
    FabricMask.addLearnedNames(message.names.filter((n) => typeof n === 'string').slice(0, 100)).catch(() => {});
  }
});
