import test from 'node:test';
import assert from 'node:assert/strict';
import {blankScene,entity,clone} from '../expressions-app/field-studies-journeys/src/model.ts';
import {automationTargets} from '../expressions-app/field-studies-journeys/src/nativeParameters.ts';
import {toNativeConfig} from '../expressions-app/field-studies-journeys/src/nativeBridge.ts';
import {createAutomationRuntime,applyAutomations} from '../expressions-app/src/engine/automation.ts';
import {evaluateTracks} from '../expressions-app/field-studies-journeys/src/propertyTracks.ts';
import {emptyRetention,withRetention,retention} from '../expressions-app/field-studies-journeys/src/proceduralRetention.ts';
import {controlCapabilities,propertyAddress,setAuthoredBase,takeOver,releaseControl,recordControl} from '../expressions-app/field-studies-journeys/src/proceduralControls.ts';

// These run the actual nativeBridge and CPU automation evaluator. No GPU,
// native Rust receipt, physical body or audio application is claimed.
const expression='expression:independent-controls';
const sceneRef=expression+':scene:main',entityRef=expression+':entity:body';
const context={expression_ref:expression,scene_ref:sceneRef,occurrences:{[entityRef]:entityRef}};
const actor={context,actor:'human:owner',operation_ref:'operation:takeover',lifetime:'persistent'};
const lane=(id,target,extra={})=>({id,target,enabled:true,type:'lfo',wave:'sine',min:0,max:1,
  rate:0.25,phase:0.125,blend:'replace',duration:5,delay:0,loop:'loop',firedAt:0,...extra});
function scene(){
  const s=blankScene('Independent controls');s.id=sceneRef;
  const e=entity('Current native constituent','O');e.id=entityRef;e.force.strength=0.2;s.entities=[e];
  return s;
}
function targets(s){
  const all=automationTargets(s);
  return {all,strength:all.find(t=>t.entityId===entityRef&&t.bind==='entity.force.strength'),
    spin:all.find(t=>t.entityId===entityRef&&t.bind==='entity.force.spin')};
}
function grouped(){
  const s=scene(),{strength,spin}=targets(s);assert.ok(strength&&spin);
  s.automation=[lane('driver:leader',strength.target,{min:0.1,max:0.7,clockId:'clock:continuing'}),
    lane('driver:peer',spin.target,{min:-0.5,max:0.5,syncWith:'driver:leader',rate:1,phase:0.5})];
  s.propertyTracks=[{id:'track:strength',bind:strength.bind,entityId:entityRef,points:[{time:0,value:0.2},{time:10,value:0.4}]}];
  return {s,strength,spin};
}

test('A02/A06 registry capabilities address every native bound scalar with exact admitted range',()=>{
  const s=scene(),capabilities=controlCapabilities(s,context),bound=automationTargets(s).filter(t=>t.bind);
  assert.equal(capabilities.length,bound.length);
  for(const c of capabilities){const target=bound.find(t=>t.target===c.target);assert.ok(target);
    assert.equal(c.min,target.hardMin);assert.equal(c.max,target.hardMax);assert.equal(c.base,target.value);
    assert.equal(c.native_factor,target.factor);assert.deepEqual(c.operations,['set_base','takeover','release','record']);}
});

test('A06 takeover of actual group leader holds its property while peer keeps the continuing engine clock',()=>{
  const {s,strength,spin}=grouped(),before=clone(s),rt=createAutomationRuntime();
  const original=toNativeConfig(s),first=applyAutomations(original,original.automations,1,rt);
  assert.equal(rt.lanes.size,1);const clock=rt.lanes.get('clock:continuing');assert.ok(clock);
  const held=takeOver(s,{...actor,target:strength.target,value:0.8});
  assert.deepEqual(s,before);assert.equal(held.entities[0].force.strength,0.8);
  assert.equal(held.propertyTracks.length,0);assert.equal(held.automation.length,1);
  const live=toNativeConfig(held),next=applyAutomations(live,live.automations,2,rt);
  assert.strictEqual(rt.lanes.get('clock:continuing'),clock);
  assert.equal(next.config.entities[0].forces.strength,0.8);
  assert.notEqual(next.config.entities[0].forces.spin,first.config.entities[0].forces.spin);
  assert.equal(live.automations[0].clockId,'clock:continuing');
  assert.equal(held.automation[0].target,spin.target);
  assert.equal(retention(held).controls[0].dormant_lanes.length,2);
});

