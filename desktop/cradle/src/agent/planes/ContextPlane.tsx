import {PreparedContextView} from "../../context/PreparedContextView";
import {WikiProjectionSection} from "../../context/WikiProjection";
import {useMemo,useState,type ReactNode} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import {Glyph} from "../../workspace/Glyph";
import {parseContextItems,removeContextItem,type ContextItem} from "../../context/contextItems";
import {ContextFacts,NowRecords} from "../../encounter/InspectParts";
import {nowRefsOf,taskBasisWithoutNow,type EncounterSessionHandle} from "../../encounter/session";
import type {AgentAccompanying,AgentSubject} from "../AgentLayer";

const KIND_GLYPH: Record<string, "chat" | "wiki" | "file" | "field" | "search"> = {
  encounter: "chat",
  knowledge: "wiki",
  file: "file",
  source: "file",
  sources: "file",
  explore: "search",
  presentation: "field",
};
const KIND_OWNER: Record<string, string> = {
  encounter: "AIKit",
  knowledge: "AIKit",
  explore: "Shared Field",
  presentation: "Shared Field",
  browser: "Browser",
};

/** D5/D9 — the Context plane follows the active canvas subject, never a
 * previous subject's rows (keyed by ref) and never a stand-in for it.
 *
 * Beneath the subject it keeps three things visibly apart:
 *   PREPARED  — native selected snapshots, plus existing draft attachments.
 *   CARRIED   — only what an owner record says was carried: context blocks in
 *               recorded user messages, the packets of addressed deliveries,
 *               the session's task basis and the NOW records it names.
 *   OPERATIVE — what the participant actually holds. No owner operation
 *               discloses that, and the plane says exactly so; it is never
 *               inferred from the transcript. */
export function ContextPlane({subject,history,historyAvailable,accompanying,session,onOpenSubject}:{
  subject:AgentSubject;history?:ReactNode;historyAvailable:boolean;accompanying?:AgentAccompanying;
  session?:EncounterSessionHandle;onOpenSubject?:(subject:AgentSubject)=>void;
}) {
  return <div className="agent-context agent-plane oi-sidecar oi-scroll" data-plane="Context">
    <PreparedContextView project={accompanying?.project??subject.project} session={accompanying?.ref} onOpenSubject={onOpenSubject}/>
    <WikiProjectionSection/>
    <details className="oi-disclosure"><summary>Current source</summary><SubjectContext key={subject.ref ?? "none"} subject={subject} history={history} historyAvailable={historyAvailable} onOpenSubject={onOpenSubject}/></details>
    {session
      ? <SessionContext key={session.state.key} session={session}/>
      : null}
    {accompanying && <details className="agent-section oi-disclosure">
      <summary>Session bounds &amp; return</summary>
      <dl className="oi-kv">
        <dt>Working ground</dt><dd>{accompanying.project}</dd>
      </dl>
      <p className="oi-note">Standing policy, not a receipt for this subject or this operation: source changes require human acceptance, and permission authority follows native provider consent.</p>
    </details>}
  </div>;
}

/** The subject's own rows, keyed by its ref by the caller: a previous subject's
 * rows and its opened History never survive a subject change. The owner's
 * history is read only once its disclosure is opened. */
function SubjectContext({subject,history,historyAvailable,onOpenSubject}:{subject:AgentSubject;history?:ReactNode;historyAvailable:boolean;onOpenSubject?:(subject:AgentSubject)=>void}) {
  const [historyOpen,setHistoryOpen]=useState(false);
  const glyph = KIND_GLYPH[subject.kind ?? ""] ?? "file";
  // Only an owner the kind actually maps to; an unknown kind is not silently
  // attributed to Central (F06).
  const owner = KIND_OWNER[subject.kind ?? ""];
  return <div className="agent-subject-context" data-subject-ref={subject.ref}>
    <p className="agent-eyebrow oi-eyebrow">Current subject · Follows selection</p>
    {subject.ref ? <>
      <div className="agent-subject">
        <span className="agent-subject-icon"><Glyph name={glyph} size={16}/></span>
        <div><strong>{subject.title}</strong><span>{subject.kind ?? "surface"}{subject.project ? ` · ${subject.project}` : ""}</span></div>
        {onOpenSubject&&<button className="oi-tool" aria-label="Open the subject in the centre" title="Open in the centre" onClick={()=>onOpenSubject(subject)}><Glyph name="arrow"/></button>}
      </div>
      <dl className="oi-kv">
        <dt>Project</dt><dd>{subject.project ?? "Not attached to a project"}</dd>
        <dt>Source ref</dt><dd className="oi-ref">{subject.ref}</dd>
        <dt>Revision</dt><dd>{subject.revision ? subject.revision.slice(0, 10) : "Unknown"}</dd>
        <dt>State</dt><dd>{subject.dirty === undefined ? "Unknown" : subject.dirty ? "Unsaved changes" : "Saved"}</dd>
        <dt>Owner</dt><dd>{owner ?? "Unknown"}</dd>
      </dl>
      {historyAvailable
        ? <details className="agent-section oi-disclosure" onToggle={event=>setHistoryOpen((event.currentTarget as HTMLDetailsElement).open)}><summary>History</summary>{historyOpen&&history}</details>
        : <p className="agent-note oi-note">No history operation is available for this subject.</p>}
    </> : <p className="agent-note oi-note">Select a surface to inspect its context.</p>}
  </div>;
}

