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

// --- SkillSet-first repertoire and the save-and-start sequence -------------

const readiness=()=>({schema:'aikit.direct-agent-scope/v1',project_ref:'control:root',world_readiness:{ready:true,world_ref:'control:root'},execution_authority_granted:false,provider_started:false});
const emptySkills=()=>({schema:'aikit.direct-agent-skills/v1',rows:[],activation_performed:false,brokered_child_activation_observed:false});
const oneSkill=()=>({schema:'aikit.direct-agent-skills/v1',rows:[{ref:'skill/one',name:'One',description:'a disclosed skill',eligible:true,reason_code:null}],activation_performed:false,brokered_child_activation_observed:false});
const setList=()=>({sets:[{name:'research-deep',provenance:'registry:central',members:3,projected:2,withheld:1,summary:'deep research repertoire'}]});
const setDetail=()=>({name:'research-deep',provenance:'registry:central',members:3,projected:['skill/a','skill/b'],withheld:[{capability:'skill/c',reason:'not installed on this machine'}],children:[{name:'core',ref:'research-core',members:2,attached_by:'set add --child'}]});

test('SkillSet-first round-trip: a non-default set is selected, resolved and carried into the native proposal beside an individual exception',async()=>{
 const r=rig({intercept:async q=>{
  if(q.action==='skillsets')return setList();
  if(q.action==='skillset')return setDetail();
  if(q.action==='skills')return oneSkill();
  if(q.action==='scope')return readiness();
  if(q.action==='propose')return {schema:'central.agent-profile-review/v1',profile:{...profile,skill_refs:q.skill_refs,skill_set_refs:q.skill_set_refs},scope_ref:scope,content_digest:'sha256:controlled',accepted:false,execution_authority_granted:false,acceptance:null};
  return undefined;
 }});
 await r.controller.refresh();
 await r.controller.refreshReadiness();
 assert.equal(r.controller.snapshot().skillSets.length,1,'the SkillSet field is read');
 await r.controller.toggleSkillSet('research-deep',true);
 assert.deepEqual(r.controller.snapshot().draft.skillSetRefs,['research-deep']);
 assert.equal(r.controller.snapshot().skillSetDetail.name,'research-deep');
 assert.equal(r.controller.snapshot().skillSetDetail.withheld[0].capability,'skill/c','the withheld member and its reason are read back');
 assert.equal(r.controller.snapshot().skillSetDetail.children[0].ref,'research-core','nested membership is shown');
 r.controller.edit({name:profile.name,purpose:profile.purpose,skillRefs:['skill/one'],scopeConfirmed:true});
 await r.controller.propose();
 const sent=r.calls.find(c=>c.action==='propose');
 assert.deepEqual(sent.skill_set_refs,['research-deep'],'the set ref reaches the native proposal');
 assert.deepEqual(sent.skill_refs,['skill/one'],'the individual exception rides beside the set');
 assert.equal(r.controller.snapshot().review.accepted,false);
 // Unselecting keeps the draft honest and drops the detail reading.
 await r.controller.toggleSkillSet('research-deep',false);
 assert.deepEqual(r.controller.snapshot().draft.skillSetRefs,[]);
 assert.equal(r.controller.snapshot().skillSetDetail,undefined);
});

test('a save-then-failed-launch leaves the source saved and reports Saved; not running with the failing stage',async()=>{
 const r=rig({losePrepare:true,intercept:async q=>{
  if(q.action==='scope')return readiness();
  if(q.action==='skills')return emptySkills();
  if(q.action==='skillsets')return {sets:[]};
  return undefined;
 }});
 await propose(r);
 await r.controller.saveAndStart();
 const s=r.controller.snapshot();
 assert.equal(s.review.accepted,true,'the accepted source stays saved');
 assert.equal(s.prepared,undefined,'no session is fabricated');
 assert.equal(s.compound.prepare,'failed');
 assert.match(s.error,/Saved; not running/);
 assert.equal(s.unknown,'prepare','the uncertain prepare stays on the recover-without-replay path');
 assert.equal(r.calls.filter(c=>c.action==='prepare').length,1,'the native write is never replayed silently');
});

test('save-and-start composes acceptance, readiness and preparation with every stage preserved',async()=>{
 const r=rig({intercept:async q=>{
  if(q.action==='scope')return readiness();
  if(q.action==='skills')return emptySkills();
  if(q.action==='skillsets')return {sets:[]};
  return undefined;
 }});
 await propose(r);
 await r.controller.saveAndStart();
 const s=r.controller.snapshot();
 assert.deepEqual(s.compound,{propose:'skipped',accept:'ok',readiness:'ok',prepare:'ok'});
 assert.equal(s.prepared.agent_session,'agent-session/native');
 assert.equal(s.prepared.provider_started,false,'preparation still never starts a provider');
 assert.equal(s.unknown,undefined);
 assert.equal(s.error,undefined);
});

test('an unavailable world stops the sequence after the save and names readiness as the failing stage',async()=>{
 const r=rig({intercept:async q=>{
  if(q.action==='scope')return {schema:'aikit.direct-agent-scope/v1',project_ref:'control:root',world_readiness:{ready:false,reason:'no authored world declaration'},execution_authority_granted:false,provider_started:false};
  if(q.action==='skills')return emptySkills();
  if(q.action==='skillsets')return {sets:[]};
  return undefined;
 }});
 await propose(r);
 await r.controller.saveAndStart();
 const s=r.controller.snapshot();
 assert.equal(s.review.accepted,true,'the save completed before readiness refused');
 assert.deepEqual(s.compound,{propose:'skipped',accept:'ok',readiness:'failed',prepare:'pending'});
 assert.match(s.error,/Saved; not running/);
 assert.equal(s.unknown,undefined,'readiness absence is a refusal, not an uncertain write');
});
