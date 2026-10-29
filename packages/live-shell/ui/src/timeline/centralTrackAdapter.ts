// Central's tracks for the shared Session and Arrangement (manual §18.1 "Central: the Day, its worlds and their pages"; T-WORLDS §4
// W2, which supersedes R3's "the tracks are workspaces": the workspaces live in the pool, §16.7):
// - the set is today's Day. Its tracks are the worlds brought into today — your world first, always, then the worlds the Day keeps in
//   its set (central/daySet.ts, the Day document's `meta.set`), in that order. A world's id is its register's wiki space ref, as
//   Central discloses it (central/centralWorlds.ts); a world the set names that Central no longer discloses stands as a named, empty
//   track, never dropped;
// - a world's clips are its pages: the Beings, Things and Flows of its folder, each placed by its island through the page owner
//   (kernel/src/page.rs `list`). A clip's id is the page's Central-relative path — the subject the browser's rows select
//   (centralSubjectOfClip), so selecting a clip opens the page in Clip view;
// - the rows are the set's rows: first the rows the Day keeps by name (a row holds the pages opened together), then the pages no
//   named row holds, one row per slot, each world's pages in the order made. A row's launcher launches every page in it;
// - a page plays when it is launched: its NOW clearing (the task `oi:page:<ref>`, kernel/src/page.rs `page_task`) stands active, and
//   its clip says so. Launch is the page owner's `launch`; a track's Stop closes every page of that world that plays;
// - the Day is the Main track, last, as Live keeps it: it holds no clip in Session view (its die stands on its chain, §18.1 "The
//   Main track"); in Arrangement view the day's entries lie on it, at their instant, on today's ruler. Earlier Days open from the
//   browser, read-only;
// - the mixer row (manual §18.1): Output is the Day; Activator is Send to Day, which no owner keeps yet; Arm is the shell's one write
//   arm; Solo and Monitor have no owner here yet;
// - dropping a world from the browser on the empty track brings it into today (the set's write; `seat`).
// Pure TypeScript. No React, no transport.
import {dayClipEventIndex, dayTrackLaneOf, projectDayTracks} from './dayTrackAdapter'
import {eventDayKey, type TemporalEventRow, type TemporalStreamAbsence} from './timeSpine'
import type {WorldMixer, WorldTakeLane, WorldTrack, WorldTrackActions, WorldTrackAdapter, WorldTrackClip, WorldTrackColumn, WorldTrackSet, WorldWalk} from './worldTrackAdapter'
import type {WorldTimelineSource} from '../projections/useWorldTemporalReading'
import {CENTRAL_DAYS_PATH, dateOfDayPath, dayEntriesOf} from '../central/daySurface'
import {withRowAt, withRowChanged, withoutRow, withoutTrackName, withTrackMoved, type DaySet} from '../central/daySet'
import type {CentralWorld, CentralWorldsReading, WorldPagesReading} from '../central/centralWorlds'
import type {CentralLocation, NativeFileEntry} from '../../../../../desktop/cradle/src/kernel/types'
import type {NowListing} from '../../../../../desktop/cradle/src/receiving/now'

export const CENTRAL_TRACK_ADAPTER_ID = 'central-world-tracks'

/** The root register's day surface — where the civil calendar's records live (the browser's Days rows read it). */
export const CENTRAL_DAY_RECORDS_PATH = CENTRAL_DAYS_PATH

/** The day-track lane kind the World cut gives Central's own day (dayTrackAdapter.ts LANES: 'central-day'). */
const DAY_LANE_KIND = 'day'
const MINUTES_PER_DAY = 1440

/** The Day, the Main track: its id, and its colour as the shell's token (shell/modeSurface.css `--mode-day`). */
export const CENTRAL_DAY_TRACK_ID = 'central:day'
const DAY_COLOUR = 'var(--mode-day, var(--track-default, var(--bg-3)))'
/** The Day's track id under the name the five streams used; kept so a reader that asks by that name still finds it. */
export const centralStreamTrackId = (_stream: 'day'): string => CENTRAL_DAY_TRACK_ID
/** A world's track id: its register's wiki space ref. */
export const centralWorldTrackId = (worldRef: string): string => `central:world:${worldRef}`
/** The drag type a world carries from the browser to the empty track (manual §18.1: "drag it from the browser onto an empty track"). */
export const CENTRAL_WORLD_DRAG = 'application/x-oi-central-world'

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

/** Central's mixer row (manual §18.1 "The mixer row"), each control's meaning in the manual's words. */
export const CENTRAL_MIXER: WorldMixer = {
  activator: {meaning: 'Send to Day: on, the work in this world reaches the Day\'s faces; off, it stays out of the Day. On by default',
    disabled: missing('Send to Day', 'a set track field `sendToDay: boolean` in the Day\'s set (central/daySet.ts) read by the Day\'s faces and its close', 'shell · Central')},
  arm: {meaning: 'Lets the agent of this world write into its pages directly, each write with a receipt; off, every agent write arrives as a proposal',
    grain: 'the shell\'s one write arm: arming one world arms every one'},
  solo: {meaning: 'Shows only this world in the Day\'s faces and in the world instrument',
    disabled: missing('Solo', 'the Day\'s faces and the world instrument reading a soloed world from the set', 'shell · Central')},
  input: {meaning: 'Its Folder: a file you add to the folder shows as a clip; a file you change in any editor shows the change on its clip', route: 'the world\'s folder'},
  output: {meaning: 'Every world sends its work to the Day, the Main track', route: 'Day'},
}

/** Why the lanes Central's owners do not give are absent, in their terms. A page's revisions are its take lanes (manual §18.1 "A page's
 * revisions are its takes"), read from Central's file-history owner (`central.temporal.source-history`, T-COVERAGE §1.3): the takes
 * stand absent only while no page of today's worlds has its history read, or none was saved over today. */
export const CENTRAL_LANES_ABSENT = {
  takes: 'Revisions as take lanes: no page of today\'s worlds has its history read yet (Central\'s central.temporal.source-history).',
  automation: 'No parameter of a page moves over the day: Central keeps no envelope (manual §18.1 "A page has no envelopes").',
  events: 'Event lanes are Factory\'s: a session\'s messages, files, terminal and pages read.',
} as const

