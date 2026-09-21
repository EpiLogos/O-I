/** N+B: the current imported application through the production PointCloudHost,
 * actual Central file/material seam and native kernel. Temporary authored work,
 * not a mocked transport, owner-machine test or full six-instrument acceptance. */
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,realpathSync,cpSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'tests/artifacts/techne-native-application');mkdirSync(out,{recursive:true});
const bins=Object.fromEntries(['OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN','WIKI_KERNEL_BIN'].map(key=>{assert.ok(process.env[key],`${key} is required`);return[key,resolve(process.env[key])];}));
const ground=realpathSync(mkdtempSync(resolve(tmpdir(),'techne-native-'))),project=resolve(ground,'Work/Notes');mkdirSync(project,{recursive:true});
const env={PATH:process.env.PATH??'/usr/bin:/bin',HOME:resolve(ground,'isolated-home'),AIKIT_HOME:resolve(ground,'isolated-aikit'),...bins,OI_CENTRAL_ROOT:ground,OI_CENTRAL_PROJECT_QUERY:'Notes'};mkdirSync(env.HOME,{recursive:true});
const receipt={scope:'Temporary native kernel/files and the actual PointCloudHost/imported application; no models, hosted publication, installed or whole-Technē acceptance',checks:[],passed:false},logs=[],errors=[],requests=[];
const check=(truth,label)=>{assert.ok(truth,label);receipt.checks.push(label);console.log('PASS',label);};
function action(name,input={}){const r=JSON.parse(execFileSync(bins.OI_CENTRAL_CTRL_BIN,['--json','--root',ground,'action','run',name,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000}));assert.equal(r.ok,true,JSON.stringify(r));return r.data;}
action('central.init');action('projectcentral.init',{project:'Notes',project_id:'techne-native-walk'});
const installed=resolve(ground,'Work/O-I/desktop/cradle/expressions-app/dist');mkdirSync(dirname(installed),{recursive:true});cpSync(resolve(root,'expressions-app/dist'),installed,{recursive:true});
let bridge,bridgeUrl,server,browser,page,frame;
async function startBridge(){
 bridge=spawn(bins.WIKI_KERNEL_BIN,['127.0.0.1:0'],{cwd:project,env,stdio:['ignore','pipe','pipe']});bridge.stderr.on('data',v=>logs.push(v.toString()));
 bridgeUrl=await new Promise((yes,no)=>{let text='';const timer=setTimeout(()=>no(new Error('Kernel did not start')),30000);bridge.on('error',e=>{clearTimeout(timer);no(e);});bridge.on('exit',code=>{clearTimeout(timer);no(new Error(`Kernel exited ${code}: ${logs.slice(-3)}`));});bridge.stdout.on('data',chunk=>{text+=chunk;const m=text.match(/listening on (http:\/\/[^ ]+)/);if(m){clearTimeout(timer);yes(m[1]);}});});
}
async function op(value){const r=await fetch(`${bridgeUrl}/op`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const data=await r.json();assert.equal(data.ok,true,JSON.stringify(data));return data.outcome;}
async function mount(){
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/techne-native-application.html?bridge=${encodeURIComponent(bridgeUrl)}`);
 await page.locator('.pcd-host-frame').waitFor();frame=await page.locator('.pcd-host-frame').elementHandle().then(el=>el.contentFrame());
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__&&window.__OI_KERNEL_EXPRESSIONS__?.kernelExpressionsAvailable());
}
async function edit(bind,value){const input=frame.locator(`#inspector-content [data-bind="${bind}"]`).first();await input.fill(String(value));if(await input.evaluate(el=>el.tagName!=='TEXTAREA'))await input.press('Enter');else await input.blur();}
async function openPanel(){if(!await frame.locator('#native-work').isVisible())await frame.locator('[data-action="native-work"]').first().click();await frame.getByRole('button',{name:'Commit composition',exact:true}).waitFor({state:'visible'});await frame.waitForFunction(()=>!document.querySelector('[data-native="commit"]').disabled);}
try{
 await startBridge();
 server=await createServer({root,configFile:false,plugins:[react()],resolve:{alias:{three:resolve(root,'node_modules/three')}},define:{__CRADLE_WALK__:'false'},server:{host:'127.0.0.1',port:0,fs:{allow:[root,resolve(root,'../../packages/oi-design-system')]}}});await server.listen();
 browser=await chromium.launch({headless:true});receipt.browser=browser.version();page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(25000);
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/op'))requests.push(r.postDataJSON());});
 await mount();
 check(await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument().id==='source-twelve-faces'),'The actual Technē mode opens the approved Epii face without a preselected Wiki subject');
 check(await frame.locator('canvas').count()>0,'The current imported renderer is mounted through the native material host');
 check(await frame.locator('#live-workspace').isHidden()&&await frame.locator('#toolbelt-panel').isHidden(),'The Technē entrance does not replace native navigation with duplicate formation and physics panels');
 await page.screenshot({path:resolve(out,'epii-home.png')});
 // The existing browser authoring library supplies new work; it is not a
 // substitute for native collection/search readback, which is tested elsewhere.
 await frame.getByRole('button',{name:'Expression library',exact:true}).click();
 await frame.getByRole('button',{name:'New expression',exact:true}).click();
 await frame.evaluate(()=>window.__FIELD_STUDIES__.openEditor('scene'));
 await edit('name','Working Scene');
 await frame.locator('[data-action="studio-section"][data-value="text"]').click();
 await frame.locator('#inspector-content [data-action="add-text"]').click();await edit('text.title','A saved reading');await edit('text.body','The source stays distinct from its authored presentation.');
 await frame.locator('[data-action="studio-section"][data-value="scene"]').click();await frame.locator('#inspector-content [data-detail="journey"] summary').click();await edit('journey.name','Native scene continuity');await edit('journey.description','Saved and working versions have different standing.');
 await frame.locator('#inspector-content [data-action="open-timeline"]').click();
 await frame.locator('[data-action="save-scene"]').click();
 await frame.evaluate(()=>window.__FIELD_STUDIES__.openEditor('scene'));await frame.locator('[data-action="studio-section"][data-value="text"]').click();await edit('text.title','A later unsaved interpretation');await frame.locator('[data-action="studio-section"][data-value="scene"]').click();await edit('duration',17);
 const captured=await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument());
 const canvas=await frame.locator('canvas').first().elementHandle();const position=await frame.evaluate(()=>window.__FIELD_STUDIES__.getState());
 await openPanel();await frame.locator('[data-native-field="folder"]').fill('Work/Notes');await frame.locator('[data-native-field="name"]').fill('whole.expression.json');
 await frame.getByRole('button',{name:'Save native file',exact:true}).click();
 await frame.locator('.native-status').filter({hasText:'Saved and independently read'}).waitFor();
 const file=resolve(project,'whole.expression.json');check(existsSync(file),'Save in the actual imported app created a file through the native owner');
 const saved=JSON.parse(readFileSync(file,'utf8')),scene=saved.scenes[0];
 check(scene.presentation?.scene.text[0].title==='A later unsaved interpretation'&&scene.presentation?.saved.text[0].title==='A saved reading','Actual native file preserves distinct saved and working text versions');
 check(scene.presentation.scene.duration===17&&saved.presentation.description===captured.description,'Pacing and whole-expression properties survive the native save');
 check(await canvas.evaluate(el=>el.isConnected),'Native commit/file save did not remount the current renderer');
 check(await frame.evaluate(before=>JSON.stringify(window.__FIELD_STUDIES__.getState().camera)===JSON.stringify(before),position.camera),'Native save preserves the current camera');
 const ref=saved.expression_ref;
 await frame.getByRole('button',{name:'Commit composition',exact:true}).click();await frame.locator('.native-status').filter({hasText:'Native working revision'}).waitFor();
 const unchanged=await op({op:'expression',request:{operation:'inspect',expression_ref:ref}});check(unchanged.data.document.revision===saved.revision,'An unchanged Scene does not generate a new native revision after JSON key ordering');
 // The M0′–M5′ Lens Studio stands on the SAME open native construction, not a
 // hardcoded surface: select the M3′ Journey instrument and it discloses the
 // real Expression (its basis and its Scenes) and carries the NATIVE commit
 // (not a browser save); switching to M1′ keeps the same construction — the
 // subject is carried, never reset (§28 lens continuity over a real subject).
 await frame.locator('#lens-chooser .lens-choice[data-lens="journey"]').click();
 await frame.locator('#lens-studio:not([hidden])').waitFor();
 const m3basis=(await frame.locator('#lens-studio .lens-basis code').first().innerText()).trim();
 check(m3basis.length>0,'The M3′ Lens Studio discloses the exact open native construction, not a hardcoded blank');
 check(/scene/i.test(await frame.locator('#lens-studio .lens-material').first().innerText()),'The M3′ Studio discloses the real Scenes of the construction');
 check(await frame.locator('#lens-studio .lens-control-native[data-action="lens-op"][data-op="commit"]').count()>0,'M3′ commits Scenes through the native owner, not a browser save');
 await frame.locator('#lens-chooser .lens-choice[data-lens="canvas"]').click();
 check((await frame.locator('#lens-studio .lens-basis code').first().innerText()).trim()===m3basis,'The open construction survives a lens change — the subject is carried, not reset');
 await frame.locator('#lens-studio .lens-studio-close').click();
 await frame.getByRole('button',{name:'Account / sources',exact:true}).click();await page.waitForFunction(()=>window.__TECHNE_HOST_PROOF__.summons.some(s=>s.kind==='verso'&&s.subject));
 const versoSummon=await page.evaluate(()=>window.__TECHNE_HOST_PROOF__.summons.find(s=>s.kind==='verso'&&s.subject));
 check(versoSummon.subject.ref===ref&&versoSummon.subject.revision===saved.revision,'The verso summon carries the EXACT open native work (expression ref + current revision), not a bare kind or a global focus');
 await page.screenshot({path:resolve(out,'native-saved.png')});
 // A second kernel must read the actual native file, not the first process or
 // a browser-memory imitation of it. Open uses real file and kernel operations.
 bridge.kill('SIGTERM');await new Promise(yes=>bridge.once('exit',yes));await startBridge();await mount();
 await openPanel();await frame.locator('[data-native-field="path"]').fill('Work/Notes/whole.expression.json');await frame.getByRole('button',{name:'Open file',exact:true}).click();
 await frame.locator('.native-status').filter({hasText:'Opened Native scene continuity'}).waitFor();
 const reopened=await frame.evaluate(()=>window.__FIELD_STUDIES__.getDocument());
 check(reopened.scenes[0].text[0].title==='A later unsaved interpretation'&&reopened.savedScenes[reopened.scenes[0].id].text[0].title==='A saved reading','The actual app reopens both versions after a separate native kernel restart');
 check((await op({op:'expression',request:{operation:'inspect',expression_ref:ref}})).data.document.expression_ref===ref,'Native file re-entry keeps the original Expression identity');
 // Controlled negative over real effects: remove the native save request,
 // then demand file existence. It must fail, not fall back to browser storage.
 await frame.getByRole('button',{name:'Close native composition',exact:true}).click();await frame.evaluate(()=>window.__FIELD_STUDIES__.openEditor('scene'));await frame.locator('[data-action="studio-section"][data-value="text"]').click();await edit('text.body','A newer working change');await openPanel();
 await page.route('**/op',route=>{const value=route.request().postDataJSON();if(value?.op==='expression'&&['save','save_as'].includes(value.request?.operation))return route.abort('failed');return route.continue();});
 const prior=readFileSync(file,'utf8');await frame.getByRole('button',{name:'Save native file',exact:true}).click();await frame.locator('#native-work [data-native="inspect"]').waitFor({state:'visible'});await frame.waitForFunction(()=>!document.querySelector('#native-work [data-native="inspect"]').disabled);
 check(readFileSync(file,'utf8')===prior,'Removing native save leaves native storage unchanged; browser backup is not mistaken for successful Return');
 await page.unroute('**/op');
 await page.setViewportSize({width:430,height:850});await page.screenshot({path:resolve(out,'narrow-pending.png')});
 check(await frame.evaluate(()=>{const r=document.querySelector('#native-work').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),'Native working controls stay within the narrow viewport');
 // Additional source-labelled native fixture for the CURRENT imported canvas.
 // Native mutation/readback is real; no Markdown provenance is invented.
 await page.setViewportSize({width:1440,height:1000});
 const relatedRef='expression:relation-walk',relatedScene=relatedRef+':scene:main';
 await op({op:'expression',request:{operation:'create',expression_ref:relatedRef,title:'Exact relation occurrences',actor:'human:fixture'}});
 const changes=[];
 for(const [id,x]of [['a',-220],['b',220],['repeat',400]]){
  const entityRef=relatedRef+':entity:'+id;
  changes.push({change:'entity_add',scene_ref:relatedScene,entity_ref:entityRef,title:id},
   {change:'parameter_set',entity_ref:entityRef,parameter:'x',value:x},
   {change:'parameter_set',entity_ref:entityRef,parameter:'share',value:0},
   {change:'subject_bind',entity_ref:entityRef,binding:{subject_ref:'source:fixture:repeated',native_owner:'ai-kit',presentation_role:'thing',sources:[],readings:[],actions:[]}});
 }
 for(const id of ['one','two'])changes.push({change:'relation_bind',binding:{binding_ref:relatedRef+':relation:'+id,native_owner:'ai-kit',relation:{ref:'wiki:fixture:relation:'+id,revision:'r1',availability:'available'},from_entity_ref:relatedRef+':entity:a',to_entity_ref:relatedRef+':entity:b',provenance:[]}});
 await op({op:'expression',request:{operation:'edit',expression_ref:relatedRef,expected_revision:1,actor:'human:fixture',changes}});
 await frame.evaluate(async ref=>{await window.__FIELD_STUDIES__.openNative(ref);window.__FIELD_STUDIES__.pause();},relatedRef);
 await frame.getByRole('button',{name:'Close native composition',exact:true}).click();
 await frame.locator('[data-action="tool-select"]').first().click();
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.nativeConnections()?.rendered?.length===2);
 const paths=await frame.evaluate(()=>window.__FIELD_STUDIES__.nativeConnections());
 check(paths.paths.length===2,'The current imported renderer draws both distinct native relation occurrences');
 const currentCanvas=await frame.locator('canvas').first().elementHandle(),priorPosition=await frame.evaluate(()=>window.__FIELD_STUDIES__.getState());
 const picked=paths.paths.find(p=>p.binding_ref.endsWith(':two')).points[12];
 const frameBox=await page.locator('.pcd-host-frame').boundingBox();await page.mouse.click(frameBox.x+picked.x,frameBox.y+picked.y);
 await frame.waitForFunction(()=>window.__FIELD_STUDIES__.nativeWorking()?.pending===undefined&&window.__FIELD_STUDIES__.nativeWorking()?.revision===3);
 const focused=await op({op:'expression',request:{operation:'inspect',expression_ref:relatedRef}});
 check(focused.data.document.selection.relation_ref===relatedRef+':relation:two','A pointer hit in the current field selects the exact native relation, not a parallel edge or repeated source');
 check(await currentCanvas.evaluate(el=>el.isConnected),'Relation selection keeps the same physical renderer');
 check(await frame.evaluate(before=>{const now=window.__FIELD_STUDIES__.getState();return now.simTime===before.simTime&&JSON.stringify(now.camera)===JSON.stringify(before.camera);},priorPosition),'Relation selection does not reset the paused clock or camera');
 await page.screenshot({path:resolve(out,'native-relations.png')});
 check(errors.length===0,`No uncaught application errors (${errors.join('; ')})`);
 receipt.passed=true;receipt.expression_ref=ref;receipt.nativeOperations=requests.filter(v=>v.op==='expression').length;
}catch(error){receipt.failure=String(error);receipt.errors=errors;receipt.lastRequests=requests.slice(-8);if(frame)receipt.ui=await frame.locator('#native-work').innerText().catch(()=>null);if(page)await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});console.error(JSON.stringify(receipt));throw error;}
finally{writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');writeFileSync(resolve(out,'kernel.log'),logs.join(''));if(browser)await browser.close();if(server)await server.close();bridge?.kill('SIGTERM');}
