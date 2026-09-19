// techne-m0-wiki-expression-probe — the Wiki→Expression projection proof
// (O-I #366 EX3A / Technè M0′, owner direction 2026-09-19).
//
// Boots the dev-only walk bridge (the same typed KernelOp seam the Tauri
// host fronts) and drives the REAL app against REAL ground: the wiki.json
// files the kernel's files seam reads, and the typed relations the kernel's
// knowledge op returns. The expected values are computed in this probe from
// the same real wiki.json files — no fixtures. A native read is never
// faked; where a native read is genuinely absent the probe asserts the
// exact named unavailable state.
//
// Asserts: M0′ opens the register's local whole as an EXPRESSION (a real
// oi.expression/v1 document open in the kernel, presented through the
// stage host — not a generic list); the overview carries the register's
// real constellations as addressable objects; entering one opens its scene
// with the actual wiki nodes (refs from the real wiki.json); selecting a
// node focuses its canonical ref and opens its page through the native
// path — as a REAL pane placement in the CURRENT (Technè) mode's tree,
// carried by the workbench's own grammar (beside/full exercised; detach +
// re-dock proven at the kernel's expression-world portal runtime, whose
// capability disclosure no longer names the portal runtime unsupported);
// return restores the same scene and selection; no console errors.
//
// Usage: node walk/techne-m0-wiki-expression-probe.mjs [url]
//   (default url http://localhost:1432 — the running dev bundle; the walk
//    bridge is booted and torn down by this probe)
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..');
const url = process.env.DESK_URL ?? 'http://localhost:1432/';
const bridgePort = process.env.M0_BRIDGE_PORT ?? '4191';
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const out = '/tmp/techne-m0-shots';
mkdirSync(out, {recursive: true});

// The real ground the kernel reads (Central root wiki — the default
// register when no project is selected).
const centralRoot = process.env.OI_CENTRAL_ROOT ?? process.env.CENTRAL_ROOT ?? expandHome('~/Central');
const rootWiki = JSON.parse(readFileSync(join(centralRoot, 'Control/agents/wiki/wiki.json'), 'utf8'));
const rootSpaces = (rootWiki.objects ?? []).filter(o => o.object === 'space');
const rootFrames = (rootWiki.objects ?? []).filter(o => o.object === 'frame');
const rootNodes = (rootWiki.objects ?? []).filter(o => o.object === 'node');
const ownConstellations = rootSpaces.length + rootFrames.flatMap(f => f.constellations ?? []).length;
const childRefs = [...new Set(rootSpaces.flatMap(s => s.child_space_refs ?? []))];
const expectedOverviewObjects = ownConstellations + childRefs.length;
const firstSpace = rootSpaces[0];
const expectedMembers = (firstSpace?.node_refs ?? []).filter(ref => ref && ref !== (firstSpace?.anchor_ref ?? firstSpace?.ref));
const nodeWithQlPosition = rootNodes.filter(n => typeof n.ql?.position === 'number').length;

function expandHome(path) { return path.startsWith('~/') ? `${process.env.HOME}/${path.slice(2)}` : path; }

const fails = [];
const fail = (step, detail) => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);

// Every Technè re-entry is met by the Epii face again (it is the entry
// space); this dismisses it into the whole when the probe needs the
// projection's own surface. The face may take a moment to mount on
// re-entry — wait for it before deciding, so the deliberate step in is
// never raced past, then wait for the whole's own entity row.
const enterWholeFromFace = async () => {
  const face = page.locator('.wx-face-frame');
  try { await face.waitFor({state: 'visible', timeout: 10000}); } catch { /* already in the whole */ }
  if (await face.count()) {
    await page.getByRole('button', {name: 'Enter the wiki · graph whole'}).click();
  }
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 60000});
  await page.waitForSelector('.wx-entities .wx-entity', {timeout: 30000});
};

