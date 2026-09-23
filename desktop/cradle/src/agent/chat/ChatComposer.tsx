import type {NativeModelActions} from "../../encounter/NativeModelControls";
import {connectionLabel,type NativeModelState} from "../../encounter/nativeModel";
import type {NativeModeState} from "../../encounter/nativeMode";
import {HarnessChip,ModeChip,ModelChip} from "./ComposerChips";
import {harnessChip,type ConnectionFacts} from "./harness";
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ClipboardEvent} from "react";
import type {EncounterReading,EncounterStatus} from "../../encounter/client";
import {parseContextItems,removeContextItem,type ContextItem} from "../../context/contextItems";
import {Glyph} from "../../workspace/Glyph";
import {useVoiceDictation} from "./voice";

/**
 * The chat composer: the shared AIKit-owned draft with its attached context
 * as chips, a row of plain attachment tools, the provider connection as a
 * chip strip inside the same card, and Send / Stop. Every attachment is an
 * `@context` block in the draft (attach.ts) — the tools here only choose
 * WHAT to quote; nothing is uploaded and nothing is sent until Send.
 *
 * The composer is anchored to the panel, never to a loaded conversation: with
 * no session it edits the person's parked draft (`drafting`) and its Send
 * opens a fresh conversation (the kernel provisions it), so the chat is
 * usable by default; a disconnected or absent provider reads as a quiet
 * local explanation with the real connect/select action — never as a missing
 * composer. Whatever is typed reaches the harness verbatim — a leading
 * `/model` or any other slash-command is the harness's own surface, never
 * intercepted here.
 */
export interface ComposerTools {
  /** Quote the active centre subject (a file surface) into the draft. */
  subject?: {title:string;attach:()=>Promise<void>};
  /** Quote files picked from this computer. */
  pickFiles: (files:FileList)=>Promise<void>;
}
export interface ComposerConnection {
  status?: EncounterStatus;
  /** The owner's connections with their harness facts (A1): protocol, command. */
  providers: ConnectionFacts[];
  /** The connected harness's facts, when the providers listing lacks them
   *  (read from the session's own journal binding). */
  currentFacts?: Partial<ConnectionFacts>;
  resume?: {provider:string};
  onProvider: (id:string)=>void;
  onReconnect: (provider:string)=>void;
  openAllowed: boolean;
  openReason?: string;
  model?:NativeModelState;
  modelActions?:NativeModelActions;
  /** Permission modes (A2): the chip is absent when the harness offers none. */
  mode?:NativeModeState;
  onMode?:(id:string)=>void;
  onSetup?:()=>void;onRefreshProviders?:()=>void;
}

