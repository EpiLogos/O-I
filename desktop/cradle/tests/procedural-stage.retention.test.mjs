import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {blankScene, entity, clone, validateJourney} from '../expressions-app/field-studies-journeys/src/model.ts';
import {
  emptyRetention, validateAddress, validateRetention, withRetention,
  retention, restorationPlan,
} from '../expressions-app/field-studies-journeys/src/proceduralRetention.ts';

// Real codec/model consumers. This test does not claim native scene, body,
// checkpoint or audio application; those require their receiving owner.
const sourcePath = new URL('../../../docs/contracts/EXPRESSION-APPLICATION-V1.md', import.meta.url);
const source = {ref:'docs/contracts/EXPRESSION-APPLICATION-V1.md',
  revision:createHash('sha256').update(await readFile(sourcePath)).digest('hex'),availability:'available'};
const expression = 'expression:procedural-independent';
const sceneRef = `${expression}:scene:main`;
const entityRef = `${expression}:entity:body`;
const address = (component='force', property=null) => ({expression_ref:expression,scene_ref:sceneRef,
  entity_ref:entityRef,component,constituent_ref:null,property});
function authoredScene() {
  const s=blankScene('Independent native authoring scene');s.id=sceneRef;
  const body=entity('Current constituent','O');body.id=entityRef;
  body.force={kind:'vortex',strength:0.75,radius:0.35,spin:0.2};s.entities=[body];
  return s;
}
function retainedScene() {
  const r=emptyRetention();r.source_basis=[source];
  r.bindings=[{address:address(),principal:{subject_ref:'source:current-constituent',native_owner:'Central',sources:[source]},
    contributors:[{subject_ref:'source:current-driver',native_owner:'Central',sources:[source]}],locus:source,
    tags:[{tag:'force',origin:'authored'}]}];
  r.procedures=[{procedure_ref:'procedure:current',revision:source.revision,source_basis:[source],
    seed:{algorithm:'mulberry32',version:'1',value:'17'},definition:{native_operation:'parameter_set'},
    resolved_targets:[address()],cursor:3,state:'held',membership_events:[]}];
  r.time_mappings=[{owner:'expressions',instance_ref:'instance:continuing-engine',domain:'simulation_seconds',cursor:3.5,rate:1,origin:0}];
  r.contributions=[{contribution_ref:'contribution:current',procedure_ref:'procedure:current',output_slot:'force',
    subject_refs:['source:current-constituent'],occurrence_ref:entityRef,recipe_revision:source.revision,
    owned_addresses:[address()],generated_basis:{kind:'vortex',strength:0.5},
    authored_overrides:[{address:address('force','strength'),value:0.75,actor:'human:independent'}],status:'active'}];
  r.controls=[{address:address('force','strength'),target:'force_strength',authored_base:0.5,
    dormant_lanes:[{id:'lane:strength',enabled:true,target:'force_strength',type:'lfo',wave:'sine',min:0,max:1,
      rate:0.5,phase:0,blend:'replace',duration:4,delay:0,loop:'loop',firedAt:0}],dormant_tracks:[],
    takeover:{value:0.75,lifetime:'persistent',actor:'human:independent',operation_ref:'operation:takeover'},source_basis:[source]}];
  const operationEnvelope={operation_ref:'operation:takeover',expression_ref:expression,expected_revision:2,
    actor:'human:independent',scope:{kind:'addresses',addresses:[address('force','strength')]},sources:[source],
    changes:[{change:'parameter_set',entity_ref:entityRef,parameter:'force_strength',value:0.75}],
    participants:[],timing:{kind:'immediate'},cause_ref:null};
  r.operations=[{fingerprint:createHash('sha256').update(JSON.stringify(operationEnvelope)).digest('hex'),envelope:operationEnvelope,
    targets:[address('force','strength')],status:'applied',accepted_revision:3,applied_revision:4,observations:[],failure:null}];
  return withRetention(authoredScene(),r);
}

