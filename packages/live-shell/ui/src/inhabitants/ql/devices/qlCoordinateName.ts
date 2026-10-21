// A coordinate's name in Quaternal Logic's map: the registry's own name for it (`ql kernel ledger <coordinate> --json`, `ql.m-ledger-view/v1`
// coordinate.names), read through the kernel's ql_read {kind: 'kernel-ledger'} (desktop/cradle/kernel/src/owner_routes.rs
// QlRead::KernelLedger). The Torus's and Resonance's tattva is announced by its coordinate (the live scene's M2 condition,
// expressions-app instrumentCondition.ts); its name is the map's. Each coordinate is read once per session: the map does not move under a
// running shell. Pure apart from the one kernel call, which takes the call it is given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {FrameInstrumentCondition} from '@epilogos/expressions-boundary'
import type {Standing, Value} from '../../../frame/devices/designed'

export type CoordinateName = {readonly ok: true; readonly name: string} | {readonly ok: false; readonly reason: string; readonly busy?: boolean}

/** The registry's name of the coordinate asked, or the reason in words. */
export function readCoordinateName(answer: KernelOpCall, ref: string): CoordinateName {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql kernel ledger`.'}
  const outcome = answer.outcome as {result?: string; data?: {schema?: unknown; coordinate?: {source_ref?: unknown; names?: unknown}}}
  if (outcome.result !== 'owner_route_reading' || outcome.data?.schema !== 'ql.m-ledger-view/v1') return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not QL's ledger view.`}
  if (outcome.data.coordinate?.source_ref !== ref) return {ok: false, reason: `QL answered another coordinate than ${ref}.`}
  const names = outcome.data.coordinate.names
  return Array.isArray(names) && typeof names[0] === 'string' && names[0] ? {ok: true, name: names[0]} : {ok: false, reason: `The map gives ${ref} no name.`}
}

export type NameCall = (op: KernelOp) => Promise<KernelOpCall>
let names: ReadonlyMap<string, CoordinateName> = new Map()
let call: NameCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const publish = (ref: string, name: CoordinateName) => { names = new Map([...names, [ref, name]]); for (const listener of [...listeners]) listener() }

export function coordinateNames(): ReadonlyMap<string, CoordinateName> { return names }

/** Read a coordinate's name once. */
export async function ensureCoordinateName(ref: string): Promise<void> {
  if (names.has(ref)) return
  publish(ref, {ok: false, reason: `Reading the map's name for ${ref}…`, busy: true})
  let name: CoordinateName
  try {
    name = readCoordinateName(await call({op: 'ql_read', request: {kind: 'kernel-ledger', coordinate: ref}}), ref)
  } catch (error) {
    name = {ok: false, reason: `The kernel could not be asked for the map's name: ${error instanceof Error ? error.message : String(error)}`}
  }
  publish(ref, name)
}

/** Tests: forget every name, and use another call. */
export function resetCoordinateNames(next: {call?: NameCall} = {}): void {
  names = new Map(); call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The map's name of the coordinate, read once; null while no coordinate is given. */
export function useCoordinateName(ref: string | null): CoordinateName | null {
  useEffect(() => { if (ref) void ensureCoordinateName(ref) }, [ref])
  const all = useSyncExternalStore(subscribe, coordinateNames, coordinateNames)
  return ref ? all.get(ref) ?? {ok: false, reason: `Reading the map's name for ${ref}…`, busy: true} : null
}

// ── the tattva of the live scene's M2 condition, as the Torus and Resonance draw it ──

export const NO_CONDITION = 'The live scene has announced no M2 condition yet: the native field announces it once it has inspected its sources (open the live instrument).'
export const TATTVA_READ = 'A reading: the tattva of the live scene\'s M2 condition, by the map\'s name for its coordinate; the condition changes with the event.'
export const FIBRE_READ = 'A reading: the element fibre of the live scene\'s M2 condition, as QL gives it.'

/** The tattva keys from the announced condition and the map's name of its coordinate: each a reading, or absent with its reason. */
export function tattvaKeys(condition: FrameInstrumentCondition | null | undefined, name: CoordinateName | null): {values: Record<string, Value>; standing: Record<string, Standing>} {
  const values: Record<string, Value> = {}
  const standing: Record<string, Standing> = {}
  if (!condition) return {values, standing: {'tattva.name': {disabled: NO_CONDITION}, 'tattva.fibre': {disabled: NO_CONDITION}}}
  if (condition.material_fibre) { values['tattva.fibre'] = condition.material_fibre; standing['tattva.fibre'] = {disabled: FIBRE_READ} }
  else standing['tattva.fibre'] = {disabled: 'The live scene\'s M2 condition gives no element fibre.'}
  if (!condition.tattva_ref) standing['tattva.name'] = {disabled: 'The live scene\'s M2 condition stands on no tattva.'}
  else if (name?.ok) { values['tattva.name'] = name.name; standing['tattva.name'] = {disabled: TATTVA_READ} }
  else standing['tattva.name'] = {disabled: name?.reason ?? `Reading the map's name for ${condition.tattva_ref}…`}
  return {values, standing}
}
