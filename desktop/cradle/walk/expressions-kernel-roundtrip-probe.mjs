// expressions-kernel-roundtrip-probe — the kernel bridge integration proof
// (Lane M, expressions-kernel-bridge 2026-09-19).
//
// The vendored Expressions application reaches the kernel's expression ops
// through the cradle's host channel (hostedApp.relayKernelChannel, carried
// by PointCloudHost): the kernel document IS the store — no second copy.
// This probe drives the REAL app frame in the standing dev shell against a
// REAL kernel (the dev-only walk bridge, the same typed seam the Tauri host
// fronts) and proves, through the app's pinned kernelExpressions API:
//   (1) the channel is feature-detected and the listing comes from the real
//       kernel (cross-checked against the bridge's own op log);
//   (2) a fresh expression is created through the channel and read back as
//       an oi.expression/v1 document;
//   (3) a save round-trips through the kernel's edit op (new entity +
//       parameters) and a fresh list/inspect holds the change;
//   (4) a stale save honestly returns {ok:false} on revision conflict and
//       is never force-written;
//   (5) the central-read channel reads a real Central file, and unknown
//       kinds are refused by name;
//   (6) the kernel document opens into the app's engine path
//       (kernelDocumentBridge) with honest conversion notes;
//   (7) NO second store: the app's browser storage (localStorage and the
//       IndexedDB recovery drafts) holds no copy of the kernel document.
//
// Usage: node walk/expressions-kernel-roundtrip-probe.mjs
//   DESK_URL (default http://localhost:1421/) — the standing dev shell.
//   The walk bridge is booted and torn down by this probe.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..');
const url = process.env.DESK_URL ?? 'http://localhost:1421/';
const bridgePort = process.env.LANE_M_BRIDGE_PORT ?? '4217';
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const artifacts = join(cradleRoot, 'walk', 'artifacts');
mkdirSync(artifacts, {recursive: true});

const DIST_ENTRY = 'Work/O-I/desktop/cradle/expressions-app/dist/index.html';
const EXPRESSION_REF = 'expression:kernel-bridge-roundtrip';
const ENTITY_REF = `${EXPRESSION_REF}:entity:probe-mark`;

const fails = [];
const fail = (step, detail) => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);
const receipts = [];

