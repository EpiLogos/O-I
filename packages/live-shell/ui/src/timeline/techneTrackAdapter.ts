// Technē's readings as tracks and its walks as stops, for the shared Session and Arrangement (T-TRACKS-TECHNE; manual §3 "In
// Technē a track might be the thread of a single reading of history, or every place a subject turned up, in order", "In
// Technē, a stop on a walk stands a place, a moment, and the scenes that belong there"; §8 "the timeline sets history beside
// the work that studied it, on one ruler that can stretch from deep time to this morning"; lock §9.1 Technē row: track = a native
// stream (a reading's thread, a subject's occurrences, a journey, runs, revisions, sky), clip = an event, occurrence or revision at
// its time and place, stop = a walk stop that stands its event and launches the Expression scene(s) it carries, takes = readings
// that extend a reading, layers and never rewrites; lock §9.2 a walk).
//
// Projection, over the one read the frame already publishes — the World cut's sets (projections/useWorldTemporalReading.ts):
// nothing is polled here, copied into a second store, or written.
// - tracks: six streams, always in the lock's order. Readings (a reading's events, then the walks through it: the whole reading
//   and its curated threads — projections/atlas/aionTimeline.ts), Occurrences (a subject's field thread, walks of kind
//   `field-thread` — projections/atlas/walkTimeline.ts), Journeys (every other walk: the Red Book, the dynamics route), Runs
//   (the World cut's run lanes — timeline/runTrackAdapter.ts), Revisions and Sky. A stream with no owner read stands as one
//   named, empty track whose owner's absence is in the track's `kind` text (the grid's name tooltip), never a fabricated clip.
//   The streams the World cut also carries for Central's own day (the day, machine NOW and kernel-log lanes, conversation
//   receipts) are Central's and Factory's: only the kinds in RUN_TRACK_KINDS are Technē's civil stream;
// - rows (stops): a walk stop is a row, `n/N` of its walk, walk after walk. The row stands the walk's own clip for that stop —
//   the clip the source walk names (`clipId`), else the stop itself as a clip, labelled and placed as the stop is. A reading's
//   event clip stands in the row of the derived whole-reading walk's stop for the same event (same label, same year); an event the
//   walk does not stand has a row of its own. A run receipt is one row each, newest first;
// - ruler: one, with the declared break into today (61%, TECHNE_DEEP_SHARE below): material with no time
//   first ("no time" slots, in order, no date invented), then deep history on the atlas's non-linear scale
//   (projections/atlas/src/data/time.ts createTimeScale, adopted by import, never re-ported), then the covered civil days'
//   hours (UTC), end to end. The ruler starts at 0, so a year is placed by the scale and never by its sign. A clip's `span` is the
//   source's years and is not carried: only `at` places a clip;
// - ids: a clip keeps the id the World cut gave it, so THE selection and the occasion route (`eventByClipId`) resolve it as they
//   resolve the World cut's own clips. Only a stop with no clip of its own is given one (`techne:stop:<walk>:<n>`);
// - layers, sections (an epoch's span, moved onto the ruler; a dynamics route's movement, whose span is in stop indices, laid
//   over the places its stops stand) and walks ride along as the contract names them (lock §7.2), the walks re-pointed at the
//   clips this set holds. The ruler also says where a civil instant stands (`ruler.instant`, inside a covered day), so material
//   known only by its instant — the spine's cron firings — stands where it happened. Takes are not carried: the layers say which reading extends which, and the
//   sources name no per-clip take;
// - follow: a stop's launch follows into the walk's next stop (lock §9.4: "follow = the walk's next stop"), read from the walk's
//   own order. Launch quantize is the shell's armed timing, not a reading of the stop, so it is absent;
// - actions: only through the owners that exist. A walk stop is stood through the one rule the Timeline and the Journey share
//   (timeline/journeyWalks.ts walkStopFocus → timeline/walkFocus.ts applyWalkStopFocus: its occasion on the spine, or its epoch
//   in the atlas) and launches the Expression it carries through the shell's own door (JourneyPresentation.openExpression, the
//   workspace's requestExpression). No controls handed in, or no stop in the set, no actions: the grid stays read-only. There is
//   no owner op that stops a walk or records one, so neither is offered.
//
// Pure TypeScript. No React, no transport.
import {browserCategoriesOf} from '../shell/modeGrammar'
import {createTimeScale, formatYear} from '../projections/atlas/src/data/time'
import type {SuiteStanding} from '../projections/atlas/provider/suiteStanding'
import type {WorldTimelineSource} from '../projections/useWorldTemporalReading'
import {journeyWalksOf} from './journeyWalks'
import {eventDayKey, type TemporalEventRow} from './timeSpine'
import type {
  WorldTrack,
  WorldTrackActions,
  WorldTrackAdapter,
  WorldTrackClip,
  WorldTrackColumn,
  WorldTrackLayer,
  WorldTrackSection,
  WorldTrackSet,
  WorldWalk,
  WorldWalkStop,
} from './worldTrackAdapter'

