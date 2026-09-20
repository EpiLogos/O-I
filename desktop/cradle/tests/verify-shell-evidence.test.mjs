import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReceipt} from './verify-shell-evidence.mjs';
const identity={sourceRevision:'tested-head',driverSha256:'tested-driver',runId:'this-run'};
const valid=()=>({passed:true,checks:['one','two'],failures:[],sourceClean:true,...identity});
test('evidence gate accepts only complete current passing receipts',()=>{assert.doesNotThrow(()=>validateReceipt(valid(),2,identity));});
test('evidence gate retains a contradictory failure despite reported success',()=>{
 assert.throws(()=>validateReceipt({...valid(),passed:false},2,identity));
 assert.throws(()=>validateReceipt({...valid(),failures:[{error:'geometry'}]},2,identity));
 assert.throws(()=>validateReceipt({...valid(),checks:['one']},2,identity));
});
test('evidence gate rejects stale source, driver and run identities',()=>{
 assert.throws(()=>validateReceipt({...valid(),sourceClean:false},2,identity));
 for(const key of Object.keys(identity))assert.throws(()=>validateReceipt({...valid(),[key]:'previous'},2,identity));
});
