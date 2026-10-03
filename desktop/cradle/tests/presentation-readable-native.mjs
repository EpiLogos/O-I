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
const native=async request=>{
 const response=await fetch(`${bridge}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'expression',request}),signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200);
 const reply=await response.json();assert.equal(reply.ok,true,reply.error);
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
const server=await createServer({root,appType:'custom',server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false},logLevel:'error'});
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
  const page=await context.newPage(),errors=[],failedRequests=[],errorDetails=[];let phase='initial reading';page.on('pageerror',error=>{errors.push(error.message);errorDetails.push({phase,message:error.message,stack:error.stack});});page.on('requestfailed',request=>failedRequests.push({phase,url:request.url(),error:request.failure()}));
  const frame=page.frameLocator('iframe.world-expression__frozen');
  try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await frame.getByRole('heading',{name:document.title,exact:true}).waitFor();}
  catch(error){
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
  const undertaking=page.locator('.world-expression__edition-context');
  check(await undertaking.getAttribute('open')===null,`${name}: saved edition starts with its own body and closed undertaking depth`);
  await undertaking.locator(':scope > summary').click();
  await page.getByRole('heading',{name:guide.title,exact:true}).first().waitFor();
  text=await visibleText();
  check(text.includes(guide.title)&&text.includes(longTitle),`${name}: deliberately opened undertaking depth retains the native names and full title`);
  check(/Unnamed subject \d+/.test(text),`${name}: missing native human name has a truthful numbered state`);
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
  phase='reopening';await page.reload();await frame.getByRole('heading',{name:document.title,exact:true}).waitFor();
  check(await undertaking.getAttribute('open')===null,`${name}: reopened saved edition retains its body and closed undertaking depth`);
  text=await visibleText();check(!text.includes(guide.ref),`${name}: reopened reading keeps source details closed`);
  await undertaking.locator(':scope > summary').click();
  text=await visibleText();check(!text.includes(guide.ref)&&text.includes(guide.title),`${name}: reopened deliberate depth retains the native human name`);
  announced=await page.locator('body').ariaSnapshot();check(!announced.includes(guide.ref)&&announced.includes(guide.title),`${name}: reopened accessibility tree retains names and closed source details`);
  const retained=await native({operation:'inspect',expression_ref:ref});check(JSON.stringify(retained)===JSON.stringify(readback),`${name}: reading/opening/reopening did not change native source`);
  if(errors.length&&process.env.OI_PRESENTATION_EVIDENCE){await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}-failure.json`,JSON.stringify({errors,errorDetails,failedRequests,html:await page.content()},null,2));await page.screenshot({path:`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}-failure.png`,fullPage:true});}
  check(errors.length===0,`${name}: production providers/renderer mounted without browser errors: ${errors.join('; ')}`);
  if(process.env.OI_PRESENTATION_EVIDENCE){await mkdir(process.env.OI_PRESENTATION_EVIDENCE,{recursive:true});await page.screenshot({path:`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}.png`,fullPage:true});await writeFile(`${process.env.OI_PRESENTATION_EVIDENCE}/native-readable-${name}.aria.txt`,await page.locator('body').ariaSnapshot());}
  await context.close();await browser.close();
 }
 console.log(`PASS ${checks} native saved composition -> local production projection -> browser text/AX, exact onOpenRef selection, deliberate disclosure and reopen checks in Chromium and WebKit. Hosted publication, target-owner opening and installed acceptance remain separate.`);
}finally{for(const browser of browsers)await browser.close();await server.close();}
