import {useMemo,useState,type ReactNode} from "react";
import {useKernel} from "../../kernel/KernelProvider";
import type {KernelReceipt} from "../../kernel/types";
import type {EncounterSessionHandle} from "../../encounter/session";
import {operationsOf} from "../../encounter/operations";
import {ActivityJournal} from "../../encounter/EncounterView";
import {Glyph,type GlyphName} from "../../workspace/Glyph";
import type {PanelInspectDetail} from "./panelInspect";

/** How many rows a list shows before "Show earlier". Activity is a reading of
 * current work, never a permanent log wall. */
const PAGE=8;

/** The Activity plane: what is happening now, then what happened, newest
 * first. Every row is an owner record — the connection state, the session's
 * task basis, delivery receipts, the transcript's working-material blocks, the
 * kernel's receipts — collapsed by default and expandable into its verbatim
 * detail. The raw owner journal stays behind its explicit "Load journal". */
export function ActivityPlane({session,onInspect,conversation}:{
 session:EncounterSessionHandle;
 onInspect:(detail:PanelInspectDetail)=>void;
 /** Where the conversation can be reached from here, when it can. */
 conversation?:{label:string;go:()=>void};
}) {
 const {state,actions}=session;
 const {reading,status}=state;
 const operations=useMemo(()=>operationsOf(reading?.blocks),[reading]);
 const running=status?.state==="TurnInFlight";const stopping=status?.state==="InterruptRequested";
 const connected=!!status&&status.state!=="Disconnected";
 const cancelAction=reading?.actions?.find(action=>action.ref==="aikit.encounter.cancel");
 const consents=reading?.permissions??[];
 const task=state.task;
 return <div className="agent-activity agent-plane oi-scroll" data-plane="Activity" aria-label="Activity">
  <section className="agent-group" aria-label="Current work">
   <header className="oi-panel-head"><h3 className="oi-panel-head-title">Now</h3></header>
   {!reading&&!state.error&&<p className="oi-note" role="status">Reading the session…</p>}
   {!reading&&state.error&&<p className="oi-refusal" role="alert">{state.error}</p>}
   {/* The wait is the owner's own connection state, never an invented
     * progress claim. Stop is offered only while the owner enables cancel. */}
   {running&&<div className="agent-now oi-row" data-busy="true" data-owner-state="TurnInFlight"><span className="agent-now-text" role="status">Provider turn in flight — waiting for the provider.</span><button className="oi-action" disabled={state.pending||cancelAction?.enabled!==true} title={cancelAction?.reason??undefined} onClick={actions.cancel}>Stop</button></div>}
   {stopping&&<div className="agent-now oi-row" data-busy="true" data-owner-state="InterruptRequested"><span className="agent-now-text" role="status">Stop requested — waiting for the provider to settle.</span></div>}
   {status?.error&&<p className="oi-refusal" role="alert">The owner reports a connection fault: {status.error}</p>}
   {consents.map(request=><div key={request.native_request_id} className="agent-now oi-row" data-attention="true" data-consent={request.native_request_id}><span className="agent-now-text">Provider consent requested — the provider is waiting for an answer.</span>{conversation&&<button className="oi-action" onClick={conversation.go}>Answer in the conversation</button>}</div>)}
   {state.draftFailed&&<p className="oi-refusal" role="alert">A draft save was refused. The unsaved typing is held in the conversation&apos;s composer, where it can be applied to the current shared draft.</p>}
   {reading&&!running&&!stopping&&!consents.length&&!status?.error&&<p className="agent-idle oi-note" data-state={connected?"idle":"disconnected"}>{connected?"No provider turn is running.":"Disconnected — no provider is attached to this session."}{conversation&&<> <button className="agent-inline oi-action" onClick={conversation.go}>{conversation.label}</button></>}</p>}
  </section>

  <section className="agent-group" aria-label="Task and deliveries">
   <header className="oi-panel-head"><h3 className="oi-panel-head-title">Task and deliveries</h3></header>
   {task?<OperationRow kind="task" label={task.ready?"Task · ready":"Task · preparing"} line={task.request?.central?.purpose??task.request?.central?.task_ref} meta={task.request?.central?.task_ref} attention={!task.ready}
      onInspect={()=>onInspect({kind:"task-basis",ref:task.request?.central?.task_ref??"task",title:task.request?.central?.purpose??"Task basis",payload:task,source:"Activity"})}>
     <dl className="oi-kv">
      <dt>Task</dt><dd className="oi-ref">{task.request?.central?.task_ref}</dd>
      <dt>State</dt><dd>{task.ready?"ready — allocated and the launcher prepared":"preparing — the owner has not finished this task"}</dd>
      <dt>Working directory</dt><dd className="oi-ref">{task.request?.cwd}</dd>
      <dt>Authority</dt><dd className="oi-ref">{task.request?.authority_ref}</dd>
      {task.allocation?.allocation&&<><dt>Allocated NOW</dt><dd className="oi-ref">{task.allocation.allocation.now_ref}</dd></>}
     </dl>
    </OperationRow>
    :<p className="oi-note" data-task={task===null?"absent":"unread"}>{task===null?"No task is bound to this session.":"The owner has served no task reading for this session."}</p>}
   {state.dispatch.kind==="running"&&<div className="agent-now oi-row" data-busy="true" data-phase={state.dispatch.phase}><span className="agent-now-text" role="status">Delivery <code className="oi-ref">{state.dispatch.ref}</code> — {state.dispatch.phase==="preparing"?"committing to the owner…":`phase: ${state.dispatch.phase}`}</span></div>}
   {state.dispatch.kind==="refused"&&<p className="oi-refusal" role="alert">The owner refused this turn: {state.dispatch.error}</p>}
   {state.deliveries.map(entry=><OperationRow key={entry.ref} kind="delivery" label={`Delivery · ${entry.record.phase}`} line={entry.ref} meta={entry.duplicate?"duplicate read":undefined} attention={entry.record.phase==="failed"||entry.record.phase==="uncertain"}
      onInspect={()=>onInspect({kind:"delivery",ref:entry.ref,title:`Delivery ${entry.record.phase}`,payload:{delivery_ref:entry.ref,receipt:entry.record,duplicate:entry.duplicate,dispatched_packet:entry.packet},source:"Activity"})}>
     <pre>{JSON.stringify(entry.record,null,1)}</pre>
    </OperationRow>)}
   {state.group&&<OperationRow kind="group" label="Group delivery" line={state.group.ref} meta={`${state.group.rows.length} recipient${state.group.rows.length===1?"":"s"}`} attention={state.group.rows.some(row=>!!row.error)}>
     <ul className="agent-group-rows">{state.group.rows.map(row=><li key={row.agentSession}><code className="oi-ref">{row.agentSession}</code> <span>{row.error??(row.duplicate?"already held by the owner":`phase: ${row.phase}`)}</span></li>)}</ul>
     <p className="oi-note">Individually durable dispatch; no automatic replay of uncertain recipients.</p>
    </OperationRow>}
   {state.dispatch.kind==="idle"&&!state.deliveries.length&&!state.group&&<p className="oi-note">No addressed delivery has been dispatched from this window.</p>}
  </section>

  <section className="agent-group" aria-label="Operations">
   <header className="oi-panel-head"><h3 className="oi-panel-head-title">Operations</h3>{reading&&<span className="oi-state">{operations.length} on this page</span>}</header>
   {state.before!==undefined&&<p className="oi-note" role="status">Showing an earlier transcript page. <button className="agent-inline oi-action" onClick={actions.latest}>Return to latest</button></p>}
   <Bounded items={operations} empty={reading?<p className="oi-note" data-state="no-operations">No provider activity in this transcript page.</p>:null}
    more={reading?.more?<button className="oi-action" onClick={actions.earlier}>Earlier transcript page</button>:null}
    row={operation=><OperationRow key={operation.id} kind={operation.kind} label={operation.label} line={operation.line} meta={`block ${operation.id}`} attention={operation.attention}
      onInspect={()=>onInspect({kind:"operation",ref:`${state.agentSession}#${operation.id}`,title:`${operation.label} · block ${operation.id}`,payload:operation.text,source:"Activity"})}>
     <pre>{operation.detail}</pre>
    </OperationRow>}/>
  </section>

  <KernelReceipts onInspect={onInspect}/>

  <section className="agent-group" aria-label="Owner journal">
   <ActivityJournal read={actions.readJournal}/>
  </section>
 </div>;
}

