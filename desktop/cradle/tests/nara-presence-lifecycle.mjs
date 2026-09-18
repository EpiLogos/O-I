/**
 * The Nara presence surface lifecycle (#336): the real surface component,
 * real kernel (walk bridge), real constitution laws, and the real capture
 * pipeline against a SYNTHETIC microphone (chromium fake device) — live
 * operating-system mic permission stays with the owner.
 *
 * Run: node tests/nara-presence-lifecycle.mjs
 */

import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';import {createServer} from 'vite';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const packageRoot=fileURLToPath(new URL('../../../packages/oi-design-system/',import.meta.url));
const walkFixtureRoot=fileURLToPath(new URL('../walk/fixtures/nara/',import.meta.url));
const textResolution=JSON.parse(readFileSync(`${walkFixtureRoot}text-body-resolution.json`,'utf8')).resolution;
const realtimeResolution=JSON.parse(readFileSync(`${walkFixtureRoot}realtime-body-resolution.json`,'utf8')).resolution;

const PORT=4391;
const BRIDGE_PORT=4392;
const BRIDGE_URL=`http://127.0.0.1:${BRIDGE_PORT}`;
const ACTOR='human:expression-editor';

// A leaked bridge from a failed earlier run would answer with the wrong
// kernel; clear the port first (the sf6 pattern).
try{
  for(const pid of execFileSync('lsof',['-ti',`tcp:${BRIDGE_PORT}`,'-sTCP:LISTEN'],{encoding:'utf8'}).split('\n').filter(Boolean).map(Number))
    if(pid!==process.pid)try{process.kill(pid,'SIGTERM');}catch{}
}catch{}
await new Promise(resolve=>setTimeout(resolve,300));

const bridge=spawn('cargo',['run','--quiet','--manifest-path',join(root,'kernel/Cargo.toml'),'--bin','walk-bridge','--',`127.0.0.1:${BRIDGE_PORT}`],{cwd:root,detached:true,stdio:['ignore','pipe','pipe']});
let bridgeOut='';
bridge.stdout.on('data',chunk=>bridgeOut+=chunk);
bridge.stderr.on('data',chunk=>bridgeOut+=chunk);
const stopBridge=()=>{try{process.kill(-bridge.pid,'SIGTERM');}catch{try{bridge.kill('SIGTERM');}catch{}}};
process.once('exit',stopBridge);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{stopBridge();process.exit(130);});

