/**
 * The Technē walk sweep, in a real browser (2026-09-22): the §28 lens-
 * continuity walk over ONE rich reading through all six M0′–M5′ instruments —
 * C5 (each instrument renders its actual material, not a stat panel), C7
 * (genuine instrument acts), C12 (the working HUD), and §28 (one subject and
 * one DisclosureSession carried across every lens change, never a new session
 * per instrument). The whole-feature acceptance spine; the deeper C1–C4 / C9
 * construction/Return and C11 shared-world remain named in the ledger.
 *
 * Run: node tests/techne-walk-sweep-browser.mjs   (Chromium/swiftshader)
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({root, appType: 'custom', server: {host: '127.0.0.1', port: 0, strictPort: false}, logLevel: 'error'});
server.middlewares.use('/techne-walk', async (_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(await server.transformIndexHtml('/techne-walk', '<body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/techne-walk-sweep-page.tsx"></script></body>'));
});
await server.listen();
const port = server.httpServer.address().port;
const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});

let pass = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); pass += 1; console.log('✔', msg); };

const clickLens = (page, label) => page.$$eval('.techne-hud-lens', (els, l) => { const b = els.find((e) => (e.textContent || '').includes(l)); if (b) b.click(); return !!b; }, label);
const paneText = (page) => page.$eval('.techne-hud-pane', (e) => e.textContent || '');
const paneHas = (page, sel) => page.$(`.techne-hud-pane ${sel}`).then((h) => !!h);

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/techne-walk`);
  await page.waitForSelector('.techne-hud-chooser .techne-hud-lens', {timeout: 20000});
  ok((await page.$$('.techne-hud-lens')).length === 6, 'six instruments stand in the HUD over the rich reading');

  const session0 = await page.evaluate(() => window.sweepProbe.session());
  ok(session0 && session0.subject_ref === 'wiki:central', `one DisclosureSession opens on the subject (${session0 && session0.subject_ref})`);
  const readingRef0 = session0.reading_ref;

  // ---- M1′ Canvas: the constellation of members and typed relations ----
  await clickLens(page, 'Canvas');
  await page.waitForSelector('.techne-hud-pane .techne-canvas-toolbar', {timeout: 15000});
  ok(!(await paneHas(page, '.techne-canvas-absent')), 'M1′ Canvas renders the real constellation (not the absent state)');

  // ---- M2′ Relation/Timeline: the typed relations over time ----
  await clickLens(page, 'Relation');
  await page.waitForSelector('.techne-hud-pane .techne-timeline', {timeout: 15000});
  ok(!(await paneHas(page, '.techne-timeline .techne-absent')), 'M2′ Timeline renders the relation field (not the absent state)');

  // ---- M3′ Journey: the Expression scenes (the reading binds two) ----
  await clickLens(page, 'Journey');
  await page.waitForSelector('.techne-hud-pane .techne-journey', {timeout: 15000});
  await page.waitForFunction(() => /scene:overview/.test(document.querySelector('.techne-hud-pane')?.textContent || ''), {timeout: 10000});
  const journeyText = await paneText(page);
  ok(/scene:overview/.test(journeyText) && !/no Expression is bound|disclose no scene refs|waits on the source/.test(journeyText),
    'M3′ Journey renders the reading’s real Expression scenes (scene:overview), not the no-scenes state');

  // ---- M4′ World/Places: the produced places ----
  await clickLens(page, 'World');
  await page.waitForSelector('.techne-hud-pane .techne-place-rail', {timeout: 15000});
  ok(/Londinium/.test(await paneText(page)), 'M4′ World renders the produced places (Londinium)');

  // ---- M5′ Palace: the composition of real Expression refs ----
  await clickLens(page, 'Palace');
  await page.waitForSelector('.techne-hud-pane .oi-palace-overview, .techne-hud-pane .oi-palace-action', {timeout: 15000});
  ok(await paneHas(page, '.oi-palace-overview, .oi-palace-action'), 'M5′ Palace renders the composition over the reading’s real Expression refs');

  // ---- M0′ Project: back to the ground, one session preserved ----
  await clickLens(page, 'Project');
  await page.waitForTimeout(500);
  ok((await paneText(page)).length > 0, 'M0′ Project renders the ground on return');

  // ---- §28: one subject and one session carried across the whole walk ----
  const session1 = await page.evaluate(() => window.sweepProbe.session());
  ok(session1.subject_ref === 'wiki:central' && session1.reading_ref === readingRef0,
    'the same subject and DisclosureSession are carried across all six lenses — no new session per instrument (§28)');

  // ---- §4: an instrument's OWN cross-open drives the HUD through the session ----
  await clickLens(page, 'World');
  await page.waitForSelector('.techne-hud-pane .techne-place-rail', {timeout: 15000});
  const crossOpened = await page.$$eval('.techne-hud-pane button', (els) => { const b = els.find((e) => /Open in timeline/i.test(e.textContent || '')); if (b) { b.click(); return true; } return false; });
  ok(crossOpened, 'the M4′ Place instrument offers a cross-open into Timeline');
  await page.waitForSelector('.techne-hud-pane .techne-timeline', {timeout: 10000});
  const afterCross = await page.evaluate(() => window.sweepProbe.session());
  ok(afterCross.instrument === 'timeline' && afterCross.subject_ref === 'wiki:central' && afterCross.reading_ref === readingRef0,
    'an instrument’s cross-open switches the HUD to that instrument through the ONE session, subject and basis carried (§4)');
  ok((afterCross.navigation || []).some((hop) => hop.to_instrument === 'timeline'), 'the cross-open records a navigation hop — Epii reads the same session, not the HUD');

  // ---- C10: collapse to the field and back preserves the one session ----
  await page.$eval('.techne-hud-collapse', (b) => b.click());
  await page.waitForSelector('.techne-hud--collapsed .techne-hud-rail-lens', {timeout: 5000});
  // Re-open onto the same instrument from the collapsed rail (Timeline).
  await page.$$eval('.techne-hud--collapsed .techne-hud-rail-lens', (els) => { const b = els.find((e) => /Timeline/.test(e.getAttribute('title') || '')); (b || els[0]).click(); });
  await page.waitForSelector('.techne-hud-chooser .techne-hud-lens', {timeout: 5000});
  const afterToggle = await page.evaluate(() => window.sweepProbe.session());
  ok(afterToggle.instrument === 'timeline' && afterToggle.subject_ref === 'wiki:central' && afterToggle.reading_ref === readingRef0,
    'C10: collapsing to the field and re-opening the HUD preserves the session — instrument, subject and basis unchanged, no reset or remint');
  await page.waitForSelector('.techne-hud-pane .techne-timeline', {timeout: 10000});
  ok(true, 'C10: the active instrument re-mounts on the same basis after the collapse cycle');

  ok(errors.length === 0, `no uncaught errors across the whole walk, cross-open and collapse cycle (${errors.join('; ')})`);

  console.log(`\nTechnē walk sweep: ${pass} checks passed`);
} finally {
  await browser.close();
  await server.close();
}
