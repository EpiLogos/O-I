import type {ReactNode} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {Glyph} from "../../workspace/Glyph";
import {DeliveryRegistrations,NowRecords,OwnerActions,RawDisclosure,SessionFacts} from "../../encounter/InspectParts";
import {deliveriesOf,nowRefsOf,taskBasisWithoutNow,type EncounterSessionHandle} from "../../encounter/session";
import type {AgentSubject} from "../AgentLayer";
import {panelInspectKey,type PanelInspectDetail} from "./panelInspect";

export type InspectView="selected"|"subject"|"session"|"returned";
/** Which thing Inspect is showing. Held by the panel, not by this plane, so a
 * plane or mode change never loses the selection. */
export interface InspectSelection {view:InspectView;handedKey?:string}

const VIEWS:{id:InspectView;label:string}[]=[{id:"selected",label:"Selected"},{id:"subject",label:"Subject"},{id:"session",label:"Session"},{id:"returned",label:"Returned"}];

/** Inspect / returned work: real room for the selected thing. The selector
 * offers only what exists — the things handed here (an Activity row, a centre
 * surface's selection; see panelInspect.ts), the current source or file
 * subject, the bound session's identity, and the material that actually
 * returned to this surface. `full` lays the list beside the material; the side
 * presentation stacks them. */
export function InspectPlane({full,selection,onSelection,handed,onDismiss,subject,history,historyAvailable,session,onOpenSubject}:{
 full:boolean;
 selection:InspectSelection;onSelection:(selection:InspectSelection)=>void;
 handed:PanelInspectDetail[];onDismiss:(key:string)=>void;
 subject:AgentSubject;history?:ReactNode;historyAvailable:boolean;
 session?:EncounterSessionHandle;
 onOpenSubject?:(subject:AgentSubject)=>void;
}) {
 const chosen=handed.find(item=>panelInspectKey(item)===selection.handedKey)??handed[0];
 return <div className="agent-inspect agent-plane" data-plane="Inspect" data-layout={full?"columns":"stacked"} data-view={selection.view}>
  <div className="agent-inspect-list oi-scroll">
   <div className="agent-inspect-views oi-segment" role="group" aria-label="Inspect view">
    {VIEWS.map(view=><button key={view.id} aria-pressed={selection.view===view.id} onClick={()=>onSelection({...selection,view:view.id})}>{view.label}{view.id==="selected"&&handed.length?<span className="oi-state"> {handed.length}</span>:null}</button>)}
   </div>
   {selection.view==="selected"&&(handed.length
    ? <ul className="agent-inspect-rows" aria-label="Handed to Inspect">{handed.map(item=>{const key=panelInspectKey(item);return <li key={key}>
       <button className="agent-inspect-row oi-row" aria-selected={chosen===item} onClick={()=>onSelection({view:"selected",handedKey:key})}><span className="oi-row-title">{item.title}</span><span className="oi-row-meta">{item.kind}</span></button>
       <button className="oi-tool" aria-label={`Dismiss ${item.title}`} onClick={()=>onDismiss(key)}><Glyph name="close" size={10}/></button>
      </li>;})}</ul>
    : <p className="oi-empty" data-state="nothing-handed">Nothing has been handed to Inspect. Use Inspect on an Activity row, or select a session, run or span in a centre surface that hands its selection here.</p>)}
  </div>
  <div className="agent-inspect-material oi-scroll" aria-live="off">
   {selection.view==="selected"&&(chosen?<HandedMaterial item={chosen}/>:<p className="oi-note">Select something to read it here.</p>)}
   {selection.view==="subject"&&<SubjectMaterial subject={subject} history={history} historyAvailable={historyAvailable} onOpenSubject={onOpenSubject}/>}
   {selection.view==="session"&&(session
    ? <div className="agent-inspect-session" key={session.state.key}>
       <header className="oi-panel-head"><h3 className="oi-panel-head-title">Session identity</h3></header>
       {!session.state.reading&&!session.state.error&&<p className="oi-note" role="status">Reading the session…</p>}
       {!session.state.reading&&session.state.error&&<p className="oi-refusal" role="alert">{session.state.error}</p>}
       <SessionFacts reading={session.state.reading} status={session.state.status} space={session.state.space}/>
       <header className="oi-panel-head"><h3 className="oi-panel-head-title">Owner operations</h3></header>
       {session.state.reading?.actions?.length?<OwnerActions reading={session.state.reading}/>:<p className="oi-note">The owner has disclosed no operations for this session.</p>}
       <RawDisclosure reading={session.state.reading} status={session.state.status}/>
      </div>
    : <p className="oi-empty" data-state="no-session">No conversation is bound to the panel, so there is no session to inspect.</p>)}
   {selection.view==="returned"&&(session
    ? <div className="agent-inspect-returned" key={session.state.key}>
       <header className="oi-panel-head"><h3 className="oi-panel-head-title">Delivery receipts</h3></header>
       <DeliveryRegistrations deliveries={deliveriesOf(session.state)}/>
       <header className="oi-panel-head"><h3 className="oi-panel-head-title">NOW records</h3></header>
       <NowRecords nowRefs={nowRefsOf(session.state)} taskBasisWithoutNow={taskBasisWithoutNow(session.state)}/>
       <header className="oi-panel-head"><h3 className="oi-panel-head-title">Reports, handoffs, verification</h3></header>
       <p className="oi-note" data-fact="returns-listing-absent">No owner operation lists a session&apos;s reports, handoffs or verification results. What returned to this surface is exactly the delivery receipts and the NOW records above; document returns are reviewed beside their document.</p>
      </div>
    : <p className="oi-empty" data-state="no-session">No conversation is bound to the panel, so nothing has returned here.</p>)}
  </div>
 </div>;
}

