import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState, type ReactNode} from "react";
// The Expression composer reaches the engine projection; it loads with the Composition plane, not with the agent layer.
const ExpressionView=lazy(()=>import("../expression/ExpressionView").then((module)=>({default:module.ExpressionView})));
// The developer preview (chat/preview.dev.tsx): the same production chat
// components over fixture state — dynamically imported, dev builds only.
const ChatPreviewDev=import.meta.env.DEV
  ?lazy(()=>import("./chat/preview.dev").then((module)=>({default:module.ChatPreview})))
  :null;
import {useKernel} from "../kernel/KernelProvider";
import {Glyph} from "../workspace/Glyph";
import {MODE_CURATION,type WorkspaceMode} from "../workspace/mode";
import {useScope,scopeProject} from "../workspace/scope";
import {useEpiLens} from "../workspace/lens";
import {EPI_PRIME_QL_BODY_REF} from "../workspace/agentBody";
import type {EncounterRow} from "../encounter/EncounterList";
import {expressionReadingOf,useEncounterSession} from "../encounter/session";
import {modeClass} from "../encounter/nativeMode";
import {EXPRESSION_COMPOSE_EVENT} from "../expression/summon";
import {encounter,encounterProvision} from "../encounter/client";
import {listFiles} from "../files/client";
import type {SurfaceBinding} from "../surface/types";
import type {CentralLocation} from "../kernel/types";
import {PANEL_INSPECT_EVENT,isPanelInspectDetail,panelInspectKey} from "./planes/panelInspect";
import {AgentChat} from "./chat/AgentChat";
import {useAgentIdentity} from "./chat/AgentIdentity";
import {factsFromBinding} from "./chat/harness";
import {CHAT_PREVIEW_EVENT,isChatPreviewDetail} from "./chat/previewGate";
import {useTape} from "./tape/journal";
import type {TapeFocus} from "./tape/Tape";
import {useAgentRoster,type RosterAgent} from "../agency/roster";
import {holdHanded,interceptObjectOpens,openObject,type ObjectRef} from "./objects/registry";
import {ObjectPage} from "./objects/ObjectPage";
import "./objects/kinds";
import {PanelTop,type PanelTab} from "./panel/PanelTop";
import {AvatarMenu,type PanelAgent,type PanelPresence} from "./panel/AvatarMenu";
import {ActivityTab} from "./panel/ActivityTab";
import {AgentsTab} from "./panel/AgentsTab";
import "./agent.css";
import "./panel/panel.css";

/**
 * THE RIGHT PANEL (10-SIDEBARS §4): who am I working with, and what are they
 * doing? One panel, curated per workspace mode (`MODE_CURATION[mode].panel`):
 *
 *   one top row — avatar menu · tabs · ⤢ · ✕ (A3; no title band)
 *   Chat     — the conversation (v2 spec), permission cards, work marks,
 *              the status line and the composer's mode / harness / model chips
 *   Activity — the tape over the owner's journal (§4.4)
 *   Agents   — the roster of real identities (§4.5)
 *   Context  — the preserved canvas insertion with its launcher (§4.6),
 *              supplied by the composition root with the frame's pane host
 *
 * Inspect opens the object's own page (§4.7) — never a tab here. The session
 * is the shared observer (encounter/session.ts): a mode or tab change never
 * remounts it, so drafts and identity ride through.
 */

export type EncounterPlane = "Conversation" | "Activity" | "Context" | "Inspect" | "Composition";
export interface AgentAccompanying { ref: string; project: string; space: string }
export interface AgentSubject {
  ref?: string;
  kind?: string;
  title: string;
  project?: string;
  location?: CentralLocation;
  dirty?: boolean;
  revision?: string;
}
/** A composition-root supplied plane (Context canvas, Factory Run…). */
export interface AgentExtraPlane { id: string; label: string; body: ReactNode }
export interface AgentLayerProps {
  project?: string;
  subject: AgentSubject;
  history?: ReactNode;
  historyAvailable: boolean;
  accompanying?: AgentAccompanying;
  /** `undefined` releases the binding — the chat face's "New chat". */
  onAccompanying: (value: AgentAccompanying | undefined) => void;
  full: boolean;
  onFull: () => void;
  /** ✕ — collapse the panel (⌘⇧B). */
  onCollapse?: () => void;
  mode?: WorkspaceMode;
  /** Shown when their id is in MODE_CURATION[mode].panel.extra, in that order. */
  extraPlanes?: AgentExtraPlane[];
  /** Optional mode/world default acting body for a NEW conversation. */
  preferredBodyRef?: string;
  /** Controlled resting plane; uncontrolled fallback is the mode's first plane. */
  plane?: string;
  onPlane?: (plane: string) => void;
  onError?: (message: string) => void;
  /** Open / focus the conversation as a centre tab (P14 promote). */
  onOpenConversation?: (accompanying: AgentAccompanying) => void;
  /** Close the conversation's centre tab so it returns here (P14 Bring back). */
  onBringBack?: (accompanying: AgentAccompanying) => void;
  onOpenSubject?: (subject: AgentSubject) => void;
  resolveSurface?: (id: string) => SurfaceBinding | undefined;
}

