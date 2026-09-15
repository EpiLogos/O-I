import {useCallback,useEffect,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {useExpressionStage,type StagePresentation} from "../stage/ExpressionStage";
import {expressionConfig} from "./engineProjection";
import type {Change,ExpressionDocument,ExpressionRequest,ExpressionResult,SubjectBinding} from "./types";
import type {CentralLocation} from "../kernel/types";
import "./expression.css";
const ACTOR="human:expression-editor";

export function ExpressionView(){
 const kernel=useKernel();const stage=useExpressionStage();
 const [document,setDocument]=useState<ExpressionDocument>();
 const [list,setList]=useState<NonNullable<ExpressionResult["expressions"]>>([]);
 const [error,setError]=useState("");const [pending,setPending]=useState(false);
 const [title,setTitle]=useState("Untitled Expression");
 const [subject,setSubject]=useState("");const [owner,setOwner]=useState("");const [role,setRole]=useState<"being"|"thing">("thing");
 const bindingDirty=useRef(false);const bindingBasis=useRef(0);const bindingEntity=useRef<string>();const [bindingConflict,setBindingConflict]=useState(false);
 const [source,setSource]=useState("");const [sourceRevision,setSourceRevision]=useState("");
 const [filePath,setFilePath]=useState("");const [file,setFile]=useState<{location:CentralLocation;revision:string}>();
 const [result,setResult]=useState<ExpressionResult>();
 const [presenting,setPresenting]=useState(false);const presentation=useRef<StagePresentation|null>(null);
 const current=useRef(document);current.current=document;
 const request=useCallback(async(request:ExpressionRequest)=>{
  const reply=await kernelOp(kernel.transport,{op:"expression",request});
  if(reply.error||!reply.outcome||reply.outcome.result!=="expression")throw new Error(reply.error??"Expression application unavailable");
  return reply.outcome.data;
 },[kernel.transport]);
 const refresh=useCallback(async()=>{
  const listing=await request({operation:"list"});setList(listing.expressions??[]);
  if(current.current){const reading=await request({operation:"inspect",expression_ref:current.current.expression_ref});if(reading.document)setDocument(reading.document);if(reading.file)setFile(reading.file);}
 },[request]);
 useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[refresh]);
 const seq=kernel.receipts.filter(r=>r.event==="expression_changed").slice(-1)[0]?.seq;
 useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[seq,refresh]);
 const run=async(op:ExpressionRequest)=>{
  setPending(true);setError("");try{
   const data=await request(op);setResult(data);
   if(data.document)setDocument(data.document);
   if(data.file)setFile(data.file);
   if(["revision_conflict","file_revision_conflict","save_refused"].includes(data.state??""))setError(JSON.stringify(data));
   await refresh();return data;
  }catch(e){setError(String(e));return undefined;}finally{setPending(false);}
 };
 const edit=(changes:Change[])=>document&&run({operation:"edit",expression_ref:document.expression_ref,expected_revision:document.revision,actor:ACTOR,changes});
 const commitParameter=async(entity_ref:string,parameter:string,value:string|number,basis:number)=>{
  if(!document)return false;
  const data=await run({operation:"edit",expression_ref:document.expression_ref,expected_revision:basis,actor:ACTOR,changes:[{change:"parameter_set",entity_ref,parameter,value}]});
  return data?.state==="ready";
 };
 const selected=document?.selection.entity_ref?document.entities[document.selection.entity_ref]:undefined;
 const resetBinding=()=>{bindingDirty.current=false;bindingBasis.current=document?.revision??0;setBindingConflict(false);setSubject(selected?.subject?.subject_ref??"");setOwner(selected?.subject?.native_owner??"");setRole(selected?.subject?.presentation_role??"thing");setSource(selected?.subject?.sources[0]?.ref??"");setSourceRevision(selected?.subject?.sources[0]?.revision??"");};
 useEffect(()=>{if(bindingEntity.current!==selected?.entity_ref){bindingEntity.current=selected?.entity_ref;resetBinding();}else if(!bindingDirty.current)resetBinding();},[selected?.entity_ref,selected?.subject,document?.revision]);
 const startBinding=()=>{if(!bindingDirty.current)bindingBasis.current=document?.revision??0;bindingDirty.current=true;};
 const bindSubject=async(retry=false)=>{
  if(!selected||!document)return;
  const existing=selected.subject?.subject_ref===subject&&selected.subject.native_owner===owner?selected.subject:null;
  const sources=source?[{ref:source,revision:sourceRevision,availability:"available" as const},...(existing?.sources.slice(1)??[])]:[];
  const binding:SubjectBinding={subject_ref:subject,native_owner:owner,presentation_role:role,sources,readings:existing?.readings??[],actions:existing?.actions??[]};
  const data=await run({operation:"edit",expression_ref:document.expression_ref,expected_revision:retry?document.revision:bindingBasis.current,actor:ACTOR,changes:[{change:"subject_bind",entity_ref:selected.entity_ref,binding}]});
  if(data?.state==="ready")bindingDirty.current=false;
  setBindingConflict(data?.state==="revision_conflict");
 };
 useEffect(()=>{
  if(!presenting||!document)return;
  try{
   const config=expressionConfig(document);
   if(!presentation.current)presentation.current=stage.present({id:"expression-application",plane:"overlay",recipe:"",config,sceneRef:document.selection.scene_ref});
   if(!presentation.current)throw new Error(stage.error??"Expression stage is off, occupied, or unavailable");
   presentation.current.updateConfig(config,document.selection.scene_ref,document.selection.entity_ref?[document.selection.entity_ref]:[]);
  }catch(e){setError(String(e));setPresenting(false);}
 },[presenting,document,stage]);
 useEffect(()=>{if(!presenting){presentation.current?.release();presentation.current=null;}},[presenting]);
 useEffect(()=>()=>{presentation.current?.release();},[]);
 async function resolveFile(){
  const clean=filePath.trim();const slash=clean.lastIndexOf("/");
  const parent=slash<0?".":clean.slice(0,slash);const name=clean.slice(slash+1);
  const reply=await kernelOp(kernel.transport,{op:"files_list",path:parent});
  if(!reply.outcome||reply.outcome.result!=="directory_read")throw new Error(reply.error??"Folder unavailable");
  const entry=reply.outcome.directory.entries.find(e=>e.name===name&&e.kind==="file");
  if(!entry)throw new Error("Choose an existing Expression file under Central");return entry.location;
 }
 return <section className="expression-editor" aria-label="Expression composition">
  <h3>Expressions</h3>
  {error&&<p role="alert">{error}</p>}
  <div className="expression-tools">
   <label>Title<input aria-label="Expression title" value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <button disabled={pending} onClick={()=>{setFile(undefined);void run({operation:"create",expression_ref:`expression:${crypto.randomUUID()}`,title,actor:ACTOR});}}>New Expression</button>
   <label>Open Expression<select aria-label="Open Expression" value={document?.expression_ref??""} onChange={e=>{setFile(undefined);void run({operation:"inspect",expression_ref:e.target.value});}}><option value="" disabled>Choose</option>{list.map(d=><option key={d.expression_ref} value={d.expression_ref}>{d.title} · r{d.revision}</option>)}</select></label>
  </div>
  {document&&<>
   <header><h4>{document.title}</h4><span>Revision {document.revision}</span></header>
   <div className="expression-tools">
    <button disabled={pending} onClick={()=>void edit([{change:"scene_create",scene_ref:`${document.expression_ref}:scene:${crypto.randomUUID()}`,title:`Scene ${document.scenes.length+1}`}])}>Add scene</button>
    <button disabled={pending} onClick={()=>void edit([{change:"entity_add",scene_ref:document.selection.scene_ref,entity_ref:`${document.expression_ref}:entity:${crypto.randomUUID()}`,title:`Thing ${Object.keys(document.entities).length+1}`}])}>Add Thing</button>
    <button aria-pressed={presenting} onClick={()=>setPresenting(!presenting)}>{presenting?"Close presentation":"Present on stage"}</button>
   </div>
   <nav aria-label="Expression scenes">{document.scenes.map(s=><button key={s.scene_ref} aria-pressed={s.scene_ref===document.selection.scene_ref} onClick={()=>void edit([{change:"focus",scene_ref:s.scene_ref,entity_ref:null}])}>{s.title}</button>)}</nav>
   <div className="expression-entities" role="group" aria-label="Expression entities">{document.scenes.find(s=>s.scene_ref===document.selection.scene_ref)?.entity_refs.map(ref=>{const e=document.entities[ref];return <button key={ref} aria-pressed={selected?.entity_ref===ref} onClick={()=>void edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:ref}])}>{e.title}{e.subject?` · ${e.subject.presentation_role}`:""}</button>;})}</div>
   {selected&&<fieldset disabled={pending}><legend>{selected.title}</legend>
    <label>Glyph<RevisionInput label="Glyph" key={`${selected.entity_ref}:glyph`} value={selected.parameters.glyph?.value??"O"} revision={document.revision} onCommit={(value,basis)=>commitParameter(selected.entity_ref,"glyph",value,basis)}/></label>
    {(["x","y","z","scale","share"] as const).map(key=>{const p=selected.parameters[key];return <div className="expression-parameter" key={key}><label>{key}<RevisionInput label={`Entity ${key}`} numeric disabled={!!p?.automation} key={`${selected.entity_ref}:${key}`} value={p?.value??(["scale","share"].includes(key)?1:0)} revision={document.revision} onCommit={(value,basis)=>commitParameter(selected.entity_ref,key,value,basis)}/></label>{p?.automation?<button onClick={()=>void edit([{change:"parameter_manual",entity_ref:selected.entity_ref,parameter:key}])}>Take manual control of {key}</button>:p&&key==="scale"&&<button onClick={()=>void edit([{change:"parameter_automate",entity_ref:selected.entity_ref,parameter:key,automation:{min:0.5,max:1.5,rate_hz:0.2,waveform:"sine"}}])}>Animate scale</button>}</div>;})}
    <label>Native subject<input aria-label="Native subject" value={subject} onChange={e=>{startBinding();setSubject(e.target.value);}}/></label>
    <label>Native owner<input aria-label="Native owner" value={owner} onChange={e=>{startBinding();setOwner(e.target.value);}}/></label>
    <label>Presentation role<select aria-label="Presentation role" value={role} onChange={e=>{startBinding();setRole(e.target.value as "being"|"thing");}}><option value="thing">Thing</option><option value="being">Being</option></select></label>
    <label>Source ref<input aria-label="Source ref" value={source} onChange={e=>{startBinding();setSource(e.target.value);}}/></label>
    <label>Source revision<input aria-label="Source revision" value={sourceRevision} onChange={e=>{startBinding();setSourceRevision(e.target.value);}}/></label>
    <button onClick={()=>void bindSubject()}>Bind subject</button>
    {bindingConflict&&<><button onClick={()=>void bindSubject(true)}>Apply binding to revision {document.revision}</button><button onClick={resetBinding}>Use current binding</button></>}

    {selected.subject&&<button onClick={()=>void edit([{change:"subject_unbind",entity_ref:selected.entity_ref}])}>Unbind subject</button>}
    <button onClick={()=>void edit([{change:"entity_remove",entity_ref:selected.entity_ref}])}>Remove entity</button>
    {selected.subject?.actions.map(a=><button key={a.action_ref} title={a.authority_requirement} onClick={()=>void run({operation:"invoke",expression_ref:document.expression_ref,expected_revision:document.revision,entity_ref:selected.entity_ref,action_ref:a.action_ref,input:null,project:null})}>{a.action_ref}</button>)}
   </fieldset>}
   <div className="expression-tools"><button disabled={pending} onClick={async()=>{const data=await run({operation:"export",expression_ref:document.expression_ref,expected_revision:document.revision});if(data?.document){const url=URL.createObjectURL(new Blob([JSON.stringify(data.document,null,2)],{type:"application/json"}));const a=window.document.createElement("a");a.href=url;a.download="expression.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}}>Export local copy</button>
    {file&&<button disabled={pending} onClick={()=>void run({operation:"save",expression_ref:document.expression_ref,expected_revision:document.revision,location:file.location,expected_file_revision:file.revision,actor:ACTOR,actor_kind:"human"})}>Save Expression file</button>}
   </div>
   <details><summary>Subject, source and operation disclosure</summary><pre>{JSON.stringify({expression:document,last_result:result},null,2)}</pre></details>
  </>}
  <label>Existing file relative to Central<input aria-label="Expression file path" value={filePath} onChange={e=>setFilePath(e.target.value)}/></label><button disabled={pending||!filePath.trim()} onClick={()=>void resolveFile().then(location=>run({operation:"open_file",location,actor:ACTOR})).catch(e=>setError(String(e)))}>Open file</button>
 </section>;
}

/** Preserve a human's uncommitted text when an Agent advances the document.
 * The edit carries the revision the person started from; conflicts never retry. */
function RevisionInput({label,value,revision,numeric=false,disabled=false,onCommit}:{label:string;value:string|number;revision:number;numeric?:boolean;disabled?:boolean;onCommit:(value:string|number,basis:number)=>Promise<boolean>}){
 const [draft,setDraft]=useState(String(value));const dirty=useRef(false);const basis=useRef(revision);const [uncommitted,setUncommitted]=useState(false);
 useEffect(()=>{if(!dirty.current){setDraft(String(value));basis.current=revision;}},[value,revision]);
 return <span><input aria-label={label} type={numeric?"number":"text"} step={numeric?"any":undefined} disabled={disabled} value={draft}
  onFocus={()=>{if(!dirty.current)basis.current=revision;}}
  onChange={e=>{dirty.current=true;setDraft(e.target.value);}}
  onBlur={()=>{if(!dirty.current)return;const next=numeric?Number(draft):draft;if(numeric&&(!draft.trim()||!Number.isFinite(next)))return;
   void onCommit(next,basis.current).then(accepted=>{if(accepted)dirty.current=false;setUncommitted(!accepted);});}}/>
  {uncommitted&&<><button onClick={()=>{const next=numeric?Number(draft):draft;void onCommit(next,revision).then(accepted=>{if(accepted)dirty.current=false;setUncommitted(!accepted);});}}>Apply {label} to revision {revision}</button><button onClick={()=>{dirty.current=false;basis.current=revision;setDraft(String(value));setUncommitted(false);}}>Use current {label}</button></>}
 </span>;
}
