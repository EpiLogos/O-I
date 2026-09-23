import {openAgentSetup} from "../../agency/agentSetup";
import {useEffect,useRef,useState,type DragEvent} from "react";
import {Glyph} from "../../workspace/Glyph";
import {useKernel} from "../../kernel/KernelProvider";
import type {CentralLocation} from "../../kernel/types";
import type {SurfaceBinding} from "../../surface/types";
import {sessionStateLabel,type EncounterSessionHandle} from "../../encounter/session";
import {EncounterList,type EncounterRow} from "../../encounter/EncounterList";
import {LOCATION_DRAG_TYPE,SURFACE_DRAG_TYPE} from "../../files/drag";
import {AgentIdentity,useAgentIdentity,type AgentIdentityReading} from "./AgentIdentity";
import {ChatTranscript} from "./ChatTranscript";
import {ChatComposer} from "./ChatComposer";
import {chatProvisionTarget} from "./firstSend";
import {appendBlock,contextBlockForLocation,contextBlockForOsFile,contextBlockForSurface,type ContextBlock} from "./attach";
import {CHAT_PREVIEW_EVENT} from "./previewGate";
import {PermissionCard} from "./PermissionCard";
import {StatusLine} from "./StatusLine";
import type {ConnectionFacts} from "./harness";
import {inFlightRow,workMarksOf,type Tape} from "../tape/model";
import "./chat.css";

/**
 * The clean chat face of the accompanying agent (base mode's resting shape):
 * the agent's identity (the active AIKit profile's image and name), the bound
 * conversation's title and live state, a transcript of turns with streamed
 * provider text, and a composer that takes attachments by drop — a file row
 * from the sidebar, a Workbench tab, a file from this computer — or from its
 * own tools. Conversations are chosen where they already are: the sidebar,
 * or the head's own history menu. One control turns the face inside out into
 * the full panel — planes, session facts, addressed dispatch — which stays
 * exactly what it was.
 *
 * The panel shell is independent of a loaded conversation: with nothing bound
 * this is a genuine new-conversation state — identity, a restrained welcome,
 * contextual starting suggestions and the FULL composer, usable by default
 * (owner commission 2026-09-20): no chooser, no gating. The first Send asks
 * the kernel to provision a fresh conversation (`onProvision` → the
 * `encounter_provision` op: SessionSpace, project context, agent session,
 * agency binding, provider open — the owner's own CLI sequence, one op) and
 * the draft is applied and sent the moment the provisioned session is live;
 * it is never lost if provisioning is refused. Nothing is invented: "new
 * chat" clears the binding and rests on this same honest fresh state, and
 * old conversations are chosen from the sidebar or the history menu only.
 *
 * The session is the SAME shared observer the panel face reads
 * (encounter/session.ts): switching faces never remounts it, and every
 * attachment is an ordinary edit of the AIKit-owned shared draft.
 */

/** The unbound composer's parked draft: kept across mode changes and tabs so
 * typing before any conversation exists is never thrown away. One key — the
 * draft is the person's next message, not a project's. */
const DRAFT_KEY="oi-chat-draft";
const readDraft=():string=>{try{return localStorage.getItem(DRAFT_KEY)??"";}catch{return "";}};
const writeDraft=(text:string)=>{try{if(text)localStorage.setItem(DRAFT_KEY,text);else localStorage.removeItem(DRAFT_KEY);}catch{/* per-viewer convenience only */}};

/** Two or three contextual starting suggestions. They FILL the draft; none
 * of them sends. The subject carries the day: an open file beats a generic
 * opener. */
const suggestionsOf=(project?:string,subject?:{title:string;location?:CentralLocation}):string[]=>{
  const out:string[]=[];
  if(subject?.location&&subject.title)out.push(`Read ${subject.title} with me and tell me what stands out.`);
  if(project)out.push(`What is the current state of ${project}, and what would you look at next?`);
  out.push("Help me think through what to do next.");
  return out.slice(0,3);
};

