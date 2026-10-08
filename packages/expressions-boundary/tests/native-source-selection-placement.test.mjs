import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
import ts from '../../../desktop/cradle/node_modules/typescript/lib/typescript.js';
const base='../../../desktop/cradle/expressions-app/field-studies-journeys/src/';
const [{kernelDocumentToJourney},{DocumentStore},{NativeWorking},{NativeSelectionQueue},{createRetainedNativeEditor},{createSourceEditorSelection},{liveWorkspaceHTML},{defaultWorkspace},{readLayerDisclosure,restoreLayerDisclosure},{formationStateNudge},{prepareCompositionEdit}]=await Promise.all([
 import(base+'kernelDocumentBridge.ts'),import(base+'store.ts'),import(base+'nativeWorking.ts'),import(base+'nativeSelectionQueue.ts'),import(base+'hostEditor.ts'),import(base+'sourceEditorSelection.ts'),import(base+'liveWorkspace.ts'),import(base+'workspacePreferences.ts'),import(base+'layerDisclosure.ts'),import(base+'formationPlacement.ts'),import(base+'kernelComposition.ts')]);
const receiptPath='/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const receipt=JSON.parse(await readFile(receiptPath,'utf8'));assert.deepEqual(receipt.before.document,receipt.after.document);
const document=receipt.after.document,originalNativeBytes=JSON.stringify(document);
const laterReceipt=JSON.parse(await readFile('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/rich-artifact-inspection-32346939-42e0-4994-851a-e03537a95c8f.json','utf8'));assert.deepEqual(laterReceipt.before.document,laterReceipt.after.document);
function retained(nativeDocument=document){
 const view=kernelDocumentToJourney(nativeDocument),store=new DocumentStore(view.journey),scene=store.document.scenes.find(s=>s.id===view.startSceneId),binding=view.bindings[scene.id],occurrence=binding.occurrences.find(o=>o.entity_ref===nativeDocument.selection.entity_ref)??binding.occurrences[0],entity=scene.entities.find(e=>e.id===occurrence.view_entity_id);
 const effects=[];const closed=()=>{effects.push('closed-native-effect');throw Error('Native effects are closed in production source verification')};
 const work=new NativeWorking({expression:closed,file:closed,mint:closed,checkpoint:closed});work.restore({schema:'oi.native-working/v1',draft_id:view.journey.id,view},store.document);
 const queue=new NativeSelectionQueue({available:()=>!work.busy,current:()=>true,apply:async intent=>{await work.select(intent);return true}});
 let release,enter;const barrier=new Promise(resolve=>{release=resolve}),started=new Promise(resolve=>{enter=resolve}),local=[];
 let selection={entity_ids:[entity.id],step_id:entity.sequence.steps[0].id};
 const owner=createRetainedNativeEditor({store,sceneId:()=>scene.id,selection:()=>selection,nativeView:()=>view,nativeSelect:async(id,target)=>{enter();await barrier;return queue.submit({scene_ref:view.bindings[id].scene_ref,entity_ref:view.bindings[id].occurrences.find(o=>o.view_entity_id===target)?.entity_ref??null})},change:fn=>store.change(fn),commit:closed,afterHistory:closed,selectLocal:(id,index)=>{selection={entity_ids:[id],step_id:entity.sequence.steps[index].id};local.push({id,index})},openEditor:closed,standing:()=>({busy:false,notice:null}),telemetry:()=>undefined,fieldPaused:()=>false});
 let context={owner,nativeOwner:work,navigation:0,sourceEpoch:0,visible:true};
 const read=()=>({...context,reading:owner.read()});
 const chooser=createSourceEditorSelection({context:read,select:(request,current)=>owner.select(request,current)});
 return {view,store,scene,entity,binding,owner,chooser,local,effects,started,release,setContext:patch=>{context={...context,...patch}},setSelection:patch=>{selection={...selection,...patch}}};
}

