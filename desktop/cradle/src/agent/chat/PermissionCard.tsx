import {useState} from "react";
import type {NativePermission,PermissionDecision} from "../../encounter/client";
import {blockText,escapedJson,oneLineText,shownOrNothing} from "../../shared/plainText";

/**
 * A permission request as an inline card (10-SIDEBARS §4.3, P5): what the
 * agent wants to do, in words, with the harness's real scope choices (its
 * own allow options — "this time", "always" — never invented ones), then
 * Allow / Refuse. One activation answers one native request; the card then
 * collapses to one line. The request's verbatim form sits behind Show raw.
 */
type Obj=Record<string,unknown>;
const obj=(value:unknown):value is Obj=>!!value&&typeof value==="object"&&!Array.isArray(value);
/** A given text without the plain white space at its ends (space, tab, line break): what the card would show if it showed it as sent. */
const ends=(text:string)=>text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g,"");
/** A string that was given: one that holds more than plain white space (be2n ruling 2; DLW build ruling 2026-11-11). Blank is judged by
 * the set `ends` cuts, never by `trim`, which also takes U+FEFF, the two separators and a no-break space: a command made only of those was
 * sent, so it is a command, it reads "nothing visible" and it gets the line. */
const str=(value:unknown)=>typeof value==="string"&&ends(value)?value:undefined;
/** Words the harness or the agent gave, as the card shows them (be2k ruling 1; DLW build ruling 2026-11-10): this is where a person
 * decides to run a command, so no bidi control reorders what they read and nothing invisible stands in it. A command keeps its line
 * breaks (blockText); a name, a path or a place stands on one line (oneLineText). Words with nothing visible left are none. */
const line=(text:string|undefined)=>text===undefined?undefined:oneLineText(text)||undefined;
/** The one line that says which parts are not shown as they were sent (be2l ruling 5), or none. */
const differing=(parts:string[])=>parts.length===0?undefined:parts.length===1
 ?`The ${parts[0]} holds characters that are not shown here. Show raw has it as it was sent.`
 :`The ${parts.slice(0,-1).join(", the ")} and the ${parts[parts.length-1]} hold characters that are not shown here. Show raw has them as they were sent.`;
const WANTS:Record<string,string>={execute:"wants to run a command",edit:"wants to edit a file",delete:"wants to delete a file",move:"wants to move a file",read:"wants to read a file",search:"wants to search",fetch:"wants to fetch a page",think:"wants to think it through"};

/** What a request asks, in the words the card draws. `differs` is the line the card adds when the command, the folder or the path it
 * shows is not the one that was sent (be2l ruling 5): the answer is then given with Show raw open. A command or a folder that shows
 * nothing reads "nothing visible"; one that is those two words is shown in quotes (be2n ruling 5). A title, or a request given as one
 * string, that stands as the target is compared as a path is (be2n ruling 3). */