/** One day record the owner lists. `path` is the Central-relative path the browser's Days row selects. */
export interface CentralDayRecord {
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

/** Today's set as the Day keeps it: read, or why it cannot be (the Day not opened yet, its document not made). */
export type CentralSetReading =
  | {state: 'reading'}
  | {state: 'none'; reason: string}
  | {state: 'read'; set: DaySet; civilDate: string}

/** A page that plays now: its NOW clearing, by the page's file ref (kernel/src/page.rs `page_task`). */
export interface CentralPlaying {
  readonly pageRef: string
  readonly nowRef: string
  readonly project: string | null
  /** When the clearing was made (its owner's created time), unix ms. */
  readonly sinceMs: number | null
}

/** The task a page's clearing carries (kernel/src/page.rs `page_task`). */
const PAGE_TASK = 'oi:page:'

/** The pages that play now, from NOW listings: each active clearing whose task is a page's. Pure. */
export function playingOf(listings: readonly {project: string | null; listing: NowListing}[]): CentralPlaying[] {
  return listings.flatMap(({project, listing}) => listing.records
    .filter(row => row.lifecycle === 'active' && row.task_ref.startsWith(PAGE_TASK))
    .map(row => ({pageRef: row.task_ref.slice(PAGE_TASK.length), nowRef: row.now_ref, project,
      sinceMs: Number.isFinite(row.created_at_unix_seconds) ? row.created_at_unix_seconds * 1000 : null})))
}

/** The owner's acts the tracks press. */
export interface CentralControls {
  /** Launch a page; it may answer how it opened (`opened`, words for the note). */
  launch?: (page: {location: CentralLocation; path: string; form?: string}) => Promise<unknown>
  stop?: (playing: CentralPlaying) => Promise<unknown>
  /** Bring a world into today's set (the Day's write). */
  addWorld?: (world: CentralWorld) => Promise<unknown>
  /** Take a world out of today's set (the Day's write): its pages stay in its folder. */
  removeWorld?: (world: CentralWorld) => Promise<unknown>
  writeArm?: {on: boolean | null; set(on: boolean): Promise<unknown>}
  /** Open or reveal a page's file or a world's folder by its Central-relative path (Central's work.open / work.reveal). */
  openOrReveal?: (act: 'open' | 'reveal', path: string) => Promise<unknown>
  /** Write today's set (the Day's write, central/daySet.ts writeDaySet): its tracks' names and order, and its named rows. */
  writeSet?: (change: (set: DaySet) => DaySet) => Promise<unknown>
  /** Make a blank page in a world (central/madeOfConstellation.ts makeBlankPage): answers its path and its file ref. */
  makePage?: (world: CentralWorld) => Promise<{path: string; ref: string}>
  /** A page's copy (the page owner's duplicate, kernel/src/page.rs, central/pageActs.ts): in its own world, or in `into`, tied to it.
   * Answers the copy's path and file ref. */
  copyPage?: (page: {location: CentralLocation}, into?: CentralWorld) => Promise<{path: string; ref: string}>
  /** A page leaving its world for Central's trash on the revision read (the page owner's trash; the person's act). Answers Central's
   * receipt, with its way back. */
  trashPage?: (page: {location: CentralLocation; revision: string}) => Promise<unknown>
  /** A world named by Central itself (`central.world.name`, the person's act): the browser's row and today's track both show it. */
  nameWorld?: (world: CentralWorld, name: string) => Promise<unknown>
}

export interface CentralReading {
  civil: CentralCivilReading
  /** The worlds Central discloses (absent: not read by this caller). */
  worlds?: CentralWorldsReading
  /** Today's set as the Day keeps it. */
  set?: CentralSetReading
  /** Each world's pages, by its ref. */
  pages?: ReadonlyMap<string, WorldPagesReading>
  /** The pages that play now. */
  playing?: readonly CentralPlaying[]
  /** Each world's colour, its body's (manual §17.2 "Your system": "on its track, its clips and its body"; projections/atlas/system/
   * systemModel.ts worldColourOf), by the world's ref. A world with none draws the default. */
  colours?: ReadonlyMap<string, string>
  /** Your practice world's ref (desktop/cradle/src/nara/practiceWorld.ts practiceWorldOf): its track is of Kind Practice, fogged, its
   * Activator off, its chain Packet · Nara · Scope (T-WORLDS §6 W4). */
  practice?: string | null
  controls?: CentralControls
  /** Each page's history as Central's file-history owner reads it, by the page's path (its clip id): its revisions are its takes. */
  histories?: ReadonlyMap<string, CentralPageHistory>
  /** Now, for the revision that stands to end at (the ruler draws no future). Absent: it ends where it began. */
  nowMs?: number
}

/** One page's history (`central.temporal.source-history`, central.source-history/v1: entries newest first, each {revision,
 * previous_revision, recorded_at_unix_seconds, actor, actor_kind}, and the revision that stands now), or Central's refusal of it. */
export type CentralPageHistory = {readonly state: 'read'; readonly history: unknown} | {readonly state: 'refused'; readonly reason: string}

/** The SourceRef a page of a world is known by to Central's file-history owner: your world's pages under the root register
 * (`central:source:control:root:<path>`), a project world's under its project (`central:source:project:<name>:<path in the project>`).
 * Null where the page's path is in neither. Pure. */
export function pageSourceRef(world: Pick<CentralWorld, 'project'>, path: string): {sourceRef: string; project?: string} | null {
  if (!world.project) return path.startsWith('Work/') ? null : {sourceRef: `central:source:control:root:${path}`}
  const base = `Work/${world.project}/`
  return path.startsWith(base) ? {sourceRef: `central:source:project:${world.project}:${path.slice(base.length)}`, project: world.project} : null
}

const revisionTail = (revision: string): string => revision.split(':').pop()?.slice(0, 8) ?? revision

/** A page's saved revisions over today as take lanes under its world's track, oldest first: each the stretch of the ruler it stood for,
 * from its save (or today's start, for the revision that stood when the day began) to the next save — the one that stands now to `nowMs`.
 * A revision saved and replaced before today, or after it, is no take of today. Pure. */
export function pageTakesOf(page: {path: string; title: string; world: string}, history: unknown, minuteOf: (unixMs: number) => number | null,
  todayStart: number | null, nowMs?: number): WorldTakeLane[] {
  const doc = history as {schema?: unknown; entries?: unknown; revision?: {revision?: unknown}} | null
  if (!doc || doc.schema !== 'central.source-history/v1' || !Array.isArray(doc.entries) || todayStart === null) return []
  const saves = (doc.entries as {revision?: unknown; recorded_at_unix_seconds?: unknown; actor_kind?: unknown}[])
    .flatMap(entry => typeof entry?.revision === 'string' && typeof entry.recorded_at_unix_seconds === 'number' && Number.isFinite(entry.recorded_at_unix_seconds)
      ? [{revision: entry.revision, at: entry.recorded_at_unix_seconds * 1000, by: typeof entry.actor_kind === 'string' ? entry.actor_kind : null}] : [])
    .sort((a, b) => a.at - b.at)
  const current = typeof doc.revision?.revision === 'string' ? doc.revision.revision : null
  const todayEnd = todayStart + 86_400_000
  return saves.flatMap((save, i) => {
    const next = saves[i + 1]
    const until = next ? next.at : nowMs ?? save.at
    if (until <= todayStart && next || save.at >= todayEnd) return []
    const start = minuteOf(Math.max(save.at, todayStart)), end = minuteOf(Math.min(Math.max(until, save.at), todayEnd - 1))
    if (start === null || end === null) return []
    return [{id: `${page.path}@${save.revision}`, trackId: centralWorldTrackId(page.world), name: `${page.title} · ${clock(start)}`,
      spans: [{start, end: Math.max(start, end), label: `revision ${revisionTail(save.revision)}${save.by ? ` · saved by a ${save.by}` : ''}`}],
      ...(current === save.revision ? {standing: true} : {})}]
  })
}

/** The owner's Flows folder (flow/instances.ts USER_FLOWS_DIR): your world's folder. */
export const CENTRAL_FLOWS_PATH = 'Control/user/flows'

/** A minted page name (flow/placement.ts mints `<form>-YYYY-MM-DD-HHMM` from this machine's local clock). */
const MINTED = /-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(?:-(\d+))?\.html$/i
/** A page's path: your world's folder, or a project's human ground. */
const PAGE_PATH = /(?:^|\/)(?:Control\/user\/flows\/[^/]+|Work\/[^/]+\/ProjectCentral\/user\/(?:[^/]+\/)*[^/]+)\.html$/i

/** When a page was made, from its minted name; null for a page named by hand (no time is invented for it). */
export function mintedAt(name: string): number | null {
  const minted = MINTED.exec(name)
  return minted ? new Date(Number(minted[1]), Number(minted[2]) - 1, Number(minted[3]), Number(minted[4]), Number(minted[5])).getTime() : null
}

/** The day records in an owner directory listing (`central.directory-reading/v1`): only `YYYY-MM-DD.md` (or a day folder's day.md)
 * are day records, newest first, each at the listing's own location path. */
export function dayRecordsOf(directory: {entries: readonly {name: string; byte_len?: number | null; location?: {path?: string} | null}[]}): CentralDayRecord[] {
  return dayEntriesOf(directory.entries as NativeFileEntry[])
    .map(entry => ({name: entry.name, path: entry.location?.path ?? `${CENTRAL_DAY_RECORDS_PATH}/${entry.name}`, byteLen: entry.byte_len || null}))
    .sort((a, b) => b.name.localeCompare(a.name))
}

/** The Central ground subject a clip id names: a day record's path opens as a day, a page's path as the page it is (the browser's
 * rows select the same). Anything else — an entry's id, an occasion — is no ground subject: null. */
export function centralSubjectOfClip(ref: string): {kind: 'day' | 'note'; path: string} | null {
  if (dateOfDayPath(ref)) return {kind: 'day', path: ref}
  return PAGE_PATH.test(ref) ? {kind: 'note', path: ref} : null
}

const isDate = (key: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(key)
const dayStartMs = (key: string): number => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
/** The ruler's day (its UTC date) an instant falls on: dayStartMs's inverse. */
const dayOfMs = (unixMs: number): string => new Date(unixMs).toISOString().slice(0, 10)
const clock = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** The World cut's temporal read as the Day track's entries read it. */
export function civilReadingOf(source: WorldTimelineSource | undefined): CentralCivilReading {
  if (!source) return {state: 'unavailable', reason: 'the shell publishes no civil reading to this pane'}
  if (source.status === 'live') return {state: 'live', events: source.events, absences: source.absences}
  if (source.status === 'reading') return {state: 'reading'}
  return {state: 'unavailable', reason: source.error ?? 'the kernel temporal read is unavailable'}
}

/** One page of a world, as a clip carries it. */
interface Page {
  world: string
  path: string
  name: string
  title: string
  form: string
  location: CentralLocation
  /** The revision the page owner listed it at: Delete takes it out of its world on it. */
  revision: string
  madeAt: number | null
}

/** The worlds today's set holds: yours first, always, then the set's, in order. A set world Central does not disclose stands named. */
function setWorlds(reading: CentralReading): {world: CentralWorld; disclosed: boolean}[] {
  const worlds = reading.worlds?.state === 'read' ? reading.worlds.worlds : []
  const byRef = new Map(worlds.map(world => [world.ref, world]))
  const yours = worlds.find(world => world.kind === 'yours') ?? {ref: 'central:wiki:root', name: 'Your world', kind: 'yours' as const, folder: CENTRAL_FLOWS_PATH, project: null}
  const held = reading.set?.state === 'read' ? reading.set.set.tracks : []
  const out: {world: CentralWorld; disclosed: boolean}[] = [{world: yours, disclosed: true}]
  for (const track of held) {
    if (out.some(item => item.world.ref === track.world)) continue
    const world = byRef.get(track.world)
    out.push(world ? {world: track.name ? {...world, name: track.name} : world, disclosed: true}
      : {world: {ref: track.world, name: track.name ?? track.world, kind: 'project', folder: '', project: null}, disclosed: false})
  }
  return out
}

/** A world's track text: what is known of it, and what is not. */
function worldKindText(world: CentralWorld, disclosed: boolean, pages: WorldPagesReading | undefined, playing: number): string {
  if (!disclosed) return `a world today's set holds that Central no longer discloses (${world.ref}): its pages cannot be read`
  const parts = [world.kind === 'yours' ? 'your world' : `${world.project}'s world`, `its folder ${world.folder}`]
  if (!pages || pages.state === 'reading') parts.push('its pages being read')
  else if (pages.state === 'unavailable') parts.push(`its pages unread (${pages.reason})`)
  else {
    parts.push(plural(pages.listing.pages.length, 'page', 'pages'))
    if (pages.listing.not_pages.length) parts.push(`${plural(pages.listing.not_pages.length, 'file', 'files')} in it no page`)
    if (pages.listing.more) parts.push('more pages than one listing reads')
  }
  if (playing) parts.push(`${plural(playing, 'page plays', 'pages play')} now`)
  return parts.join(' · ')
}

/** The day's entries on the Day track: the events the World cut's day lane draws for Central's own day, under its clip ids. */
function dayEntries(events: TemporalEventRow[]): {clip: WorldTrackClip; key: string | null; instant: number | null}[] {
  const index = dayClipEventIndex(events)
  const entries: {clip: WorldTrackClip; key: string | null; instant: number | null}[] = []
  for (const clip of projectDayTracks(events).clips) {
    const event = index.get(clip.id)
    if (!event || dayTrackLaneOf(event)?.kind !== DAY_LANE_KIND) continue
    const instant = event.instant_unix_ms != null && Number.isFinite(event.instant_unix_ms) ? event.instant_unix_ms : null
    entries.push({clip, key: eventDayKey(event), instant})
  }
  return entries
}

/** The Day track's text: the set, today's entries, and what has not been read. */
function dayKindText(reading: CentralReading, entries: number): string {
  const parts = ['the Day · the Main track']
  const set = reading.set
  if (!set || set.state === 'reading') parts.push('today\'s set being read')
  else if (set.state === 'none') parts.push(`today keeps no set yet (${set.reason})`)
  else parts.push(`today, ${set.civilDate}: ${plural(set.set.tracks.length + 1, 'world', 'worlds')}, ${plural(set.set.rows.length, 'named row', 'named rows')}`)
  const c = reading.civil
  parts.push(c.state === 'live' ? `${plural(entries, 'entry', 'entries')} today` : c.state === 'reading' ? 'the civil field being read' : `the civil field unread (${c.reason})`)
  if (c.state === 'live') for (const absence of c.absences) {
    if (dayTrackLaneOf({stream: absence.stream, subject_ref: ''})?.kind !== DAY_LANE_KIND) continue
    parts.push(`${absence.stream} gave nothing: ${absence.reason}${absence.owner_words ? ` — ${absence.owner_words}` : ''}`)
  }
  if (reading.worlds?.state === 'unavailable') parts.push(`the worlds unread (${reading.worlds.reason})`)
  return parts.join(' · ')
}

export function projectCentralTracks(reading: CentralReading): WorldTrackSet {
  const worlds = setWorlds(reading)
  const playing = new Map((reading.playing ?? []).map(item => [item.pageRef, item]))
  const pagesOf = (world: CentralWorld): Page[] => {
    const read = reading.pages?.get(world.ref)
    if (read?.state !== 'read') return []
    return read.listing.pages.map(page => ({world: world.ref, path: page.location.path, name: page.name, title: page.title || page.name.replace(/\.html$/i, ''),
      form: page.form, location: page.location, revision: page.revision, madeAt: mintedAt(page.name)}))
      .sort((a, b) => (a.madeAt ?? Infinity) - (b.madeAt ?? Infinity) || a.name.localeCompare(b.name))
  }
  const pages = new Map(worlds.map(({world}) => [world.ref, pagesOf(world)]))
  const byRef = new Map([...pages.values()].flat().map(page => [page.location.ref, page]))

  // Today's ruler: one civil day (the set's date; else the newest the entries name), UTC minutes as the World cut's week strip tiles.
  const entries = reading.civil.state === 'live' ? dayEntries(reading.civil.events) : []
  const today = reading.set?.state === 'read' ? reading.set.civilDate
    : entries.map(entry => entry.key).filter((key): key is string => !!key && isDate(key)).sort().pop() ?? null
  const todayStart = today && isDate(today) ? dayStartMs(today) : null
  const minuteOf = (unixMs: number): number | null => todayStart === null || !Number.isFinite(unixMs) || unixMs < todayStart || unixMs >= todayStart + 86_400_000
    ? null : Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round((unixMs - todayStart) / 60000)))

