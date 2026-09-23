import {Fragment,useState,useLayoutEffect,useRef,type ReactNode} from "react";
import type {EncounterReading,EncounterStatus} from "../../encounter/client";
import {CONTEXT_MARK,parseContextItems} from "../../context/contextItems";
import {Glyph} from "../../workspace/Glyph";
import {parsePieces,useStreamedText,type Inline} from "./streamText";
import type {WorkMark} from "../tape/model";
import {operationsOf} from "../../encounter/operations";

/** Work marks (§4.3): per conversation turn, counted from the newest turn
 *  (0 = the latest), each linking to its exact event on the Activity tape. */
export interface TranscriptMarks {forTurnFromEnd:(fromEnd:number)=>WorkMark[];onOpen:(rowId:string)=>void;
 /** How the turn ended per the owner's record (a person's Stop = "cancelled"). */
 stopFromEnd?:(fromEnd:number)=>string|undefined;
 /** Files the turn edited (P6 artifact chips), and how to open one. */
 artifactsForTurnFromEnd?:(fromEnd:number)=>string[];onArtifact?:(path:string)=>void}

/**
 * The chat transcript: the owner's recorded blocks as turns. A user turn is
 * the person's own message with its attached context read as chips; an
 * assistant turn is the provider's text, streamed at a reading pace while the
 * owner reports the turn in flight; working material (thinking, tools,
 * consent, notices) folds into one quiet "working" row between turns so the
 * conversation stays readable and the detail stays one click away.
 *
 * The reader leads: the view follows the stream only while they are at the
 * bottom — scroll away and a quiet "Jump to latest" appears instead of the
 * view yanking itself. Copy sits where reading happens (code blocks, turns);
 * a sent message can return to the composer as an edit. Deeper logs stay in
 * Activity and Inspect.
 */
type Block=EncounterReading["blocks"][number];
interface Turn {kind:"user"|"assistant"|"working"|"error"|"cancelled";blocks:Block[]}

const WORKING=new Set(["thinking","tool","permission","provider-notice"]);
const LABEL:Record<string,string>={thinking:"Thinking",tool:"Tool",permission:"Consent","provider-notice":"Notice"};

function turnsOf(blocks:Block[]):Turn[] {
  const turns:Turn[]=[];
  for(const block of blocks){
    if(block.kind==="completed")continue;
    const kind:Turn["kind"]=block.kind==="user"||block.kind==="assistant"||block.kind==="error"||block.kind==="cancelled"?block.kind:WORKING.has(block.kind)?"working":"working";
    const last=turns[turns.length-1];
    if(kind==="working"&&last?.kind==="working")last.blocks.push(block);
    else turns.push({kind,blocks:[block]});
  }
  return turns;
}

/** A message's text as it would be composed again: the @context blocks and
 * the person's own words — what Edit places back in the composer. */
const contextBlockText=(meta:string,quote:string):string=>`${CONTEXT_MARK}${meta}${quote?`\n${quote.split("\n").map(line=>`> ${line}`).join("\n")}`:""}`;

const copyText=(text:string)=>void navigator.clipboard?.writeText(text).catch(()=>{});

