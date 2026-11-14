import {Refusal} from "../shared/Refusal";
import {TextEditor,EditorCommands,type EditorHandle} from "../editor/lazy";
import {useEffect,useRef,useState} from "react";
import {EditorFrame} from "../editor/EditorChrome";
import {registerPageObservation,releaseObservation} from "../context/ComponentSelection";
import {setContextCues,getContextCues} from "../context/selectionPresentation";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {readFlowInstance,writeFlowInstance,type FlowInstance} from "./instances";
import {appendEntry,embedDocument,type QlDoc,type QlDocParticipant} from "./instance";
import {activeParticipants,isCurrentFormat,withSession,type PluralParticipant,type Relation} from "./plural";
import {FlowThreads} from "./FlowThreads";
import {FlowParticipants} from "./FlowParticipants";
import {FlowEntryBody,FlowRichBody} from "./FlowEntryBody";
import {FlowCognition} from "./contemplate";
import {EncounterList,type EncounterRow} from "../encounter/EncounterList";
import {encounterSessionOf} from "../encounter/session";
import {encounterProvision} from "../encounter/client";
import {useChosenAgent} from "../agency/selection";
import {useAgentRoster} from "../agency/roster";
import {useScope,scopeProject} from "../workspace/scope";
import {useWritingIdentity} from "./identity";
import "./flow.css";

/** The flow document surface: one self-contained 0/1 instance read from
 * `Control/user/flows/`. The thread renders as the form holds it — declared
 * author, timestamp, text — and writing appends an entry through the
 * document's own contract; existing entries are never rewritten. Save is a
 * revision-checked write of the whole document; a stale revision renders the
 * owner's conflict verbatim with the composer retained and the current bytes
 * offered as a rebase.
 *
 * The document converses: an entry can be sent to a live agent session the
 * person binds to this surface. The person's entry lands in the file first,
 * the same words drive the bound session through its own encounter
 * machinery, and the answer that actually comes back is appended to the
 * file as the agent's declared entry — initial and name from the live
 * agent, the session ref as provenance. Nothing is invented on the agent's
 * behalf: no session, no answer, no attribution. Every ask is the one send
 * (encounter/session.ts `ask`, O-I #1003): the words go through the agent's
 * own conversation, and its answer is read there when the turn ends. */
