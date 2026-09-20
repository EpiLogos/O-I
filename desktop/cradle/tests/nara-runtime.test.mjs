import test from 'node:test';import assert from 'node:assert/strict';
import {NaraRuntime} from '../src/nara/runtime.ts';
import {NaraPresentation,selectedContext} from '../src/nara/presentation.ts';
import {ResponseFold,dialoguePacket,validateAttachment,nativeTurn} from '../src/nara/nativeDialogue.ts';
import {delegationLedger,putDelegationLedger} from '../src/nara/delegationLedger.ts';
import {NaraSpeechBinding} from '../src/nara/session.ts';
import {applyGate,buildEpiiDelegation} from '../src/nara/dialogueContext.ts';
import {attachment,controlledOwner,controlledAudio,deferred,expression,fixture} from './nara-runtime-fixtures.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const runtime=(options={})=>{const a=attachment(),owner=controlledOwner(),audio=controlledAudio();return {a,owner,audio,r:new NaraRuntime(a,{call:owner.call,audio,pollMs:1,timeoutMs:500,...options})};};

test('attachment and mode entry never open microphone or native session',()=>{const {r,owner,audio}=runtime();assert.equal(r.getSnapshot().voice_enabled,false);assert.deepEqual(owner.requests,[]);assert.deepEqual(audio.events,[]);});
test('explicit consent is required before microphone; no native side effects on refusal',async()=>{const {r,owner,audio}=runtime();await assert.rejects(r.startCapture(),/Enable/);assert.equal(owner.requests.length,0);assert.equal(audio.events.length,0);});
test('real native readiness is checked before capture, not inferred from any connected state',async()=>{const {r,owner,audio}=runtime();owner.state='TurnInFlight';r.enableVoice();await r.startCapture();assert.equal(r.getSnapshot().phase,'error');assert.deepEqual(audio.events,[]);assert.equal(owner.sendCount,0);});
test('provider mismatch refuses before microphone or message',async()=>{const {r,owner,audio}=runtime();owner.provider='other';r.enableVoice();await r.startCapture();assert.equal(r.getSnapshot().phase,'error');assert.deepEqual(audio.events,[]);});
test('late microphone permission grant after stop is cancelled and cannot send',async()=>{const {r,audio,owner}=runtime();r.enableVoice();audio.captureWait=deferred();const start=r.startCapture();await tick();assert.equal(r.getSnapshot().phase,'requesting-microphone');await r.interrupt();audio.captureWait.resolve();await start;assert.equal(audio.cancelled,1);assert.equal(owner.sendCount,0);assert.equal(r.getSnapshot().phase,'interrupted');});
test('microphone release before native preflight resolves never opens input',async()=>{const gate=deferred(),owner=controlledOwner(),audio=controlledAudio();const r=new NaraRuntime(attachment(),{audio,call:async(...args)=>{await gate.promise;return owner.call(...args);}});r.enableVoice();const start=r.startCapture();await r.finishCapture();gate.resolve();await start;assert.deepEqual(audio.events,[]);assert.equal(owner.sendCount,0);});
test('capture, transcript, addressed delivery and playback use real returned text; human draft untouched',async()=>{const {r,audio,owner,a}=runtime();r.enableVoice();await r.startCapture();assert.equal(r.getSnapshot().phase,'listening');await r.finishCapture();assert.deepEqual(audio.events,['capture','transcribe','synthesize','play']);assert.equal(r.getSnapshot().phase,'idle');assert.equal(owner.sendCount,1);const turn=owner.requests.find(x=>x.action==='send').turn;assert.equal(turn.expected_binding_revision,a.dialogue.expected_binding_revision);assert.equal(JSON.parse(turn.packet.text).request,'A spoken question');assert.equal(JSON.parse(turn.packet.text).context.pointed_ref,a.context.pointed_ref);assert.ok(!owner.requests.some(x=>['start','open','draft','prompt'].includes(x.action)));assert.ok(!JSON.stringify(r.getSnapshot()).includes('PRIVATE THOUGHT'));assert.equal(r.getSnapshot().rows.at(-1).text,owner.answer);});
test('speaking begins only on actual playback notification, never on request submission',async()=>{const {r,audio}=runtime();r.enableVoice();audio.playWait=deferred();const send=r.sendText('Hello');await tick();assert.equal(r.getSnapshot().phase,'preparing-audio');audio.playing();assert.equal(r.getSnapshot().phase,'speaking');audio.playWait.resolve();await send;assert.equal(r.getSnapshot().phase,'idle');});
test('interruption during synthesis stops output and holds pending choreography together',async()=>{let holds=0;const {r,audio}=runtime({hold:async()=>{holds++;}});r.enableVoice();audio.synthesisWait=deferred();const send=r.sendText('Hello');await tick();await r.interrupt();audio.synthesisWait.resolve();await send;assert.equal(holds,1);assert.ok(audio.stopped>0);assert.ok(!audio.events.includes('play'));assert.equal(r.getSnapshot().phase,'interrupted');assert.equal(r.getSnapshot().rows.at(-1).complete,true);});
test('lost native acknowledgement recovers exact delivery without resend or automatic speech',async()=>{const {r,owner,audio}=runtime();owner.failSend=true;r.enableVoice();await r.sendText('Hello');assert.equal(r.getSnapshot().phase,'error');const id=r.getSnapshot().pending.delivery_ref;await r.recover();assert.equal(owner.sendCount,1);assert.equal(r.getSnapshot().rows.at(-1).delivery_ref,id);assert.deepEqual(audio.events,[]);assert.equal(r.getSnapshot().pending,null);});
test('interrupted response is quarantined until explicit recovery and does not auto-apply',async()=>{const {r,owner,audio}=runtime();owner.delay=deferred();const send=r.sendText('Hello');await tick();await r.interrupt();owner.delay.resolve();await send;assert.ok(r.getSnapshot().pending);assert.ok(!r.getSnapshot().rows.some(row=>row.role==='nara'));await r.recover();assert.equal(owner.sendCount,1);assert.equal(r.getSnapshot().rows.at(-1).text,owner.answer);assert.ok(!owner.requests.some(x=>x.action==='cancel'));assert.deepEqual(audio.events,[]);});
test('reconnect keeps canonical Nara/AgentSession and transcript distinct from native provider identity',async()=>{const {r,owner}=runtime();await r.sendText('Hello');const before=r.binding;owner.state='Disconnected';await r.reconnect();assert.equal(r.binding.context.nara_ref,before.context.nara_ref);assert.equal(r.binding.dialogue.agent_session,before.dialogue.agent_session);assert.equal(r.getSnapshot().rows.length,2);assert.deepEqual(owner.requests.find(x=>x.action==='reconnect'),{action:'reconnect',space:before.dialogue.space,agent_session:before.dialogue.agent_session,provider:before.dialogue.provider});const foreign=structuredClone(before);foreign.context.agent_session_ref=foreign.constitution.agent_session_ref=foreign.dialogue.agent_session='agent-session/other';await assert.rejects(r.reconnect(foreign),/cannot change/);});
test('body replacement revokes consent without reminting personal identity',async()=>{const {r}=runtime();r.enableVoice();const next=r.binding;next.speech.tts.model='another-selected-model';await r.reconnect(next);assert.equal(r.binding.dialogue.agent_session,next.dialogue.agent_session);assert.equal(r.getSnapshot().voice_enabled,false);});
test('draft and response remain through presentation resubscription; other Nara is isolated',async()=>{const {r}=runtime(),other=runtime().r;let changes=0;let stop=r.subscribe(()=>changes++);r.setDraft('Personal draft');stop();await r.sendText();stop=r.subscribe(()=>changes++);assert.equal(r.getSnapshot().rows.length,2);assert.equal(other.getSnapshot().rows.length,0);assert.equal(other.getSnapshot().draft,'');stop();assert.ok(changes>0);});
test('ending refuses to forget an unresolved native delivery',async()=>{const {r,owner}=runtime();owner.failSend=true;await r.sendText('Hello');await assert.rejects(r.end(),/Recover/);assert.ok(r.getSnapshot().pending);await r.recover();await r.end();assert.equal(r.getSnapshot().rows.length,0);assert.equal(r.getSnapshot().voice_enabled,false);});
test('selected relation and revision are exact and source body is never fetched by disclosure',()=>{const a=attachment(),d=expression(a.context);const selected={subject_ref:'relation/exact',kind:'relation',native_owner:'central',revision:'r8',origin:'graph',expression_ref:d.expression_ref};const c=selectedContext(a.context,d,selected);assert.equal(c.pointed_ref,selected.subject_ref);assert.equal(c.disclosed.at(-1).revision,'r8');assert.equal(c.disclosed.at(-1).standing,'observed');const p=dialoguePacket('Explain this relation',c);assert.ok(p.source_refs.includes('relation/exact'));assert.equal(JSON.parse(p.text).context.pointed_ref,'relation/exact');assert.throws(()=>selectedContext(a.context,d,{...selected,expression_ref:'other'}),/No exact/);});
test('unknown/credential-bearing/remote speech endpoints do not become universal provider transport',()=>{for(const endpoint of ['https://other.example/inference','file:///x','http://u:p@localhost/x','http://localhost/x?key=secret']){const a=attachment();a.speech.stt.endpoint=endpoint;assert.throws(()=>validateAttachment(a));}const a=attachment();a.epii.agent_session=a.dialogue.agent_session;assert.throws(()=>validateAttachment(a),/distinct/);});
test('journal fold admits only exact delivery-attributed response chunks',()=>{const f=new ResponseFold(10,'delivery/a');const e=(cursor,delivery,kind,text)=>({cursor,event:{kind:'provider',delivery_ref:delivery,event:{Signal:{kind:{kind,text}}}}});f.accept({agent_session:'agent-session/a',events:[e(11,'delivery/b','agent-message-chunk','foreign'),e(12,'delivery/a','agent-thought-chunk','private'),e(13,'delivery/a','agent-message-chunk','answer')],more:false,next_cursor:13},'agent-session/a');assert.equal(f.text,'answer');assert.throws(()=>f.accept({agent_session:'other',events:[]},'agent-session/a'),/another/);assert.throws(()=>f.accept({agent_session:'agent-session/a',events:[e(12,'delivery/a','agent-message-chunk','replay')]},'agent-session/a'),/Non-monotonic/);});
test('forged delivery identity is refused instead of speaking another participant result',async()=>{const a=attachment(),owner=controlledOwner();const call=async(b,r)=>{const value=await owner.call(b,r);if(r.action==='send')value.delivery.agent_session='agent-session/foreign';return value;};await assert.rejects(nativeTurn({call,binding:a.dialogue,audience:a.constitution.agent_ref,text:'Hello',source_refs:[],signal:new AbortController().signal,delivery_ref:'delivery/our',timeoutMs:50}),/another participant/);});
test('global legacy ledger cannot expose or publish personal dialogue',()=>{assert.deepEqual(delegationLedger(),[]);assert.throws(()=>putDelegationLedger({delegation:{brief:'private'},enrichment:null}),/forbidden/);assert.deepEqual(delegationLedger(),[]);});

