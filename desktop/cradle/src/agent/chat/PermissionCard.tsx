import {useState} from "react";
import type {NativePermission,PermissionDecision} from "../../encounter/client";
import {blockText,escapedJson,oneLineText} from "../../shared/plainText";

/**
 * A permission request as an inline card (10-SIDEBARS §4.3, P5): what the
 * agent wants to do, in words, with the harness's real scope choices (its
 * own allow options — "this time", "always" — never invented ones), then
 * Allow / Refuse. One activation answers one native request; the card then
 * collapses to one line. The request's verbatim form sits behind Show raw.
 */
type Obj=Record<string,unknown>;
const obj=(value:unknown):value is Obj=>!!value&&typeof value==="object"&&!Array.isArray(value);
const str=(value:unknown)=>typeof value==="string"&&value.trim()?value:undefined;
/** Words the harness or the agent gave, as the card shows them (be2k ruling 1; DLW build ruling 2026-11-10): this is where a person
 * decides to run a command, so no bidi control reorders what they read and nothing invisible stands in it. A command keeps its line
 * breaks (blockText); a name, a path or a place stands on one line (oneLineText). Words with nothing visible left are none. */
const line=(text:string|undefined)=>text===undefined?undefined:oneLineText(text)||undefined;
/** What a command or a folder that shows nothing reads as on its line (be2l ruling 5). */
const NOTHING_VISIBLE="nothing visible";
/** A given text without the plain white space at its ends: what the card would show if it showed it as sent. */
const ends=(text:string)=>text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g,"");
/** The one line that says which parts are not shown as they were sent (be2l ruling 5), or none. */
const differing=(parts:string[])=>parts.length===0?undefined:parts.length===1
 ?`The ${parts[0]} holds characters that are not shown here. Show raw has it as it was sent.`
 :`The ${parts.slice(0,-1).join(", the ")} and the ${parts[parts.length-1]} hold characters that are not shown here. Show raw has them as they were sent.`;
const WANTS:Record<string,string>={execute:"wants to run a command",edit:"wants to edit a file",delete:"wants to delete a file",move:"wants to move a file",read:"wants to read a file",search:"wants to search",fetch:"wants to fetch a page",think:"wants to think it through"};

/** What a request asks, in the words the card draws. `differs` is the line the card adds when the command, the folder or the path it
 * shows is not the one that was sent (be2l ruling 5): the answer is then given with Show raw open. A command or a folder that shows
 * nothing reads "nothing visible". */
export function describePermission(request:NativePermission):{wants:string;target?:string;where?:string;full?:string;differs?:string} {
 const call=obj(request.tool_call)?request.tool_call:{};
 const kind=str(call.kind)??"";
 const input=obj(call.rawInput)?call.rawInput:obj(call.input)?call.input:{};
 const locations=Array.isArray(call.locations)?call.locations:[];
 const path=str((locations[0] as Obj|undefined)?.path)??str(input.path)??str(input.file_path);
 const command=str(input.command)??(kind==="execute"?str(call.title)?.replace(/^[a-z_ -]+:\s*/i,""):undefined);
 const title=str(call.title)?.replace(/^[A-Za-z][\w -]{0,30}:\s*/,"");
 const titledPath=!path&&title?.startsWith("/")?title:undefined;
 const shownPath=path??titledPath;
 const named=(shownPath?shownPath.split("/").pop():undefined)??title??(typeof request.tool_call==="string"?request.tool_call:undefined);
 const cwd=str(input.cwd);
 const shownCommand=command===undefined?undefined:blockText(command).trim(),shownCwd=cwd===undefined?undefined:oneLineText(cwd);
 const target=shownCommand!==undefined?shownCommand||NOTHING_VISIBLE:line(named);
 const where=shownCwd!==undefined?shownCwd||NOTHING_VISIBLE:line(shownPath&&shownPath.includes("/")?shownPath.slice(0,shownPath.lastIndexOf("/")).split("/").slice(-2).join("/"):undefined);
 const differs=differing([
  ...(command!==undefined&&shownCommand!==ends(command)?["command"]:[]),
  ...(cwd!==undefined&&shownCwd!==ends(cwd)?["folder"]:[]),
  ...(shownPath!==undefined&&oneLineText(shownPath)!==ends(shownPath)?["path"]:[]),
 ]);
 return {wants:WANTS[kind]??"wants permission",target,where,full:line(shownPath),differs};
}
/** Scope choices: the harness's allow options, labelled by their ACP kind. */
const SCOPE:Record<string,string>={allow_once:"This time",allow_always:"Always"};

