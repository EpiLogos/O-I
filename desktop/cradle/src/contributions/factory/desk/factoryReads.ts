/**
 * The Factory owner reads and acts the Desk and the Run page need, through
 * the kernel's `factory_owner` request family and the existing development
 * reads (11-FACTORY §0). Nothing here invents a state path, a ref or a
 * payload: discovery names the sources (`factory project locate` over
 * Central's own roots), every reading is the owner's document verbatim, and a
 * refusal comes back in the owner's own words.
 */
import {kernelOp} from "../../../kernel/bridge";
import type {KernelTransportStatus} from "../../../kernel/types";
import {developmentRead, ownerRefusalText} from "../development";
import type {Scope} from "../../../workspace/scope";
import type {DeskSourceRef, JourneyReading, ProjectLocation, ProjectReading, RunReading} from "./runModel";
import {followInspection, type InspectionPage, type WholeInspection} from "./inspectionPages";
import {ownerReadFailure, snakeKeys, type FactoryCurrentWork, type FactoryInhabitationReading, type OwnerRead} from "../inhabitation/model";

export type FactoryOwnerRequest =
  | {kind: "locate"; project?: string; all?: boolean}
  | {kind: "workflow-inspect"; state_path: string; run_ref: string; unit?: string; attempt?: string; limit?: number; cursor?: unknown}
  | {kind: "telemetry-status"; state_path: string}
  | {kind: "telemetry-inspect"; state_path: string; telemetry_ref: string}
  | {kind: "attempt-return"; state_path: string; run_ref: string; attempt_ref: string}
  | {kind: "action-list"; state_path: string; project_ref: string; run_ref: string}
  | {kind: "action-invoke"; state_path: string; project_ref: string; run_ref: string; request: unknown}
  | {kind: "recognise"; state_path: string; journey_ref: string; subject_ref: string; basis_refs?: string[]}
  | {kind: "inhabitation"; state_path: string; run_ref?: string; position_ref?: string}
  | {kind: "current-work"; state_path: string; position_ref: string};

export async function factoryOwner<T = unknown>(transport: KernelTransportStatus, request: FactoryOwnerRequest): Promise<T> {
  const result = await kernelOp(transport, {op: "factory_owner", request});
  if (result.error || result.outcome?.result !== "factory_development_reading") throw new Error(result.error ? ownerRefusalText(result.error) : "The Factory owner did not answer");
  return result.outcome.data as T;
}

// ---------------------------------------------------------------------------
// Discovery (§2 Scope): the sources in scope, located by the owner
// ---------------------------------------------------------------------------

export interface LocatedRow { project: string | null; root: string; state: "located" | "absent" | "refused"; location?: ProjectLocation; error?: string }
export interface Discovery { sources: DeskSourceRef[]; unreadable: {label: string; error: string}[]; absent: string[] }

/** Where a scope looks: Central's root, one Work project, or (All projects)
 * the root and every Work project. */
export function locateRequestFor(scope: Scope): FactoryOwnerRequest {
  if (scope.kind === "all") return {kind: "locate", all: true};
  if (scope.kind === "project") return {kind: "locate", project: scope.project};
  return {kind: "locate"};
}

export function discoveryOf(rows: LocatedRow[]): Discovery {
  const sources: DeskSourceRef[] = [];
  const unreadable: Discovery["unreadable"] = [];
  const absent: string[] = [];
  for (const row of rows) {
    const label = row.project ?? "Central";
    if (row.state === "located" && row.location?.statePath && row.location.projectRef) {
      sources.push({statePath: row.location.statePath, projectRef: row.location.projectRef, projectKey: row.location.projectKey,
        ...(row.project ? {project: row.project} : {}), root: row.root});
    } else if (row.state === "absent") absent.push(label);
    else unreadable.push({label, error: row.error ?? "The owner did not answer"});
  }
  return {sources, unreadable, absent};
}

export async function discoverSources(transport: KernelTransportStatus, scope: Scope): Promise<Discovery> {
  const data = await factoryOwner<{locations?: LocatedRow[]}>(transport, locateRequestFor(scope));
  return discoveryOf(data.locations ?? []);
}

// ---------------------------------------------------------------------------
// Developmental reads, typed
// ---------------------------------------------------------------------------

export const readProject = (transport: KernelTransportStatus, source: DeskSourceRef) =>
  developmentRead<ProjectReading>(transport, source.statePath, "project", source.projectRef);
export const readJourney = (transport: KernelTransportStatus, statePath: string, journeyRef: string) =>
  developmentRead<JourneyReading>(transport, statePath, "journey", journeyRef);
export const readRun = (transport: KernelTransportStatus, statePath: string, runRef: string) =>
  developmentRead<RunReading>(transport, statePath, "run", runRef);
/** The run's WHOLE workflow inspection: pages of the owner's maximum size,
 * the cursor followed to completion; `partial` names what could not be read
 * (inspectionPages.ts). */
export const inspectWorkflow = (transport: KernelTransportStatus, statePath: string, runRef: string, limit = 100): Promise<WholeInspection> =>
  followInspection(cursor => factoryOwner<InspectionPage>(transport, {kind: "workflow-inspect", state_path: statePath, run_ref: runRef, limit, ...(cursor != null ? {cursor} : {})}));

/** Factory's inhabitation reading for a source (every run) or one run
 * (WORLD-INHABITATION-V1 §3). Never throws: a failed read is a named absence. */
export async function readFactoryInhabitation(transport: KernelTransportStatus, statePath: string, runRef?: string): Promise<OwnerRead<FactoryInhabitationReading>> {
  const source = "factory development inhabitation";
  try {
    const data = await factoryOwner(transport, {kind: "inhabitation", state_path: statePath, ...(runRef ? {run_ref: runRef} : {})});
    return {state: "read", data: snakeKeys<FactoryInhabitationReading>(data), source};
  } catch (error) { return ownerReadFailure(error, source); }
}

/** Factory's current-work derivation for one Position — none, one or
 * ambiguous, over every in-progress custody (never a display page). */
export async function readCurrentWork(transport: KernelTransportStatus, statePath: string, positionRef: string): Promise<OwnerRead<FactoryCurrentWork>> {
  const source = "factory development current-work";
  try {
    const data = await factoryOwner(transport, {kind: "current-work", state_path: statePath, position_ref: positionRef});
    return {state: "read", data: snakeKeys<FactoryCurrentWork>(data), source};
  } catch (error) { return ownerReadFailure(error, source); }
}

export interface TelemetryInspection {
  contract?: string;
  telemetryRef?: string;
  gitBasis?: {repo?: string; head?: string; branch?: string; clean?: boolean} | null;
  [field: string]: unknown;
}
export const inspectTelemetry = (transport: KernelTransportStatus, statePath: string, telemetryRef: string) =>
  factoryOwner<TelemetryInspection>(transport, {kind: "telemetry-inspect", state_path: statePath, telemetry_ref: telemetryRef});

export const attemptReturn = (transport: KernelTransportStatus, statePath: string, runRef: string, attemptRef: string) =>
  factoryOwner<Record<string, unknown>>(transport, {kind: "attempt-return", state_path: statePath, run_ref: runRef, attempt_ref: attemptRef});

export const recognise = (transport: KernelTransportStatus, statePath: string, journeyRef: string, subjectRef: string, basisRefs: string[] = []) =>
  factoryOwner<{contract?: string; status?: string; record?: unknown}>(transport, {kind: "recognise", state_path: statePath, journey_ref: journeyRef, subject_ref: subjectRef, basis_refs: basisRefs});
