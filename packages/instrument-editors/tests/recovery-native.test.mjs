import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {writeFile} from 'node:fs/promises';
import {NativeWorking} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking.ts';
import {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts';
import {applyResearchMaterial} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/researchMaterial.ts';
import {openNativeWorkbench,acknowledgeWorkbenchComposition,nativeWorkbenchJournal} from '../dev/nativeRecovery.ts';
const bridge=process.env.OI_EDITOR_TEST_BRIDGE??'http://127.0.0.1:4186';
async function call(op){const packet=await fetch(bridge+'/op',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(op),signal:AbortSignal.timeout(30000)}).then(response=>response.json());assert.equal(packet.ok,true,packet.error);return packet.outcome.data;}
test('native receiver reopens its actual pending journal without replay or dropping submitted input',async()=>{
 const ref='expression:research-editor-'+randomUUID(),requests=[];
 const expression=request=>{requests.push(request);return call({op:'expression',request});};
 const recovery=request=>call({op:'expression_recovery',request});
 const read=async()=>(await recovery({operation:'read',scope:'expressions',kind:'checkpoint',id:ref})).record?.value;
 const owner=async()=>{const journal=await nativeWorkbenchJournal(ref,recovery);return new NativeWorking({expression,file:request=>call({op:'expression_file',request}),mint:()=>ref,checkpoint:journal.checkpoint});};
 await expression({operation:'create',expression_ref:ref,title:'Actual retained recovery input',actor:'agent:instrument-editor-native-test'});
 const work=await owner(),view=await openNativeWorkbench(work,ref,read,async()=>(await expression({operation:'inspect',expression_ref:ref})).document),store=new DocumentStore(view.journey);
 const second=await owner(),secondView=await openNativeWorkbench(second,ref,read,async()=>{throw Error('The second aperture has a saved journal');}),secondStore=new DocumentStore(secondView.journey);
 store.change(document=>applyResearchMaterial(document.scenes.find(scene=>scene.id===view.startSceneId),{type:'viewport',key:'timeline',value:{x:1880,y:0,zoom:8}}));
 await assert.rejects(work.commit({journey:store.document,sceneId:view.startSceneId,entityId:null}),/Invalid or unbounded research Scene material/);
 const nativeBefore=(await expression({operation:'inspect',expression_ref:ref})).document,recordBefore=(await recovery({operation:'read',scope:'expressions',kind:'checkpoint',id:ref})).record;
 assert.equal(recordBefore.value.pending.kind,'edit');requests.length=0;
 const reopened=await owner(),received=await openNativeWorkbench(reopened,ref,read,async()=>{throw Error('A journal must reopen before direct inspection');});
 assert.deepEqual(requests.map(request=>request.operation),['open'],'Recovery does not retry the refused native edit');
 assert.deepEqual(received.journey,store.document,'The submitted viewport remains local input');assert.deepEqual(reopened.state.pending,recordBefore.value.pending);
 assert.deepEqual((await expression({operation:'inspect',expression_ref:ref})).document,nativeBefore);assert.deepEqual((await recovery({operation:'read',scope:'expressions',kind:'checkpoint',id:ref})).record,recordBefore);
 await assert.rejects(acknowledgeWorkbenchComposition(reopened,new DocumentStore(received.journey),nativeBefore),/local input was pending/);
 secondStore.change(document=>{document.scenes[0].name='A conflicting aperture';});const beforeSecond=requests.length;await assert.rejects(second.commit({journey:secondStore.document,sceneId:secondView.startSceneId,entityId:null}),/refused the captured journal revision/);assert.equal(requests.length,beforeSecond,'Foreign journal advancement refuses before dispatching another native edit');assert.deepEqual((await recovery({operation:'read',scope:'expressions',kind:'checkpoint',id:ref})).record,recordBefore,'A second aperture cannot overwrite the first pending proposal');
 const foreign=await owner(),count=requests.length;await assert.rejects(openNativeWorkbench(foreign,ref,async()=>({...recordBefore.value,view:{...recordBefore.value.view,document:{...nativeBefore,expression_ref:'expression:other'}}}),async()=>nativeBefore),/does not name this work/);assert.equal(requests.length,count,'A mismatched journal cannot write native work');
 await writeFile(process.env.OI_EDITOR_EVIDENCE_DIR+'/recovery-native-result.json',JSON.stringify({expression_ref:ref,checkpoint_id:ref,revision:nativeBefore.revision,pending_kind:reopened.state.pending.kind,confirmed:['actual native refusal preserved in native journal','reopen uses native open before inspection','submitted local input retained','no pending operation replay','acknowledgement cannot discard pending input','foreign journal refuses before native dispatch','second retained aperture cannot overwrite newer pending journal or submit a native edit']},null,2));
});
