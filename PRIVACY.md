# Privacy Policy – Fab Mask

_Last updated: 2026-10-04_

**Fab Mask does not collect, transmit, sell or share any data.**

- The extension runs entirely inside your browser. It contains no analytics, telemetry, tracking or
  remote code, and it makes no network requests.
- To decide what to hide, the extension reads the text of pages on the Microsoft Fabric / Power BI
  portal **locally** and marks matching elements with an attribute. Page content never leaves the
  page.
- **Learned person names**: to mask people consistently, the extension remembers names shown in
  owner and admin fields of the portal. This list is stored with `chrome.storage.local` in your
  browser profile only, can be reviewed and deleted at any time on the options page, and is never
  transmitted.
- Your settings (toggles, profiles, custom terms, custom CSS selectors) are also stored with
  `chrome.storage.local` only. Nothing is synced to your Google or Microsoft account. Uninstalling
  the extension deletes all of it.
- Permissions: `storage` (settings) and `contextMenus` (right-click entries). Content scripts run
  only on the Fabric / Power BI hosts listed in the manifest. Presentation mode only changes the
  window state (full screen) via the `windows` API, which needs no permission.

Questions: open an issue at <https://github.com/TheTrustedAdvisor/fab-mask/issues>.