export function ChatTranscript({reading,status,error,agentLabel,onEarlier,onLatest,paged,onEdit,marks,children}:{reading?:EncounterReading;status?:EncounterStatus;error?:string;agentLabel:string;onEarlier:()=>void;onLatest:()=>void;paged:boolean;onEdit?:(text:string)=>void;marks?:TranscriptMarks;children?:ReactNode}) {
  const host=useRef<HTMLDivElement>(null);const following=useRef(true);
  /** Mirrors `following` for rendering: the jump control exists only while
   * the reader has scrolled away from the live edge. */
  const [away,setAway]=useState(false);
  const inFlight=status?.state==="TurnInFlight";
  const blocks=reading?.blocks??[];
  const turns=turnsOf(blocks);
  const lastAssistant=[...blocks].reverse().find(block=>block.kind==="assistant")?.id;
  const signature=blocks.length?`${blocks[blocks.length-1].id}:${blocks[blocks.length-1].text.length}`:"";
  const atBottom=()=>{const element=host.current;return !element||element.scrollHeight-element.clientHeight-element.scrollTop<64;};
  useLayoutEffect(()=>{const element=host.current;if(element&&following.current)element.scrollTop=element.scrollHeight;},[signature,inFlight]);
  const connected=!!status&&status.state!=="Disconnected";
  const onScroll=()=>{const value=!atBottom();following.current=!value;setAway(value);};
  const jump=()=>{const element=host.current;if(!element)return;following.current=true;setAway(false);element.scrollTo({top:element.scrollHeight,behavior:"smooth"});};
  return <div className="chat-transcript-host">
    <div ref={host} className="chat-transcript oi-scroll" aria-label="Transcript" aria-live="polite" onScroll={onScroll}>
    {reading?.more&&<button className="chat-earlier oi-action" onClick={()=>{following.current=false;onEarlier();}}>Earlier messages</button>}
    {paged&&<p className="chat-paged oi-note" role="status">Showing an earlier page. <button className="oi-action" onClick={()=>{following.current=true;onLatest();}}>Return to latest</button></p>}
    {(()=>{
      // Conversation turns open at each user message; a turn's work marks
      // close it (§4.3). Without a tape reading the working blocks fold into
      // one quiet row instead.
      const users=turns.filter(turn=>turn.kind==="user").length;
      let segment=-1;
      const out:ReactNode[]=[];
      const flush=(key:string)=>{
        if(!marks||segment<0)return;
        const list=marks.forTurnFromEnd(users-1-segment);
        if(list.length)out.push(<WorkMarks key={key} marks={list} onOpen={marks.onOpen}/>);
        const files=marks.artifactsForTurnFromEnd?.(users-1-segment)??[];
        if(files.length&&marks.onArtifact)out.push(<div key={`${key}-files`} className="chat-artifacts" aria-label="Files this turn changed">{files.map(path=><button key={path} type="button" className="oi-chip chat-artifact" title={path} onClick={()=>marks.onArtifact!(path)}><Glyph name="file" size={10}/><span>{path.split("/").pop()}</span></button>)}</div>);
      };
      for(const turn of turns){
        const first=turn.blocks[0];
        if(turn.kind==="user"){flush(`marks-${first.id}`);segment++;out.push(<UserTurn key={first.id} block={first} onEdit={onEdit}/>);continue;}
        if(turn.kind==="assistant"){out.push(<AssistantTurn key={first.id} block={first} label={agentLabel} live={inFlight&&first.id===lastAssistant}/>);continue;}
        if(turn.kind==="error"){
          // A person's Stop can reach the provider as an abort: the owner's
          // turn record says it was stopped (P7), so it reads as Stopped.
          if(segment>=0&&marks?.stopFromEnd?.(users-1-segment)==="cancelled"){out.push(<p key={first.id} className="chat-stopped oi-note" data-kind="cancelled"><Glyph name="stop" size={11}/> Stopped.</p>);continue;}
          out.push(<div key={first.id} className="chat-turn chat-turn-error" data-kind="error"><span className="chat-avatar" aria-hidden="true"><Glyph name="warning" size={12}/></span><div><strong>Provider turn failed</strong><p>{failureText(first.text)}</p></div></div>);continue;
        }
        if(turn.kind==="cancelled"){out.push(<p key={first.id} className="chat-stopped oi-note" data-kind="cancelled"><Glyph name="stop" size={11}/> Stopped.{first.text?` ${first.text}`:""}</p>);continue;}
        if(!marks)out.push(<WorkingRow key={first.id} blocks={turn.blocks}/>);
      }
      flush("marks-last");
      return out;
    })()}
    {inFlight&&(!lastAssistant||blocks[blocks.length-1]?.kind!=="assistant")&&<div className="chat-turn chat-turn-assistant chat-turn-pending" data-kind="pending"><span className="chat-avatar" aria-hidden="true"><Glyph name="chat" size={12}/></span><div><strong>{agentLabel}</strong><p className="chat-caret" aria-label="Responding"><span/><span/><span/></p></div></div>}
    {!reading&&!error&&<p className="chat-reading oi-note" role="status">Reading the conversation…</p>}
    {!reading&&error&&<div className="chat-refused"><p className="oi-refusal" role="alert">{error}</p><p className="oi-note">The owner has not served this conversation; the read is retried while this chat stays open.</p></div>}
    {reading&&!reading.more&&!paged&&!blocks.some(block=>block.kind==="user"||block.kind==="assistant")&&<div className="chat-empty" data-state="empty-transcript"><Glyph name="chat" size={22}/><p>Nothing said yet.</p><p className="oi-note">{connected?"Write below to begin a turn.":"Connect a provider below, then write."}</p></div>}
    {children}
    </div>
    {away&&<button className="chat-jump oi-action" onClick={jump}><Glyph name="down" size={11}/> Jump to latest</button>}
  </div>;
}

