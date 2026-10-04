# Changelog

All notable changes to this project are documented here. Versions follow [SemVer](https://semver.org/).

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

[1.0.1]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.0.1
[1.0.0]: https://github.com/TheTrustedAdvisor/fab-mask/releases/tag/v1.0.0
