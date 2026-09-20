import {TextEditor,EditorCommands,type EditorHandle} from "../editor/lazy";
import {useEffect,useRef,useState} from "react";
import {EditorFrame} from "../editor/EditorChrome";
import {registerPageObservation,releaseObservation} from "../context/ComponentSelection";
import {setContextCues,getContextCues} from "../context/selectionPresentation";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {readFlowInstance,writeFlowInstance,type FlowInstance} from "./instances";
import {appendEntry} from "./instance";
import {FlowEntryBody,FlowRichBody} from "./FlowEntryBody";
import {FlowCognition} from "./contemplate";
import "./flow.css";

/** The flow document surface (queue cell E, the ratified carrier): one
 * self-contained 0/1 instance read from `Control/user/flows/`. The thread
 * renders as the template holds it — declared author, timestamp, text — and
 * writing APPENDS an F entry through the template's own contract; the human's
 * existing entries are never rewritten by the desktop. Save is a
 * revision-checked write of the whole document; a stale revision renders the
 * owner's conflict verbatim with the composer retained and the current bytes
 * offered as a rebase. */
export function FlowSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const input=useRef<EditorHandle>(null);const [text,setText]=useState("");
 const [instance,setInstance]=useState<FlowInstance>();const [error,setError]=useState<string>();const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);
 const [conflict,setConflict]=useState<{current:FlowInstance}>();
 const liveSelection=useRef({text,instance});liveSelection.current={text,instance};
 const documentId=useRef(crypto.randomUUID());const observationKeys=useRef(new Set<string>());
 useEffect(()=>()=>{for(const key of observationKeys.current)releaseObservation(key);},[]);
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
  })().catch(reason=>{if(live)setError(String(reason));}).finally(()=>{if(live)setLoaded(true);});
  return()=>{live=false;};
 },[binding.id]);
 const change=(value:string)=>{setText(value);try{localStorage.setItem(key,JSON.stringify({text:value}));}catch{setError("Draft recovery storage is unavailable; save your writing to Central.");}};
 const save=async()=>{
  if(!loaded||!instance||busy||!text.trim())return;
  setBusy(true);setError(undefined);
  try{
   const {html}=appendEntry(instance.html,text);
   const result=await writeFlowInstance(kernel.transport,instance.location,instance.revision,html);
   if(result.outcome==="conflict"){
    const current=await readFlowInstance(kernel.transport,instance.location);
    setConflict({current});return;
   }
   const next=await readFlowInstance(kernel.transport,instance.location);
   setInstance(next);setText("");
   try{localStorage.removeItem(key);}catch{setError("Saved. Local draft recovery storage could not be cleared.");}
  }catch(reason){setError(String(reason));}finally{setBusy(false);}
 };
 const rebase=async()=>{
  if(!instance)return;
  setBusy(true);setError(undefined);
  try{const current=await readFlowInstance(kernel.transport,instance.location);setInstance(current);setConflict(undefined);}catch(reason){setError(String(reason));}finally{setBusy(false);}
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
 const status=!loaded?(error?"Unavailable":"Loading…"):busy?"Saving…":conflict?"Conflict":error?"Needs attention":text.trim()?"Unsaved entry":"Saved";
 const doc=instance?.doc;
 return <EditorFrame className="flow-surface" label="Flow document" data={{"source-ref":binding.ref??binding.location?.ref,"source-revision":instance?.revision,"document-id":instance?.doc.meta.documentId??undefined}}
  toolbar={<EditorCommands editor={input} markdown readOnly={!loaded||!!conflict}/>}
  footer={<><span className="editor-path" title={binding.location?.ref}>{binding.flow?.path??"Flow"}</span><span role="status">{status}</span><button title={text.trim()?"Append this entry to the document":"Write an entry first"} disabled={!loaded||busy||!text.trim()} onClick={()=>void save()}>Save · ⌘S</button></>}
 >
  {error&&<p role="alert" className="flow-error">{error}</p>}
  {loaded&&doc&&<ol className="flow-thread" aria-label="Document thread">
    {doc.entries.map(entry=><FlowEntryBody key={entry.id} entry={entry} entries={doc.entries} notes={doc.notes} media={doc.media}/>)}
  </ol>}
  {loaded&&doc&&!!doc.journal.length&&<details className="flow-journal-note"><summary>Journal pages ({doc.journal.length})</summary><p className="oi-note">Journal pages remain a distinct collection in this document.</p><ol className="flow-journal-pages">{doc.journal.map(page=><li key={page.id} data-journal-page={page.id}><time>{page.at}</time><div className="flow-thread-body"><FlowRichBody html={page.html}/></div></li>)}</ol></details>}
  {loaded?<TextEditor ref={input} binding={binding} filename="New entry" aria-label="New entry" value={text} readOnly={!loaded||busy||!!conflict} sourceRevision={instance?.revision} workingCopy onChange={change} onSave={()=>void save()} onAttach={attach}/>:<p className="flow-error" role="status">Opening the flow document…</p>}
  {conflict&&<div className="source-conflict" role="alert" data-conflict-kind="revision-conflict">
    <p className="source-conflict-title">revision conflict — the document moved while this surface was open</p>
    <p className="source-conflict-sides">both sides are preserved — your new entry stays in the composer above; the current document is what Central holds now. nothing was overwritten.</p>
    <button type="button" className="source-reread" onClick={()=>void rebase()}>Rebase on the current document</button>{" "}<button type="button" onClick={keepDraft}>Resolve later</button>
  </div>}
  {loaded&&binding.flow&&<FlowCognition project={binding.project??null} flowRef={binding.flow.flowRef}/>}

 </EditorFrame>;
}
