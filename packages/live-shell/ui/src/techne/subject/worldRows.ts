// Technē's World groups as browser rows [the ticket N, PATH §7 S1; DLW manual §8 "Find a subject and gather what surrounds it" and
// "Everything starts from the world"; §10.3 "To preview something, select it once. To open it, double-click it"; lock §0.1.2
// "Central: your planet is Central; projects are places on its surface"; world-shell-mockup.html renderBrowser() :1501–1505].
//
// A pure model: the landed owners' readings in, rows and words out. It reads only what the owners published:
//   - the suite reading's standing (projections/atlas/provider/suiteStanding.ts — `places`, the inputs' own states and details,
//     `describeStanding` / `describeProgress`): Locations are the project spaces on your planet (`kind: 'project'`), Earth places
//     the places an owner declares (`kind: 'declared'`), each by the owner's own ref, name and standing;
//   - the World cut's walks (the published World reading, timeline/journeyWalks.ts `journeyWalksOf`), sorted as the tracks sort
//     them (timeline/techneTrackAdapter.ts: a walk of no reading and not a field thread is a journey);
//   - the subject door's answer for a row (subjectOpenings.ts), whose words stand in the row's standing slot.
// It makes up no place, no body, no walk and no Scene; a group the owners have not answered says so in the standing's words.
//
// Pure TypeScript: no React, no DOM, no transport.

import {SUITE_INPUT_LABELS, describeProgress, describeStanding, type SuiteInputName, type SuitePlace, type SuiteStanding} from '../../projections/atlas/provider/suiteStanding'
import {FIELD_THREAD_WALK_KIND, type TechneWorldReading} from '../../timeline/techneTrackAdapter'
import {journeyWalksOf} from '../../timeline/journeyWalks'
import type {WorldWalk} from '../../timeline/worldTrackAdapter'
import type {KindShapeName} from '../../inhabitants/sdk/icons'
import type {SubjectScene, WorldSubject} from './subjectScenes'
import type {SubjectOpening} from './subjectOpenings'

/** An answer that carries Scenes (the door found where the subject stands), whatever the stage has answered since. */
const hasScenes = (opening: SubjectOpening | undefined): opening is Extract<SubjectOpening, {opened: SubjectScene}> => !!opening && 'opened' in opening

/** The World groups that have a row source here, by their browser category id (shell/modeGrammar.ts, the `techne` browser).
 * Palaces has none: its owner (N4, palaces on the atlas) has not landed, and the browser draws it designed empty. */
export const WORLD_GROUP_IDS = ['techne-bodies', 'techne-locations', 'techne-places', 'techne-journeys'] as const
export type WorldGroupId = (typeof WORLD_GROUP_IDS)[number]
export const isWorldGroup = (id: string): id is WorldGroupId => (WORLD_GROUP_IDS as readonly string[]).includes(id)

/** One row of a World group: the browser's row grammar (mark · name in words · standing), the subject it holds, and what selecting
 * it makes THE selection (`kind`, WorldSelection.kind — the aperture's marks read `place` and `location`). */
export interface WorldRow {
  key: string
  subject: WorldSubject & {title: string}
  kind: 'location' | 'place' | 'journey'
  mark: KindShapeName
  name: string
  standing: string
  hover: string
  /** A journey opens by standing its first stop (the tracks' own rule); a subject opens through the subject door. */
  opens: 'subject' | 'walk'
  /** The walk a journey row stands for. */
  walk?: WorldWalk
}

/** THE selection's kinds that are a World subject the door opens (a Location, an Earth place): the detail names such a selection
 * and lists the Scenes that carry it. A journey is a walk, which the Session grid stands; it is not a subject of the door. */
export const WORLD_SUBJECT_KINDS: ReadonlySet<string> = new Set<WorldRow['kind']>(['location', 'place'])

/** The World subject THE selection holds, or null when the selection is something else (a Day, a clip, a walk). */
export function worldSubjectOf(selection: {kind: string; ref: string; title: string} | null | undefined): {kind: string; ref: string; title: string} | null {
  return selection && WORLD_SUBJECT_KINDS.has(selection.kind) ? {kind: selection.kind, ref: selection.ref, title: selection.title} : null
}