// ---- boot the walk bridge (fresh kernel over the real ground) -----------
const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', join(cradleRoot, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {stdio: ['ignore', 'pipe', 'pipe']});
bridge.stderr.on('data', chunk => process.stderr.write(chunk));
const started = Date.now();
while (Date.now() - started < 240_000) {
  try { if ((await fetch(`${bridgeUrl}/state`)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}
try { if (!(await fetch(`${bridgeUrl}/state`).catch(() => null))?.ok) throw new Error('bridge did not come up'); }
catch (cause) { console.log(`FAIL bridge: ${cause}`); bridge.kill(); process.exit(1); }
ok('walk bridge up', `${bridgeUrl} (${Math.round((Date.now() - started) / 1000)}s)`);
const bridgeOp = async op => (await (await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(op)})).json());

const browser = await chromium.launch({headless: true});
const host = await browser.newPage({viewport: {width: 1440, height: 900}});
const errors = [];
host.on('pageerror', e => errors.push('pageerror: ' + e.message));
host.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await host.addInitScript(bridge => { try {
  window.__OI_KERNEL_BRIDGE__ = bridge;
  sessionStorage.setItem('oi-cradle.welcome.v1', 'probe');
  localStorage.setItem('oi-cradle.welcome.v1', 'probe');
} catch {} }, bridgeUrl);

// In-frame helper: speak the raw channel envelope to the cradle host. It is
// installed INTO the frame once and reused by every raw-envelope step.
const installChannelCall = frame => frame.evaluate(() => {
  window.__probeChannelCall = payload => new Promise((resolve, reject) => {
    const req = Math.floor(Math.random() * 1e9);
    const onMessage = ev => {
      const d = ev.data;
      if (!d || typeof d !== 'object' || d.v !== 1 || d.req !== req || typeof d.kind !== 'string' || !d.kind.endsWith('-result')) return;
      window.removeEventListener('message', onMessage);
      if (d.ok) resolve(d.data); else reject(new Error(d.error));
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({v: 1, req, ...payload}, '*');
    setTimeout(() => { window.removeEventListener('message', onMessage); reject(new Error('the host channel did not answer in time')); }, 15000);
  });
  return true;
});

try {
  await host.goto(url);
  await host.waitForSelector('.desktop-shell', {timeout: 20000});
  await host.waitForTimeout(1200);
  await host.locator('.world-mode-strip [data-mode="expressions"]').click();
  await host.waitForSelector('.pcd-host[data-state="ready"]', {timeout: 30000});
  const appFrame = host.frames().find(f => f !== host.mainFrame());
  if (!appFrame) throw new Error('no hosted application frame stood up');
  await appFrame.waitForFunction(() => !!window.__FIELD_STUDIES__, {timeout: 20000});
  await appFrame.waitForFunction(() => !!(window.__OI_KERNEL_EXPRESSIONS__ && window.__OI_KERNEL_EXPRESSIONS__.kernelExpressionsAvailable()), {timeout: 20000});
  ok('the hosted application feature-detects the kernel host channel', 'window.__OI_KERNEL_EXPRESSIONS__.kernelExpressionsAvailable()');

  // ---- (1) the listing comes from the real kernel ------------------------
  const kernelListBefore = (await bridgeOp({op: 'expression', request: {operation: 'list'}}))?.outcome?.data?.expressions ?? [];
  const listedBefore = await appFrame.evaluate(() => window.__OI_KERNEL_EXPRESSIONS__.listKernelExpressions());
  if (listedBefore.length !== kernelListBefore.length) fail('listing truth', `app saw ${listedBefore.length}, kernel holds ${kernelListBefore.length}`);
  else ok('the listing is the real kernel\'s (fresh kernel, empty)', `${listedBefore.length} expressions, cross-checked against the kernel's own list op`);

  // ---- (2) create a fresh expression THROUGH the channel -----------------
  if (!await installChannelCall(appFrame)) throw new Error('the in-frame channel helper did not install');
  const created = await appFrame.evaluate(ref => window.__probeChannelCall({kind: 'kernel-expression', request: {operation: 'create', expression_ref: ref, title: 'Kernel bridge round-trip', actor: 'expressions-app-probe'}}), EXPRESSION_REF).catch(cause => ({error: String(cause)}));
  if (created?.state !== 'ready' || created?.document?.schema !== 'oi.expression/v1') fail('create through the channel', JSON.stringify(created).slice(0, 160));
  else ok('a fresh expression was created through the channel', `${EXPRESSION_REF} @ revision ${created.document.revision}`);

  const listed = await appFrame.evaluate(ref => window.__OI_KERNEL_EXPRESSIONS__.listKernelExpressions().then(entries => entries.find(e => e.expression_ref === ref)), EXPRESSION_REF);
  if (!listed) fail('pinned list', `the created expression is absent from the pinned listing`);
  else if (listed.revision !== 1 || listed.title !== 'Kernel bridge round-trip' || !(listed.last_touched_unix > 0)) fail('pinned list entry', JSON.stringify(listed));
  else ok('the pinned listKernelExpressions carries the kernel entry', `revision ${listed.revision} · "${listed.title}" · last_touched_unix ${listed.last_touched_unix}${listed.dirty === undefined ? '' : ' · dirty ' + listed.dirty}`);

  // ---- (2b) read one document --------------------------------------------
  const doc = await appFrame.evaluate(ref => window.__OI_KERNEL_EXPRESSIONS__.readKernelExpression(ref), EXPRESSION_REF);
  if (doc?.schema !== 'oi.expression/v1' || doc?.expression_ref !== EXPRESSION_REF || doc?.revision !== 1) fail('readKernelExpression', JSON.stringify(doc).slice(0, 140));
  else ok('readKernelExpression returns the oi.expression/v1 document', `revision ${doc.revision}, ${doc.scenes.length} scene(s)`);

  // ---- (3) round-trip save: a new entity through the kernel's edit op ----
  const edited = structuredClone(doc);
  edited.entities[ENTITY_REF] = {entity_ref: ENTITY_REF, revision: 1, title: 'Probe mark', subject: null, parameters: {
    glyph: {value: 'M', automation: null}, x: {value: 160, automation: null}, y: {value: -80, automation: null}, scale: {value: 1.5, automation: null},
  }};
  edited.scenes[0].entity_refs.push(ENTITY_REF);
  const saveOutcome = await appFrame.evaluate(edited => window.__OI_KERNEL_EXPRESSIONS__.saveKernelExpression(edited), edited);
  if (!saveOutcome || saveOutcome.ok !== true || saveOutcome.revision !== 2) fail('save round-trip', JSON.stringify(saveOutcome));
  else ok('saveKernelExpression round-trips through the kernel edit op', `{ok:true, revision:${saveOutcome.revision}}`);

  // Fresh list + inspect hold the change — the kernel is the store.
  const freshList = await appFrame.evaluate(ref => window.__OI_KERNEL_EXPRESSIONS__.listKernelExpressions().then(entries => entries.find(e => e.expression_ref === ref)), EXPRESSION_REF);
  if (freshList?.revision !== 2) fail('fresh list after save', JSON.stringify(freshList));
  else ok('a fresh list holds the change', `revision ${freshList.revision}, dirty ${freshList.dirty}`);
  const freshDoc = await appFrame.evaluate(ref => window.__OI_KERNEL_EXPRESSIONS__.readKernelExpression(ref), EXPRESSION_REF);
  const freshEntity = freshDoc?.entities?.[ENTITY_REF];
  if (freshDoc?.revision !== 2 || !freshDoc.scenes[0].entity_refs.includes(ENTITY_REF)) fail('fresh inspect after save', JSON.stringify(freshDoc).slice(0, 160));
  else if (freshEntity?.parameters?.glyph?.value !== 'M' || freshEntity?.parameters?.x?.value !== 160 || freshEntity?.parameters?.y?.value !== -80 || freshEntity?.parameters?.scale?.value !== 1.5) fail('fresh inspect entity', JSON.stringify(freshEntity));
  else ok('a fresh inspect holds the edited document', `entity ${ENTITY_REF.split(':').pop()} · glyph M · x 160 · y -80 · scale 1.5 @ revision ${freshDoc.revision}`);

  // ---- (4) revision conflict: honest {ok:false}, never force-written -----
  const stale = structuredClone(edited);
  stale.revision = 1; // the pre-save revision — one behind the kernel
  stale.entities[ENTITY_REF].parameters.x.value = 999;
  const conflict = await appFrame.evaluate(stale => window.__OI_KERNEL_EXPRESSIONS__.saveKernelExpression(stale), stale);
  if (!conflict || conflict.ok !== false || !/revision conflict/.test(String(conflict.error))) fail('revision conflict', JSON.stringify(conflict));
  else ok('a stale save returns {ok:false} honestly', String(conflict.error));
  const afterConflict = await appFrame.evaluate(ref => window.__OI_KERNEL_EXPRESSIONS__.readKernelExpression(ref), EXPRESSION_REF);
  if (afterConflict?.revision !== 2 || afterConflict?.entities?.[ENTITY_REF]?.parameters?.x?.value !== 160) fail('conflict not force-written', `revision ${afterConflict?.revision}, x ${afterConflict?.entities?.[ENTITY_REF]?.parameters?.x?.value}`);
  else ok('the conflicting edit was never force-written', 'the kernel still holds revision 2 with x 160');

  // ---- (5) central-read + named refusals ---------------------------------
  const readBack = await appFrame.evaluate(path => window.__probeChannelCall({kind: 'central-read', path}), DIST_ENTRY).catch(cause => ({error: String(cause)}));
  if (typeof readBack?.content !== 'string' || !readBack.content.includes('<title>O:I — Expressions</title>')) fail('central-read', `content head: ${String(readBack?.content ?? readBack?.error).slice(0, 80)}`);
  else ok('central-read reads a real Central file through the files seam', `${readBack.path} · ${readBack.byte_len} bytes @ ${String(readBack.revision).slice(0, 10)}…`);
  const bogus = await appFrame.evaluate(() => window.__probeChannelCall({kind: 'oi-no-such-kind'}).then(() => null, e => e.message)).catch(cause => String(cause));
  if (!/unknown host-channel kind/.test(String(bogus))) fail('unknown kind refused by name', String(bogus));
  else ok('an unknown kind is refused by name, never with silence', String(bogus));
  const unsupported = await appFrame.evaluate(() => window.__probeChannelCall({kind: 'kernel-expression', request: {operation: 'fork', expression_ref: 'expression:x', expected_revision: 1, new_expression_ref: 'expression:y', actor: 'probe'}}).then(() => null, e => e.message)).catch(cause => String(cause));
  if (!/unsupported kernel-expression operation/.test(String(unsupported))) fail('unsupported op refused by name', String(unsupported));
  else ok('an op outside the relay\'s grammar is refused by name', String(unsupported));

  // ---- (6) the kernel document opens into the app's own engine path ------
  const nodeBridge = await import(join(cradleRoot, 'expressions-app/field-studies-journeys/build/kernelDocumentBridge.js'));
  const conversion = nodeBridge.kernelDocumentToJourney(freshDoc);
  const view = conversion.journey;
  if (view.schema !== 'oi.journey' || view.version !== 1 || view.id !== EXPRESSION_REF || view.name !== 'Kernel bridge round-trip') fail('engine-path conversion', JSON.stringify({id: view.id, name: view.name, schema: view.schema}));
  else if (view.scenes.length !== 1 || view.scenes[0].entities.length !== 1 || view.scenes[0].entities[0].text !== 'M' || view.scenes[0].entities[0].position.x !== 0.4 || view.scenes[0].entities[0].scale !== 1.5) fail('engine-path conversion detail', JSON.stringify(view.scenes[0].entities));
  else ok('the kernel document opens into the app\'s engine path', `oi.journey "${view.name}" · 1 scene · entity M at stage x ${view.scenes[0].entities[0].position.x} (world 160 over WORLD_SCALE)`);
  const disclosive = nodeBridge.kernelDocumentToJourney({
    schema: 'oi.expression/v1', expression_ref: EXPRESSION_REF, revision: 3, title: 'Disclosure probe',
    scenes: [{scene_ref: `${EXPRESSION_REF}:scene:main`, title: 'Main', entity_refs: [`${EXPRESSION_REF}:entity:a`], body: {carrier: 'knowledge_whole'}, triggers: [{trigger_ref: 't1'}]}],
    entities: {[`${EXPRESSION_REF}:entity:a`]: {entity_ref: `${EXPRESSION_REF}:entity:a`, title: 'A', subject: {subject_ref: 'central:source:ground', native_owner: 'central'}, parameters: {glyph: {value: 'Ω'}, x: {value: 0, automation: {min: -10, max: 10, rate_hz: 1, waveform: 'sine'}}, tone: {value: 7}}}},
    relations: {r1: {binding_ref: 'r1'}},
  });
  const notes = disclosive.notes.join(' ');
  const named = [/native subject binding/, /parameter tone/, /automated \(sine/, /scene body \(carrier knowledge_whole\)/, /1 declarative trigger/, /typed relation/].map(rx => rx.test(notes));
  if (named.some(pass => !pass) || disclosive.notes.length < 6) fail('conversion notes disclose the remainder', notes.slice(0, 240));
  else ok('structural mismatch converts what maps and names the remainder', `${disclosive.notes.length} conversion notes: subject binding, unmapped parameter, automation, scene body, trigger, relations`);
  if (disclosive.journey.scenes[0].entities[0].position.x !== 0) fail('automation base value stands', `x = ${disclosive.journey.scenes[0].entities[0].position.x}`);
  else ok('an automated parameter keeps its base value in the view', 'the automation itself is named as not carried');

  // ---- (7) NO second store -----------------------------------------------
  const secondStore = await appFrame.evaluate(async ([ref, title]) => {
    const scan = {localStorage: [], drafts: []};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key) ?? '';
      if (value.includes(ref) || value.includes(title)) scan.localStorage.push(key);
    }
    try {
      const db = await new Promise((resolve, reject) => { const open = indexedDB.open('oi.expression-recovery', 1); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
      scan.drafts = await new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readonly');
        const request = tx.objectStore('drafts').getAll();
        request.onsuccess = () => resolve((request.result ?? []).filter(draft => JSON.stringify(draft).includes(ref) || JSON.stringify(draft).includes(title)).map(draft => draft.id));
        request.onerror = () => reject(request.error);
      });
      db.close();
    } catch (cause) { scan.drafts = [`scan failed: ${cause}`]; }
    return scan;
  }, [EXPRESSION_REF, 'Kernel bridge round-trip']);
  if (secondStore.localStorage.length || secondStore.drafts.length) fail('no second store', JSON.stringify(secondStore));
  else ok('the app\'s browser storage holds no copy of the kernel document', 'localStorage and the IndexedDB recovery drafts are clean of the kernel expression');

  // ---- artifacts ----------------------------------------------------------
  receipts.push({expression_ref: EXPRESSION_REF, created_revision: 1, saved_revision: saveOutcome?.revision ?? null, conflict_ok: conflict?.ok ?? null, fresh_inspect_revision: freshDoc?.revision ?? null, central_read_bytes: readBack?.byte_len ?? null, conversion_notes: disclosive.notes.length, second_store: secondStore});
  await host.screenshot({path: join(artifacts, 'expressions-kernel-roundtrip.png')});
  const fs = await import('node:fs');
  fs.writeFileSync(join(artifacts, 'expressions-kernel-roundtrip.json'), JSON.stringify({probe: 'expressions-kernel-roundtrip', desk: url, bridge: bridgeUrl, receipts, at: new Date().toISOString()}, null, 2));
  ok('artifacts written', 'walk/artifacts/expressions-kernel-roundtrip.{png,json}');
} catch (cause) {
  fail('probe', cause instanceof Error ? cause.message : String(cause));
  await host.screenshot({path: join(artifacts, 'expressions-kernel-roundtrip-failure.png')}).catch(() => {});
}

if (errors.length) { console.log('console/page errors:'); for (const error of errors) console.log('  ' + error); fails.push('no console errors'); }
else ok('no console or page errors');

await browser.close();
bridge.kill();
console.log(fails.length ? `\n${fails.length} FAILURES: ${fails.join('; ')}` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
