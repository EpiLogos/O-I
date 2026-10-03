/** Real native UI walk: Central + AIKit + O:I kernel + production Wiki/Stage.
 * Controlled temporary ground, no transport fixtures, models or owner machine.
 */
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium,webkit} from 'playwright';
const engineName=process.env.WIKI_BROWSER==='webkit'?'webkit':'chromium';
// Supplemental real race: change only controlled native material after the UI
// preflight, then forward the original request to the real owner unchanged.
const nativeConflictRace=process.env.WIKI_NATIVE_CONFLICT_RACE==='1';
const restartDiagnostics=process.env.WIKI_RESTART_DIAGNOSTICS==='1';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'tests/artifacts/wiki-constructive',...(nativeConflictRace?['native-conflict-race']:[]),...(restartDiagnostics?['restart-diagnostic']:[]),engineName);mkdirSync(out,{recursive:true});
const binaries=Object.fromEntries(['OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN','WIKI_KERNEL_BIN'].map(key=>{assert.ok(process.env[key],`${key} must name the actual built executable`);return [key,resolve(process.env[key])];}));
// Canonicalise the ground so a symlinked temp root (macOS /var -> /private/var)
// matches the native owner's own path canonicalisation; a no-op where temp is not
// symlinked (Linux CI). Without it the constellation register/space refs mismatch.
const ground=realpathSync(mkdtempSync(resolve(tmpdir(),'wiki-constructive-'))),project=resolve(ground,'Work/Notes');mkdirSync(project,{recursive:true});
const env={PATH:process.env.PATH??'/usr/bin:/bin',HOME:resolve(ground,'isolated-home'),AIKIT_HOME:resolve(ground,'isolated-aikit'),...binaries,OI_CENTRAL_ROOT:ground,OI_CENTRAL_PROJECT_QUERY:'Notes'};
mkdirSync(env.HOME,{recursive:true});
const receipt={scope:'N+B: real CLI, files, dev kernel and production UI on a controlled temporary ground; no installed, live-model or human acceptance',checks:[],native:[],passed:false};
const check=(truth,label)=>{assert.ok(truth,label);receipt.checks.push(label);console.log('PASS',label);};
function action(name,input={}){const result=JSON.parse(execFileSync(binaries.OI_CENTRAL_CTRL_BIN,['--json','--root',ground,'action','run',name,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000}));assert.equal(result.ok,true,JSON.stringify(result));receipt.native.push({action:name,status:result.status});return result.data;}
action('central.init');action('projectcentral.init',{project:'Notes',project_id:'wiki-native-walk'});
const sourceText='# Alpha\n\n🌱 **A first reading.**\n\n> A complementary reading.\n\n[[Beta]]\n';
const sourceMaterial=[['a','Alpha',sourceText],['b','Beta','# Beta\n\n[[Alpha]]\n']].map(([key,title,body])=>({binding:{source:`source:${key}`,revision:'r1',title,tags:['notes'],visibility:'public',owners:[],media_type:'text/markdown',locator:{kind:'path',value:resolve(project,`${key}.md`)},metadata:{}},body}));
const materialPath=resolve(project,'source-material.json');writeFileSync(materialPath,JSON.stringify(sourceMaterial));
for(const item of sourceMaterial)writeFileSync(item.binding.locator.value,item.body);
const before=readFileSync(materialPath,'utf8'),wikiPath=resolve(project,'ProjectCentral/agents/wiki/wiki.json');
let bridge,server,browser,page,bridgeUrl;const logs=[],errors=[],writes=[],responses=[];

