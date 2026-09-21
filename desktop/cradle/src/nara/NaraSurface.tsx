/** Foreground Nara over the existing native encounter and Expression world.
 * No generated identities, pretend responses, test buttons or auto-microphone.
 * Saved Central attachment source selects the native QL/Actuation/session and
 * optional speech route facts. Selection is disclosed only by an explicit act.
 */
import {useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {encounter} from "../encounter/client";
import {worldOp,type WorldSelection} from "../expression/world";
import type {ExpressionDocument} from "../expression/types";
import type {KernelTransportStatus} from "../kernel/types";
import type {SurfaceBinding} from "../surface/types";
import {BrowserSpeechAudio} from "./audio";
import {NaraRuntime,type NaraRuntimeSnapshot} from "./runtime";
import {NaraPresentation,selectedContext} from "./presentation";
import {readNativeSession,validateAttachment} from "./nativeDialogue";
import {requireObject} from "./support";
import {PersonalWorkbench} from "./personal/PersonalWorkbench";
import "./nara.css";

interface HeldEncounter {channel:{current:KernelTransportStatus};abort:{current:AbortController|null};runtime:NaraRuntime;presentation:NaraPresentation;source_ref:string;source_revision:string}
// Private application-lifetime holders only. No browser storage/export or
// unscoped ledger. Closed/reopened presentations retain the same encounter.
const held=new Map<string,HeldEncounter>(),surfaces=new Map<string,string>();
const LABEL:Record<NaraRuntimeSnapshot["phase"],string>={idle:"At rest",checking:"Checking native session", "requesting-microphone":"Waiting for microphone permission",listening:"Microphone active",transcribing:"Transcribing input",waiting:"Waiting for native response","preparing-audio":"Preparing response audio",speaking:"Playing response",interrupted:"Interrupted",error:"Needs attention",ended:"Detached"};
const BRANCH:Record<string,string>={identity:"Identity · authored sources",embodied:"Receiving centres · EarthBody",oracle:"Oracle · consent and cast",transformation:"Practice · transformation",context:"Context · interpretive lenses",integration:"Integration · source return"};
const keyOf=(a:ReturnType<typeof validateAttachment>)=>JSON.stringify([a.dialogue.project,a.context.nara_ref,a.context.subject_ref,a.dialogue.agent_session]);
const idle:NaraRuntimeSnapshot={phase:"idle",voice_enabled:false,draft:"",notice:"",rows:[],pending:null,inquiries:[]};

export function NaraSurface({binding}:{binding:SurfaceBinding}){
  const kernel=useKernel(),transport=useRef(kernel.transport);transport.current=kernel.transport;
  const initial=held.get(surfaces.get(binding.id)??"");
  const [entry,setEntry]=useState<HeldEncounter|undefined>(initial);
  const [view,setView]=useState<NaraRuntimeSnapshot>(initial?.runtime.getSnapshot()??idle);
  const [source,setSource]=useState(initial?.source_ref??"");
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const [inquiry,setInquiry]=useState("");const [expanded,setExpanded]=useState(false);
  const [presentation,setPresentation]=useState(initial?.presentation.state);
  const mounted=useRef(true),loadGeneration=useRef(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;++loadGeneration.current;};},[]);
  useEffect(()=>{if(entry)entry.channel.current=kernel.transport;},[entry,kernel.transport]);
  useEffect(()=>{if(!entry)return;setView(entry.runtime.getSnapshot());return entry.runtime.subscribe(()=>setView(entry.runtime.getSnapshot()));},[entry]);
  const act=async(work:()=>Promise<unknown>)=>{setError("");setBusy(true);try{await work();}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:"Native operation failed");}finally{if(mounted.current){setBusy(false);setPresentation(entry?.presentation.state);}}};
  const readExpression=async(ref:string):Promise<ExpressionDocument>=>{
    const reply=await kernelOp(transport.current,{op:"expression",request:{operation:"inspect",expression_ref:ref}});
    if(reply.error||reply.outcome?.result!=="expression"||!reply.outcome.data.document)throw new Error("The native Expression reading is unavailable");
    return reply.outcome.data.document;
  };
  const load=()=>act(async()=>{
    const generation=++loadGeneration.current;
    const reply=await kernelOp(transport.current,{op:"source_open",source_ref:source.trim(),...(binding.project?{project:binding.project}:{})});
    if(reply.error||reply.outcome?.result!=="source_opened")throw new Error("The selected native attachment source could not be opened");
    const buffer=reply.outcome.buffer;
    if(buffer.dirty||buffer.conflict||!buffer.base_revision||buffer.content!==buffer.saved_content)throw new Error("Save or reconcile the attachment source before binding it");
    if(buffer.saved_content.length>1048576)throw new Error("The attachment is too large; use bounded native readings");
    const attachment=validateAttachment(JSON.parse(buffer.saved_content));
    if(binding.project&&attachment.dialogue.project!==binding.project)throw new Error("This attachment belongs to a different Project");
    if(binding.ref&&attachment.context.expression_ref!==binding.ref)throw new Error("This attachment belongs to a different Expression");
    const channel={current:transport.current};
    const call=async<T,>(native:typeof attachment.dialogue,request:Parameters<typeof encounter>[2])=>encounter<T>(channel.current,native.project,request);
    await readNativeSession(call,attachment.dialogue);
    const document=await readExpression(attachment.context.expression_ref);
    if(String(document.revision)!==attachment.context.expression_revision)throw new Error("The saved attachment's Expression revision is stale; refresh its native basis");
    if(!mounted.current||generation!==loadGeneration.current)return;
    const key=keyOf(attachment),existing=held.get(key);
    if(entry&&entry!==existing&&entry.runtime.getSnapshot().phase!=="ended")throw new Error("End the current personal attachment explicitly before choosing another");
    if(existing&&existing.runtime.getSnapshot().phase!=="ended"){
      if(existing.source_revision!==buffer.base_revision)throw new Error("The attachment source changed; use the native setup path to review the body before replacing it");
      existing.channel.current=transport.current;surfaces.set(binding.id,key);setEntry(existing);return;
    }
    if(held.size>=16&&!held.has(key))throw new Error("End an unused personal attachment before opening another");
    const abort:{current:AbortController|null}={current:null};
    const expression=new NaraPresentation({read:async ref=>{
      const reply=await kernelOp(channel.current,{op:"expression",request:{operation:"inspect",expression_ref:ref}});
      if(reply.error||reply.outcome?.result!=="expression"||!reply.outcome.data.document)throw new Error("Native Expression reading unavailable");
      return reply.outcome.data.document;
    },world:async request=>requireObject(await worldOp(channel.current,request),"Native Expression world reply")});
    const runtime=new NaraRuntime(attachment,{call,audio:new BrowserSpeechAudio(),hold:async()=>{abort.current?.abort();await expression.hold();}});
    const next={channel,abort,runtime,presentation:expression,source_ref:source.trim(),source_revision:buffer.base_revision};
    held.set(key,next);surfaces.set(binding.id,key);setEntry(next);setPresentation(expression.state);
  });
  const reloadBody=()=>act(async()=>{
    if(!entry)return;
    const reply=await kernelOp(transport.current,{op:"source_open",source_ref:entry.source_ref,...(binding.project?{project:binding.project}:{})});
    if(reply.error||reply.outcome?.result!=="source_opened")throw new Error("Native attachment source unavailable");
    const b=reply.outcome.buffer;
    if(b.dirty||b.conflict||!b.base_revision||b.content!==b.saved_content)throw new Error("Reconcile the attachment source first");
    if(b.saved_content.length>1048576)throw new Error("The attachment is too large");
    const next=validateAttachment(JSON.parse(b.saved_content));
    await entry.runtime.reconnect(next);
    if(entry.runtime.getSnapshot().phase!=="error")entry.source_revision=b.base_revision;
  });
  const stop=()=>act(async()=>{if(entry)await entry.runtime.interrupt();});
  const disclose=()=>act(async()=>{
    if(!entry)return;const current=entry.runtime.binding.context;
    const [document,selection]=await Promise.all([readExpression(current.expression_ref),worldOp(transport.current,{operation:"selection_read"})]);
    const reading=requireObject(selection,"Native selection reply");
    entry.runtime.updateContext(selectedContext(current,document,reading.selection as WorldSelection|undefined));
  });
  const openSource=(ref:string)=>act(async()=>{
    // Source navigation is explicit. It neither uploads nor adds its contents
    // to dialogue. Personal generated replies never become public source.
    const opened=await kernelOp(transport.current,{op:"source_open",source_ref:ref,...(binding.project?{project:binding.project}:{})});
    if(opened.error||opened.outcome?.result!=="source_opened")throw new Error("Native source is unavailable or withheld");
    const result=await kernel.apply({op:"surface_open",surface_id:`nara-source:${ref}`,kind:"source",source_ref:ref,title:"Source"});
    if(!result)throw new Error("The source could not be presented");
  });
  const acceptFocus=(ref:string)=>act(async()=>{
    if(!entry)return;const current=entry.runtime.binding.context;
    const live=await readExpression(current.expression_ref);
    if(String(live.revision)!==current.expression_revision)throw new Error("The Expression advanced; this proposal cannot apply to that newer basis");
    const proposal=entry.runtime.reviewInquiry(ref);
    if(!proposal.enrichment.proposed_focus_refs.length)throw new Error("This result has no executable focus proposal");
    entry.runtime.beginInquiryAcceptance(ref);
    const previousAttempt=entry.presentation.state.attempt;
    const controller=new AbortController();entry.abort.current=controller;
    let settled=false;
    try{const next=await entry.presentation.perform(current,proposal.enrichment.proposed_focus_refs,controller.signal);entry.runtime.updateContext(next,ref);
      if(controller.signal.aborted)throw new Error("Presentation interrupted. Only the confirmed atomic steps stand; no pending focus was applied.");
      entry.runtime.finishInquiryAcceptance(ref,"accepted");settled=true;
    }finally{
      if(!settled){const result=entry.presentation.state;
        entry.runtime.finishInquiryAcceptance(ref,result.attempt===previousAttempt?"pending":result.state==="unknown"?"uncertain":result.completed_refs.length?"partial":"pending");
      }
      if(entry.abort.current===controller)entry.abort.current=null;
    }
  });
  const runtime=entry?.runtime,attachment=runtime?.binding;
  const active=!["idle","interrupted","error","ended"].includes(view.phase);
  const capture=view.phase==="listening"||view.phase==="requesting-microphone"||view.phase==="checking";
  return <section className="nara-surface" data-nara-phase={view.phase} data-private="true" aria-label="Personal Nara encounter">
    <header className="nara-head"><h3>Nara</h3><span role="status">{LABEL[view.phase]}</span></header>
    {error&&<p role="alert" className="oi-refusal">{error}</p>}
    <details><summary>Your personal field and writing</summary><PersonalWorkbench binding={binding} runtime={entry?.runtime}/></details>
    {view.notice&&<p role="status" className="oi-note">{view.notice}</p>}
    {!entry||view.phase==="ended"?<form onSubmit={event=>{event.preventDefault();void load();}} className="nara-composer">
      <label>Saved native Nara attachment<input className="oi-input" aria-label="Nara attachment source" value={source} onChange={event=>setSource(event.target.value)} placeholder="Central source reference"/></label>
      <button type="submit" disabled={busy||!source.trim()}>Attach existing encounter</button>
      <p className="oi-note">Select the protected source containing this Nara's actual QL context, Actuation body and existing native session binding. This does not create a persona, start a model or enable a microphone.</p>
    </form>:<>
      <div className="nara-composer">
        <button type="button" disabled={busy||active||!!view.pending} onClick={()=>void act(()=>runtime!.reconnect())}>Reconnect same encounter</button>
        <button type="button" disabled={busy||active||!!view.pending} onClick={()=>void reloadBody()}>Reload selected body</button>
        {attachment?.speech?<label><input type="checkbox" aria-label="Enable Nara voice" checked={view.voice_enabled} onChange={event=>{if(event.target.checked)void act(async()=>runtime!.enableVoice());else void act(()=>runtime!.disableVoice());}}/>Enable this voice route</label>:<span className="oi-note">Text path only: no executable audio adapter is attached.</span>}
        <button type="button" disabled={busy||!view.voice_enabled||(!capture&&(active||!!view.pending))} onClick={()=>void act(()=>capture?runtime!.finishCapture():runtime!.startCapture())}>{capture?"Finish microphone turn":"Start microphone turn"}</button>
        <button type="button" onClick={()=>void stop()}>Stop audio and hold</button>
        {view.pending&&<button type="button" disabled={busy||active} onClick={()=>void act(()=>runtime!.recover())}>Recover original response</button>}
      </div>
      {view.voice_enabled&&attachment?.speech&&<p className="oi-note">Microphone audio goes to {attachment.speech.stt.endpoint}; response text goes to {attachment.speech.tts.endpoint}. Manual turn-taking; no automatic VAD or provider barge-in is claimed.</p>}
      <div className="nara-composer"><button type="button" disabled={busy||active} onClick={()=>void disclose()}>Include current selection</button><button type="button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>Context and transcript</button></div>
      <p className="oi-note">{BRANCH[attachment?.context.m4_branch??""]??"Personal dialogue"} · {attachment?.context.pointed_ref??"No selected subject disclosed"}</p>
      <form className="nara-composer" onSubmit={event=>{event.preventDefault();void act(()=>runtime!.sendText());}}>
        <label className="nara-draft-label">Speak with Nara<textarea className="oi-input" aria-label="Message to Nara" value={view.draft} onChange={event=>runtime!.setDraft(event.target.value)} maxLength={16384}/></label>
        <button type="submit" disabled={busy||active||!!view.pending||!view.draft.trim()}>Send</button>
      </form>
      {expanded&&<section aria-label="Private dialogue and context"><p className="oi-note">Only the refs below and the text you explicitly send enter this dialogue. Native journals remain protected by their owner.</p>
        <dl className="nara-proposal-facts"><dt>Nara</dt><dd>{attachment?.context.nara_ref}</dd><dt>AgentSession</dt><dd>{attachment?.dialogue.agent_session}</dd><dt>Body</dt><dd>{attachment?.constitution.body_ref}</dd><dt>Context basis</dt><dd>{attachment?.context.context_ref} · {attachment?.context.expression_revision}</dd></dl>
        {attachment?.context.disclosed.map(item=><p key={item.ref_id}><button type="button" onClick={()=>void openSource(item.ref_id)}>Open {item.ref_id}</button> · {item.revision} · {item.standing}</p>)}
        <div role="log" aria-label="Private transcript">{view.rows.map((row,index)=><p key={`${row.delivery_ref}:${row.role}:${index}`} className={`nara-turn-${row.role}`}><strong>{row.role=== "person"?"You":row.role=== "nara"?"Nara":"Epii"}</strong> {row.text}{!row.complete&&<small> · partial</small>}</p>)}</div>
      </section>}
      {attachment?.epii&&<section aria-label="Epii inquiry"><form className="nara-composer" onSubmit={event=>{event.preventDefault();const c=runtime!.binding.context;void act(()=>runtime!.inquire(inquiry,[...new Set([c.pointed_ref,...c.disclosed.map(item=>item.ref_id)].filter((ref):ref is string=>!!ref))]));}}>
        <label>Ask Epii for deeper inquiry<textarea className="oi-input" value={inquiry} onChange={event=>setInquiry(event.target.value)} maxLength={16384}/></label><button type="submit" disabled={busy||active||!!view.pending||!inquiry.trim()}>Delegate selected basis</button>
      </form><p className="oi-note">Epii is a separate selected native Agent. This sends the stated question and scoped refs, not the private Nara transcript.</p>
      {view.inquiries.map(row=><article className="nara-proposal" data-delegation-ref={row.delegation.delegation_ref} data-decision={row.decision} key={row.delegation.delegation_ref}>
        <p>{row.enrichment?.synthesis??row.explanation??""}</p>{row.error&&<p className="oi-note">{row.error}</p>}
        {row.enrichment&&<><p>Source refs: {row.enrichment.source_refs.join(", ")||"none returned"}</p><p>Proposed focus: {row.enrichment.proposed_focus_refs.join(", ")||"none"}</p>
          <button type="button" disabled={busy||active||!!view.pending||row.decision!=="pending"||!row.enrichment.proposed_focus_refs.length} onClick={()=>void acceptFocus(row.delegation.delegation_ref)}>Accept focus only</button>
          {(row.enrichment.proposed_native_action_refs.length>0||row.enrichment.proposed_scene_change_refs.length>0||row.enrichment.proposed_profile_variant_ref)&&<p className="oi-note">Other native/scene/profile proposals remain unexecuted and need their own native review. Accepting focus grants none of those effects.</p>}</>}
        <button type="button" disabled={row.decision!=="pending"} onClick={()=>void act(async()=>runtime!.rejectInquiry(row.delegation.delegation_ref))}>Reject without mutation</button><span> {row.decision=== "accepted"?"Focus accepted; other proposals not applied":row.decision}</span>
      </article>)}</section>}
      {presentation?.act_ref&&<section aria-label="Expression checkpoint"><p>{presentation.state} · {presentation.completed_refs.length} confirmed focus steps</p>
        <button type="button" disabled={busy||presentation.state!=="held"} onClick={()=>void act(()=>entry.presentation.checkpoint())}>Checkpoint performed state</button>
        <button type="button" disabled={busy||!presentation.checkpoint_ref||presentation.state!=="held"} onClick={()=>void act(async()=>runtime!.updateContext(await entry.presentation.restore()))}>Restore native draft checkpoint</button>
        <p className="oi-note">Restoration returns the native draft to its checkpoint; an unchanged draft keeps its revision. It does not rewind GPU particles, audio or the provider conversation.</p>
      </section>}
      <button type="button" disabled={busy} onClick={()=>void act(async()=>{await runtime!.end();if(entry){held.delete(keyOf(entry.runtime.binding));surfaces.delete(binding.id);}})}>End personal attachment</button>
    </>}
  </section>;
}
