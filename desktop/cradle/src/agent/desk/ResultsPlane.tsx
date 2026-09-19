import {useMemo} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {Glyph} from "../../workspace/Glyph";
import {nowRefsOf,useEncounterSession} from "../../encounter/session";
import {NowRelations} from "../../receiving/NowRelations";
import {useDeskState,type DeskPlaneProps} from "./deskTypes";
import {WorkScope} from "./WorkScope";
import "./desk.css";

export interface ResultsDeskState {
 selectedKind?:"handoff"|"diff";
 selectedRef?:string;
 selectedLabel?:string;
 /** The delivery phase, or the buffer's base/working revisions, at the
   * moment the selection was held — compared each render to the live value
   * so a newer revision offers "Show newer" instead of silently replacing
   * what the reader is looking at. */
 heldSnapshot?:string;
}
const INIT:ResultsDeskState={};

const KINDS_WITH_NO_PRODUCER=["Preview","Tests","Report","Artifact"];

/** Actual returned material: addressed deliveries and their receipts (Handoff),
 * the subject's unsaved-vs-saved content (Diff, when the kernel's own buffer
 * carries both sides), and the NOW records this session names. Tabs appear
 * only where a real producer exists — Preview/Tests/Report/Artifact have
 * none on the bound cut and are named, not faked as disabled buttons. */