/** Built-in planes whose bodies the panel owns; stay mounted once visited. */
const BUILT_IN:Record<string,string>={Chat:"Chat",Activity:"Activity",Agents:"Agents"};
const KEPT_PLANES=["Chat","Activity","Agents"] as const;
const CHOSEN_KEY="oi-panel-agent.v1";
const readChosen=():Record<string,string>=>{try{return JSON.parse(localStorage.getItem(CHOSEN_KEY)??"{}") as Record<string,string>;}catch{return {};}};

export function AgentLayer({project:projectProp, subject, accompanying, onAccompanying, full, onFull, onCollapse, mode="base", extraPlanes, preferredBodyRef, plane: controlledPlane, onPlane, onError, onOpenConversation, onBringBack, onOpenSubject, resolveSurface}: AgentLayerProps) {
  const kernel = useKernel();
  const curation = MODE_CURATION[mode].panel;
  const scope = useScope();
  const lens = useEpiLens();
  const project = projectProp ?? scopeProject(scope);
  // --- developer preview ----------------------------------------------------
  const [preview,setPreview]=useState(false);
  useEffect(()=>{
    if(!import.meta.env.DEV)return;
    const toggle=(event:Event)=>{const detail=(event as CustomEvent<unknown>).detail;if(isChatPreviewDetail(detail))setPreview(detail.open);};
    window.addEventListener(CHAT_PREVIEW_EVENT,toggle);return()=>window.removeEventListener(CHAT_PREVIEW_EVENT,toggle);
  },[]);
  const [compositionRef,setCompositionRef]=useState<string>();
  const [choosing,setChoosing]=useState(false);

  // --- the tabs, curated in the mode's own order ---------------------------
  const offered=useMemo(()=>curation.planes
    .map(id=>{
      if(BUILT_IN[id])return {id,label:BUILT_IN[id]};
      const extra=extraPlanes?.find(candidate=>candidate.id===id);
      return curation.extra.includes(id)&&extra?{id,label:extra.label}:undefined;
    })
    .filter((entry):entry is {id:string;label:string}=>!!entry),[curation,extraPlanes]);
  const [ownPlane,setOwnPlane]=useState<string>();
  const [visiting,setVisiting]=useState<string>();
  useEffect(()=>setVisiting(undefined),[mode]);
  const requested=controlledPlane??ownPlane;
  const resting=requested&&offered.some(entry=>entry.id===requested)?requested:offered[0]?.id??"Chat";
  const plane=visiting??resting;
  const select=useCallback((id:string)=>{setVisiting(undefined);setOwnPlane(id);onPlane?.(id);},[onPlane]);
  const show=useCallback((id:string)=>{if(offered.some(entry=>entry.id===id))select(id);else setVisiting(id);},[offered,select]);
  const visited=useRef(new Set<string>());visited.current.add(plane);

  // --- the one session and its tape ---------------------------------------
  const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
  const sessionState=session?.state;
  const expression=useMemo(()=>expressionReadingOf(sessionState),[sessionState?.status,sessionState?.reading,sessionState?.pending]);
  const {tape,reading:journal}=useTape(accompanying?{project:accompanying.project,ref:accompanying.ref}:undefined,sessionState?.reading);
  const binding=useMemo(()=>{const events=journal?.events??[];for(let index=events.length-1;index>=0;index--){const event=events[index].event as {kind?:string};if(event?.kind==="binding")return event as {protocol?:unknown;effective_launch_argv?:unknown};}return undefined;},[journal?.events]);
  const connectionFacts=useMemo(()=>factsFromBinding(binding),[binding]);
  /** An artifact chip opens the file the turn changed: the provider's path,
   *  resolved against the session's working directory, located in Central. */
  const openArtifact=useCallback(async(path:string)=>{
    try{
      const cwd=typeof (binding as {cwd?:unknown}|undefined)?.cwd==="string"?(binding as {cwd:string}).cwd:undefined;
      const absolute=path.startsWith("/")?path:cwd?`${cwd.replace(/\/+$/,"")}/${path}`:path;
      const bare=(value:string)=>value.replace(/^\/private(?=\/)/,"");
      const root=kernel.snapshot.navigator?.root?.root;
      if(!root||!bare(absolute).startsWith(`${bare(root).replace(/\/+$/,"")}/`))throw new Error(`${path} is outside this Central, so it cannot be opened here.`);
      const relative=bare(absolute).slice(bare(root).replace(/\/+$/,"").length+1);
      const slash=relative.lastIndexOf("/");
      const directory=await listFiles(kernel.transport,slash<0?"":relative.slice(0,slash));
      const entry=directory.entries.find(candidate=>candidate.kind==="file"&&candidate.name===relative.slice(slash+1));
      if(!entry)throw new Error(`Central lists no ${relative} any more.`);
      onOpenSubject?.({title:entry.name,location:entry.location as CentralLocation});
    }catch(error){onError?.(error instanceof Error?error.message:String(error));}
  },[binding,kernel.snapshot.navigator,kernel.transport,onOpenSubject,onError]);
  const [focus,setFocus]=useState<TapeFocus>();
  /** Choosing the Activity tab afresh resumes following the newest event. */
  const [followToken,setFollowToken]=useState(0);
  const openActivity=useCallback((rowId?:string)=>{if(rowId)setFocus(held=>({rowId,token:(held?.token??0)+1}));show("Activity");},[show]);
  // Activity carries a dot for rows that arrived while it was not in view.
  const [seenRows,setSeenRows]=useState(0);
  useEffect(()=>{if(plane==="Activity")setSeenRows(tape.rows.length);},[plane,tape.rows.length]);
  useEffect(()=>setSeenRows(0),[accompanying?.ref]);

  // --- the Expression summon: Composition, full (unchanged) -----------------
  useEffect(()=>{
    if(mode==="expressions"||mode==="techne")return;
    const summon=(event:Event)=>{const ref=(event as CustomEvent<{expressionRef?:string}>).detail?.expressionRef;if(ref!==undefined&&!ref.startsWith("expression:"))return;if(ref)setCompositionRef(ref);show("Composition");if(!full)onFull();};
    window.addEventListener(EXPRESSION_COMPOSE_EVENT,summon);return()=>window.removeEventListener(EXPRESSION_COMPOSE_EVENT,summon);
  },[mode,full,onFull,show]);

  // --- Inspect opens the object (D1): the older hand-off seam lands on a page
  useEffect(()=>{
    const take=(event:Event)=>{
      const detail=(event as CustomEvent<unknown>).detail;
      if(!isPanelInspectDetail(detail))return;
      const ref=panelInspectKey(detail);
      holdHanded(ref,{payload:detail.payload,source:detail.source,kindLabel:detail.kind.replace(/[-_]/g," ").replace(/^./,letter=>letter.toUpperCase())});
      openObject({kind:"handed",ref,title:detail.title});
    };
    window.addEventListener(PANEL_INSPECT_EVENT,take);return()=>window.removeEventListener(PANEL_INSPECT_EVENT,take);
  },[]);

  // --- P18: narrow — the panel is an overlay drawer; a page opened from it
  // opens as a detail layer in place, with Back; Escape steps one layer.
  const host=useRef<HTMLElement>(null);
  const [detail,setDetail]=useState<ObjectRef>();
  useEffect(()=>interceptObjectOpens(open=>{
    if(open.popOut||window.innerWidth>760||!host.current?.offsetParent)return false;
    setDetail(open.object);return true;
  }),[]);
  useEffect(()=>{
    if(!detail)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();setDetail(undefined);}};
    window.addEventListener("keydown",escape,true);return()=>window.removeEventListener("keydown",escape,true);
  },[detail]);

  // --- choosing a conversation: the existing start/read pair -----------------
  const [titles,setTitles]=useState<Record<string,string>>({});
  const learnTitles=useCallback((rows:EncounterRow[])=>setTitles(held=>{const next={...held};let changed=false;for(const row of rows)if(next[row.ref]!==row.title){next[row.ref]=row.title;changed=true;}return changed?next:held;}),[]);
  const choose = async (row: EncounterRow) => {
    setChoosing(true);
    try {
      await encounter(kernel.transport, row.project, {action: "start"});
      await encounter(kernel.transport, row.project, {action: "read", agent_session: row.ref, after: 0, limit: 1});
      const value={ref: row.ref, project: row.project, space: row.space};
      learnTitles([row]);
      onAccompanying(value);
      if(!curation.conversationInCentre&&offered.some(entry=>entry.id==="Chat"))select("Chat");
    } catch (e) {
      if(onError)onError(String(e));else console.error(e);
    } finally {setChoosing(false);}
  };
  const choosePreparedRef=useRef(choose);choosePreparedRef.current=choose;
  useEffect(()=>{
    const take=(event:Event)=>{
      const row=(event as CustomEvent<EncounterRow>).detail;
      if(!row||typeof row.project!=="string"||typeof row.ref!=="string"||!row.ref.startsWith("agent-session/")||typeof row.space!=="string"||!row.space.startsWith("session-space/"))return;
      void choosePreparedRef.current(row);
    };
    window.addEventListener("oi:agent-session-prepared",take);
    return()=>window.removeEventListener("oi:agent-session-prepared",take);
  },[]);

  // --- who: the roster, the chosen agent, the presence ----------------------
  const scopeKey=project??"";
  const [chosenRefs,setChosenRefs]=useState<Record<string,string>>(readChosen);
  const chosenRef=chosenRefs[scopeKey];
  // Read the roster only once it is needed: the Agents tab, the avatar menu,
  // or a chosen agent to name.
  const [rosterWanted,setRosterWanted]=useState(false);
  useEffect(()=>{if(plane==="Agents"||chosenRef)setRosterWanted(true);},[plane,chosenRef]);
  const roster=useAgentRoster(project,rosterWanted);
  // The roster is read again whenever the Agents tab is chosen: new agents
  // created elsewhere (Agency, another window) appear without a restart.
  const reread=roster.retry;
  useEffect(()=>{if(plane==="Agents"&&rosterWanted)reread();},[plane,reread,rosterWanted]);
  const chooseAgent=(agent:RosterAgent)=>setChosenRefs(held=>{const next={...held,[scopeKey]:agent.ref};try{localStorage.setItem(CHOSEN_KEY,JSON.stringify(next));}catch{/* per-viewer convenience */}return next;});
  const chosen=roster.agents.find(agent=>agent.ref===chosenRef);
  const naraChosen=lens.on&&(preferredBodyRef===EPI_PRIME_QL_BODY_REF);
  const identity=useAgentIdentity(curation.agent,!chosen);
  const agent:PanelAgent=naraChosen&&!chosen?{name:"Nara"}:chosen?{name:chosen.name,ref:chosen.ref,purpose:chosen.purpose}:{name:identity.state==="read"?identity.name:curation.agent,image:identity.image,ref:undefined};
  const status=sessionState?.status;
  const permissionsPending=!!sessionState?.reading?.permissions?.length;
  const presence:PanelPresence=sessionState?.unreachable||status?.error?"unavailable":permissionsPending?"attention":status?.state==="TurnInFlight"||status?.state==="InterruptRequested"?"working":"idle";
  const currentMode=sessionState?.mode.reading?.mode_observation?.current_mode_id;
  const bypass=!!currentMode&&modeClass(currentMode)==="bypass";

  // --- P14: the conversation promoted to a centre tab ------------------------
  const promoted=!!accompanying&&Object.values(kernel.snapshot.surfaces).some(surface=>surface.kind==="encounter"&&surface.source_ref===accompanying.ref);

  const tabs:PanelTab[]=offered.map(entry=>({...entry,mark:entry.id==="Chat"&&permissionsPending?"attention":entry.id==="Activity"&&plane!=="Activity"&&tape.rows.length>seenRows&&seenRows>0?"dot":undefined}));
  const nav=visiting&&!offered.some(entry=>entry.id===visiting)?[...tabs,{id:visiting,label:visiting}]:tabs;
  const extraBody=extraPlanes?.find(extra=>extra.id===plane&&curation.extra.includes(extra.id))?.body;

  const Preview=import.meta.env.DEV?ChatPreviewDev:null;
  if(preview&&Preview)return <section className="agent-layer" aria-label="Accompanying agent" data-full={full} data-mode={mode} data-face="preview">
    <Suspense fallback={null}><Preview onClose={()=>setPreview(false)}/></Suspense>
  </section>;

  const lastSeen=sessionState?.reconnecting?.lastSeenAt;
  return <section ref={host} className="agent-layer" aria-label="Accompanying agent" data-full={full} data-mode={mode} data-plane={plane} data-presence={presence} data-agent-session-ref={expression.agentSessionRef} data-owner-state={expression.state} data-owner-activity-block={expression.latestOwnerActivity?.blockId}>
    <PanelTop tabs={nav} current={plane} onSelect={id=>{setDetail(undefined);if(id==="Activity"&&plane!=="Activity")setFollowToken(token=>token+1);select(id);}} full={full} onFull={onFull} onCollapse={onCollapse}
      avatar={<AvatarMenu onOpen={()=>setRosterWanted(true)} agent={agent} presence={presence} bypass={bypass} roster={roster} lens={lens.on} chosenRef={chosenRef} onChoose={chooseAgent} naraChosen={naraChosen}
        onChooseNara={lens.on?()=>setChosenRefs(held=>{const next={...held};delete next[scopeKey];try{localStorage.setItem(CHOSEN_KEY,JSON.stringify(next));}catch{/* convenience */}return next;}):undefined}/>}/>
    {lastSeen!==undefined&&<p className="panel-line" role="status" data-line="reconnecting">Reconnecting — last seen {Math.max(1,Math.round((Date.now()-lastSeen)/1000))}s ago. Your draft is kept.</p>}
    {sessionState?.unreachable&&<p className="panel-line" role="status" data-line="unreachable">Agents aren&apos;t reachable here right now. Your files, flows and this draft still work here.</p>}
    {bypass&&plane==="Chat"&&!promoted&&<p className="panel-line panel-bypass" role="status" data-line="bypass">Bypass permissions is on for this session: {agent.name} acts without asking. <button type="button" className="oi-action" onClick={()=>{const ask=sessionState?.mode.reading?.mode_observation?.available_modes.find(option=>modeClass(option.id)==="ask");if(ask&&session)void session.actions.selectMode(ask.id);}}>Back to Ask</button></p>}
    <div className="agent-body">
      {detail&&<div className="panel-detail" data-detail-kind={detail.kind} data-escape-layer="true"><ObjectPage object={detail} onBack={()=>setDetail(undefined)}/></div>}
      {KEPT_PLANES.map(name=>{
        if(!visited.current.has(name)||(name!==plane&&!offered.some(entry=>entry.id===name)))return null;
        const hidden=plane!==name||!!detail;
        return <div key={name} className="agent-plane-host" hidden={hidden} style={hidden?{display:"none"}:undefined}>
          {name==="Chat"&&accompanying&&!promoted&&!curation.conversationInCentre&&onOpenConversation&&<button type="button" className="oi-tool panel-promote" aria-label="Open the conversation in the centre" title="Open in the centre" onClick={()=>onOpenConversation(accompanying)}><Glyph name="detach" size={13}/></button>}
          {name==="Chat"&&(promoted&&accompanying
            ?<p className="panel-promoted" data-line="promoted"><span>Open in the centre</span> — <button type="button" className="oi-action" onClick={()=>onBringBack?.(accompanying)}>Bring back</button></p>
            :<AgentChat variant="plane" session={session} accompanying={accompanying} project={project??accompanying?.project} agentName={agent.name} situating="" sessionTitle={accompanying?titles[accompanying.ref]:undefined} choosing={choosing}
            subject={{title:subject.title,location:subject.location}} resolveSurface={resolveSurface} onMessage={onError??(message=>console.error(message))}
            tape={tape} onOpenActivity={offered.some(entry=>entry.id==="Activity")?openActivity:undefined} connectionFacts={connectionFacts} onArtifact={path=>void openArtifact(path)}
            onNewChat={()=>onAccompanying(undefined)} onChoose={choose}
            onProvision={async provisionProject=>{
              const provisioned=await encounterProvision(kernel.transport,provisionProject,preferredBodyRef);
              const value={ref:provisioned.agent_session,project:provisionProject,space:provisioned.space};
              learnTitles([{ref:provisioned.agent_session,project:provisionProject,space:provisioned.space,title:provisioned.space}]);
              onAccompanying(value);
              if(offered.some(entry=>entry.id==="Chat"))select("Chat");
            }}/>)}
          {name==="Activity"&&<ActivityTab key={accompanying?.ref??"none"} session={session} tape={tape} reading={journal} focus={focus} followToken={followToken} onChat={offered.some(entry=>entry.id==="Chat")?()=>select("Chat"):undefined}/>}
          {name==="Agents"&&<AgentsTab roster={roster} boundRef={chosen?.ref} boundPresence={accompanying?presence:undefined} onMessage={agentChosen=>{chooseAgent(agentChosen);select(offered.some(entry=>entry.id==="Chat")?"Chat":plane);}}/>}
        </div>;
      })}
      {plane==="Composition"&&!detail&&<Suspense fallback={null}><ExpressionView key={compositionRef??"expression-composition"} initialExpressionRef={compositionRef??(subject.ref?.startsWith("expression:")?subject.ref:undefined)}/></Suspense>}
      {extraBody!==undefined&&!detail&&<div key={`extra:${plane}`} className="agent-plane-host agent-extra-plane" data-extra-plane={plane}>{extraBody}</div>}
    </div>
  </section>;
}
