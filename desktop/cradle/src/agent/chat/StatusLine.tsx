import {useEffect,useState} from "react";
import {formatDuration,presentVerb,type TapeRow} from "../tape/model";

/**
 * The status line (10-SIDEBARS §4.1, P4): one line above the composer, ONLY
 * while a turn is actually in flight — "● Epii · editing shell.css · 1m 12s"
 * — from the real encounter state and the newest moving row of the tape.
 * The time counts from the turn's start as observed. Clicking opens Activity
 * at that event.
 */
export function StatusLine({agentName,row,startedAt,stopping,onOpen}:{agentName:string;row?:TapeRow;startedAt?:number;stopping?:boolean;onOpen:(rowId?:string)=>void}) {
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const doing=stopping?"stopping":row?(row.verb==="reply"?"replying":row.verb==="you"||row.verb==="message"?"reading your message":`${presentVerb(row.verb)} ${row.object}`):"working";
 const elapsed=startedAt!==undefined?formatDuration(Math.max(0,now-startedAt)):undefined;
 return <button type="button" className="chat-status-line" data-status-row={row?.id} onClick={()=>onOpen(row?.id)} title="Open Activity at this event">
  <span className="chat-status-dot" aria-hidden="true"/>
  <strong>{agentName}</strong>
  <span className="chat-status-doing">· {doing}</span>
  {elapsed&&<span className="chat-status-time">· {elapsed}</span>}
 </button>;
}
