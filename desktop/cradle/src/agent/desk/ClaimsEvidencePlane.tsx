import {useEffect,useMemo,useState} from "react";
import {Glyph} from "../../workspace/Glyph";
import {useEncounterSession} from "../../encounter/session";
import {claimsSource,useDeskState,type ClaimRecord,type ClaimsReading,type DeskPlaneProps} from "./deskTypes";
import "./desk.css";

export interface ClaimsDeskState { selectedClaimRef?:string }
const INIT:ClaimsDeskState={};

// Dev-only, explicit opt-in fixture (see fixtures.dev.ts): never loaded in a
// production build, never registered ahead of a real source.
if(import.meta.env.DEV&&new URLSearchParams(location.search).has("fixtures")) {
 void import("./fixtures.dev").then(module=>module.installDeskFixtures());
}

/** What is asserted, about which state, by whom, on what basis; what
 * supports/challenges it; what remains open; what next operation is
 * warranted. No native Claim/Evidence/Assessment operation exists today
 * (grepped kernel/types.ts — no "claim"/"evidence" op or result); this reads
 * whatever adapter registered itself through deskTypes.claimsSource(). With
 * none registered, the plane names the real producers this waits on and
 * shows only what IS real today: the session's own "completed" turn reports,
 * explicitly under an unverified heading — never styled as evidence. */
export function ClaimsEvidencePlane({subject,accompanying,onMessage: _onMessage}:DeskPlaneProps) {
 const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
 const [held,setHeld]=useDeskState<ClaimsDeskState>("claims",accompanying?.ref,INIT);
 const source=claimsSource();
 const [reading,setReading]=useState<ClaimsReading>();
 const [refusal,setRefusal]=useState<string>();
 const [pending,setPending]=useState(false);

 useEffect(()=>{
  setReading(undefined);setRefusal(undefined);
  if(!source||!accompanying)return;
  let live=true;setPending(true);
  source.read(accompanying).then(value=>{if(live)setReading(value);}).catch(error=>{if(live)setRefusal(String(error));}).finally(()=>{if(live)setPending(false);});
  return ()=>{live=false;};
 },[source,accompanying?.ref]);

 // Repeated reports from one origin are one origin: group by sender.
 const grouped=useMemo(()=>{
  const groups=new Map<string,ClaimRecord[]>();
  for(const claim of reading?.claims??[]) {
   const key=claim.sender??"unattributed origin";
   const list=groups.get(key)??[];
   list.push(claim);groups.set(key,list);
  }
  return groups;
 },[reading]);

 const selected=reading?.claims.find(claim=>claim.ref===held.selectedClaimRef)??reading?.claims[0];
 const supports=reading?.evidence.filter(item=>item.claimRef===selected?.ref&&item.relation==="supports")??[];
 const challenges=reading?.evidence.filter(item=>item.claimRef===selected?.ref&&item.relation==="challenges")??[];
 const assessment=reading?.assessments.find(item=>item.claimRef===selected?.ref);

 if(!accompanying)return <div className="desk-plane" data-plane="Claims & evidence"><p className="oi-empty" data-state="no-accompanying">No accompanying session. Choose a conversation in the panel head to read its work here.</p></div>;

 const completed=(session?.state.reading?.blocks??[]).filter(block=>block.kind==="completed");

 return <div className="desk-plane" data-plane="Claims & evidence">
  <div className="oi-scroll">
   {!source&&<div className="oi-empty" data-state="no-claims-source">
    <strong>No claims reading is available yet.</strong>
    <p>No owner operation discloses Claim, Evidence or Assessment records for {subject.title || "this subject"}. The named producers: Factory #222 (claim reception) and O:I #220 (native joins). This plane will read them the moment one registers a <code>ClaimsSource</code> (deskTypes.ts).</p>
   </div>}
   {source&&pending&&<p className="oi-note" role="status">Reading claims from {source.label}…</p>}
   {source&&refusal&&<p className="oi-refusal" role="alert">{refusal}</p>}
   {source&&reading&&<div className="desk-claim-list">
    {source.kind==="fixture"&&<span className="desk-fixture-label"><Glyph name="warning" size={10}/>Fixture — not native data</span>}
    {!reading.claims.length&&<p className="oi-note" data-state="no-claims">No claims are recorded for this session.</p>}
    {[...grouped.entries()].map(([sender,claims])=><div key={sender}>
     <p className="oi-eyebrow">{sender}{claims.length>1?` · ${claims.length} reports, one origin`:""}</p>
     {claims.map(claim=><button key={claim.ref} type="button" className="oi-row" aria-selected={selected?.ref===claim.ref} onClick={()=>setHeld({selectedClaimRef:claim.ref})}>
      <Glyph name="report" size={12}/><span className="oi-row-title">{claim.assertion}</span><span className="oi-row-meta">{claim.subjectRef??""}</span>
     </button>)}
    </div>)}

    {selected&&<article className="desk-claim-detail">
     <header className="oi-panel-head"><h3 className="oi-panel-head-title">Selected claim</h3></header>
     <div className="desk-claim-block"><h4>Sender's assertion</h4><p>{selected.assertion}</p>
      <dl className="oi-kv">
       <dt>Sender</dt><dd>{selected.sender??"Not disclosed"}</dd>
       <dt>Subject</dt><dd className="oi-ref">{selected.subjectRef??"Not disclosed"}</dd>
       <dt>Subject revision</dt><dd className="oi-ref">{selected.subjectRevision??"Not disclosed"}</dd>
       <dt>Supplied basis</dt><dd>{selected.basis?.length?selected.basis.join(", "):"None supplied"}</dd>
      </dl>
     </div>
     <div className="desk-claim-block"><h4>Support / challenge</h4>
      {!supports.length&&!challenges.length&&<p className="oi-note">Nothing supports or challenges this claim yet.</p>}
      {supports.map(item=><p key={item.ref} className="oi-note" data-relation="supports">Supports — {item.summary}</p>)}
      {challenges.map(item=><p key={item.ref} className="oi-note" data-relation="challenges">Challenges — {item.summary}</p>)}
     </div>
     <div className="desk-claim-block"><h4>Receiver's assessment</h4>
      {assessment
       ? <><p>{assessment.assessment}</p>{assessment.obligationsOpen?.length?<p className="oi-note">Remaining obligations: {assessment.obligationsOpen.join(", ")}</p>:<p className="oi-note">No obligations remain open.</p>}</>
       : <p className="oi-note" data-state="no-assessment">No receiving assessment is recorded for this claim yet.</p>}
     </div>
    </article>}
   </div>}

   <div className="desk-reported-only">
    <header className="oi-panel-head"><h3 className="oi-panel-head-title">Reported by the agent — not independently verified</h3></header>
    {!completed.length&&<p className="oi-note">No completed-turn report is on this transcript page.</p>}
    {completed.map(block=><p key={block.id} className="oi-note" data-source="agent-reported">Block {block.id}: {block.text.slice(0,240)}{block.text.length>240?"…":""}</p>)}
   </div>
  </div>
 </div>;
}
