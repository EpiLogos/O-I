import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionVerification} from '../src/workspace/settings/harnessCapabilities.ts';

test('connection verification needs a resident native session and no fault',()=>{
 assert.deepEqual(connectionVerification({state:'Resident',native_session_id:'native-1',resident:true}),{connected:true,summary:'Connected. The native session is ready.'});
 assert.equal(connectionVerification({state:'Resident'}).connected,false);
 assert.equal(connectionVerification({state:'Resident',native_session_id:'native-1',resident:false}).connected,false);
 assert.equal(connectionVerification({state:'Resident',native_session_id:'native-1',error:'socket closed'}).connected,false);
 assert.equal(connectionVerification({state:'TurnInFlight',native_session_id:'native-1'}).summary,'Connected. A turn is in progress.');
 assert.equal(connectionVerification({state:'Disconnected'}).summary,'Disconnected. This conversation has no resident harness connection.');
});
