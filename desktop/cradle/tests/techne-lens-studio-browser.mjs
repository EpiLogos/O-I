/** The M0′–M5′ Lens Studio in the ACTUAL imported application (owner
 * wayfinder §§2, 13–19, 28): the compact instrument chooser and the floating
 * Studio stand in the current mount's Technē cut, each lens presents its real
 * operating controls or an honest facet state, and switching lenses never
 * resets the field. The built standalone application is served whole (its own
 * IIFE bundle, no host, no native binaries) — the chooser, the Studio content
 * and lens continuity are the current-app UI, proven in a real browser.
 *
 * The native operations behind the routed controls are honestly unavailable
 * without the desktop host channel; that is a separate proof (the native
 * composition/application receipts). This walk proves the instrument surface
 * itself: it works, it is not a metadata-only panel, and it does not reset
 * the field.
 */
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const html = readFileSync(fileURLToPath(new URL('../expressions-app/field-studies-journeys/field-studies.html', import.meta.url)), 'utf8');
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end(html); });
await new Promise(done => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});
const page = await browser.newPage({viewport: {width: 1200, height: 820}});
const errors = [];
page.on('pageerror', error => errors.push(String(error)));

const LENSES = ['project', 'canvas', 'timeline', 'journey', 'place', 'palace'];
const OFFICE = {project: 'M0′', canvas: 'M1′', timeline: 'M2′', journey: 'M3′', place: 'M4′', palace: 'M5′'};
const ROUTED = {project: 'native-library', canvas: 'native-work', timeline: 'open-timeline', journey: 'sequence-panel'};
const FACET = {place: 'place', palace: 'palace'};
const receipt = {schema: 'oi.techne-lens-studio/v1', standing: 'current-app instrument surface in a real browser; native operations are a separate host-channel proof', passed: false, lenses: []};

const state = () => page.evaluate(() => window.__FIELD_STUDIES__.getState());
const active = id => page.locator(`#lens-chooser .lens-choice[data-lens="${id}"]`);

try {
  await page.goto(`${origin}/?mode=techne`);
  await page.waitForFunction(() => window.__FIELD_STUDIES__ && window.__FIELD_STUDIES__.getState);
  assert.equal((await state()).hostMode, 'techne', 'the application boots in the Technē cut');

  // The chooser stands in Technē mode with all six instruments in M′ order.
  await page.waitForSelector('#lens-chooser:not([hidden])');
  const choices = await page.locator('#lens-chooser .lens-choice').evaluateAll(nodes => nodes.map(n => n.dataset.lens));
  assert.deepEqual(choices, LENSES, 'the chooser carries M0′–M5′ in order');

  // A construction basis is honest before any native work is open.
  await active('project').click();
  await page.waitForSelector('#lens-studio:not([hidden])');
  assert.ok(await page.locator('#lens-studio .lens-basis[data-empty="true"]').count(), 'the empty construction is an honest state, not an invented subject');

  // Field basis for the continuity check — captured before touching lenses.
  const before = await state();

  for (const id of LENSES) {
    await active(id).click();
    assert.equal(await active(id).getAttribute('aria-selected'), 'true', `${id} is the selected instrument`);
    assert.equal((await state()).activeLens, id, `getState reports ${id} active`);
    const studio = page.locator('#lens-studio');
    assert.equal(await studio.getAttribute('data-lens'), id, `the Studio presents the ${id} lens`);
    assert.ok((await studio.locator('.panel-kicker').innerText()).includes(OFFICE[id]), `the Studio names office ${OFFICE[id]}`);
    if (ROUTED[id]) {
      // M0′–M3′: the Studio CONTAINS operative controls carrying the app's own
      // actions — not reading statistics.
      assert.ok(await studio.locator(`.lens-control[data-action="${ROUTED[id]}"]`).count(), `${id} presents its real operating control (${ROUTED[id]})`);
      assert.equal(await studio.locator('.lens-facet').count(), 0, `${id} is not an honest-facet placeholder`);
    } else {
      // M4′/M5′: an honest facet state, its purpose and eligible material — no
      // fabricated control, no invented coordinate.
      assert.ok(await studio.locator(`.lens-facet[data-lens-facet="${FACET[id]}"]`).count(), `${id} names its honest facet state`);
      assert.equal(await studio.locator('.lens-control').count(), 0, `${id} invents no control it cannot honour`);
    }
    receipt.lenses.push(id);
  }

  // Lens continuity (§28): moving through every instrument must not reset the
  // field — the camera and selection stand.
  const after = await state();
  assert.deepEqual(after.camera, before.camera, 'switching instruments does not move the camera');
  assert.deepEqual(after.selected, before.selected, 'switching instruments does not change the selection');
  assert.equal(after.hostMode, 'techne', 'the workspace stays in the Technē cut across lens changes');

  // The active lens's control is operative: routing M1′ opens the real native
  // composition surface (its native operations are the separate host proof).
  await active('canvas').click();
  await page.locator('#lens-studio .lens-control[data-action="native-work"]').click();
  await page.waitForSelector('#native-work:not([hidden])');
  assert.ok(await page.locator('#native-work:not([hidden])').count(), 'the M1′ control opens the real native composition surface');

  // The Studio closes without disturbing the chooser or the field.
  await page.locator('#lens-studio .lens-studio-close').click();
  await page.waitForSelector('#lens-studio', {state: 'hidden'});
  assert.ok(await page.locator('#lens-chooser:not([hidden])').count(), 'closing the Studio leaves the chooser standing');
  assert.deepEqual((await state()).camera, before.camera, 'closing the Studio does not move the field');

  // Negative control: the Expressions cut carries no instrument chooser.
  const lived = await browser.newPage({viewport: {width: 1200, height: 820}});
  lived.on('pageerror', error => errors.push(String(error)));
  await lived.goto(`${origin}/?mode=expressions`);
  await lived.waitForFunction(() => window.__FIELD_STUDIES__ && window.__FIELD_STUDIES__.getState);
  assert.equal((await lived.evaluate(() => window.__FIELD_STUDIES__.getState())).hostMode, 'expressions', 'the lived cut is not Technē');
  assert.ok(await lived.locator('#lens-chooser[hidden]').count(), 'the Expressions cut hides the instrument chooser');
  await lived.close();

  assert.deepEqual(errors, [], 'no uncaught application errors');
  receipt.passed = true;
  if (process.env.TECHNE_EVIDENCE_DIR) {
    const dir = process.env.TECHNE_EVIDENCE_DIR;
    mkdirSync(dir, {recursive: true});
    await page.screenshot({path: resolve(dir, 'lens-studio.png')});
    writeFileSync(resolve(dir, 'lens-studio-receipt.json'), JSON.stringify(receipt, null, 2));
  }
  console.log(`Technē Lens Studio: chooser + floating Studio in the current app, six instruments (${receipt.lenses.join(', ')}) with real controls or honest facet states, lens continuity preserved, chooser absent in the lived cut.`);
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
