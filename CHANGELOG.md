# Changelog

All notable changes to this project are documented here. Versions follow [SemVer](https://semver.org/).

## [1.3.2] – 2026-10-05

### Fixed
- The popup was cut off: Chrome and Edge limit extension popups to 600 px height, and the
  single-column popup had grown to ~900 px. New two-column layout (640 px wide, ~550 px high in
  English and German); a test now fails if any UI language exceeds the limit.

## [1.3.1] – 2026-10-05

### Added
- **Send feedback** link in the popup and on the options page: opens a pre-filled GitHub issue form
  (type, description, environment). Only non-sensitive diagnostics are filled in – extension
  version, browser, OS, mode, profile, enabled categories and the *number* of custom terms and
  selectors; never page URLs, terms, selectors or learned names.

### Changed
- The popup footer shows "Send feedback" instead of the masking shortcut hint (all shortcuts are
  listed in the README).

## [1.3.0] – 2026-10-05

### Added
- **Presentation mode** (Alt+Shift+F or "Present" in the popup): switches the window to full screen
  so the address bar – which contains workspace and item IDs – disappears from screen shares, turns
  masking on and optionally applies a profile (options page). Toggling again restores the window.
- **Right-click menu** on Fabric pages: "always hide “<selection>”" adds the selected text as a
  custom term; "always hide this element" adds the right-clicked element as a custom selector.
  New permission `contextMenus` (no install warning).

## [1.2.1] – 2026-10-05

### Fixed
- OneLake catalog column headers ("Owner", "Location") were masked – and replaced with fake names
  in fake-data mode – because the catalog marks header cells only via the header row.
- Fake-data overlays now wrap like the original text (a two-line owner name was cut off).

### Changed
- README and store screenshots now show the real Fabric portal (demo tenant) instead of a mock page.

## [1.2.0] – 2026-10-04

### Added
- **Learned person names**: names from owner, admin and account fields are collected locally and
  masked everywhere in the portal (descriptions, lineage, search …). Listed on the options page,
  removable individually or all at once. New category "Learned person names" (on by default).
- **Tooltip masking**: native `title` tooltips of masked elements, and tooltips containing
  sensitive values, are masked; originals are restored when switched off.
- **Curtain** (Alt+Shift+B or popup): covers all Fabric tabs with a neutral overlay.
- **Preview mode** (Alt+Shift+P or popup): outlines everything that is masked and shows a counter.
- **Fake-data mode**: plausible, consistent replacement values (same person → same fake name,
  same ID → same fake ID) shown as an overlay; inputs, images and initials stay pixelated.
- **Profiles**: built-in *Customer demo*, *Recording (fake data)*, *Screenshots (redact)*,
  *Internal training*, plus user profiles saved on the options page.
- Performance regression test (3,000-row list with all features on).

### Changed
- Documentation (README, installation guide, privacy policy, store texts) is now English-only.

### Fixed
- The README's "without Fab Mask" screenshot showed masked content (race with the install handler
  in the screenshot script); the script now verifies that all demo shots differ.

## [1.1.1] – 2026-10-04

### Fixed
- **Portal froze or stopped loading** (e.g. OneLake catalog, admin portal → Domains). The
  main-world `attachShadow` hook queued a microtask per shadow root; in Fabric's Angular/zone.js
  app every microtask triggers change detection, which created new shadow roots – an endless
  microtask loop. The hook is removed; the extension no longer runs any code in the page's
  JavaScript context.
- Shadow roots only receive the masking stylesheet and filter when they actually contain
  something to mask (Fabric has one shadow root per tooltip), reducing style recalculation.

### Added
- Admin/member name lists (admin portal → Domains → Admins) are masked as part of
  "Signed-in user".

## [1.1.0] – 2026-10-04

### Added
- **Pixelate mode** (new default): a mosaic filter keeps masked text visible as coloured blocks
  instead of fading into the background like the blur. Block size follows the "Strength" slider
  (minimum 6 px so large headings stay unreadable). Installs still on the untouched 1.0.x default
  (blur 8 px) switch to pixelate automatically.

### Fixed
- Masked elements nested inside other masked elements (e.g. string tokens in a masked notebook
  line) are no longer filtered twice, which made them almost invisible.

## [1.0.1] – 2026-10-04

### Fixed
- Column headers ("Owner", "Location") in workspace lists and the OneLake catalog are no longer
  masked – only the cells below them.

## [1.0.0] – 2026-10-04

First release.

### Added
- Masking of GUIDs, e-mail addresses / UPNs, Fabric & Azure endpoints and connection strings
  (incl. OneLake/`abfss://`, XMLA, Power Query data source references), keys & tokens, and
  optional IPv4 addresses.
- Signed-in user masking: avatar, account flyout (name, e-mail, tenant), Owner columns,
  OneLake catalog owner, workspace image.
- Optional workspace-name masking (header, navigation, workspace list, catalog location).
- Custom terms (whole-word, case-insensitive) and custom CSS selectors; element picker that works
  across frames.
- Coverage of notebooks (`pbides.powerbi.com`), lakehouse explorer and pipelines frames,
  Monaco editor lines, open and closed shadow roots, inputs and the tab title.
- Blur or redact mode, adjustable blur, reveal-on-hover, Alt+Shift+M toggle with "OFF" badge.
- Popup and options page in English and German, light and dark theme.
- Signed CRX + `updates.xml` for policy-based deployment (Chrome & Edge).

[1.3.2]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.3.2
[1.3.1]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.3.1
[1.3.0]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.3.0
[1.2.1]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.2.1
[1.2.0]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.2.0
[1.1.1]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.1.1
[1.1.0]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.1.0
[1.0.1]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.0.1
[1.0.0]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.0.0
