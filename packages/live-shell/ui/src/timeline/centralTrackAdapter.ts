// Central's five streams as tracks for the shared Session and Arrangement (T-TRACKS-CENTRAL; manual §3 "In Central the day is
// a track, and so are your Flows, the people and things you are writing about, and your goals", "In Central, the day's face
// stands the entries you made while it was turned up"; lock §9.1 Central row: track = a stream, clip = an entry or document,
// stop = the day's face standing its entries, takes = revisions).
//
// Projection, over two reads Central mode already makes — nothing is copied into a second store, nothing is written:
// - tracks: Day, Flows, Beings, Things, Goals, always in that order (`central:stream:<name>`). Only Day has an owner read
//   today; the other four are `waiting` in the mode grammar (shell/modeGrammar.ts, the `base` browser) and stand as named,
//   empty tracks whose owner's absence is in the track's `kind` text (the grid's name tooltip), never a fabricated clip;
// - Day's clips: the day records (the browser's Days rows: `files_list` at the root register's day surface, ported from
//   shell/ModeBrowser.tsx DaysRows) and the day's entries (the World cut's own day lane — timeline/dayTrackAdapter.ts — the
//   same clips under the same ids, so the shell's existing occasion route opens an entry in the Clip side);
// - rows (stops): a row is a DAY, and a day is one stop, newest first as the browser lists them (lock §9.1 Central row: "stop =
//   the day's face (the die) standing its entries"; manual §3: "In Central, the day's face stands the entries you made while it
//   was turned up. A stop stands several things together."; mockup `docgrid`: the Day track's clips are days, not entries, and the
//   entries lie on `tl-today`, the Arrangement). The shared grid draws one clip per track per row, so the Day track's slot in a
//   day's row is the day's FACE: the day record, when the owner lists one (its label carries the count of entries it stands), else
//   the day's first entry, which opens as the occasion it is, with the day it stands in. The day's other entries are clips of the same track in the same row — the
//   Arrangement lays each on the ruler at its instant, the Clip side opens each as the occasion it is — and the grid's slot shows
//   the clip the set lists LAST, so the face is listed last; tests/central-tracks.test.mjs renders the grid to hold that. The
//   stop itself is also a walk (the contract's own "stop stands a clip and reaches the rest": `walks`, kind `day`): its `clipId`
//   is the face and its `also` every other entry of the day, nothing dropped (lock §7.2; worldTrackAdapter.ts WorldWalkStop);
// - ruler: the covered civil days laid end to end, as the World cut's own week strip tiles them. The ruler starts at 0, so it
//   cannot carry absolute unix time: each covered day is one 1440-minute segment, and an entry stands at its instant's minutes
//   from its civil day's UTC midnight, held inside that day (the owner's day_ref names the civil day; the reading publishes no
//   timezone to this pane, so the ruler says UTC and an entry just past a local midnight stands at its day's opening, never in
//   the day before). An entry the reading gives no instant, or whose day names no date, stands in a first "no time" segment, in
//   order, with no date invented for it. A day record stands at its day's opening as a locator, not a span.
//
// A clip's id is the ref THE selection already speaks: a day record's is its Central-relative path (what the browser's Days
// row selects, App.tsx selectCentralSubject), an entry's is the World cut's clip id (what `worldView.source.eventByClipId`
// resolves to the retained occasion). The owner discloses no run state, launch or revision read for these, so no clip carries
// a status, a launch or takes and the set has no actions: the grid is honest and read-only (manual §3: entries are read, not
// launched — lock §9.4).
//
// Pure TypeScript. No React, no transport.
import {browserCategoriesOf, type ModeBrowserCategory} from '../shell/modeGrammar'
import {dayClipEventIndex, dayTrackLaneOf, projectDayTracks} from './dayTrackAdapter'
import {eventDayKey, type TemporalEventRow, type TemporalStreamAbsence} from './timeSpine'
import type {WorldTrack, WorldTrackAdapter, WorldTrackClip, WorldTrackColumn, WorldTrackSet, WorldWalk, WorldWalkStop} from './worldTrackAdapter'
import type {WorldTimelineSource} from '../projections/useWorldTemporalReading'
import {CENTRAL_DAYS_PATH, dateOfDayPath, dayEntriesOf} from '../central/daySurface'
import type {NativeFileEntry} from '../../../../../desktop/cradle/src/kernel/types'

export const CENTRAL_TRACK_ADAPTER_ID = 'central-stream-tracks'

/** The root register's day surface — where the civil calendar's records live. Ported from shell/ModeBrowser.tsx
 * `DAY_RECORDS_PATH` (line 52); tests/central-tracks.test.mjs holds the two together. */
