// Real native Create/Edit/Inspect -> local production projection -> the
// complete production providers and renderer -> browser/AX/exact selection.
// The owner must be a disposable real kernel bridge; no request interception,
// replacement contexts, captured fixture, skipped owner or synthetic document.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {eventsSince,subscribeTopic} from '../src/kernel/bridge.ts';
import {projectExpression as canonicalProjectExpression} from '../../../shared-field/expression-projection.mjs';

// Independent prior-source discrimination uses the actual retained publisher
// implementation; native operations and their source readings stay identical.
const projectExpression=process.env.OI_EXPRESSION_PROJECTION_SOURCE?(await import(pathToFileURL(process.env.OI_EXPRESSION_PROJECTION_SOURCE).href)).projectExpression:canonicalProjectExpression;

const bridge=process.env.OI_KERNEL_BRIDGE;
assert.ok(bridge,'OI_KERNEL_BRIDGE must name a disposable, real native kernel owner');
// Diagnostic records share a strict count/byte budget; native responses are
// never copied wholesale and Playwright response.body() is never called.
const nativeExchanges=[];
const diagnosticBudget={max_records:512,max_bytes:256*1024,retained_records:0,retained_bytes:0,dropped_records:0,dropped_bytes:0};
const boundedText=value=>typeof value==='string'?value.slice(0,1024):null;
const boundedRevision=value=>typeof value==='number'&&Number.isSafeInteger(value)?value:null;
const traceHeaders=headers=>Object.fromEntries(['content-type','content-length','access-control-allow-origin','connection','cache-control'].map(key=>[key,boundedText(headers[key])]));
const retainTrace=(bucket,value)=>{try{const encoded=JSON.stringify(value),bytes=Buffer.byteLength(encoded);if(diagnosticBudget.retained_records>=diagnosticBudget.max_records||diagnosticBudget.retained_bytes+bytes>diagnosticBudget.max_bytes){diagnosticBudget.dropped_records++;diagnosticBudget.dropped_bytes+=bytes;return;}bucket.push(value);diagnosticBudget.retained_records++;diagnosticBudget.retained_bytes+=bytes;}catch{diagnosticBudget.dropped_records++;}};
const native=async request=>{
 const started_at=new Date().toISOString();
 const response=await fetch(`${bridge}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request}),signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200);
 const reply=await response.json();assert.equal(reply.ok,true,reply.error);
 try{retainTrace(nativeExchanges,{operation:boundedText(request.operation),expression_ref:boundedText(request.expression_ref),expected_revision:boundedRevision(request.expected_revision),status:response.status,headers:traceHeaders(Object.fromEntries(response.headers)),started_at,completed_at:new Date().toISOString(),readback_ref:boundedText(reply.outcome?.data?.document?.expression_ref),readback_revision:boundedRevision(reply.outcome?.data?.document?.revision)});}catch{diagnosticBudget.dropped_records++;}
 assert.equal(reply.outcome.result,'expression');assert.equal(reply.outcome.data.state,'ready');
 return reply.outcome.data.document;
};
const actor='human:desktop-presentation-native-check',ref=`expression:presentation-acceptance-${randomUUID()}`;
let document=await native({operation:'create',expression_ref:ref,title:'Continue one shared undertaking',actor});
const guide={ref:'world:shared-expression:ann/artifact:shared-continuation-guide',title:'Shared continuation guide'};
const longTitle='A shared guide with enough context to remain distinguishable — '+Array(10).fill('continuation and concurrent proposals').join(' · ');
const bound=[
 {ref:guide.ref,title:guide.title},
 {ref:'central:source:control:root:Control/agents/now/flows/c654e76cad0c3f65bbab45c895996faeeb9bd95f70e9ff5a09511f05d24eef44.json',title:longTitle},
 {ref:'world:shared-expression:ann/agent:expressed-88d11962e8c34c2ea8209169c93f7012',title:'world:shared-expression:ann/agent:expressed-88d11962e8c34c2ea8209169c93f7012'},
];
const changes=bound.flatMap((subject,index)=>[
 {change:'entity_add',scene_ref:document.scenes[0].scene_ref,entity_ref:`${ref}:entity:${index}`,title:subject.title},
 {change:'subject_bind',entity_ref:`${ref}:entity:${index}`,binding:{subject_ref:subject.ref,native_owner:'central',presentation_role:index===2?'being':'thing',sources:[],readings:[],actions:[]}},
]);
document=await native({operation:'edit',expression_ref:ref,expected_revision:document.revision,actor,changes});
const readback=await native({operation:'inspect',expression_ref:ref});
assert.deepEqual(readback,document,'The rendered source is the exact native saved document');
const transport={kind:'bridge',url:bridge};
assert.ok((await eventsSince(transport,1)).length>0,'The actual native saved operations produced ordered events');
const disposedReceipts=[];
const disposedSubscription=await subscribeTopic(transport,receipt=>disposedReceipts.push(receipt));
assert.ok(disposedSubscription,'The actual native event subscription opened');
disposedSubscription.unsubscribe();
await eventsSince(transport,1);
await new Promise(resolve=>setTimeout(resolve,250));
assert.deepEqual(disposedReceipts,[],'Disposal cancels the pending native read and prevents late receipts');
const bundle=projectExpression({document:readback,world_ref:`world:${ref}`,field_ref:`oi:field:${ref}`,projection_ref:`projection:${ref}`,publisher:{identity_ref:actor,chosen_name:'Presentation reviewer'},audience:{visibility:'public'}});
if(process.env.OI_PRESENTATION_EVIDENCE){await mkdir(process.env.OI_PRESENTATION_EVIDENCE,{recursive:true});await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/native-saved-source.json`,JSON.stringify(readback,null,2));await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/production-publication.json`,JSON.stringify(bundle,null,2));}
const cards=bundle.presentation.regions.flatMap(region=>region.bindings).filter(binding=>binding.component_ref==='oi.presentation/reference-card/v1');
assert.equal(cards[0].props.title,guide.title,'The publisher must publish the native human title');
assert.equal(cards[1].props.title,longTitle,'The publisher must preserve the full long authored title');
assert.match(cards[2].props.title,/^Unnamed subject \d+$/,'A missing human name remains truthful and distinguishable');
for(const subject of bound)assert.ok(cards.some(card=>card.subject_ref===subject.ref&&card.props.refs.includes(subject.ref)),'Publication retains each exact native binding');

const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
server.middlewares.use('/presentation-native/input',(_request,response)=>{response.setHeader('content-type','application/json');response.end(JSON.stringify({presentation:bundle.presentation,document:readback}));});
server.middlewares.use('/presentation-native',async(_request,response)=>{response.setHeader('content-type','text/html');response.end(await server.transformIndexHtml('/presentation-native','<!doctype html><html><body class="oi-desktop"><div id="root"></div><script type="module" src="/tests/presentation-readable-native-page.tsx"></script></body></html>'));});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const browsers=[];
try{
 await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/presentation-native`;
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true,...(name==='webkit'&&process.env.OI_WEBKIT_EXECUTABLE?{executablePath:process.env.OI_WEBKIT_EXECUTABLE}:{})});browsers.push(browser);
  const context=await browser.newContext({viewport:{width:1200,height:900}});
  await context.addInitScript(endpoint=>{if(window.top!==window)return;window.__OI_KERNEL_BRIDGE__=endpoint;localStorage.setItem('oi-cradle.visuals.v1',JSON.stringify({enabled:false,welcomeEnabled:false}));},bridge);
  // Observation only: actual platform methods execute with their original
  // receiver/arguments; their result/exception is returned unchanged. Post-call
  // observations cannot throw, coerce object reasons or re-read input iterables.
  await context.addInitScript(()=>{
   if(window.top!==window)return;
   const apply=Reflect.apply,getDescriptor=Object.getOwnPropertyDescriptor;
   const signals=new WeakMap();let nextSignal=0,records=0,bytes=0,capped=false;
   const small=value=>typeof value==='string'?value.slice(0,2048):null;
   const signalId=signal=>{if(!signals.has(signal))signals.set(signal,++nextSignal);return signals.get(signal);};
   const controllerSignal=getDescriptor(AbortController.prototype,'signal')?.get;
   const signalAborted=getDescriptor(AbortSignal.prototype,'aborted')?.get,signalReason=getDescriptor(AbortSignal.prototype,'reason')?.get;
   const exceptionName=getDescriptor(DOMException.prototype,'name')?.get,exceptionMessage=getDescriptor(DOMException.prototype,'message')?.get;
   const reasonValue=reason=>{
    const kind=typeof reason;if(reason===null||kind==='string'||kind==='boolean')return {kind,value:kind==='string'?small(reason):reason};
    if(kind==='number')return {kind,value:Number.isFinite(reason)?reason:null};
    if(kind==='object'){try{return {kind:'native-dom-exception',name:small(apply(exceptionName,reason,[])),message:small(apply(exceptionMessage,reason,[]))};}catch{}}
    return {kind}; // Other values remain opaque; no toString or object getters.
   };
   const stackValue=()=>{try{return small(getDescriptor(new Error(),'stack')?.value);}catch{return null;}};
   const emit=(event,details={})=>{try{
    if(capped)return;
    const text=JSON.stringify({event,realm:performance.timeOrigin,elapsed_ms:performance.now(),url:small(location.href),ready_state:document.readyState,visibility:document.visibilityState,...details});
    const size=new TextEncoder().encode(text).byteLength;
    if(records>=256||bytes+size>128*1024){capped=true;console.debug('__OI_NATIVE_PAGE_DIAGNOSTIC__'+JSON.stringify({event:'diagnostic-emission-capped',realm:performance.timeOrigin,retained_records:records,retained_bytes:bytes,max_records:256,max_bytes:128*1024}));return;}
    records++;bytes+=size;console.debug('__OI_NATIVE_PAGE_DIAGNOSTIC__'+text);
   }catch{}};
   for(const event of ['beforeunload','pagehide','pageshow','visibilitychange'])addEventListener(event,value=>{try{emit(event,{persisted:typeof value.persisted==='boolean'?value.persisted:null});}catch{}},true);
   emit('init');
   try{
    const descriptor=getDescriptor(AbortController.prototype,'abort'),actual=descriptor?.value;
    if(typeof actual==='function'&&descriptor.configurable)Object.defineProperty(AbortController.prototype,'abort',{...descriptor,value:function(...args){const result=apply(actual,this,args);try{const signal=apply(controllerSignal,this,[]);emit('abort',{signal:signalId(signal),aborted:apply(signalAborted,signal,[]),reason:reasonValue(apply(signalReason,signal,[])),stack:stackValue()});}catch{}return result;}});
   }catch{emit('abort-observer-unavailable');}
   try{
    const descriptor=getDescriptor(AbortSignal,'any'),actual=descriptor?.value;
    if(typeof actual==='function'&&descriptor.configurable)Object.defineProperty(AbortSignal,'any',{...descriptor,value:function(...args){const result=apply(actual,this,args);try{emit('signal-any',{signal:signalId(result),aborted:apply(signalAborted,result,[]),reason:reasonValue(apply(signalReason,result,[])),stack:stackValue()});}catch{}return result;}});
   }catch{emit('signal-any-observer-unavailable');}
  });
  const page=await context.newPage(),errors=[],failedRequests=[],errorDetails=[],lifetimes=[],nativeNetwork=[];let phase='initial reading',requestSequence=0,pageErrorsSeen=0;
  const requestIds=new WeakMap(),stamp=()=>({phase,observed_at:new Date().toISOString()});
  const nativeRequest=request=>request.url().startsWith(bridge+'/');
  const requestId=request=>{if(!requestIds.has(request))requestIds.set(request,++requestSequence);return requestIds.get(request);};
  const observe=fn=>{try{fn();}catch{retainTrace(nativeNetwork,{...stamp(),event:'diagnostic-observer-error'});}};
  page.on('console',message=>observe(()=>{const text=message.text(),prefix='__OI_NATIVE_PAGE_DIAGNOSTIC__';if(text.startsWith(prefix)){if(text.length>8192){diagnosticBudget.dropped_records++;diagnosticBudget.dropped_bytes+=Buffer.byteLength(text);return;}retainTrace(lifetimes,{...stamp(),...JSON.parse(text.slice(prefix.length))});}}));
  page.on('pageerror',error=>{pageErrorsSeen++;if(!errors.length)errors.push(boundedText(error.message)??'Browser page error with a non-string message');observe(()=>retainTrace(errorDetails,{...stamp(),message:boundedText(error.message),stack:boundedText(error.stack)}));});
  page.on('request',request=>observe(()=>{if(nativeRequest(request))retainTrace(nativeNetwork,{...stamp(),event:'request',id:requestId(request),url:boundedText(request.url()),method:boundedText(request.method()),headers:traceHeaders(request.headers()),post_data_prefix:boundedText(request.postData()),frame_url:boundedText(request.frame().url())});}));
  page.on('requestfinished',request=>observe(()=>{if(nativeRequest(request))retainTrace(nativeNetwork,{...stamp(),event:'requestfinished',id:requestId(request),url:boundedText(request.url()),timing:request.timing()});}));
  page.on('requestfailed',request=>observe(()=>{retainTrace(failedRequests,{...stamp(),url:boundedText(request.url()),error_text:boundedText(request.failure()?.errorText)});if(nativeRequest(request))retainTrace(nativeNetwork,{...stamp(),event:'requestfailed',id:requestId(request),url:boundedText(request.url()),error_text:boundedText(request.failure()?.errorText),timing:request.timing()});}));
  // Status/CORS/timing are observed synchronously. No extra response-body
  // allocation or pending asynchronous response-reader exists in this version.
  page.on('response',response=>observe(()=>{const request=response.request();if(nativeRequest(request))retainTrace(nativeNetwork,{...stamp(),event:'response',id:requestId(request),url:boundedText(response.url()),status:response.status(),headers:traceHeaders(response.headers()),timing:request.timing()});}));
  const retainDiagnostics=async point=>{
   if(!process.env.OI_PRESENTATION_EVIDENCE)return;
   await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}-diagnostics.json`,JSON.stringify({schema:'oi.native-presentation-reopening-diagnostic/v2',point,browser:name,bridge,page_url:page.url(),phase,errors,page_errors_seen:pageErrorsSeen,errorDetails,failedRequests,lifetimes,nativeNetwork,nativeExchanges,diagnostic_budget:diagnosticBudget,pending_response_reads:0,native_readback:{file:'native-saved-source.json',expression_ref:ref,revision:readback.revision,post_reopening_equality_gate:point==='before unchanged no-page-error gate'},scope:'Timing-instrumented diagnosis of the original real-owner driver. No response-body reader, fabricated response, installed or whole-world acceptance.'},null,2));
  };
  try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('heading',{name:guide.title,exact:true}).first().waitFor();}
  catch(error){
   await retainDiagnostics('opening failed');
   if(process.env.OI_PRESENTATION_EVIDENCE){await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}-failure.json`,JSON.stringify({error:String(error),errors,failedRequests,html:await page.content()},null,2));await page.screenshot({path:`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}-failure.png`,fullPage:true});}
   throw error;
  }
  const visibleText=async()=>page.evaluate(()=>{
   const closed=element=>{for(let node=element;node;node=node.parentElement){if(node.tagName==='DETAILS'&&!node.open&&!node.querySelector(':scope > summary')?.contains(element))return true;}return false;};
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);const parts=[];
   while(walker.nextNode()){const parent=walker.currentNode.parentElement;if(parent&&!closed(parent)&&getComputedStyle(parent).display!=='none'&&!['SCRIPT','STYLE'].includes(parent.tagName))parts.push(walker.currentNode.textContent);}
   for(const element of document.querySelectorAll('[aria-label],[title]'))if(!closed(element))parts.push(element.getAttribute('aria-label')??'',element.getAttribute('title')??'');
   return parts.join(' ');
  });
  let text=await visibleText();
  let announced=await page.locator('body').ariaSnapshot();
  for(const identity of [ref,...bound.map(subject=>subject.ref),document.scenes[0].scene_ref])check(!text.includes(identity),`${name}: ordinary text/announced names do not substitute canonical identity for meaning`);
  for(const identity of [ref,...bound.map(subject=>subject.ref),document.scenes[0].scene_ref])check(!announced.includes(identity),`${name}: default accessibility tree does not announce canonical identities`);
  check(text.includes(guide.title)&&text.includes(longTitle),`${name}: native names and long title survive default reading`);
  check(/Unnamed subject \d+/.test(text),`${name}: missing native human name has a truthful numbered state`);
  const frame=page.frameLocator('iframe.world-expression__frozen');await frame.getByRole('heading',{name:document.title,exact:true}).waitFor();
  check(!(await frame.locator('body').innerText()).includes(ref),`${name}: saved frame contains readable generated chrome`);
  const frameNames=await frame.locator('body').ariaSnapshot();
  for(const identity of [ref,...bound.map(subject=>subject.ref)])check(!frameNames.includes(identity),`${name}: saved-frame accessibility names do not announce canonical identities`);
  const nativeCard=page.locator('[data-component-ref="oi.presentation/reference-card/v1"][data-subject-ref]').filter({has:page.getByRole('heading',{name:guide.title,exact:true})});
  await nativeCard.getByRole('button',{name:guide.title,exact:true}).click();
  const opened=page.getByRole('status',{name:'Selected subject target'});await opened.waitFor();
  check(await opened.getAttribute('data-selected-ref')===guide.ref,`${name}: named card dispatches the exact source binding to onOpenRef`);
  await page.getByRole('button',{name:'Back to shared work'}).click();
  await nativeCard.locator('details').first().locator('summary').click();
  check((await nativeCard.innerText()).includes(guide.ref),`${name}: deliberate disclosure recovers the original identity`);
  phase='reopening';await page.reload();await page.getByRole('heading',{name:guide.title,exact:true}).first().waitFor();
  text=await visibleText();check(!text.includes(guide.ref)&&text.includes(guide.title),`${name}: reopened reading starts with human names and closed source details`);
  announced=await page.locator('body').ariaSnapshot();check(!announced.includes(guide.ref)&&announced.includes(guide.title),`${name}: reopened accessibility tree retains names and closed source details`);
  const retained=await native({operation:'inspect',expression_ref:ref});check(JSON.stringify(retained)===JSON.stringify(readback),`${name}: reading/opening/reopening did not change native source`);
  await retainDiagnostics('before unchanged no-page-error gate');
  if(errors.length&&process.env.OI_PRESENTATION_EVIDENCE){await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}-failure.json`,JSON.stringify({errors,errorDetails,failedRequests,html:await page.content()},null,2));await page.screenshot({path:`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}-failure.png`,fullPage:true});}
  check(errors.length===0,`${name}: production providers/renderer mounted without browser errors: ${errors.join('; ')}`);
  if(process.env.OI_PRESENTATION_EVIDENCE){await mkdir(process.env.OI_PRESENTATION_EVIDENCE,{recursive:true});await page.screenshot({path:`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}.png`,fullPage:true});await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}.aria.txt`,await page.locator('body').ariaSnapshot());}
  await context.close();await browser.close();
 }
 console.log(`PASS ${checks} native saved composition -> local production projection -> browser text/AX, exact onOpenRef selection, deliberate disclosure and reopen checks in Chromium and WebKit. Hosted publication, target-owner opening and installed acceptance remain separate.`);
}finally{for(const browser of browsers)await browser.close();await server.close();}
