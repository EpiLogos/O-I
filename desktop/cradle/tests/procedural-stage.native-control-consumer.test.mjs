import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clone,blankScene} from '../expressions-app/field-studies-journeys/src/model.ts';
import {takeOver} from '../expressions-app/field-studies-journeys/src/proceduralControls.ts';
import {automationTargets} from '../expressions-app/field-studies-journeys/src/nativeParameters.ts';
import {retention} from '../expressions-app/field-studies-journeys/src/proceduralRetention.ts';
import {toNativeConfig} from '../expressions-app/field-studies-journeys/src/nativeBridge.ts';
import {kernelDocumentToJourney} from '../expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {nativeControlCorrespondenceKey} from '../expressions-app/field-studies-journeys/src/proceduralNativeControlProjection.ts';
import {resolveEntityPose} from '../expressions-app/src/engine/entityPose.ts';
import {validateNativeEntityControls} from '../expressions-app/src/engine/fieldModel.ts';
const path=process.env.QL_PROCEDURAL_CONTROL_CONSUMER_ARTIFACT;
// Actual Source output + existing native Document-to-view converter. This is
// renderer configuration consequence, not a native read/commit/body/audio ACK.
function viewOf(artifact,presentation,value,revision,preferred=false){
 const scene=presentation.scene,refs=scene.entities.map(e=>e.id);
 const document={schema:'oi.expression/v1',expression_ref:artifact.input.reading.expression_ref,revision,title:'Actual Source control consumer',entities:Object.fromEntries(scene.entities.map(e=>[e.id,{entity_ref:e.id,title:e.name,parameters:e.id===artifact.input.reading.entity_ref?{force_radius:{value}}:{}}])),scenes:[{scene_ref:scene.id,title:scene.name,entity_refs:refs,presentation}]};
 return kernelDocumentToJourney(document,preferred?{identity:{expression:'preferred-world',scenes:{[scene.id]:'preferred-scene'},entities:Object.fromEntries(refs.map((ref,i)=>[ref,'preferred-entity-'+i]))}}:{});
}
test('native control projection rejects invalid native domains and zero revision before a field config exists',()=>{
 const control={parameter:'force_radius',value:120,actor_ref:'human:owner',operation_ref:'operation:actual-control',document_revision:1,lifetime:'persistent'};
 const envelope={schema:'ql.native-entity-controls/v1',entity_ref:'native:entity',controls:[control]};
 for(const [parameter,value] of [['force_radius',0],['force_radius',1601],['force_strength',21],['force_spin',-21],['x',1601],['y',-1601],['z',1601],['scale',.049],['scale',4.001],['rotation',Math.PI*2+.001]])assert.throws(()=>validateNativeEntityControls({...envelope,controls:[{...control,parameter,value}]},'native:entity'));
 assert.throws(()=>validateNativeEntityControls({...envelope,controls:[{...control,document_revision:0}]},'native:entity'));
});
test('actual Source control reaches real preferred-ID sequence consumer with exact current namespace',{skip:!path&&'requires actual owner-compiled Source control artifact'},()=>{
 const artifact=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(artifact.schema,'ql.procedural-control-consumer-source-fixture/v1');
 const r=artifact.input.reading;
 const original=viewOf(artifact,r.scenes[0].presentation,120,r.document_revision),saved=clone(original);
 const base=toNativeConfig(original.journey.scenes[0],original).entities.find(e=>e.id===r.entity_ref);
 assert.equal(resolveEntityPose(base,0,0,0,0).forces.radius,240);
 for(const preferred of [false,true]){
  const current=viewOf(artifact,artifact.takeover.native_edit.changes[0].presentation,640,r.document_revision+1,preferred),scene=current.journey.scenes[0];
  const id=current.entity_ids[r.entity_ref],native=toNativeConfig(scene,current).entities.find(e=>e.id===id);
  assert.equal(native.nativeControls.controls[0].value,640);
  for(const t of [0,.5,2,3.5,6])assert.equal(resolveEntityPose(native,t,0,0,0).forces.radius,640);
  assert.equal(scene.procedural.controls[0].address.entity_ref,r.entity_ref,'saved address retains canonical native identity');
  assert.equal(scene.procedural.controls[0].address.scene_ref,r.scenes[0].scene_ref);
  assert.throws(()=>toNativeConfig(scene),'native controls cannot infer current correspondence from view IDs');
  const key=nativeControlCorrespondenceKey(scene,current),newer=clone(current);newer.document.revision++;assert.notEqual(nativeControlCorrespondenceKey(scene,newer),key,'native cache key changes without an authoring revision change');
  const foreign=clone(current);foreign.document.expression_ref='foreign:expression';assert.throws(()=>toNativeConfig(scene,foreign));
  const stale=clone(current);stale.document.entities[r.entity_ref].parameters.force_radius.value=639;assert.throws(()=>toNativeConfig(scene,stale));
  const hidden=clone(current);hidden.bindings[scene.id].hidden_refs.push(r.entity_ref);assert.throws(()=>toNativeConfig(scene,hidden));
  const missingLoaded=clone(current);missingLoaded.bindings[scene.id].loaded_refs=missingLoaded.bindings[scene.id].loaded_refs.filter(ref=>ref!==r.entity_ref);missingLoaded.bindings[scene.id].occurrences=missingLoaded.bindings[scene.id].occurrences.filter(o=>o.entity_ref!==r.entity_ref);assert.throws(()=>toNativeConfig(scene,missingLoaded),'visible member cannot lose its exact loaded occurrence');
  const automated=clone(current);automated.document.entities[r.entity_ref].parameters.force_radius.automation={min:1,max:1600,rate_hz:1,waveform:'sine'};assert.throws(()=>toNativeConfig(scene,automated),'same native base with a newly active Automation cannot retain a manual takeover projection');
  const altered=clone(scene);altered.procedural.controls[0].address.property='strength';assert.throws(()=>toNativeConfig(altered,current));
  const missing=clone(scene);delete missing.procedural.controls[0].takeover.native_value;assert.throws(()=>toNativeConfig(missing,current));
  const missingBase=clone(scene);delete missingBase.procedural.controls[0].native_base;const missingBaseBefore=clone(missingBase);assert.throws(()=>toNativeConfig(missingBase,current),/lost paired native/);assert.deepEqual(missingBase,missingBaseBefore);
  const released=viewOf(artifact,artifact.release.native_edit.changes[0].presentation,120,r.document_revision+2,preferred),returned=toNativeConfig(released.journey.scenes[0],released).entities.find(e=>e.id===id);
  assert.equal(returned.nativeControls,undefined);assert.equal(resolveEntityPose(returned,0,0,0,0).forces.radius,240);
  const staleDerived=clone(released.journey.scenes[0]);staleDerived.native={...staleDerived.native,config:toNativeConfig(scene,current),projection:toNativeConfig(scene,current)};
  assert.equal(toNativeConfig(staleDerived,released).entities.find(e=>e.id===id).nativeControls,undefined,'release strips stale derived overrides');
 }
 const paged=clone(artifact.takeover.native_edit.changes[0].presentation),controlled=paged.scene.entities.find(e=>e.id===r.entity_ref);
 paged.scene.entities=Array.from({length:32},(_,i)=>({...clone(controlled),id:'uncontrolled-page-member:'+i})).concat([controlled]);
 const first=viewOf(artifact,paged,640,r.document_revision+1,true);
 const visible=toNativeConfig(first.journey.scenes[0],first);
 assert.equal(visible.entities.some(e=>e.nativeControls),false,'unloaded current control retains source without inventing a visible native consumer');
 assert.equal(first.journey.scenes[0].procedural.controls.length,1);
 const secondDocument=clone(first.document);secondDocument.selection={scene_ref:paged.scene.id,entity_ref:r.entity_ref};
 const second=kernelDocumentToJourney(secondDocument),secondScene=second.journey.scenes[0];
 const controlledNative=toNativeConfig(secondScene,second).entities.find(e=>e.id===r.entity_ref);
 assert.equal(resolveEntityPose(controlledNative,0,0,0,0).forces.radius,640);
 assert.deepEqual(original,saved);
});


