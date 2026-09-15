import {useCallback,useEffect,useId,useRef,useState} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {kernelOp} from "../kernel/bridge";
import {useExpressionStage,type StagePresentation} from "../stage/ExpressionStage";
import {expressionConfig} from "./engineProjection";
import type {Change,ExpressionDocument,ExpressionRequest,ExpressionResult,SubjectBinding} from "./types";
import type {CentralLocation} from "../kernel/types";
import {compilePedagogy,type PedagogicalSequence} from "./pedagogy";
import {ShareProjection} from "../explore/ShareProjection";
import "./expression.css";
const ACTOR="human:expression-editor";

export function ExpressionView({initialExpressionRef}:{initialExpressionRef?:string}={}){
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
 const [reviewReason,setReviewReason]=useState("");
 const [reviewCorrections,setReviewCorrections]=useState("[]");
 const [lesson,setLesson]=useState("");
 const [presentationDisclosure,setPresentationDisclosure]=useState<ReturnType<typeof compilePedagogy>["agentPresentation"]>([]);
 const [presenting,setPresenting]=useState(false);const presentation=useRef<StagePresentation|null>(null);const stageHost=useRef<HTMLDivElement|null>(null);
 const mounted=useRef(true);const readGeneration=useRef(0);const selectedRef=useRef<string>();
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;readGeneration.current++;};},[]);
 // Share / Project remains separate from Save, Export and Present.
 const [sharing,setSharing]=useState(false);
 const request=useCallback(async(request:ExpressionRequest)=>{
  const reply=await kernelOp(kernel.transport,{op:"expression",request});
  if(reply.error||!reply.outcome||reply.outcome.result!=="expression")throw new Error(reply.error??"Expression application unavailable");
  return reply.outcome.data;
 },[kernel.transport]);
 const inspect=useCallback(async(expressionRef:string)=>{
  const generation=++readGeneration.current;selectedRef.current=expressionRef;setPending(false);setError("");
  const reading=await request({operation:"inspect",expression_ref:expressionRef});
  if(!mounted.current||generation!==readGeneration.current||selectedRef.current!==expressionRef)return;
  if(reading.document)setDocument(reading.document);if(reading.file)setFile(reading.file);
 },[request]);
 const refresh=useCallback(async()=>{
  const generation=readGeneration.current;const expressionRef=selectedRef.current;
  const listing=await request({operation:"list"});if(!mounted.current||generation!==readGeneration.current)return;setList(listing.expressions??[]);
  if(expressionRef){const reading=await request({operation:"inspect",expression_ref:expressionRef});if(!mounted.current||generation!==readGeneration.current||selectedRef.current!==expressionRef)return;if(reading.document)setDocument(reading.document);if(reading.file)setFile(reading.file);}
 },[request]);
 useEffect(()=>{if(initialExpressionRef)void inspect(initialExpressionRef).catch(e=>setError(String(e)));else void refresh().catch(e=>setError(String(e)));},[refresh,inspect,initialExpressionRef]);
 const seq=kernel.receipts.filter(r=>r.event==="expression_changed").slice(-1)[0]?.seq;
 useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[seq,refresh]);
 const run=async(op:ExpressionRequest)=>{
  const target="expression_ref" in op?op.expression_ref:undefined;
  let generation=readGeneration.current;
  if(op.operation==="create"){selectedRef.current=op.expression_ref;generation=++readGeneration.current;}
  setPending(true);setError("");try{
   const data=await request(op);
   const currentSelection=mounted.current&&generation===readGeneration.current&&(!target||selectedRef.current===target);
   if(!currentSelection)return undefined;
   setResult(data);
   if(data.document){selectedRef.current=data.document.expression_ref;setDocument(data.document);}
   if(data.file)setFile(data.file);
   if(["revision_conflict","proposal_basis_conflict","file_revision_conflict","save_refused"].includes(data.state??""))setError(JSON.stringify(data));
   await refresh();return data;
  }catch(e){if(mounted.current&&generation===readGeneration.current)setError(String(e));return undefined;}finally{if(mounted.current&&generation===readGeneration.current)setPending(false);}
 };
 const review=async(proposalRef:string,decision:"accepted"|"rejected")=>{
  let corrections:Change[]=[];
  if(decision==="accepted"){const parsed:unknown=JSON.parse(reviewCorrections);if(!Array.isArray(parsed))throw new Error("Corrections must be a JSON array of Expression changes");corrections=parsed as Change[];}
  const result=await run({operation:"review",expression_ref:document!.expression_ref,expected_revision:document!.revision,proposal_ref:proposalRef,actor:ACTOR,decision,reason:reviewReason,corrections});
  if(result?.state==="ready"){setReviewReason("");setReviewCorrections("[]");}
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
   presentation.current.setContainer(stageHost.current);
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
 const pendingRefinements=document?.refinements.filter(proposal=>!proposal.decision)??[];
 const sceneEntities=document?.scenes.find(s=>s.scene_ref===document.selection.scene_ref)?.entity_refs??[];
 return <section className="expression-editor" aria-label="Expression composition" data-expression-ref={document?.expression_ref} data-presenting={presenting}>
  {/* Head: what this composition is (title, revision, file identity) and the
      few primary tools — one row, no banner. The field itself is the body. */}
  <header className="expression-head oi-context-head">
   <div className="oi-context-head-title">
    <h3>{document?document.title:"Expressions"}</h3>
    {document?<small><span className="oi-ref">{document.expression_ref}</span> · revision {document.revision}{file?<> · <span className="oi-ref">{file.location.path??JSON.stringify(file.location)}</span></>:" · not yet a file"}</small>:<small>Compose a living field: scenes, Things and Beings, bound to native subjects.</small>}
   </div>
   {document&&<div className="oi-action-group">
    <button className="oi-action" aria-pressed={presenting} onClick={()=>setPresenting(!presenting)}>{presenting?"Close presentation":"Present on stage"}</button>
    <button className="oi-action expression-share" aria-pressed={sharing} onClick={()=>setSharing(!sharing)} title="Project this Expression for an audience: exact outward preview, omissions, audience, Projection, Open in Explore">{sharing?"Close share":"Share / Project"}</button>
   </div>}
  </header>
  {error&&<p role="alert">{error}</p>}
  {/* Identity row: open an existing Expression or begin a new one. */}
  <div className="expression-tools expression-identity">
   <label className="oi-field">Open Expression<select className="oi-input" aria-label="Open Expression" value={document?.expression_ref??""} onChange={e=>{setFile(undefined);void inspect(e.target.value).catch(error=>setError(String(error)));}}><option value="" disabled>Choose</option>{list.map(d=><option key={d.expression_ref} value={d.expression_ref}>{d.title} · r{d.revision}</option>)}</select></label>
   <label className="oi-field">New Expression title<input className="oi-input" aria-label="Expression title" value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <button className="oi-action" disabled={pending} onClick={()=>{setFile(undefined);void run({operation:"create",expression_ref:`expression:${crypto.randomUUID()}`,title,actor:ACTOR});}}>New Expression</button>
  </div>
  {document&&<>
   {/* The field: the stage artboard is the primary body while presenting;
       scenes and entities are its plane nav and its selection row. */}
   <div ref={stageHost} className="expression-stage-host" aria-label="Expression artboard" hidden={!presenting}/>
   <nav className="expression-scenes oi-plane-nav" aria-label="Expression scenes">{document.scenes.map(s=><button key={s.scene_ref} aria-pressed={s.scene_ref===document.selection.scene_ref} onClick={()=>void edit([{change:"focus",scene_ref:s.scene_ref,entity_ref:null}])}>{s.title}</button>)}<button className="oi-tool expression-add" aria-label="Add scene" title="Add scene" disabled={pending} onClick={()=>void edit([{change:"scene_create",scene_ref:`${document.expression_ref}:scene:${crypto.randomUUID()}`,title:`Scene ${document.scenes.length+1}`}])}>+</button></nav>
   <div className="expression-entities" role="group" aria-label="Expression entities">
    {sceneEntities.map(ref=>{const e=document.entities[ref];return <button key={ref} className="expression-entity" aria-pressed={selected?.entity_ref===ref} onClick={()=>void edit([{change:"focus",scene_ref:document.selection.scene_ref,entity_ref:ref}])}>{e.title}{e.subject?<span className="oi-state">{e.subject.presentation_role} · {e.subject.native_owner}</span>:null}</button>;})}
    <button className="oi-action expression-add" disabled={pending} onClick={()=>void edit([{change:"entity_add",scene_ref:document.selection.scene_ref,entity_ref:`${document.expression_ref}:entity:${crypto.randomUUID()}`,title:`Thing ${Object.keys(document.entities).length+1}`}])}>Add Thing</button>
    {sceneEntities.length===0&&<span className="oi-note">This scene holds nothing yet.</span>}
   </div>
   {selected&&<fieldset className="expression-inspector" disabled={pending}><legend>{selected.title} <span className="oi-state">{selected.subject?`${selected.subject.presentation_role} · ${selected.subject.native_owner}`:"unbound"}</span></legend>
    <div className="expression-parameters">
    <RevisionInput label="Glyph" key={`${selected.entity_ref}:glyph`} value={selected.parameters.glyph?.value??"O"} revision={document.revision} onCommit={(value,basis)=>commitParameter(selected.entity_ref,"glyph",value,basis)}/>
    {(["x","y","z","scale","share"] as const).map(key=>{const p=selected.parameters[key];return <div className="expression-parameter" key={key}><RevisionInput caption={key} label={`Entity ${key}`} numeric disabled={!!p?.automation} key={`${selected.entity_ref}:${key}`} value={p?.value??(["scale","share"].includes(key)?1:0)} revision={document.revision} onCommit={(value,basis)=>commitParameter(selected.entity_ref,key,value,basis)}/>{p?.automation?<button className="oi-action" onClick={()=>void edit([{change:"parameter_manual",entity_ref:selected.entity_ref,parameter:key}])}>Take manual control of {key}</button>:p&&key==="scale"&&<button className="oi-action" onClick={()=>void edit([{change:"parameter_automate",entity_ref:selected.entity_ref,parameter:key,automation:{min:0.5,max:1.5,rate_hz:0.2,waveform:"sine"}}])}>Animate scale</button>}</div>;})}
    </div>
    <details className="expression-binding oi-disclosure" open={!!selected.subject||bindingDirty.current}><summary>Subject binding <span className="oi-state">{selected.subject?selected.subject.subject_ref:"none"}</span></summary>
     <div className="expression-binding-fields">
      <label className="oi-field">Native subject<input className="oi-input" aria-label="Native subject" value={subject} onChange={e=>{startBinding();setSubject(e.target.value);}}/></label>
      <label className="oi-field">Native owner<input className="oi-input" aria-label="Native owner" value={owner} onChange={e=>{startBinding();setOwner(e.target.value);}}/></label>
      <label className="oi-field">Presentation role<select className="oi-input" aria-label="Presentation role" value={role} onChange={e=>{startBinding();setRole(e.target.value as "being"|"thing");}}><option value="thing">Thing</option><option value="being">Being</option></select></label>
      <label className="oi-field">Source ref<input className="oi-input" aria-label="Source ref" value={source} onChange={e=>{startBinding();setSource(e.target.value);}}/></label>
      <label className="oi-field">Source revision<input className="oi-input" aria-label="Source revision" value={sourceRevision} onChange={e=>{startBinding();setSourceRevision(e.target.value);}}/></label>
     </div>
     <div className="oi-action-group">
      <button className="oi-action" onClick={()=>void bindSubject()}>Bind subject</button>
      {bindingConflict&&<><button className="oi-action" onClick={()=>void bindSubject(true)}>Apply binding to revision {document.revision}</button><button className="oi-action" onClick={resetBinding}>Use current binding</button></>}
      {selected.subject&&<button className="oi-action" onClick={()=>void edit([{change:"subject_unbind",entity_ref:selected.entity_ref}])}>Unbind subject</button>}
     </div>
    </details>
    {selected.subject&&selected.subject.actions.length>0&&<div className="expression-subject-actions"><span className="oi-eyebrow">Native Actions · {selected.subject.native_owner}</span><div className="oi-action-group">{selected.subject.actions.map(a=><button key={a.action_ref} className="oi-action" title={a.authority_requirement} onClick={()=>void run({operation:"invoke",expression_ref:document.expression_ref,expected_revision:document.revision,entity_ref:selected.entity_ref,action_ref:a.action_ref,input:null,project:null})}>{a.action_ref}</button>)}</div></div>}
    <div className="oi-action-group expression-entity-tools"><button className="oi-action" onClick={()=>void edit([{change:"entity_remove",entity_ref:selected.entity_ref}])}>Remove entity</button></div>
   </fieldset>}
   <details className="expression-pedagogy oi-disclosure"><summary>Propose structured source-backed pedagogy</summary>
    <p>Enter scenes, exact Expression object refs, disclosed subject bindings, explicit motion intent and duration, and exact Method/evidence readings. Personal-Web and Agent subjects pass through their native-disclosure adapters; an Agent without a disclosed Agent ref is refused.</p>
    <label className="oi-field">Pedagogy operation<textarea className="oi-input" spellCheck={false} autoCorrect="off" autoCapitalize="off" aria-label="Structured pedagogy operation" value={lesson} onChange={event=>setLesson(event.target.value)} placeholder={`{
  "summary": "…",
  "scenes": […],
  "motions": […],
  "method_refs": […],
  "evidence_refs": […]
}`}/></label>
    <button className="oi-action" disabled={pending||!lesson.trim()} onClick={()=>{try{const sequence=JSON.parse(lesson) as PedagogicalSequence;const compiled=compilePedagogy(sequence);setPresentationDisclosure(compiled.agentPresentation);const nonce=crypto.randomUUID();void run({operation:"propose",expression_ref:document.expression_ref,expected_revision:document.revision,proposal_ref:`${document.expression_ref}:proposal:${nonce}`,actor:ACTOR,activity_ref:null,continues_proposal_ref:document.refinements.slice().reverse().find(proposal=>proposal.decision)?.proposal_ref??null,summary:sequence.summary,changes:compiled.changes,method_refs:sequence.method_refs,evidence_refs:sequence.evidence_refs});}catch(error){setError(String(error));}}}>Submit structured proposal for human review</button>
    {presentationDisclosure.length>0&&<details className="oi-disclosure"><summary>Disclosed Agent presentation state</summary><pre>{JSON.stringify(presentationDisclosure,null,2)}</pre></details>}
   </details>
   {pendingRefinements.length>0&&<section className="expression-refinements oi-section" aria-label="Expression refinement proposals">
    <h3>Proposals awaiting review <span className="oi-state">{pendingRefinements.length}</span></h3>
    {pendingRefinements.map(proposal=><article key={proposal.proposal_ref} data-proposal-ref={proposal.proposal_ref}>
     <strong>{proposal.summary}</strong><span className="oi-note">{proposal.proposed_by}{proposal.activity_ref?` · supplied Activity correlation ${proposal.activity_ref} (unverified here)`:" · no Activity ref disclosed"}</span>
     <p>{proposal.changes.length} proposed changes · {proposal.method_refs.length} methods · {proposal.evidence_refs.length} evidence sources. Attribution and Activity refs do not authenticate authority.</p>
     <label className="oi-field">Decision note<input className="oi-input" aria-label={`Decision note for ${proposal.proposal_ref}`} value={reviewReason} onChange={event=>setReviewReason(event.target.value)}/></label>
     <label className="oi-field">Correction changes<textarea className="oi-input" spellCheck={false} autoCorrect="off" autoCapitalize="off" aria-label={`Correction changes for ${proposal.proposal_ref}`} value={reviewCorrections} onChange={event=>setReviewCorrections(event.target.value)}/></label>
     <div className="oi-action-group"><button className="oi-action oi-action-primary" disabled={pending||!reviewReason.trim()} onClick={()=>void review(proposal.proposal_ref,"accepted").catch(error=>setError(String(error)))}>Accept with corrections</button>
     <button className="oi-action" disabled={pending||!reviewReason.trim()} onClick={()=>void review(proposal.proposal_ref,"rejected").catch(error=>setError(String(error)))}>Reject and retain note</button></div>
     <details className="oi-disclosure"><summary>Inspect proposal, methods and evidence</summary><pre>{JSON.stringify(proposal,null,2)}</pre></details>
    </article>)}
   </section>}
   {document.refinements.some(proposal=>proposal.decision)&&<details className="expression-refinements oi-disclosure"><summary>Reviewed proposals and human decisions</summary>{document.refinements.filter(proposal=>proposal.decision).map(proposal=><article key={proposal.proposal_ref}><strong>{proposal.summary}</strong><span>{proposal.decision!.state} by {proposal.decision!.actor} · {proposal.decision!.reason}</span><p>{proposal.decision!.corrections.length} retained correction changes</p></article>)}</details>}
   {sharing&&<ShareProjection key={`${document.expression_ref}@${document.revision}`} document={document} onClose={()=>setSharing(false)}/>}
   <div className="expression-tools oi-action-group"><button className="oi-action" disabled={pending} onClick={async()=>{const data=await run({operation:"export",expression_ref:document.expression_ref,expected_revision:document.revision});if(data?.document){const url=URL.createObjectURL(new Blob([JSON.stringify(data.document,null,2)],{type:"application/json"}));const a=window.document.createElement("a");a.href=url;a.download="expression.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}}>Export local copy</button>
    {file&&<button className="oi-action oi-action-primary" disabled={pending} onClick={()=>void run({operation:"save",expression_ref:document.expression_ref,expected_revision:document.revision,location:file.location,expected_file_revision:file.revision,actor:ACTOR,actor_kind:"human"})}>Save Expression file</button>}
   </div>
   <details className="oi-disclosure"><summary>Subject, source and operation disclosure</summary><pre>{JSON.stringify({expression:document,last_result:result},null,2)}</pre></details>
  </>}
  <details className="expression-file oi-disclosure"><summary>Open an Expression file</summary>
   <div className="expression-tools"><label className="oi-field">Existing file relative to Central<input className="oi-input" aria-label="Expression file path" value={filePath} onChange={e=>setFilePath(e.target.value)}/></label><button className="oi-action" disabled={pending||!filePath.trim()} onClick={()=>void resolveFile().then(location=>run({operation:"open_file",location,actor:ACTOR})).catch(e=>setError(String(e)))}>Open file</button></div>
  </details>
 </section>;
}

/** Preserve a human's uncommitted text when an Agent advances the document.
 * The edit carries the revision the person started from; conflicts never retry. */
function RevisionInput({label,caption=label,value,revision,numeric=false,disabled=false,onCommit}:{label:string;caption?:string;value:string|number;revision:number;numeric?:boolean;disabled?:boolean;onCommit:(value:string|number,basis:number)=>Promise<boolean>}){
 const id=useId();
 const [draft,setDraft]=useState(String(value));const dirty=useRef(false);const basis=useRef(revision);
 const [uncommitted,setUncommitted]=useState(false),[invalid,setInvalid]=useState(false);
 useEffect(()=>{if(!dirty.current){setDraft(String(value));basis.current=revision;}},[value,revision]);
 const restore=()=>{dirty.current=false;basis.current=revision;setDraft(String(value));setUncommitted(false);setInvalid(false);};
 const commit=(expectedRevision:number)=>{
  const next=numeric?Number(draft):draft;
  if(numeric&&(!draft.trim()||!Number.isFinite(next))){setInvalid(true);return;}
  setInvalid(false);
  void onCommit(next,expectedRevision).then(accepted=>{if(accepted)dirty.current=false;setUncommitted(!accepted);});
 };
 return <div className="expression-revision-field">
  <label className="oi-field" htmlFor={id}>{caption}</label>
  <input id={id} className="oi-input" aria-label={label} aria-invalid={invalid||undefined} aria-describedby={invalid?`${id}-error`:uncommitted?`${id}-conflict`:undefined} type={numeric?"number":"text"} step={numeric?"any":undefined} disabled={disabled} value={draft}
   onFocus={()=>{if(!dirty.current)basis.current=revision;}}
   onChange={e=>{dirty.current=true;setDraft(e.target.value);setInvalid(false);}}
   onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur();}else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();restore();}}}
   onBlur={()=>{if(dirty.current)commit(basis.current);}}/>
  {invalid&&<p id={`${id}-error`} className="oi-note" role="alert">Enter a finite number for {caption}. The saved value is unchanged.</p>}
  {uncommitted&&<><p id={`${id}-conflict`} className="oi-note">This edit was not applied. Review the current revision before retrying.</p><div className="oi-action-group"><button className="oi-action" onClick={()=>commit(revision)}>Apply {label} to revision {revision}</button><button className="oi-action" onClick={restore}>Use current {label}</button></div></>}
 </div>;
}