test('A06/A07/A13 actual scene JSON round-trip retains contributions, intervention and dormant automation',()=>{
  const scene=retainedScene(),before=retention(scene);
  const reopened=JSON.parse(JSON.stringify(scene));
  assert.deepEqual(retention(reopened),before);
  assert.equal(reopened.entities[0].force.strength,0.75);
  assert.equal(before.controls[0].takeover.value,0.75);
  assert.equal(before.controls[0].dormant_lanes[0].id,'lane:strength');
  assert.equal(before.contributions[0].authored_overrides[0].value,0.75);
  assert.equal(before.procedures[0].cursor,3);
  assert.equal(before.time_mappings[0].cursor,3.5);
  assert.equal(before.bindings[0].contributors[0].subject_ref,'source:current-driver');
});

test('A13 ordinary Journey validation retains the same native scene procedural payload',()=>{
  const scene=retainedScene();
  const journey={schema:'oi.journey',version:1,id:'independent-journey',name:'Independent retained work',
    description:'Actual application codec conformance',loop:true,scenes:[scene],updatedAt:'2026-10-02T00:00:00Z'};
  const validated=validateJourney(JSON.parse(JSON.stringify(journey)));
  assert.deepEqual(retention(validated.scenes[0]),retention(scene));
});

test('A13 configuration open returns no replayed operations and cannot claim dynamic restoration',()=>{
  const scene=retainedScene(),plan=restorationPlan(scene,'configuration',[source]);
  assert.equal(plan.mode,'configuration');assert.deepEqual(plan.operations,[]);
  assert.deepEqual(plan.retained,retention(scene));
});

test('A05/A13 replay refuses every unresolved operation before repeating a mutation',()=>{
  for(const status of ['prepared','scheduled','applying']) {
    const scene=retainedScene();scene.procedural.operations[0].status=status;
    assert.throws(()=>restorationPlan(scene,'replay',[source]),/uncertain operations/);
    assert.equal(scene.procedural.operations[0].status,status);
  }
  const plan=restorationPlan(retainedScene(),'replay',[source]);
  assert.deepEqual(plan.operations.map(o=>o.envelope.operation_ref),['operation:takeover']);
});

test('A13/A14 checkpoint requires exact compatible native body source and explicit mode',()=>{
  const scene=retainedScene();
  assert.throws(()=>restorationPlan(scene,'checkpoint',[source]),/Checkpoint incompatible/);
  scene.procedural.checkpoint={owner:'ql::physical::PhysicalBody',instance_ref:'body:current',revision:'body-r1',
    source_basis:[source],cursor:48000,state_ref:'state:body-current'};
  const compatible={owner:'ql::physical::PhysicalBody',instance_ref:'body:current',revision:'body-r1'};
  const plan=restorationPlan(scene,'checkpoint',[source],compatible);
  assert.equal(plan.mode,'checkpoint');assert.equal(plan.retained.checkpoint.cursor,48000);
  for(const field of ['owner','instance_ref','revision']) {
    assert.throws(()=>restorationPlan(scene,'checkpoint',[source],{...compatible,[field]:'foreign'}),/Checkpoint incompatible/);
  }
  assert.throws(()=>restorationPlan(scene,'checkpoint',[{...source,revision:'stale'}],compatible),/Checkpoint incompatible/);
  assert.throws(()=>restorationPlan(scene,'checkpoint',[{...source,availability:'stale'}],compatible),/Checkpoint incompatible/);
  // A valid top-level basis must not conceal a foreign checkpoint basis.
  for(const change of [{revision:'foreign-checkpoint-source'},{availability:'stale'}]) {
    const foreign=clone(scene);foreign.procedural.checkpoint.source_basis=[{...source,...change}];
    assert.throws(()=>restorationPlan(foreign,'checkpoint',[source],compatible),/Checkpoint incompatible/);
  }
});

test('A14 source drift remains an explicit diff and preserves saved original intervention',()=>{
  const scene=retainedScene(),before=clone(scene);
  const changed={...source,revision:'changed-source'};
  const plan=restorationPlan(scene,'configuration',[changed]);
  assert.deepEqual(plan.source_drift,[source]);assert.deepEqual(scene,before);
  assert.equal(plan.retained.controls[0].takeover.value,0.75);
});

