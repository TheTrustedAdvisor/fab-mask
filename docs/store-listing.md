# Store listing (Chrome Web Store & Microsoft Edge Add-ons)

Everything needed to submit `fab-mask-<version>.zip` from the GitHub release.
Step-by-step for Edge: [publishing-edge.md](publishing-edge.md).

| | Chrome Web Store | Edge Add-ons |
|---|---|---|
| Developer account | <https://chrome.google.com/webstore/devconsole> – one-time US$5 | <https://partner.microsoft.com/dashboard/microsoftedge> – free |
| Package | `fab-mask-<version>.zip` | same ZIP |
| Category | Productivity / Developer Tools | Productivity / Developer tools |
| Privacy policy URL | <https://github.com/TheTrustedAdvisor/fab-mask/blob/main/PRIVACY.md> | same |
| Support / homepage | <https://github.com/TheTrustedAdvisor/fab-mask> | same |
| Developer | Matthias Falland – <https://www.fabricperiodictable.com> | same |
| Screenshots (1280×800) | `docs/images/store/portal-unmasked-1280x800.png`, `portal-pixelate-1280x800.png`, `portal-fake-1280x800.png`, `portal-preview-1280x800.png` | same |
| Logo | 128 px icon from the package | `docs/images/store/logo-300x300.png` |
| Small promo tile (440×280) | `docs/images/store/promo-small-440x280.png` | same |
| Marquee / large tile (1400×560) | `docs/images/store/promo-large-1400x560.png` | same |

Note: a store-installed copy gets a store-assigned extension ID, different from the ID of the
self-signed CRX (`mamdngeehbhnikhehiplimphjgpfpdid`). Use one channel per device.

## Name

Fab Mask

## Short description (≤ 132 characters)

Hide IDs, e-mails, endpoints, secrets and names in the Microsoft Fabric & Power BI portal for demos and screen sharing.

## Detailed description

Presenting Microsoft Fabric to customers, recording a tutorial or taking screenshots? Fab Mask
blurs or redacts sensitive information in the Fabric and Power BI portal before it reaches your
screen share.

What it hides:
• Workspace, item, tenant and capacity IDs (GUIDs) – also inside URLs and paths
• E-mail addresses and UPNs (owners, access lists, guest accounts)
• SQL analytics endpoints, OneLake/abfss paths, XMLA and KQL URIs, connection strings, data sources
• Keys and tokens: account keys, SAS signatures, passwords, JWTs
• The signed-in user: avatar, account menu, owner columns
• Optional: workspace names, IP addresses
• Your own terms (customer, project or person names) and any element you pick on the page

Works in notebooks (including code cells and outputs), the lakehouse explorer, pipelines and the
OneLake catalog. Pixelate, blur, redact – or replace values with consistent fake data for
recordings. Learns person names from owner fields and masks them everywhere, hides tooltips,
"curtain" shortcut to cover the portal instantly, preview mode to check before sharing, and
profiles for customer demos, recordings and screenshots. English and German.

Privacy: no data collection, no network requests, settings stay local in your browser.
Not affiliated with Microsoft.

## Single purpose (Chrome)

Hides sensitive information displayed in the Microsoft Fabric / Power BI web portal so it is not
exposed during screen sharing, recordings or screenshots.

## Permission justifications (Chrome)

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings (on/off, categories, custom terms and selectors) locally. |
| `contextMenus` | Adds "always hide this text / element" entries to the right-click menu on Fabric pages. |
| Host access (content scripts on `*.fabric.microsoft.com`, `*.powerbi.com`, `*.powerbigov.us`, `*.powerbi.cn`, `*.pbidedicated.windows.net`, `*.analysis.windows.net`) | The extension must read page text on the Fabric / Power BI portal and its embedded frames (notebooks, lakehouse explorer, pipelines) to detect and hide sensitive values. It runs on no other sites. |
| Remote code | None. All code is packaged. |

## Data usage disclosure (Chrome)

- Collects: **nothing** (no category checked).
- Certifications: does not sell data, does not use or transfer data for purposes unrelated to the
  single purpose, does not use data for creditworthiness or lending.

## Test notes for reviewers

The extension only acts on the Microsoft Fabric portal (requires a Microsoft work account).
Without one, reviewers can verify behaviour via the screenshots, or by opening any page on
`https://app.fabric.microsoft.com/` (the sign-in page is not masked as it contains no tenant data).
Toggle: toolbar popup or Alt+Shift+M.