  // The rows: the set's named rows, then one row per slot for the pages no named row holds.
  const named = reading.set?.state === 'read' ? reading.set.set.rows : []
  const inNamed = new Set(named.flatMap(row => row.pages))
  const loose = new Map(worlds.map(({world}) => [world.ref, (pages.get(world.ref) ?? []).filter(page => !inNamed.has(page.location.ref))]))
  const slots = Math.max(0, ...[...loose.values()].map(list => list.length))
  const columns: WorldTrackColumn[] = [
    ...named.map(row => ({id: `central:row:${row.id}`, name: row.name})),
    ...Array.from({length: slots}, (_, i) => ({id: `central:slot:${i + 1}`, name: `${named.length + i + 1}`})),
  ]
  const pageClip = (page: Page, columnId: string): WorldTrackClip => {
    const plays = playing.get(page.location.ref)
    const since = plays?.sinceMs ?? null
    // A page carried from an earlier Day (manual §18.1 "What carries to tomorrow") plays through today from its start, and says
    // since when it plays and when to look at it again: the day-close law's review, three days on (Control/agents/governance/
    // field-and-now/day-close.md; central-day-close "carried 3 or more days is re-justified").
    const carried = since !== null && todayStart !== null && since < todayStart
    const start = since === null ? null : carried ? 0 : minuteOf(since)
    const carriedWords = carried ? ` · carried, open since ${dayOfMs(since!)}; look at it again ${dayOfMs(since! + 3 * 86_400_000)}` : ''
    return {id: page.path, trackId: centralWorldTrackId(page.world), columnId, label: page.title,
      ...(plays ? {status: 'running' as const} : {}),
      ...(start !== null ? {at: {start, end: MINUTES_PER_DAY - 1}} : {}),
      note: `${page.form === 'flow' ? 'A Flow' : page.form === 'being' ? 'A Being' : page.form === 'thing' ? 'A Thing' : 'A page'} · ${page.path}${plays ? ` · plays now (${plays.nowRef})${carriedWords}` : ''}`}
  }
  // Each row's pages, by its column: a named row's in the order it names them, a slot's one page from each world.
  const rowPages = new Map<string, Page[]>(columns.map(column => [column.id, []]))
  for (const row of named) for (const ref of row.pages) {
    const page = byRef.get(ref)
    if (page) rowPages.get(`central:row:${row.id}`)!.push(page)
  }
  for (const [, list] of loose) list.forEach((page, i) => rowPages.get(`central:slot:${i + 1}`)!.push(page))
  const clips: WorldTrackClip[] = [...rowPages].flatMap(([columnId, list]) => list.map(page => pageClip(page, columnId)))
  // The day's entries lie on the Day track in Arrangement view, at their instant today. They stand in no row (the Day holds no clip
  // in Session view), so they carry no column the grid would draw.
  for (const entry of entries) {
    if (entry.key !== today || entry.instant === null) continue
    const start = minuteOf(entry.instant)
    if (start === null) continue
    clips.push({id: entry.clip.id, trackId: CENTRAL_DAY_TRACK_ID, columnId: '', label: entry.clip.label, ...(entry.clip.standing ? {standing: entry.clip.standing} : {}), at: {start}})
  }