test('A06 release returns to original driver parameters and current engine clock, retaining property track',()=>{
  const {s,strength}=grouped(),rt=createAutomationRuntime();
  const before=toNativeConfig(s);applyAutomations(before,before.automations,1,rt);
  const clock=rt.lanes.get('clock:continuing');
  const held=takeOver(s,{...actor,target:strength.target,value:0.8});
  const active=toNativeConfig(held);applyAutomations(active,active.automations,2,rt);
  const address=propertyAddress(context,strength),released=releaseControl(held,address);
  assert.deepEqual(released.automation,s.automation);assert.deepEqual(released.propertyTracks,s.propertyTracks);
  assert.equal(released.entities[0].force.strength,0.2);assert.equal(retention(released).controls.length,0);
  const returned=toNativeConfig(released),received=applyAutomations(returned,returned.automations,3,rt);
  assert.strictEqual(rt.lanes.get('clock:continuing'),clock);assert.equal(clock.lastTime,3);
  assert.notEqual(received.config.entities[0].forces.strength,0.8);
  assert.ok(Math.abs(evaluateTracks(released,5).entities[0].force.strength-0.3)<1e-12);
});

test('A06 concurrent group edits refuse release without altering actual retained draft',()=>{
  const {s,strength}=grouped(),held=takeOver(s,{...actor,target:strength.target,value:0.8});
  held.automation[0].rate=0.9;const before=clone(held);
  assert.throws(()=>releaseControl(held,propertyAddress(context,strength)),/group changed/);
  assert.deepEqual(held,before);assert.equal(retention(held).controls[0].takeover.value,0.8);
});

test('A06 new target driver refuses release and preserves manual intervention',()=>{
  const {s,strength}=grouped(),held=takeOver(s,{...actor,target:strength.target,value:0.8});
  held.automation.push(lane('driver:foreign',strength.target));const before=clone(held);
  assert.throws(()=>releaseControl(held,propertyAddress(context,strength)),/new driver/);assert.deepEqual(held,before);
});

test('A06/A07 persistent intervention is recorded under owning whole-scene contribution at the exact property',()=>{
  const s=scene(),{strength}=targets(s),r=emptyRetention();
  r.contributions=[{contribution_ref:'contribution:scene',procedure_ref:'procedure:scene',output_slot:'scene',
    subject_refs:['native:source'],occurrence_ref:sceneRef,recipe_revision:'1',
    owned_addresses:[{expression_ref:expression,scene_ref:sceneRef,entity_ref:null,component:'scene',constituent_ref:null,property:null}],
    generated_basis:clone(s),authored_overrides:[],status:'active'}];
  const held=takeOver(withRetention(s,r),{...actor,target:strength.target,value:0.8});
  const overrides=retention(held).contributions[0].authored_overrides;
  assert.equal(overrides.length,1,'whole-scene generated owner must retain its contained property intervention');
  assert.deepEqual(overrides[0].address,propertyAddress(context,strength));assert.equal(overrides[0].value,0.8);
});

test('A06 out-of-domain values and missing targets refuse through actual registry, preserving input',()=>{
  const s=scene(),before=clone(s),{strength}=targets(s);
  for(const value of [NaN,Infinity,strength.hardMin-1,strength.hardMax+1]){
    assert.throws(()=>setAuthoredBase(s,strength.target,value));assert.throws(()=>takeOver(s,{...actor,target:strength.target,value}));
  }
  assert.throws(()=>takeOver(s,{...actor,target:'entity:missing:forces.strength',value:0.5}));assert.deepEqual(s,before);
});

test('A06 explicit authored-base edit keeps the same active native driver',()=>{
  const {s,strength}=grouped(),updated=setAuthoredBase(s,strength.target,0.8);
  assert.deepEqual(updated.automation,s.automation);assert.deepEqual(updated.propertyTracks,s.propertyTracks);
  assert.equal(updated.entities[0].force.strength,0.8);assert.equal(s.entities[0].force.strength,0.2);
});

