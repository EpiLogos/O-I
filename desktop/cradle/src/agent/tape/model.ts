/**
 * THE TAPE MODEL — the owner's encounter journal as a turn-aware event tape
 * (10-SIDEBARS §4.4, the DeepSeek Harness run-log reference). Pure: journal
 * events in, rows out. No React, no kernel, no clock of its own.
 *
 * Shared by the right panel's Activity tab (agent/tape/Tape.tsx), the chat's
 * work marks and status line, and Factory's Run tape and full Trajectory page
 * (lane 3). Keep this API small; extend it only backward-compatibly.
 *
 * ── API ──────────────────────────────────────────────────────────────────
 *   tapeFromJournal(events, options?) → Tape
 *       events: the owner's journal pages concatenated in cursor order
 *       (`aikit encounter read` → {cursor, event}[]; see ./journal.ts for the
 *       shared incremental reader). options.seenAt(cursor) supplies the time
 *       this window first observed a cursor, used only when the event carries
 *       no owner timestamp (`observed_at_ms`).
 *   filterRows(rows, filter) → rows          TAPE_FILTERS: All · Edits · Commands · Tools · Waits
 *   rowsOfTurn(tape, turn) → rows            workMarksOf(tape, turn) → WorkMark[]
 *   inFlightRow(tape) → the newest running/waiting row of the open turn (status line)
 *   formatClock(ms) · formatDuration(ms)     VERB_LABEL
 *
 * Rows: time · verb · object · duration. Verbs are read / edit / run / tool
 * (tool calls, classified from the provider's own kind or tool name), think,
 * wait (a pending permission), note (connection / model / mode changes), and
 * the conversation's own rows: you (the person's message), message (an
 * addressed turn from another agent) and reply.
 * A tool call and its result are one row, joined by the provider's
 * `toolCallId`. Repeated calls on the same object in a row coalesce into one
 * row with a count; every call stays addressable (`row.calls`) with its exact
 * input and output. Raw events ride along (`row.events`) for "Show raw" only.
 *
 * Honesty: the journal carries no clock unless the owner stamps one. A row
 * without a known time shows none; a duration exists only when both ends
 * were observed. Status comes from the provider's own fields (status,
 * isError, stop) — nothing is inferred from text.
 */

export interface JournalEventLike {cursor:number;event:unknown}

export type TapeVerb = "you"|"message"|"reply"|"think"|"read"|"edit"|"run"|"tool"|"wait"|"note";
export type TapeStatus = "running"|"done"|"failed"|"waiting"|"cancelled";
export type TapeFilter = "all"|"edits"|"commands"|"tools"|"waits";
export type TurnStop = "completed"|"cancelled"|"failed"|"limit";

export interface TapeCall {
 /** The provider's own call identity (`toolCallId`), when it gave one. */
 id?:string;
 /** The provider's tool name or ACP kind/title. */
 name?:string;
 /** Exact input as the provider reported it (args / rawInput / title). */
 input?:unknown;
 /** Exact output as the provider reported it (result / content), when returned. */
 output?:unknown;
 error:boolean;
 status:TapeStatus;
 firstCursor:number;
 lastCursor:number;
 startedAt?:number;
 endedAt?:number;
}

export interface TapeRow {
 /** Stable across re-reads: `c<first cursor>`. */
 id:string;
 /** 1-based turn index; 0 = before the first message (bindings, setup). */
 turn:number;
 verb:TapeVerb;
 /** What the row acts on: a file name, a command, a tool, or a text excerpt. */
 object:string;
 /** The full target (full path / full command / full text) behind `object`. */
 detail?:string;
 /** Coalesced repeated calls on the same object. */
 count:number;
 status:TapeStatus;
 startedAt?:number;
 endedAt?:number;
 durationMs?:number;
 /** Every journal cursor that contributed to this row, ascending. */
 cursors:number[];
 calls:TapeCall[];
 /** Message / thought text for you / reply / think rows. */
 text?:string;
 /** The owner events behind this row — for "Show raw" only. */
 events:JournalEventLike[];
}

export interface TapeTurn {index:number;firstCursor:number;open:boolean;stop?:TurnStop;stopReason?:string;rows:TapeRow[]}
export interface Tape {turns:TapeTurn[];rows:TapeRow[];lastCursor:number;
 /** Owner events the tape recognised but deliberately shows no row for (provider status chatter). */
 quiet:number;
 /** Events of a shape the tape does not know — counted, never guessed at. */
 unknown:number}

