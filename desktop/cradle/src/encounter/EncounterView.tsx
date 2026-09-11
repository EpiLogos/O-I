import {useLayoutEffect,useRef,useState,type ReactNode} from "react";
import type {EncounterReading,EncounterStatus,JournalPage,PermissionDecision} from "./client";
import {Glyph} from "../workspace/Glyph";
import "./encounter.css";
/** Rendering and interaction only; AIKit owns transcript, consent and shared draft.
 * `presentation`: "tab" is the canvas-surface shape (own heading + plane nav);
 * "side"/"full" are the accompanying-agent-layer shapes, where the layer
 * renders its own header and plane nav (FND-02) and this view supplies only
 * the transcript + composer. */
export function EncounterView({title,plane,onPlane,reading,status,draft,pending,error,providers,onProvider,onDraft,onSend,onCancel,onEarlier,onLatest,onPermission,presentation,concealed=false,addressed,resume,onReconnect,readJournal,deliveries,space}:{title:string;plane:string;onPlane:(plane:"Conversation"|"Activity"|"Context"|"Inspect")=>void;reading?:EncounterReading;status?:EncounterStatus;draft:string;pending:boolean;error?:string;providers:{id:string;label:string}[];onProvider:(id:string)=>void;onDraft:(text:string)=>void;onSend:()=>void;onCancel:()=>void;onEarlier:()=>void;onLatest:()=>void;onPermission:(id:string,decision:PermissionDecision)=>void;presentation:"tab"|"side"|"full";concealed?:boolean;addressed?:ReactNode;resume?:{provider:string};onReconnect:(provider:string)=>void;readJournal?:(after:number)=>Promise<JournalPage>;deliveries?:{ref:string;phase:string}[];space?:string}) {
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
  // The Activity plane keeps the provider's working material — thinking, tools,
  // consent, stops, failures, turn boundaries — and leaves only the two
  // conversational kinds to the Conversation plane.
  const blocks=reading?.blocks.filter(block=>plane!=="Activity"||!["user","assistant"].includes(block.kind));
  const tab=presentation==="tab";
  return <section hidden={concealed} style={concealed?{display:"none"}:undefined} className="encounter" data-presentation={presentation} aria-label="Encounter">
    {tab && <header className="encounter-heading"><span className="encounter-mark" aria-hidden="true">◌</span><div><h2>{title}</h2><small>{status?.provider?.label??(connected?"Native encounter":"Choose a provider")}</small></div><span className="encounter-state" role="status">{running?status?.state==="InterruptRequested"?"Stopping…":"Responding…":connected?"Connected":"Disconnected"}</span></header>}
    {tab && <nav className="encounter-planes" aria-label="Encounter planes">{(["Conversation","Activity","Context","Inspect"] as const).map(name=><button key={name} aria-pressed={plane===name} onClick={()=>onPlane(name)}>{name}</button>)}</nav>}
    <div ref={transcript} className="encounter-transcript" aria-label={plane==="Conversation"?"Transcript":`Encounter ${plane}`} onScroll={()=>{const element=transcript.current;if(element)following.current=element.scrollHeight-element.clientHeight-element.scrollTop<48;}}>
      {plane==="Context"?<div className="encounter-context">
        {/* §4.1's three correlated facts, kept distinct: what is recorded, what
          * the participant is permitted to carry, and what the provider actually
          * continues. Equalising them is how transcripts become fake memory. */}
        <dl className="encounter-context-facts">
          <dt>Recorded conversation history</dt>
          <dd>The transcript pages live in the Conversation plane — this plane is not a second copy of them.</dd>
          <dt>Participant&apos;s permitted operative context</dt>
          <dd data-fact="operative-context-absent">No owner operation on the bound cut inspects the participant&apos;s operative context — the desktop does not infer it from the transcript, a profile, or a binding.</dd>
          <dt>Provider&apos;s actual continuation state</dt>
          <dd data-fact="continuation">{status?.state??"Unavailable"}{status?.native_session_id?<> — native session <code>{status.native_session_id}</code></>:null}{status?.error?<>, carrying a fault</>:null}.</dd>
        </dl>
        <dl className="encounter-context">
          <dt>Encounter</dt><dd>{reading?.agent_session}</dd>
          <dt>Provider</dt><dd>{status?.provider?.label??"No provider identity supplied"}</dd>
        </dl>
      </div>
      :plane==="Inspect"?<div className="encounter-inspect">
        <dl>
          <dt>Encounter</dt><dd>{reading?.agent_session??"Unavailable"}</dd>
          <dt>Session space</dt><dd>{typeof space==="string"?space:"Not disclosed"}</dd>
          <dt>Native session</dt><dd>{status?.native_session_id??"Not resident — no native session identity"}</dd>
          <dt>Provider</dt><dd>{status?.provider?.label??"No provider identity supplied"}</dd>
          <dt>Connection</dt><dd>{status?.state??"Unavailable"}</dd>
          <dt>Permission authority</dt><dd>{reading?.permission_authority??"Not disclosed"}</dd>
        </dl>
        <h3>Addressed deliveries dispatched from this surface</h3>
        {deliveries?.length?<ul className="encounter-deliveries">{deliveries.map(d=><li key={d.ref}><code>{d.ref}</code><span>{d.phase}</span></li>)}</ul>
          :<p>No addressed delivery has been dispatched while this surface is open. Delivery identities are minted here, bound durably by the owner, and re-dispatched never — repeat sends return the owner&apos;s held receipt.</p>}
        {reading?.actions?.length?<ul className="encounter-actions">{reading.actions.map(a=><li key={a.ref}><span>{a.ref}</span><span>{a.enabled?"Enabled":a.reason??"Disabled"}</span></li>)}</ul>:null}
        <details><summary>Raw disclosure</summary><pre>{JSON.stringify({schema:reading?.schema,connection:status,actions:reading?.actions,permission_authority:reading?.permission_authority},null,2)}</pre></details>
      </div>
      :<>
      {reading?.more&&<button onClick={()=>{following.current=false;onEarlier();}}>Earlier messages</button>}
      {/* The wait is the owner's own connection state, never an invented
        * progress claim: in-flight means a provider turn is running, and
        * InterruptRequested means a stop was asked for but not settled. */}
      {plane==="Activity"&&status?.state==="TurnInFlight"&&<p className="encounter-wait" role="status">Provider turn in flight — waiting for the provider.</p>}
      {plane==="Activity"&&status?.state==="InterruptRequested"&&<p className="encounter-wait" role="status">Stop requested — waiting for the provider to settle.</p>}
      {plane==="Activity"&&status?.error&&<p className="encounter-fault" role="alert">The owner reports a connection fault: {status.error}</p>}
      {blocks?.map(block=>(block.kind==="thinking"||block.kind==="provider-notice"||block.kind==="tool"||block.kind==="permission")?<details className="encounter-thinking" data-kind={block.kind} key={block.id}><summary>{block.kind==="thinking"?"Thinking":block.kind==="tool"?"Tool activity":block.kind==="permission"?"Provider consent":"Provider notice"}</summary><div>{block.text}</div></details>
        :block.kind==="error"?<div key={block.id} className="encounter-turn encounter-error" data-kind="error"><span className="encounter-avatar" aria-hidden="true"><Glyph name="chat" size={12}/></span><div><strong>Provider turn failed</strong><p>{block.text}</p></div></div>
        :block.kind==="completed"&&plane==="Conversation"?null
        :<div key={block.id} className={`encounter-turn encounter-${block.kind}`}><span className="encounter-avatar" aria-hidden="true">{block.kind==="user"?"Y":<Glyph name="chat" size={12}/>}</span><div><strong>{block.kind==="user"?"You":block.kind==="assistant"?(status?.provider?.label??"Assistant"):block.kind==="permission"?"Native permission requested":block.kind==="cancelled"?"Stopped":"Provider report"}</strong><p>{block.text}</p></div></div>)}
      {!reading&&<p role="status">Reading encounter…</p>}{plane==="Activity"&&blocks?.length===0&&!status?.error&&<p>No provider activity in this transcript page.</p>}
      {plane==="Activity"&&readJournal&&<ActivityJournal read={readJournal}/>}
      </>}
    </div>
    {/* Finding 14: the composer (and the permission/connect prompts that
      * live in it) rendered under every plane, including while inspecting —
      * a conversation composer with nothing to converse in. It mounts only
      * in Conversation now; every other plane still reaches it by switching
      * planes, same as switching any other tab. */}
    {plane==="Conversation" && <div className="encounter-composer">
      {(error||status?.error)&&<p role="alert">{error||status?.error}</p>}
      {/* A faulted resident still holds its seat, so the connect section never
        * re-renders — and on the bound owner cut, reconnect returns that same
        * resident idempotently without starting a new transport. The honest
        * disclosure is the held seat and the fault, not a recovery promise. */}
      {status?.error&&status?.native_session_id&&<p className="encounter-fault-held" role="status">The owner still holds the recorded session&apos;s seat ({status.native_session_id}); no operation on the bound owner replaces a faulted transport — recovery is the owner&apos;s service restart.</p>}
      {reading?.permissions?.map(request=><section className="encounter-permission" key={request.native_request_id} aria-label="Provider consent"><strong>Provider consent requested</strong><pre>{typeof request.tool_call==="string"?request.tool_call:JSON.stringify(request.tool_call,null,2)}</pre><p>This answers the provider. Execution remains subject to its native authority.</p><div>{request.choices.map(choice=><button key={choice.option_id} disabled={pending||!allowed("permission",false)} onClick={()=>onPermission(request.native_request_id,{outcome:"selected",option_id:choice.option_id})}>{choice.label}</button>)}<button disabled={pending||!allowed("permission",false)} onClick={()=>onPermission(request.native_request_id,{outcome:"cancelled"})}>Cancel request</button></div></section>)}
      {!connected&&<div className="encounter-connect"><span>Connect a native provider</span>{providers.map(provider=><button key={provider.id} disabled={pending||!allowed("open",true)} title={action("open")?.reason??undefined} onClick={()=>onProvider(provider.id)}>{provider.label}</button>)}{!providers.length&&<p>No ACP provider configured in AIKit.</p>}{resume&&<div className="encounter-resume"><p>The owner holds a recorded native session for this conversation, so a fresh open is refused. Reconnecting resumes that exact recorded identity — nothing is replaced or silently created.</p><button disabled={pending} aria-label="Reconnect recorded session" onClick={()=>onReconnect(resume.provider)}>Reconnect recorded session ({resume.provider})</button></div>}</div>}
      <textarea ref={composerInput} disabled={!reading||!allowed("draft",true)} aria-label="Message" value={draft} onChange={event=>onDraft(event.target.value)} rows={3}/>
      <div className="encounter-composer-actions">
        <button className="encounter-latest" onClick={()=>{following.current=true;onLatest();const element=transcript.current;if(element)element.scrollTop=element.scrollHeight;}}>Latest</button>
        <span role="status">{pending?"Updating…":""}</span>
        {running
          ? <button className="encounter-stop" disabled={pending||!allowed("cancel",status?.state!=="InterruptRequested")} title={action("cancel")?.reason??undefined} onClick={onCancel}>Stop</button>
          : <button className="encounter-send" disabled={!allowed("prompt",connected)||pending||!draft.trim()} title={action("prompt")?.reason??undefined} onClick={onSend}><Glyph name="arrow" size={13}/><span className="sr-only">Send</span></button>}
      </div>
      {addressed}
    </div>}
  </section>;
}
/** The owner's raw journal, read on demand through its own cursor
 * (`aikit encounter read`): the events the transcript view coalesces away.
 * Bounded page, explicit load, no polling — the cursor is the owner's. */