test('A06 lost dormant drivers and duplicate active controls are refused',()=>{
  const record=retention(retainedScene());
  for(const field of ['dormant_lanes','dormant_tracks']) {
    const broken=clone(record);delete broken.controls[0][field];
    assert.throws(()=>validateRetention(broken),/Lost dormant driver/);
  }
  const duplicate=clone(record);duplicate.controls.push(clone(duplicate.controls[0]));
  assert.throws(()=>validateRetention(duplicate),/Conflicting retained control/);
});

test('A02/A05 unknown addresses, foreign containment and unsafe paths are refused',()=>{
  for(const bad of [
    {...address(),expression_ref:'foreign'},
    {...address(),entity_ref:'expression:foreign:entity:body'},
    {...address(),scene_ref:'expression:foreign:scene:main'},
    {...address(),component:'invented'},
    {...address(),property:'__proto__.value'},
    {...address(),property:'sequence.steps.0.text'},
  ]) assert.throws(()=>validateAddress(bad),undefined,JSON.stringify(bad));
  assert.deepEqual(validateAddress(address('force','strength')),address('force','strength'));
});

test('A07 duplicate retained operation/procedure/contribution identities cannot silently replace original work',()=>{
  const r=retention(retainedScene());
  for(const [key,label] of [['operations','operation_ref'],['procedures','procedure_ref'],['contributions','contribution_ref']]) {
    const duplicate=clone(r);duplicate[key].push(clone(duplicate[key][0]));
    assert.throws(()=>validateRetention(duplicate),new RegExp(label));
  }
});

test('A13 integer rule-event ordinal remains separate from retained simulation seconds',()=>{
  const r=retention(retainedScene());
  assert.equal(r.time_mappings[0].domain,'simulation_seconds');assert.equal(r.time_mappings[0].cursor,3.5);
  const bad=clone(r);bad.procedures[0].cursor=3.5;
  assert.throws(()=>validateRetention(bad),/procedure|ordinal|cursor|position/i);
});

test('A13 retained time position requires its actual owner, instance and named domain',()=>{
  const r=retention(retainedScene());
  for(const key of ['owner','instance_ref','domain','cursor','rate','origin']){
    const bad=clone(r);delete bad.time_mappings[0][key];
    assert.throws(()=>validateRetention(bad),/time|mapping|domain|position|owner/i,key);
  }
  const duplicate=clone(r);duplicate.time_mappings.push(clone(duplicate.time_mappings[0]));
  assert.throws(()=>validateRetention(duplicate),/time|mapping|domain|duplicate/i);
});

test('A09/A13 retained scene continuation refuses missing or invented flow semantics',()=>{
  const r=retention(retainedScene());
  r.scene_flow=[{from_scene_ref:sceneRef,to_scene_ref:expression+':scene:continuation',policy:'continue',cursor:3}];
  for(const change of [{policy:'invented-continuation'},{from_scene_ref:''},{to_scene_ref:'expression:foreign:scene:other'},{cursor:-1}]){
    const bad=clone(r);bad.scene_flow[0]={...bad.scene_flow[0],...change};
    assert.throws(()=>validateRetention(bad),/flow|scene|continuation|position|cursor/i,JSON.stringify(change));
  }
});

test('A07/A13 complete procedure and generated basis are required for three-way replay',()=>{
  const r=retention(retainedScene());
  for(const key of ['definition','membership_events']){
    const bad=clone(r);delete bad.procedures[0][key];
    assert.throws(()=>validateRetention(bad),/procedure|definition|membership|replay/i,key);
  }
  const badState=clone(r);badState.procedures[0].state='invented';
  assert.throws(()=>validateRetention(badState),/procedure|state|replay/i);
  const lostBasis=clone(r);delete lostBasis.contributions[0].generated_basis;
  assert.throws(()=>validateRetention(lostBasis),/contribution|basis|generated|replay/i);
});
