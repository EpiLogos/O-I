// A device popped out into the native host's own window (manual §16.3 Pop-out: "Its own window, which can fill the screen"). The
// host's second window (desktop/cradle/src-tauri/src/windows.rs window_detach) is a separate page with its own script: the device's
// binding — its readings, its standing and its writes to the owner — lives in this window's door. The relay carries it across:
// this window publishes the device as it stands (values, standing, holds, which keys it writes and which the view holds) on every
// change of the door, and applies what the second window sends back (a write, a view hold, a hand-back), answering each with the
// owner's words. The second window draws the device's own Pop-out view on that relayed binding (RelayedDevice). Nothing is copied
// into a second store: the owner and the binding stay here, one door.
//
// Off the native host (the browser, the dev server) and wherever the host refuses, a device pops out in this window instead
// (DeviceWindows.tsx), as before.
import type {RelayedFull} from './relayedFulls'
import type {DeviceInstance} from './deviceRuntime'
import type {DesignBinding, Standing, Value, ValueChange, Values} from './designed'
import {publishedDevice, subscribeDeviceDoor, type PublishedDevice} from './deviceDoor'

export const RELAY_EVENTS = {publish: 'oi:device-relay', act: 'oi:device-relay-act', ack: 'oi:device-relay-ack', hello: 'oi:device-relay-hello', bye: 'oi:device-relay-bye'} as const

/** A device as the relay carries it: the instance's data and its binding's, never a function. */
export interface RelayedSnapshot {
  readonly bindingId: string
  readonly deviceId: string
  /** The device's own Full named as data (relayedFulls.ts), or null where its Full is its design's. */
  readonly full: RelayedFull | null
  readonly device: Pick<DeviceInstance, 'id' | 'family' | 'face' | 'rows' | 'values' | 'heldBy' | 'enabledKey'>
  readonly binding: null | {
    readonly id: string
    readonly values: Values
    readonly standing: Readonly<Record<string, Standing>>
    readonly heldBy: Readonly<Record<string, string>>
    readonly modulatedBy: Readonly<Record<string, string>>
    readonly enabledKey: string | null
    /** The keys the view holds (each set goes to the binding's own hand). */
    readonly local: readonly string[]
    /** Whether the binding writes at all, and the keys it was asked about that it does not take. */
    readonly writes: boolean
    readonly reads: readonly string[]
    readonly handBack: boolean
  }
}

export type RelayAct =
  | {readonly kind: 'write'; readonly changes: readonly ValueChange[]}
  | {readonly kind: 'local'; readonly key: string; readonly value: Value | undefined}
  | {readonly kind: 'handBack'; readonly key: string}

/** A binding as the relay carries it. Pure. */
export function relaySnapshot(bindingId: string, deviceId: string, device: DeviceInstance, binding: DesignBinding | undefined, ownFull?: RelayedFull): RelayedSnapshot {
  const full = ownFull ? JSON.parse(JSON.stringify(ownFull)) as RelayedFull : null
  const data = JSON.parse(JSON.stringify({id: device.id, family: device.family, face: device.face, rows: device.rows, values: device.values,
    heldBy: device.heldBy ?? {}, enabledKey: device.enabledKey})) as RelayedSnapshot['device']
  if (!binding) return {bindingId, deviceId, full, device: data, binding: null}
  const local = binding.local ? Object.keys(binding.local) : []
  const asked = new Set([...Object.keys(binding.values), ...Object.keys(binding.standing ?? {}), ...device.rows.map(row => row.key)])
  const reads = binding.write && binding.writes ? [...asked].filter(key => !local.includes(key) && !binding.writes!(key)) : []
  return {bindingId, deviceId, full, device: data, binding: {id: binding.id, values: JSON.parse(JSON.stringify(binding.values)) as Values,
    standing: JSON.parse(JSON.stringify(binding.standing ?? {})) as Record<string, Standing>, heldBy: {...(binding.heldBy ?? {})},
    modulatedBy: {...(binding.modulatedBy ?? {})}, enabledKey: binding.enabledKey ?? null, local, writes: !!binding.write, reads,
    handBack: !!binding.handBack}}
}

/** Apply one act from the second window to the device's binding; the owner's refusal is thrown in its words. */
export async function applyRelayAct(binding: DesignBinding | undefined, act: RelayAct): Promise<void> {
  if (!binding) throw new Error('The device has no binding here: nothing writes it.')
  if (act.kind === 'local') {
    const hand = binding.local?.[act.key]
    if (!hand) throw new Error(`${act.key} is not the view's to hold.`)
    hand(act.value)
    return
  }
  if (act.kind === 'handBack') {
    if (!binding.handBack) throw new Error('Nothing here gives the value back.')
    await binding.handBack(act.key)
    return
  }
  if (!binding.write) throw new Error('Every value of this device is a reading: nothing here writes it.')
  await binding.write(act.changes)
}

/** The relayed binding the second window draws on: readings and standing as the snapshot holds them, every act sent back. Pure,
 * apart from `send`. */
