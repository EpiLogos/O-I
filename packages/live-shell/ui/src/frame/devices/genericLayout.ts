// The generic plate's layout (manual §16.12: "A device without views of its own is drawn by the generic plate: its parameters,
// grouped, in the order the device declares them"). Pure: which kit control a row takes (§5), how tall and wide it stands, and how
// a device's rows fill its bands — sections by declared group in declared order, bands of fixed height, pages in the head when two
// bands are not enough (§1 "Nothing scrolls … When a panel holds more than fits, it gets pages in its head"). The measures are
// §3's: a band 168 high, a control column 56 wide, a value box 16 high, a section label 13 high.
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import {compactRows, groupRows} from './deviceRuntime'

/** §3, in px at 100 %. */
export const MEASURE = {head: 22, band: 168, plate: 191, column: 56, dial: 28, box: 16, hit: 22, row: 17, label: 13,
  compactDisplay: [140, 146], wholeDisplay: [194, 146], folded: 22, tile: [136, 136], tileWide: [280, 136], pool: 400} as const

/** The section's own padding (panel.css .dp-sec: 5 above, 6 below, 6 either side — inside its width, which is its control columns'
 * as the kit's Section draws it, panel.tsx Section `cols * COL`) and the gap between rows of controls. */
const SEC_PAD_X = 12, SEC_PAD_Y = 11, GAP = 5
/** The height a section's controls stand in: the band, less the section's padding and its label. */
export const SECTION_BODY = MEASURE.band - SEC_PAD_Y - MEASURE.label

export type ControlKind = 'dial' | 'box' | 'toggle' | 'radio' | 'radio-stack' | 'chooser' | 'field' | 'readout'
export type Place = 'compact' | 'whole' | 'widget'

const CHAR = 5.6
/** What a control has to stand in: one control column inside a section (56 less the section's padding and the grid's gap, ≈ 48),
 * and two (≈ 100). */
const ONE = 48, TWO = 100
const textWidth = (text: string) => Math.ceil(text.length * CHAR)
const ranged = (row: SdkParamRow) => typeof row.range?.min === 'number' && typeof row.range?.max === 'number' && row.range.max > row.range.min

/** The kit control a row takes (§5; §8.1 "Its control fits its values … Do not draw a range or a step that the owner does not have"):
 * a reading for a row with no write path, a toggle for two states, a radio for two to five, a chooser for more; a dial for a number
 * the owner gives a range (a value box where space is short); a number with no range is set as text, never on a made-up scale. */
export function controlOf(row: SdkParamRow, place: Place): ControlKind {
  if (!row.writePath) return 'readout'
  if (row.type === 'boolean') return 'toggle'
  if (row.type === 'enumerated') {
    const values = row.values ?? []
    if (place === 'widget' || values.length > 5 || values.length < 2) return 'chooser'
    const across = values.reduce((sum, value) => sum + textWidth(value) + 10, 0)
    return across <= TWO ? 'radio' : Math.max(...values.map(textWidth)) + 10 <= TWO ? 'radio-stack' : 'chooser'
  }
  if (row.type === 'number' || row.type === 'duration') {
    if (!ranged(row)) return 'field'
    return place === 'whole' || place === 'compact' ? 'dial' : 'box'
  }
  if (row.type === 'string') return 'field'
  return 'readout'
}

export interface Cell {
  readonly row: SdkParamRow
  readonly kind: ControlKind
  /** Control columns it spans. */
  readonly span: 1 | 2
  /** Its height in px, its label included. */
  readonly height: number
}

/** A control's measure in its section (§3: dial 28 under its 12 px name and over its value; value box, toggle, radio, chooser 16). */
export function cellOf(row: SdkParamRow, place: Place, value?: string): Cell {
  const kind = controlOf(row, place)
  const named = 12 + 2
  switch (kind) {
    case 'dial': return {row, kind, span: 1, height: named + MEASURE.dial + 2 + 12}
    case 'box': return {row, kind, span: textWidth(row.title) > ONE ? 2 : 1, height: named + MEASURE.box}
    case 'toggle': return {row, kind, span: textWidth(row.title) + 14 > ONE ? 2 : 1, height: MEASURE.box}
    case 'radio': {
      const across = (row.values ?? []).reduce((sum, choice) => sum + textWidth(choice) + 10, 0)
      return {row, kind, span: across > ONE ? 2 : 1, height: named + MEASURE.box}
    }
    case 'radio-stack': {
      const wide = Math.max(...(row.values ?? []).map(textWidth)) + 10
      return {row, kind, span: wide > ONE ? 2 : 1, height: named + (row.values?.length ?? 2) * (MEASURE.box - 1) + 1}
    }
    case 'chooser': case 'field': return {row, kind, span: 2, height: named + MEASURE.box}
    case 'readout': {
      const wide = Math.max(textWidth(row.title), textWidth(value ?? '—') * 1.1)
      return {row, kind, span: wide > ONE ? 2 : 1, height: 14 + 12}
    }
  }
}