  // Today walked (manual §18.1 "Arrangement view: the day as you lived it"): each of today's entries a stop, in the order the day
  // went; a stop stands its occasion on the spine (the World cut's one stop rule, worldCutTracks.ts focusStopAction).
  const walked = entries.filter(entry => entry.key === today && entry.instant !== null).sort((a, b) => (a.instant as number) - (b.instant as number))
  const walks: WorldWalk[] = walked.length ? [{id: 'central:today', name: 'Today', kind: 'day', derived: true,
    stops: walked.map((entry, i) => ({id: `central:today-stop:${i}`, label: entry.clip.label, clipId: entry.clip.id, also: []}))}] : []
  const armOn = reading.controls?.writeArm?.on
  const tracks: WorldTrack[] = [
    ...worlds.map(({world, disclosed}): WorldTrack => {
      const plays = (pages.get(world.ref) ?? []).filter(page => playing.has(page.location.ref)).length
      const practice = reading.practice === world.ref
      const colour = reading.colours?.get(world.ref)
      const kind = worldKindText(world, disclosed, reading.pages?.get(world.ref), plays)
      return {id: centralWorldTrackId(world.ref), name: world.name, ...(colour ? {color: colour} : {}),
        kind: practice ? `Practice · fogged: its pages stay out of the Day unless you send them · its chain Packet · Nara · Scope · ${kind}` : kind,
        ...(typeof armOn === 'boolean' || practice ? {mix: {...(typeof armOn === 'boolean' ? {arm: armOn} : {}), ...(practice ? {activator: false} : {})}} : {})}
    }),
    {id: CENTRAL_DAY_TRACK_ID, name: 'Day', color: DAY_COLOUR, main: true, kind: dayKindText(reading, entries.filter(entry => entry.key === today).length)},
  ]
  const label = (at: number): string => today ? `${today.slice(5)} ${clock(Math.min(MINUTES_PER_DAY - 1, Math.max(0, Math.round(at))))}` : clock(Math.round(at))
  const instant = (unixMs: number): number | undefined => minuteOf(unixMs) ?? undefined
  const actions = centralActions(reading, worlds.map(item => item.world), pages, rowPages, playing)
  return {
    columns,
    tracks,
    clips,
    ...(today ? {ruler: {unit: `minutes (UTC) of ${today}`, label, instant, end: MINUTES_PER_DAY}} : {}),
    ...(walks.length ? {walks} : {}),
    mixer: CENTRAL_MIXER,
    main: {name: today ? `Day · ${today}` : 'Day', chain: ['Day', 'Approvals']},
    lanes: centralLanes(reading, pages, minuteOf, todayStart),
    ...(actions ? {actions} : {}),
  }
}

