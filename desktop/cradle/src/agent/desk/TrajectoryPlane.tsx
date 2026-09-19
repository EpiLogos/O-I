import {useEffect,useMemo,useRef,useState} from "react";
import {scrollWithin} from "../../shared/scrollWithin";
import {Glyph,type GlyphName} from "../../workspace/Glyph";
import {handToPanelInspect} from "../planes/panelInspect";
import {useEncounterSession} from "../../encounter/session";
import {operationLabel,type EncounterBlock} from "../../encounter/operations";
import {clipped,useDeskState,type DeskPlaneProps,type WorkScopeStop} from "./deskTypes";
import {WorkScope} from "./WorkScope";
import "./desk.css";

/** Trajectory's own held reading position — selection, which rows are open,
 * which open rows are showing their full (unclipped) detail, and whether the
 * view is following the newest row or paused on history. Kept per
 * accompanying session so a tab change, collapse, split or maximise never
 * loses the reader's place (deskTypes.useDeskState). */
export interface TrajectoryDeskState {
 selectedId?:number;
 expandedIds:number[];
 fullIds:number[];
 paused:boolean;
 /** The row count held at the moment of pausing, for the "N new" cue. */
 pausedAtCount?:number;
}
const INIT:TrajectoryDeskState={expandedIds:[],fullIds:[],paused:false};

const ROW_HEIGHT=27;
const KIND_GLYPH:Record<string,GlyphName>={
 user:"chat",assistant:"chat",thinking:"lens",tool:"terminal",permission:"verify",
 "provider-notice":"report",error:"warning",cancelled:"stop",completed:"check",
};
const KIND_LABEL:Record<string,string>={user:"User message",assistant:"Assistant reply"};
const rowLabel=(kind:string)=>KIND_LABEL[kind]??operationLabel(kind);
const firstLine=(text:string)=>{const line=text.split("\n").map(part=>part.trim()).find(Boolean)??"";return line.length>110?`${line.slice(0,109)}…`:line;};

interface TurnGroup { turnId:number; rows:EncounterBlock[]; endKind?:"completed"|"cancelled"|"error"; open:boolean }
/** A turn is from a user block to its completed/cancelled/error boundary —
 * the owner's own block kinds are the only signal; nothing is inferred
 * beyond them. */
function turnsOf(blocks:EncounterBlock[]|undefined):TurnGroup[] {
 if(!blocks)return [];
 const turns:TurnGroup[]=[];
 let current:TurnGroup|undefined;
 for(const block of blocks) {
  if(block.kind==="user"||!current) { current={turnId:block.id,rows:[],open:true}; turns.push(current); }
  current.rows.push(block);
  if(block.kind==="completed"||block.kind==="cancelled"||block.kind==="error") { current.endKind=block.kind as TurnGroup["endKind"]; current.open=false; }
 }
 return turns;
}

type FlatItem={kind:"header";turn:TurnGroup;index:number}|{kind:"row";block:EncounterBlock;turn:TurnGroup};

/** The full turn/step/tool ledger — Activity (agent/planes/ActivityPlane.tsx)
 * is its compact current-work summary; this goes deeper: every block, grouped
 * by turn, with exact expandable detail, lazy paging, a windowed/virtual row
 * list and a paused-follow reading mode. Timing: the owner's transcript
 * blocks (encounter/client.ts EncounterReading) and the kernel's receipts
 * carry no timestamp field at all — so no duration is ever shown here; that
 * is measured honesty, not an omission to fill in later. */