function HandedMaterial({item}:{item:PanelInspectDetail}) {
 // Owner ruling 2 (DESKTOP-LANGUAGE.md, 2026-09-22): no raw JSON where a
 // person reads. Text handed as text stays readable prose; a structured
 // payload's raw record sits behind a collapsed disclosure — the same
 // <details>-grade pattern the session's Raw disclosure uses — so the
 // primary view stays the readable identity facts above it.
 const text=typeof item.payload==="string"?item.payload:undefined;
 const raw=item.payload!==undefined&&typeof item.payload!=="string"?JSON.stringify(item.payload,null,1):undefined;
 return <article className="agent-inspect-handed" data-inspect-kind={item.kind} data-inspect-ref={item.ref}>
  <header className="oi-panel-head"><h3 className="oi-panel-head-title">{item.title}</h3></header>
  <dl className="oi-kv">
   <dt>Kind</dt><dd>{item.kind}</dd>
   <dt>Ref</dt><dd className="oi-ref">{item.ref}</dd>
   {item.source&&<><dt>Handed by</dt><dd>{item.source}</dd></>}
  </dl>
  {text!==undefined?<pre className="agent-inspect-payload">{text}</pre>
   :raw!==undefined?<details className="oi-disclosure"><summary>Raw record</summary><pre className="agent-inspect-payload">{raw}</pre></details>
   :<p className="oi-note">This selection carried no material of its own.</p>}
 </article>;
}

/** The current source / file subject: identity, revision and dirty state, the
 * owner's history, and both sides of a change only where both are disclosed
 * (the kernel's canonical and working layers of an open source; FileHistory's
 * own before/after readings). No diff is computed here. */
function SubjectMaterial({subject,history,historyAvailable,onOpenSubject}:{subject:AgentSubject;history?:ReactNode;historyAvailable:boolean;onOpenSubject?:(subject:AgentSubject)=>void}) {
 const kernel=useKernel();
 if(!subject.ref)return <p className="oi-empty" data-state="no-subject">No surface is selected in the centre, so there is no subject to inspect.</p>;
 const buffer=kernel.snapshot.buffers[subject.ref];
 return <article className="agent-inspect-subject" key={subject.ref} data-subject-ref={subject.ref}>
  <header className="oi-panel-head"><h3 className="oi-panel-head-title">{subject.title}</h3>{onOpenSubject&&<button className="oi-action" onClick={()=>onOpenSubject(subject)}>Open in centre</button>}</header>
  <dl className="oi-kv">
   <dt>Kind</dt><dd>{subject.kind??"surface"}</dd>
   <dt>Ref</dt><dd className="oi-ref">{subject.ref}</dd>
   <dt>Project</dt><dd>{subject.project??"Not attached to a project"}</dd>
   <dt>Revision</dt><dd className="oi-ref">{subject.revision??"Not disclosed for this subject"}</dd>
   <dt>State</dt><dd>{subject.dirty?"Unsaved changes":"Saved"}</dd>
  </dl>
  {buffer?.conflict&&<p className="oi-refusal" role="alert">The last save was refused: the source moved from revision {buffer.conflict.expected_revision.slice(0,10)} to {buffer.conflict.current_revision.slice(0,10)}. Both sides are kept.</p>}
  {buffer?.dirty&&<details className="oi-disclosure agent-inspect-sides"><summary>Unsaved changes — both sides</summary>
   <div className="agent-inspect-two"><section><h4 className="oi-eyebrow">Saved · {buffer.base_revision.slice(0,10)}</h4><pre>{buffer.saved_content}</pre></section><section><h4 className="oi-eyebrow">Working copy</h4><pre>{buffer.content}</pre></section></div>
  </details>}
  <header className="oi-panel-head"><h3 className="oi-panel-head-title">History</h3></header>
  {historyAvailable?history:<p className="oi-note">No history operation is available for this subject.</p>}
 </article>;
}
