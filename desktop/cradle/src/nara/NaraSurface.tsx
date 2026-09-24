/**
 * The Nara presence surface (#336): canonical Nara inhabiting the current
 * Expression world with a speech body.
 *
 * Component grammar (map §2.1): a stable Ref (nara_ref + binding), the
 * owner's read-model state (the session read the constitution discloses),
 * the Actions the owners disclose (available_action_refs + the subject's
 * disclosed Actions), and invocation that crosses the authority seam at
 * commit time — every consequential operation here goes through the kernel
 * `expression` seam or the owner Action dispatch, never through this
 * component's own authority.
 *
 * Capability-adaptive by law: the UI renders what the constitution
 * disclosed — manual push-to-talk/interrupt when VAD/barge-in are not
 * proven, transcript rows only for real turns, text input always available
 * as the honest fallback. Unavailable is never an error. The speech body
 * itself renders in one of three states derived only from the constitution's
 * disclosed facts (src/nara/bodyState.ts): live (chips as usual), option
 * (constituted but gated or degraded — the body shows as a visible option
 * with the gap named exactly as the document carries it), or absent
 * (text-capable Nara) — and hold-to-talk never presents as live on a gated
 * or absent body. At rest the surface is summoned, never permanent: no
 * transcript dashboard over the world.
 */

import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {useExpressionStage} from "../stage/ExpressionStage";
import type {SurfaceBinding} from "../surface/types";
import type {Change,ExpressionDocument} from "../expression/types";
import {
  constitutionFromAikitResolution,
  type SpeechConstitutionChangeReceipt,type SpeechConstitutionFacts,
} from "./constitution";
import {
  buildDeixisRequest,buildDialogueContext,buildEpiiDelegation,resolveDeixis,
  type BimbaSelectionBinding,type DeicticKind,type DeixisResolution,type M4Branch,
  type NaraDialogueContext,type SemanticTargetKind,
} from "./dialogueContext";
import {
  interruptChoreography,planChoreography,takeChoreographyStep,completeChoreographyStep,
  beginExpressiveAct,interruptExpressiveAct,restoreExpressiveActCheckpoint,
  type ChoreographyPlan,
} from "./expressiveAct";
import {stageFocusPlan} from "./stageFocus";
import {holdToTalkLive,holdToTalkRefusal,naraBodyState} from "./bodyState";
import {voiceBodyFromConstitution,voiceBodySatisfactionReceipt} from "./voiceBody";
import {NaraSpeechBinding,type NaraSpeechRead,type SpeechToolDecision} from "./session";
import {supportUsable,type SpeechSupport} from "./support";
import "./nara.css";
import {recordToolDecision} from "./decisionRecord";
import {putDelegationLedger} from "./delegationLedger";

const PHASE_WORD:Record<NaraSpeechRead["phase"],string>={
  idle:"at rest",listening:"listening",speaking:"speaking",interrupted:"interrupted",completed:"responded",
};

interface TurnRow {role:"person"|"nara";text:string}
interface HighlightState {ref:string;action:string}
interface ProposalRow {delegation:Record<string,unknown>;delegation_receipt:Record<string,unknown>;enrichment:Record<string,unknown>|null;enrichment_receipt:Record<string,unknown>|null}

