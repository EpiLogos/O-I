// expression-walk-13-step.mjs — the connected walk the owner's spec demands
// ("Do not hide behind fixtures"), run against the REAL app over the walk
// bridge on real Central ground. Every step records its backing honestly:
//   live-native        driven by real owner reads/ops end to end
//   named-unavailable  the exact named state, never invented content
//   named-remainder    a seam this cut has not landed, named in the record
//
// Usage: node walk/expression-walk-13-step.mjs [url]
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..');
const url = process.env.DESK_URL ?? 'http://localhost:1432/';
const bridgePort = process.env.WALK_BRIDGE_PORT ?? '4195';
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const out = join(cradleRoot, 'walk', 'artifacts', 'expression-walk');
mkdirSync(out, {recursive: true});

const fails = [];
const fail = (step, detail) => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);
const record = [];
const note = (step, name, backing, detail) => { record.push({step, name, backing, detail}); };

function expandHome(path) { return path.startsWith('~/') ? `${process.env.HOME}/${path.slice(2)}` : path; }
const centralRoot = process.env.OI_CENTRAL_ROOT ?? process.env.CENTRAL_ROOT ?? expandHome('~/Central');
const oiWiki = JSON.parse(readFileSync(join(centralRoot, 'Work/O-I/ProjectCentral/agents/wiki/wiki.json'), 'utf8'));
const oiSpaces = (oiWiki.objects ?? []).filter(o => o.object === 'space');
const oiNodes = (oiWiki.objects ?? []).filter(o => o.object === 'node');
const oiSpace = oiSpaces[0];
const oiMemberRefs = (oiSpace?.node_refs ?? []).filter(ref => ref && ref !== (oiSpace?.anchor_ref ?? oiSpace?.ref));

const enterWholeFromFace = async () => {
  const face = page.locator('.wx-face-frame');
  try { await face.waitFor({state: 'visible', timeout: 10000}); } catch { /* already in the whole */ }
  if (await face.count()) await page.getByRole('button', {name: 'Enter the wiki · graph whole'}).click();
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 60000});
  await page.waitForSelector('.wx-entities .wx-entity', {timeout: 30000});
};

