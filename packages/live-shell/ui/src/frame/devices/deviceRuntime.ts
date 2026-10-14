// The device runtime's model (manual §10.4, FOUNDATION F5): one device, three sizes, the same live settings in each.
// Pure: which rows each size shows, how the whole view groups them, what a light reads, who holds a value, and the plate's
// measures (how wide a compact plate stands, how many columns a control takes, what the power ring's press writes).
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

/** The rows someone else holds now, for the Re-enable slot and each row's hand-back light. */
export function heldRows(device: Pick<DeviceInstance, 'heldBy'>): string[] {
  return Object.keys(device.heldBy ?? {})
}

// ---------------------------------------------------------------------------
// the plate (world-shell-mockup.html:331-347, `dev()` at :1410): a head, then the picture box beside a two-column grid of
// controls, at a fixed width per device.

/** The press on the power ring: the value that turns the device the other way, in the owner's own form, when the owner
 * writes the light's row; null when the light is not the owner's to turn from here (no write path, or no reading to turn). */
export function powerToggle(device: Pick<DeviceInstance, 'enabledKey' | 'values' | 'rows' | 'submit'>): {key: string; value: ParamValue} | null {
  const key = device.enabledKey
  if (!key || !device.submit) return null
  if (!device.rows.some(row => row.key === key && row.writePath)) return null
  const value = device.values[key]
  if (typeof value === 'boolean') return {key, value: !value}
  if (value === 'on' || value === 'off') return {key, value: value === 'on' ? 'off' : 'on'}
  if (value === 1 || value === 0) return {key, value: 1 - value}
  return null
}

/** How the plate draws an enumerated row: a segmented toggle when its choices are few and short enough to read at once (the
 * mockup's `.tog`), else one value box that steps through them. */
export function enumPresentation(row: Pick<SdkParamRow, 'values'>): 'segmented' | 'cycle' {
  const values = row.values ?? []
  return values.length >= 2 && values.length <= 4 && values.join('').length <= 28 ? 'segmented' : 'cycle'
}

/** The columns a row takes in the plate's two-column grid: a knob, a toggle of two or a short choice takes one (the mockup's
 * `.knob`, `.tog.half`); a longer choice and a reading take both (`.tog`). */
export function rowSpan(row: SdkParamRow): 1 | 2 {
  if (!row.writePath) return 2
  if (row.type === 'enumerated' && enumPresentation(row) === 'segmented') {
    const values = row.values ?? []
    return values.length === 2 && values.join('').length <= 8 ? 1 : 2
  }
  return 1
}

/** The plate's measures (world-shell-mockup.html:337-341): border, body padding, the picture box, the gap beside it, one control
 * column and the gap between the two; a device with no controls lets its picture take the body (the mockup's list devices). */
export const PLATE = {border: 2, padding: 14, picture: 104, gap: 10, column: 62, columnGap: 6, body: 236, min: 120, max: 280} as const
// What text takes at the plate's 9.5px: a control's name (it ellipsizes past a column's worth), and a choice of a segmented
// toggle with its 5px padding either side (a choice never ellipsizes on a plate wide enough for it).
const LABEL_CHAR = 5, LABEL_MAX = 84, CHOICE_CHAR = 6, CHOICE_PADDING = 10

function naturalWidth(row: SdkParamRow): number {
  const label = Math.min(LABEL_MAX, row.title.length * LABEL_CHAR)
  if (!row.writePath) return Math.max(label, PLATE.column * 2 + PLATE.columnGap)
  if (row.type === 'enumerated' && enumPresentation(row) === 'segmented') return Math.max(label, (row.values ?? []).reduce((sum, value) => sum + value.length * CHOICE_CHAR + CHOICE_PADDING, 2))
  return Math.max(label, PLATE.column)
}

/** A compact plate's fixed width, derived from what it shows: its picture box beside its controls, one column for one small
 * control and two otherwise, each column as wide as its widest control. Clamped to the mockup's range. */
export function plateWidth(rows: readonly SdkParamRow[], picture: boolean): number {
  if (!rows.length) return picture ? PLATE.body : PLATE.min
  const single = rows.filter(row => rowSpan(row) === 1)
  const column = Math.max(PLATE.column, ...single.map(naturalWidth))
  const twoColumns = rows.length > 1 || single.length < rows.length
  let controls = twoColumns ? column * 2 + PLATE.columnGap : column
  for (const row of rows) if (rowSpan(row) === 2) controls = Math.max(controls, naturalWidth(row))
  const width = PLATE.border + PLATE.padding + (picture ? PLATE.picture + PLATE.gap : 0) + controls
  return Math.min(PLATE.max, Math.max(PLATE.min, Math.round(width)))
}
