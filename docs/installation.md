# Installation

Fab Mask runs in **Google Chrome** and **Microsoft Edge** version 111 or later and in **Mozilla
Firefox** 142 or later (Windows, macOS, Linux).

- [Single machine: load unpacked](#single-machine-load-unpacked)
- [Firefox](#firefox)
- [Enterprise deployment via policy](#enterprise-deployment-via-policy)
- [Troubleshooting](#troubleshooting)

> **Why not just double-click a `.crx`?** On Windows and macOS, Chrome and Edge block extensions that
> do not come from the Chrome Web Store or Edge Add-ons – unless they are deployed via enterprise
> policy. This is a browser security measure.

## Single machine: load unpacked

1. On the [releases page](https://github.com/TheTrustedAdvisor/fab-mask/releases/latest), download
   **`fab-mask-<version>.zip`**.
2. Unzip it into a **permanent** folder (e.g. `~/Extensions/fab-mask`) – the browser loads the
   extension from there on every start. If the folder is deleted, the extension disappears.
3. Open the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. Turn on **Developer mode** (Chrome: top right, Edge: bottom left).
5. Click **Load unpacked** and select the unzipped folder.
6. Optional: **pin** the extension to the toolbar via the puzzle icon.
7. **Reload** Fabric tabs that are already open.

**Updating:** unzip the new ZIP into the same folder (replace the files) and click **Reload** (↻) on
Fab Mask on the extensions page.

Note: Chrome may show a notice about extensions in developer mode at startup. This is normal for
unpacked extensions.

## Firefox

Firefox only installs add-ons permanently when they are signed by Mozilla (addons.mozilla.org).
Until the AMO listing is live, load it as a **temporary add-on** (stays until Firefox restarts):

1. Download **`fab-mask-<version>-firefox.zip`** from the
   [releases page](https://github.com/TheTrustedAdvisor/fab-mask/releases/latest) and unzip it.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → select the
   `manifest.json` in the unzipped folder.
3. If Firefox asks for site access, allow it for the Fabric / Power BI sites
   (`about:addons` → Fab Mask → *Permissions*).
4. Reload open Fabric tabs.

All features work as in Chrome/Edge. Shortcuts can be changed in `about:addons` → ⚙ →
*Manage Extension Shortcuts*.

## Enterprise deployment via policy

On managed devices, the **signed CRX** from the GitHub release is installed via policy. Browsers then
update automatically through `updates.xml`.

| Value | |
|---|---|
| Extension ID | `mamdngeehbhnikhehiplimphjgpfpdid` |
| Update URL | `https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml` |

The ID is determined by the signing key and stays the same across all versions.

### Windows – Intune (Settings Catalog) or Group Policy

**Chrome** (*Google Chrome → Extensions → Configure the list of force-installed apps and extensions*,
policy `ExtensionInstallForcelist`):

```
mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml
```

**Edge** (*Microsoft Edge → Extensions → Control which extensions are installed silently*,
policy `ExtensionInstallForcelist`): same value.

Alternatively via the registry (e.g. a test machine, as administrator):

```bat
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml" /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml" /f
```

Instead of force-installing, the `ExtensionSettings` policy can also just **allow** the extension
(`"installation_mode": "normal_installed"` or `"allowed"` with `update_url`).

### macOS – Jamf / Intune (configuration profile)

Domain `com.google.Chrome` or `com.microsoft.Edge`:

```xml
<key>ExtensionInstallForcelist</key>
<array>
  <string>mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml</string>
</array>
```

### Linux

`/etc/opt/chrome/policies/managed/fab-mask.json` (Chrome) or
`/etc/opt/edge/policies/managed/fab-mask.json` (Edge):

```json
{
  "ExtensionInstallForcelist": [
    "mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml"
  ]
}
```

### Verify

Open `chrome://policy` or `edge://policy` → *Reload policies*. Fab Mask then appears in
`chrome://extensions` with the note "Installed by your organization".

## Troubleshooting

| Problem | Solution |
|---|---|
| The popup says "Not a Fabric page" on a Fabric page | Reload the tab (required after installing or updating). |
| Something is not masked | In the popup, use **Pick element to mask** and click it, or add a term on the options page. Please open an issue (without real data). |
| Too much is masked | Turn the category off in the popup; check custom selectors on the options page. |
| A person name keeps being masked | Remove it from the learned names on the options page – removed names are not learned again. |
| Shortcuts Alt+Shift+M / B / P / F do nothing | `chrome://extensions/shortcuts` or `edge://extensions/shortcuts` – another extension may use them. |
| Policy installation fails | Check errors in `chrome://policy`; the update URL must be reachable from the device (github.com). |
