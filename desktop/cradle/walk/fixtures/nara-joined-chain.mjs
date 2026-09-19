/**
 * The joined Nara chain (#336) driven against a real kernel walk bridge.
 *
 * Spawned by walk/scenarios/nara-speech.mjs with the repo's own TS test
 * flags (the same way tests/nara-speech-conformance.mjs runs), so the
 * TypeScript Nara consumer modules import exactly as they do in the test
 * harness. Every step below is a real kernel operation over the bridge;
 * the script prints one JSON result line the scenario turns into checks.
 *
 * Usage: node --experimental-strip-types --import ./tests/ts-register.mjs \
 *          walk/fixtures/nara-joined-chain.mjs <bridgeUrl>
 */

import {register} from "node:module";
import {readFileSync} from "node:fs";
import {fileURLToPath,pathToFileURL} from "node:url";
import assert from "node:assert/strict";

register(pathToFileURL(fileURLToPath(new URL("../../tests/ts-resolve-hook.mjs", import.meta.url))).href);

const {constitutionFromAikitResolution} = await import("../../src/nara/constitution.ts");
const {
  buildDialogueContext,buildDeixisRequest,resolveDeixis,
  buildEpiiDelegation,validateEpiiEnrichment,receiveEnrichment,applyGate,
} = await import("../../src/nara/dialogueContext.ts");
const {
  beginExpressiveAct,interruptExpressiveAct,restoreExpressiveActCheckpoint,planChoreography,
  takeChoreographyStep,completeChoreographyStep,interruptChoreography,
} = await import("../../src/nara/expressiveAct.ts");
const {NaraSpeechBinding} = await import("../../src/nara/session.ts");

const bridgeUrl=process.argv[2];
if(!bridgeUrl)throw new Error("usage: nara-joined-chain.mjs <bridgeUrl>");
const fixtureRoot=fileURLToPath(new URL("./nara/",import.meta.url));
const textResolution=JSON.parse(readFileSync(`${fixtureRoot}text-body-resolution.json`,"utf8")).resolution;
const realtimeResolution=JSON.parse(readFileSync(`${fixtureRoot}realtime-body-resolution.json`,"utf8")).resolution;
const ACTOR="human:expression-editor";

const bridgeOp=async(op,request)=>{
  const envelope=await (await fetch(`${bridgeUrl}/op`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op,request})})).json();
  if(envelope.error||!envelope.outcome)throw new Error(`${op} failed: ${JSON.stringify(envelope.error??envelope)}`);
  return envelope.outcome;
};

/** One check with its label and data, evaluated lazily so a throw reads as
 * the check's failure, never a crashed chain. */
const checks=[];
async function check(label,run){
  try{
    const data=await run();
    checks.push({ok:true,label,data:detail(data)});
    console.log(`PASS  ${label}`);
  }catch(error){
    checks.push({ok:false,label,error:String(error?.message??error)});
    console.log(`FAIL  ${label}: ${error?.message??error}`);
  }
}
const detail=value=>value&&typeof value==="object"?JSON.parse(JSON.stringify(value,value=>typeof value==="bigint"?String(value):value)):value;

const throws=(run,match)=>{
  try{run();return false;}catch(error){return match.test(String(error?.message??error));}
};