/** The owner's day surface (central/daySurface.ts); the legacy agent records stopped at 12 Sep. */
export const CENTRAL_DAY_RECORDS_PATH = CENTRAL_DAYS_PATH

/** The day-track lane kind the World cut gives Central's own day (dayTrackAdapter.ts LANES: 'central-day'). A Day clip is an
 * event that lane draws — the lane table is the World cut's, not a second one here. */
const DAY_LANE_KIND = 'day'

const MINUTES_PER_DAY = 1440

/** The five streams, in the order the manual and the lock give them. `category` is the mode grammar's browser category for
 * the stream; `readable` marks the streams this adapter has an owner read for. `colour` is the mockup's column identity as
 * the shell's tokens (shell/modeSurface.css `--mode-*`), falling back to the track default where a scope does not define them. */
const STREAMS = [
  {id: 'day', name: 'Day', category: 'central-days', readable: true, colour: 'var(--mode-day, var(--track-default, var(--bg-3)))'},
  {id: 'flows', name: 'Flows', category: 'central-flows', readable: false, colour: 'var(--mode-flows, var(--track-default, var(--bg-3)))'},
  {id: 'beings', name: 'Beings', category: 'central-beings', readable: false, colour: 'var(--mode-beings, var(--track-default, var(--bg-3)))'},
  {id: 'things', name: 'Things', category: 'central-things', readable: false, colour: 'var(--mode-things, var(--track-default, var(--bg-3)))'},
  {id: 'goals', name: 'Goals', category: 'central-goals', readable: false, colour: 'var(--mode-goals, var(--track-default, var(--bg-3)))'},
] as const

export type CentralStreamId = (typeof STREAMS)[number]['id']
/** The five stream ids, in track order. */
export const CENTRAL_STREAM_IDS: readonly CentralStreamId[] = STREAMS.map(stream => stream.id)
/** A stream's track id. */
export const centralStreamTrackId = (stream: CentralStreamId): string => `central:stream:${stream}`

/** One day record the owner lists. `path` is the Central-relative path the browser's Days row selects. */
export interface CentralDayRecord {
  /** The file name, `YYYY-MM-DD.md`. */
  name: string
  path: string
  byteLen: number | null
}

/** The day records, as the owner's listing stands. */
export type CentralDayRecordsReading =
  | {state: 'reading'}
  | {state: 'unavailable'; reason: string}
  | {state: 'read'; records: readonly CentralDayRecord[]}

/** The World cut's one temporal read, as the pane is given it. */
export type CentralCivilReading =
  | {state: 'reading'}
  | {state: 'unavailable'; reason: string}
  | {state: 'live'; events: TemporalEventRow[]; absences: readonly TemporalStreamAbsence[]}

export interface CentralReading {
  records: CentralDayRecordsReading
  civil: CentralCivilReading
}

/** The day records in an owner directory listing (`central.directory-reading/v1`). Ported from shell/ModeBrowser.tsx DaysRows:
 * only `YYYY-MM-DD.md` files are day records (line 200), newest first (line 202), and a record's path is the listing's own
 * location path (line 211). */
export function dayRecordsOf(directory: {entries: readonly {name: string; byte_len?: number | null; location?: {path?: string} | null}[]}): CentralDayRecord[] {
  return dayEntriesOf(directory.entries as NativeFileEntry[])
    .map(entry => ({name: entry.name, path: entry.location?.path ?? `${CENTRAL_DAY_RECORDS_PATH}/${entry.name}`, byteLen: entry.byte_len || null}))
    .sort((a, b) => b.name.localeCompare(a.name))
}

/** The Central ground subject a clip id names, when it is a day record's path — the subject the Document detail opens
 * (CentralSubjectSelection, inhabitants/CentralSubjectDetail.tsx). The regular expression is the browser's own
 * (shell/ModeBrowser.tsx line 295). An entry's clip id (an occasion) is not a ground subject: null. */
export function centralSubjectOfClip(ref: string): {kind: 'day'; path: string} | null {
  return dateOfDayPath(ref) ? {kind: 'day', path: ref} : null
}

const isDate = (key: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(key)
const shortDay = (key: string): string => (isDate(key) ? key.slice(5) : key)
const dayStartMs = (key: string): number => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
const clock = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

interface Entry {
  clip: WorldTrackClip
  /** The civil day the owner's reading puts it in; null when it names none and carries no instant. */
  key: string | null
  /** The event's instant, when the reading carries one. */
  instant: number | null
  /** Its minutes from its civil day's UTC midnight, held inside the day; null when it cannot be placed on the ruler. */
  minute: number | null
}

/** The day's entries: the events the World cut's day lane draws for Central's own day, as the World cut labels and ids them
 * (dayTrackAdapter.ts projectDayTracks + dayClipEventIndex walk the same sequence, so a clip id recovers its event). */
function dayEntries(events: TemporalEventRow[]): Entry[] {
  const index = dayClipEventIndex(events)
  const entries: Entry[] = []
  for (const clip of projectDayTracks(events).clips) {
    const event = index.get(clip.id)
    if (!event || dayTrackLaneOf(event)?.kind !== DAY_LANE_KIND) continue
    const key = eventDayKey(event)
    const instant = event.instant_unix_ms != null && Number.isFinite(event.instant_unix_ms) ? event.instant_unix_ms : null
    const minute = instant !== null && key !== null && isDate(key)
      ? Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round((instant - dayStartMs(key)) / 60000)))
      : null
    entries.push({clip, key, instant, minute})
  }
  return entries
}

