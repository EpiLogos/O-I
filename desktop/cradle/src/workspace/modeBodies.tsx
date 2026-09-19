/**
 * The mode-specific bodies the composition root places into the shell's
 * existing regions (workspace/mode.ts): the left body of the Expressions and
 * Technè modes, and the extra planes those modes add to the common right
 * panel. Each loads with its mode — base mode never pays for them.
 */
import {lazy, Suspense, type ReactNode} from "react";
import type {CentralLocation} from "../kernel/types";
import type {WorkspaceMode} from "./mode";
import type {FactoryPanelHost} from "../contributions/factory/sidebar/sidebarModel";
import {ActiveContext} from "../expressions/ActiveContext";
import type {TaPaneOpens} from "../expressions/TaOntaSide";

/** What a mode plane is told about the active centre subject. */
export interface PanelSubject { ref?: string; kind?: string; title: string; project?: string; location?: CentralLocation }

const ExpressionGraphNavigator = lazy(() => import("../expressions/ExpressionGraphNavigator").then(module => ({default: module.ExpressionGraphNavigator})));
const MaterialNavigator = lazy(() => import("../techne/MaterialNavigator").then(module => ({default: module.MaterialNavigator})));
const EpiPlacesNavigator = lazy(() => import("../epilogos/EpiPlacesNavigator").then(module => ({default: module.EpiPlacesNavigator})));
const AnimaPlane = lazy(() => import("../expressions/AnimaPlanes").then(module => ({default: module.AnimaPlane})));
const EpiiPlane = lazy(() => import("../techne/EpiiPlane").then(module => ({default: module.EpiiPlane})));
/** The Ta-Onta side planes (owner direction 2026-09-18, second pass): the
 * Factory Run/Agents/Context pattern with the Ta-Onta specifics in the
 * content — the offices and guardians as the agents roster, Factory's own
 * RunPlane for the run log/track, and a Context that holds real panes. See
 * expressions/TaOntaSide.tsx. */
const TaOntaAgentsPlane = lazy(() => import("../expressions/TaOntaSide").then(module => ({default: module.TaOntaAgentsPlane})));
const TaOntaContextPlane = lazy(() => import("../expressions/TaOntaSide").then(module => ({default: module.TaOntaContextPlane})));
/** The Factory desk (FACTORY-UI-INTEGRATION-HANDOFF §4/§9). Each plane reads
 * the ONE shared session observer through the accompanying binding — never a
 * second transcript, never its own polling. The #373 desk planes' functions
 * moved into the three top-level tabs: trajectory into Run, skills & tools
 * into Agents, claims/results into Run and Context (inspect stays an action). */
export interface PanelAccompanying { ref: string; project: string; space: string }
const RunPlane = lazy(() => import("../contributions/factory/sidebar/RunPlane").then(module => ({default: module.RunPlane})));
const AgentsPlane = lazy(() => import("../contributions/factory/sidebar/AgentsPlane").then(module => ({default: module.AgentsPlane})));
const ContextPlane = lazy(() => import("../contributions/factory/sidebar/ContextPlane").then(module => ({default: module.ContextPlane})));

/** The left body for a mode whose curation does not use the World navigator. */
export function ModeLeftBody({mode, project, onOpenExpressions, onOpenTechne, onOpenPlace, onOpenFile, onMessage}: {
  mode: WorkspaceMode;
  project?: string;
  onOpenExpressions: (expressionRef?: string) => void;
  onOpenTechne?: () => void;
  onOpenPlace: (place: {family: string; ref: string; title: string}) => void;
  onOpenFile: (location: CentralLocation) => Promise<void> | void;
  onMessage: (message: string) => void;
}) {
  return <Suspense fallback={null}>
    {mode === "expressions"
      ? <ExpressionGraphNavigator onOpenExpressions={onOpenExpressions} onOpenTechne={onOpenTechne} onMessage={onMessage}/>
      : mode === "epi-logos" ? <EpiPlacesNavigator onOpenPlace={onOpenPlace} onMessage={onMessage}/>
      : mode === "techne" ? <ExpressionGraphNavigator onOpenExpressions={onOpenExpressions} onOpenTechne={onOpenTechne} onMessage={onMessage}/>
      : <MaterialNavigator project={project} onOpenFile={onOpenFile} onMessage={onMessage}/>}
  </Suspense>;
}

