import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionVerification,modelDefaults,modelDefaultChoice} from '../src/workspace/settings/harnessCapabilities.ts';

test('connection verification needs a resident native session and no fault',()=>{
 assert.deepEqual(connectionVerification({state:'Resident',native_session_id:'native-1',resident:true}),{connected:true,summary:'Connected. The native session is ready.'});
 assert.equal(connectionVerification({state:'Resident'}).connected,false);
 assert.equal(connectionVerification({state:'Resident',native_session_id:'native-1',resident:false}).connected,false);
 assert.equal(connectionVerification({state:'Resident',native_session_id:'native-1',error:'socket closed'}).connected,false);
 assert.equal(connectionVerification({state:'TurnInFlight',native_session_id:'native-1'}).summary,'Connected. A turn is in progress.');
 assert.equal(connectionVerification({state:'Disconnected'}).summary,'Disconnected. This conversation has no resident harness connection.');
});


test('default model staging retains the advertised name and native provider without inventing a candidate',()=>{
 const observation={current_model_id:'glm-5',native_provider:'zai',available_models:[{modelId:'glm-5',name:'GLM 5'}],standing:'native get_state'};
 assert.deepEqual(modelDefaultChoice(observation,'glm-5'),{model_id:'glm-5',model_name:'GLM 5',native_provider:'zai'});
 assert.equal(modelDefaultChoice(observation,'unknown'),undefined);
 assert.equal(modelDefaultChoice(undefined,'glm-5'),undefined);
 const stored={pi:modelDefaultChoice(observation,'glm-5')};
 assert.equal(modelDefaults(JSON.parse(JSON.stringify(stored))).pi.model_name,'GLM 5');
 assert.deepEqual(modelDefaults({broken:{model_name:'invented'}}),{});
});
