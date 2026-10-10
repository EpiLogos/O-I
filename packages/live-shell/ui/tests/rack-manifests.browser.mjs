/**
 * Inhabitant-rack capture walk — SCRIPTED browser capture (computer use is
 * blocked machine-wide; this driver is playwright, channel-labelled).
 *
 * The walk (WORLD-SHELL-DESIGN §5.5, §12, §16; ticket L2 acceptance): the
 * six world-shell families load through the generalised manifest schema and
 * the real InhabitantRack renders them; a document device (the 4+2 Day die,
 * the retained ql-daily-die.html over its own hosting path) docks in the
 * rack and its save router's named outcomes are driven and visible —
 * unchanged, saved, conflict, refused, and the stale standing (blocked on a
 * moved source); the Flow document device docks the same way; the
 * conversation face holds the honest absence and the fixture-bound standing
 * over oi.nara-dialogue-binding/v1.
 *
 * The document bodies are the retained forms' own bytes served by the
 * fixture kernel (the middleware in src/inhabitants/dev/vite.config.mjs);
 * the day/flow responses are the fixture's scripted owner semantics. This
 * capture proves the dock + the router grammar; it runs against no live
 * kernel and claims no native owner effect.
 *
 * Run: node tests/rack-manifests.browser.mjs --evidence <dir>
 */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchShell} from './support/agentShellHarness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const evidence = args.includes('--evidence') ? args[args.indexOf('--evidence') + 1] : join(here, 'artifacts', 'rack-manifests');
mkdirSync(evidence, {recursive: true});
const shots = join(evidence, 'captures');
mkdirSync(shots, {recursive: true});

const devRoot = join(here, '..', 'src', 'inhabitants', 'dev');
const server = await createServer({
  root: devRoot,
  logLevel: 'error',
  server: {port: 5203, strictPort: true, host: '127.0.0.1'},
});
await server.listen();
const url = 'http://127.0.0.1:5203/';

const results = {schema: 'oi.rack-manifests-walk/v1', recorded_at: new Date().toISOString(), channel: 'scripted-playwright (computer use blocked machine-wide)', url, steps: [], browserErrors: [], pageErrors: []};
const step = (name, detail) => {results.steps.push({name, ...detail}); console.log(`+ ${name}${detail.detail ? ` — ${detail.detail}` : ''}`)};

const {browser, context, page, browserErrors, pageErrors} = await launchShell({width: 1280, height: 900});
const scenario = async body => {
  const response = await fetch(new URL('/scenario', url), {method: 'POST', body: JSON.stringify(body)});
  return response.json();
};
const saveSlot = locator => locator.locator('.inhabitant-device-save').first();
const DEBUG_FLOW = process.env.DEBUG_FLOW === '1';

