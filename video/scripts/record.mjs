// Records frame-exact clips of the Assembly Guide app (running at APP_URL) with headless Chrome.
// The app's ?capture mode freezes its clock; each frame advances it by 1/30 s and takes a screenshot.
// Usage: node scripts/record.mjs [shot ...]   (no args: every shot)
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_CORE);
const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME;
const FPS = 30;

const press = (key) => async (page) => page.keyboard.press(key);
const click = (sel) => async (page) => page.evaluate((s) => document.querySelector(s)?.click(), sel);

const SHOTS = {
  'showroom-combo': { hash: '#/showroom/billy-corner-combo', seconds: 7, prefs: { revolve: '1' } },
  'showroom-80': { hash: '#/showroom/billy-80', seconds: 4, prefs: { revolve: '1' } },
  'assembly-80': { hash: '#/assembly/billy-80/1', seconds: 16, at: [[0.4, press('Space')]] },
  'detail-camlock': { hash: '#/assembly/billy-80/5', seconds: 7, at: [[0.6, click('[data-ref="119081"]')]] },
  'combo-build': { hash: '#/assembly/billy-corner-combo/1', seconds: 10, speed: 24, wide: true, at: [[0.1, press('Space')]] },
  'how-80': { hash: '#/how/billy-80/4', seconds: 5, settle: 3 },
};

async function record(browser, name, shot) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((prefs) => {
    const all = { theme: 'dark', accent: 'ember', iso: '0', revolve: '0', ...prefs };
    for (const [k, v] of Object.entries(all)) localStorage.setItem(`assembly-lab-${k}`, v);
  }, shot.prefs ?? {});
  await page.goto(`${APP}/?capture${shot.wide ? '&wide' : ''}${shot.hash}`, { waitUntil: 'networkidle0' });
  for (let i = 0; i < 10; i++) await page.evaluate(() => window.__advance(1000 / 30));
  if (shot.settle) await new Promise((r) => setTimeout(r, shot.settle * 1000)); // let pdf.js paint
  // puppeteer's page.screenshot waits on requestAnimationFrame, which the frozen clock owns: use CDP directly
  const cdp = await page.createCDPSession();
  const dir = join('captures', 'frames', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = Math.round(shot.seconds * FPS), step = (1000 / FPS) * (shot.speed ?? 1);
  const pending = [...(shot.at ?? [])];
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    while (pending.length && pending[0][0] <= t * (shot.speed ?? 1)) await pending.shift()[1](page);
    await page.evaluate((ms) => window.__advance(ms), step);
    if (process.env.DEBUG) console.log('frame', f, 'advanced');
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(dir, `${String(f).padStart(5, '0')}.png`), Buffer.from(data, 'base64'));
  }
  await page.close();
  mkdirSync(join('assets', 'clips'), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%05d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-g', '1', join('assets', 'clips', `${name}.mp4`)]);
  console.log(`${name}: ${frames} frames`);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], protocolTimeout: 120000 });
for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS)) await record(browser, name, SHOTS[name]);
await browser.close();
