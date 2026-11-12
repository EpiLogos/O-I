import {useState} from "react";
import type {NativePermission,PermissionDecision} from "../../encounter/client";
import {blockText,escapedJson,oneLineText,shownOrNothing} from "../../shared/plainText";

/**
 * A permission request as an inline card (10-SIDEBARS §4.3, P5): what the
 * agent wants to do, in words, with the harness's real scope choices (its
 * own allow options — "this time", "always" — never invented ones), then
 * Allow / Refuse. One activation answers one native request; the card then
 * collapses to one line. The request's verbatim form sits behind Show raw.
 * Allow and Refuse are the harness's choices of an allow and a reject kind;
 * a choice with neither kind stands under its own label (be2p ruling 1).
 */
type Obj=Record<string,unknown>;
const obj=(value:unknown):value is Obj=>!!value&&typeof value==="object"&&!Array.isArray(value);
/** A given text without the plain white space at its ends (space, tab, line break): what the card would show if it showed it as sent. */
export const ends=(text:string)=>text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g,"");
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
 * string, that stands as the target is compared as a path is (be2n ruling 3). A path or a title that is exactly "nothing visible" is
 * shown in quotes too (be2o ruling 4; DLW build ruling 2026-11-11). `labels`: the face draws the allow choices' labels (the card's "For how
 * long"), so a label that is not shown as it was sent is named in the line as well. */
export function describePermission(request:NativePermission,face?:{labels?:boolean}):{wants:string;target?:string;where?:string;full?:string;differs?:string} {
 const {parts,...said}=readPermission(request);
 return {...said,differs:differing(face?.labels?[...parts,...labelParts(request)]:parts)};
}
/** The labels the card draws as a part of the line: the allow choices' where there is more than one, and every choice that is drawn by
 * its own label (be2p ruling 1). Named when one of them is not shown as it was sent. */
const labelParts=(request:NativePermission):string[]=>{
 const allows=allowsOf(request);
 return [...(allows.length>1?allows:[]),...othersOf(request)].some(choice=>typeof choice.label==="string"&&oneLineText(choice.label)!==ends(choice.label))?["label of a choice"]:[];
};
/** Given words on one line, in quotes when they are exactly the fallback words. */
const quoted=(text:string|undefined)=>text===undefined?undefined:shownOrNothing(text);
function readPermission(request:NativePermission):{wants:string;target?:string;where?:string;full?:string;parts:string[]} {
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
 const target=shownCommand!==undefined?shownOrNothing(shownCommand):quoted(line(named));
 const where=shownCwd!==undefined?shownOrNothing(shownCwd):quoted(line(shownPath&&shownPath.includes("/")?shownPath.slice(0,shownPath.lastIndexOf("/")).split("/").slice(-2).join("/"):undefined));
 const parts=[
  ...(command!==undefined&&shownCommand!==ends(command)?["command"]:[]),
  ...(cwd!==undefined&&shownCwd!==ends(cwd)?["folder"]:[]),
  ...(shownPath!==undefined&&oneLineText(shownPath)!==ends(shownPath)?["path"]:[]),
  ...(command===undefined&&shownPath===undefined&&title!==undefined&&oneLineText(title)!==ends(title)?["title"]:[]),
  ...(command===undefined&&shownPath===undefined&&title===undefined&&whole!==undefined&&oneLineText(whole)!==ends(whole)?["request"]:[]),
 ];
 return {wants:WANTS[kind]??"wants permission",target,where,full:line(shownPath),parts};
}
/** What every place that answers a request carries beside its words (be2n ruling 1; DLW build ruling 2026-11-11): the line that says
 * what is shown is not what was sent, when it is not, and the request as it was sent, each character of the set written as its escape,
 * for a raw view. One helper for the card, the Approvals queue and the Thread. An answer names the harness's own choice by its id and
 * carries no word of the request, shown or sent. `also` is what a face adds of its own (be2o rulings 3 and 4): `parts`, more words of the
 * request it draws cleaned (the Approvals row's tool), named in the same line; `said`, whole sentences that stand after it (a command
 * drawn on one line or cut short: targetOnOneLine), closed with the way to the raw form where the line has not said it already. */
