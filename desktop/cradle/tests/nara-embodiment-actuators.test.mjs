import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPhysicalFormPose} from '../expressions-app/field-studies-journeys/src/physicalFormActuator';
import {nativeActuatorStanding} from '../expressions-app/field-studies-journeys/src/nativeActuatorStanding';
import {planAnimaStageActuators} from '../src/nara/animaStageActuators.ts';
import {bindPersonalProjection,NARA_ANIMA_PROFILE_SCHEMA} from '../src/nara/personalProjection.ts';
import {stageFocusPlan} from '../src/nara/stageFocus.ts';

const standing='M3 physical form target — fold-pose; not orientation_seed; not source angles as pose';

function form(pose=2,states=6){
  return {
    schema:'ql.m3-physical-form-target/v1',
    target_kind:'fold-pose',
    constituent_ref:'constituent:1',
    pose_ordinal:pose,
    state_count:states,
    address:4,
    standing,
  };
}

test('physical form actuator maps fold-pose onto degrees when connected',()=>{
  const result=applyPhysicalFormPose(form(3,6),true);
  assert.equal(result.applied,true);
  if(result.applied)assert.equal(result.rotationDegrees,180);
});

test('physical form actuator refuses disconnected consumer and angle collapse',()=>{
  assert.equal(applyPhysicalFormPose(form(),false).applied,false);
  assert.equal(applyPhysicalFormPose({...form(),standing:'just angles'},true).applied,false);
  assert.equal(applyPhysicalFormPose(null,true).applied,false);
});

test('M1/M2/M3 actuators name unavailable on disconnect — no demo fallback',()=>{
  const standing=nativeActuatorStanding({status:'manual',domain:null});
  assert.equal(standing.connected,false);
  assert.deepEqual(standing.layers.map(l=>l.available),[false,false,false]);
  assert.match(standing.layers[0].reason,/carrier overlay unavailable/);
  assert.match(standing.layers[1].reason,/modal audio/);
  assert.equal(standing.physical_form.applied,false);
});

test('connected reading with physical_form exposes M3 pose consumer',()=>{
  const standing=nativeActuatorStanding({
    status:'following',
    domain:{
      m1:{coordinate:'M1.0',revision:'1'},
      m2:{modes:[{ref:'mode:1',frequency_hz:110}],generation:2},
      m3:{physical_form:form(1,4),codon_ref:'codon:1'},
    },
  });
  assert.equal(standing.connected,true);
  assert.equal(standing.layers.every(l=>l.available),true);
  assert.equal(standing.physical_form.applied,true);
});

test('connected reading without physical_form keeps M3 pose unavailable',()=>{
  const standing=nativeActuatorStanding({
    status:'following',
    domain:{
      m1:{coordinate:'M1.0',revision:'1'},
      m2:{modes:[{ref:'mode:1',frequency_hz:110}],generation:2},
      m3:{physical_form:null,codon_ref:'codon:1'},
    },
  });
  assert.equal(standing.layers[0].available,true);
  assert.equal(standing.layers[1].available,true);
  assert.equal(standing.layers[2].available,false);
  assert.match(standing.layers[2].reason,/physical form/);
});

function profile(){
  const centres=Array.from({length:7},(_,ordinal)=>({
    ordinal,
    locus_ref:`ql:nara:subject:1:centre:${ordinal}`,
    label:['Root','Sacral','Solar','Heart','Throat','Brow','Crown'][ordinal],
    source_ref:`source:centre:${ordinal}`,
    source_revision:'r1',
    m1_basis_ref:'m1',
    m2_basis_ref:'m2',
    m3_basis_ref:'m3',
    amplitude:0.4+ordinal*0.08,
  }));
  return {
    schema:NARA_ANIMA_PROFILE_SCHEMA,
    subject_ref:'subject:1',
    event_ref:'event:1',
    profile_generation:3,
    personal_reception_generation:7,
    current:true,
    centres,
    earth_body:{locus_ref:'ql:nara:subject:1:earth-body',frame_ref:'frame:earth',standing:'EarthBody is the grounding relation; not an eighth centre peer'},
    centre_identity_neq_cymatic_station:true,
    standing:'live projection',
  };
}

test('Anima stage actuators drive existing centre entities by locus/title',()=>{
  const binding=bindPersonalProjection({
    nara_ref:'nara:desktop',
    subject_ref:'subject:1',
    expression_ref:'expression:1',
    expression_revision:'12',
    profile:profile(),
  });
  const entities=[
    ...profile().centres.map(c=>({entity_ref:`entity:centre-${c.ordinal}`,title:c.label,subject_ref:c.locus_ref})),
    {entity_ref:'entity:earth',title:'EarthBody',subject_ref:'ql:nara:subject:1:earth-body'},
  ];
  const plan=planAnimaStageActuators(binding,entities);
  assert.equal(plan.centres.filter(c=>c.applied).length,7);
  assert.equal(plan.earth_body.applied,true);
  const first=plan.centres[0];
  assert.equal(first.applied,true);
  if(first.applied){
    assert.ok(first.tintWeight>=0&&first.tintWeight<=1);
    assert.ok(first.sizeScale>0.8&&first.sizeScale<1.3);
  }
});

test('Anima actuators refuse inventing unbound centres or eighth EarthBody peer',()=>{
  const binding=bindPersonalProjection({
    nara_ref:'nara:desktop',
    subject_ref:'subject:1',
    expression_ref:'expression:1',
    expression_revision:'12',
    profile:profile(),
  });
  const plan=planAnimaStageActuators(binding,[]);
  assert.equal(plan.centres.every(c=>!c.applied),true);
  assert.equal(plan.earth_body.applied,false);
  assert.match(plan.earth_body.reason,/not invented/);
});

test('stage focus resolves personal centre locus through co-ref binding',()=>{
  const binding=bindPersonalProjection({
    nara_ref:'nara:desktop',
    subject_ref:'subject:1',
    expression_ref:'expression:1',
    expression_revision:'12',
    profile:profile(),
  });
  const document={
    entities:{
      'entity:heart':{entity_ref:'entity:heart',title:'Heart',subject:{subject_ref:'ql:nara:subject:1:centre:3'}},
    },
  };
  const resolution={
    outcome:{
      outcome:'focused',
      focus:[{ref_id:'ql:nara:subject:1:centre:3',focus_action:'select'}],
    },
  };
  const plan=stageFocusPlan(resolution,document,binding);
  assert.deepEqual(plan.unmapped,[]);
  assert.ok(plan.operations.some(op=>op.op==='kernel-focus'&&op.entity_ref==='entity:heart'));
});