function ActivityJournal({read}:{read:(after:number)=>Promise<JournalPage>}) {
  const [page,setPage]=useState<JournalPage>();
  const [error,setError]=useState<string>();
  const [loading,setLoading]=useState(false);
  const load=(after:number)=>{
    setLoading(true);setError(undefined);
    read(after).then(next=>{setPage(previous=>{
      const merged=after===0?next:{...next,events:[...(previous?.events??[]),...next.events]};
      return merged;
    });}).catch(reason=>setError(String(reason))).finally(()=>setLoading(false));
  };
  return <details className="encounter-journal">
    <summary>Owner journal (raw events)</summary>
    {!page&&!loading&&<button onClick={()=>load(0)}>Load journal</button>}
    {loading&&<p role="status" aria-busy="true">Reading the journal…</p>}
    {error&&<p role="alert">{error}</p>}
    {page&&<ol className="encounter-journal-list">
      {page.events.map(event=><li key={event.cursor}>
        <code>cursor {event.cursor}</code>
        <span className="encounter-journal-kind">{journalEventKind(event.event)}</span>
        {typeof (event.event as {connection_generation?:unknown})?.connection_generation==="string"&&<small>generation {String((event.event as {connection_generation:string}).connection_generation)}</small>}
        <details><summary>event</summary><pre>{JSON.stringify(event.event,null,1).slice(0,2000)}</pre></details>
      </li>)}
    </ol>}
    {page?.more&&<button onClick={()=>load(page.next_cursor)}>Load after cursor {page.next_cursor}</button>}
    {page&&!loading&&page.events.length===0&&<p>The journal holds no events after this cursor.</p>}
  </details>;
}
/** The journal event's own kind field — verbatim from the owner's record. */
function journalEventKind(event:unknown):string{
  const kind=(event as {kind?:string})?.kind;
  if(typeof kind==="string")return kind;
  const signal=(event as {event?:{Signal?:{kind?:{kind?:string}}}})?.event?.Signal?.kind?.kind;
  return typeof signal==="string"?signal:"unknown";
}
