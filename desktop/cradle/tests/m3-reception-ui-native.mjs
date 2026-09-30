#!/usr/bin/env node
/** Production Nara instrument and channel -> real native M3/current owners.
 * Source-mounted UI proof; retained GPU and installed app are separate runs.
 * node tests/nara-m3-ui-native.mjs /absolute/native-config.json /absolute/output
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import {createServer,optimizeDeps} from 'vite';
import {chromium} from 'playwright';
import {closeControlledExpression} from './nara-native-cleanup.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8')),output=process.argv[3];
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(config.binding.person_ref,/^controlled:/);assert.ok(path.isAbsolute(output)&&output.includes('/T/'));
await mkdir(output,{recursive:true});
const exchanges=[],checks=[],errors=[];
const native=async request=>{
 const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(180000)});
 const result=await response.json();exchanges.push({request,result});
 await writeFile(path.join(output,'native-exchanges.json'),JSON.stringify(exchanges,null,2));
 if(result.error)throw Error(result.error);assert.ok(result.outcome);return result.outcome.data;
};
const original=await native({op:'expression',request:{operation:'inspect',expression_ref:config.binding.expression_ref}});
const expression_ref='expression:controlled-m3-ui-'+randomUUID();
const fork=await native({op:'expression',request:{operation:'fork',expression_ref:original.document.expression_ref,expected_revision:original.document.revision,new_expression_ref:expression_ref,actor:'agent:nara-m3-ui-verification'}});
const saved=await native({op:'nara_identity',request:{operation:'open',source_ref:config.binding.source_ref}});
// A distinct controlled profile prevents this UI's explicit Save from moving
// another live replay's identity revision. All determinants remain native.
const suffix=':m3-ui:'+randomUUID();
const profile={...saved.reading.profile,person_ref:saved.reading.person_ref+suffix,nara_ref:saved.reading.nara_ref+suffix};
const identity=await native({op:'nara_identity',request:{operation:'save',profile,source_ref:null,expected_revision:null}});
const parentModule=`
import {kernelOp} from '/src/kernel/bridge.ts';
import {relayNaraChannel} from '/src/expressions/naraChannel.ts';
import {relayKernelChannel} from '/src/expressions/hostedApp.ts';
const transport={kind:'bridge',url:${JSON.stringify(config.bridge)}};
window.documentReading=${JSON.stringify(fork.document)};
const frame=document.querySelector('iframe');
relayKernelChannel(frame,transport);
relayNaraChannel(frame,transport,{project:()=>${JSON.stringify(config.project)},expression:()=>window.documentReading});
window.acceptDocument=async value=>{
 const response=await kernelOp(transport,{op:'expression',request:{operation:'inspect',expression_ref:value.expression_ref}});
 if(response.error||response.outcome?.data.document.revision!==value.revision)throw Error(response.error??'Native revision changed');
 window.documentReading=response.outcome.data.document;
};
frame.src='/m3-child';`;
const childModule=`
import {installNaraInstrument} from '/expressions-app/field-studies-journeys/src/naraInstrument.tsx';
import {installKernelExpressions} from '/expressions-app/field-studies-journeys/src/kernelExpressions.ts';
import {kernelDocumentToJourney} from '/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {naraFormGeometry} from '/expressions-app/field-studies-journeys/src/naraFormField.ts';
installKernelExpressions();
const view=()=>kernelDocumentToJourney(parent.documentReading);
window.presentedGeometry=null;
installNaraInstrument({nativeView:view,sceneId:()=>view().startSceneId,acceptNativeDocument:value=>parent.acceptDocument(value),
 presentForm:reading=>{window.presentedGeometry=reading?naraFormGeometry(reading,view(),view().startSceneId):null;}});`;
const server=await createServer({configFile:false,root:process.cwd(),cacheDir:path.join(output,'vite-cache'),server:{host:'127.0.0.1',port:0,hmr:false},optimizeDeps:{noDiscovery:true,entries:[],include:['react','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']},resolve:{dedupe:['react','react-dom']},esbuild:{jsx:'automatic'},plugins:[{name:'native-m3-ui',configureServer(server){server.middlewares.use((req,res,next)=>{
 const route=req.url?.split('?')[0];
 if(route==='/m3-parent'||route==='/m3-child'){res.setHeader('Content-Type','text/html');res.end(route==='/m3-parent'?'<iframe style="width:100%;height:1200px"></iframe><script type="module" src="/m3-parent.js"></script>':'<div id="app"><header class="header-actions"></header></div><script type="module" src="/m3-child.js"></script>');}
 else if(route==='/m3-parent.js'||route==='/m3-child.js'){res.setHeader('Content-Type','application/javascript');res.end(route==='/m3-parent.js'?parentModule:childModule);}else next();
 });}}]});
let browser,page;
try{
 await optimizeDeps(server.config);await server.listen();browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1400,height:1280}});
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(server.resolvedUrls.local[0]+'m3-parent',{waitUntil:'commit'});
 const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'Nara',exact:true}).click({timeout:90000});
 await frame.getByLabel('Saved profiles',{exact:true}).selectOption(identity.source.source_ref);
 await frame.getByRole('button',{name:'Save and use identity',exact:true}).click({timeout:90000});
 await frame.getByText('Saved. This identity is selected for the Expression.',{exact:true}).waitFor({timeout:90000});
 const selected=await native({op:'nara_identity',request:{operation:'open',source_ref:identity.source.source_ref}});
 const binding={...config.binding,operation:'context',role:'nara',expression_ref,source_ref:selected.source.source_ref,expected_revision:selected.source.revision,person_ref:profile.person_ref,nara_ref:profile.nara_ref};
 const read=()=>native({op:'m3_reception',project:config.project,request:{operation:'read',binding}});
 await frame.getByRole('button',{name:'Composition',exact:true}).click();
 await frame.getByLabel('Sky date and time UTC',{exact:true}).fill('2026-09-27T12:00:00');
 await frame.getByRole('button',{name:'Read this dated sky',exact:true}).click();
 await frame.getByText(/Sky at 2026-09-27T12:00:00Z/).waitFor({timeout:180000});
 const pinned=await native({op:'nara_current',project:config.project,request:{operation:'read',binding}});
 assert.ok(pinned.reading.baseline_available,'Use a real selected composition profile for this replay');
 await frame.getByRole('button',{name:'Form and clock',exact:true}).click();
 assert.equal((await read()).status,'absent');
 await frame.getByLabel('Opening form address',{exact:true}).selectOption('0');
 await frame.getByLabel('Opening pose',{exact:true}).selectOption('0');
 await frame.getByLabel('Opening static aperture',{exact:true}).selectOption('0');
 await frame.getByLabel('Opening matrix axis',{exact:true}).selectOption('0');
 await frame.getByLabel('Opening clock step',{exact:true}).fill('359');
 await frame.getByLabel('Opening transcription',{exact:true}).selectOption('dna');
 await frame.getByRole('button',{name:'Open this native form',exact:true}).click();
 await frame.getByRole('button',{name:'Apply native operation',exact:true}).waitFor({timeout:180000});
 const first=await read();assert.equal(first.state.identity.profile_generation,0);assert.equal(first.activity_admitted,false);
 checks.push('Actual dated sky and explicit UI selections open one native form without an implicit activity policy');
 const apply=async(address,generation)=>{
  await frame.getByLabel('Form operation',{exact:true}).selectOption('select-form');
  await frame.getByLabel('Form address · 0–63',{exact:true}).fill(String(address));
  await frame.getByRole('button',{name:'Apply native operation',exact:true}).click();
  await frame.getByRole('status').filter({hasText:'generation '+generation}).waitFor({timeout:180000});
  const actual=await read();assert.equal(actual.state.form.address,address);assert.equal(actual.state.identity.profile_generation,generation);return actual;
 };
 const previous=await apply(17,1);assert.equal(previous.activity_admitted,false);
 await frame.getByText('Include subsequent operations in activity',{exact:true}).click();
 await frame.getByRole('button',{name:'Enable activity for subsequent operations',exact:true}).click();
 await frame.getByRole('button',{name:'Enable activity for subsequent operations',exact:true}).waitFor({state:'detached',timeout:180000});
 const enabled=await read();assert.deepEqual(enabled.state,previous.state);assert.equal(enabled.activity.turn_count,0);
 const changed=await apply(42,2);assert.equal(changed.activity.turn_count,1);assert.equal(changed.activity_admitted,true);
 const current=await native({op:'nara_current',project:config.project,request:{operation:'read',binding}});
 assert.deepEqual(current.reading.identity,pinned.reading.identity);assert.deepEqual(current.reading.transit,pinned.reading.transit);assert.ok(current.reading.q_composed);
 checks.push('Actual UI policy selection preserves prior history; only the subsequent native operation changes activity and leaves natal and sky unchanged');
 await frame.getByRole('button',{name:'Present native hinge on selected formation',exact:true}).click();
 const child=page.frames().find(value=>value.url().includes('/m3-child'));assert.ok(child);
 await child.waitForFunction(()=>window.presentedGeometry!==null,{timeout:90000});
 const geometry=await child.evaluate(()=>window.presentedGeometry);
 assert.deepEqual(geometry.points,changed.state.form.hinge_geometry.points.map(point=>point.xyz));
 await frame.getByRole('button',{name:'Return to the Expression',exact:true}).click();
 assert.deepEqual((await read()).state,changed.state);
 await frame.getByRole('button',{name:'Nara',exact:true}).click();
 await frame.getByRole('button',{name:'Form and clock',exact:true}).click();
 await frame.getByRole('button',{name:'Read current form',exact:true}).click();
 await frame.getByRole('status').filter({hasText:'generation 2'}).waitFor({timeout:90000});
 assert.deepEqual((await read()).state,changed.state);
 await frame.getByRole('button',{name:'Restore authored formation',exact:true}).click();
 assert.equal(await child.evaluate(()=>window.presentedGeometry),null);
 checks.push('Native hinge coordinates reach the actual projection receiver; hide/re-entry preserves generation and explicit release clears presentation');
 await frame.getByLabel('Form address · 0–63',{exact:true}).fill('64');
 await frame.getByRole('button',{name:'Apply native operation',exact:true}).click();
 await frame.getByRole('alert').waitFor({timeout:90000});assert.deepEqual((await read()).state,changed.state);
 assert.deepEqual((await native({op:'nara_identity',request:{operation:'open',source_ref:selected.source.source_ref}})).source,selected.source);
 checks.push('Invalid form is refused through the native owner and leaves form, activity and saved identity unchanged');
 assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'native-form-ui.png'),fullPage:true});
 const files=['tests/nara-m3-ui-native.mjs','src/nara/nativeM3.ts','src/expressions/naraChannel.ts','expressions-app/field-studies-journeys/src/naraM3.tsx','expressions-app/field-studies-journeys/src/naraInstrument.tsx','expressions-app/field-studies-journeys/src/naraFormField.ts'];
 const sources=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
 await writeFile(path.join(output,'receipt.json'),JSON.stringify({schema:'oi.m3-reception-ui-native-verification/v1',checks,sources,expression_ref,first,enabled,changed,geometry,limits:['Production source-mounted Nara UI, relay and native owner; retained GPU and installed app proofs are separate','Controlled identity remains as explicit saved native test material in the controlled World']},null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,output}));
}catch(error){await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(output,'failure.json'),JSON.stringify({error:String(error),errors,checks},null,2));throw error;}
finally{await browser?.close();await closeControlledExpression(server,config.bridge,expression_ref,output,'Native M3 UI replay');await server.close();}