// ---------------------------------------------------------------------------
const expressionRef=`expression:nara-walk-${Date.now()}`;
const created=await bridgeOp("expression",{operation:"create",expression_ref:expressionRef,title:"Nara speech walk",actor:ACTOR});
await check("Expression world created through the real kernel seam",()=>{
  assert.equal(created.data.state,"ready");
  return {expression_ref:expressionRef,revision:created.data.document.revision};
});
let revision=created.data.document.revision;
const edit=async changes=>{
  const result=await bridgeOp("expression",{operation:"edit",expression_ref:expressionRef,expected_revision:revision,actor:ACTOR,changes});
  if(result.data.state!=="ready")throw new Error(`edit did not apply: ${JSON.stringify(result.data)}`);
  revision=result.data.document.revision;
  return result.data.document;
};
const bind=(entityRef,subjectRef,title)=>[
  {change:"entity_add",scene_ref:`${expressionRef}:scene:main`,entity_ref:entityRef,title},
  {change:"subject_bind",entity_ref:entityRef,binding:{
    subject_ref:subjectRef,native_owner:"ql",presentation_role:"thing",
    sources:[{ref:`source:ql/${subjectRef.replace(/[^a-z0-9.-]/gi,"-")}`,revision:String(revision),availability:"available"}],
    readings:[],actions:[],
  }},
];
await edit([
  ...bind(`${expressionRef}:entity:person`,"bimba:#4","Person locus"),
  ...bind(`${expressionRef}:entity:relation`,"bimba:relation:1","Pointed relation"),
  ...bind(`${expressionRef}:entity:earth`,"ql:nara:focus:m4:earth-body","EarthBody"),
]);
let document=await edit([{change:"focus",scene_ref:`${expressionRef}:scene:main`,entity_ref:`${expressionRef}:entity:relation`}]);
await check("Pointing committed: the application owns the exact ref",()=>{
  assert.equal(document.selection.entity_ref,`${expressionRef}:entity:relation`);
  return {selection:document.selection,revision:document.revision};
});

// Canonical Nara attaches to the resolved text-capable body.
const constitutionText=constitutionFromAikitResolution({
  constitution_ref:`speech-constitution:${crypto.randomUUID()}`,
  agent_ref:"agent:nara",agency_ref:"agency:nara",world_binding_ref:"world:desktop",
  agent_session_ref:`agent-session:${crypto.randomUUID()}`,
  body_ref:"model:desktop-text",
},textResolution,new Date().toISOString());
const contextRef=`dialogue-context:${crypto.randomUUID()}`;
const buildContext=(documentSnapshot,overrides={})=>buildDialogueContext({
  context_ref:contextRef,
  nara_ref:"nara:desktop-walk",
  subject_ref:"bimba:#4",
  agent_session_ref:constitutionText.agent_session_ref,
  coordinate_ref:"M4.1.1",m4_branch:"embodied",
  bimba:{owner_contract_ref:"ql.aw1-rooted-m-world/v1",registry_revision:"registry:walk-1",
    selected_source_ref:"bimba:source:M4.1",direct_canonical_ref:"bimba:#4",conjugate_canonical_ref:"pratibimba:#4"},
  expression_ref:expressionRef,
  expression_revision:String(documentSnapshot.revision),
  profile_ref:`profile:${expressionRef}`,profile_revision:"1",
  scene_ref:documentSnapshot.selection.scene_ref,
  active_m_focus:"m4",
  pointed_ref:documentSnapshot.selection.entity_ref?documentSnapshot.entities[documentSnapshot.selection.entity_ref]?.subject?.subject_ref??null:null,
  pinned_refs:[],
  disclosed:[{ref_id:"bimba:relation:1",revision:"1",standing:"source",disclosure:"hen-disclosure",disclosed_via_ref:`${expressionRef}@${documentSnapshot.revision}`}],
  available_action_refs:["action:expression.focus"],
  ...overrides,
});
const binding=NaraSpeechBinding.constitute({
  constitution:constitutionText,
  dialogue_context:buildContext(document),
  allowed_action_refs:["action:expression.focus"],
  denied_action_refs:["central.source.write"],
});
await check("Canonical Nara attaches to the resolved text-capable body (honest constitution)",()=>{
  const read=binding.read();
  assert.equal(read.schema,"actuation.speech-session-read/v1");
  assert.equal(read.text_capable,true);
  assert.equal(read.speech_capable,false,"no acoustic body is claimed on this host");
  assert.equal(read.nara_ref,"nara:desktop-walk");
  return read;
});

