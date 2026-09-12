import {TextEditor,EditorCommands,type EditorHandle} from "../editor/TextEditor";
import {useEffect,useRef,useState} from "react";
import {EditorFrame} from "../editor/EditorChrome";
import {useKernel} from "../kernel/KernelProvider";
import type {SurfaceBinding} from "../surface/types";
import {flow,inspectFlow,type FlowInspection,type FlowRecord} from "./client";
import {FlowCognition} from "./contemplate";
import "./flow.css";

export function FlowSurface({binding}:{binding:SurfaceBinding}){
 const kernel=useKernel();const input=useRef<EditorHandle>(null);const textRef=useRef("");const [text,setText]=useState("");const [saved,setSaved]=useState("");const [revision,setRevision]=useState("");const [error,setError]=useState<string>();const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);
 // U4.1 §5 (acceptance 5): a save refused because the Flow moved is a
 // structured revision conflict, never prose — the buffer above stays as the
 // human edited it, the canonical side is fetched and shown read-only, and
 // nothing is overwritten. Revisions are compared, never conflict prose.
 const [conflict,setConflict]=useState<{expected:string;current:string;canonical:string}>();
 const [capabilities,setCapabilities]=useState<FlowInspection["capabilities"]>();
 const writable=capabilities?.write.available===true;
 const key=`oi-flow-draft:${binding.flow?.flowRef}`;
 useEffect(()=>{let live=true;setLoaded(false);setCapabilities(undefined);setError(undefined);void inspectFlow(kernel.transport,(binding.project??null),binding.flow!.flowRef).then(inspection=>{if(!live)throw new Error("Flow view closed");setCapabilities(inspection.capabilities);if(inspection.capabilities.read.available!==true)throw new Error(inspection.capabilities.read.reason??"Central has not enabled reading this Flow");return flow(kernel.transport,{action:"flow_read",project:(binding.project??null),flow_ref:binding.flow!.flowRef});}).then(read=>{if(!live)return;setSaved(read.content??"");let draft:{text:string;revision:string}|undefined;let recoveryNotice:string|undefined;try{const raw=localStorage.getItem(key);if(raw){const parsed:unknown=JSON.parse(raw);if(parsed&&typeof parsed==="object"&&typeof (parsed as {text?:unknown}).text==="string"&&typeof (parsed as {revision?:unknown}).revision==="string")draft=parsed as {text:string;revision:string};else recoveryNotice="The saved local Flow draft has an unsupported shape. Its original recovery data was retained.";}}catch{recoveryNotice="The saved local Flow draft could not be read. Its original recovery data was retained.";}const content=draft?.text??read.content??"";textRef.current=content;setText(content);setRevision(draft?.revision??read.flow.current_revision);setLoaded(true);if(draft&&draft.revision!==read.flow.current_revision)setError("This Flow changed since your draft. Your writing is retained; saving will require resolving that revision.");else if(recoveryNotice)setError(recoveryNotice);}).catch(reason=>{if(live)setError(String(reason));});return()=>{live=false;};},[binding.id]);
 const change=(value:string)=>{textRef.current=value;setText(value);try{localStorage.setItem(key,JSON.stringify({text:value,revision}));}catch{setError("Draft recovery storage is unavailable; save your writing to Central.");}};
 const save=async()=>{if(!loaded||!revision||busy||!writable)return;const content=text;setBusy(true);setError(undefined);try{const inspection=await inspectFlow(kernel.transport,(binding.project??null),binding.flow!.flowRef);setCapabilities(inspection.capabilities);if(inspection.capabilities.write.available!==true)throw new Error(inspection.capabilities.write.reason??"Central has not enabled writing this Flow");let read:{flow:FlowRecord;content?:string};try{read=await flow(kernel.transport,{action:"flow_write",project:(binding.project??null),flow_ref:binding.flow!.flowRef,expected_revision:revision,content,actor:"desktop-user",actor_kind:"human"});}catch(cause){
  // The owner refused: settle whether this was a revision move by
  // re-reading the Flow — the same law the source editor uses.
  const current=await flow(kernel.transport,{action:"flow_read",project:(binding.project??null),flow_ref:binding.flow!.flowRef});
  if(current.flow.current_revision!==revision){setConflict({expected:revision,current:current.flow.current_revision,canonical:current.content??""});return;}
  throw cause;}
 window.dispatchEvent(new CustomEvent("oi:expression-intent",{detail:{intent:"save",sourceRef:read.flow.source_ref,disposition:"reserved"}}));const nextRevision=read.flow.current_revision;setSaved(content);setRevision(nextRevision);setConflict(undefined);try{if(textRef.current===content)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify({text:textRef.current,revision:nextRevision}));}catch{setError("Your Flow was saved, but newer writing could not be kept in local recovery storage.");}}catch(reason){setError(String(reason));}finally{setBusy(false);}};
 const takeCanonical=()=>{if(!conflict)return;textRef.current=conflict.canonical;setText(conflict.canonical);setSaved(conflict.canonical);setRevision(conflict.current);setConflict(undefined);try{localStorage.removeItem(key);}catch{}};
 const keepDraft=()=>setConflict(undefined);
 const attach=()=>{const el=input.current;if(!el)return;const start=el.selectionStart,end=el.selectionEnd;const selected=end>start?text.slice(start,end):text;if(!selected.trim())return;window.dispatchEvent(new CustomEvent("oi:context-candidate",{detail:{bindingId:binding.id,kind:"text",text:selected,start:end>start?start:0,end:end>start?end:text.length,sourceRef:binding.ref,revision,workingCopy:text!==saved}}));};
 const status=!loaded?(error?"Unavailable":"Loading…"):busy?"Saving…":conflict?"Conflict":error?"Needs attention":text===saved?"Saved":"Unsaved";
 const short=(value:string)=>value.split(":").slice(-2).join(":");
 return <EditorFrame className="flow-surface" label="Flow editor"
  toolbar={<EditorCommands editor={input} markdown readOnly={!loaded||!writable}/>}
  footer={<><span className="editor-path" title={`${binding.ref}\n${binding.flow?.flowRef}`}>{binding.project ?? "Central"} / {binding.flow?.path}</span><span role="status">{status}</span><button title={capabilities?.write.reason??undefined} disabled={!loaded||busy||!revision||!writable||text===saved} onClick={()=>void save()}>Save · ⌘S</button></>}
 >
  {loaded&&!writable&&<p className="flow-error">{capabilities?.write.reason??"Central has not enabled writing this Flow."}</p>}
  {error&&<p role="alert" className="flow-error">{error}</p>}
  {loaded?<TextEditor ref={input} binding={binding} filename="Flow.md" readOnly={!loaded||!writable} aria-label="Writing in Flow.md" value={text} onChange={change} onSave={()=>void save()} onAttach={attach}/>:<p className="flow-error" role="status">Opening Flow…</p>}
  {conflict&&<div className="source-conflict" role="alert" data-conflict-kind="revision-conflict">
    <p className="source-conflict-title">revision conflict — the Flow moved while this buffer was open</p>
    <dl className="source-conflict-revisions">
      <div><dt>expected (this buffer&apos;s base)</dt><dd data-expected={conflict.expected}>{short(conflict.expected)}</dd></div>
      <div><dt>current (canonical now)</dt><dd data-current={conflict.current}>{short(conflict.current)}</dd></div>
    </dl>
    <p className="source-conflict-sides">both sides are preserved — your writing stays in the editor above; the canonical content below is what Central holds now. nothing was overwritten.</p>
    <div className="source-conflict-canonical"><p className="source-conflict-canonical-label">canonical side (read-only)</p><pre className="source-conflict-canonical-body" data-canonical="true">{conflict.canonical}</pre></div>
    <button type="button" className="source-reread" data-action="flow.take-canonical" onClick={takeCanonical}>Take the canonical side (discard my draft)</button>{" "}<button type="button" onClick={keepDraft}>Keep my draft and resolve later</button>
  </div>}
  {loaded&&binding.flow&&<FlowCognition project={binding.project??null} flowRef={binding.flow.flowRef}/>}

 </EditorFrame>;
}
