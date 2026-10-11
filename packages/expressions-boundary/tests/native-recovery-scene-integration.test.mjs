import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve,sep} from 'node:path';
const storageArg=process.execArgv.find(value=>value.startsWith('--localstorage-file='));
assert.ok(storageArg,'run with --experimental-webstorage --localstorage-file=<owned OS temporary file>');
assert.ok(resolve(storageArg.slice('--localstorage-file='.length)).startsWith(resolve(tmpdir())+sep),'tests require an owned OS temporary storage file');
assert.equal(typeof localStorage.getItem,'function');
beforeEach(()=>localStorage.clear());
const root=new URL('../../../',import.meta.url),compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(u).pathname}).outputText}}`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{NativeWorking,validateWorkingRecord},{DocumentStore},{validateJourney,clone},{captureNativeAdoption},{createRetainedNativeEditor,installNativeEditorReceiver},{readNativeExpressionsContent,createNativeContentActions},{currentNativeSceneReply,createNativeCompositionPresentationGuard},typescript]=await Promise.all([
 import(new URL('nativeWorking.ts',author)),import(new URL('store.ts',author)),import(new URL('model.ts',author)),import(new URL('nativeWorkspace.ts',author)),import(new URL('hostEditor.ts',author)),import(new URL('packages/live-shell/ui/src/shell/nativeContent.ts',root)),import(new URL('packages/live-shell/ui/src/shell/compositionViews.ts',root)),import(compiler)]);
const ts=typescript.default,files={};
const {sameSceneData}=await import(new URL('sceneCorrespondence.ts',author));
const {saveScene,restoreScene}=await import(new URL('sceneWorkflow.ts',author));
const {preserveRecoveryLibraryCopies}=await import(new URL('recoveryLibrary.ts',author));
const {STORAGE_KEY,saveToLibrary,readLibraryDetailed}=await import(new URL('store.ts',author));
for(const [name,path] of Object.entries({nativeRecovery:'desktop/cradle/expressions-app/field-studies-journeys/src/nativeRecovery.ts',recovery:'desktop/cradle/expressions-app/field-studies-journeys/src/recovery.ts',workspace:'desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorkspace.ts',transport:'packages/live-shell/ui/src/components/NativeSceneTransport.tsx',session:'packages/live-shell/ui/src/components/SessionView.tsx'}))files[name]=ts.createSourceFile(path,await readFile(new URL(path,root),'utf8'),ts.ScriptTarget.Latest,true);
const nodes=(file,predicate)=>{const found=[];const walk=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,walk)};walk(file);return found};
const execute=(text,bindings)=>new Function(...Object.keys(bindings),ts.transpileModule(`const receive=${text};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+'\nreturn receive;')(...Object.values(bindings));
const callback=(file,name)=>nodes(file,n=>ts.isVariableDeclaration(n)&&n.name.getText(file)===name)[0].initializer.getText(file);
const functions=(file,names,bindings)=>{
 const functions=file.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name&&names.includes(n.name.text));assert.equal(functions.length,names.length);
 const text=functions.map(n=>n.getText(file).replace(/^export /,'')).join('\n');
 return new Function(...Object.keys(bindings),ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+`\nreturn {${names.join(',')}};`)(...Object.values(bindings));
};
const base='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/';
const inputs=await Promise.all(['native-recovery-checkpoint-read-20261008.json','native-recovery-draft-read-20261008.json'].map(async name=>JSON.parse(await readFile(base+name,'utf8'))));
for(const input of inputs){assert.equal(input.response.ok,true);assert.equal(input.response.outcome.result,'expression_recovery')}
const record=inputs[0].response.outcome.data.record.value,binding={scope:inputs[0].request.request.scope,checkpoint_id:inputs[0].request.request.id,expression_ref:record.view.document.expression_ref};
const closed=Error('Native mutations are closed during this source integration review');
function recovery(beforeRead=async()=>{}) {
 const state={bindings:new Map(),drafts:new Map(),revisions:new Map(),queues:new Map(),readReceipts:new WeakMap(),latestReadRevisions:new Map()},requests=[];
 const native=functions(files.nativeRecovery,['nativeRead','rememberReading','collectNativeRecoveryBasis','validateNativeRecoveryBasis','acceptNativeRecoveryBasis','acceptRecoveryDraft'],{...state,key:(scope,kind,id)=>`${scope}:${kind}:${id}`,nativeRecoveryRequest:async request=>{
  requests.push(request);await beforeRead(request);const input=inputs.find(row=>JSON.stringify(row.request.request)===JSON.stringify(request));assert.ok(input,'only genuine archived owner reads are admitted');return structuredClone(input.response.outcome.data);
 }});
 const receiving=functions(files.recovery,['readBoundWorkingDraft','acceptWorkingRecoveryBasis'],{...native,hostedRecovery:()=>true,validateJourney,validateWorkingRecord,sameSceneData,preserveRecoveryLibraryCopies});
 return {...state,...native,...receiving,requests};
}
test('actual bound recovery read carries original owner records without accepting newer CAS and explicit validated adoption couples them',async()=>{
 const r=recovery(),address=`${binding.scope}:checkpoint:${binding.checkpoint_id}`;r.revisions.set(address,2301);
 const recovered=await r.readBoundWorkingDraft(binding);assert.equal(recovered.recoveryRecords.length,2);
 assert.deepEqual(recovered.record.view.document,record.view.document);assert.equal(recovered.record.draft_id,record.draft_id);assert.equal(r.revisions.get(address),2301);
 r.acceptWorkingRecoveryBasis(recovered,()=>true);assert.equal(r.revisions.get(address),2591);
});
test('recovery receiving refuses a valid altered checkpoint body or draft that is disconnected from its actual read receipts',async()=>{
 for(const change of [value=>{value.record.view.document.title+=' unacknowledged'},value=>{value.journey.name+=' unacknowledged'},value=>{value.journey.updatedAt='2000-01-01T00:00:00.000Z'}]) {
  const r=recovery(),address=`${binding.scope}:checkpoint:${binding.checkpoint_id}`;r.revisions.set(address,2301);
  const recovered=await r.readBoundWorkingDraft(binding),before=new Map(r.revisions);change(recovered);
  assert.throws(()=>r.acceptWorkingRecoveryBasis(recovered,()=>true),/read|receipt|basis|acknowledged/);
  assert.deepEqual(r.revisions,before);
 }
});
test('retired adoption refuses before any durable Library retention or recovery CAS acceptance',async()=>{
 const r=recovery(),address=`${binding.scope}:checkpoint:${binding.checkpoint_id}`;r.revisions.set(address,2301);
 const recovered=await r.readBoundWorkingDraft(binding),local=clone(recovered.journey);local.description+=' retained local material';saveToLibrary(local);
 const before=localStorage.getItem(STORAGE_KEY),revisions=new Map(r.revisions);
 assert.throws(()=>r.acceptWorkingRecoveryBasis(recovered,()=>false),/no longer current/);
 assert.equal(localStorage.getItem(STORAGE_KEY),before);assert.deepEqual(r.revisions,revisions);
});
test('actual unreadable Library refuses before acknowledged recovery CAS is consumed and preserves foreign bytes',async()=>{
 const r=recovery(),address=`${binding.scope}:checkpoint:${binding.checkpoint_id}`;r.revisions.set(address,2301);
 const recovered=await r.readBoundWorkingDraft(binding),foreign={schema:'future-library-owner',id:recovered.journey.id,material:['retain verbatim']};
 const raw=JSON.stringify([recovered.journey,foreign]);localStorage.setItem(STORAGE_KEY,raw);const revisions=new Map(r.revisions);
 assert.throws(()=>r.acceptWorkingRecoveryBasis(recovered,()=>true),/unreadable material/);
 assert.equal(localStorage.getItem(STORAGE_KEY),raw);assert.deepEqual(r.revisions,revisions);
});
test('consumer-mutated actual read receipt is refused before any durable Library retention',async()=>{
 const r=recovery(),address=`${binding.scope}:checkpoint:${binding.checkpoint_id}`;r.revisions.set(address,2301);
 const recovered=await r.readBoundWorkingDraft(binding),local=clone(recovered.journey);local.description+=' existing browser definition';saveToLibrary(local);
 const before=localStorage.getItem(STORAGE_KEY),revisions=new Map(r.revisions);
 const checkpoint=recovered.recoveryRecords.find(row=>row.kind==='checkpoint'),draft=recovered.recoveryRecords.find(row=>row.kind==='draft');
 draft.value.name+=' consumer mutation';recovered.journey=validateJourney(draft.value);recovered.record=validateWorkingRecord(checkpoint.value,recovered.journey);
 assert.throws(()=>r.acceptWorkingRecoveryBasis(recovered,()=>true),/body changed after reading/);
 assert.ok(localStorage.getItem(STORAGE_KEY)===before,'invalidated receipt must refuse before any Library write');assert.deepEqual(r.revisions,revisions);
});
test('successful explicit source adoption retains divergent rich Library material before adopting actual read basis',async()=>{
 const r=recovery(),address=`${binding.scope}:checkpoint:${binding.checkpoint_id}`;r.revisions.set(address,2301);
 const recovered=await r.readBoundWorkingDraft(binding),local=clone(recovered.journey);local.scenes[0].entities[0].sequence.steps[0].hold=2.45;saveToLibrary(local);
 r.acceptWorkingRecoveryBasis(recovered,()=>true);
 const library=readLibraryDetailed(),copy=library.journeys.find(row=>row.id!==local.id);
 assert.ok(copy);assert.equal(copy.scenes[0].entities[0].sequence.steps[0].hold,2.45);
 assert.deepEqual(library.journeys.find(row=>row.id===local.id),local);assert.equal(r.revisions.get(address),2591);
});
function working(checkpoint=()=>{throw closed}) {
 const validated=validateWorkingRecord(record,record.view.journey),store=new DocumentStore(validated.view.journey);
 const work=new NativeWorking({expression:()=>{throw closed},file:()=>{throw closed},mint:()=>{throw closed},checkpoint});work.restore(validated,store.document);
 return {store,work};
}
test('actual follow of already retained native work leaves dirty material, clock and recovery untouched',async()=>{
 const {store,work}=working(),local=structuredClone(store.document);local.scenes[0].entities[0].sequence.steps[0].hold=2.45;store.replace(local);
 const before=structuredClone(store.document),calls=[],host={snapshot:()=>({journey:structuredClone(store.document)}),version:()=>store.revision};
 const run=execute(`()=>{let followGeneration=0;return ${callback(files.workspace,'followOpen')};}`,{host,work,opens:{cancel:()=>calls.push('cancel')},hostedRecovery:()=>true,recoveryBinding:()=>binding,status:value=>calls.push(value)})();
 await run(binding.expression_ref);assert.deepEqual(store.document,before);assert.equal(store.undoStack.length,1);assert.equal(work.state.view.document.revision,11);
 assert.equal(calls.length,2);assert.match(calls[1],/transport and working draft were retained/);
});
test('actual follow refuses before destination reading/adoption when departing draft cannot be durably retained',async()=>{
 const {store,work}=working(),host={snapshot:()=>({journey:structuredClone(store.document)}),version:()=>store.revision,shouldRetainDraft:()=>true},calls=[];
 const run=execute(`()=>{let followGeneration=0;return ${callback(files.workspace,'followOpen')};}`,{host,work,opens:{cancel:()=>{}},hostedRecovery:()=>true,recoveryBinding:()=>binding,captureNativeAdoption,clone,writeDraft:async()=>{calls.push('retain');throw closed},readBoundWorkingDraft:()=>assert.fail('Refused departing draft must precede destination read')})();
 const before=work.state;await assert.rejects(run('expression:authored-acb9d00d-e7e4-4f2f-948f-395914da17b1'),error=>error===closed);
 assert.deepEqual(calls,['retain']);assert.deepEqual(work.state,before);
});
test('human input arriving during genuine recovery reading prevents basis acceptance and native adoption',async()=>{
 let release,entered;const barrier=new Promise(resolve=>{release=resolve}),started=new Promise(resolve=>{entered=resolve});
 const r=recovery(async request=>{if(request.kind==='checkpoint'){entered();await barrier}}),{store,work}=working();work.detach();
 const address=`${binding.scope}:checkpoint:${binding.checkpoint_id}`;r.revisions.set(address,2301);
 const host={snapshot:()=>({journey:structuredClone(store.document)}),version:()=>store.revision,shouldRetainDraft:()=>false};
 const requireAdoption=execute(callback(files.workspace,'requireAdoption'),{});
 const run=execute(`()=>{let followGeneration=0;return ${callback(files.workspace,'followOpen')};}`,{host,work,opens:{cancel:()=>{}},hostedRecovery:()=>true,recoveryBinding:()=>binding,captureNativeAdoption,clone,requireAdoption,readBoundWorkingDraft:r.readBoundWorkingDraft,acceptWorkingRecoveryBasis:()=>assert.fail('New human input cannot consume recovery CAS'),actPerforms:()=>assert.fail('New human input must retire this adoption first')})();
 const following=run(binding.expression_ref);await started;
 const local=structuredClone(store.document);local.scenes[0].entities[0].sequence.steps[0].hold=2.45;store.replace(local);const authored=structuredClone(store.document);release();
 await assert.rejects(following,/working draft changed while opening/);assert.deepEqual(store.document,authored);assert.equal(store.undoStack.length,1);assert.equal(work.state,undefined);assert.equal(r.revisions.get(address),2301);
});

