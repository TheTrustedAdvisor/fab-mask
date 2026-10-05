# Publishing to Microsoft Edge Add-ons

Step-by-step guide for submitting Fab Mask to [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons)
via Partner Center. Registration and publishing are free. Field names reflect Partner Center at the
time of writing and may change slightly.

## 1. One-time: register as an Edge developer

1. Open the [Partner Center Edge program](https://partner.microsoft.com/dashboard/microsoftedge/public/login?ref=dd)
   and sign in with a Microsoft account (personal) or a Microsoft Entra work account.
2. Choose the account type:
   - **Individual** – quickest; the publisher name shown in the store is yours.
   - **Company** – shows a company name; requires business verification (can take a few days).
3. Enter the publisher display name (e.g. *Matthias Falland* or *TheTrustedAdvisor*), contact details,
   and accept the **Microsoft Edge Add-ons developer agreement**.

## 2. Create the submission

Partner Center → **Microsoft Edge** → **Extensions** → **Create new extension**.

### Packages

Upload `fab-mask-<version>.zip` from the
[latest GitHub release](https://github.com/TheTrustedAdvisor/fab-mask/releases/latest)
(the ZIP, not the CRX – the store signs the package itself).

### Availability

| Field | Value |
|---|---|
| Visibility | **Public** (or *Hidden* for a test listing reachable only by link) |
| Markets | All markets |

### Properties

| Field | Value |
|---|---|
| Category | **Productivity** |
| Privacy policy required? | **Yes** |
| Privacy policy URL | `https://github.com/TheTrustedAdvisor/fab-mask/blob/main/PRIVACY.md` |
| Website URL | `https://github.com/TheTrustedAdvisor/fab-mask` |
| Support contact | `https://github.com/TheTrustedAdvisor/fab-mask/issues` |
| Mature content | No |

### Store listing (English)

| Field | Value / file |
|---|---|
| Display name | Taken from the package: **Fab Mask** |
| Description | Copy the *Detailed description* from [store-listing.md](store-listing.md) (min. 250 characters) |
| Short description | Copy the *Short description* from [store-listing.md](store-listing.md) |
| Extension logo (300×300) | `docs/images/store/logo-300x300.png` |
| Small promotional tile (440×280) | `docs/images/store/promo-small-440x280.png` |
| Large promotional tile (1400×560) | `docs/images/store/promo-large-1400x560.png` |
| Screenshots (1280×800) | `docs/images/store/portal-unmasked-1280x800.png`, `portal-pixelate-1280x800.png`, `portal-fake-1280x800.png`, `portal-preview-1280x800.png` |
| Search terms | Microsoft Fabric, Power BI, screen sharing, privacy, redact, mask, demo |

A German listing can be added as a second language; the extension UI is already localized.

### Notes for certification

Paste this into **Notes for certification**:

```
Fab Mask only acts on the Microsoft Fabric / Power BI web portal (app.fabric.microsoft.com,
*.powerbi.com), which requires a Microsoft work or school account. It hides sensitive values
(IDs, e-mail addresses, endpoints, secrets, person names) in the portal for screen sharing.

How to verify without a Fabric tenant:
- The listing screenshots show the portal with and without the extension.
- Popup: toggle masking, switch modes (pixelate / blur / fake data / redact), curtain and
  preview buttons; options page: custom terms and selectors.
- Source code and automated tests: https://github.com/TheTrustedAdvisor/fab-mask

Permissions: "storage" (local settings only) and "contextMenus" (right-click "always hide"
entries on Fabric pages). No network requests, no remote code, no data collection
(privacy policy: https://github.com/TheTrustedAdvisor/fab-mask/blob/main/PRIVACY.md).
```

Then **Publish**. Certification usually takes up to **7 business days**; Partner Center shows the
status and sends an e-mail.

## Fab Mask's Edge Add-ons identity

| Value | |
|---|---|
| Store ID | `0RDCKBR61GL8` |
| Product ID | `2ee3cd53-9035-4a72-8b16-6e79c0cd3dd2` |
| Extension (CRX) ID | `ngeccjajkajkbhaipmdbcfmhpabfengl` (derived from the store's public key – verified) |
| Store URL (once published) | `https://microsoftedge.microsoft.com/addons/detail/ngeccjajkajkbhaipmdbcfmhpabfengl` |

## 3. After publication

- Add the store link to the README installation table.
- **Updates:** Partner Center → the extension → **Update** → upload the new release ZIP → submit.
  (This can later be automated in the release workflow with the Edge Add-ons publish API.)
- **Extension ID:** the store version has the ID `ngeccjajkajkbhaipmdbcfmhpabfengl`, different from
  the self-signed CRX (`mamdngeehbhnikhehiplimphjgpfpdid`). Managed Edge devices can then
  force-install the store version with `ExtensionInstallForcelist` =
  `ngeccjajkajkbhaipmdbcfmhpabfengl;https://edge.microsoft.com/extensionwebstorebase/v1/crx`.
  Use one channel per device, otherwise both copies run.