test('real Epii return is scoped, received without mutation and rejects without native effects',async()=>{const {r,owner,a}=runtime();owner.answer=turn=>{const {delegation:d}=JSON.parse(turn.packet.text),e=fixture('nara-epii-delegation-v1.json').enrichment;return JSON.stringify({...e,delegation_ref:d.delegation_ref,basis_context_ref:d.basis.context_ref,basis_expression_revision:d.basis.expression_revision,proposed_focus_refs:[a.context.pointed_ref]});};await r.inquire('Explain the selected relation',[a.context.pointed_ref]);const row=r.getSnapshot().inquiries[0];assert.ok(row.enrichment);const request=owner.requests.find(x=>x.action==='send');assert.equal(request.agent_session,a.epii.agent_session);assert.deepEqual(request.turn.packet.source_refs,[a.context.pointed_ref]);assert.ok(!request.turn.packet.text.includes('rows'));const effects=owner.requests.length;r.rejectInquiry(row.delegation.delegation_ref);assert.equal(owner.requests.length,effects);assert.throws(()=>r.reviewInquiry(row.delegation.delegation_ref),/No pending/);});
test('plain Epii explanation is retained honestly without fabricated proposal or evidence',async()=>{const {r,a}=runtime();await r.inquire('Explain',[a.context.pointed_ref]);const row=r.getSnapshot().inquiries[0];assert.ok(row.explanation);assert.equal(row.enrichment,null);assert.match(row.error,/no valid basis-bound/);});
test('same Expression revision but changed context cannot accept stale Epii enrichment',()=>{const f=fixture('nara-epii-delegation-v1.json');const d=buildEpiiDelegation({delegation_ref:f.delegation.delegation_ref,context:f.context,epii_session_ref:f.delegation.epii_session_ref,brief:'Question',scope_candidates:f.delegation.scope_candidates_admitted,delegated_at_unix_ms:1});assert.throws(()=>applyGate(d,f.enrichment,{...f.context,context_ref:'context/new'}),/stale dialogue context/);assert.throws(()=>applyGate({...d,state:{state:'withdrawn',reason:'no'}},f.enrichment,f.context),/withdrawn/);assert.throws(()=>applyGate(d,{...f.enrichment,basis_context_ref:'foreign'},f.context),/original delegation/);});