export const TECHNE_TRACK_ADAPTER_ID = 'techne-stream-tracks'

/** The ruler's length, in its own units. Large enough that the row-end-to-end fallback the shared Arrangement keeps for a clip
 * with no place can never outrun it. */
export const TECHNE_RULER_UNITS = 10_000
/** The declared break into today: deep history keeps this share of the ruler, the covered civil days take the rest. The World
 * cut's own presentation declared it first (`TODAY_BREAK = 61`, deleted with that presentation on 15 Oct); this is now the one
 * declaration. */
export const TECHNE_DEEP_SHARE = 0.61
/** Ruler units one "no time" slot takes. */
const NO_TIME_UNIT = 10
const MINUTES_PER_DAY = 1440

/** The track kinds and the walk kinds this adapter reads by, as the projections that produce them write them
 * (projections/atlas/aionTimeline.ts: EVENT_TRACK_KIND line 77, the walk kinds line 176; walkTimeline.ts: lines 54, 82 and 97;
 * runTrackAdapter.ts: lines 128 and 131). tests/techne-tracks.test.mjs projects the real adapters and holds these to what they
 * emit. */
export const READING_EVENTS_TRACK_KIND = 'atlas-aion-events'
export const WHOLE_READING_WALK_KIND = 'aion-whole-reading'
export const READING_THREAD_WALK_KIND = 'aion-thread'
export const FIELD_THREAD_WALK_KIND = 'field-thread'
export const REDBOOK_WALK_KIND = 'redbook'
export const DYNAMICS_ROUTE_WALK_KIND = 'dynamics-route'
/** The World cut's run lanes — the only civil kinds that are Technē's stream. */
export const RUN_TRACK_KINDS: ReadonlySet<string> = new Set(['run', 'run-overflow'])
const RUN_OVERFLOW_KIND = 'run-overflow'

/** A stop launches only what the Expression door opens: an `expression:` ref. Any other scene ref a family carries is named,
 * never handed to the door as if it were an Expression. */
export const isExpressionRef = (ref: string): boolean => ref.startsWith('expression:')

const STREAMS = [
  {id: 'readings', name: 'Readings', colour: 'var(--mode-narration, var(--track-default, var(--bg-3)))'},
  {id: 'occurrences', name: 'Occurrences', colour: 'var(--mode-artefact, var(--track-default, var(--bg-3)))'},
  {id: 'journeys', name: 'Journeys', colour: 'var(--mode-place, var(--track-default, var(--bg-3)))'},
  {id: 'runs', name: 'Runs', colour: 'var(--mode-flows, var(--track-default, var(--bg-3)))'},
  {id: 'revisions', name: 'Revisions', colour: 'var(--mode-day, var(--track-default, var(--bg-3)))'},
  {id: 'sky', name: 'Sky', colour: 'var(--mode-occasion, var(--track-default, var(--bg-3)))'},
] as const

export type TechneStreamId = (typeof STREAMS)[number]['id']
/** The six stream ids, in track order. */
export const TECHNE_STREAM_IDS: readonly TechneStreamId[] = STREAMS.map(stream => stream.id)
/** The track that stands for a stream no owner read fills. */
export const techneStreamTrackId = (stream: TechneStreamId): string => `techne:stream:${stream}`

/** The World cut's one temporal read, as the pane is given it: the sets it projected, the clip-to-occasion map the shell selects
 * through, and the year the civil field stands in (the deep-time scale ends there). */
