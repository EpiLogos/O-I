import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
const [{kernelDocumentToJourney},{DocumentStore},{NativeWorking},{NativeSelectionQueue},{createRetainedNativeEditor,installNativeEditorReceiver}]=await Promise.all([
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts'),import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking.ts'),import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeSelectionQueue.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts')]);
const path='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const input=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(input.before.document,input.after.document);
const document=input.after.document;
function retained(selectedDocument=document) {
 const view=kernelDocumentToJourney(selectedDocument),store=new DocumentStore(view.journey),scene=store.document.scenes.find(row=>row.id===view.startSceneId),occurrence=view.bindings[scene.id].occurrences.find(row=>row.entity_ref===selectedDocument.selection.entity_ref)??view.bindings[scene.id].occurrences[0],entity=scene.entities.find(row=>row.id===occurrence.view_entity_id);
 assert.ok(occurrence);assert.equal(selectedDocument.selection.scene_ref,view.bindings[scene.id].scene_ref);assert.ok(!selectedDocument.selection.relation_ref);
 let release,entered;const barrier=new Promise(resolve=>{release=resolve}),started=new Promise(resolve=>{entered=resolve}),local=[],editors=[],native=[],checkpoints=[];
 const closed=()=>{throw Error('Native mutations remain closed in source owner-selection verification')};
 const work=new NativeWorking({expression:closed,file:closed,mint:closed,checkpoint:(_id,record)=>{checkpoints.push(record);closed()}});
 work.restore({schema:'oi.native-working/v1',draft_id:view.journey.id,view},store.document);
 const queue=new NativeSelectionQueue({available:()=>!work.busy,current:()=>true,apply:async intent=>{await work.select(intent);return true}});
 let sceneId=scene.id;
 const owner=createRetainedNativeEditor({store,sceneId:()=>sceneId,selection:()=>({entity_ids:[entity.id],step_id:entity.sequence.steps[0].id}),nativeView:()=>work.state.view,
  nativeSelect:async(id,target)=>{native.push({id,target});entered();await barrier;return queue.submit({scene_ref:view.bindings[id].scene_ref,entity_ref:target===null?null:view.bindings[id].occurrences.find(row=>row.view_entity_id===target).entity_ref})},
  change:fn=>store.change(fn),commit:closed,afterHistory:closed,selectLocal:(id,index)=>local.push({id,index}),openEditor:(editor,id,index)=>editors.push({editor,id,index}),standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
 return {owner,scene,entity,view,store,local,editors,native,checkpoints,started,release,setScene:value=>{sceneId=value}};
}
function request(r,operation){return operation==='select'?{operation,basis:r.owner.read().basis,entity_id:r.entity.id,step_id:r.entity.sequence.steps[0].id}:{operation,basis:r.owner.read().basis,entity_id:r.entity.id,step_id:r.entity.sequence.steps[0].id,editor:'layers'}}

test('actual already-focused native no-op still selects/opens its exact stable state without checkpoint or new native acceptance',async()=>{
 for(const operation of ['select','open']) {
  const r=retained(),before=structuredClone(r.store.document),pending=r.owner[operation](request(r,operation));await r.started;r.release();await pending;
  assert.deepEqual(r.local,[{id:r.entity.id,index:0}]);assert.equal(r.editors.length,operation==='open'?1:0);assert.equal(r.checkpoints.length,0);assert.deepEqual(r.store.document,before);
 }
});

test('retired callback or scene-only navigation during real no-op selection refuses local select/open',async()=>{
 for(const operation of ['select','open'])for(const transition of ['retired','scene']){
  const r=retained();let current=true;const pending=r.owner[operation](request(r,operation),()=>current);await r.started;
  if(transition==='retired')current=false;else r.setScene('departed-scene');
  r.release();await assert.rejects(pending,/editor lifetime changed|Open a native scene/);
  assert.deepEqual(r.local,[]);assert.deepEqual(r.editors,[]);assert.equal(r.checkpoints.length,0);
 }
});

test('even an untouched open human transaction during await retains its draft and refuses source/selection presentation',async()=>{
 for(const operation of ['select','open']){
  const r=retained(),pending=r.owner[operation](request(r,operation));await r.started;r.store.begin();const before=structuredClone(r.store.document);
  r.release();await assert.rejects(pending,/current human work was retained/);assert.equal(r.store.transactionOpen,true);assert.deepEqual(r.store.document,before);assert.deepEqual(r.local,[]);assert.deepEqual(r.editors,[]);
 }
});

test('stale native/authored basis and retired lifetime refuse before any owner selection attempt',async()=>{
 for(const operation of ['select','open']) {
  const r=retained(),intent=request(r,operation);intent.basis.authored_revision++;
  await assert.rejects(r.owner[operation](intent),/captured scene or authoring revision/);assert.equal(r.native.length,0);
  const current=request(r,operation);await assert.rejects(r.owner[operation](current,()=>false),/editor lifetime changed/);assert.equal(r.native.length,0);
 }
});

test('real receiver disposal invalidates an awaited select before local focus is admitted',async()=>{
 const r=retained(),target=new EventTarget(),sent=[];target.parent={postMessage:data=>sent.push(data)};target.location={origin:'http://source-review.invalid'};
 const receiver=installNativeEditorReceiver(r.owner,target);
 const send=(req,operation)=>{const event=new Event('message');Object.defineProperties(event,{source:{value:target.parent},origin:{value:target.location.origin},data:{value:{schema:'oi.native-editor/v1',kind:'request',token:'owner-review',bindingId:'source-receiver',epoch:0,req,request:operation}}});target.dispatchEvent(event)};
 send('read',{operation:'read'});assert.ok(sent.some(row=>row.req==='read'&&row.reply.ok));send('select',request(r,'select'));await r.started;
 receiver.dispose();r.release();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(r.local,[]);assert.deepEqual(r.editors,[]);assert.ok(!sent.some(row=>row.req==='select'));
});

test('actual acknowledged Field receipt supports null-focus no-op; retired Field callback cannot clear newer local selection',async()=>{
 const receipt=JSON.parse(await readFile('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/glyph-ui-field-selection-ack-20261008.json','utf8'));
 assert.equal(receipt.response.ok,true);assert.equal(receipt.response.outcome.result,'expression');const fieldDocument=receipt.response.outcome.data.document;assert.equal(fieldDocument.selection.entity_ref,null);
 for(const retired of [false,true]){
  const r=retained(fieldDocument);let current=true;
  const pending=r.owner.selectField({operation:'select-field',basis:r.owner.read().basis},()=>current);await r.started;current=!retired;r.release();
  if(retired){await assert.rejects(pending,/editor lifetime changed/);assert.deepEqual(r.local,[])}
  else{await pending;assert.deepEqual(r.local,[{id:null,index:0}])}
  assert.equal(r.checkpoints.length,0);
 }
});
