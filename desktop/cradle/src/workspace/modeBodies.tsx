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
import type {TaPaneOpens} from "../expressions/TaOntaSide";
import {ContextCanvas} from "../agent/panel/ContextCanvas";
import {PreparedContextView} from "../context/PreparedContextView";
import {SituationView} from "../context/SituationView";

/** What a mode plane is told about the active centre subject. */
export interface PanelSubject { ref?: string; kind?: string; title: string; project?: string; location?: CentralLocation }

const ExpressionGraphNavigator = lazy(() => import("../expressions/ExpressionGraphNavigator").then(module => ({default: module.ExpressionGraphNavigator})));
const MaterialNavigator = lazy(() => import("../techne/MaterialNavigator").then(module => ({default: module.MaterialNavigator})));
const WikiMapNavigator = lazy(() => import("../techne/WikiMapNavigator").then(module => ({default: module.WikiMapNavigator})));
const EpiPlacesNavigator = lazy(() => import("../epilogos/EpiPlacesNavigator").then(module => ({default: module.EpiPlacesNavigator})));
const SettingsNavigator = lazy(() => import("./settings/SettingsNavigator").then(module => ({default: module.SettingsNavigator})));
/** The Factory desk (FACTORY-UI-INTEGRATION-HANDOFF §4/§9). Each plane reads
 * the ONE shared session observer through the accompanying binding — never a
 * second transcript, never its own polling. The #373 desk planes' functions
 * moved into the three top-level tabs: trajectory into Run, skills & tools
 * into Agents, claims/results into Run and Context (inspect stays an action). */
export interface PanelAccompanying { ref: string; project: string; space: string }
const FactoryRunTab = lazy(() => import("../contributions/factory/sidebar/FactoryRunTab").then(module => ({default: module.FactoryRunTab})));
const FactoryContextSlice = lazy(() => import("../contributions/factory/sidebar/FactoryContextSlice").then(module => ({default: module.FactoryContextSlice})));

/** The left body for a mode whose curation does not use the World navigator. */
export function ModeLeftBody({mode, project, onOpenExpressions, onOpenTechne, onOpenPlace, onOpenFile, onOpenWiki, onMessage}: {
  mode: WorkspaceMode;
  project?: string;
  onOpenExpressions: (expressionRef?: string) => void;
  onOpenTechne?: () => void;
  onOpenPlace: (place: {family: string; ref: string; title: string}) => void;
  onOpenFile: (location: CentralLocation) => Promise<void> | void;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
}) {
  return <Suspense fallback={null}>
    {mode === "expressions"
      ? <ExpressionGraphNavigator onOpenExpressions={onOpenExpressions} onOpenTechne={onOpenTechne} onMessage={onMessage}/>
      : mode === "epi-logos" ? <EpiPlacesNavigator onOpenPlace={onOpenPlace} onMessage={onMessage}/>
      : mode === "techne" ? <WikiMapNavigator project={project} onOpenWiki={onOpenWiki} onMessage={onMessage}/>
      : mode === "settings" ? <SettingsNavigator/>
      : <MaterialNavigator project={project} onOpenFile={onOpenFile} onMessage={onMessage}/>}
  </Suspense>;
}

/** The shared Context mount: the panel's own pane canvas plus the
 * persistent Active Context lanes — the same component in Factory,
 * Expressions and Technè. Central (base) uses prepared context alone. */
export function ContextPaneMount({opens,dataPlane="context",project,session}:{opens?:TaPaneOpens;dataPlane?:string;project?:string;session?:string}) {
  return <ContextCanvas opens={opens} dataPlane={dataPlane} project={project} session={session}/>;
}

/** Central mode's Context: present situation, then the native prepared-context
 * system the centre canvas already uses for highlighting and saving
 * selections — not a second pane-insertion surface. */
export function PreparedContextMount({project,session}:{project?:string;session?:string}) {
  return <><SituationView/><PreparedContextView project={project} session={session}/></>;
}

/** The extra planes a mode contributes to the common panel. The panel shows
 * those its curation names, in the curation's order. `host` lends the real
 * app-level ways a Factory control reaches the rest of the shell; `opens`
 * lends the centre canvas's own pane openings to the Ta-Onta Context. */
export function modeExtraPlanes(mode: WorkspaceMode, subject: PanelSubject, accompanying?: PanelAccompanying, _onMessage?: (message: string) => void, _host?: FactoryPanelHost, _full?: boolean, opens?: TaPaneOpens, project?: string): {id: string; label: string; body: ReactNode}[] {
  // 10-SIDEBARS §4.2/§4.6: Chat · Activity · Agents are the panel's own; the
  // mode supplies only its Context.
  const scopeProject = project ?? accompanying?.project ?? subject.project;
  const session = accompanying?.ref;
  if (mode === "base" || mode === "epi-logos") {
    return [{id: "context", label: "Context", body: <PreparedContextMount project={scopeProject} session={session}/>}];
  }
  const context = (id: string) => ({id, label: "Context", body: <ContextPaneMount opens={opens} dataPlane={id} project={scopeProject} session={session}/>});
  if (mode === "factory") return [
    {id: "run", label: "Run", body: <Suspense fallback={null}><FactoryRunTab accompanying={accompanying}/></Suspense>},
    // Owner direction 2026-09-20: the Context plane IS the canvas — the same
    // plane body the Ta-Onta modes mount, nothing mounted beneath it. The
    // former Needs-you/Sources/Produced stack under the canvas is unmounted.
    // §5: Factory's Context is the preserved canvas; with nothing inserted its
    // empty state also offers Factory's slice (Intent, run material, NOW).
    // The canvas and Factory's slice stack in one column: the canvas grows
    // with what it holds and the slice follows it (never drawn over it).
    {id: "context", label: "Context", body: <Suspense fallback={null}><div className="factory-context-stack"><ContextPaneMount opens={opens} dataPlane="context" project={scopeProject} session={session}/>{!opens?.sideTabs?.length && <FactoryContextSlice/>}</div></Suspense>},
  ];
  // Expressions (Anima) and Technè (Aletheia): the same one panel; their
  // Context is the canvas under its Ta-Onta id.
  if (mode === "expressions" || mode === "techne") return [context("context")];
  return [];
}
