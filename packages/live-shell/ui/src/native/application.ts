import {detectTransport, kernelOp, tauriInvoke} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

export interface NativeContributionReading {
  contribution_ref: string
  owner: string
  revision: number
  compiled: boolean
  owner_selected: boolean
  registration: 'registered' | 'excluded' | 'failed'
  failure?: string
}
export interface ShellConfig {
  default_set: string
  product_ids?: string[]
  contributions?: NativeContributionReading[]
  /** The suite product universe the footprint offers (live_shell_config's
   * suite_product_ids, native_shell.rs): every product named in the footprint's
   * backing options that the host owns, in the host's owner order. product_ids
   * is the selected backing's admitted subset of it. Absent on a host build
   * that predates the field. */
  suite_product_ids?: string[]
  /** Each suite product's public owner name (live_shell_config's
   * suite_owner_names, native_shell.rs, read from the host's OWNERS table),
   * keyed by product id. The readback shows the name with the id as secondary
   * text. Absent on a host build that predates the field; a product the host
   * names no name for is shown by its id alone. */
  suite_owner_names?: Record<string, string>
  kernel_bridge?: string
  kernel_transport?: {kind: 'tauri'; invoke: 'kernel_op'}
  kernel_epoch?: string
  runtime_epoch?: string
  runtime_scope?: {kind: 'host-runtime'; epoch: string}
  world_scope?: {owner: 'central'; world: 'control:root'; personal_ground: string; workcell_ref?: string} | null
  world_error?: string
  personal_ground?: string | null
  backing_id?: string
  profile_scope?: {backing_id: string; configuration_home: string; active_profile: unknown}
  onboarding?: boolean
  expressions_entry?: string
  saved_works?: unknown
  /** The installed host's qualified source basis (live_shell_config in
   * src-tauri native_shell.rs): the commit the binary was built from, its
   * tree digest, and whether that tree carried uncommitted changes. The
   * development browser discloses none of them. */
  source_revision?: string
  source_tree_sha256?: string
  source_dirty?: boolean
}
export interface SetReading {summary: unknown; document: unknown; revision: string}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const nativeHost = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
export function shellTransport(config: ShellConfig): KernelTransportStatus {
  if (nativeHost()) return config.kernel_transport?.kind === 'tauri'
    ? {kind: 'tauri'} : {kind: 'unavailable', reason: 'The installed host did not disclose its native kernel transport'}
  return typeof config.kernel_bridge === 'string' && config.kernel_bridge.trim() ? {kind: 'bridge', url: config.kernel_bridge}
    : {kind: 'unavailable', reason: 'The development shell has no configured native owner bridge'}
}
async function json(path: string): Promise<unknown> {
  const abort = new AbortController()
  // The development owner bounds CurrentWorld at 30s. Leave time for its
  // explicit refusal to arrive instead of racing that response with an abort.
  const deadline = setTimeout(() => abort.abort(new Error('The native owner read exceeded its 35 second deadline')), 35_000)
  try {
    const response = await fetch(path, {signal: abort.signal})
    const body: unknown = await response.json()
    if (!response.ok || object(body) && body.error) throw Error(object(body) && body.error ? String(body.error) : `Owner read failed (${response.status})`)
    return body
  } finally {clearTimeout(deadline)}
}
let configuration: Promise<ShellConfig> | null = null
let generation = 0
let scope = ''
let configRequest = 0
const readings = new Map<string, {reading?: SetReading; pending?: Promise<SetReading>}>()
let activeReads = 0
const waitingReads: {key: string; entry: object; grant: () => void; reject: (cause: Error) => void}[] = []
function releaseReading(key: string): void {
  readings.delete(key)
  for (let i = waitingReads.length - 1; i >= 0; --i) if (waitingReads[i].key === key) {
    waitingReads.splice(i, 1)[0].reject(Error('The queued set reading was superseded or evicted'))
  }
}
function retireReadings(): void {for (const key of [...readings.keys()]) releaseReading(key)}
async function acquireOwnerSlot(key: string, entry: object): Promise<() => void> {
  if (activeReads >= 2) await new Promise<void>((grant, reject) => waitingReads.push({key, entry, grant, reject}))
  else ++activeReads
  if (readings.get(key) !== entry) {
    releaseOwnerSlot()
    throw Error('The queued set subject has retired')
  }
  return releaseOwnerSlot
}
function releaseOwnerSlot(): void {
  --activeReads
  while (waitingReads.length && activeReads < 2) {
    const next = waitingReads.shift()!
    if (readings.get(next.key) !== next.entry) {next.reject(Error('The queued set subject has retired')); continue}
    ++activeReads; next.grant()
  }
}
const setListeners = new Map<string, Set<() => void>>()
export function subscribeSet(path: string, listener: () => void): () => void {
  let held = setListeners.get(path)
  if (!held) {held = new Set(); setListeners.set(path, held)}
  held.add(listener)
  return () => {held!.delete(listener); if (!held!.size) setListeners.delete(path)}
}
/** The settled outcome of the current owner configuration reading. */
export type ShellConfigOutcome = {config: ShellConfig; error: null} | {config: null; error: string}
const configListeners = new Set<(outcome: ShellConfigOutcome) => void>()
/** Announces each settled reading of the current request (a value or a failure), so a
 * surface that reads the configuration once can follow a refresh (readShellConfig(true)).
 * A superseded request is not announced; the request that superseded it is. */
