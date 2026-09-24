import {useSyncExternalStore} from "react";
import type {KernelTransportStatus} from "../../../kernel/types";
import {factoryOwner} from "../desk/factoryReads";
import {ownerReadFailure, type OwnerRead} from "../inhabitation/model";
import {fieldOf, type Field, type SignalDetail} from "./model";

export type FieldRead = OwnerRead<Field> | {state: "reading"; source: string};
const fields = new Map<string, FieldRead>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => { for (const listener of listeners) listener(); };
export function useField(statePath: string): FieldRead | undefined {
  return useSyncExternalStore(subscribe, () => fields.get(statePath), () => fields.get(statePath));
}
export const peekField = (statePath: string) => fields.get(statePath);
let selectedSignal: {statePath: string; signalRef: string} | undefined;
export function selectSignal(statePath: string, signalRef: string) { selectedSignal = signalRef ? {statePath, signalRef} : undefined; emit(); }
export function useSelectedSignal() { return useSyncExternalStore(subscribe, () => selectedSignal, () => selectedSignal); }

// A native Factory telemetry inspection can name a Run even before the
// signal is commissioned. Retain only the exact source→Run relation read in
// this Desk session, so returning from that Run reaches the same evidence.
const sourceRunRelations = new Map<string, {statePath: string; sourceRef: string; sourceRevision: string; runRef: string}>();
export function rememberSourceRun(signalRef: string, statePath: string, sourceRef: string, sourceRevision: string, runRef: string) {
  if (!sourceRunRelations.has(signalRef) && sourceRunRelations.size >= 512) sourceRunRelations.delete(sourceRunRelations.keys().next().value!);
  sourceRunRelations.set(signalRef, {statePath, sourceRef, sourceRevision, runRef}); emit();
}
export function sourceRunFor(signalRef: string) { return sourceRunRelations.get(signalRef); }

const generations = new Map<string, number>();
export async function readField(transport: KernelTransportStatus, statePath: string, preferHot = false): Promise<FieldRead> {
  const previous = fields.get(statePath);
  const generation = (generations.get(statePath) ?? 0) + 1;
  generations.set(statePath, generation);
  fields.set(statePath, {state: "reading", source: "factory telemetry field"}); emit();
  let result: FieldRead;
  try {
    if (preferHot && previous?.state === "read") {
      const answer = await factoryOwner<{schema: string; basis: string; field: unknown; hot_absence?: string; published_at_unix_ms?: number}>(transport,
        {kind: "telemetry-current", state_path: statePath, project_world_ref: previous.data.project_world_ref});
      if (answer.schema !== "oi.factory-sensing-current/v1" || !["aikit-hot", "factory-native"].includes(answer.basis)) throw new Error("The current sensing adapter returned an unsupported reading");
      const data = fieldOf(answer.field);
      if (data.project_world_ref !== previous.data.project_world_ref) throw new Error("The current sensing reading changed ProjectWorld");
      result = {state: "read", source: answer.basis === "aikit-hot"
        ? `AIKit hot projection of Factory · published ${new Date(answer.published_at_unix_ms ?? 0).toLocaleString()} (six-minute freshness limit)`
        : `Factory native · hot projection unavailable${answer.hot_absence ? `: ${answer.hot_absence}` : ""}`, data};
    } else {
      const data = await factoryOwner(transport, {kind: "telemetry-field", state_path: statePath});
      result = {state: "read", source: "Factory native field", data: fieldOf(data)};
    }
  } catch (error) { result = ownerReadFailure(error, "factory telemetry field"); }
  if (generations.get(statePath) === generation) { fields.set(statePath, result); emit(); }
  return result;
}

export async function readSignal(transport: KernelTransportStatus, statePath: string, signalRef: string): Promise<OwnerRead<SignalDetail>> {
  try {
    const data = await factoryOwner<SignalDetail>(transport, {kind: "telemetry-signal", state_path: statePath, signal_ref: signalRef});
    if (data.schema !== "factory.signal-reading/v1" || data.signal?.signal_ref !== signalRef || data.summary?.signal_ref !== signalRef) throw new Error("Factory returned another signal or an unsupported reading");
    return {state: "read", data, source: "factory telemetry signal"};
  } catch (error) { return ownerReadFailure(error, "factory telemetry signal"); }
}
