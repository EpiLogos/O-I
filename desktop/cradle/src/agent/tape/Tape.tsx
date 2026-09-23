import {Fragment,useEffect,useLayoutEffect,useMemo,useRef,useState,type MouseEvent as ReactMouseEvent,type ReactNode} from "react";
import {Glyph} from "../../workspace/Glyph";
import {TAPE_FILTERS,VERB_LABEL,filterRows,formatClock,formatDuration,isToolRow,type Tape as TapeData,type TapeCall,type TapeFilter,type TapeRow} from "./model";
import "./tape.css";

/**
 * THE TAPE — one component for the right panel's Activity tab and Factory's
 * Run tape (10-SIDEBARS §4.4): time · verb · object · duration rows on a
 * slightly darker monospace body, grouped by turn, coalesced by object.
 *
 * ── API ──────────────────────────────────────────────────────────────────
 *   <Tape tape={…} live focus={{rowId,token}} filter onFilter onInspect
 *         loading error onRetry empty head/>
 *   - tape: model.ts `Tape` (use journal.ts `useTape` for a session).
 *   - live: a turn is in flight — the head reads "Following live".
 *   - focus: open the tape AT one row (the status line, a chat work mark):
 *     bumping `token` scrolls that row into view and expands it; following
 *     pauses so the view stays there.
 *   - onInspect(row, call?, event): open the object page (§4.7). The event
 *     carries ⌥ for Pop out; the caller routes it.
 *   - filter / onFilter: controlled filter (uncontrolled when omitted).
 *   - head: extra head content (Factory's run summary sits above the tape).
 *
 * Tail-follow is on by default. Scrolling up pauses it and shows one
 * "Resume live · n new" pill; an event arriving while paused never moves the
 * view. Expanding a row shows each call's exact input and output as text;
 * verbatim owner events sit only behind "Show raw".
 */
export interface TapeFocus {rowId:string;token:number}
export interface TapeProps {
 tape:TapeData;
 live?:boolean;
 focus?:TapeFocus;
 filter?:TapeFilter;
 onFilter?:(filter:TapeFilter)=>void;
 onInspect?:(row:TapeRow,call:TapeCall|undefined,event:ReactMouseEvent)=>void;
 loading?:boolean;
 error?:string;
 onRetry?:()=>void;
 empty?:ReactNode;
 head?:ReactNode;
 label?:string;
}

const FOLLOW_SLACK=24;

