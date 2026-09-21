import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeModelController,readNativeModel,connectionReady,connectionLabel} from '../src/encounter/nativeModel.ts';
// Controlled replies are test inputs to the production controller, not model proof.
const reading=()=>({agent_session:'agent-session/test',native_session_id:'native-one',model_observation:{current_model_id:'test/a',available_models:[{modelId:'test/a',name:'A'},{modelId:'test/b',name:'B'}],reasoning_effort:{configId:'reasoning_effort',currentValue:'low',options:[{value:'low',name:'Low'},{value:'high',name:'High'}]},standing:'provider-reported'},model_controls:{model_selection:true,reasoning_effort_selection:true},standing:'provider-reported'});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function create(call){const calls=[];const controller=new NativeModelController('agent-session/test',r=>{calls.push(r);return call(r);},()=>{});controller.observe({state:'Resident',native_session_id:'native-one'});return {controller,calls};}
test('connection labels do not turn faults, unknown states or a process badge into a ready session',()=>{
 for(const state of ['Connected','Connecting','Closed','Disconnected','FutureState'])assert.equal(connectionReady({state,native_session_id:'n'}),false);
 assert.equal(connectionReady({state:'Resident',native_session_id:'n',error:'lost pipe'}),false);
 assert.equal(connectionLabel({state:'Resident',native_session_id:'n',error:'lost pipe'}),'Connection failed');
 assert.equal(connectionLabel({state:'Connecting'}),'Connection Connecting');
 assert.equal(connectionReady({state:'Resident'}),false);
 assert.equal(connectionReady({state:'Resident',native_session_id:'n'}),true);
});
test('legacy owners and observed-only harness models stay read-only',async()=>{
 for(const capabilities of [undefined,{model_selection:false,reasoning_effort_selection:false,reason:'Launch-time only'}]){
  const row=reading();row.model_controls=capabilities;const {controller,calls}=create(async()=>row);await controller.refresh();await controller.select('test/b');assert.equal(calls.length,1);assert.equal(controller.snapshot().phase,'ready');assert.ok(controller.snapshot().error);
 }
});
test('empty provider observation remains honest absence, not an Auto entry',async()=>{
 const row=reading();row.model_observation=null;row.model_controls={model_selection:false,reasoning_effort_selection:false};const {controller}=create(async()=>row);await controller.refresh();assert.equal(controller.snapshot().reading.model_observation,null);
});
test('unknown model and unsupported reasoning do not reach the native write handler',async()=>{
 const {controller,calls}=create(async()=>reading());await controller.refresh();await controller.select('not-advertised');await controller.select('test/b','extreme');assert.equal(calls.length,1);
});
test('native durable policy pin is respected without hiding the harness catalogue',async()=>{
 const row=reading();row.pinned_model_id='test/a';const {controller,calls}=create(async()=>row);await controller.refresh();await controller.select('test/b');assert.equal(calls.length,1);assert.equal(controller.snapshot().reading.model_observation.available_models.length,2);
});
test('selection carries exact session identity and confirms configuration, never inference',async()=>{
 const {controller,calls}=create(async request=>{const row=reading();if(request.action==='model-select'){row.model_observation.current_model_id='test/b';row.model_observation.reasoning_effort.currentValue='high';return {...row,selected:true,inference_observed:false};}return row;});
 await controller.refresh();await controller.select('test/b','high');assert.deepEqual(calls[1],{action:'model-select',agent_session:'agent-session/test',expected_native_session_id:'native-one',provider_model_id:'test/b',provider_reasoning_effort:'high'});assert.deepEqual(controller.snapshot().confirmed,{modelId:'test/b',effort:'high'});
});
test('transport disconnect after selection is unknown, never automatically resent',async()=>{
 const {controller,calls}=create(async request=>{if(request.action==='model-select')throw Error('disconnected after send');return reading();});await controller.refresh();await controller.select('test/b');assert.equal(controller.snapshot().phase,'unknown');await controller.select('test/b');assert.equal(calls.length,2);await controller.refresh();assert.equal(controller.snapshot().phase,'ready');assert.equal(controller.snapshot().confirmed,undefined);assert.equal(calls.length,3);
});
test('partial or contradictory configuration acknowledgement is unknown',async()=>{
 for(const extra of [{selected:true,inference_observed:false},{...reading(),selected:true,inference_observed:false},{...reading(),selected:true,inference_observed:true}]){
  const {controller}=create(async request=>request.action==='model-read'?reading():extra);await controller.refresh();await controller.select('test/b');assert.equal(controller.snapshot().phase,'unknown');assert.equal(controller.snapshot().confirmed,undefined);
 }
});
test('old reads cannot populate a new native session',async()=>{
 const d=deferred();const {controller}=create(()=>d.promise);const load=controller.refresh();controller.observe({state:'Resident',native_session_id:'native-two'});d.resolve(reading());await load;assert.equal(controller.snapshot().phase,'unread');assert.equal(controller.snapshot().reading,undefined);
});
test('out-of-order refresh drops the earlier result',async()=>{
 const first=deferred(),second=deferred();let count=0;const {controller}=create(()=>++count===1?first.promise:second.promise);const a=controller.refresh(),b=controller.refresh();const next=reading();next.model_observation.current_model_id='test/b';second.resolve(next);await b;first.resolve(reading());await a;assert.equal(controller.snapshot().reading.model_observation.current_model_id,'test/b');
});
test('old selection acknowledgement cannot confirm a reconnected session',async()=>{
 const d=deferred();const {controller}=create(request=>request.action==='model-read'?Promise.resolve(reading()):d.promise);await controller.refresh();const pending=controller.select('test/b');controller.observe({state:'Resident',native_session_id:'native-two'});const row=reading();row.model_observation.current_model_id='test/b';d.resolve({...row,selected:true,inference_observed:false});await pending;assert.equal(controller.snapshot().confirmed,undefined);assert.equal(controller.snapshot().reading,undefined);
});
test('stale or malformed native readings never become choices',()=>{
 for(const mutate of [r=>r.agent_session='other',r=>r.native_session_id='other',r=>delete r.model_observation,r=>r.model_observation.available_models.push(r.model_observation.available_models[0]),r=>r.model_observation.reasoning_effort.configId='arbitrary']){
  const row=reading();mutate(row);assert.throws(()=>readNativeModel(row,'agent-session/test','native-one'));
 }
});
test('running session blocks model writes even after an earlier ready reading',async()=>{
 const {controller,calls}=create(async()=>reading());await controller.refresh();controller.observe({state:'TurnInFlight',native_session_id:'native-one'});await controller.select('test/b');assert.equal(calls.length,1);assert.equal(controller.snapshot().phase,'unavailable');
});
