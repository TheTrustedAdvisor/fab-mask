# Publishing to the Mac App Store (Safari)

Safari extensions ship inside a small macOS app. `npm run release:safari` builds that app from the
same sources as the Chrome/Edge/Firefox versions, signs it with your Apple Developer team and uploads
it to App Store Connect. Field names reflect App Store Connect at the time of writing.

## 1. One-time setup

1. **Xcode → Settings → Accounts** → **+** → *Apple ID* → sign in with the Apple ID of your
   developer account.
2. Select the team → **Manage Certificates…** → **+** → **Apple Distribution**.
3. Look up your **Team ID** (10 characters) at
   [developer.apple.com → Membership details](https://developer.apple.com/account#MembershipDetailsCard).

The first `release:safari` run registers the bundle IDs `com.thetrustedadvisor.fabmask` (app) and
`com.thetrustedadvisor.fabmask.Extension` (extension) automatically (`-allowProvisioningUpdates`).

## 2. Create the app in App Store Connect

[App Store Connect](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**:

| Field | Value |
|---|---|
| Platform | macOS |
| Name | Fab Mask (must be unique on the App Store – alternative: *Fab Mask for Microsoft Fabric*) |
| Primary language | English (U.S.) |
| Bundle ID | `com.thetrustedadvisor.fabmask` (appears after the first `release:safari` run) |
| SKU | `fab-mask` |
| User access | Full access |

## 3. Upload a build

```bash
APPLE_TEAM_ID=XXXXXXXXXX npm run release:safari
```

This archives a signed Release build (version = extension version, build number e.g. `10402` for
1.4.2) and uploads it. To only produce the `.pkg` (e.g. for Transporter), add
`SAFARI_EXPORT_DESTINATION=export`. The build appears in App Store Connect under *TestFlight* after
a few minutes of processing.

## 4. App information

| Field | Value |
|---|---|
| Subtitle | Hide Fabric secrets on screen |
| Category | Developer Tools (secondary: Productivity) |
| Content rights | Does not contain third-party content |
| Age rating | 4+ (answer "No" to all questions) |
| Price | Free |
| Privacy policy URL | `https://github.com/TheTrustedAdvisor/fab-mask/blob/main/PRIVACY.md` |
| Copyright | 2026 Matthias Falland |

### App Privacy ("nutrition label")

**Data Not Collected.** Fab Mask transmits nothing; settings and learned names stay on the device.

### Version page (macOS)

| Field | Value |
|---|---|
| Screenshots (16:10) | `docs/images/store/portal-unmasked-1280x800.png`, `portal-pixelate-1280x800.png`, `portal-fake-1280x800.png`, `portal-preview-1280x800.png` |
| Promotional text | Present Microsoft Fabric without exposing IDs, endpoints or names – pixelate, blur, redact or fake them live. |
| Description | *Detailed description* from [store-listing.md](store-listing.md), plus: "After installing, enable Fab Mask in Safari → Settings → Extensions and allow it on app.fabric.microsoft.com." |
| Keywords (≤ 100 chars) | `fabric,power bi,microsoft,privacy,screen sharing,redact,mask,demo,blur,pixelate` |
| Support URL | `https://github.com/TheTrustedAdvisor/fab-mask/issues` |
| Marketing URL | `https://github.com/TheTrustedAdvisor/fab-mask` |
| Build | the uploaded build |

### App Review information

- **Sign-in required:** No (the app itself needs no account).
- **Notes:**

```
Fab Mask is a Safari Web Extension. The app only explains how to enable it; the functionality runs
in Safari on the Microsoft Fabric / Power BI web portal (app.fabric.microsoft.com, *.powerbi.com),
which requires a Microsoft work or school account. It hides sensitive values (IDs, e-mail
addresses, endpoints, secrets, person names) for screen sharing.

To review without a Fabric tenant: the screenshots show the portal with and without the extension;
the extension popup (masking toggle, modes, curtain, preview) and settings page work on any page.
Source code and automated tests: https://github.com/TheTrustedAdvisor/fab-mask
No data is collected or transmitted (privacy policy linked above).
```

Then **Add for Review** → **Submit**. Review usually takes 1–3 days.

## 5. Updates

Bump the version as usual, then run `APPLE_TEAM_ID=… npm run release:safari` and submit the new build
for review. (CI automation would need an App Store Connect API key – see the store automation notes.)
