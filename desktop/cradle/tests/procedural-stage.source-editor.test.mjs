import test from 'node:test';
import assert from 'node:assert/strict';
import {blankJourney,blankScene,entity,clone,validateJourney} from '../expressions-app/field-studies-journeys/src/model.ts';
import {toNativeConfig} from '../expressions-app/field-studies-journeys/src/nativeBridge.ts';
import {resolveSequence} from '../expressions-app/src/engine/fieldModel.ts';
import {inspectorHTML as currentInspectorHTML} from '../expressions-app/field-studies-journeys/src/inspector.ts';
import {validateAddress,addressKey,addressCovers} from '../expressions-app/field-studies-journeys/src/proceduralRetention.ts';

const inspectorHTML=process.env.OI_SOURCE_EDITOR_INSPECTOR_PROPOSAL
  ?(await import(process.env.OI_SOURCE_EDITOR_INSPECTOR_PROPOSAL)).inspectorHTML:currentInspectorHTML;
function material(){
  const scene=blankScene('Actual source editor consumers'),body=entity('Actual layered formation','O');
  body.id='native-body';body.sequence.enabled=true;body.sequence.clock='seconds';
  body.sequence.steps[0].id='state:a';body.sequence.steps[0].hold=2;body.sequence.steps[0].transition=1;
  body.sequence.steps.push({...clone(body.sequence.steps[0]),id:'state:b',text:'I'});
  body.layers=[{id:'layer:shared',text:'O',z:0.02,scale:0.9}];
  body.sequence.steps[0].layers=[{id:'layer:shared',text:'A',z:0.17,scale:0.6}];
  scene.entities=[body];const journey=blankJourney('Actual source editor consumers');journey.scenes=[scene];
  return {scene,body,journey};
}

test('A02/A17 actual Studio Inspector emits each state identity for the native source event adapter',()=>{
  const {scene,body,journey}=material();
  const html=inspectorHTML({scene,journey,selected:[body.id],textId:null,tab:'motion',motionTab:'sequence',stepIndex:0,preview:false,search:'',pinned:[]});
  const stateButtons=[...html.matchAll(/<button\b[^>]*data-action="select-step"[^>]*>/g)].map(m=>m[0]);
  assert.equal(stateButtons.length,2,'the actual Studio sequence producer must expose both real states');
  assert.ok(stateButtons[0].includes('data-state-ref="state:a"'),'first Studio state lacks its actual identity');
  assert.ok(stateButtons[1].includes('data-state-ref="state:b"'),'second Studio state would receive the current-state fallback');
});

test('A01/A02 actual authored model and native sequence consumer preserve distinct same-id base/state layers',()=>{
  const {journey}=material(),admitted=validateJourney(journey).scenes[0],native=toNativeConfig(admitted).entities[0];
  assert.equal(native.layers[0].id,'layer:shared');assert.equal(native.layers[0].z,8);assert.equal(native.layers[0].shape.text,'O');
  const step=native.sequence.links.find(k=>k.id==='state:a');
  assert.equal(step.layers[0].id,'layer:shared');assert.equal(step.layers[0].z,68);assert.equal(step.layers[0].shape.text,'A');
  assert.equal(step.layers[0].scale,0.6);assert.equal(native.layers[0].scale,0.9);
  const held=resolveSequence(native,1,0,0,0);assert.equal(held.linkIndex,0);assert.equal(held.phase,'hold');
  const reopened=validateJourney(JSON.parse(JSON.stringify(journey))).scenes[0],again=toNativeConfig(reopened).entities[0];
  assert.deepEqual(again.layers,native.layers);assert.deepEqual(again.sequence.links[0].layers,step.layers);
});

test('A02/A07 retained address identities preserve omitted, explicit base and exact state Layer parents',()=>{
  const expression='expression:actual-layer-parent',legacy={expression_ref:expression,scene_ref:expression+':scene:main',entity_ref:expression+':entity:a',component:'layer',constituent_ref:'layer:shared',property:'z'};
  const base={...legacy,parent_ref:null},state={...legacy,parent_ref:'state:a'};
  assert.equal(Object.hasOwn(validateAddress(legacy),'parent_ref'),false);
  assert.equal(Object.hasOwn(validateAddress(base),'parent_ref'),true);
  assert.equal(validateAddress(base).parent_ref,null);assert.equal(validateAddress(state).parent_ref,'state:a');
  assert.notEqual(addressKey(legacy),addressKey(base),'ambiguous legacy lookup and exact base target must not share retained intervention identity');
  assert.notEqual(addressKey(base),addressKey(state));
  assert.equal(addressCovers(base,state),false);assert.equal(addressCovers(state,base),false);
});