export function TrajectoryPlane({subject: _subject,accompanying,onMessage}:DeskPlaneProps) {
 const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
 const [held,setHeld]=useDeskState<TrajectoryDeskState>("trajectory",accompanying?.ref,INIT);
 const listRef=useRef<HTMLDivElement|null>(null);
 const autoScrolling=useRef(false);

 const turns=useMemo(()=>turnsOf(session?.state.reading?.blocks),[session?.state.reading]);
 const items=useMemo<FlatItem[]>(()=>{
  const flat:FlatItem[]=[];
  turns.forEach((turn,index)=>{flat.push({kind:"header",turn,index});for(const block of turn.rows)flat.push({kind:"row",block,turn});});
  return flat;
 },[turns]);

 // --- windowed rendering: only rows near the viewport are in the DOM ------
 const [range,setRange]=useState({start:0,end:Math.min(items.length,80)});
 useEffect(()=>{
  const el=listRef.current;if(!el)return;
  const update=()=>{
   const top=el.scrollTop,height=el.clientHeight;
   const start=Math.max(0,Math.floor(top/ROW_HEIGHT)-10);
   const end=Math.min(items.length,Math.ceil((top+height)/ROW_HEIGHT)+10);
   setRange(prev=>prev.start===start&&prev.end===end?prev:{start,end});
  };
  update();
  el.addEventListener("scroll",update,{passive:true});
  const observer=new ResizeObserver(update);observer.observe(el);
  return ()=>{el.removeEventListener("scroll",update);observer.disconnect();};
 },[items.length]);
 // Expanded rows stay in the DOM even off-window (grow the window to cover
 // them) rather than measuring their real height — the simpler of the two
 // permitted approaches.
 const {start,end}=useMemo(()=>{
  let {start,end}=range;
  items.forEach((item,index)=>{if(item.kind==="row"&&held.expandedIds.includes(item.block.id)){if(index<start)start=index;if(index>=end)end=index+1;}});
  return {start,end};
 },[range,items,held.expandedIds]);

 // --- live-follow: appended rows land after the held ones, so the reader's
 // scroll position over earlier rows never moves on its own; following only
 // needs to carry the viewport to the newest row when not paused. ----------
 useEffect(()=>{
  const el=listRef.current;if(!el||held.paused)return;
  autoScrolling.current=true;el.scrollTop=el.scrollHeight;
  const clear=setTimeout(()=>{autoScrolling.current=false;},0);
  return ()=>clearTimeout(clear);
 },[items.length,held.paused]);
 const pause=()=>{if(held.paused)return;setHeld({paused:true,pausedAtCount:items.filter(item=>item.kind==="row").length});};
 const onScroll=()=>{
  if(autoScrolling.current)return;
  const el=listRef.current;if(!el)return;
  const atBottom=el.scrollHeight-el.scrollTop-el.clientHeight<24;
  if(!atBottom)pause();
 };
 const resumeLive=()=>{setHeld({paused:false,pausedAtCount:undefined});const el=listRef.current;if(el){autoScrolling.current=true;el.scrollTop=el.scrollHeight;setTimeout(()=>{autoScrolling.current=false;},0);}};

 const rowItems=useMemo(()=>items.filter(item=>item.kind==="row") as {kind:"row";block:EncounterBlock;turn:TurnGroup}[],[items]);
 const select=(id:number,fromHistory=true)=>{setHeld({selectedId:id});if(fromHistory)pause();};
 const toggleExpand=(id:number)=>{setHeld(prev=>({...prev,expandedIds:prev.expandedIds.includes(id)?prev.expandedIds.filter(existing=>existing!==id):[...prev.expandedIds,id]}));pause();};
 const toggleFull=(id:number)=>setHeld(prev=>({...prev,fullIds:prev.fullIds.includes(id)?prev.fullIds.filter(existing=>existing!==id):[...prev.fullIds,id]}));

 const onKeyDown=(event:React.KeyboardEvent)=>{
  if(!rowItems.length)return;
  const currentIndex=rowItems.findIndex(row=>row.block.id===held.selectedId);
  if(event.key==="ArrowDown") { event.preventDefault(); const next=rowItems[Math.min(rowItems.length-1,currentIndex+1)]??rowItems[0]; select(next.block.id); }
  else if(event.key==="ArrowUp") { event.preventDefault(); const next=rowItems[Math.max(0,currentIndex-1)]??rowItems[0]; select(next.block.id); }
  else if(event.key==="Enter"||event.key===" ") { if(held.selectedId!==undefined) { event.preventDefault(); toggleExpand(held.selectedId); } }
  else if(event.key==="l"||event.key==="L") { resumeLive(); }
 };

 const onJump=(stop:WorkScopeStop)=>{
  if(stop.level!=="act"||!stop.ref)return;
  const id=Number(stop.ref.split("#")[1]);
  if(Number.isNaN(id))return;
  select(id);
  scrollWithin(listRef.current?.querySelector<HTMLElement>(`[data-block-id="${id}"]`),"center");
 };

 const earlier=async()=>{try{if(session)session.actions.earlier();}catch(error){onMessage?.(String(error));}};

 if(!accompanying)return <div className="desk-plane" data-plane="Trajectory"><p className="oi-empty" data-state="no-accompanying">No accompanying session. Choose a conversation in the panel head to read its work here.</p></div>;
 if(!session)return <div className="desk-plane" data-plane="Trajectory"><p className="oi-note" role="status">Reading the session…</p></div>;
 const {state}=session;
 const newCount=held.paused&&held.pausedAtCount!==undefined?rowItems.length-held.pausedAtCount:0;

 return <div className="desk-plane" data-plane="Trajectory">
  <WorkScope accompanying={accompanying} onJump={onJump}/>
  <div className="desk-trajectory-strip" data-paused={held.paused?"true":"false"}>
   {held.paused
    ? <span>Paused — reading history{newCount>0?` · ${newCount} new`:""}</span>
    : <span>Following the newest row.</span>}
   {state.before!==undefined&&<button className="oi-action" onClick={()=>session.actions.latest()}>Return to latest page</button>}
   {held.paused&&<button className="oi-action" onClick={resumeLive}>Resume live (L)</button>}
  </div>
  {!state.reading&&!state.error&&<p className="oi-note" role="status">Reading the session…</p>}
  {!state.reading&&state.error&&<p className="oi-refusal" role="alert">{state.error}</p>}
  {state.reading&&!rowItems.length&&<p className="desk-trajectory-empty oi-empty" data-state="no-rows">No blocks are in this transcript page yet.</p>}
  {state.reading&&!!rowItems.length&&<div className="desk-trajectory-list" ref={listRef} onScroll={onScroll} onKeyDown={onKeyDown} tabIndex={0} role="listbox" aria-label="Trajectory rows" aria-activedescendant={held.selectedId!==undefined?`traj-row-${held.selectedId}`:undefined}>
   <div className="desk-trajectory-spacer" style={{height:start*ROW_HEIGHT}}/>
   {items.slice(start,end).map(item=>item.kind==="header"
    ? <div key={`head-${item.turn.turnId}`} className="desk-turn-head"><Glyph name="chat" size={11}/><span>Turn {item.index+1}</span><span className="oi-state">{item.turn.open?"open":item.turn.endKind??"closed"}</span></div>
    : <Row key={item.block.id} block={item.block} selected={held.selectedId===item.block.id} expanded={held.expandedIds.includes(item.block.id)} full={held.fullIds.includes(item.block.id)}
       onSelect={()=>select(item.block.id)} onToggle={()=>toggleExpand(item.block.id)} onToggleFull={()=>toggleFull(item.block.id)}
       onInspect={()=>{handToPanelInspect({kind:"trajectory-block",ref:`${accompanying.ref}#${item.block.id}`,title:`${rowLabel(item.block.kind)} · block ${item.block.id}`,payload:item.block.text,source:"Trajectory"});}}/>)}
   <div className="desk-trajectory-spacer" style={{height:Math.max(0,items.length-end)*ROW_HEIGHT}}/>
  </div>}
  {state.reading?.more
   ? <div className="oi-action-group" style={{padding:"6px 8px"}}><button className="oi-action" onClick={earlier}>Load earlier</button></div>
   : <p className="oi-note" style={{margin:"6px 8px"}}>Earlier pages load from the conversation.</p>}
 </div>;
}

