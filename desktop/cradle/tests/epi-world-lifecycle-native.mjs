/** Actual ordinary Library and native recovery, using an explicitly owned
 * bridge. The caller stops/restarts its native process; this driver never kills
 * a service. A fresh context alone is not reported as process restart. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {build} from 'esbuild';
import {chromium} from 'playwright';

assert.ok(process.argv[2],'Supply the exact bridge/candidate/controlled-world lifecycle configuration');
const config=JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
assert.match(config.bridge,/^http:\/\/127\.0\.0\.1:\d+$/);
assert.ok(['library','checkpoint'].includes(config.entry),'entry must name the ordinary Library or actual native checkpoint route');
if(config.entry==='checkpoint')assert.ok(config.restart_witness,'Checkpoint restart proof requires the actual owned native exit/spawn witness');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(config.output);
assert.ok(!existsSync(resolve(out,'receipt.json')),'Retain the original failure; choose a new evidence directory');mkdirSync(out,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const expected=JSON.parse(readFileSync(resolve(config.world_snapshot),'utf8'));
const file=expected.working?.file;
assert.ok(file?.location?.path&&file.location.ref&&file.revision&&expected.record&&expected.current,'Use an actual acknowledged native world snapshot');
assert.equal(expected.working.native_ref,expected.record.world.instance_ref);
const entryPath=resolve(config.app_entry??resolve(root,'expressions-app/field-studies-journeys/public/index.html')),application=readFileSync(entryPath,'utf8');
const receipt={schema:'oi.epi-world-ordinary-lifecycle/v1',passed:false,entry:config.entry,
 scope:'Real production application/host/native owner; actual Library file admission and native recovery. Recorded Chromium GPU, separate from installed Mac or exact particle checkpoint.',
 bridge:config.bridge,verifier:{path:fileURLToPath(import.meta.url),sha256:sha(readFileSync(fileURLToPath(import.meta.url)))},
 application:{path:entryPath,sha256:sha(application)},expected_basis:{snapshot:resolve(config.world_snapshot),sha256:sha(readFileSync(resolve(config.world_snapshot))),file},checks:[],requests:[],responses:[],artifacts:[],qualification:config.binaries??null};
const artifact=(name,value)=>{writeFileSync(resolve(out,name+'.json'),JSON.stringify(value,null,2)+'\n');receipt.artifacts.push(name+'.json');};
const save=()=>writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const check=(condition,label)=>{assert.ok(condition,label);receipt.checks.push(label);save();console.log('PASS',label);};
async function op(request,name){const response=await fetch(config.bridge+'/op',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});const raw=await response.text(),body=JSON.parse(raw);artifact(name,{request,response:body,raw_sha256:sha(raw)});assert.equal(body.ok,true,body.error);return body.outcome;}
const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}};
if(config.restart_witness){
 const path=resolve(config.restart_witness),w=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(w.schema,'oi.owned-native-restart/v1');
 assert.ok(Number.isSafeInteger(w.previous_pid)&&Number.isSafeInteger(w.current_pid)&&w.previous_pid!==w.current_pid);
 assert.equal(alive(w.previous_pid),false,'The previous actual owned native process must have exited');assert.equal(alive(w.current_pid),true,'The new actual owned native process must exist');
 assert.ok(w.previous_exit_code===0||(w.previous_exit_code===null&&w.previous_exit_signal==='SIGTERM'&&w.shutdown_requested===true),'Require the actual owned clean exit or its recorded requested SIGTERM; an unexplained crash is not a restart receipt');
 assert.equal(w.bridge_url,config.bridge);assert.equal(w.before_oi_home,w.after_oi_home);assert.equal(w.before_central_root,w.after_central_root);
 assert.equal(w.before_executable_sha256,w.after_executable_sha256);assert.equal(sha(readFileSync(w.executable)),w.after_executable_sha256);
 assert.ok(w.before_oi_home&&w.before_central_root&&w.argv&&w.spawn_log&&w.exit_log,'Record actual owned command, storage roots and process logs');
 receipt.restart={path,sha256:sha(readFileSync(path)),witness:w,claim:'Owner-recorded actual exit/spawn; independent old/new PID liveness and on-disk executable hash, without running process-image verification; preserved native/Central stores, no browser storage carried'};
}else receipt.restart={claim:false,remaining:'Caller must supply an actual owned exit/spawn/storage witness to claim process restart'};
save();
let server,browser,page,frame,restoreFile=null;
const read=()=>frame.evaluate(()=>{const f=window.__FIELD_STUDIES__;return{state:f.getState(),working:f.nativeWorking(),document:f.getDocument(),record:f.epiWorld(),current:f.epiCurrent(),native:f.native(),rendered:f.inspect(true),telemetry:f.telemetry()};});
const snapshot=async name=>{const s=await read();artifact(name,s);await page.screenshot({path:resolve(out,name+'.png')});receipt.artifacts.push(name+'.png');return s;};
const showLibrary=async()=>{
 if(await frame.locator('#library-page').isVisible())return;
 const gate=frame.locator('[data-action="entry-open"]');
 if(await gate.isVisible())await gate.click();
 else {const rail=frame.locator('[data-action="library"]').first();if(!await rail.isVisible()){const menu=frame.getByRole('button',{name:'Workspace menu',exact:true});assert.equal(await menu.isVisible(),true,'Ordinary Library control and its menu are missing');await menu.click();}assert.equal(await rail.isVisible(),true,'Ordinary Library control is missing');await rail.click();}
 await frame.locator('#library-page').waitFor({state:'visible'});
};
const savedRow=()=>frame.locator(`[data-native-open=${JSON.stringify(file.location.ref)}][data-native-file]`);
try{
 const initialIndex=await op({op:'expression',request:{operation:'index'}},'native-index-before-entry');
 if(config.restart_witness)check(!initialIndex.data.expressions.some(row=>row.expression_ref===expected.working.native_ref),'The restarted native owner has not been silently pre-opened with the saved world');
 const receiverSource=`import {relayKernelChannel,trackHostedAppState} from './src/expressions/hostedApp.ts';import {relayNaraChannel} from './src/expressions/naraChannel.ts';import {readScope,scopeProject} from './src/workspace/scope.ts';import {chatProvisionTarget} from './src/agent/chat/firstSend.ts';const frame=document.getElementById('world'),transport={kind:'bridge',url:${JSON.stringify(config.bridge)}};let state=null;const stops=[trackHostedAppState(frame,s=>state=s),relayKernelChannel(frame,transport),relayNaraChannel(frame,transport,{project:()=>chatProvisionTarget(scopeProject(readScope())),expression:()=>state?.nativeScene??null})];frame.src='/__epi_application'+location.search;window.__EPI_REAL_HOST__={state:()=>state};window.addEventListener('pagehide',()=>stops.forEach(stop=>stop()));`;
 const compiled=await build({stdin:{contents:receiverSource,resolveDir:root,sourcefile:'actual-lifecycle-host.mjs',loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',metafile:true,define:{__CRADLE_WALK__:'false','process.env.NODE_ENV':'"production"'},plugins:[{name:'actual-raw-assets',setup(b){b.onResolve({filter:/\?raw$/},a=>({path:resolve(dirname(a.importer),a.path.slice(0,-4)),namespace:'raw'}));b.onLoad({filter:/.*/,namespace:'raw'},a=>({contents:readFileSync(a.path,'utf8'),loader:'text'}));}}]});
 const receiver=compiled.outputFiles[0].text;
 writeFileSync(resolve(out,'actual-host.mjs'),receiver);writeFileSync(resolve(out,'actual-application.html'),application);
 receipt.host={sha256:sha(receiver),assembly_sha256:sha(receiverSource),inputs:Object.fromEntries(Object.keys(compiled.metafile.inputs).filter(p=>!p.startsWith('<')&&p!=='actual-lifecycle-host.mjs').map(p=>[p,sha(readFileSync(resolve(root,p.replace(/^raw:/,''))))]))};
 server=await createServer({root,configFile:false,plugins:[{name:'actual-lifecycle-entry',configureServer(s){s.middlewares.use((req,res,next)=>{const path=req.url?.split('?')[0];if(path==='/__epi_host'){res.setHeader('Content-Type','text/javascript');res.end(receiver);return;}if(path==='/__epi_application'){res.setHeader('Content-Type','text/html');res.end(application);return;}if(path==='/__epi_parent'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body style="margin:0"><iframe id="world" style="border:0;width:100vw;height:100vh"></iframe><script type="module" src="/__epi_host"></script></body></html>');return;}next();});}}],server:{host:'127.0.0.1',port:0}});await server.listen();
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(40000);
 page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/op'))receipt.requests.push(r.postDataJSON());});
 page.on('response',async r=>{if(r.request().method()==='POST'&&r.url().endsWith('/op'))try{const body=await r.json();receipt.responses.push({request:r.request().postDataJSON(),response:body});save();}catch(error){receipt.response_capture_error=String(error);}});
 const query='?mode=expressions&world=epi-logos&still'+(config.entry==='checkpoint'?'&expression='+encodeURIComponent(expected.working.native_ref):'');
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__epi_parent`+query);
 await page.waitForFunction(()=>document.querySelector('#world')?.getAttribute('src')?.startsWith('/__epi_application'),null,{timeout:90000});frame=await page.locator('#world').elementHandle().then(e=>e.contentFrame());
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__?.nativeWorking&&window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable(),null,{timeout:90000});
 const env=await frame.evaluate(()=>{const g=document.getElementById('field-canvas').getContext('webgl2'),d=g?.getExtension('WEBGL_debug_renderer_info');return{url:location.href,bundle:document.getElementById('app-bundle')?.textContent,gpu:g?{version:g.getParameter(g.VERSION),renderer:d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}:null,browser_local_keys:Object.keys(localStorage)};});
 assert.ok(env.bundle&&env.gpu);receipt.environment={browser:browser.version(),requested_angle:'swiftshader',reduced_motion:'reduce',url:env.url,loaded_app_bundle_sha256:sha(env.bundle),gpu:env.gpu,browser_local_keys_on_initial_entry:env.browser_local_keys};
 if(config.entry==='library'){
  await showLibrary();await frame.locator('[data-native-list][data-native-state="ready"]').waitFor({timeout:90000});await savedRow().waitFor({state:'visible'});
  const basis=await savedRow().evaluate(e=>JSON.parse(e.dataset.nativeFile));assert.deepEqual(basis,{location:file.location,revision:file.revision,expression_ref:expected.working.native_ref});
  const row=await savedRow().locator('..').innerText();artifact('ordinary-cold-library-row',{basis,text:row});await snapshot('cold-library-before-opening');
  const afterDiscovery=await op({op:'expression',request:{operation:'index'}},'native-index-after-library-discovery');
  if(config.restart_witness)check(!afterDiscovery.data.expressions.some(r=>r.expression_ref===expected.working.native_ref),'Library discovery reads the durable saved file without opening it');
  check(receipt.requests.some(r=>r.op==='expression_world'&&r.request?.operation==='material_list'),'The ordinary Library called the actual durable native material owner');
  check(row.includes(file.location.path)&&await savedRow().locator('..').locator('[data-scene-strip]').count()===1,'The exact saved file and its bounded native Scene strip are visible in the existing Library');
  // These negative channel admissions use the actual observed row with one
  // conflicting claim. They do not replace the ordinary click replay below.
  for(const [label,changed] of [
   ['source location',{...basis,location:{...basis.location,ref:basis.location.ref+':different-source'}}],
   ['Expression identity',{...basis,expression_ref:basis.expression_ref+':different-expression'}],
  ]){
   const before=await read(),issued=receipt.requests.length;
   const accepted=await frame.evaluate(({path,observed})=>window.__FIELD_STUDIES__.openNativeFile(path,observed),{path:file.location.path,observed:changed});
   assert.equal(accepted,false);assert.equal(await frame.locator('#library-page').isVisible(),true);
   const after=await read();assert.deepEqual(after.document,before.document);assert.deepEqual(after.state.selected,before.state.selected);assert.deepEqual(after.state.camera,before.state.camera);assert.deepEqual(after.record,before.record);
   check(!receipt.requests.slice(issued).some(r=>r.op==='expression'&&r.request?.operation==='open_file'),`The actual native receiving channel refuses a mismatched saved-row ${label} before open_file and retains the Library/draft`);
  }
  if(config.controlled_file_revision_gate){
   const controlled=realpathSync(config.central_root),allowed=realpathSync(config.authorised_evidence_root);
   assert.ok(controlled.startsWith(allowed+sep),'Native CAS fault may touch only the authorised controlled world');assert.ok(realpathSync(resolve(controlled,file.location.path)).startsWith(controlled+sep));
   const original=(await op({op:'file_read',location:file.location},'stale-row-original-file')).reading;assert.equal(original.revision,file.revision);
   const altered=await op({op:'file_operation',location:file.location,request:{action:'write',expected_revision:original.revision,content:original.content+'\n'}},'stale-row-real-native-cas');assert.ok(['written','unchanged'].includes(altered.data.outcome));assert.notEqual(altered.data.revision,original.revision);
   restoreFile={location:file.location,original:original.content,revision:altered.data.revision};const issued=receipt.requests.length,before=await read();
   await savedRow().click();await frame.waitForFunction(ref=>{const e=Array.from(document.querySelectorAll('[data-native-open]')).find(e=>e.dataset.nativeOpen===ref);return e?.getAttribute('aria-busy')==='false';},file.location.ref);
   assert.equal(await frame.locator('#library-page').isVisible(),true);const refused=await read();assert.deepEqual(refused.document,before.document);assert.deepEqual(refused.record,before.record);
   check(!receipt.requests.slice(issued).some(r=>r.op==='expression'&&r.request?.operation==='open_file'),'A real concurrently changed file refuses the clicked stale Library row before native open_file');
   await op({op:'file_operation',location:file.location,request:{action:'write',expected_revision:restoreFile.revision,content:restoreFile.original}},'stale-row-restore-real-native-cas');restoreFile=null;
   const restored=(await op({op:'file_read',location:file.location},'stale-row-restored-full-file')).reading;assert.equal(restored.content,original.content);
   await frame.locator('[data-action="close-library"]').first().click();await showLibrary();await savedRow().waitFor({state:'visible'});
   const refreshed=await savedRow().evaluate(e=>JSON.parse(e.dataset.nativeFile));assert.equal(refreshed.revision,restored.revision);assert.deepEqual(refreshed.location,file.location);artifact('refreshed-library-native-basis',refreshed);
  }
  const at=receipt.requests.length;await savedRow().click();await frame.locator('#library-page').waitFor({state:'hidden',timeout:180000});
  check(receipt.requests.slice(at).some(r=>r.op==='expression'&&r.request?.operation==='open_file'),'The actual saved Library row opens its source through the native file owner');
 }
 await frame.waitForFunction(person=>{const f=window.__FIELD_STUDIES__;return f.epiWorld()?.person_ref===person&&f.epiCurrent()?.reading?.identity?.person_ref===person&&!f.nativeWorking()?.pending;},expected.record.person_ref,{timeout:180000});
 await frame.evaluate(()=>window.__FIELD_STUDIES__.pause());const opened=await snapshot('ordinary-opened-world');
 check(opened.working.native_ref===expected.working.native_ref&&opened.record.world.event_ref===expected.record.world.event_ref&&opened.record.world.snapshot_ref===expected.record.world.snapshot_ref,'Ordinary opening restores the exact Expression/person/retained cosmic occasion');
 assert.deepEqual(opened.record.identity_source,expected.record.identity_source);assert.deepEqual(opened.record.world.sky,expected.record.world.sky);
 assert.equal(opened.document.scenes[opened.state.sceneIndex].id,expected.document.scenes[expected.state.sceneIndex].id);assert.deepEqual(opened.state.selected,expected.state.selected);
 check(true,'The actual saved Scene, selection and exact source identity survive ordinary opening');
 const personal=expected.working.native_ref+':scene:personal';
 if(opened.document.scenes[opened.state.sceneIndex].id!==personal)await frame.locator(`[data-epi-scene=${JSON.stringify(personal)}]`).click();
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.inspect().localizedResonance.length===9,null,{timeout:180000});
 const body=await snapshot('ordinary-restored-personal-receiver');assert.equal(body.rendered.partitions.length,9);assert.equal(body.record.receiving.personal.canonical_locus,'ql:m-coordinate:bimba:M4.4.4.4');
 await frame.locator('[data-epi="identity"]').click();await frame.getByRole('button',{name:'Composition',exact:true}).click();assert.equal(await frame.getByRole('combobox',{name:'Natal force presentation'}).isEnabled(),true);await frame.getByRole('button',{name:'Return to the Expression',exact:true}).click();
 check(true,'The exact canonical saved person hydrates ordinary controls and all nine actual resident bodies/drivers');
 check(receipt.requests.some(r=>r.op==='expression_recovery'&&r.request?.operation==='write'),'The production host actually writes the native durable recovery owner');
 if(config.entry==='checkpoint')check(receipt.requests.some(r=>r.op==='expression_recovery'&&r.request?.operation==='find_checkpoint')&&receipt.requests.some(r=>r.op==='expression'&&r.request?.operation==='open'),'Actual restart re-entry opens its acknowledged native checkpoint without browser recovery');
 artifact('native-owner-after-ordinary-opening',(await op({op:'expression',request:{operation:'inspect',expression_ref:expected.working.native_ref}},'native-owner-inspection')).data);
 receipt.passed=true;
}catch(error){receipt.failure=String(error.stack??error);if(frame)try{await snapshot('failure-original-encounter');}catch(e){receipt.capture_error=String(e);}process.exitCode=1;}
finally{
 if(restoreFile)try{const restored=await op({op:'file_operation',location:restoreFile.location,request:{action:'write',expected_revision:restoreFile.revision,content:restoreFile.original}},'cleanup-native-cas-restore');assert.ok(['written','unchanged'].includes(restored.data.outcome));receipt.cleanup='Only the exact controlled-file CAS intervention was restored';}catch(error){receipt.cleanup_error=String(error);receipt.passed=false;process.exitCode=1;}
 await browser?.close();await server?.close();receipt.application.final_on_disk_sha256=sha(readFileSync(entryPath));receipt.application.changed_on_disk=receipt.application.final_on_disk_sha256!==receipt.application.sha256;save();console.log('RECEIPT',resolve(out,'receipt.json'));
}
