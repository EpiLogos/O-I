// The designed-device contract as the shell hosts it (docs/dlw/DLW.md §16.3, §8, §11). The contract's one source is the
// catalogue's (inhabitants/catalogue/panels/design.ts: DesignedDevice, ViewProps, Values, Nav — "The host owns the values and the
// navigation; a view only reads them and asks for changes"); this module re-exports it for the shell's callers and adds what the
// shell brings a view (§8 "The shell brings the values, the writes, the navigation between views, and the standing of each
// parameter"): the binding a device is hosted on, the standing of each value, and the places' own marks. Pure.
import type {ReactNode} from 'react'
import type {DesignedDevice, Nav, Value, Values, ViewProps} from '../../inhabitants/catalogue/panels/design'
import type {Standing} from '../../inhabitants/sdk/panel'
import type {DeviceInstance, ParamValue} from './deviceRuntime'

export type {DesignedDevice, Nav, Value, Values, ViewProps, Standing}

/** The six views of one device (the catalogue's ViewName, design.ts; d18c911a3): Folded and Compact on a chain, Whole in the pool or
 * as the expanded view above the chain, Full in a pane, Pop-out in the device's own window, Widget on the rail. */
export type DeviceViewName = 'folded' | 'compact' | 'whole' | 'full' | 'popout' | 'widget'
export const DEVICE_VIEWS: readonly DeviceViewName[] = ['folded', 'compact', 'whole', 'full', 'popout', 'widget']

/** The navigation a place gives a view: the catalogue's Nav (select, expand, full, popout, fold, unfold, rail, close), and the place's
 * own marks. */
export interface HostNav extends Nav {
  /** The expanded view stands above the chain: the head's ▸ shows ▾, pressed (sdk/panel.tsx Place.expanded). */
  readonly expanded?: boolean
  /** The marks the place gives the device's head, before ⤢ (a pop-out, a redock; manual §16.8): the generic plate draws them in its
   * head, and the host hands them to a design's kit head when the design draws none of its own (deviceHost.tsx withPlaceMarks). */
  readonly marks?: ReactNode
}

/** What the host hands a view: the catalogue's ViewProps, the standing of each value (manual §16.10: waiting, refused, held,
 * automated, modulated, disabled), and the extended navigation. A view written to ViewProps alone reads it unchanged. */
export interface HostedViewProps extends ViewProps {
  readonly nav: HostNav
  /** The standing of each value by key; a key with nothing to show has none. */
  readonly standing?: Readonly<Record<string, Standing>>
  /** The owner's readings alone, without what the hand holds or what waits on the owner: a light reads these (manual §16.8 "The
   * light changes only when the owner answers"). */
  readonly owner?: Values
  /** Why this view stands in for the device's own: its design's view did not draw (deviceHost.tsx ViewBoundary). The generic plate
   * says it on the status bar's Info line. */
  readonly fault?: string
}

/** One change a view asks the owner for. */
export interface ValueChange {
  readonly key: string
  readonly value: Value
}

/** The wiring of one device to its owner, as the shell hands it to the host (lead, 16 Oct: "the design's value keys mapped to
 * owner readings"). The owners write; the views read. */