/** A group's rows, or the words a group says while it has none: what it waits on, in the standing's words, under a one-word state
 * (reading while the owners are read, waiting on an input not there, none when the owners answered with nothing for it). */
export type WorldGroup =
  | {state: 'rows'; rows: readonly WorldRow[]; note: string | null}
  | {state: 'waiting'; word: 'reading' | 'waiting' | 'none'; words: string; detail: string | null}

/** What the World groups read: the suite standing, the World cut's one temporal read as the tracks are given it
 * (timeline/techneTrackAdapter.ts `worldReadingOf`), and whether the kernel carrier is there to read the suite through. */
export interface WorldReadings {
  standing: SuiteStanding
  world: TechneWorldReading
  carrier: {available: true} | {available: false; reason: string}
}

/** The World's walks as the World reading carries them, or why there are none to read (the reading is not in). */
export function walksOfWorld(world: TechneWorldReading): {walks: readonly WorldWalk[]} | {unread: string} {
  if ('sets' in world) return {walks: journeyWalksOf(world.sets)}
  return {unread: 'reason' in world ? world.reason : 'the civil field is being read'}
}

// ── words ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`
/** One sentence, ending in exactly one full stop (an owner's own words may already end in one; suiteStanding.ts `sentence`). */
const sentence = (text: string): string => `${text.trim().replace(/[.\s]+$/, '')}.`

