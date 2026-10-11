import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
const root=new URL('../../../',import.meta.url);
const compiler=new URL('desktop/cradle/node_modules/typescript/lib/typescript.js',root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
 try{return await next(specifier,context)}catch(error){
  if(!specifier.startsWith('.'))throw error;
  if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
  for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
  throw error;
 }
}
export async function load(url,context,next){
 if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
 return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`,import.meta.url);
const author=new URL('desktop/cradle/expressions-app/field-studies-journeys/src/',root);
const [{kernelDocumentToJourney},{DocumentStore},{createRetainedNativeEditor},{NativeWorking},{NativeSelectionQueue},{readNativeExpressionsContent,createNativeContentActions}]=await Promise.all([
 import(new URL('kernelDocumentBridge.ts',author)),import(new URL('store.ts',author)),import(new URL('hostEditor.ts',author)),
 import(new URL('nativeWorking.ts',author)),import(new URL('nativeSelectionQueue.ts',author)),
 import(new URL('packages/live-shell/ui/src/shell/nativeContent.ts',root)),
]);
const path=process.env.OI_NATIVE_COMPOSITION_RECEIPT??'/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(path,'utf8')),document=receipt.after.document;
assert.deepEqual(document,receipt.before.document);
const nativeBytes=JSON.stringify(document);
function retained(){
 const view=kernelDocumentToJourney(document),store=new DocumentStore(view.journey);
 const scene=store.document.scenes.find(scene=>scene.id===view.startSceneId)??store.document.scenes[0],binding=view.bindings[scene.id];
 const entity=binding.occurrences.find(row=>row.entity_ref===document.selection.entity_ref)??binding.occurrences[0];
 const selection={entity_ids:[entity.view_entity_id],step_id:scene.entities[0].sequence.steps[0].id};
 const attempts=[],checkpoints=[],local=[];let pending=false;
 const closed=()=>{throw Error('Native effects and checkpoint writes are closed during source verification')};
 const work=new NativeWorking({expression:closed,file:closed,mint:closed,checkpoint:async(id,record)=>{checkpoints.push({id,record:structuredClone(record)});return closed()}});
 work.restore({schema:'oi.native-working/v1',draft_id:view.journey.id,view},store.document);
 const queue=new NativeSelectionQueue({available:()=>!work.busy,current:()=>true,apply:async intent=>{
  await work.select({scene_ref:intent.scene_ref,entity_ref:intent.entity_ref});return true;
 }});
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>selection,nativeView:()=>view,
  nativeSelect:(sceneId,entityId)=>{attempts.push({sceneId,entityId});return queue.submit({scene_ref:view.bindings[sceneId].scene_ref,entity_ref:entityId===null?null:view.bindings[sceneId].occurrences.find(row=>row.view_entity_id===entityId).entity_ref})},
  commit:closed,change:mutate=>store.change(mutate),afterHistory:closed,
  selectLocal:(id,index)=>{local.push({id,index});selection.entity_ids=id===null?[]:[id];selection.step_id=id===null?null:scene.entities.find(entity=>entity.id===id)?.sequence.steps[index]?.id??null},openEditor:closed,
  standing:()=>({busy:pending,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
 return {view,store,scene,owner,selection,attempts,checkpoints,local,setPending:value=>{pending=value}};
}
test('Field request carries only its exact captured native basis, never a fabricated entity',async()=>{
 const r=retained(),reading=r.owner.read(),content=readNativeExpressionsContent(reading),requests=[];
 const actions=createNativeContentActions(content,{request:async request=>{requests.push(structuredClone(request));await r.owner.selectField(request);throw Error('No native outcome may be manufactured')}});
 await assert.rejects(actions.selectField(),/superseded or refused/);
 assert.deepEqual(requests,[{operation:'select-field',basis:reading.basis}]);
 assert.deepEqual(r.attempts,[{sceneId:r.scene.id,entityId:null}]);assert.equal(r.local.length,0);
});
test('actual NativeWorking focus compiler stages null focus at exact revision before the closed checkpoint boundary',async()=>{
 const r=retained(),before=structuredClone(r.store.document),selection=structuredClone(r.selection);
 await assert.rejects(r.owner.selectField({operation:'select-field',basis:r.owner.read().basis}),/superseded or refused/);
 assert.equal(r.checkpoints.length,1);
 const pending=r.checkpoints[0].record.pending,request=pending.request;
 assert.equal(pending.kind,'selection');assert.equal(request.operation,'edit');
 assert.equal(request.expression_ref,document.expression_ref);assert.equal(request.expected_revision,document.revision);
 assert.equal(request.changes.length,1);assert.equal(request.changes[0].change,'focus');
 assert.equal(request.changes[0].scene_ref,r.view.bindings[r.scene.id].scene_ref);assert.equal(request.changes[0].entity_ref,null);
 assert.deepEqual(r.store.document,before);assert.deepEqual(r.selection,selection);
 assert.equal(r.store.undoStack.length,0);assert.equal(r.store.redoStack.length,0);assert.equal(r.local.length,0);
 assert.equal(JSON.stringify(document),nativeBytes);
});
test('each stale native/authored basis component refuses before a native focus attempt',async()=>{
 for(const key of ['expression_ref','scene_ref','revision','authored_revision']){
  const r=retained(),basis={...r.owner.read().basis};basis[key]=typeof basis[key]==='number'?basis[key]+1:basis[key]+':other';
  await assert.rejects(r.owner.selectField({operation:'select-field',basis}),/captured scene or authoring revision changed/);
  assert.equal(r.attempts.length,0);assert.equal(r.checkpoints.length,0);assert.equal(r.local.length,0);
 }
});
test('Field selection refuses disguised entity or stable-state targets before dispatch',async()=>{
 for(const extra of [{entity_id:''},{entity_id:'Field'},{step_id:'state:other'}]){
  const r=retained();
  await assert.rejects(r.owner.selectField({operation:'select-field',basis:r.owner.read().basis,...extra}),/only its operation/);
  assert.equal(r.attempts.length,0);assert.equal(r.checkpoints.length,0);
 }
});
test('pending owner operation and a touched human gesture retain selection/draft without native dispatch',async()=>{
 const r=retained();r.setPending(true);
 await assert.rejects(r.owner.selectField({operation:'select-field',basis:r.owner.read().basis}),/awaiting acknowledgement/);
 r.setPending(false);r.store.begin();r.store.document.scenes[0].entities[0].name+=' uncommitted';r.store.touch();
 const draft=structuredClone(r.store.document),selection=structuredClone(r.selection),revision=r.store.revision;
 await assert.rejects(r.owner.selectField({operation:'select-field',basis:r.owner.read().basis}),/current human gesture/);
 assert.deepEqual(r.store.document,draft);assert.deepEqual(r.selection,selection);assert.equal(r.store.revision,revision);
 assert.equal(r.store.transactionOpen,true);assert.equal(r.attempts.length,0);assert.equal(r.checkpoints.length,0);assert.equal(r.local.length,0);
});
test('standard entity select retains its exact native entity target and does not become Field selection',async()=>{
 const r=retained(),id=r.selection.entity_ids[0];
 const nativeRef=r.view.bindings[r.scene.id].occurrences.find(row=>row.view_entity_id===id).entity_ref;
 const alreadyFocused=document.selection.entity_ref===nativeRef&&!document.selection.relation_ref;
 const request={operation:'select',basis:r.owner.read().basis,entity_id:id};
 if(alreadyFocused)await r.owner.select(request);
 else await assert.rejects(r.owner.select(request),/superseded or refused/);
 assert.deepEqual(r.attempts,[{sceneId:r.scene.id,entityId:id}]);
 if(alreadyFocused){assert.equal(r.checkpoints.length,0);assert.deepEqual(r.local,[{id,index:0}]);assert.deepEqual(r.selection.entity_ids,[id]);}
 else{assert.equal(r.checkpoints[0].record.pending.request.changes[0].entity_ref,nativeRef);assert.equal(r.local.length,0);}
 assert.equal(JSON.stringify(document),nativeBytes);
});