const KIND_GLYPH:Record<string,GlyphName>={thinking:"lens",tool:"terminal",permission:"verify","provider-notice":"report",error:"warning",cancelled:"stop",completed:"check",task:"list",delivery:"handoff",group:"handoff"};
/** One readable operation: a dense summary row, expandable into its execution
 * detail. Collapsed by default. */
function OperationRow({kind,label,line,meta,attention,children,onInspect}:{kind:string;label:string;line?:string;meta?:string;attention?:boolean;children:ReactNode;onInspect?:()=>void}) {
 return <details className="agent-op" data-kind={kind} data-attention={attention?"true":undefined}>
  <summary className="oi-row"><Glyph name={KIND_GLYPH[kind]??(kind.startsWith("receipt:")?"activity":"report")} size={12}/><span className="oi-row-title"><span className="agent-op-label">{label}</span>{line&&<span className="agent-op-line"> · {line}</span>}</span>{meta&&<span className="oi-row-meta">{meta}</span>}</summary>
  <div className="agent-op-detail">{children}{onInspect&&<div className="oi-action-group"><button className="oi-action" aria-label={`Inspect ${label}${meta?` (${meta})`:""}`} onClick={onInspect}><Glyph name="inspect" size={12}/>Inspect</button></div>}</div>
 </details>;
}

