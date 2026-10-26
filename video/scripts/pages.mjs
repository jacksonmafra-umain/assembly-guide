// Renders manual pages to PNG through the app's dev-only PDF viewer (.superpowers/viewer in the repo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_CORE);
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const PAGES = [
  ['billy-bookcase-white__AA-2289108-3-100.pdf', [1, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 'billy-80'],
  ['billy-corner-hardware-galvanized__AA-197501-5-2.pdf', [5], 'corner'],
  ['billy-height-extension-unit-white__AA-2287627-4-100.pdf', [10], 'ext'],
  ['billy-bookcase-white__AA-2287624-3-100.pdf', [9], 'billy-40'],
];
mkdirSync('assets/manual', { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
for (const [file, pages, id] of PAGES) {
  for (const p of pages) {
    await page.goto(`${APP}/.superpowers/viewer/index.html?f=${file}&p=${p}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.title.startsWith('p'), { timeout: 30000 });
    writeFileSync(`assets/manual/${id}-p${String(p).padStart(2, '0')}.png`, await page.screenshot({ type: 'png' }));
  }
}
await browser.close();
console.log('pages done');