/** The lanes under today's tracks: each page's revisions as its take lanes, where its history was read; absent with the reason
 * otherwise (the first refusal in Central's words, or none saved over today). */
function centralLanes(reading: CentralReading, pages: ReadonlyMap<string, readonly Page[]>, minuteOf: (unixMs: number) => number | null, todayStart: number | null) {
  const takes = [...pages.values()].flat().flatMap(page => {
    const history = reading.histories?.get(page.path)
    return history?.state === 'read' ? pageTakesOf(page, history.history, minuteOf, todayStart, reading.nowMs) : []
  })
  if (takes.length) return {takes, absent: {automation: CENTRAL_LANES_ABSENT.automation, events: CENTRAL_LANES_ABSENT.events}}
  const refused = [...(reading.histories?.values() ?? [])].find((history): history is Extract<CentralPageHistory, {state: 'refused'}> => history.state === 'refused')
  const read = [...(reading.histories?.values() ?? [])].some(history => history.state === 'read')
  return {absent: {...CENTRAL_LANES_ABSENT,
    ...(refused ? {takes: `Revisions as take lanes: Central did not read a page's history — ${refused.reason}`}
      : read ? {takes: 'Revisions as take lanes: no page of today\'s worlds was saved over today (Central\'s central.temporal.source-history).'} : {})}}
}

