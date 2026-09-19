import {TextEditor,EditorCommands,type EditorHandle} from "../editor/lazy";
import {useEffect,useRef,useState} from "react";
import {EditorFrame} from "../editor/EditorChrome";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {readFlowInstance,writeFlowInstance,type FlowInstance} from "./instances";
import {appendEntry,htmlAnchorPosition,sanitizeRichHtml,type QlDocEntry,type QlDocMedia,type QlDocNote} from "./instance";
import {FlowCognition} from "./contemplate";
import "./flow.css";

/** The flow document surface (queue cell E, the ratified carrier): one
 * self-contained 0/1 instance read from `Control/user/flows/`. The thread
 * renders as the template holds it — declared author, timestamp, rich body,
 * notes, media, reply anchors — and
 * writing APPENDS an F entry through the template's own contract; the human's
 * existing entries are never rewritten by the desktop. Save is a
 * revision-checked write of the whole document; a stale revision renders the
 * owner's conflict verbatim with the composer retained and the current bytes
 * offered as a rebase. */
export function FlowSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const input=useRef<EditorHandle>(null);const [text,setText]=useState("");
 const [instance,setInstance]=useState<FlowInstance>();const [error,setError]=useState<string>();const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);
 const [conflict,setConflict]=useState<{current:FlowInstance}>();
 const [selection,setSelection]=useState<{entryId:string;text:string}|undefined>();
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
 /** Hold a snapshot, not a DOM Range. Clearing the browser selection or
  * changing the document cannot later make a staged excerpt point at some
  * other passage; the Context admission revalidates the excerpt and the
  * Flow revision before it can be included. */
 const captureSelection=()=>{
  const active=window.getSelection();
  if(!active||active.isCollapsed||active.rangeCount===0){setSelection(undefined);return;}
  const range=active.getRangeAt(0);
  const host=(range.commonAncestorContainer instanceof Element?range.commonAncestorContainer:range.commonAncestorContainer.parentElement)?.closest<HTMLElement>("[data-flow-entry]");
  const excerpt=active.toString();
  const entryId=host?.dataset.flowEntry;
  if(!entryId||!excerpt.trim()){setSelection(undefined);return;}
  setSelection({entryId,text:excerpt});
 };
 useEffect(()=>{
  const clear=()=>{if(!window.getSelection()?.toString().trim())setSelection(undefined);};
  document.addEventListener("mouseup",captureSelection);
  document.addEventListener("keyup",captureSelection);
  document.addEventListener("selectionchange",clear);
  return()=>{
   document.removeEventListener("mouseup",captureSelection);
   document.removeEventListener("keyup",captureSelection);
   document.removeEventListener("selectionchange",clear);
  };
 },[]);
 const stageSelection=()=>{
  if(!selection||!instance)return;
  window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:{bindingId:binding.id,kind:"text",text:selection.text,sourceRef:binding.location?.ref,revision:instance.doc.meta.revision.toString(),workingCopy:false}}));
 };
 const status=!loaded?(error?"Unavailable":"Loading…"):busy?"Saving…":conflict?"Conflict":error?"Needs attention":text.trim()?"Unsaved entry":"Saved";
 const doc=instance?.doc;
 const selectionEntryIndex=selection&&doc?doc.entries.findIndex(entry=>entry.id===selection.entryId):-1;
 return <EditorFrame className="flow-surface" label="Flow document"
  toolbar={<EditorCommands editor={input} markdown readOnly={!loaded||!!conflict}/>}
  footer={<><span className="editor-path" title={binding.location?.ref}>{binding.flow?.path??"Flow"}</span><span role="status">{status}</span><button title={text.trim()?"Append this entry to the document":"Write an entry first"} disabled={!loaded||busy||!text.trim()} onClick={()=>void save()}>Save · ⌘S</button></>}
 >
  {error&&<p role="alert" className="flow-error">{error}</p>}
  {loaded&&doc&&<ol className="flow-thread" aria-label="Document thread">
    {doc.entries.map(entry=><FlowEntry key={entry.id} entry={entry} entries={doc.entries} notes={doc.notes} media={doc.media}/>)}
  </ol>}
  {loaded&&doc&&!!doc.journal.length&&<details className="flow-journal-note"><summary>Journal pages ({doc.journal.length})</summary>
    <p>Journal is the same 0/1 document's distinct collection. Its rich bodies are preserved here; the template's own Journal view remains the full-page writing surface.</p>
    <ol className="flow-journal-pages">{doc.journal.map(page=><li key={page.id}><span>{page.at}</span><div className="flow-thread-body" dangerouslySetInnerHTML={{__html:sanitizeRichHtml(page.html)}}/></li>)}</ol>
  </details>}
  {selection&&selectionEntryIndex>=0&&<div className="flow-selection-hold" role="status" aria-live="polite">
    <p>Selected in entry {selectionEntryIndex+1}: “{selection.text.length>180?`${selection.text.slice(0,180)}…`:selection.text}”</p>
    <button type="button" onClick={stageSelection}>Add to Context</button>
  </div>}
  {loaded?<TextEditor ref={input} binding={binding} filename="New entry" aria-label="New entry" value={text} onChange={change} onSave={()=>void save()} onAttach={attach}/>:<p className="flow-error" role="status">Opening the flow document…</p>}
  {conflict&&<div className="source-conflict" role="alert" data-conflict-kind="revision-conflict">
    <p className="source-conflict-title">revision conflict — the document moved while this surface was open</p>
    <p className="source-conflict-sides">both sides are preserved — your new entry stays in the composer above; the current document is what Central holds now. nothing was overwritten.</p>
    <button type="button" className="source-reread" onClick={()=>void rebase()}>Rebase on the current document</button>{" "}<button type="button" onClick={keepDraft}>Resolve later</button>
  </div>}
  {loaded&&binding.flow&&<FlowCognition project={binding.project??null} flowRef={binding.flow.flowRef}/>}

 </EditorFrame>;
}
function FlowEntry({entry,entries,notes,media}:{entry:QlDocEntry;entries:QlDocEntry[];notes:QlDocNote[];media:QlDocMedia[]}){
 const target=entry.replyTo?entries.find(candidate=>candidate.id===entry.replyTo?.entryId):undefined;
 const staleReply=!!entry.replyTo&&(!target||(entry.replyTo.anchor?htmlAnchorPosition(target?.html??"",entry.replyTo.anchor)===null:false));
 const entryNotes=notes.filter(note=>note.entryId===entry.id);
 const entryMedia=media.filter(item=>item.entry===entry.id);
 return <li className="flow-thread-entry" data-flow-entry={entry.id} data-flow-author={entry.author}>
  <span className="flow-thread-who" data-flow-author={entry.author}>{entry.author}</span>
  <span className="flow-thread-when">{entry.at}</span>
  <div className="flow-thread-body" dangerouslySetInnerHTML={{__html:sanitizeRichHtml(entry.html)}}/>
  {entry.replyTo&&<p className="flow-thread-reply" data-reply-state={staleReply?"stale":"current"}>
    Answers {target?`entry ${entries.indexOf(target)+1}`:"an entry no longer here"}
    {entry.replyTo.anchor?<> at “{entry.replyTo.anchor}”</>:null}
    {staleReply&&<span> — anchor changed or missing; review</span>}
  </p>}
  {entryMedia.length>0&&<ul className="flow-thread-media">{entryMedia.map(renderMedia)}</ul>}
  {entryNotes.length>0&&<ul className="flow-thread-notes">{entryNotes.map(note=><FlowNote key={note.id} note={note} entries={entries}/>)}</ul>}
 </li>;
}
function renderMedia(item:QlDocMedia){
 const mime=typeof item.mime==="string"?item.mime:"";
 const safeImage=mime.startsWith("image/")&&typeof item.data==="string"&&item.data.startsWith(`data:${mime};`);
 return <li key={item.id} className="flow-thread-media-item" data-media-mime={mime||"unknown"}>
  {safeImage&&<img src={item.data} alt={item.name??"attached image"}/>}
  {!safeImage&&<span>{mime||"media"} attachment — open through the template's own media view</span>}
  {item.caption&&<div className="flow-thread-caption" dangerouslySetInnerHTML={{__html:sanitizeRichHtml(item.caption)}}/>}
 </li>;
}
function FlowNote({note,entries}:{note:QlDocNote;entries:QlDocEntry[]}){
 const target=note.entryId?entries.find(entry=>entry.id===note.entryId):undefined;
 const stale=!!note.anchor&&(!target||htmlAnchorPosition(target?.html??"",note.anchor)===null);
 return <li className="flow-thread-note" data-note-id={note.id} data-note-anchor-state={note.anchor?(stale?"stale":"current"):"whole-entry"}>
  <span className="flow-thread-note-who">{note.author??"F"}{note.timing?` · ${note.timing}`:""}</span>
  {note.anchor&&<q data-reply-state={stale?"stale":"current"}>{note.anchor}{stale&&<span> — anchor changed or missing; review</span>}</q>}
  <div className="flow-thread-note-body" dangerouslySetInnerHTML={{__html:sanitizeRichHtml(note.text??"")}}/>
  {(note.replies??[]).map((reply,index)=><div key={reply.id??index} className="flow-thread-note-reply"><span>{reply.author??"F"}</span><div dangerouslySetInnerHTML={{__html:sanitizeRichHtml(reply.text??"")}}/></div>)}
 </li>;
}
