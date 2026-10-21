// The Lens's registry readings on their owner (DLW §17.11, techne:lens): Quaternal Logic's MEF lens registry (`ql mef lenses`), its
// Context-Frame grammar's frames (`ql context-frame list`) and its service provider's operations (`ql service capabilities`), reached
// through the kernel's ql_read {kind: 'mef-lenses' | 'context-frame-list' | 'service-capabilities'} (desktop/cradle/kernel/src/
// owner_routes.rs QlRead::MefLenses, ContextFrameList, ServiceCapabilities, each admitted on the fields its answer declares). Each list
// is drawn as QL gives it: the lenses by QL's own codes (`L0'` for a night face) with their name, face and square, and no sublens labels,
// because QL's answer carries none; the frames with their expressions and names; the operations with whether the provider supports
// them. The registry does not move under a running shell, so each list is read once per session (a refused read is asked again when a
// view next opens). Pure apart from the kernel calls, which take the call they are given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../desktop/cradle/src/kernel/types'
import type {Standing, Value} from '../../frame/devices/designed'

export const LENS_REGISTRY_KEYS = ['lenses', 'frames', 'service'] as const
export type LensRegistryKey = (typeof LENS_REGISTRY_KEYS)[number]
type Kind = 'mef-lenses' | 'context-frame-list' | 'service-capabilities'
const READS: Readonly<Record<LensRegistryKey, {kind: Kind; route: string; version: string; list: string}>> = {
  lenses: {kind: 'mef-lenses', route: 'ql mef lenses', version: 'registryVersion', list: 'lenses'},
  frames: {kind: 'context-frame-list', route: 'ql context-frame list', version: 'grammarVersion', list: 'frames'},
  service: {kind: 'service-capabilities', route: 'ql service capabilities', version: 'providerState', list: 'operations'},
}

export type RegistryReading = {readonly ok: true; readonly list: readonly unknown[]; readonly version: string} | {readonly ok: false; readonly reason: string; readonly busy?: boolean}
export type LensRegistry = Readonly<Record<LensRegistryKey, RegistryReading>>

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const named = (key: LensRegistryKey) => (x: unknown): boolean => rec(x) && (key === 'service'
  ? typeof x.operation === 'string' && typeof x.supported === 'boolean'
  : typeof x.code === 'string' && typeof x.name === 'string')

/** One registry answer, admitted only when it carries its own list with every entry named; else the reason in words. */
export function readRegistry(key: LensRegistryKey, answer: KernelOpCall): RegistryReading {
  const read = READS[key]
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? `Quaternal Logic did not answer \`${read.route}\`.`}
  const outcome = answer.outcome as {result?: string; data?: unknown}
  const data = outcome.data
  if (outcome.result !== 'owner_route_reading' || !rec(data)) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`${read.route}\`.`}
  const list = data[read.list], version = data[read.version]
  if (!Array.isArray(list) || typeof version !== 'string' || !list.every(named(key))) return {ok: false, reason: `QL's \`${read.route}\` answer is not the list it declares.`}
  return {ok: true, list, version}
}

const asking = (key: LensRegistryKey): RegistryReading => ({ok: false, reason: `Reading QL's \`${READS[key].route}\`…`, busy: true})
const INITIAL: LensRegistry = {lenses: asking('lenses'), frames: asking('frames'), service: asking('service')}
export type RegistryCall = (op: KernelOp) => Promise<KernelOpCall>
let registry: LensRegistry = INITIAL
const pending = new Set<LensRegistryKey>()
let call: RegistryCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const publish = (key: LensRegistryKey, reading: RegistryReading) => { registry = {...registry, [key]: reading}; for (const listener of [...listeners]) listener() }

export function lensRegistry(): LensRegistry { return registry }

/** Read each list QL has not yet answered, once at a time. */
export async function ensureLensRegistry(): Promise<void> {
  await Promise.all(LENS_REGISTRY_KEYS.filter(key => !registry[key].ok && !pending.has(key)).map(async key => {
    pending.add(key)
    if (!(registry[key] as {busy?: boolean}).busy) publish(key, asking(key))
    let reading: RegistryReading
    try {
      reading = readRegistry(key, await call({op: 'ql_read', request: {kind: READS[key].kind}}))
    } catch (error) {
      reading = {ok: false, reason: `The kernel could not be asked \`${READS[key].route}\`: ${error instanceof Error ? error.message : String(error)}`}
    }
    pending.delete(key)
    publish(key, reading)
  }))
}

/** Tests: forget every list, and use another call. */
export function resetLensRegistry(next: {call?: RegistryCall} = {}): void {
  registry = INITIAL; pending.clear(); call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** QL's registry lists, read once while a Lens stands. */
export function useLensRegistry(): LensRegistry {
  useEffect(() => { void ensureLensRegistry() }, [])
  return useSyncExternalStore(subscribe, lensRegistry, lensRegistry)
}

const READ: Readonly<Record<LensRegistryKey, (reading: {list: readonly unknown[]; version: string}) => string>> = {
  lenses: r => `A reading: QL's MEF lens registry (\`ql mef lenses\`, registry ${r.version}), its ${r.list.length} lenses by code, name, face and square. QL names no sublenses in it, so the ring is drawn whole.`,
  frames: r => `A reading: QL's Context-Frame grammar (\`ql context-frame list\`, grammar ${r.version}), its ${r.list.length} frames with their expressions and names.`,
  service: r => `A reading: QL's service provider (\`ql service capabilities\`, ${r.version}), each operation with whether it supports it.`,
}

/** The lists as the design's keys carry them (JSON, verbatim), each a reading or absent with its reason. */
export function registryKeys(registry: LensRegistry): {values: Record<string, Value>; standing: Record<string, Standing>} {
  const values: Record<string, Value> = {}
  const standing: Record<string, Standing> = {}
  for (const key of LENS_REGISTRY_KEYS) {
    const reading = registry[key]
    if (reading.ok) { values[key] = JSON.stringify(reading.list); standing[key] = {disabled: READ[key](reading)} }
    else standing[key] = {disabled: reading.reason}
  }
  return {values, standing}
}