// Exact point: the ref enters Nara's bounded context.
const pointedDeixis=buildDeixisRequest({
  deixis_ref:`deixis:${crypto.randomUUID()}`,
  nara_ref:binding.contextNow.nara_ref,
  turn_ref:`turn:${crypto.randomUUID()}`,
  basis_expression_revision:binding.contextNow.expression_revision,
  kind:"pointed",
  target:{target:"exact",ref_id:"bimba:relation:1",target_kind:"relation"},
  requested_at_unix_ms:Date.now(),
});
await check("Exact point resolves: the ref enters the bounded turn context",()=>{
  const resolution=resolveDeixis(binding.contextNow,pointedDeixis);
  assert.equal(resolution.outcome.outcome,"focused");
  assert.ok(resolution.outcome.turn_context.turn_refs.includes("bimba:relation:1"));
  return resolution.outcome.turn_context;
});
await check("A deixis request on a moved Expression revision is refused (stale basis)",()=>{
  assert.ok(throws(()=>resolveDeixis(binding.contextNow,buildDeixisRequest({...pointedDeixis,basis_expression_revision:"1"})),/deixis request is stale/));
  return {refused:"stale"};
});

// Nara's turn runs on the resolved text path (the honest fallback).
await check("Nara's turn runs on the text path; the phase machine discloses it",()=>{
  binding.beginListening();
  binding.beginResponse(`response:${crypto.randomUUID()}`);
  binding.commitResult(`result:context:${binding.contextNow.expression_revision}`);
  binding.completeResponse();
  assert.equal(binding.read().phase,"completed");
  return {phase:binding.read().phase};
});

// Nara focuses another exact relation: a REAL kernel edit.
binding.updateContext({...binding.contextNow,expression_revision:String(document.revision)});
await check("A ref that was never disclosed, selected or structural is not admitted",()=>{
  assert.ok(throws(()=>resolveDeixis(binding.contextNow,buildDeixisRequest({
    deixis_ref:`deixis:${crypto.randomUUID()}`,nara_ref:binding.contextNow.nara_ref,
    turn_ref:`turn:${crypto.randomUUID()}`,basis_expression_revision:binding.contextNow.expression_revision,
    kind:"spoken",target:{target:"spoken",phrase:"the EarthBody locus",candidate_refs:["ql:nara:focus:m4:earth-body"]},
    requested_at_unix_ms:Date.now(),
  })),/not admitted to Nara context/));
  return {ref:"ql:nara:focus:m4:earth-body",status:"not admitted"};
});
// Disclosure is a fact with a receipt: the kernel entity_add edit that
// bound the EarthBody locus disclosed it (hen-disclosure via the document).
binding.updateContext({...binding.contextNow,disclosed:[...binding.contextNow.disclosed,
  {ref_id:"ql:nara:focus:m4:earth-body",revision:"1",standing:"source",disclosure:"hen-disclosure",disclosed_via_ref:`${expressionRef}@${document.revision}`}]});
const spoken=buildDeixisRequest({
  deixis_ref:`deixis:${crypto.randomUUID()}`,
  nara_ref:binding.contextNow.nara_ref,
  turn_ref:`turn:${crypto.randomUUID()}`,
  basis_expression_revision:binding.contextNow.expression_revision,
  kind:"spoken",
  target:{target:"spoken",phrase:"the EarthBody locus",candidate_refs:["ql:nara:focus:m4:earth-body"]},
  requested_at_unix_ms:Date.now(),
});
const earthFocus=async()=>{
  const resolution=resolveDeixis(binding.contextNow,spoken);
  if(resolution.outcome.outcome!=="focused")throw new Error("spoken deixis did not focus");
  const entity=Object.values(document.entities).find(candidate=>candidate.subject?.subject_ref==="ql:nara:focus:m4:earth-body");
  const focused=await edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:entity.entity_ref}]);
  document=focused;
  return focused;
};
await check("Nara-returned focus action landed as a real kernel Expression edit",async()=>{
  const focused=await earthFocus();
  assert.equal(focused.selection.entity_ref,`${expressionRef}:entity:earth`);
  assert.ok(focused.revision>revision-1);
  return {revision:focused.revision,selection:focused.selection};
});