/** The owner's acts over this set's own clips, rows and tracks: an id that is none of them is refused before any owner is called. */
function centralActions(reading: CentralReading, worlds: readonly CentralWorld[], pages: ReadonlyMap<string, readonly Page[]>,
  rowPages: ReadonlyMap<string, readonly Page[]>, playing: ReadonlyMap<string, CentralPlaying>): WorldTrackActions | undefined {
  const controls = reading.controls
  if (!controls) return undefined
  const actions: WorldTrackActions = {}
  const byPath = new Map([...pages.values()].flat().map(page => [page.path, page]))
  const launchPage = controls.launch
  if (launchPage) {
    actions.launch = {op: 'the page owner\'s launch (kernel/src/page.rs): its NOW clearing allocated, or rejoined, and active', run: async clipId => {
      const page = byPath.get(clipId)
      if (!page) return {ok: false, error: `"${clipId}" is no page of today's worlds.`}
      const answer = await launchPage({location: page.location, path: page.path, form: page.form})
      const opened = (answer as {opened?: unknown} | null)?.opened
      return {ok: true, note: `${page.title} plays: ${typeof opened === 'string' ? opened : 'it is open now'}.`}
    }}
    actions.launchStop = {op: 'every page in the row launched through the page owner', run: async columnId => {
      const inRow = rowPages.get(columnId) ?? []
      if (!inRow.length) return {ok: false, error: 'The row holds no page to launch.'}
      for (const page of inRow) await launchPage({location: page.location, path: page.path, form: page.form})
      return {ok: true, note: `${plural(inRow.length, 'page plays', 'pages play')}.`}
    }}
  }
  const stopPage = controls.stop
  if (stopPage) actions.stopTrack = {op: 'the page owner\'s stop (kernel/src/page.rs): each playing page\'s NOW clearing closed', grain: null, run: async trackId => {
    const world = worlds.find(candidate => centralWorldTrackId(candidate.ref) === trackId)
    if (!world) return {ok: false, error: `"${trackId}" is no world of today's set.`}
    const plays = (pages.get(world.ref) ?? []).flatMap(page => { const item = playing.get(page.location.ref); return item ? [item] : [] })
    if (!plays.length) return {ok: true, note: `No page of ${world.name} plays.`}
    for (const item of plays) await stopPage(item)
    return {ok: true, note: `${plural(plays.length, 'page', 'pages')} of ${world.name} stopped.`}
  }}
  const addWorld = controls.addWorld
  const disclosed = reading.worlds?.state === 'read' ? reading.worlds.worlds : []
  if (addWorld && reading.set?.state === 'read') actions.seat = {op: 'today\'s set written into the Day (central/daySet.ts): the world becomes a track', accepts: CENTRAL_WORLD_DRAG, run: async payload => {
    const world = disclosed.find(candidate => candidate.ref === payload.trim())
    if (!world) return {ok: false, error: `"${payload}" is no world Central discloses.`}
    if (worlds.some(held => held.ref === world.ref)) return {ok: true, note: `${world.name} is already in today's set.`}
    await addWorld(world)
    return {ok: true, note: `${world.name} is in today's set.`}
  }}
  // A world leaves today's set as it came in (Live: select the track, Delete): the Day's set written without it. Its pages stay in its
  // folder, its body and any landing stay its own; your world is in every day's set and does not leave it.
  const removeWorld = controls.removeWorld
  if (removeWorld && reading.set?.state === 'read') actions.removeTrack = {op: 'today\'s set written into the Day without the world (central/daySet.ts withoutWorld): its pages stay in its folder', run: async trackId => {
    const world = worlds.find(candidate => centralWorldTrackId(candidate.ref) === trackId)
    if (!world) return {ok: false, error: `"${trackId}" is no world of today's set.`}
    if (world.kind === 'yours') return {ok: false, error: 'Your world is in every day\'s set; it does not leave it.'}
    await removeWorld(world)
    return {ok: true, note: `${world.name} is out of today's set; its pages stay in its folder.`}
  }}
  // Open and Reveal (manual §10.9 "In Central"): a clip's page file and a track's world folder, by the Central-relative path the page's
  // location and the world's folder name, through Central's work.open and work.reveal. Neither changes the world.
  const openOrReveal = controls.openOrReveal
  if (openOrReveal) {
    const pageOf = (clipId: string) => byPath.get(clipId)
    const worldOf = (trackId: string) => worlds.find(candidate => centralWorldTrackId(candidate.ref) === trackId)
    const onPage = (act: 'open' | 'reveal') => async (clipId: string) => {
      const page = pageOf(clipId)
      if (!page) return {ok: false, error: `"${clipId}" is no page of today's worlds.`}
      await openOrReveal(act, page.path)
      return {ok: true, note: act === 'open' ? `${page.title} is open in the application your computer opens it with.` : `${page.title} is shown in Finder.`}
    }
    const onWorld = (act: 'open' | 'reveal') => async (trackId: string) => {
      const world = worldOf(trackId)
      if (!world) return {ok: false, error: `"${trackId}" is no world of today's set.`}
      await openOrReveal(act, world.folder)
      return {ok: true, note: act === 'open' ? `${world.name}'s folder is open in the application your computer opens it with.` : `${world.name}'s folder is shown in Finder.`}
    }
    actions.openFile = {op: 'Central\'s work.open: the page\'s file, to the application your computer opens it with', run: onPage('open')}
    actions.revealFile = {op: 'Central\'s work.reveal: the page\'s file, shown in Finder', run: onPage('reveal')}
    actions.openFolder = {op: 'Central\'s work.open: the world\'s folder, to the application your computer opens it with', run: onWorld('open')}
    actions.revealFolder = {op: 'Central\'s work.reveal: the world\'s folder, shown in Finder', run: onWorld('reveal')}
  }
  const arm = controls.writeArm
  if (arm) actions.mixer = {arm: {op: 'shell.setWriteArm — the shell\'s one write arm (agent/shellSetterBridge.ts): its receipt names the owner that enforces it', run: (_trackId, on) => arm.set(on)}}
  // Stop all clips (the Main track's Stop All): every page that plays stopped through the page owner.
  if (stopPage) actions.stopAll = {op: 'the page owner\'s stop (kernel/src/page.rs) for every page that plays: each NOW clearing closed', run: async () => {
    const plays = [...playing.values()]
    if (!plays.length) return {ok: true, note: 'No page plays.'}
    for (const item of plays) await stopPage(item)
    return {ok: true, note: `${plural(plays.length, 'page', 'pages')} stopped.`}
  }}
  centralSetActs(actions, reading, worlds, rowPages)
  centralPageActs(actions, reading, worlds, byPath, rowPages, playing)
  actions.waiting = centralWaiting(actions, reading)
  return Object.keys(actions).length ? actions : undefined
}

/** What Central's acts no owner op carries wait for (O-I #743), as the status bar says after the missing op. */
export const CENTRAL_WAITING: Readonly<Record<string, string>> = {
  'clip.info': 'a page\'s info text: the page owner keeps no note on the page as a whole apart from its notes',
  'clip.split': 'no owner splits a page',
  'clip.consolidate': 'no owner joins pages',
  'clip.crop': 'no owner crops a page',
  'slot.stop-button': 'a slot\'s own stop in today\'s set: the Day keeps rows of pages, not slots',
  'slot.record': 'a recording path into a world: what the armed agent writes is a page\'s own write, not a slot\'s',
  'track.duplicate': 'a world\'s copy: Central makes a world through setup, not by copying one',
  'track.colour': 'a world\'s own colour: a world wears its body\'s (projections/atlas/system/systemModel.ts worldColourOf), which no act writes yet',
  'tracks.group': 'a group of worlds: today\'s set keeps worlds side by side, none under another',
  'track.activator': 'Send to Day: a set track field `sendToDay: boolean` in the Day\'s set (central/daySet.ts) that the Day\'s faces and its close read',
  'track.solo': 'the Day\'s faces and the world instrument reading a soloed world from today\'s set',
  'track.arm': 'the shell\'s one write arm (shell.setWriteArm, agent/shellSetterBridge.ts), which no shell holds for this pane',
}

/** The owners' acts the set carries where a kernel carrier hands the pane their controls: each op, the action that carries it, and whose. */
const CARRIED_BY_THE_CARRIER: readonly (readonly [op: string, action: keyof WorldTrackActions, owner: string])[] = [
  ['clip.launch', 'launch', 'the page owner\'s launch (kernel/src/page.rs)'], ['row.launch', 'launchStop', 'the page owner\'s launch of every page in the row'],
  ['track.stop', 'stopTrack', 'the page owner\'s stop'], ['set.stop-all', 'stopAll', 'the page owner\'s stop of every page that plays'],
  ['clip.insert', 'insertClip', 'a blank Flow made through Central\'s door'], ['clip.duplicate', 'duplicateClip', 'the page owner\'s duplicate (kernel/src/page.rs)'],
  ['clip.paste', 'pasteClip', 'the page owner\'s duplicate into the world it is pasted in'], ['clip.delete', 'deleteClip', 'the page owner\'s trash, Central\'s central.files.trash'],
  ['row.duplicate', 'duplicateRow', 'the page owner\'s duplicate of each page in the row'], ['track.rename', 'renameTrack', 'Central\'s central.world.name'],
  ['work.open', 'openFile', 'Central\'s work.open'], ['work.reveal', 'revealFile', 'Central\'s work.reveal'],
]
/** The acts that write today's set, kept in today's Day, and the actions that carry them. */
const KEPT_IN_THE_DAY: readonly (readonly [op: string, action: keyof WorldTrackActions])[] = [
  ['track.remove', 'removeTrack'], ['track.move', 'moveTrack'], ['row.insert', 'insertRow'], ['row.rename', 'renameRow'], ['row.delete', 'deleteRow'],
]