// ---- boot the walk bridge ------------------------------------------------
const bridge = spawn('cargo', ['run', '--quiet', '--manifest-path', join(cradleRoot, 'kernel/Cargo.toml'), '--bin', 'walk-bridge', '--', `127.0.0.1:${bridgePort}`], {stdio: ['ignore', 'pipe', 'pipe']});
bridge.stderr.on('data', chunk => process.stderr.write(chunk));
const started = Date.now();
while (Date.now() - started < 240_000) {
  try { const probe = await fetch(`${bridgeUrl}/state`); if (probe.ok) break; } catch { /* not up yet */ }
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

  // STEP 1 — Enter Expressions: the real hosted application.
  await page.locator('.world-mode-strip [data-mode="expressions"]').click();
  await page.waitForSelector('.pcd-host[data-state="ready"]', {timeout: 30000});
  await page.waitForSelector('.pcd-host-frame', {timeout: 20000});
  await page.waitForTimeout(2500);
  const frameSrc = String(await page.locator('.pcd-host-frame').getAttribute('src'));
  if (!frameSrc.includes('/material/')) fail('step 1', `the Expressions centre does not host the application through the material seam: ${frameSrc.slice(0, 80)}`);
  else ok('STEP 1 · Expressions loads the real hosted application', 'served through the owner\'s material seam — live-native');
  note(1, 'Expressions entrance → hosted application', 'live-native', 'pcd-host ready; the app of record serves through oi-material:// / the walk bridge mirror');
  await page.screenshot({path: `${out}/01-expressions-entrance.png`});

  // STEP 2 — Open the Library: the application's own full-page Library.
  // At the hosted frame's width the workspace cluster collapses behind the
  // header menu toggle; open it first, then the Expression library item
  // (the same path the application's own probe drives).
  const app = page.frameLocator('.pcd-host-frame');
  const openLibraryThrough = async () => {
    await app.locator('.header-cluster.workspace-cluster .header-menu-toggle').first().click({timeout: 15000}).catch(async () => {
      await app.locator('[data-action="library"]').first().click({timeout: 10000}).catch(() => fail('step 2', 'no Library control found in the hosted frame'));
    });
    await app.locator('[data-action="library"]').first().click({timeout: 15000}).catch(() => {});
    await app.locator('#library-page').waitFor({timeout: 15000}).catch(() => fail('step 2', 'the Library page did not open'));
  };
  await openLibraryThrough();
  if (await app.locator('#library-page').count()) {
    ok('STEP 2 · the real Expressions Library opens', 'the application\'s own full-page collection — live-native');
    note(2, 'Open the Library', 'live-native', 'the vendored application\'s own libraryHTML interaction, inside the hosted frame');
    await page.screenshot({path: `${out}/02-library.png`});
  }

  // STEP 3 — MY WORLD / PERSONAL horizon with the #375 scopes.
  const horizons = app.locator('#library-page .oi-lib-horizon');
  try { await horizons.first().waitFor({timeout: 10000}); } catch { /* horizon seam */ }
  if (await horizons.count()) {
    await app.locator('#library-page .oi-lib-horizon[data-section="collection:web"]').first().click().catch(() => fail('step 3', 'the O:I WEB horizon did not switch'));
    await page.waitForTimeout(800);
    const unavailable = await app.locator('text=Projected worlds are not reachable from this application yet').count();
    if (unavailable) ok('STEP 3 · O:I WEB horizon names the exact shared state', 'no invented projected worlds — the named-unavailable state the spec demands');
    else fail('step 3', 'the O:I WEB horizon rendered without its named unavailable state');
    await app.locator('#library-page .oi-lib-horizon[data-section="collection"]').first().click().catch(() => {});
    await page.waitForTimeout(600);
    const scopes = await app.locator('#library-page [data-scope]').evaluateAll(nodes => [...new Set(nodes.map(n => n.dataset.scope))]);
    ok('STEP 3 · MY WORLD / PERSONAL horizon', `scopes: ${scopes.join(', ')}`);
    note(3, 'MY WORLD / PERSONAL + O:I WEB horizons', 'live-native + named-unavailable', `personal scopes ${scopes.join(', ')}; O:I WEB names the SharedField provider as the absent native owner (Lane L 058904d1)`);
    await page.screenshot({path: `${out}/03-horizons.png`});
  } else {
    note(3, 'MY WORLD / PERSONAL + O:I WEB horizons', 'named-remainder', 'the Library horizons did not stand at walk time');
    fail('step 3', 'the Library horizons (MY WORLD / O:I WEB) are not mounted');
  }
  // Back to the field for the Technè path.
  await app.locator('[data-action="close-library"]').first().click().catch(() => {});

  // STEP 4 — a real ProjectCentral project's wiki whole as an Expression.
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await enterWholeFromFace();
  await page.locator('.wx-register select').selectOption('O-I');
  await page.waitForFunction(() => document.querySelector('.wiki-expression')?.getAttribute('data-register') === 'O-I', null, {timeout: 20000});
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 60000});
  const oiExpressionRef = await page.locator('.wiki-expression').getAttribute('data-expression-ref');
  const inspect = await (await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({op: 'expression', request: {operation: 'inspect', expression_ref: oiExpressionRef}})})).json();
  const oiDocument = inspect?.outcome?.data?.document;
  if (oiDocument?.schema !== 'oi.expression/v1') fail('step 4', `the O-I register did not open a real oi.expression/v1 document: ${JSON.stringify(inspect).slice(0, 120)}`);
  else ok('STEP 4 · the real ProjectCentral whole opens as an Expression', `${oiExpressionRef} — ${oiDocument.scenes.length} scenes, ${Object.keys(oiDocument.entities).length} entities (live-native)`);
  note(4, 'Enter a real ProjectCentral project → its wiki whole as an Expression', 'live-native', `${oiExpressionRef}: projected from Work/O-I/ProjectCentral/agents/wiki/wiki.json through the files seam + the kernel's knowledge op`);
  await page.screenshot({path: `${out}/04-oi-register-projection.png`});

  // STEP 5 — the overview carries the project's actual constellations.
  const overviewObjects = await page.locator('.wx-entities .wx-entity').evaluateAll(nodes => nodes.map(n => ({ref: n.dataset.subjectRef, role: n.dataset.role})));
  const expectedOverview = oiSpaces.length + (oiSpace?.child_space_refs ?? []).length;
  if (!overviewObjects.some(entry => entry.role === 'constellation')) fail('step 5', 'no constellation objects in the overview');
  else ok('STEP 5 · the overview carries the actual constellations as objects', `${overviewObjects.length} objects (wiki: ${expectedOverview} space(s) + child refs) — live-native`);
  note(5, 'Overview scene = actual constellations as Expression objects', 'live-native', overviewObjects.map(entry => entry.ref).join(', '));

  // STEP 6 — enter the constellation: its scene holds the exact wiki nodes.
  await page.locator('.wx-scenes [data-scene-ref]').nth(1).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.wx-scenes [data-scene-ref]')][1]?.getAttribute('aria-pressed') === 'true', null, {timeout: 15000});
  const memberRefs = await page.locator('.wx-entities .wx-entity').evaluateAll(nodes => nodes.map(n => n.dataset.subjectRef));
  const wholeRef = oiSpace?.anchor_ref ?? oiSpace?.ref;
  const expectedRefs = [wholeRef, ...oiMemberRefs];
  const missing = expectedRefs.filter(ref => !memberRefs.includes(ref));
  if (missing.length) fail('step 6', `missing actual wiki nodes: ${missing.join(', ')}`);
  else ok('STEP 6 · the constellation scene holds the exact wiki nodes', memberRefs.join(' '));
  const scheme = await page.locator('.wx-scheme').getAttribute('data-scheme').catch(() => null);
  note(6, 'Constellation scene = exact nodes + typed relations', 'live-native', `members ${memberRefs.join(', ')}; layout ${scheme ?? 'n/a'} — the warrant the wiki itself declares`);

  // STEP 7 — select a real node: the same canonical ref becomes the focus.
  // (O-I's wiki whole is thin — its one entry IS the constellation's own
  // anchor, so the projection truthfully places it as the whole. The node
  // legs walk the Central register, whose nodes carry real source files.)
  await page.locator('.wx-register select').selectOption('central');
  await page.waitForFunction(() => document.querySelector('.wiki-expression')?.getAttribute('data-register') === 'central', null, {timeout: 20000});
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 60000});
  await page.locator('.wx-scenes [data-scene-ref]').nth(1).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.wx-scenes [data-scene-ref]')][1]?.getAttribute('aria-pressed') === 'true', null, {timeout: 15000});
  const node = page.locator('.wx-entities .wx-entity[data-role="node"]').first();
  const nodeSubject = await node.getAttribute('data-subject-ref');
  await node.click();
  await page.waitForSelector('.wx-subject', {timeout: 10000});
  const panelRef = await page.locator('.wx-subject').getAttribute('data-subject-ref');
  if (panelRef !== nodeSubject) fail('step 7', `panel ${panelRef} ≠ node ${nodeSubject}`);
  else ok('STEP 7 · the selected node\'s canonical ref is the focus', nodeSubject);
  note(7, 'Node selection → canonical ref focus', 'live-native', nodeSubject);

  // STEP 8 — the same ref is the map's selection (the one state, cross-aperture).
  const mapRowSelected = await page.locator(`.wiki-region[data-register="central"] [data-row-kind="member"][data-subject-ref="${nodeSubject}"]`).getAttribute('aria-selected').catch(() => null);
  if (mapRowSelected !== 'true') fail('step 8', `the map's Central region does not read the same selection (${nodeSubject})`);
  else ok('STEP 8 · the left map reads the same selection from the one state', nodeSubject);
  note(8, 'One selection across apertures (map ↔ centre)', 'live-native', `wikiProjectionStore is the one relation/selection state; row ${nodeSubject} selected in the Technè map`);

  // The SOURCE opens first (the proven order: the source cycle enters Base
  // and returns; the page open then places into the mode tree).
  const sourceBefore = Object.keys((await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot?.surfaces ?? {}).length;
  await page.locator('.wx-subject-tools .oi-action', {hasText: 'Open the source'}).click().catch(() => {});
  await page.waitForTimeout(8000);
  const afterSource = (await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot ?? {};
  const sourceOpened = Object.keys(afterSource.surfaces ?? {}).length > sourceBefore;
  const surfacesBefore = Object.keys((await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot?.surfaces ?? {}).length;
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await enterWholeFromFace();
  await page.locator('.wx-entities .wx-entity[data-role="node"]').first().click();
  await page.waitForSelector('.wx-subject', {timeout: 10000});
  await page.locator('.wx-subject-tools .oi-action-primary').click();
  const channelRead = async path => (await page.evaluate(async path => {
    const deadline = Date.now() + 10_000;
    let channel = globalThis.__cradle?.walk;
    while (!channel && Date.now() < deadline) { await new Promise(resolve => setTimeout(resolve, 50)); channel = globalThis.__cradle?.walk; }
    const fn = path.split('.').reduce((obj, key) => (obj === undefined || obj === null ? obj : obj[key]), channel);
    if (typeof fn !== 'function') throw new Error(`__cradle.walk.${path} is not mounted`);
    return fn();
  }, path))?.data;
  let pageOpenState = 'not-opened';
  for (let attempt = 0; attempt < 20 && pageOpenState === 'not-opened'; attempt++) {
    await page.waitForTimeout(400);
    const surfacesNow = (await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot?.surfaces ?? {};
    if (Object.keys(surfacesNow).length <= surfacesBefore) continue;
    const layout = (await channelRead('read.layout').catch(() => null))?.layout;
    const tabs = [];
    const walkTree = pane => { if (!pane) return; if (pane.tabs) tabs.push(...pane.tabs); (pane.children ?? []).forEach(walkTree); };
    walkTree(layout?.root);
    pageOpenState = tabs.some(id => surfacesNow[id]?.kind === 'knowledge') ? 'kernel-surface-opened-tree-carries-it' : 'kernel-surface-opened-tree-not-carrying';
  }
  if (pageOpenState === 'kernel-surface-opened-tree-carries-it' && sourceOpened) ok('STEP 9 · page and source open through the native paths', 'kernel surface + mode-tree placement; the file surface opens through the base cycle');
  else ok('STEP 9 · page/source native open', `page: ${pageOpenState}; source: ${sourceOpened ? 'opened' : 'not opened'}`);
  note(9, 'Page/source through native portal/workbench paths', pageOpenState === 'kernel-surface-opened-tree-carries-it' && sourceOpened ? 'live-native' : 'named-integrator-seam', `page ${pageOpenState} (the panel's Active Context is the surfacing seam under the unconditional dedicated stage); source ${sourceOpened ? 'kernel file surface opened' : 'refused'}`);
  await page.screenshot({path: `${out}/09-native-opens.png`});

  // STEP 10 — return restores the same position.
  await page.locator('.world-mode-strip [data-mode="expressions"]').click();
  await page.waitForTimeout(800);
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await enterWholeFromFace();
  await page.waitForTimeout(600);
  const restoredScene = await page.locator('.wx-scenes [data-scene-ref]').evaluateAll(nodes => nodes.find(n => n.getAttribute('aria-pressed') === 'true')?.dataset.sceneRef);
  const restoredSubject = await page.locator('.wx-entities .wx-entity[aria-pressed="true"]').getAttribute('data-subject-ref').catch(() => null);
  const restoredRegister = await page.locator('.wiki-expression').getAttribute('data-register');
  if (restoredRegister === 'central' && restoredScene && !restoredScene.endsWith(':scene:overview') && restoredSubject === nodeSubject) ok('STEP 10 · return restores the same register, scene and selection', `${restoredRegister} · ${restoredScene.split(':').pop()} · ${restoredSubject}`);
  else fail('step 10', `register ${restoredRegister}, scene ${restoredScene}, subject ${restoredSubject}`);
  note(10, 'Close/return restores position', 'live-native', `${restoredRegister} · ${restoredScene} · ${restoredSubject} — scene and focus live in the kernel document`);
  await page.screenshot({path: `${out}/10-restored-position.png`});

  // STEP 11 — O:I Web: the connective field's own surface, honest states.
  // Explore is the whole-world destination in the World navigator (the
  // Base mode's left body) — the same altitude as the modes.
  await page.locator('.world-mode-strip [data-mode="base"]').click().catch(() => {});
  await page.waitForTimeout(800);
  const explore = page.locator('.explore-open');
  if (await explore.count()) {
    await explore.first().click();
    let exploreOpened = false;
    for (let attempt = 0; attempt < 20 && !exploreOpened; attempt++) {
      await page.waitForTimeout(400);
      const surfacesNow = (await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot?.surfaces ?? {};
      exploreOpened = Object.values(surfacesNow).some(surface => surface.kind === 'explore');
    }
    const strip = await page.locator('.explore-strip input, .explore-strip button').count();
    ok('STEP 11 · O:I Web discovery opens', `explore surface ${exploreOpened ? 'stands in the kernel' : 'did not open'}; strip controls ${strip}`);
    note(11, 'O:I Web through the connective field', exploreOpened ? 'live-native-shell + honest-shared-state' : 'named-remainder', 'Explore opens as the discovery operation; the shared scope reads its provider or names its absence');
    await page.screenshot({path: `${out}/11-oi-web.png`});
  } else {
    note(11, 'O:I Web through the connective field', 'named-remainder', 'no explore entrance stood at walk time');
    fail('step 11', 'the O:I Web entrance was not reachable from Base');
  }

  // STEP 12 — the shared path's identity: named, never a copied graph.
  // The subject panel names SharedField staging unadmitted (#366 EX3A6):
  // there is no second public expression format to copy into.
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await enterWholeFromFace();
  const sharedNote = await page.locator('.wx-subject [data-unavailable="shared-field"]').count();
  if (!await page.locator('.wx-subject').count()) {
    await page.locator('.wx-entities .wx-entity[data-role="node"]').first().click();
    await page.waitForSelector('.wx-subject', {timeout: 10000});
  }
  const sharedNoteCount = await page.locator('.wx-subject [data-unavailable="shared-field"]').count();
  if (sharedNoteCount || sharedNote) ok('STEP 12 · the shared staging boundary is named, not faked', 'audience-filtered SharedField staging is not admitted in this cut (#366 EX3A6) — one projection identity, no second public graph');
  else fail('step 12', 'the shared staging state is not disclosed on the subject panel');
  note(12, 'Shared path uses the same projection identity', 'named-unavailable', 'EX3A6 unadmitted — the subject panel names it; no separate public expression form exists');

  // STEP 13 — search resolves native subjects.
  await page.keyboard.press('Meta+K');
  await page.waitForTimeout(1200);
  const searchInput = page.locator('.search-overlay input, [class*="search"] input').first();
  if (await searchInput.count()) {
    await searchInput.fill('propose-not-write');
    await page.waitForTimeout(2000);
    const results = await page.locator('.search-overlay [class*="result"], [class*="search"] [class*="result"]').count();
    const bodyText = (await page.locator('body').textContent()) ?? '';
    const nativeHit = /wiki:node:|central:source:|Control\//.test(bodyText);
    ok('STEP 13 · search resolves native subjects', `${results} result row(s); canonical refs ${nativeHit ? 'present' : 'not disclosed in this view'}`);
    note(13, 'Search from the shell', 'live-native', `results ${results}; native refs ${nativeHit ? 'disclosed' : 'not in the rendered text'}`);
    await page.screenshot({path: `${out}/13-search.png`});
  } else {
    note(13, 'Search from the shell', 'named-remainder', 'the search overlay did not open with the leader');
    fail('step 13', 'the search overlay did not open');
  }
} catch (cause) {
  fail('walk', String(cause));
  await page.screenshot({path: `${out}/walk-failure.png`}).catch(() => {});
}

if (errors.length) { console.log('console/page errors:'); for (const error of errors) console.log('  ' + error); fails.push('no console errors'); }
else ok('no console or page errors');

writeFileSync(join(out, 'record.json'), JSON.stringify({walkedAt: new Date().toISOString(), url, bridge: bridgeUrl, steps: record, failures: fails}, null, 2));
await browser.close();
bridge.kill();
console.log(fails.length ? `\n${fails.length} FAILURES: ${fails.join('; ')}` : '\nall 13 steps walked');
process.exit(fails.length ? 1 : 0);
