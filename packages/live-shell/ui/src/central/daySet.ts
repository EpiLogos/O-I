// Today's set (manual §18.1 "The set": "The Day is Central's set, as a song is Live's … A track: a world you work in today … A scene: a
// row of pages you open together, named as you like"; T-WORLDS §4 W2 "Rows … are kept with the Day"). The set is kept in the Day
// document itself, under its meta (`meta.set`, schema oi.day-set/v1): the worlds brought into today, in order, and the named rows.
// It is written the way the die turns its open face (centralDeviceWrites.ts turnDieFace): the owner's document reading, the retained
// draft held by `DayFormSession`, and the `receiving` `mutate-field` of the Day's `original:meta` field, checked against the revision
// read — no second store and no new owner. A Day made before it kept a set reads as an empty set. Pure apart from `writeDaySet`.
import {DayFormSession, isObject, unmappedChanges, validateDocumentBasis} from '../../../../../desktop/cradle/src/central/dayForm'
import {receiving} from '../../../../../desktop/cradle/src/receiving/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {DayAperture} from './devices/dayBinding'

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
  return {schema: DAY_SET_SCHEMA, tracks, rows}
}

/** The set with a world brought into today, at the end (a world already there stays where it is). Pure. */
export function withWorld(set: DaySet, world: string, name?: string): DaySet {
  if (set.tracks.some(track => track.world === world)) return set
  return {...set, tracks: [...set.tracks, {world, ...(name ? {name} : {})}]}
}

/** The set without a world (its pages stay in its folder; only today's track goes). Pure. */
export function withoutWorld(set: DaySet, world: string): DaySet {
  return {...set, tracks: set.tracks.filter(track => track.world !== world)}
}

/** The set with a row named, holding the given pages (a row of that id is replaced). Pure. */
export function withRow(set: DaySet, row: DaySetRow): DaySet {
  return {...set, rows: [...set.rows.filter(held => held.id !== row.id), row]}
}

/** Write today's set: read the Day document again (the revision the write is checked against), let `change` make the next set from
 * the one it keeps, and write the Day's meta through the owner. Resolves to the revision the owner holds after; nothing is written when
 * the set is unchanged. A Day whose field map has no field for its meta is refused by name, as the die's turn is. */
export async function writeDaySet(transport: KernelTransportStatus, day: DayAperture, change: (set: DaySet) => DaySet): Promise<{revision: string; wrote: boolean}> {
  const reading = await receiving<unknown>(transport, day.project, {kind: 'document', source_ref: day.sourceRef, document_id: day.documentId})
  const basis = validateDocumentBasis(reading, day.sourceRef, day.documentId)
  if (!isObject(basis.payload) || !isObject(basis.payload.meta)) throw new Error('This Day document carries no meta, so it keeps no set.')
  const before = daySetOf(basis.payload)
  const next = change(before)
  if (JSON.stringify(next) === JSON.stringify(before)) return {revision: basis.revision, wrote: false}
  const draft = JSON.parse(JSON.stringify(basis.payload)) as {meta: Record<string, unknown>}
  draft.meta.set = next
  const session = new DayFormSession(basis)
  session.stage(draft)
  const unmapped = unmappedChanges(session.basis, draft)
  if (unmapped.length) throw new Error(`This Day document's field map carries no field for its meta (${unmapped.join(', ')}); the owner admits no set here.`)
  await session.save(input => receiving<unknown>(transport, day.project, {kind: 'mutate-field', ...input}))
  return {revision: session.basis.revision, wrote: true}
}
