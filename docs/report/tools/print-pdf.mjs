// Prints a page to an A4 PDF, with the page number at the foot of each page.
//   node print-pdf.mjs <page.html> <output.pdf>
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { withBrowser } from './chrome.mjs';

const [page, out] = process.argv.slice(2);

const footer = `
<div style="width: 100%; padding: 0 15mm; display: flex; justify-content: space-between;
  font: 8px 'Segoe UI', system-ui, sans-serif; color: #52627a;">
  <span>PCa mHealth operations manual</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

await withBrowser(async (browser) => {
  await browser.navigate(pathToFileURL(page).href);
  // Every picture and font must have loaded before printing.
  await browser.evaluate(`Promise.all([...document.images].map((img) =>
    img.complete ? 0 : new Promise((done) => { img.onload = img.onerror = done; })))`);
  await browser.evaluate('document.fonts.ready.then(() => 0)');
  const missing = await browser.evaluate(
    `[...document.images].filter((img) => !img.naturalWidth).map((img) => img.getAttribute('src'))`,
  );
  if (missing.length) throw new Error(`These pictures did not load: ${missing.join(', ')}`);
  // Fetched in pieces: Chrome does not send a PDF this large in one message.
  const { stream } = await browser.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
    transferMode: 'ReturnAsStream',
  });
  const parts = [];
  for (;;) {
    const piece = await browser.send('IO.read', { handle: stream, size: 1 << 20 });
    parts.push(Buffer.from(piece.data, piece.base64Encoded ? 'base64' : 'utf8'));
    if (piece.eof) break;
  }
  await browser.send('IO.close', { handle: stream });
  writeFileSync(out, Buffer.concat(parts));
});