export function permissionAsSent(request:NativePermission,described=describePermission(request),also?:{parts?:readonly string[];said?:readonly (string|undefined)[]}):{differs?:string;raw:string} {
 const line=also?.parts?.length?differing([...readPermission(request).parts,...also.parts]):described.differs;
 const said=(also?.said??[]).filter((words):words is string=>!!words);
 const differs=[line,...said,...(said.length&&!line?["Show raw has it as it was sent."]:[])].filter(Boolean).join(" ")||undefined;
 return {differs,raw:escapedJson({tool_call:request.tool_call,choices:request.choices},1)};
}
/** What a face that draws a request's target on one line, or cuts it at `cut` characters, says of it (be2o ruling 3): a command of more
 * than one line is joined there, and a cut target ends before its end, so the words shown are not the whole of what was sent. None where
 * the target stands whole on its one line. permissionAsSent closes it with the way to the raw form. */
export function targetOnOneLine(target:string|undefined,cut?:number):string|undefined {
 if(target===undefined)return undefined;
 const lines=target.split("\n").length,clipped=cut!==undefined&&target.length>cut;
 if(lines<2&&!clipped)return undefined;
 return lines>1?`The command has ${lines} lines, drawn as one here.${clipped?" It is cut short here.":""}`:"What it asks is cut short here.";
}
/** Scope choices: the harness's allow options, labelled by their ACP kind. */
const SCOPE:Record<string,string>={allow_once:"This time",allow_always:"Always"};

type CardProps={request:NativePermission;agentName:string;disabled?:boolean;onAnswer:(decision:PermissionDecision,summary:string)=>void};
/** What a choice is, by its kind alone (be2p ruling 1; DLW build ruling 2026-11-11): an allow, a refusal, or neither. A word in a label
 * never makes a choice one or the other: "Allow now" holds "no", and a harness that sends no kind has not said which its choice is. */
const isAllow=(choice:{kind?:string})=>choice.kind?.startsWith("allow")===true,isReject=(choice:{kind?:string})=>choice.kind?.startsWith("reject")===true;
const allowsOf=(request:NativePermission)=>request.choices.filter(isAllow);
/** The choices that are neither by their kind: the card lists each by its own label, and each sends its own id. */
const othersOf=(request:NativePermission)=>request.choices.filter(choice=>!isAllow(choice)&&!isReject(choice));
/** What a refusing button sends, on every face (the card's Refuse, the Approvals queue's Deny, the answer's Decline; be2q ruling 3): the
 * harness's reject for this time, else its other reject, else the cancelled outcome. Never a choice picked by its words, and never an id
 * that a choice of another kind holds too (be2q ruling 5; DLW build ruling 2026-11-11): the answer names a choice by its id alone, AIKit
 * checks only that the id was offered and hands it to the harness, so an id shared with an allow could be read there as the allow. */
export const refusalOf=(request:NativePermission):PermissionDecision=>{
 const sure=(choice:{kind?:string;option_id:string})=>isReject(choice)&&request.choices.every(other=>other.option_id!==choice.option_id||isReject(other));
 const refuse=request.choices.find(choice=>choice.kind==="reject_once"&&sure(choice))??request.choices.find(sure);
 return refuse?{outcome:"selected",option_id:refuse.option_id}:{outcome:"cancelled"};
};
/** The words for a refusing button that will send the cancelled outcome (be2q ruling 3): one helper for every face, said beside the
 * button in standing words before the press. `button` is the button's own name on that face. */
export const cancelsLine=(button:string)=>`${button} cancels the request: it offers no refusing choice.`;
/** That line for the card's Refuse. */
export const REFUSE_CANCELS=cancelsLine("Refuse");
/** The line a face whose refusing button is `button` says of this request, or none where the request offers a refusal. */
export const cancelsSaid=(request:NativePermission,button:string)=>refusalOf(request).outcome==="cancelled"?cancelsLine(button):undefined;
/** What the card's Allow is called and what its answer leaves (be2q ruling 5): where the request offers one allow and it is the always
 * kind, the button says so, since no "For how long" stands beside it to say it. */
const loneAlways=(request:NativePermission,choice:{kind?:string}|undefined)=>choice?.kind==="allow_always"&&allowsOf(request).length===1;
/** The words a card leaves after its answer, made from what was sent and never from the button pressed (be2p ruling 1): "Allowed" for a
 * choice of an allow kind (with its scope where there was more than one, and "always" for a lone always), "Refused" for one of a reject kind (and "always" where that is
 * the kind sent), "Cancelled" where no choice was sent, and for a choice of neither kind its own label, as "Answered". */
