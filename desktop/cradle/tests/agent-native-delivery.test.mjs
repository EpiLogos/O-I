import test from 'node:test';import assert from 'node:assert/strict';
import {unknownDispatch,settledPhase,mayStartDispatch} from '../src/encounter/deliveryOutcome.ts';
test('transport failure cannot become a refusal or an automatically replayable delivery',()=>{
 const state=unknownDispatch('delivery/original',Error('socket closed'));
 assert.equal(state.kind,'unknown');assert.equal(state.ref,'delivery/original');assert.equal(mayStartDispatch(state),false);
 assert.equal(mayStartDispatch({kind:'running'}),false);
});
test('partial group acknowledgement preserves a per-recipient replay barrier',()=>{
 for(const phase of ['preparing','submitted','dispatching','uncertain','unknown','future-state'])assert.equal(mayStartDispatch({kind:'idle'},{rows:[{phase:'returned'},{phase}]}),false);
 assert.equal(mayStartDispatch({kind:'settled'},{rows:[{phase:'returned'},{phase:'cancelled'},{}]}),true);
});
test('only native terminal phases settle; configuration or connection does not',()=>{
 for(const phase of ['returned','failed','cancelled','reconciled-no-replay'])assert.equal(settledPhase(phase),true);
 for(const phase of ['connected','configured','submitted','uncertain','future-state'])assert.equal(settledPhase(phase),false);
});