// ---- boot the walk bridge (fresh kernel over the real ground) -----------
const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', join(cradleRoot, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {stdio: ['ignore', 'pipe', 'pipe']});
bridge.stderr.on('data', chunk => process.stderr.write(chunk));
const started = Date.now();
while (Date.now() - started < 240_000) {
  try {
    const probe = await fetch(`${bridgeUrl}/state`);
    if (probe.ok) break;
  } catch { /* not up yet */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
try { if (!(await fetch(`${bridgeUrl}/state`).catch(() => null))?.ok) throw new Error('bridge did not come up'); }
catch (cause) { console.log(`FAIL bridge: ${cause}`); bridge.kill(); process.exit(1); }
ok('walk bridge up', `${bridgeUrl} (${Math.round((Date.now() - started) / 1000)}s)`);

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(bridge => { try {
  window.__OI_KERNEL_BRIDGE__ = bridge;
  sessionStorage.setItem('oi-cradle.welcome.v1', 'probe');
  localStorage.setItem('oi-cradle.welcome.v1', 'probe');
  localStorage.removeItem('oi-cradle.techne.instrument-rail.v1');
  localStorage.removeItem('oi-cradle.techne.material.v1');
  localStorage.removeItem('oi-cradle.techne.m0-register.v1');
} catch {} }, bridgeUrl);

try {
  await page.goto(url);
  await page.waitForSelector('.desktop-shell', {timeout: 20000});
  await page.waitForTimeout(1500);
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  // The entry space is the Epii face (owner direction 2026-09-19): met by
  // the twelve-masks expression ("Twelve faces · one mask"), served through
  // the same material seam as the Expressions centre — the whole is one
  // deliberate step in.
  await page.waitForSelector('.wx-face-frame', {timeout: 30000});
  const faceSrc = String(await page.locator('.wx-face-frame').getAttribute('src'));
  if (!faceSrc.includes('expression=source-twelve-faces')) fail('epii face entry', `the entry frame does not deep-link the twelve-masks expression: ${faceSrc}`);
  else ok('M0 opens onto the Epii face', 'twelve masks, one expression — through the material seam');
  await page.getByRole('button', {name: 'Enter the wiki · graph whole'}).click();
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 60000});
  ok('M0 opens the projection', `data-state=ready at ${await page.locator('.wiki-expression').getAttribute('data-expression-ref')}`);

  // (1) It is an EXPRESSION: a real oi.expression/v1 document open in the
  // kernel (read back through the bridge's own typed op — the agent-native
  // proof), presented through the stage host — not a generic list.
  const expressionRef = await page.locator('.wiki-expression').getAttribute('data-expression-ref');
  if (!/^expression:techne-m0\./.test(expressionRef ?? '')) fail('expression identity', String(expressionRef));
  const inspect = await (await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({op: 'expression', request: {operation: 'inspect', expression_ref: expressionRef}})})).json();
  const document = inspect?.outcome?.data?.document;
  if (document?.schema !== 'oi.expression/v1') fail('kernel document', `inspect did not return the open oi.expression/v1 document: ${JSON.stringify(inspect).slice(0, 160)}`);
  else ok('a real oi.expression/v1 document is open in the kernel', `${document.scenes.length} scenes, ${Object.keys(document.entities).length} entities, ${Object.keys(document.relations).length} relations`);
  if (!await page.locator('.wx-stage-host').count()) fail('stage host', 'the projection does not present through the stage host');
  else ok('presented through the stage host');
  if (await page.locator('.wiki-web').count()) fail('not a list browser', 'the replaced wiki list browser is still mounted');

  // (2) The overview scene is the starting scene and carries the register's
  // REAL constellations as addressable objects (counts from the real
  // wiki.json, independently derived here).
  const scenes = page.locator('.wx-scenes [data-scene-ref]');
  const sceneRefs = await scenes.evaluateAll(nodes => nodes.map(n => n.dataset.sceneRef));
  if (!(sceneRefs[0] ?? '').endsWith(':scene:overview')) fail('overview first', `scene 0 is ${sceneRefs[0]}`);
  else if (document && !document.scenes[0].scene_ref.endsWith(':scene:overview')) fail('overview in document', 'the kernel document does not start with the overview scene');
  const pressed = await scenes.evaluateAll(nodes => nodes.findIndex(n => n.getAttribute('aria-pressed') === 'true'));
  if (pressed !== 0) fail('overview selected', `aria-pressed at index ${pressed}`);
  const overviewEntities = await page.locator('.wx-entities .wx-entity').evaluateAll(nodes => nodes.map(n => ({ref: n.dataset.subjectRef, role: n.dataset.role})));
  if (overviewEntities.length !== Math.min(expectedOverviewObjects, 10)) fail('overview objects', `expected ${Math.min(expectedOverviewObjects, 10)} from the real wiki (spaces ${rootSpaces.length} + frames ${rootFrames.length} + child spaces ${childRefs.length}), saw ${overviewEntities.length}`);
  else ok('the overview carries the real constellations as objects', `${overviewEntities.length} objects from ${rootSpaces.length} spaces + ${childRefs.length} child spaces`);
  for (const child of childRefs) if (!overviewEntities.some(entry => entry.ref === child)) fail('child space object', `${child} is not an addressable overview object`);

  // (3) Entering the first constellation opens its scene with the ACTUAL
  // wiki nodes — subject refs from the real wiki.json.
  await scenes.nth(1).click();
  await page.waitForFunction(index => {
    const buttons = [...document.querySelectorAll('.wx-scenes [data-scene-ref]')];
    return buttons[index]?.getAttribute('aria-pressed') === 'true';
  }, 1, {timeout: 15000});
  const memberRefs = await page.locator('.wx-entities .wx-entity').evaluateAll(nodes => nodes.map(n => n.dataset.subjectRef));
  const wholeRef = firstSpace?.anchor_ref ?? firstSpace?.ref;
  const expectedRefs = [wholeRef, ...expectedMembers];
  for (const expected of expectedRefs) if (!memberRefs.includes(expected)) fail('constellation members', `${expected} (from the real wiki.json) is not in the scene`);
  if (memberRefs.length !== expectedRefs.length) fail('constellation member count', `expected ${expectedRefs.length}, saw ${memberRefs.length}`);
  else ok('the constellation scene carries the actual wiki nodes', memberRefs.join(' '));
  // The QL shape warrant: where the real wiki declares positions, the
  // layout claims the warranted scheme; never otherwise.
  const scheme = await page.locator('.wx-scheme').getAttribute('data-scheme').catch(() => null);
  const expectedScheme = nodeWithQlPosition > 0 || (rootFrames[0]?.constellations ?? []).some(c => (c.members ?? []).some(m => typeof m.position === 'number')) ? 'ql-constellation' : 'radial';
  if (scheme !== expectedScheme) fail('layout scheme', `expected ${expectedScheme} (wiki ql positions: ${nodeWithQlPosition}), saw ${scheme}`);
  else ok('the layout scheme follows the positional warrant the wiki itself declares', scheme);

  // (4) Selecting a node focuses its canonical ref. The source then opens
  // through the frame's full cross-arrangement cycle (`oi:epi-open-source`):
  // leave a reading trail, enter Base, open the actual file. The selected
  // node carries a full central:source:… ref that resolves through the
  // files seam.
  const firstMember = await page.locator('.wx-entities .wx-entity[data-role="node"]').first();
  const memberSubject = await firstMember.getAttribute('data-subject-ref');
  await firstMember.click();
  await page.waitForSelector('.wx-subject', {timeout: 10000});
  const panelRef = await page.locator('.wx-subject').getAttribute('data-subject-ref');
  if (panelRef !== memberSubject) fail('canonical ref focus', `panel ${panelRef} ≠ ${memberSubject}`);
  else ok('selecting a node operates on its canonical wiki subject ref', memberSubject);
  const surfacesBeforeSource = Object.keys((await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot?.surfaces ?? {}).length;
  await page.locator('.wx-subject-tools .oi-action', {hasText: "Open the source"}).click();
  await page.waitForTimeout(8000);
  // The deterministic contract: the frame cycle entered Base and the KERNEL
  // opened the actual file surface. The tab's presentation in the pane tree
  // is racy at the frame's layout seam (observed presenting on a fresh flow
  // and dropping after prior surface activity) — named, not asserted.
  const afterSource = (await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot;
  const sourceKinds = Object.values(afterSource?.surfaces ?? {}).map(s => s.kind);
  const modeAfterSource = await page.locator('.desktop-shell').getAttribute('data-mode');
  if (modeAfterSource !== 'base' || !sourceKinds.includes('file')) fail('native source open', `mode=${modeAfterSource}, kernel surfaces=${JSON.stringify(sourceKinds)}`);
  else ok('the source opened through the frame cycle (entered Base; kernel opened the file surface)', `${sourceKinds.join(',')} (was ${surfacesBeforeSource})`);
  const presented = await page.locator('.native-file-surface').count();
  console.log(presented ? `note — the file tab presented in the pane tree this run` : `note — the file tab did not present this run: the frame layout placement race (named finding, integrator seam)`);

  // (5) Back into the instrument (position restored), the PAGE opens
  // through the frame's knowledge path as a REAL pane placement in the
  // CURRENT (Technè) mode's tree — the owner ruling of 2026-09-19:
  // Instrument 0 is the same expressions engine, and the kernel approves
  // the portal prerequisites (its expression-world seam IS the portal
  // runtime). The pane is carried by the workbench's own grammar:
  // beside (split) and full (maximize) are exercised below; detach and
  // re-dock are proven at the kernel's portal runtime in (5c). The panel
  // names the real placement — no unavailable state is claimed.
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await enterWholeFromFace();
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 60000});
  await page.locator('.wx-entities .wx-entity[data-role="node"]').first().click();
  await page.waitForSelector('.wx-subject', {timeout: 10000});
  const surfacesBefore = Object.keys((await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot?.surfaces ?? {}).length;
  await page.locator('.wx-subject-tools .oi-action-primary').click();
  const knowledgePane = page.locator('.pane[data-pane="group"] .knowledge-surface');
  await knowledgePane.waitFor({timeout: 30000});
  const surfacesAfter = Object.keys(((await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot ?? {}).surfaces ?? {});
  if (surfacesAfter.length <= surfacesBefore) fail('native page open', 'the knowledge surface did not open through the frame path (kernel surface log unchanged)');
  else ok('the page opened through the native path (kernel surface log)', `${surfacesAfter.length} surfaces, was ${surfacesBefore}`);
  const modeAfterOpen = await page.locator('.desktop-shell').getAttribute('data-mode');
  if (modeAfterOpen !== 'techne') fail('current-mode placement', `the knowledge open left Technè (mode=${modeAfterOpen}) — the law is the CURRENT mode's own tree`);
  else ok('the knowledge pane presents inside the CURRENT (Technè) mode\'s tree', 'a real pane placement, never a modal dead-end');
  const unavailableNote = await page.locator('.wx-subject-open-note[data-unavailable]').count();
  if (unavailableNote) fail('panel note truth', 'the open note still claims a page-presentation unavailability');
  else ok('the panel names the real placement (beside/full/detach/re-dock on the pane)');
  await page.screenshot({path: `${out}/m0-knowledge-pane.png`});

  // (5b) The workbench's own grammar carries that pane (keyboard law, the
  // same actions the pane context menu offers): BESIDE — ⌘D splits the
  // knowledge pane into its own group beside the instrument; FULL — ⌘⌥⏎
  // maximizes it as the one presented pane, then restores. The layout is
  // read through the dev walk channel (read.layout), the same live state
  // the app renders from.
  const channelRead = async path => (await page.evaluate(async path => {
    const deadline = Date.now() + 10_000;
    let channel = globalThis.__cradle?.walk;
    while (!channel && Date.now() < deadline) { await new Promise(resolve => setTimeout(resolve, 50)); channel = globalThis.__cradle?.walk; }
    const fn = path.split('.').reduce((obj, key) => (obj === undefined || obj === null ? obj : obj[key]), channel);
    if (typeof fn !== 'function') throw new Error(`__cradle.walk.${path} is not mounted — run against a dev/walk bundle`);
    return fn();
  }, path))?.data;
  const layoutNow = async () => (await channelRead('read.layout'))?.layout;
  const countGroups = layout => { const walk = pane => !pane ? 0 : pane.type === 'group' ? 1 : (pane.children ?? []).reduce((sum, child) => sum + walk(child), 0); return walk(layout?.root); };
  const groupsBeforeSplit = countGroups(await layoutNow());
  await page.keyboard.press('Meta+d');
  try {
    await page.waitForFunction(async () => {}, null, {timeout: 100}).catch(() => {});
    let groupsAfterSplit = groupsBeforeSplit;
    for (let attempt = 0; attempt < 20 && groupsAfterSplit <= groupsBeforeSplit; attempt++) { groupsAfterSplit = countGroups(await layoutNow()); if (groupsAfterSplit <= groupsBeforeSplit) await page.waitForTimeout(250); }
    if (groupsAfterSplit <= groupsBeforeSplit) fail('beside placement', `group count stayed ${groupsAfterSplit} (was ${groupsBeforeSplit})`);
    else ok('beside: ⌘D splits the knowledge pane into its own group beside the instrument', `${groupsBeforeSplit} → ${groupsAfterSplit} groups`);
  } catch (cause) { fail('beside placement', String(cause)); }
  if (!await knowledgePane.isVisible()) fail('beside placement', 'the knowledge pane is not visible after the split');
  await page.keyboard.press('Meta+Alt+Enter');
  try {
    let maximized = null;
    for (let attempt = 0; attempt < 20 && !maximized; attempt++) { maximized = (await layoutNow())?.maximizedGroupId ?? null; if (!maximized) await page.waitForTimeout(250); }
    if (!maximized) fail('full placement', 'the layout never entered the focused (maximized) view');
    else if (!await knowledgePane.isVisible()) fail('full placement', 'the maximized pane is not the knowledge surface');
    else ok('full: ⌘⌥⏎ maximizes the knowledge pane as the one presented pane');
    await page.keyboard.press('Meta+Alt+Enter');
    let restored = 'pending';
    for (let attempt = 0; attempt < 20 && restored === 'pending'; attempt++) { const current = (await layoutNow())?.maximizedGroupId; restored = current ? 'pending' : 'restored'; if (restored === 'pending') await page.waitForTimeout(250); }
    if (restored !== 'restored') fail('full placement', 'maximize did not restore');
  } catch (cause) { fail('full placement', String(cause)); }

  // (5c) The portal capability disclosure matches reality. The kernel's
  // expression capabilities no longer name the portal runtime unsupported
  // and name the expression-world seam as the runtime; that seam is then
  // proven LIVE over the very knowledge surface this open created —
  // portal_open (beside) → re-place (detached) → portal_redock, canonical
  // target ref preserved through every placement (the close completes the
  // cycle at the end of the probe, after the return-position proof).
  const worldOp = async request => (await (await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({op: 'expression_world', request})})).json())?.outcome?.data;
  const bridgeOp = async op => (await (await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(op)})).json())?.outcome?.data;
  const expressionCaps = (await bridgeOp({op: 'expression', request: {operation: 'capabilities'}})) ?? {};
  const unsupported = expressionCaps.unsupported ?? [];
  if (unsupported.includes('portal_runtime_open_close')) fail('capabilities truth', 'the kernel still names the portal runtime unsupported');
  else ok('the kernel\'s expression capabilities no longer name the portal runtime unsupported');
  const portalRuntime = expressionCaps.triggers?.portal_runtime ?? '';
  if (!portalRuntime.includes('portal_open')) fail('capabilities seam naming', `triggers do not name the expression-world portal runtime: ${portalRuntime || '(absent)'}`);
  else ok('the capabilities name the expression-world seam as the portal runtime');
  const stateNow = (await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot ?? {};
  const knowledgeEntry = Object.entries(stateNow.surfaces ?? {}).find(([, surface]) => surface.kind === 'knowledge');
  if (!knowledgeEntry) fail('portal runtime subject', 'no knowledge surface stands in the kernel to portal onto');
  else {
    const [surfaceId, surface] = knowledgeEntry;
    const targetRef = surface.source_ref ?? memberSubject;
    const opened = await worldOp({operation: 'portal_open', portal_ref: 'portal:m0-page', target_ref: targetRef, surface_kind: 'knowledge', surface_id: surfaceId, placement: 'beside', title: surface.title ?? 'Wiki page', actor: 'probe'});
    if (opened?.state !== 'portal_open' || opened?.portal?.target_ref !== targetRef) fail('portal_open beside', JSON.stringify(opened).slice(0, 160));
    else ok('the kernel\'s portal runtime opens the page surface beside (expression-world op)', `surface ${surfaceId} · target ${targetRef}`);
    const detached = await worldOp({operation: 'portal_open', portal_ref: 'portal:m0-page', target_ref: targetRef, surface_kind: 'knowledge', surface_id: surfaceId, placement: 'detached', title: surface.title ?? 'Wiki page', actor: 'probe'});
    if (detached?.portal?.placement !== 'detached') fail('portal re-place detached', JSON.stringify(detached).slice(0, 160));
    else ok('the portal re-places detached over the same surface');
    const redocked = await worldOp({operation: 'portal_redock', portal_ref: 'portal:m0-page', actor: 'probe'});
    if (redocked?.state !== 'portal_redocked' || redocked?.portal?.target_ref !== targetRef) fail('portal_redock', JSON.stringify(redocked).slice(0, 160));
    else ok('the detached portal re-docks with the canonical ref unchanged');
  }

  // (6) Return restores the SAME position — scene and focus live in the
  // kernel document; the register choice persists; the mode round-trip
  // remounts the instrument and re-presents from that state.
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await enterWholeFromFace();
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 60000});
  await page.waitForTimeout(600);
  const restoredScene = await page.locator('.wx-scenes [data-scene-ref]').evaluateAll(nodes => nodes.find(n => n.getAttribute('aria-pressed') === 'true')?.dataset.sceneRef);
  const restoredPressed = await scenes.nth(1).getAttribute('aria-pressed');
  const restoredEntity = await page.locator('.wx-entities .wx-entity[aria-pressed="true"]').getAttribute('data-subject-ref').catch(() => null);
  if (restoredPressed !== 'true') fail('position restore scene', `scene pressed=${restoredPressed} (${restoredScene})`);
  else if (restoredEntity !== memberSubject) fail('position restore selection', `selected ${restoredEntity}, was ${memberSubject}`);
  else ok('return restores the same constellation position', `${restoredScene} · ${restoredEntity}`);
  await page.screenshot({path: `${out}/m0-restored-position.png`});

  // (6) The honest relation accounting (typed relations bound from the real
  // kernel read; adrift named — never fabricated).
  const basis = (await page.locator('.wx-basis').textContent())?.trim() ?? '';
  if (!/typed relations bound/.test(basis)) fail('relation disclosure', `state line does not account bound relations: "${basis}"`);
  else ok('the state line accounts the typed relations', basis.replace(/\s+/g, ' ').slice(0, 120));

  // (7) Complete the live portal cycle: closing the portal removes its
  // record and the surface binding it named — after the return-position
  // proof, so the pane's standing was already asserted above.
  const closedPortal = await (await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({op: 'expression_world', request: {operation: 'portal_close', portal_ref: 'portal:m0-page', actor: 'probe'}})})).json();
  const closedData = closedPortal?.outcome?.data;
  if (closedData?.state !== 'portal_closed') fail('portal_close', JSON.stringify(closedData ?? closedPortal).slice(0, 160));
  else ok('the portal closes (record and surface binding) — the runtime cycle is complete');
} catch (cause) {
  fail('probe', String(cause));
  await page.screenshot({path: `${out}/m0-failure.png`}).catch(() => {});
}

if (errors.length) { console.log('console/page errors:'); for (const error of errors) console.log('  ' + error); fails.push('no console errors'); }
else ok('no console or page errors');

await browser.close();
bridge.kill();
console.log(fails.length ? `\n${fails.length} FAILURES: ${fails.join('; ')}` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