export interface TapeOptions {seenAt?:(cursor:number)=>number|undefined}

export const VERB_LABEL:Record<TapeVerb,string>={you:"you",message:"message",reply:"reply",think:"think",read:"read",edit:"edit",run:"run",tool:"tool",wait:"wait",note:"note"};
export const TAPE_FILTERS:{id:TapeFilter;label:string}[]=[
 {id:"all",label:"All"},{id:"edits",label:"Edits"},{id:"commands",label:"Commands"},{id:"tools",label:"Tools"},{id:"waits",label:"Waits"},
];
const TOOL_VERBS:ReadonlySet<TapeVerb>=new Set(["read","edit","run","tool"]);
export const isToolRow=(row:TapeRow)=>TOOL_VERBS.has(row.verb);

export function filterRows(rows:TapeRow[],filter:TapeFilter):TapeRow[] {
 switch(filter){
  case "edits":return rows.filter(row=>row.verb==="edit");
  case "commands":return rows.filter(row=>row.verb==="run");
  case "tools":return rows.filter(isToolRow);
  case "waits":return rows.filter(row=>row.verb==="wait");
  default:return rows;
 }
}

// ── reading one owner event ───────────────────────────────────────────────
type Obj=Record<string,unknown>;
const obj=(value:unknown):value is Obj=>!!value&&typeof value==="object"&&!Array.isArray(value);
const str=(value:unknown):string|undefined=>typeof value==="string"&&value.trim()?value:undefined;
const num=(value:unknown):number|undefined=>typeof value==="number"&&Number.isFinite(value)?value:undefined;

/** The signal inside a `{kind:"provider",event:{Signal:{kind:{kind,…}}}}` envelope. */
function signalOf(event:Obj):{kind:string;body:Obj}|undefined {
 const inner=obj(event.event)?event.event:undefined;
 const signal=inner&&obj(inner.Signal)?inner.Signal:undefined;
 const kind=signal&&obj(signal.kind)?signal.kind:undefined;
 const name=kind&&str(kind.kind);
 return name?{kind:name,body:kind!}:undefined;
}
function turnEndedOf(event:Obj):Obj|undefined {
 const inner=obj(event.event)?event.event:undefined;
 return inner&&obj(inner.TurnEnded)?inner.TurnEnded:undefined;
}

const basename=(path:string)=>{const trimmed=path.replace(/\/+$/,"");return trimmed.slice(trimmed.lastIndexOf("/")+1)||trimmed;};
const oneLine=(text:string,limit=90)=>{const line=text.replace(/\s+/g," ").trim();return line.length>limit?`${line.slice(0,limit-1)}…`:line;};

/** Verb from the provider's own classification (ACP `kind`) or tool name. */
function verbOf(kind:string|undefined,name:string|undefined):TapeVerb {
 const k=(kind??"").toLowerCase();
 if(["read","search","fetch"].includes(k))return "read";
 if(["edit","delete","move"].includes(k))return "edit";
 if(k==="execute")return "run";
 const n=(name??"").toLowerCase();
 if(/^(read|read_file|view|cat|ls|list|find|glob|grep|search|fetch|web_fetch)$/.test(n))return "read";
 if(/^(edit|write|write_file|multiedit|multi_edit|str_replace|apply_patch|patch|delete|move|rename)$/.test(n))return "edit";
 if(/^(bash|shell|sh|exec|execute|terminal|run|command)$/.test(n))return "run";
 return "tool";
}

interface CallFacts {id?:string;name?:string;verb:TapeVerb;object:string;detail?:string;input?:unknown;output?:unknown;status?:TapeStatus;error?:boolean;start:boolean}

/** A tool signal's facts, from the two shapes the owner's journal carries:
 *  ACP `session/update` tool_call / tool_call_update, and Pi RPC
 *  tool_execution_start / _update / _end (and its tool-result). */
