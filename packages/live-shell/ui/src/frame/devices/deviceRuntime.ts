// The device runtime's model (manual §10.4, FOUNDATION F5; manual §16.3): one device, one set of live settings in every view.
// Pure: the device as its publishers build it, which rows the compact view shows, how the whole view groups them, and what a light
// reads. The plate itself is the panel kit's (genericDevice.tsx, genericLayout.ts); the light's press is designed.ts
// activatorChange.
import type {DeviceDeclaration, SdkParamRow} from '../../inhabitants/sdk/define'

export type DeviceSize = 'compact' | 'whole' | 'full'
export type ParamValue = number | string | boolean

/** One device as the runtime draws it: its declaration, its rows, and the owner's readings of them. */
export interface DeviceInstance {
  /** A stable id for this device on its chain. */
  id: string
  family: string
  face: DeviceDeclaration
  rows: readonly SdkParamRow[]
  /** The owner's readings, by row key. A key with no reading is unknown, never a default. */
  values: Readonly<Record<string, ParamValue>>
  /** Who holds a row that is not yours right now (an agent, the sky, an instrument), by row key. */
  heldBy?: Readonly<Record<string, string>>
  /** The row whose reading is the device's on/off light, when the device has one. */
  enabledKey?: string
  /** Write rows through the owner (absent: every row is a reading). */
  submit?: (changes: readonly {key: string; value: ParamValue}[]) => Promise<void>
  /** Give back what someone else holds (the hand-back light). */
  handBack?: (key: string) => Promise<void>
}

/** The compact size's controls: the declared macros, else the rows marked compact, else the first write rows — at most four. */
export function compactRows(rows: readonly SdkParamRow[]): SdkParamRow[] {
  // A macro is a macro only when it maps at least one row (lock §5.3); a mapping the owner has not declared is not one.
  const macros = rows.filter(row => (row.macro?.maps.length ?? 0) > 0)
  if (macros.length) return macros.slice(0, 4)
  const marked = rows.filter(row => row.compact)
  if (marked.length) return marked.slice(0, 4)
  return rows.filter(row => row.writePath).slice(0, 4)
}

/** The whole size's rows, grouped by their declared group in first-seen order; ungrouped rows stand under the device's own name. */
export function groupRows(rows: readonly SdkParamRow[], fallback: string): {group: string; rows: SdkParamRow[]}[] {
  const groups = new Map<string, SdkParamRow[]>()
  for (const row of rows) {
    const name = row.group ?? fallback
    groups.set(name, [...(groups.get(name) ?? []), row])
  }
  return [...groups].map(([group, held]) => ({group, rows: held}))
}

/** A light is a reading (manual §10.4): on only when the owner reports on; with no reading it stays dark. */
export function lightOf(device: Pick<DeviceInstance, 'enabledKey' | 'values'>): 'on' | 'off' | 'unknown' {
  if (!device.enabledKey) return 'unknown'
  const value = device.values[device.enabledKey]
  return value === true || value === 'on' || value === 1 ? 'on' : value === false || value === 'off' || value === 0 ? 'off' : 'unknown'
}
