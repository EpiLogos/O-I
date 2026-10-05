import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {blankScene,entity,clone} from '../expressions-app/field-studies-journeys/src/model.ts';
import {automationTarget,automationTargets} from '../expressions-app/field-studies-journeys/src/nativeParameters.ts';
import {toNativeConfig} from '../expressions-app/field-studies-journeys/src/nativeBridge.ts';
import {kernelDocumentToJourney} from '../expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {emptyRetention,withRetention,retention} from '../expressions-app/field-studies-journeys/src/proceduralRetention.ts';
import {takeOver,releaseControl,propertyAddress,controlCapabilities} from '../expressions-app/field-studies-journeys/src/proceduralControls.ts';
import {evaluateTracks} from '../expressions-app/field-studies-journeys/src/propertyTracks.ts';
import {createAutomationRuntime,applyAutomations} from '../expressions-app/src/engine/automation.ts';

// The source is produced by the actual authoring/control modules. It is data
// for real Application::Fork execution, never a native or receiving receipt.
const expression='expression:independent-native';
const sceneRef=expression+':scene:main',entityRef=expression+':entity:a';
const forkRef='expression:independent-native-fork-controls';
const context={expression_ref:expression,scene_ref:sceneRef,occurrences:{[entityRef]:entityRef}};
const lane=(id,target,extra={})=>({id,target,enabled:true,type:'lfo',wave:'sine',min:0.1,max:0.7,
  rate:0.25,phase:0.125,blend:'replace',duration:5,delay:0,loop:'loop',firedAt:0,...extra});
function produce(lifetime='persistent'){
  const s=blankScene('Actual control Fork source');s.id=sceneRef;
  const e=entity('Actual copied body','O');e.id=entityRef;e.force.strength=0.2;
  e.sequence.enabled=true;e.sequence.steps[0].id=expression+':opaque-step';
  e.sequence.steps[0].native={hold:1.25};e.sequence.steps[0].text='O';
  const all=automationTargets({...s,entities:[e]});
  const strength=all.find(t=>t.entityId===entityRef&&t.bind==='entity.force.strength');
  const spin=all.find(t=>t.entityId===entityRef&&t.bind==='entity.force.spin');
  const radius=all.find(t=>t.entityId===entityRef&&t.bind==='entity.force.radius');
  assert.ok(strength&&spin&&radius);
  const sourceText=`${strength.target} / ${expression}:opaque-driver`;
  e.source={kind:'ascii',ascii:{text:sourceText}};
  e.sequence.steps[0].source=clone(e.source);s.entities=[e];
  s.character=sourceText;
  s.automation=[lane('driver:leader',strength.target,{entityId:entityRef,clockId:'clock:copied-definition'}),
    lane('driver:peer',spin.target,{entityId:entityRef,syncWith:'driver:leader',min:-0.5,max:0.5}),
    lane('driver:target-only',radius.target,{min:0.1,max:0.4,clockId:'clock:radius-definition'}),
    lane('driver:link',`link:${encodeURIComponent(entityRef)}:${encodeURIComponent(e.sequence.steps[0].id)}:hold`,{min:1,max:2})];
  s.propertyTracks=[{id:'track:strength',entityId:entityRef,bind:strength.bind,points:[{time:0,value:0.2},{time:10,value:0.4}]},
    {id:'track:spin',entityId:entityRef,bind:spin.bind,points:[{time:0,value:0.1},{time:10,value:0.3}]}];
  const r=emptyRetention(),address=propertyAddress(context,strength);
  r.contributions=[{contribution_ref:expression+':contribution:manual',procedure_ref:'procedure:manual-authoring',
    output_slot:'scene',subject_refs:[expression+':source:literal'],occurrence_ref:sceneRef,recipe_revision:'1',
    owned_addresses:[{expression_ref:expression,scene_ref:sceneRef,entity_ref:null,component:'scene',constituent_ref:null,property:null}],
    generated_basis:{schema:'oi.journey-scene/v1',scene:clone(s),saved:clone(s)},
    authored_overrides:[{address,value:0.2,actor:'human:prior'}],status:'active'}];
  const held=takeOver(withRetention(s,r),{context,target:strength.target,value:0.8,actor:'human:owner',
    operation_ref:'operation:actual-component-takeover',lifetime});
  held.native={config:toNativeConfig(held),projection:toNativeConfig(held)};
  const document={schema:'oi.expression/v1',expression_ref:expression,revision:1,title:'Actual control Fork source',
    entities:{[entityRef]:{entity_ref:entityRef,revision:1,title:e.name,subject:null,parameters:{force_strength:{value:0.8,automation:null}}}},
    relations:{},provenance:[],representations:[],
    scenes:[{scene_ref:sceneRef,revision:1,title:held.name,entity_refs:[entityRef],body:null,triggers:[],presentation:{schema:'oi.journey-scene/v1',scene:held,saved:clone(held)}}],
    selection:{scene_ref:sceneRef,entity_ref:null,relation_ref:null},refinements:[],collections:[],profiles:[]};
  return {schema:'oi.procedural-control-fork-source/v1',original:document,fork_ref:forkRef,
    expected:{source_text:sourceText,step_ref:e.sequence.steps[0].id,strength_target:strength.target,
      original_entity_ref:entityRef,fork_entity_ref:forkRef+':entity:a',original_scene_ref:sceneRef,
      fork_scene_ref:forkRef+':scene:main'},source_scope:'actual authoring modules; native Fork unexecuted',
      gesture_release: lifetime==='gesture'?releaseControl(held,propertyAddress(context,strength)):null};
}
const source=produce();
source.gesture=produce('gesture');source.gesture.fork_ref='expression:independent-native-fork-gesture';
if(process.env.TA_ONTA_FORK_CONTROL_SOURCE_OUTPUT)await writeFile(process.env.TA_ONTA_FORK_CONTROL_SOURCE_OUTPUT,JSON.stringify(source,null,2)+'\n');

