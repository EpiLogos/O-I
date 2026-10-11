/** Actual production admission/binding checks; native effects stay closed.
 * No successful Agent creation, Session or provider reply is fabricated. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import './register-production-sources.mjs';
const [{captureAgentReceiver,agentReceiverKey,journalReceiverKey,assertAgentSessionPage,readNativeSessionProfile},{NativeAgentController,nativeAgentInputKey},{nativeAgentOwner}]=await Promise.all([
 import('../../../desktop/cradle/src/agent/receiverScope.ts'),
 import('../../../desktop/cradle/src/agency/nativeAgent.ts'),
 import('../../../desktop/cradle/src/agency/nativeAgentClient.ts'),
]);
const unavailable={kind:'unavailable',reason:'The real source-test native transport is closed.'};
const basis={project:'O-I',sourceWorldRef:'world:retained-owner',accompanying:{project:'O-I',ref:'agent-session/retained',space:'session-space/retained'},mode:'factory',plane:'Agents',transport:unavailable,mounted:true,visible:true,current:true};
test('receiver capture survives harmless rerender but retires on each original target or presentation change',()=>{
 let state=structuredClone(basis);const current=captureAgentReceiver(()=>state);
 assert.equal(current(),true);state=structuredClone(basis);assert.equal(current(),true);
 for(const change of [{project:'other'},{sourceWorldRef:'world:other'},{accompanying:{...basis.accompanying,ref:'agent-session/other'}},{accompanying:{...basis.accompanying,space:'session-space/other'}},{mode:'expressions'},{plane:'Chat'},{transport:{...unavailable,reason:'New exact owner'}},{mounted:false},{visible:false},{current:false}]){
  state={...structuredClone(basis),...change};assert.equal(current(),false);
 }
 assert.equal(agentReceiverKey(basis),agentReceiverKey(structuredClone(basis)));
});
test('actual journal observer keys isolate owner transport, World, project and session',()=>{
 const binding={project:'O-I',ref:'agent-session/retained',sourceWorldRef:'world:retained-owner'};
 const key=journalReceiverKey(unavailable,binding);
 for(const next of [{project:'other'},{ref:'agent-session/other'},{sourceWorldRef:'world:other'},{sourceWorldRef:undefined}])assert.notEqual(journalReceiverKey(unavailable,{...binding,...next}),key);
 assert.notEqual(journalReceiverKey({...unavailable,reason:'another owner'},binding),key);
});
test('wrong-session and malformed actual journal readings refuse before cursor/selection adoption',()=>{
 for(const page of [null,{}, {agent_session:'foreign',events:[],next_cursor:0,more:false},{agent_session:basis.accompanying.ref,events:{},next_cursor:0,more:false},{agent_session:basis.accompanying.ref,events:[],next_cursor:-1,more:false},{agent_session:basis.accompanying.ref,events:[],next_cursor:NaN,more:false}])assert.throws(()=>assertAgentSessionPage(page,basis.accompanying.ref),/selected conversation/);
});
test('real unavailable native owner cannot produce either a local or hosted Agent reading',async()=>{
 for(const world of [undefined,basis.sourceWorldRef])await assert.rejects(nativeAgentOwner(unavailable,'O-I',world)({action:'roster'}),/real source-test native transport is closed/);
});
test('retired compound intent preserves exact human material and never becomes an uncertain native write',async()=>{
 const controller=new NativeAgentController(nativeAgentOwner(unavailable,'O-I',basis.sourceWorldRef));
 controller.edit({name:'Retained authored Agent',purpose:'Keep this original purpose',skillRefs:['skill/ql/anima-orchestration'],skillSetRefs:[],scopeConfirmed:true});
 const before=structuredClone(controller.snapshot().draft);
 assert.equal(await controller.saveAndStart(()=>false),undefined);
 const after=controller.snapshot();assert.deepEqual(after.draft,before);
 assert.equal(after.unknown,undefined);assert.equal(after.requestId,undefined);assert.equal(after.prepared,undefined);assert.equal(after.busy,false);
 assert.match(after.error,/presentation retired/);assert.equal(after.compound.propose,'failed');
});
test('new human input invalidates a captured opening without discarding or retargeting either material',()=>{
 const controller=new NativeAgentController(nativeAgentOwner(unavailable,'O-I',basis.sourceWorldRef));
 controller.edit({name:'Original named Agent',purpose:'Original exact human purpose'});
 const captured=nativeAgentInputKey(controller.snapshot());
 const before=structuredClone(controller.snapshot().draft);
 controller.edit({purpose:'New incoming human purpose'});
 assert.notEqual(nativeAgentInputKey(controller.snapshot()),captured);
 assert.equal(controller.snapshot().draft.purpose,'New incoming human purpose');
 assert.equal(before.purpose,'Original exact human purpose');
 assert.equal(controller.snapshot().prepared,undefined);
});
test('a desired profile or bare label is not a session/source/authority receipt',()=>{
 for(const value of [{name:'Epii Prime QL'}, {agent_ref:'agent/anima'}, {session:{schema:'aikit.direct-agent-session/v1',agent_session:'foreign',space:basis.accompanying.space}}, {session:{schema:'aikit.direct-agent-session/v1',agent_session:basis.accompanying.ref,space:basis.accompanying.space,provider_started:true,execution_authority_granted:false}}])assert.throws(()=>readNativeSessionProfile(value,basis.accompanying));
 assert.equal(readNativeSessionProfile({session:null,profile:null},basis.accompanying),undefined);
});
test('native changed, revoked or unavailable source refuses with its actual reason instead of disappearing into a generic identity',()=>{
 const session={schema:'aikit.direct-agent-session/v1',agent_session:basis.accompanying.ref,space:basis.accompanying.space,profile_ref:'retained-profile',profile_revision:'retained-revision',agent_ref:'retained-agent',provider_started:false,execution_authority_granted:false};
 for(const source_state of ['changed','revoked','unavailable']){
  assert.throws(()=>readNativeSessionProfile({session,source_state,reason:'Actual owner source refusal'},basis.accompanying),/Actual owner source refusal/);
  assert.throws(()=>readNativeSessionProfile({session,source_state},basis.accompanying),new RegExp(`source is ${source_state}`));
 }
 assert.throws(()=>readNativeSessionProfile({session,source_state:'unknown'},basis.accompanying),/no qualified currentness/);
 assert.throws(()=>readNativeSessionProfile({session,source_state:'current',profile:null},basis.accompanying),/no definition material/);
});
test('actual rich native inspection cannot cosmetically name the Agent or Session of a different owner',async()=>{
 const raw=JSON.parse(await readFile('/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json','utf8'));
 assert.deepEqual(raw.before.document,raw.after.document);
 assert.throws(()=>readNativeSessionProfile(raw.before,basis.accompanying));
 assert.throws(()=>assertAgentSessionPage(raw.before,basis.accompanying.ref));
});
