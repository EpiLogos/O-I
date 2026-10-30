// The catalogue designs of Technē and the knowledge graph as devices of the runtime (T-COVERAGE §1.4; manual §16.13 "A device brings
// these to the shell: its parameters … its kind and its views … its displays"; the shell brings "the values, the writes, the
// navigation between views"). A design has no family manifest of its own: its device is keyed by the design's `<family>:<face>`, so
// the door draws the catalogue's design on the binding it is published with (frame/devices/designs.ts designKey, DeviceView.tsx
// useHosting), as the rail-born devices are (widgets/railDevices.tsx railDevice). The device carries no rows: every key it draws is
// the binding's.
//
// What every binding here shares: a refusal names the owner operation that is missing, a key with no reading stays absent (never a
// default, never a design's sample), and the hand's own settings are held here, never sent to an owner (DesignBinding.local).
// Pure, apart from the holds' small store.
import {useSyncExternalStore} from 'react'
import type {Standing, Value} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {LiveSemantic} from '../../inhabitants/sdk/semantics'
import type {IconName} from '../../inhabitants/sdk/icons'

/** The designs this lane binds, by their catalogue keys (`<family>:<face>`). */
export const PALACE_DESIGN = 'techne:palace'
export const JOURNEY_DESIGN = 'techne:journey'
export const TIMELINE_DESIGN = 'techne:timeline'
export const CANVAS_DESIGN = 'techne:canvas'
export const LENS_DESIGN = 'techne:lens'
export const GRAPH_DESIGN = 'knowledge-graph:graph'

/** A design's device: keyed by its design id, which is also its id on the door. `heldBy` names the instruments whose chain it
 * stands on (manual §16.2 Technē: "The instrument it plays through, then its lens and filter effects"). */
export function designDevice(design: string, spec: {title: string; icon: IconName; effect?: boolean; heldBy: readonly string[]; note: string}): DeviceInstance {
  const [family, face] = design.split(':') as [string, string]
  const liveSemantic: LiveSemantic = spec.effect ? 'detail-device' : 'device-instrument'
  return {id: design, family, rows: [], values: {},
    face: {id: face, title: spec.title, icon: spec.icon, liveSemantic, heldBy: spec.heldBy, note: spec.note,
      invariant: {generatesAbsent: 'It reads its owner and draws what the owner reports; a reading the owner has not given stays absent.'}}}
}

/** A refusal that names the owner operation no route reaches yet. */
export const missing = (what: string, op: string, owner: string): string => `${what}: no owner operation carries it here — missing op: ${op} (${owner}).`

/** Each key's refusal as its standing. */
export const disabled = (reasons: Readonly<Record<string, string>>): Record<string, Standing> =>
  Object.fromEntries(Object.entries(reasons).map(([key, why]) => [key, {disabled: why}]))

/** Put a reading, keeping absence absent (no null, no NaN, no infinity). */
export function put(values: Record<string, Value>, key: string, value: Value | null | undefined): void {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

/** A write the binding was asked for that no route takes: thrown in words, so the host keeps the person's value and says why. */
export const refusal = (reasons: Readonly<Record<string, string>>, key: string): Error =>
  Error(reasons[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)

// ---------------------------------------------------------------------------------------------------------------- the hand's holds

type Holds = Readonly<Record<string, Readonly<Record<string, Value>>>>
let holds: Holds = {}
const listeners = new Set<() => void>()

/** What the hand holds for a device (its view's own settings: a name typed before Keep, a window before Read over). */
export function heldFor(id: string): Readonly<Record<string, Value>> {
  return holds[id] ?? {}
}

/** Hold (or, with undefined, drop) one of a device's own settings. Never sent to an owner. */
export function hold(id: string, key: string, value: Value | undefined): void {
  const mine = {...(holds[id] ?? {})}
  if (value === undefined) delete mine[key]; else mine[key] = value
  holds = {...holds, [id]: mine}
  for (const listener of [...listeners]) listener()
}

/** The local hands of a device's own keys (DesignBinding.local). */
export const handsFor = (id: string, keys: readonly string[]): Record<string, (value: Value | undefined) => void> =>
  Object.fromEntries(keys.map(key => [key, (value: Value | undefined) => hold(id, key, value)]))

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
/** Re-render when a hold changes. */
export function useHolds(): Holds {
  return useSyncExternalStore(subscribe, () => holds, () => holds)
}

/** For the tests: forget every hold. */
export function resetHolds(): void {
  holds = {}
  for (const listener of [...listeners]) listener()
}
