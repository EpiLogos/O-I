import {useEffect,useState} from "react";
import {createProjection,withdrawProjection} from "../../../../shared-field/index.mjs";
import {createA2aBinding,createA2aPresence,performA2aExchange} from "../../../../shared-field/a2a.mjs";
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
/** A selection handed to the A2A exchange form. Same presentation-slot law:
 * held until the strip next renders for the source, never persisted. */
let pendingA2a:SharedFieldCandidate|undefined;
export function openA2aExchange(candidate:SharedFieldCandidate) {
  pendingA2a=candidate;
  window.dispatchEvent(new CustomEvent("oi:a2a-exchange-candidate",{detail:candidate}));
}
/** A published projection this surface composed, held as presentation state so
 * the human can see and withdraw exactly what they published. */
interface PublishedProjection {envelope:Record<string,unknown>&{projection_ref:string;projection_revision:number;state:string};sourceRef:string}
export function SharedFieldMaterial({sourceRef}:{sourceRef:string}) {
 const [candidate,setCandidate]=useState<SharedFieldCandidate>();
 const [a2aCandidate,setA2aCandidate]=useState<SharedFieldCandidate>();
 const [peerAgent,setPeerAgent]=useState("");
 const [peerEndpoint,setPeerEndpoint]=useState("");
 const [peerCard,setPeerCard]=useState("");
 const [peerAvailability,setPeerAvailability]=useState("online");
 const [a2aText,setA2aText]=useState("");
 const [a2aBusy,setA2aBusy]=useState(false);
 const [a2aDifference,setA2aDifference]=useState<Record<string,unknown>&{exchange_ref:string;transport_result:{kind:string;ref:string};transport_provenance?:{agent_card?:{name?:string;version?:string}}}|undefined>();
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
 const takeA2a=(event:Event)=>{
  const detail=(event as CustomEvent<SharedFieldCandidate>).detail;
  if(detail?.sourceRef===sourceRef){pendingA2a=undefined;setA2aCandidate(detail);if(!a2aText)setA2aText(detail.text);setError(undefined);}
 };
 useEffect(()=>{window.addEventListener("oi:a2a-exchange-candidate",takeA2a);return()=>window.removeEventListener("oi:a2a-exchange-candidate",takeA2a);},[sourceRef,a2aText]);
 // A composition made while another tab held the view — or a projection this
 // surface published before an inactive-tab unmount — is consumed the moment
 // this strip renders again for the same source.
 useEffect(()=>{
  if(pendingSharedField?.sourceRef===sourceRef){
   const pending=pendingSharedField;pendingSharedField=undefined;
   if(pending.envelope)setPublished({envelope:pending.envelope,sourceRef});
   else if(pending.candidate)setCandidate(pending.candidate);
  }
  if(pendingA2a?.sourceRef===sourceRef){
   const pending=pendingA2a;pendingA2a=undefined;
   setA2aCandidate(pending);if(!a2aText)setA2aText(pending.text);
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
 // --- A2A exchange (Wave 7): an explicit bounded message to a peer agent over
 // the A2A v1 wire. Binding, presence, exchange authority and returned
 // difference are all the owner floor's own contracts, composed per send —
 // no registry, no store. The human's send IS the exchange-authority
 // decision: nothing touches the network until it happens. Credentials ride
 // request headers only, never into any contract or returned material.
 const sendA2a=async()=>{
  setA2aBusy(true);setError(undefined);
  try{
   const slug=peerAgent.trim().replace(/[^a-z0-9]+/gi,"-").toLowerCase();
   const binding=createA2aBinding({
    binding_ref:`a2a-binding:desktop:${slug||"peer"}`,
    field_ref:`field:document:${sourceRef}`,
    participant_ref:`participant:a2a:${slug||"peer"}`,
    agent_ref:peerAgent.trim(),
    publisher_participant_ref:"participant:desktop-operator",
    publication_decision_ref:`decision:desktop-send:${Date.now().toString(36)}`,
    source_revision:"desktop-operator",
    published_at:new Date().toISOString(),
    endpoint_url:peerEndpoint.trim(),
    agent_card_url:peerCard.trim(),
    provenance:[{kind:"desktop-operator-decision",ref:"decision:desktop-send",source_system:"oi.cradle"}],
   });
   const presence=createA2aPresence({
    binding_ref:binding.binding_ref,
    field_ref:binding.field_ref,
    participant_ref:binding.participant_ref,
    sequence:1,
    observed_at:new Date().toISOString(),
    availability:peerAvailability==="offline"?"offline":peerAvailability==="degraded"?"degraded":"online",
    provenance:[{kind:"desktop-operator-observation",ref:"observation:desktop-peer",source_system:"oi.cradle"}],
   });
   const messageId=`a2a-desktop-${Date.now().toString(36)}`;
   const difference=await performA2aExchange({
    binding,presence,
    initiator_participant_ref:"participant:desktop-operator",
    message:{message_id:messageId,text:a2aText,purpose:"desktop-a2a-exchange"},
    authorize_exchange:async(demand:{operation_id:string})=>({allowed:true,grant_ref:`exchange-grant:desktop:${demand.operation_id}`}),
    fetch_impl:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,init),
   }) as unknown as Record<string,unknown>&{exchange_ref:string;transport_result:{kind:string;ref:string};transport_provenance?:{agent_card?:{name?:string;version?:string}}};
   setA2aDifference(difference);setError(undefined);
  }catch(err){setError(String(err));}
  finally{setA2aBusy(false);}
 };
 if(!candidate&&!published&&!a2aCandidate&&!a2aDifference)return null;
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
  {(a2aCandidate||a2aDifference)&&<div className="shared-field-a2a">
   <header className="shared-field-a2a-header"><strong>A2A exchange with a peer agent</strong><small>Protocol A2A v1, HTTP+JSON. Nothing reaches the network until you send; the peer's Agent Card must advertise exactly the published interface.</small></header>
   <div className="shared-field-fields">
    <label>Peer agent ref<input aria-label="Peer agent ref" value={peerAgent} onChange={event=>setPeerAgent(event.target.value)} placeholder="agent ref of the peer" autoComplete="off" spellCheck={false}/></label>
    <label>Peer A2A endpoint URL<input aria-label="Peer A2A endpoint URL" value={peerEndpoint} onChange={event=>setPeerEndpoint(event.target.value)} placeholder="https://peer.example/a2a" autoComplete="off" spellCheck={false}/></label>
    <label>Peer Agent Card URL<input aria-label="Peer Agent Card URL" value={peerCard} onChange={event=>setPeerCard(event.target.value)} placeholder="https://peer.example/.well-known/agent-card.json" autoComplete="off" spellCheck={false}/></label>
    <label>Peer availability (your explicit observation)<select aria-label="Peer availability" value={peerAvailability} onChange={event=>setPeerAvailability(event.target.value)}>{["online","degraded","offline"].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
   </div>
   <textarea aria-label="A2A message text" disabled={a2aBusy} value={a2aText} onChange={event=>setA2aText(event.target.value)} rows={3} placeholder="The bounded message to the peer…"/>
   <div className="shared-field-actions"><span>The returned difference is untrusted material: it arrives pending admission and gains nothing by arrival.</span><button className="shared-field-a2a-send" disabled={a2aBusy||!peerAgent.trim()||!peerEndpoint.trim()||!peerCard.trim()||!a2aText.trim()} onClick={()=>void sendA2a()}>{a2aBusy?"Exchanging…":"Send over A2A"}</button></div>
   {a2aDifference&&<div className="shared-field-a2a-difference" data-a2a-difference={JSON.stringify(a2aDifference)} data-a2a-exchange-ref={a2aDifference.exchange_ref}>
    <p role="status">Exchange <code>{a2aDifference.exchange_ref}</code> returned a {a2aDifference.transport_result.kind} <code>{a2aDifference.transport_result.ref}</code>{a2aDifference.transport_provenance?.agent_card?.name?<> from {a2aDifference.transport_provenance.agent_card.name}</>:null}. The difference is pending admission — quarantine and the receiving-side decision happen under the field's own law, and only an admitted contribution can be returned to this document.</p>
   </div>}
  </div>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