export function subscribeShellConfig(listener: (outcome: ShellConfigOutcome) => void): () => void {
  configListeners.add(listener)
  return () => {configListeners.delete(listener)}
}
function announceShellConfig(outcome: ShellConfigOutcome): void {
  for (const listener of [...configListeners]) listener(outcome)
}
/** One host reading and bounded shared document models above pane lifetimes.
 * Installed execution never discovers a development server or external assets. */
export function readShellConfig(refresh = false): Promise<ShellConfig> {
  if (refresh) configuration = null
  if (configuration) return configuration
  const request = ++configRequest
  const pending = (async () => {
    const value = nativeHost() ? await tauriInvoke<unknown>('live_shell_config', {}) : await json('/api/config')
    if (!object(value) || typeof value.default_set !== 'string') throw Error('Invalid native shell configuration')
    if (nativeHost() && (!Array.isArray(value.product_ids) || value.product_ids.some(id => typeof id !== 'string')
      || !Array.isArray(value.contributions) || value.contributions.some(row => !object(row)
        || typeof row.contribution_ref !== 'string' || typeof row.owner !== 'string' || !Number.isSafeInteger(row.revision)
        || typeof row.compiled !== 'boolean' || typeof row.owner_selected !== 'boolean'
        || !['registered', 'excluded', 'failed'].includes(String(row.registration))))) throw Error('The installed host did not disclose qualified native composition and contribution admission')
    if (request !== configRequest) throw Error('This host configuration reading has been superseded')
    if (nativeHost() && (!object(value.kernel_transport) || value.kernel_transport.kind !== 'tauri' || value.kernel_transport.invoke !== 'kernel_op'
      || typeof value.runtime_epoch !== 'string' || !value.runtime_epoch || typeof value.kernel_epoch !== 'string' || !value.kernel_epoch
      || !object(value.runtime_scope) || value.runtime_scope.kind !== 'host-runtime' || value.runtime_scope.epoch !== value.runtime_epoch)) throw Error('The installed host did not qualify its runtime access')
    const next = JSON.stringify([value.world_scope ?? null, value.runtime_scope ?? null, value.kernel_bridge ?? null, value.backing_id ?? null])
    if (scope !== next) {scope = next; ++generation; retireReadings()}
    return value as unknown as ShellConfig
  })().catch(cause => {if (request === configRequest) configuration = null; throw cause})
  configuration = pending
  // Announce only the request that is still current at settlement; a superseded one stays silent.
  void pending.then(
    config => {if (request === configRequest) announceShellConfig({config, error: null})},
    cause => {if (request === configRequest) announceShellConfig({config: null, error: cause instanceof Error ? cause.message : String(cause)})},
  )
  return pending
}
export function invalidateSet(path?: string): void {
  if (!path) {++generation; retireReadings()}
  else for (const key of [...readings.keys()]) if (key.endsWith(`|${path}`)) releaseReading(key)
  for (const [subject, listeners] of setListeners) if (!path || subject === path) for (const listener of [...listeners]) listener()
}
function current(signal?: AbortSignal) {if (signal?.aborted) throw new DOMException('The originating view was released', 'AbortError')}
/** The Live set reading from the kernel's live_set_read op, the owner's document verbatim. */
async function kernelSetReading(transport: KernelTransportStatus, path: string): Promise<unknown> {
  const answer = await kernelOp(transport, {op: 'live_set_read', path})
  if (answer.outcome == null) throw Error(answer.error ?? 'the kernel did not serve the set reading')
  const outcome = answer.outcome as {result?: string; reading?: unknown}
  if (outcome.result !== 'live_set_reading') throw Error(`the kernel answered \`${outcome.result ?? 'unknown'}\`, not \`live_set_reading\``)
  return outcome.reading
}
export async function readSet(path: string, signal?: AbortSignal): Promise<SetReading> {
  current(signal)
  await readShellConfig()
  current(signal)
  const key = `${scope}|live-set|current|${path}`
  const access = generation
  let entry = readings.get(key)
  if (entry) {readings.delete(key); readings.set(key, entry)}
  else {
    while (readings.size >= 8) releaseReading(readings.keys().next().value!)
    entry = {}; readings.set(key, entry)
  }
  if (!entry.reading && !entry.pending) {
    const origin = generation, held = entry
    held.pending = (async () => {
      const release = await acquireOwnerSlot(key, held)
      let value: unknown
      try {
        if (origin !== generation || readings.get(key) !== held) throw Error('The set subject retired before its owner acquisition')
        const transport = detectTransport()
        value = transport.kind !== 'unavailable' ? await kernelSetReading(transport, path)
          : nativeHost() ? await tauriInvoke<unknown>('live_shell_read', {request: {kind: 'set', path}})
          : await json(`/api/set?path=${encodeURIComponent(path)}`)
      } finally {release()}
      if (origin !== generation || readings.get(key) !== held) throw Error('The set reading belongs to a retired owner access')
      if (!object(value) || !object(value.summary) || !object(value.document) || value.summary.path !== path || value.document.path !== path
        || typeof value.revision !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value.revision)) throw Error('The owner did not return a qualified set reading')
      const result = value as unknown as SetReading
      held.reading = result
      return result
    })().finally(() => {held.pending = undefined})
  }
  const result = entry.reading ?? await entry.pending!
  current(signal)
  if (access !== generation || readings.get(key) !== entry) throw Error('The set result belongs to a retired owner access or subject generation')
  return result
}
