# Installation

Fab Mask läuft in **Google Chrome** und **Microsoft Edge** ab Version 111 (Windows, macOS, Linux).

- [Einzelplatz: entpackt laden](#einzelplatz-entpackt-laden)
- [Unternehmensweit per Richtlinie](#unternehmensweit-per-richtlinie)
- [Aus dem Store](#aus-dem-store)
- [Fehlerbehebung](#fehlerbehebung)

> **Warum kein Doppelklick auf eine `.crx`?** Chrome und Edge blockieren unter Windows und macOS
> Erweiterungen, die nicht aus dem Chrome Web Store bzw. Edge Add-ons stammen – außer sie werden
> per Unternehmensrichtlinie verteilt. Das ist eine Sicherheitsmaßnahme der Browser.

## Einzelplatz: entpackt laden

1. Auf der [Release-Seite](https://github.com/TheTrustedAdvisor/fab-mask/releases/latest)
   **`fab-mask-<version>.zip`** herunterladen.
2. In einen **dauerhaften** Ordner entpacken (z. B. `~/Extensions/fab-mask`) – der Browser lädt die
   Erweiterung bei jedem Start von dort. Wird der Ordner gelöscht, verschwindet die Erweiterung.
3. Erweiterungsseite öffnen:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. **Entwicklermodus** aktivieren (Chrome: oben rechts, Edge: links unten).
5. **Entpackte Erweiterung laden** (Edge: *Entpackt laden*) → entpackten Ordner wählen.
6. Optional: Erweiterung über das Puzzle-Symbol an die Symbolleiste **anheften**.
7. Bereits geöffnete Fabric-Tabs **neu laden**.

**Update:** neue ZIP in denselben Ordner entpacken (Dateien ersetzen) und auf der Erweiterungsseite
bei Fab Mask auf **Neu laden** (↻) klicken.

Hinweis: Chrome zeigt beim Start ggf. einen Hinweis auf Erweiterungen im Entwicklermodus an. Das ist
bei entpackt geladenen Erweiterungen normal.

## Unternehmensweit per Richtlinie

Für verwaltete Geräte wird das **signierte CRX** aus dem GitHub-Release per Richtlinie installiert.
Browser laden Updates danach automatisch über `updates.xml`.

| Wert | |
|---|---|
| Extension-ID | `mamdngeehbhnikhehiplimphjgpfpdid` |
| Update-URL | `https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml` |

Die ID ist durch den Signaturschlüssel festgelegt und bleibt über alle Versionen gleich.

### Windows – Intune (Settings Catalog) oder Gruppenrichtlinie

**Chrome** (*Google Chrome → Extensions → Configure the list of force-installed apps and extensions*,
Richtlinie `ExtensionInstallForcelist`):

```
mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml
```

**Edge** (*Microsoft Edge → Extensions → Control which extensions are installed silently*,
Richtlinie `ExtensionInstallForcelist`): gleicher Wert.

Alternativ per Registry (z. B. Testgerät, als Administrator):

```bat
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml" /f
reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml" /f
```

Statt der Zwangsinstallation kann die Erweiterung über die Richtlinie `ExtensionSettings` auch nur
**erlaubt** werden (`"installation_mode": "normal_installed"` bzw. `"allowed"` mit `update_url`).

### macOS – Jamf / Intune (Konfigurationsprofil)

Domäne `com.google.Chrome` bzw. `com.microsoft.Edge`:

```xml
<key>ExtensionInstallForcelist</key>
<array>
  <string>mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml</string>
</array>
```

### Linux

`/etc/opt/chrome/policies/managed/fab-mask.json` (Chrome) bzw.
`/etc/opt/edge/policies/managed/fab-mask.json` (Edge):

```json
{
  "ExtensionInstallForcelist": [
    "mamdngeehbhnikhehiplimphjgpfpdid;https://github.com/TheTrustedAdvisor/fab-mask/releases/latest/download/updates.xml"
  ]
}
```

### Prüfen

`chrome://policy` bzw. `edge://policy` → *Richtlinien neu laden*. Danach erscheint Fab Mask unter
`chrome://extensions` mit dem Hinweis „Von deiner Organisation installiert“.

## Aus dem Store

Die Einreichung im **Chrome Web Store** und bei **Microsoft Edge Add-ons** ist vorbereitet
(Paket: `fab-mask-<version>.zip` aus dem Release, Texte: [store-listing.md](store-listing.md)).
Sobald freigegeben, steht hier der Link.

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| Popup meldet „Keine Fabric-Seite“ auf einer Fabric-Seite | Tab neu laden (nach Installation/Update nötig). |
| Etwas wird nicht maskiert | Im Popup **Element zum Maskieren auswählen** und darauf klicken, oder Begriff auf der Optionsseite eintragen. Gern ein Issue eröffnen (ohne echte Daten). |
| Zu viel wird maskiert | Kategorie im Popup abschalten; eigene Selektoren auf der Optionsseite prüfen. |
| Tastenkürzel Alt+Shift+M reagiert nicht | `chrome://extensions/shortcuts` bzw. `edge://extensions/shortcuts` – evtl. von einer anderen Erweiterung belegt. |
| Richtlinien-Installation schlägt fehl | In `chrome://policy` Fehler prüfen; die Update-URL muss vom Gerät aus erreichbar sein (github.com). |
