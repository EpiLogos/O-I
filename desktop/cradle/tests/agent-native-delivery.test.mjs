import test from 'node:test';import assert from 'node:assert/strict';
import {unknownDispatch,failedDispatch,admissionRefusal,settledPhase,mayStartDispatch} from '../src/encounter/deliveryOutcome.ts';
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
test('only the owner\'s own pre-effect admission code is a refusal; every other failure stays unknown',()=>{
 const refused=failedDispatch('delivery/a',Error('Sender, audience or packet source is outside this participant\'s explicit transport disclosure [encounter.disclosure_denied]'));
 assert.equal(refused.kind,'refused');assert.match(refused.error,/encounter\.disclosure_denied/);assert.equal(mayStartDispatch(refused),true);
 for(const code of ['encounter.group_audience','encounter.binding_changed','encounter.agency_required'])assert.equal(admissionRefusal(`refused [${code}]`),code);
 for(const failure of ['socket closed','AIKit encounter owner unavailable: broken pipe','Receipt not durable [encounter.storage]','Prompt submission uncertain [encounter.submission_uncertain]','quoted [encounter.disclosure_denied] then more'])assert.equal(failedDispatch('delivery/b',Error(failure)).kind,'unknown');
});
