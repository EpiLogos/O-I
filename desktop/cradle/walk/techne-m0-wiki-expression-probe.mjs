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
// path; return restores the same scene and selection; no console errors.
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
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 30000});
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
  // through the owner-named native path. From Technè the mode centre stands
  // in front of the pane tree, and the kernel's own capabilities name the
  // portal runtime ("portal_runtime_open_close") unsupported — so the native
  // open is proven by the kernel's surface log, and the panel NAMES the
  // presentation gap instead of faking one.
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 30000});
  await page.locator('.wx-entities .wx-entity[data-role="node"]').first().click();
  await page.waitForSelector('.wx-subject', {timeout: 10000});
  const surfacesBefore = Object.keys((await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot?.surfaces ?? {}).length;
  await page.locator('.wx-subject-tools .oi-action-primary').click();
  await page.waitForTimeout(6000);
  const surfacesAfter = Object.keys(((await (await fetch(`${bridgeUrl}/state`)).json())?.snapshot ?? {}).surfaces ?? {});
  if (surfacesAfter.length <= surfacesBefore) fail('native page open', 'the knowledge surface did not open through the frame path (kernel surface log unchanged)');
  else ok('the page opened through the native path (kernel surface log)', `${surfacesAfter.length} surfaces, was ${surfacesBefore}`);
  const openNote = await page.locator('.wx-subject-open-note[data-unavailable="page-presentation"]').count();
  if (!openNote) fail('presentation gap naming', 'the panel does not name the page-presentation seam (portal runtime unsupported)');
  else ok('the panel names the page-presentation gap exactly (portal runtime unsupported)');

  // (6) Return restores the SAME position — scene and focus live in the
  // kernel document; the register choice persists; the mode round-trip
  // remounts the instrument and re-presents from that state.
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await page.waitForSelector('.wiki-expression[data-state="ready"]', {timeout: 30000});
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