/** Newest-first, bounded: the first page, then "Show earlier" a page at a time. */
function Bounded<T,>({items,row,empty,more}:{items:T[];row:(item:T)=>ReactNode;empty:ReactNode;more?:ReactNode}) {
 const [shown,setShown]=useState(PAGE);
 if(!items.length)return <>{empty}{more}</>;
 return <>
  {items.slice(0,shown).map(row)}
  {(items.length>shown||more)&&<div className="agent-more oi-action-group">
   {items.length>shown&&<button className="oi-action" onClick={()=>setShown(count=>count+PAGE)}>Show earlier ({items.length-shown})</button>}
   {items.length<=shown&&more}
  </div>}
 </>;
}

const RECEIPT_LABEL:Record<string,string>={
 world_changed:"World changed",expression_changed:"Expression changed",focus_changed:"Focus moved",surface_changed:"Surface changed",
 source_opened:"Source opened",buffer_dirty:"Buffer crossed clean/dirty",source_changed:"Source saved",source_write_conflict:"Save refused — revision conflict",
};
/** The exact subject a receipt names, in the kernel's own fields. */
function receiptSubject(receipt:KernelReceipt):string|undefined {
 const ref=(value:unknown)=>typeof (value as {ref?:unknown})?.ref==="string"?(value as {ref:string}).ref:undefined;
 return ref(receipt.source)??ref(receipt.surface_ref)??ref((receipt.focus as {subject?:unknown}|undefined)?.subject)??(typeof receipt.expression_ref==="string"?receipt.expression_ref:undefined)??(typeof receipt.surface_id==="string"?receipt.surface_id:undefined);
}
/** Kernel receipts as readable operations: event, subject and the kernel's own
 * sequence number. Receipts carry no clock, so no time is shown. */
function KernelReceipts({onInspect}:{onInspect:(detail:PanelInspectDetail)=>void}) {
 const {receipts}=useKernel();
 const rows=useMemo(()=>[...receipts].reverse(),[receipts]);
 return <section className="agent-group" aria-label="Kernel receipts">
  <header className="oi-panel-head"><h3 className="oi-panel-head-title">Workspace receipts</h3><span className="oi-state">{rows.length} held</span></header>
  <Bounded items={rows} empty={<p className="oi-note">The kernel has recorded no receipts in this window yet.</p>}
   row={receipt=><OperationRow key={receipt.seq} kind={`receipt:${receipt.event}`} label={RECEIPT_LABEL[receipt.event]??receipt.event} line={receiptSubject(receipt)??(typeof receipt.summary==="string"?receipt.summary:undefined)} meta={`seq ${receipt.seq}`} attention={receipt.event==="source_write_conflict"}
     onInspect={()=>onInspect({kind:"kernel-receipt",ref:`seq:${receipt.seq}`,title:`${RECEIPT_LABEL[receipt.event]??receipt.event} · seq ${receipt.seq}`,payload:receipt,source:"Activity"})}>
    {typeof receipt.summary==="string"&&<p className="oi-note">{receipt.summary}</p>}
    <pre>{JSON.stringify(receipt,null,1)}</pre>
   </OperationRow>}/>
 </section>;
}
