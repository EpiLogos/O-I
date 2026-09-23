import {useState} from "react";
import type {NativePermission,PermissionDecision} from "../../encounter/client";

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
const WANTS:Record<string,string>={execute:"wants to run a command",edit:"wants to edit a file",delete:"wants to delete a file",move:"wants to move a file",read:"wants to read a file",search:"wants to search",fetch:"wants to fetch a page",think:"wants to think it through"};

export function describePermission(request:NativePermission):{wants:string;target?:string;where?:string;full?:string} {
 const call=obj(request.tool_call)?request.tool_call:{};
 const kind=str(call.kind)??"";
 const input=obj(call.rawInput)?call.rawInput:obj(call.input)?call.input:{};
 const locations=Array.isArray(call.locations)?call.locations:[];
 const path=str((locations[0] as Obj|undefined)?.path)??str(input.path)??str(input.file_path);
 const command=str(input.command)??(kind==="execute"?str(call.title)?.replace(/^[a-z_ -]+:\s*/i,""):undefined);
 const title=str(call.title)?.replace(/^[A-Za-z][\w -]{0,30}:\s*/,"");
 const titledPath=!path&&title?.startsWith("/")?title:undefined;
 const shownPath=path??titledPath;
 const target=command??(shownPath?shownPath.split("/").pop():undefined)??title??(typeof request.tool_call==="string"?request.tool_call:undefined);
 return {wants:WANTS[kind]??"wants permission",target,where:str(input.cwd)??(shownPath&&shownPath.includes("/")?shownPath.slice(0,shownPath.lastIndexOf("/")).split("/").slice(-2).join("/"):undefined),full:shownPath};
}
/** Scope choices: the harness's allow options, labelled by their ACP kind. */
const SCOPE:Record<string,string>={allow_once:"This time",allow_always:"Always"};

export function PermissionCard({request,agentName,disabled,onAnswer}:{request:NativePermission;agentName:string;disabled?:boolean;onAnswer:(decision:PermissionDecision,summary:string)=>void}) {
 const allows=request.choices.filter(choice=>choice.kind?.startsWith("allow")??/allow|yes|approve/i.test(choice.label));
 const refuse=request.choices.find(choice=>choice.kind==="reject_once")??request.choices.find(choice=>choice.kind?.startsWith("reject")??/reject|deny|no/i.test(choice.label));
 const [scope,setScope]=useState(allows[0]?.option_id);
 const described=describePermission(request);
 const chosen=allows.find(choice=>choice.option_id===scope)??allows[0];
 return <section className="chat-permission" aria-label="Provider consent" aria-describedby={`consent-${request.native_request_id}`} data-request={request.native_request_id}>
  <p className="chat-permission-title" id={`consent-${request.native_request_id}`}><strong>{agentName} {described.wants}</strong></p>
  {described.target&&<p className="chat-permission-target" title={described.full}><code>{described.target}</code>{described.where&&<span> in {described.where}</span>}</p>}
  {allows.length>1&&<div className="chat-permission-scopes" role="radiogroup" aria-label="For how long">
   {allows.map(choice=><button key={choice.option_id} type="button" role="radio" aria-checked={choice.option_id===chosen?.option_id} className="chat-permission-scope" title={choice.label} onClick={()=>setScope(choice.option_id)}>{choice.kind&&SCOPE[choice.kind]?SCOPE[choice.kind]:choice.label}</button>)}
  </div>}
  <div className="chat-permission-actions">
   {chosen&&<button type="button" className="chat-permission-allow" disabled={disabled} onClick={()=>onAnswer({outcome:"selected",option_id:chosen.option_id},`Allowed${allows.length>1?` · ${chosen.kind&&SCOPE[chosen.kind]?SCOPE[chosen.kind].toLowerCase():chosen.label}`:""}${described.target?` · ${described.target}`:""}`)}>Allow</button>}
   <button type="button" className="oi-action chat-permission-refuse" disabled={disabled} onClick={()=>onAnswer(refuse?{outcome:"selected",option_id:refuse.option_id}:{outcome:"cancelled"},`Refused${described.target?` · ${described.target}`:""}`)}>Refuse</button>
  </div>
  <details className="chat-permission-raw"><summary>Show raw</summary><pre>{JSON.stringify({tool_call:request.tool_call,choices:request.choices},null,1)}</pre></details>
 </section>;
}