/** The shared Context mount: the panel's own pane canvas plus the
 * persistent Active Context lanes — the same component in Factory,
 * Expressions and Technè. */
export function ContextPaneMount({opens}:{opens?:TaPaneOpens}) {
  return <>
    {opens?.sideHost??<p className="oi-empty">The pane host is not wired for this mode yet.</p>}
    <ActiveContext tabs={opens?.sideTabs} onActivate={opens?.activateTab}/>
  </>;
}

/** The extra planes a mode contributes to the common panel. The panel shows
 * those its curation names, in the curation's order. `host` lends the real
 * app-level ways a Factory control reaches the rest of the shell; `opens`
 * lends the centre canvas's own pane openings to the Ta-Onta Context. */
export function modeExtraPlanes(mode: WorkspaceMode, subject: PanelSubject, accompanying?: PanelAccompanying, onMessage?: (message: string) => void, host?: FactoryPanelHost, full?: boolean, opens?: TaPaneOpens): {id: string; label: string; body: ReactNode}[] {
  // Central (owner direction 2026-09-19): the panel's core shape matches the
  // other modes — Run and Agents are the shared planes (the same run
  // log/track; the roster with the real project conversations, opened the
  // ordinary way). No Factory host chrome rides along — no Expand, no Full
  // run, no plane switching, no dev scenario bar. Context is NOT supplied
  // here: it stays the panel's own doc-forward plane, curated in the mode.
  if (mode === "base") return [
    {id: "run", label: "Run", body: <Suspense fallback={null}><RunPlane subject={subject} accompanying={accompanying} onMessage={onMessage} full={full} withScenarioBar={false}/></Suspense>},
    {id: "agents", label: "Agents", body: <Suspense fallback={null}><AgentsPlane subject={subject} accompanying={accompanying} onMessage={onMessage} withScenarioBar={false} host={host ? {onOpenEncounterRow: host.onOpenEncounterRow} : undefined}/></Suspense>},
  ];
  if (mode === "factory") return [
    {id: "run", label: "Run", body: <Suspense fallback={null}><RunPlane subject={subject} accompanying={accompanying} onMessage={onMessage} host={host} full={full}/></Suspense>},
    {id: "agents", label: "Agents", body: <Suspense fallback={null}><AgentsPlane subject={subject} accompanying={accompanying} onMessage={onMessage} host={host}/></Suspense>},
    {id: "factory-context", label: "Context", body: <Suspense fallback={null}><div className="ta-context-plane"><ContextPaneMount opens={opens}/><ContextPlane subject={subject} accompanying={accompanying} onMessage={onMessage} host={host}/></div></Suspense>},
  ];
  // Nara/Anima is the personal encounter, Epii the deep inquiry — the same
  // companion components, curated to the Epi-Logos world.
  if (mode === "epi-logos") return [
    {id: "anima", label: "Nara · Anima", body: <Suspense fallback={null}><AnimaPlane subject={subject}/></Suspense>},
    {id: "epii", label: "Epii", body: <Suspense fallback={null}><EpiiPlane subject={subject}/></Suspense>},
  ];
  // Expressions (Anima, S4') and Technè (Aletheia, S5') share one panel
  // shape: Factory's RunPlane passes the bound agent's run through the same
  // run log/track; Agents reads the Ta-Onta offices and the guardians;
  // Context holds real panes and the wiki/file contexts.
  if (mode === "expressions" || mode === "techne") return [
    {id: "ta-run", label: "Run", body: <Suspense fallback={null}><RunPlane subject={subject} accompanying={accompanying} onMessage={onMessage} full={full} withScenarioBar={false}/></Suspense>},
    {id: "ta-onta-agents", label: "Agents", body: <Suspense fallback={null}><TaOntaAgentsPlane subject={subject} agent={mode === "expressions" ? "Anima" : "Aletheia"}/></Suspense>},
    {id: "ta-onta-context", label: "Context", body: <Suspense fallback={null}><TaOntaContextPlane subject={subject} opens={opens}/></Suspense>},
  ];
  return [];
}
