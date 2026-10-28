// Today's set (manual §18.1 "The set": "The Day is Central's set, as a song is Live's … A track: a world you work in today … A scene: a
// row of pages you open together, named as you like"; T-WORLDS §4 W2 "Rows … are kept with the Day"). The set is kept in the Day
// document itself, under its meta (`meta.set`, schema oi.day-set/v1): the worlds brought into today, in order, and the named rows.
// It is written the way the die turns its open face (centralDeviceWrites.ts turnDieFace): the owner's document reading, the retained
// draft held by `DayFormSession`, and the `receiving` `mutate-field` of the Day's `original:meta` field, checked against the revision
// read — no second store and no new owner. A Day made before it kept a set reads as an empty set. Pure apart from `writeDaySet`.
import {DayFormSession, isObject, unmappedChanges, validateDocumentBasis} from '../../../../../desktop/cradle/src/central/dayForm'
import {receiving} from '../../../../../desktop/cradle/src/receiving/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {CentralGroundReading} from '../../../../../desktop/cradle/src/central/client'
import {canCloseDay, civilDayName, currentDayOf, type DayAperture} from './devices/dayBinding'

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

/** Tomorrow's set from a closed Day's (manual §18.1 "What carries to tomorrow": "When the day closes, what still plays carries into
 * tomorrow's set, playing, with today added to its history … What you stopped leaves tomorrow's grid"): the worlds of the set that
 * hold a page still playing, in their order, then the world of any other playing page; each row with only its playing pages, a row
 * left with none dropped; the closed Day added to the lineage. Your world is every set's first track, so it is not named. The pages
 * keep playing on their own: Central carries their NOW clearings across the boundary (central.day.ensure "the live NOW horizon
 * crosses the Day boundary untouched"). Pure. */
export function carriedSet(closed: DaySet, closedDay: string, playing: readonly string[], worldOfPage: (pageRef: string) => {readonly ref: string; readonly name?: string; readonly yours?: boolean} | null): DaySet {
  const plays = new Set(playing)
  const worlds = playing.flatMap(ref => { const world = worldOfPage(ref); return world && !world.yours ? [world] : [] })
  const held = new Set(worlds.map(world => world.ref))
  let set: DaySet = {schema: DAY_SET_SCHEMA, tracks: closed.tracks.filter(track => held.has(track.world)), rows: [], lineage: [...(closed.lineage ?? []), closedDay]}
  for (const world of worlds) set = withWorld(set, world.ref, world.name)
  const rows = closed.rows.flatMap(row => { const pages = row.pages.filter(page => plays.has(page)); return pages.length ? [{...row, pages}] : [] })
  return {...set, rows}
}

/** Why a world cannot come into today's set now, or null when it can (manual §18.1 "To bring a world into today, drag it from the
 * browser onto an empty track"). Today's set is kept in today's Day, so the refusal is the Day's: the Day Central names and civil today,
 * in the owner's words, and the press on the Day device that opens today (§18.2 Whole, Close: "Close routine, Close now, Open today").
 * While Central names an earlier Day the kernel reads it `stale` (central.rs Request::Inspect); the owner would take the set's write
 * into that earlier Day (central.document.mutate does not refuse it), which is no world in today. Close now closes the Day Central
 * names and opens tomorrow's (central.day.close-carry); Open today then points at today and makes its document (centralDeviceWrites.ts
 * openToday). Pressing Open today first would leave the earlier Day open with no press to close it, so Close now is named first while
 * the Day Central names can still be closed (canCloseDay). Pure. */
export function bringInRefusal(world: string, ground: CentralGroundReading | null, error: string | null): string | null {
  if (!ground) return error ? `${world} cannot come into today: Central's ground did not answer: ${error}` : `${world} cannot come into today yet: Central's Day is still being read.`
  const {standing, pointer} = currentDayOf(ground)
  if (!standing) return `${world} cannot come into today yet: Central's Day is still being read.`
  if (standing.state === 'ready') return null
  const kept = `${world} cannot come into today: today's set is kept in today's Day`
  const again = `then bring ${world} in again.`
  const today = ground.time.state === 'ready' ? ground.time.data?.civil_date ?? null : null
  const named = (date: string) => civilDayName(date) ?? date
  if (standing.state === 'uninitialised') {
    return `${kept}, and ${named(standing.civilDate)} has no document yet (${standing.op}). On the Day device, press Open today to make it; ${again}`
  }
  if (pointer && today && pointer !== today) {
    const press = canCloseDay(ground) ? `press Close now to close ${named(pointer)}, then Open today` : 'press Open today'
    return `${kept}, and the Day Central names is ${named(pointer)}, not today, ${named(today)} (Central: "${standing.message}"). On the Day device, ${press}; ${again}`
  }
  return `${kept}, which Central did not read: ${standing.message}`
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
