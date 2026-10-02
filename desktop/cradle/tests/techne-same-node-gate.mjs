/** N+B: the source→construction→live-field join through BOTH production
 * surfaces over ONE real kernel — the Wiki (KnowledgeSurface + #418
 * construction) and the live imported application (PointCloudHost, the Technē
 * mount). A constellation authored in the Wiki projects to a real kernel
 * oi.expression/v1 Expression; `summonExpression` crosses into the field
 * through the production relay; the app opens it in place and works it. No
 * transport fixtures, no mocked summon, no owner machine or model.
 *
 * §41 negative: the same summon in the Expressions cut (where the Technē
 * open-expression relay is not bound) must NOT reach the field — the join is
 * load-bearing, not a coincidence of a shared kernel. */
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bootRaceMode=process.env.TECHNE_BOOT_RECOVERY_RACE??'';
assert.ok(['','1','before-file-ack'].includes(bootRaceMode),'Unknown boot race aperture');
const bootRace=bootRaceMode!=='';const earlyBootRace=bootRaceMode==='before-file-ack';
const out=resolve(root,earlyBootRace?'tests/artifacts/techne-same-node-boot-early-race':bootRace?'tests/artifacts/techne-same-node-boot-race':'tests/artifacts/techne-same-node-gate');
mkdirSync(out, {recursive: true});
const bins = Object.fromEntries(['OI_BIN', 'OI_AIKIT_BIN', 'OI_CENTRAL_CTRL_BIN', 'WIKI_KERNEL_BIN'].map(key => {assert.ok(process.env[key], `${key} is required`); return [key, resolve(process.env[key])];}));
const ground = realpathSync(mkdtempSync(resolve(tmpdir(), 'techne-gate-'))), project = resolve(ground, 'Work/Notes');
mkdirSync(project, {recursive: true});
const env = {PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: resolve(ground, 'isolated-home'), AIKIT_HOME: resolve(ground, 'isolated-aikit'), ...bins, OI_CENTRAL_ROOT: ground, OI_CENTRAL_PROJECT_QUERY: 'Notes'};
mkdirSync(env.HOME, {recursive: true});
const receipt = {scope: 'Temporary native kernel/files, the production Wiki construction and the live PointCloudHost — no models, publication, installed or whole-Technē acceptance', checks: [], passed: false}, logs = [], errors = [];
const check = (truth, label) => {assert.ok(truth, label); receipt.checks.push(label); console.log('PASS', label);};
function action(name, input = {}) {const r = JSON.parse(execFileSync(bins.OI_CENTRAL_CTRL_BIN, ['--json', '--root', ground, 'action', 'run', name, JSON.stringify(input)], {env, encoding: 'utf8', timeout: 30000})); assert.equal(r.ok, true, JSON.stringify(r)); return r.data;}

action('central.init');
action('projectcentral.init', {project: 'Notes', project_id: 'techne-join-walk'});
const sourceText = '# Alpha\n\n🌱 **A first reading.**\n\n> A complementary reading.\n\n[[Beta]]\n';
const sourceMaterial = [['a', 'Alpha', sourceText], ['b', 'Beta', '# Beta\n\n[[Alpha]]\n']].map(([key, title, body]) => ({binding: {source: `source:${key}`, revision: 'r1', title, tags: ['notes'], visibility: 'public', owners: [], media_type: 'text/markdown', locator: {kind: 'path', value: resolve(project, `${key}.md`)}, metadata: {}}, body}));
writeFileSync(resolve(project, 'source-material.json'), JSON.stringify(sourceMaterial));
for (const item of sourceMaterial) writeFileSync(item.binding.locator.value, item.body);
const wikiPath = resolve(project, 'ProjectCentral/agents/wiki/wiki.json');
const installed = resolve(ground, 'Work/O-I/desktop/cradle/expressions-app/dist');
mkdirSync(dirname(installed), {recursive: true});
cpSync(resolve(root, 'expressions-app/dist'), installed, {recursive: true});

