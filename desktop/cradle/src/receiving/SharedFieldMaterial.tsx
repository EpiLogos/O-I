import {useEffect,useState} from "react";
import {createProjection,withdrawProjection} from "../../../../shared-field/index.mjs";
/** Shared Field material for the OPEN document (Wave 7). Publication is the
 * owner's portable projection contract — this strip composes and withdraws
 * real `oi.projection/v1` envelopes through `shared-field/index.mjs`, it does
 * not re-implement the contract. Audience and publisher stay explicit typed
 * inputs (participant enumeration is still an open owner lane); visibility
 * defaults to restricted because the desktop publishes excerpts of private
 * documents, never public material by accident. The envelope is presentation
 * state beside the document — no store, no second panel. */

/** A selection handed over from the context tray's publish destination.
 * Carries source identity only; publisher/audience stay explicit inputs. */
export interface SharedFieldCandidate {sourceRef:string;revision:string;text:string;title:string}
/** What the pending slot carries: a fresh composition, or the envelope this
 * surface already published (so the record survives the tab system's
 * unmount-on-inactive law the same way an addressed composition does).
 * Presentation state only — never persisted, never re-sent anywhere. */
type PendingSharedField={sourceRef:string;candidate?:SharedFieldCandidate;envelope?:Record<string,unknown>&{projection_ref:string;projection_revision:number;state:string}};
let pendingSharedField:PendingSharedField|undefined;
export function composeSharedField(candidate:SharedFieldCandidate) {
  pendingSharedField={sourceRef:candidate.sourceRef,candidate};
  window.dispatchEvent(new CustomEvent("oi:shared-field-candidate",{detail:candidate}));
}
/** A published projection this surface composed, held as presentation state so
 * the human can see and withdraw exactly what they published. */