/** The tail of an owner's ref, as the suite reading names a project the owner gives no title (provider/suiteReading.ts `tailOf`). */
export function tailOfRef(ref: string): string {
  const trimmed = ref.replace(/[:/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf(':'), trimmed.lastIndexOf('/'))
  return cut >= 0 ? trimmed.slice(cut + 1) : trimmed
}

/** A place's name in words: the owner's name, else (the provider names an unnamed place by its ref) the ref's tail. */
const placeName = (place: SuitePlace): string => (place.name && place.name !== place.ref ? place.name : tailOfRef(place.ref) || place.ref)

/** What the standing says while the owners are being read, or why nothing was read. Empty when it has nothing to say. */
export function standingWords(standing: SuiteStanding): string {
  if (standing.phase === 'idle') return ''
  if (standing.phase === 'reading') return describeProgress(standing)
  return describeStanding(standing)
}

/** One input as the standing names it ("Central’s wiki: still being read"; "The shared field: unavailable — <the owner's detail>"). */
function inputWords(standing: SuiteStanding, name: SuiteInputName): string {
  const input = standing.inputs[name]
  const label = input?.label ?? SUITE_INPUT_LABELS[name]
  if (!input || standing.phase === 'idle') return `${label}: not read yet`
  if (input.state === 'available') return `${label}: read (${plural(input.rows, 'row', 'rows')})`
  if (input.state === 'reading') return `${label}: still being read`
  return `${label}: ${input.state === 'deferred' ? 'not read' : 'unavailable'}${input.detail ? ` — ${input.detail}` : ''}`
}

/** The words a group says when the suite has not been read, or is being read with nothing for it yet. */
function unreadWords(readings: WorldReadings, what: string): {word: 'reading' | 'waiting'; words: string; detail: string | null} | null {
  const {standing, carrier} = readings
  if (standing.phase === 'idle') {
    return carrier.available
      ? {word: 'reading', words: `Reading your world — ${what} come from the suite reading of your owners.`, detail: null}
      : {word: 'waiting', words: `${what[0].toUpperCase()}${what.slice(1)} come from the suite reading of your owners, which reads through the kernel carrier.`, detail: sentence(`The kernel carrier is unavailable: ${carrier.reason}`)}
  }
  if (standing.phase === 'reading') return {word: 'reading', words: describeProgress(standing), detail: null}
  return null
}

// ── the subject door's answer, in a row ─────────────────────────────────────────────────────────────────────────────────────

/** A row's standing and hover once the door has answered for its subject: the Scene asked for while the stage has not answered,
 * the Scene shown (and how many more carry it), the stage's refusal in its own words, or the owner's absence words verbatim.
 * Null while the door has not been asked. */
export function openingWords(opening: SubjectOpening | undefined, name: string): {standing: string; hover: string} | null {
  if (!opening) return null
  if (opening.state === 'opening') return {standing: 'opening…', hover: `Asking where ${name} stands in the wiki — the owner's reverse query over its registers.`}
  if (opening.state === 'absent') return {standing: opening.reason, hover: opening.reason}
  const more = opening.scenes.length - 1
  const others = more > 0 ? ` ${plural(more, 'more Scene carries', 'more Scenes carry')} it, listed under the row.` : ''
  if (opening.state === 'asked') return {
    standing: `asking for ${opening.opened.scene_title}…`,
    hover: `Technē was asked to open ${opening.opened.scene_title}, the Scene that carries ${name}; the stage has not answered yet.${others}`,
  }
  if (opening.state === 'refused') return {standing: opening.reason, hover: `${opening.reason}${others}`}
  return {
    standing: `in ${opening.opened.scene_title}${more > 0 ? ` · +${more}` : ''}`,
    hover: `Technē's stage shows ${opening.opened.scene_title}, the Scene that carries ${name} (${opening.expression_ref}).${others}`,
  }
}

/** One Scene that carries the opened subject, as a row under it: the Scene's own title, and what it is to the subject. */
export interface SceneRow {
  key: string
  scene: SubjectScene
  name: string
  standing: string
  hover: string
  asked: boolean
}

/** The asked Scene's word under its row, by the stage's answer. */
const ASKED_WORD = {asked: 'asked', shown: 'open', refused: 'not open'} as const
const ASKED_HOVER = {asked: 'Technē was asked to open it; the stage has not answered yet.', shown: 'Technē\'s stage shows it.',
  refused: 'Technē was asked to open it and the stage did not; the row says why.'} as const

/** The Scenes under an opened row: the one asked for first, then the others in the door's order. Empty unless the door found
 * where the subject stands. */
export function sceneRowsOf(opening: SubjectOpening | undefined, subjectName: string): SceneRow[] {
  if (!hasScenes(opening)) return []
  return opening.scenes.map(scene => {
    const asked = scene.scene_ref === opening.opened.scene_ref
    const what = scene.whole ? 'its own constellation' : scene.overview ? 'the register’s overview' : 'carries it'
    return {
      key: `${scene.registerKey}\u0000${scene.scene_ref}`, scene, name: scene.scene_title, asked,
      standing: asked ? ASKED_WORD[opening.state] : what,
      hover: `${scene.scene_title} — ${scene.whole ? `the constellation ${subjectName} is the whole of` : scene.overview ? `the ${scene.registerKey} register's overview, which stands ${subjectName}` : `a Scene that carries ${subjectName}`} (${scene.registerKey} register). ${asked ? ASKED_HOVER[opening.state] : 'Press to open it instead.'}`,
    }
  })
}

// ── the groups ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

const SELECTS = 'Select to hold it as the subject; double-click or Enter opens it in the Scene that carries it.'

/** Locations: the project spaces on your planet, as the suite reading names them (lock §0.1.2: projects are places on its surface). */
export function locationRows(places: readonly SuitePlace[]): WorldRow[] {
  return places.filter(place => place.kind === 'project').map(place => {
    const name = placeName(place)
    return {
      key: place.ref, kind: 'location', mark: 'location', name, standing: 'project', opens: 'subject',
      subject: {ref: place.ref, title: name, native_owner: place.owner},
      hover: `${name} — a project space on your planet, disclosed by ${place.owner} through ${place.source} (${place.ref}). ${place.located ? '' : `Not on the Earth: ${place.reason ?? 'no owner declares where it is'}. `}${SELECTS}`,
    }
  })
}

/** Earth places: the places an owner declares, one row per place (several subjects may declare one), standing on the owner's own
 * precision — or unlocated, with the reason in the hover. */
export function earthPlaceRows(places: readonly SuitePlace[]): WorldRow[] {
  const byRef = new Map<string, SuitePlace[]>()
  for (const place of places) {
    if (place.kind !== 'declared') continue
    const list = byRef.get(place.ref)
    if (list) list.push(place); else byRef.set(place.ref, [place])
  }
  return [...byRef.values()].map(declared => {
    const place = declared.find(entry => entry.located) ?? declared[0]
    const name = placeName(place)
    const where = place.located && place.lat !== undefined && place.lon !== undefined
      ? `on the Earth at ${place.lat.toFixed(3)}, ${place.lon.toFixed(3)} (${place.precision})`
      : `not on the Earth: ${place.reason ?? 'the owner declares it unlocated'}`
    const by = [...new Set(declared.map(entry => entry.subject_ref).filter((ref): ref is string => !!ref))]
    const relations = [...new Set(declared.map(entry => entry.relation).filter((relation): relation is string => !!relation))]
    return {
      key: place.ref, kind: 'place', mark: 'place', name, standing: place.located ? place.precision : 'unlocated', opens: 'subject',
      subject: {ref: place.ref, title: name, native_owner: place.owner},
      hover: `${name} — ${where}; declared by ${by.length ? plural(by.length, 'subject', 'subjects') : 'its owner'} through ${place.source}${relations.length ? ` (${relations.join(', ')})` : ''} (${place.ref}). ${SELECTS}`,
    }
  })
}

/** Journeys: the World's walks that belong to no reading and are not a subject's field thread — the tracks' own Journeys stream
 * (timeline/techneTrackAdapter.ts `journeyLanes`). */
export function journeyRows(walks: readonly WorldWalk[]): WorldRow[] {
  const seen = new Set<string>()
  const journeys = walks.filter(walk => {
    if (walk.layerId !== undefined || walk.kind === FIELD_THREAD_WALK_KIND || seen.has(walk.id)) return false
    seen.add(walk.id)
    return true
  })
  return journeys.map(walk => ({
    key: walk.id, kind: 'journey', mark: 'journey', name: walk.name, standing: plural(walk.stops.length, 'stop', 'stops'), opens: 'walk', walk,
    subject: {ref: walk.id, title: walk.name},
    hover: `${walk.name} — a walk of ${plural(walk.stops.length, 'stop', 'stops')}, ${walk.derived ? 'derived on read' : 'curated'} (${walk.kind}). Select to hold it; double-click or Enter stands its first stop, as the Session grid does.`,
  }))
}

/** One World group from the readings: its rows, or what it waits on in the standing's own words. `hint` is the grammar's own
 * words for the group (the existing honest hint a group with no owner reading keeps). */
export function worldGroupOf(id: WorldGroupId, readings: WorldReadings, hint: string): WorldGroup {
  const {standing} = readings
  if (id === 'techne-journeys') {
    const world = walksOfWorld(readings.world)
    if ('unread' in world) return {state: 'waiting', word: 'waiting', words: hint, detail: sentence(`The World reading is not in: ${world.unread}`)}
    const rows = journeyRows(world.walks)
    return rows.length
      ? {state: 'rows', rows, note: null}
      : {state: 'waiting', word: 'waiting', words: hint, detail: 'The World reading carries no walk: the atlas publishes one only from a reading that holds a history, and the suite reading yields none.'}
  }
  if (id === 'techne-bodies') {
    // The suite reading composes your World's registers (Central's root, each hosted World) into the Earth's field, but its standing
    // publishes their places, not the bodies: the group names the inputs the bodies come from, in the standing's words.
    const unread = unreadWords(readings, 'the bodies')
    const inputs = `${inputWords(standing, 'central_wiki')}. ${inputWords(standing, 'shared_field')}.`
    return {state: 'waiting', word: unread?.word ?? 'waiting',
      words: unread?.words ?? 'Your planet comes from Central’s wiki and the Worlds around it from the shared field; the suite reading’s standing lists their places, not the bodies, so none is listed here.',
      detail: inputs}
  }
  const rows = id === 'techne-locations' ? locationRows(standing.places) : earthPlaceRows(standing.places)
  const what = id === 'techne-locations' ? 'the project spaces on your planet' : 'the places your owners declare'
  if (!rows.length) {
    const unread = unreadWords(readings, what)
    if (unread) return {state: 'waiting', ...unread}
    const said = standingWords(standing)
    return {state: 'waiting', word: 'none', words: id === 'techne-locations' ? 'No project space stands on your planet in this reading.' : 'No owner declares a place in this reading.', detail: said || null}
  }
  // The mockup's World rows stand under no separator (renderBrowser :1501–1505); while the owners are still read, the provider's
  // own progress words stand under the rows that have arrived.
  return {state: 'rows', rows, note: standing.phase === 'reading' ? describeProgress(standing) : null}
}