test('Source chooser waits for actual retained native no-op focus before local stable-state selection',async()=>{
 const r=retained(),before=structuredClone(r.store.document),pending=r.chooser.select(r.entity.id,r.entity.sequence.steps[0].id);
 await r.started;assert.deepEqual(r.local,[]);assert.deepEqual(r.store.document,before);r.release();assert.equal(await pending,'applied');assert.deepEqual(r.local,[{id:r.entity.id,index:0}]);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);
});
for(const departure of ['visibility','owner','native-owner','navigation','render','authored','selection','step','occurrence','Scene','Expression','membership'])test(`Source ${departure} departure during actual native no-op refuses late local focus`,async()=>{
 const r=retained(),pending=r.chooser.select(r.entity.id,r.entity.sequence.steps[0].id);await r.started;
 if(departure==='visibility')r.setContext({visible:false});
 if(departure==='owner')r.setContext({owner:{}});
 if(departure==='native-owner')r.setContext({nativeOwner:{}});
 if(departure==='navigation')r.setContext({navigation:1});
 if(departure==='render')r.setContext({sourceEpoch:1});
 if(departure==='authored')r.store.touch();
 if(departure==='selection')r.setSelection({entity_ids:[]});
 if(departure==='step')r.setSelection({step_id:r.entity.sequence.steps[1].id});
 if(departure==='occurrence')r.binding.occurrences.find(o=>o.view_entity_id===r.entity.id).entity_ref='entity:wrong-source-test';
 if(departure==='Scene')r.binding.scene_ref='scene:wrong-source-test';
 if(departure==='Expression')r.view.document.expression_ref='expression:wrong-source-test';
 if(departure==='membership')r.entity.sequence.steps=r.entity.sequence.steps.slice(1);
 const before=structuredClone(r.store.document);r.release();assert.equal(await pending,'superseded');assert.deepEqual(r.local,[]);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);
});
test('parallel Source selection and absent stable ID refuse without replacing captured pending intent',async()=>{
 const r=retained();await assert.rejects(r.chooser.select(r.entity.id,'absent-state'),/stable source state/);
 const pending=r.chooser.select(r.entity.id,r.entity.sequence.steps[0].id);await r.started;await assert.rejects(r.chooser.select(r.entity.id,r.entity.sequence.steps[1].id),/awaiting acknowledgement/);r.release();await pending;assert.deepEqual(r.local,[{id:r.entity.id,index:0}]);
});
test('actual Field-null to formation native focus refusal retains Source material and exposes owner error',async()=>{
 assert.equal(laterReceipt.after.document.selection.entity_ref,null);
 const r=retained(laterReceipt.after.document),before=structuredClone(r.store.document),pending=r.chooser.select(r.entity.id,r.entity.sequence.steps[0].id);await r.started;r.release();await assert.rejects(pending,/The native selection was superseded or refused/);assert.ok(r.effects.length>0);assert.deepEqual(r.local,[]);assert.deepEqual(r.store.document,before);
});

function layerDetails(html,open=false){
 const attrs=html.match(/<details class="live-layers"([^>]*)>/)?.[1];if(!attrs)return null;
 // This is a markup presentation observer, never a native owner or ACK.
 const dataset={};for(const [,key,value]of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g))dataset[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
 return {dataset,open};
}
function layered(){const r=retained(),entity=r.scene.entities.find(e=>e.sequence.steps.some(s=>s.layers?.length));assert.ok(entity);const index=entity.sequence.steps.findIndex(s=>s.layers?.length);const context={journey:r.store.document,scene:r.scene,selected:[entity.id],textId:null,tab:'objects',motionTab:'sequence',stepIndex:index,preview:false,search:''};return {...r,entity,index,context,html:()=>liveWorkspaceHTML(context,defaultWorkspace()).sequence};}
test('real rich layer renderer identity restores exact same-body open and closed states across replacement',()=>{
 const r=layered(),html=r.html(),first=layerDetails(html,true);assert.ok(first);assert.equal(first.dataset.layerJourney,r.store.document.id);assert.equal(first.dataset.layerScene,r.scene.id);assert.equal(first.dataset.entityId,r.entity.id);assert.equal(first.dataset.layerState,r.entity.sequence.steps[r.index].id);
 for(const open of [true,false]){first.open=open;const prior=readLayerDisclosure(first),next=layerDetails(r.html(),!open);assert.equal(restoreLayerDisclosure(next,prior),true);assert.equal(next.open,open)}
});
test('layer disclosure never transfers across journey, Scene, entity or stable-state body; absent layers are graceful',()=>{
 const r=layered(),prior=readLayerDisclosure(layerDetails(r.html(),true));
 for(const key of ['layerJourney','layerScene','entityId','layerState']){const next=layerDetails(r.html());next.dataset[key]+=':other';assert.equal(restoreLayerDisclosure(next,prior),false);assert.equal(next.open,false)}
 assert.equal(restoreLayerDisclosure(null,prior),false);assert.equal(readLayerDisclosure(null),null);
});