function speechBinding(){const a=attachment();a.constitution.interaction['tool-requests']={state:'supported'};a.constitution.interruption={state:'supported'};return {a,b:NaraSpeechBinding.constitute({constitution:a.constitution,dialogue_context:a.context,allowed_action_refs:['action:expression.focus'],denied_action_refs:[]})};}
const tool=(a)=>({schema:'actuation.speech-tool-decision/v1',request_ref:'request/test',constitution_ref:a.constitution.constitution_ref,agent_session_ref:a.context.agent_session_ref,proposed_action_ref:'action:expression.focus',payload_refs:['payload/test'],requested_at:'2026-09-20T00:00:00Z'});
const execution={execution_ref:'execution/test',owner_operation:'expression.edit',result:{state:'ready'},evidence_refs:['receipt/test'],executed_at:'2026-09-20T00:00:01Z'};
test('consumer decision cannot authorize a request for another session',()=>{const {a,b}=speechBinding();assert.throws(()=>b.adjudicateToolRequest({decision_ref:'decision/test',request:{...tool(a),agent_session_ref:'agent-session/other'},decided_by:'human/test',at:'2026-09-20T00:00:00Z'}),/another AgentSession/);});
test('mutated or fabricated authority decisions cannot be recorded as execution',()=>{const {a,b}=speechBinding();const d=b.adjudicateToolRequest({decision_ref:'decision/test',request:tool(a),decided_by:'human/test',at:'2026-09-20T00:00:00Z'});d.resolution.action_ref='action/forged';assert.throws(()=>b.recordExecution(d,execution),/unchanged recorded/);const genuine=b.decisionsRecorded[0];b.recordExecution(genuine,execution);assert.throws(()=>b.recordExecution(genuine,execution),/already recorded/);});
test('source and read-model aliases cannot mutate the retained private context or constitution',()=>{const {a,b}=speechBinding();a.context.subject_ref='foreign';const c=b.contextNow;c.subject_ref='other';assert.notEqual(b.contextNow.subject_ref,c.subject_ref);const body=b.constitutionNow;body.agent_ref='another';assert.notEqual(b.agentRef,body.agent_ref);});
test('interruption retains original response identity and invalid receipt input cannot change phase',()=>{const {b}=speechBinding();b.beginResponse('response/test');assert.throws(()=>b.interrupt({interruption_ref:'interrupt/test',reason:'',at:'2026-09-20T00:00:00Z'}));assert.equal(b.phaseNow,'speaking');const r=b.interrupt({interruption_ref:'interrupt/test',reason:'stop',at:'2026-09-20T00:00:00Z'});assert.equal(r.interruption_receipt.response_ref,'response/test');assert.equal(r.session_destroyed,false);});