export function ResultsPlane({subject,accompanying,onMessage: _onMessage}:DeskPlaneProps) {
 const kernel=useKernel();
 const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
 const [held,setHeld]=useDeskState<ResultsDeskState>("results",accompanying?.ref,INIT);

 const buffer=subject.ref?kernel.snapshot.buffers[subject.ref]:undefined;
 const hasDiff=!!buffer?.dirty;
 const deliveries=useMemo(()=>session?session.state.deliveries:[],[session]);
 const nowRefs=useMemo(()=>session?nowRefsOf(session.state):[],[session]);

 const selectDelivery=(ref:string)=>{const entry=deliveries.find(item=>item.ref===ref);setHeld({selectedKind:"handoff",selectedRef:ref,selectedLabel:`Handoff · ${ref}`,heldSnapshot:entry?entry.record.phase:undefined});};
 const selectDiff=()=>setHeld({selectedKind:"diff",selectedRef:subject.ref,selectedLabel:"Diff",heldSnapshot:buffer?`${buffer.base_revision}:${buffer.content.length}`:undefined});
 const clear=()=>setHeld(INIT);

 if(!accompanying)return <div className="desk-plane" data-plane="Results"><p className="oi-empty" data-state="no-accompanying">No accompanying session. Choose a conversation in the panel head to read its work here.</p></div>;

 const selectedDelivery=held.selectedKind==="handoff"?deliveries.find(item=>item.ref===held.selectedRef):undefined;
 const deliveryNewer=selectedDelivery&&held.heldSnapshot!==undefined&&selectedDelivery.record.phase!==held.heldSnapshot;
 const diffNewer=held.selectedKind==="diff"&&buffer&&held.heldSnapshot!==undefined&&held.heldSnapshot!==`${buffer.base_revision}:${buffer.content.length}`;
 const dominant=held.selectedKind==="handoff"&&selectedDelivery?"handoff":held.selectedKind==="diff"&&buffer?"diff":undefined;

 return <div className="desk-plane" data-plane="Results">
  <WorkScope accompanying={accompanying}/>
  <div className="oi-scroll">
   <div className="oi-segment" role="tablist" aria-label="Result kinds">
    {hasDiff&&<button role="tab" aria-selected={held.selectedKind==="diff"} onClick={selectDiff}>Diff</button>}
    <button role="tab" aria-selected={held.selectedKind==="handoff"} disabled={!deliveries.length} onClick={()=>deliveries[0]&&selectDelivery(deliveries[0].ref)}>Handoff{deliveries.length?` (${deliveries.length})`:""}</button>
   </div>

   {!dominant&&<>
    <div className="desk-results-chooser">
     {hasDiff&&<button type="button" className="oi-row" onClick={selectDiff}><Glyph name="diff" size={12}/><span className="oi-row-title">Unsaved changes — {subject.title}</span></button>}
     {deliveries.map(entry=><button key={entry.ref} type="button" className="oi-row" onClick={()=>selectDelivery(entry.ref)}><Glyph name="handoff" size={12}/><span className="oi-row-title">Delivery · {entry.record.phase}</span><span className="oi-row-meta">{entry.ref}</span></button>)}
     {!hasDiff&&!deliveries.length&&<p className="oi-note" data-state="nothing-returned">No addressed delivery has been dispatched from this window, and the subject carries no unsaved changes.</p>}
    </div>
    <div className="desk-missing-kinds">No producer yet for: {KINDS_WITH_NO_PRODUCER.join(", ")}.</div>
   </>}

   {dominant==="handoff"&&selectedDelivery&&<div className="desk-results-material">
    <div className="oi-action-group"><button className="oi-action" onClick={clear}>Back to results</button></div>
    {deliveryNewer&&<div className="desk-newer-cue"><span>Newer revision available — phase is now {selectedDelivery.record.phase}.</span><button className="oi-action" onClick={()=>setHeld({heldSnapshot:selectedDelivery.record.phase})}>Show newer</button></div>}
    <header className="oi-panel-head"><h3 className="oi-panel-head-title">Handoff · {held.heldSnapshot??selectedDelivery.record.phase}</h3></header>
    <dl className="oi-kv">
     <dt>Delivery ref</dt><dd className="oi-ref">{selectedDelivery.ref}</dd>
     <dt>Sender</dt><dd>{selectedDelivery.record.sender}</dd>
     <dt>Duplicate read</dt><dd>{selectedDelivery.duplicate?"yes":"no"}</dd>
    </dl>
    <pre>{JSON.stringify(selectedDelivery.record,null,1)}</pre>
   </div>}

   {dominant==="diff"&&buffer&&<div className="desk-results-material">
    <div className="oi-action-group"><button className="oi-action" onClick={clear}>Back to results</button></div>
    {diffNewer&&<div className="desk-newer-cue"><span>The working copy changed since this was opened.</span><button className="oi-action" onClick={()=>setHeld({heldSnapshot:`${buffer.base_revision}:${buffer.content.length}`})}>Show newer</button></div>}
    <header className="oi-panel-head"><h3 className="oi-panel-head-title">Diff · {subject.title}</h3></header>
    {buffer.conflict&&<p className="oi-refusal" role="alert">The last save was refused: the source moved from revision {buffer.conflict.expected_revision.slice(0,10)} to {buffer.conflict.current_revision.slice(0,10)}. Both sides are kept.</p>}
    <div className="agent-inspect-two">
     <section><h4 className="oi-eyebrow">Saved · {buffer.base_revision.slice(0,10)}</h4><pre>{buffer.saved_content}</pre></section>
     <section><h4 className="oi-eyebrow">Working copy</h4><pre>{buffer.content}</pre></section>
    </div>
   </div>}

   <section className="oi-section" aria-label="NOW records">
    <header className="oi-panel-head"><h3 className="oi-panel-head-title">NOW records</h3></header>
    {!nowRefs.length&&<p className="oi-note" data-state="no-now-refs">This session names no NOW records.</p>}
    {nowRefs.map(ref=><NowRelations key={ref.ref} nowRef={ref.ref} project={ref.register??accompanying.project}/>)}
   </section>

   <section className="oi-section" aria-label="Subject">
    <header className="oi-panel-head"><h3 className="oi-panel-head-title">Subject</h3>
     <button className="oi-action" disabled={!subject.ref} onClick={()=>{if(subject.ref)window.dispatchEvent(new CustomEvent("oi:panel-open-subject",{detail:subject}));}}>Open in centre</button>
    </header>
    {subject.ref
     ? <dl className="oi-kv"><dt>Ref</dt><dd className="oi-ref">{subject.ref}</dd><dt>Kind</dt><dd>{subject.kind??"surface"}</dd><dt>Project</dt><dd>{subject.project??"Not attached to a project"}</dd></dl>
     : <p className="oi-note" data-state="no-subject">No surface is selected in the centre.</p>}
   </section>
  </div>
 </div>;
}
