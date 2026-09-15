import {TextEditor,EditorCommands,type EditorHandle} from "../editor/TextEditor";
import {useEffect,useRef,useState} from "react";
import {EditorFrame} from "../editor/EditorChrome";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {readFlowInstance,writeFlowInstance,type FlowInstance} from "./instances";
import {appendEntry,htmlToText} from "./instance";
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
 const attach=()=>{const el=input.current;if(!el)return;const start=el.selectionStart,end=el.selectionEnd;const selected=end>start?text.slice(start,end):text;if(!selected.trim())return;window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:{bindingId:binding.id,kind:"text",text:selected,start:end>start?start:0,end:end>start?end:text.length,sourceRef:binding.location?.ref,workingCopy:true}}));};
 const status=!loaded?(error?"Unavailable":"Loading…"):busy?"Saving…":conflict?"Conflict":error?"Needs attention":text.trim()?"Unsaved entry":"Saved";
 const doc=instance?.doc;
 return <EditorFrame className="flow-surface" label="Flow document"
  toolbar={<EditorCommands editor={input} markdown readOnly={!loaded||!!conflict}/>}
  footer={<><span className="editor-path" title={binding.location?.ref}>{binding.flow?.path??"Flow"}</span><span role="status">{status}</span><button title={text.trim()?"Append this entry to the document":"Write an entry first"} disabled={!loaded||busy||!text.trim()} onClick={()=>void save()}>Save · ⌘S</button></>}
 >
  {error&&<p role="alert" className="flow-error">{error}</p>}
  {loaded&&doc&&<ol className="flow-thread" aria-label="Document thread">
    {doc.entries.map(entry=><li key={entry.id} className="flow-thread-entry" data-flow-entry={entry.id}>
      <span className="flow-thread-who" data-flow-author={entry.author}>{entry.author}</span>
      <span className="flow-thread-when">{entry.at}</span>
      <div className="flow-thread-body">{threadParagraphs(entry.html)}</div>
    </li>)}
  </ol>}
  {loaded&&doc&&!!doc.journal.length&&<details className="flow-journal-note"><summary>Journal pages ({doc.journal.length})</summary><p>The document's journal pages travel inside the file; they render in the template's own Journal view.</p></details>}
  {loaded?<TextEditor ref={input} binding={binding} filename="New entry" aria-label="New entry" value={text} onChange={change} onSave={()=>void save()} onAttach={attach}/>:<p className="flow-error" role="status">Opening the flow document…</p>}
  {conflict&&<div className="source-conflict" role="alert" data-conflict-kind="revision-conflict">
    <p className="source-conflict-title">revision conflict — the document moved while this surface was open</p>
    <p className="source-conflict-sides">both sides are preserved — your new entry stays in the composer above; the current document is what Central holds now. nothing was overwritten.</p>
    <button type="button" className="source-reread" onClick={()=>void rebase()}>Rebase on the current document</button>{" "}<button type="button" onClick={keepDraft}>Resolve later</button>
  </div>}
  {loaded&&binding.flow&&<FlowCognition project={binding.project??null} flowRef={binding.flow.flowRef}/>}

 </EditorFrame>;
}
function threadParagraphs(html:string){
  return htmlToText(html).split(/\n{2,}/).filter(p=>p.trim()).map((paragraph,i)=><p key={i}>{paragraph}</p>);
}