test('A06/A13 real native target producer retains active and dormant driver/track coordinates',()=>{
  const s=source.original.scenes[0].presentation.scene,r=retention(s),c=r.controls[0];
  assert.equal(c.target,source.expected.strength_target);assert.equal(c.authored_base,0.2);
  assert.equal(c.takeover.value,0.8);assert.equal(c.dormant_lanes.length,2);assert.equal(c.dormant_tracks.length,1);
  assert.equal(c.suspended_lanes.length,1);assert.equal(c.dormant_overrides[0].overrides[0].address.entity_ref,entityRef);
  const view=kernelDocumentToJourney(source.original),scene=view.journey.scenes[0],config=toNativeConfig(scene);
  assert.equal(config.automations.length,3);assert.ok(config.automations.some(l=>l.path==='entities.0.forces.radius'));
  assert.ok(config.automations.some(l=>l.path==='entities.0.sequence.links.0.hold'));
  assert.equal(evaluateTracks(scene,5).entities[0].force.spin,0.2);
  const released=releaseControl(scene,c.address),returned=toNativeConfig(released);
  assert.equal(returned.automations.length,4);assert.equal(retention(released).controls.length,0);
  const rt=createAutomationRuntime(),first=applyAutomations(returned,returned.automations,1,rt),second=applyAutomations(returned,returned.automations,2,rt);
  assert.notEqual(first.config.entities[0].forces.strength,second.config.entities[0].forces.strength);
  assert.equal(rt.lanes.has('clock:copied-definition'),true);
  assert.equal(source.gesture.gesture_release.entities[0].force.strength,0.2);
  assert.equal(source.gesture.gesture_release.procedural.controls.length,0);
});