export interface DesignBinding {
  /** The device's id on its chain. */
  readonly id: string
  /** The owner's readings by value key. A key with no reading is unknown — absent here, never a default (manual §16.11). */
  readonly values: Values
  /** Send changes to the owner. Absent: nothing here writes, and every value is a reading. A refusal rejects with the owner's
   * own words. */
  readonly write?: (changes: readonly ValueChange[]) => Promise<void>
  /** Whether the owner takes a change of this key (absent: every key the owner is asked for). */
  readonly writes?: (key: string) => boolean
  /** Who holds a value that is not yours right now (an agent, the sky, an instrument), by key. */
  readonly heldBy?: Readonly<Record<string, string>>
  /** Give back what someone else holds. */
  readonly handBack?: (key: string) => Promise<void>
  /** The key whose reading is the device's on/off light. */
  readonly enabledKey?: string
  /** What moves a value, by key (the status bar names it). */
  readonly modulatedBy?: Readonly<Record<string, string>>
  /** Who moved a value just now, by key, where the owner knows it was not the hand (an agent's write, the sky): the name stands on the
   * control with the ring for a moment. Absent, the host names the holder or the modulator, if the value has one. */
  readonly movedBy?: Readonly<Record<string, string>>
  /** The owner has been asked for its first reading and has not answered (manual §16.10, "A reading that has not come yet"): `true` for
   * every value that has no reading, or the keys that wait. A value that has a reading never waits: it shows at once and is asked again
   * behind it. */
  readonly waiting?: boolean | readonly string[]
  /** Standing the owner reports beyond the shell's own (automation, a reason a value cannot act now), by key. */
  readonly standing?: Readonly<Record<string, Standing>>
  /** Keys the view holds, not the owner (a raised reach before Confirm, an ask before Trust), each with the binding's own hand. Every
   * set of one — a value, or its drop (`set(key, undefined)`, a Cancel) — goes to that hand at once: never to `write`, never drawn
   * waiting or refused. Its reading is in `values`, as the hand left it. */
  readonly local?: Readonly<Record<string, (value: Value | undefined) => void>>
}

/** The shell's earlier name for the binding (the ticket's DeviceBinding). */
export type DeviceBinding = DesignBinding

/** The binding of a device of the runtime: its rows' keys are its value keys, its readings the owner's, its submit the write
 * (deviceRuntime.ts DeviceInstance, the shape every publisher already builds — ported from DeviceView.tsx:31, where the submit was
 * the plate's one write path). */
export function bindingOf(device: DeviceInstance): DesignBinding {
  const writable = new Set(device.rows.filter(row => row.writePath).map(row => row.key))
  const known = new Set(device.rows.map(row => row.key))
  const modulatedBy: Record<string, string> = {}
  for (const row of device.rows) if (row.modulatedBy) modulatedBy[row.key] = row.modulatedBy
  const values: Record<string, ParamValue> = {}
  for (const [key, value] of Object.entries(device.values)) if (value !== undefined && value !== null) values[key] = value
  return {
    id: device.id,
    values,
    ...(device.submit ? {write: device.submit} : {}),
    // A row with no write path is a reading (lock §0.4); a key the device does not declare is the owner's to refuse.
    writes: key => !known.has(key) || writable.has(key),
    ...(device.heldBy ? {heldBy: device.heldBy} : {}),
    ...(device.handBack ? {handBack: device.handBack} : {}),
    ...(device.enabledKey ? {enabledKey: device.enabledKey} : {}),
    ...(Object.keys(modulatedBy).length ? {modulatedBy} : {}),
  }
}

/** The device's light, from the owner's reading only (manual §10.4: "on only when the device reports that it is on"). */
export function lightOfBinding(binding: Pick<DesignBinding, 'enabledKey' | 'values'>): 'lit' | 'dark' | 'unknown' {
  if (!binding.enabledKey) return 'unknown'
  const value = binding.values[binding.enabledKey]
  return value === true || value === 'on' || value === 1 ? 'lit' : value === false || value === 'off' || value === 0 ? 'dark' : 'unknown'
}

/** The press on the activator: the owner's own form of the other state, or null where the light is not the owner's to turn from
 * here (ported from deviceRuntime.ts powerToggle, which it replaces). */
export function activatorChange(binding: DesignBinding): ValueChange | null {
  const key = binding.enabledKey
  if (!key || !binding.write || (binding.writes && !binding.writes(key))) return null
  const value = binding.values[key]
  if (typeof value === 'boolean') return {key, value: !value}
  if (value === 'on' || value === 'off') return {key, value: value === 'on' ? 'off' : 'on'}
  if (value === 1 || value === 0) return {key, value: 1 - value}
  return null
}
