/** Actual production channels stay closed. These are source/pre-dispatch
 * and archived-owner decoding checks, never successful native Act replay. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
const [{createNativeMaterialController,readNativeActResult,readNativeActList,sameNativeMaterialReadBasis},{requestNativeMaterialEditor},{kernelDocumentToJourney},{prepareCompositionEdit},{DocumentStore},{worldRequest,worldAvailable},{nativeExpressionRequest}]=await Promise.all([
 import('../src/nativeMaterials.ts'),import('../src/materialEditor.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelComposition.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/worldChannel.ts'),
 import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelExpressions.ts'),
]);
const archive='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(archive,'utf8'));
assert.deepEqual(receipt.before.document,receipt.after.document);
const original=receipt.before.document;
function local(){
 const view=kernelDocumentToJourney(structuredClone(original)),store=new DocumentStore(view.journey),calls=[];
 let scene=store.document.scenes[0].id,flush=async()=>{};
 const host={reading:()=>({basis:{expression_ref:view.document.expression_ref,scene_ref:view.bindings[scene].scene_ref,revision:view.document.revision,authored_revision:store.revision},scene:store.document.scenes.find(s=>s.id===scene),entityOccurrences:{},selection:{entity_ids:[],step_id:null},history:{canUndo:!!store.undoStack.length,canRedo:!!store.redoStack.length},standing:{dirty:prepareCompositionEdit(view,store.document).changes.length>0,pending:false,notice:null}}),journey:()=>store.document,nativeView:()=>view,flush:async()=>{calls.push({operation:'flush'});await flush()},worldRequest:async request=>{calls.push(structuredClone(request));return worldRequest(request)},expressionRequest:nativeExpressionRequest,advance:async()=>{throw Error('No acknowledged native follow in this source check')},transition:()=>{throw Error('No acknowledged native transition in this source check')}};
 return {host,view,store,calls,controller:createNativeMaterialController(host),select:id=>{scene=id},flush:fn=>{flush=fn}};
}
const closed=/kernel host channel is not available/;
const v2='oi.expression-act-material/v2';
const act_ref='act:expressions:db2bf871-2dba-4e1e-b98b-d43c1e4be74d'; // actual prior native evidence; no requests to that live owner
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}};

test('archived rich owner material remains intact through real conversion; its inspection cannot masquerade as an Act result',()=>{
 const l=local();assert.deepEqual(l.view.document,original);
 assert.equal(prepareCompositionEdit(l.view,l.store.document).changes.length,0);
 assert.throws(()=>readNativeActResult(receipt.before,{act_ref,expression_ref:original.expression_ref}),/refused/);
 assert.throws(()=>readNativeActList(receipt.before,original.expression_ref),/refused/);
 assert.deepEqual(receipt.before.document,receipt.after.document);
});

test('known retained and legacy inspections choose only their exact existing native grammar, with no fallback',async()=>{
 assert.equal(worldAvailable(),false);
 const l=local();await assert.rejects(l.controller.inspect(act_ref,v2),closed);
 assert.deepEqual(l.calls,[{operation:'act_retained_inspect',act_ref}]);
 await assert.rejects(l.controller.inspect(act_ref),closed);
 assert.deepEqual(l.calls.at(-1),{operation:'act_inspect',act_ref});
 assert.equal(l.store.undoStack.length,0);assert.deepEqual(l.view.document,original);
});

test('unknown or malformed contract identity refuses before any native channel',async()=>{
 const l=local();for(const contract of ['oi.expression-act-material/v3',null,''])await assert.rejects(l.controller.inspect(act_ref,contract),/disclosed material contract/);
 await assert.rejects(l.controller.inspect(''),/exact native Act/);
 assert.deepEqual(l.calls,[]);
});

test('list carries only the exact current Expression filter to the real closed owner channel',async()=>{
 const l=local();await assert.rejects(l.controller.listActs(),closed);
 assert.deepEqual(l.calls,[{operation:'act_list',expression_ref:original.expression_ref}]);
});

test('retained edition read does not flush, mutate or follow; its request keeps the exact Act revision and passage index',async()=>{
 const l=local(),basis=l.host.reading().basis;
 await assert.rejects(l.controller.readEdition({basis,act_ref,expected_act_revision:2,position:0}),closed);
 assert.deepEqual(l.calls,[{operation:'act_retained_edition',act_ref,expected_act_revision:2,position:0}]);
 for(const change of [{position:0.5},{position:-1},{expected_act_revision:NaN},{expected_act_revision:0},{basis:{...basis,revision:basis.revision+1}}])await assert.rejects(l.controller.readEdition({basis,act_ref,expected_act_revision:2,position:0,...change}),/exact native Act revision/);
 assert.equal(l.calls.length,1);assert.equal(l.store.undoStack.length,0);
});

test('retained seek inspects its exact known contract and cannot convert unavailable owner acknowledgement into a replay',async()=>{
 const l=local(),basis=l.host.reading().basis;
 await assert.rejects(l.controller.seek({basis,act_ref,expected_act_revision:2,position:0,material_contract:v2}),closed);
 assert.deepEqual(l.calls,[{operation:'flush'},{operation:'act_retained_inspect',act_ref}]);
 assert.equal(l.calls.some(r=>r.operation==='act_seek'),false);
 await assert.rejects(l.controller.seek({basis,act_ref,expected_act_revision:2,position:0,material_contract:v2}),closed);
 assert.equal(l.calls.length,4,'real channel refusal releases exclusivity without a retry or fallback');
});

test('a captured seek cannot be retargeted by caller changes or a new real human draft during flush',async()=>{
 const l=local(),entered=deferred(),finish=deferred(),basis=l.host.reading().basis;
 l.flush(async()=>{entered.resolve();await finish.promise});
 const input={basis,act_ref,expected_act_revision:2,position:0,material_contract:v2};
 const pending=l.controller.seek(input);await entered.promise;
 input.basis={...basis,expression_ref:'expression:retarget'};input.act_ref='act:retarget';
 l.store.change(doc=>{doc.name='Incoming human Act reading draft'});finish.resolve();
 await assert.rejects(pending,/local draft changed/);
 assert.deepEqual(l.calls,[{operation:'flush'}]);assert.equal(l.store.undoStack.length,1);
 assert.equal(l.store.document.name,'Incoming human Act reading draft');
});

test('router refuses old editor basis for all Act read/replay actions before any actual channel',async()=>{
 const l=local(),basis=l.host.reading().basis;l.store.change(doc=>{doc.name='New human source'});
 for(const request of [{action:'list-acts'},{action:'inspect',act_ref,material_contract:v2},{action:'read-edition',input:{act_ref,expected_act_revision:2,position:0}},{action:'seek',input:{act_ref,expected_act_revision:2,position:0,material_contract:v2}}])await assert.rejects(requestNativeMaterialEditor(l.controller,{operation:'material',basis,...request},()=>l.host.reading().basis),/material destination changed/);
 assert.deepEqual(l.calls,[]);assert.equal(l.store.undoStack.length,1);
});

test('actual human transaction, undo and pending state retire a read basis without claiming an owner effect',()=>{
 const l=local(),captured=structuredClone(l.host.reading());
 assert.equal(sameNativeMaterialReadBasis(captured,l.host.reading()),true);
 l.store.begin();l.store.document.name='Uncommitted human material';
 assert.equal(l.store.revision,captured.basis.authored_revision);
 assert.equal(l.store.transactionOpen,true);
 assert.equal(sameNativeMaterialReadBasis(captured,l.host.reading()),false,'dirty body detects input before revision changes');
 l.store.touch();l.store.finish();assert.equal(l.store.undo(),true);
 assert.equal(l.store.document.name,l.view.journey.name);
 assert.equal(sameNativeMaterialReadBasis(captured,l.host.reading()),false,'undo restores body but cannot restore the captured authored version');
 const now=l.host.reading();assert.equal(sameNativeMaterialReadBasis(now,{...now,standing:{...now.standing,pending:true}}),false);
 assert.deepEqual(l.calls,[]);
});