const app=await readFile(new URL(base+'app.ts',import.meta.url),'utf8'),tree=ts.createSourceFile('app.ts',app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let arrow;
function find(node){if(ts.isIfStatement(node)&&node.expression.getText(tree)==="ev.key.startsWith('Arrow')")arrow=node;ts.forEachChild(node,find)}find(tree);assert.ok(arrow);
const branch=ts.transpileModule(arrow.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const invokeArrow=new Function('stepIndex','ev','editing','selected','blueprintMember','scene','toast','selectedEntity','nativeWorkspace','formationStateNudge','changed','clamp','setScene',`let placementStep=true;(function(){${branch}})();return placementStep;`);
function nudge(r,key='ArrowRight',shift=false,{locked=false,pinned=false,blueprint=false}={}){
 const entity=r.entity,stepIndex=1,notes=[],view=r.view;entity.locked=locked;
 if(pinned)view.document.entities[r.binding.occurrences.find(o=>o.view_entity_id===entity.id).entity_ref].pinned=true;
 return {active:invokeArrow(stepIndex,{key,shiftKey:shift,preventDefault(){}},true,[entity.id],()=>blueprint,()=>r.scene,value=>notes.push(value),()=>entity,{nativeView:()=>view},formationStateNudge,fn=>r.store.change(fn),(n,a,b)=>Math.max(a,Math.min(b,n)),()=>{throw Error('Placement must not navigate Scenes')}),notes};
}
test('actual Placement Arrow callback changes only selected stable state, compiles material and gives one Undo/Redo',()=>{
 const r=retained(),before=structuredClone(r.store.document),step=r.entity.sequence.steps[1],prior=structuredClone(step.position??{x:0,y:0,z:0});
 assert.equal(nudge(r).active,true);assert.deepEqual(step.position,{...prior,x:prior.x+.01});assert.deepEqual(r.entity.position,before.scenes.find(s=>s.id===r.scene.id).entities.find(e=>e.id===r.entity.id).position);
 const expected=structuredClone(before);expected.scenes.find(s=>s.id===r.scene.id).entities.find(e=>e.id===r.entity.id).sequence.steps[1].position={...prior,x:prior.x+.01};expected.updatedAt=r.store.document.updatedAt;assert.deepEqual(r.store.document,expected);assert.equal(r.store.undoStack.length,1);
 const authored=structuredClone(r.store.document),prepared=prepareCompositionEdit(r.view,r.store.document),material=prepared.changes.find(c=>c.change==='scene_material_set'&&c.scene_ref===r.binding.scene_ref);assert.ok(material);assert.deepEqual(material.presentation.scene.entities.find(e=>e.id===r.entity.id).sequence.steps[1].position,step.position);
 assert.equal(r.store.undo(),true);assert.deepEqual(r.store.document,before);assert.equal(r.store.redo(),true);assert.deepEqual(r.store.document,authored);
});
test('Shift keyboard state placement has existing .1 stage-unit precision and keeps offset z',()=>{
 const r=retained(),before=r.entity.sequence.steps[1].position??{x:0,y:0,z:0};assert.equal(nudge(r,'ArrowUp',true).active,true);assert.deepEqual(r.entity.sequence.steps[1].position,{...before,y:before.y+.1});
});
test('locked, Blueprint and pinned native Placement never change state/base position or history',()=>{
 for(const guard of ['locked','blueprint','pinned']){const r=retained();if(guard==='locked')r.entity.locked=true;if(guard==='pinned')r.view.document.entities[r.binding.occurrences.find(o=>o.view_entity_id===r.entity.id).entity_ref].pinned=true;const before=structuredClone(r.store.document);const result=nudge(r,'ArrowRight',false,{[guard]:true});assert.equal(result.active,true);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);if(guard!=='locked')assert.equal(result.notes.length,1)}
});
test('same state XY boundary creates no key gesture history; unknown/missing stable states never retarget',()=>{
 const r=retained();r.entity.sequence.steps[1].position={x:50,y:-50,z:2};const before=structuredClone(r.store.document);nudge(r);assert.deepEqual(r.store.document,before);assert.equal(r.store.undoStack.length,0);assert.equal(formationStateNudge(r.entity,'absent','ArrowRight',.01),null);assert.equal(formationStateNudge(r.entity,r.entity.sequence.steps[1].id,'PageUp',.01),null);assert.equal(formationStateNudge(r.entity,r.entity.sequence.steps[1].id,'ArrowRight',NaN),null);
});
test('Source handlers route through the real controller rather than writing local selection before its native receipt',()=>{
 const actions=[];function visit(node){if(ts.isIfStatement(node)&&node.expression.getText(tree).includes("el.dataset.action==='source-entity'"))actions.push(node.getText(tree));ts.forEachChild(node,visit)}visit(tree);assert.equal(actions.length,1);assert.match(actions[0],/selectSourceState/);assert.doesNotMatch(actions[0],/selected=|stepIndex=|syncHeldState/);
 assert.match(app,/sourceEditorEpoch\+\+;readCapture\(\)/);assert.match(app,/select:\(request,isCurrent\)=>retainedEditor.select\(request,isCurrent\)/);assert.match(app,/restoreLayerDisclosure\(host.querySelector/);assert.equal(JSON.stringify(document),originalNativeBytes);
});
