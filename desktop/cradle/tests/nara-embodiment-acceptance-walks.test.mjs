/**
 * Bounded acceptance walks for Nara × Expressions embodiment.
 * Exercises the commission §9 walks that can run without an installed
 * WKWebView or live microphone. Local physical acceptance is recorded
 * separately via native-expression-local.py.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {blankJourney, blankScene, entity, validateJourney, chakraEntities} from '../expressions-app/field-studies-journeys/build/model.js';
import {
  AUTHORED_CHAKRA_STARTER,NARA_PERSONAL_LIVE,CYMATIC_STATION,centreStandingDistinct,
} from '../expressions-app/field-studies-journeys/build/centreStanding.js';
import {entryGateHTML} from '../expressions-app/field-studies-journeys/build/entryGate.js';
import {nativeSeven} from '../expressions-app/field-studies-journeys/build/expressions.js';
import {applyPhysicalFormPose} from '../expressions-app/field-studies-journeys/src/physicalFormActuator';
import {nativeActuatorStanding} from '../expressions-app/field-studies-journeys/src/nativeActuatorStanding';
import {
  bindPersonalProjection,disconnectPersonalProjection,assertNoPrivateLeak,
  NARA_ANIMA_PROFILE_SCHEMA,
} from '../src/nara/personalProjection.ts';
import {planAnimaStageActuators} from '../src/nara/animaStageActuators.ts';
import {stageFocusPlan} from '../src/nara/stageFocus.ts';

const here=dirname(fileURLToPath(import.meta.url));
const receiptDir=join(here,'../walk/artifacts/nara-embodiment-20260924');
mkdirSync(receiptDir,{recursive:true});
const receipt={schema:'oi.nara-embodiment-acceptance/v1',started_at:new Date().toISOString(),walks:{}};

function profile(current=true){
  const centres=Array.from({length:7},(_,ordinal)=>({
    ordinal,
    locus_ref:`ql:nara:subject:1:centre:${ordinal}`,
    label:['Root','Sacral','Solar','Heart','Throat','Brow','Crown'][ordinal],
    source_ref:`source:centre:${ordinal}`,
    source_revision:'r1',
    m1_basis_ref:'m1',m2_basis_ref:'m2',m3_basis_ref:'m3',
    amplitude:0.4+ordinal*0.08,
  }));
  return {
    schema:NARA_ANIMA_PROFILE_SCHEMA,subject_ref:'subject:1',event_ref:'event:1',
    profile_generation:3,personal_reception_generation:7,current,
    centres,
    earth_body:{locus_ref:'ql:nara:subject:1:earth-body',frame_ref:'frame:earth',standing:'EarthBody is the grounding relation; not an eighth centre peer'},
    centre_identity_neq_cymatic_station:true,standing:'live projection',
  };
}

const formStanding='explicit-m3-physical-form-target/v1; not orientation_seed; not presentation glyph; not source angles as pose';
function form(pose=2,states=6){
  return {schema:'ql.m3-physical-form-target/v1',target_kind:'fold-pose',constituent_ref:'c:1',pose_ordinal:pose,state_count:states,address:4,standing:formStanding};
}

test('GENERIC BUILDER WALK: New blank → place/shape → second Scene → round-trip without QL',()=>{
  const empty=blankJourney();
  assert.equal(empty.scenes[0].entities.length,0);
  const gate=entryGateHTML({hasContinue:true,continueLabel:'Continue last'});
  assert.match(gate,/entry-new/);
  assert.match(gate,/entry-continue/);
  assert.match(gate,/entry-open/);
  const journey=blankJourney();
  journey.name='Builder walk';
  const scene=journey.scenes[0];
  const a=entity('Glyph A','△',{x:0,y:0,z:0});
  const b=entity('Glyph B','◯',{x:.4,y:.2,z:0});
  a.force={kind:'vortex',strength:.2,radius:.2,spin:.1};
  a.tintWeight=.6;
  b.size={x:.3,y:.3};
  scene.entities=[a,b];
  const scene2=blankScene('Second');
  scene2.entities=[entity('Later','✧',{x:0,y:.5,z:0})];
  journey.scenes.push(scene2);
  validateJourney(journey);
  const restored=JSON.parse(JSON.stringify(journey));
  validateJourney(restored);
  assert.equal(restored.scenes.length,2);
  assert.equal(restored.scenes[0].entities.length,2);
  const starter=nativeSeven();
  assert.match(starter.description,/authored/i);
  assert.match(starter.description,/not live Nara/i);
  assert.ok(centreStandingDistinct(AUTHORED_CHAKRA_STARTER,NARA_PERSONAL_LIVE));
  assert.ok(centreStandingDistinct(AUTHORED_CHAKRA_STARTER,CYMATIC_STATION));
  receipt.walks.generic_builder={status:'passed',scenes:2,entities:restored.scenes[0].entities.length,ql_required:false};
});

test('M1/M2/M3 WALK: causal actuators available when following; refuse on disconnect',()=>{
  const connected=nativeActuatorStanding({
    status:'following',
    domain:{
      m1:{coordinate:'M1.0',revision:'1'},
      m2:{modes:[{ref:'mode:1',frequency_hz:110}],generation:2},
      m3:{physical_form:form(1,4),codon_ref:'codon:1'},
    },
  });
  assert.equal(connected.connected,true);
  assert.equal(connected.layers.every(l=>l.available),true);
  assert.equal(connected.physical_form.applied,true);
  if(connected.physical_form.applied)assert.equal(connected.physical_form.rotationDegrees,90);

  const heldM1=nativeActuatorStanding({
    status:'following',
    domain:{m1:{coordinate:'M1.3',revision:'2'},m2:{modes:[{ref:'mode:1',frequency_hz:110}],generation:2},m3:{physical_form:form(1,4)}},
  });
  assert.match(JSON.stringify(heldM1.layers[0]),/M1\.3|coordinate/);

  const disconnected=nativeActuatorStanding({status:'manual',domain:null});
  assert.equal(disconnected.connected,false);
  assert.equal(disconnected.layers.every(l=>!l.available),true);
  assert.equal(applyPhysicalFormPose(form(),false).applied,false);
  assert.equal(applyPhysicalFormPose({...form(),standing:'angles only'},true).applied,false);
  receipt.walks.m1_m2_m3={
    status:'passed',
    connected_layers:connected.layers.map(l=>({layer:l.layer,available:l.available})),
    disconnect_refuses:true,
    physical_form_pose_degrees:connected.physical_form.applied?connected.physical_form.rotationDegrees:null,
  };
});

test('NARA PERSONAL WALK: admit profile → seven centres → disconnect retains authored',()=>{
  const live=bindPersonalProjection({
    nara_ref:'nara:desktop',subject_ref:'subject:1',expression_ref:'expression:1',expression_revision:'12',profile:profile(),
  });
  const entities=[
    ...chakraEntities().map((e,i)=>({entity_ref:e.id,title:e.name,subject_ref:`ql:nara:subject:1:centre:${i}`})),
    {entity_ref:'earth',title:'EarthBody',subject_ref:'ql:nara:subject:1:earth-body'},
  ];
  const plan=planAnimaStageActuators(live,entities);
  assert.equal(plan.centres.filter(c=>c.applied).length,7);
  assert.equal(plan.earth_body.applied,true);
  assert.throws(()=>bindPersonalProjection({
    nara_ref:'nara:desktop',subject_ref:'subject:1',expression_ref:'expression:1',expression_revision:'12',profile:profile(false),
  }),/stale/);
  const disconnected=disconnectPersonalProjection(live);
  assert.equal(disconnected.standing,AUTHORED_CHAKRA_STARTER);
  assert.equal(disconnected.profile,null);
  assert.doesNotThrow(()=>assertNoPrivateLeak(JSON.stringify({schema:'oi.expression/v1',scenes:[]})));
  receipt.walks.nara_personal={status:'passed',centres_applied:7,earth_body:true,stale_refused:true,disconnect_standing:disconnected.standing};
});

test('NARA + AGENT WALK: personal co-ref drives stage focus with speech identity',()=>{
  const binding=bindPersonalProjection({
    nara_ref:'nara:desktop',subject_ref:'subject:1',expression_ref:'expression:1',expression_revision:'12',profile:profile(),
  });
  const document={entities:{'entity:heart':{entity_ref:'entity:heart',title:'Heart',subject:{subject_ref:'ql:nara:subject:1:centre:3'}}}};
  const resolution={outcome:{outcome:'focused',focus:[{ref_id:'ql:nara:subject:1:centre:3',focus_action:'select'}]}};
  const plan=stageFocusPlan(resolution,document,binding);
  assert.deepEqual(plan.unmapped,[]);
  assert.ok(plan.operations.some(op=>op.op==='kernel-focus'&&op.entity_ref==='entity:heart'));
  receipt.walks.nara_agent={status:'passed',operations:plan.operations.map(o=>o.op),shared_nara_ref:binding.nara_ref};
});

test.after(()=>{
  receipt.finished_at=new Date().toISOString();
  receipt.standing='D-grade automated walks for commission §9; Mac GPU/audio physical acceptance is separate';
  writeFileSync(join(receiptDir,'acceptance-walks.json'),JSON.stringify(receipt,null,2));
});