function Row({block,selected,expanded,full,onSelect,onToggle,onToggleFull,onInspect}:{
 block:EncounterBlock;selected:boolean;expanded:boolean;full:boolean;
 onSelect:()=>void;onToggle:()=>void;onToggleFull:()=>void;onInspect:()=>void;
}) {
 const attention=block.kind==="error"||block.kind==="cancelled";
 const clip=clipped(block.text);
 const text=full||!clip.truncated?block.text:clip.shown;
 // A plain <details> whose `open` is fully React-controlled: the summary's
 // own click/keyboard toggle is suppressed (tabIndex=-1, preventDefault) so
 // keyboard activation has exactly one path — the row list's own roving
 // ↑/↓/Enter/Space (TrajectoryPlane's onKeyDown) — never a native "toggle"
 // event firing a second time on top of it.
 return <details id={`traj-row-${block.id}`} data-block-id={block.id} className="desk-row" data-selected={selected} data-attention={attention?"true":undefined} open={expanded}>
  <summary className="oi-row" role="option" tabIndex={-1} aria-selected={selected}
   onClick={event=>{event.preventDefault();onSelect();onToggle();}}
   onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();event.stopPropagation();}}}>
   <Glyph name={KIND_GLYPH[block.kind]??"report"} size={12}/>
   <span className="oi-row-title"><span className="desk-row-label">{rowLabel(block.kind)}</span>{" · "}{firstLine(block.text)}</span>
   <span className="oi-row-meta">block {block.id}</span>
  </summary>
  <div className="desk-row-detail">
   <pre>{text}</pre>
   {clip.truncated&&<div className="oi-action-group"><button className="oi-action" onClick={onToggleFull}>{full?"Show clipped":`Show all (${clip.fullLength} chars)`}</button></div>}
   <div className="oi-action-group"><button className="oi-action" onClick={onInspect}><Glyph name="inspect" size={12}/>Inspect</button></div>
  </div>
 </details>;
}