export function describePermission(request:NativePermission):{wants:string;target?:string;where?:string;full?:string;differs?:string} {
 const call=obj(request.tool_call)?request.tool_call:{};
 const kind=str(call.kind)??"";
 const input=obj(call.rawInput)?call.rawInput:obj(call.input)?call.input:{};
 const locations=Array.isArray(call.locations)?call.locations:[];
 const path=str((locations[0] as Obj|undefined)?.path)??str(input.path)??str(input.file_path);
 const command=str(input.command)??(kind==="execute"?str(call.title)?.replace(/^[a-z_ -]+:[ \t]*/i,""):undefined);
 const title=str(call.title)?.replace(/^[A-Za-z][\w -]{0,30}:[ \t]*/,"");
 const titledPath=!path&&title?.startsWith("/")?title:undefined;
 const shownPath=path??titledPath;
 const whole=typeof request.tool_call==="string"?request.tool_call:undefined;
 const named=(shownPath?shownPath.split("/").pop():undefined)??title??whole;
 const cwd=str(input.cwd);
 const shownCommand=command===undefined?undefined:blockText(command).trim(),shownCwd=cwd===undefined?undefined:oneLineText(cwd);
 const target=shownCommand!==undefined?shownOrNothing(shownCommand):line(named);
 const where=shownCwd!==undefined?shownOrNothing(shownCwd):line(shownPath&&shownPath.includes("/")?shownPath.slice(0,shownPath.lastIndexOf("/")).split("/").slice(-2).join("/"):undefined);
 const differs=differing([
  ...(command!==undefined&&shownCommand!==ends(command)?["command"]:[]),
  ...(cwd!==undefined&&shownCwd!==ends(cwd)?["folder"]:[]),
  ...(shownPath!==undefined&&oneLineText(shownPath)!==ends(shownPath)?["path"]:[]),
  ...(command===undefined&&shownPath===undefined&&title!==undefined&&oneLineText(title)!==ends(title)?["title"]:[]),
  ...(command===undefined&&shownPath===undefined&&title===undefined&&whole!==undefined&&oneLineText(whole)!==ends(whole)?["request"]:[]),
 ]);
 return {wants:WANTS[kind]??"wants permission",target,where,full:line(shownPath),differs};
}
/** What every place that answers a request carries beside its words (be2n ruling 1; DLW build ruling 2026-11-11): the line that says
 * what is shown is not what was sent, when it is not, and the request as it was sent, each character of the set written as its escape,
 * for a raw view. One helper for the card, the Approvals queue and the Thread. An answer names the harness's own choice by its id and
 * carries no word of the request, shown or sent. */
export function permissionAsSent(request:NativePermission,described=describePermission(request)):{differs?:string;raw:string} {
 return {differs:described.differs,raw:escapedJson({tool_call:request.tool_call,choices:request.choices},1)};
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
 const described=describePermission(request),sent=permissionAsSent(request,described);
 const chosen=allows.find(choice=>choice.option_id===scope)??allows[0];
 const who=oneLineText(agentName)||"The agent",labelOf=(choice:{label:string})=>oneLineText(choice.label);
 return <section className="chat-permission" aria-label="Provider consent" aria-describedby={`consent-${request.native_request_id}`} data-request={request.native_request_id}>
  <p className="chat-permission-title" id={`consent-${request.native_request_id}`}><strong>{who} {described.wants}</strong></p>
  {described.target&&<p className="chat-permission-target" title={described.full}><code>{described.target}</code>{described.where&&<span> in {described.where}</span>}</p>}
  {sent.differs&&<p className="chat-permission-differs" role="note">{sent.differs}</p>}
  {allows.length>1&&<div className="chat-permission-scopes" role="radiogroup" aria-label="For how long">
   {allows.map(choice=><button key={choice.option_id} type="button" role="radio" aria-checked={choice.option_id===chosen?.option_id} className="chat-permission-scope" title={labelOf(choice)} onClick={()=>setScope(choice.option_id)}>{choice.kind&&SCOPE[choice.kind]?SCOPE[choice.kind]:labelOf(choice)}</button>)}
  </div>}
  <div className="chat-permission-actions">
   {chosen&&<button type="button" className="chat-permission-allow" disabled={disabled} onClick={()=>onAnswer({outcome:"selected",option_id:chosen.option_id},`Allowed${allows.length>1?` · ${chosen.kind&&SCOPE[chosen.kind]?SCOPE[chosen.kind].toLowerCase():labelOf(chosen)}`:""}${described.target?` · ${described.target}`:""}`)}>Allow</button>}
   <button type="button" className="oi-action chat-permission-refuse" disabled={disabled} onClick={()=>onAnswer(refuse?{outcome:"selected",option_id:refuse.option_id}:{outcome:"cancelled"},`Refused${described.target?` · ${described.target}`:""}`)}>Refuse</button>
  </div>
  <details className="chat-permission-raw" open={sent.differs?true:undefined}><summary>Show raw</summary><pre>{sent.raw}</pre></details>
 </section>;
}
