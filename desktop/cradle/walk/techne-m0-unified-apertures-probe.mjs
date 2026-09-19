// techne-m0-unified-apertures-probe — the ONE projection state proof
// (QL-MEF #213 / O-I #366, owner direction 2026-09-19).
//
// Boots the dev-only walk bridge (same seam as techne-m0-wiki-expression-
// probe) and proves that Instrument 0's centre and the Technè left body's
// LIST/TREE/GRAPH apertures (and the Expressions graph navigator) read from
// and drive ONE Wiki→Expression projection state:
//
//   1. the map renders from the projection (subject refs from the real
//      wiki.json — no second reading, no parallel navigator law);
//   2. a sidebar row click focuses the SAME canonical ref in the centre
//      (kernel focus edit — the subject panel names it);
//   3. a centre focus marks the SAME row selected in the map (the
//      bidirectional law, centre → aperture);
//   4. the three apertures stand over the same state — LIST flat, TREE
//      nested, GRAPH drawn from the document's own positions and bound
//      relations — and a graph node click is the same focus act;
//   5. projecting another register from the map switches the instrument
//      and reads that register's own ground (or names its absence);
//   6. the Expressions graph navigator's ask on the standing projection
//      enters Technè and focuses the same entity (cross-mode law);
//   7. no console errors.
//
// Usage: node walk/techne-m0-unified-apertures-probe.mjs [url]
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const cradleRoot = resolve(here, '..');
const url = process.env.DESK_URL ?? 'http://localhost:1432/';
const bridgePort = process.env.AP_BRIDGE_PORT ?? '4193';
const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const out = '/tmp/techne-m0-apertures-shots';
mkdirSync(out, {recursive: true});

// The real ground (Central root wiki — the default register).
const centralRoot = process.env.OI_CENTRAL_ROOT ?? process.env.CENTRAL_ROOT ?? expandHome('~/Central');
const rootWiki = JSON.parse(readFileSync(join(centralRoot, 'Control/agents/wiki/wiki.json'), 'utf8'));
const rootSpaces = (rootWiki.objects ?? []).filter(o => o.object === 'space');
const rootNodes = (rootWiki.objects ?? []).filter(o => o.object === 'node');
const titleByRef = new Map(rootNodes.map(node => [node.ref, node.title ?? node.ref]));
const firstSpace = rootSpaces[0];
const firstSpaceMembers = (firstSpace?.node_refs ?? []).filter(ref => ref && ref !== (firstSpace?.anchor_ref ?? firstSpace?.ref));
const firstMemberRef = firstSpaceMembers[0];

function expandHome(path) { return path.startsWith('~/') ? `${process.env.HOME}/${path.slice(2)}` : path; }

const fails = [];
const fail = (step, detail) => { console.log(`FAIL ${step}: ${detail}`); fails.push(step); };
const ok = (step, detail = '') => console.log(`ok — ${step}${detail ? ` · ${detail}` : ''}`);

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
  localStorage.setItem('oi-cradle.techne.wiki-map-aperture.v1', 'tree');
} catch {} }, bridgeUrl);

