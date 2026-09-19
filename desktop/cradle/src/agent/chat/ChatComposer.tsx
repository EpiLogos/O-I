import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ClipboardEvent} from "react";
import type {EncounterReading,EncounterStatus,PermissionDecision} from "../../encounter/client";
import {parseContextItems,removeContextItem,type ContextItem} from "../../context/contextItems";
import {Glyph} from "../../workspace/Glyph";
import {EncounterList,type EncounterRow} from "../../encounter/EncounterList";
import {useVoiceDictation} from "./voice";

/**
 * The chat composer: the shared AIKit-owned draft with its attached context
 * as chips, a row of plain attachment tools, the provider connection as a
 * chip strip inside the same card, and Send / Stop. Every attachment is an
 * `@context` block in the draft (attach.ts) — the tools here only choose
 * WHAT to quote; nothing is uploaded and nothing is sent until Send.
 *
 * The composer is anchored to the panel, never to a loaded conversation: with
 * no session it edits the person's parked draft (`drafting`), its Send asks
 * which conversation carries the message, and a disconnected or absent
 * provider reads as a quiet local explanation with the real connect/select
 * action — never as a missing composer.
 */
export interface ComposerTools {
  /** Quote the active centre subject (a file surface) into the draft. */
  subject?: {title:string;attach:()=>Promise<void>};
  /** Quote files picked from this computer. */
  pickFiles: (files:FileList)=>Promise<void>;
}
export interface ComposerConnection {
  status?: EncounterStatus;
  providers: {id:string;label:string}[];
  resume?: {provider:string};
  onProvider: (id:string)=>void;
  onReconnect: (provider:string)=>void;
  openAllowed: boolean;
  openReason?: string;
}