export function relayedBinding(snapshot: NonNullable<RelayedSnapshot['binding']>, send: (act: RelayAct) => Promise<void>): DesignBinding {
  const reads = new Set(snapshot.reads)
  return {
    id: snapshot.id,
    values: snapshot.values,
    standing: snapshot.standing,
    heldBy: snapshot.heldBy,
    modulatedBy: snapshot.modulatedBy,
    ...(snapshot.enabledKey ? {enabledKey: snapshot.enabledKey} : {}),
    local: Object.fromEntries(snapshot.local.map(key => [key, (value: Value | undefined) => { void send({kind: 'local', key, value}) }])),
    ...(snapshot.writes ? {write: (changes: readonly ValueChange[]) => send({kind: 'write', changes}), writes: (key: string) => !reads.has(key)} : {}),
    ...(snapshot.handBack ? {handBack: (key: string) => send({kind: 'handBack', key})} : {}),
  }
}

// ---------------------------------------------------------------------------------------------------------------- the main window

type Emit = (event: string, payload: unknown) => Promise<void>
/** The main window's record of its popped-out devices: binding id → the door's device id. `entries` are the windows standing now,
 * which every door change is published to. A window that sends bye is no longer published to, but the device stays popped out: its
 * window remounts the device when its own access arrives (DetachedFrame re-runs its admission), and the remount's hello must find it
 * again (r24: the Day and Scope popped out and never reached the main window). A pop-out the host refused is forgotten. Pure. */
export function relayRegistry() {
  const standing = new Map<string, string>()
  const popped = new Map<string, string>()
  return {
    popped(bindingId: string, deviceId: string) { popped.set(bindingId, deviceId); standing.set(bindingId, deviceId) },
    refused(bindingId: string) { popped.delete(bindingId); standing.delete(bindingId) },
    /** Its window greets the main window: true where the binding is one this window popped out, which stands again. */
    hello(bindingId: string): boolean {
      const deviceId = popped.get(bindingId)
      if (deviceId === undefined) return false
      standing.set(bindingId, deviceId)
      return true
    },
    bye(bindingId: string) { standing.delete(bindingId) },
    deviceOf: (bindingId: string): string | undefined => standing.get(bindingId),
    entries: (): IterableIterator<[string, string]> => standing.entries(),
  }
}

const relayed = relayRegistry()
let installed: Promise<Emit> | null = null

/** The native host's main window (not a detached page): the one that can open a second window and relay to it. */
export function nativeHostMain(): boolean {
  const w = typeof window === 'undefined' ? undefined : (window as unknown as {__TAURI_INTERNALS__?: unknown; __OI_DETACHED__?: boolean})
  return !!w?.__TAURI_INTERNALS__ && !w.__OI_DETACHED__
}

/** The published device's own Full as data, where it names one. */
const relayOf = (published: PublishedDevice): RelayedFull | undefined => (published.full && 'draw' in published.full ? published.full.relay : undefined)

function publishAll(emit: Emit) {
  for (const [bindingId, deviceId] of relayed.entries()) {
    const published = publishedDevice(deviceId)
    if (published) void emit(RELAY_EVENTS.publish, relaySnapshot(bindingId, deviceId, published.device, published.binding, relayOf(published)))
  }
}

function install(): Promise<Emit> {
  installed ??= (async () => {
    const {emit, listen} = await import('@tauri-apps/api/event')
    const send: Emit = (event, payload) => emit(event, payload)
    let last = ''
    subscribeDeviceDoor(() => {
      // Publish only when what the relayed devices show moved.
      const now = JSON.stringify([...relayed.entries()].map(([bindingId, deviceId]) => {
        const p = publishedDevice(deviceId)
        return p ? relaySnapshot(bindingId, deviceId, p.device, p.binding, relayOf(p)) : null
      }))
      if (now !== last) { last = now; publishAll(send) }
    })
    await listen<{bindingId: string}>(RELAY_EVENTS.hello, event => { if (relayed.hello(event.payload.bindingId)) publishAll(send) })
    await listen<{bindingId: string}>(RELAY_EVENTS.bye, event => { relayed.bye(event.payload.bindingId) })
    await listen<{bindingId: string; requestId: string; act: RelayAct}>(RELAY_EVENTS.act, event => {
      const {bindingId, requestId, act} = event.payload
      const deviceId = relayed.deviceOf(bindingId)
      const published = deviceId ? publishedDevice(deviceId) : undefined
      const answer = published ? applyRelayAct(published.binding, act) : Promise.reject(new Error('The device left its chain: its window no longer reaches it.'))
      void answer.then(() => send(RELAY_EVENTS.ack, {requestId}), cause => send(RELAY_EVENTS.ack, {requestId, error: cause instanceof Error ? cause.message : String(cause)}))
    })
    return send
  })()
  return installed
}

/** Pop a device out into the host's own window, relaying its binding there. Rejects with the host's words where it refuses. */
export async function popOutNative(deviceId: string, workspaceId: string): Promise<void> {
  const published = publishedDevice(deviceId)
  if (!published) throw new Error('The device is not on the door.')
  const identity = {family: published.device.family, face: published.device.face.id, aperture: {day: null, flow: null, conversation: null, instrument: null}}
  const bindingId = `device:${identity.family}/${identity.face}`
  relayed.popped(bindingId, deviceId)
  await install()
  const {invoke} = await import('@tauri-apps/api/core')
  try {
    await invoke('window_detach', {workspaceId, binding: {id: bindingId, kind: 'device', title: published.device.face.title, ref: bindingId, device: identity}, bounds: null})
  } catch (cause) {
    relayed.refused(bindingId)
    throw cause instanceof Error ? cause : new Error(String(cause))
  }
}
