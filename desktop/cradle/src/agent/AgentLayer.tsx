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
import {EncounterList, type EncounterRow} from "../encounter/EncounterList";
import {expressionReadingOf,useEncounterSession} from "../encounter/session";
import {EXPRESSION_COMPOSE_EVENT} from "../expression/summon";
import {encounter,encounterProvision} from "../encounter/client";
import type {SurfaceBinding} from "../surface/types";
import type {CentralLocation} from "../kernel/types";
import {SessionHeader} from "./planes/SessionHeader";
import {PlaneNav} from "./planes/PlaneNav";
import {ActivityPlane} from "./planes/ActivityPlane";
import {ContextPlane} from "./planes/ContextPlane";
import {InspectPlane,type InspectSelection} from "./planes/InspectPlane";
import {PANEL_INSPECT_EVENT,handToPanelInspect,isPanelInspectDetail,panelInspectKey,type PanelInspectDetail} from "./planes/panelInspect";
import {AgentChat} from "./chat/AgentChat";
import {CHAT_PREVIEW_EVENT,isChatPreviewDetail} from "./chat/previewGate";
import "./agent.css";

/** The panel's two faces. `chat` is the clean conversation (agent/chat/):
 * the resting shape of EVERY mode whose conversation lives in this panel —
 * the curated companion (Agent, Anima/Nara, Epii) presents the same way.
 * `panel` is the full instrument — head, plane nav, Activity / Context /
 * Inspect / Composition and the mode's extra planes. The chat is the first
 * plane of the one strip — there is no second side to flip to. A mode whose
 * conversation lives in the centre (Factory) offers no Chat plane at all. */

/**
 * FND-02 — the person's own accompanying agent. This is never a subject
 * inspector (REORIENTATION-HANDOFF §Binding owner corrections, D9): it is
 * one native encounter (AIKit-owned transcript/draft/CAS) presented in the
 * `side`/`full` shape, with Activity, Context and Inspect planes reading that
 * same session and the active canvas subject's real read model. No desktop
 * session store, no fake transcript.
 *
 * ONE common panel, curated per workspace mode (`MODE_CURATION[mode].panel`):
 * the mode names the agent, the planes offered and the composition-root extra
 * planes shown — never a second sidebar implementation. A mode change never
 * remounts the encounter observer: the session lives in the shared store
 * (encounter/session.ts), so the draft and the session identity ride through,
 * and Factory's centre conversation tab and this panel read one observer.
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
/** A composition-root supplied plane (Ta-Onta, Anima, Epii…). */
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
  /** Default "base". Curates the agent name and the planes via MODE_CURATION. */
  mode?: WorkspaceMode;
  /** Shown when their id is in MODE_CURATION[mode].panel.extra, in that order, after the mode's own planes. */
  extraPlanes?: AgentExtraPlane[];
  /** Optional mode/world default acting body for a NEW conversation. Existing
   * sessions and explicit provider choices are never rewritten by this hint. */
  preferredBodyRef?: string;
  /** Controlled resting plane; uncontrolled fallback is the mode's first plane. */
  plane?: string;
  onPlane?: (plane: string) => void;
  /** Panel-level errors and refusals — the footer status disclosure. */
  onError?: (message: string) => void;
  /** Factory: open / focus the accompanying encounter as a centre tab. */
  onOpenConversation?: (accompanying: AgentAccompanying) => void;
  /** Inspect / Context: open the source or file subject in the centre. */
  onOpenSubject?: (subject: AgentSubject) => void;
  /** The chat face: a Workbench tab dropped on the chat carries its surface
   * id; the composition root resolves it to the binding to quote. */
  resolveSurface?: (id: string) => SurfaceBinding | undefined;
}

/** Planes that stay mounted (hidden) once visited, so expanded rows, reviewed
 * revisions, scroll position and the Inspect selection survive plane changes.
 * Chat keeps the composer's draft fields alive the same way. */
