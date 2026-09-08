import {useLayoutEffect,useRef} from "react";
import type {EncounterReading,EncounterStatus,PermissionDecision} from "./client";
import {Glyph} from "../workspace/Glyph";
import "./encounter.css";
/** Rendering and interaction only; AIKit owns transcript, consent and shared draft.
 * `presentation`: "tab" is the canvas-surface shape (own heading + plane nav);
 * "side"/"full" are the accompanying-agent-layer shapes, where the layer
 * renders its own header and plane nav (FND-02) and this view supplies only
 * the transcript + composer. */
export function EncounterView({title,plane,onPlane,reading,status,draft,pending,error,providers,onProvider,onDraft,onSend,onCancel,onEarlier,onLatest,onPermission,presentation,concealed=false}:{title:string;plane:string;onPlane:(plane:"Conversation"|"Activity"|"Context"|"Inspect")=>void;reading?:EncounterReading;status?:EncounterStatus;draft:string;pending:boolean;error?:string;providers:{id:string;label:string}[];onProvider:(id:string)=>void;onDraft:(text:string)=>void;onSend:()=>void;onCancel:()=>void;onEarlier:()=>void;onLatest:()=>void;onPermission:(id:string,decision:PermissionDecision)=>void;presentation:"tab"|"side"|"full";concealed?:boolean}) {
  const transcript=useRef<HTMLDivElement>(null);const following=useRef(true);
  const composerInput=useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(()=>{const element=transcript.current;if(element&&following.current)element.scrollTop=element.scrollHeight;},[reading,plane]);
  // Finding 15: `resize:vertical` drew the WebKit resize grabber inside the
  // composer card. Auto-grow to content instead (bounded by the CSS
  // max-height, which still scrolls past that point) — covers typed input
  // and a programmatic clear (e.g. after Send) alike.
  useLayoutEffect(()=>{const el=composerInput.current;if(!el)return;el.style.height="auto";el.style.height=`${el.scrollHeight}px`;},[draft]);
  const running=status?.state==="TurnInFlight"||status?.state==="InterruptRequested";
  const connected=!!status&&status.state!=="Disconnected";
  const action=(name:string)=>reading?.actions?.find(action=>action.ref===`aikit.encounter.${name}`);
  // Missing owner Actions are unknown authority, never permission to act.
  const allowed=(name:string,_legacy:boolean)=>action(name)?.enabled===true;
  const blocks=reading?.blocks.filter(block=>plane!=="Activity"||!["user","assistant","thinking"].includes(block.kind));
  const tab=presentation==="tab";
  return <section hidden={concealed} style={concealed?{display:"none"}:undefined} className="encounter" data-presentation={presentation} aria-label="Encounter">
    {tab && <header className="encounter-heading"><span className="encounter-mark" aria-hidden="true">◌</span><div><h2>{title}</h2><small>{status?.provider?.label??(connected?"Native encounter":"Choose a provider")}</small></div><span className="encounter-state" role="status">{running?status?.state==="InterruptRequested"?"Stopping…":"Responding…":connected?"Connected":"Disconnected"}</span></header>}
    {tab && <nav className="encounter-planes" aria-label="Encounter planes">{(["Conversation","Activity","Context","Inspect"] as const).map(name=><button key={name} aria-pressed={plane===name} onClick={()=>onPlane(name)}>{name}</button>)}</nav>}
    <div ref={transcript} className="encounter-transcript" aria-label={plane==="Conversation"?"Transcript":`Encounter ${plane}`} onScroll={()=>{const element=transcript.current;if(element)following.current=element.scrollHeight-element.clientHeight-element.scrollTop<48;}}>
      {plane==="Context"?<dl className="encounter-context"><dt>Encounter</dt><dd>{reading?.agent_session}</dd><dt>Provider</dt><dd>{status?.provider?.label??"No provider identity supplied"}</dd><dt>Connection</dt><dd>{status?.state??"Unavailable"}</dd></dl>
      :plane==="Inspect"?<div className="encounter-inspect">
        <dl>
          <dt>Encounter</dt><dd>{reading?.agent_session??"Unavailable"}</dd>
          <dt>Provider</dt><dd>{status?.provider?.label??"No provider identity supplied"}</dd>
          <dt>Connection</dt><dd>{status?.state??"Unavailable"}</dd>
          <dt>Permission authority</dt><dd>{reading?.permission_authority??"Not disclosed"}</dd>
        </dl>
        {reading?.actions?.length?<ul className="encounter-actions">{reading.actions.map(a=><li key={a.ref}><span>{a.ref}</span><span>{a.enabled?"Enabled":a.reason??"Disabled"}</span></li>)}</ul>:null}
        <details><summary>Raw disclosure</summary><pre>{JSON.stringify({schema:reading?.schema,connection:status,actions:reading?.actions,permission_authority:reading?.permission_authority},null,2)}</pre></details>
      </div>
      :<>
      {reading?.more&&<button onClick={()=>{following.current=false;onEarlier();}}>Earlier messages</button>}
      {blocks?.map(block=>(block.kind==="thinking"||block.kind==="provider-notice"||block.kind==="tool"||block.kind==="permission")?<details className="encounter-thinking" data-kind={block.kind} key={block.id}><summary>{block.kind==="thinking"?"Thinking":block.kind==="tool"?"Tool activity":block.kind==="permission"?"Provider consent":"Provider notice"}</summary><div>{block.text}</div></details>:block.kind==="completed"&&plane==="Conversation"?null:<div key={block.id} className={`encounter-turn encounter-${block.kind}`}><span className="encounter-avatar" aria-hidden="true">{block.kind==="user"?"Y":<Glyph name="chat" size={12}/>}</span><div><strong>{block.kind==="user"?"You":block.kind==="assistant"?(status?.provider?.label??"Assistant"):block.kind==="permission"?"Native permission requested":block.kind==="cancelled"?"Stopped":"Provider report"}</strong><p>{block.text}</p></div></div>)}
      {!reading&&<p role="status">Reading encounter…</p>}{plane==="Activity"&&blocks?.length===0&&<p>No provider activity in this transcript page.</p>}
      </>}
    </div>
    {/* Finding 14: the composer (and the permission/connect prompts that
      * live in it) rendered under every plane, including while inspecting —
      * a conversation composer with nothing to converse in. It mounts only
      * in Conversation now; every other plane still reaches it by switching
      * planes, same as switching any other tab. */}
    {plane==="Conversation" && <div className="encounter-composer">
      {(error||status?.error)&&<p role="alert">{error||status?.error}</p>}
      {reading?.permissions?.map(request=><section className="encounter-permission" key={request.native_request_id} aria-label="Provider consent"><strong>Provider consent requested</strong><pre>{typeof request.tool_call==="string"?request.tool_call:JSON.stringify(request.tool_call,null,2)}</pre><p>This answers the provider. Execution remains subject to its native authority.</p><div>{request.choices.map(choice=><button key={choice.option_id} disabled={pending||!allowed("permission",false)} onClick={()=>onPermission(request.native_request_id,{outcome:"selected",option_id:choice.option_id})}>{choice.label}</button>)}<button disabled={pending||!allowed("permission",false)} onClick={()=>onPermission(request.native_request_id,{outcome:"cancelled"})}>Cancel request</button></div></section>)}
      {!connected&&<div className="encounter-connect"><span>Connect a native provider</span>{providers.map(provider=><button key={provider.id} disabled={pending||!allowed("open",true)} title={action("open")?.reason??undefined} onClick={()=>onProvider(provider.id)}>{provider.label}</button>)}{!providers.length&&<p>No ACP provider configured in AIKit.</p>}</div>}
      <textarea ref={composerInput} disabled={!reading||!allowed("draft",true)} aria-label="Message" value={draft} onChange={event=>onDraft(event.target.value)} rows={3}/>
      <div className="encounter-composer-actions">
        <button className="encounter-latest" onClick={()=>{following.current=true;onLatest();const element=transcript.current;if(element)element.scrollTop=element.scrollHeight;}}>Latest</button>
        <span role="status">{pending?"Updating…":""}</span>
        {running
          ? <button className="encounter-stop" disabled={pending||!allowed("cancel",status?.state!=="InterruptRequested")} title={action("cancel")?.reason??undefined} onClick={onCancel}>Stop</button>
          : <button className="encounter-send" disabled={!allowed("prompt",connected)||pending||!draft.trim()} title={action("prompt")?.reason??undefined} onClick={onSend}><Glyph name="arrow" size={13}/><span className="sr-only">Send</span></button>}
      </div>
    </div>}
  </section>;
}
