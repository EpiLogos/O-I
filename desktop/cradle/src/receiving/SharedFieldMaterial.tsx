import {useEffect,useState} from "react";
import {createProjection,withdrawProjection} from "../../../../shared-field/index.mjs";
import {useKernel} from "../kernel/KernelProvider";
import {hostedPublicationArgs,sharedField,type SharedFieldHostedResult,type SharedFieldStatus} from "../knowledge/shared-field";
/** Shared Field material for the OPEN document (Wave 7). Publication is the
 * owner's portable projection contract — this strip composes and withdraws
 * real `oi.projection/v1` envelopes through `shared-field/index.mjs`, it does
 * not re-implement the contract. Audience and publisher stay explicit typed
 * inputs (participant enumeration is still an open owner lane); visibility
 * defaults to restricted because the desktop publishes excerpts of private
 * documents, never public material by accident. The envelope is presentation
 * state beside the document — no store, no second panel.
 *
 * Hosting (Lane C step 5): once an envelope is composed, an explicit
 * "Publish to the hosted field" act sends it through the kernel's
 * `shared_field` op to the O:I-owned client (`publish {args}`), and only
 * when the kernel reports a bound target. The hosted result is shown
 * verbatim — the hosted Projection row, the target, and the transport
 * identity labelled as transport. No target, token or hosted state lives
 * in the renderer. */

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
interface PublishedProjection {envelope:Record<string,unknown>&{projection_ref:string;projection_revision:number;state:string};sourceRef:string;candidate?:SharedFieldCandidate}
/** The selection an envelope was composed from, needed to host it (label,
 * summary and revision of the Explore entry); a record restored through the
 * consumed-on-view slot carries it too. */
const candidateOf=(published:PublishedProjection)=>published.candidate;
export function SharedFieldMaterial({sourceRef}:{sourceRef:string}) {
 const [candidate,setCandidate]=useState<SharedFieldCandidate>();
 const [publisher,setPublisher]=useState("");
 const [audience,setAudience]=useState("");
 const [visibility,setVisibility]=useState("restricted");
 const [reason,setReason]=useState("");
 const [published,setPublished]=useState<PublishedProjection>();
 const [error,setError]=useState<string>();
 const {transport}=useKernel();
 const [hostedStatus,setHostedStatus]=useState<SharedFieldStatus>();
 const [hosted,setHosted]=useState<SharedFieldHostedResult>();
 const [hostedBusy,setHostedBusy]=useState(false);
 // The kernel reports whether a hosting target is bound (the client's own
 // `status`, no network) once there is an envelope to host; nothing is sent.
 useEffect(()=>{
  if(!published||hostedStatus)return;
  let active=true;
  void sharedField<SharedFieldStatus>(transport,{kind:"status"}).then(s=>{if(active)setHostedStatus(s);}).catch(err=>{if(active)setHostedStatus({state:"unavailable",owner_operation:"shared-field.projection",detail:String(err)});});
  return()=>{active=false;};
 },[published,hostedStatus,transport]);
 const publishHosted=async()=>{
  if(!published||!candidateOf(published))return;
  setHostedBusy(true);setError(undefined);
  try{
   const args=hostedPublicationArgs(published.envelope,candidateOf(published)!);
   setHosted(await sharedField<SharedFieldHostedResult>(transport,{kind:"publish",args}));
  }catch(err){setError(String(err));}
  finally{setHostedBusy(false);}
 };
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
   if(pending.envelope)setPublished({envelope:pending.envelope,sourceRef,candidate:pending.candidate});
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
   pendingSharedField={sourceRef,envelope,candidate};
   setPublished({envelope,sourceRef,candidate});setCandidate(undefined);
  }catch(err){setError(String(err));}
 };
 const withdraw=()=>{
  if(!published||!reason.trim()){setError("Name the withdrawal reason — withdrawal is a new projection revision, never a deletion.");return;}
  try{
   const envelope=withdrawProjection(published.envelope,{published_at:new Date().toISOString(),reason:reason.trim()}) as PublishedProjection["envelope"];
   pendingSharedField={sourceRef,envelope,candidate:published.candidate};
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
   {envelope.state==="published"&&!hosted&&hostedStatus&&"bound" in hostedStatus&&hostedStatus.bound&&<div className="shared-field-actions shared-field-host" data-hosted-target={`${hostedStatus.target.uri}/${hostedStatus.target.database}`}><span>Hosting target <code>{hostedStatus.target.name}</code> ({hostedStatus.target.uri}/{hostedStatus.target.database}) is bound through the kernel's Shared Field client. Publishing places this projection, its publisher and one Explore entry in that field — visible to the field's audience.</span><button className="shared-field-host-send" disabled={hostedBusy||!published.candidate} title={published.candidate?undefined:"The selection this envelope was composed from is no longer held; compose it again to host it"} onClick={()=>void publishHosted()}>{hostedBusy?"Publishing to the hosted field…":"Publish to the hosted field"}</button></div>}
   {envelope.state==="published"&&!hosted&&hostedStatus&&!("bound" in hostedStatus&&hostedStatus.bound)&&<p className="shared-field-host-absent" role="status" data-hosted-bound="false">No hosting target is bound for this desktop — {"bound" in hostedStatus?(hostedStatus.bound?"":hostedStatus.reason):hostedStatus.detail}</p>}
   {hosted&&<div className="shared-field-hosted" data-hosted-result={JSON.stringify(hosted)} data-hosted-projection-ref={hosted.hosted_projection_row.projectionRef} data-hosted-entry-ref={hosted.entries[0]??""}>
    <p role="status">Hosted in <code>{hosted.target.name}</code> ({hosted.target.uri}/{hosted.target.database}).</p>
    <dl className="shared-field-hosted-row">
     <dt>Hosted projection row</dt><dd><code>{hosted.hosted_projection_row.projectionKey}</code> · row {hosted.hosted_projection_row.rowId} · projection revision {hosted.hosted_projection_row.projectionRevision} · source revision <code>{hosted.hosted_projection_row.sourceRevision}</code> · {hosted.hosted_projection_row.state}</dd>
     <dt>Publisher participant</dt><dd><code>{hosted.hosted_projection_row.publisherParticipantRef}</code></dd>
     <dt>Explore entries</dt><dd>{hosted.entries.map(ref=><code key={ref}>{ref}</code>)}</dd>
     <dt>Transport identity</dt><dd><code>{hosted.transport_identity}</code> — the SpaceTimeDB connection identity of this desktop's client, not a human participant</dd>
    </dl>
   </div>}
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