/** The height of cells laid row by row across `cols` control columns (the kit section's grid, panel.css .dp-sec-body). */
export function stackHeight(cells: readonly Cell[], cols: number): number {
  let height = 0, rowHeight = 0, used = 0, rows = 0
  for (const cell of cells) {
    const span = Math.min(cell.span, cols)
    if (used + span > cols) { height += rowHeight; rows++; used = 0; rowHeight = 0 }
    used += span
    rowHeight = Math.max(rowHeight, cell.height)
  }
  if (used) { height += rowHeight; rows++ }
  return height + Math.max(0, rows - 1) * GAP
}

export interface SectionPlan {
  readonly label: string
  readonly cols: number
  readonly cells: readonly Cell[]
  /** Its width on the band, padding included (the rule before it is the band's). */
  readonly width: number
}

const sectionWidth = (cols: number) => cols * MEASURE.column

/** One group as sections: the fewest control columns whose stack stands within the band; a group taller than the widest section
 * the band allows continues in a second section under the same name. */
export function planGroup(label: string, cells: readonly Cell[], maxCols: number, body = SECTION_BODY): SectionPlan[] {
  const out: SectionPlan[] = []
  let rest = [...cells], part = 0
  while (rest.length) {
    const need = Math.max(...rest.map(cell => cell.span))
    let cols = Math.min(maxCols, need)
    while (cols < maxCols && stackHeight(rest, cols) > body) cols++
    let take = rest.length
    while (take > 1 && stackHeight(rest.slice(0, take), cols) > body) take--
    const cellsHere = rest.slice(0, take)
    out.push({label: part ? `${label} ${part + 1}` : label, cols, cells: cellsHere, width: sectionWidth(cols)})
    rest = rest.slice(take)
    part++
  }
  return out
}

export interface BandPlan {readonly sections: readonly SectionPlan[]; readonly picture: boolean}
export interface PagePlan {readonly id: string; readonly label: string; readonly bands: readonly BandPlan[]}

/** The whole view (§2 "Every parameter, grouped, and the display with all its handles"; "one or two bands high. Pages when more is
 * needed"): the display first on band one, then each group's sections in declared order, filling bands of the plate's inner width;
 * two bands to a page. */
export function planWhole(rows: readonly SdkParamRow[], fallback: string, opts: {width?: number; picture?: boolean; values?: (row: SdkParamRow) => string} = {}): PagePlan[] {
  const inner = (opts.width ?? MEASURE.pool) - 2
  const maxCols = Math.max(1, Math.floor(inner / MEASURE.column))
  const sections = groupRows(rows, fallback).flatMap(group => planGroup(group.group, group.rows.map(row => cellOf(row, 'whole', opts.values?.(row))), maxCols))
  const bands: {sections: SectionPlan[]; picture: boolean; used: number}[] = []
  const picture = MEASURE.wholeDisplay[0] + SEC_PAD_X
  let band = {sections: [] as SectionPlan[], picture: !!opts.picture, used: opts.picture ? picture : 0}
  for (const section of sections) {
    if (band.used && band.used + section.width > inner) { bands.push(band); band = {sections: [], picture: false, used: 0} }
    band.sections.push(section)
    band.used += section.width
  }
  if (band.sections.length || band.picture || !bands.length) bands.push(band)
  const pages: PagePlan[] = []
  for (let at = 0; at < bands.length; at += 2) {
    const held = bands.slice(at, at + 2).map(({sections: s, picture: p}) => ({sections: s, picture: p}))
    const first = held.flatMap(b => b.sections)[0]
    pages.push({id: `p${pages.length + 1}`, label: first ? first.label : fallback, bands: held})
  }
  return pages
}

/** The compact view's controls (§2 "The display and up to four macros"): the declared macros, else the rows marked compact, else
 * the first write rows — never the activator's own row. */
export function compactCells(rows: readonly SdkParamRow[], enabledKey?: string): Cell[] {
  return compactRows(rows.filter(row => row.key !== enabledKey)).map(row => cellOf(row, 'compact'))
}

/** The compact section: two control columns as Live's macros stand (2 × 2 dials), more only where a control is wide and tall. */
export function planCompact(cells: readonly Cell[]): SectionPlan | null {
  if (!cells.length) return null
  return planGroup('', cells, 4)[0]!
}

/** A row's value as a control shows it: a number to the precision its size asks, its unit after it; a switch on or off; a word
 * as it is; no reading "—". */
export function formatValue(row: Pick<SdkParamRow, 'unit' | 'range' | 'type'>, value: unknown): string {
  if (value === undefined || value === null || (typeof value === 'number' && !Number.isFinite(value))) return '—'
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (typeof value === 'number') {
    const magnitude = Math.abs(value)
    const text = Number.isInteger(value) || magnitude >= 100 ? String(Math.round(value)) : magnitude >= 10 ? value.toFixed(1) : value.toFixed(2).replace(/0$/, '')
    const unit = row.range?.unit ?? row.unit
    return unit ? `${text} ${unit}` : text
  }
  return String(value)
}