// Reconnect to the interruption-capable body: a body change, not a new Nara.
const constitutionRealtime=constitutionFromAikitResolution({
  constitution_ref:`speech-constitution:${crypto.randomUUID()}`,
  agent_ref:constitutionText.agent_ref,agency_ref:constitutionText.agency_ref,
  world_binding_ref:constitutionText.world_binding_ref,
  agent_session_ref:`agent-session:${crypto.randomUUID()}`,
  body_ref:"model:desktop-realtime",
},realtimeResolution,new Date().toISOString());
await check("Body change recorded without reminting Nara; new capabilities disclosed",()=>{
  const change=binding.reconnect({
    change_ref:`speech-constitution-change:${crypto.randomUUID()}`,
    next_constitution:constitutionRealtime,
    next_context:buildContext(document,{agent_session_ref:constitutionRealtime.agent_session_ref}),
    reason:"realtime body resolved; canonical Nara continues",
    evidence_refs:["walk:fixture:realtime-body-resolution.json"],
    at:new Date().toISOString(),
  });
  assert.equal(change.schema,"actuation.speech-constitution-change/v1");
  assert.equal(change.delta.body_changed,true);
  assert.equal(change.delta.speech_capable_before,false);
  assert.equal(change.delta.speech_capable_after,true);
  assert.equal(change.agent_ref,"agent:nara");
  assert.equal(binding.read().realtime_capable,true);
  return change.delta;
});

// One reversible ExpressiveAct with speech; interrupt holds both together.
const actRef=`expressive-act:${crypto.randomUUID()}`;
const actRevision=binding.contextNow.expression_revision;
binding.nextTurnContext({expressive_act:beginExpressiveAct({
  expressive_act_ref:actRef,
  basis_expression_revision:actRevision,
  speech_turn_ref:`turn:${crypto.randomUUID()}`,
  checkpoint:{checkpoint_ref:`checkpoint:r${actRevision}`,checkpoint_expression_revision:actRevision},
})});
binding.beginResponse(`response:${crypto.randomUUID()}`);
const plan=planChoreography(actRef,[
  {step_ref:`${actRef}:step:focus-person`,summary:"focus the person locus",atomic_safe:true,reversible:true},
  {step_ref:`${actRef}:step:settle`,summary:"settle the presentation",atomic_safe:true,reversible:true},
  {step_ref:`${actRef}:step:third`,summary:"third movement",atomic_safe:false,reversible:true},
]);
const interruptAndHold=async()=>{
  const running=takeChoreographyStep(plan);
  const person=Object.values(document.entities).find(candidate=>candidate.subject?.subject_ref==="bimba:#4");
  const actDocument=await edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:person.entity_ref}]);
  document=actDocument;
  completeChoreographyStep(plan);
  takeChoreographyStep(plan); // the second step is mid-flight when the person interrupts
  const receipt=binding.interrupt({interruption_ref:`interruption:${crypto.randomUUID()}`,reason:"person interrupted mid-act",at:new Date().toISOString()});
  const held=interruptChoreography(plan);
  binding.nextTurnContext({expressive_act:interruptExpressiveAct(binding.contextNow.expressive_act)});
  return {receipt,held,actDocument,running};
};
await check("Interrupt cancels speech AND holds/cancels the choreography together; the session survives",async()=>{
  const {receipt,held,actDocument}=await interruptAndHold();
  assert.equal(receipt.schema,"actuation.nara-interruption/v1");
  assert.equal(receipt.interruption_receipt.outcome,"cancelled");
  assert.equal(receipt.session_destroyed,false);
  assert.deepEqual(receipt.expressive_act,{expressive_act_ref:actRef,disposition:"hold-and-cancel-pending-choreography"});
  assert.equal(held.finish?.step_ref,`${actRef}:step:settle`);
  assert.deepEqual(held.cancelled.map(step=>step.step_ref),[`${actRef}:step:third`]);
  assert.equal(binding.read().phase,"interrupted");
  assert.equal(binding.read().nara_ref,"nara:desktop-walk");
  assert.equal(binding.read().agent_ref,"agent:nara");
  assert.equal(actDocument.selection.entity_ref,`${expressionRef}:entity:person`,"the atomic step's committed edit stands");
  return {outcome:receipt.interruption_receipt.outcome,cancelled:held.cancelled.length,stood:held.stood.length};
});
// The world moved under the interrupted act: its context entry is released
// (the QL coherence law refuses an act whose basis is not the live
// revision), and the act object itself proves the checkpoint honesty.
const interruptedAct=binding.contextNow.expressive_act;
binding.updateContext({...binding.contextNow,expression_revision:String(document.revision),expressive_act:null});
await check("Checkpoint restore refuses while the live Expression has moved past the authored checkpoint",()=>{
  assert.ok(interruptedAct?.checkpoint?.checkpoint_ref,"the interrupted act carries its authored checkpoint");
  assert.ok(throws(()=>restoreExpressiveActCheckpoint(interruptedAct,interruptedAct.checkpoint.checkpoint_ref,binding.contextNow.expression_revision),/does not match the live Expression/));
  return {checkpoint:interruptedAct.checkpoint.checkpoint_ref,honest:"no fake rewind",released_from_context:true};
});

