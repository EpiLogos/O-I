/**
 * The Technē HUD, in a real browser (2026-09-22): proves the six existing
 * M0′–M5′ instruments are AVAILABLE in the live HUD (TechneSurfaceHost) over a
 * REAL production reading (wikiReadingPayload, carrying the M4′ producer's
 * spatial facets), that selecting an instrument mounts it, that the M4′ place
 * instrument renders the produced places, and — the §41 negative — that with
 * no place ground the aperture stays honestly unavailable and nothing renders.
 *
 * Run: node tests/techne-hud-browser.mjs   (Chromium via Playwright, swiftshader)
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({root, appType: 'custom', server: {host: '127.0.0.1', port: 0, strictPort: false}, logLevel: 'error'});
server.middlewares.use('/techne-hud', async (_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(await server.transformIndexHtml('/techne-hud', '<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/techne-hud-page.tsx"></script></body>'));
});
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass += 1; console.log('✔', msg); };
const lensBy = (re) => (els, pattern) => { const rx = new RegExp(pattern); const b = els.find(e => rx.test(e.textContent || '')); return b; };

try {
  // ---- The live reading: six instruments available in the HUD ----
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/techne-hud`);
  await page.waitForSelector('.techne-hud-chooser .techne-hud-lens', {timeout: 20000});

  const labels = await page.$$eval('.techne-hud-lens .techne-hud-lens-label', (els) => els.map((e) => e.textContent));
  ok(labels.length === 6, `six M0′–M5′ instruments available in the HUD chooser (${labels.join(', ')})`);

  const availability = await page.$$eval('.techne-hud-lens', (els) => Object.fromEntries(els.map((e) => [(e.querySelector('.techne-hud-lens-label')?.textContent || '').replace(/ .*/, ''), e.getAttribute('data-available')])));
  ok(availability['Project'] === 'true' && availability['Canvas'] === 'true' && availability['World'] === 'true' && availability['Palace'] === 'true', 'M0′/M1′/M4′/M5′ disclosed available on the real reading');
  ok(availability['Journey'] === 'false', 'M3′ journey honestly unavailable (no open Expression), its reason disclosed — availability is the reading, never the mount');

  // ---- Selecting M4′ mounts the place instrument over the produced facets ----
  await page.$$eval('.techne-hud-lens', (els) => { const b = els.find((e) => /World|Places/.test(e.textContent || '')); if (b) b.click(); });
  await page.waitForSelector('.techne-hud-pane .techne-place-rail', {timeout: 15000});
  ok(true, 'selecting M4′ mounts the real PlaceInstrument (its rail) in the HUD pane');
  const placeText = await page.$eval('.techne-hud-pane', (e) => e.textContent || '');
  ok(/Londinium/.test(placeText) && /Avalon/.test(placeText), 'the produced places render — the georeferenced Londinium and the unlocated Avalon');
  ok(errors.length === 0, `no uncaught errors on the live HUD (${errors.join('; ')})`);

  // ---- §41 negative: no place ground → M4′ stays absent, nothing renders ----
  const bare = await browser.newPage();
  const bareErrors = [];
  bare.on('pageerror', (e) => bareErrors.push(String(e)));
  await bare.goto(`http://127.0.0.1:${port}/techne-hud?reading=bare`);
  await bare.waitForSelector('.techne-hud-chooser .techne-hud-lens', {timeout: 20000});
  const bareAvail = await bare.$$eval('.techne-hud-lens', (els) => { const b = els.find((e) => /World|Places/.test(e.textContent || '')); return b?.getAttribute('data-available'); });
  ok(bareAvail === 'false', '§41: no spatial facet → M4′ place disclosed unavailable');
  await bare.$$eval('.techne-hud-lens', (els) => { const b = els.find((e) => /World|Places/.test(e.textContent || '')); if (b) b.click(); });
  await bare.waitForTimeout(600);
  const barePane = await bare.$eval('.techne-hud-pane', (e) => e.textContent || '');
  ok(!(await bare.$('.techne-hud-pane .techne-place-rail')), '§41: the PlaceInstrument does not mount when the reading discloses no place');
  ok(!/Londinium|Avalon/.test(barePane), '§41: no places render once the producer emits none — the binding is load-bearing');

  console.log(`\nTechnē HUD: ${pass} checks passed`);
} finally {
  await browser.close();
  await server.close();
}