function UserTurn({block,onEdit}:{block:Block;onEdit?:(text:string)=>void}) {
  const items=parseContextItems(block.text);
  let text=block.text;
  for(const item of [...items].reverse())text=text.slice(0,item.start)+text.slice(item.end);
  text=text.replace(/\n{3,}/g,"\n\n").trim();
  const whole=[...items.map(item=>contextBlockText(item.meta,item.quote)),text].filter(Boolean).join("\n\n");
  return <div className="chat-turn chat-turn-user" data-kind="user">
    <div className="chat-turn-body">
      <div className="chat-bubble">
        {items.length>0&&<div className="chat-attachments" aria-label="Attached context">{items.map((item,index)=><span key={index} className="oi-chip chat-attachment" title={`${item.meta}\n\n${item.quote}`}><Glyph name="attach" size={10}/><span>{item.title}</span></span>)}</div>}
        {text&&<p>{text}</p>}
      </div>
      <div className="chat-turn-actions">
        <button className="oi-tool" aria-label="Copy message" title="Copy" onClick={()=>copyText(whole)}><Glyph name="copy" size={12}/></button>
        {onEdit&&<button className="oi-tool" aria-label="Edit and resend" title="Edit and resend — the text returns to the composer" onClick={()=>onEdit(whole)}><Glyph name="arrow" size={12}/></button>}
      </div>
    </div>
  </div>;
}

function AssistantTurn({block,label,live}:{block:Block;label:string;live:boolean}) {
  const shown=useStreamedText(block.text,live);
  const pieces=parsePieces(shown);
  return <div className="chat-turn chat-turn-assistant" data-kind="assistant" data-live={live?"true":undefined}>
    <span className="chat-avatar" aria-hidden="true"><Glyph name="chat" size={12}/></span>
    <div className="chat-turn-body">
      <div className="chat-prose">
        <strong>{label}</strong>
        {pieces.map((piece,index)=>piece.kind==="code"
          ?<CodeBlock key={index} lang={piece.lang} text={piece.text}/>
          :piece.kind==="list"?<ul key={index}>{piece.items.map((item,itemIndex)=><li key={itemIndex}>{inline(item)}</li>)}</ul>
          :<p key={index}>{inline(piece.inline)}</p>)}
        {live&&<span className="chat-cursor" aria-hidden="true"/>}
      </div>
      {!live&&block.text.trim()&&<div className="chat-turn-actions">
        <button className="oi-tool" aria-label="Copy reply" title="Copy" onClick={()=>copyText(block.text)}><Glyph name="copy" size={12}/></button>
      </div>}
    </div>
  </div>;
}

function CodeBlock({lang,text}:{lang?:string;text:string}) {
  const [copied,setCopied]=useState(false);
  return <pre data-lang={lang}><code>{text}</code><button className="oi-tool chat-copy" aria-label="Copy code" title="Copy" onClick={()=>{copyText(text);setCopied(true);setTimeout(()=>setCopied(false),1200);}}>{copied?<Glyph name="check" size={11}/>:<Glyph name="copy" size={11}/>}</button></pre>;
}

function WorkingRow({blocks}:{blocks:Block[]}) {
  const counts=new Map<string,number>();
  for(const block of blocks)counts.set(block.kind,(counts.get(block.kind)??0)+1);
  const summary=[...counts].map(([kind,count])=>`${count} ${(LABEL[kind]??kind).toLowerCase()}${count===1?"":"s"}`).join(" · ");
  return <details className="chat-working" data-kind="working">
    <summary><Glyph name="activity" size={11}/><span>{summary}</span></summary>
    <div className="chat-working-list">{operationsOf(blocks).reverse().map(operation=><div key={operation.id} className="chat-working-item" data-kind={operation.kind}><span className="oi-eyebrow">{LABEL[operation.kind]??operation.kind}</span><span>{operation.line}</span></div>)}<details className="chat-working-raw"><summary>Show raw</summary><pre>{blocks.map(block=>block.text).join("\n\n")}</pre></details></div>
  </details>;
}

const inline=(parts:Inline[])=>parts.map((part,index)=><Fragment key={index}>{part.kind==="code"?<code>{part.text}</code>:part.kind==="strong"?<strong>{part.text}</strong>:part.kind==="em"?<em>{part.text}</em>:part.text}</Fragment>);

/** One line per tool row of the turn — `⟡ edited shell.css · 12s · 3 calls`
 *  — each opening the Activity tape at that exact event. */
function WorkMarks({marks,onOpen}:{marks:WorkMark[];onOpen:(rowId:string)=>void}) {
  return <ul className="chat-work-marks" aria-label="Work in this turn">
    {marks.map(mark=><li key={mark.rowId}><button type="button" className="chat-work-mark" data-row={mark.rowId} data-status={mark.status} onClick={()=>onOpen(mark.rowId)} title="Open this event in Activity"><span aria-hidden="true">⟡</span>{mark.line}</button></li>)}
  </ul>;
}

/** The owner records a failure as {"Failed":{"reason":…}}; show its words. */
function failureText(text:string):string {
  try{const value=JSON.parse(text) as {Failed?:{reason?:unknown}};if(typeof value?.Failed?.reason==="string")return value.Failed.reason;}catch{/* plain text */}
  return text;
}