function sceneOwner(checkpoint=()=>{throw closed}) {
 const {store,work}=working(checkpoint),view=work.state.view;let epoch=0;
 const owner=createRetainedNativeEditor({store,sceneId:()=>view.startSceneId,selection:()=>({entity_ids:[],step_id:null}),nativeView:()=>work.state.view,change:fn=>store.change(fn),
  nativeSelect:async(id,entityId)=>{await work.select({scene_ref:view.bindings[id].scene_ref,entity_ref:entityId});return 'applied'},
  commit:async()=>{await work.commit({journey:structuredClone(store.document),sceneId:view.startSceneId,entityId:null});return true},afterHistory:()=>{throw closed},selectLocal:()=>{throw closed},openEditor:()=>{throw closed},standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false,
  sceneControls:{read:()=>({scene_ref:view.bindings[view.startSceneId].scene_ref,scene_elapsed_seconds:0,expression_time_seconds:0,scene_playing:false,saved_sequence_playing:false,field_paused:false,track_preview:false,intent_epoch:epoch}),recording:()=>false,focus:()=>{throw closed},transport:()=>{throw closed},seek:()=>{throw closed},snapshot:input=>store.change(()=>{const scene=store.document.scenes.find(row=>row.id===view.startSceneId);if(input.action==='restore-snapshot')restoreScene(store.document,scene.id);else saveScene(store.document,scene,input.name)})}});
 return {owner,store,advanceIntent:()=>{epoch++}};
}
function editor(t,owner) {
 const target=new EventTarget(),pending=new Map();let req=0;
 const parent={postMessage:data=>{if(data.kind==='result'){pending.get(data.req)?.(data.reply);pending.delete(data.req)}}};target.parent=parent;target.location={origin:'http://source-review.invalid'};
 const receiver=installNativeEditorReceiver(owner,target);t.after(()=>receiver.dispose());
 return {request:request=>new Promise(resolve=>{const id=String(++req);pending.set(id,resolve);const event=new Event('message');Object.defineProperties(event,{source:{value:parent},origin:{value:target.location.origin},data:{value:{schema:'oi.native-editor/v1',kind:'request',token:'source-review',bindingId:'existing-editor',epoch:0,req:id,request}}});target.dispatchEvent(event)})};
}
const viewSource=(reading,actions=null,presented=()=>true)=>({owner:'expressions',content:readNativeExpressionsContent(reading),actions,isPresented:presented,revealDetail:()=>assert.fail('Transport must not invent a detail reveal')});
test('actual Scene action uses captured native/authored/transport basis and real receiver refuses changed human intent',async t=>{
 const r=sceneOwner(),controller=editor(t,r.owner),read=await controller.request({operation:'read'});assert.equal(read.ok,true);
 const captured=viewSource(read.reading),actions=createNativeContentActions(captured.content,controller);r.advanceIntent();
 const reply=await actions.scene({action:'pause'});assert.equal(reply.ok,false);assert.match(reply.error,/transport intent changed/);
 const current=viewSource(r.owner.read());assert.equal(currentNativeSceneReply(captured,current,reply,{action:'pause'}),false,'an old refusal must not replace the newer human transport presentation');
});
test('untyped Scene action operands cannot replace the captured operation, authored basis or transport intent',async t=>{
 const r=sceneOwner(),controller=editor(t,r.owner),read=await controller.request({operation:'read'}),actions=createNativeContentActions(readNativeExpressionsContent(read.reading),controller);
 r.advanceIntent();const newer=r.owner.read();
 for(const extra of [{intent_epoch:newer.playback.intent_epoch},{operation:'read',basis:newer.basis,intent_epoch:newer.playback.intent_epoch}]) {
  const reply=await actions.scene({action:'pause',...extra});assert.equal(reply.ok,false);assert.match(reply.error,/transport intent changed/);
 }
 const local=structuredClone(r.store.document);local.scenes[0].entities[0].sequence.steps[0].hold=2.45;r.store.replace(local);
 const reply=await actions.scene({action:'pause',basis:r.owner.read().basis,intent_epoch:r.owner.read().playback.intent_epoch});
 assert.equal(reply.ok,false);assert.match(reply.error,/captured scene|captured Scene|authoring revision changed/);
});
test('Scene reply qualification refuses hidden current cut and mismatched actual receiver reading intent',async t=>{
 const r=sceneOwner(),controller=editor(t,r.owner),reply=await controller.request({operation:'read'});assert.equal(reply.ok,true);
 const captured=viewSource(reply.reading);r.advanceIntent();const current=viewSource(r.owner.read());
 assert.equal(currentNativeSceneReply(captured,current,reply,{action:'pause'}),false,'a genuine old reading is not the current transport acknowledgement');
 assert.equal(currentNativeSceneReply(captured,viewSource(reply.reading,null,()=>false),reply,{action:'pause'}),false,'hidden current cuts cannot settle presentation');
 assert.equal(currentNativeSceneReply(captured,viewSource(reply.reading),reply,{action:'focus',scene_ref:captured.content.basis.scene_ref+':absent'}),false,'a reading of one native Scene cannot acknowledge focus on another target');
});
test('actual Scene action dispatcher refuses wrong target and live human transaction without native effects',async t=>{
 const r=sceneOwner(),controller=editor(t,r.owner),read=await controller.request({operation:'read'}),content=readNativeExpressionsContent(read.reading),actions=createNativeContentActions(content,controller);
 const wrong=await actions.scene({action:'seek',scene_ref:content.basis.scene_ref+':absent',seconds:0,sequence:'working'});
 assert.equal(wrong.ok,false);assert.match(wrong.error,/not loaded/);
 r.store.begin();r.store.document.scenes[0].entities[0].sequence.steps[0].hold=2.45;r.store.touch();const before=structuredClone(r.store.document);
 const interrupted=await actions.scene({action:'pause'});assert.equal(interrupted.ok,false);assert.match(interrupted.error,/human gesture/);assert.equal(r.store.transactionOpen,true);assert.deepEqual(r.store.document,before);
 assert.equal(currentNativeSceneReply(viewSource(read.reading),viewSource(r.owner.read()),interrupted,{action:'pause'}),false);
});
test('actual Scene snapshot refusal retains the authored snapshot and one Undo through native checkpoint failure',async t=>{
 const checkpoints=[],r=sceneOwner((_id,value)=>{checkpoints.push(structuredClone(value));throw closed}),controller=editor(t,r.owner),read=await controller.request({operation:'read'}),before=structuredClone(r.store.document);
 const reply=await createNativeContentActions(readNativeExpressionsContent(read.reading),controller).scene({action:'save-snapshot',name:'Independently retained Scene',next:false});
 assert.equal(reply.ok,false);assert.match(reply.error,/Native mutations are closed/);assert.equal(checkpoints.length,1);assert.equal(checkpoints[0].pending.kind,'edit');assert.equal(r.store.undoStack.length,1);
 const scene=r.store.document.scenes[0];assert.equal(scene.name,'Independently retained Scene');assert.deepEqual(r.store.document.savedScenes[scene.id],scene);
 assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,before);
});
test('actual SceneTransport async settlement stops after its production mounted cleanup',async t=>{
 let reject,entered;const waiting=new Promise((_,r)=>{reject=r}),started=new Promise(resolve=>{entered=resolve});
 const r=sceneOwner(()=>{entered();return waiting}),controller=editor(t,r.owner),read=await controller.request({operation:'read'}),updates=[];
 const source=viewSource(read.reading,createNativeContentActions(readNativeExpressionsContent(read.reading),controller)),lifetime={current:{mounted:false,epoch:0}},latest={current:source};
 const effect=nodes(files.transport,n=>ts.isCallExpression(n)&&n.expression.getText(files.transport)==='useEffect'&&n.arguments[0]?.getText(files.transport).includes('lifetime.current.mounted=true'))[0];
 const cleanup=execute(effect.arguments[0].getText(files.transport),{lifetime})();
 const settle=execute(callback(files.transport,'settle'),{source,lifetime,latest,currentNativeSceneReply,setBusy:value=>updates.push(['busy',value]),setFault:value=>updates.push(['fault',value])});
 const finishing=settle({action:'focus',scene_ref:source.content.basis.scene_ref});await started;
 cleanup();const before=updates.length;reject(closed);await finishing;
 assert.equal(updates.length,before);assert.deepEqual(updates,[['busy',true],['fault',null]]);assert.equal(r.store.undoStack.length,0);
});
test('actual SceneTransport late refusal keeps a newer human draft and clears only its own busy state',async t=>{
 let reject,entered;const waiting=new Promise((_,r)=>{reject=r}),started=new Promise(resolve=>{entered=resolve});
 const r=sceneOwner(()=>{entered();return waiting}),controller=editor(t,r.owner),read=await controller.request({operation:'read'}),updates=[];
 const source=viewSource(read.reading,createNativeContentActions(readNativeExpressionsContent(read.reading),controller)),lifetime={current:{mounted:true,epoch:3}},latest={current:source};
 const settle=execute(callback(files.transport,'settle'),{source,lifetime,latest,currentNativeSceneReply,setBusy:value=>updates.push(['busy',value]),setFault:value=>updates.push(['fault',value])});
 const finishing=settle({action:'focus',scene_ref:source.content.basis.scene_ref});await started;
 const local=structuredClone(r.store.document);local.scenes[0].entities[0].sequence.steps[0].hold=2.45;r.store.replace(local);const authored=structuredClone(r.store.document);
 latest.current=viewSource(r.owner.read());reject(closed);await finishing;
 assert.deepEqual(updates,[['busy',true],['fault',null],['busy',false]]);assert.deepEqual(r.store.document,authored);assert.equal(r.store.undoStack.length,1);
});
test('actual SceneTransport hidden originating cut refuses before any retained editor request',async()=>{
 const r=sceneOwner(),source=viewSource(r.owner.read(),{scene:()=>assert.fail('A hidden source cut cannot dispatch')},()=>false),updates=[];
 const settle=execute(callback(files.transport,'settle'),{source,lifetime:{current:{mounted:true,epoch:3}},latest:{current:source},currentNativeSceneReply,setBusy:value=>updates.push(value),setFault:value=>updates.push(value)});
 await settle({action:'pause'});assert.deepEqual(updates,[]);assert.equal(r.store.undoStack.length,0);
});
test('actual Session Scene action cannot publish a correlated late refusal after its presentation mount retires',async t=>{
 let reject,entered;const waiting=new Promise((_,r)=>{reject=r}),started=new Promise(resolve=>{entered=resolve});
 const r=sceneOwner(()=>{entered();return waiting}),controller=editor(t,r.owner),read=await controller.request({operation:'read'}),faults=[];
 const source=viewSource(read.reading,createNativeContentActions(readNativeExpressionsContent(read.reading),controller)),latest={current:source},presentation=createNativeCompositionPresentationGuard(),cleanup=presentation.mount();
 const sceneAction=execute(callback(files.session,'sceneAction'),{source,latest,presentation,currentNativeSceneReply,setFault:value=>faults.push(value)});
 const finishing=sceneAction({action:'focus',scene_ref:source.content.basis.scene_ref});await started;
 cleanup();reject(closed);await finishing;assert.deepEqual(faults,[]);assert.equal(r.store.undoStack.length,0);
});