interface AnswerBinding {ref:string;space:string;title:string;initial:string;name:string}
const answerKey=(surfaceId:string)=>`oi-flow-answer:${surfaceId}`;
const initialOf=(name:string):string=>{const m=name.toUpperCase().match(/[A-Z]/);return m?m[0]:"A";};
/** How long an addressed agent is waited for. */
const ANSWER_WAIT_MS=10*60_000;
const lateWords=(who:string)=>`${who} has not finished answering yet: the question stands in ${who}'s conversation, and nothing more was added to this flow.`;
export function FlowSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const scope=useScope();const input=useRef<EditorHandle>(null);const [text,setText]=useState("");
 const [instance,setInstance]=useState<FlowInstance>();const [error,setError]=useState<string|{said:string;cause:unknown}>();const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);
 const [conflict,setConflict]=useState<{current:FlowInstance}>();
 const liveSelection=useRef({text,instance});liveSelection.current={text,instance};
 const documentId=useRef(crypto.randomUUID());const observationKeys=useRef(new Set<string>());
 const [identity,setIdentity]=useWritingIdentity();
 const scoped=binding.project??scopeProject(scope)??"";
 // A flow in the personal ground belongs to no project, but agents work in one:
 // the person says where, and a single project is the obvious default.
 const projects=kernel.snapshot.navigator?.root?.work.projects??[];
 const projectKey=`oi-flow-work-project:${binding.id}`;
 const [chosenProject,setChosenProject]=useState(()=>{try{return localStorage.getItem(projectKey)??"";}catch{return "";}});
 const project=scoped||(projects.some(p=>p.name===chosenProject)?chosenProject:projects.length===1?projects[0].name:"");
 const [chosenAgentRef]=useChosenAgent(project||undefined);
 const roster=useAgentRoster(project||undefined);
 const [answerWith,setAnswerWith]=useState<AnswerBinding>();
 const [answerBusy,setAnswerBusy]=useState(false);
 const [view,setView]=useState<"chronological"|"threads">("chronological");
 const [focusId,setFocusId]=useState<string>();
 const [replyTarget,setReplyTarget]=useState("");
 const [relationType,setRelationType]=useState<"reply"|"branch"|"correct">("reply");
 const [addressees,setAddressees]=useState<string[]>([]);
 const [asking,setAsking]=useState(false);
 useEffect(()=>{try{const raw=localStorage.getItem(answerKey(binding.id));if(raw){const parsed:unknown=JSON.parse(raw);if(parsed&&typeof parsed==="object"&&typeof (parsed as {ref?:unknown}).ref==="string")setAnswerWith(parsed as AnswerBinding);}}catch{/* an unreadable binding leaves the document unbound */}},[binding.id]);
 const bindAnswer=(row:EncounterRow)=>{
  const named=roster.agents?.find(a=>a.ref===chosenAgentRef);
  const name=named?.name??row.title;
  const next:AnswerBinding={ref:row.ref,space:row.space,title:row.title,initial:initialOf(name),name};
  setAnswerWith(next);
  try{localStorage.setItem(answerKey(binding.id),JSON.stringify(next));}catch{/* in-window binding still applies */};
 };
 const unbindAnswer=()=>{setAnswerWith(undefined);try{localStorage.removeItem(answerKey(binding.id));}catch{/* in-window binding still applies */}};
 const encounterBinding=answerWith&&binding.project!==undefined?{project:binding.project,ref:answerWith.ref,space:answerWith.space||undefined}:answerWith?{project:"",ref:answerWith.ref,space:answerWith.space||undefined}:undefined;
 useEffect(()=>{window.dispatchEvent(new CustomEvent("oi:file-draft-changed",{detail:{ref:binding.ref??binding.location?.ref}}));},[text,instance?.revision,binding.ref]);
 const key=`oi-flow-instance-draft:${binding.id}`;
 useEffect(()=>{let live=true;setLoaded(false);setError(undefined);
  void (async()=>{
   if(!binding.location)throw new Error("This flow surface has no document location to read.");
   const next=await readFlowInstance(kernel.transport,binding.location);
   let composer="";let recoveryNotice:string|undefined;
   try{const raw=localStorage.getItem(key);if(raw){const parsed:unknown=JSON.parse(raw);if(parsed&&typeof parsed==="object"&&typeof (parsed as {text?:unknown}).text==="string")composer=(parsed as {text:string}).text;else recoveryNotice="The saved local draft has an unsupported shape. Its original recovery data was retained.";}}catch{recoveryNotice="The saved local draft could not be read. Its original recovery data was retained.";}
   if(!live)return;
   setInstance(next);setText(composer);
   if(recoveryNotice)setError(recoveryNotice);
  })().catch(reason=>{if(live)setError({said:"Couldn't read this Flow.",cause:reason});}).finally(()=>{if(live)setLoaded(true);});
  return()=>{live=false;};
 },[binding.id]);
 const change=(value:string)=>{setText(value);try{localStorage.setItem(key,JSON.stringify({text:value}));}catch{setError("Draft recovery storage is unavailable; save your writing to Central.");}};
 const flowRef=binding.ref??binding.location?.ref;
 const writeEntries=async(nextInstance:FlowInstance,html:string)=>writeFlowInstance(kernel.transport,nextInstance.location,nextInstance.revision,html);
 /** A membership or upgrade change to the document, through the same
  * revision-checked write as an entry: a stale revision keeps both sides. */
 const commitDocument=async(next:QlDoc)=>{
  if(!instance)return;
  setBusy(true);setError(undefined);
  try{
   const result=await writeEntries(instance,embedDocument(instance.html,next));
   if(result.outcome==="conflict"){setConflict({current:await readFlowInstance(kernel.transport,instance.location)});return;}
   setInstance(await readFlowInstance(kernel.transport,instance.location));
  }catch(reason){setError({said:"Couldn't save the change to this Flow.",cause:reason});}finally{setBusy(false);}
 };
 const openEntry=(entryId:string)=>{
  setFocusId(entryId);
  requestAnimationFrame(()=>{const el=document.querySelector<HTMLElement>(`[data-flow-entry="${CSS.escape(entryId)}"]`);el?.scrollIntoView({block:"center"});el?.focus();});
 };
 const writerOf=(doc:QlDoc):PluralParticipant|undefined=>{
  const people=((doc.meta.participants??[]) as PluralParticipant[]).filter(p=>p.kind==="person"&&!p.left);
  return people.find(p=>p.initial===identity.initial)??people[0];
 };
 /** An agent's returned words, appended as that agent's own declared entry on
  * the current bytes. A conflict is retried once on the bytes then current; a
  * second conflict keeps the answer in the error: the words are never dropped.
  * Appends are taken one at a time, so answers arriving together never race. */
 const appending=useRef<Promise<unknown>>(Promise.resolve());
 const appendAgentResponse=(answerText:string,participant:QlDocParticipant,relations?:Relation[])=>{
  const run=appending.current.catch(()=>undefined).then(async()=>{
   if(!binding.location)throw new Error("This flow surface has no document location to write.");
   let basis=await readFlowInstance(kernel.transport,binding.location);
   for(let attempt=0;attempt<2;attempt++){
    const {html}=appendEntry(basis.html,answerText,{participant,...(relations?{relations}:{})});
    const result=await writeEntries(basis,html);
    if(result.outcome!=="conflict"){const next=await readFlowInstance(kernel.transport,basis.location);setInstance(next);return;}
    basis=await readFlowInstance(kernel.transport,basis.location);setInstance(basis);
   }
   throw new Error(`${participant.name||participant.initial} answered, but the document moved twice under this surface. The answer, unlost:\n\n${answerText}`);
  });
  appending.current=run;
  return run;
 };
 const save=async()=>{
  if(!loaded||!instance||busy||!text.trim())return;
  setBusy(true);setError(undefined);
  try{
   const plural=isCurrentFormat(instance.doc);
   const relations:Relation[]=plural&&replyTarget?[{type:relationType,entryId:replyTarget,revision:instance.doc.meta.revision,anchor:null}]:[];
   const {html}=appendEntry(instance.html,text,plural?{participant:writerOf(instance.doc),relations,addressees:addressees.length?addressees:undefined,basisRevision:instance.doc.meta.revision}:undefined);
   const result=await writeEntries(instance,html);
   if(result.outcome==="conflict"){
    const current=await readFlowInstance(kernel.transport,instance.location);
    setConflict({current});return;
   }
   const next=await readFlowInstance(kernel.transport,instance.location);
   setInstance(next);setText("");setReplyTarget("");setRelationType("reply");setAddressees([]);
   try{localStorage.removeItem(key);}catch{setError("Saved. Local draft recovery storage could not be cleared.");}
  }catch(reason){setError({said:"Couldn't save the entry. Your writing is still here.",cause:reason});}finally{setBusy(false);}
 };
 /** Send the entry to the bound live session: the person's words land in
  * the file as their entry, then go to the session as its next turn (the one
  * send); the answer that turn ends with is appended as the agent's entry. */
 const sendToAgent=async()=>{
  if(!loaded||!instance||busy||answerBusy||!text.trim())return;
  if(!answerWith){setError("Bind a live session first — the answer must come from an actual agent.");return;}
  setAnswerBusy(true);setError(undefined);
  try{
   const asked=text;
   const {html}=appendEntry(instance.html,asked);
   const result=await writeEntries(instance,html);
   if(result.outcome==="conflict"){
    const current=await readFlowInstance(kernel.transport,instance.location);
    setConflict({current});return;
   }
   const next=await readFlowInstance(kernel.transport,instance.location);
   setInstance(next);setText("");
   try{localStorage.removeItem(key);}catch{/* the ground holds the writing now */}
   if(!encounterBinding)throw new Error("The live session is not bound yet.");
   const who=answerWith.name||answerWith.title||"The agent";
   const answer=await encounterSessionOf(kernel.transport,encounterBinding).ask(asked,who,ANSWER_WAIT_MS,lateWords(who));
   await appendAgentResponse(answer.text,{initial:/^[A-Z]$/.test(answerWith.initial)?answerWith.initial:initialOf(answerWith.name||"A"),name:answerWith.name||undefined,kind:"agent",ref:answerWith.ref});
  }catch(reason){setError({said:"Couldn't get the session's answer into this flow.",cause:reason});}finally{setAnswerBusy(false);}
 };
 /** Put the composed entry to the addressed agents. The entry lands in the
  * file first, addressed; then each agent is asked through its own
  * conversation (the one send; an agent with no conversation yet is started
  * for exactly that roster Agent), and each answer is appended as that
  * agent's entry, replying to the one asked. Asking is the act that starts an
  * agent's session, and only for an agent the person addressed. */
 const askForResponse=async()=>{
  if(!loaded||!instance||busy||asking||!text.trim()||!flowRef||!binding.location)return;
  if(!project){setError("Choose the project the agents should work in, then ask again.");return;}
  const plural=isCurrentFormat(instance.doc);
  if(!plural){setError("Upgrade this flow to the plural form to ask agents in it.");return;}
  setAsking(true);setError(undefined);
  try{
   let basis=instance;const writer=writerOf(basis.doc);
   if(!writer?.key)throw new Error("This flow has no person to ask as.");
   const targets=addressees.map(key=>(basis.doc.meta.participants as PluralParticipant[]).find(p=>p.key===key)).filter((p):p is PluralParticipant=>!!p&&p.kind==="agent");
   if(!targets.length)throw new Error("Choose the agents you want to hear from.");
   const asked=text;
   const relations:Relation[]=replyTarget?[{type:relationType,entryId:replyTarget,revision:basis.doc.meta.revision,anchor:null}]:[];
   const {html,entry}=appendEntry(basis.html,asked,{participant:writer,relations,addressees,intent:"response",basisRevision:basis.doc.meta.revision});
   const written=await writeEntries(basis,html);
   if(written.outcome==="conflict"){setConflict({current:await readFlowInstance(kernel.transport,basis.location)});return;}
   basis=await readFlowInstance(kernel.transport,basis.location);setInstance(basis);
   setText("");setReplyTarget("");setRelationType("reply");setAddressees([]);
   try{localStorage.removeItem(key);}catch{/* the ground holds the entry now */}
   const sessions:{target:PluralParticipant;session:string}[]=[];
   for(const target of targets){
    let session=target.ref;
    if(!session){
     const agentRef=target.binding?.ref;
     if(!agentRef)throw new Error(`${target.name||target.initial} has no registered agent to start; bring them in from the roster.`);
     session=(await encounterProvision(kernel.transport,project,{agentRef})).agent_session;
     // Remember the conversation this agent now answers from, through the ordinary CAS.
     const bound=withSession(basis.doc,target.key as string,session);
     const kept=await writeEntries(basis,embedDocument(basis.html,bound));
     if(kept.outcome==="conflict")throw new Error(`${target.name||target.initial}'s conversation was started, but the flow moved before it could be remembered; ask again to use it.`);
     basis=await readFlowInstance(kernel.transport,basis.location);setInstance(basis);
    }
    sessions.push({target,session});
   }
   const answering:Relation[]=[{type:"reply",entryId:entry.id,revision:basis.doc.meta.revision,anchor:null}];
   const outcomes=await Promise.allSettled(sessions.map(async({target,session})=>{
    const who=target.name||target.initial;
    const answer=await encounterSessionOf(kernel.transport,{project,ref:session}).ask(asked,who,ANSWER_WAIT_MS,lateWords(who));
    await appendAgentResponse(answer.text,target,answering);
   }));
   const failed=outcomes.flatMap((outcome,index)=>outcome.status==="rejected"?[`${sessions[index].target.name||sessions[index].target.initial}: ${outcome.reason instanceof Error?outcome.reason.message:String(outcome.reason)}`]:[]);
   if(failed.length)throw new Error(failed.join("\n"));
  }catch(reason){setError({said:"Not every addressed agent's answer is in the flow.",cause:reason});}finally{setAsking(false);}
 };
 const rebase=async()=>{
  if(!instance)return;
  setBusy(true);setError(undefined);
  try{const current=await readFlowInstance(kernel.transport,instance.location);setInstance(current);setConflict(undefined);}catch(reason){setError({said:"Couldn't read the current Flow.",cause:reason});}finally{setBusy(false);}
 };
 const keepDraft=()=>setConflict(undefined);
 const attach=()=>{
  const el=input.current,basis=liveSelection.current;if(!el||!basis.instance)return;
  const start=el.selectionStart,end=el.selectionEnd;if(end<=start)return;
  const selected=basis.text.slice(start,end);if(!selected.trim())return;
  const sourceRef=binding.ref??binding.location?.ref;if(!sourceRef)return;
  const revision=basis.instance.revision;
  // The new entry is an unsaved view of this Flow, NOT a span in its HTML.
  const observationKey=registerPageObservation(selected,async()=>{
   const current=liveSelection.current;
   if(!input.current||current.instance?.revision!==revision||current.text!==basis.text)return false;
   const saved=await readFlowInstance(kernel.transport,basis.instance!.location);
   return saved.revision===revision;
  },enabled=>{
   const others=getContextCues().filter(c=>c.id!==observationKey);
   setContextCues(enabled?[...others,{id:observationKey,bindingId:binding.id,viewOnly:true,sourceRef,start,end,text:selected}]:others);
  });
  observationKeys.current.add(observationKey);
  if(observationKeys.current.size>32){const oldest=observationKeys.current.values().next().value!;observationKeys.current.delete(oldest);releaseObservation(oldest);}
  window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:{bindingId:binding.id,kind:"element",text:selected,sourceRef,revision,workingCopy:true,observationKey,documentId:basis.instance.doc.meta.documentId??documentId.current,selector:`new-entry UTF-16 ${start}:${end}`,role:"draft-text"}}));
 };
 const status=!loaded?(error?"Unavailable":"Loading…"):busy?"Saving…":conflict?"Conflict":error?"Needs attention":asking?"Asking…":answerBusy?"Waiting for the agent…":text.trim()?"Unsaved entry":"Saved";
 const doc=instance?.doc;
 return <EditorFrame className="flow-surface" label="Flow document" data={{"source-ref":binding.ref??binding.location?.ref,"source-revision":instance?.revision,"document-id":instance?.doc.meta.documentId??undefined}}
  toolbar={<><EditorCommands editor={input} markdown readOnly={!loaded||!!conflict}/>{loaded&&doc&&isCurrentFormat(doc)&&<span className="flow-view-toggle" role="group" aria-label="Reading order"><button type="button" aria-pressed={view==="chronological"} onClick={()=>setView("chronological")}>In order</button><button type="button" aria-pressed={view==="threads"} onClick={()=>setView("threads")}>Threads</button></span>}</>}
  footer={<><span className="editor-path" title={binding.location?.ref}>{binding.flow?.path??"Flow"}</span><span role="status">{status}</span>
   {!(doc&&isCurrentFormat(doc))&&<label className="flow-answer-initial" title="The declared initial the agent's answers carry">agent initial <input aria-label="Agent initial" value={answerWith?.initial??""} maxLength={1} onChange={event=>{if(!answerWith)return;const updated={...answerWith,initial:event.target.value.toUpperCase()};setAnswerWith(updated);try{localStorage.setItem(answerKey(binding.id),JSON.stringify(updated));}catch{/* in-window binding still applies */}}}/></label>}
   {!(loaded&&doc&&isCurrentFormat(doc))&&<button title={text.trim()&&answerWith?"Send this entry to the bound live session; its answer returns into this file":!answerWith?"Bind a live session below, then send":text.trim()?"Send this entry to the live session":"Write an entry first"} disabled={!loaded||busy||answerBusy||!text.trim()||!answerWith} onClick={()=>void sendToAgent()}>Send to agent</button>}
   <button title={text.trim()?"Append this entry to the document":"Write an entry first"} disabled={!loaded||busy||!text.trim()} onClick={()=>void save()}>Save · ⌘S</button></>}
 >
  {/* The surface's own sentences (a conflict, the answer kept, what to choose first) stand as written; a caught fault says what
    * didn't happen, with its cause behind Why (shared/Refusal.tsx). */}
  {typeof error==="string"&&<p role="alert" className="flow-error">{error}</p>}
  {error&&typeof error!=="string"&&<Refusal className="flow-error" said={error.said} error={error.cause}/>}
  {loaded&&doc&&<FlowParticipants doc={doc} project={project} disabled={!!conflict||busy||asking} onChange={commitDocument}/>}
  {loaded&&doc&&(view==="threads"&&isCurrentFormat(doc)
   ?<FlowThreads doc={doc} focusId={focusId} onOpenEntry={openEntry}/>
   :<ol className="flow-thread" aria-label="Document thread">
    {doc.entries.map(entry=><FlowEntryBody key={entry.id} entry={entry} entries={doc.entries} notes={doc.notes} media={doc.media} doc={doc} onOpenEntry={openEntry} focused={focusId===entry.id}/>)}
  </ol>)}
  {loaded&&doc&&!!doc.journal.length&&<details className="flow-journal-note"><summary>Journal pages ({doc.journal.length})</summary><p className="oi-note">Journal pages remain a distinct collection in this document.</p><ol className="flow-journal-pages">{doc.journal.map(page=><li key={page.id} data-journal-page={page.id}><time>{page.at}</time><div className="flow-thread-body"><FlowRichBody html={page.html}/></div></li>)}</ol></details>}
  {loaded&&doc&&isCurrentFormat(doc)&&<fieldset className="flow-compose-controls" aria-label="Address this entry">
   <label>Reply to <select aria-label="Reply to" value={replyTarget} onChange={event=>setReplyTarget(event.target.value)}>
    <option value="">a new contribution</option>
    {doc.entries.map((entry,index)=><option key={entry.id} value={entry.id}>{`entry ${index+1} · ${(entry.html.replace(/<[^>]*>/g,"").trim()||"(empty)").slice(0,48)}`}</option>)}
   </select></label>
   {replyTarget&&<label>as <select aria-label="Relation" value={relationType} onChange={event=>setRelationType(event.target.value as "reply"|"branch"|"correct")}><option value="reply">an answer</option><option value="branch">a side inquiry</option><option value="correct">a correction</option></select></label>}
   {!scoped&&projects.length>1&&<label>Agents work in <select aria-label="Agents work in" value={project} onChange={event=>{setChosenProject(event.target.value);try{localStorage.setItem(projectKey,event.target.value);}catch{/* in-window choice still applies */}}}><option value="">choose a project</option>{projects.map(p=><option key={p.path} value={p.name}>{p.name}</option>)}</select></label>}
   <span role="group" aria-label="Address" className="flow-address">To {activeParticipants(doc).filter(p=>p.key&&p.key!==writerOf(doc)?.key).map(p=><label key={p.key}><input type="checkbox" aria-label={`Address ${(p as PluralParticipant).name||p.initial}`} checked={addressees.includes((p as PluralParticipant).key as string)} onChange={event=>setAddressees(current=>event.target.checked?[...current,(p as PluralParticipant).key as string]:current.filter(key=>key!==(p as PluralParticipant).key))}/> {(p as PluralParticipant).name||p.initial}</label>)}</span>
   <span className="flow-compose-acts" role="group" aria-label="What to do with this entry">
    <button type="button" className="oi-action" disabled={busy||asking||!text.trim()} title="Add this entry to the flow without asking anyone to respond" onClick={()=>void save()}>Add to the flow</button>
    <button type="button" className="oi-action oi-action-primary" disabled={busy||asking||!text.trim()||!addressees.length} title={addressees.length?"Add this entry and ask the addressed agents to respond; each answer is added here when it arrives":"Address one or more agents to ask for a response"} onClick={()=>void askForResponse()}>Ask for a response</button>
   </span>
  </fieldset>}
  {loaded?<TextEditor ref={input} binding={binding} filename="New entry" aria-label="New entry" value={text} readOnly={!loaded||busy||!!conflict} sourceRevision={instance?.revision} workingCopy onChange={change} onSave={()=>void save()} onAttach={attach}/>:<p className="flow-error" role="status">Opening the flow document…</p>}
  {!(doc&&isCurrentFormat(doc))&&<details className="flow-answer" open={!answerWith}>
   <summary>{answerWith?`Answering with · ${answerWith.title} (declared as ${answerWith.initial})`:"Answer with a live agent session"}</summary>
   <p className="oi-note">Your entry lands in this file first, the same words drive the live session, and the answer that actually returns is appended here as the agent's declared entry. The initial is declared by you; the words are the agent's own.</p>
   <div className="flow-identity">
    <label>Your entries are declared as <input aria-label="Your writing initial" value={identity.initial} maxLength={1} onChange={event=>{try{setIdentity({...identity,initial:event.target.value.toUpperCase()});}catch{/* a one-letter initial is the contract; the held one stays */}}} size={1}/></label>
    <label>name <input aria-label="Your name" value={identity.name??""} placeholder="the person" onChange={event=>setIdentity({...identity,name:event.target.value})} size={12}/></label>
   </div>
   <EncounterList project={project} variant="panel" onOpen={async row=>bindAnswer(row)} onRows={()=>{/* rows render inside the list */}}/>
   {answerWith&&<button type="button" onClick={unbindAnswer}>Unbind this session</button>}
  </details>}
  {conflict&&<div className="source-conflict" role="alert" data-conflict-kind="revision-conflict">
    <p className="source-conflict-title">revision conflict — the document moved while this surface was open</p>
    <p className="source-conflict-sides">both sides are preserved — your new entry stays in the composer above; the current document is what Central holds now. nothing was overwritten.</p>
    <button type="button" className="source-reread" onClick={()=>void rebase()}>Rebase on the current document</button>{" "}<button type="button" onClick={keepDraft}>Resolve later</button>
  </div>}
  {loaded&&binding.flow&&<FlowCognition project={binding.project??null} flowRef={binding.flow.flowRef}/>}

 </EditorFrame>;
}
