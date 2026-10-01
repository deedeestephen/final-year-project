// Photographs the window (".win") on each page that report.py wrote, at 1.5
// times the size, so the text stays sharp.
//   node shoot-pages.mjs <pages folder> <output folder> <name>...
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { withBrowser } from './chrome.mjs';

const [pages, out, ...names] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

await withBrowser(async (browser) => {
  await browser.send('Emulation.setDeviceMetricsOverride', {
    width: 960,
    height: 800,
    deviceScaleFactor: 1.5,
    mobile: false,
  });
  for (const name of names) {
    await browser.navigate(pathToFileURL(join(pages, `${name}.html`)).href);
    const { x, y, width, height } = JSON.parse(
      await browser.evaluate(`JSON.stringify(document.querySelector('.win').getBoundingClientRect())`),
    );
    const shot = await browser.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x, y, width, height, scale: 1 },
      captureBeyondViewport: true,
    });
    writeFileSync(join(out, `${name}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  ${name}.png`);
  }
});