export type TechneWorldReading =
  | {state: 'reading'}
  | {state: 'unavailable'; reason: string}
  | {state: 'live'; sets: readonly WorldTrackSet[]; eventByClipId: ReadonlyMap<string, TemporalEventRow>; todayYear: number | null}

/** The owners a stop is launched through, handed in by whoever holds them. */
export interface TechneControls {
  /** Stand the stop: its occasion on the spine, or its epoch in the atlas. Resolves to the named absence, or null when it stood. */
  stand(walk: WorldWalk, stop: WorldWalkStop): Promise<string | null>
  /** The shell's door to an Expression; absent, a stop's Expression is named but not opened. */
  openExpression?(ref: string): void
}

/** The answer to a launch: what happened, or the refusal in the owner's or the adapter's own words. */
export type TechneReceipt = {ok: true; note: string} | {ok: false; error: string}

export interface TechneReading {
  world: TechneWorldReading
  /** The Earth's standing (provider/suiteStanding.ts), for the words a stream without an owner read gives. */
  earth?: SuiteStanding
  /** The owners behind the actions; absent, the set has none. */
  controls?: TechneControls
}

/** The World cut's temporal read as this adapter reads it. */
export function worldReadingOf(source: WorldTimelineSource | undefined): TechneWorldReading {
  if (!source) return {state: 'unavailable', reason: 'the shell publishes no World reading to this pane'}
  if (source.status === 'live') {
    return {state: 'live', sets: source.sets, eventByClipId: source.eventByClipId, todayYear: source.now ? new Date(source.now.instantUnixMs).getUTCFullYear() : null}
  }
  if (source.status === 'reading') return {state: 'reading'}
  return {state: 'unavailable', reason: source.error ?? 'the kernel temporal read is unavailable'}
}

// ── ops the actions name ────────────────────────────────────────────────────────────────────────────────────────────────────

export const TECHNE_STAND_OP = 'applyWalkStopFocus: the stop\'s occasion on the spine, or its epoch in the atlas'
export const TECHNE_OPEN_OP = 'requestExpression: the Expression the stop carries'

// ── small helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`
const isDate = (key: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(key)
const shortDay = (key: string): string => key.slice(5)
const dayStartMs = (key: string): number => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
const clock = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))
const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value)
const stopRowId = (walkId: string, index: number): string => `techne:row:stop:${walkId}:${index + 1}`
const stopClipIdOf = (walkId: string, index: number): string => `techne:stop:${walkId}:${index + 1}`
const colourOf = (stream: TechneStreamId): string => STREAMS.find(item => item.id === stream)?.colour ?? 'var(--track-default, var(--bg-3))'

/** The words a walk's kind carries, in the lock's own: which stream a walk is and what it is of. */
const WALK_WORDS: Readonly<Record<string, string>> = {
  [WHOLE_READING_WALK_KIND]: 'a reading\'s whole walk',
  [READING_THREAD_WALK_KIND]: 'a reading\'s thread',
  [FIELD_THREAD_WALK_KIND]: 'a subject\'s occurrences',
  [REDBOOK_WALK_KIND]: 'a journey · the Red Book',
  [DYNAMICS_ROUTE_WALK_KIND]: 'a journey · the dynamics route',
}

function walkKindText(walk: WorldWalk): string {
  const stops = walk.stops.length
  return `${WALK_WORDS[walk.kind] ?? `a journey · ${walk.kind}`} · ${walk.derived ? 'derived on read' : 'curated'} · ${plural(stops, 'stop', 'stops')}`
}

/** What the Earth says about itself, in the counts it publishes (provider/suiteStanding.ts). */
function earthWords(earth: SuiteStanding | undefined): string {
  if (!earth || earth.phase === 'idle') return 'the Earth has not read your world yet'
  if (earth.phase === 'reading') return 'the Earth is reading your world'
  if (earth.phase === 'unavailable') return 'the Earth could not read your world'
  const {counts} = earth
  return `the Earth holds ${plural(counts.subjects, 'subject', 'subjects')}: ${counts.located} placed, ${counts.dated} dated, ${plural(counts.places, 'place', 'places')}`
}

function worldWords(world: TechneWorldReading): string {
  if (world.state === 'reading') return 'the civil field is being read'
  if (world.state === 'unavailable') return `the civil field is unread (${world.reason})`
  return ''
}

