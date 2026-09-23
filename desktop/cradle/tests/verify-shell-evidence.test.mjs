import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReceipt,aggregateVerdict} from './verify-shell-evidence.mjs';
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

test('evidence gate inspects the error list independently of an empty failure list',()=>{
 assert.throws(()=>validateReceipt({...valid(),failures:[],errors:[{error:'runtime exception'}]},2,identity));
});

const controlled=()=>[{name:'a',count:1,grade:'D'},{name:'b',count:2,grade:'D'},{name:'c',count:3,grade:'D'}];
test('an aggregate of controlled receipts is grade D and never accepted',()=>{
 const {grade,accepted}=aggregateVerdict(controlled());
 assert.equal(grade,'D');
 assert.equal(accepted,false);
});
test('an aggregate may not claim acceptance without a grade-A (live/installed) input',()=>{
 const entries=controlled(); entries[1].grade='A';
 const {grade,accepted}=aggregateVerdict(entries);
 assert.equal(accepted,true,'one grade-A input admits acceptance');
 assert.equal(grade,'D','the aggregate grade is still its weakest input');
});
test('the aggregate refuses receipts without a grade at all',()=>{
 assert.throws(()=>aggregateVerdict([{name:'a',count:1}]));
});
