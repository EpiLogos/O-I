import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {blankScene,entity} from '../expressions-app/field-studies-journeys/src/model.ts';
import {automationTargets} from '../expressions-app/field-studies-journeys/src/nativeParameters.ts';
import {propertyAddress} from '../expressions-app/field-studies-journeys/src/proceduralControls.ts';
import {validateEnvelope,validateOperation,proceduralChanges} from '../expressions-app/field-studies-journeys/src/proceduralProtocol.ts';

// Negative validation only. Controlled input is assembled from the actual
// authoring registry; it is never presented as a native-produced receipt.
const expression='expression:independent-protocol',sceneRef=expression+':scene:main',entityRef=expression+':entity:body';
const s=blankScene('Independent wire validation');s.id=sceneRef;s.entities=[entity('Native target','O')];s.entities[0].id=entityRef;
const target=automationTargets(s).find(t=>t.entityId===entityRef&&t.bind==='entity.force.strength');
const address=propertyAddress({expression_ref:expression,scene_ref:sceneRef,occurrences:{[entityRef]:entityRef}},target);
function envelope(){return {operation_ref:'operation:independent-wire',expression_ref:expression,expected_revision:1,
  actor:'agent:independent',scope:{kind:'addresses',addresses:[structuredClone(address)]},sources:[],
  changes:[{change:'parameter_set',entity_ref:entityRef,parameter:'force_strength',value:0.5}],
  participants:[],timing:{kind:'immediate'},cause_ref:null};}
function operation(){const e=envelope();return {fingerprint:createHash('sha256').update(JSON.stringify(e)).digest('hex'),
  envelope:e,targets:[structuredClone(address)],status:'prepared',accepted_revision:2,applied_revision:null,observations:[],failure:null};}

test('A02/A05 foreign scoped targets are refused at the wire boundary',()=>{
  const e=envelope();e.scope.addresses[0]={...address,expression_ref:'expression:foreign',
    scene_ref:'expression:foreign:scene:main',entity_ref:'expression:foreign:entity:body'};
  assert.throws(()=>validateEnvelope(e),/Expression|scope|target/);
});

test('A02/A05 unknown selector and timing kinds are refused before native dispatch',()=>{
  for(const field of ['scope','timing']){
    const e=envelope();e[field]={kind:'invented-native-owner'};
    assert.throws(()=>validateEnvelope(e),/scope|selector|timing|envelope/i);
  }
});

test('A14 unavailable or unqualified source cannot be silently admitted as a current operation',()=>{
  for(const source of [{ref:'source:current',revision:'1',availability:'stale'},
    {ref:'source:current',revision:'1',availability:'invented'}, {ref:'source:current',revision:'',availability:'available'}]){
    const e=envelope();e.sources=[source];assert.throws(()=>validateEnvelope(e),/source|basis|revision/i);
  }
});

test('A05 applied or applying wire state requires the actual committed document revision',()=>{
  for(const status of ['applied','applying']){
    const o=operation();o.status=status;assert.throws(()=>validateOperation(o),/revision|applied|committed/i);
  }
});

test('A04 operation observations cannot carry another Expression or document basis',()=>{
  for(const revision of [0,2]){
    const o=operation();o.status='applied';o.applied_revision=3;
    o.envelope.participants=[{owner:'expressions',instance_ref:'instance:current',required_generation:1,targets:[address]}];
    // This copied invalid observation is a discriminator, not a receiving ACK.
    o.observations=[{owner:'expressions',instance_ref:'instance:current',generation:1,document_revision:revision,
      operation_ref:o.envelope.operation_ref,cursor:128,targets:[address],effective:{}}];
    assert.throws(()=>validateOperation(o),/observation|basis|revision/i);
  }
});

test('A02/A05 retained operation targets cannot escape their admitted Expression',()=>{
  const o=operation();o.targets=[{...address,expression_ref:'expression:foreign',
    scene_ref:'expression:foreign:scene:main',entity_ref:'expression:foreign:entity:body'}];
  assert.throws(()=>validateOperation(o),/Expression|target|scope/i);
});

test('A07/A13 actual immutable material intent removes recursive journals and retains all authored procedure state',()=>{
  const scene=structuredClone(s),retained={schema:'oi.expression-procedural/v1',
    bindings:[{address,principal:{subject_ref:'subject:current',native_owner:'ql',sources:[]},contributors:[],locus:{ref:'source:current',revision:'1',availability:'available'},tags:[]}],
    procedures:[{procedure_ref:'procedure:current',definition:{recipe:'recipe:current'},cursor:3,state:'held'}],
    contributions:[{contribution_ref:'contribution:current',generated_basis:{force:{strength:.2}},authored_overrides:[{address,value:.6,actor:'human:owner'}]}],
    controls:[{address,target:target.target,takeover:{value:.8,lifetime:'gesture'},dormant_lanes:[],dormant_tracks:[]}],
    operations:[operation()],scene_flow:[{from_scene_ref:sceneRef,to_scene_ref:expression+':scene:next',policy:'continue',cursor:3}],
    time_mappings:[{owner:'expressions',instance_ref:'instance:current',domain:'simulation_seconds',cursor:3.5,rate:1,origin:0}],
    source_basis:[{ref:'source:current',revision:'1',availability:'available'}],checkpoint:{owner:'expressions',instance_ref:'instance:current',revision:'1',source_basis:[],cursor:3,state_ref:'state:current'}};
  scene.procedural=retained;
  const changes=[{change:'scene_material_set',scene_ref:sceneRef,presentation:{schema:'oi.journey-scene/v1',scene,saved:structuredClone(s)}},
    {change:'parameter_set',entity_ref:entityRef,parameter:'force_strength',value:.6}];
  const before=structuredClone(changes),actual=proceduralChanges(changes);
  assert.deepEqual(changes,before,'intent projection modified the actual saved source');
  assert.deepEqual(actual[0].presentation.scene.procedural,{...retained,operations:[]});
  assert.deepEqual(actual[0].presentation.saved,before[0].presentation.saved);
  assert.deepEqual(actual[1],before[1]);
  actual[0].presentation.scene.procedural.controls[0].takeover.value=.9;
  assert.equal(changes[0].presentation.scene.procedural.controls[0].takeover.value,.8,'projected material shared source storage');
});
