/** Actual archived Expression conversion and real closed native channel.
 * This proves presentation refusal, not an accepted Act replay. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
const [{currentNativeActReply},{readNativeExpressionsContent},{kernelDocumentToJourney},{worldRequest,worldAvailable}]=await Promise.all([
  import('../../live-shell/ui/src/components/NativeActPassages.tsx'),
  import('../../live-shell/ui/src/shell/nativeContent.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/worldChannel.ts'),
]);
const archive=JSON.parse(await readFile('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json','utf8'));
assert.deepEqual(archive.before.document,archive.after.document);
const view=kernelDocumentToJourney(structuredClone(archive.before.document)),scene=view.journey.scenes[0];
const reading={basis:{expression_ref:view.document.expression_ref,scene_ref:view.bindings[scene.id].scene_ref,revision:view.document.revision,authored_revision:0},scene,entityOccurrences:{},selection:{entity_ids:[],step_id:null},history:{canUndo:false,canRedo:false},standing:{dirty:false,pending:false,notice:null}};
const content=readNativeExpressionsContent(reading);
let reply;
assert.equal(worldAvailable(),false);
try{await worldRequest({operation:'act_list',expression_ref:reading.basis.expression_ref});assert.fail('The actual source-test native channel must remain closed')}
catch(error){reply={ok:false,error:error.message};assert.match(reply.error,/kernel host channel is not available/)}
const source=()=>({owner:'expressions',content,actions:null,isPresented:()=>true,currentReading:()=>reading,revealDetail:()=>{throw Error('No native reveal is acknowledged')}});
test('a real owner refusal may settle only onto the still-current original Act presentation',()=>{
  const original=source();assert.equal(currentNativeActReply(original,source(),reply),true);
  assert.equal(currentNativeActReply({...original,isPresented:()=>false},source(),reply),false);
  assert.equal(currentNativeActReply(original,{...source(),isPresented:()=>false},reply),false);
  assert.equal(currentNativeActReply(original,{...source(),content:null},reply),false);
});
test('synchronous owner publication retires a stale React basis before Act refusal settlement',()=>{
  const captured=source();
  for(const change of [{expression_ref:'expression:foreign'},{scene_ref:'scene:foreign'},{revision:reading.basis.revision+1},{authored_revision:1}]){
    const latest={...reading,basis:{...reading.basis,...change}};
    assert.equal(currentNativeActReply(captured,{...source(),currentReading:()=>latest},reply),false);
  }
  assert.deepEqual(view.document,archive.before.document);
});