export function ChatComposer({reading,draft,pending,busy,error,editable,promptAllowed,promptReason,cancelAllowed,onDraft,onSend,onCancel,connection,tools,draftFailed,onRecover,paged,onLatest,focusToken,drafting,provisionProject,agentName="Agent",sendState,onRetry}:{
  reading?:EncounterReading;draft:string;pending:boolean;busy:boolean;error?:string;
  editable:boolean;promptAllowed:boolean;promptReason?:string;cancelAllowed:boolean;
  onDraft:(text:string)=>void;onSend:()=>void;onCancel:()=>void;
  connection:ComposerConnection;tools:ComposerTools;
  draftFailed:boolean;onRecover:()=>void;paged:boolean;onLatest:()=>void;
  /** Bump to move focus to the message field (a suggestion or an edit filled it). */
  focusToken?:number;
  /** Drafting before any conversation exists: Send opens a fresh conversation
   * (the kernel provisions it); nothing is gated on a chooser. */
  drafting?:boolean;
  /** The project a fresh conversation will provision into — disclosure only. */
  provisionProject?:string;
  /** Who the message goes to (the chips and the Bypass line name it). */
  agentName?:string;
  /** The last Send's outcome (P8 not sent · P9 checking). */
  sendState?:{phase:"checking"|"failed";error?:string};
  onRetry?:()=>void;
  }) {
  const input=useRef<HTMLTextAreaElement>(null);
  const picker=useRef<HTMLInputElement>(null);
  const status=connection.status;
  const running=status?.state==="TurnInFlight"||status?.state==="InterruptRequested";
  const connected=!!status?.native_session_id&&!status.error&&["Resident","TurnInFlight","InterruptRequested"].includes(status.state);
  const selected=useMemo(()=>parseContextItems(draft),[draft]);
  /** The message text without its attachment blocks — what the person reads as theirs. */
  const message=useMemo(()=>{let text=draft;for(const item of [...selected].reverse())text=text.slice(0,item.start)+text.slice(item.end);return text.replace(/^\n+|\n+$/g,"");},[draft,selected]);
  const setMessage=(text:string)=>onDraft([text.replace(/\n+$/,""),...selected.map(item=>draft.slice(item.start,item.end))].filter(Boolean).join("\n\n"));
  /** Voice dictation: the webview's own speech engine where it exists, an
   * honest named gap where it does not. Dictation writes the message part of
   * the shared draft and never touches the attached context blocks. */
  const voice=useVoiceDictation(text=>setMessage(text),()=>message);
  const fit=()=>{const el=input.current;if(!el)return;el.style.height="auto";el.style.height=`${Math.min(el.scrollHeight,220)}px`;};
  useLayoutEffect(fit,[message]);
  // The panel opens from zero width: measure again whenever the width changes.
  useLayoutEffect(()=>{const el=input.current;if(!el||typeof ResizeObserver==="undefined")return;let width=el.clientWidth;const observer=new ResizeObserver(()=>{if(el.clientWidth!==width){width=el.clientWidth;fit();}});observer.observe(el);return()=>observer.disconnect();},[]);
  useLayoutEffect(()=>{if(focusToken)input.current?.focus();},[focusToken]);
  const canSend=promptAllowed&&!pending&&!busy&&!!draft.trim();
  const chip=(item:ContextItem,index:number)=><span key={index} className="oi-chip chat-attachment" data-state="selected" title={`${item.meta}\n\n${item.quote}`}><Glyph name="attach" size={10}/><span className="chat-attachment-title">{item.title}</span>{editable&&<button className="oi-tool" aria-label={`Remove ${item.title}`} onClick={()=>onDraft(removeContextItem(draft,item))}><Glyph name="close" size={9}/></button>}</span>;
  /** Files pasted straight into the message field attach like dropped ones. */
  const onPaste=(event:ClipboardEvent)=>{const files=event.clipboardData?.files;if(files?.length&&editable){event.preventDefault();void tools.pickFiles(files);}};
  const current=status?.provider;
  // Stop is a request (P4): "Stopping…" from the click until the owner's
  // own state says how the turn ended.
  const [stopAsked,setStopAsked]=useState(false);
  useEffect(()=>{if(!running)setStopAsked(false);},[running]);
  const stopping=status?.state==="InterruptRequested"||stopAsked;
  const currentFacts:ConnectionFacts|undefined=current?{...connection.providers.find(provider=>provider.id===current.id),...connection.currentFacts,...(current as Partial<ConnectionFacts>),id:current.id,label:current.label}:undefined;
  return <div className="chat-composer" data-connection={drafting?"drafting":connected?running?"running":"connected":"disconnected"}>
    {(error||status?.error)&&reading&&<p className="chat-composer-error oi-refusal" role="alert">{error||status?.error}</p>}
    {status?.error&&status.native_session_id&&<p className="oi-note" role="status">The owner still holds this session&apos;s seat ({status.native_session_id}); recovery is the owner&apos;s service restart.</p>}
    {draftFailed&&<button className="oi-action" onClick={onRecover}>Apply my typing to the current shared draft</button>}
    {sendState?.phase==="checking"&&<p className="chat-send-state oi-note" role="status">Checking whether your message was sent…</p>}
    {sendState?.phase==="failed"&&<p className="chat-send-state" role="alert"><span>Message not sent.</span>{onRetry&&<button type="button" className="oi-action" onClick={onRetry}>Retry</button>}</p>}
    {drafting
      ?<div className="chat-connect" data-fact="new-chat">
        <span className="chat-connect-label"><Glyph name="link" size={11}/> New conversation</span>
        {provisionProject&&<span className="oi-note">First send opens it in {provisionProject}.</span>}
      </div>
      :!connected&&<div className="chat-connect" data-fact="disconnected">
      {status&&status.state!=="Disconnected"&&<span className="oi-note" role="status">{connectionLabel(status)}</span>}
      <span className="chat-connect-label"><Glyph name="link" size={11}/> Connect with</span>
      {connection.providers.map(provider=><button key={provider.id} className="chat-provider oi-chip" data-provider={provider.id} disabled={pending||!connection.openAllowed} title={connection.openReason??provider.label} aria-label={`${harnessChip(provider)} — ${provider.label}`} onClick={()=>connection.onProvider(provider.id)}>{harnessChip(provider)}</button>)}
      {!connection.providers.length&&<span className="oi-note">No encounter harness is configured. Configure an eligible native harness in System, then refresh here; your draft stays.</span>}
      {connection.onSetup&&<button type="button" className="oi-menu-item" onClick={connection.onSetup}>Repair native harness / model / credentials</button>}{connection.onRefreshProviders&&<button type="button" className="chat-provider oi-chip" disabled={pending} onClick={connection.onRefreshProviders}>Refresh harnesses</button>}
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
      {connection.mode&&connection.onMode&&<ModeChip mode={connection.mode} agentName={agentName} onSelect={connection.onMode} disabled={pending} turnRunning={running}/>}
      <span className="chat-composer-status" role="status">{voice.listening?"Listening…":pending?"Updating…":busy?"Saving…":drafting?"First send opens the conversation":paged?<button className="oi-action" onClick={onLatest}>Latest</button>:<span className="chat-drop-hint">Drop a file or a tab to attach</span>}</span>
      {connected&&currentFacts&&<div className="chat-composer-chips" role="group" aria-label="Harness and model">
        <HarnessChip current={currentFacts} picker={{connections:connection.providers,onChoose:connection.onProvider,disabled:pending||!connection.openAllowed,reason:connection.openReason,resume:connection.resume?{provider:connection.resume.provider,onResume:()=>connection.onReconnect(connection.resume!.provider)}:undefined}}/>
        {connection.model&&connection.modelActions&&<ModelChip model={connection.model} actions={connection.modelActions} disabled={pending||running}/>}
      </div>}
      {running
        ?<button className="chat-stop" disabled={pending||stopping||!cancelAllowed} aria-label={stopping?"Stopping":"Stop"} title="Stop the provider turn" onClick={()=>{setStopAsked(true);onCancel();}}><Glyph name="stop" size={12}/><span>{stopping?"Stopping…":"Stop"}</span></button>
        :<button className="chat-send" disabled={!canSend} aria-label="Send" title={drafting?"Send — opens a new conversation":promptReason??"Send (Enter)"} onClick={onSend}><Glyph name="arrow" size={13}/><span className="sr-only">Send</span></button>}
    </div>
  </div>;
}