/** A stream with no reader here: its owner's absence, in words. A stream the World cut would fill, named by its grammar category
 * where the mode grammar declares one (shell/modeGrammar.ts, the `techne` browser). */
function absenceText(stream: TechneStreamId, reading: TechneReading): string {
  const unread = worldWords(reading.world)
  switch (stream) {
    case 'readings':
      return unread
        ? `stream · waiting — ${unread}; the World cut carries no reading until its temporal read lands`
        : 'stream · waiting — no Aion reading is carried: the atlas publishes one only when its corpus bundle holds a history, and the suite provider yields none'
    case 'occurrences':
      return `stream · waiting — a subject\'s occurrences are the Earth\'s field thread for a subject in focus, and none is published to this pane · ${earthWords(reading.earth)}`
    case 'journeys': {
      const category = browserCategoriesOf('techne').find(item => item.id === 'techne-journeys')
      return category && category.state === 'waiting'
        ? `stream · waiting — ${category.hint}`
        : 'stream · waiting — no walk is carried: a journey\'s stops are read from the World\'s walks'
    }
    case 'runs':
      return unread
        ? `stream · waiting — ${unread}; the run lanes come from the same read`
        : 'stream · no run is admitted or has a receipt in the window'
    case 'revisions':
      return 'stream · waiting — no stream of the civil field reads a source\'s revisions, so none is published to this pane'
    case 'sky':
      return 'stream · waiting — the sky is the QL family\'s snapshot of one epoch (ql.sky-snapshot/v1); no stream of skies over dates is published to this pane'
  }
}

// ── placement ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Where the source puts a clip: a year, an instant in a civil day, or nowhere. */
type Place =
  | {kind: 'year'; year: number}
  | {kind: 'civil'; day: string; minute: number}
  | {kind: 'none'}

interface Draft {
  clip: Omit<WorldTrackClip, 'at'>
  place: Place
}

/** A run receipt's place: its instant, held inside the civil day the owner's day_ref names (never the day before). */
function civilPlaceOf(event: TemporalEventRow | undefined): {place: Place; instant: number | null} {
  if (!event) return {place: {kind: 'none'}, instant: null}
  const key = eventDayKey(event)
  const instant = finite(event.instant_unix_ms) ? event.instant_unix_ms : null
  if (instant === null || key === null || !isDate(key)) return {place: {kind: 'none'}, instant}
  return {place: {kind: 'civil', day: key, minute: clamp(Math.round((instant - dayStartMs(key)) / 60000), 0, MINUTES_PER_DAY - 1)}, instant}
}

interface Lane {
  track: WorldTrack
  /** A reading's event track. */
  events?: boolean
  walk?: WorldWalk
}