const nativePath=process.env.TA_ONTA_NATIVE_FORK_CONTROL_OUTPUT;
const native=nativePath?JSON.parse(await readFile(nativePath,'utf8')):null;
test('A06/A13 actual Application Fork reaches normal registry, automation and retained driver consumers',{
  skip:!native&&'Unexecuted: authentic Application::Fork original+fork artifact required',
},()=>{
  assert.equal(native.schema,'oi.procedural-control-fork-application/v1');
  assert.deepEqual(native.original,source.original,'real Fork must preserve its exact original Document');
  const doc=native.fork;assert.equal(doc.expression_ref,forkRef);
  const view=kernelDocumentToJourney(doc),s=view.journey.scenes[0],r=retention(s),c=r.controls[0];
  assert.equal(s.entities[0].id,source.expected.fork_entity_ref);
  assert.equal(s.entities[0].source.ascii.text,source.expected.source_text);assert.equal(s.character,source.expected.source_text);
  assert.equal(s.entities[0].sequence.steps[0].id,source.expected.step_ref);
  const capabilities=controlCapabilities(s,{expression_ref:forkRef,scene_ref:source.expected.fork_scene_ref,
    occurrences:{[source.expected.fork_entity_ref]:source.expected.fork_entity_ref}});
  assert.ok(automationTarget(s,c.target)?.bind,'retained actual target lost its owning parameter operation');
  assert.ok(capabilities.some(cap=>cap.target===c.target));
  for(const item of [...s.automation,...c.dormant_lanes,...c.suspended_lanes]){
    assert.equal(automationTarget(s,item.target)?.entityId,source.expected.fork_entity_ref,'encoded driver target stayed in original Expression');
    if(item.entityId)assert.equal(item.entityId,source.expected.fork_entity_ref);
  }
  for(const track of [...s.propertyTracks,...c.dormant_tracks])assert.equal(track.entityId,source.expected.fork_entity_ref);
  for(const group of c.dormant_overrides)for(const overlay of [...group.overrides,...group.takeover_overrides]){
    assert.equal(overlay.address.expression_ref,forkRef);assert.equal(overlay.address.scene_ref,source.expected.fork_scene_ref);
    assert.equal(overlay.address.entity_ref,source.expected.fork_entity_ref);
  }
  const cfg=toNativeConfig(s);assert.equal(cfg.automations.length,3,'a copied active driver was silently dropped at the real native converter');
  assert.equal(evaluateTracks(s,5).entities[0].force.spin,0.2,'a copied active property track no longer reaches the body');
  assert.equal(r.operations.length,0);assert.equal(r.time_mappings.length,0);assert.equal(r.checkpoint,undefined);
  assert.deepEqual(c.takeover,source.original.scenes[0].presentation.scene.procedural.controls[0].takeover,
    'persistent authored intervention lost its original lifetime/actor/operation provenance');
  const released=releaseControl(s,c.address),config=toNativeConfig(released);
  assert.equal(retention(released).controls.length,0);assert.equal(config.automations.length,4);
  assert.equal(released.entities[0].force.strength,0.2);
  assert.ok(Math.abs(evaluateTracks(released,5).entities[0].force.strength-0.3)<1e-12);
  const localContext={expression_ref:forkRef,scene_ref:source.expected.fork_scene_ref,
    occurrences:{[source.expected.fork_entity_ref]:source.expected.fork_entity_ref}};
  const retaken=takeOver(released,{context:localContext,target:c.target,value:0.6,actor:'human:fork-owner',
    operation_ref:'operation:fork-authored',lifetime:'persistent'});
  assert.equal(retaken.entities[0].force.strength,0.6);
  assert.equal(retention(retaken).controls[0].takeover.actor,'human:fork-owner');
});

const gesturePath=process.env.TA_ONTA_NATIVE_SOURCE_FORK_GESTURE_OUTPUT;
const gesture=gesturePath?JSON.parse(await readFile(gesturePath,'utf8')):null;
test('A06/A13 actual source-produced gesture Fork restores the exact native Parameter and dormant configuration',{
  skip:!gesture&&'Unexecuted: actual native ReadDriver -> compiled source control -> Application/Fork gesture artifact required; legacy gesture may only refuse',
},()=>{
  assert.equal(gesture.schema,'oi.native-source-control-fork/v1');
  assert.ok(gesture.producer_source_revisions&&gesture.native_driver_before&&gesture.source_prepared&&gesture.applied_before_fork&&gesture.fork);
  assert.deepEqual(gesture.original_after_fork,gesture.applied_before_fork);
  const view=kernelDocumentToJourney(gesture.fork),s=view.journey.scenes[0],prior=gesture.applied_before_fork.scenes[0].presentation.scene.procedural.controls[0];
  assert.deepEqual(prior.native_base,gesture.native_driver_before.native_parameter);
  assert.equal(prior.takeover.lifetime,'gesture');assert.ok(prior.takeover.native_value!==undefined);
  const entity=gesture.fork.entities[s.entities[0].id];
  assert.deepEqual(entity.parameters[gesture.native_driver_before.parameter],prior.native_base,
    'original native Automation/value was numerically reconstructed or discarded');
  assert.equal(retention(s).controls.length,0,'expired gesture left an unreachable retained control');
  assert.equal(s.entities[0].force.strength,0.2);assert.equal(toNativeConfig(s).automations.length,4);
  assert.ok(Math.abs(evaluateTracks(s,5).entities[0].force.strength-0.3)<1e-12);
  assert.equal(retention(s).contributions[0].authored_overrides[0].value,0.2);
  assert.equal(retention(s).contributions[0].authored_overrides[0].actor,'human:prior');
  for(const l of s.automation)assert.equal(automationTarget(s,l.target)?.entityId,s.entities[0].id);
  const t=automationTargets(s).find(t=>t.bind==='entity.force.strength');
  const next=takeOver(s,{context:{expression_ref:gesture.fork.expression_ref,scene_ref:s.id,occurrences:{[s.entities[0].id]:s.entities[0].id}},
    target:t.target,value:0.6,actor:'human:fork-owner',operation_ref:'operation:fork-gesture',lifetime:'gesture'});
  assert.equal(next.entities[0].force.strength,0.6);
});
