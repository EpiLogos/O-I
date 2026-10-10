/** Material pre-dispatch and local-adoption regressions. All host channels are
 * the production channels: no successful kernel/world reply is fabricated.
 * Acknowledged act follow, CAS and durable material saving require live replay. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

const root=new URL('../../../',import.meta.url);
const typescript=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(typescript)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
 try{return await next(specifier,context)}catch(error){
  if(specifier.startsWith('.')&&specifier.endsWith('.js'))return next(specifier.slice(0,-3)+'.ts',context);
  if(specifier.startsWith('.')&&!/\\.[cm]?[jt]s$/.test(specifier))return next(specifier+'.ts',context);
  throw error;
 }
}
export async function load(url,context,next){
 if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 const source=await readFile(new URL(url),'utf8');
 return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}
`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{createNativeMaterialController,NativeMaterialRefusal},{DocumentStore},{kernelDocumentToJourney},{prepareCompositionEdit},
  {NativeWorking},{captureNativeAdoption},{nativeExpressionRequest,nativeFileRequest},{worldRequest,worldAvailable},{buildReuse,remapReuse}]=await Promise.all([
  import('../src/nativeMaterials.ts'),import(new URL('store.ts',author)),import(new URL('kernelDocumentBridge.ts',author)),
  import(new URL('kernelComposition.ts',author)),import(new URL('nativeWorking.ts',author)),import(new URL('nativeWorkspace.ts',author)),
  import(new URL('kernelExpressions.ts',author)),import(new URL('worldChannel.ts',author)),import(new URL('reuse.ts',author)),
]);
// This is the actual shipped native material, read and converted by production
// code. Reading it is source evidence, not a simulated save acknowledgement.
const material=JSON.parse(await readFile(new URL('desktop/cradle/material/factory-expressions/expression/factory-generic.expression.json',root),'utf8'));
const gate=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function localHost(){
  const view=kernelDocumentToJourney(material),store=new DocumentStore(view.journey);
  let selected=store.document.scenes[0].id,pending=false,flush=async()=>{};
  const calls={flush:0,world:[],expression:[],advance:0,transition:0};
  const host={
    reading:()=>({basis:{expression_ref:view.document.expression_ref,revision:view.document.revision,
      scene_ref:view.bindings[selected].scene_ref,authored_revision:store.revision},scene:store.document.scenes.find(s=>s.id===selected),
      entityOccurrences:{},selection:{entity_ids:[],step_id:null},history:{canUndo:!!store.undoStack.length,canRedo:!!store.redoStack.length},
      standing:{dirty:prepareCompositionEdit(view,store.document).changes.length>0,pending,notice:null}}),
    journey:()=>store.document,nativeView:()=>view,
    flush:async()=>{calls.flush++;await flush();},
    worldRequest:async request=>{calls.world.push(structuredClone(request));return worldRequest(request);},
    expressionRequest:async request=>{calls.expression.push(structuredClone(request));return nativeExpressionRequest(request);},
    advance:async()=>{calls.advance++;throw Error('This pre-dispatch source run has no acknowledged native follow.');},transition:()=>{calls.transition++;},
  };
  return {view,store,host,calls,controller:createNativeMaterialController(host),setPending:value=>{pending=value;},
    select:id=>{selected=id;},setFlush:value=>{flush=value;}};
}
const input=host=>({basis:host.reading().basis,material:{file_ref:'central:exact-captured-material',revision:'captured-file-revision'}});
const untouched=calls=>{assert.deepEqual(calls.world,[]);assert.deepEqual(calls.expression,[]);assert.equal(calls.advance,0);assert.equal(calls.transition,0);};

test('material performance refuses a real edited/undone draft even when the authored content returns to its old value',async()=>{
  const local=localHost(),request=input(local.host),before=structuredClone(local.store.document);
  local.store.change(doc=>{doc.name='Incoming human material draft';});
  assert.equal(local.store.undo(),true);assert.deepEqual(local.store.document.scenes,before.scenes);
  assert.ok(local.store.revision>request.basis.authored_revision);
  await assert.rejects(local.controller.perform(request),error=>error instanceof NativeMaterialRefusal&&/editor basis changed/.test(error.message));
  assert.equal(local.calls.flush,0);untouched(local.calls);assert.equal(local.store.redoStack.length,1);
});

test('pending acknowledgement refuses every material mutation before flushing or reaching an owner',async()=>{
  const local=localHost(),request=input(local.host);local.setPending(true);
  for(const action of [()=>local.controller.perform(request),()=>local.controller.play(request),
    ()=>local.controller.seek({basis:request.basis,act_ref:'act:exact',expected_act_revision:1,position:0}),
    ()=>local.controller.gesture({basis:request.basis,act_ref:'act:exact',expected_act_revision:1,gesture:'nod'})]){
    await assert.rejects(action(),/pending native acknowledgement/);
  }
  assert.equal(local.calls.flush,0);untouched(local.calls);assert.equal(local.store.undoStack.length,0);
});

test('a human draft arriving during flush is retained with its actual undo history and no material write',async()=>{
  const local=localHost(),request=input(local.host),entered=gate(),finish=gate();
  local.setFlush(async()=>{entered.resolve();await finish.promise;});
  const performing=local.controller.perform(request);await entered.promise;
  local.store.change(doc=>{doc.scenes[0].entities[0].name='Retained human draft';});const after=structuredClone(local.store.document);
  finish.resolve();await assert.rejects(performing,/local draft changed/);
  assert.deepEqual(local.store.document,after);assert.equal(local.store.undoStack.length,1);untouched(local.calls);
});

test('Scene navigation during flush cannot retarget a captured material operation',async()=>{
  const local=localHost(),request=input(local.host),entered=gate(),finish=gate();
  assert.ok(local.store.document.scenes.length>1);
  local.setFlush(async()=>{entered.resolve();await finish.promise;});
  const performing=local.controller.perform(request);await entered.promise;
  local.select(local.store.document.scenes[1].id);finish.resolve();
  await assert.rejects(performing,/native location or local draft changed/);
  assert.notEqual(local.host.reading().basis.scene_ref,request.basis.scene_ref);untouched(local.calls);
});

test('caller edits cannot rewrite the captured async basis; exclusive ownership releases after an actual channel refusal',async()=>{
  assert.equal(worldAvailable(),false,'this source run has no native host and must not invent one');
  const local=localHost(),request=input(local.host),original=structuredClone(request),entered=gate(),finish=gate();
  local.setFlush(async()=>{entered.resolve();await finish.promise;});
  const performing=local.controller.perform(request);await entered.promise;
  request.basis.expression_ref='expression:caller-retarget';request.basis.scene_ref='scene:caller-retarget';
  request.material.file_ref='central:caller-retarget';request.material.revision='caller-revision';
  await assert.rejects(local.controller.perform(input(local.host)),/current native material acknowledgement/);
  finish.resolve();await assert.rejects(performing,/kernel host channel is not available/);
  assert.equal(local.calls.world[0].operation,'act_open');assert.equal(local.calls.world[0].expression_ref,original.basis.expression_ref);
  assert.equal(local.calls.transition,0);assert.equal(local.calls.advance,0);assert.deepEqual(local.calls.expression,[]);
  local.setFlush(async()=>{});
  await assert.rejects(local.controller.perform(input(local.host)),/kernel host channel is not available/);
  assert.equal(local.calls.world.length,2,'the actual rejection releases controller exclusivity');
});

test('untracked local composition and invalid material revisions refuse before native dispatch',async()=>{
  const local=localHost(),request=input(local.host),version=local.store.revision;
  // Standing checks also defend a changed composition before its gesture ends.
  local.store.begin();local.store.document.scenes[0].entities[0].name='In-progress local gesture';
  assert.equal(local.store.revision,version);assert.equal(local.host.reading().standing.dirty,true);
  await assert.rejects(local.controller.perform(request),/local draft changed/);untouched(local.calls);
  await assert.rejects(local.controller.perform({...request,material:{...request.material,revision:''}}),/exact native file revision/);
  assert.equal(local.store.transactionOpen,true);assert.equal(local.store.document.scenes[0].entities[0].name,'In-progress local gesture');
});

test('the real working owner refuses to advance a dirty DocumentStore draft without consulting a kernel channel',async()=>{
  const local=localHost(),checkpoints=new Map();
  const work=new NativeWorking({expression:nativeExpressionRequest,file:nativeFileRequest,
    checkpoint:async(id,value)=>{checkpoints.set(id,structuredClone(value));},mint:()=>crypto.randomUUID()});
  const adopted=await work.adopt(material);assert.equal(work.state.view.document.expression_ref,material.expression_ref);
  const store=new DocumentStore(adopted.journey);store.change(doc=>{doc.scenes[0].entities[0].name='Unsaved material edits';});
  const before=structuredClone(store.document),nativeBefore=work.state;
  assert.equal(await work.advanceClean(store.document),null);
  assert.deepEqual(store.document,before);assert.deepEqual(work.state,nativeBefore);assert.equal(checkpoints.size,1);
  assert.equal(local.calls.world.length,0);
});

test('actual native adoption checks the real DocumentStore version after an awaited checkpoint and retains the old basis',async()=>{
  const view=kernelDocumentToJourney(material),store=new DocumentStore(view.journey),checkpoints=new Map();
  let checkpoint=async(id,value)=>{checkpoints.set(id,structuredClone(value));},generation=3;
  const work=new NativeWorking({expression:nativeExpressionRequest,file:nativeFileRequest,
    checkpoint:(id,value)=>checkpoint(id,value),mint:()=>crypto.randomUUID()});
  await work.adopt(material);const prior=work.state,entered=gate(),finish=gate();
  const accept=captureNativeAdoption({snapshot:()=>({journey:store.document,sceneId:store.document.scenes[0].id,entityId:null}),version:()=>store.revision},()=>generation);
  checkpoint=async(id,value)=>{checkpoints.set(id,structuredClone(value));entered.resolve();await finish.promise;};
  const adopting=work.adopt(material,undefined,accept);await entered.promise;
  store.change(doc=>{doc.name='Incoming authored work during checkpoint';});finish.resolve();
  await assert.rejects(adopting,/selected draft changed while opening/);
  assert.deepEqual(work.state,prior);assert.equal(store.document.name,'Incoming authored work during checkpoint');assert.equal(store.undoStack.length,1);
  generation++;assert.equal(accept(),false);
});

test('reusable copy remapping keeps actual role/state/playback references inside its exact native Expression',()=>{
  const {view,store}=localHost(),scene=store.document.scenes[0],nativeScene=view.bindings[scene.id].scene_ref;
  const form={kind:'expression',title:'Actual source copy',entrySceneId:scene.id,states:{entry:scene.id},gestures:{},playback:[scene.id],associations:{workflow_keys:[],task_types:[],skill_set_refs:[],skill_refs:[],event_families:[]}};
  const built=buildReuse(store.document,form,{scene:id=>view.bindings[id]?.scene_ref,
    entity:(sceneId,entityId)=>view.bindings[sceneId]?.occurrences.find(o=>o.view_entity_id===entityId)?.entity_ref});
  assert.equal(built.states.entry,nativeScene);assert.deepEqual(built.playback,[nativeScene]);
  const copy='expression:material-independent-copy',remapped=remapReuse(built,view.document.expression_ref,copy);
  assert.equal(remapped.states.entry,copy+nativeScene.slice(view.document.expression_ref.length));
  assert.deepEqual(remapped.playback,[remapped.states.entry]);assert.equal(built.states.entry,nativeScene);
});
