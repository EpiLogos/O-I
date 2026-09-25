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

  // This standalone CI probe has no native host. It must not fabricate a
  // source field; positive component/owner acceptance belongs to native tests.
  await active('project').click();
  const before = await state();
  const documentBefore = await page.evaluate(() => window.__FIELD_STUDIES__.getDocument());
  for (const id of LENSES) {
    await active(id).click();
    assert.equal(await active(id).getAttribute('aria-selected'), 'true');
    assert.equal((await state()).activeLens, id);
    if (['canvas', 'timeline', 'place'].includes(id)) {
      // The actual refusal text every m1/m2/m4 instrument gives without a
      // bound native Scene (researchInstruments.tsx `load`, the shared
      // `if(!view||!binding)` throw, and m1's own no-view branch — R6,
      // Wayfinder §21). "unavailable"/"not been announced" are kept for any
      // other honest-refusal wording a future instrument may use.
      await page.waitForFunction(() => /unavailable|not been announced|open a native scene/i.test(document.querySelector('.research-instrument-status')?.textContent ?? ''));
      assert.equal(await page.locator('#lens-studio:not([hidden])').count(), 0, 'research tools do not open a duplicate explanatory panel');
      assert.equal(await page.locator('.research-instrument-body .react-flow__node').count(), 0, 'missing owner never becomes demo graph data');
    } else {
      await page.waitForSelector('#lens-studio:not([hidden])');
      const action = id === 'project' ? 'native-library' : 'timeline';
      assert.equal(await page.locator(`#lens-studio [data-action="${action}"]`).count(), 1);
      if (id !== 'project') assert.equal(await page.locator('#lens-studio [data-op="commit"]').count(), 1);
    }
    assert.deepEqual(await page.evaluate(() => window.__FIELD_STUDIES__.getDocument()), documentBefore, 'lens selection retains the same actual Expression draft and Scenes');
    receipt.lenses.push(id);
  }

  // Field continuity (§28): moving through every instrument must not reset the
  // field — camera and selection stand. (This standalone walk has no host, so
  // no native construction is open; the subject-CARRYING continuity — a stale
  // selection/subject handoff surviving a lens change — is proven by the native
  // application walk where a real construction stands.)
  const after = await state();
  assert.deepEqual(after.camera, before.camera, 'switching instruments does not move the camera');
  assert.deepEqual(after.selected, before.selected, 'switching instruments does not change the selection');
  assert.equal(after.hostMode, 'techne', 'the workspace stays in the Technē cut across lens changes');

  // M5 operates the existing native composition controls in this engine.
  await active('palace').click();
  await page.locator('#lens-studio [data-action="native-work"]').click();
  await page.waitForSelector('#native-work:not([hidden])');
  await page.locator('#native-work [data-native="close"]').click();

  // Keyboard: the chooser is a tablist. Selecting keeps focus on the chosen tab
  // (the innerHTML-rebuild focus loss the review caught is fixed), and arrow
  // keys rove between instruments.
  await active('timeline').click();
  assert.ok(await page.evaluate(() => document.activeElement?.dataset?.lens === 'timeline'), 'selecting a lens keeps keyboard focus on its tab');
  await active('timeline').press('ArrowRight');
  assert.equal((await state()).activeLens, 'journey', 'ArrowRight roves to the next instrument');
  assert.ok(await page.evaluate(() => document.activeElement?.dataset?.lens === 'journey'), 'the roved instrument takes focus');

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
  console.log(`Technē Lens Studio: chooser + floating Studio in the current app, six instrument choices (${receipt.lenses.join(', ')}) with real engine controls and missing-owner refusal, lens continuity preserved, chooser absent in the lived cut.`);
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