function presentationOwner(a){
 let doc=expression(a.context);const requests=[],gate=deferred(),checkpoints=new Map();let wait=false;
 const p=new NaraPresentation({read:async()=>structuredClone(doc),world:async r=>{
  requests.push(structuredClone(r));
  if(r.operation==='act_perform'){
   if(wait)await gate.promise;assert.equal(r.expected_revision,doc.revision);
   const selection={scene_ref:r.changes[0].scene_ref,entity_ref:r.changes[0].entity_ref};
   if(JSON.stringify(doc.selection)!==JSON.stringify(selection)){doc.revision++;doc.selection=selection;}
   return {state:'act_running'};
  }
  if(r.operation==='act_interrupt')return {state:'act_held'};
  if(r.operation==='act_checkpoint'){checkpoints.set(r.checkpoint_ref,structuredClone(doc));return {state:'checkpointed',checkpoint:{checkpoint_ref:r.checkpoint_ref,act_ref:r.act_ref,revision:doc.revision}};}
  if(r.operation==='act_restore'){
   const saved=checkpoints.get(r.checkpoint_ref);
   if(JSON.stringify({...saved,revision:0})!==JSON.stringify({...doc,revision:0}))doc={...structuredClone(saved),revision:doc.revision+1};
   return {state:'act_restored',act_ref:r.act_ref,checkpoint_ref:r.checkpoint_ref,expression:{state:'ready',document:structuredClone(doc)}};
  }
  throw new Error('unsupported fixture op');
 }});return {p,requests,gate,wait:()=>{wait=true;},doc:()=>doc};
}
test('reviewed focus executes native act with exact bound entity and revision',async()=>{const a=attachment(),o=presentationOwner(a);const result=await o.p.perform(a.context,[a.context.pointed_ref],new AbortController().signal);assert.equal(o.requests[0].operation,'act_perform');assert.equal(o.requests[0].changes[0].entity_ref,'entity/a');assert.equal(result.expression_revision,'8');assert.equal(o.p.state.state,'held');await o.p.checkpoint();assert.ok(o.p.state.checkpoint_ref);await o.p.restore();assert.equal(o.p.state.revision,8); // native unchanged restore is a no-op
});
test('interrupt while atomic focus is pending lets only that step finish and cancels later refs',async()=>{const a=attachment(),o=presentationOwner(a);o.wait();const signal=new AbortController();const run=o.p.perform(a.context,[a.context.pointed_ref,a.context.pinned_refs[0]],signal.signal);await tick();signal.abort();const hold=o.p.hold();o.gate.resolve();await Promise.all([run,hold]);assert.equal(o.requests.filter(x=>x.operation==='act_perform').length,1);assert.deepEqual(o.p.state.completed_refs,[a.context.pointed_ref]);assert.deepEqual(o.p.state.cancelled_refs,[a.context.pinned_refs[0]]);assert.equal(o.p.state.state,'held');});
test('unmapped/escaping focus and stale peer edit cannot be replaced by first entity or rewind',async()=>{const a=attachment(),o=presentationOwner(a);await assert.rejects(o.p.perform(a.context,['foreign'],new AbortController().signal),/outside/);assert.equal(o.requests.length,0);o.doc().revision++;await assert.rejects(o.p.perform(a.context,[a.context.pointed_ref],new AbortController().signal),/changed/);assert.equal(o.requests.length,0);});