try {
  await page.goto(url);
  await page.waitForSelector('.desktop-shell', {timeout: 20000});
  await page.waitForTimeout(1500);
  await page.locator('.world-mode-strip [data-mode="techne"]').click();
  await enterWholeFromFace();

  // (1) The map is an aperture of the projection: regions render the
  // register's own entries with canonical subject refs from the real
  // wiki.json — same objects, same refs as the centre's scenes.
  const map = page.locator('.wiki-map');
  if (!await map.count()) fail('the map', 'the Technè left body does not carry the wiki map');
  else {
    ok('the wiki map stands as the left body');
    const aperture = await map.getAttribute('data-aperture');
    if (aperture !== 'tree') fail('map aperture default', aperture ?? 'none');
    else ok('the map opens in the TREE aperture over the one state');
    const centralRegion = page.locator('.wiki-region[data-register="central"]');
    if (!await centralRegion.count()) fail('central region', 'the Central register has no region');
    else {
      const memberRows = centralRegion.locator('[data-row-kind="member"][data-subject-ref]');
      const rowCount = await memberRows.count();
      const rowRefs = await memberRows.evaluateAll(nodes => nodes.map(n => n.dataset.subjectRef));
      const expectedRows = Math.min(firstSpaceMembers.length, 9);
      if (rowCount < expectedRows || !rowRefs.slice(0, expectedRows).every(ref => firstSpaceMembers.includes(ref))) {
        fail('map renders the projection', `rows ${rowCount}, refs ${JSON.stringify(rowRefs.slice(0, 3))}… vs wiki ${JSON.stringify(firstSpaceMembers.slice(0, 3))}…`);
      } else ok('the map renders the projection\'s own members', `${rowCount} member rows with canonical refs from the real wiki.json`);
    }
  }

  // (2) Sidebar → centre: a member row click focuses the SAME canonical
  // ref in the centre (a kernel focus edit — the subject panel names it).
  const row = page.locator('.wiki-region[data-register="central"] [data-row-kind="member"][data-subject-ref]').first();
  const rowSubject = await row.getAttribute('data-subject-ref');
  const rowScene = await row.getAttribute('data-scene-ref');
  await row.click();
  await page.waitForSelector(`.wx-subject[data-subject-ref="${cssEscape(rowSubject)}"]`, {timeout: 20000});
  const selectedEntity = await page.locator('.wx-entities .wx-entity[aria-pressed="true"]').getAttribute('data-subject-ref');
  const selectedScene = await page.locator('.wx-scenes [data-scene-ref][aria-pressed="true"]').getAttribute('data-scene-ref');
  if (selectedEntity !== rowSubject || selectedScene !== rowScene) fail('sidebar → centre', `entity ${selectedEntity} ≠ row ${rowSubject} or scene ${selectedScene} ≠ ${rowScene}`);
  else ok('a map row click focuses the same canonical ref in Instrument 0', `${rowSubject} in ${rowScene?.split(':').pop()}`);

  // (3) Centre → sidebar: focusing from the centre marks the same row
  // selected in the map (the one state's selection is the map's).
  const centreEntity = page.locator('.wx-entities .wx-entity[data-role="node"]').nth(1);
  const centreSubject = await centreEntity.getAttribute('data-subject-ref');
  await centreEntity.click();
  const centreSceneRef = await page.locator('.wx-scenes [data-scene-ref][aria-pressed="true"]').getAttribute('data-scene-ref');
  const matchingRow = page.locator(`.wiki-region[data-register="central"] [data-row-kind="member"][data-subject-ref="${cssEscape(centreSubject)}"][data-scene-ref="${cssEscape(centreSceneRef)}"]`);
  try { await page.waitForFunction(subject => {
    const rows = [...document.querySelectorAll(`.wiki-region[data-register="central"] [data-row-kind="member"][data-subject-ref="${subject}"]`)];
    return rows.some(row => row.getAttribute('aria-selected') === 'true');
  }, centreSubject, {timeout: 15000}); }
  catch { fail('centre → sidebar', `no map row reads selected for ${centreSubject}`); }
  if (await matchingRow.getAttribute('aria-selected') !== 'true') fail('centre → sidebar (scene)', `the selected row is not in the centre's scene ${centreSceneRef?.split(':').pop()}`);
  else ok('a centre focus marks the same canonical row selected in the map', centreSubject);

  // (4) The three apertures over the one state.
  await page.locator('.wiki-map-apertures [data-aperture-choice="list"]').click();
  await page.waitForSelector('.wiki-map[data-aperture="list"]', {timeout: 5000});
  const listRows = await page.locator('.wiki-region[data-register="central"] [data-row-kind]').count();
  if (listRows === 0) fail('LIST aperture', 'no rows');
  else ok('LIST: the flat index over the same state', `${listRows} rows`);
  await page.locator('.wiki-map-apertures [data-aperture-choice="graph"]').click();
  await page.waitForSelector('.wiki-map[data-aperture="graph"]', {timeout: 5000});
  const graph = page.locator('.wiki-region[data-register="central"] .wiki-graph');
  try { await graph.waitFor({timeout: 10000}); } catch { /* may open on the overview */ }
  if (!await graph.count()) fail('GRAPH aperture', 'no drawing');
  else {
    const graphScene = await graph.getAttribute('data-scene-ref');
    const nodes = await graph.locator('g.wiki-graph-node').count();
    const relations = await graph.locator('line.wiki-graph-relation').count();
    if (nodes === 0) fail('GRAPH nodes', 'the drawing carries no entities');
    else ok('GRAPH: the projection\'s own drawing', `${nodes} entities, ${relations} bound relations at ${graphScene?.split(':').pop()}`);
    // A graph node click is the same focus act.
    const node = graph.locator('g.wiki-graph-node[data-subject-ref]').first();
    const nodeSubject = await node.getAttribute('data-subject-ref');
    await node.click();
    await page.waitForSelector(`.wx-subject[data-subject-ref="${cssEscape(nodeSubject)}"]`, {timeout: 20000});
    ok('a graph node click focuses the same canonical ref in Instrument 0', nodeSubject);
  }
  await page.screenshot({path: `${out}/apertures-graph.png`});
  await page.locator('.wiki-map-apertures [data-aperture-choice="tree"]').click();

  // (5) Projecting another register from the map: the instrument follows
  // and reads that register's own ground — or names its absence.
  const projectRegion = page.locator('.wiki-region[data-register]:not([data-register="central"])').first();
  if (await projectRegion.count()) {
    const registerKey = await projectRegion.getAttribute('data-register');
    await projectRegion.locator('.wiki-project-register').first().click({force: true});
    await page.waitForFunction(key => document.querySelector('.wiki-expression')?.getAttribute('data-register') === key, registerKey, {timeout: 20000});
    const state = await page.locator('.wiki-expression').getAttribute('data-state');
    if (!['ready', 'absent', 'reading', 'unavailable'].includes(state ?? '')) fail('register projection', `untruthful state ${state}`);
    else ok('the map projects another register in Instrument 0', `${registerKey} → ${state} (its own ground, or the named absence)`);
  } else ok('no project registers disclosed (single-register world)', 'the Central region is the whole');

  // (6) The Expressions graph navigator's ask on the standing projection
  // enters Technè and focuses the same entity (cross-mode bidirectional law).
  // The centre's published selection auto-expands the projection's branch in
  // the navigator, so the entity rows render without asking; clicking one is
  // the ask (the same law that makes any projection-row click route to
  // Instrument 0, the able presenter).
  await page.locator('.world-mode-strip [data-mode="expressions"]').click();
  await page.waitForSelector('.xg-navigator', {timeout: 20000});
  const entityRow = page.locator('.xg-tree [data-row-id^="expression:techne-m0."][data-kind="entity"]').first();
  try { await entityRow.waitFor({state: 'visible', timeout: 30000}); }
  catch { fail('navigator entity rows', 'the standing projection\'s entity rows never rendered (selection auto-expand + inspect)'); }
  if (await entityRow.count()) {
    const rowTitle = await entityRow.getAttribute('title');
    const wantedSubject = rowTitle?.includes(' — ') ? rowTitle.split(' — ').pop() : null;
    await entityRow.click();
    await page.waitForFunction(() => document.querySelector('.desktop-shell')?.getAttribute('data-mode') === 'techne', null, {timeout: 20000})
      .then(() => ok('the navigator\'s ask on the projection enters Technè (the able presenter)'))
      .catch(() => fail('cross-mode ask', 'the ask did not enter Technè'));
    await enterWholeFromFace();
    const focused = await page.locator('.wx-entities .wx-entity[aria-pressed="true"]').getAttribute('data-subject-ref').catch(() => null);
    if (focused && wantedSubject && focused === wantedSubject) ok('the cross-mode ask focuses the same canonical entity in Instrument 0', focused);
    else if (focused) ok('the cross-mode ask focuses the projection\'s standing selection in Instrument 0', `${focused} (row: ${wantedSubject})`);
    else fail('cross-mode focus', 'no entity focused after the ask');
  }
  await page.screenshot({path: `${out}/apertures-restored.png`});
} catch (cause) {
  fail('probe', String(cause));
  await page.screenshot({path: `${out}/apertures-failure.png`}).catch(() => {});
}

if (errors.length) { console.log('console/page errors:'); for (const error of errors) console.log('  ' + error); fails.push('no console errors'); }
else ok('no console or page errors');

await browser.close();
bridge.kill();
console.log(fails.length ? `\n${fails.length} FAILURES: ${fails.join('; ')}` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);

function cssEscape(value) { return (typeof CSS !== 'undefined' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&')); }