// ── the projection ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export function projectTechneTracks(reading: TechneReading): WorldTrackSet {
  const world = reading.world
  const sets = world.state === 'live' ? world.sets : []
  const eventByClipId: ReadonlyMap<string, TemporalEventRow> = world.state === 'live' ? world.eventByClipId : new Map()

  // What the World cut carries, indexed. First sight wins, as the World cut's own consumers read it.
  const trackById = new Map<string, WorldTrack>()
  const clipById = new Map<string, WorldTrackClip>()
  const clipsOf = new Map<string, WorldTrackClip[]>()
  for (const set of sets) {
    for (const track of set.tracks) if (!trackById.has(track.id)) trackById.set(track.id, track)
    for (const clip of set.clips) {
      if (clipById.has(clip.id)) continue
      clipById.set(clip.id, clip)
      const own = clipsOf.get(clip.trackId)
      if (own) own.push(clip)
      else clipsOf.set(clip.trackId, [clip])
    }
  }
  const walks: WorldWalk[] = []
  for (const walk of journeyWalksOf(sets)) if (!walks.some(seen => seen.id === walk.id)) walks.push(walk)
  const layers: WorldTrackLayer[] = []
  const sections: WorldTrackSection[] = []
  // A section's span is in its family's own units (worldTrackAdapter.ts). An Aion epoch's and a Red Book section's are years; a
  // dynamics route's movement spans its walk's stop indices (projections/atlas/walkTimeline.ts:85-97), so it is placed through
  // its stops, never read as years.
  const stopUnits = new Map<string, string>()
  for (const set of sets) {
    for (const layer of set.layers ?? []) if (!layers.some(seen => seen.id === layer.id)) layers.push(layer)
    const route = set.walks?.find(walk => walk.kind === DYNAMICS_ROUTE_WALK_KIND)
    for (const section of set.sections ?? []) {
      if (sections.some(seen => seen.id === section.id)) continue
      sections.push(section)
      if (route) stopUnits.set(section.id, route.id)
    }
  }
  const yearSections = sections.filter(section => !stopUnits.has(section.id))
  const layerName = new Map(layers.map(layer => [layer.id, layer.name]))

  // ── lanes: the streams that have an owner read ────────────────────────────────────────────────────────────────────────────
  const walkTrackId = (walk: WorldWalk): string => {
    for (const stop of walk.stops) {
      const clip = stop.clipId !== undefined ? clipById.get(stop.clipId) : undefined
      if (clip) return clip.trackId
    }
    return `techne:walk:${walk.id}`
  }
  const walkLane = (walk: WorldWalk, stream: TechneStreamId): Lane => {
    const prefix = walk.layerId !== undefined && layers.length > 1 ? `${layerName.get(walk.layerId) ?? walk.layerId} · ` : ''
    return {walk, track: {id: walkTrackId(walk), name: `${prefix}${walk.name}`, color: colourOf(stream), kind: walkKindText(walk), ...(walk.layerId !== undefined ? {layerId: walk.layerId} : {})}}
  }
  const readingWalks = walks.filter(walk => walk.layerId !== undefined)
  const readingLanes: Lane[] = []
  const laned = new Set<WorldWalk>()
  for (const source of trackById.values()) {
    if (source.kind !== READING_EVENTS_TRACK_KIND) continue
    const extended = layers.find(layer => layer.id === source.layerId)?.extends
    readingLanes.push({events: true, track: {
      id: source.id, name: source.name, color: colourOf('readings'), ...(source.layerId !== undefined ? {layerId: source.layerId} : {}),
      kind: `reading · ${plural((clipsOf.get(source.id) ?? []).length, 'event', 'events')}${extended !== undefined ? ` · extends ${layerName.get(extended) ?? extended}` : ''}`,
    }})
    for (const walk of readingWalks) {
      if (walk.layerId !== source.layerId || laned.has(walk)) continue
      laned.add(walk)
      readingLanes.push(walkLane(walk, 'readings'))
    }
  }
  for (const walk of readingWalks) if (!laned.has(walk)) readingLanes.push(walkLane(walk, 'readings'))
  const occurrenceLanes = walks.filter(walk => walk.layerId === undefined && walk.kind === FIELD_THREAD_WALK_KIND).map(walk => walkLane(walk, 'occurrences'))
  const journeyLanes = walks.filter(walk => walk.layerId === undefined && walk.kind !== FIELD_THREAD_WALK_KIND).map(walk => walkLane(walk, 'journeys'))
  const runLanes: Lane[] = [...trackById.values()].filter(source => RUN_TRACK_KINDS.has(source.kind)).map(source => ({
    track: {
      id: source.id, name: source.name, color: colourOf('runs'),
      kind: source.kind === RUN_OVERFLOW_KIND ? 'run · beyond the lane bound, named and not drawn' : `run · ${plural((clipsOf.get(source.id) ?? []).length, 'receipt', 'receipts')} in the window`,
    },
  }))
  const lanes: Record<TechneStreamId, Lane[]> = {readings: readingLanes, occurrences: occurrenceLanes, journeys: journeyLanes, runs: runLanes, revisions: [], sky: []}

  // ── rows and clips ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const orderedWalks = [...readingLanes, ...occurrenceLanes, ...journeyLanes].flatMap(lane => lane.walk ? [lane.walk] : [])
  const trackOfWalk = new Map<WorldWalk, string>()
  for (const lane of [...readingLanes, ...occurrenceLanes, ...journeyLanes]) if (lane.walk && !trackOfWalk.has(lane.walk)) trackOfWalk.set(lane.walk, lane.track.id)

  const columns: WorldTrackColumn[] = []
  const drafts: Draft[] = []
  const usedClipIds = new Set<string>()
  const stopClipIds = new Map<WorldWalk, string[]>()
  for (const walk of orderedWalks) {
    const trackId = trackOfWalk.get(walk) as string
    const total = walk.stops.length
    const ids: string[] = []
    walk.stops.forEach((stop, index) => {
      const row = stopRowId(walk.id, index)
      columns.push({id: row, name: `${index + 1}/${total} · ${stop.label}`})
      const source = stop.clipId !== undefined ? clipById.get(stop.clipId) : undefined
      // The clip the source walk names; a clip two stops name (the same event twice in a thread) is stood once, the second stop
      // standing itself.
      const id = source && !usedClipIds.has(source.id) ? source.id : stopClipIdOf(walk.id, index)
      usedClipIds.add(id)
      ids.push(id)
      const year = finite(stop.year) ? stop.year : finite(source?.span?.start) ? source?.span?.start : undefined
      const next = walk.stops[index + 1]
      drafts.push({
        clip: {
          id, trackId, columnId: row, label: source?.label ?? stop.label,
          ...(source?.state !== undefined ? {state: source.state} : {}),
          ...(source?.standing ? {standing: source.standing} : {}),
          ...(next ? {launch: {follow: `stop ${index + 2}/${total} · ${next.label}`}} : {}),
        },
        place: year !== undefined ? {kind: 'year', year} : {kind: 'none'},
      })
    })
    stopClipIds.set(walk, ids)
  }

  // A reading's events: in the row of the derived whole-reading walk's stop for the same event; else a row of their own.
  const eventRows: WorldTrackColumn[] = []
  for (const lane of readingLanes) {
    if (!lane.events) continue
    const pool = orderedWalks.filter(walk => walk.derived && walk.layerId === lane.track.layerId)
      .flatMap(walk => walk.stops.map((stop, index) => ({stop, row: stopRowId(walk.id, index), used: false})))
    for (const clip of clipsOf.get(lane.track.id) ?? []) {
      const year = clip.span?.start
      const hit = pool.find(entry => !entry.used && entry.stop.label === clip.label && entry.stop.year === year)
      let row: string
      if (hit) {
        hit.used = true
        row = hit.row
      } else {
        row = `techne:row:event:${clip.id}`
        eventRows.push({id: row, name: finite(year) ? `${formatYear(year)} · ${clip.label}` : clip.label})
      }
      drafts.push({
        clip: {id: clip.id, trackId: lane.track.id, columnId: row, label: clip.label, ...(clip.state !== undefined ? {state: clip.state} : {}), ...(clip.standing ? {standing: clip.standing} : {})},
        place: finite(year) ? {kind: 'year', year} : {kind: 'none'},
      })
    }
  }
  columns.push(...eventRows)

  // Run receipts: a row each, newest first, as Central lists its days.
  const runDrafts: {draft: Draft; instant: number | null; name: string}[] = []
  for (const lane of runLanes) {
    for (const clip of clipsOf.get(lane.track.id) ?? []) {
      const {place, instant} = civilPlaceOf(eventByClipId.get(clip.id))
      runDrafts.push({
        instant,
        name: place.kind === 'civil' ? `${shortDay(place.day)} ${clock(place.minute)} · ${clip.label}` : `no time · ${clip.label}`,
        draft: {clip: {id: clip.id, trackId: lane.track.id, columnId: `techne:row:run:${clip.id}`, label: clip.label, ...(clip.standing ? {standing: clip.standing} : {})}, place},
      })
    }
  }
  runDrafts.sort((a, b) => {
    const left = a.instant ?? Number.NEGATIVE_INFINITY
    const right = b.instant ?? Number.NEGATIVE_INFINITY
    return left === right ? 0 : right > left ? 1 : -1
  })
  for (const run of runDrafts) {
    columns.push({id: run.draft.clip.columnId as string, name: run.name})
    drafts.push(run.draft)
  }

  // ── the ruler ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const years: number[] = []
  for (const draft of drafts) if (draft.place.kind === 'year') years.push(draft.place.year)
  for (const section of yearSections) years.push(section.span.start, section.span.end)
  const civilDays = [...new Set(drafts.flatMap(draft => draft.place.kind === 'civil' ? [draft.place.day] : []))].sort()
  const noTime = drafts.filter(draft => draft.place.kind === 'none').length
  const hasDeep = years.length > 0
  const hasToday = civilDays.length > 0
  const deepStart = noTime * NO_TIME_UNIT
  const deepShare = Math.round(TECHNE_RULER_UNITS * TECHNE_DEEP_SHARE)
  const deepWidth = hasDeep ? (hasToday ? deepShare : TECHNE_RULER_UNITS) : 0
  const todayStart = deepStart + deepWidth
  const dayWidth = hasToday ? (hasDeep ? TECHNE_RULER_UNITS - deepShare : TECHNE_RULER_UNITS) / civilDays.length : 0
  let lowYear = -1000
  let highYear = world.state === 'live' && world.todayYear !== null ? world.todayYear : Number.NEGATIVE_INFINITY
  for (const year of years) {
    if (year < lowYear) lowYear = year
    if (year > highYear) highYear = year
  }
  const scale = hasDeep ? createTimeScale(lowYear, highYear) : null
  const yearAt = (year: number): number => deepStart + (scale ? scale.toU(year) : 0) * deepWidth

  let slot = 0
  const clips: WorldTrackClip[] = drafts.map(({clip, place}) => {
    if (place.kind === 'year') return {...clip, at: {start: yearAt(place.year)}}
    if (place.kind === 'civil') return {...clip, at: {start: todayStart + (civilDays.indexOf(place.day) + place.minute / MINUTES_PER_DAY) * dayWidth}}
    return {...clip, at: {start: slot++ * NO_TIME_UNIT}}
  })

  const label = (at: number): string => {
    if (at < deepStart) return `no time · ${Math.floor(at / NO_TIME_UNIT) + 1}`
    if (hasDeep && (!hasToday || at < todayStart) && scale) return formatYear(scale.fromU(clamp((at - deepStart) / deepWidth, 0, 1)))
    if (!hasToday) return ''
    const within = Math.max(0, at - todayStart)
    const index = Math.min(civilDays.length - 1, Math.floor(within / dayWidth))
    return `${shortDay(civilDays[index])} ${clock(clamp(Math.round(((within - index * dayWidth) / dayWidth) * MINUTES_PER_DAY), 0, MINUTES_PER_DAY - 1))}`
  }
  // Where a civil instant stands: inside a covered day, at its UTC minute (the same placement a run receipt gets); a day the
  // ruler does not cover has no place.
  const instant = (unixMs: number): number | undefined => {
    if (!hasToday || !finite(unixMs)) return undefined
    const key = new Date(unixMs).toISOString().slice(0, 10)
    const index = civilDays.indexOf(key)
    if (index < 0) return undefined
    return todayStart + (index + clamp(Math.round((unixMs - dayStartMs(key)) / 60000), 0, MINUTES_PER_DAY - 1) / MINUTES_PER_DAY) * dayWidth
  }
  const unit = [
    noTime ? 'no-time slots' : '',
    hasDeep ? 'deep-time years (the atlas\'s non-linear scale)' : '',
    hasToday ? 'UTC hours of the covered days' : '',
  ].filter(Boolean).join(', then ')

  // ── tracks ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const tracks: WorldTrack[] = []
  for (const stream of STREAMS) {
    const own = lanes[stream.id].map(lane => lane.track)
    if (own.length) {
      for (const track of own) if (!tracks.some(seen => seen.id === track.id)) tracks.push(track)
    } else {
      tracks.push({id: techneStreamTrackId(stream.id), name: stream.name, color: stream.colour, kind: absenceText(stream.id, reading)})
    }
  }

  // ── walks, re-pointed at the clips this set holds ────────────────────────────────────────────────────────────────────────
  const outWalks: WorldWalk[] = orderedWalks.map(walk => ({...walk, stops: walk.stops.map((stop, index) => ({...stop, clipId: (stopClipIds.get(walk) as string[])[index]}))}))
  const set: WorldTrackSet = {columns, tracks, clips}
  if (noTime || hasDeep || hasToday) set.ruler = {unit, label, ...(hasToday ? {instant} : {})}
  if (layers.length) set.layers = layers
  // Sections on the ruler: a year span by the deep-time scale; a stop-index span over the places its stops' clips stand (the last
  // stop's slot included), and none when no stop of it has a place.
  const placedAt = new Map(clips.map(clip => [clip.id, clip.at?.start]))
  const onRuler = sections.flatMap((section): WorldTrackSection[] => {
    const routeId = stopUnits.get(section.id)
    if (routeId === undefined) return hasDeep ? [{...section, span: {start: yearAt(section.span.start), end: yearAt(section.span.end)}}] : []
    const route = orderedWalks.find(walk => walk.id === routeId)
    const ids = route ? (stopClipIds.get(route) ?? []).slice(section.span.start, section.span.end) : []
    const starts = ids.map(id => placedAt.get(id)).filter(finite)
    return starts.length ? [{...section, span: {start: Math.min(...starts), end: Math.max(...starts) + NO_TIME_UNIT}}] : []
  })
  if (onRuler.length) set.sections = onRuler
  if (outWalks.length) set.walks = outWalks
  const actions = reading.controls ? actionsFor(reading.controls, outWalks) : undefined
  if (actions) set.actions = actions
  return set
}

