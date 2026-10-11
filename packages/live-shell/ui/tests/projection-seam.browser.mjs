/**
 * Projection-seam acceptance walk — SCRIPTED browser capture (computer use
 * is blocked machine-wide; this driver is playwright, channel-labelled).
 *
 * The walk (WORLD-SHELL-DESIGN §10 seams 1–3, L1 ticket acceptance): a real
 * pane tree from the surface engine holds TWO projections of ONE subject;
 * an encounter transition moves the subject and BOTH panes follow (one
 * spine, no second store); a concealed pane keeps its module state and
 * returns with it (hidden-inhabitant retention); a kernel-epoch bump
 * retires stale bridge registrations and the spine keeps flowing.
 *
 * The pane bodies are the reference module — PLACEHOLDER bodies, honestly
 * labelled on their faces; this capture seam-proofs the contract, it does
 * not claim any projection engine (atlas port's globe, timeline content…).
 *
 * Run: node tests/projection-seam.browser.mjs --evidence <dir>
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchShell} from './support/agentShellHarness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : join(here, 'artifacts', 'projection-seam');
mkdirSync(evidence, {recursive: true});
const shots = join(evidence, 'captures');
mkdirSync(shots, {recursive: true});

const devRoot = join(here, '..', 'src', 'projections', 'dev');
const server = await createServer({
  root: devRoot,
  logLevel: 'error',
  server: {port: 5201, strictPort: true, host: '127.0.0.1'},
});
await server.listen();
const url = 'http://127.0.0.1:5201/';

const results = {schema: 'oi.projection-seam-walk/v1', recorded_at: new Date().toISOString(), channel: 'scripted-playwright (computer use blocked machine-wide)', url, steps: [], browserErrors: [], pageErrors: []};
const step = (name, detail) => {results.steps.push({name, ...detail}); console.log(`✔ ${name}${detail.detail ? ` — ${detail.detail}` : ''}`)};

const {browser, context, page, browserErrors, pageErrors} = await launchShell({width: 1280, height: 800});
try {
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.waitForSelector('[data-projection-reference]', {timeout: 15000});

  // ── step 1: two panes, two projections, one subject ──
  const bodies = page.locator('[data-projection-reference]');
  assert.equal(await bodies.count(), 2, 'two projection panes are mounted');
  const kinds = await page.locator('[data-projection-pane-kind], [data-projection-kind]').evaluateAll(els => els.map(el => el.getAttribute('data-projection-kind')));
  const paneKinds = [...new Set(kinds)].sort();
  assert.deepEqual(paneKinds, ['projection.constellation', 'projection.timeline'], 'the two projections are two different pane kinds');
  for (let i = 0; i < 2; i++) {
    const text = await bodies.nth(i).innerText();
    assert.ok(text.includes('REFERENCE PROJECTION'), 'placeholder bodies are labelled, never passed off as engines');
    assert.ok(text.includes('Stone 1950'), `pane ${i} follows the encounter's subject`);
    assert.ok(text.includes('epoch 3'), `pane ${i} reads the kernel epoch`);
    assert.ok(text.includes('concealed' ) === false || text.includes('presented'), 'pane states its presented cut');
  }
  await page.screenshot({path: join(shots, '01-two-panes-one-subject.png')});
  step('two panes hold two projections of one subject', {detail: paneKinds.join(' + '), capture: '01-two-panes-one-subject.png'});

  // ── step 2: an encounter transition moves the subject; both panes follow ──
  const transitionsBefore = await bodies.evaluateAll(els => els.map(el => Number(el.textContent.match(/encounter transitions received: (\d+)/)[1])));
  await page.getByRole('button', {name: "subject: Ariadne's Loom"}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-projection-reference]')].every(el => el.textContent.includes("Ariadne's Loom")));
  const transitionsAfter = await bodies.evaluateAll(els => els.map(el => Number(el.textContent.match(/encounter transitions received: (\d+)/)[1])));
  assert.ok(transitionsAfter.every((n, i) => n > transitionsBefore[i]), 'both projections received the encounter transition');
  await page.screenshot({path: join(shots, '02-encounter-transition.png')});
  step('selection propagated as an encounter transition; both panes follow', {detail: `transitions ${transitionsBefore} → ${transitionsAfter}`, capture: '02-encounter-transition.png'});

  // ── step 3: local state, then concealment (hidden-inhabitant retention) ──
  const timelinePane = page.locator('[data-projection-reference][data-projection-kind="projection.timeline"]');
  const gestureButton = timelinePane.getByRole('button', {name: '+1 local gesture'});
  await gestureButton.click();
  await gestureButton.click();
  assert.ok((await timelinePane.innerText()).includes('2 — kept through every concealment'), 'local gestures recorded');
  await timelinePane.locator('xpath=ancestor::div[@data-group-id]').locator('.pane-conceal').click();
  await page.waitForFunction(() => document.querySelector('[data-projection-reference][data-projection-kind="projection.timeline"]').dataset.concealed === 'true');
  const concealedText = await timelinePane.innerText();
  assert.ok(concealedText.includes('Concealed-retained: still mounted'), 'the module was told it is concealed, not unmounted');
  assert.ok(await timelinePane.isVisible() === false, 'the concealed pane is display:none');
  await page.screenshot({path: join(shots, '03-concealed-retained.png')});
  step('pane concealed — module still mounted, told setVisible(false)', {capture: '03-concealed-retained.png'});

  // ── step 4: reveal — the exact state returns ──
  await timelinePane.locator('xpath=ancestor::div[@data-group-id]').locator('.pane-conceal').click();
  await page.waitForFunction(() => document.querySelector('[data-projection-reference][data-projection-kind="projection.timeline"]').dataset.concealed === 'false');
  assert.ok((await timelinePane.innerText()).includes('2 — kept through every concealment'), 'the gesture count survived concealment');
  await page.screenshot({path: join(shots, '04-retention-on-reveal.png')});
  step('reveal restores the exact retained state', {capture: '04-retention-on-reveal.png'});

  // ── step 5: the epoch guard retires stale registrations; the spine flows ──
  // A new connection generation retires epoch-3 registrations; the host
  // remounts each pane's module, which re-subscribes on the current epoch.
  await page.getByRole('button', {name: 'bump kernel epoch'}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-projection-reference]')].every(el => el.textContent.includes('epoch 4')));
  const monitors = await page.locator('.monitors').innerText();
  assert.ok(monitors.includes('listener@e3'), 'the epoch-3 registration stands in the record');
  assert.ok(monitors.includes('retired — epoch guard'), 'the stale registration is marked retired');
  assert.ok(monitors.includes('listener@e4'), 'the current registration continues');
  const freshCounts = await bodies.evaluateAll(els => els.map(el => Number(el.textContent.match(/encounter transitions received: (\d+)/)[1])));
  assert.ok(freshCounts.every(n => n >= 1), 'each remounted module received the current spine on subscribe');
  await page.getByRole('button', {name: 'subject: Stone 1950'}).click();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-projection-reference]')].every(el => el.textContent.includes('Stone 1950')));
  const flowed = await bodies.evaluateAll(els => els.map(el => Number(el.textContent.match(/encounter transitions received: (\d+)/)[1])));
  assert.ok(flowed.every((n, i) => n > freshCounts[i]), 'current-epoch registrations keep receiving after the bump');
  // The epoch bump is a new CONNECTION generation: the pane binding stands,
  // the module remounts on the new epoch, and a fresh module instance starts
  // at zero. Retention (steps 3–4) is the law for concealment and mode
  // switches; a reconnect re-derives, exactly like the shell's own views.
  const gesturesAfter = await timelinePane.innerText().then(text => Number(text.match(/(\d+) — kept/)[1]));
  assert.equal(gesturesAfter, 0, 'a remount is a fresh module instance on a new connection');
  await page.screenshot({path: join(shots, '05-epoch-guard.png')});
  step('kernel epoch bump retires stale callbacks; the spine keeps flowing', {detail: monitors.replace(/\n/g, ' · '), capture: '05-epoch-guard.png'});

  results.ok = true;
} catch (error) {
  results.ok = false;
  results.error = String(error && error.stack || error);
  console.error(results.error);
  try {await page.screenshot({path: join(shots, 'failure.png')});} catch { /* the page may be gone */ }
} finally {
  results.browserErrors = browserErrors.slice(0, 20);
  results.pageErrors = pageErrors.slice(0, 20);
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
writeFileSync(join(evidence, 'projection-seam-walk.json'), JSON.stringify(results, null, 2) + '\n');
if (!results.ok) process.exit(1);
console.log(`\nevidence: ${evidence}`);