export function NaraSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const stage=useExpressionStage();
 const client=useRef<NaraSpeechBinding|null>(null);
 const doc=useRef<ExpressionDocument|null>(null);
 const [read,setRead]=useState<NaraSpeechRead|null>(null);
 const [context,setUpstreamContext]=useState<NaraDialogueContext|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [turns,setTurns]=useState<TurnRow[]>([]);
 const [highlight,setHighlight]=useState<HighlightState|null>(null);
 const [choreography,setChoreography]=useState<ChoreographyPlan|null>(null);
 const [proposals,setProposals]=useState<ProposalRow[]>([]);
 const [changeReceipt,setChangeReceipt]=useState<SpeechConstitutionChangeReceipt|null>(null);
 const [interruptReceipt,setInterruptReceipt]=useState<Record<string,unknown>|null>(null);
 const [toolPending,setToolPending]=useState(false);
 const [toolReceipt,setToolReceipt]=useState<{decision:SpeechToolDecision;execution:Record<string,unknown>|null}|null>(null);
 const [floor,setFloor]=useState<Record<string,unknown>|null>(null);
 const [mic,setMic]=useState<"idle"|"requesting"|"live"|"denied"|"unavailable">("idle");
 const composer=useRef<HTMLInputElement|null>(null);
 const head=useRef<HTMLElement|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const stageCue=useRef<number|null>(null);
 const [resolutionText,setResolutionText]=useState("");
 const [bimbaText,setBimbaText]=useState("");
 const [expressionRefField,setExpressionRefField]=useState(binding.ref??"");
 const [subjectField,setSubjectField]=useState("");
 const [coordinateField,setCoordinateField]=useState("M4.1.1");
 const [naraField,setNaraField]=useState("nara:desktop");

 const renderFrom=useCallback(()=>{
  const current=client.current;
  setRead(current?current.read():null);
  if(current){
   setUpstreamContext(current.contextNow);
   setChoreography(plan=>plan);
  }
 },[]);

 // Presence rides the house notify-form vocabulary (D22) while the surface
 // lives; it never moves layout.
 useEffect(()=>{
  if(!read)return;
  const form=read.phase==="listening"?"listening":read.phase==="speaking"?"presence":read.phase==="interrupted"?"waiting":"idle";
  const rect=head.current?.getBoundingClientRect()??new DOMRect(24,24,24,24);
  if(stageCue.current!=null)stage.update(stageCue.current,{name:form,rect});
  else stageCue.current=stage.express(form,{target:`nara:${read.nara_ref}`,rect});
 },[read,stage]);
 useEffect(()=>()=>{
  if(stageCue.current!=null)stage.release(stageCue.current);
 },[stage]);

 /** Read the live Expression document through the kernel seam. */
 const readDocument=useCallback(async()=>{
  const ref=expressionRefField.trim()||doc.current?.expression_ref;
  if(!ref)return null;
  const reply=await kernelOp(kernel.transport,{op:"expression",request:{operation:"inspect",expression_ref:ref}});
  if(reply.error||!reply.outcome||reply.outcome.result!=="expression")throw new Error(reply.error??"Expression application unavailable");
  const document=(reply.outcome.data.document as ExpressionDocument|null)??null;
  doc.current=document;
  return document;
 },[kernel.transport,expressionRefField]);

 /** Construct the bounded dialogue context from real current state. */
 const buildTurnContext=useCallback(async()=>{
  const current=client.current;
  if(!current)throw new Error("Nara is not attached");
  const document=await readDocument();
  if(!document)throw new Error("The Expression document is unavailable; the dialogue context names a live Expression");
  const previous=current.contextNow;
  const selected=document.selection.entity_ref?document.entities[document.selection.entity_ref]:null;
  // Coherence: an act whose basis is no longer the live revision cannot ride
  // the next turn's context (the QL law refuses it) — it is released here,
  // named in the notice, never silently.
  const act=previous.expressive_act;
  const releasedAct=act&&act.basis_expression_revision!==String(document.revision)?act:null;
  if(releasedAct)setNotice(`ExpressiveAct ${releasedAct.expressive_act_ref} released: the live Expression moved past its basis ${releasedAct.basis_expression_revision}`);
  const next=buildDialogueContext({
   context_ref:previous.context_ref,
   nara_ref:previous.nara_ref,
   subject_ref:previous.subject_ref,
   agent_session_ref:previous.agent_session_ref,
   coordinate_ref:previous.coordinate_ref,
   m4_branch:previous.m4_branch,
   bimba:previous.bimba,
   expression_ref:document.expression_ref,
   expression_revision:String(document.revision),
   profile_ref:previous.profile_ref,
   profile_revision:previous.profile_revision,
   scene_ref:document.selection.scene_ref,
   active_m_focus:previous.active_m_focus,
   pointed_ref:selected?.subject?.subject_ref??null,
   hovered_ref:previous.hovered_ref,
   pinned_refs:previous.pinned_refs,
   occasion:previous.occasion,
   disclosed:previous.disclosed,
   available_action_refs:collectAvailableActions(document),
   c_prime:previous.c_prime,
   shared_field:previous.shared_field,
   expressive_act:releasedAct?null:previous.expressive_act,
  });
  current.updateContext(next);
  renderFrom();
  return next;
 },[readDocument,renderFrom]);

 const attach=useCallback(async()=>{
  setError("");setNotice("");
  try{
   const resolution=JSON.parse(resolutionText) as unknown;
   const bimba=bimbaText.trim()?(JSON.parse(bimbaText) as BimbaSelectionBinding):null;
   const constitution=constitutionFromAikitResolution({
    constitution_ref:`speech-constitution:${crypto.randomUUID()}`,
    agent_ref:"agent:nara",
    agency_ref:"agency:nara",
    world_binding_ref:"world:desktop",
    agent_session_ref:`agent-session:${crypto.randomUUID()}`,
    body_ref:bodyRefOf(resolution),
   },resolution,new Date().toISOString());
   const document=await readDocument();
   if(!document)throw new Error("Open or name an Expression before attaching Nara");
   const context=buildDialogueContext({
    context_ref:`dialogue-context:${crypto.randomUUID()}`,
    nara_ref:naraField.trim(),
    subject_ref:subjectField.trim()||document.selection.entity_ref||`subject:${document.expression_ref}`,
    agent_session_ref:constitution.agent_session_ref,
    coordinate_ref:coordinateField.trim(),
    m4_branch:branchOf(coordinateField.trim()),
    bimba,
    expression_ref:document.expression_ref,
    expression_revision:String(document.revision),
    profile_ref:`profile:${document.expression_ref}`,
    profile_revision:"1",
    scene_ref:document.selection.scene_ref,
    active_m_focus:"m4",
    pinned_refs:[],
    disclosed:[],
    available_action_refs:collectAvailableActions(document),
   });
   client.current=NaraSpeechBinding.constitute({
    constitution,
    dialogue_context:context,
    // Governance: explicit lists. Absence is not permission. The desktop
    // allows only the reversible focus action the Expression owner discloses.
    allowed_action_refs:["action:expression.focus"],
    denied_action_refs:[],
   });
   setChangeReceipt(null);setProposals([]);setTurns([]);setInterruptReceipt(null);setToolReceipt(null);setHighlight(null);setFloor(null);
   // The caller-side composition check: does the resolved body satisfy the
   // QL dialogical floor? Computed and disclosed at attach, recomputed at
   // reconnect — floor unmet is a fact, never an error.
   const floorReceipt=voiceBodySatisfactionReceipt({
    satisfaction_ref:`voice-body-satisfaction:${crypto.randomUUID()}`,
    nara_ref:context.nara_ref,
    reduction:voiceBodyFromConstitution({constitution,nara_ref:context.nara_ref}),
    evaluated_at:new Date().toISOString(),
   });
   setFloor(floorReceipt);
   renderFrom();
   setNotice(`Nara attached to ${constitution.body_ref}${speechCapableWord(constitution)} · QL dialogical floor ${floorReceipt["satisfied"]?"met":"unmet: "+(floorReceipt["unmet"] as string[]).join("; ")}`);
  }catch(e){setError(String(e));}
 },[resolutionText,bimbaText,naraField,subjectField,coordinateField,readDocument,renderFrom]);

 /** Reconnect / body change: a new resolution, the same Nara identity. */
 const reconnect=useCallback(async()=>{
  setError("");setNotice("");
  try{
   const current=client.current;
   if(!current)throw new Error("Nara is not attached");
   const before=current.constitutionNow;
   const next=constitutionFromAikitResolution({
    constitution_ref:`speech-constitution:${crypto.randomUUID()}`,
    agent_ref:before.agent_ref,
    agency_ref:before.agency_ref,
    world_binding_ref:before.world_binding_ref,
    agent_session_ref:`agent-session:${crypto.randomUUID()}`,
    body_ref:bodyRefOf(JSON.parse(resolutionText) as unknown),
   },JSON.parse(resolutionText) as unknown,new Date().toISOString());
   const context=await buildTurnContext();
   const change=current.reconnect({
    change_ref:`speech-constitution-change:${crypto.randomUUID()}`,
    next_constitution:next,
    next_context:{...context,agent_session_ref:next.agent_session_ref},
    reason:"body re-resolved; the canonical Nara and its dialogue continue",
    evidence_refs:[`aikit:model-runtime:${before.harness_composition_ref??before.body_ref}@reconnect`],
    at:new Date().toISOString(),
   });
   setChangeReceipt(change);
   const floorReceipt=voiceBodySatisfactionReceipt({
    satisfaction_ref:`voice-body-satisfaction:${crypto.randomUUID()}`,
    nara_ref:current.contextNow.nara_ref,
    reduction:voiceBodyFromConstitution({constitution:next,nara_ref:current.contextNow.nara_ref}),
    evaluated_at:new Date().toISOString(),
   });
   setFloor(floorReceipt);
   renderFrom();
   setNotice(`Body changed${change.delta.body_changed?" to a different body":" in place"}; speech capable: ${change.delta.speech_capable_after}; Agent/Agency identity preserved · QL dialogical floor ${floorReceipt["satisfied"]?"met":"unmet: "+(floorReceipt["unmet"] as string[]).join("; ")}`);
  }catch(e){setError(String(e));}
 },[resolutionText,buildTurnContext,renderFrom]);

 /** Deixis: the application already owns the ref; the request is exact. */
 const point=useCallback(async(kind:DeicticKind,refId:string,targetKind:SemanticTargetKind)=>{
  setError("");
  try{
   const current=client.current;
   if(!current)throw new Error("Nara is not attached");
   const context=await buildTurnContext();
   const resolution=resolveDeixis(context,buildDeixisRequest({
    deixis_ref:`deixis:${crypto.randomUUID()}`,
    nara_ref:context.nara_ref,
    turn_ref:`turn:${crypto.randomUUID()}`,
    basis_expression_revision:context.expression_revision,
    kind,target:{target:"exact",ref_id:refId,target_kind:targetKind},
    requested_at_unix_ms:Date.now(),
   }));
   await applyDeixis(resolution);
  }catch(e){setError(String(e));}
 },[buildTurnContext]);

 /** Execute a resolved deixis against the LIVE Expression stage (the ES1
  * focus wiring): the plan names real operations — a committed kernel focus
  * edit, the live presentation's selection movement, a pure highlight — and
  * operations the stage does not carry are named unavailable, never faked. */
 const applyDeixis=useCallback(async(resolution:DeixisResolution)=>{
  setError("");
  if(resolution.outcome.outcome==="unresolved-outside-context"){
   setNotice(`"${resolution.outcome.ref_id}" is not admitted to this Nara's context — nothing was invented in its place`);
   return;
  }
  const document=await readDocument();
  if(!document){setError("No live Expression document; Nara's focus plan has nothing real to move");return;}
  const plan=stageFocusPlan(resolution,document);
  const notices:string[]=[];
  try{
   for(const operation of plan.operations){
    if(operation.op==="kernel-focus"){
     const moved=await focusEntity(operation.entity_ref,operation.subject_ref);
     if(moved)notices.push(`Nara focused ${operation.subject_ref}; Expression revision ${moved.revision}, stage selection follows`);
    }else if(operation.op==="stage-select"){
     // The committed kernel focus is semantic; this moves the live
     // presentation's own decoration to match it immediately.
     stage.focusSelection([operation.entity_ref]);
    }else if(operation.op==="stage-highlight"){
     const moved=stage.focusSelection([operation.entity_ref]);
     setHighlight({ref:operation.subject_ref,action:"highlight"});
     notices.push(moved
      ?`Nara highlights ${operation.subject_ref} on the live Expression stage`
      :`Nara highlights ${operation.subject_ref}; no live Expression stage presentation stands, so the highlight is named and nothing was moved`);
    }else{
     setHighlight(null);
     notices.push(`Nara returned open for ${operation.subject_ref}: ${operation.reason}`);
    }
   }
   for(const refId of plan.unmapped){
    notices.push(`Nara returned ${refId}, which no bound entity in this Expression carries; the stage was not moved`);
   }
   if(notices.length)setNotice(notices.join(" · "));
  }catch(e){setError(String(e));}
 },[readDocument,stage]);

 /** Focus a bound entity for real: a committed, reversible kernel edit on
  * the exact entity the plan mapped. Returns the moved document, or null
  * when the ref no longer sits on any bound entity (named upstream). */
 const focusEntity=useCallback(async(entityRef:string,subjectRef:string):Promise<ExpressionDocument|null>=>{
  const document=await readDocument();
  const current=client.current;
  if(!document||!current)throw new Error("No live Expression document");
  const entity=document.entities[entityRef];
  if(!entity||entity.subject?.subject_ref!==subjectRef){
   throw new Error(`${subjectRef} no longer sits on entity ${entityRef}; the focus was not committed`);
  }
  const scene=document.scenes.find(candidate=>candidate.scene_ref===document.selection.scene_ref)??document.scenes[0];
  const changes:Change[]=[];
  if(!scene.entity_refs.includes(entity.entity_ref))changes.push({change:"scene_compose",scene_ref:scene.scene_ref,entity_refs:[...scene.entity_refs,entity.entity_ref]});
  changes.push({change:"focus",scene_ref:scene.scene_ref,entity_ref:entity.entity_ref});
  const moved=await editExpression(changes);
  setHighlight({ref:subjectRef,action:"select"});
  return moved;
 },[readDocument]);

 const editExpression=useCallback(async(changes:Change[]):Promise<ExpressionDocument|null>=>{
  const document=doc.current;
  if(!document)throw new Error("No live Expression document");
  const reply=await kernelOp(kernel.transport,{op:"expression",request:{
   operation:"edit",expression_ref:document.expression_ref,expected_revision:document.revision,
   actor:`nara:${client.current?.naraRef??"desktop"}`,changes}});
  if(reply.error||!reply.outcome||reply.outcome.result!=="expression")throw new Error(reply.error??"Expression edit refused");
  const data=reply.outcome.data as {state?:string;document?:ExpressionDocument};
  if(data.state!=="ready"||!data.document)throw new Error(`Expression edit did not apply: ${JSON.stringify(data)}`);
  doc.current=data.document;
  return data.document;
 },[kernel.transport]);

 /** Point the current selection at Nara (the person's own pointing act). */
 const pointSelection=useCallback(async()=>{
  const document=await readDocument();
  const selected=document?.selection.entity_ref?document.entities[document.selection.entity_ref]:null;
  if(!selected?.subject){
   setNotice("The current selection carries no bound subject ref; there is nothing exact to point with");
   return;
  }
  await point("pointed",selected.subject.subject_ref,"subject");
 },[readDocument,point]);

 /** Point the current selection as a highlight: the QL hovered deixis kind —
  * a pure presentation movement on the live stage, no document change. */
 const highlightSelection=useCallback(async()=>{
  const document=await readDocument();
  const selected=document?.selection.entity_ref?document.entities[document.selection.entity_ref]:null;
  if(!selected?.subject){
   setNotice("The current selection carries no bound subject ref; there is nothing exact to highlight");
   return;
  }
  await point("hovered",selected.subject.subject_ref,"subject");
 },[readDocument,point]);

 /** One text turn — the honest fallback that always exists. */
 const sendText=useCallback(async()=>{
  setError("");
  try{
   const current=client.current;
   if(!current)throw new Error("Nara is not attached");
   const text=composer.current?.value.trim()??"";
   if(!text)return;
   if(composer.current)composer.current.value="";
   setTurns(rows=>[...rows,{role:"person",text}]);
   await buildTurnContext();
   current.beginListening();
   current.beginResponse(`response:${crypto.randomUUID()}`);
   renderFrom();
   // The turn's response content rides the canonical dialogue owner (the
   // agent session) when one is joined. Without that owner the turn is
   // honest about what happened: the bounded context advanced; no response
   // content is manufactured here.
   current.commitResult(`result:context-advance:${current.contextNow.expression_revision}`);
   current.completeResponse();
   setTurns(rows=>[...rows,{role:"nara",text:`[context advanced to revision ${current.contextNow.expression_revision}; response content rides the canonical dialogue owner]`}]);
   renderFrom();
  }catch(e){setError(String(e));renderFrom();}
 },[buildTurnContext,renderFrom]);

 /** Push-to-talk: real capture, honestly gated by the constitution. A gated
  * or absent body never presents the affordance as live. */
 const holdToTalk=useCallback(async()=>{
  const current=client.current;
  if(!current)return;
  const refusal=holdToTalkRefusal(current.constitutionNow);
  if(refusal){
   setNotice(refusal);
   return;
  }
  try{
   setMic("requesting");
   const media=await navigator.mediaDevices.getUserMedia({audio:true});
   stream.current=media;
   setMic("live");
   current.beginListening();
   renderFrom();
  }catch(e){
   stream.current=null;
   const denied=e instanceof DOMException&&e.name==="NotAllowedError";
   setMic(denied?"denied":"unavailable");
   setNotice(denied?"Microphone permission was refused by the operating system; text is available":"No microphone is reachable; text is available");
   renderFrom();
  }
 },[renderFrom]);

 const releaseTalk=useCallback(()=>{
  stream.current?.getTracks().forEach(track=>track.stop());
  stream.current=null;
  setMic("idle");
  const current=client.current;
  if(current&&current.phaseNow==="listening")current.endListening();
  renderFrom();
 },[renderFrom]);

 /** Interrupt: the Actuation receipt drives BOTH the speech stop and the
  * choreography hold/cancel; session and identity survive. */
 const interrupt=useCallback(()=>{
  setError("");
  try{
   const current=client.current;
   if(!current)throw new Error("Nara is not attached");
   const receipt=current.interrupt({interruption_ref:`interruption:${crypto.randomUUID()}`,reason:"person interrupted",at:new Date().toISOString()});
   setInterruptReceipt(receipt as unknown as Record<string,unknown>);
   const generic=receipt.interruption_receipt as {outcome:string;phase_after:string};
   const act=current.contextNow.expressive_act;
   if(choreography){
    const held=interruptChoreography(choreography);
    setChoreography({...choreography,pending:[],running:held.finish});
    if(act&&act.phase==="active")current.nextTurnContext({expressive_act:interruptExpressiveAct(act)});
    setNotice(`Interrupt ${generic.outcome}: speech ${generic.phase_after}; choreography ${held.disposition} (cancelled ${held.cancelled.length}, finishing ${held.finish?1:0}, stood ${held.stood.length}); session survives`);
   }else if(act&&act.phase==="active"){
    current.nextTurnContext({expressive_act:interruptExpressiveAct(act)});
    setNotice(`Interrupt ${generic.outcome}: speech ${generic.phase_after}; the live act held (no pending choreography)`);
   }else{
    setNotice(`Interrupt ${generic.outcome}: speech ${generic.phase_after}`);
   }
   renderFrom();
  }catch(e){setError(String(e));}
 },[choreography,renderFrom]);

 /** Begin one short reversible Expression act with speech. */
 const performAct=useCallback(async()=>{
  setError("");
  try{
   const current=client.current;
   if(!current)throw new Error("Nara is not attached");
   const context=await buildTurnContext();
   const turnRef=`turn:${crypto.randomUUID()}`;
   const actRef=`expressive-act:${crypto.randomUUID()}`;
   const steps=planChoreography(actRef,[
    {step_ref:`${actRef}:step:focus-locus`,summary:"focus the pointed locus",atomic_safe:true,reversible:true},
    {step_ref:`${actRef}:step:second-move`,summary:"continue the presentation movement",atomic_safe:false,reversible:true},
   ]);
   current.nextTurnContext({expressive_act:beginExpressiveAct({
    expressive_act_ref:actRef,
    basis_expression_revision:context.expression_revision,
    speech_turn_ref:turnRef,
    checkpoint:{checkpoint_ref:`checkpoint:r${context.expression_revision}`,checkpoint_expression_revision:context.expression_revision},
   })});
   current.beginResponse(`response:${crypto.randomUUID()}`);
   setChoreography(steps);
   renderFrom();
   // Perform the first (atomic-safe) step for real, then pause at the
   // boundary: the act is interruptible from here.
   const step=takeChoreographyStep(steps);
   const document=await readDocument();
   if(step&&document){
    const earth=Object.values(document.entities).find(candidate=>candidate.title==="EarthBody"||candidate.subject?.subject_ref?.includes("earth"));
    const target=earth??Object.values(document.entities)[0];
    if(target){
     const scene=document.scenes.find(candidate=>candidate.scene_ref===document.selection.scene_ref)??document.scenes[0];
     await editExpression([{change:"focus",scene_ref:scene.scene_ref,entity_ref:target.entity_ref}]);
     completeChoreographyStep(steps);
    }
   }
   setNotice("ExpressiveAct live: speech and reversible choreography correlated; interrupt holds both");
   renderFrom();
  }catch(e){setError(String(e));}
 },[buildTurnContext,readDocument,editExpression,renderFrom]);

 /** Restore the authored checkpoint ("go back"): a named return. */
 const restoreCheckpoint=useCallback(()=>{
  const current=client.current;
  if(!current)return;
  try{
   const act=current.contextNow.expressive_act;
   if(!act?.checkpoint)throw new Error("The act carries no authored checkpoint");
   const restored=restoreExpressiveActCheckpoint(act,act.checkpoint.checkpoint_ref,act.checkpoint.checkpoint_expression_revision);
   current.nextTurnContext({expressive_act:restored});
   setNotice(`Restored checkpoint ${restored.checkpoint?.checkpoint_ref} — the act continues from the authored state`);
   renderFrom();
  }catch(e){setError(String(e));}
 },[renderFrom]);

 /** Delegate the composer's question to Epii over admitted refs only. */
 const delegateToEpii=useCallback(async()=>{
  setError("");
  try{
   const current=client.current;
   if(!current)throw new Error("Nara is not attached");
   const context=await buildTurnContext();
   const brief=composer.current?.value.trim()||"What stands behind the pointed relation?";
   if(composer.current)composer.current.value="";
   const delegation=buildEpiiDelegation({
    delegation_ref:`delegation:${crypto.randomUUID()}`,
    context,
    epii_session_ref:"epii:session:desktop",
    brief,
    scope_candidates:context.disclosed.map(entry=>entry.ref_id),
    delegated_at_unix_ms:Date.now(),
   });
   const receipt=current.recordDelegation(delegation,{delegation_receipt_ref:`delegation-receipt:${crypto.randomUUID()}`,at:new Date().toISOString()});
   renderFrom();
   setNotice(`Delegated to Epii over ${delegation.scope_refs.length} admitted refs; Nara stays foreground`);
   const row:ProposalRow={delegation:delegation as unknown as Record<string,unknown>,delegation_receipt:receipt,enrichment:null,enrichment_receipt:null};
   setProposals(rows=>[...rows,row]);
   putDelegationLedger({...row,recorded_at:new Date().toISOString()});
  }catch(e){setError(String(e));}
 },[buildTurnContext,renderFrom]);

 /** Receive an Epii result against one open delegation: retained, never
  * applied. With `enrichment` absent, a current-basis proof body is derived
  * from the delegation's own basis. */
 const receiveEnrichment=useCallback(async(index:number,enrichment?:Record<string,unknown>)=>{
  setError("");
  try{
   const current=client.current;
   if(!current)throw new Error("Nara is not attached");
   const row=proposals[index];
   if(!row)throw new Error("No such delegation row");
   await buildTurnContext();
   const basis=typeof enrichment==="undefined"?{
    ...(row.delegation as {basis:Record<string,unknown>}).basis,
    basis_context_ref:(row.delegation as {basis:Record<string,unknown>}).basis.context_ref,
    basis_expression_revision:(row.delegation as {basis:Record<string,unknown>}).basis.expression_revision,
   }:enrichment;
   const receipt=current.recordEnrichment({
    schema:"ql.epii-enrichment/v1",
    enrichment_ref:"enrichment:desktop-proof",
    delegation_ref:row.delegation["delegation_ref"],
    ...basis,
    coordinate_refs:[],source_refs:[],method_refs:[],evidence_refs:[],
    standing:"derived",
    synthesis:"The disclosed source bears on the pointed relation through its conjugate face.",
    proposed_focus_refs:[],proposed_scene_change_refs:[],proposed_profile_variant_ref:null,
    proposed_expressive_act_refs:[],proposed_native_action_refs:[],
    continuing_questions:[],factory_commission_proposal:null,returned_at_unix_ms:Date.now(),
   },{enrichment_receipt_ref:`enrichment-receipt:${crypto.randomUUID()}`,at:new Date().toISOString()});
   const enriched=(rows:ProposalRow[])=>rows.map((candidate,i)=>i===index?{...candidate,enrichment:enrichment??null,enrichment_receipt:receipt}:candidate);
   setProposals(enriched);
   putDelegationLedger({...row,recorded_at:new Date().toISOString()});
   renderFrom();
   setNotice(`Epii enrichment ${String(receipt["standing"])} — presented as a proposal; applied: ${String(receipt["applied"])}`);
  }catch(e){setError(String(e));}
 },[proposals,buildTurnContext,renderFrom]);

 /** Authority proof: a speech-model tool request is a request, never a
  * canonical Action. Refusal happens before any effect; an authorised
  * request executes separately through the real seam. */
 const proveRefusal=useCallback(async()=>{
  const current=client.current;
  if(!current || toolPending)return;
  setToolPending(true);setError("");
  try{
   const decision=current.adjudicateToolRequest({
    decision_ref:`decision:${crypto.randomUUID()}`,
    request:{
     schema:"actuation.speech-tool-decision/v1",
     request_ref:`request:${crypto.randomUUID()}`,
     constitution_ref:current.constitutionNow.constitution_ref,
     agent_session_ref:current.constitutionNow.agent_session_ref,
     proposed_action_ref:"central.source.write",
     payload_refs:["source:some-undisclosed-source"],
     requested_at:new Date().toISOString(),
    },
    decided_by:"person:desktop",
    at:new Date().toISOString(),
   });
   if(decision.resolution.resolution!=="refused")throw new Error("the refusal proof expected a refusal");
   await recordToolDecision(kernel.apply,decision,kernel.lastOpError);
   setToolReceipt({decision,execution:null});
   setNotice(`Tool request refused before effect (${decision.resolution.stage}): no dispatch happened`);
   renderFrom();
  }catch(e){setError(String(e));}finally{setToolPending(false);}
 },[renderFrom,kernel.apply,toolPending]);

 const proveAuthorised=useCallback(async()=>{
  const current=client.current;
  if(!current || toolPending)return;
  setToolPending(true);setError("");
  try{
   const decision=current.adjudicateToolRequest({
    decision_ref:`decision:${crypto.randomUUID()}`,
    request:{
     schema:"actuation.speech-tool-decision/v1",
     request_ref:`request:${crypto.randomUUID()}`,
     constitution_ref:current.constitutionNow.constitution_ref,
     agent_session_ref:current.constitutionNow.agent_session_ref,
     proposed_action_ref:"action:expression.focus",
     payload_refs:["bimba:relation:1"],
     requested_at:new Date().toISOString(),
    },
    decided_by:"person:desktop",
    at:new Date().toISOString(),
   });
   if(decision.resolution.resolution!=="authorised")throw new Error("the authorised proof expected authorisation");
   await recordToolDecision(kernel.apply,decision,kernel.lastOpError);
   // Execution is a separate receipt — and a real dispatch: the focus the
   // action names crosses the kernel expression seam here.
   await buildTurnContext();
   const document=await readDocument();
   if(!document)throw new Error("No live Expression document");
   const target=Object.values(document.entities).find(candidate=>candidate.subject?.subject_ref==="bimba:relation:1")
    ??Object.values(document.entities).find(candidate=>candidate.title==="EarthBody")
    ??Object.values(document.entities)[0];
   if(!target)throw new Error("No entity to focus");
   const scene=document.scenes.find(candidate=>candidate.scene_ref===document.selection.scene_ref)??document.scenes[0];
   const applied=await editExpression([{change:"focus",scene_ref:scene.scene_ref,entity_ref:target.entity_ref}]);
   if(!applied)throw new Error(kernel.lastOpError() || "The authorised focus was not applied; no execution receipt was recorded.");
   const execution=current.recordExecution(decision,{
    execution_ref:`execution:${crypto.randomUUID()}`,
    owner_operation:"expression.edit",
    result:{state:"ready",revision:applied?.revision},
    evidence_refs:[`expression:${document.expression_ref}@${applied?.revision??document.revision}`],
    executed_at:new Date().toISOString(),
   });
   setToolReceipt({decision,execution:execution as unknown as Record<string,unknown>});
   setNotice(`Authorised tool request executed as expression.edit at revision ${applied?.revision}; receipts recorded`);
   renderFrom();
  }catch(e){setError(String(e));}finally{setToolPending(false);}
 },[buildTurnContext,readDocument,editExpression,renderFrom,kernel.apply,toolPending]);

 if(!read||!client.current)return <section className="nara-surface" aria-label="Nara presence" data-nara="unattached">
  <p className="oi-note">No canonical Nara is attached to a speech body. Attach consumes the AIKit-resolved body; the cradle invents no resolution and no voice.</p>
  <details className="oi-disclosure nara-attach"><summary>Attach canonical Nara to a resolved body</summary>
   <label className="oi-field">AIKit resolution read model<textarea className="oi-input nara-resolution" aria-label="AIKit resolution read model" spellCheck={false} value={resolutionText} onChange={e=>setResolutionText(e.target.value)} placeholder='{"version":"1","composed_modality":{…}}'/></label>
   <label className="oi-field">Bimba selection binding (optional)<input className="oi-input" aria-label="Bimba selection binding" spellCheck={false} value={bimbaText} onChange={e=>setBimbaText(e.target.value)}/></label>
   <div className="nara-attach-grid">
    <label className="oi-field">Expression ref<input className="oi-input" aria-label="Expression ref" value={expressionRefField} onChange={e=>setExpressionRefField(e.target.value)}/></label>
    <label className="oi-field">Subject ref<input className="oi-input" aria-label="Subject ref" value={subjectField} onChange={e=>setSubjectField(e.target.value)}/></label>
    <label className="oi-field">Coordinate<input className="oi-input" aria-label="Coordinate" value={coordinateField} onChange={e=>setCoordinateField(e.target.value)}/></label>
    <label className="oi-field">Nara ref<input className="oi-input" aria-label="Nara ref" value={naraField} onChange={e=>setNaraField(e.target.value)}/></label>
   </div>
   <button className="oi-action oi-action-primary" disabled={!resolutionText.trim()} onClick={()=>void attach()}>Attach</button>
  </details>
  {error&&<p role="alert" className="oi-note">{error}</p>}
 </section>;

 return <section className="nara-surface" aria-label="Nara presence" data-nara={read.nara_ref} data-phase={read.phase}>
  <header className="nara-head oi-context-head" ref={head}>
   <div className="oi-context-head-title">
    <h3>Nara <span className="oi-ref">{read.nara_ref}</span></h3>
    <small data-nara-phase={read.phase}>{PHASE_WORD[read.phase]}{mic==="live"?" · microphone live":mic==="denied"?" · microphone refused by the OS":mic==="unavailable"?" · microphone unreachable":""}</small>
   </div>
   <div className="oi-action-group">
    {(()=>{
     const talkLive=holdToTalkLive(client.current.constitutionNow);
     const refusal=holdToTalkRefusal(client.current.constitutionNow);
     return <button className="oi-action" aria-pressed={mic==="live"} disabled={!talkLive}
      onMouseDown={()=>void holdToTalk()} onMouseUp={releaseTalk} onTouchStart={()=>void holdToTalk()} onTouchEnd={releaseTalk}
      title={talkLive?"Hold to capture audio for the constituted body":refusal??""}>Hold to talk</button>;
    })()}
    <button className="oi-action" onClick={interrupt} title={supportUsable(read.interruption)?"Stop speech and hold pending choreography":"This body cannot be trusted to cancel cleanly; the refusal is recorded honestly"}>Interrupt</button>
    <button className="oi-action" onClick={()=>void reconnect()} title="Change or reconnect the body without reminting Nara">Reconnect body</button>
   </div>
  </header>
  {error&&<p role="alert" className="oi-note">{error}</p>}
  {notice&&<p className="oi-note" data-nara-notice>{notice}</p>}
  <dl className="nara-capabilities" aria-label="Disclosed body capabilities">
   <dt>voice</dt><dd data-capability="speech">{read.speech_capable?"supported":"unsupported"}</dd>
   <dt>text</dt><dd data-capability="text">{read.text_capable?"supported":"unsupported"}</dd>
   <dt>full duplex</dt><dd data-capability="duplex">{capWord(read.full_duplex_realtime)}</dd>
   <dt>VAD</dt><dd data-capability="vad">{capWord(read.vad_turn_detection)}</dd>
   <dt>barge-in</dt><dd data-capability="barge-in">{capWord(read.barge_in)}</dd>
   <dt>interruption</dt><dd data-capability="interruption">{capWord(read.interruption)}</dd>
   <dt>transcripts</dt><dd data-capability="transcripts">{capWord(read.final_transcripts)}</dd>
   <dt>reconnect</dt><dd data-capability="reconnect">{read.reconnect??"stateless"}</dd>
   <dt>QL dialogical floor</dt><dd data-capability="voice-floor">{floor?(floor["satisfied"]?"met":"unmet"):"—"}</dd>
  </dl>
  {(()=>{const body=naraBodyState(client.current.constitutionNow);
   if(body.state==="live")return null;
   if(body.state==="absent")return <p className="oi-note" data-nara-body-state="absent">{body.line}</p>;
   return <div className="oi-note" data-nara-body-state="option" data-nara-body-usable={body.usable?"usable":"unusable"}>
    <p data-nara-body-state-line>{body.line}</p>
    <ul data-nara-body-gaps>{body.gaps.map((gap,index)=><li key={index} data-nara-body-gap={gap.condition}>{gap.line}</li>)}</ul>
    {body.credential.line&&<p data-nara-credential>{body.credential.line}</p>}
   </div>;
  })()}
  {floor&&!floor["satisfied"]&&<p className="oi-note" data-voice-floor-unmet>Dialogical floor unmet for {String(floor["body_ref"])}: {(floor["unmet"] as string[]).join("; ")}. The composition is honest about the gap; it does not claim foreground dialogical speech.</p>}
  <div className="nara-composer oi-action-group">
   <input ref={composer} className="oi-input" aria-label="Message Nara" placeholder="Text is always available" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void sendText();}}}/>
   <button className="oi-action oi-action-primary" onClick={()=>void sendText()}>Send</button>
   <button className="oi-action" onClick={()=>void pointSelection()} title="Point the current selection to Nara as an exact ref">Point selection</button>
   <button className="oi-action" onClick={()=>void highlightSelection()} title="Point the current selection as a highlight: the live stage moves, the document does not">Highlight selection</button>
   <button className="oi-action" onClick={()=>void delegateToEpii()}>Delegate to Epii</button>
  </div>
  <section className="nara-act oi-section" aria-label="ExpressiveAct" data-act-phase={context?.expressive_act?.phase??"none"}>
   <h3>ExpressiveAct {context?.expressive_act?<span className="oi-state">{context.expressive_act.phase}{context.expressive_act.speech_turn_ref?" · speech coupled":""}</span>:<span className="oi-state">none live</span>}</h3>
   <div className="oi-action-group">
    <button className="oi-action" onClick={()=>void performAct()}>Perform reversible act with speech</button>
    <button className="oi-action" onClick={interrupt}>Hold</button>
    <button className="oi-action" onClick={restoreCheckpoint}>Back to checkpoint</button>
   </div>
   {choreography&&<ul className="nara-choreography" aria-label="Choreography steps">
    {choreography.completed.map(step=><li key={step.step_ref} data-step="stood">{step.summary} — stood</li>)}
    {choreography.running?<li data-step="running">{choreography.running.summary} — running</li>:null}
    {choreography.pending.map(step=><li key={step.step_ref} data-step="pending">{step.summary} — pending</li>)}
   </ul>}
  </section>
  {highlight&&<p className="oi-note" data-nara-highlight>Nara {highlight.action}: <span className="oi-ref">{highlight.ref}</span></p>}
  <details className="oi-disclosure nara-next-body"><summary>Next body resolution <span className="oi-state">consumed by Reconnect</span></summary>
   <label className="oi-field">AIKit resolution read model<textarea className="oi-input nara-resolution" aria-label="Next body resolution" spellCheck={false} value={resolutionText} onChange={e=>setResolutionText(e.target.value)}/></label>
  </details>
  <details className="oi-disclosure nara-authority"><summary>Authority proofs <span className="oi-state">{toolReceipt?toolReceipt.decision.resolution.resolution:"none run"}</span></summary>
   <p className="oi-note">A speech tool request is a request, never a canonical Action: refusal happens before any effect; authorisation and execution are separate receipts.</p>
   <div className="oi-action-group">
    <button className="oi-action" disabled={toolPending} onClick={()=>void proveRefusal()}>Request refused (unauthorised action)</button>
    <button className="oi-action" disabled={toolPending} onClick={()=>void proveAuthorised()}>Request authorised focus (executes for real)</button>
   </div>
   {toolReceipt&&<pre data-tool-receipt>{JSON.stringify(toolReceipt,null,2)}</pre>}
  </details>
  {proposals.length>0&&<section className="nara-proposals oi-section" aria-label="Returned Epii material">
   <h3>Epii proposals <span className="oi-state">retained, not applied</span></h3>
   {proposals.map((row,index)=><article key={String(row.delegation["delegation_ref"])} className="nara-proposal">
    <p>{row.enrichment_receipt?String(row.enrichment_receipt["standing"]):"Delegation open; Epii has not returned."}</p>
    {row.enrichment_receipt
     ?<dl className="nara-proposal-facts">
      <dt>standing</dt><dd>{String(row.enrichment_receipt["standing"])}</dd>
      <dt>applied</dt><dd>{String(row.enrichment_receipt["applied"])}</dd>
      <dt>currentness</dt><dd>{JSON.stringify(row.enrichment_receipt["currentness"])}</dd>
     </dl>
     :<button className="oi-action" onClick={()=>void receiveEnrichment(index)}>Receive returned enrichment (proof)</button>}
   </article>)}
  </section>}
  {changeReceipt&&<details className="oi-disclosure" open data-change-receipt><summary>Last body change <span className="oi-state">{changeReceipt.delta.body_changed?"body swapped":"in place"} · interruption {changeReceipt.delta.interruption_after.state}</span></summary>
   <pre>{JSON.stringify(changeReceipt.delta,null,2)}</pre></details>}
  {interruptReceipt&&<details className="oi-disclosure" data-interruption-receipt><summary>Interruption receipt <span className="oi-state">{String((interruptReceipt["interruption_receipt"] as Record<string,unknown>|undefined)?.["outcome"])}</span></summary>
   <pre>{JSON.stringify(interruptReceipt,null,2)}</pre></details>}
  <details className="oi-disclosure nara-transcript"><summary>Dialogue transcript <span className="oi-state">{turns.length}</span></summary>
   <ol>{turns.map((row,index)=><li key={index} className={`nara-turn nara-turn-${row.role}`}>{row.text}</li>)}</ol>
   {turns.length===0&&<p className="oi-note">No turns yet. Nothing is simulated here.</p>}
  </details>
   <details className="oi-disclosure"><summary>Session read and bounded context</summary><pre>{JSON.stringify({read,context,floor},null,2)}</pre></details>
 </section>;
}