// ── actions ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const refused = (error: string): Promise<TechneReceipt> => Promise.resolve({ok: false, error})

/** A stop stood, and the Expression it carries opened. Each half goes through its owner and is reported on its own: a stop the
 * atlas cannot stand still opens its scene, and a stop that stood but carries no scene says so. */
async function launchStop(controls: TechneControls, walk: WorldWalk, stop: WorldWalkStop): Promise<TechneReceipt> {
  let absence: string | null
  try {
    absence = await controls.stand(walk, stop)
  } catch (cause) {
    absence = cause instanceof Error ? cause.message : String(cause)
  }
  const notes: string[] = []
  const problems: string[] = []
  if (absence === null) notes.push(`Stood ${stop.label}.`)
  else problems.push(absence)
  const ref = stop.sceneRef
  if (ref === undefined) {
    if (absence === null) notes.push('It carries no Expression.')
  } else if (!isExpressionRef(ref)) {
    problems.push(`${stop.label} carries ${ref}, which is not an Expression the shell can open.`)
  } else if (!controls.openExpression) {
    problems.push(`${stop.label} carries ${ref}, but the shell offers no door to open it here.`)
  } else {
    try {
      controls.openExpression(ref)
      notes.push(`Opened ${ref}.`)
    } catch (cause) {
      problems.push(cause instanceof Error ? cause.message : String(cause))
    }
  }
  return notes.length ? {ok: true, note: [...notes, ...problems].join(' ')} : {ok: false, error: problems.join(' ')}
}

