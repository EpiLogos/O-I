import test from 'node:test';
import assert from 'node:assert/strict';
import {blankScene,entity,clone,validateJourney} from '../expressions-app/field-studies-journeys/src/model.ts';
import {automationTargets} from '../expressions-app/field-studies-journeys/src/nativeParameters.ts';
import {takeOver,releaseControl,propertyAddress} from '../expressions-app/field-studies-journeys/src/proceduralControls.ts';
import {toNativeConfig} from '../expressions-app/field-studies-journeys/src/nativeBridge.ts';
import {captureObjectState} from '../expressions-app/field-studies-journeys/src/sourceState.ts';
import {resolveEntityPose} from '../expressions-app/src/engine/entityPose.ts';

// Real accepted model, normal control producer, native converter and the exact
// CPU pose consumed by EntityRuntime for force emitters. No field/GPU/native
// receipt, source qualification, physical body or audio output is substituted.
test('A04/A06 default manual takeover reaches the effective force during a real retained entity sequence',()=>{
  const expression='expression:independent-effective-control',sceneRef=expression+':scene:main',entityRef=expression+':entity:body';
  const raw=blankScene('Actual sequence force control');raw.id=sceneRef;
  const body=entity('Continuing sequenced constituent','A');body.id=entityRef;body.force={kind:'attract',strength:0.2,radius:0.2,spin:0};
  body.sequence.enabled=true;body.sequence.clock='seconds';body.sequence.steps[0].id='state:retained';
  body.sequence.steps[0].objectState=captureObjectState(body).objectState;
  body.sequence.steps[0].objectState.force={kind:'attract',strength:0.15,radius:0.6,spin:0.1};
  raw.entities=[body];
  const s=validateJourney({schema:'oi.journey',version:1,id:expression,name:raw.name,description:'',loop:true,
    scenes:[raw],savedScenes:{},updatedAt:'2026-10-03T00:00:00Z'}).scenes[0],before=clone(s);
  const target=automationTargets(s).find(t=>t.entityId===entityRef&&t.bind==='entity.force.strength');assert.ok(target);
  const context={expression_ref:expression,scene_ref:sceneRef,occurrences:{[entityRef]:entityRef}},base=toNativeConfig(s).entities[0];
  assert.equal(resolveEntityPose(base,1,0,0,0).forces.strength,0.15,'a real step force is the active original consumer basis');
  const held=takeOver(s,{context,target:target.target,value:0.8,actor:'human:owner',operation_ref:'operation:effective-force',lifetime:'persistent'});
  const commanded=toNativeConfig(held).entities[0],actual=resolveEntityPose(commanded,1,0,0,0);
  assert.equal(commanded.forces.strength,0.8);assert.deepEqual(s,before);
  assert.equal(actual.forces.strength,0.8,'accepted takeover changed the base while the actual sequence force consumer remained unchanged');
  const released=releaseControl(held,propertyAddress(context,target)),returned=toNativeConfig(released).entities[0];
  assert.deepEqual(released.entities[0].sequence,s.entities[0].sequence,'release must preserve authored state force and continuing sequence');
  assert.equal(resolveEntityPose(returned,1,0,0,0).forces.strength,0.15);
});
