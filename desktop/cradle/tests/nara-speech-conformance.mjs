/**
 * #336 conformance: the desktop's constructed wire documents round-trip
 * against the QL fixtures verbatim and match the Actuation receipt shapes.
 *
 * The fixtures under tests/fixtures/nara/ are byte-copies of the QL owner's
 * `fixtures/nara/*.json` (ql-mef #201 thread). Everything asserted here is
 * the owners' own expected blocks — the desktop adds no dialect of its own.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/nara-speech-conformance.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

import {
  constitutionFromAikitResolution,recordConstitutionChange,constitutionDelta,validateSpeechConstitution,
  speechCapable,realtimeCapable,textPathSupport,aikitResolutionRef,
} from "../src/nara/constitution";
import {
  validateDialogueContext,buildDialogueContext,admitRefs,isAdmitted,turnContext,
  buildDeixisRequest,resolveDeixis,contextContinues,
  buildEpiiDelegation,validateEpiiEnrichment,receiveEnrichment,applyGate,
} from "../src/nara/dialogueContext";
import {
  beginExpressiveAct,interruptExpressiveAct,resumeExpressiveAct,restoreExpressiveActCheckpoint,
  planChoreography,takeChoreographyStep,completeChoreographyStep,interruptChoreography,
} from "../src/nara/expressiveAct";
import {NaraSpeechBinding,validateToolRequest} from "../src/nara/session";

const fixturesRoot=fileURLToPath(new URL("./fixtures/nara/",import.meta.url));
const readFixture=name=>JSON.parse(readFileSync(`${fixturesRoot}${name}`,"utf8"));
const dialogueFixture=readFixture("nara-dialogue-context-v1.json");
const deixisFixture=readFixture("nara-deixis-v1.json");
const delegationFixture=readFixture("nara-epii-delegation-v1.json");

test("fixture dialogue context round-trips byte-exactly through the desktop validator",()=>{
  const validated=validateDialogueContext(structuredClone(dialogueFixture));
  assert.deepEqual(validated,dialogueFixture);
});

test("desktop construction from the fixture's own facts reproduces the fixture context",()=>{
  const source=dialogueFixture;
  const built=buildDialogueContext({
    context_ref:source.context_ref,
    nara_ref:source.nara_ref,
    subject_ref:source.subject_ref,
    agent_session_ref:source.agent_session_ref,
    coordinate_ref:source.coordinate_ref,
    m4_branch:source.m4_branch,
    bimba:source.bimba,
    expression_ref:source.expression_ref,
    expression_revision:source.expression_revision,
    profile_ref:source.profile_ref,
    profile_revision:source.profile_revision,
    scene_ref:source.scene_ref,
    active_m_focus:source.active_m_focus,
    pointed_ref:source.pointed_ref,
    hovered_ref:source.hovered_ref,
    pinned_refs:source.pinned_refs,
    occasion:source.occasion,
    disclosed:source.disclosed,
    available_action_refs:source.available_action_refs,
    c_prime:source.c_prime,
    shared_field:source.shared_field,
    expressive_act:source.expressive_act,
  });
  assert.deepEqual(built,source);
});

test("admission law matches the QL fixture's disclosed/selected/structural facts",()=>{
  const context=dialogueFixture;
  assert.equal(isAdmitted(context,"source:fixture-disclosed-1"),true,"disclosed ref is admitted");
  assert.equal(isAdmitted(context,"bimba:relation:1"),true,"pointed ref is admitted");
  assert.equal(isAdmitted(context,"bimba:source:M4.1"),true,"pinned ref is admitted");
  assert.equal(isAdmitted(context,"expression:fixture-1"),true,"structural Expression ref is admitted");
  assert.equal(isAdmitted(context,"profile:M4.1"),true,"structural profile ref is admitted");
  assert.equal(isAdmitted(context,"source:fixture-private"),false,"undisclosed source is not admitted");
  assert.deepEqual(admitRefs(context,["source:fixture-disclosed-1","bimba:relation:1","source:fixture-disclosed-1"]),["source:fixture-disclosed-1","bimba:relation:1"]);
  assert.throws(()=>admitRefs(context,["source:fixture-private"]),/not admitted to Nara context/);
});

test("deixis requests and resolutions match every expected block in the QL fixture",()=>{
  const context=validateDialogueContext(structuredClone(dialogueFixture));
  for(const entry of deixisFixture.requests){
    const request=entry.request;
    if(request.kind==="pointed"&&request.basis_expression_revision!==context.expression_revision){
      assert.throws(()=>resolveDeixis(context,buildDeixisRequest(request)),/deixis request is stale/,"stale basis is refused, not forced");
      continue;
    }
    const resolution=resolveDeixis(context,buildDeixisRequest(request));
    const expected=entry.expected;
    if(expected.outcome==="focused"){
      assert.equal(resolution.outcome.outcome,"focused");
      assert.deepEqual(resolution.outcome.focus.map(focus=>focus.ref_id),expected.focus_refs);
      assert.ok(resolution.outcome.focus.map(focus=>focus.ref_id).includes(expected.turn_refs_contain),"the exact ref entered the bounded turn context");
      assert.ok(resolution.outcome.turn_context.turn_refs.includes(expected.turn_refs_contain),"the exact ref entered the bounded turn context");
      assert.equal(resolution.outcome.turn_context.expression_revision,expected.expression_revision);
    }else{
      assert.equal(resolution.outcome.outcome,"unresolved-outside-context");
      assert.equal(resolution.outcome.ref_id,expected.ref_id);
    }
    assert.equal(resolution.schema,"ql.nara-deixis/v1");
    assert.equal(resolution.nara_ref,context.nara_ref);
  }
});

test("delegation construction refuses undisclosed scope and matches the fixture document",()=>{
  const context=validateDialogueContext(structuredClone(delegationFixture.context));
  const source=delegationFixture.delegation;
  // The fixture's admitted candidate list delegates cleanly.
  const admitted=buildEpiiDelegation({
    delegation_ref:source.delegation_ref,
    context,
    epii_session_ref:source.epii_session_ref,
    brief:source.brief,
    scope_candidates:source.scope_candidates_admitted,
    delegated_at_unix_ms:source.delegated_at_unix_ms,
  });
  assert.deepEqual(admitted.scope_refs,source.scope_candidates_admitted);
  assert.equal(admitted.basis.context_ref,source.basis?.context_ref??context.context_ref);
  assert.equal(admitted.basis.bimba_registry_revision,context.bimba.registry_revision);
  assert.equal(admitted.state.state,"delegated");
  // The undisclosed candidate refuses with the fixture's expected words.
  assert.throws(()=>buildEpiiDelegation({
    delegation_ref:`${source.delegation_ref}:b`,
    context,epii_session_ref:source.epii_session_ref,brief:source.brief,
    scope_candidates:source.scope_candidates_with_undisclosed,
    delegated_at_unix_ms:source.delegated_at_unix_ms,
  }),/not admitted/);
});

test("enrichment reception is retained-not-applied and the apply gate refuses stale and escaping scope",()=>{
  const context=validateDialogueContext(structuredClone(delegationFixture.context));
  const source=delegationFixture.delegation;
  const delegation=buildEpiiDelegation({
    delegation_ref:source.delegation_ref,context,epii_session_ref:source.epii_session_ref,
    brief:source.brief,scope_candidates:source.scope_candidates_admitted,
    delegated_at_unix_ms:source.delegated_at_unix_ms,
  });
  const enrichment=validateEpiiEnrichment(structuredClone(delegationFixture.enrichment));
  const returned=receiveEnrichment(delegation,enrichment);
  assert.equal(returned.state.state,"returned");
  assert.equal(returned.state.enrichment_ref,enrichment.enrichment_ref);
  // Current basis: the gate admits the enrichment as a proposal only.
  applyGate(delegation,enrichment,context);
  // Moved context (the fixture's rev-8 world): the stale refusal fires.
  const moved=validateDialogueContext(structuredClone(delegationFixture.moved_context));
  assert.throws(()=>applyGate(delegation,enrichment,moved),/stale Epii enrichment/);
  // The escaping-scope enrichment refuses against its own expected words.
  assert.throws(()=>applyGate(delegation,validateEpiiEnrichment(structuredClone(delegationFixture.enrichment_escaping_scope)),context),/outside the delegated scope/);
});

test("expressive act interruption releases the voice and refuses stale resume",()=>{
  const act=beginExpressiveAct({expressive_act_ref:"expressive-act:1",basis_expression_revision:"rev-7",speech_turn_ref:"turn:1",checkpoint:{checkpoint_ref:"checkpoint:1",checkpoint_expression_revision:"rev-7"}});
  const interrupted=interruptExpressiveAct(act);
  assert.equal(interrupted.phase,"interrupted");
  assert.equal(interrupted.speech_turn_ref,null,"interruption stops the voice");
  assert.throws(()=>resumeExpressiveAct(interrupted,"rev-8"),/stale ExpressiveAct resume/);
  assert.equal(resumeExpressiveAct(interrupted,"rev-7").phase,"active");
});

test("checkpoint restore is a named return that must match the live revision",()=>{
  const act=beginExpressiveAct({expressive_act_ref:"expressive-act:1",basis_expression_revision:"rev-7",checkpoint:{checkpoint_ref:"checkpoint:1",checkpoint_expression_revision:"rev-7"}});
  assert.throws(()=>restoreExpressiveActCheckpoint(act,"checkpoint:other","rev-7"),/not authored on this ExpressiveAct/);
  assert.throws(()=>restoreExpressiveActCheckpoint(act,"checkpoint:1","rev-8"),/does not match the live Expression/);
  const restored=restoreExpressiveActCheckpoint(act,"checkpoint:1","rev-7");
  assert.equal(restored.phase,"active");
});

test("choreography interrupt holds speech and cancels pending together, finishing only the atomic step",()=>{
  const plan=planChoreography("expressive-act:1",[
    {step_ref:"s1",summary:"atomic focus",atomic_safe:true,reversible:true},
    {step_ref:"s2",summary:"settle presentation",atomic_safe:true,reversible:true},
    {step_ref:"s3",summary:"third movement",atomic_safe:false,reversible:true},
  ]);
  const running=takeChoreographyStep(plan);
  assert.equal(running?.step_ref,"s1");
  completeChoreographyStep(plan);
  takeChoreographyStep(plan);
  const held=interruptChoreography(plan);
  assert.equal(held.disposition,"hold-and-cancel-pending-choreography");
  assert.equal(held.finish?.step_ref,"s2","the running atomic-safe step may finish");
  assert.deepEqual(held.cancelled.map(step=>step.step_ref),["s3"],"queued steps are cancelled stale");
  assert.deepEqual(held.stood.map(step=>step.step_ref),["s1"]);
});

// ---------------------------------------------------------------------------
// Speech constitution from the AIKit resolution (Actuation receipt shapes)
// ---------------------------------------------------------------------------

const realtimeResolution={
  version:"7",
  harness:"harness:conversation",
  agent_session:"agent-session:fixture",
  harness_composition_fingerprint:"fp-1",
  relation:{
    model:{model_ref:"model:realtime"},
    engine:{engine_ref:"engine:realtime"},
    materialisation:{materialisation_ref:"material:cloud"},
    change_application:"live",
    model_surface:{
      contract:"contract:realtime",protocol:"realtime",capabilities:["speech"],
      access:{inference:{state:"available",capabilities:[]},material_control:{state:"unavailable",reason:"cloud"},interior:{state:"unavailable",reason:"opaque"}},
      modality:{
        schema:"aikit.model-modality/v1",
        input_modalities:["speech","text"],output_modalities:["speech","text"],
        transforms:{"speech-to-speech":{available:true},"speech-to-text":{available:true},"text-to-speech":{available:true}},
        interaction:["full-duplex-realtime","vad-turn-detection","barge-in","final-transcripts","partial-transcripts","tool-requests","structured-events"],
        degraded_interaction:{},
        transport:"webrtc",
        connection:{kind:"connected",reconnect:"resumable"},
        credential_scope:"bearer",availability:"available",
        provider:"provider:openai",provider_native_surface:"gpt-realtime",provider_revision:"r1",
        credential:{state:"declared",scope:"bearer"},constraints:{},provenance:["fixture"],
      },
    },
  },
  components:[],contracts:[],surfaces:[],unavailable:[],
};

const identities={
  constitution_ref:"speech-constitution:1",
  agent_ref:"agent:nara",agency_ref:"agency:nara",world_binding_ref:"world:desktop",
  agent_session_ref:"agent-session:1",body_ref:"surface:realtime",
};

test("constitution builds from the AIKit single-model resolution with four-state honesty",()=>{
  const c=constitutionFromAikitResolution(identities,realtimeResolution,"2026-09-17T09:00:00Z");
  assert.equal(c.schema,"actuation.speech-constitution/v1");
  assert.equal(speechCapable(c),true);
  assert.equal(realtimeCapable(c),true);
  assert.equal(c.interaction["vad-turn-detection"].state,"supported");
  assert.equal(c.interaction["barge-in"].state,"supported");
  assert.equal(c.interruption.state,"supported");
  assert.equal(c.interaction["timestamps"].state,"unsupported","proven-absent is unsupported, not unknown");
  assert.equal(c.connection.kind,"connected");
  assert.equal(c.connection.reconnect,"resumable");
  assert.ok(c.provenance.source_refs.includes(aikitResolutionRef("harness:conversation","7")));
  // A text-capable body reports its honest text path.
  assert.equal(textPathSupport(c).state,"supported");
});

test("a text-only body is a valid constitution and the text path is the honest fallback",()=>{
  const textResolution=structuredClone(realtimeResolution);
  const modality=textResolution.relation.model_surface.modality;
  assert.ok(modality);
  modality.input_modalities=["text"];modality.output_modalities=["text"];
  modality.transforms={};modality.interaction=["request-response","final-transcripts"];
  modality.transport="http";modality.connection={kind:"stateless"};
  const c=constitutionFromAikitResolution({...identities,constitution_ref:"speech-constitution:text",body_ref:"surface:text"},textResolution,"2026-09-17T09:00:00Z");
  assert.equal(speechCapable(c),false);
  assert.equal(realtimeCapable(c),false);
  assert.equal(textPathSupport(c).state,"supported");
  assert.equal(c.interruption.state,"unsupported");
  assert.equal(c.interaction["full-duplex-realtime"].state,"unsupported");
});

test("an incomplete declaration answers unknown, and unproven never behaves as a yes",()=>{
  const partial=structuredClone(realtimeResolution);
  partial.composed_modality={input_modalities:["speech"],output_modalities:["speech"],interaction:{"full-duplex-realtime":{available:true}},complete:false,basis:["stage-1"]};
  const c=constitutionFromAikitResolution({...identities,constitution_ref:"speech-constitution:partial",body_ref:"surface:partial"},partial,"2026-09-17T09:00:00Z");
  assert.equal(c.interaction["barge-in"].state,"unknown");
  assert.equal(c.interruption.state,"unknown");
});

test("a resolution declaring a transform its modalities lack is refused, not papered over",()=>{
  const contradiction=structuredClone(realtimeResolution);
  const modality=contradiction.relation.model_surface.modality;
  assert.ok(modality);
  modality.input_modalities=["text"];modality.transforms={"speech-to-text":{available:true}};
  assert.throws(()=>constitutionFromAikitResolution(identities,contradiction,"2026-09-17T09:00:00Z"),/whose acoustic modalities the composed body does not carry/);
});

test("the constitution carries no secret material",()=>{
  // The reduction strips the raw contract wholesale: an api_key on the
  // resolution's credential object cannot travel into the constitution.
  const leaky=structuredClone(realtimeResolution);
  leaky.relation.model_surface.modality.credential={state:"declared",scope:"bearer",api_key:"sk-nothing"};
  const built=constitutionFromAikitResolution(identities,leaky,"2026-09-17T09:00:00Z");
  assert.ok(!JSON.stringify(built).includes("sk-nothing"),"secret material must not travel");
  // A hand-built constitution that carries a value-shaped key is refused.
  const carrying=structuredClone(built);
  carrying.provider_binding.facts.api_key="sk-nothing";
  assert.throws(()=>validateSpeechConstitution(carrying),/forbidden value-shaped key/);
});

const textResolution=(()=>{const clone=structuredClone(realtimeResolution);
  const modality=clone.relation.model_surface.modality;assert.ok(modality);
  modality.input_modalities=["text"];modality.output_modalities=["text"];
  modality.transforms={};modality.interaction=["request-response"];modality.transport="http";modality.connection={kind:"stateless"};
  return clone;})();

test("reconnect records a body change without reminting identity, with an exact delta",()=>{
  const before=constitutionFromAikitResolution({...identities,body_ref:"surface:text"},textResolution,"2026-09-17T09:00:00Z");
  const after=constitutionFromAikitResolution({...identities,constitution_ref:"speech-constitution:2",body_ref:"surface:realtime"},realtimeResolution,"2026-09-17T09:01:00Z");
  const change=recordConstitutionChange({change_ref:"change:1",before,after,reason:"realtime body resolved",evidence_refs:["evidence:1"],changed_at:"2026-09-17T09:01:00Z"});
  assert.equal(change.schema,"actuation.speech-constitution-change/v1");
  assert.equal(change.agent_ref,"agent:nara");
  assert.equal(change.delta.body_changed,true);
  assert.equal(change.delta.speech_capable_before,false);
  assert.equal(change.delta.speech_capable_after,true);
  assert.ok(change.delta.gained_interaction.includes("full-duplex-realtime"));
  assert.deepEqual(constitutionDelta(before,after),change.delta);
  // Identity change refuses — a different Agent is not a body change.
  assert.throws(()=>recordConstitutionChange({change_ref:"change:2",before,after:{...after,agent_ref:"agent:other"},reason:"x",evidence_refs:["evidence:1"],changed_at:"2026-09-17T09:01:00Z"}),/must not change Agent or Agency identity/);
  assert.throws(()=>recordConstitutionChange({change_ref:"change:3",before,after:{...after,constitution_ref:before.constitution_ref},reason:"x",evidence_refs:["evidence:1"],changed_at:"2026-09-17T09:01:00Z"}),/two distinct constitutions/);
});

// ---------------------------------------------------------------------------
// The binding: session read, interruption, tool authority
// ---------------------------------------------------------------------------

function fixtureBinding(){
  const constitution=constitutionFromAikitResolution(identities,textResolution,"2026-09-17T09:00:00Z");
  const context=buildDialogueContext({
    context_ref:"dialogue-context:1",nara_ref:"nara:a",subject_ref:"subject:a",
    agent_session_ref:constitution.agent_session_ref,coordinate_ref:"M4.1.1",m4_branch:"embodied",
    bimba:dialogueFixture.bimba,
    expression_ref:"expression:1",expression_revision:"rev-7",
    profile_ref:"profile:M4.1",profile_revision:"prof-2",scene_ref:"scene:1",active_m_focus:"m4",
    disclosed:dialogueFixture.disclosed,available_action_refs:["action:expression.focus"],
  });
  return NaraSpeechBinding.constitute({
    constitution,dialogue_context:context,
    allowed_action_refs:["action:expression.focus"],denied_action_refs:["central.source.write"],
  });
}

test("binding constitutes with agreement, reads the session, and refuses mismatched identity",()=>{
  const binding=fixtureBinding();
  const read=binding.read();
  assert.equal(read.schema,"actuation.speech-session-read/v1");
  assert.equal(read.phase,"idle");
  assert.equal(read.text_capable,true);
  assert.equal(read.speech_capable,false);
  assert.equal(read.nara_ref,"nara:a");
  assert.equal(read.interruption.state,"unsupported");
  assert.equal(read.expressive_act.live,false);
  // A context naming another session refuses.
  assert.throws(()=>NaraSpeechBinding.constitute({
    constitution:binding.constitutionNow,
    dialogue_context:{...binding.contextNow,agent_session_ref:"agent-session:other"},
    allowed_action_refs:[],denied_action_refs:[],
  }),/does not name the constituted AgentSession/);
});

test("interruption degrades honestly on an unsupported body and never destroys the session",()=>{
  const binding=fixtureBinding();
  binding.beginListening();
  binding.beginResponse("response:1");
  const receipt=binding.interrupt({interruption_ref:"interruption:1",reason:"person stopped",at:"2026-09-17T09:02:00Z"});
  assert.equal(receipt.schema,"actuation.nara-interruption/v1");
  assert.equal(receipt.session_destroyed,false);
  assert.equal(receipt.nara_ref,"nara:a");
  const generic=receipt.interruption_receipt;
  assert.equal(generic["outcome"],"refused","an unsupported body is refused honestly, not faked");
  assert.match(String(generic["refusal_reason"]),/does not support interruption/);
  assert.equal(binding.read().phase,"speaking","the response honestly continues");
  binding.commitResult("result:1");binding.completeResponse();
  assert.equal(binding.read().phase,"completed");
});

test("interruption on a supported body cancels in flight and carries the choreography disposition",()=>{
  // Constitute on the realtime body, where interruption is supported.
  const constitution=constitutionFromAikitResolution(identities,realtimeResolution,"2026-09-17T09:00:00Z");
  const context=buildDialogueContext({
    context_ref:"dialogue-context:1",nara_ref:"nara:a",subject_ref:"subject:a",
    agent_session_ref:constitution.agent_session_ref,coordinate_ref:"M4.1.1",m4_branch:"embodied",
    expression_ref:"expression:1",expression_revision:"rev-7",
    profile_ref:"profile:M4.1",profile_revision:"prof-2",scene_ref:"scene:1",active_m_focus:"m4",
    disclosed:[],available_action_refs:[],
    expressive_act:{expressive_act_ref:"expressive-act:1",phase:"active",basis_expression_revision:"rev-7",speech_turn_ref:"turn:1",checkpoint:null},
  });
  const binding=NaraSpeechBinding.constitute({constitution,dialogue_context:context,allowed_action_refs:[],denied_action_refs:[]});
  binding.beginResponse("response:1");
  const receipt=binding.interrupt({interruption_ref:"interruption:2",reason:"barge-in",at:"2026-09-17T09:02:00Z"});
  const generic=receipt.interruption_receipt;
  assert.equal(generic["outcome"],"cancelled");
  assert.equal(generic["phase_after"],"interrupted");
  assert.deepEqual(receipt.expressive_act,{expressive_act_ref:"expressive-act:1",disposition:"hold-and-cancel-pending-choreography"});
  assert.equal(binding.read().phase,"interrupted");
  assert.equal(binding.read().nara_ref,"nara:a","Nara survives the interruption");
});

test("a tool request is refused before effect and an authorised one is executable separately",()=>{
  const realtimeConstitution=constitutionFromAikitResolution({...identities,constitution_ref:"speech-constitution:tools",body_ref:"surface:realtime"},realtimeResolution,"2026-09-17T09:00:00Z");
  const binding=NaraSpeechBinding.constitute({
    constitution:realtimeConstitution,dialogue_context:{...fixtureBinding().contextNow,agent_session_ref:realtimeConstitution.agent_session_ref},
    allowed_action_refs:["action:expression.focus"],denied_action_refs:["central.source.write"],
  });
  const base={schema:"actuation.speech-tool-decision/v1",constitution_ref:binding.constitutionNow.constitution_ref,agent_session_ref:binding.constitutionNow.agent_session_ref,payload_refs:["source:x"],requested_at:"2026-09-17T09:03:00Z"};
  validateToolRequest({...base,request_ref:"request:1",proposed_action_ref:"central.source.write"});
  const refused=binding.adjudicateToolRequest({decision_ref:"decision:1",request:{...base,request_ref:"request:1",proposed_action_ref:"central.source.write"},decided_by:"person:desktop",at:"2026-09-17T09:03:00Z"});
  assert.equal(refused.resolution.resolution,"refused");
  assert.equal(refused.resolution.stage,"denied","the explicitly denied action refuses at the denial stage");
  assert.throws(()=>binding.recordExecution(refused,{execution_ref:"execution:1",owner_operation:"x",result:{},evidence_refs:["e:1"],executed_at:"2026-09-17T09:03:00Z"}),/refused tool request cannot be executed/);
  const unlisted=binding.adjudicateToolRequest({decision_ref:"decision:2",request:{...base,request_ref:"request:2",proposed_action_ref:"central.day.write"},decided_by:"person:desktop",at:"2026-09-17T09:03:00Z"});
  assert.equal(unlisted.resolution.stage,"unauthorised","absence from the allowed list is not permission");
  const authorised=binding.adjudicateToolRequest({decision_ref:"decision:3",request:{...base,request_ref:"request:3",proposed_action_ref:"action:expression.focus"},decided_by:"person:desktop",at:"2026-09-17T09:03:00Z"});
  assert.equal(authorised.resolution.resolution,"authorised");
  assert.equal(authorised.resolution.action_ref,"action:expression.focus");
  const execution=binding.recordExecution(authorised,{execution_ref:"execution:1",owner_operation:"expression.edit",result:{state:"ready"},evidence_refs:["expression:1@8"],executed_at:"2026-09-17T09:03:01Z"});
  assert.equal(execution.decision_ref,"decision:3");
  assert.equal(binding.read().executed_refs.length,0,"adjudication executes nothing by itself");
});

test("reconnect continues the same dialogue and refuses a changed identity",()=>{
  const binding=fixtureBinding();
  const nextConstitution=constitutionFromAikitResolution({...identities,constitution_ref:"speech-constitution:next",body_ref:"surface:realtime"},realtimeResolution,"2026-09-17T09:04:00Z");
  const nextContext={...binding.contextNow,agent_session_ref:nextConstitution.agent_session_ref,expression_revision:"rev-8"};
  const change=binding.reconnect({change_ref:"change:9",next_constitution:nextConstitution,next_context:nextContext,reason:"realtime body",evidence_refs:["evidence:9"],at:"2026-09-17T09:04:00Z"});
  assert.equal(change.agent_ref,"agent:nara");
  assert.equal(binding.read().phase,"idle");
  assert.equal(binding.read().realtime_capable,true);
  // A reconnect that changes the Expression identity refuses (a different encounter).
  const elsewhereConstitution=constitutionFromAikitResolution({...identities,constitution_ref:"speech-constitution:elsewhere",body_ref:"surface:text"},textResolution,"2026-09-17T09:05:00Z");
  const elsewhere={...binding.contextNow,expression_ref:"expression:other",agent_session_ref:elsewhereConstitution.agent_session_ref};
  assert.throws(()=>binding.reconnect({change_ref:"change:10",next_constitution:elsewhereConstitution,next_context:elsewhere,reason:"x",evidence_refs:["e:1"],at:"2026-09-17T09:05:00Z"}),/reconnect changed the Expression/);
});

test("turn context updates keep the Nara and session identity",()=>{
  const binding=fixtureBinding();
  binding.updateContext({...binding.contextNow,expression_revision:"rev-8",pointed_ref:"bimba:relation:1"});
  assert.equal(binding.contextNow.expression_revision,"rev-8");
  assert.throws(()=>binding.updateContext({...binding.contextNow,nara_ref:"nara:b"}),/cannot change the Nara identity/);
});