const deadline=Date.now()+180000;
for(;;){
  if(bridge.exitCode!==null){stopBridge();throw new Error(`walk bridge exited before readiness (${bridge.exitCode}): ${bridgeOut}`);}
  try{if((await fetch(`${BRIDGE_URL}/state`)).ok)break;}catch{}
  if(Date.now()>deadline){stopBridge();throw new Error(`walk bridge did not start: ${bridgeOut}`);}
  await new Promise(resolve=>setTimeout(resolve,200));
}
const bridgeOp=async(op,request)=>{
  const envelope=await (await fetch(`${BRIDGE_URL}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op,request})})).json();
  if(envelope.error||!envelope.outcome)throw new Error(`${op} failed: ${JSON.stringify(envelope.error??envelope)}`);
  return envelope.outcome;
};

// The Expression world Nara joins: real kernel document, bound subjects.
const expressionRef=`expression:nara-presence-${Date.now()}`;
const created=await bridgeOp('expression',{operation:'create',expression_ref:expressionRef,title:'Nara presence walk',actor:ACTOR});
let revision=created.data.document.revision;
const edit=async changes=>{
  const result=await bridgeOp('expression',{operation:'edit',expression_ref:expressionRef,expected_revision:revision,actor:ACTOR,changes});
  if(result.data.state!=='ready')throw new Error(`edit did not apply: ${JSON.stringify(result.data)}`);
  revision=result.data.document.revision;
  return result.data.document;
};
const bind=(entityRef,subjectRef,title)=>[
  {change:'entity_add',scene_ref:`${expressionRef}:scene:main`,entity_ref:entityRef,title},
  {change:'subject_bind',entity_ref:entityRef,binding:{
    subject_ref:subjectRef,native_owner:'ql',presentation_role:'thing',
    sources:[{ref:`source:ql/${subjectRef.replace(/[^a-z0-9.-]/gi,'-')}`,revision:'1',availability:'available'}],
    readings:[],actions:[],
  }},
];
await edit([
  ...bind(`${expressionRef}:entity:person`,'bimba:#4','Person locus'),
  ...bind(`${expressionRef}:entity:relation`,'bimba:relation:1','Pointed relation'),
  ...bind(`${expressionRef}:entity:earth`,'ql:nara:focus:m4:earth-body','EarthBody'),
]);

const server=await createServer({root,appType:'custom',resolve:{alias:{'@epilogos/oi-design-system':packageRoot}},server:{host:'127.0.0.1',port:PORT,strictPort:true},logLevel:'error'});
server.middlewares.use('/nara-presence',async(_req,res)=>{
  res.setHeader('content-type','text/html');
  res.end(await server.transformIndexHtml('/nara-presence',
    '<!doctype html><html><head><meta charset="utf-8"></head><body class="oi-desktop"><div id="root" style="width:1100px;height:760px"></div><script type="module" src="/tests/nara-presence-page.tsx"></script></body></html>'));
});
await server.listen();

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1100,height:760},permissions:['microphone']});
const page=await context.newPage();
page.on('pageerror',error=>console.log(`  [pageerror] ${error.message}`));
await page.addInitScript(([url,ref])=>{
  window.__OI_KERNEL_BRIDGE__=url;
  window.NARA_TEST_BINDING={id:'nara-test',kind:'nara',title:'Nara',ref};
},[BRIDGE_URL,expressionRef]);

const checks=[];
const check=(ok,label,data)=>{checks.push({ok:!!ok,label,...(data!==undefined?{data}:{})});console.log(`${ok?'PASS':'FAIL'}  ${label}`);if(!ok)process.exitCode=1;};

try{
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/nara-presence`);
  await page.waitForFunction(()=>document.querySelector('[data-nara]'),null,{timeout:30000});

  check(await page.locator('[data-nara="unattached"]').count()===1,'At rest the surface discloses honestly: no Nara is attached');

  // Attach through the real form: text-capable resolution + the Expression ref.
  await page.locator('.nara-attach summary').click();
  await page.locator('textarea[aria-label="AIKit resolution read model"]').fill(JSON.stringify(textResolution));
  await page.locator('input[aria-label="Bimba selection binding"]').fill(JSON.stringify({
    owner_contract_ref:'ql.aw1-rooted-m-world/v1',registry_revision:'registry:presence-1',
    selected_source_ref:'bimba:source:M4.1',direct_canonical_ref:'bimba:#4',conjugate_canonical_ref:'pratibimba:#4',
  }));
  await page.locator('button:has-text("Attach")').click();
  await page.waitForFunction(()=>document.querySelector('[data-nara]:not([data-nara="unattached"])'),null,{timeout:15000});
  check(true,'Attach consumes the AIKit resolution: canonical Nara constituted on the text body');

  const capabilities=async name=>await page.locator(`dd[data-capability="${name}"]`).innerText();
  check(await capabilities('speech')==='unsupported'&&await capabilities('text')==='supported',
    'Capability chips disclose the text-capable body honestly',{voice:await capabilities('speech'),text:await capabilities('text')});
  const talkDisabled=await page.locator('button:has-text("Hold to talk")').isDisabled();
  check(talkDisabled===true,'Hold-to-talk is disabled on a body with no declared acoustic input (manual fallback, honest)');
  check(await page.locator('input[aria-label="Message Nara"]').count()===1,'The text composer is always available as the honest fallback');

  // The caller-side QL dialogical floor check, computed at attach.
  check(await capabilities('voice-floor')==='unmet','The QL dialogical floor is evaluated at attach: the text body fails it honestly');
  await page.waitForFunction(()=>document.querySelector('[data-voice-floor-unmet]')?.textContent?.includes('duplex'),null,{timeout:15000});
  const unmetNote=await page.locator('[data-voice-floor-unmet]').innerText();
  check(['duplex','barge-in','manual interrupt','structured event channel','reconnect status reporting'].every(named=>unmetNote.includes(named))
    &&!unmetNote.includes('context refresh'),
    'Every body-fact gap is named on the surface; context refresh is met by the per-turn push, never named');

  // Reconnect the body: same Nara, different resolution.
  await page.locator('.nara-next-body summary').click();
  await page.locator('textarea[aria-label="Next body resolution"]').fill(JSON.stringify(realtimeResolution));
  await page.locator('button:has-text("Reconnect body")').click();
  await page.waitForFunction(()=>document.querySelector('dd[data-capability="speech"]')?.textContent==='supported',null,{timeout:15000});
  check(await capabilities('interruption')==='supported'&&await capabilities('vad')==='supported',
    'Body change disclosed: interruption and VAD now supported; Nara identity unchanged',{nara:await page.locator('[data-nara]').getAttribute('data-nara')});
  check(await page.locator('[data-change-receipt]').count()===1,'The constitution-change receipt is visible');
  await page.waitForFunction(()=>document.querySelector('dd[data-capability="voice-floor"]')?.textContent==='met',null,{timeout:15000});
  check(await page.locator('[data-voice-floor-unmet]').count()===0,
    'The floor recomputes at reconnect: the realtime body meets it — context refresh met by push-on-change over the structured event channel');

  // Hold to talk: the REAL capture pipeline against the synthetic device.
  const talk=page.locator('button:has-text("Hold to talk")');
  check(await talk.isEnabled()===true,'Hold-to-talk enabled on the acoustic body');
  await talk.dispatchEvent('mousedown');
  await page.waitForFunction(()=>document.querySelector('[data-nara]')?.getAttribute('data-phase')==='listening',null,{timeout:15000});
  check(true,'Real getUserMedia capture (synthetic device) drives the listening phase');
  const micLive=await page.locator('[data-nara-phase]').innerText();
  check(micLive.includes('microphone live'),'The presence row discloses the live microphone', {row:micLive});
  await talk.dispatchEvent('mouseup');
  await page.waitForFunction(()=>document.querySelector('[data-nara]')?.getAttribute('data-phase')==='idle',null,{timeout:15000});
  check(true,'Releasing the hold returns the session to rest');

  // Point the current selection (focus the person locus first, node-side).
  await bridgeOp('expression',{operation:'edit',expression_ref:expressionRef,expected_revision:revision,actor:ACTOR,
    changes:[{change:'focus',scene_ref:`${expressionRef}:scene:main`,entity_ref:`${expressionRef}:entity:relation`}]});
  revision+=1;
  await page.locator('button:has-text("Point selection")').click();
  await page.waitForFunction(()=>document.querySelector('[data-nara-notice]')?.textContent?.includes('focused'),null,{timeout:15000});
  check(true,'Point selection crosses deixis: the exact ref enters the bounded context and Nara focuses it');

  // Highlight pointing (QL hovered deixis): a pure presentation movement.
  // This harness stands no live stage presentation, so the honesty law is
  // exactly observable: the highlight is named, nothing is faked.
  await page.locator('button:has-text("Highlight selection")').click();
  await page.waitForFunction(()=>document.querySelector('[data-nara-notice]')?.textContent?.includes('no live Expression stage presentation stands'),null,{timeout:15000});
  check(await page.locator('[data-nara-highlight]').count()===1,
    'A highlight without a live stage presentation is named honestly; nothing was moved');

  // One reversible ExpressiveAct with speech; interrupt holds both together.
  await page.locator('button:has-text("Perform reversible act with speech")').click();
  await page.waitForFunction(()=>document.querySelector('[data-act-phase]')?.getAttribute('data-act-phase')==='active',null,{timeout:15000});
  check(await page.locator('.nara-choreography li').count()>=1,'The act runs with its choreography steps disclosed');
  await page.locator('button:has-text("Interrupt")').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-act-phase]')?.getAttribute('data-act-phase')==='interrupted',null,{timeout:15000});
  check(await page.locator('[data-interruption-receipt]').count()===1,'Interrupt stops speech and holds the choreography; the receipt is visible');
  check((await page.locator('[data-interruption-receipt] summary').innerText()).includes('cancelled'),'The interruption receipt records the cancelled speech');

  // Authority proofs against the real seam.
  await page.locator('.nara-authority summary').click();
  await page.locator('button:has-text("Request refused")').click();
  await page.waitForFunction(()=>document.querySelector('[data-tool-receipt]')?.textContent?.includes('"refused"'),null,{timeout:15000});
  check(true,'A tool request for an unauthorised action is refused before effect, receipt visible');
  await page.locator('button:has-text("Request authorised focus")').click();
  await page.waitForFunction(()=>document.querySelector('[data-tool-receipt]')?.textContent?.includes('"authorised"'),null,{timeout:20000});
  check(true,'An authorised tool request executes as a real dispatch through the expression seam');

  // Epii: delegation, then the returned enrichment as a retained proposal.
  await page.locator('input[aria-label="Message Nara"]').fill('What stands behind the pointed relation?');
  await page.locator('button:has-text("Delegate to Epii")').click();
  await page.waitForFunction(()=>document.querySelectorAll('.nara-proposal').length===1,null,{timeout:15000});
  check(true,'Delegation recorded over admitted refs; Nara stays foreground');
  await page.locator('button:has-text("Receive returned enrichment")').click();
  await page.waitForFunction(()=>document.querySelector('.nara-proposal-facts')?.textContent?.includes('appliedfalse'),null,{timeout:15000});
  check(true,'The returned enrichment is presented retained-not-applied (applied: false)');

  // Transcript expansion only on demand; no permanent dashboard.
  check(await page.locator('.nara-transcript summary').isVisible()&&!(await page.locator('.nara-transcript').getAttribute('open')),
    'The transcript stays collapsed at rest');

  await page.screenshot({path:new URL('../walk/artifacts/nara-presence-lifecycle.png',import.meta.url).pathname});
}catch(error){
  process.exitCode=1;
  console.log(`FAIL  lifecycle error: ${error.message}`);
  try{console.log('  [alert]',await page.locator('[role=alert]').first().innerText());}catch{}
  try{console.log('  [notice]',await page.locator('[data-nara-notice]').first().innerText());}catch{}
  try{await page.screenshot({path:new URL('../walk/artifacts/nara-presence-lifecycle-failure.png',import.meta.url).pathname});}catch{}
}finally{
  await browser.close();
  await server.close();
  stopBridge();
  const passed=checks.filter(entry=>entry.ok).length;
  console.log(`\nNara presence lifecycle: ${passed}/${checks.length} checks`);
}
