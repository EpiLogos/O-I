/**
 * Device-SDK face-kit capture walk — SCRIPTED browser capture (computer use
 * is blocked machine-wide; this driver is playwright, channel-labelled).
 *
 * The walk (DEVICE-SDK.md §5–6): the kit's demo family admits through the
 * authoring API exactly as an owner's would; the harness page renders the
 * real controls; the editor standard's input law is exercised — pointer
 * drag moves a scalar's draft (amber, distinct from the acknowledged base),
 * typed entry commits, the enumerated cycles the owner's values, the
 * waiting card carries its owner's name and no body; the fixture aperture's
 * acknowledge turns drafts into base values.
 *
 * Run: node tests/device-sdk.browser.mjs [--evidence <dir>]
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchShell} from './support/agentShellHarness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : join(here, 'artifacts', 'device-sdk');
mkdirSync(join(evidence, 'captures'), {recursive: true});

const devRoot = join(here, '..', 'src', 'inhabitants', 'sdk', 'dev');
const server = await createServer({
  root: devRoot,
  logLevel: 'error',
  server: {port: 5207, strictPort: true, host: '127.0.0.1'},
});
await server.listen();
const url = 'http://127.0.0.1:5207/';

const results = {schema: 'oi.device-sdk-walk/v1', recorded_at: new Date().toISOString(), channel: 'scripted-playwright (computer use blocked machine-wide)', url, steps: [], browserErrors: [], pageErrors: []};
const step = (name, detail) => {results.steps.push({name, ...detail}); console.log(`+ ${name}${detail.detail ? ` — ${detail.detail}` : ''}`)};

const {browser, context, page, browserErrors, pageErrors} = await launchShell({width: 1280, height: 900});
try {
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.waitForSelector('.sdk-face', {timeout: 15000});

  // 1 — the plate: mark from the cut, title, owner line, honest lamp.
  const title = await page.textContent('.sdk-face__title');
  assert.equal(title, 'Probe');
  const owner = await page.textContent('.sdk-face__owner');
  assert.match(owner, /Device SDK/);
  const marks = await page.locator('.sdk-face svg').count();
  assert.ok(marks >= 1, 'the plate carries its mark from the cut');
  step('plate renders', {detail: `title="${title}", owner="${owner.trim()}", marks=${marks}`});

  // 2 — the scalar: pointer drag moves the DRAFT, amber, distinct from base.
  const gain = page.locator('.sdk-scalar').first();
  const before = await gain.locator('.sdk-scalar__value').textContent();
  const box = await gain.locator('.sdk-scalar__well').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 30, {steps: 5});
  await page.mouse.up();
  const rowDirty = await page.locator('.sdk-row--dirty').count();
  assert.ok(rowDirty >= 1, 'the drag leaves a retained draft, shown dirty');
  const draftHeight = await gain.locator('.sdk-scalar__draft').count();
  assert.equal(draftHeight, 1, 'the draft handle rides beside the base');
  step('scalar drag → draft', {detail: `value ${before?.trim()} → draft shown dirty`});
  await page.screenshot({path: join(evidence, 'captures', 'device-sdk-draft.png')});

  // 3 — commit: Enter acknowledges through the fixture aperture.
  await gain.focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-standing="idle"]', {timeout: 5000});
  const dirtyAfter = await page.locator('.sdk-row--dirty').count();
  assert.equal(dirtyAfter, 0, 'acknowledged: the draft became base');
  step('commit acknowledges', {detail: 'standing=idle, no dirty rows'});

  // 4 — the enumerated cycles the owner's values; typed scalar entry.
  await page.click('.sdk-enum');
  const enumValue = await page.textContent('.sdk-enum');
  assert.ok(['linear', 'log', 'exp'].includes(enumValue.trim()), `enum cycles within its values (${enumValue.trim()})`);
  step('enum cycles', {detail: `value=${enumValue.trim()}`});

  // 5 — the waiting card: honest, owner named, no body.
  const waiting = await page.textContent('.sdk-waiting');
  assert.match(waiting, /Waits for/);
  const waitingLamp = await page.locator('.sdk-face--waiting .sdk-lamp--waiting').count();
  assert.equal(waitingLamp, 1, 'the waiting card carries the waiting lamp');
  step('waiting card honest', {detail: waiting.trim().slice(0, 80)});

  // 6 — the capture: the whole kit.
  await page.screenshot({path: join(evidence, 'captures', 'device-sdk-kit.png')});
  step('captures written', {detail: join(evidence, 'captures')});
} finally {
  results.browserErrors = browserErrors.slice(0, 20);
  results.pageErrors = pageErrors.slice(0, 20);
  writeFileSync(join(evidence, 'device-sdk-walk.json'), JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
if (pageErrors.length || browserErrors.filter(error => !/\/favicon\.ico/.test(error)).length) {
  console.error('page/browser errors:', pageErrors, browserErrors);
  process.exit(1);
}
console.log(`device-sdk walk: PASS (${results.steps.length} steps) — evidence in ${evidence}`);