function SessionContext({session}:{session:EncounterSessionHandle}) {
  const kernel=useKernel();
  const {state,actions}=session;
  const selected=useMemo(()=>parseContextItems(state.draft),[state.draft]);
  const sent=useMemo(()=>(state.reading?.blocks??[]).filter(block=>block.kind==="user").flatMap(block=>parseContextItems(block.text).map(item=>({item,blockId:block.id}))),[state.reading]);
  const carriedPackets=state.deliveries.filter(entry=>entry.packet?.source_refs.length);
  const task=state.task;
  const editable=actions.allowed("draft");
  /** A selection is stale when its source is open here at another revision
   * than the one recorded at selection time. Only an open buffer can say so. */
  const stale=(item:ContextItem)=>{const buffer=item.origin?kernel.snapshot.buffers[item.origin]:undefined;return !!buffer&&!!item.revision&&buffer.base_revision!==item.revision;};
  return <>
    {selected.length>0&&<details className="agent-section oi-disclosure" data-context="selected">
      <summary>Draft attachments · {selected.length} not sent</summary>
      {selected.length
        ? <ul className="agent-context-items">{selected.map((item,index)=><ContextRow key={index} item={item} state={stale(item)?"stale":"selected"} note={stale(item)?"The source has changed since this selection.":undefined} onRemove={editable?()=>actions.change(removeContextItem(state.draft,item)):undefined}/>)}</ul>
        : <p className="oi-note" data-state="nothing-selected">No legacy text attachments. Prepared source selections appear above and are validated when you explicitly send.</p>}
    </details>}
    <details className="agent-section oi-disclosure" data-context="used">
      <summary>Sent &amp; carried context</summary>
      {(state.reading?.prepared_context_receipts??[]).map(receipt=><details key={receipt.cursor}><summary>{receipt.items.length} selections · submission {receipt.cursor}</summary><p className="oi-note">Recorded submission, not proof of current provider memory.</p>{receipt.items.map(item=><p className="oi-ref" key={item.id}>{item.title} · {item.source_ref} · {item.source_revision}</p>)}</details>)}
      {sent.length>0&&<><p className="oi-eyebrow">Sent in recorded messages on this page</p>
        <ul className="agent-context-items">{sent.map(({item,blockId},index)=><ContextRow key={`${blockId}-${index}`} item={item} state="used" note={`message block ${blockId}`}/>)}</ul></>}
      {carriedPackets.length>0&&<><p className="oi-eyebrow">Addressed deliveries from this window</p>
        <ul className="agent-context-items">{carriedPackets.map(entry=><li key={entry.ref} className="agent-context-item"><span className="oi-chip" data-state="used">{entry.record.phase}</span><span className="oi-ref">{entry.packet!.source_refs.join(", ")}</span><small className="oi-note">{entry.ref}</small></li>)}</ul></>}
      {task&&<><p className="oi-eyebrow">Task basis</p>
        <dl className="oi-kv" data-task-ref={task.request?.central?.task_ref}>
          <dt>Task</dt><dd className="oi-ref">{task.request?.central?.task_ref}</dd>
          <dt>Purpose</dt><dd>{task.request?.central?.purpose}</dd>
          <dt>Source refs</dt><dd className="oi-ref">{task.request?.central?.source_refs?.join(", ")||"none recorded"}</dd>
          <dt>Participants</dt><dd className="oi-ref">{task.request?.central?.participant_refs?.join(", ")||"none recorded"}</dd>
        </dl></>}
      {!sent.length&&!carriedPackets.length&&!task&&!state.reading?.prepared_context_receipts?.length&&<p className="oi-note" data-state="nothing-carried">No recorded context delivery on this page.</p>}
      <p className="oi-eyebrow">NOW records this session names</p>
      <NowRecords nowRefs={nowRefsOf(state)} taskBasisWithoutNow={taskBasisWithoutNow(state)}/>
    </details>
    <details className="agent-section oi-disclosure" data-context="pinned">
      <summary>Pinned</summary>
      {/* Capability-derived from the bound conversation's disclosed actions, not
          a universal product law about pinning. */}
      {actions.allowed("pin")
        ? <p className="oi-note" data-fact="pinned-context-available">This conversation discloses a pin capability.</p>
        : <p className="oi-note" data-fact="pinned-context-absent">This conversation does not offer pinning context to the session.</p>}
    </details>
    <details className="agent-section oi-disclosure" data-context="operative">
      <summary>Effective context</summary>
      <ContextFacts status={state.status}/>
    </details>
  </>;
}

function ContextRow({item,state,note,onRemove}:{item:ContextItem;state:"selected"|"used"|"stale";note?:string;onRemove?:()=>void}) {
  return <li className="agent-context-item">
    <details>
      <summary><span className="oi-chip" data-state={state}>{state==="used"?"sent":state}</span><span className="agent-context-title">{item.title}</span>{item.revision&&<small className="oi-state">rev {item.revision.slice(0,8)}</small>}</summary>
      {item.origin&&<p className="oi-ref">{item.origin}</p>}
      {note&&<p className="oi-note">{note}</p>}
      <pre>{item.quote}</pre>
      {onRemove&&<div className="oi-action-group"><button className="oi-action" onClick={onRemove}>Remove from the draft</button></div>}
    </details>
  </li>;
}