test('hold while native focus is being prepared prevents the first mutation',async()=>{const a=attachment(),gate=deferred(),ops=[];const p=new NaraPresentation({read:()=>gate.promise,world:async req=>{ops.push(req);return {state:'act_running'};}});const run=p.perform(a.context,[a.context.pointed_ref],new AbortController().signal);await p.hold();gate.resolve(expression(a.context));await assert.rejects(run,/held during preparation/);assert.deepEqual(ops,[]);});
test('terminal native refusal stays a failure but no longer deadlocks continuation',async()=>{const {r,owner}=runtime();const call=owner.call;owner.call=async(...args)=>call(...args);owner.answer='';await r.sendText('No returned text');assert.equal(r.getSnapshot().phase,'error');assert.equal(r.getSnapshot().pending,null);owner.answer='Next native result';await r.sendText('Continue');assert.equal(r.getSnapshot().phase,'idle');assert.equal(owner.sendCount,2);});

test('body reload preserves the current encounter context instead of restoring old source selection',async()=>{const {r}=runtime();const old=r.binding,next={...r.binding.context,context_ref:'context/later'};r.updateContext(next);old.speech.tts.voice='selected-voice';await r.reconnect(old);assert.equal(r.binding.context.context_ref,'context/later');});

function structuredEpii(owner) {
 owner.answer=turn=>{const {delegation:d}=JSON.parse(turn.packet.text),e=fixture('nara-epii-delegation-v1.json').enrichment;
  return JSON.stringify({...e,enrichment_ref:`enrichment/${d.delegation_ref}`,delegation_ref:d.delegation_ref,basis_context_ref:d.basis.context_ref,basis_expression_revision:d.basis.expression_revision,proposed_focus_refs:[attachment().context.pointed_ref]});};
}
test('reject then delegate again retains two distinct review identities and allows only the second',async()=>{
 const {r,owner,a}=runtime();structuredEpii(owner);const scope=[a.context.pointed_ref,...a.context.disclosed.map(d=>d.ref_id)];
 await r.inquire('First inquiry',scope);const first=r.getSnapshot().inquiries[0];r.rejectInquiry(first.delegation.delegation_ref);
 await r.inquire('Second inquiry',scope);const second=r.getSnapshot().inquiries[1];
 assert.notEqual(first.delivery_ref,second.delivery_ref);assert.ok(second.enrichment);assert.equal(second.decision,'pending');
 assert.throws(()=>r.reviewInquiry(first.delegation.delegation_ref),/No pending/);
 assert.equal(r.reviewInquiry(second.delegation.delegation_ref).enrichment.delegation_ref,second.delegation.delegation_ref);
});
test('a changed source revision at the same context address invalidates Epii acceptance',async()=>{
 const {r,owner,a}=runtime();structuredEpii(owner);await r.inquire('Source basis',[a.context.pointed_ref,...a.context.disclosed.map(d=>d.ref_id)]);
 const row=r.getSnapshot().inquiries[0],next=r.binding.context;next.disclosed[0].revision='changed-source';r.updateContext(next);
 assert.throws(()=>r.reviewInquiry(row.delegation.delegation_ref),/source or occasion changed/);
 assert.equal(row.enrichment.basis_context_ref,r.binding.context.context_ref);
});
test('an acceptance reservation blocks duplicate application and rejection while preserving truthful partial result',async()=>{
 const {r,owner,a}=runtime();structuredEpii(owner);await r.inquire('Focus',[a.context.pointed_ref,...a.context.disclosed.map(d=>d.ref_id)]);
 const ref=r.getSnapshot().inquiries[0].delegation.delegation_ref;r.beginInquiryAcceptance(ref);
 assert.throws(()=>r.rejectInquiry(ref),/No pending/);assert.throws(()=>r.beginInquiryAcceptance(ref),/No pending/);
 await assert.rejects(r.sendText('Concurrent send'),/Finish or recover/);
 r.finishInquiryAcceptance(ref,'partial');assert.equal(r.getSnapshot().inquiries[0].decision,'partial');
 assert.throws(()=>r.rejectInquiry(ref),/No pending/);
});
test('a refused preflight may return to review but uncertain effects never turn back into a pending proposal',async()=>{
 const {r,owner,a}=runtime();structuredEpii(owner);await r.inquire('Focus',[a.context.pointed_ref,...a.context.disclosed.map(d=>d.ref_id)]);
 const ref=r.getSnapshot().inquiries[0].delegation.delegation_ref;r.beginInquiryAcceptance(ref);r.finishInquiryAcceptance(ref,'pending');
 r.beginInquiryAcceptance(ref);r.finishInquiryAcceptance(ref,'uncertain');assert.throws(()=>r.beginInquiryAcceptance(ref),/No pending/);
 assert.equal(r.getSnapshot().inquiries[0].decision,'uncertain');
});


