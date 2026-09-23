/**
 * AIKit's inhabitation reads through the kernel (`inhabitation_read`), and
 * the one population store the Agents aperture, the Position page and the
 * Context basis share. Each read returns an `OwnerRead`: the owner's
 * document after the kernel's schema check, or a named absence carrying the
 * owner's own words and the command that failed — never a thrown error a
 * panel could swallow into an empty roster.
 *
 * Reading is explicit, like the Desk: on first show for a scope and on
 * Retry. No poll, no timer.
 */
import {useCallback, useEffect, useSyncExternalStore} from "react";
import {kernelOp} from "../../../kernel/bridge";
import type {KernelTransportStatus} from "../../../kernel/types";
import {ownerReadFailure, snakeKeys, type InhabitationReading, type OwnerRead, type PopulationReading, type RefocusReading} from "./model";

export type InhabitationWireRequest =
  | {kind: "population"; project?: string}
  | {kind: "whoami"; project?: string; position?: string}
  | {kind: "refocus"; project?: string; position?: string};

const SOURCE: Record<InhabitationWireRequest["kind"], string> = {population: "aikit gateway who", whoami: "aikit whoami", refocus: "aikit refocus"};

async function inhabitationRead<T>(transport: KernelTransportStatus, request: InhabitationWireRequest): Promise<OwnerRead<T>> {
  const source = SOURCE[request.kind];
  const result = await kernelOp(transport, {op: "inhabitation_read", request});
  if (result.error || result.outcome?.result !== "inhabitation_reading") return ownerReadFailure(result.error ?? "the kernel gave no inhabitation reading", source);
  const warnings = result.outcome.warnings ?? [];
  return {state: "read", data: snakeKeys<T>(result.outcome.data), source, ...(warnings.length ? {warnings} : {})};
}

export const readPopulation = (transport: KernelTransportStatus, project?: string) =>
  inhabitationRead<PopulationReading>(transport, {kind: "population", ...(project ? {project} : {})});
export const readWhoami = (transport: KernelTransportStatus, position: string, project?: string) =>
  inhabitationRead<InhabitationReading>(transport, {kind: "whoami", position, ...(project ? {project} : {})});
export const readRefocus = (transport: KernelTransportStatus, position: string, project?: string) =>
  inhabitationRead<RefocusReading>(transport, {kind: "refocus", position, ...(project ? {project} : {})});

// ---------------------------------------------------------------------------
// The population store — one reading per scope, shared
// ---------------------------------------------------------------------------

export interface PopulationState { key: string; status: "reading" | "read"; read?: OwnerRead<PopulationReading>; readAt?: number }
let population: PopulationState | undefined;
let generation = 0;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of [...listeners]) listener(); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const keyOf = (project: string | undefined) => project ? `project:${project}` : "root";

/** Read who is here for a scope. The previous reading stays standing until
 * the new one lands whole. */
export async function readPopulationFor(transport: KernelTransportStatus, project: string | undefined): Promise<void> {
  const gen = ++generation;
  const key = keyOf(project);
  const previous = population?.key === key ? population : undefined;
  population = {key, status: "reading", ...(previous?.read ? {read: previous.read} : {}), ...(previous?.readAt ? {readAt: previous.readAt} : {})};
  emit();
  const read = await readPopulation(transport, project);
  if (gen !== generation) return;
  population = {key, status: "read", read, readAt: Date.now()};
  emit();
}

/** The population for the scope in view: read on first show, then only on
 * `retry`. */
export function usePopulation(transport: KernelTransportStatus, project: string | undefined): {state?: PopulationState; retry: () => void} {
  const state = useSyncExternalStore(subscribe, () => population, () => population);
  const key = keyOf(project);
  const current = state?.key === key ? state : undefined;
  const retry = useCallback(() => { void readPopulationFor(transport, project); }, [transport, project]);
  useEffect(() => { if (!current) retry(); /* first show for this scope */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, transport]);
  return {state: current, retry};
}
export function peekPopulation(project: string | undefined): PopulationState | undefined {
  return population?.key === keyOf(project) ? population : undefined;
}
/** Tests only. */
export function __setPopulationForTest(next: PopulationState | undefined) { population = next; emit(); }