interface PublishedProjection {envelope:Record<string,unknown>&{projection_ref:string;projection_revision:number;state:string};sourceRef:string}
export function SharedFieldMaterial({sourceRef}:{sourceRef:string}) {
 const [candidate,setCandidate]=useState<SharedFieldCandidate>();
 const [publisher,setPublisher]=useState("");
 const [audience,setAudience]=useState("");
 const [visibility,setVisibility]=useState("restricted");
 const [reason,setReason]=useState("");
 const [published,setPublished]=useState<PublishedProjection>();
 const [error,setError]=useState<string>();
 const take=(event:Event)=>{
  const detail=(event as CustomEvent<SharedFieldCandidate>).detail;
  if(detail?.sourceRef===sourceRef){pendingSharedField={sourceRef,candidate:detail};setCandidate(detail);setError(undefined);}
 };
 useEffect(()=>{window.addEventListener("oi:shared-field-candidate",take);return()=>window.removeEventListener("oi:shared-field-candidate",take);},[sourceRef]);
 // A composition made while another tab held the view — or a projection this
 // surface published before an inactive-tab unmount — is consumed the moment
 // this strip renders again for the same source.
 useEffect(()=>{
  if(pendingSharedField?.sourceRef===sourceRef){
   const pending=pendingSharedField;pendingSharedField=undefined;
   if(pending.envelope)setPublished({envelope:pending.envelope,sourceRef});
   else if(pending.candidate)setCandidate(pending.candidate);
  }
 },[sourceRef]);
 const publish=()=>{
  setError(undefined);
  const refs=audience.split(/[\s,]+/).filter(Boolean);
  if(!publisher.trim()){setError("Name the publishing participant — publication carries its attribution.");return;}
  if(visibility==="restricted"||visibility==="private"){
   if(!refs.length){setError(`A ${visibility} projection names its audience explicitly — add at least one participant ref.`);return;}
  }
  try{
   const envelope=createProjection({
    projection_ref:`projection:desktop:${Date.now().toString(36)}`,
    projection_revision:1,
    subject:{ref:sourceRef,kind:"central.document"},
    source:{system:"central",revision:candidate!.revision},
    publisher_participant_ref:publisher.trim(),
    published_at:new Date().toISOString(),
    audience:{visibility,...(refs.length?{refs}:[])},
    representation:{kind:"oi.sparse-representation/v1",payload:{schema:"oi.sparse-representation/v1",title:candidate!.title,text:candidate!.text,meta:[{label:"Native type",value:"central.document"}]}},
    provenance:[{kind:"document-source",ref:sourceRef,source_system:"central",revision:candidate!.revision}],
   }) as PublishedProjection["envelope"];
   pendingSharedField={sourceRef,envelope};
   setPublished({envelope,sourceRef});setCandidate(undefined);
  }catch(err){setError(String(err));}
 };
 const withdraw=()=>{
  if(!published||!reason.trim()){setError("Name the withdrawal reason — withdrawal is a new projection revision, never a deletion.");return;}
  try{
   const envelope=withdrawProjection(published.envelope,{published_at:new Date().toISOString(),reason:reason.trim()}) as PublishedProjection["envelope"];
   pendingSharedField={sourceRef,envelope};
   setPublished({...published,envelope});setError(undefined);
  }catch(err){setError(String(err));}
 };
 if(!candidate&&!published)return null;
 const envelope=published?.envelope;
 const audienceRefs=(envelope?.audience as {refs?:string[]}|undefined)?.refs??[];
 return <section className="shared-field-material" aria-label="Shared material for this document">
  <header><span>Shared material for this document</span>{envelope&&<small data-projection-state={envelope.state}>projection {envelope.projection_ref} · rev {envelope.projection_revision} · {envelope.state}</small>}</header>
  {candidate&&<div className="shared-field-compose">
   <p className="shared-field-quote">{candidate.text}</p>
   <p className="context-origin">{candidate.sourceRef} · revision {candidate.revision}</p>
   <div className="shared-field-fields">
    <label>Publish as<input aria-label="Publisher participant" value={publisher} onChange={event=>setPublisher(event.target.value)} placeholder="participant ref the projection is published under" autoComplete="off" spellCheck={false}/></label>
    <label>Audience participants<input aria-label="Audience participants" value={audience} onChange={event=>setAudience(event.target.value)} placeholder="comma-separated participant refs" autoComplete="off" spellCheck={false}/></label>
    <label>Visibility<select aria-label="Projection visibility" value={visibility} onChange={event=>setVisibility(event.target.value)}>{["public","unlisted","restricted","private"].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
   </div>
   <div className="shared-field-actions"><span>The owner projection contract validates the envelope; the receiving field quarantines and admits it under its own law.</span><button className="shared-field-publish" onClick={publish}>Publish projection</button></div>
  </div>}
  {envelope&&<div className="shared-field-published" data-projection-ref={envelope.projection_ref} data-projection-revision={envelope.projection_revision} data-projection-state={envelope.state} data-projection={JSON.stringify(envelope)}>
   <p>Subject <code>{String((envelope.subject as {ref:string}).ref)}</code> at source revision <code>{String((envelope.source as {revision:string}).revision)}</code> — published by <code>{String(envelope.publisher_participant_ref)}</code> for {String((envelope.audience as {visibility:string}).visibility)} audience{audienceRefs.length?`: ${audienceRefs.join(", ")}`:""}.</p>
   {envelope.state==="withdrawn"
    ?<p role="status">Withdrawn at revision {envelope.projection_revision} — “{String((envelope.withdrawal as {reason:string}).reason)}”. Receivers keep what they already admitted; the source history is not deleted.</p>
    :<div className="shared-field-withdraw">
     <label>Withdrawal reason<input aria-label="Withdrawal reason" value={reason} onChange={event=>setReason(event.target.value)} placeholder="why this projection is being withdrawn" autoComplete="off" spellCheck={false}/></label>
     <button className="shared-field-withdraw-send" onClick={withdraw}>Withdraw projection</button>
    </div>}
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
