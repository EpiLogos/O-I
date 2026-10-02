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
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, realpathSync, cpSync, lstatSync, renameSync, symlinkSync, unlinkSync} from 'node:fs';
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
const checkpointRefusalMode=process.env.TECHNE_CHECKPOINT_REFUSAL??'';
assert.ok(['','outer-read','inner-open'].includes(checkpointRefusalMode),'Unknown checkpoint refusal aperture');
const checkpointRefusal=checkpointRefusalMode!=='';const innerCheckpointRefusal=checkpointRefusalMode==='inner-open';
assert.ok(!(bootRace&&checkpointRefusal),'Each response ordering is a separate mandatory replay');
if(checkpointRefusalMode==='outer-read')assert.equal(process.platform,'linux','The exact ELOOP refusal aperture is Linux-only; no unsupported-platform pass');
const out=resolve(root,checkpointRefusal?`tests/artifacts/techne-same-node-checkpoint-${checkpointRefusalMode}`:earlyBootRace?'tests/artifacts/techne-same-node-boot-early-race':bootRace?'tests/artifacts/techne-same-node-boot-race':'tests/artifacts/techne-same-node-gate');
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
async function startBridge(address = '127.0.0.1:0') {
  bridge = spawn(bins.WIKI_KERNEL_BIN, [address], {cwd: project, env, stdio: ['ignore', 'pipe', 'pipe']});
  bridge.stderr.on('data', v => logs.push(v.toString()));
  bridgeUrl = await new Promise((yes, no) => {let text = ''; const timer = setTimeout(() => no(new Error('Kernel did not start')), 30000); bridge.on('error', e => {clearTimeout(timer); no(e);}); bridge.on('exit', code => {clearTimeout(timer); no(new Error(`Kernel exited ${code}: ${logs.slice(-3)}`));}); bridge.stdout.on('data', chunk => {text += chunk; const m = text.match(/listening on (http:\/\/[^ ]+)/); if (m) {clearTimeout(timer); yes(m[1]);}});});
}
async function restartBridge(stage) {
  const previousUrl=bridgeUrl,previousPid=bridge.pid;
  const priorResponse=await fetch(`${bridgeUrl}/event-replay?cursor=1&limit=1`);
  assert.equal(priorResponse.status,200);const priorPage=await priorResponse.json();
  assert.equal(priorPage.schema,'oi.kernel-event-replay/v1');assert.match(priorPage.generation,/^[A-Za-z0-9-]{1,128}$/);
  await new Promise((yes,no)=>{
    const timer=setTimeout(()=>no(new Error('The owned native bridge did not exit before restart')),30000);
    bridge.once('exit',()=>{clearTimeout(timer);yes();});bridge.once('error',error=>{clearTimeout(timer);no(error);});
    if(!bridge.kill('SIGTERM')){clearTimeout(timer);no(new Error('The owned native bridge refused SIGTERM'));}
  });
  // Browser continuation is origin-bound. Reopen the actual owner on its
  // prior listening address; never copy/fabricate last-work or session keys.
  await startBridge(new URL(previousUrl).host);
  assert.equal(bridgeUrl,previousUrl);assert.notEqual(bridge.pid,previousPid);
  const nextResponse=await fetch(`${bridgeUrl}/event-replay?cursor=1&limit=1`);
  assert.equal(nextResponse.status,200);const nextPage=await nextResponse.json();
  assert.equal(nextPage.schema,'oi.kernel-event-replay/v1');assert.match(nextPage.generation,/^[A-Za-z0-9-]{1,128}$/);
  assert.notEqual(nextPage.generation,priorPage.generation);
  (probe.nativeRestarts??=[]).push({stage,previous_pid:previousPid,current_pid:bridge.pid,previous_url:previousUrl,current_url:bridgeUrl,prior_native_page:priorPage,current_native_page:nextPage});
}
async function acknowledgedCurrentDraft(stage,request) {
  // File adoption and an ordinary Library switch legitimately schedule an
  // acknowledged backup. Qualify that complete CURRENT basis before testing
  // a later read/restart; a dated pre-adoption CAS is historical evidence.
  await frame.waitForFunction(()=>document.getElementById('save-status')?.textContent==='Working copy backed up on this device',null,{timeout:60000});
  const document=await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument());
  assert.equal(request.request.kind,'draft');assert.equal(request.request.id,document.id);
  const actual=await op(request);assert.equal(actual.result,'expression_recovery');assert.equal(actual.data.state,'ready');
  assert.deepEqual(actual.data.record.value,document,'The independently acknowledged recovery value is the complete current rendered draft');
  (probe.acknowledgedRecoveryBases??=[]).push({stage,request,actual,document});
  return actual;
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
let releaseRefusalReply,releaseNewReply,heldRefusalReady,heldRefusalDelivery,heldNewReady,heldNewDelivery,refusalBasis,heldRefusal,heldNew;
let restoreCheckpointMember;
let bootTarget;
const probe = {};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const snapshot=f=>f.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState(),status:document.getElementById('native-status')?.textContent,timeOrigin:performance.timeOrigin,url:location.href}));
function privateCheckpointFixture(id){
 const recoveryRoot=resolve(env.HOME,'.oi/desktop/expression-recovery');
 assert.equal(realpathSync(recoveryRoot),recoveryRoot);assert.ok(recoveryRoot.startsWith(ground+'/'));
 const scope=resolve(recoveryRoot,'techne');assert.equal(realpathSync(scope),scope);
 const member=resolve(scope,digest(Buffer.from('Checkpoint:'+id))+'.json');
 const retained=resolve(recoveryRoot,'controlled-held-checkpoint-original.json');
 const meta=lstatSync(member);assert.ok(meta.isFile()&&!meta.isSymbolicLink()&&meta.nlink===1);assert.ok(meta.size<=8*1024*1024+2048);
 assert.throws(()=>lstatSync(retained),{code:'ENOENT'});
 const bytes=readFileSync(member);writeFileSync(resolve(out,'checkpoint-before.raw.json'),bytes);
 renameSync(member,retained);let restored=false;
 const restore=()=>{if(restored)return;assert.ok(lstatSync(member).isSymbolicLink());unlinkSync(member);renameSync(retained,member);restored=true;const after=lstatSync(member);assert.ok(after.isFile()&&!after.isSymbolicLink()&&after.nlink===1);assert.deepEqual(readFileSync(member),bytes);};
 try{symlinkSync(retained,member);}catch(error){renameSync(retained,member);throw error;}
 restoreCheckpointMember=restore;
 return {member,retained,bytes:bytes.length,sha256:digest(bytes),restore};
}
async function fillNativeBudget(){
 const listed=await op({op:'expression',request:{operation:'list'}});assert.equal(listed.data.schema,'oi.expression-list/v1');assert.deepEqual(listed.data.expressions,[]);
 const fixtures=[];
 for(let i=0;i<64;i++){
  const request={op:'expression',request:{operation:'create',expression_ref:`expression:controlled-checkpoint-budget-${i}`,title:`Controlled checkpoint budget fixture ${i}`,actor:'human:test-checkpoint-refusal'}};
  const result=await op(request);assert.equal(result.data.state,'ready');assert.equal(result.data.document.expression_ref,request.request.expression_ref);fixtures.push({request,result});
 }
 const document=fixtures[63].result.data.document,name='controlled-budget-slot.expression.json',path=resolve(project,name);
 const bytes=Buffer.from(JSON.stringify(document));assert.ok(bytes.length<16384);writeFileSync(path,bytes);
 const directory=action('central.files.list',{path:'Work/Notes'});assert.equal(directory.schema,'central.directory-reading/v1');assert.equal(directory.automatic_agent_or_model_invocation,false);
 const entries=directory.entries.filter(row=>row.name===name);assert.equal(entries.length,1);assert.equal(entries[0].kind,'file');assert.equal(entries[0].retrieval_allowed,true);
 const reading=action('central.files.read',{location:entries[0].location});assert.equal(reading.schema,'central.file-reading/v1');assert.equal(reading.automatic_agent_or_model_invocation,false);assert.deepEqual(reading.location,entries[0].location);assert.equal(reading.content_encoding,'utf-8');assert.deepEqual(Buffer.from(reading.content),bytes);
 const saveRequest={op:'expression',request:{operation:'open_file',location:reading.location,expected_file_revision:reading.revision,actor:'human:test-checkpoint-refusal'}};
 const saved=await op(saveRequest);assert.equal(saved.data.state,'ready');assert.equal(saved.data.dirty,false);assert.deepEqual(saved.data.document,document);
 const full=await op({op:'expression',request:{operation:'list'}});assert.equal(full.data.expressions.length,64);assert.ok(!full.data.expressions.some(row=>row.expression_ref===refusalBasis.savedFile.expression_ref));
 probe.controlledNativeBudget={fixtures,saveRequest,saved,full,scope:'64 actual tiny native documents in this isolated kernel; only one is saved for a non-destructive close. All are discarded with the isolated process, never private owner data.'};
 return document.expression_ref;
}
async function installCheckpointRefusal(){
 let selected=false,newSelected=false,readyRefusal,deliveredRefusal,refuseRefusal,refuseDelivery,readyNew,deliveredNew,refuseNew,refuseNewDelivery;
 heldRefusalReady=new Promise((yes,no)=>{readyRefusal=yes;refuseRefusal=no;});heldRefusalDelivery=new Promise((yes,no)=>{deliveredRefusal=yes;refuseDelivery=no;});
 heldNewReady=new Promise((yes,no)=>{readyNew=yes;refuseNew=no;});heldNewDelivery=new Promise((yes,no)=>{deliveredNew=yes;refuseNewDelivery=no;});
 for(const p of [heldRefusalReady,heldRefusalDelivery,heldNewReady,heldNewDelivery])void p.catch(()=>{});
 const released=new Promise(yes=>{releaseRefusalReply=yes;}),newReleased=new Promise(yes=>{releaseNewReply=yes;});
 await page.route('**/op',async route=>{
  try{
   const body=route.request().method()==='POST'?route.request().postDataJSON():null;
   const exactOpen=body?.op==='expression'&&body.request?.operation==='open'&&body.request.actor==='oi:working-draft-recovery'&&body.request.document?.expression_ref===refusalBasis.savedFile.expression_ref;
   const exactRead=body?.op==='expression_recovery'&&body.request?.operation==='read'&&body.request.kind==='checkpoint'&&body.request.scope==='techne'&&body.request.id===refusalBasis.target.document.id;
   if(!selected&&(innerCheckpointRefusal?exactOpen:exactRead)){
    selected=true;if(exactOpen)assert.deepEqual(body.request.document,refusalBasis.savedFile);
    const fixture=innerCheckpointRefusal?null:privateCheckpointFixture(body.request.id);
    let response,raw;
    try{response=await route.fetch();raw=await response.body();}finally{fixture?.restore();}
    assert.equal(response.status(),200);assert.ok(raw.length>0&&raw.length<=16384);const actual=JSON.parse(raw.toString('utf8'));assert.equal(actual.ok,false);assert.ok(typeof actual.error==='string'&&actual.error.length>0);
    if(innerCheckpointRefusal)assert.equal(actual.error,'Open Expression budget exceeded');
    else assert.equal(actual.error,'Too many levels of symbolic links (os error 40)','The actual Linux owner refusal must be ELOOP, not an unrelated parse/lock/permission error');
    const artifact='held-real-checkpoint-refusal.raw.json';writeFileSync(resolve(out,artifact),raw);
    heldRefusal={request:body,http_status:response.status(),actual,raw_response:{artifact,bytes:raw.length,sha256:digest(raw)},fixture:fixture?{member:fixture.member,retained:fixture.retained,bytes:fixture.bytes,sha256:fixture.sha256,restored_before_new_open:true}:null};
    readyRefusal();await released;await route.fulfill({response,body:raw});heldRefusal.delivered_sha256=digest(raw);deliveredRefusal();
   }else if(innerCheckpointRefusal&&selected&&!newSelected&&exactOpen){
    newSelected=true;assert.deepEqual(body.request.document,refusalBasis.savedFile);
    const response=await route.fetch(),raw=await response.body();assert.equal(response.status(),200);assert.ok(raw.length<=4*1024*1024+65536);const actual=JSON.parse(raw.toString('utf8'));assert.equal(actual.ok,true);assert.equal(actual.outcome?.result,'expression');assert.equal(actual.outcome.data.state,'ready');assert.deepEqual(actual.outcome.data.document,refusalBasis.savedFile);
    const artifact='held-real-successor-open.raw.json';writeFileSync(resolve(out,artifact),raw);heldNew={request:body,http_status:response.status(),raw_response:{artifact,bytes:raw.length,sha256:digest(raw)}};
    readyNew();await newReleased;await route.fulfill({response,body:raw});heldNew.delivered_sha256=digest(raw);deliveredNew();
   }else await route.continue();
  }catch(error){for(const refuse of [refuseRefusal,refuseDelivery,refuseNew,refuseNewDelivery])refuse(error);await route.abort('failed').catch(()=>{});}
 });
}
async function fStatusReports(){return frame.evaluate(()=>{const witness=window.__CHECKPOINT_STATUS_WITNESS__;if(!witness)throw Error('Actual status observer is missing');witness.observer.disconnect();return witness.retained;});}
async function finishCheckpointRefusal(expectedRef,kernelDoc,readSavedBasis){
 if(!checkpointRefusal)return;
 await heldRefusalDelivery;await frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady());
 assert.equal(heldRefusal.delivered_sha256,heldRefusal.raw_response.sha256);
  const after=await snapshot(frame);assert.equal(after.native.failed,false);assert.equal(after.native.busy,false);assert.equal(after.native.native_ref,expectedRef);
 assert.deepEqual(after.document,probe.checkpointRefusal.beforeDelivery.document,'The old real refusal cannot replace any current rendered document field');
 for(const key of ['native_ref','revision','file','pending','notes','bindings'])assert.deepEqual(after.native[key],probe.checkpointRefusal.beforeDelivery.native[key],key+': real old refusal cannot detach the current acknowledged basis');
 assert.equal(after.status,probe.checkpointRefusal.beforeDelivery.status,'A stale native error cannot replace current opening status');
 for(const key of ['sceneIndex','selected','camera','sceneElapsed','simTime'])assert.deepEqual(after.state[key],probe.checkpointRefusal.beforeDelivery.state[key],key+': stale refusal keeps current position');
 assert.equal(after.timeOrigin,probe.checkpointRefusal.beforeDelivery.timeOrigin);assert.equal(after.url,probe.checkpointRefusal.beforeDelivery.url);
 const reports=await fStatusReports();assert.equal(reports.overflow,false);assert.ok(reports.records.length>0,'Observe actual production status mutations, not an empty witness');
 assert.ok(!reports.records.some(row=>row.failed||row.text.some(text=>text.includes(heldRefusal.actual.error))),'Even a transient old run/changed failure report or toast is forbidden after the newer intent');
 probe.checkpointRefusal.statusReports=reports;
 assert.deepEqual(await kernelDoc(),refusalBasis.savedFile);await readSavedBasis('after-real-stale-checkpoint-refusal');
 probe.checkpointRefusal.after=after;probe.checkpointRefusal.heldRefusal=heldRefusal;probe.checkpointRefusal.heldNew=heldNew??null;
 check(true,'The actual old checkpoint refusal preserves the newer acknowledged native/rendered world, complete saved file, current status and position');
 await page.unroute('**/op');
}
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
  if(bootRace||checkpointRefusal){assert.deepEqual(beforeRestart,savedFile,'The complete live document after saving agrees with the independently retained saved file');writeFileSync(resolve(out,'acknowledged-saved-expression-file.raw.json'),savedFileBytes);await readSavedBasis('acknowledged-before-restart');}
  if(checkpointRefusal){
    const target=await snapshot(frame);await frame.waitForFunction(id=>localStorage.getItem('oi.field-studies.last')===id,target.document.id);
    const request={op:'expression_recovery',request:{operation:'read',scope:'techne',kind:'checkpoint',id:target.document.id}},checkpoint=await op(request);
    assert.equal(checkpoint.result,'expression_recovery');assert.equal(checkpoint.data.state,'ready');assert.equal(checkpoint.data.record.id,target.document.id);
    assert.deepEqual(checkpoint.data.record.value.view.document,savedFile);assert.deepEqual(checkpoint.data.record.value.file,target.native.file);
    const draftRequest={op:'expression_recovery',request:{operation:'read',scope:'techne',kind:'draft',id:target.document.id}},draft=await op(draftRequest);
    assert.equal(draft.data.state,'ready');assert.deepEqual(draft.data.record.value,target.document,'The actual last marker, persisted Journey and checkpoint agree before the refusal aperture');
    refusalBasis={target,request,checkpoint,draftRequest,draft,savedFile};writeFileSync(resolve(out,'acknowledged-refusal-basis.json'),JSON.stringify(refusalBasis,null,2)+'\n');
  }
  // The presented real host, not the concealed warm source, owns restart.
  const presented=await snapshot(frame);
  await frame.waitForFunction(id=>localStorage.getItem('oi.field-studies.last')===id,presented.document.id);
  const sessionBefore=await frame.evaluate(()=>({last:localStorage.getItem('oi.field-studies.last'),session:JSON.parse(localStorage.getItem('oi.expression-session.v1')??'null'),presence:window.__FIELD_STUDIES__.sessionPresence()}));
  assert.equal(sessionBefore.last,presented.document.id);assert.equal(sessionBefore.session.journeyId,presented.document.id);assert.equal(sessionBefore.presence.visible,true);
  assert.equal(await page.locator('[data-host="concealed"] .pcd-host-frame').count(),1,'The original production opening must retain its actual concealed peer');
  const concealed=await frameOf('concealed');await ready(concealed);assert.notEqual(concealed,frame);
  {
    const start=await concealed.evaluate(()=>window.__FIELD_STUDIES__.sessionPresence());assert.equal(start.visible,false);
    // A display:none iframe can pause animation frames. Poll this real interval counter with a timer.
    await concealed.waitForFunction(n=>window.__FIELD_STUDIES__.sessionPresence().intervalSuppressed>=n+2,start.intervalSuppressed,{polling:100,timeout:60000});
    const after=await frame.evaluate(()=>({last:localStorage.getItem('oi.field-studies.last'),session:JSON.parse(localStorage.getItem('oi.expression-session.v1')??'null')}));
    assert.equal(after.last,presented.document.id);assert.equal(after.session.journeyId,presented.document.id);
    probe.presentedContinuation={presented,sessionBefore,after,concealedPresence:await concealed.evaluate(()=>window.__FIELD_STUDIES__.sessionPresence()),scope:'Actual two suppressed hidden-host autosave cycles; no timer or synthetic visibility substitutes the native host observer'};
  }
  bootTarget=presented.document.id;
  await restartBridge('original-same-origin-cold-opening');
  if(checkpointRefusal){
    if(innerCheckpointRefusal)probe.closableBudgetRef=await fillNativeBudget();
    await installCheckpointRefusal();
  }
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
      if (!selected && body?.op==='expression_recovery' && body.request?.operation==='read' && body.request.kind==='draft' && body.request.scope==='techne' && body.request.id===bootTarget) {
        selected=true;
        const response=await route.fetch(),raw=await response.body();
        assert.equal(response.status(),200);const actual=JSON.parse(raw.toString('utf8'));
        assert.equal(actual.ok,true);assert.equal(actual.outcome?.result,'expression_recovery');assert.equal(actual.outcome.data.state,'ready');assert.equal(actual.outcome.data.record?.id,bootTarget);
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
  await gotoMode('techne',bootRace||checkpointRefusal);
  const continued=await frame.evaluate(()=>({origin:location.origin,last:localStorage.getItem('oi.field-studies.last'),session:JSON.parse(localStorage.getItem('oi.expression-session.v1')??'null')}));
  assert.equal(continued.origin,new URL(presented.url).origin);assert.equal(continued.last,sessionBefore.last);assert.deepEqual(continued.session,sessionBefore.session);
  probe.sameOriginContinuation=continued;
  if(bootRace){
    check(await page.locator('[data-host="concealed"]').count()===0,'The controlled held-reply restart has exactly one actual production receiver; original multi-host replay remains separate');
    await Promise.race([heldBootReady,frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady()).then(()=>{throw new Error('Actual boot completed without the exact acknowledged presented-work recovery reply to hold.');})]);
  }
  const initialOpening=bootRace?await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState()})):null;
  let opening;
  if(checkpointRefusal){
    check(await page.locator('[data-host="concealed"]').count()===0,'The refusal aperture has one actual production receiver; the original multi-host replay remains separate');
    await Promise.race([heldRefusalReady,frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady()).then(()=>{throw new Error('Boot completed without the exact real checkpoint refusal being held');})]);
    const initial=await snapshot(frame);assert.equal(initial.native.native_ref,undefined);assert.equal(initial.native.failed,false);
    // Passive DOM witness includes removed/added text nodes, so a stale toast
    // reset by the next run cannot escape a final-state-only assertion.
    await frame.evaluate(()=>{const retained={records:[],overflow:false,bytes:0},targets=[document.getElementById('native-status'),document.getElementById('toast')];if(targets.some(node=>!node))throw Error('Actual status surfaces are unavailable');const observer=new MutationObserver(changes=>{for(const change of changes){if(retained.records.length>=256){retained.overflow=true;return;}const text=[change.oldValue??'',...Array.from(change.addedNodes,node=>node.textContent??''),...Array.from(change.removedNodes,node=>node.textContent??'')];if(text.some(value=>value.length>16384)){retained.overflow=true;return;}const native=window.__FIELD_STUDIES__.nativeWorking();const row={target:change.target.nodeType===1?change.target.id:change.target.parentElement?.id,type:change.type,attribute:change.attributeName,text,failed:native.failed,busy:native.busy,notice:native.notice};const bytes=new TextEncoder().encode(JSON.stringify(row)).length;if(bytes>65536||retained.bytes+bytes>256*1024){retained.overflow=true;return;}retained.bytes+=bytes;retained.records.push(row);}});for(const node of targets)observer.observe(node,{subtree:true,childList:true,characterData:true,characterDataOldValue:true,attributes:true,attributeFilter:['class','hidden'],attributeOldValue:true});window.__CHECKPOINT_STATUS_WITNESS__={retained,observer};});
    if(innerCheckpointRefusal){
      assert.equal(initial.native.busy,true,'The actual checkpoint reopen is still busy while its native refusal is withheld');
      const request={op:'expression',request:{operation:'close',expression_ref:probe.closableBudgetRef,actor:'human:test-checkpoint-refusal'}},closed=await op(request);assert.equal(closed.data.state,'closed');
      const listed=await op({op:'expression',request:{operation:'list'}});assert.equal(listed.data.expressions.length,63);assert.ok(!listed.data.expressions.some(row=>row.expression_ref===expectedRef));
      // Observe the ordinary parent host-command after the application's own
      // listener has synchronously invoked follow(). No synthetic owner data.
      await frame.evaluate(ref=>{window.__CHECKPOINT_FOLLOW_OBSERVATION__=null;window.addEventListener('message',function observed(event){const d=event.data;if(event.source!==window.parent||d?.v!==1||d.kind!=='host-command'||d.command!=='open-expression'||d.ref!==ref)return;window.removeEventListener('message',observed);window.__CHECKPOINT_FOLLOW_OBSERVATION__={command:JSON.parse(JSON.stringify(d)),native:window.__FIELD_STUDIES__.nativeWorking(),document:window.__FIELD_STUDIES__.getDocument(),channelAvailable:window.__OI_KERNEL_EXPRESSIONS__.kernelExpressionsAvailable()};});},expectedRef);
      await page.evaluate(ref=>window.dispatchEvent(new CustomEvent('oi:expression-compose',{detail:{expressionRef:ref}})),expectedRef);
      await frame.waitForFunction(()=>window.__CHECKPOINT_FOLLOW_OBSERVATION__!==null);
      const observation=await frame.evaluate(()=>window.__CHECKPOINT_FOLLOW_OBSERVATION__);assert.equal(observation.command.ref,expectedRef);assert.equal(observation.channelAvailable,true);assert.equal(observation.native.busy,true);assert.equal(observation.native.failed,false);assert.deepEqual(observation.document,initial.document);
      releaseRefusalReply();await heldRefusalDelivery;
      await Promise.race([heldNewReady,frame.waitForFunction(ref=>window.__FIELD_STUDIES__.nativeWorking()?.native_ref===ref,expectedRef).then(()=>{throw new Error('Follow adopted without the exact real successor owner response being held');})]);
      const beforeAcknowledgement=await snapshot(frame);assert.equal(beforeAcknowledgement.native.failed,false);assert.equal(beforeAcknowledgement.native.busy,true);assert.equal(beforeAcknowledgement.native.native_ref,undefined);assert.deepEqual(beforeAcknowledgement.document,initial.document);
      assert.ok(!beforeAcknowledgement.status?.includes(heldRefusal.actual.error),'The old inner run refusal is fenced before the newer acknowledgement');
      probe.checkpointRefusal={mode:checkpointRefusalMode,initial,closed:{request,closed,listed},observation,beforeAcknowledgement,ordering:'actual old refusal held → actual newer host command and synchronous follow intent → old refusal delivered → actual new native reply held → new reply delivered. Busy serialisation forbids claiming newer ACK preceded the old refusal.'};
      releaseNewReply();await heldNewDelivery;
      await frame.waitForFunction(ref=>{const w=window.__FIELD_STUDIES__.nativeWorking();return w?.native_ref===ref&&!w.busy&&!w.failed;},expectedRef);
      const followAcknowledged=await snapshot(frame);assert.deepEqual(followAcknowledged.document,refusalBasis.target.document);assert.deepEqual(followAcknowledged.native.file,refusalBasis.target.native.file);assert.deepEqual(followAcknowledged.native.bindings,refusalBasis.checkpoint.data.record.value.view.bindings);assert.deepEqual(await kernelDoc(),savedFile);await readSavedBasis('actual-follow-ack-after-old-inner-refusal');probe.checkpointRefusal.followAcknowledged=followAcknowledged;
      // Keep the original gate's actual file-opening acknowledgement too;
      // an observed follow is never fabricated as this API's boolean result.
      opening=frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),'Work/Notes/gate.expression.json');
    }else{
      assert.equal(initial.native.busy,false,'Outer checkpoint read is pending before the busy owner operation');
      const restoredCheckpoint=await op(refusalBasis.request);assert.equal(restoredCheckpoint.result,'expression_recovery');assert.equal(restoredCheckpoint.data.state,'ready');assert.deepEqual(restoredCheckpoint.data.record,refusalBasis.checkpoint.data.record);
      const restoredBytes=readFileSync(heldRefusal.fixture.member),restoredMember=lstatSync(heldRefusal.fixture.member);assert.ok(restoredMember.isFile()&&!restoredMember.isSymbolicLink()&&restoredMember.nlink===1);assert.equal(digest(restoredBytes),heldRefusal.fixture.sha256);assert.equal(restoredBytes.length,heldRefusal.fixture.bytes);
      opening=frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),'Work/Notes/gate.expression.json');
      const acknowledged=await opening;assert.equal(acknowledged,true);await frame.waitForFunction(ref=>{const w=window.__FIELD_STUDIES__.nativeWorking();return w?.native_ref===ref&&!w.busy;},expectedRef);
      const beforeDelivery=await snapshot(frame);assert.equal(beforeDelivery.native.failed,false);await readSavedBasis('new-file-ack-before-old-read-refusal');
      probe.checkpointRefusal={mode:checkpointRefusalMode,initial,restoredCheckpoint,restoredMember:{bytes:restoredBytes.length,sha256:digest(restoredBytes),is_regular:true,nlink:restoredMember.nlink},beforeDelivery,ordering:'actual checkpoint member restored and independently read → newer native file acknowledgement → old actual checkpoint refusal delivered'};
      releaseRefusalReply();
    }
  }else opening=frame.evaluate(path=>window.__FIELD_STUDIES__.openNativeFile(path),'Work/Notes/gate.expression.json');
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
  if(innerCheckpointRefusal){assert.equal(heldNew.delivered_sha256,heldNew.raw_response.sha256);probe.checkpointRefusal.beforeDelivery=await snapshot(frame);}
  await finishCheckpointRefusal(expectedRef,kernelDoc,readSavedBasis);
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
    const recoveryBeforeDelivery=await acknowledgedCurrentDraft('current-file-adoption-before-late-read',heldBootReply.request);
    assert.equal(recoveryBeforeDelivery.result,'expression_recovery');assert.equal(recoveryBeforeDelivery.data.state,'ready');
    assert.ok(recoveryBeforeDelivery.data.record.revision>=heldBootReply.native_record.revision);
    // Only projection's adoption timestamp may differ from the dated draft;
    // every authored field and both exact native/saved bodies remain guarded.
    assert.deepEqual(recoveryBeforeDelivery.data.record.value,{...heldBootReply.native_record.value,updatedAt:recoveryBeforeDelivery.data.record.value.updatedAt},'Opening the native file must preserve the complete prior authored recovery body');
    const before=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState(),timeOrigin:performance.timeOrigin,url:location.href}));
    releaseBootReply();await frame.evaluate(()=>window.__FIELD_STUDIES__.workspaceReady());await heldBootDelivery;
    const after=await frame.evaluate(()=>({document:window.__FIELD_STUDIES__.getDocument(),native:window.__FIELD_STUDIES__.nativeWorking(),state:window.__FIELD_STUDIES__.getState(),timeOrigin:performance.timeOrigin,url:location.href}));
    const nativeAfter=await kernelDoc(),recoveryAfterDelivery=await op(heldBootReply.request);
    assert.equal(recoveryAfterDelivery.result,'expression_recovery');assert.equal(recoveryAfterDelivery.data.state,'ready');
    assert.deepEqual(recoveryAfterDelivery.data.record,recoveryBeforeDelivery.data.record,'Delivering the late read must preserve its complete durable recovery record and revision');
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
  if(checkpointRefusal){
    const current=await snapshot(frame);assert.deepEqual(current.document,probe.checkpointRefusal.after.document);assert.equal(current.native.failed,false);assert.equal(current.native.busy,false);
    for(const key of ['native_ref','revision','file','pending','notes','bindings'])assert.deepEqual(current.native[key],probe.checkpointRefusal.after.native[key],key+': Journey keeps the real acknowledged basis after stale refusal');
    assert.deepEqual(await kernelDoc(),savedFile);await readSavedBasis('Journey-after-stale-checkpoint-refusal');probe.checkpointRefusal.journey=current;
    check(true,'Journey continues the complete saved native/rendered body and current basis after the real stale checkpoint refusal');
  }
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
    const currentRecoveryBeforeRestart=await acknowledgedCurrentDraft('ordinary-target-switch-before-separate-owner-restart',heldBootReply.request);
    assert.deepEqual(currentRecoveryBeforeRestart.data.record.value,returnedTarget.document);
    await restartBridge('separate-native-owner-current-record-continuation');
    const recoveryAfterRestart=await op(heldBootReply.request);
    await readSavedBasis('after-separate-owner-restart');
    assert.equal(recoveryAfterRestart.result,'expression_recovery');assert.equal(recoveryAfterRestart.data.state,'ready');
    assert.deepEqual(recoveryAfterRestart.data.record,currentRecoveryBeforeRestart.data.record,'A separate restarted native owner must still read the same complete recovery record and revision');
    probe.heldBootReply.recoveryAfterRestart=recoveryAfterRestart;
    check(true,'The independently acknowledged current recovery record remains exact through the actual native recovery reader after a separate kernel restart');
  }
  receipt.passed = true;
} catch (error) {
  receipt.failure = String(error);
  if (page) receipt.drawer = await page.evaluate(() => document.querySelector('[aria-label="Constellation authoring"]')?.innerText.slice(-1500)).catch(() => null);
  if (page) await page.screenshot({path: resolve(out, 'failure.png')}).catch(() => {});
  throw error;
} finally {
  const hadPrimaryFailure=!!receipt.failure,encounterPassed=receipt.passed,cleanupFailures=[];
  receipt.encounter_passed_before_cleanup=encounterPassed;receipt.passed=false;
  const attempt=async(name,operation)=>{try{await operation();}catch(error){cleanupFailures.push({operation:name,error:String(error).slice(0,4096)});receipt.passed=false;receipt.failure??=`Cleanup failed during ${name}`;}};
  // An unexpected restoration failure is a failing receipt. It cannot skip
  // releasing held real replies, retaining diagnostics or stopping our owners.
  await attempt('restore-original-checkpoint-member',()=>restoreCheckpointMember?.());
  for(const [name,release] of [['refusal',releaseRefusalReply],['successor',releaseNewReply],['boot',releaseBootReply],['file',releaseFileReply]])await attempt(`release-${name}-reply`,()=>release?.());
  receipt.errors = errors; receipt.probe = probe; receipt.boot_reply_race = {requested:bootRace,mode:bootRaceMode,held:heldBootReply??null,held_file:heldFileReply??null,original_uninstrumented_multi_host_replay_required:bootRace}; receipt.checkpoint_refusal={requested:checkpointRefusal,mode:checkpointRefusalMode,held:heldRefusal??null,held_successor:heldNew??null,original_and_both_success_order_modes_required:checkpointRefusal}; receipt.expressionEdits = expressionEdits;
  receipt.cleanup_failures=cleanupFailures;
  await attempt('retain-receipt-before-owned-cleanup',()=>writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n'));
  await attempt('retain-native-log',()=>writeFileSync(resolve(out,'kernel.log'),logs.join('')));
  // Each operation is attempted even if its predecessor rejects. The owned
  // native child is stopped in finally, including failed browser/server close.
  try{await attempt('close-owned-browser',()=>browser?.close());}
  finally{try{await attempt('close-owned-server',()=>server?.close());}
   finally{await attempt('stop-owned-native-bridge',()=>{if(bridge&&bridge.exitCode===null&&bridge.signalCode===null&&!bridge.kill('SIGTERM'))throw Error('Owned bridge did not accept SIGTERM');});}}
  receipt.passed=encounterPassed&&cleanupFailures.length===0;
  await attempt('retain-final-cleanup-receipt',()=>writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n'));
  if(cleanupFailures.length){console.error('Owned replay cleanup failed',JSON.stringify(cleanupFailures));if(!hadPrimaryFailure)throw new Error('Replay cleanup failed; see retained receipt and stderr');}
}
