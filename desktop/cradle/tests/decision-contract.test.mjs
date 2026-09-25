import test from 'node:test';
import assert from 'node:assert/strict';
import {decisionReservation,authoriseDecisionEpisode} from '../src/flow/decisionClient.ts';
test('decision reservation rounds upwards without floating point or unsafe integer spend',()=>{
 assert.equal(decisionReservation(16000,1000,42000,0),672);
 assert.equal(decisionReservation(1,0,1,0),1);
 assert.equal(decisionReservation(10,10,50000,50000),1);
 assert.throws(()=>decisionReservation(1.5,0,1,0),/whole/);
 assert.throws(()=>decisionReservation(100,0,-1,0),/non-negative/);
 assert.throws(()=>decisionReservation(Number.MAX_SAFE_INTEGER,0,Number.MAX_SAFE_INTEGER,0),/budget bound/);
});
test('a bridge or unavailable renderer cannot issue an episode without native confirmation',async()=>{
 for(const transport of [{kind:'bridge',url:'http://127.0.0.1:1'},{kind:'unavailable',reason:'native host absent'}])await assert.rejects(authoriseDecisionEpisode(transport,{preflight_ref:'caller-chosen'}),/native confirmation/);
});
