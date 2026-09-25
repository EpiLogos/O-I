/** Actual native transport and typed client. No grant bypass, provider double,
 * credential resolution, or paid request. Positive issuance is a native-dialog walk. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {kernelOp,eventsSince} from '../src/kernel/bridge.ts';
import {prepareDecision,executeDecision,authoriseDecisionEpisode} from '../src/flow/decisionClient.ts';

test('native decision preflight resolves real source counts and refuses forged permission before egress',{skip:process.env.OI_NATIVE_DECISION!=='1',timeout:90000},async()=>{
 assert.ok(process.env.OI_KERNEL_BIN,'OI_KERNEL_BIN must name the candidate walk-bridge');
 const home=await mkdtemp(join(tmpdir(),'oi-decision-native-'));let child,stderr='';
 try{
  child=spawn(process.env.OI_KERNEL_BIN,['127.0.0.1:0'],{env:{...process.env,OI_HOME:home},stdio:['ignore','pipe','pipe']});
  child.stderr.on('data',chunk=>stderr+=chunk);
  const url=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error(`Native startup timed out: ${stderr}`)),30000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(Error(`Native bridge exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{text+=chunk;const match=/listening on (http:\/\/[^ ]+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const transport={kind:'bridge',url};
  const read=await kernelOp(transport,{op:'decision_read'});
  assert.equal(read.outcome?.result,'decision_reading',read.error);assert.deepEqual(read.outcome.reading.episodes,[]);
  assert.equal(read.outcome.reading.sites.filter(site=>site.plane==='domain').length,2);
  const observer='view:decision-native';const secret='NEVER SEND THIS PRIVATE DRAFT OR URL';
  assert.equal((await kernelOp(transport,{op:'presentation_observe',window_id:observer,visuals:{enabled:true,glyph:secret},arrangement:{mode:'base',workspace_ids:[secret],surfaces:[{id:secret,ref:secret}],root:{type:'group',tabs:[secret]},draft:secret}})).outcome?.result,'presentation_reading');
  const proposal={project:null,observer_id:observer,sites:['receiving.review-priority','workspace.recovery-suggestion'],credential_ref:'keychain://native-decision-test/never-resolved',limits:{timeout_ms:1000,max_attempts:1,max_total_reserved_microusd:1000,tariff:{model_version:'jev-1.13.0',source:'Native boundary regression; never used for provider egress',max_input_tokens_per_attempt:1000,max_output_tokens_per_attempt:100,input_microusd_per_million_tokens:42000,output_microusd_per_million_tokens:0}},episode_budget_microusd:1000,episode_seconds:60};
  const preflight=await prepareDecision(transport,proposal);
  assert.equal(preflight.schema,'oi.decision-preflight/v1');assert.equal(preflight.basis.scope_ref,'control:root');assert.equal(Object.keys(preflight.questions).length,2);
  assert.equal(preflight.basis.inputs.presentation.surface_count,1);assert.ok(Number.isInteger(preflight.basis.inputs.receiving.count));
  assert.ok(!JSON.stringify(preflight.basis.inputs).includes(secret),'kernel re-curates advisory renderer strings before any provider input');
  await assert.rejects(authoriseDecisionEpisode(transport,preflight),/native confirmation/);
  await assert.rejects(executeDecision(transport,preflight,{authority_ref:'forged'}),/No host-issued/);
  const raw=await fetch(`${url}/op`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'decision_episode_authorise',preflight_ref:preflight.preflight_ref,confirmed:true})});
  assert.ok(!raw.ok||!(await raw.json()).ok,'HTTP JSON cannot manufacture native approval');
  const invalid=structuredClone(proposal);invalid.limits.tariff.model_version='jev-latest';await assert.rejects(prepareDecision(transport,invalid),/concrete|alias/i);
  const agent=await kernelOp(transport,{op:'invoke_action',invocation:{action:'action:decision.preflight',target_ref:observer,input:{...proposal,sites:['agent.ui'],agent_questions:{'layout-empty':{type:'noul',instructions:'Does this disclosed layout contain no surfaces?'}}}}});
  assert.equal(agent.outcome?.result,'action_dispatched',agent.error);assert.equal(agent.outcome.dispatch.state,'invoked');assert.equal(Object.keys(agent.outcome.dispatch.data.questions).length,1);
  const denied=await kernelOp(transport,{op:'invoke_action',invocation:{action:'action:decision.decide',target_ref:agent.outcome.dispatch.data.preflight_ref,input:{authority_ref:'forged-agent-grant'}}});assert.match(denied.error,/No host-issued/);
  const final=await kernelOp(transport,{op:'decision_read'});assert.deepEqual(final.outcome.reading.episodes,[]);assert.deepEqual(final.outcome.reading.receipts,[]);
  const events=await eventsSince(transport,0);assert.ok(!events.some(event=>event.event==='decision_recorded'||event.event==='decision_episode_changed'),'inert preflight and refusals emit no completed decision or granted episode');
 }finally{if(child&&child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}await rm(home,{recursive:true,force:true});}
});