try {
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.waitForSelector('[data-inhabitant-rack]', {timeout: 20000});

  // ── step 1: the six families render from the composed manifests ──
  const families = page.locator('[data-family]');
  const familyIds = await families.evaluateAll(nodes => nodes.map(node => node.dataset.family));
  assert.deepEqual([...familyIds].sort(), ['actuation', 'ai-kit', 'central', 'quaternal-logic', 'software-factory', 'workcell']);
  step('six families render', {detail: familyIds.join(', '), familyIds});
  await page.screenshot({path: join(shots, '01-six-families.png'), fullPage: false});

  // ── step 2: waiting faces are honest — notes, no bodies, no light ──
  const waiting = page.locator('[data-admission="waiting"]');
  const waitingCount = await waiting.count();
  assert.ok(waitingCount >= 6, `quaternal-logic alone declares ${6} waiting faces`);
  const waitingBodies = await waiting.evaluateAll(nodes => nodes.filter(node => node.querySelector('iframe')).length);
  assert.equal(waitingBodies, 0, 'a waiting face never mounts a body');
  step('waiting faces: declared, named, bodyless', {detail: `${waitingCount} waiting cards, 0 bodies`, waitingCount});
  await page.locator('[data-family="quaternal-logic"]').scrollIntoViewIfNeeded();
  await page.screenshot({path: join(shots, '02-waiting-faces.png')});

  // ── step 3: the Day die docks and expands over the retained form ──
  const dieCard = page.locator('[data-face-id="day-die"]');
  await dieCard.scrollIntoViewIfNeeded();
  await dieCard.locator('[data-action="fold"]').first().click();
  const die = page.locator('[data-document-device="ql-daily-die"]');
  await die.waitFor({timeout: 20000});
  await page.waitForSelector('[data-document-device="ql-daily-die"] iframe', {timeout: 20000});
  const frame = page.frameLocator('[data-document-device="ql-daily-die"] iframe');
  await frame.locator('#stage, #cube, body').first().waitFor({timeout: 15000});
  step('day die docks and expands', {detail: 'the retained ql-daily-die.html body is mounted (sandboxed iframe)'});
  await die.screenshot({path: join(shots, '03-day-die-docked.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '03-day-die-docked.png')});
  });

  // ── step 4: save with no edits → unchanged ──
  await die.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-daily-die"]')?.getAttribute('data-save-outcome') === 'unchanged', undefined, {timeout: 15000});
  const unchangedLabel = (await saveSlot(die).textContent())?.trim();
  assert.match(unchangedLabel ?? '', /unchanged/);
  step('save-router: unchanged', {detail: unchangedLabel, outcome: 'unchanged'});
  await die.screenshot({path: join(shots, '04-unchanged.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '04-unchanged.png')});
  });

  // ── step 5: a real edit inside the form → save → saved ──
  const dieFrame = page.frames().find(candidate => candidate.parentFrame() !== null);
  assert.ok(dieFrame, 'the die frame is present');
  const edited = await dieFrame.evaluate(`(() => {
    const field = document.querySelector('[data-field="p0_quick_thoughts"]') || document.querySelector('[data-field]');
    if (!field) return {edited: false, reason: 'no data-field editor rendered'};
    field.focus();
    field.innerHTML = 'Rack capture: one mapped edit from the L2 lane.';
    field.dispatchEvent(new InputEvent('input', {bubbles: true}));
    return {edited: true, field: field.dataset.field};
  })()`);
  assert.ok(edited.edited, `the form edit landed: ${JSON.stringify(edited)}`);
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-daily-die"]')?.getAttribute('data-dirty') === 'true', undefined, {timeout: 15000});
  step('form edit landed through its own binding', {detail: `field ${edited.field}; the dirty light is a reading`});
  await scenario({mutate: 'ok', document: 'ok'});
  await die.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-daily-die"]')?.getAttribute('data-save-outcome') === 'saved', undefined, {timeout: 20000});
  const savedLabel = (await saveSlot(die).textContent())?.trim();
  step('save-router: saved', {detail: savedLabel, outcome: 'saved'});
  await die.screenshot({path: join(shots, '05-saved.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '05-saved.png')});
  });

  // ── step 6: a second edit, the owner's receipt contradicts → conflict ──
  await dieFrame.evaluate(`(() => {
    const field = document.querySelector('[data-field="p0_quick_thoughts"]') || document.querySelector('[data-field]');
    field.focus();
    field.innerHTML += ' / second pass.';
    field.dispatchEvent(new InputEvent('input', {bubbles: true}));
    return true;
  })()`);
  await scenario({mutate: 'conflict'});
  await die.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-daily-die"]')?.getAttribute('data-save-outcome') === 'conflict', undefined, {timeout: 20000});
  const conflictLabel = (await saveSlot(die).textContent())?.trim();
  assert.match(conflictLabel ?? '', /conflict/);
  const stillDirty = await die.getAttribute('data-dirty');
  assert.equal(stillDirty, 'true', 'a conflicted save keeps the draft');
  step('save-router: conflict', {detail: conflictLabel, outcome: 'conflict', draftRetained: true});
  await die.screenshot({path: join(shots, '06-conflict.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '06-conflict.png')});
  });

  // ── step 7: the reviewed-basis recovery, then the owner refuses → refused ──
  // A failed save leaves the session blocked (the owner's own law); Review
  // reads the current source and the draft re-stands on it (reviewOnto).
  await scenario({mutate: 'ok', document: 'ok'});
  await die.locator('[data-action="review"]').click();
  await page.waitForFunction(() => !!document.querySelector('[data-document-device="ql-daily-die"] [data-action="keep-draft"]'), undefined, {timeout: 20000});
  await die.locator('[data-action="keep-draft"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-document-device="ql-daily-die"] [data-action="save"]')?.disabled, undefined, {timeout: 20000});
  step('reviewed-basis recovery', {detail: 'the draft re-stands on the reviewed revision; Save is operable again'});
  await scenario({mutate: 'error'});
  await die.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-daily-die"]')?.getAttribute('data-save-outcome') === 'refused', undefined, {timeout: 20000});
  const refusedLabel = (await saveSlot(die).textContent())?.trim();
  assert.match(refusedLabel ?? '', /refused/);
  step('save-router: refused', {detail: refusedLabel, outcome: 'refused'});
  await die.screenshot({path: join(shots, '07-refused.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '07-refused.png')});
  });

  // ── step 8: the source moved under the draft → the stale standing ──
  await scenario({mutate: 'ok', document: 'moved'});
  await die.locator('[data-action="review"]').click();
  await page.waitForFunction(() => {
    const notice = document.querySelector('[data-document-device="ql-daily-die"] .inhabitant-device-notice');
    return notice?.textContent?.includes('Native source changed') || false;
  }, undefined, {timeout: 20000});
  const staleLabel = (await die.locator('.inhabitant-device-notice').textContent())?.trim();
  assert.match(staleLabel ?? '', /Native source changed/);
  const saveDisabled = await die.locator('[data-action="save"]').isDisabled();
  assert.equal(saveDisabled, true, 'a blocked (stale) device refuses Save until review');
  step('save-router: stale standing', {detail: staleLabel, outcome: 'stale (blocked on moved source; draft retained)'});
  await die.screenshot({path: join(shots, '08-stale.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '08-stale.png')});
  });

  // ── step 9: the Flow document device docks and saves by its own CAS write ──
  const flowCard = page.locator('[data-face-id="flow-document"]');
  await flowCard.scrollIntoViewIfNeeded();
  await flowCard.locator('[data-action="fold"]').first().click();
  const flow = page.locator('[data-document-device="ql-flow"]');
  await flow.waitFor({timeout: 20000});
  await page.waitForSelector('[data-document-device="ql-flow"] iframe', {timeout: 20000});
  step('flow document docks', {detail: 'the retained ql-flow.html served as the fixture instance (labelled)'});
  // Save with nothing staged: the router names it honestly.
  await scenario({flowWrite: 'written'});
  await flow.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-save-outcome') === 'unchanged', undefined, {timeout: 20000});
  step('flow save-router: unchanged', {detail: 'nothing staged — no write sent', outcome: 'unchanged'});
  // A host-side island change (the fixture act, disclosed here) makes the
  // bounded read return a changed document; the router then saves by the
  // document's own revision-checked CAS write.
  const flowFrame = page.frames().find(candidate => candidate.parentFrame() !== null && candidate !== dieFrame);
  assert.ok(flowFrame, 'the flow frame is present');
  const patched = await flowFrame.evaluate(`(() => {
    const island = document.getElementById('ql-doc');
    if (!island) return {patched: false, reason: 'no island'};
    const doc = JSON.parse(island.textContent);
    doc.meta = doc.meta || {};
    doc.meta.title = 'Capture plan (rack-capture edit)';
    island.textContent = JSON.stringify(doc);
    // The live-closure read seam is removed so the bounded bridge answers
    // from the patched island — the fixture's disclosed content change.
    delete window.__OI_DOCUMENT_PAYLOAD_READ__;
    return {patched: true};
  })()`);
  assert.ok(patched.patched, `island patched: ${JSON.stringify(patched)}`);
  await flow.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-save-outcome') === 'saved', undefined, {timeout: 20000});
  step('flow save-router: saved', {detail: 'revision-checked CAS write acknowledged', outcome: 'saved'});
  // The face re-read the owner after its save; wait for its fresh baseline
  // (the first bounded read of the reloaded body), then stage a second
  // change; a moved file under the face → the owner's conflict bytes, named.
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-baselined') !== 'true', undefined, {timeout: 20000});
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-baselined') === 'true', undefined, {timeout: 20000});
  const repatched = await flowFrame.evaluate(`(() => {
    const island = document.getElementById('ql-doc');
    if (!island) return {patched: false, reason: 'no island'};
    const doc = JSON.parse(island.textContent);
    doc.meta = doc.meta || {};
    doc.meta.title = 'Capture plan (second rack-capture edit)';
    island.textContent = JSON.stringify(doc);
    delete window.__OI_DOCUMENT_PAYLOAD_READ__;
    return {patched: true};
  })()`);
  assert.ok(repatched.patched, `island re-patched: ${JSON.stringify(repatched)}`);
  if (DEBUG_FLOW) {
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(2000);
      const s = await page.evaluate(() => ({
        dirty: document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-dirty'),
        baselined: document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-baselined'),
        outcome: document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-save-outcome'),
      }));
      console.log('DEBUG tick', i, JSON.stringify(s));
    }
  }
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-dirty') === 'true', undefined, {timeout: 20000});
  await scenario({flowWrite: 'conflict'});
  await flow.locator('[data-action="save"]').click();
  await page.waitForFunction(() => document.querySelector('[data-document-device="ql-flow"]')?.getAttribute('data-save-outcome') === 'conflict', undefined, {timeout: 20000});
  const flowConflict = (await flow.locator('.inhabitant-device-save').textContent())?.trim();
  step('flow save-router: conflict', {detail: flowConflict, outcome: 'conflict', ownerBytesDisclosed: true});
  await flow.screenshot({path: join(shots, '09-flow.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '09-flow.png')});
  });

  // ── step 10: the conversation face — honest absence, then the binding ──
  const conversationCard = page.locator('[data-face-id="nara-conversation"]');
  await conversationCard.scrollIntoViewIfNeeded();
  await conversationCard.locator('[data-action="fold"]').first().click();
  const conversation = page.locator('[data-conversation-device="nara"]');
  await conversation.waitFor({timeout: 20000});
  // The binding read is async: wait for the face to settle on a terminal
  // standing before naming it.
  await page.waitForFunction(() => {
    const standing = document.querySelector('[data-conversation-device="nara"]')?.getAttribute('data-standing');
    return standing === 'no-identity' || standing === 'unbound' || standing === 'bound' || standing === 'refused';
  }, undefined, {timeout: 20000});
  const absence = await conversation.getAttribute('data-standing');
  assert.equal(absence, 'no-identity', 'without an identity the face discloses absence');
  step('conversation: disclosed absence', {detail: 'no Nara identity is current — nothing fabricated'});
  await page.locator('#identity-btn').click();
  // The identity bump remounts the rack (fresh DOM), so the card folds back
  // to its strip: re-resolve the card, re-expand, then wait for the binding.
  await page.waitForFunction(() => !!document.querySelector('[data-face-id="nara-conversation"] [data-action="fold"]'), undefined, {timeout: 20000});
  await page.waitForTimeout(300);
  await page.locator('[data-face-id="nara-conversation"]').scrollIntoViewIfNeeded();
  await page.locator('[data-face-id="nara-conversation"] [data-action="fold"]').first().click();
  await page.waitForFunction(() => document.querySelector('[data-conversation-device="nara"]')?.getAttribute('data-standing') === 'bound', undefined, {timeout: 20000});
  const bindingFields = await conversation.locator('[data-binding-fields]').count();
  step('conversation: bound over oi.nara-dialogue-binding/v1', {detail: `${bindingFields} binding field groups disclosed (fixture echo)`});
  await conversation.screenshot({path: join(shots, '10-conversation.png')}).catch(async () => {
    await page.screenshot({path: join(shots, '10-conversation.png')});
  });

  // ── final: the whole rack, scrolled top ──
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path: join(shots, '11-rack-full.png'), fullPage: false});
  step('capture complete', {detail: `${results.steps.length} steps, captures in ${shots}`});
} catch (error) {
  results.fault = String(error);
  await page.screenshot({path: join(shots, 'fault.png')}).catch(() => {});
  console.error('FAULT:', error);
} finally {
  results.browserErrors = browserErrors.slice(0, 20);
  results.pageErrors = pageErrors.slice(0, 20);
  writeFileSync(join(evidence, 'rack-manifests-walk.json'), JSON.stringify(results, null, 2));
  await browser.close();
  await server.close();
}
if (results.fault || results.pageErrors.length) {
  console.error(JSON.stringify({fault: results.fault, pageErrors: results.pageErrors}, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ok: true, evidence, steps: results.steps.length, channel: results.channel}, null, 2));
