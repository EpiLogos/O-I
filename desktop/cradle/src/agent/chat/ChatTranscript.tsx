import {Fragment,useState,useLayoutEffect,useRef,type ReactNode} from "react";
import type {EncounterReading,EncounterStatus} from "../../encounter/client";
import {CONTEXT_MARK,parseContextItems} from "../../context/contextItems";
import {Glyph} from "../../workspace/Glyph";
import {parsePieces,useStreamedText,type Inline} from "./streamText";

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

export function ChatTranscript({reading,status,error,agentLabel,onEarlier,onLatest,paged,onEdit,children}:{reading?:EncounterReading;status?:EncounterStatus;error?:string;agentLabel:string;onEarlier:()=>void;onLatest:()=>void;paged:boolean;onEdit?:(text:string)=>void;children?:ReactNode}) {
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
    {turns.map(turn=>{
      const first=turn.blocks[0];
      if(turn.kind==="user")return <UserTurn key={first.id} block={first} onEdit={onEdit}/>;
      if(turn.kind==="assistant")return <AssistantTurn key={first.id} block={first} label={agentLabel} live={inFlight&&first.id===lastAssistant}/>;
      if(turn.kind==="error")return <div key={first.id} className="chat-turn chat-turn-error" data-kind="error"><span className="chat-avatar" aria-hidden="true"><Glyph name="warning" size={12}/></span><div><strong>Provider turn failed</strong><p>{first.text}</p></div></div>;
      if(turn.kind==="cancelled")return <p key={first.id} className="chat-stopped oi-note" data-kind="cancelled"><Glyph name="stop" size={11}/> Stopped{first.text?` — ${first.text}`:""}</p>;
      return <WorkingRow key={first.id} blocks={turn.blocks}/>;
    })}
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
    <div className="chat-working-list">{blocks.map(block=><div key={block.id} className="chat-working-item" data-kind={block.kind}><span className="oi-eyebrow">{LABEL[block.kind]??block.kind}</span><pre>{block.text}</pre></div>)}</div>
  </details>;
}

const inline=(parts:Inline[])=>parts.map((part,index)=><Fragment key={index}>{part.kind==="code"?<code>{part.text}</code>:part.kind==="strong"?<strong>{part.text}</strong>:part.kind==="em"?<em>{part.text}</em>:part.text}</Fragment>);
