/* global FabricMask -- defined in the page by the injected styles.js */
// The mosaic filter must render in Blink (Chrome/Edge) and WebKit (Safari): a WebKit-specific
// coordinate quirk once made every masked element render empty (white) in Safari.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');

const STYLES = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'shared', 'styles.js'), 'utf8');

for (const [name, engine] of [['Blink', chromium], ['WebKit', webkit]]) {
  test(`mosaic filter renders visible blocks in ${name}`, async () => {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 400, height: 120 } });
      await page.setContent('<body style="margin:20px;background:#fff;font:16px sans-serif">' +
        '<span id="inline">jane.doe@contoso.com</span><div id="block">4e864cf8-386d-4067-bfa7-4ef5e408c474</div></body>');
      await page.addScriptTag({ content: STYLES });
      await page.evaluate(() => {
        document.body.appendChild(FabricMask.renderPixelateSvg(document, 8));
        const st = document.createElement('style');
        st.textContent = `#inline,#block{filter:url("#${FabricMask.PIXELATE_FILTER_ID}")}`;
        document.head.appendChild(st);
      });
      for (const id of ['#inline', '#block']) {
        const png = await page.locator(id).screenshot();
        // Count dark pixels via a canvas in the page (no image library needed).
        const dark = await page.evaluate(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, c.width, c.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 600) n++;
          return n / (d.length / 4);
        }, png.toString('base64'));
        assert.ok(dark > 0.15, `${name} ${id}: only ${(dark * 100).toFixed(1)}% non-white pixels – filter rendered empty`);
      }
    } finally {
      await browser.close();
    }
  });
}
