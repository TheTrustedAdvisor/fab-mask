# Store listing (Chrome Web Store & Microsoft Edge Add-ons)

Everything needed to submit `fab-mask-<version>.zip` from the GitHub release.

| | Chrome Web Store | Edge Add-ons |
|---|---|---|
| Developer account | <https://chrome.google.com/webstore/devconsole> – one-time US$5 | <https://partner.microsoft.com/dashboard/microsoftedge> – free |
| Package | `fab-mask-<version>.zip` | same ZIP |
| Category | Productivity / Developer Tools | Productivity / Developer tools |
| Privacy policy URL | <https://github.com/TheTrustedAdvisor/fab-mask/blob/main/PRIVACY.md> | same |
| Support / homepage | <https://github.com/TheTrustedAdvisor/fab-mask> | same |
| Screenshots (1280×800) | `docs/images/demo-unmasked.png`, `demo-masked.png`, `demo-redacted.png`, `options.png` | same |
| Small promo tile | optional | optional |

Note: a store-installed copy gets a store-assigned extension ID, different from the ID of the
self-signed CRX (`mamdngeehbhnikhehiplimphjgpfpdid`). Use one channel per device.

## Name

Fab Mask

## Short description (≤ 132 characters)

**EN:** Hide IDs, e-mails, endpoints, secrets and names in the Microsoft Fabric & Power BI portal for demos and screen sharing.

**DE:** Versteckt IDs, E-Mails, Endpunkte, Secrets und Namen im Microsoft Fabric- & Power BI-Portal für Demos und Bildschirmfreigaben.

## Detailed description

**EN**

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
OneLake catalog. Toggle with Alt+Shift+M. Pixelate, blur or redact mode. English and German.

Privacy: no data collection, no network requests, settings stay local in your browser.
Not affiliated with Microsoft.

**DE**

Du präsentierst Microsoft Fabric bei Kunden, nimmst ein Tutorial auf oder machst Screenshots?
Fab Mask macht sensible Informationen im Fabric- und Power BI-Portal unscharf oder schwärzt sie –
bevor sie in der Bildschirmfreigabe landen.

Was verborgen wird:
• Workspace-, Item-, Tenant- und Capacity-IDs (GUIDs) – auch in URLs und Pfaden
• E-Mail-Adressen und UPNs (Besitzer, Zugriffslisten, Gastkonten)
• SQL-Endpunkte, OneLake-/abfss-Pfade, XMLA- und KQL-URIs, Connection Strings, Datenquellen
• Schlüssel und Tokens: Account Keys, SAS-Signaturen, Passwörter, JWTs
• Der angemeldete Benutzer: Avatar, Kontomenü, Besitzer-Spalten
• Optional: Workspace-Namen, IP-Adressen
• Eigene Begriffe (Kunden-, Projekt- oder Personennamen) und beliebige Elemente per Auswahl auf der Seite

Funktioniert auch in Notebooks (inkl. Code-Zellen und Ausgaben), im Lakehouse-Explorer, in Pipelines
und im OneLake-Katalog. Umschalten mit Alt+Shift+M. Modus Pixel, Unscharf oder Schwärzen. Deutsch und Englisch.

Datenschutz: keine Datenerhebung, keine Netzwerkzugriffe, Einstellungen bleiben lokal im Browser.
Nicht mit Microsoft verbunden.

## Single purpose (Chrome)

Hides sensitive information displayed in the Microsoft Fabric / Power BI web portal so it is not
exposed during screen sharing, recordings or screenshots.

## Permission justifications (Chrome)

| Permission | Justification |
|---|---|
| `storage` | Stores the user's settings (on/off, categories, custom terms and selectors) locally. |
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
