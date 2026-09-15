import {createPortal} from "react-dom";
import {advanceCompletion} from "./expressionReading";
import {useEffect,useRef,useState, type ReactNode} from "react";
import {useKernel} from "../kernel/KernelProvider";
import {Glyph} from "../workspace/Glyph";
import {EncounterList, type EncounterRow} from "../encounter/EncounterList";

import type {FormName} from "@epilogos/oi-design-system/expression";
import {EncounterSurface,type EncounterExpressionReading} from "../encounter/EncounterSurface";
import {ExpressionView} from "../expression/ExpressionView";
import {EXPRESSION_COMPOSE_EVENT} from "../expression/summon";
import {encounter} from "../encounter/client";
import type {SurfaceBinding} from "../surface/types";
import type {CentralLocation} from "../kernel/types";
import "./agent.css";

/**
 * FND-02 — the person's own accompanying agent. This is never a subject
 * inspector (REORIENTATION-HANDOFF §Binding owner corrections, D9): it is
 * one native encounter (AIKit-owned transcript/draft/CAS) presented in the
 * `side`/`full` shape, plus a Context plane that follows the active canvas
 * subject's real read model. No desktop session store, no fake transcript.
 */

export type EncounterPlane = "Conversation" | "Activity" | "Context" | "Inspect";
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

const KIND_GLYPH: Record<string, "chat" | "wiki" | "file" | "field" | "search"> = {
  encounter: "chat",
  knowledge: "wiki",
  file: "file",
  source: "file",
  sources: "file",
  explore: "search",
  presentation: "field",
};

const KIND_OWNER: Record<string, string> = {
  encounter: "AIKit",
  observatory: "AIKit",
  factory: "Factory",
  agents: "Central",
  knowledge: "AIKit",
  explore: "Shared Field",
  presentation: "Shared Field",
};

