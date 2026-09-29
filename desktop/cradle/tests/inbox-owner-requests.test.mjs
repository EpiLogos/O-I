/** An accepted proposal becomes Factory work through Factory's own intake:
 * the commission request is derived only from the accepted Return, and a
 * repeat after interruption is byte-identical (Factory replays it). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {awaitsFactory,commissionRequest,registerScope} from '../src/receiving/commission.ts';
const family={kind:'agent-set',ref:'oi-guardians',revision:'r1',source_path:'Control/agents/agent-sets/agent-set-1561df4e0ea22f08.json',record:{orchestrator_agent_ref:'agent/oi-field-guardian',members:[]}};

const accepted=(over={})=>({schema:'central.receiving-reading/v1',return_ref:'central:return:project:O-I:3f9c2a7be0d14e55aa01',revision:'central.content-fnv1a64/v1:900:aa',included:false,
 source_changed_by_arrival_or_review:false,automatic_agent_or_model_invocation:false,
 record:{kind:'request',status:'accepted',author:{principal_ref:'native-service:aikit/gateway',actor_kind:'native-service'},
  declared_producer:{ref:'central:position:control:root:epii',actor_kind:'agent',attribution:'verified'},
  request:{kind:'proposal',subject:'Commission independent verification of the Mac shader uniform limit',body:'The receipt has no per-check results.\n\nNor a bundle hash.',proposed_owner_ref:'factory',proposal_ref:'factory:commission:verify-shader'},
  evidence_refs:['central:path:/w:T/failure.json'],now_ref:'central:now:control:root:abc',
  review:{reviewer_ref:'human:owner',authority_ref:'a',authority_revision:'r',disposition:'accepted',reviewed_at_unix_seconds:1790700000,note:'Verification only.'},
  authority_ref:'a',authority_revision:'r',stale_at_arrival:false,received_at_unix_seconds:1790690000,revision:'x',return_ref:'x',sequence:1,...over}});
const source={statePath:'/Central/Work/O-I/.factory/development-state.json',projectKey:'central-project:O-I'};

test('an accepted Factory proposal composes one replay-stable commission request',()=>{
 const reading=accepted();
 assert.equal(awaitsFactory(reading),true);
 const first=commissionRequest(reading,source,'O-I',family),again=commissionRequest(structuredClone(reading),source,'O-I',family);
 assert.deepEqual(first,again,'a retry must be byte-identical so Factory replays instead of minting a second Run');
 assert.equal(first.contract,'factory.commission-request/v1');
 assert.equal(first.requestRef,'commission:inbox-3f9c2a7be0d14e55aa01');
 assert.doesNotMatch(first.requestRef,/\s/);
 assert.equal(first.projectKey,'central-project:O-I');
 assert.equal(first.writeOwner,'factory');
 assert.equal(first.commissionedAt,'2026-09-29T16:40:00Z','the acceptance time, not the retry clock');
 assert.equal(first.rootAct.standing,'commissioned-not-executed');
 assert.deepEqual(first.rootAct.scopeRefs,[registerScope('O-I')]);
 assert.equal(first.rootAct.agentRef,'agent/oi-field-guardian','the O:I guardian carries the Run');
 assert.equal(first.participantRequirements[0].ref,first.rootAct.agentRef,'Factory requires the root Agent among the participants');
 assert.deepEqual(first.participantRequirements[1],{ref:'agent-set/oi-guardians',description:first.participantRequirements[1].description,sourceOwner:'central',
  sourceRef:'central:source:control:root:Control/agents/agent-sets/agent-set-1561df4e0ea22f08.json',sourceRevision:'r1'},'the family it calls on is required, pinned to its Central record');
 assert.equal(first.participantRequirements[0].sourceOwner,'central');
 assert.equal(first.participantRequirements[0].sourceRef,reading.return_ref);
 assert.match(first.frontier,/Verification only\./,"the person's note travels into the commission");
 for(const text of [first.purpose,first.frontier,first.runDestination,first.rootAct.purpose,first.participantRequirements[0].description])
  assert.ok(text===text.trim()&&!/[\p{Cc}]/u.test(text),`Factory refuses control characters: ${JSON.stringify(text)}`);
 assert.match(first.participantRequirements[0].description,/central:position:control:root:epii/);
});

test('nothing is commissioned before the person accepts it, or twice',()=>{
 for(const over of [{status:'pending',review:null},{status:'rejected'},{status:'included',realisation:{ref:'run:01'}},
  {request:{kind:'proposal',subject:'s',proposed_owner_ref:null}},{request:{kind:'question',subject:'s'}},{kind:'contribution'}]){
  const reading=accepted(over);
  assert.equal(awaitsFactory(reading),false,JSON.stringify(over));
  assert.throws(()=>commissionRequest(reading,source,'O-I',family));
 }
 assert.equal(registerScope(null),'control:root');
 assert.throws(()=>commissionRequest(accepted(),source,'O-I',{...family,record:{members:[]}}),/no orchestrator/,'a family with no orchestrator cannot carry a Run');
});
