import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeAgentController,validateReview,validatePrepared} from '../src/agency/nativeAgent.ts';
const scope='control:root';
const profile={ref:'agent-profile:test',revision:'r1',agent_ref:'agent:test',name:'Source reader',purpose:'Read only the selected sources.',intent_provenance:{intent_expression:'Read only the selected sources.'}};
export function review(accepted=false){return {schema:'central.agent-profile-review/v1',profile:{...profile},scope_ref:scope,content_digest:'sha256:controlled',accepted,execution_authority_granted:false,acceptance:accepted?{schema:'central.agent-profile-acceptance/v1',acceptance_ref:'acceptance:test',profile_ref:profile.ref,agent_ref:profile.agent_ref,profile_revision:profile.revision,content_digest:'sha256:controlled',scope_ref:scope}:null};}
export function prepared(id='controlled-12345678'){return {schema:'aikit.direct-agent-session/v1',request_id:id,profile_ref:profile.ref,profile_revision:profile.revision,agent_ref:profile.agent_ref,agent_session:'agent-session/native',space:'session-space/native',project_ref:scope,acceptance_ref:'acceptance:test',prepared:true,provider_started:false,execution_authority_granted:false,brokered_child_context:'not established'};}
function rig(options={}){
 const calls=[];let value=review(false),stored=false,result=null;
 const owner=async request=>{
  calls.push(structuredClone(request));
  if(options.intercept){const answer=await options.intercept(request);if(answer!==undefined)return answer;}
  switch(request.action){
   case 'roster':return {schema:'central.agent-profile-roster/v1',scope_ref:scope,profiles:stored?[value]:[],execution_authority_granted:false};
   case 'propose':stored=true;return value;
   case 'review':return value;
   case 'accept':value=review(true);if(options.loseAcceptance)throw Error('lost acknowledgement');return value;
   case 'prepare':result=prepared(request.request_id);if(options.losePrepare)throw Error('lost acknowledgement');return result;
   case 'find':return result;
   default:throw Error('unexpected');
  }
 };
 return {calls,controller:new NativeAgentController(owner,()=> 'controlled-12345678'),owner};
}
async function propose(r){await r.controller.refresh();r.controller.edit({name:profile.name,purpose:profile.purpose,scopeConfirmed:true});await r.controller.propose();}
test('proposal, explicit acceptance, roster readback, native preparation are separate operations',async()=>{
 const r=rig();await propose(r);assert.equal(r.controller.snapshot().review.accepted,false);assert.equal(r.calls.some(c=>c.action==='accept'),false);
 await r.controller.accept();assert.equal(r.controller.snapshot().review.accepted,true);
 assert.deepEqual(r.calls.slice(-3).map(c=>c.action),['accept','review','roster']);
 await r.controller.prepare();assert.equal(r.controller.snapshot().prepared.agent_session,'agent-session/native');
 assert.equal(r.calls.some(c=>['open','prompt'].includes(c.action)),false);
});
test('scope must be consciously confirmed, and purpose is never silently trimmed',async()=>{
 const r=rig();await r.controller.refresh();r.controller.edit({name:profile.name,purpose:profile.purpose});await r.controller.propose();
 assert.equal(r.calls.length,1);r.controller.edit({scopeConfirmed:true,purpose:' '+profile.purpose});await r.controller.propose();assert.equal(r.calls.length,1);
});
test('double-click creation is fenced while the native response is pending',async()=>{
 let resolve;const r=rig({intercept:q=>q.action==='propose'?new Promise(r=>resolve=r):undefined});
 await r.controller.refresh();r.controller.edit({name:profile.name,purpose:profile.purpose,scopeConfirmed:true});
 const first=r.controller.propose();await r.controller.propose();r.controller.edit({name:'replaced'});
 assert.equal(r.calls.filter(c=>c.action==='propose').length,1);resolve(review());await first;assert.equal(r.controller.snapshot().draft.name,profile.name);
});
test('lost acceptance response is reconciled by read, never another acceptance',async()=>{
 const r=rig({loseAcceptance:true});await propose(r);await r.controller.accept();assert.equal(r.controller.snapshot().unknown,'accept');
 await r.controller.accept();assert.equal(r.calls.filter(c=>c.action==='accept').length,1);
 await r.controller.recover();assert.equal(r.controller.snapshot().review.accepted,true);assert.equal(r.controller.snapshot().unknown,undefined);
});
test('lost prepare acknowledgement recovers the same native session by original correlation',async()=>{
 const r=rig({losePrepare:true});await propose(r);await r.controller.accept();await r.controller.prepare();
 assert.equal(r.controller.snapshot().unknown,'prepare');await r.controller.prepare();assert.equal(r.calls.filter(c=>c.action==='prepare').length,1);
 await r.controller.recover();assert.equal(r.calls.at(-1).action,'find');assert.equal(r.calls.at(-1).request_id,'controlled-12345678');assert.equal(r.controller.snapshot().prepared.space,'session-space/native');
});
test('unconfirmed proposal stays held; refreshing never repeats generation',async()=>{
 const r=rig({intercept:q=>{if(q.action==='propose')throw Error('disconnected');}});await propose(r);
 assert.equal(r.controller.snapshot().unknown,'propose');await r.controller.propose();await r.controller.recover();
 assert.equal(r.calls.filter(c=>c.action==='propose').length,1);assert.equal(r.controller.snapshot().draft.purpose,profile.purpose);
});
test('write acknowledgement without native accepted roster is not completed creation',async()=>{
 const r=rig({intercept:q=>q.action==='roster'?{schema:'central.agent-profile-roster/v1',scope_ref:scope,profiles:[],execution_authority_granted:false}:undefined});
 await propose(r);await r.controller.accept();assert.equal(r.controller.snapshot().unknown,'accept');assert.equal(r.controller.snapshot().prepared,undefined);
});
test('foreign source, scope, revision, forged acceptance and grant claims are refused',()=>{
 for(const patch of [{scope_ref:'other'},{execution_authority_granted:true},{accepted:'yes'},{content_digest:null},{acceptance:{...review(true).acceptance,agent_ref:'agent:wrong'}}]){
  assert.throws(()=>validateReview({...review(true),...patch},scope));
 }
 for(const patch of [{agent_ref:'agent:wrong'},{profile_ref:'other'},{profile_revision:'r2'},{request_id:'different'},{acceptance_ref:'other'},{prepared:false},{execution_authority_granted:true},{provider_started:true},{space:'fake'},{project_ref:null}]){
  assert.throws(()=>validatePrepared({...prepared(),...patch},review(true),'controlled-12345678'));
 }
});
test('a changed native scope invalidates confirmation and prior selected identity',async()=>{
 const r=rig();await propose(r);r.controller.bind(async()=>({schema:'central.agent-profile-roster/v1',scope_ref:'project:new',profiles:[],execution_authority_granted:false}));
 await r.controller.refresh();assert.equal(r.controller.snapshot().draft.scopeConfirmed,false);assert.equal(r.controller.snapshot().review,undefined);assert.equal(r.controller.snapshot().draft.purpose,profile.purpose);
});
test('malformed native scope cannot enable a write',async()=>{
 const c=new NativeAgentController(async()=>({profiles:[]}));await c.refresh();c.edit({name:'n',purpose:'p',scopeConfirmed:true});await c.propose();assert.equal(c.snapshot().scopeRef,undefined);
});
test('request recovery with no record retains the same id for explicit idempotent continuation',async()=>{
 let attempts=0;const r=rig({intercept:q=>{if(q.action==='prepare'&&attempts++===0)throw Error('lost');if(q.action==='find')return null;}});
 await propose(r);await r.controller.accept();await r.controller.prepare();await r.controller.recover();await r.controller.prepare();
 assert.deepEqual(r.calls.filter(c=>c.action==='prepare').map(c=>c.request_id),['controlled-12345678','controlled-12345678']);
});

test('lost acceptance cannot recover from source alone when the native roster is absent',async()=>{
 const r=rig({loseAcceptance:true});await propose(r);await r.controller.accept();
 const owner=r.owner;r.controller.bind(async q=>q.action==='roster'?{schema:'central.agent-profile-roster/v1',scope_ref:scope,profiles:[],execution_authority_granted:false}:owner(q));
 await r.controller.recover();assert.equal(r.controller.snapshot().unknown,'accept');assert.equal(r.controller.snapshot().review.accepted,false);
});