type CardProps={request:NativePermission;agentName:string;disabled?:boolean;onAnswer:(decision:PermissionDecision,summary:string)=>void};
const allowsOf=(request:NativePermission)=>request.choices.filter(choice=>choice.kind?.startsWith("allow")??/allow|yes|approve/i.test(choice.label));

export function PermissionCard(props:CardProps) {
 const [scope,setScope]=useState(allowsOf(props.request)[0]?.option_id);
 return <PermissionCardView {...props} scope={scope} setScope={setScope}/>;
}

/** The card as drawn for one chosen scope: no state of its own, so a test can press its buttons. */
export function PermissionCardView({request,agentName,disabled,scope,setScope,onAnswer}:CardProps&{scope:string|undefined;setScope:(scope:string)=>void}) {
 const allows=allowsOf(request);
 const refuse=request.choices.find(choice=>choice.kind==="reject_once")??request.choices.find(choice=>choice.kind?.startsWith("reject")??/reject|deny|no/i.test(choice.label));
 const described=describePermission(request);
 const chosen=allows.find(choice=>choice.option_id===scope)??allows[0];
 const who=oneLineText(agentName)||"The agent",labelOf=(choice:{label:string})=>oneLineText(choice.label);
 return <section className="chat-permission" aria-label="Provider consent" aria-describedby={`consent-${request.native_request_id}`} data-request={request.native_request_id}>
  <p className="chat-permission-title" id={`consent-${request.native_request_id}`}><strong>{who} {described.wants}</strong></p>
  {described.target&&<p className="chat-permission-target" title={described.full}><code>{described.target}</code>{described.where&&<span> in {described.where}</span>}</p>}
  {described.differs&&<p className="chat-permission-differs" role="note">{described.differs}</p>}
  {allows.length>1&&<div className="chat-permission-scopes" role="radiogroup" aria-label="For how long">
   {allows.map(choice=><button key={choice.option_id} type="button" role="radio" aria-checked={choice.option_id===chosen?.option_id} className="chat-permission-scope" title={labelOf(choice)} onClick={()=>setScope(choice.option_id)}>{choice.kind&&SCOPE[choice.kind]?SCOPE[choice.kind]:labelOf(choice)}</button>)}
  </div>}
  <div className="chat-permission-actions">
   {chosen&&<button type="button" className="chat-permission-allow" disabled={disabled} onClick={()=>onAnswer({outcome:"selected",option_id:chosen.option_id},`Allowed${allows.length>1?` · ${chosen.kind&&SCOPE[chosen.kind]?SCOPE[chosen.kind].toLowerCase():labelOf(chosen)}`:""}${described.target?` · ${described.target}`:""}`)}>Allow</button>}
   <button type="button" className="oi-action chat-permission-refuse" disabled={disabled} onClick={()=>onAnswer(refuse?{outcome:"selected",option_id:refuse.option_id}:{outcome:"cancelled"},`Refused${described.target?` · ${described.target}`:""}`)}>Refuse</button>
  </div>
  <details className="chat-permission-raw" open={described.differs?true:undefined}><summary>Show raw</summary><pre>{escapedJson({tool_call:request.tool_call,choices:request.choices},1)}</pre></details>
 </section>;
}
