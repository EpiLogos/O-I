/**
 * The Expression composer's reusable bodies. Each is the exact markup the
 * composer has always rendered (same classes, labels and text — the walks
 * pin them), lifted out so the Expressions centre surface can place the same
 * controls in its field-local Studio instead of re-implementing them.
 *
 *   ExpressionEntityInspector  the selected entity: parameters, automation,
 *                              subject binding, native Actions, remove
 *   ExpressionPedagogy         structured source-backed pedagogy proposal
 *   ExpressionRefinementReview proposals awaiting human review
 *   ExpressionReviewedDecisions reviewed proposals and human decisions
 *   RevisionInput              the revision-preserving field
 */
import {useEffect,useId,useRef,useState} from "react";
import type {Change,SubjectBinding} from "./types";
import {compilePedagogy,type PedagogicalSequence} from "./pedagogy";
import {EXPRESSION_EDITOR_ACTOR as ACTOR,type ExpressionApplication} from "./useExpressionApplication";

/** The inspector of the selected entity. Renders nothing without one. */
export function ExpressionEntityInspector({app}:{app:ExpressionApplication}){
 const {document,selected,pending,run,edit,commitParameter}=app;
 const [subject,setSubject]=useState("");const [owner,setOwner]=useState("");const [role,setRole]=useState<"being"|"thing">("thing");
 const bindingDirty=useRef(false);const bindingBasis=useRef(0);const bindingEntity=useRef<string>();const [bindingConflict,setBindingConflict]=useState(false);
 const [source,setSource]=useState("");const [sourceRevision,setSourceRevision]=useState("");
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
 if(!document||!selected)return null;
 return <fieldset className="expression-inspector" disabled={pending}><legend>{selected.title} <span className="oi-state">{selected.subject?`${selected.subject.presentation_role} · ${selected.subject.native_owner}`:"unbound"}</span></legend>
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
 </fieldset>;
}

/** Structured, source-backed pedagogy: compiled locally, proposed for human
 * review through the owner. */
export function ExpressionPedagogy({app}:{app:ExpressionApplication}){
 const {document,pending,run,setError}=app;
 const [lesson,setLesson]=useState("");
 const [presentationDisclosure,setPresentationDisclosure]=useState<ReturnType<typeof compilePedagogy>["agentPresentation"]>([]);
 if(!document)return null;
 return <details className="expression-pedagogy oi-disclosure"><summary>Propose structured source-backed pedagogy</summary>
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
 </details>;
}

/** Proposals awaiting human review. Renders nothing when none are pending. */
export function ExpressionRefinementReview({app}:{app:ExpressionApplication}){
 const {document,pending,pendingRefinements,run,setError}=app;
 const [reviewReason,setReviewReason]=useState("");
 const [reviewCorrections,setReviewCorrections]=useState("[]");
 if(!document||pendingRefinements.length===0)return null;
 const review=async(proposalRef:string,decision:"accepted"|"rejected")=>{
  let corrections:Change[]=[];
  if(decision==="accepted"){const parsed:unknown=JSON.parse(reviewCorrections);if(!Array.isArray(parsed))throw new Error("Corrections must be a JSON array of Expression changes");corrections=parsed as Change[];}
  const result=await run({operation:"review",expression_ref:document.expression_ref,expected_revision:document.revision,proposal_ref:proposalRef,actor:ACTOR,decision,reason:reviewReason,corrections});
  if(result?.state==="ready"){setReviewReason("");setReviewCorrections("[]");}
 };
 return <section className="expression-refinements oi-section" aria-label="Expression refinement proposals">
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
 </section>;
}

/** Reviewed proposals and their human decisions. */
export function ExpressionReviewedDecisions({app}:{app:ExpressionApplication}){
 const {document}=app;
 if(!document||!document.refinements.some(proposal=>proposal.decision))return null;
 return <details className="expression-refinements oi-disclosure"><summary>Reviewed proposals and human decisions</summary>{document.refinements.filter(proposal=>proposal.decision).map(proposal=><article key={proposal.proposal_ref}><strong>{proposal.summary}</strong><span>{proposal.decision!.state} by {proposal.decision!.actor} · {proposal.decision!.reason}</span><p>{proposal.decision!.corrections.length} retained correction changes</p></article>)}</details>;
}

/** Preserve a human's uncommitted text when an Agent advances the document.
 * The edit carries the revision the person started from; conflicts never retry. */
export function RevisionInput({label,caption=label,value,revision,numeric=false,disabled=false,onCommit}:{label:string;caption?:string;value:string|number;revision:number;numeric?:boolean;disabled?:boolean;onCommit:(value:string|number,basis:number)=>Promise<boolean>}){
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