function callFacts(signalKind:string,payload:Obj):CallFacts {
 const id=str(payload.toolCallId)??str(payload.tool_call_id)??str(payload.id);
 // Pi RPC.
 const piType=str(payload.type);
 if(piType?.startsWith("tool_execution")||str(payload.toolName)){
  const name=str(payload.toolName);
  const args=obj(payload.args)?payload.args:undefined;
  const path=args&&(str(args.path)??str(args.file_path)??str(args.filePath)??str(args.file));
  const command=args&&(str(args.command)??str(args.cmd));
  const pattern=args&&(str(args.pattern)??str(args.query));
  const verb=verbOf(undefined,name);
  const object=path?basename(path):command?oneLine(command,60):pattern?`${oneLine(pattern,40)}`:name??"tool";
  const ended=signalKind==="tool-result"||piType==="tool_execution_end";
  const error=payload.isError===true;
  return {id,name,verb,object,detail:path??command??pattern??name,input:args,output:ended?payload.result:undefined,status:ended?(error?"failed":"done"):"running",error,start:piType==="tool_execution_start"};
 }
 // ACP.
 const update=str(payload.sessionUpdate);
 const kind=str(payload.kind);
 const title=str(payload.title);
 const locations=Array.isArray(payload.locations)?payload.locations:[];
 const path=str((locations[0] as Obj|undefined)?.path);
 const bareTitle=title?.replace(/^[a-z_ -]+:\s*/i,"");
 const verb=verbOf(kind,undefined);
 const object=path?basename(path):bareTitle?oneLine(bareTitle,60):kind??"tool";
 const acpStatus=str(payload.status);
 const status:TapeStatus|undefined=acpStatus==="completed"?"done":acpStatus==="failed"?"failed":acpStatus==="in_progress"||acpStatus==="pending"?"running":signalKind==="tool-result"?"done":undefined;
 const output=update==="tool_call_update"||signalKind==="tool-result"?(payload.content??payload.rawOutput):undefined;
 return {id,name:kind,verb,object,detail:path??title,input:payload.rawInput??(update==="tool_call"?{title,locations:locations.length?locations:undefined}:undefined),output,status,error:status==="failed",start:update==="tool_call"||(!update&&signalKind==="tool-call")};
}

