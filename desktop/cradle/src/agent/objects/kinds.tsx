/**
 * The object kinds the right panel itself opens (lane 2): a tape event (one
 * row of the Activity tape — a tool call, a message, a wait), handed
 * material from the older inspect seam, and an agent (./agentObject.tsx).
 * Imported once for its registrations (agent/objects/index.ts).
 */
import {registerObjectKind,handedMaterial,type ObjectRef} from "./registry";
import {readJournalEvent} from "../tape/journal";
import {tapeFromJournal,VERB_LABEL,formatClock,formatDuration,isToolRow,type JournalEventLike,type TapeRow} from "../tape/model";
import {CallDetail} from "../tape/Tape";

/** A tape row's page identity: `<agent-session>#<cursor>,<cursor>…` in its
 *  project. The page re-reads those exact journal events from the owner. */
export function tapeEventObject(row:TapeRow,session:{project:string;ref:string}):ObjectRef {
 const cursors=row.cursors.slice(0,24);
 return {kind:"tape-event",project:session.project,ref:`${session.ref}#${cursors.join(",")}`,title:`${VERB_LABEL[row.verb]} ${row.object}`.trim()};
}
const STATE:Record<string,string>={running:"Running",done:"Done",failed:"Failed",waiting:"Waiting for you",cancelled:"Stopped"};

registerObjectKind({
 kind:"tape-event",label:"Activity event",glyph:"activity",
 read:async(object,{transport})=>{
  const [session,list]=object.ref.split("#");
  if(!object.project||!session||!list)throw new Error("This event reference names no session.");
  const cursors=list.split(",").map(Number).filter(Number.isFinite);
  const events=(await Promise.all(cursors.map(cursor=>readJournalEvent(transport,object.project!,session,cursor)))).filter((event):event is JournalEventLike=>!!event);
  if(!events.length)throw new Error("The owner's journal holds none of these events any more.");
  const tape=tapeFromJournal(events);
  const row=tape.rows.find(candidate=>candidate.verb!=="note")??tape.rows[0];
  if(!row)throw new Error("These journal events are not an activity the tape can read.");
  const tool=isToolRow(row);
  return {
   kindLabel:tool?(row.count>1?`${row.count} tool calls`:"Tool call"):row.verb==="wait"?"Permission request":row.verb==="you"?"Your message":row.verb==="message"?"Addressed message":row.verb==="reply"?"Reply":row.verb==="think"?"Thinking":"Activity event",
   title:tool?`${VERB_LABEL[row.verb]} ${row.object}`:row.object||object.title,
   state:STATE[row.status],
   fields:[
    {label:"What",value:`${VERB_LABEL[row.verb]} · ${row.detail??row.object}`},
    ...(row.startedAt!==undefined?[{label:"When",value:`${formatClock(row.startedAt)}${row.durationMs!==undefined?` · took ${formatDuration(row.durationMs)}`:""}`}]:[{label:"When",value:"Not recorded — the journal carries no time for this event."}]),
    {label:"Session",value:session},
    ...(row.calls.some(call=>call.id)?[{label:"Provider call",value:row.calls.map(call=>call.id).filter(Boolean).join(", ")}]:[]),
    {label:"Journal",value:`${events.length} owner event${events.length===1?"":"s"} · cursor ${cursors[0]}${cursors.length>1?`–${cursors[cursors.length-1]}`:""}`},
   ],
   content:<>
    {row.text!==undefined&&!tool&&<p className="object-text">{row.text}</p>}
    {row.calls.map((call,index)=><CallDetail key={call.id??index} call={call} index={index} count={row.calls.length}/>)}
   </>,
   raw:events,
  };
 },
});

registerObjectKind({
 kind:"handed",label:"Material",glyph:"inspect",
 read:object=>{
  const held=handedMaterial(object.ref);
  if(!held)return {kindLabel:"Material",title:object.title,state:"Not held any more",fields:[{label:"Reference",value:object.ref},{label:"Why it is empty",value:"This material was handed over in an earlier session of this window; only its reference is kept, so its page cannot show it again. Open it again from where it lives."}]};
  const text=typeof held.payload==="string"?held.payload:undefined;
  return {
   kindLabel:held.kindLabel,title:object.title,
   fields:[{label:"What",value:held.kindLabel},{label:"Reference",value:object.ref},...(held.source?[{label:"Handed by",value:held.source}]:[])],
   content:text!==undefined?<p className="object-text">{text}</p>:held.payload===undefined?undefined:<p className="object-text">Structured material — in Show raw.</p>,
   raw:text!==undefined?undefined:held.payload,
  };
 },
});
