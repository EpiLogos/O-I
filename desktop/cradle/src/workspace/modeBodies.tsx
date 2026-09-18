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

/** What a mode plane is told about the active centre subject. */
export interface PanelSubject { ref?: string; kind?: string; title: string; project?: string }

const ExpressionGraphNavigator = lazy(() => import("../expressions/ExpressionGraphNavigator").then(module => ({default: module.ExpressionGraphNavigator})));
const MaterialNavigator = lazy(() => import("../techne/MaterialNavigator").then(module => ({default: module.MaterialNavigator})));
const WikiMapNavigator = lazy(() => import("../techne/WikiMapNavigator").then(module => ({default: module.WikiMapNavigator})));
const EpiPlacesNavigator = lazy(() => import("../epilogos/EpiPlacesNavigator").then(module => ({default: module.EpiPlacesNavigator})));
const TaOntaPlane = lazy(() => import("../expressions/AnimaPlanes").then(module => ({default: module.TaOntaPlane})));
const AnimaPlane = lazy(() => import("../expressions/AnimaPlanes").then(module => ({default: module.AnimaPlane})));
const EpiiPlane = lazy(() => import("../techne/EpiiPlane").then(module => ({default: module.EpiiPlane})));
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
export function ModeLeftBody({mode, project, onOpenExpressions, onOpenPlace, onOpenFile, onOpenWiki, onMessage}: {
  mode: WorkspaceMode;
  project?: string;
  onOpenExpressions: (expressionRef?: string) => void;
  onOpenPlace: (place: {family: string; ref: string; title: string}) => void;
  onOpenFile: (location: CentralLocation) => Promise<void> | void;
  onOpenWiki: (ref: string, title: string, project?: string) => void;
  onMessage: (message: string) => void;
}) {
  return <Suspense fallback={null}>
    {mode === "expressions"
      ? <ExpressionGraphNavigator onOpenExpressions={onOpenExpressions} onMessage={onMessage}/>
      : mode === "epi-logos" ? <EpiPlacesNavigator onOpenPlace={onOpenPlace} onMessage={onMessage}/>
      : mode === "techne" ? <WikiMapNavigator project={project} onOpenWiki={onOpenWiki} onMessage={onMessage}/>
      : <MaterialNavigator project={project} onOpenFile={onOpenFile} onMessage={onMessage}/>}
  </Suspense>;
}

/** The extra planes a mode contributes to the common panel. The panel shows
 * those its curation names, in the curation's order. `host` lends the real
 * app-level ways a Factory control reaches the rest of the shell. */
export function modeExtraPlanes(mode: WorkspaceMode, subject: PanelSubject, accompanying?: PanelAccompanying, onMessage?: (message: string) => void, host?: FactoryPanelHost): {id: string; label: string; body: ReactNode}[] {
  if (mode === "factory") return [
    {id: "run", label: "Run", body: <Suspense fallback={null}><RunPlane subject={subject} accompanying={accompanying} onMessage={onMessage} host={host}/></Suspense>},
    {id: "agents", label: "Agents", body: <Suspense fallback={null}><AgentsPlane subject={subject} accompanying={accompanying} onMessage={onMessage} host={host}/></Suspense>},
    {id: "factory-context", label: "Context", body: <Suspense fallback={null}><ContextPlane subject={subject} accompanying={accompanying} onMessage={onMessage} host={host}/></Suspense>},
  ];
  // Nara/Anima is the personal encounter, Epii the deep inquiry — the same
  // companion components, curated to the Epi-Logos world.
  if (mode === "epi-logos") return [
    {id: "anima", label: "Nara · Anima", body: <Suspense fallback={null}><AnimaPlane subject={subject}/></Suspense>},
    {id: "epii", label: "Epii", body: <Suspense fallback={null}><EpiiPlane subject={subject}/></Suspense>},
  ];
  if (mode === "expressions") return [
    {id: "ta-onta", label: "Ta-Onta", body: <Suspense fallback={null}><TaOntaPlane subject={subject}/></Suspense>},
    {id: "anima", label: "Anima", body: <Suspense fallback={null}><AnimaPlane subject={subject}/></Suspense>},
  ];
  if (mode === "techne") return [
    {id: "epii", label: "Epii", body: <Suspense fallback={null}><EpiiPlane subject={subject}/></Suspense>},
  ];
  return [];
}