export function Tape({tape,live,focus,filter:controlled,onFilter,onInspect,loading,error,onRetry,empty,head,label="Activity"}:TapeProps) {
 const [ownFilter,setOwnFilter]=useState<TapeFilter>("all");
 const filter=controlled??ownFilter;
 const chooseFilter=(next:TapeFilter)=>{setOwnFilter(next);onFilter?.(next);};
 const [open,setOpen]=useState<ReadonlySet<string>>(()=>new Set());
 const toggle=(id:string)=>setOpen(held=>{const next=new Set(held);if(next.has(id))next.delete(id);else next.add(id);return next;});
 const body=useRef<HTMLDivElement>(null);
 const [following,setFollowing]=useState(true);
 const pausedAt=useRef(0);
 const programmatic=useRef(false);

 const visible=useMemo(()=>new Set(filterRows(tape.rows,filter).map(row=>row.id)),[tape.rows,filter]);
 const turns=useMemo(()=>tape.turns.map(turn=>({turn,rows:turn.rows.filter(row=>visible.has(row.id))})).filter(entry=>entry.rows.length>0),[tape.turns,visible]);
 const shown=visible.size;
 const newCount=following?0:Math.max(0,shown-pausedAt.current);

 const toBottom=()=>{const el=body.current;if(!el)return;programmatic.current=true;el.scrollTop=el.scrollHeight;requestAnimationFrame(()=>{programmatic.current=false;});};
 // Follow: new rows carry the view to the newest row — never while paused.
 useLayoutEffect(()=>{if(following)toBottom();},[shown,tape.lastCursor,following]);
 const onScroll=()=>{
  if(programmatic.current)return;
  const el=body.current;if(!el)return;
  const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<=FOLLOW_SLACK;
  if(!atBottom&&following){pausedAt.current=shown;setFollowing(false);}
  else if(atBottom&&!following)setFollowing(true);
 };
 const resume=()=>{setFollowing(true);toBottom();};
 // Open the tape at one row: expand it, scroll it into view, pause following.
 useEffect(()=>{
  if(!focus)return;
  if(!tape.rows.some(row=>row.id===focus.rowId))return;
  if(!visible.has(focus.rowId))chooseFilter("all");
  setOpen(held=>new Set(held).add(focus.rowId));
  pausedAt.current=shown;setFollowing(false);
  requestAnimationFrame(()=>{const el=body.current?.querySelector<HTMLElement>(`[data-tape-row="${CSS.escape(focus.rowId)}"]`);if(el){programmatic.current=true;el.scrollIntoView({block:"center"});requestAnimationFrame(()=>{programmatic.current=false;});}});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[focus?.token,focus?.rowId]);

 return <section className="tape" aria-label={label} data-following={following?"true":"false"}>
  {head}
  <div className="tape-head">
   <div className="tape-filters" role="radiogroup" aria-label="Show">
    {TAPE_FILTERS.map(entry=><button key={entry.id} type="button" role="radio" aria-checked={filter===entry.id} className="tape-filter" onClick={()=>chooseFilter(entry.id)}>{entry.label}</button>)}
   </div>
   <span className="tape-follow" role="status" data-live={live?"true":undefined}>{following?(live?<><span className="tape-live-dot" aria-hidden="true"/>Following live</>:"Up to date"):"Paused"}</span>
  </div>
  <div className="tape-body" ref={body} onScroll={onScroll} role="list" aria-label={`${label} events`} aria-busy={loading||undefined}>
   {error&&<p className="tape-error" role="alert">Couldn&apos;t read the activity. {onRetry&&<button type="button" className="oi-action" onClick={onRetry}>Retry</button>}</p>}
   {!error&&!turns.length&&(loading?<p className="tape-note" role="status">Reading…</p>:tape.rows.length&&filter!=="all"?<p className="tape-note">Nothing here for {TAPE_FILTERS.find(entry=>entry.id===filter)?.label}. <button type="button" className="oi-action" onClick={()=>chooseFilter("all")}>Show all</button></p>:(empty??<p className="tape-note">No activity yet.</p>))}
   {turns.map(({turn,rows})=><Fragment key={turn.index}>
    {turn.index>0&&<div className="tape-turn" role="separator" data-turn={turn.index} data-stop={turn.stop}><span>Turn {turn.index}</span>{turn.stop&&turn.stop!=="completed"&&<span className="tape-turn-stop">{turn.stop==="cancelled"?"stopped":turn.stop==="limit"?"stopped at the provider's limit":"failed"}</span>}</div>}
    {rows.map(row=><TapeRowView key={row.id} row={row} open={open.has(row.id)} onToggle={()=>toggle(row.id)} onInspect={onInspect}/>)}
   </Fragment>)}
  </div>
  {!following&&<button type="button" className="tape-resume" onClick={resume}>Resume live{newCount>0?` · ${newCount} new`:""}</button>}
 </section>;
}

const STATUS_MARK:Record<string,string>={done:"✓",failed:"×",cancelled:"–",waiting:"!",running:""};
function TapeRowView({row,open,onToggle,onInspect}:{row:TapeRow;open:boolean;onToggle:()=>void;onInspect?:TapeProps["onInspect"]}) {
 const tool=isToolRow(row);
 return <div className="tape-row" role="listitem" data-tape-row={row.id} data-verb={row.verb} data-status={row.status} data-open={open?"true":undefined}>
  <button type="button" className="tape-row-line" aria-expanded={open} onClick={onToggle} title={row.detail??row.text??row.object}>
   <span className="tape-time">{row.startedAt!==undefined?formatClock(row.startedAt):""}</span>
   <span className="tape-verb">{VERB_LABEL[row.verb]}</span>
   <span className="tape-object" data-mono={tool?"true":undefined}>{row.object||"…"}{row.count>1&&<span className="tape-count"> ×{row.count}</span>}</span>
   <span className="tape-duration">{row.status==="running"?<span className="tape-running" aria-label="running"/>:row.durationMs!==undefined?formatDuration(row.durationMs):""}</span>
   <span className="tape-status" aria-label={row.status}>{STATUS_MARK[row.status]}</span>
  </button>
  {open&&<div className="tape-detail">
   {row.text!==undefined&&!tool&&<p className="tape-text">{row.text||"(empty)"}</p>}
   {row.calls.map((call,index)=><CallDetail key={call.id??index} call={call} index={index} count={row.calls.length}/>)}
   {row.detail&&tool&&<p className="tape-target"><span>Target</span>{row.detail}</p>}
   <div className="tape-detail-actions">
    {onInspect&&<button type="button" className="oi-action" title="Open this event's page — ⌥-click pops it out" onClick={event=>onInspect(row,row.calls.length===1?row.calls[0]:undefined,event)}><Glyph name="inspect" size={12}/>Open</button>}
    <details className="tape-raw"><summary>Show raw</summary><pre>{JSON.stringify(row.events,null,1)}</pre></details>
   </div>
  </div>}
 </div>;
}

/** Plain text of a provider's tool output: ACP content blocks, Pi result
 *  content, or a string. Anything else is only in Show raw. */
export function outputText(output:unknown):string|undefined {
 if(typeof output==="string")return output;
 const blocks=Array.isArray(output)?output:output&&typeof output==="object"&&Array.isArray((output as {content?:unknown}).content)?(output as {content:unknown[]}).content:undefined;
 if(!blocks)return undefined;
 const parts=blocks.map(block=>{
  if(!block||typeof block!=="object")return undefined;
  const b=block as {text?:unknown;content?:{text?:unknown}};
  return typeof b.text==="string"?b.text:typeof b.content?.text==="string"?b.content.text:undefined;
 }).filter((part):part is string=>typeof part==="string");
 return parts.length?parts.join("\n"):undefined;
}
const looksStructured=(text:string)=>{const t=text.trim();if(!(t.startsWith("{")||t.startsWith("[")))return false;try{JSON.parse(t);return true;}catch{return false;}};

export function CallDetail({call,index,count}:{call:TapeCall;index:number;count:number}) {
 const input=call.input;
 const out=outputText(call.output);
 return <div className="tape-call" data-status={call.status}>
  {count>1&&<p className="tape-call-head">Call {index+1} of {count}{call.status==="failed"?" · failed":call.status==="running"?" · running":""}</p>}
  <dl className="tape-kv">
   {input&&typeof input==="object"&&!Array.isArray(input)?Object.entries(input as Record<string,unknown>).filter(([,value])=>value!==undefined).map(([key,value])=><Fragment key={key}><dt>{key}</dt><dd>{typeof value==="string"||typeof value==="number"||typeof value==="boolean"?String(value):"structured — in Show raw"}</dd></Fragment>)
    :input!==undefined?<><dt>input</dt><dd>{typeof input==="string"?input:"structured — in Show raw"}</dd></>:null}
   <dt>output</dt>
   <dd className="tape-output">{call.output===undefined?(call.status==="running"?"Waiting for the result…":"No output was reported."):out===undefined?"Structured output — in Show raw.":looksStructured(out)?`Structured output (${out.length.toLocaleString()} characters) — in Show raw.`:out.length>4000?`${out.slice(0,4000)}\n… ${(out.length-4000).toLocaleString()} more characters in Show raw.`:out}</dd>
  </dl>
 </div>;
}