/** The actions the owners give, over this set's own ids: an id that is not a walk stop of the set is refused before any owner is
 * called. None when there is no stop to launch. */
function actionsFor(controls: TechneControls, walks: readonly WorldWalk[]): WorldTrackActions | undefined {
  const rowStop = new Map<string, {walk: WorldWalk; stop: WorldWalkStop}>()
  const clipStop = new Map<string, {walk: WorldWalk; stop: WorldWalkStop}>()
  for (const walk of walks) {
    walk.stops.forEach((stop, index) => {
      rowStop.set(stopRowId(walk.id, index), {walk, stop})
      if (stop.clipId !== undefined && !clipStop.has(stop.clipId)) clipStop.set(stop.clipId, {walk, stop})
    })
  }
  if (!rowStop.size) return undefined
  const op = controls.openExpression ? `${TECHNE_STAND_OP} · ${TECHNE_OPEN_OP}` : TECHNE_STAND_OP
  return {
    launchStop: {op, run: columnId => {
      const found = rowStop.get(columnId)
      return found ? launchStop(controls, found.walk, found.stop) : refused(`"${columnId}" is not a walk stop of this work: an event or a run is read, not launched.`)
    }},
    launch: {op, run: clipId => {
      const found = clipStop.get(clipId)
      return found ? launchStop(controls, found.walk, found.stop) : refused(`"${clipId}" is not a walk stop of this work: an event or a run is read, not launched.`)
    }},
  }
}

export const techneTrackAdapter: WorldTrackAdapter<TechneReading> = {
  id: TECHNE_TRACK_ADAPTER_ID,
  project: projectTechneTracks,
}