export function AgentChat({session,accompanying,project,agentName,situating,sessionTitle,choosing,subject,resolveSurface,onMessage,onNewChat,onChoose,onProvision,identity:identityOverride,fixture,variant,tape,onOpenActivity,connectionFacts}:{
  session?:EncounterSessionHandle;
  accompanying?:{ref:string;project:string;space:string};
  project?:string;
  agentName:string;
  situating:string;
  sessionTitle?:string;
  choosing:boolean;
  subject:{title:string;location?:CentralLocation};
  /** A Workbench tab dropped here carries its surface id; the composition root resolves it. */
  resolveSurface?:(id:string)=>SurfaceBinding|undefined;
  onMessage?:(message:string)=>void;
  /** New chat: release the binding and rest on the fresh new-conversation state. */
  onNewChat?:()=>void;
  /** The existing start/read choose pair — the history menu routes through
   * it (the sidebar and the head's history menu are the ONLY ways an old
   * conversation is selected). */
  onChoose?:(row:EncounterRow)=>Promise<void>;
  /** First Send with no conversation: provision a fresh conversation in this
   * project (kernel `encounter_provision`) and bind it — the composition root
   * sets its binding so the shared observer mounts and the parked draft is
   * applied and sent. Undefined in fixtures: fresh Send there is inert. */
  onProvision?:(project:string)=>Promise<void>;
  /** Developer preview override: a fixed identity, no profile read. */
  identity?:AgentIdentityReading;
  /** Developer preview: attachment paths stay local in fixtures, so they are
   * disabled rather than silently doing nothing. */
  fixture?:boolean;
  /** Where the chat stands. "plane" (default) is the panel strip's own Chat
   * view — the head and session row belong to the panel above it. "centre"
   * is a centre workspace (the Factory Tasks chat) and carries its own
   * head keeps only the conversation's own controls (new chat, history). */
  variant?:"plane"|"centre";
  /** The session's activity tape (agent/tape): work marks and the status line read it. */
  tape?:Tape;
  /** Open the Activity tab, at one tape row when given (status line, work marks). */
  onOpenActivity?:(rowId?:string)=>void;
  /** The connected harness's facts from the session's own binding (A1). */
  connectionFacts?:Partial<ConnectionFacts>;
}) {
  const centre=variant==="centre";
  const kernel=useKernel();
  const liveIdentity=useAgentIdentity(agentName,!(identityOverride||fixture));
  const identity=identityOverride??liveIdentity;
  const [dropping,setDropping]=useState(false);
  const [attaching,setAttaching]=useState<string>();
  const dragDepth=useRef(0);

  // --- the parked draft: editable before any conversation or provider -------
  // The fixture preview neither reads nor writes the real parked draft.
  const [localDraft,setLocalDraft]=useState(()=>fixture?"":readDraft());
  const localRef=useRef(localDraft);localRef.current=localDraft;
  const setLocal=(text:string)=>{setLocalDraft(text);if(!fixture)writeDraft(text);};

  // --- first Send with no conversation: provision, then send ---------------
  /** Set when Send was pressed with nothing bound; the provisioned binding
   * below completes it. The draft waits for the bind and is never lost. */
  const pendingSend=useRef(false);
  const flushed=useRef<string>();
  const [provisioning,setProvisioning]=useState(false);
  const [composerFocusToken,setComposerFocusToken]=useState(0);
  const state=session?.state;const actions=session?.actions;
  const action=(name:string)=>state?.reading?.actions?.find(entry=>entry.ref===`aikit.encounter.${name}`);
  const allowed=(name:string)=>action(name)?.enabled===true;
  /** The conversation's observer is live (fresh or chosen): apply the parked
   * draft, then finish the Send that opened this state. A conversation that
   * already holds a draft is never clobbered. */
  useEffect(()=>{
    if(!pendingSend.current||!session||!state||!actions)return;
    if(!state.reading||state.pending||state.busy)return;
    const key=state.key;
    if(flushed.current!==key){
      if(!localRef.current.trim()){pendingSend.current=false;return;}
      if(state.draft!==""){pendingSend.current=false;onMessage?.("That conversation already holds a draft; yours is kept in the composer.");return;}
      if(!actions.allowed("draft")){pendingSend.current=false;onMessage?.(action("draft")?.reason??"The owner does not allow editing this draft.");return;}
      flushed.current=key;actions.change(localRef.current);setLocal("");return;
    }
    if(!actions.allowed("prompt")){pendingSend.current=false;return;}
    pendingSend.current=false;void actions.send();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[session,state,actions]);
  const chooseRow=async(row:EncounterRow)=>{try{await onChoose?.(row);}catch(error){onMessage?.(String(error));}};
  /** The project a fresh chat provisions into: the face's project, else
   * Central (firstSend.ts carries the placement law). */
  const provisionProject=chatProvisionTarget(project);
  const send=()=>{
    if(session&&actions){void actions.send();return;}
    if(!onProvision){onMessage?.("Provisioning a new conversation is not available in this view.");return;}
    pendingSend.current=true;setProvisioning(true);
    onProvision(provisionProject)
      .catch(error=>{pendingSend.current=false;onMessage?.(String(error));})
      .finally(()=>setProvisioning(false));
  };
  /** Edit a sent message: its text (with its attachments) returns to the
   * composer — the recording stays; the new turn is the person's to send. */
  const editTurn=(text:string)=>{if(session&&actions)actions.change(text);else setLocal(text);setComposerFocusToken(token=>token+1);};

  // --- attachments: every path ends as one @context block in the shared draft
  const attach=async(label:string,make:()=>Promise<ContextBlock>)=>{
    if(fixture)return;
    if(!actions||!state){onMessage?.("Choose a conversation in the sidebar before attaching.");return;}
    if(!allowed("draft")){onMessage?.(action("draft")?.reason??"The owner does not allow editing this draft.");return;}
    setAttaching(label);
    try{const item=await make();actions.change(appendBlock(session!.state.draft,item));}
    catch(error){onMessage?.(String(error));}
    finally{setAttaching(undefined);}
  };
  const attachLocation=(location:CentralLocation)=>attach(location.path,()=>contextBlockForLocation(kernel.transport,location));
  const attachFiles=async(files:FileList|File[])=>{for(const file of Array.from(files))await attach(file.name,()=>contextBlockForOsFile(file));};
  const accepts=(event:DragEvent)=>{const types=event.dataTransfer.types;return types.includes(LOCATION_DRAG_TYPE)||types.includes(SURFACE_DRAG_TYPE)||types.includes("Files");};
  const onDragEnter=(event:DragEvent)=>{if(!accepts(event))return;event.preventDefault();dragDepth.current++;setDropping(true);};
  const onDragOver=(event:DragEvent)=>{if(!accepts(event))return;event.preventDefault();event.dataTransfer.dropEffect="copy";};
  const onDragLeave=(event:DragEvent)=>{if(!accepts(event))return;dragDepth.current=Math.max(0,dragDepth.current-1);if(dragDepth.current===0)setDropping(false);};
  const onDrop=(event:DragEvent)=>{
    if(!accepts(event))return;
    event.preventDefault();dragDepth.current=0;setDropping(false);
    const carried=event.dataTransfer.getData(LOCATION_DRAG_TYPE);
    if(carried){try{const location=JSON.parse(carried) as CentralLocation;if(location?.path!==undefined)void attachLocation(location);}catch(error){onMessage?.(String(error));}return;}
    const surfaceId=event.dataTransfer.getData(SURFACE_DRAG_TYPE);
    if(surfaceId){const binding=resolveSurface?.(surfaceId);if(binding)void attach(binding.title,()=>contextBlockForSurface(kernel.transport,binding));else onMessage?.("That tab names no surface this window can quote.");return;}
    if(event.dataTransfer.files.length)void attachFiles(event.dataTransfer.files);
  };

  // --- the head's history menu: the project's attached conversations --------
  const [historyOpen,setHistoryOpen]=useState(false);
  const historyRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!historyOpen)return;
    const outside=(event:MouseEvent)=>{if(!historyRef.current?.contains(event.target as Node))setHistoryOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setHistoryOpen(false);};
    document.addEventListener("mousedown",outside);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape);};
  },[historyOpen]);

  const status=state?.status;
  /** Answered requests collapse to one line until their turn ends (P5). */
  const [answered,setAnswered]=useState<{id:string;line:string}[]>([]);
  useEffect(()=>{if(status?.state!=="TurnInFlight"&&status?.state!=="InterruptRequested")setAnswered([]);},[status?.state]);
  const answer=(id:string,decision:import("../../encounter/client").PermissionDecision,line:string)=>{if(!actions)return;setAnswered(list=>[...list,{id,line}]);void actions.permission(id,decision);};
  const inFlight=status?.state==="TurnInFlight"||status?.state==="InterruptRequested";
  const moving=tape&&inFlight?inFlightRow(tape):undefined;
  const openTurn=tape?[...tape.turns].reverse().find(turn=>turn.open):undefined;
  const turnStart=openTurn?.rows[0]?.startedAt;
  const [flightSeen,setFlightSeen]=useState<number>();
  useEffect(()=>{if(inFlight)setFlightSeen(seen=>seen??Date.now());else setFlightSeen(undefined);},[inFlight]);
  const tapeTurns=tape?tape.turns.filter(turn=>turn.index>0&&(turn.rows[0]?.verb==="you"||turn.rows[0]?.verb==="message")):[];
  const marks=tape&&onOpenActivity?{forTurnFromEnd:(fromEnd:number)=>{const turn=tapeTurns[tapeTurns.length-1-fromEnd];return turn?workMarksOf(tape,turn.index):[];},onOpen:(rowId:string)=>onOpenActivity(rowId)}:undefined;
  const stateLabel=!accompanying?undefined:!state?.reading&&!status?"Reading…":sessionStateLabel(status);
  const agentLabel=status?.provider?.label??identity.name;
  const bound=!!(session&&state&&actions);
  const suggestions=suggestionsOf(project,subject);
  // The history menu is the head's own control; the sidebar is the other way
  // to select an existing conversation. A fresh chat has no chooser: first
  // Send provisions.
  const menuOpen=historyOpen;
  return <section className="agent-chat" aria-label="Agent chat" data-variant={variant??"plane"} data-fixture={fixture?"true":undefined} data-dropping={dropping?"true":undefined} data-attaching={attaching?"true":undefined} data-owner-state={status?.state} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
    {centre&&<header className="chat-head">
      <AgentIdentity identity={identity} situating={situating}/>
      <div className="chat-head-tools">
        {onNewChat&&(bound||accompanying)&&<button className="oi-tool chat-new" aria-label="New chat" title="New chat — clear the binding and start a fresh draft" onClick={()=>{setHistoryOpen(false);onNewChat();}}><Glyph name="plus" size={14}/></button>}
        <div className="chat-history" ref={historyRef}>
          <button className="oi-tool chat-history-open" aria-label="History" aria-haspopup="true" aria-expanded={menuOpen} title="History — the project's attached conversations" disabled={!onChoose} onClick={()=>setHistoryOpen(value=>!value)}><Glyph name="history" size={14}/></button>
          {menuOpen&&<div className="chat-history-menu oi-menu" role="group" aria-label="Conversations">
            {project
              ?<div className="chat-history-rows oi-scroll"><EncounterList project={project} variant="panel" activeRef={accompanying?.ref} onOpen={chooseRow}/></div>
              :<p className="chat-history-note oi-note">Select a project in the sidebar to list its conversations.</p>}
            {onNewChat&&accompanying&&<button className="oi-menu-item" onClick={()=>{setHistoryOpen(false);onNewChat();}}>New chat</button>}
            {import.meta.env.DEV&&<>
              <div className="chat-history-rule" aria-hidden="true"/>
              <button className="oi-menu-item chat-preview-entry" onClick={()=>{setHistoryOpen(false);window.dispatchEvent(new CustomEvent(CHAT_PREVIEW_EVENT,{detail:{open:true}}));}}>Preview chat UI<span className="oi-eyebrow"> developer</span></button>
            </>}
          </div>}
        </div>
      </div>
    </header>}
    {centre&&accompanying&&<div className="chat-session" data-bound={!!accompanying} data-session-state={stateLabel}>
      <Glyph name="chat" size={11}/>
      <span className="chat-session-title">{choosing?"Opening…":sessionTitle??accompanying?.ref}</span>
      {status?.provider?.label&&<span className="chat-session-provider" title="Native provider">{status.provider.label}</span>}
      {stateLabel&&!choosing&&<span className="chat-session-state oi-state" role="status" data-attention={status?.error?"true":undefined}>{status?.error?`${stateLabel} · fault`:stateLabel}</span>}
    </div>}
    {bound
      ?<>
        <ChatTranscript reading={state.reading} status={status} error={state.error} agentLabel={agentLabel} onEarlier={actions.earlier} onLatest={actions.latest} paged={state.before!==undefined} onEdit={editTurn} marks={marks}>
          {answered.map(entry=><p key={entry.id} className="chat-permission-answered oi-note" data-request={entry.id}>{entry.line}</p>)}
          {state.reading?.permissions?.filter(request=>!answered.some(entry=>entry.id===request.native_request_id)).map(request=><PermissionCard key={request.native_request_id} request={request} agentName={agentName} disabled={state.pending||!allowed("permission")} onAnswer={(decision,line)=>answer(request.native_request_id,decision,line)}/>)}
        </ChatTranscript>
        {inFlight&&<StatusLine agentName={agentName} row={moving} startedAt={turnStart??flightSeen} stopping={status?.state==="InterruptRequested"} onOpen={rowId=>onOpenActivity?.(rowId)}/>}
        <ChatComposer reading={state.reading} draft={state.draft} pending={state.pending} busy={state.busy&&!state.pending} error={state.send?undefined:state.error} editable={!!state.reading&&allowed("draft")}
          promptAllowed={allowed("prompt")&&state.send?.phase!=="checking"} promptReason={action("prompt")?.reason??undefined} cancelAllowed={allowed("cancel")}
          onDraft={actions.change} onSend={send} onCancel={actions.cancel} agentName={agentName} sendState={state.send} onRetry={()=>void actions.retrySend()}
          connection={{onSetup:()=>openAgentSetup({project:state.project||undefined,destination:{owner:"ai-kit",topic:"harness"},reason:state.error??"Harness, model or credential setup",refresh:()=>actions.refreshProviders()}),status,model:state.model,modelActions:{refresh:actions.readModel,select:actions.selectModel},mode:state.mode,onMode:id=>void actions.selectMode(id),currentFacts:connectionFacts,onRefreshProviders:()=>void actions.refreshProviders(),providers:state.providers,resume:state.resume,onProvider:provider=>void actions.connect(provider),onReconnect:provider=>void actions.reconnect(provider),openAllowed:allowed("open"),openReason:action("open")?.reason??undefined}}
          tools={{subject:subject.location?{title:subject.title,attach:()=>attachLocation(subject.location!)}:undefined,pickFiles:attachFiles}}
          draftFailed={state.draftFailed} onRecover={()=>void actions.recover()} paged={state.before!==undefined} onLatest={actions.latest} focusToken={composerFocusToken}/>
      </>
      :<div className="chat-fresh" data-state="new-conversation">
        <div className="chat-welcome">
          <p className="chat-welcome-title">{choosing?"Opening the conversation…":provisioning?"Opening a new conversation…":"New conversation"}</p>
          <p className="chat-welcome-line oi-note">{choosing?"The conversation binds through the owner's own start and read."
            :`Write below — your first message opens a new conversation in ${provisionProject}, ready to send.`}</p>
        </div>
        {/* The plane's own chooser over the project's real attached
          * conversations (the same start/read pair the centre head uses):
          * the first-Send composer stays the default, and the older
          * conversations stay one open away, here as well as the sidebar. */}
        {!centre&&!choosing&&!provisioning&&onChoose&&project&&<div className="chat-history chat-history-plane" ref={historyRef}>
          <button className="oi-action chat-history-open" aria-label="History" aria-haspopup="true" aria-expanded={menuOpen} title="History — the project's attached conversations" onClick={()=>setHistoryOpen(value=>!value)}><Glyph name="history" size={12}/><span>Choose an older conversation</span></button>
          {menuOpen&&<div className="chat-history-menu oi-menu" role="group" aria-label="Conversations">
            <div className="chat-history-rows oi-scroll"><EncounterList project={project} variant="panel" activeRef={accompanying?.ref} onOpen={chooseRow}/></div>
          </div>}
        </div>}
        {!choosing&&!provisioning&&suggestions.length>0&&<div className="chat-suggestions" aria-label="Starting suggestions">
          {suggestions.map(suggestion=><button key={suggestion} className="chat-suggestion" onClick={()=>{setLocal(suggestion);setComposerFocusToken(token=>token+1);}}>{suggestion}</button>)}
        </div>}
        <ChatComposer reading={undefined} draft={localDraft} pending={false} busy={choosing||provisioning} error={undefined} editable={!choosing&&!provisioning}
          promptAllowed={!choosing&&!provisioning} cancelAllowed={false}
          onDraft={setLocal} onSend={send} onCancel={()=>{}} agentName={agentName}
          connection={{status:undefined,providers:[],resume:undefined,onProvider:()=>{},onReconnect:()=>{},openAllowed:false,openReason:undefined}}
          tools={{pickFiles:attachFiles}} drafting provisionProject={provisionProject}
          draftFailed={false} onRecover={()=>{}} paged={false} onLatest={()=>{}} focusToken={composerFocusToken}/>
      </div>}
    {dropping&&<div className="chat-drop-veil" aria-hidden="true"><Glyph name="attach" size={20}/><span>Drop to attach to the message</span></div>}
    {attaching&&<p className="chat-attaching oi-note" role="status">Quoting {attaching}…</p>}
  </section>;
}