const KEPT_PLANES=["Chat","Activity","Context","Inspect"] as const;
const HANDED_LIMIT=12;

export function AgentLayer({project, subject, history, historyAvailable, accompanying, onAccompanying, full, onFull, mode="base", extraPlanes, preferredBodyRef, plane: controlledPlane, onPlane, onError, onOpenConversation, onOpenSubject, resolveSurface}: AgentLayerProps) {
  const kernel = useKernel();
  const curation = MODE_CURATION[mode].panel;
  // --- developer preview: the same components over fixture state -----------
  // Dev builds only; the module is never bundled into a production path and
  // the preview touches no session, history or context store.
  const [preview,setPreview]=useState(false);
  useEffect(()=>{
    if(!import.meta.env.DEV)return;
    const toggle=(event:Event)=>{const detail=(event as CustomEvent<unknown>).detail;if(isChatPreviewDetail(detail))setPreview(detail.open);};
    window.addEventListener(CHAT_PREVIEW_EVENT,toggle);return()=>window.removeEventListener(CHAT_PREVIEW_EVENT,toggle);
  },[]);
  // --- one strip: the planes, curated by the mode, one selection away ------
  const [compositionRef,setCompositionRef]=useState<string>();
  const [choosing,setChoosing]=useState(false);

  // --- planes: one strip, curated in the mode's own order -------------------
  // `curation.planes` interleaves built-in planes (bodies owned here) with
  // composition-root ids; a composition-root id is offered only when its body
  // was actually supplied, and takes the extra's label.
  const offered=useMemo(()=>curation.planes
    .map(id=>{
      const extra=extraPlanes?.find(candidate=>candidate.id===id);
      if(!curation.extra.includes(id))return {id,label:id};
      return extra?{id,label:extra.label}:undefined;
    })
    .filter((entry):entry is {id:string;label:string}=>!!entry),[curation,extraPlanes]);
  const [ownPlane,setOwnPlane]=useState<string>();
  /** A plane shown for this visit though the mode does not list it (a
   * summoned Composition). Choosing any listed plane ends the visit. */
  const [visiting,setVisiting]=useState<string>();
  useEffect(()=>setVisiting(undefined),[mode]);
  const requested=controlledPlane??ownPlane;
  const resting=requested&&offered.some(entry=>entry.id===requested)?requested:offered[0]?.id??"Context";
  const plane=visiting??resting;
  const select=useCallback((id:string)=>{setVisiting(undefined);setOwnPlane(id);onPlane?.(id);},[onPlane]);
  /** Show a plane: select it where the mode lists it, visit it where it does not. */
  const show=useCallback((id:string)=>{if(offered.some(entry=>entry.id===id))select(id);else setVisiting(id);},[offered,select]);
  const visited=useRef(new Set<string>());visited.current.add(plane);

  // --- the one session: shared with any centre tab showing it ---------------
  const session=useEncounterSession(accompanying?{project:accompanying.project,ref:accompanying.ref,space:accompanying.space}:undefined);
  const sessionState=session?.state;
  const expression=useMemo(()=>expressionReadingOf(sessionState),[sessionState?.status,sessionState?.reading,sessionState?.pending]);
  // The Expression summon selects Composition and goes full. A mode that does
  // not list Composition still shows it for that visit. In Expressions mode the
  // composition root focuses the centre Expressions surface instead, and in the
  // Technē cut the composition root opens the summon in the live field (the
  // imported application, the Technē composer): in BOTH those cuts the panel
  // (Anima/Epii) is never displaced and never goes full because of a summon, so
  // a single summon opens exactly once — in the centre, not also here.
  useEffect(()=>{
    if(mode==="expressions"||mode==="techne")return;
    const summon=(event:Event)=>{const ref=(event as CustomEvent<{expressionRef?:string}>).detail?.expressionRef;if(ref!==undefined&&!ref.startsWith("expression:"))return;if(ref)setCompositionRef(ref);show("Composition");if(!full)onFull();};
    window.addEventListener(EXPRESSION_COMPOSE_EVENT,summon);return()=>window.removeEventListener(EXPRESSION_COMPOSE_EVENT,summon);
  },[mode,full,onFull,show]);

  // --- Inspect: the centre → panel hand-off seam (planes/panelInspect.ts) ----
  const [handed,setHanded]=useState<PanelInspectDetail[]>([]);
  const [inspect,setInspect]=useState<InspectSelection>({view:"subject"});
  useEffect(()=>{
    const take=(event:Event)=>{
      const detail=(event as CustomEvent<unknown>).detail;
      if(!isPanelInspectDetail(detail))return;
      const key=panelInspectKey(detail);
      setHanded(list=>[detail,...list.filter(item=>panelInspectKey(item)!==key)].slice(0,HANDED_LIMIT));
      setInspect({view:"selected",handedKey:key});
      show("Inspect");
    };
    window.addEventListener(PANEL_INSPECT_EVENT,take);return()=>window.removeEventListener(PANEL_INSPECT_EVENT,take);
  },[show]);
  const dismissHanded=(key:string)=>setHanded(list=>list.filter(item=>panelInspectKey(item)!==key));

  // --- choosing a conversation: the existing start/read pair -----------------
  const [titles,setTitles]=useState<Record<string,string>>({});
  const learnTitles=useCallback((rows:EncounterRow[])=>setTitles(held=>{const next={...held};let changed=false;for(const row of rows)if(next[row.ref]!==row.title){next[row.ref]=row.title;changed=true;}return changed?next:held;}),[]);
  const choose = async (row: EncounterRow) => {
    setChoosing(true);
    try {
      // The same start/read pair every encounter open uses (Cradle.openEncounter) —
      // no new desktop-owned launch path.
      await encounter(kernel.transport, row.project, {action: "start"});
      await encounter(kernel.transport, row.project, {action: "read", agent_session: row.ref, after: 0, limit: 1});
      const value={ref: row.ref, project: row.project, space: row.space};
      learnTitles([row]);
      onAccompanying(value);
      // Factory relocates the conversation to the centre: its own surface is
      // the chat, bound through accompanying — no encounter tab to open.
      if(!curation.conversationInCentre&&offered.some(entry=>entry.id==="Chat"))select("Chat");
    } catch (e) {
      // Choosing a session is panel-level, not a plane's own material: it
      // belongs to the footer status disclosure, never an inline block.
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


  const conversation=!accompanying?undefined
    :curation.conversationInCentre?(onOpenConversation?{label:"Open the conversation in the centre",go:()=>onOpenConversation(accompanying)}:undefined)
    :undefined;
  const extraBody=extraPlanes?.find(extra=>extra.id===plane&&curation.extra.includes(extra.id))?.body;
  const nav=visiting&&!offered.some(entry=>entry.id===visiting)?[...offered,{id:visiting,label:visiting}]:offered;

  const Preview=import.meta.env.DEV?ChatPreviewDev:null;
  if(preview&&Preview)return <section className="agent-layer" aria-label="Accompanying agent" data-full={full} data-mode={mode} data-face="preview">
    <Suspense fallback={null}><Preview onClose={()=>setPreview(false)}/></Suspense>
  </section>;

  return <section className="agent-layer" aria-label="Accompanying agent" data-full={full} data-mode={mode} data-plane={plane} data-agent-session-ref={expression.agentSessionRef} data-owner-state={expression.state} data-owner-activity-block={expression.latestOwnerActivity?.blockId}>
    <SessionHeader agentName={curation.agent} situating={project ? `Situated in ${project}` : "Situated in Central"}/>
    <PlaneNav entries={nav} current={plane} onSelect={select}/>
    {/* Factory relocates the conversation to the centre: the panel offers no
        Conversation plane and never a second composer — only the way there. */}
    {curation.conversationInCentre&&accompanying&&<div className="agent-centre-conversation" data-fact="conversation-in-centre">
      <Glyph name="chat" size={12}/><span>The conversation is in the centre.</span>
    </div>}
    <div className="agent-body">
      {/* The Chat plane: the same clean conversation, one view of the strip
          among Run / Agents / Context — kept mounted (concealed) like the
          other planes so the composer's own fields survive. The observer is
          the shared session — never remounted by a plane or mode change. */}
      {KEPT_PLANES.map(name=>{
        if(!visited.current.has(name)||(name!==plane&&!offered.some(entry=>entry.id===name)))return null;
        const hidden=plane!==name;
        return <div key={name} className="agent-plane-host" hidden={hidden} style={hidden?{display:"none"}:undefined}>
          {name==="Chat"&&<AgentChat variant="plane" session={session} accompanying={accompanying} project={project??accompanying?.project} agentName={curation.agent} situating={project?`Situated in ${project}`:"Situated in Central"} sessionTitle={accompanying?titles[accompanying.ref]:undefined} choosing={choosing}
            subject={{title:subject.title,location:subject.location}} resolveSurface={resolveSurface} onMessage={onError??(message=>console.error(message))}
            onNewChat={()=>onAccompanying(undefined)} onChoose={choose}
            onProvision={async provisionProject=>{
              // New-chat first Send: provision through the kernel, then bind —
              // the same one binding the chooser sets, no chooser on the way.
              const provisioned=await encounterProvision(kernel.transport,provisionProject,preferredBodyRef);
              const value={ref:provisioned.agent_session,project:provisionProject,space:provisioned.space};
              learnTitles([{ref:provisioned.agent_session,project:provisionProject,space:provisioned.space,title:provisioned.space}]);
              onAccompanying(value);
              if(offered.some(entry=>entry.id==="Chat"))select("Chat");
            }}/>}
          {name==="Activity"&&(session?<ActivityPlane key={session.state.key} session={session} onInspect={handToPanelInspect} conversation={conversation}/>:<NoAccompanying project={project} onOpen={choose}/>)}
          {name==="Context"&&<ContextPlane subject={subject} history={history} historyAvailable={historyAvailable} accompanying={accompanying} session={session} onOpenSubject={onOpenSubject}/>}
          {name==="Inspect"&&<InspectPlane full={full} selection={inspect} onSelection={setInspect} handed={handed} onDismiss={dismissHanded} subject={subject} history={history} historyAvailable={historyAvailable} session={session} onOpenSubject={onOpenSubject}/>}
        </div>;
      })}
      {plane==="Composition"&&<Suspense fallback={null}><ExpressionView key={compositionRef??"expression-composition"} initialExpressionRef={compositionRef??(subject.ref?.startsWith("expression:")?subject.ref:undefined)}/></Suspense>}
      {extraBody!==undefined&&<div key={`extra:${plane}`} className="agent-plane-host agent-extra-plane" data-extra-plane={plane}>{extraBody}</div>}
    </div>
  </section>;
}

/** Honest absence (D10): the project's real attached encounters, no auto
 * launch, no fake session. Once chosen, EncounterSurface's own connect flow
 * discloses the real provider list. */
function NoAccompanying({project, onOpen}: {project?: string; onOpen: (row: EncounterRow) => Promise<void>}) {
  // The same truthful Agency Gateway absence line SystemPanel shows
  // (`.gateway-aperture`, workspace/SystemPanel.tsx) — no new operation,
  // just the same honest sentence wherever the person can land on it.
  const gatewayNote = <p className="agent-note oi-note">Agency Gateway attach and stream operations are not exposed here. Existing local conversations remain available; see System.</p>;
  if (!project) return <div className="agent-empty oi-empty"><p>Select a project to bring its conversations here.</p>{gatewayNote}</div>;
  return <div className="agent-empty oi-empty">
    <p>No accompanying agent yet. Choose a conversation attached to this project.</p>
    <EncounterList project={project} variant="panel" onOpen={onOpen}/>
    {gatewayNote}
  </div>;
}
