// Today's set (manual §18.1 "The set": "The Day is Central's set, as a song is Live's … A track: a world you work in today … A scene: a
// row of pages you open together, named as you like"; T-WORLDS §4 W2 "Rows … are kept with the Day"). The set is kept in the Day
// document itself, under its meta (`meta.set`, schema oi.day-set/v1): the worlds brought into today, in order, and the named rows.
// Since O-I #1004 the set is the kernel's Central Set (its seat and row acts are Actions); this reads the Day's own `meta.set` for the
// readings that show it, and writes nothing. A Day made before it kept a set reads as an empty set. Pure.
import {isObject, validateDocumentBasis} from '../../../../../desktop/cradle/src/central/dayForm'
import type {CentralGroundReading} from '../../../../../desktop/cradle/src/central/client'
import {currentDayOf} from './centralVertical'

export const DAY_SET_SCHEMA = 'oi.day-set/v1'

/** A world brought into today: its ref (the register's wiki space, Central's own disclosure), and the name the track shows. */
export interface DaySetTrack {
  readonly world: string
  readonly name?: string
}

/** A row of pages opened together (a scene): its name and the pages it holds, by their file refs. */
export interface DaySetRow {
  readonly id: string
  readonly name: string
  readonly pages: readonly string[]
}

export interface DaySet {
  readonly schema: typeof DAY_SET_SCHEMA
  readonly tracks: readonly DaySetTrack[]
  readonly rows: readonly DaySetRow[]
  /** The Days this set carried from, oldest first (manual §18.1 "What carries to tomorrow": "with today added to its history"). A set
   * made fresh carries none. */
  readonly lineage?: readonly string[]
}

export const EMPTY_SET: DaySet = {schema: DAY_SET_SCHEMA, tracks: [], rows: []}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)

/** The set a Day document's payload keeps (its `meta.set`), read as the schema says and nothing more: a track without a world and a
 * row without an id or a name are left out. A Day with none keeps an empty set. Pure. */
export function daySetOf(payload: unknown): DaySet {
  const meta = isObject(payload) && isObject(payload.meta) ? payload.meta : null
  const set = meta && isObject(meta.set) ? meta.set : null
  if (!set || set.schema !== DAY_SET_SCHEMA) return EMPTY_SET
  const tracks = (Array.isArray(set.tracks) ? set.tracks : []).flatMap((track): DaySetTrack[] => {
    if (!isObject(track) || !text(track.world)) return []
    return [{world: track.world as string, ...(text(track.name) ? {name: track.name as string} : {})}]
  })
  const rows = (Array.isArray(set.rows) ? set.rows : []).flatMap((row): DaySetRow[] => {
    if (!isObject(row) || !text(row.id) || !text(row.name)) return []
    return [{id: row.id as string, name: row.name as string, pages: (Array.isArray(row.pages) ? row.pages : []).filter((page): page is string => !!text(page))}]
  })
  const lineage = (Array.isArray(set.lineage) ? set.lineage : []).filter((day): day is string => !!text(day))
  return {schema: DAY_SET_SCHEMA, tracks, rows, ...(lineage.length ? {lineage} : {})}
}

/** Today's set as the Day keeps it: read, or why it cannot be (the Day not opened yet, its document not made). */
export type CentralSetReading =
  | {state: 'reading'}
  | {state: 'none'; reason: string}
  | {state: 'read'; set: DaySet; civilDate: string}

/** Today's set as the ground reads the Day: its document's `meta.set`, or why there is none. Pure. */
export function setReadingOf(ground: CentralGroundReading | null, error: string | null): CentralSetReading {
  if (!ground) return error ? {state: 'none', reason: error} : {state: 'reading'}
  const {standing} = currentDayOf(ground)
  if (!standing) return {state: 'reading'}
  if (standing.state === 'uninitialised') return {state: 'none', reason: `today's Day has no page yet: Central makes it at the Day's turn (${standing.op})`}
  if (standing.state === 'refused' || standing.state === 'unopened') return {state: 'none', reason: standing.message}
  const reading = ground.day.data!
  const basis = validateDocumentBasis(reading.document, standing.sourceRef, standing.documentId)
  return {state: 'read', set: daySetOf(basis.payload), civilDate: standing.civilDate}
}

