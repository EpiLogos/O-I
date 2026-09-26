import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeAgentController,validatePartialPreparation} from '../src/agency/nativeAgent.ts';
import {readAgentScope,readAgentSkills} from '../src/agency/nativeAgentReadiness.ts';
const scope={schema:'aikit.direct-agent-scope/v1',project_ref:'control:root',world_readiness:{ready:true,world_ref:'control:root'},execution_authority_granted:false,provider_started:false};
const row={ref:'skill/test/a',name:'Native A',description:'Native description',revision:'r1',source:null,eligible:true,reason_code:null};
const skills={schema:'aikit.direct-agent-skills/v1',rows:[row],activation_performed:false,brokered_child_activation_observed:false};
test('only native eligible Skill facts become selections; duplicate and activation claims are refused',()=>{
 assert.deepEqual(readAgentSkills(skills),[row]);
 for(const patch of [{rows:[row,row]},{activation_performed:true},{brokered_child_activation_observed:true},{rows:[{...row,eligible:'yes'}]}])assert.throws(()=>readAgentSkills({...skills,...patch}));
});
test('World absence, missing owner or a launch claim cannot be a ready native scope',()=>{
 assert.equal(readAgentScope({...scope,world_readiness:{ready:false,reason:'explicit source missing'}}).world_readiness.ready,false);
 for(const patch of [{world_readiness:{ready:true}},{provider_started:true},{execution_authority_granted:true},{project_ref:''}])assert.throws(()=>readAgentScope({...scope,...patch}));
});
test('discovery is independent, read only, and failure invalidates previously available Skills',async()=>{
 let fail=false;const calls=[];const c=new NativeAgentController(async q=>{calls.push(q.action);if(q.action==='scope')return scope;if(q.action==='skillsets')return {sets:[]};if(fail)throw Error('owner unavailable');return skills;});
 await c.refreshReadiness();assert.equal(c.snapshot().skills[0].eligible,true);
 fail=true;await c.refreshReadiness();assert.equal(c.snapshot().skills,undefined);assert.equal(c.snapshot().world.project_ref,'control:root');assert.match(c.snapshot().readinessError,/unavailable/);assert.deepEqual(calls,['scope','skills','skillsets','scope','skills','skillsets']);
});
test('late prerequisite reads cannot overwrite a newer scope read',async()=>{
 let release;const c=new NativeAgentController(async q=>q.action==='scope'?new Promise(r=>release=r):skills);
 const old=c.refreshReadiness();c.bind(async q=>q.action==='scope'?{...scope,project_ref:'project:new'}:skills);
 await c.refreshReadiness();release(scope);await old;assert.equal(c.snapshot().world.project_ref,'project:new');
});
test('partial native preparation can only continue the exact accepted basis without becoming ready',()=>{
 const review={accepted:true,profile:{ref:'p',revision:'r',agent_ref:'a'},acceptance:{acceptance_ref:'accept'}};
 const partial={schema:'aikit.direct-agent-session/v1',request_id:'id',profile_ref:'p',profile_revision:'r',agent_ref:'a',acceptance_ref:'accept',space:'session-space/native',agent_session:'agent-session/native',project_ref:'control:root',prepared:false,resume_preparation_allowed:true,provider_started:false,execution_authority_granted:false,brokered_child_context:'not established'};
 assert.doesNotThrow(()=>validatePartialPreparation(partial,review,'id'));
 for(const patch of [{prepared:true},{request_id:'other'},{agent_ref:'other'},{resume_preparation_allowed:false},{provider_started:true}])assert.throws(()=>validatePartialPreparation({...partial,...patch},review,'id'));
});
test('unknown Skill selection is refused before native proposal generation',async()=>{
 const calls=[];const c=new NativeAgentController(async q=>{calls.push(q.action);return {schema:'central.agent-profile-roster/v1',scope_ref:'control:root',profiles:[],execution_authority_granted:false};});
 await c.refresh();c.edit({name:'Reader',purpose:'Read sources',scopeConfirmed:true,skillRefs:['skill/unknown/a']});await c.propose();assert.deepEqual(calls,['roster']);assert.match(c.snapshot().error,/not currently eligible/);
});