export function ChatComposer({reading,draft,pending,busy,error,editable,promptAllowed,promptReason,cancelAllowed,onDraft,onSend,onCancel,onPermission,permissionAllowed,connection,tools,draftFailed,onRecover,paged,onLatest,focusToken,drafting,picking,onPick,listProject,onChooseRow}:{
  reading?:EncounterReading;draft:string;pending:boolean;busy:boolean;error?:string;
  editable:boolean;promptAllowed:boolean;promptReason?:string;cancelAllowed:boolean;
  onDraft:(text:string)=>void;onSend:()=>void;onCancel:()=>void;
  onPermission:(id:string,decision:PermissionDecision)=>void;permissionAllowed:boolean;
  connection:ComposerConnection;tools:ComposerTools;
  draftFailed:boolean;onRecover:()=>void;paged:boolean;onLatest:()=>void;
  /** Bump to move focus to the message field (a suggestion or an edit filled it). */
  focusToken?:number;
  /** Drafting before any conversation exists: Send routes through the chooser. */
  drafting?:boolean;
  /** The chooser is open (first Send with nothing bound). */
  picking?:boolean;onPick?:()=>void;listProject?:string;
  onChooseRow?:(row:EncounterRow)=>Promise<void>;
}) {
  const input=useRef<HTMLTextAreaElement>(null);
  const picker=useRef<HTMLInputElement>(null);
  const [providerOpen,setProviderOpen]=useState(false);
  const status=connection.status;
  const running=status?.state==="TurnInFlight"||status?.state==="InterruptRequested";
  const connected=!!status&&status.state!=="Disconnected";
  const selected=useMemo(()=>parseContextItems(draft),[draft]);
  /** The message text without its attachment blocks — what the person reads as theirs. */
  const message=useMemo(()=>{let text=draft;for(const item of [...selected].reverse())text=text.slice(0,item.start)+text.slice(item.end);return text.replace(/^\n+|\n+$/g,"");},[draft,selected]);
  const setMessage=(text:string)=>onDraft([text.replace(/\n+$/,""),...selected.map(item=>draft.slice(item.start,item.end))].filter(Boolean).join("\n\n"));
  /** Voice dictation: the webview's own speech engine where it exists, an
   * honest named gap where it does not. Dictation writes the message part of
   * the shared draft and never touches the attached context blocks. */
  const voice=useVoiceDictation(text=>setMessage(text),()=>message);
  useLayoutEffect(()=>{const el=input.current;if(!el)return;el.style.height="auto";el.style.height=`${Math.min(el.scrollHeight,220)}px`;},[message]);
  useLayoutEffect(()=>{if(focusToken)input.current?.focus();},[focusToken]);
  const canSend=promptAllowed&&!pending&&!busy&&!!draft.trim();
  const chip=(item:ContextItem,index:number)=><span key={index} className="oi-chip chat-attachment" data-state="selected" title={`${item.meta}\n\n${item.quote}`}><Glyph name="attach" size={10}/><span className="chat-attachment-title">{item.title}</span>{editable&&<button className="oi-tool" aria-label={`Remove ${item.title}`} onClick={()=>onDraft(removeContextItem(draft,item))}><Glyph name="close" size={9}/></button>}</span>;
  /** Files pasted straight into the message field attach like dropped ones. */
  const onPaste=(event:ClipboardEvent)=>{const files=event.clipboardData?.files;if(files?.length&&editable){event.preventDefault();void tools.pickFiles(files);}};
  const current=status?.provider;
  useEffect(()=>{
    if(!providerOpen)return;
    const outside=(event:MouseEvent)=>{if(event.target instanceof Element&&!event.target.closest(".chat-provider-menu"))setProviderOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setProviderOpen(false);};
    document.addEventListener("mousedown",outside);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape);};
  },[providerOpen]);
  return <div className="chat-composer" data-connection={drafting?"drafting":connected?running?"running":"connected":"disconnected"} data-picking={picking?"true":undefined}>
    {(error||status?.error)&&reading&&<p className="chat-composer-error oi-refusal" role="alert">{error||status?.error}</p>}
    {status?.error&&status.native_session_id&&<p className="oi-note" role="status">The owner still holds this session&apos;s seat ({status.native_session_id}); recovery is the owner&apos;s service restart.</p>}
    {draftFailed&&<button className="oi-action" onClick={onRecover}>Apply my typing to the current shared draft</button>}
    {reading?.permissions?.map(request=><section className="chat-consent" key={request.native_request_id} aria-label="Provider consent">
      <strong><Glyph name="verify" size={12}/> Provider consent requested</strong>
      <pre>{typeof request.tool_call==="string"?request.tool_call:JSON.stringify(request.tool_call,null,2)}</pre>
      <div className="chat-consent-choices">{request.choices.map(choice=><button key={choice.option_id} className="oi-action" disabled={pending||!permissionAllowed} onClick={()=>onPermission(request.native_request_id,{outcome:"selected",option_id:choice.option_id})}>{choice.label}</button>)}<button className="oi-action" disabled={pending||!permissionAllowed} onClick={()=>onPermission(request.native_request_id,{outcome:"cancelled"})}>Cancel request</button></div>
    </section>)}
    {drafting
      ?<div className="chat-connect" data-fact="drafting">
        <span className="chat-connect-label"><Glyph name="link" size={11}/> {picking?"Choose a conversation":"No conversation bound yet"}</span>
        {onPick&&<button className="chat-provider oi-chip" disabled={busy} onClick={onPick}>{picking?"Close":"Choose"}</button>}
        {picking&&listProject&&onChooseRow&&<div className="chat-history-rows oi-scroll"><EncounterList project={listProject} variant="panel" onOpen={onChooseRow}/></div>}
        {!listProject&&picking&&<span className="oi-note">Select a project in the sidebar to list its conversations.</span>}
      </div>
      :!connected&&<div className="chat-connect" data-fact="disconnected">
      <span className="chat-connect-label"><Glyph name="link" size={11}/> Connect with</span>
      {connection.providers.map(provider=><button key={provider.id} className="chat-provider oi-chip" disabled={pending||!connection.openAllowed} title={connection.openReason} onClick={()=>connection.onProvider(provider.id)}>{provider.label}</button>)}
      {!connection.providers.length&&<span className="oi-note">No ACP provider is configured; connect one in System → Sources, then return here.</span>}
      {connection.resume&&<button className="chat-provider oi-chip" data-resume="true" disabled={pending} title="The owner holds a recorded native session for this conversation; reconnecting resumes that exact identity." onClick={()=>connection.onReconnect(connection.resume!.provider)}><Glyph name="refresh" size={10}/>Reconnect {connection.resume.provider}</button>}
    </div>}
    {selected.length>0&&<div className="chat-attachments" aria-label="Attached context">{selected.map(chip)}</div>}
    <textarea ref={input} disabled={!editable} aria-label="Message" placeholder={drafting?"Write the first message…":!reading?"Reading…":connected?"Message the agent…":"Connect a provider, then write…"} value={message} rows={3}
      onChange={event=>setMessage(event.target.value)} onPaste={onPaste}
      onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(canSend)onSend();}}}/>
    <div className="chat-composer-row">
      {/* Plain tools, no menus: files from this computer, the centre subject.
          Everything else attaches by drop — a sidebar file, a tab. The
          provider/session configuration folds into one compact menu. */}
      <button className="oi-tool" aria-label="Attach files from this computer" title={drafting?"Attach after the message is carried by a conversation":"Attach files from this computer"} disabled={!editable||drafting} onClick={()=>picker.current?.click()}><Glyph name="attach" size={14}/></button>
      <input ref={picker} type="file" multiple hidden aria-hidden="true" tabIndex={-1} onChange={event=>{const files=event.target.files;if(files?.length)void tools.pickFiles(files);event.target.value="";}}/>
      {tools.subject&&<button className="oi-tool" aria-label={`Attach ${tools.subject.title}`} title={`Attach ${tools.subject.title} (the open subject)`} disabled={!editable||drafting} onClick={()=>void tools.subject!.attach()}><Glyph name="file" size={14}/></button>}
      <button type="button" className="oi-tool chat-voice" aria-pressed={voice.listening} aria-label={voice.listening?"Stop voice input":"Voice input"} title={voice.supported?(voice.listening?"Stop dictation":"Dictate into the message"):(voice.error??"Voice input is not available in this webview yet")} data-listening={voice.listening||undefined} disabled={!editable&&!voice.listening} onClick={voice.toggle}><Glyph name="mic" size={14}/></button>
      {connected&&current&&<div className="chat-provider-menu">
        <button className="oi-tool chat-provider-config" aria-label="Model and session" aria-haspopup="true" aria-expanded={providerOpen} title={`${current.label} — model and session`} onClick={()=>setProviderOpen(value=>!value)}><span className="chat-provider-config-label">{current.label}</span><Glyph name="down" size={10}/></button>
        {providerOpen&&<div className="oi-menu" role="group" aria-label="Model and session">
          <span className="oi-eyebrow">Provider</span>
          {connection.providers.filter(provider=>provider.id!==current.id).map(provider=><button key={provider.id} className="oi-menu-item" disabled={pending||!connection.openAllowed} title={connection.openReason} onClick={()=>{setProviderOpen(false);connection.onProvider(provider.id);}}>{`Connect ${provider.label}`}</button>)}
          {connection.resume&&<button className="oi-menu-item" disabled={pending} onClick={()=>{setProviderOpen(false);connection.onReconnect(connection.resume!.provider);}}>{`Reconnect recorded session (${connection.resume.provider})`}</button>}
          {!connection.providers.filter(provider=>provider.id!==current.id).length&&!connection.resume&&<span className="oi-menu-item" data-static="true">{current.label} is the configured provider.</span>}
        </div>}
      </div>}
      <span className="chat-composer-status" role="status">{voice.listening?"Listening…":pending?"Updating…":busy?"Saving…":drafting?"Send asks which conversation carries it":paged?<button className="oi-action" onClick={onLatest}>Latest</button>:<span className="chat-drop-hint">Drop a file or a tab to attach</span>}</span>
      {running
        ?<button className="chat-stop" disabled={pending||!cancelAllowed} aria-label="Stop" title="Stop the provider turn" onClick={onCancel}><Glyph name="stop" size={12}/><span>Stop</span></button>
        :<button className="chat-send" disabled={!canSend} aria-label="Send" title={drafting?"Send — choose the conversation, draft kept":promptReason??"Send (Enter)"} onClick={onSend}><Glyph name="arrow" size={13}/><span className="sr-only">Send</span></button>}
    </div>
  </div>;
}