test('same focused subject is a native no-op, not a fabricated revision or failure',async()=>{
 const a=attachment(),o=presentationOwner(a);const first=await o.p.perform(a.context,[a.context.pointed_ref],new AbortController().signal);
 const second=await o.p.perform(first,[a.context.pointed_ref],new AbortController().signal);
 assert.equal(second.expression_revision,first.expression_revision);assert.equal(o.p.state.attempt,2);assert.deepEqual(o.p.state.completed_refs,[a.context.pointed_ref]);
});
test('native checkpoint restore after another reviewed step restores the original exact subject',async()=>{
 const a=attachment(),o=presentationOwner(a);const first=await o.p.perform(a.context,[a.context.pointed_ref],new AbortController().signal);await o.p.checkpoint();
 await o.p.perform(first,[a.context.pinned_refs[0]],new AbortController().signal);const before=o.doc().revision;const restored=await o.p.restore();
 assert.equal(o.doc().selection.entity_ref,'entity/a');assert.equal(restored.pointed_ref,a.context.pointed_ref);assert.equal(o.doc().revision,before+1);
});
test('a preflight refusal leaves the previous attempt distinct from any new mutation',async()=>{
 const a=attachment(),o=presentationOwner(a);await o.p.perform(a.context,[a.context.pointed_ref],new AbortController().signal);const before=o.p.state;
 await assert.rejects(o.p.perform(a.context,[a.context.pointed_ref],new AbortController().signal),/changed/);assert.deepEqual(o.p.state,before);
});
test('missing checkpoint identity is rejected despite a successful-looking state string',async()=>{
 const a=attachment();let doc=expression(a.context);const p=new NaraPresentation({read:async()=>structuredClone(doc),world:async r=>{
  if(r.operation==='act_perform'){doc.revision++;doc.selection={scene_ref:r.changes[0].scene_ref,entity_ref:r.changes[0].entity_ref};return {state:'act_running'};}
  return {state:r.operation==='act_checkpoint'?'checkpointed':'act_held'};
 }});await p.perform(a.context,[a.context.pointed_ref],new AbortController().signal);await assert.rejects(p.checkpoint(),/did not retain/);assert.equal(p.state.checkpoint_ref,null);
});


test('an applying native proposal reserves context and cannot be forgotten or rebound',async()=>{
 const {r,owner,a}=runtime();structuredEpii(owner);await r.inquire('Focus',[a.context.pointed_ref,...a.context.disclosed.map(d=>d.ref_id)]);
 const ref=r.getSnapshot().inquiries[0].delegation.delegation_ref;r.beginInquiryAcceptance(ref);
 assert.throws(()=>r.updateContext(r.binding.context),/reserved/);await assert.rejects(r.end(),/Settle/);await assert.rejects(r.reconnect(),/Finish or recover/);
 r.updateContext(r.binding.context,ref);r.finishInquiryAcceptance(ref,'partial');assert.equal(r.getSnapshot().inquiries[0].decision,'partial');
});
