/** Actual embedded application and relay with WebGL/audio. The protocol source is
 * controlled test data, not native numerical or installed-device evidence. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from '../expressions-app/node_modules/esbuild/lib/main.js';
import {chromium} from 'playwright';
import {ControlledOwner} from './native-expression-fixture.mjs';
const out=resolve(process.env.NATIVE_EXPRESSION_OUT??'walk/artifacts/native-expression');await mkdir(out,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'native-expression-browser-')),owner=new ControlledOwner();let count=0,opens=0,closes=0;
const binding=()=>({schema:'oi.native-expression-binding/v1',host:{field:{sample_rate:48000}},presentation:{units_per_metre:400,slots_a:Array.from({length:count},(_,i)=>i%2),slots_b:Array.from({length:count},(_,i)=>(i+1)%2)}});
await build({stdin:{contents:`import {relayNativeChannel} from './src/expressions/nativeChannel.ts'; window.disposeRelay=relayNativeChannel(document.querySelector('iframe'),{kind:'bridge',url:location.origin});`,resolveDir:resolve('.')},bundle:true,platform:'browser',format:'esm',outfile:join(temp,'parent.js')});
const html=await readFile('expressions-app/field-studies-journeys/public/index.html');
const server=createServer(async(req,res)=>{try{
 if(req.method==='POST'&&req.url==='/op'){
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const op=JSON.parse(Buffer.concat(chunks));let outcome;
  if(op.op==='files_list')outcome={result:'directory_read',directory:{entries:[{name:'binding.json',retrieval_allowed:true,location:{path:'binding.json'}}]}};
  else if(op.op==='file_read'){const content=JSON.stringify(binding());outcome={result:'file_read',reading:{content,revision:'controlled:r1',byte_len:Buffer.byteLength(content),location:op.location}};}
  else if(op.op==='native_expression'){
   const result=await owner.request(op.request);if(op.request.operation==='open'){opens++;result.presentation=binding().presentation;}if(op.request.operation==='close')closes++;
   outcome={result:'native_expression',data:result};
  }else throw new Error(`Unexpected test op ${op.op}`);
  res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,outcome}));return;
 }
 if(req.url==='/parent.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(join(temp,'parent.js')));return;}
 res.setHeader('content-type','text/html');res.end(req.url?.startsWith('/app')?html:'<!doctype html><style>body{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe src="/app?host=expressions"></iframe><script type="module" src="/parent.js"></script>');
 }catch(error){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:String(error)}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
const report={standing:'controlled-protocol-real-browser-not-native-engine',checks:[],errors,browser:browser.version(),renderer:'Chromium SwiftShader software WebGL',viewport:'1100x800',audio:'real AudioContext; no speaker/microphone observation'};
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);const frame=page.frames().find(f=>f!==page.mainFrame());
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.inspect()?.particleCount>0,null,{timeout:30000});
 const topology=await frame.evaluate(()=>window.__FIELD_STUDIES__.native().renderer_requirements);
 count=topology.slot_count;report.particles=topology.particle_count;report.target_slots=count;
 assert.ok(count>=report.particles);assert.equal(count,topology.tex_width*topology.tex_height);
 const before=await frame.evaluate(()=>window.__FIELD_STUDIES__.inspect());
 const dismiss=frame.locator('#entry-gate:not([hidden]) [data-action="entry-dismiss"]');
 if(await dismiss.count()){
  await dismiss.click();
  await frame.waitForFunction(()=>document.querySelector('#entry-gate')?.hasAttribute('hidden'),null,{timeout:5000});
 }
 // Native field is Studio-section content, not a floating pill: open Studio
 // and select its "Native field" section before its controls exist in the DOM.
 // At this viewport the workspace header cluster is in its compact form
 // (the "Studio" button rides the collapsed "•••" menu, per the 1100px
 // breakpoint in workspace.css), so open that menu first when present.
 const openNativeSection=async()=>{
  const workspaceMenuToggle=frame.locator('.workspace-cluster>.header-menu-toggle');
  if(await workspaceMenuToggle.isVisible())await workspaceMenuToggle.click();
  await frame.locator('[data-action="studio"]').click();
  const section=frame.locator('[data-action="studio-section"][data-value="native"]');
  // Reopening Studio on an already-'native' section re-renders the panel
  // immediately; only steer the section when it is not already current
  // (the fixed native-domain-output overlay can otherwise intercept a
  // no-op click on the section tab).
  if(await section.getAttribute('aria-current')!=='page')await section.click();
  await frame.locator('.native-field-panel').waitFor();
 };
 // The panel is now ordinary Studio-section content, not its own small
 // fixed popup with its own internal 75vh scroll — its controls live in
 // the shared #inspector-content scroll region, below the fixed scene
 // transport bar (z-index above the Studio drawer). Playwright's built-in
 // click auto-scroll does not reliably clear that fixed overlap here, so
 // every native-panel click scrolls its own target into view first.
 const clickNative=async target=>{const el=typeof target==='string'?frame.locator(target):target;await el.scrollIntoViewIfNeeded();await el.click();};
 const domainSummary=frame.locator('summary').filter({hasText:'Native domain controls'});
 const operationSummary=frame.locator('summary').filter({hasText:'Native operation and sources'});
 await openNativeSection();
 await frame.locator('[name="native-path"]').fill('binding.json');await clickNative('[data-native="source"]');await clickNative('[data-native="connect"]');
 await frame.waitForFunction(()=>['following','held','unavailable'].includes(window.__FIELD_STUDIES__.native()?.status),null,{timeout:15000});
 assert.equal(await frame.evaluate(()=>window.__FIELD_STUDIES__.native().status),'following',await frame.locator('[data-native-status]').textContent());
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.nativeTargets()?.target_a[1]>0,null,{timeout:10000});
 report.checks.push('actual embedded target texture receives native protocol values');
 await frame.waitForFunction(()=>document.querySelector('[data-transcription]')?.textContent.includes('ACT'));
 assert.equal(await frame.locator('[data-carrier]').getAttribute('x2'),'1');
 const identity=await frame.evaluate(()=>({lease:window.__FIELD_STUDIES__.native().lease,event:window.__FIELD_STUDIES__.native().native.event_ref,subject:window.__FIELD_STUDIES__.native().native.subject_ref}));
 await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({v:1,kind:'host-mode',mode:'techne'},'*'));
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.getState().hostMode==='techne');
 assert.deepEqual(await frame.evaluate(()=>({lease:window.__FIELD_STUDIES__.native().lease,event:window.__FIELD_STUDIES__.native().native.event_ref,subject:window.__FIELD_STUDIES__.native().native.subject_ref})),identity);
 assert.equal(opens,1);report.checks.push('Expressions to Technè host-mode switch retains same stage, lease, subject and occasion');
 await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({v:1,kind:'host-mode',mode:'expressions'},'*'));
 // Entering Technè's M0 project lens closes the Studio (activateInstrument's
 // 'project' branch sets inspectorOpen=false); the return to Expressions
 // does not reopen it, so the Native field section is reselected here —
 // same product control, reached fresh after the round trip.
 await openNativeSection();
 await clickNative(domainSummary);
 await frame.locator('[name="native-rna"]').selectOption('true');await clickNative('[data-native="transcription"]');
 await frame.waitForFunction(()=>document.querySelector('[data-transcription]')?.textContent.includes('ACU')&&document.querySelector('[data-native-field]')?.getAttribute('aria-busy')==='false');
 await frame.locator('[name="native-row"]').fill('4');await clickNative('[data-native="row"]');
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native()?.domain?.m1.row12===4&&document.querySelector('[data-carrier]')?.getAttribute('y2')==='-1'&&document.querySelector('[data-native-field]')?.getAttribute('aria-busy')==='false');
 assert.equal(owner.sources.current.input.m1.row12,4);report.checks.push('native transcription and carrier reach visible form output via native controls');
 await frame.locator('[name="native-damping"]').fill('0.75');await clickNative('[data-native="damping"]');
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.nativeTargets()?.target_b[2]===300);
 report.checks.push('native material control alters the actual retained target field');
 await clickNative(domainSummary);
 assert.equal((await frame.evaluate(()=>window.__FIELD_STUDIES__.inspect())).seeds,before.seeds);assert.equal(opens,1);report.checks.push('single owner attachment without reseed');
 await clickNative(operationSummary);await frame.locator('[name="native-command"]').fill(JSON.stringify({operation:'set-axis',axis:0,phase:{turns:'0',half_degrees:180}}));await clickNative('[data-native="operate"]');
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.nativeTargets()?.target_a[0]===100,null,{timeout:10000});report.checks.push('native set-axis changes consumed target, not metadata');
 await frame.waitForFunction(()=>document.querySelector('[data-clock]')?.getAttribute('transform')==='rotate(90)');
 await clickNative('[data-native="hold"]');await page.waitForTimeout(100);
 const held=await frame.evaluate(()=>({reading:window.__FIELD_STUDIES__.native(),field:window.__FIELD_STUDIES__.inspect(true)}));await page.waitForTimeout(160);
 const still=await frame.evaluate(()=>({reading:window.__FIELD_STUDIES__.native(),field:window.__FIELD_STUDIES__.inspect(true)}));
 assert.deepEqual(still.reading.native.acknowledged,held.reading.native.acknowledged);assert.deepEqual(still.field.positions,held.field.positions);assert.deepEqual(still.field.velocities,held.field.velocities);report.checks.push('hold freezes GPU position/velocity and native cursor');
 await frame.locator('[name="native-scale"]').fill('800');await clickNative('[data-native="scale"]');const scaled=await frame.evaluate(()=>({reading:window.__FIELD_STUDIES__.native(),target:window.__FIELD_STUDIES__.nativeTargets().target_a[0]}));
 assert.equal(scaled.target,200);assert.deepEqual(scaled.reading.native.acknowledged,held.reading.native.acknowledged);assert.equal(scaled.reading.presentation_mode,'manual-presentation-override');report.checks.push('presentation scale changes without native state mutation');
 await clickNative('[data-native="follow"]');assert.equal(await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeTargets().target_a[0]),100);
 await clickNative('[data-native="resume"]');await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native()?.status==='following');
 owner.lost=true;await frame.waitForFunction(()=>window.__FIELD_STUDIES__.native()?.status==='unavailable',null,{timeout:10000});
 const lost=await frame.evaluate(()=>window.__FIELD_STUDIES__.inspect(true)),requests=owner.calls.length;await page.waitForTimeout(200);const disconnected=await frame.evaluate(()=>window.__FIELD_STUDIES__.inspect(true));
 assert.deepEqual(disconnected.positions,lost.positions);assert.deepEqual(disconnected.velocities,lost.velocities);assert.equal(owner.calls.length,requests);report.checks.push('disconnect stops GPU evolution and request retries');
 await page.screenshot({path:join(out,'disconnected.png')});await page.evaluate(()=>{window.disposeRelay();document.querySelector('iframe').remove();});await page.waitForTimeout(100);
 assert.equal(owner.closed,true);assert.equal(closes,1);report.checks.push('unmount releases the single native lease');assert.deepEqual(errors,[]);report.pass=true;report.requests={opens,closes,total:owner.calls.length};console.log(JSON.stringify(report,null,2));
}catch(error){report.pass=false;report.failure=String(error);report.reading=await page.frames().find(f=>f!==page.mainFrame())?.evaluate(()=>window.__FIELD_STUDIES__?.native()).catch(()=>null);await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});throw error;}
finally{await writeFile(join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});}
