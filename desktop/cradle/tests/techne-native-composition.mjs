/** Native-only complement to techne-native-application.mjs. Uses actual kernel,
 * Central file operations, and the production hosted file adapter; no browser
 * or model double. All ground is uniquely temporary and remains for diagnosis. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {isDeepStrictEqual} from 'node:util';
import {blankJourney,blankScene,entity,clone} from '../expressions-app/field-studies-journeys/build/model.js';
import {initialiseSceneSaves,saveScene,sceneSaveState} from '../expressions-app/field-studies-journeys/build/sceneWorkflow.js';
import {NativeWorking} from '../expressions-app/field-studies-journeys/build/nativeWorking.js';
import {NativeSelectionQueue} from '../expressions-app/field-studies-journeys/build/nativeSelectionQueue.js';
import {kernelDocumentToJourney} from '../expressions-app/field-studies-journeys/build/kernelDocumentBridge.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.env.TECHNE_EVIDENCE_DIR??resolve(root,'tests/artifacts/techne-native-composition'));
mkdirSync(out,{recursive:true});
const names=['OI_BIN','OI_AIKIT_BIN','OI_CENTRAL_CTRL_BIN','WIKI_KERNEL_BIN'];
const bins=Object.fromEntries(names.map(key=>{assert.ok(process.env[key],`${key} must name a real source-built binary`);return[key,resolve(process.env[key])];}));
const ground=realpathSync(mkdtempSync(resolve(tmpdir(),'techne-native-composition-'))),project=resolve(ground,'Work/Notes');mkdirSync(project,{recursive:true});
const env={PATH:process.env.PATH??'/usr/bin:/bin',HOME:resolve(ground,'isolated-home'),AIKIT_HOME:resolve(ground,'isolated-aikit'),...bins,OI_CENTRAL_ROOT:ground,OI_CENTRAL_PROJECT_QUERY:'Notes'};mkdirSync(env.HOME,{recursive:true});
const receipt={scope:'Actual NativeWorking and hostedCompositionFile against kernel/AIKit/Central in temporary ground. Native storage evidence, not a browser, model, shared-host or whole-Technē claim.',ground,binaries:Object.fromEntries(names.map(key=>[key,{path:bins[key],sha256:createHash('sha256').update(readFileSync(bins[key])).digest('hex')}])),checks:[],passed:false};
const check=(truth,label)=>{assert.ok(truth,label);receipt.checks.push(label);console.log('PASS',label);};
function action(name,input={}){const response=JSON.parse(execFileSync(bins.OI_CENTRAL_CTRL_BIN,['--json','--root',ground,'action','run',name,JSON.stringify(input)],{env,encoding:'utf8',timeout:30000}));assert.equal(response.ok,true,JSON.stringify(response));return response.data;}
action('central.init');action('projectcentral.init',{project:'Notes',project_id:'techne-composition-native'});
await build({stdin:{contents:"export {hostedCompositionFile} from '../src/expressions/hostedComposition'; export {expressionOperation} from '../src/knowledge/constructionProjection';",resolveDir:resolve(root,'tests'),loader:'ts'},outfile:resolve(out,'native-owner-adapters.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
const {hostedCompositionFile,expressionOperation}=await import(pathToFileURL(resolve(out,'native-owner-adapters.mjs')).href);
let bridge,transport;const logs=[],effects=[];
async function start(){
 bridge=spawn(bins.WIKI_KERNEL_BIN,['127.0.0.1:0'],{cwd:project,env,stdio:['ignore','pipe','pipe']});bridge.stderr.on('data',chunk=>logs.push(String(chunk)));
 const url=await new Promise((yes,no)=>{let text='';const timer=setTimeout(()=>no(new Error('Native kernel did not start')),10000);bridge.once('error',error=>{clearTimeout(timer);no(error);});bridge.once('exit',code=>{clearTimeout(timer);no(new Error(`Native kernel exited ${code}`));});bridge.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/listening on (http:\/\/[^ ]+)/);if(match){clearTimeout(timer);yes(match[1]);}});});
 transport={kind:'bridge',url};
}
async function stop(){if(!bridge||bridge.exitCode!==null)return;await new Promise(done=>{bridge.once('exit',done);bridge.kill('SIGTERM');});}
const ports={expression:async request=>{effects.push(clone(request));return expressionOperation(transport,request);},file:request=>hostedCompositionFile(transport,request),mint:()=>`expression:test-${crypto.randomUUID()}`,checkpoint:async(id,value)=>writeFileSync(resolve(out,'working-checkpoint.json'),JSON.stringify({id,value}))};
const snapshot=j=>({journey:j,sceneId:j.scenes[0].id,entityId:j.scenes[0].entities[0]?.id??null});
try{
 await start();
 const j=initialiseSceneSaves(blankJourney());j.name='Native continuity specimen';j.description='An explicitly authored test, not independent evidence.';
 const a=entity('Passage representation','A');j.scenes[0].entities=[a];j.scenes[0].name='First view';j.scenes[0].view.mode='3d';
 saveScene(j,j.scenes[0],'First view');j.scenes[0].duration=29;a.position.z=.75;
 const second=blankScene('Second occurrence');second.entities=[clone(a)];second.entities[0].position.z=-.4;j.scenes.push(second);
 const work=new NativeWorking(ports),file=await work.saveFile(snapshot(j),{parent_path:'Work/Notes',name:'whole.expression.json'});
 const path=resolve(project,'whole.expression.json');check(existsSync(path),'Native save creates an actual Central-owned Expression file');
 const persisted=JSON.parse(readFileSync(path,'utf8'));
 check(persisted.scenes.length===2&&persisted.scenes[0].presentation.scene.duration===29,'Scene ordering and pacing survive native save');
 check(persisted.scenes[0].presentation.scene.entities[0].position.z===.75&&persisted.scenes[1].presentation.scene.entities[0].position.z===-.4,'Repeated entity retains distinct Scene-local placement');
 check(persisted.scenes[0].presentation.saved.entities[0].position.z===0,'Saved presentation and later working draft remain distinct');
 const count=effects.filter(r=>r.operation==='edit').length;await work.commit(snapshot(j));check(effects.filter(r=>r.operation==='edit').length===count,'Unchanged commit is idempotent after native serialization');
 await stop();await start();
 const opened=await hostedCompositionFile(transport,{operation:'open',path:'Work/Notes/whole.expression.json'});
 check(isDeepStrictEqual(opened.document,persisted),'A fresh kernel reopens the exact file rather than the prior process state');
 const restored=new NativeWorking(ports),view=await restored.adopt(opened.document,{location:file.location,revision:file.revision,expression_ref:persisted.expression_ref});
 check(sceneSaveState(view.journey,view.journey.scenes[0])==='Edited since save','Reopening retains saved-versus-edited standing');
 const changed=clone(view.journey);changed.scenes[0].duration=30;
 await restored.commit(snapshot(changed));check((await expressionOperation(transport,{operation:'inspect',expression_ref:persisted.expression_ref})).document.scenes[0].presentation.scene.duration===30,'Reopened work remains constructively editable');
 // Delay delivery of a real successful selection reply. The second gesture
 // must survive the wait, but it must not submit concurrently on the old CAS.
 let release,entered;
 const waiting=new Promise(done=>{entered=done;});
 const nativeExpression=ports.expression;
 let holdSelection=true;
 ports.expression=async request=>{
  const result=await nativeExpression(request);
  if(request.operation==='edit'&&request.changes?.[0]?.change==='focus'&&holdSelection){holdSelection=false;entered();await new Promise(done=>{release=done;});}
  return result;
 };
 const queue=new NativeSelectionQueue({available:()=>!restored.busy,current:()=>true,apply:async value=>{await restored.select(value);return true;}});
 const first=queue.submit({scene_ref:persisted.scenes[0].scene_ref,entity_ref:null});await waiting;
 const latest=queue.submit({scene_ref:persisted.scenes[1].scene_ref,entity_ref:persisted.scenes[1].entity_refs[0]});
 release();check(await first==='applied'&&await latest==='applied','Rapid selection gestures serialize on actual native revisions');
 const focused=(await expressionOperation(transport,{operation:'inspect',expression_ref:persisted.expression_ref})).document;
 check(focused.selection.scene_ref===persisted.scenes[1].scene_ref&&focused.selection.entity_ref===persisted.scenes[1].entity_refs[0],'Native focus follows the latest exact Scene occurrence, not the first completed click');
 check(focused.scenes[0].presentation.scene.duration===30,'Selection does not author unrelated Scene material');
 ports.expression=nativeExpression;
 const current=await expressionOperation(transport,{operation:'inspect',expression_ref:persisted.expression_ref});
 await expressionOperation(transport,{operation:'edit',expression_ref:persisted.expression_ref,expected_revision:current.document.revision,actor:'human:concurrent',changes:[{change:'rename',title:'A concurrent inquiry edit'}]});
 changed.scenes[0].duration=31;await assert.rejects(()=>restored.commit(snapshot(changed)),error=>error?.state==='revision_conflict');
 check((await expressionOperation(transport,{operation:'inspect',expression_ref:persisted.expression_ref})).document.title==='A concurrent inquiry edit','Stale constructive return refuses without overwriting concurrent work');
 const savedBasis=kernelDocumentToJourney(persisted);const disconnected=clone(persisted);delete disconnected.scenes[0].presentation;
 check(kernelDocumentToJourney(disconnected).journey.scenes[0].duration!==savedBasis.journey.scenes[0].duration,'Removing material binding breaks native round-trip equality (negative control)');
 // Fault injection removes only the file-execution reply. A routing receipt
 // cannot close persistence or create an artifact in the real native ground.
 const unsaved=initialiseSceneSaves(blankJourney());unsaved.name='Disconnected save negative';
 const noSave=new NativeWorking({...ports,file:request=>request.operation==='perform'?Promise.resolve({state:'routed'}):ports.file(request)});
 await assert.rejects(()=>noSave.saveFile(snapshot(unsaved),{parent_path:'Work/Notes',name:'not-saved.expression.json'}),/did not confirm/);
 check(!existsSync(resolve(project,'not-saved.expression.json'))&&noSave.state.pending.kind==='file','Removing native file execution fails proof and retains its pending intent (fault-injected negative)');
 receipt.passed=true;
}catch(error){receipt.failure=String(error);throw error;}
finally{await stop();receipt.requests=effects;receipt.logs=logs;writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({passed:receipt.passed,checks:receipt.checks.length,failure:receipt.failure,ground}));}
