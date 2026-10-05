# Publishing to Firefox Add-ons (addons.mozilla.org)

1. Sign in at the [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/) with a
   Firefox account and accept the developer agreement.
2. **Submit a New Add-on** → *On this site* (public listing on addons.mozilla.org).
3. Upload **`fab-mask-<version>-firefox.zip`** from the
   [latest release](https://github.com/TheTrustedAdvisor/fab-mask/releases/latest). Mozilla validates
   it with the same linter as `npm run lint:firefox`; two warnings about `dom.openOrClosedShadowRoot`
   are expected – it is the guarded Chrome code path, Firefox uses `element.openOrClosedShadowRoot()`.
4. Source code: not required – the package contains the unminified sources. If asked, point to
   <https://github.com/TheTrustedAdvisor/fab-mask>.
5. Listing details:

   | Field | Value |
   |---|---|
   | Name | Fab Mask |
   | Summary | Short description from [store-listing.md](store-listing.md) |
   | Description | Detailed description from [store-listing.md](store-listing.md) |
   | Categories | Privacy & Security, Other |
   | Homepage | `https://github.com/TheTrustedAdvisor/fab-mask` |
   | Support site | `https://github.com/TheTrustedAdvisor/fab-mask/issues` |
   | Privacy policy | Contents of [PRIVACY.md](../PRIVACY.md) |
   | License | MIT |
   | Icon | `src/icons/icon128.png` |
   | Screenshots | `docs/images/store/portal-*-1280x800.png` |

6. **Notes to reviewer**: reuse the certification notes from [publishing-edge.md](publishing-edge.md).

The add-on ID is fixed in the manifest (`fab-mask@thetrustedadvisor`), so updates are uploaded to the
same listing (*Upload New Version*). Review usually takes a few days.