/** What each act no owner op carries now waits for: what no owner carries at all (CENTRAL_WAITING), an owner's act whose control no kernel
 * carrier hands this pane, and today's set's acts while today's Day cannot be written. An act the set carries is never named. Pure. */
function centralWaiting(actions: WorldTrackActions, reading: CentralReading): Readonly<Record<string, string>> {
  const waiting: Record<string, string> = {...CENTRAL_WAITING}
  for (const [op, action, owner] of CARRIED_BY_THE_CARRIER) {
    if (!actions[action]) waiting[op] = `${owner}, which no kernel carrier hands this pane`
  }
  const day = reading.set?.state === 'none' ? reading.set.reason : reading.set?.state === 'reading' ? 'today\'s Day is still being read'
    : !reading.controls?.writeSet ? 'no kernel carrier reaches today\'s Day' : null
  for (const [op, action] of KEPT_IN_THE_DAY) {
    if (!actions[action]) waiting[op] = `today's set, kept in today's Day, which cannot be written now${day ? ` (${day})` : ''}`
  }
  return waiting
}

/** Today's set's own acts (the Day's write): a world's track named and moved, a page made in a world, and the named rows inserted, named and
 * taken out (their pages stay in their worlds). Your world is every set's first track: it is neither named nor moved here. */
function centralSetActs(actions: WorldTrackActions, reading: CentralReading, worlds: readonly CentralWorld[], rowPages: ReadonlyMap<string, readonly Page[]>): void {
  const controls = reading.controls
  const writeSet = controls?.writeSet
  const set = reading.set?.state === 'read' ? reading.set.set : null
  const worldOf = (trackId: string) => worlds.find(candidate => centralWorldTrackId(candidate.ref) === trackId)
  const named = (rowId: string) => set?.rows.find(row => `central:row:${row.id}` === rowId) ?? null
  const makePage = controls?.makePage
  if (makePage) actions.insertClip = {op: 'a blank Flow made in the world through Central\'s door (flow/createInPlace.ts), tied to the world; in a named row, today\'s set holds it there', run: async (trackId, rowId) => {
    const world = worldOf(trackId)
    if (!world) return {ok: false, error: `"${trackId}" is no world of today's set.`}
    const made = await makePage(world)
    const row = named(rowId)
    if (row && writeSet) await writeSet(held => withRowChanged(held, row.id, kept => ({...kept, pages: [...kept.pages.filter(page => page !== made.ref), made.ref]})))
    return {ok: true, note: `${world.name} has a new Flow (${made.path})${row ? `, in the row ${row.name}` : ''}.`}
  }}
  // Rename reaches the world itself (O-I #743): Central keeps its name in the world's ProjectCentral manifest (central.world.name), so the
  // browser's row and today's track both show it. It replaces the name today's set kept for the track (daySet.ts withTrackName), which
  // would stand over the world's own name; the set's name is taken away once Central has named the world.
  const nameWorld = controls?.nameWorld
  if (nameWorld) actions.renameTrack = {op: 'Central\'s central.world.name: the world itself named, in the browser and on today\'s track', run: async (trackId, name) => {
    const world = worldOf(trackId)
    if (!world) return {ok: false, error: `"${trackId}" is no world of today's set.`}
    if (world.kind === 'yours') return {ok: false, error: 'Your world is named by your ground: Central names a project\'s world, not yours.'}
    if (!world.project) return {ok: false, error: `${world.name} is a world Central no longer discloses: there is no world to name.`}
    if (!name.trim()) return {ok: false, error: 'A world\'s name is text.'}
    await nameWorld(world, name.trim())
    const kept = set?.tracks.find(track => track.world === world.ref)?.name
    if (kept && writeSet) await writeSet(held => withoutTrackName(held, world.ref))
    return {ok: true, note: `${world.name} is named ${name.trim()}: the browser and today's track show it.`}
  }}
  if (!writeSet || !set) return
  const op = (what: string) => `today's set written into the Day (central/daySet.ts): ${what}`
  actions.moveTrack = {op: op('the worlds in a new order'), run: async (trackId, by) => {
    const world = worldOf(trackId)
    if (!world) return {ok: false, error: `"${trackId}" is no world of today's set.`}
    if (world.kind === 'yours') return {ok: false, error: 'Your world is every set\'s first track: it does not move.'}
    const at = set.tracks.findIndex(track => track.world === world.ref)
    if (at + by < 0) return {ok: false, error: `${world.name} stands right after your world, which is always first.`}
    if (at + by >= set.tracks.length) return {ok: false, error: `${world.name} is already the last track.`}
    await writeSet(held => withTrackMoved(held, world.ref, by))
    return {ok: true, note: `Moved ${world.name} ${by < 0 ? 'left' : 'right'}.`}
  }}
  actions.insertRow = {op: op('an empty named row'), run: async afterRowId => {
    const after = afterRowId ? set.rows.findIndex(row => `central:row:${row.id}` === afterRowId) : -1
    const index = after >= 0 ? after + 1 : set.rows.length
    const row = {id: `row-${Date.now().toString(36)}`, name: `Row ${set.rows.length + 1}`, pages: []}
    await writeSet(held => withRowAt(held, row, index))
    return {ok: true, note: `Today's set has a new row, ${row.name}.`}
  }}
  actions.renameRow = {op: op('a row named; a row of loose pages becomes a named row holding them'), run: async (rowId, name) => {
    if (!name.trim()) return {ok: false, error: 'A row\'s name is text.'}
    const row = named(rowId)
    if (row) {
      await writeSet(held => withRowChanged(held, row.id, kept => ({...kept, name: name.trim()})))
      return {ok: true, note: `The row is named ${name.trim()}.`}
    }
    const pages = rowPages.get(rowId)
    if (!pages) return {ok: false, error: `"${rowId}" is no row of today's set.`}
    const kept = {id: `row-${Date.now().toString(36)}`, name: name.trim(), pages: pages.map(page => page.location.ref)}
    await writeSet(held => withRowAt(held, kept, held.rows.length))
    return {ok: true, note: `Today's set keeps the row ${kept.name}, holding ${plural(kept.pages.length, 'page', 'pages')}.`}
  }}
  actions.deleteRow = {op: op('a named row taken out; its pages stay in their worlds'), run: async rowId => {
    const row = named(rowId)
    if (!row) return {ok: false, error: 'This row holds the pages no named row holds: the Day keeps no row to take out.'}
    await writeSet(held => withoutRow(held, row.id))
    return {ok: true, note: `The row ${row.name} is out of today's set; its pages stay in their worlds.`}
  }}
}

