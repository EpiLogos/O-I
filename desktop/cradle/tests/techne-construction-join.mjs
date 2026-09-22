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
const out = resolve(root, 'tests/artifacts/techne-construction-join');
mkdirSync(out, {recursive: true});
const bins = Object.fromEntries(['OI_BIN', 'OI_AIKIT_BIN', 'OI_CENTRAL_CTRL_BIN', 'WIKI_KERNEL_BIN'].map(key => {assert.ok(process.env[key], `${key} is required`); return [key, resolve(process.env[key])];}));
const ground = realpathSync(mkdtempSync(resolve(tmpdir(), 'techne-join-'))), project = resolve(ground, 'Work/Notes');
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
async function gotoMode(mode) {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/techne-construction-join.html?bridge=${encodeURIComponent(bridgeUrl)}${mode === 'expressions' ? '&mode=expressions' : ''}`);
  await page.locator('.wiki-prose h1').waitFor();
  await page.locator('.pcd-host-frame').waitFor();
  frame = await page.locator('.pcd-host-frame').elementHandle().then(el => el.contentFrame());
  await frame.waitForFunction(() => window.__FIELD_STUDIES__ && window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable());
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

try {
  await startBridge();
  server = await createServer({root, configFile: false, plugins: [react()], resolve: {alias: {three: resolve(root, 'node_modules/three')}}, define: {__CRADLE_WALK__: 'false'}, server: {host: '127.0.0.1', port: 0, fs: {allow: [root, resolve(root, '../../packages/oi-design-system')]}}});
  await server.listen();
  browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl']});
  receipt.browser = browser.version();
  page = await browser.newPage({viewport: {width: 1600, height: 1000}, reducedMotion: 'reduce'});
  page.setDefaultTimeout(30000);
  page.on('pageerror', e => errors.push(String(e)));

  // ——— Positive: material-first construction opens and is worked in the live field ———
  await gotoMode('techne');
  check((await frame.evaluate(() => window.__FIELD_STUDIES__.getState())).hostMode === 'techne', 'The live app boots in the Technē cut beside the connected Wiki');
  check(await frame.evaluate(() => window.__FIELD_STUDIES__.nativeWorking()?.native_ref === undefined), 'No native construction is open in the field before one is summoned');

  await authorConstellation();
  const savedRef = savedFrame('Field-join inquiry').ref;
  const expectedRef = projectedRef(savedRef);
  check(savedFrame('Field-join inquiry').constellations[0].members.length === 2, 'The Wiki authored a native two-member constellation from selected passages');

  await openLiveThenSummon();
  // The summon crossed the iframe seam through the production relay: the live
  // field's OWN open document is now the EXACT constellation Expression, read
  // frame-bound from __FIELD_STUDIES__.nativeWorking(), on its kernel identity.
  await frame.waitForFunction(ref => window.__FIELD_STUDIES__.nativeWorking()?.native_ref === ref, expectedRef);
  check(true, 'summonExpression from the Wiki opens the exact constellation Expression in the live field (open-expression relay), not the cradle composer');
  check(await page.evaluate(() => window.__TECHNE_FIELD_OPEN__.peek()) === null, 'The presented field consumed the summon exactly once — the buffered request was cleared, not left standing for a second surface (no double-open)');
  const opened = await frame.evaluate(() => window.__FIELD_STUDIES__.getDocument());
  check(await frame.locator('canvas').count() > 0, 'The live renderer holds the constellation — one field, not a second renderer');
  const kernelDoc = (await op({op: 'expression', request: {operation: 'inspect', expression_ref: expectedRef}})).data.document;
  check(Object.keys(kernelDoc.entities).length >= 2 && opened.scenes.some(s => s.entities.length >= 2), 'The field opened the constellation with its real members, read from the kernel document');
  await page.screenshot({path: resolve(out, 'constellation-in-field.png')});

  // Work it in the field: a real edit committed to the SAME native Expression
  // through the owner (kernel edit at the opened revision), not a browser save.
  const openedRevision = kernelDoc.revision;
  await frame.evaluate(() => window.__FIELD_STUDIES__.openEditor('scene'));
  await frame.locator('[data-action="studio-section"][data-value="scene"]').click();
  await frame.locator('#inspector-content [data-detail="journey"] summary').click();
  await edit('journey.name', 'Worked in the field');
  if (!await frame.locator('#native-work').isVisible()) await frame.locator('[data-action="native-work"]').first().click();
  await frame.getByRole('button', {name: 'Commit composition', exact: true}).waitFor({state: 'visible'});
  await frame.waitForFunction(() => !document.querySelector('[data-native="commit"]').disabled);
  await frame.getByRole('button', {name: 'Commit composition', exact: true}).click();
  await frame.locator('.native-status').filter({hasText: 'Native working revision'}).waitFor();
  const reread = (await op({op: 'expression', request: {operation: 'inspect', expression_ref: expectedRef}})).data.document;
  check(reread.revision > openedRevision && reread.title === 'Worked in the field', 'An edit made in the field commits to the SAME native constellation Expression through the owner (revision advanced, title changed)');

  // ——— §41 negative: the Expressions cut does not bind the relay ———
  // Remove the load-bearing binding by standing in the lived cut, then summon
  // the very same saved constellation. The field must NOT receive it.
  await gotoMode('expressions');
  check((await frame.evaluate(() => window.__FIELD_STUDIES__.getState())).hostMode === 'expressions', 'The negative control stands the app in the Expressions cut');
  await page.getByRole('button', {name: 'Constellations', exact: true}).click();
  await drawer().getByLabel('Open saved constellation').selectOption(savedRef);
  await openLiveThenSummon();
  // Give the summon a real window to be (wrongly) honoured before asserting absence.
  await page.waitForTimeout(1500);
  check(await frame.evaluate(ref => window.__FIELD_STUDIES__.nativeWorking()?.native_ref !== ref, expectedRef), 'Without the Technē open-expression relay the summon does NOT reach the field — the join is load-bearing, not a shared-kernel coincidence');
  // Sharp production-severing proof: the summon WAS recorded (the composition
  // root ran), yet the Expressions-cut field never consumed it — PointCloudHost's
  // own mode==="techne" gate is exactly what carries the constellation.
  check(await page.evaluate(ref => window.__TECHNE_FIELD_OPEN__.peek() === ref, expectedRef), 'The summon was recorded but the Expressions-cut field left it unconsumed — the field mode gate is the relay, severed here');

  check(errors.length === 0, `No uncaught application errors (${errors.join('; ')})`);
  receipt.passed = true;
  receipt.expression_ref = expectedRef;
  receipt.frame_ref = savedRef;
} catch (error) {
  receipt.failure = String(error);
  receipt.errors = errors;
  if (frame) receipt.field = await frame.evaluate(() => ({native: window.__FIELD_STUDIES__?.nativeWorking?.() ?? null, doc: window.__FIELD_STUDIES__?.getDocument?.()?.id})).catch(() => null);
  if (page) await page.screenshot({path: resolve(out, 'failure.png')}).catch(() => {});
  console.error(JSON.stringify(receipt));
  throw error;
} finally {
  writeFileSync(resolve(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(resolve(out, 'kernel.log'), logs.join(''));
  if (browser) await browser.close();
  if (server) await server.close();
  bridge?.kill('SIGTERM');
}