// ── the fold ──────────────────────────────────────────────────────────────
export function tapeFromJournal(events:readonly JournalEventLike[],options:TapeOptions={}):Tape {
 const turns:TapeTurn[]=[];
 const rows:TapeRow[]=[];
 const byCall=new Map<string,{row:TapeRow;call:TapeCall}>();
 let quiet=0,unknown=0,lastCursor=0;
 const preamble:TapeTurn={index:0,firstCursor:0,open:false,rows:[]};
 let current:TapeTurn=preamble;
 const timeOf=(entry:JournalEventLike,event:Obj)=>num(event.observed_at_ms)??options.seenAt?.(entry.cursor);
 const push=(row:TapeRow)=>{if(current===preamble&&!turns.includes(preamble))turns.unshift(preamble);rows.push(row);current.rows.push(row);return row;};
 const touch=(row:TapeRow,entry:JournalEventLike,at?:number)=>{
  if(!row.cursors.includes(entry.cursor))row.cursors.push(entry.cursor);
  row.events.push(entry);
  if(at!==undefined){row.startedAt??=at;row.endedAt=at;}
 };
 const newRow=(verb:TapeVerb,object:string,entry:JournalEventLike,at:number|undefined,extra:Partial<TapeRow>={}):TapeRow=>
  push({id:`c${entry.cursor}`,turn:current.index,verb,object,count:1,status:"done",startedAt:at,endedAt:at,cursors:[entry.cursor],calls:[],events:[entry],...extra});
 const lastRow=()=>current.rows[current.rows.length-1];
 /** A pending wait settles when anything after it happens in its turn. */
 const settleWaits=(cursor:number)=>{for(const row of current.rows)if(row.status==="waiting"&&row.cursors[0]<cursor)row.status="done";};
 const closeTurn=(stop:TurnStop,reason?:string)=>{
  current.open=false;current.stop=stop;if(reason)current.stopReason=reason;
  for(const row of current.rows){
   if(row.status==="running"||row.status==="waiting")row.status=stop==="completed"?"done":stop==="cancelled"?"cancelled":"failed";
   for(const call of row.calls)if(call.status==="running")call.status=row.status;
  }
 };
 const text=(row:TapeRow,chunk:string)=>{row.text=(row.text??"")+chunk;row.object=oneLine(row.text);};

 for(const entry of events){
  lastCursor=Math.max(lastCursor,entry.cursor);
  if(!obj(entry.event)){unknown++;continue;}
  const event=entry.event;
  const at=timeOf(entry,event);
  const kind=str(event.kind);
  if(kind==="user-message"){
   // A message opens a new turn.
   if(current!==preamble&&current.open)closeTurn("completed");
   current={index:turns.filter(turn=>turn.index>0).length+1,firstCursor:entry.cursor,open:true,rows:[]};
   turns.push(current);
   const body=str(event.text)??"";
   newRow("you",oneLine(body),entry,at,{text:body,detail:body});
   continue;
  }
  if(kind==="agent-message"){
   // An addressed turn from another agent (owner-delivered packet): it opens
   // a turn exactly like a person's message, attributed to its sender.
   if(current!==preamble&&current.open)closeTurn("completed");
   current={index:turns.filter(turn=>turn.index>0).length+1,firstCursor:entry.cursor,open:true,rows:[]};
   turns.push(current);
   const request=obj(event.request)?event.request:{};
   const submission=obj(request.submission)?request.submission:{};
   const turn=obj(submission.turn)?submission.turn:{};
   const packet=obj(turn.packet)?turn.packet:{};
   const body=str(packet.text)??str(event.text)??"";
   const sender=str(request.sender)??str(turn.sender)??str(submission.agent_ref);
   newRow("message",oneLine(body),entry,at,{text:body,detail:sender});
   continue;
  }
  if(kind==="binding"){
   const provider=str(event.provider);
   newRow("note",provider?`connected · ${provider}`:"connected",entry,at,{detail:str(event.native_session_id)});
   continue;
  }
  if(kind==="native-model-configuration-confirmed"){
   const receipt=obj(event.receipt)?event.receipt:{};
   const current_=obj(receipt.current)?receipt.current:obj(receipt.model_observation)?receipt.model_observation:{};
   newRow("note",`model · ${str(current_.current_model_id)??"changed"}`,entry,at);
   continue;
  }
  if(kind==="native-mode-configuration-confirmed"){
   const receipt=obj(event.receipt)?event.receipt:{};
   newRow("note",`permission mode · ${str(receipt.current_mode_id)??str(event.mode_id)??"changed"}`,entry,at);
   continue;
  }
  if(kind==="provider"){
   const ended=turnEndedOf(event);
   if(ended){
    const stop=obj(ended.stop)?ended.stop:str(ended.stop);
    if(obj(stop)&&obj(stop.Completed))closeTurn("completed",str(stop.Completed.stop_reason));
    else if(stop==="Cancelled"||(obj(stop)&&"Cancelled" in stop))closeTurn("cancelled");
    else if(obj(stop)&&obj(stop.Failed))closeTurn("failed",str(stop.Failed.reason));
    else if(obj(stop)&&obj(stop.OperationalLimit))closeTurn("limit");
    else closeTurn("completed");
    continue;
   }
   const signal=signalOf(event);
   if(!signal){unknown++;continue;}
   const body=signal.body;
   settleWaits(entry.cursor);
   switch(signal.kind){
    case "agent-message-chunk":{
     const last=lastRow();
     if(last?.verb==="reply"&&last.status!=="failed"){text(last,str(body.text)??"");touch(last,entry,at);}
     else{const row=newRow("reply","",entry,at);text(row,str(body.text)??"");}
     break;
    }
    case "agent-thought-chunk":{
     const last=lastRow();
     if(last?.verb==="think"){text(last,str(body.text)??"");touch(last,entry,at);}
     else{const row=newRow("think","",entry,at);text(row,str(body.text)??"");}
     break;
    }
    case "tool-call":case "tool-result":{
     const payload=obj(body.payload)?body.payload:{};
     const facts=callFacts(signal.kind,payload);
     const known=facts.id?byCall.get(facts.id):undefined;
     if(known&&!facts.start){
      // A later update of a known call: its status and output.
      const {row,call}=known;
      if(facts.output!==undefined)call.output=facts.output;
      if(facts.status)call.status=facts.status;
      if(facts.error)call.error=true;
      call.lastCursor=entry.cursor;if(at!==undefined){call.endedAt=at;}
      touch(row,entry,at);
      row.status=row.calls.some(c=>c.status==="running")?"running":row.calls.some(c=>c.status==="failed")?"failed":"done";
      break;
     }
     const call:TapeCall={id:facts.id,name:facts.name,input:facts.input,output:facts.output,error:!!facts.error,status:facts.status??"running",firstCursor:entry.cursor,lastCursor:entry.cursor,startedAt:at,endedAt:at};
     const last=lastRow();
     let row:TapeRow;
     if(last&&last.verb===facts.verb&&last.object===facts.object&&isToolRow(last)){
      // Coalesce a repeated call on the same object.
      row=last;row.count++;row.calls.push(call);touch(row,entry,at);
     }else{
      row=newRow(facts.verb,facts.object,entry,at,{detail:facts.detail,calls:[call]});
     }
     row.status=row.calls.some(c=>c.status==="running")?"running":row.calls.some(c=>c.status==="failed")?"failed":"done";
     if(facts.id)byCall.set(facts.id,{row,call});
     break;
    }
    case "permission-requested":{
     const request=obj(body.request)?body.request:{};
     const toolCall=obj(request.tool_call)?request.tool_call:{};
     const title=str(toolCall.title)??str(request.tool_call)??"permission";
     newRow("wait",oneLine(title,70),entry,at,{status:"waiting",detail:str(request.native_request_id)});
     break;
    }
    case "completed":closeTurn("completed",str(body.stop_reason));break;
    case "cancelled":closeTurn("cancelled");break;
    case "failed":{const row=newRow("note",oneLine(str(body.reason)??"failed"),entry,at,{status:"failed"});row.text=str(body.reason);closeTurn("failed",str(body.reason));break;}
    case "status":case "session-opened":case "history-replay":case "model-configured":case "degraded":quiet++;break;
    default:unknown++;
   }
   continue;
  }
  // Owner housekeeping (shutdown, replay classification, context submission).
  if(kind)quiet++;else unknown++;
 }
 for(const row of rows){
  if(row.startedAt!==undefined&&row.endedAt!==undefined&&row.status!=="running"&&row.status!=="waiting")row.durationMs=Math.max(0,row.endedAt-row.startedAt);
  row.cursors.sort((a,b)=>a-b);
 }
 return {turns,rows,lastCursor,quiet,unknown};
}