/** A page's own acts over its file (O-I #743, manual §10.9): Duplicate and Paste make the page again through the page owner (in its world, or
 * in the world it is pasted in), Cut moves it (the copy made, then the page taken out of its world), Delete takes it out of its world into
 * Central's trash, and a row's Duplicate copies each of its pages. A copy in a named row stands in that row too; a page taken out of its
 * world leaves today's named rows. Pure, apart from the acts it hands back. */
function centralPageActs(actions: WorldTrackActions, reading: CentralReading, worlds: readonly CentralWorld[], byPath: ReadonlyMap<string, Page>,
  rowPages: ReadonlyMap<string, readonly Page[]>, playing: ReadonlyMap<string, CentralPlaying>): void {
  const controls = reading.controls
  const set = reading.set?.state === 'read' ? reading.set.set : null
  const writeSet = set ? controls?.writeSet : undefined
  const rowOf = (columnId: string) => set?.rows.find(row => `central:row:${row.id}` === columnId) ?? null
  const worldOf = (ref: string) => worlds.find(world => world.ref === ref)
  const copyPage = controls?.copyPage, trashPage = controls?.trashPage
  /** The named row a clip stands in, by the column it is drawn in. */
  const columnOf = (page: Page) => [...rowPages].find(([, list]) => list.includes(page))?.[0] ?? null
  if (copyPage) {
    actions.duplicateClip = {op: 'the page owner\'s duplicate (kernel/src/page.rs): the page made again in its world with an identity of its own, through its world\'s door; in a named row, the row holds the copy beside it', run: async clipId => {
      const page = byPath.get(clipId)
      if (!page) return {ok: false, error: `"${clipId}" is no page of today's worlds.`}
      const made = await copyPage({location: page.location})
      const row = rowOf(columnOf(page) ?? '')
      if (row && writeSet) await writeSet(held => withRowChanged(held, row.id, kept => {
        const at = kept.pages.indexOf(page.location.ref)
        const pages = kept.pages.filter(ref => ref !== made.ref)
        pages.splice(at < 0 ? pages.length : at + 1, 0, made.ref)
        return {...kept, pages}
      }))
      return {ok: true, note: `${page.title} is copied in its world (${made.path})${row ? `, beside it in the row ${row.name}` : ''}.`}
    }}
    actions.pasteClip = {op: 'the page owner\'s duplicate into the world it is pasted in (kernel/src/page.rs), tied to that world; Cut then takes the page out of its own world into Central\'s trash', run: async (fromClipId, trackId, rowId, cut) => {
      const page = byPath.get(fromClipId)
      if (!page) return {ok: false, error: 'The page held is no page of today\'s worlds now: copy it again.'}
      const world = worlds.find(candidate => centralWorldTrackId(candidate.ref) === trackId)
      if (!world || !world.folder) return {ok: false, error: `"${trackId}" is no world of today's set that keeps pages.`}
      if (cut && !trashPage) return {ok: false, error: 'Cut moves the page, and nothing takes it out of its world here: Copy it instead.'}
      const made = await copyPage({location: page.location}, world.ref === page.world ? undefined : world)
      const row = rowOf(rowId)
      if (row && writeSet) await writeSet(held => withRowChanged(held, row.id, kept => ({...kept, pages: [...kept.pages.filter(ref => ref !== made.ref), made.ref]})))
      if (cut) await trashPage!({location: page.location, revision: page.revision})
      return {ok: true, note: `${page.title} ${cut ? 'is moved' : 'is copied'} into ${world.name} (${made.path})${row ? `, in the row ${row.name}` : ''}${cut ? '; the page it was is in Central\'s trash' : ''}.`}
    }}
    actions.duplicateRow = {op: 'the page owner\'s duplicate of each page in the row; a named row is copied as a new row beside it, holding the copies', run: async columnId => {
      const pages = rowPages.get(columnId) ?? []
      if (!pages.length) return {ok: false, error: 'The row holds no page to copy.'}
      const made: {path: string; ref: string}[] = []
      for (const page of pages) made.push(await copyPage({location: page.location}))
      const row = rowOf(columnId)
      if (row && writeSet && set) {
        const copy = {id: `row-${Date.now().toString(36)}`, name: row.name, pages: made.map(item => item.ref)}
        await writeSet(held => withRowAt(held, copy, held.rows.findIndex(kept => kept.id === row.id) + 1))
      }
      return {ok: true, note: `${plural(made.length, 'page is', 'pages are')} copied in ${made.length === 1 ? 'its world' : 'their worlds'}${row ? `, in a new row ${row.name} beside the row` : ''}.`}
    }}
  }
  if (trashPage) actions.deleteClip = {op: 'Central\'s trash (central.files.trash, through the page owner): the page leaves its world on the revision read, and Central\'s file history brings it back (central.files.restore)', run: async clipId => {
    const page = byPath.get(clipId)
    if (!page) return {ok: false, error: `"${clipId}" is no page of today's worlds.`}
    const plays = playing.get(page.location.ref)
    if (plays) {
      if (!controls?.stop) return {ok: false, error: `${page.title} plays now: stop it first, then Delete takes it out of its world.`}
      await controls.stop(plays)
    }
    await trashPage({location: page.location, revision: page.revision})
    const held = set?.rows.filter(row => row.pages.includes(page.location.ref)) ?? []
    if (held.length && writeSet) await writeSet(kept => held.reduce((next, row) => withRowChanged(next, row.id, r => ({...r, pages: r.pages.filter(ref => ref !== page.location.ref)})), kept))
    return {ok: true, note: `${page.title} left ${worldOf(page.world)?.name ?? 'its world'}${plays ? ' (stopped first)' : ''}: it is in Central's trash, and Central's file history brings it back.`}
  }}
}

export const centralTrackAdapter: WorldTrackAdapter<CentralReading> = {
  id: CENTRAL_TRACK_ADAPTER_ID,
  project: projectCentralTracks,
}
