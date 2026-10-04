/* global FabricMask */
importScripts('../shared/settings.js');

const MSG = FabricMask.MESSAGES;

async function updateBadge(settings) {
  const s = settings || (await FabricMask.loadSettings());
  await chrome.action.setBadgeText({ text: s.enabled ? '' : 'OFF' });
  await chrome.action.setTitle({
    title: `${chrome.i18n.getMessage('extName')} – ${chrome.i18n.getMessage(s.enabled ? 'statusOn' : 'statusOff')}`
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setBadgeBackgroundColor({ color: '#8a8886' });
  // Persist normalized settings so new defaults are filled in after an update.
  const settings = await FabricMask.saveSettings(await FabricMask.loadSettings());
  await updateBadge(settings);
});

chrome.runtime.onStartup.addListener(() => updateBadge());

chrome.storage.onChanged.addListener((changes, areaName) => {
  const settings = FabricMask.settingsFromChange(changes, areaName);
  if (settings) updateBadge(settings);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-masking') {
    await FabricMask.updateSettings((s) => {
      s.enabled = !s.enabled;
      return s;
    });
  }
});

// The picker runs in every frame of the tab; once one frame picked (or cancelled), stop the others.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message && message.type === MSG.PICKER_DONE && sender.tab && sender.tab.id !== undefined) {
    chrome.tabs.sendMessage(sender.tab.id, { type: MSG.STOP_PICKER }).catch(() => {});
  }
});
