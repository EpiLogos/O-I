#!/usr/bin/env node
/** Native manual-stop replay using the production instrument and parent relay.
 * node tests/nara-stop-native.mjs /absolute/native-return-replay-config.json
 * Requires the existing controlled identity, Expression,
 * native model and speech services. No provider answers or audio are supplied.
 * Stops actual pending synthesis before testing a separate native text turn.
 * If no completed answer is supplied, one brief actual turn is completed first.
 * A second controlled question is submitted and stopped. No microphone is opened.
 */
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer,optimizeDeps} from 'vite';
import {chromium} from 'playwright';
import {waitForNativeTurn} from './nara-native-turn.mjs';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert.match(config.bridge, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.person_ref, /^controlled:/);
assert.ok(config.world.includes('/Control/agents/now/clearings/') && config.world.includes('/T/') && config.world.endsWith('/world'));
const output = path.join(path.dirname(process.argv[2]), 'nara-stop-native');
await mkdir(output, {recursive: true});
const checks = [], events = [], failures = [];
const native=async request=>{
 const response=await fetch(`${config.bridge}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(90000)});
 const reply=await response.json();if(reply.ok===false||reply.error||!reply.outcome)throw Error(reply.error||`Native ${request.op} returned no outcome: ${JSON.stringify(reply)}`);return reply.outcome.data;
};
let preparatorySession;
const voiceLeases = new Set(), closedLeases = new Set(), observedResponses = [];
const sourcePaths = ['src/expressions/naraChannel.ts', 'src/nara/instrumentProtocol.ts',
  'expressions-app/field-studies-journeys/src/naraConversationTools.tsx',
  'expressions-app/field-studies-journeys/src/naraInstrument.tsx'];
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file,
  createHash('sha256').update(await readFile(file)).digest('hex')])));
const rootModule = `
import {kernelOp} from '/src/kernel/bridge.ts';
import {relayNaraChannel} from '/src/expressions/naraChannel.ts';
import {hostedCompositionFile} from '/src/expressions/hostedComposition.ts';
const config=${JSON.stringify(config)};
const transport={kind:'bridge',url:config.bridge};
if(config.file_path)await hostedCompositionFile(transport,{operation:'open',path:config.file_path});
const reply=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:config.binding.expression_ref}});
if(reply.error)throw Error(reply.error);
window.documentReading=reply.outcome.data.document;
window.acceptDocument=async document=>{
 const readback=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:document.expression_ref}});
 if(readback.error||readback.outcome?.data.document.revision!==document.revision)throw Error(readback.error??'Native document readback differs');
 window.documentReading=readback.outcome.data.document;
};
const frame=document.querySelector('iframe');
relayNaraChannel(frame,transport,{project:()=>config.project,expression:()=>window.documentReading});
frame.src='/stop-child';
`;
const childModule = `
import {installNaraInstrument} from '/expressions-app/field-studies-journeys/src/naraInstrument.tsx';
import {installKernelExpressions,naraInstrumentRequest} from '/expressions-app/field-studies-journeys/src/kernelExpressions.ts';
installKernelExpressions();
window.nativeRequest=naraInstrumentRequest;
installNaraInstrument({nativeView:()=>({document:parent.documentReading}),sceneId:()=>parent.documentReading.selection.scene_ref,acceptNativeDocument:document=>parent.acceptDocument(document)});
`;
const server = await createServer({configFile: false, root: process.cwd(),
  cacheDir: path.join(output, 'vite-cache'), server: {host: '127.0.0.1', port: 0, hmr: false},
  optimizeDeps: {noDiscovery: true, entries: [], include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime']},
  resolve: {dedupe:['react','react-dom']},
  esbuild: {jsx: 'automatic'}, plugins: [{name: 'native-stop-replay', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const route = req.url?.split('?')[0];
      if (route === '/stop-parent' || route === '/stop-child') {
        res.setHeader('Content-Type', 'text/html');
        res.end(route === '/stop-parent'
          ? '<!doctype html><iframe style="width:100%;height:1100px"></iframe><script type="module" src="/stop-parent.js"></script>'
          : '<!doctype html><div id="app"><header class="header-actions"></header></div><script type="module" src="/stop-child.js"></script>');
      } else if (route === '/stop-parent.js' || route === '/stop-child.js') {
        res.setHeader('Content-Type', 'application/javascript'); res.end(route === '/stop-parent.js' ? rootModule : childModule);
      } else next();
    });
  }}]});
let browser, page;
try {
  await optimizeDeps(server.config);await server.listen();
  browser = await chromium.launch({headless: true, args: ['--autoplay-policy=no-user-gesture-required']});
  page = await browser.newPage({viewport: {width: 1400, height: 1200}});
  page.on('pageerror', error => failures.push(String(error)));
  page.on('response', response => {
    if (response.url() !== `${config.bridge}/op` || response.request().method() !== 'POST') return;
    const op = response.request().postDataJSON();
    if (op.op !== 'nara_voice' || !['open','close'].includes(op.request?.operation)) return;
    observedResponses.push(response.json().then(reply => {
      const data = reply.outcome?.data;
      if (data?.voice_ref && op.request.operation === 'open') voiceLeases.add(data.voice_ref);
      if (data?.voice_ref && data.closed === true) closedLeases.add(data.voice_ref);
    }).catch(error => failures.push(`Native voice response unreadable: ${error}`)));
  });
  page.on('request', request => {
    if (request.url() === `${config.bridge}/op` && request.method() === 'POST') {
      const op = request.postDataJSON();
      events.push({op: op.op, operation: op.request?.operation ?? op.action?.action ?? op.request?.action,
        voice_ref: op.request?.voice_ref});
    }
  });
  // Instrument the real browser constructors; preserve actual audio effects.
  await page.addInitScript(() => {
    window.observedAudio = [];
    window.AudioContext = new Proxy(window.AudioContext, {construct(Type, args) {
      const context = new Type(...args); window.observedAudio.push(context); return context;
    }});
  });
  await page.goto(`${server.resolvedUrls.local[0]}stop-parent`, {waitUntil:'commit'});
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', {name: 'Nara', exact: true}).click({timeout:90000});
  await frame.getByLabel('Saved profiles', {exact: true}).selectOption(config.binding.source_ref);
  await frame.getByRole('button', {name: 'Save and use identity', exact: true}).click({timeout: 90000});
  await frame.getByText('Saved. This identity is selected for the Expression.', {exact: true}).waitFor({timeout: 90000});
  await frame.getByRole('button', {name: 'With Nara', exact: true}).click();
  if(config.block_id===null||config.block_id===undefined){
    const source=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
    const lookupRequest={...config.binding,operation:'resolve',role:'nara',expected_revision:source.source.revision};
    const lookup=await native({op:'nara_dialogue',project:config.project,request:lookupRequest});
    preparatorySession=lookup.provisioning.agent_session;
    let prior=await native({op:'encounter',project:config.project,request:{action:'view',agent_session:preparatorySession}});
    if(prior.connection.state==='Disconnected'){
      await frame.getByRole('button',{name:'Reconnect this conversation',exact:true}).click({timeout:90000});
      await frame.getByText('Connected',{exact:true}).waitFor({timeout:90000});
      const resumed=await native({op:'encounter',project:config.project,request:{action:'status',agent_session:preparatorySession}});
      if(config.expected_native_session_id)assert.equal(resumed.native_session_id,config.expected_native_session_id);
      prior=await native({op:'encounter',project:config.project,request:{action:'view',agent_session:preparatorySession}});
      checks.push('Explicit production reconnect restores the retained native conversation before a fresh turn');
    }
    const lastId=Math.max(0,...prior.blocks.map(block=>block.id));
    await frame.getByLabel('Message Nara',{exact:true}).fill('For this controlled native audio check, state the supplied Expression title and selected entity title in exactly two short sentences. Use only the supplied context. Do not use tools or initiate actions.');
    await frame.getByRole('button',{name:'Send',exact:true}).click();
    await waitForNativeTurn(native,config.project,preparatorySession,lastId,output,'nara');
    await frame.getByRole('button',{name:'Keep this answer',exact:true}).last().waitFor({timeout:30000});
    checks.push('Completed an actual native Nara turn through production UI; no answer or audio was supplied by the test');
  }
  await frame.getByText('Connected',{exact:true}).waitFor({timeout:90000});
  await frame.getByRole('button', {name: 'Open voice', exact: true}).click();
  await frame.getByText('Voice connected · one turn at a time', {exact: true}).waitFor({timeout: 90000});
  const child = page.frames().find(value => value.url().endsWith('/stop-child'));
  assert.ok(child);
  const speechRequest = page.waitForRequest(request => request.url() === `${config.bridge}/op`
    && request.method() === 'POST' && request.postDataJSON()?.op === 'nara_voice'
    && request.postDataJSON()?.request?.operation === 'speak', {timeout: 90000});
  const speechResponse = page.waitForResponse(response => response.url() === `${config.bridge}/op`
    && response.request().method() === 'POST' && response.request().postDataJSON()?.op === 'nara_voice'
    && response.request().postDataJSON()?.request?.operation === 'speak', {timeout: 90000});
  // Attach immediately so a failing precondition does not leave an unhandled wait.
  speechRequest.catch(() => {});
  let synthesisResponded=false;
  speechResponse.then(()=>{synthesisResponded=true;},()=>{});
  await frame.getByRole('button', {name: 'Listen to the answer', exact: true}).click();
  const synthesis=(await speechRequest).postDataJSON().request;
  const voiceRef=synthesis.voice_ref,answerBlockId=synthesis.answer_block_id;
  assert.ok(Number.isInteger(answerBlockId));
  assert.ok(voiceRef);
  assert.ok(await child.evaluate(() => window.observedAudio.some(context => context.state === 'running')));
  checks.push('Production voice UI dispatched actual native synthesis with a real active browser AudioContext');
  assert.equal(synthesisResponded,false,'Pending-synthesis proof requires an actual unanswered native speech request at Stop');
  await frame.getByRole('button', {name: 'Stop response', exact: true}).click();
  await child.waitForFunction(() => window.observedAudio.length > 0 && window.observedAudio.every(context => context.state === 'closed'));
  checks.push('Production Stop response closes real local audio output while native synthesis is pending');
  await frame.getByText('Voice stopped. No native response was in flight.', {exact: true}).waitFor({timeout: 90000});
  assert.ok(events.some(value => value.op === 'nara_voice' && value.operation === 'close' && value.voice_ref === voiceRef));
  checks.push('Audio-only stop closes the native lease without requiring an active text response');
  await (await speechResponse).finished();
  assert.ok(await child.evaluate(() => window.observedAudio.every(context => context.state === 'closed')));
  assert.equal(await frame.getByText('Playing Nara’s answer', {exact: true}).count(), 0);
  checks.push('Returned native synthesis cannot restart the stopped browser audio context');
  const stale = await child.evaluate(async ({voice_ref,person_ref,answer_block_id}) => {
    const document = parent.documentReading;
    const profile = await window.nativeRequest({operation:'identity',request:{operation:'list'}});
    const selected = profile.profiles.find(value => value.person_ref === person_ref);
    try {
      await window.nativeRequest({operation:'voice',role:'nara',basis:{expression_ref:document.expression_ref,
        source:{source_ref:selected.source_ref,revision:selected.revision}},request:{operation:'speak',voice_ref,answer_block_id}});
      return {accepted:true};
    } catch (error) {return {accepted:false,error:String(error)};}
  }, {voice_ref:voiceRef,person_ref:config.binding.person_ref,answer_block_id:answerBlockId});
  assert.equal(stale.accepted, false);
  assert.match(stale.error, /voice|lease|identity/i);
  checks.push('Stopped voice reference cannot resume speech through the production relay');
  await frame.getByLabel('Message Nara', {exact: true}).fill('Controlled manual-stop verification: explain in six paragraphs how preserving one person and one Expression across interruptions maintains conversational continuity.');
  await frame.getByRole('button', {name: 'Send', exact: true}).click();
  await frame.getByText('Responding…', {exact: true}).waitFor({timeout: 90000});
  await frame.getByRole('button', {name: 'Stop response', exact: true}).click();
  await frame.getByText('Local voice stopped. Native cancellation requested; the conversation will confirm its state.', {exact: true}).waitFor({timeout: 90000});
  assert.ok(events.some(value => value.operation === 'cancel'));
  checks.push('Production Stop response requests cancellation of an actual in-flight native text turn');
  await page.screenshot({path: path.join(output, 'manual-stop.png'), fullPage: true});
  assert.deepEqual(failures, []);
  await writeFile(path.join(output, 'receipt.json'), JSON.stringify({schema:'oi.nara-manual-stop-native/v1', passed:true,
    sources, checks, events, limits:['Controlled existing world and source-mounted production UI; not installed WKWebView.',
      'Real native speech request and browser audio teardown; pending synthesis is stopped before playback, with no microphone or audible-speaker claim.',
      'Native cancellation acknowledgement is not provider-quiescence or full TA3 acceptance.']},null,2)+'\n');
  console.log(JSON.stringify({passed:true,checks,output}));
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(() => {});
    await writeFile(path.join(output,'failure.html'),await page.content().catch(() => 'Page unavailable'));
  }
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({error:String(error),sources,checks,events,failures},null,2)+'\n');
  throw error;
} finally {
  await Promise.allSettled(observedResponses);
  await browser?.close();
  const cleanup = [];
  if(preparatorySession){
    try{
      const status=await native({op:'encounter',project:config.project,request:{action:'status',agent_session:preparatorySession}});
      if(['TurnInFlight','InterruptRequested'].includes(status.state))await native({op:'encounter',project:config.project,request:{action:'cancel',agent_session:preparatorySession,reason:'Controlled stop verification ended'}});
    }catch(error){cleanup.push({agent_session:preparatorySession,closed:false,error:String(error)});}
  }
  for (const voice_ref of voiceLeases) {
    if (closedLeases.has(voice_ref)) continue;
    try {
      const response = await fetch(`${config.bridge}/op`, {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({op:'nara_voice',project:config.project,request:{operation:'close',voice_ref}}), signal:AbortSignal.timeout(10000)});
      const reply = await response.json();
      cleanup.push({voice_ref,closed:reply.outcome?.data?.closed === true,error:reply.error ?? null});
    } catch (error) {cleanup.push({voice_ref,closed:false,error:String(error)});}
  }
  await writeFile(path.join(output,'cleanup.json'),JSON.stringify({leases:[...voiceLeases],acknowledged:[...closedLeases],cleanup},null,2)+'\n');
  if(cleanup.some(result=>!result.closed)){
    process.exitCode=1;
    try {const receipt=JSON.parse(await readFile(path.join(output,'receipt.json'),'utf8'));receipt.passed=false;receipt.cleanup=cleanup;await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}catch{/* The original failure already has its own retained report. */}
  }
  server.httpServer?.closeAllConnections(); await server.close();
}