test('A06 recording uses sorted admitted owner positions and replaces only the same target/time',()=>{
  const s=scene(),{strength}=targets(s);
  let recorded=recordControl(s,{target:strength.target,time:8,value:0.2,track_ref:'track:take'});
  recorded=recordControl(recorded,{target:strength.target,time:2,value:0.4,track_ref:'track:take'});
  recorded=recordControl(recorded,{target:strength.target,time:8,value:0.9,track_ref:'track:take'});
  assert.deepEqual(recorded.propertyTracks[0].points,[{time:2,value:0.4},{time:8,value:0.9}]);
  assert.equal(evaluateTracks(recorded,5).entities[0].force.strength,0.65);
  for(const time of [-1,Infinity,NaN,3601])assert.throws(()=>recordControl(s,{target:strength.target,time,value:0.2,track_ref:'track:take'}));
});

function priorIntervention(){
  const {s,strength}=grouped(),a=propertyAddress(context,strength),r=emptyRetention(),basis=clone(s);
  s.entities[0].force.strength=0.6;
  r.contributions=[{contribution_ref:'contribution:prior',procedure_ref:'procedure:prior',output_slot:'scene',
    subject_refs:['native:source'],occurrence_ref:sceneRef,recipe_revision:'1',
    owned_addresses:[{expression_ref:expression,scene_ref:sceneRef,entity_ref:null,component:'scene',constituent_ref:null,property:null}],
    generated_basis:basis,authored_overrides:[{address:a,value:0.6,actor:'human:prior'}],status:'active'}];
  return {s:withRetention(s,r),strength,address:a};
}

test('A06/A07 prior persistent human intervention survives gesture and persistent takeover, release and durable three-way basis',()=>{
  for(const lifetime of ['gesture','persistent']){
    const {s,strength,address}=priorIntervention(),before=clone(s);
    const held=takeOver(s,{...actor,target:strength.target,value:0.8,lifetime});
    assert.deepEqual(s,before);assert.equal(held.entities[0].force.strength,0.8);
    const cached=retention(held).controls[0].dormant_overrides[0];
    assert.equal(cached.contribution_ref,'contribution:prior');assert.deepEqual(cached.overrides,before.procedural.contributions[0].authored_overrides);
    assert.equal(cached.takeover_overrides.length,lifetime==='persistent'?1:0);
    const reopened=JSON.parse(JSON.stringify(held)),released=releaseControl(reopened,address),kept=retention(released);
    assert.equal(released.entities[0].force.strength,0.6);assert.equal(kept.controls.length,0);
    assert.deepEqual(kept.contributions[0].authored_overrides,before.procedural.contributions[0].authored_overrides);
    assert.deepEqual(kept.contributions[0].generated_basis,before.procedural.contributions[0].generated_basis);
    assert.equal(kept.contributions[0].generated_basis.entities[0].force.strength,0.2);
    assert.equal(toNativeConfig(released).entities[0].forces.strength,0.6);
    assert.deepEqual(released.automation,before.automation);assert.deepEqual(released.propertyTracks,before.propertyTracks);
  }
  // This exercises durable controls and the original native-generation basis.
  // Actual native regenerate over this retained act is a separate paired test.
});

test('A06/A07 conflicting human intervention or new contribution ownership refuses release without losing the draft',()=>{
  for(const mutation of ['changed_override','new_owner']){
    const {s,strength,address}=priorIntervention(),held=takeOver(s,{...actor,target:strength.target,value:0.8});
    if(mutation==='changed_override')held.procedural.contributions[0].authored_overrides[0].value=0.9;
    else{const added=clone(held.procedural.contributions[0]);added.contribution_ref='contribution:new-owner';held.procedural.contributions.push(added);}
    const before=clone(held);assert.throws(()=>releaseControl(held,address),/intervention|ownership|reconcile/i);
    assert.deepEqual(held,before);assert.equal(held.entities[0].force.strength,0.8);
  }
});