export const rowsOfTurn=(tape:Tape,turn:number)=>tape.turns.find(entry=>entry.index===turn)?.rows??[];
/** The newest row still moving in the open turn — what the status line names. */
export function inFlightRow(tape:Tape):TapeRow|undefined {
 const open=[...tape.turns].reverse().find(turn=>turn.open);
 if(!open)return undefined;
 return [...open.rows].reverse().find(row=>row.status==="running"||row.status==="waiting")??[...open.rows].reverse().find(row=>row.verb!=="you");
}

/** One-line work marks for the chat (§4.3): each tool row of a turn,
 *  `edited shell.css · 12s · 3 calls`, linked to its tape row id. */
export interface WorkMark {rowId:string;line:string;status:TapeStatus}
const PAST:Partial<Record<TapeVerb,string>>={read:"read",edit:"edited",run:"ran",tool:"used",wait:"asked to",think:"thought"};
const PRESENT:Partial<Record<TapeVerb,string>>={read:"reading",edit:"editing",run:"running",tool:"using",wait:"waiting on",think:"thinking"};
export function workMarksOf(tape:Tape,turn:number):WorkMark[] {
 return rowsOfTurn(tape,turn).filter(row=>isToolRow(row)||row.verb==="wait").map(row=>{
  const moving=row.status==="running"||row.status==="waiting";
  const parts=[`${(moving?PRESENT:PAST)[row.verb]??row.verb} ${row.object}`];
  if(!moving&&row.durationMs!==undefined)parts.push(formatDuration(row.durationMs));
  if(row.count>1)parts.push(`${row.count} calls`);
  if(moving)parts.push(row.status==="waiting"?"needs you":"running");
  if(row.status==="failed")parts.push("failed");
  return {rowId:row.id,line:parts.join(" · "),status:row.status};
 });
}
export const presentVerb=(verb:TapeVerb)=>PRESENT[verb]??verb;

export function formatDuration(ms:number):string {
 if(ms<1000)return `${(ms/1000).toFixed(1)}s`;
 const seconds=Math.round(ms/1000);
 if(seconds<60)return `${seconds}s`;
 const minutes=Math.floor(seconds/60);
 return minutes<60?`${minutes}m ${seconds%60}s`:`${Math.floor(minutes/60)}h ${minutes%60}m`;
}
export function formatClock(ms:number):string {
 const date=new Date(ms);
 return `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}:${String(date.getSeconds()).padStart(2,"0")}`;
}