// Authority: refusal before effect; authorised executes for real.
const executedBefore=binding.read().executed_refs.length;
const refused=binding.adjudicateToolRequest({
  decision_ref:`decision:${crypto.randomUUID()}`,
  request:{
    schema:"actuation.speech-tool-decision/v1",
    request_ref:`request:${crypto.randomUUID()}`,
    constitution_ref:binding.constitutionNow.constitution_ref,
    agent_session_ref:binding.constitutionNow.agent_session_ref,
    proposed_action_ref:"central.source.write",
    payload_refs:["source:undisclosed"],
    requested_at:new Date().toISOString(),
  },
  decided_by:"person:desktop",
  at:new Date().toISOString(),
});
await check("Speech tool request REFUSED before effect; no dispatch followed",()=>{
  assert.equal(refused.resolution.resolution,"refused");
  assert.equal(refused.resolution.stage,"denied");
  assert.equal(binding.decisionsRecorded.at(-1).decision_ref,refused.decision_ref);
  assert.equal(binding.read().executed_refs.length,executedBefore,"nothing executed behind the refusal");
  return {stage:refused.resolution.stage,reason:refused.resolution.reason};
});
const authorised=binding.adjudicateToolRequest({
  decision_ref:`decision:${crypto.randomUUID()}`,
  request:{
    schema:"actuation.speech-tool-decision/v1",
    request_ref:`request:${crypto.randomUUID()}`,
    constitution_ref:binding.constitutionNow.constitution_ref,
    agent_session_ref:binding.constitutionNow.agent_session_ref,
    proposed_action_ref:"action:expression.focus",
    payload_refs:["bimba:relation:1"],
    requested_at:new Date().toISOString(),
  },
  decided_by:"person:desktop",
  at:new Date().toISOString(),
});
const executed=async()=>{
  const relation=Object.values(document.entities).find(candidate=>candidate.subject?.subject_ref==="bimba:relation:1");
  const execDocument=await edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:relation.entity_ref}]);
  document=execDocument;
  const execution=binding.recordExecution(authorised,{
    execution_ref:`execution:${crypto.randomUUID()}`,
    owner_operation:"expression.edit",
    result:{state:"ready",revision:execDocument.revision},
    evidence_refs:[`${expressionRef}@${execDocument.revision}`],
    executed_at:new Date().toISOString(),
  });
  return {execution,execDocument};
};
await check("Authorised tool request executed as a real dispatch with its own receipt",async()=>{
  const {execution,execDocument}=await executed();
  assert.equal(authorised.resolution.resolution,"authorised");
  assert.equal(execution.decision_ref,authorised.decision_ref);
  assert.equal(execution.action_ref,"action:expression.focus");
  assert.equal(execDocument.selection.entity_ref,`${expressionRef}:entity:relation`);
  return {execution:execution.execution_ref,revision:execDocument.revision};
});