function collectAvailableActions(document:ExpressionDocument):string[] {
 const refs=new Set<string>();
 for(const entity of Object.values(document.entities))for(const action of entity.subject?.actions??[])refs.add(action.action_ref);
 return [...refs];
}

function speechCapableWord(constitution:SpeechConstitutionFacts):string {
 return constitution.output_modalities.some(m=>m==="audio"||m==="speech")?" (acoustic output declared)":" (text body)";
}

function bodyRefOf(resolution:unknown):string {
 const document=(resolution??{}) as Record<string,unknown>;
 if(document["relation"]){
  const relation=document["relation"] as Record<string,unknown>;
  const surface=relation["model_surface"] as Record<string,unknown>|undefined;
  if(surface&&typeof surface["surface"]==="string")return surface["surface"];
  const model=relation["model"] as Record<string,unknown>|undefined;
  if(model&&typeof model["model"]==="string")return model["model"];
 }
 if(Array.isArray(document["stages"])&&document["stages"].length){
  const stages=document["stages"] as Record<string,unknown>[];
  const last=stages[stages.length-1];
  if(last&&typeof last["component"]==="string")return String(last["component"]);
 }
 if(Array.isArray(document["surfaces"])&&document["surfaces"].length){
  const surfaces=document["surfaces"] as Record<string,unknown>[];
  const last=surfaces[surfaces.length-1];
  if(last&&typeof last["surface"]==="string")return String(last["surface"]);
 }
 throw new Error("The resolution carries no body surface ref; the desktop invents none");
}

function branchOf(coordinate:string):M4Branch|null {
 if(!coordinate.startsWith("M4"))return null;
 const branches=["identity","embodied","oracle","transformation","context","integration"];
 return (branches[Number(coordinate.split(".")[1]?.[0]??NaN)]??null) as M4Branch|null;
}

function capWord(support:SpeechSupport):string {
 return support.state==="supported"?"supported":support.state;
}
