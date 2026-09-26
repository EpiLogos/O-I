import test from 'node:test';
import assert from 'node:assert/strict';
import {teamProposalBuild,teamResolveBuild,teamOutcomeRows,isWellFormedTeamRef,AGENT_SET_PROPOSE,AGENT_SET_RESOLVE} from '../src/agency/teamFormation.ts';

test('team proposal builds the owner-typed central.agent-set.propose input at the requested register',()=>{
 const build=teamProposalBuild({draft:{intentExpression:'cover the night shift'},project:'garden',ref:'night-crew',revision:'r2',memberRefs:['agent/gardener','agent/picker'],orchestrator:'agent/gardener'});
 assert.equal(build.action,AGENT_SET_PROPOSE);
 assert.equal(build.target_ref,'night-crew');
 assert.deepEqual(build.input,{scope:'project',project:'garden',ref:'night-crew',revision:'r2',
  members:[{kind:'agent',agent_ref:'agent/gardener'},{kind:'agent',agent_ref:'agent/picker'}],
  orchestrator_agent_ref:'agent/gardener',reason:'cover the night shift'});
 const root=teamProposalBuild({draft:{intentExpression:'  '},ref:'root-crew',revision:'r1',memberRefs:['agent/hermes']});
 assert.deepEqual(root.input,{scope:'root',ref:'root-crew',revision:'r1',members:[{kind:'agent',agent_ref:'agent/hermes'}]},'no project, no orchestrator, no empty reason');
});

test('resolve build partitions authored membership against the roster availability',()=>{
 const build=teamResolveBuild({ref:'night-crew',availableAgents:['agent/gardener']});
 assert.equal(build.action,AGENT_SET_RESOLVE);
 assert.deepEqual(build.input,{scope:'root',ref:'night-crew',available_agents:['agent/gardener']});
});

test('team refs must be one plain lowercase name',()=>{
 for(const ref of ['night-crew','crew2','a'])assert.ok(isWellFormedTeamRef(ref),ref);
 for(const ref of ['','Night-Crew','crew:1','a/b','-crew'])assert.equal(isWellFormedTeamRef(ref),false,ref);
});

test('outcomes carry the owner standing verbatim: a proposal is generated and unrecognised, never an Agent',()=>{
 const rows=teamOutcomeRows({state:'invoked',owner_operation:AGENT_SET_PROPOSE,data:{authorship:'generated-proposal',recognition:'unrecognised',human_recognised:false,receipt:{created:true,source_path:'ProjectCentral/agents/agent-sets/night-crew.md'}}});
 assert.deepEqual(rows.map(r=>r.kind),['ok','refused']);
 assert.match(rows[1].text,/human recognition has NOT been given/);
 assert.match(rows[0].text,/night-crew/);
});

test('resolve, refusal, unavailability and unsupported dispatches keep their own words',()=>{
 const resolved=teamOutcomeRows({state:'invoked',owner_operation:AGENT_SET_RESOLVE,data:{authored_agents:['a','b','c'],resolved_agents:['a','b'],unavailable_agents:['c']}});
 assert.match(resolved[0].text,/2 of 3/);
 assert.match(resolved[1].text,/agent\/c|c/);
 assert.match(teamOutcomeRows({state:'owner_refused',owner_operation:'central.agent-set.propose',message:'duplicate agent-set ref'})[0].text,/duplicate agent-set ref/);
 assert.equal(teamOutcomeRows({state:'owner_unavailable',owner_operation:'central.agent-set.propose',detail:'ctrl not found'})[0].kind,'unavailable');
 assert.equal(teamOutcomeRows({state:'unsupported_action',owner:'central',detail:'no such operation'})[0].kind,'unsupported');
 assert.match(teamOutcomeRows({state:'unknown_owner',action:'central.nonsense'})[0].text,/central\.nonsense/);
});