/** The Day track's `kind` text — what the track discloses about its reads, shown in the grid's name tooltip. */
function dayKindText(reading: CentralReading, records: number, entries: number): string {
  const parts: string[] = []
  const r = reading.records
  parts.push(r.state === 'read' ? plural(records, 'day record', 'day records') : r.state === 'reading' ? 'day records being read' : `day records unread (${r.reason})`)
  const c = reading.civil
  parts.push(c.state === 'live' ? `${plural(entries, 'entry', 'entries')} from the civil field` : c.state === 'reading' ? 'civil field being read' : `civil field unread (${c.reason})`)
  if (c.state === 'live') {
    for (const absence of c.absences) {
      // Which streams the Day track draws is the World cut's day lane's to say (dayTrackLaneOf), not a list kept here.
      if (dayTrackLaneOf({stream: absence.stream, subject_ref: ''})?.kind !== DAY_LANE_KIND) continue
      parts.push(`${absence.stream} gave nothing: ${absence.reason}${absence.owner_words ? ` — ${absence.owner_words}` : ''}`)
    }
  }
  if (entries > 0) parts.push('a day\'s face stands its entries: the Session draws the face, the Arrangement every entry')
  return `stream · ${parts.join(' · ')}`
}

/** A stream with no reader here: its owner's absence, in the mode grammar's own words. */
function waitingKindText(category: ModeBrowserCategory | undefined, label: string): string {
  if (!category) return 'stream · waiting — no owner read is declared for this stream'
  if (category.state === 'waiting') return `stream · waiting — ${category.hint}`
  return `stream · ${label} lists in the browser, but this Session reads none of it yet`
}

/** The World cut's temporal read as the Day track's entries read it. */
export function civilReadingOf(source: WorldTimelineSource | undefined): CentralCivilReading {
  if (!source) return {state: 'unavailable', reason: 'the shell publishes no civil reading to this pane'}
  if (source.status === 'live') return {state: 'live', events: source.events, absences: source.absences}
  if (source.status === 'reading') return {state: 'reading'}
  return {state: 'unavailable', reason: source.error ?? 'the kernel temporal read is unavailable'}
}