test('actual authored Field takeover stays with its normal converter and lost paired native facts refuse',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./procedural-stage.existing-field-control-source.json',import.meta.url),'utf8'));
 const scene=blankScene('Existing authored Field control');
 scene.id=fixture.control.address.scene_ref;scene.field=clone(fixture.field_before);
 const target=automationTargets(scene).find(t=>t.target===fixture.control.target);
 assert.ok(target);assert.equal(target.bind,fixture.target.bind);
 const controlled=takeOver(scene,{context:{expression_ref:fixture.control.address.expression_ref,scene_ref:scene.id,occurrences:{}},target:target.target,value:.42,actor:fixture.control.takeover.actor,operation_ref:fixture.control.takeover.operation_ref,lifetime:'persistent'});
 const row=retention(controlled).controls[0];
 assert.deepEqual(row,fixture.control,'existing actual TS producer fixture stays byte-equivalent');
 const before=clone(controlled),config=toNativeConfig(controlled);
 assert.equal(nativeControlCorrespondenceKey(controlled),'','authored controls do not invent a native correspondence');
 assert.equal(config.material.opacity,.42,'actual normal material opacity consumer is retained');
 assert.equal(config.entities.some(e=>e.nativeControls),false,'authored Field control does not become an Entity native override');
 assert.deepEqual(controlled,before);
 for(const field of ['native_base','native_value']){
  const lost=clone(controlled);
  if(field==='native_base')lost.procedural.controls[0].native_base={value:0,automation:null};
  else lost.procedural.controls[0].takeover.native_value=.42;
  const original=clone(lost);
  assert.throws(()=>toNativeConfig(lost),/lost paired native/);
  assert.deepEqual(lost,original);
 }
});
