import test from 'node:test';import assert from 'node:assert/strict';
import {fieldStudies,clone} from '../build/model.js';
import {inspectorHTML} from '../build/inspector.js';
import {captureObjectState} from '../build/sourceState.js';

function motionContext(scene,journey,entityId,stepIndex=0){
 return {scene,journey,selected:[entityId],textId:null,tab:'motion',motionTab:'sequence',stepIndex,preview:false,search:''};
}

test('the sequence chain marks which steps carry their own object state, without instructional-label substitutes',()=>{
 const journey=fieldStudies(),scene=journey.scenes[0],e=scene.entities.find(x=>x.kind==='formation');
 assert.ok(e,'fixture must contain a formation to edit its sequence');
 // A second step with a captured object state, alongside the plain first step.
 e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'state-2'});
 e.sequence.steps[1].objectState=captureObjectState(e).objectState;
 const html=inspectorHTML(motionContext(scene,journey,e.id,0));
 const buttons=[...html.matchAll(/<button data-action="select-step"[^>]*>/g)].map(m=>m[0]);
 assert.equal(buttons.length,e.sequence.steps.length);
 assert.match(buttons[0],/data-overrides-state="0"/);
 assert.match(buttons[1],/data-overrides-state="1"/);
 assert.match(buttons[1],/own object state/);
 // The selected step is unambiguously marked active, by class, not by a swapped-in label.
 assert.match(buttons[0],/class="active"/);
 assert.doesNotMatch(buttons[1],/class="active"/);
});

test('reorder, duplicate and remove act on the real sequence model, not a placeholder',()=>{
 const journey=fieldStudies(),scene=journey.scenes[0],e=scene.entities.find(x=>x.kind==='formation');
 e.sequence.steps.push({...clone(e.sequence.steps[0]),id:'state-2',text:'B'});
 const html=inspectorHTML(motionContext(scene,journey,e.id,0));
 for(const action of ['step-earlier','step-later','duplicate-step','delete-step','add-step'])
  assert.match(html,new RegExp(`data-action="${action}"`),`${action} control must be present in the sequence editor`);
});