// Observation only: never attach a handler to a product fetch Promise, replace
// a response, prevent an error event, or alter the original restart/gates.
const TRACE_ROWS=2048,TRACE_BYTES=1024*1024,TRACE_ROW_BYTES=8192,PENDING_READS=256,PENDING_BYTES=128*1024;
const trace={schema:'oi.wiki-native-restart-diagnostic/v1',scope:'Real owned request/lifetime observations; diagnostic timing differs from the uninstrumented original walk.',rows:[],bytes:0,dropped:0,pendingOverflow:0};
let phase='setup',requestSequence=0,bridgeGeneration=0,pendingBytes=0;
const requestIds=new WeakMap(),pendingRequests=new Map();
function observe(kind,data={}) {
 if(!restartDiagnostics)return;
 try {
  const row={kind,phase,at_utc:new Date().toISOString(),monotonic_ms:performance.now(),bridge_generation:bridgeGeneration,bridge_url:bridgeUrl??null,...data};
  const text=JSON.stringify(row),bytes=Buffer.byteLength(text);
  if(bytes>TRACE_ROW_BYTES||trace.rows.length>=TRACE_ROWS||trace.bytes+bytes>TRACE_BYTES){trace.dropped++;return;}
  trace.rows.push(row);trace.bytes+=bytes;
 }catch{/* An observer failure cannot change a native call or its settlement. */}
}
function boundary(next) {phase=next;observe('boundary',{pending_ids:[...pendingRequests.keys()],pending_count:pendingRequests.size,pending_bytes:pendingBytes,pending_untracked:trace.pendingOverflow});}
function classify(request) {
 const value=request.postData();
 if(typeof value!=='string'||value.length>65536||Buffer.byteLength(value)>65536)return {body_class:'absent-or-over-64KiB'};
 try{const body=JSON.parse(value);return {op:typeof body?.op==='string'?body.op.slice(0,128):null,action:typeof body?.request?.action==='string'?body.request.action.slice(0,128):typeof body?.invocation?.action==='string'?body.invocation.action.slice(0,128):null,expression_operation:typeof body?.request?.operation==='string'?body.request.operation.slice(0,128):null};}catch{return {body_class:'not-json'};}
}
function ownErrorString(value,key,limit) {
 try{if(value===null||typeof value!=='object')return null;const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string'?descriptor.value.slice(0,limit):null;}catch{return null;}
}
async function instrument(page) {
 if(!restartDiagnostics)return;
 page.on('console',message=>{try{const text=message.text();if(text.startsWith('OI_WIKI_RESTART_TRACE ')&&text.length<=TRACE_ROW_BYTES)observe('realm',JSON.parse(text.slice('OI_WIKI_RESTART_TRACE '.length)));}catch{}});
 page.on('pageerror',error=>{try{observe('pageerror',{message:ownErrorString(error,'message',2048),stack:ownErrorString(error,'stack',4096)});}catch{}});
 page.on('framenavigated',frame=>{try{if(frame===page.mainFrame())observe('navigation',{url:frame.url().slice(0,2048)});}catch{}});
 page.on('request',request=>{
  try {
   const url=request.url();if(!url.includes('/op')&&!url.includes('/event-replay'))return;
   const id=++requestSequence,row={id,url:url.slice(0,2048),method:request.method(),...classify(request)},bytes=Buffer.byteLength(JSON.stringify(row));
   const tracked=pendingRequests.size<PENDING_READS&&pendingBytes+bytes<=PENDING_BYTES;requestIds.set(request,{id,tracked,bytes});
   if(tracked){pendingRequests.set(id,row);pendingBytes+=bytes;}else trace.pendingOverflow++;
   observe('request',row);
  }catch{}
 });
 const settled=(request,kind)=>{try{const held=requestIds.get(request);if(!held)return;if(held.tracked){pendingRequests.delete(held.id);pendingBytes-=held.bytes;}else trace.pendingOverflow--;observe(kind,{id:held.id,url:request.url().slice(0,2048),...(kind==='requestfailed'?{error_text:request.failure()?.errorText?.slice(0,2048)??null}:{})});}catch{}};
 page.on('requestfinished',request=>settled(request,'requestfinished'));
 page.on('requestfailed',request=>settled(request,'requestfailed'));
 page.on('response',response=>{try{const held=requestIds.get(response.request());if(held){const headers=response.headers();observe('response-headers',{id:held.id,status:response.status(),url:response.url().slice(0,2048),content_type:headers['content-type']?.slice(0,256)??null,allow_origin:headers['access-control-allow-origin']?.slice(0,256)??null});}}catch{}});
 await page.addInitScript(()=>{
  const nativeFetch=window.fetch,ROW_LIMIT=512,BYTE_LIMIT=256*1024,ROW_BYTES=8192;
  const ownErrorString=(value,key,limit)=>{try{if(value===null||typeof value!=='object')return null;const descriptor=Object.getOwnPropertyDescriptor(value,key);return descriptor&&Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string'?descriptor.value.slice(0,limit):null;}catch{return null;}};
  let rows=0,bytes=0,dropped=0;
  const emit=row=>{try{const value={realm_utc:new Date().toISOString(),realm_ms:performance.now(),document_url:location.href.slice(0,2048),...row};const text=JSON.stringify(value),size=new TextEncoder().encode(text).byteLength;if(rows>=ROW_LIMIT||size>ROW_BYTES||bytes+size>BYTE_LIMIT){dropped++;return;}rows++;bytes+=size;console.debug('OI_WIKI_RESTART_TRACE '+text);}catch{}};
  // No response/rejection observer is attached: the exact native Promise and
  // any synchronous native exception remain owned by the original caller.
  window.fetch=function(...args){try{emit({kind:'fetch-call',url:typeof args[0]==='string'?args[0].slice(0,2048):'<non-string input>',stack:new Error('native fetch invocation').stack?.slice(0,4096)??null});}catch{}return Reflect.apply(nativeFetch,this,args);};
  window.addEventListener('error',event=>{try{emit({kind:'window-error',message:typeof event.message==='string'?event.message.slice(0,2048):null,filename:typeof event.filename==='string'?event.filename.slice(0,2048):null,line:event.lineno,column:event.colno,stack:ownErrorString(event.error,'stack',4096)});}catch{}});
  window.addEventListener('unhandledrejection',event=>{try{const reason=event.reason;emit({kind:'unhandledrejection',reason_type:typeof reason,message:typeof reason==='string'?reason.slice(0,2048):ownErrorString(reason,'message',2048),stack:ownErrorString(reason,'stack',4096)});}catch{}});
  window.addEventListener('pagehide',event=>emit({kind:'pagehide',persisted:event.persisted,rows,bytes,dropped}));
  window.addEventListener('pageshow',event=>emit({kind:'pageshow',persisted:event.persisted}));
 });
}

async function startBridge(){
 bridge=spawn(binaries.WIKI_KERNEL_BIN,['127.0.0.1:0'],{cwd:project,env,stdio:['ignore','pipe','pipe']});
 bridgeGeneration++;observe('bridge-spawn',{pid:bridge.pid??null});const ownedBridge=bridge;bridge.on('exit',(code,signal)=>observe('bridge-exit',{pid:ownedBridge.pid??null,code,signal}));
 bridge.stderr.on('data',data=>logs.push(data.toString()));
 bridgeUrl=await new Promise((yes,no)=>{let data='';const timer=setTimeout(()=>no(new Error('The actual kernel did not become available')),30000);bridge.on('error',error=>{clearTimeout(timer);no(new Error(`Kernel could not start: ${error.message}`));});bridge.on('exit',code=>{clearTimeout(timer);no(new Error(`Kernel exited ${code}: ${logs.slice(-5)}`));});bridge.stdout.on('data',chunk=>{data+=chunk;const match=data.match(/listening on (http:\/\/[^ ]+)/);if(match){clearTimeout(timer);yes(match[1]);}});});
}
async function op(value){observe('harness-op',{op:value.op,operation:value.request?.operation??null});const response=await fetch(`${bridgeUrl}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await response.json();assert.equal(result.ok,true,JSON.stringify(result));return result.outcome;}
function savedFrame(title){return JSON.parse(readFileSync(wikiPath,'utf8')).objects.find(object=>object.object==='frame'&&object['aikit.constellation/v1']?.title===title);}
async function choosePassage(selector){await page.locator(selector).evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);element.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));});await page.getByRole('button',{name:'Add to constellation',exact:true}).click();}
try{
 await startBridge();
 const readRequest={op:'knowledge',project:'Notes',request:{action:'read',address:{kind:'source',value:'source:a'}}};
 const coldStart=performance.now(),actual=await op(readRequest);
 receipt.timings={scope:'Two-source temporary native world; transport/owner readings only, not installed-app latency',coldSourceMs:performance.now()-coldStart};
 check(actual.result==='knowledge'&&actual.data.document?.schema==='aikit.markdown-reading/v1','The actual native owner supplies the Markdown reading');
 const warm=[];for(let i=0;i<8;i++){const start=performance.now(),value=await op(readRequest);assert.equal(value.data.resource,actual.data.resource);assert.equal(value.data.revision,actual.data.revision);warm.push(performance.now()-start);}
 warm.sort((a,b)=>a-b);receipt.timings.warmSourceP95Ms=warm.at(-1);receipt.timings.warmSamples=warm.length;
 server=await createServer({root,configFile:false,plugins:[react()],resolve:{alias:{three:resolve(root,'node_modules/three')}},define:{__CRADLE_WALK__:'false'},optimizeDeps:{include:['d3-force']},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});await server.listen();
 const url=`http://127.0.0.1:${server.httpServer.address().port}/tests/wiki-constructive.html?bridge=${encodeURIComponent(bridgeUrl)}`;
 browser=await (engineName==='webkit'?webkit:chromium).launch({headless:true});receipt.browser={name:engineName,version:browser.version()};page=await browser.newPage({viewport:{width:1360,height:960},reducedMotion:'reduce'});page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(String(error)));
 page.on('response',response=>{if(response.request().method()==='POST'&&response.url().endsWith('/op'))void response.json().then(result=>{if(result.error||result.ok===false||/(?:refused|failed|conflict|unavailable)$/.test(result.outcome?.data?.state??'')||result.outcome?.dispatch?.state==='owner_refused')responses.push(result);},()=>{});});
 page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/op')){const body=request.postDataJSON();if(body.op==='invoke_action'||body.op==='expression')writes.push(body);}});
 await instrument(page);boundary('original-opening');await page.goto(url);await page.locator('.wiki-prose h1').waitFor();boundary('original-encounter');
 await choosePassage('.wiki-prose strong');
 const drawer=page.getByRole('complementary',{name:'Constellation authoring'});
 await drawer.getByLabel('Constellation title').fill('Native passage inquiry');await drawer.getByLabel('Constellation inquiry').fill('How do these two readings qualify each other?');
 await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Constellation frame"] option[value^="ql:"]').length>0);
 const form=await drawer.locator('[aria-label="Constellation frame"] option[value^="ql:"]').first().getAttribute('value');
 await drawer.getByLabel('Constellation frame').selectOption(form);
 await drawer.getByLabel('Role for member 1').selectOption({index:1});
 await drawer.getByRole('button',{name:'Close constellation authoring'}).click();
 await choosePassage('.wiki-prose blockquote');
 await drawer.getByLabel('Role for member 2').selectOption({index:2});
 await drawer.getByRole('button',{name:'Add connection',exact:true}).click();await drawer.getByLabel('Meaning of connection 1').fill('qualifies');
 await drawer.getByRole('button',{name:'Save constellation',exact:true}).click();
 await drawer.getByText('Saved and found through native Wiki/search.',{exact:true}).waitFor();
 let frame=savedFrame('Native passage inquiry');const wholeRef=frame.ref;
 check(frame.constellations[0].members.length===2,'Reader selection saves a native two-member constellation');
 const members=frame.constellations[0].members;
 check(members[0].ref===members[1].ref&&members[0]['aikit.constellation-participation/v1'].participation_ref!==members[1]['aikit.constellation-participation/v1'].participation_ref,'Two passages retain one source identity and two contextual participations');
 check(readFileSync(materialPath,'utf8')===before,'Constellation authoring leaves the original linked writing unchanged');
 const graph=await op({op:'graph',project:'Notes',query:'',options:{input:'aikit_resolution',fresh:true}});
 check(graph.reading.edges.some(edge=>edge.family==='ql-authored'&&edge.relation==='qualifies'),'Authored QL relation is read back through the actual Wiki graph');
 check(graph.reading.formations.some(formation=>formation.ref===wholeRef&&formation.members.length===2),'Native formation is discoverable without collapsing whole/member structure');
 await drawer.getByRole('button',{name:'Open live composition',exact:true}).click();
 await drawer.getByText('The live constellation is rendered. Select a body or relation to inspect its native identity.',{exact:true}).waitFor();
 await drawer.locator('.wiki-construction-stage').scrollIntoViewIfNeeded();
 const stageBounds=await drawer.locator('.wiki-construction-stage').boundingBox();
 check(stageBounds&&stageBounds.width>200&&stageBounds.height>150&&stageBounds.y<960,'The actual live Stage is visible in its working surface');
 await page.screenshot({path:resolve(out,'live-constellation.png')});
 await drawer.getByRole('button',{name:'Edit glyphs, text, media and motion',exact:true}).click();
 const composer=page.getByRole('region',{name:'Expression composition'});
 await page.locator('[aria-label="Expression composition"][data-expression-ref]').waitFor();
 const expressionRef=await composer.getAttribute('data-expression-ref');
 await composer.getByLabel('Entity x',{exact:true}).fill('173');await composer.getByLabel('Entity x',{exact:true}).press('Enter');
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Expression composition"] fieldset:disabled'));
 await composer.getByLabel('Glyph',{exact:true}).fill('∴');await composer.getByLabel('Glyph',{exact:true}).press('Enter');
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Expression composition"] fieldset:disabled'));
 let edited;const editDeadline=Date.now()+10000;
 do {edited=await op({op:'expression',request:{operation:'inspect',expression_ref:expressionRef}});if(Object.values(edited.data.document.entities).some(entity=>entity.parameters.x?.value===173&&entity.parameters.glyph?.value==='∴'))break;await new Promise(resolve=>setTimeout(resolve,50));}while(Date.now()<editDeadline);
 check(Object.values(edited.data.document.entities).some(entity=>entity.parameters.x?.value===173&&entity.parameters.glyph?.value==='∴'),'The production composer edits the actual 3D body and glyph');
 check(Object.keys(edited.data.document.relations).length===1,'The live Expression carries the actual native typed relationship');
 await page.getByRole('button',{name:'Return to Wiki',exact:true}).click();
 await drawer.getByText('Save and Return composition',{exact:true}).click();
 await drawer.getByLabel('Expression destination folder').fill('Work/Notes');await drawer.getByLabel('Expression filename').fill('inquiry.expression.json');
 const firstSaveResponse=page.waitForResponse(response=>response.request().method()==='POST'&&response.url().endsWith('/op')&&response.request().postDataJSON()?.request?.operation==='save_as');
 await drawer.getByRole('button',{name:'Save Expression file',exact:true}).click();
 const firstSave=await (await firstSaveResponse).json();
 assert.equal(firstSave.outcome?.data?.state,'saved',JSON.stringify(firstSave.outcome?.data));
 check(true,'Native first save confirms its actual file and independent readback');
 await drawer.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).waitFor();
 await drawer.getByRole('button',{name:'Return saved Expression to constellation',exact:true}).click();
 await drawer.getByRole('button',{name:'Returned to constellation',exact:true}).waitFor();
 const artifact=JSON.parse(readFileSync(resolve(project,'inquiry.expression.json'),'utf8'));
 check(artifact.expression_ref===expressionRef&&Object.values(artifact.entities).some(entity=>entity.parameters.x?.value===173),'The actual saved artifact preserves the human-edited composition');
 frame=savedFrame('Native passage inquiry');check(frame['aikit.constellation/v1'].compositions[0].reference===expressionRef,'The saved composition Returns to its actual native constellation');
 boundary('before-owned-bridge-stop');bridge.kill('SIGTERM');await new Promise(resolve=>bridge.once('exit',resolve));boundary('after-owned-bridge-exit');await startBridge();boundary('successor-bridge-ready-before-navigation');
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/wiki-constructive.html?bridge=${encodeURIComponent(bridgeUrl)}`);
 boundary('successor-navigation-complete');await page.locator('.wiki-prose h1').waitFor();await page.getByRole('button',{name:'Constellations',exact:true}).click();boundary('successor-encounter');
 await drawer.getByText(/expression · r/).last().click();
 await page.locator('[aria-label="Expression composition"][data-expression-ref]').waitFor();
 check(await composer.getAttribute('data-expression-ref')===expressionRef,'A returned composition reopens from its native artifact after a kernel restart');
 await page.getByRole('button',{name:'Return to Wiki',exact:true}).click();
 await drawer.getByRole('button',{name:'New inquiry',exact:true}).click();
 await drawer.getByLabel('Constellation title').fill('Frame before material');await drawer.getByLabel('Constellation inquiry').fill('What belongs in these open roles?');
 await drawer.getByLabel('Constellation frame').selectOption(form);await drawer.getByRole('button',{name:'Save constellation',exact:true}).click();
 await drawer.getByText('Saved and found through native Wiki/search.',{exact:true}).waitFor();
 check(savedFrame('Frame before material').constellations[0].members.length===0,'Frame-first creation retains genuinely open roles');
 await drawer.getByRole('button',{name:'Close constellation authoring'}).click();await choosePassage('.wiki-prose strong');
 const prior=readFileSync(wikiPath,'utf8');
 const changeControlledSource=()=>{sourceMaterial[0].binding.revision='r2';sourceMaterial[0].body=sourceText+'\nChanged externally.\n';writeFileSync(materialPath,JSON.stringify(sourceMaterial));};
 let heldRequest;
 const matchesConflictRequest=request=>{if(request.method()!=='POST'||!request.url().endsWith('/op'))return false;const body=request.postDataJSON();return body?.op==='invoke_action'&&body.invocation?.action==='aikit.constellation.apply'&&body.invocation?.input?.sources?.some(source=>source.source_ref==='source:a'&&source.revision==='r1');};
 let conflictReply;
 if(nativeConflictRace){
   await page.route(`${bridgeUrl}/op`,async route=>{if(!heldRequest&&matchesConflictRequest(route.request())){heldRequest=route.request().postDataJSON();changeControlledSource();}await route.continue();});
   conflictReply=page.waitForResponse(response=>matchesConflictRequest(response.request())).then(response=>response.json());
   // Keep early cleanup/failure from leaving an unobserved rejection; awaiting
   // the original promise below still preserves its actual timeout/error.
   void conflictReply.catch(()=>{});
 }else changeControlledSource();
 await drawer.getByRole('button',{name:'Save constellation',exact:true}).click();await drawer.getByRole('alert').filter({hasText:'Source changed'}).waitFor();
 if(nativeConflictRace){
   const raw=await conflictReply,dispatch=raw.outcome?.dispatch;
   check(raw.ok===true&&raw.outcome?.result==='action_dispatched'&&dispatch?.state==='owner_refused'&&dispatch.owner_operation==='aikit wiki-construct apply'&&dispatch.message==='source_revision_conflict: source:a changed or was redirected; inspect and reconcile','The unchanged actual native request is refused on its exact source basis');
   const alert=drawer.getByRole('alert').filter({hasText:'Source changed'});
   check(await alert.getAttribute('data-dispatch-state')==='owner_refused'&&await alert.getAttribute('data-native-error-code')==='source_revision_conflict'&&(await alert.innerText()).includes(dispatch.message),'Clear conflict feedback preserves native state, classification and exact owner diagnostic');
   const retained=await page.evaluate(()=>JSON.parse(localStorage.getItem('oi-cradle.knowledge-travel.v1:native-wiki-page')).construction);
   check(JSON.stringify(retained.pending)===JSON.stringify(heldRequest.invocation.input.request)&&retained.draft.members.length===1&&retained.saved===false,'The refused request and operation identity remain exact in durable recovery');
   check(await drawer.getByRole('button',{name:'Save constellation',exact:true}).isDisabled()&&await drawer.getByRole('button',{name:'Inspect saved state',exact:true}).isEnabled(),'Refusal requires inspection before editing or replaying');
   receipt.nativeConflict={request:heldRequest,response:raw,pending:retained.pending,scope:'Real native refusal; controlled material changed after UI preflight; no owner response replaced.'};
   await page.unroute(`${bridgeUrl}/op`);
 }
 check(readFileSync(wikiPath,'utf8')===prior,'A stale source selection is refused without changing the saved constellation');
 boundary('before-refused-proposal-reload');await page.reload();boundary('after-refused-proposal-reload');await page.getByRole('button',{name:'Constellations',exact:true}).click();
 check(await drawer.locator('.wiki-construction-members li').count()===1,'The refused proposal survives reload for reconciliation');
 await page.setViewportSize({width:420,height:800});await page.screenshot({path:resolve(out,'narrow-recovery.png')});
 boundary('before-original-no-page-error-gate');check(errors.length===0,`No uncaught UI errors (${errors.join('; ')})`);
 receipt.passed=true;receipt.expression_ref=expressionRef;receipt.frame_ref=wholeRef;receipt.operations=writes.length;
 console.log(JSON.stringify(receipt));
}catch(error){receipt.failure={message:String(error),errors,responses,lastWrites:writes.slice(-4),authoring:page?await page.locator('.wiki-construction').innerText().catch(()=>null):null};console.error(JSON.stringify(receipt.failure));if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{boundary('cleanup-before-browser-close');if(restartDiagnostics){receipt.restart_diagnostics={ref:'restart-diagnostic.json',rows:trace.rows.length,bytes:trace.bytes,dropped:trace.dropped,pending_at_cleanup:[...pendingRequests.values()],pending_bytes:pendingBytes,pending_untracked:trace.pendingOverflow};writeFileSync(resolve(out,'restart-diagnostic.json'),JSON.stringify(trace,null,2)+'\n');}writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');writeFileSync(resolve(out,'kernel.log'),logs.join(''));if(browser)await browser.close();if(server)await server.close();bridge?.kill('SIGTERM');}