export function answerSummary(request:NativePermission,decision:PermissionDecision,target=describePermission(request).target):string {
 const tail=target?` \u00b7 ${target}`:"";
 if(decision.outcome==="cancelled")return `Cancelled: the request offered no refusing choice${tail}`;
 const choice=request.choices.find(item=>item.option_id===decision.option_id);
 const label=choice?shownOrNothing(oneLineText(choice.label)):"a choice the request does not list";
 if(choice&&isAllow(choice))return `Allowed${allowsOf(request).length>1?` \u00b7 ${choice.kind&&SCOPE[choice.kind]?SCOPE[choice.kind].toLowerCase():label}`:loneAlways(request,choice)?" \u00b7 always":""}${tail}`;
 if(choice&&isReject(choice))return `Refused${choice.kind==="reject_always"?" \u00b7 always":""}${tail}`;
 return `Answered \u00b7 ${label}${tail}`;
}

export function PermissionCard(props:CardProps) {
 const [scope,setScope]=useState(allowsOf(props.request)[0]?.option_id);
 return <PermissionCardView {...props} scope={scope} setScope={setScope}/>;
}

/** The card as drawn for one chosen scope: no state of its own, so a test can press its buttons. */
export function PermissionCardView({request,agentName,disabled,scope,setScope,onAnswer}:CardProps&{scope:string|undefined;setScope:(scope:string)=>void}) {
 const allows=allowsOf(request);
 const others=othersOf(request),refusal=refusalOf(request);
 const described=describePermission(request,{labels:true}),sent=permissionAsSent(request,described);
 const chosen=allows.find(choice=>choice.option_id===scope)??allows[0];
 const who=oneLineText(agentName)||"The agent",labelOf=(choice:{label:string})=>oneLineText(choice.label);
 const answer=(decision:PermissionDecision)=>onAnswer(decision,answerSummary(request,decision,described.target));
 return <section className="chat-permission" aria-label="Provider consent" aria-describedby={`consent-${request.native_request_id}`} data-request={request.native_request_id}>
  <p className="chat-permission-title" id={`consent-${request.native_request_id}`}><strong>{who} {described.wants}</strong></p>
  {described.target&&<p className="chat-permission-target" title={described.full}><code>{described.target}</code>{described.where&&<span> in {described.where}</span>}</p>}
  {sent.differs&&<p className="chat-permission-differs" role="note">{sent.differs}</p>}
  {allows.length>1&&<div className="chat-permission-scopes" role="radiogroup" aria-label="For how long">
   {allows.map((choice,n)=><button key={n} type="button" role="radio" aria-checked={choice.option_id===chosen?.option_id} className="chat-permission-scope" title={labelOf(choice)} onClick={()=>setScope(choice.option_id)}>{choice.kind&&SCOPE[choice.kind]?SCOPE[choice.kind]:labelOf(choice)}</button>)}
  </div>}
  {/* Refuse will send the cancelled outcome: said in the card, beside the button, before the press (be2q ruling 3). */}
  {refusal.outcome==="cancelled"&&<p className="chat-permission-cancels" role="note">{REFUSE_CANCELS}</p>}
  {/* Each choice has its own button, whatever its id: two that share an id are both drawn, and each sends that id (be2q ruling 5). */}
  <div className="chat-permission-actions">
   {chosen&&<button type="button" className="chat-permission-allow" disabled={disabled} onClick={()=>answer({outcome:"selected",option_id:chosen.option_id})}>{loneAlways(request,chosen)?"Allow always":"Allow"}</button>}
   {others.map((choice,n)=><button key={n} type="button" className="oi-action chat-permission-choice" disabled={disabled} title="The harness's own choice, in its own words. It does not say whether this allows or refuses." onClick={()=>answer({outcome:"selected",option_id:choice.option_id})}>{shownOrNothing(labelOf(choice))}</button>)}
   <button type="button" className="oi-action chat-permission-refuse" disabled={disabled} title={refusal.outcome==="cancelled"?REFUSE_CANCELS:undefined} onClick={()=>answer(refusal)}>Refuse</button>
  </div>
  <details className="chat-permission-raw" open={sent.differs?true:undefined}><summary>Show raw</summary><pre>{sent.raw}</pre></details>
 </section>;
}