// Epii: delegated over admitted refs; returned material retained-not-applied.
const delegateContext=binding.contextNow;
const delegation=buildEpiiDelegation({
  delegation_ref:`delegation:${crypto.randomUUID()}`,
  context:delegateContext,
  epii_session_ref:"epii:session:walk",
  brief:"What stands behind the pointed relation?",
  scope_candidates:["bimba:relation:1"],
  delegated_at_unix_ms:Date.now(),
});
const delegationReceipt=binding.recordDelegation(delegation,{delegation_receipt_ref:`delegation-receipt:${crypto.randomUUID()}`,at:new Date().toISOString()});
await check("Delegation handed exactly the admitted scope; Nara stays foreground",()=>{
  assert.equal(delegationReceipt.foreground_agent,"nara:desktop-walk");
  assert.deepEqual(delegation.scope_refs,["bimba:relation:1"]);
  assert.ok(throws(()=>buildEpiiDelegation({delegation_ref:`delegation:${crypto.randomUUID()}`,context:delegateContext,epii_session_ref:"epii:session:walk",brief:"x",scope_candidates:["source:private"],delegated_at_unix_ms:Date.now()}),/not admitted/));
  return delegationReceipt;
});
const enrichment=validateEpiiEnrichment({
  schema:"ql.epii-enrichment/v1",
  enrichment_ref:"enrichment:walk-1",
  delegation_ref:delegation.delegation_ref,
  basis_context_ref:delegation.basis.context_ref,
  basis_expression_revision:delegation.basis.expression_revision,
  coordinate_refs:["M4.1.1"],source_refs:["bimba:relation:1"],method_refs:[],evidence_refs:["evidence:walk-1"],
  standing:"derived",
  synthesis:"The disclosed relation bears its conjugate face behind it.",
  proposed_focus_refs:["bimba:relation:1"],proposed_scene_change_refs:[],proposed_profile_variant_ref:null,
  proposed_expressive_act_refs:[],proposed_native_action_refs:[],
  continuing_questions:["What does the conjugate face hold?"],
  factory_commission_proposal:null,returned_at_unix_ms:Date.now(),
});
const enrichmentReceipt=(()=>{
  receiveEnrichment(delegation,enrichment); // the delegation's own state law
  return binding.recordEnrichment(enrichment,{enrichment_receipt_ref:`enrichment-receipt:${crypto.randomUUID()}`,at:new Date().toISOString()});
})();
await check("Epii enrichment arrived basis-bound, retained-not-applied (a proposal)",()=>{
  assert.equal(enrichmentReceipt.applied,false);
  assert.equal(enrichmentReceipt.standing,"proposed-only");
  applyGate(delegation,enrichment,binding.contextNow);
  return enrichmentReceipt;
});
const moved=await edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:`${expressionRef}:entity:person`}]);
document=moved;
binding.updateContext({...binding.contextNow,expression_revision:String(document.revision),pointed_ref:null});
await check("Stale Epii enrichment refuses auto-application after the world moved",()=>{
  assert.ok(throws(()=>applyGate(delegation,enrichment,binding.contextNow),/stale Epii enrichment/));
  return {live_revision:binding.contextNow.expression_revision,basis:enrichment.basis_expression_revision};
});

process.stdout.write(`\n${JSON.stringify({schema:"oi.cradle.walk.nara-joined/v1",expression_ref:expressionRef,checks})}\n`);
const failed=checks.filter(entry=>!entry.ok).length;
process.exit(failed?1:0);