export function AgentLayer({project, subject, history, historyAvailable, accompanying, onAccompanying, full, onFull, onClose, region = "right",complementaryHost,onReturnConversation,onOpenWorkingSurface}: {
  project?: string;
  subject: AgentSubject;
  history?: ReactNode;
  historyAvailable: boolean;
  accompanying?: AgentAccompanying;
  onAccompanying: (value: AgentAccompanying) => void;
  region?: "right" | "centre";
  complementaryHost?:HTMLElement|null;
  onReturnConversation?:()=>void;
  onOpenWorkingSurface?:(selection:import("../encounter/working-surface").WorkingSurfaceSelection)=>Promise<void>;
  full: boolean;
  onFull: () => void;
  onClose: () => void;
}) {
  const kernel = useKernel();
  const [detailHost,setDetailHost]=useState<HTMLDivElement|null>(null);
  const [plane, setPlane] = useState<EncounterPlane>("Conversation");
  const [error, setError] = useState<string>();
  const [expression,setExpression]=useState<EncounterExpressionReading>({pending:false});
  const [compositionRef,setCompositionRef]=useState<string>();
  const [compositionOpen,setCompositionOpen]=useState(false);
  const [listening,setListening]=useState(false);
  const [arrived,setArrived]=useState(false);
  const [choosing,setChoosing]=useState(false);
  const [inputArrived,setInputArrived]=useState(false);
  const inputRevision=useRef<number>();
  const completion=useRef<number>();
  const arrivalTimer=useRef<ReturnType<typeof setTimeout>>();
  useEffect(()=>()=>clearTimeout(arrivalTimer.current),[]);
  const accompanyingIdentity=accompanying?JSON.stringify([accompanying.project,accompanying.ref,accompanying.space]):undefined;
  useEffect(()=>{clearTimeout(arrivalTimer.current);completion.current=undefined;inputRevision.current=undefined;setInputArrived(false);setExpression({pending:false});setArrived(false);setListening(false);},[accompanyingIdentity]);
  useEffect(()=>{
    const next=advanceCompletion(completion.current,expression.completed);
    completion.current=next.highWater;
    if(!next.arrived)return;
    clearTimeout(arrivalTimer.current);setArrived(true);
    arrivalTimer.current=setTimeout(()=>setArrived(false),1200);
  },[expression.completed]);
  useEffect(()=>{
    const prior=inputRevision.current;inputRevision.current=expression.inputRevision;
    if(prior===undefined||expression.inputRevision===undefined||expression.inputRevision===prior)return;
    setInputArrived(true);const timer=setTimeout(()=>setInputArrived(false),1200);return()=>clearTimeout(timer);
  },[expression.inputRevision]);
  useEffect(()=>{if(plane!=="Conversation")setListening(false);},[plane]);
  useEffect(()=>{const summon=(event:Event)=>{const ref=(event as CustomEvent<{expressionRef?:string}>).detail?.expressionRef;if(ref!==undefined&&!ref.startsWith("expression:"))return;if(ref)setCompositionRef(ref);setCompositionOpen(true);setPlane("Inspect");if(!full)onFull();};window.addEventListener(EXPRESSION_COMPOSE_EVENT,summon);return()=>window.removeEventListener(EXPRESSION_COMPOSE_EVENT,summon);},[full,onFull]);
  const form:FormName=expression.state==="TurnInFlight"||expression.state==="InterruptRequested"?"searching":arrived?"arrival":listening||inputArrived?"listening":expression.pending||choosing?"presence":"idle";


  const choose = async (row: EncounterRow) => {
    setError(undefined);setChoosing(true);
    try {
      // The same start/read pair every encounter open uses (Cradle.openEncounter) —
      // no new desktop-owned launch path.
      await encounter(kernel.transport, row.project, {action: "start"});
      await encounter(kernel.transport, row.project, {action: "read", agent_session: row.ref, after: 0, limit: 1});
      onAccompanying({ref: row.ref, project: row.project, space: row.space});
      setPlane("Conversation");
    } catch (e) { setError(String(e)); } finally {setChoosing(false);}
  };

  const binding: SurfaceBinding | undefined = accompanying ? {
    id: `accompanying:${accompanyingIdentity}`,
    kind: "encounter",
    ref: accompanying.ref,
    project: accompanying.project,
    title: "Accompanying agent",
    encounter: {space: accompanying.space},
  } : undefined;
  const complementary=!!complementaryHost;
  const detailPlane: "Activity" | "Context" | "Inspect" = plane==="Context"?"Context":plane==="Inspect"?"Inspect":"Activity";
  const encounterPlane: "Conversation" | "Activity" | "Inspect" = complementary||plane === "Context"||compositionOpen ? "Conversation" : plane;
  const planeNames:EncounterPlane[]=["Conversation","Activity","Context","Inspect"];
  const planes=<nav className="agent-planes" aria-label={complementary||region==="right"?"Right region planes":"Encounter planes"}>
    {planeNames.map(name=><button key={name} aria-pressed={name===(complementary?detailPlane:plane)} title={complementary&&name==="Conversation"?"Return conversation to the right":undefined} onClick={()=>{if(complementary&&name==="Conversation"){setPlane(name);onReturnConversation?.();}else {if(name==="Inspect")setCompositionOpen(false);setPlane(name);}}}>{name}</button>)}
    {(region==="right"||complementary)&&<span className="agent-plane-tools"><button className="agent-tool" aria-label={full?"Restore right region":"Full right region"} onClick={onFull}><Glyph name={full?"restore":"expand"}/></button><button className="agent-tool" aria-label="Collapse right region" onClick={onClose}><Glyph name="close"/></button></span>}
  </nav>;

  return <section className="agent-layer" aria-label="Accompanying agent" data-full={full} data-expression={form} data-agent-session-ref={expression.agentSessionRef} data-owner-state={expression.state} data-owner-activity-block={expression.latestOwnerActivity?.blockId} onFocusCapture={event=>{if((event.target as Element).matches(".encounter-composer textarea"))setListening(true);}} onBlurCapture={event=>{if((event.target as Element).matches(".encounter-composer textarea"))setListening(false);}}>
    {!complementary&&planes}
    {complementaryHost&&createPortal(<section className="agent-layer agent-complementary" aria-label="Conversation details">{planes}<div className="agent-body">{detailPlane==="Context"&&<ContextPlane subject={subject} history={history} historyAvailable={historyAvailable} accompanying={accompanying}/>}<div ref={setDetailHost} className="agent-detail-host"/></div></section>,complementaryHost)}
    <div className="agent-body">
      {error && <p role="alert">{error}</p>}
      {/* The visible head still reads this same encounter while Context is open.
          Keep its one observer mounted; hide only its body, never duplicate it. */}
      {binding
        ? <EncounterSurface onOpenWorkingSurface={onOpenWorkingSurface} key={binding.id} binding={{...binding, view: {encounterPlane}}} onView={view => {setCompositionOpen(false);setPlane(view.encounterPlane ?? "Conversation");}} onExpression={setExpression} complementary={complementary&&detailHost?{host:detailHost,plane:detailPlane}:undefined} concealed={!complementary&&(plane==="Context"||compositionOpen)} presentation={region === "centre" || full ? "full" : "side"}/>
        : plane!=="Context"&&!compositionOpen ? <NoAccompanying project={project} onOpen={choose}/> : null}
      {!complementary&&compositionOpen&&<ExpressionView key={compositionRef??"expression-composition"} initialExpressionRef={compositionRef??(subject.ref?.startsWith("expression:")?subject.ref:undefined)}/>}
      {!complementary&&plane==="Context"&&<ContextPlane subject={subject} history={history} historyAvailable={historyAvailable} accompanying={accompanying}/>}
    </div>
  </section>;
}