export function projectCentralTracks(reading: CentralReading): WorldTrackSet {
  const records = reading.records.state === 'read' ? reading.records.records : []
  const entries = reading.civil.state === 'live' ? dayEntries(reading.civil.events) : []
  const categories = browserCategoriesOf('base')

  // Every day the reading names: the days that have a record, and the days that have entries.
  const recordByDay = new Map<string, CentralDayRecord>()
  for (const record of records) recordByDay.set(record.name.replace(/\.md$/, ''), record)
  const entriesByDay = new Map<string | null, Entry[]>()
  for (const entry of entries) {
    const group = entriesByDay.get(entry.key)
    if (group) group.push(entry)
    else entriesByDay.set(entry.key, [entry])
  }
  const dayKeys = [...new Set<string>([...recordByDay.keys(), ...[...entriesByDay.keys()].filter((key): key is string => key !== null)])]

  // The ruler: an optional first segment for entries with no instant, then each day that has a record or a placed entry.
  const unplaced = entries.filter(entry => entry.minute === null)
  const rulerKeys = [...new Set<string>([...recordByDay.keys(), ...entries.filter(entry => entry.minute !== null && entry.key !== null).map(entry => entry.key as string)])].sort()
  const segments: {key: string | null; start: number}[] = []
  if (unplaced.length) segments.push({key: null, start: 0})
  for (const key of rulerKeys) segments.push({key, start: segments.length * MINUTES_PER_DAY})
  const startOfDay = new Map(segments.filter(segment => segment.key !== null).map(segment => [segment.key as string, segment.start]))
  const unplacedAt = new Map(unplaced.map((entry, order) => [entry.clip.id, order]))

  const dayTrack = centralStreamTrackId('day')
  const columns: WorldTrackColumn[] = []
  const clips: WorldTrackClip[] = []
  const stops: WorldWalkStop[] = []
  const entryClip = (entry: Entry, columnId: string): WorldTrackClip => {
    const start = entry.minute !== null && entry.key !== null ? (startOfDay.get(entry.key) ?? 0) + entry.minute : unplacedAt.get(entry.clip.id) ?? 0
    // An entry the reading cannot place on its day says so on the clip, in place of the "(no time)" its own row used to carry.
    return {id: entry.clip.id, trackId: dayTrack, columnId, label: entry.clip.label, ...(entry.clip.standing ? {standing: entry.clip.standing} : {}), at: {start},
      ...(entry.minute === null ? {note: 'no time: the reading gives this entry no instant on a dated day, so it stands in the ruler\'s "no time" segment'} : {})}
  }
  // Days newest first, as the browser's Days rows list them; the entries that name no day close the set as one "no day" stop.
  const days: (string | null)[] = [...dayKeys.sort((a, b) => b.localeCompare(a)), ...(entriesByDay.has(null) ? [null] : [])]
  for (const key of days) {
    const record = key === null ? undefined : recordByDay.get(key)
    // Within a day, the entries as the day went: the timed ones by instant, then the untimed in the order read.
    const own = entriesByDay.get(key) ?? []
    const ordered = [...own.filter(entry => entry.instant !== null).sort((a, b) => (a.instant as number) - (b.instant as number)), ...own.filter(entry => entry.instant === null)]
    const columnId = `central:day-row:${key ?? 'none'}`
    columns.push({id: columnId, name: key ?? 'no day'})
    const entryClips = ordered.map(entry => entryClip(entry, columnId))
    // The day's face: its record when the owner lists one, else its first entry. It is the Session's slot.
    const face: WorldTrackClip = record
      ? {id: record.path, trackId: dayTrack, columnId, label: `${shortDay(key!)}${entryClips.length ? ` · ${plural(entryClips.length, 'entry', 'entries')}` : ''}`, at: {start: startOfDay.get(key!) ?? 0}}
      : entryClips[0]!
    const rest = record ? entryClips : entryClips.slice(1)
    clips.push(...rest, face) // the face is listed last: the grid's one slot per track per row shows it
    stops.push({id: `central:day-stop:${key ?? 'none'}`, label: key ?? 'no day', clipId: face.id, also: rest.map(clip => clip.id)})
  }
  const walks: WorldWalk[] = stops.length ? [{id: 'central:days', name: 'Days', kind: 'day', derived: true, stops}] : []

  const tracks: WorldTrack[] = STREAMS.map(stream => ({
    id: centralStreamTrackId(stream.id),
    name: stream.name,
    color: stream.colour,
    kind: stream.readable ? dayKindText(reading, records.length, entries.length)
      : waitingKindText(categories.find(category => category.id === stream.category), stream.name),
  }))

  const label = (at: number): string => {
    const segment = segments[Math.min(segments.length - 1, Math.max(0, Math.floor(at / MINUTES_PER_DAY)))]
    if (!segment) return ''
    const within = Math.round(at - segment.start)
    return segment.key === null ? `no time · ${within + 1}` : `${shortDay(segment.key)} ${clock(Math.min(MINUTES_PER_DAY - 1, Math.max(0, within)))}`
  }
  // A moment on this ruler (lane K): its day's segment plus its minute, so the spine's cron firings stand at their instant; a
  // moment on a day the ruler does not cover has no place.
  const instant = (unixMs: number): number | undefined => {
    if (!Number.isFinite(unixMs)) return undefined
    const key = new Date(unixMs).toISOString().slice(0, 10)
    const start = startOfDay.get(key)
    return start === undefined ? undefined : start + Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round((unixMs - dayStartMs(key)) / 60000)))
  }
  return {
    columns,
    tracks,
    clips,
    ...(segments.length ? {ruler: {unit: 'minutes (UTC) over the covered days, end to end', label, instant}} : {}),
    ...(walks.length ? {walks} : {}),
  }
}

/** The entries a day's face stands — for the Clip side to list under the face the Session shows. The face's clip id in, the other
 * clips of its stop out (the walk's own `also`, in the order the day went); empty for a clip that is no day's face. */
export function entriesStoodBy(set: Pick<WorldTrackSet, 'clips' | 'walks'>, faceClipId: string): WorldTrackClip[] {
  const stop = set.walks?.find(walk => walk.id === 'central:days')?.stops.find(candidate => candidate.clipId === faceClipId)
  const byId = new Map(set.clips.map(clip => [clip.id, clip]))
  return (stop?.also ?? []).flatMap(id => { const clip = byId.get(id); return clip ? [clip] : [] })
}

export const centralTrackAdapter: WorldTrackAdapter<CentralReading> = {
  id: CENTRAL_TRACK_ADAPTER_ID,
  project: projectCentralTracks,
}