let bridge, bridgeUrl, server, browser, page, frame;
async function startBridge() {
  bridge = spawn(bins.WIKI_KERNEL_BIN, ['127.0.0.1:0'], {cwd: project, env, stdio: ['ignore', 'pipe', 'pipe']});
  bridge.stderr.on('data', v => logs.push(v.toString()));
  bridgeUrl = await new Promise((yes, no) => {let text = ''; const timer = setTimeout(() => no(new Error('Kernel did not start')), 30000); bridge.on('error', e => {clearTimeout(timer); no(e);}); bridge.on('exit', code => {clearTimeout(timer); no(new Error(`Kernel exited ${code}: ${logs.slice(-3)}`));}); bridge.stdout.on('data', chunk => {text += chunk; const m = text.match(/listening on (http:\/\/[^ ]+)/); if (m) {clearTimeout(timer); yes(m[1]);}});});
}
async function op(value) {const r = await fetch(`${bridgeUrl}/op`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)}); const data = await r.json(); assert.equal(data.ok, true, JSON.stringify(data)); return data.outcome;}
function savedFrame(title) {return JSON.parse(readFileSync(wikiPath, 'utf8')).objects.find(o => o.object === 'frame' && o['aikit.constellation/v1']?.title === title);}
// The exact projected Expression ref: constructionProjection projects the
// constellation onto surface `constellation:<frame.ref>`, and
// knowledgeExpressionRef is `expression:knowledge-<sha256(surface) first 32 hex>`.
function projectedRef(frameRef) {return `expression:knowledge-${createHash('sha256').update(`constellation:${frameRef}`).digest('hex').slice(0, 32)}`;}
async function frameOf(host) {return page.locator(`[data-host="${host}"] .pcd-host-frame`).elementHandle().then(el => el.contentFrame());}
async function ready(f) {await f.waitForFunction(() => window.__FIELD_STUDIES__ && window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable());}
async function gotoMode(mode, singleRecoveryHost = false) {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/techne-construction-join.html?bridge=${encodeURIComponent(bridgeUrl)}${mode === 'expressions' ? '&mode=expressions' : ''}${singleRecoveryHost ? '&single-recovery-host=1' : ''}`);
  await page.locator('.wiki-prose h1').waitFor();
  await page.locator('[data-host="presented"] .pcd-host-frame').waitFor();
  frame = await frameOf('presented');
  await ready(frame);
}
async function choosePassage(selector) {
  await page.locator(selector).evaluate(element => {const range = document.createRange(); range.selectNodeContents(element); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); element.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));});
  await page.getByRole('button', {name: 'Add to constellation', exact: true}).click();
}
const drawer = () => page.getByRole('complementary', {name: 'Constellation authoring'});
async function edit(bind, value) {const input = frame.locator(`#inspector-content [data-bind="${bind}"]`).first(); await input.fill(String(value)); if (await input.evaluate(el => el.tagName !== 'TEXTAREA')) await input.press('Enter'); else await input.blur();}
const memberCount = () => page.evaluate(() => document.querySelectorAll('.wiki-construction-members li').length);
async function authorConstellation() {
  // The drawer overlays the narrow reader, so a passage is selected with the
  // drawer CLOSED (as the standalone Wiki walk does). Each added member is
  // awaited before the draft is edited further, so the incoming-effect add is
  // never overwritten by a stale-closure draft edit (a real race in this
  // two-surface page).
  await choosePassage('.wiki-prose strong');
  await page.waitForFunction(() => document.querySelectorAll('.wiki-construction-members li').length === 1);
  await drawer().getByLabel('Constellation title').fill('Field-join inquiry');
  await drawer().getByLabel('Constellation inquiry').fill('How do these two readings qualify each other in the field?');
  await page.waitForFunction(() => document.querySelectorAll('[aria-label="Constellation frame"] option[value^="ql:"]').length > 0);
  const form = await drawer().locator('[aria-label="Constellation frame"] option[value^="ql:"]').first().getAttribute('value');
  await drawer().getByLabel('Constellation frame').selectOption(form);
  await drawer().getByLabel('Role for member 1').selectOption({index: 1});
  await drawer().getByRole('button', {name: 'Close constellation authoring'}).click();
  await choosePassage('.wiki-prose blockquote');
  await page.waitForFunction(() => document.querySelectorAll('.wiki-construction-members li').length === 2);
  await drawer().getByLabel('Role for member 2').selectOption({index: 2});
  await drawer().getByRole('button', {name: 'Add connection', exact: true}).click();
  await drawer().getByLabel('Meaning of connection 1').fill('qualifies');
  await drawer().getByRole('button', {name: 'Save constellation', exact: true}).click();
  await drawer().getByText('Saved and found through native Wiki/search.', {exact: true}).waitFor();
}
async function openLiveThenSummon() {
  await drawer().getByRole('button', {name: 'Open live composition', exact: true}).click();
  await drawer().getByText('The live constellation is rendered. Select a body or relation to inspect its native identity.', {exact: true}).waitFor();
  await drawer().getByRole('button', {name: 'Edit glyphs, text, media and motion', exact: true}).click();
}

let releaseBootReply,heldBootReply,heldBootReady,heldBootDelivery,releaseFileReply,heldFileReply,heldFileReady,heldFileDelivery;
const probe = {};
const expressionEdits = [];
try {
  await startBridge();
  server = await createServer({root, configFile: false, plugins: [react()], resolve: {alias: {three: resolve(root, 'node_modules/three')}}, define: {__CRADLE_WALK__: 'false'}, server: {host: '127.0.0.1', port: 0, fs: {allow: [root, resolve(root, '../../packages/oi-design-system')]}}});
  await server.listen();
  browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});
  receipt.browser = browser.version();
  page = await browser.newPage({viewport: {width: 1600, height: 1000}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(60000); // shared development hosts run under heavy load; waits, not assertions
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {if (m.type() === 'error' || m.type() === 'warning') (probe.console ??= []).push(m.text().slice(0, 400));});
  page.on('response', async r => {if (r.request().method() === 'POST' && r.url().endsWith('/op')) {try {const body = r.request().postDataJSON(); const text = JSON.stringify(body); const resp = await r.text(); if (!resp.includes('"ok":true') || text.includes('constellation')) (probe.apply ??= []).push({request: text.slice(0, 600), response: resp.slice(0, 900)});} catch {}}});
  page.on('request', r => {if (r.method() === 'POST' && r.url().endsWith('/op')) {try {const body = r.postDataJSON(); if (body?.op === 'expression' && body.request?.operation === 'edit') {const changes = (body.request.changes ?? []).map(c => c.change); expressionEdits.push({at: Date.now(), changes, focusOnly: changes.every(c => c === 'focus' || c === 'relation_focus')});}} catch {}}});

  await gotoMode('techne');
  check((await frame.evaluate(() => window.__FIELD_STUDIES__.getState())).hostMode === 'techne', 'The live app boots in the Technē cut beside the connected Wiki');
  check(await frame.evaluate(() => window.__FIELD_STUDIES__.nativeWorking()?.native_ref === undefined), 'No native construction is open before one is summoned');
  await authorConstellation();
  const savedRef = savedFrame('Field-join inquiry').ref, expectedRef = projectedRef(savedRef);
  await openLiveThenSummon();
  await frame.waitForFunction(ref => window.__FIELD_STUDIES__.nativeWorking()?.native_ref === ref, expectedRef);
  check(true, 'A Wiki-authored two-member constellation (one source in two roles) is open as the live field');
  const kernelDoc = async () => (await op({op: 'expression', request: {operation: 'inspect', expression_ref: expectedRef}})).data.document;
  const journeyEntity = id => frame.evaluate(id => {const d = window.__FIELD_STUDIES__.getDocument(); for (const s of d.scenes) {const e = s.entities.find(v => v.id === id); if (e) return JSON.parse(JSON.stringify(e));} return null;}, id);
  const state = () => frame.evaluate(() => window.__FIELD_STUDIES__.getState());

  // ——— M1 Canvas on the same native occurrences ———
  await frame.locator('[data-action="lens"][data-lens="canvas"]').first().click();
  await frame.locator('.research-canvas .react-flow__node').nth(1).waitFor();
  const nodeIds = await frame.$$eval('.research-canvas .react-flow__node', els => els.map(e => e.dataset.id));
  const [nodeA, nodeB] = nodeIds;
  const before = await kernelDoc();
  check(nodeIds.every(id => before.entities[id]) && nodeIds.length >= 2, 'Canvas cards are the exact native entity occurrences of the open constellation Expression');
  probe.nodes = await frame.$$eval('.research-canvas .react-flow__node', els => els.map(e => ({id: e.dataset.id, cls: e.className, w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height, radius: getComputedStyle(e).borderRadius})));
  await page.screenshot({path: resolve(out, '01-canvas.png')});

  // Drag trace: a 30-step pointer drag must produce at most one durable native write.
  const box = await frame.locator(`.research-canvas .react-flow__node[data-id="${nodeA}"]`).boundingBox();
  const editsBefore = expressionEdits.length, pointerSteps = 30;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const dragStart = Date.now();
  for (let i = 1; i <= pointerSteps; i++) await page.mouse.move(box.x + box.width / 2 + i * 4, box.y + box.height / 2 + i * 2);
  const durable = () => expressionEdits.slice(editsBefore).filter(e => !e.focusOnly).length;
  const editsDuringDrag = durable();
  await page.mouse.up();
  await frame.waitForFunction(n => document.querySelector('.research-instrument-status')?.textContent !== 'Saving position…', null).catch(() => {});
  await page.waitForTimeout(1500);
  const editsAfterDrag = durable();
  probe.dragFocusWrites = expressionEdits.slice(editsBefore).filter(e => e.focusOnly).length;
  probe.drag = {pointerSteps, editsDuringDrag, editsAfterDrag, ms: Date.now() - dragStart};
  check(editsDuringDrag === 0, `No durable native configuration write while the pointer moves (${pointerSteps} moves, ${editsDuringDrag} writes; selection focus reported separately)`);
  check(editsAfterDrag <= 1, `One completed gesture commits at most once (${editsAfterDrag} native edit(s))`);
  const movedA = (await kernelDoc());
  check(JSON.stringify(movedA.entities[nodeB]) === JSON.stringify(before.entities[nodeB]), 'Moving A leaves B’s native configuration untouched');

  // ——— Edit object: the existing full Studio over the still-active Canvas ———
  await frame.locator(`.research-canvas .react-flow__node[data-id="${nodeA}"]`).click();
  await page.waitForTimeout(300);
  probe.toolsAfterSelect = await frame.$$eval('#instrument-tools button, #instrument-tools select', els => els.map(e => (e.getAttribute('aria-label') || e.textContent.trim()) + (e.offsetParent ? '' : '(hidden)')));
  probe.selectionAfterClick = (await state()).selected;
  probe.selectedClass = await frame.$$eval('.research-canvas .react-flow__node', els => els.map(e => e.dataset.id.slice(-6) + ':' + e.classList.contains('selected')));
  await frame.locator(`.research-canvas .react-flow__node[data-id="${nodeB}"]`).click();
  await page.waitForTimeout(300);
  probe.afterClickB = {sel: (await state()).selected, tools: await frame.$$eval('#instrument-tools button', els => els.map(e => e.getAttribute('aria-label') || e.textContent.trim()).filter(t => /Edit/.test(t)))};
  await frame.locator(`.research-canvas .react-flow__node[data-id="${nodeA}"]`).click();
  await page.waitForTimeout(300);
  await frame.getByRole('button', {name: 'Edit object'}).first().click();
  await frame.locator('#inspector:not([hidden])').waitFor();
  const studio = await frame.evaluate(() => ({classes: document.body.className, display: getComputedStyle(document.getElementById('inspector')).display, entity: document.getElementById('inspector-content').dataset.entityId, research: !!document.querySelector('.research-instrument:not([hidden]) .research-canvas')}));
  const viewA = studio.entity;
  probe.studio = studio;
  check(studio.display !== 'none' && studio.research && studio.classes.includes('research-active') && studio.classes.includes('research-studio'), 'Edit object opens the full Studio while Canvas stays mounted and active');
  const bindsIn = () => frame.$$eval('#inspector-content [data-bind]', els => els.map(e => e.dataset.bind));
  const sections = await frame.$$eval('[data-action="studio-section"]', els => els.map(e => e.dataset.value));
  probe.sections = sections;
  async function reveal(bind) {
    if ((await bindsIn()).includes(bind)) return true;
    for (const section of sections) {await frame.locator(`[data-action="studio-section"][data-value="${section}"]`).first().click(); if ((await bindsIn()).includes(bind)) return true;}
    return false;
  }
  async function openGroup(bind) {await frame.locator(`#inspector-content [data-bind="${bind}"]`).first().evaluate(el => {for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) if (!d.open) d.querySelector(':scope > summary')?.click();});}
  async function setBind(bind, value) {await openGroup(bind); const input = frame.locator(`#inspector-content [data-bind="${bind}"]`).first(); await input.fill(String(value)); await input.press('Enter');}
  const aBefore = await journeyEntity(viewA);
  check(await reveal('entity.force.strength'), 'The selected object’s local force is editable in the Studio');
  await setBind('entity.force.strength', 3.25);
  check(await reveal('entity.tint'), 'The selected object’s material tint is editable in the Studio');
  await openGroup('entity.tint');
  await frame.locator('#inspector-content [data-bind="entity.tint"]').first().evaluate(el => {el.value = '#3366cc'; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true}));});
  let addStep = frame.locator('#inspector [data-action="add-step"]').first();
  if (!await addStep.count()) for (const section of sections) {await frame.locator(`[data-action="studio-section"][data-value="${section}"]`).first().click(); if (await addStep.count()) break;}
  check(await addStep.count() > 0, 'Object states are reachable in the same Studio');
  await addStep.click();
  const glyph = frame.locator('#inspector [data-action="native-glyph"], #inspector [data-action="set-glyph"]').first();
  probe.glyphControl = await glyph.count();
  if (await glyph.count()) {await glyph.evaluate(el => {for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) if (!d.open) d.querySelector(':scope > summary')?.click();}); await glyph.click();}
  const aAfter = await journeyEntity(viewA);
  probe.aEdit = {force: [aBefore.force, aAfter.force], tint: [aBefore.tint, aAfter.tint], steps: [aBefore.sequence.steps.length, aAfter.sequence.steps.length], glyph: [aBefore.sequence.steps.map(s => s.text), aAfter.sequence.steps.map(s => s.text)]};
  check(aAfter.force.strength === 3.25 && aAfter.tint.toLowerCase() === '#3366cc' && aAfter.sequence.steps.length === aBefore.sequence.steps.length + 1, 'Force, material and a new object state are written to the exact occurrence edited');
  check((await state()).selected?.[0] === viewA && await frame.evaluate(() => document.body.classList.contains('research-active')), 'Canvas remained the active instrument throughout the edit');

  // Target negative: begin an edit of A, select B before it commits.
  await reveal('entity.force.strength');
  await openGroup('entity.force.strength');
  const input = frame.locator('#inspector-content [data-bind="entity.force.strength"]').first();
  probe.negSteps = [{at: 'before-fill', a: (await journeyEntity(viewA))?.force.strength, sel: (await state()).selected, doc: await frame.evaluate(() => window.__FIELD_STUDIES__.getDocument().id), edits: expressionEdits.length}];
  await input.fill('4.5');
  probe.negSteps.push({at: 'after-fill', a: (await journeyEntity(viewA))?.force.strength, sel: (await state()).selected});
  // B is selected through Canvas's own source selector (the Studio panel
  // covers part of the field); the focused input blurs exactly as a person's
  // pointer on the Canvas tool would make it.
  // Source focus lives in the Studio's Canvas section; switching to it blurs
  // A's field exactly as leaving the control would.
  await frame.locator('[data-action="studio-section"][data-value="canvas"]').click();
  await frame.getByLabel('Focus disclosed source').selectOption(nodeB);
  await page.waitForTimeout(400);
  probe.negSteps.push({at: 'after-click-B', a: (await journeyEntity(viewA))?.force.strength, sel: (await state()).selected, doc: await frame.evaluate(() => window.__FIELD_STUDIES__.getDocument().id), edits: expressionEdits.slice(-3).map(e => e.changes.slice(0, 4)), studioEntity: await frame.evaluate(() => document.getElementById('inspector-content').dataset.entityId), active: await frame.evaluate(() => document.activeElement?.dataset?.bind ?? document.activeElement?.tagName)});
  const selectedB = (await state()).selected?.[0];
  const aNeg = await journeyEntity(viewA), bNeg = selectedB ? await journeyEntity(selectedB) : null;
  probe.negative = {selectedB, aForce: aNeg.force.strength, bForce: bNeg?.force.strength};
  check(selectedB && selectedB !== viewA, 'Selecting B in Canvas moves the shared selection to B');
  check(bNeg && bNeg.force.strength !== 4.5, 'An edit begun on A never lands on B after the selection changed');
  check([3.25, 4.5].includes(aNeg.force.strength), `A keeps its acknowledged Studio edit across the selection change (force ${aNeg.force.strength})`);

  // Preview the actual expressive result through the existing engine.
  await frame.locator('[data-action="research-preview"]').first().click();
  const preview = await frame.evaluate(() => ({stage: getComputedStyle(document.getElementById('stage')).display, canvasHidden: getComputedStyle(document.querySelector('#research-workspace > .research-instrument')).visibility, active: document.body.classList.contains('research-active')}));
  probe.preview = preview;
  await page.waitForTimeout(800);
  await page.screenshot({path: resolve(out, '02-preview.png')});
  check(preview.stage !== 'none' && preview.canvasHidden === 'hidden' && preview.active, 'Preview shows the live field while Canvas stays the active, mounted instrument');
  await frame.locator('[data-action="research-preview"]').first().click();

  // Native commit, then kernel readback: A changed, B unchanged.
  // Save is the app's own masthead act. Qualify the actual current native
  // work, selected occurrence and held file basis rather than a UI sentence.
  await frame.waitForFunction(() => {const w=window.__FIELD_STUDIES__.nativeWorking();return w&&!w.busy&&!w.pending&&!w.failed&&!document.getElementById('native-save')?.disabled;});
  const saveBefore = await kernelDoc(), revisionBefore = saveBefore.revision;
  const saveBasis = await frame.evaluate(() => {
    const w=window.__FIELD_STUDIES__.nativeWorking(),st=window.__FIELD_STUDIES__.getState(),scene=window.__FIELD_STUDIES__.getDocument().scenes[st.sceneIndex],binding=w.bindings?.[scene?.id];
    const occurrence=binding?.occurrences.find(row=>row.view_entity_id===st.selected[0]);
    return {native_ref:w.native_ref,revision:w.revision,file:w.file??null,scene_id:scene?.id,scene_ref:binding?.scene_ref,entity_ref:occurrence?.entity_ref,selected:[...st.selected]};
  });
  probe.saveBasis=saveBasis;
  check(saveBasis.native_ref===expectedRef&&saveBasis.revision===revisionBefore&&saveBasis.entity_ref&&saveBefore.entities[saveBasis.entity_ref]&&saveBefore.scenes.some(scene=>scene.scene_ref===saveBasis.scene_ref&&scene.entity_refs.includes(saveBasis.entity_ref)), 'Save starts on the exact native Expression revision, Scene and selected occurrence');
  await frame.locator('#native-save').click();
  await frame.waitForFunction(basis => {
    const w=window.__FIELD_STUDIES__.nativeWorking(),st=window.__FIELD_STUDIES__.getState(),scene=window.__FIELD_STUDIES__.getDocument().scenes[st.sceneIndex];
    return w?.native_ref===basis.native_ref&&Number.isSafeInteger(w.revision)&&w.revision>basis.revision&&!w.busy&&!w.pending&&!w.failed&&scene?.id===basis.scene_id&&JSON.stringify(st.selected)===JSON.stringify(basis.selected);
  }, saveBasis, {timeout:60000});
  const saveAcknowledged=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking());
  const committed = await kernelDoc();
  probe.saveAcknowledged={native_ref:saveAcknowledged.native_ref,revision:saveAcknowledged.revision,file:saveAcknowledged.file??null,selection:committed.selection};
  check(committed.expression_ref===expectedRef&&committed.revision===saveAcknowledged.revision&&committed.revision>revisionBefore&&committed.selection.scene_ref===saveBasis.scene_ref&&committed.selection.entity_ref===saveBasis.entity_ref&&JSON.stringify(saveAcknowledged.file??null)===JSON.stringify(saveBasis.file), 'Independent native Inspect confirms the acknowledged revision and exact selected occurrence without replacing the held file basis');
  probe.committed = {a: committed.entities[nodeA], b: committed.entities[nodeB], scenes: committed.scenes.map(sc => ({scene_ref: sc.scene_ref, keys: Object.keys(sc), presentationKeys: Object.keys(sc.presentation ?? {}), aForces: JSON.stringify(sc.presentation ?? {}).match(/"force":\{[^}]*\}/g)?.slice(0, 6), tints: JSON.stringify(sc.presentation ?? {}).match(/"tint":"#[0-9a-f]+"/gi)?.slice(0, 6)}))};
  // Expressive configuration (force, material, object states) is persisted in
  // the Scene's native working presentation; its 'saved' snapshot is the
  // separate Save-scene act and is deliberately not asserted here.
  const workingEntity = (doc, id) => doc.scenes.map(sc => sc.presentation?.scene?.entities?.find(e => e.id === id)).find(Boolean);
  const nativeA = workingEntity(committed, viewA), nativeB = workingEntity(committed, selectedB), nativeBBefore = workingEntity(before, selectedB);
  probe.nativeA = nativeA && {force: nativeA.force, tint: nativeA.tint, steps: nativeA.sequence.steps.map(x => x.text)};
  check(nativeA && nativeA.force.strength === aNeg.force.strength && nativeA.tint.toLowerCase() === '#3366cc' && nativeA.sequence.steps.length === aAfter.sequence.steps.length, 'The native Expression owner holds A’s new force, material and object states');
  check(nativeB && nativeB.force.strength !== 4.5 && (!nativeBBefore || (JSON.stringify(nativeB.force) === JSON.stringify(nativeBBefore.force) && nativeB.tint === nativeBBefore.tint && nativeB.sequence.steps.length === nativeBBefore.sequence.steps.length)), 'B’s native configuration was not rewritten');
  await page.screenshot({path: resolve(out, '03-committed.png')});

  // ——— A deliberate typed knowledge relationship from the Canvas ———
  if (await frame.locator('#inspector:not([hidden])').count()) await frame.locator('#inspector [data-action="close-studio"]').first().click();
  const edgesBefore = await frame.$$eval('.research-canvas .react-flow__edge', els => els.map(e => e.getAttribute('data-id') ?? e.getAttribute('data-testid')));
  await frame.locator(`.research-canvas .react-flow__node[data-id="${nodeA}"] .react-flow__handle`).first().click({force: true});
  await frame.locator(`.research-canvas .react-flow__node[data-id="${nodeB}"] .react-flow__handle`).last().click({force: true});
  await frame.waitForFunction(n => document.querySelectorAll('.research-canvas .react-flow__edge').length > n, edgesBefore.length);
  const edgesAfter = await frame.$$eval('.research-canvas .react-flow__edge', els => els.map(e => e.getAttribute('data-id') ?? e.getAttribute('data-testid')));
  const drawn = edgesAfter.find(id => !edgesBefore.includes(id));
  const presentation = (await kernelDoc()).relations;
  const presentationRef = Object.keys(presentation).find(ref => presentation[ref].native_owner === 'oi');
  probe.presentation = {drawn, presentationRef};
  check(!!presentationRef && presentation[presentationRef].from_entity_ref === nodeA && presentation[presentationRef].to_entity_ref === nodeB, 'A drawn Canvas connection is an O:I presentation connection between the exact occurrences');
  const relationsBefore = JSON.parse(readFileSync(wikiPath, 'utf8')).objects.filter(o => o.object === 'edge');
  // Same-endpoint relations overlap on screen (recorded as a remaining UX
  // gap); select the presentation connection by its own element.
  probe.edgeDom = await frame.$$eval('.research-canvas .react-flow__edge', els => els.map(e => ({id: e.getAttribute('data-id'), testid: e.getAttribute('data-testid'), cls: e.getAttribute('class')})));
  const clicked = await frame.evaluate(ref => {const el = [...document.querySelectorAll('.research-canvas .react-flow__edge')].find(e => (e.getAttribute('data-id') ?? e.getAttribute('data-testid') ?? '').endsWith(ref)); const target = el?.querySelector('.react-flow__edge-interaction') ?? el?.querySelector('path'); if (!target) return false; target.dispatchEvent(new MouseEvent('click', {bubbles: true})); return true;}, presentationRef);
  check(clicked, 'The presentation connection is drawn as its own selectable edge');
  // The connection card follows the selection (no separate inspector toggle).
  await frame.locator('#research-inspector:not([hidden])').waitFor();
  probe.edgeInspector = await frame.evaluate(() => ({text: document.getElementById('research-inspector')?.innerText.slice(0, 400), rel: window.__TMP_REL__?.()}));
  const relationInput = frame.locator('#research-inspector').getByLabel('Relation');
  await relationInput.fill('grounds');
  await frame.getByRole('button', {name: 'Record as constellation relationship'}).click();
  const relateOutcome = await frame.waitForFunction(() => {const st = document.querySelector('.research-instrument-status')?.textContent ?? '', toast = document.getElementById('toast')?.hidden ? '' : (document.getElementById('toast')?.textContent ?? ''); return /Recorded as constellation relationship|Relationship saved|refus|unavailable|Error|No |not /i.test(st + ' ' + toast) ? st + ' | ' + toast : false;}, null, {timeout: 60000}).then(h => h.jsonValue()).catch(async () => 'timeout: ' + await frame.evaluate(() => (document.querySelector('.research-instrument-status')?.textContent ?? '') + ' | ' + (document.getElementById('toast')?.textContent ?? '')));
  probe.relateOutcome = relateOutcome;
  const relationsAfter = JSON.parse(readFileSync(wikiPath, 'utf8')).objects.filter(o => o.object === 'edge');
  const recorded = relationsAfter.filter(o => !relationsBefore.some(b => b.ref === o.ref));
  probe.recorded = recorded;
  check(recorded.length === 1 && recorded[0].relation === 'grounds', 'Record as constellation relationship writes exactly one typed relation to the native constellation register');
  const qualifies = relationsAfter.find(o => o.relation === 'qualifies');
  const endpoints = o => JSON.stringify([o['aikit.constellation-relation/v1']?.from_participation_ref, o['aikit.constellation-relation/v1']?.to_participation_ref]);
  check(!!qualifies && endpoints(qualifies) === endpoints(recorded[0]) && qualifies.ref !== recorded[0].ref, 'Two relationships with the same endpoints keep distinct identities (qualifies, grounds)');
  const fieldAfter = await kernelDoc();
  const fieldRelation = Object.values(fieldAfter.relations).find(r => r.native_owner !== 'oi' && r.relation?.ref === recorded[0].ref);
  probe.fieldRelation = fieldRelation ?? null;
  check(!!fieldRelation, 'The recorded relationship reaches the same live constellation Expression as a source relation');
  check(!!fieldAfter.relations[presentationRef] && fieldAfter.relations[presentationRef].native_owner === 'oi', 'The presentation connection stays presentation; it did not become evidence');
  check(fieldAfter.entities[nodeA]?.subject?.subject_ref === committed.entities[nodeA]?.subject?.subject_ref && JSON.stringify(workingEntity(fieldAfter, viewA)?.force) === JSON.stringify(nativeA.force), 'Re-projection kept A’s occurrence identity and its authored configuration');
  await page.screenshot({path: resolve(out, '04-relation.png')});

  // ——— Native save, restart, reopen ———
  const statusBefore = await frame.locator('#native-status').textContent();
  await frame.locator('#native-save').click();
  await frame.waitForFunction(before => {const t = document.getElementById('native-status')?.textContent ?? ''; return t && t !== before;}, statusBefore, {timeout: 30000}).catch(() => {});
  probe.secondCommit = await frame.locator('#native-status').textContent();
  // Central file save: the Library's file bar opens the app's own modal.
  await frame.evaluate(() => document.querySelector('[data-action="library"]').click());
  await frame.locator('#library-page:not([hidden])').waitFor();
  check(await frame.evaluate(() => document.body.classList.contains('research-active') && getComputedStyle(document.getElementById('instrument-tools-dock')).display === 'none'), 'The open instrument’s tools stand down under the full-page Library — they never cover its return control');
  await frame.locator('#library-page [data-action="native-save-file"]').first().click();
  await frame.locator('#confirm-dialog[open] input[name="folder"]').fill('Work/Notes');
  await frame.locator('#confirm-dialog[open] input[name="name"]').fill('gate.expression.json');
  await frame.locator('#confirm-dialog[open] button[value="save"]').click();
  await frame.waitForFunction(() => /Saved and read back/.test(document.getElementById('native-status')?.textContent ?? '') || /Saved and read back/.test(document.getElementById('toast')?.textContent ?? ''), null, {timeout: 60000});
  await frame.locator('#library-page [data-action="close-library"]').first().click();
  const savedPath = resolve(project, 'gate.expression.json');
  const savedFileBytes=readFileSync(savedPath),savedFile=JSON.parse(savedFileBytes.toString('utf8'));
  const savedFileBasis=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeWorking().file);
  const readSavedBasis=async stage=>{
    assert.ok(savedFileBasis?.location&&savedFileBasis?.revision,'The saved file has an independently acknowledged native CAS basis');
    const physical=readFileSync(savedPath);assert.deepEqual(physical,savedFileBytes,stage+': actual saved file bytes must remain unchanged');
    const request={op:'expression',request:{operation:'inspect_file',location:savedFileBasis.location,expected_file_revision:savedFileBasis.revision}};
    const actual=await op(request);assert.equal(actual.result,'expression');assert.equal(actual.data.state,'ready');
    assert.deepEqual(actual.data.document,savedFile,stage+': native file reader restores the entire original saved document');
    assert.deepEqual(actual.data.file,{location:savedFileBasis.location,revision:savedFileBasis.revision});
    (probe.savedFileReadbacks??=[]).push({stage,request,actual,physical_bytes:physical.length,physical_sha256:createHash('sha256').update(physical).digest('hex')});
    return actual.data.document;
  };
  check(savedFile.expression_ref === expectedRef && !!savedFile.entities[nodeA], 'The native Expression file holds the same Expression and occurrence identities');
  const beforeRestart = await kernelDoc();
  if(bootRace){assert.deepEqual(beforeRestart,savedFile,'The complete live document after saving agrees with the independently retained saved file');writeFileSync(resolve(out,'acknowledged-saved-expression-file.raw.json'),savedFileBytes);await readSavedBasis('acknowledged-before-restart');}
  bridge.kill('SIGTERM');
  await new Promise(r => setTimeout(r, 500));
  await startBridge();
  if (bootRace) {
    let selected = false,fileSelected=false,readyHeld,delivered,refuseHeld,refuseDelivery,readyFile,deliveredFile,refuseFile,refuseFileDelivery;
    heldBootReady = new Promise((resolve,reject) => {readyHeld = resolve;refuseHeld = reject;});
    heldBootDelivery = new Promise((resolve,reject) => {delivered = resolve;refuseDelivery = reject;});
    // A relay/owner refusal must fail this gate, never leave a silent hold.
    void heldBootReady.catch(()=>{});void heldBootDelivery.catch(()=>{});
    const released = new Promise(resolve => {releaseBootReply = resolve;});
    const fileReleased=new Promise(resolve=>{releaseFileReply=resolve;});
    heldFileReady=new Promise((resolve,reject)=>{readyFile=resolve;refuseFile=reject;});
    heldFileDelivery=new Promise((resolve,reject)=>{deliveredFile=resolve;refuseFileDelivery=reject;});
    void heldFileReady.catch(()=>{});void heldFileDelivery.catch(()=>{});
    await page.route('**/op', async route => {
     try{
      const request=route.request(),body=request.method()==='POST'?request.postDataJSON():null;
      if (!selected && body?.op==='expression_recovery' && body.request?.operation==='read' && body.request.kind==='draft' && body.request.scope==='techne' && body.request.id==='source-twelve-faces') {
        selected=true;
        const response=await route.fetch(),raw=await response.body();
        assert.equal(response.status(),200);const actual=JSON.parse(raw.toString('utf8'));
        assert.equal(actual.ok,true);assert.equal(actual.outcome?.result,'expression_recovery');assert.equal(actual.outcome.data.state,'ready');assert.equal(actual.outcome.data.record?.id,'source-twelve-faces');
        const artifact='held-real-boot-recovery-response.raw.json';writeFileSync(resolve(out,artifact),raw);
        heldBootReply={request:body,http_status:response.status(),native_record:actual.outcome.data.record,raw_response:{artifact,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')},scope:'Exactly one real native reply through the ordinary production HTTP relay; only the presented production host is mounted in this restart aperture'};
        readyHeld();await released;await route.fulfill({response,body:raw});heldBootReply.delivered_sha256=createHash('sha256').update(raw).digest('hex');delivered();
      }else if(earlyBootRace&&!fileSelected&&body?.op==='expression'&&body.request?.operation==='open_file'&&body.request.location?.path==='Work/Notes/gate.expression.json'){
        fileSelected=true;assert.deepEqual(body.request.location,savedFileBasis.location);assert.equal(body.request.expected_file_revision,savedFileBasis.revision);
        const response=await route.fetch(),raw=await response.body();assert.equal(response.status(),200);const actual=JSON.parse(raw.toString('utf8'));
        assert.equal(actual.ok,true);assert.equal(actual.outcome?.result,'expression');assert.equal(actual.outcome.data.state,'ready');
        assert.deepEqual(actual.outcome.data.document,savedFile);assert.deepEqual(actual.outcome.data.file,{location:savedFileBasis.location,revision:savedFileBasis.revision});
        const artifact='held-real-file-opening-response.raw.json';writeFileSync(resolve(out,artifact),raw);
        heldFileReply={request:body,http_status:response.status(),raw_response:{artifact,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')}};
        readyFile();await fileReleased;await route.fulfill({response,body:raw});heldFileReply.delivered_sha256=createHash('sha256').update(raw).digest('hex');deliveredFile();
      }else await route.continue();
     }catch(error){refuseHeld(error);refuseDelivery(error);refuseFile(error);refuseFileDelivery(error);await route.abort('failed').catch(()=>{});}
    });
  }
  await gotoMode('techne',bootRace);
  if(bootRace){
    check(await page.locator('[data-host="concealed"]').count()===0,'The controlled held-reply restart has exactly one actual production receiver; original multi-host replay remains separate');
    await Promise.race([heldBootReady,frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady()).then(()=>{throw new Error('Actual boot completed without the exact controlled source-twelve-faces recovery reply to hold.');})]);
  }
  const initialOpening=bootRace?await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState()})):null;
  const opening=frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),'Work/Notes/gate.expression.json');
  if(earlyBootRace){
    await Promise.race([heldFileReady,opening.then(()=>{throw Error('File opening completed without the exact actual native response being held');})]);
    const beforeAcknowledgement=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState()}));
    assert.equal(beforeAcknowledgement.native.native_ref,initialOpening.native.native_ref,'The actual file acknowledgement is still withheld');
    releaseBootReply();await heldBootDelivery;await frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady());
    const afterEarlyBoot=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState()}));
    assert.deepEqual(afterEarlyBoot.document,initialOpening.document,'Explicit file intent fences the real old boot reply before the file acknowledgement');
    assert.equal(afterEarlyBoot.native.native_ref,initialOpening.native.native_ref);assert.equal(afterEarlyBoot.native.failed,false);
    for(const key of ['sceneIndex','selected','camera','sceneElapsed','simTime'])assert.deepEqual(afterEarlyBoot.state[key],initialOpening.state[key],key+': superseded boot cannot restore an old position before file acknowledgement');
    const recoveryEarly=await op(heldBootReply.request);assert.deepEqual(recoveryEarly.data.record,heldBootReply.native_record,'Early boot completion cannot author or overwrite the untouched canvas recovery');
    await readSavedBasis('before-held-file-acknowledgement');
    probe.earlyBoot={initialOpening,beforeAcknowledgement,afterEarlyBoot,recoveryEarly,heldFileReply};
    releaseFileReply();await heldFileDelivery;
  }
  const actualOpen=await opening;
  check(actualOpen===true,'The ordinary file-opening API acknowledges the exact native saved-file adoption');
  await frame.waitForFunction(ref => window.__FIELD_STUDIES__.nativeWorking()?.native_ref === ref, expectedRef, {timeout: 60000});
  const reopened = await kernelDoc();
  if(bootRace){assert.deepEqual(reopened,savedFile,'Reopening must preserve every field of the original independently acknowledged saved native document');await readSavedBasis('after-file-adoption');if(earlyBootRace)assert.equal(heldFileReply.delivered_sha256,heldFileReply.raw_response.sha256);}
  probe.reopen = {a: reopened.entities[nodeA] === undefined ? null : true, relations: Object.keys(reopened.relations).length};
  check(JSON.stringify(workingEntity(reopened, viewA)) === JSON.stringify(workingEntity(beforeRestart, viewA)) && JSON.stringify(workingEntity(reopened, selectedB)) === JSON.stringify(workingEntity(beforeRestart, selectedB)) && reopened.entities[nodeA]?.subject?.subject_ref === 'source:a', 'After restart the reopened Expression carries A’s edits and B unchanged, under the same identities');
  check(!!Object.values(reopened.relations).find(r => r.relation?.ref === recorded[0].ref) && !!reopened.relations[presentationRef], 'After restart both the typed relationship and the presentation connection are present and distinct');
  const reopenedA = await frame.evaluate(id => {for (const s of window.__FIELD_STUDIES__.getDocument().scenes) {const e = s.entities.find(v => v.id === id); if (e) return e;} return null;}, viewA);
  probe.reopenedA = reopenedA && {force: reopenedA.force, tint: reopenedA.tint, steps: reopenedA.sequence.steps.map(s => s.text)};
  check(reopenedA && reopenedA.force.strength !== 0 && reopenedA.tint.toLowerCase() === '#3366cc' && reopenedA.sequence.steps.length >= 2, 'The reopened field renders A with its edited force, material and object states');
  const register = JSON.parse(readFileSync(wikiPath, 'utf8'));
  check(register.objects.some(o => o.ref === recorded[0].ref), 'Independent readback: the native Wiki register (source of truth) still holds the typed relationship after restart');
  if(bootRace){
    const recoveryBeforeDelivery=await op(heldBootReply.request);
    assert.equal(recoveryBeforeDelivery.result,'expression_recovery');assert.equal(recoveryBeforeDelivery.data.state,'ready');
    assert.deepEqual(recoveryBeforeDelivery.data.record,heldBootReply.native_record,'Opening the native file must preserve the complete prior recovery record and revision');
    const before=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState(),timeOrigin:performance.timeOrigin,url:location.href}));
    releaseBootReply();await frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady());await heldBootDelivery;
    const after=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState(),timeOrigin:performance.timeOrigin,url:location.href}));
    const nativeAfter=await kernelDoc(),recoveryAfterDelivery=await op(heldBootReply.request);
    assert.equal(recoveryAfterDelivery.result,'expression_recovery');assert.equal(recoveryAfterDelivery.data.state,'ready');
    assert.deepEqual(recoveryAfterDelivery.data.record,heldBootReply.native_record,'Delivering the late read must preserve its complete durable recovery record and revision');
    assert.deepEqual(after.document,before.document,'A real late boot reply cannot replace any rendered document field');
    assert.deepEqual(nativeAfter,savedFile,'A real boot reply cannot rewrite the independently acknowledged complete saved native document');
    await readSavedBasis('after-boot-and-file-acknowledgements');
    assert.equal(after.native.native_ref,expectedRef);
    for(const key of ['native_ref','revision','file','pending','notes','bindings'])assert.deepEqual(after.native[key],before.native[key],key+': late recovery cannot detach or replace the acknowledged native basis');
    assert.equal(after.native.busy,false);assert.equal(after.native.failed,false);
    assert.equal(after.timeOrigin,before.timeOrigin);assert.equal(after.url,before.url);
    for(const key of ['sceneIndex','selected','camera','sceneElapsed','simTime'])assert.deepEqual(after.state[key],before.state[key],key+': actual late boot response does not replace current position');
    assert.equal(heldBootReply.delivered_sha256,heldBootReply.raw_response.sha256,'The held actual owner bytes were delivered unchanged');
    probe.heldBootReply={...heldBootReply,recoveryBeforeDelivery,recoveryAfterDelivery,before,after};
    check(true,'The selected real boot/file response ordering preserves the full native/rendered document, saved-file bytes/CAS basis, scene, subject and camera');
    await page.unroute('**/op');
  }
  await page.screenshot({path: resolve(out, '05-reopened.png')});

  // ——— Same member through M3′ Journey and an independent Library readback ———
  await frame.locator('[data-action="lens"][data-lens="journey"]').first().click();
  await frame.locator('#timeline-panel:not([hidden])').waitFor();
  const journey = await frame.evaluate(id => {const d = window.__FIELD_STUDIES__.getDocument(), st = window.__FIELD_STUDIES__.getState(); const sc = d.scenes[st.sceneIndex]; const e = sc?.entities.find(v => v.id === id); return {strip: document.querySelectorAll('#timeline-panel .scene-strip [data-action]').length, scene: sc?.name, force: e?.force.strength, tint: e?.tint, steps: e?.sequence.steps.length, doc: d.id};}, viewA);
  probe.journey = journey;
  if(bootRace){
    const current=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState()}));
    assert.deepEqual(current.document,probe.heldBootReply.after.document,'Journey consumes the complete same rendered document after the real late reply');
    assert.deepEqual(await kernelDoc(),savedFile,'Journey consumes the complete original saved native document after the real reply ordering');
    await readSavedBasis('after-Journey');
    for(const key of ['native_ref','revision','file','pending','notes','bindings'])assert.deepEqual(current.native[key],probe.heldBootReply.after.native[key],key+': Journey keeps the acknowledged native basis');
    for(const key of ['sceneIndex','selected','camera','sceneElapsed','simTime'])assert.deepEqual(current.state[key],probe.heldBootReply.after.state[key],key+': Journey keeps the same current position');
    probe.heldBootReply.journey=current;
    check(true,'Journey continues the exact native and rendered document, selected occurrence, attached file and current position after actual late boot delivery');
  }
  check(journey.strip > 0 && journey.force === reopenedA.force.strength && journey.tint === reopenedA.tint && journey.steps === reopenedA.sequence.steps.length, 'M3′ Journey shows the same Scene with the same member, material and object states');
  await frame.evaluate(() => document.querySelector('[data-action="library"]').click());
  await frame.locator('#library-page:not([hidden])').waitFor();
  check(await frame.evaluate(() => getComputedStyle(document.getElementById('lens-chooser')).display === 'none'), 'The Technē instrument chooser does not float over the full-page Library');
  await frame.waitForFunction(title => [...document.querySelectorAll('#library-page .oi-lib-kernel-row, #library-page .oi-lib-native-row')].some(row => row.textContent.includes(title)), reopened.title, {timeout: 60000});
  probe.libraryRows = await frame.$$eval('#library-page .oi-lib-kernel-row, #library-page .oi-lib-native-row', rows => rows.map(r => r.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)));
  check(true, 'Independent readback: the reused Library page lists the reopened native Expression by its title');
  await page.screenshot({path: resolve(out, '06-library.png')});
  await frame.locator('#library-page [data-action="close-library"]').first().click();
  await frame.locator('#library-page').waitFor({state: 'hidden'});
  check(await frame.evaluate(ref => window.__FIELD_STUDIES__.nativeWorking()?.native_ref === ref, expectedRef), 'Closing the Library returns to the same open native work');
  check(errors.length === 0, `No uncaught application errors (${errors.join('; ')})`);
  if(bootRace){
    // A real ordinary Library draft switch must restore its own acknowledged
    // checkpoint AFTER that target document and initial position are installed.
    const target=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking()}));
    const targetRequest={op:'expression_recovery',request:{operation:'read',scope:'techne',kind:'checkpoint',id:target.document.id}};
    const targetCheckpoint=await op(targetRequest);assert.equal(targetCheckpoint.result,'expression_recovery');assert.equal(targetCheckpoint.data.state,'ready');
    assert.equal(targetCheckpoint.data.record?.value?.draft_id,target.document.id);
    assert.deepEqual(targetCheckpoint.data.record.value.view.document,savedFile,'The ordinary target checkpoint is the exact previously acknowledged saved native document');
    assert.deepEqual(targetCheckpoint.data.record.value.file,target.native.file);
    await frame.evaluate(()=>document.querySelector('[data-action="library"]').click());await frame.locator('#library-page:not([hidden])').waitFor();
    await frame.getByRole('button',{name:'New expression',exact:true}).click();
    await frame.waitForFunction(id=>window.__FIELD_STUDIES__.getDocument().id!==id&&window.__FIELD_STUDIES__.nativeWorking()?.native_ref===undefined,target.document.id);
    const departingTarget=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking()}));
    await frame.evaluate(()=>document.querySelector('[data-action="library"]').click());await frame.locator('#library-page:not([hidden])').waitFor();
    const targetCard=frame.locator('#library-page [data-action="load-saved"][data-id='+JSON.stringify(target.document.id)+']');
    assert.equal(await targetCard.count(),1,'The exact target draft has one ordinary Library card');await targetCard.click();
    await frame.waitForFunction(basis=>{const api=window.__FIELD_STUDIES__,w=api.nativeWorking();return api.getDocument().id===basis.id&&w?.native_ref===basis.ref&&w.file?.revision===basis.fileRevision&&!w.busy&&!w.failed&&!w.pending;},{id:target.document.id,ref:expectedRef,fileRevision:savedFileBasis.revision});
    const returnedTarget=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState()}));
    assert.deepEqual(returnedTarget.document,target.document,'Ordinary target draft continuation restores every rendered document field');
    assert.deepEqual(await kernelDoc(),savedFile,'Ordinary target draft continuation restores every saved native document field');
    assert.equal(returnedTarget.native.native_ref,expectedRef);assert.deepEqual(returnedTarget.native.file,target.native.file);
    assert.deepEqual(returnedTarget.native.bindings,targetCheckpoint.data.record.value.view.bindings);
    await readSavedBasis('after-ordinary-target-checkpoint-switch');
    probe.ordinaryTargetSwitch={target,targetRequest,targetCheckpoint,departingTarget,returnedTarget};
    check(true,'An ordinary Library switch installs its target first, then restores the exact target checkpoint/native file/body without a stale version refusal');
    const exited=new Promise(resolve=>bridge.once('exit',resolve));bridge.kill('SIGTERM');await exited;await startBridge();
    const recoveryAfterRestart=await op(heldBootReply.request);
    await readSavedBasis('after-separate-owner-restart');
    assert.equal(recoveryAfterRestart.result,'expression_recovery');assert.equal(recoveryAfterRestart.data.state,'ready');
    assert.deepEqual(recoveryAfterRestart.data.record,heldBootReply.native_record,'A separate restarted native owner must still read the same complete recovery record and revision');
    probe.heldBootReply.recoveryAfterRestart=recoveryAfterRestart;
    check(true,'The untouched original recovery record remains available through the actual native recovery reader after a separate kernel restart');
  }
  receipt.passed = true;
} catch (error) {
  receipt.failure = String(error);
  if (page) receipt.drawer = await page.evaluate(() => document.querySelector('[aria-label="Constellation authoring"]')?.innerText.slice(-1500)).catch(() => null);
  if (page) await page.screenshot({path: resolve(out, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  releaseBootReply?.();releaseFileReply?.();
  receipt.errors = errors; receipt.probe = probe; receipt.boot_reply_race = {requested:bootRace,mode:bootRaceMode,held:heldBootReply??null,held_file:heldFileReply??null,original_uninstrumented_multi_host_replay_required:bootRace}; receipt.expressionEdits = expressionEdits;
  writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(resolve(out, 'kernel.log'), logs.join(''));
  if (browser) await browser.close();
  if (server) await server.close();
  bridge?.kill('SIGTERM');
}