/** Honest absence (D10): the project's real attached encounters, no auto
 * launch, no fake session. Once chosen, EncounterSurface's own connect flow
 * discloses the real provider list. */
function NoAccompanying({project, onOpen}: {project?: string; onOpen: (row: EncounterRow) => Promise<void>}) {
  if (!project) return <div className="agent-empty"><p>Select a project to bring its conversations here.</p></div>;
  return <div className="agent-empty">
    <p>No accompanying agent yet. Choose a conversation attached to this project.</p>
    <EncounterList project={project} onOpen={onOpen}/>
  </div>;
}

/** D5/D9 — the Context plane follows the active canvas subject, never a
 * previous subject's rows (keyed by ref) and never a stand-in for it. */
function ContextPlane({subject, history, historyAvailable, accompanying}: {
  subject: AgentSubject; history?: ReactNode; historyAvailable: boolean; accompanying?: AgentAccompanying;
}) {
  const glyph = KIND_GLYPH[subject.kind ?? ""] ?? "file";
  const owner = KIND_OWNER[subject.kind ?? ""] ?? "Central";
  return <div className="agent-context" key={subject.ref ?? "none"}>
    <p className="agent-eyebrow">Current subject · Follows selection</p>
    {subject.ref ? <>
      <div className="agent-subject">
        <span className="agent-subject-icon"><Glyph name={glyph} size={16}/></span>
        <div><strong>{subject.title}</strong><span>{subject.kind ?? "surface"}{subject.project ? ` · ${subject.project}` : ""}</span></div>
      </div>
      <dl>
        <dt>Project</dt><dd>{subject.project ?? "Not attached to a project"}</dd>
        <dt>Revision</dt><dd>{subject.revision ? subject.revision.slice(0, 10) : "Unknown"}</dd>
        <dt>State</dt><dd>{subject.dirty===true?"Unsaved changes":subject.dirty===false?"Saved":"Not disclosed"}</dd>
        <dt>Owner</dt><dd>{owner}</dd>
      </dl>
      {historyAvailable
        ? <details className="agent-section"><summary>History</summary>{history}</details>
        : <p className="agent-note">No history operation is available for this subject.</p>}
    </> : <p className="agent-note">Select a surface to inspect its context.</p>}
    {accompanying && <div className="agent-section">
      <h3>Selected session</h3>
      <dl>
        <dt>Project</dt><dd>{accompanying.project}</dd>
        <dt>AgentSession</dt><dd>{accompanying.ref}</dd>
        <dt>SessionSpace</dt><dd>{accompanying.space}</dd>
        <dt>Context disclosure</dt><dd>Not disclosed by the current session reading</dd>
      </dl>
    </div>}
  </div>;
}
