// Factory's clip binding (manual §19.1 Clip view; §16.5's table: "Factory — A task — The log — Mode, Then, Quantize — The Agent's
// Effort and Autonomy for this task"): the task THE selection names, on the owners the replaced bodies read, mapped onto the keys of
// the designed clip `clip:factory` (inhabitants/catalogue/clips/factory.tsx). It replaces the Clip side's Tasks device
// (agent/devices/TaskClipDevice.tsx, the Tasks binding at compact size) and the task log's Clip view (shell/ModeDetail.tsx
// FactoryTaskLogDetail). Ported from:
//   - the task THE selection names, or a session track's first task (shell/modeDetails.tsx FactoryClip, :93-107 as it stood);
//   - the task itself — its title, state, start and last activity — from the agency reading's track (agent/agentRunModel.ts TaskClip);
//     the session's budget as the task's turns (FactoryTaskLogDetail's budget row);
//   - the log: the session's temporal events (the sessions provider's one read, agentRunModel.ts eventsForSession), within the task's
//     own span (its start to the next task's), each the owner's own row — its time, its kind and what it says (FactoryTaskLogDetail).
//   - the task's own settings — its name and colour as the person set them, its activator, output style, Loop with its stop condition
//     and cap, Launch mode, Then, Quantize, what a Repeat varies, envelopes and its source (the constellation it was made of, taskSourceOf)
//     — from the session's settings on their owner (AIKit `encounter-session-settings`, agent/sessionSettings.ts), every default stated by
//     the owner, in the manual's words, which are the owner's: read and written as they are, with no table between them.
// A constellation dropped on a session's track would make the session's task of it (makeTaskOf); Factory's Set (the kernel's) carries no
// clip maker yet and says what it waits for (its `clip.make`), so no drop reaches it.
// A song's clip dropped there (Material › Songs, O-I #844) is one unit of the song the session's Run performs, with the thread form canon
// (songClips.ts dropSong); File › Export Song… makes the selected task's song one clip (songClips.ts exportSong, answered here while
// Factory's Clip view stands), and with a session's track selected, that track's row of it, with a stretch selected on the
// Arrangement's ruler, the units that ran in it (exportChoiceOf, songClips.ts unitsInSpan). Loop turned on with a song's note chosen
// names the song for AIKit's executor, which makes each pass a take of it (songClips.ts loopSongChange); Repeat makes the song's
// takes where Factory's Set (the kernel's) carries a Repeat, which it does not yet; the note chosen is published for Routine… on a song (chosenNoteOf,
// songClips.ts routineOfSong).
// Every per-task setting writes through its seam in agent/devices/taskBindings.ts TASK_SEAMS, against the settings' standing
// revision. The Intent panel (§19.1, the design's D3 panel): its Success conditions are the words the person typed for the task, kept with
// the task's settings on AIKit (`success`), and Add appends one; the intent is the required difference of the task's Run, as Factory reads
// the Run's Development Field (readDevelopmentField); its other keys have no reading a kernel route reaches and stand absent, its Intent
// write refused, each with the operation it waits for (INTENT_ABSENT, INTENT_REFUSED). Of the Launch panel, Compare is the takes' own
// setting on AIKit (`compare`), and the takes a Repeat made stand absent before a set stands (LAUNCH_ABSENT). Hand off to is retired: the task is dragged onto another
// session's track (§19.1). The score (Notes, Vāk and the Tools, O-I #843) is the song the task's Run performs, as Factory reads it, on
// the rows of the track's Agent rack — its agents and agent sets — with Allocate, Connect and Thread form written into the song's file
// by Factory and Fill heads asked of AIKit's decision model (agent/scoreBinding.ts); the log's retrospective readings stand where they
// were found, and nothing the tools do writes the log. Selecting another unit's note moves Clip view to that unit's task (§19.1 "Select
// another note and Clip view moves to that unit's task"): the task whose latest attempt names the unit in this Run (unitTasksOf), read
// from the takes of the track's Agent rack and of the sessions on the song's rows (noteSessionsOf), the note chosen there. Pure, apart
// from the hook at the end.
import {useContext, useEffect, useMemo, useRef, useState} from 'react'
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {madeOfValues, withMadeOf, type ClipSource} from '../frame/detail/clipSource'
import {constellationNamed, useConstellations, type Constellation} from '../owners/constellations'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {CentralLocation, EncounterSessionSettingsReading, FactoryAttemptArtifacts, KernelTransportStatus, NativeDirectory} from '../../../../../desktop/cradle/src/kernel/types'
import {attemptArtifacts} from '../../../../../desktop/cradle/src/contributions/factory/desk/factoryReads'
import {listFiles, resolveFileLocation} from '../../../../../desktop/cradle/src/files/client'
import {useAttemptTakes} from '../owners/attemptTakes'
import type {DocumentEntry} from '../central/documents/centralDocuments'
import {Workspace} from '../shell/workspaceContext'
import type {WorkspaceReading} from '../shell/workspaceTypes'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'
import {useOptionalContinuity} from '../continuity/workspace'
import {parseCentralPathRef} from '../central/centralVertical'
import type {FactoryTake} from './factoryTakes'
import {lockPlan, planTargetOf, planValuesOf, planWiring, useWavePlan, type PlanPort, type PlanTarget} from './wavePlan'
import {refusalWords as refusalText} from './devices/ownerRoutes'
import {composeAddressOf, rackRowsOf, scorePortOf, scoreValuesOf, scoreWiring, useCompose, useScore, useUnitSteps, type ComposeWords,
  type ScorePort, type ScoreReading} from './scoreBinding'
import {usePopulationAnswer} from './devices/usePopulationAnswer'
import {useCentralAction} from '../central/devices/useCentralReadings'
import type {WorldActionReceipt} from '../timeline/worldTrackAdapter'
import {clipHostId, setViewHold, useViewHoldsVersion, viewHoldsOf} from '../frame/detail/clipBinding'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import {timelineReading, useTimelinePanePresentation} from '../projections/timelinePaneHost'
import {factoryTaskRef, parseFactoryTaskRef} from '../timeline/factoryTrackAdapter'
import {readSettingsOf, settingsReadingEntry, taskReadingEntry, useSettingsAnswer} from '../owners/readers'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {projectOfSession} from './worldScope'
import {eventsForSession, trackKey, type AgentSessionTrack, type TaskClip, type TemporalEventLike} from './agentRunModel'
import {TASK_SEAMS, settingSubject, type TaskAddress, type TaskSeamContext, type TaskSetting} from './devices/taskBindings'
import {useSessionCustody} from './devices/sessionCustody'
import {MENU_ACT} from '../native/openStudio'
import {sayOnInfoLine} from '../frame/devices/deviceHost'
import {canonNoteOf, exportSong, loopSongChange, publishChosenNote, unitsInSpan, type ChosenNote, type ExportChoice} from './songClips'
import {shownSpanNow} from '../frame/tracks/tracksDoor'
import {clipValuesOfSettings, settingsRefusal, SETTINGS_RESULT, SETTINGS_WHY, writeSessionSettings} from './sessionSettings'

/** The register a session's settings are read in: the one its world-wide agency read listed it in (AgentSessionsProvider.tsx rows,
 * agent/worldScope.ts) — '' the root register, else its project. */
export const sessionProjectOf = (rows: readonly {readonly sessionRef: string; readonly project?: string}[] | null | undefined, sessionRef: string | null): string =>
  projectOfSession(rows ?? [], sessionRef)
const UNAVAILABLE = {kind: 'unavailable', reason: 'No sessions provider is mounted here.'} as const

/** The log keeps the latest rows of a long thread (FactoryTaskLogDetail's LOG_ROWS). */
export const LOG_ROWS = 200

/** The task THE selection names: `<session track>#task/<n>`, or a session track whose first real task it opens (ported from
 * modeDetails.tsx FactoryClip). Null when the selection names no session of the agency reading. */
export function factoryTaskOf(ref: string | null, tracks: readonly AgentSessionTrack[]): {track: AgentSessionTrack; task: TaskClip | null; trackId: string} | null {
  if (!ref) return null
  const named = parseFactoryTaskRef(ref)
  const trackId = named?.trackId ?? ref
  const track = tracks.find(item => trackKey(item) === trackId && !item.group) ?? null
  if (!track) return null
  const task = track.tasks.find(item => !item.softStop && (named ? item.n === named.n : true)) ?? null
  return {track, task, trackId}
}

/** The note chosen in the Clip view of the task THE selection names (its view's `unit` hold): the session, the project it is read under
 * and the note's key — what Routine… on a song takes (songClips.ts routineOfSong). A session's track selected opens its first task's
 * Clip view (factoryClipBinding), so it names that task's note. Null when no task is open or no note is chosen. */
export function chosenNoteOf(ref: string | null, tracks: readonly AgentSessionTrack[], project: string): ChosenNote | null {
  const chosen = factoryTaskOf(ref, tracks)
  if (!chosen?.task) return null
  const key = viewHoldsOf(clipHostId('factory', `${chosen.trackId}#task/${chosen.task.n}`)).unit
  return typeof key === 'string' && key ? {project, session: chosen.track.sessionRef, key} : null
}

/** What Export Song… renders of the selection (manual §10.9: "the song, or the tracks and the range you select"): a session's track
 * selected, that track's row (its agent's, as the score draws its rows); a task selected, or a track naming no agent, the whole song;
 * and with a stretch selected on the Arrangement's ruler, the units of the song that ran in it (songClips.ts unitsInSpan). Pure. */
export function exportChoiceOf(ref: string | null, chosen: {track: Pick<AgentSessionTrack, 'agentRef'>} | null, units?: readonly string[]): ExportChoice {
  const range = units?.length ? {units} : {}
  if (!ref || !chosen || parseFactoryTaskRef(ref)) return range
  const agent = chosen.track.agentRef
  return typeof agent === 'string' && agent ? {rows: [agent], ...range} : range
}

/** One row of the design's log (factory.tsx Entry): at seconds from the task's start, the owner's own kind as the tool, its words; a
 * retrospective reading (a thought the temporal field types T0′–T5′) stands as a reading where it was found. */
export type LogRow = {readonly at: number; readonly kind: 'tool'; readonly tool: string; readonly text: string}
  | {readonly at: number; readonly kind: 'reading'; readonly reading: string; readonly text: string}

/** A retrospective reading's name as the design marks it: the temporal field's machine spelling (`T3-prime`) with its prime, else null. */
const retrospectiveOf = (event: TemporalEventLike): string | null => {
  const type = event.thought_type
  return typeof type === 'string' && /^T[0-5]-prime$/.test(type) ? `${type.slice(0, 2)}′` : null
}

/** The session's events with the thoughts it wrote. A thought of Central's NOW stream is about its clearing (its subject is the
 * fixture's own place), so the session's own rule (eventsForSession) does not find it: the kernel names the agent session that wrote
 * it among the thought's evidence (Central's `agent_session_ref` on the fixture), and it is the session's by that. Pure. */
export function sessionLogEvents(events: readonly TemporalEventLike[], sessionRef: string): TemporalEventLike[] {
  const own = eventsForSession([...events], sessionRef)
  if (!sessionRef) return own
  const held = new Set(own)
  return [...own, ...events.filter(event => event.kind === 'thought' && !held.has(event) && (event.evidence_refs ?? []).includes(sessionRef))]
}

/** The task's log: the session's temporal events, and the thoughts it wrote, inside the task's span (its start to the next task's start), each placed at its
 * seconds from the task's start, its kind the owner's own word, its text the owner's summary. An event with no instant has no place
 * on the task's time and is left out; a task with no start reads the session's events from its first. The latest LOG_ROWS. Pure. */
export function taskLogOf(track: AgentSessionTrack, task: TaskClip | null, events: readonly TemporalEventLike[]): LogRow[] {
  const mine = sessionLogEvents(events, track.sessionRef).filter(event => typeof event.instant_unix_ms === 'number')
    .sort((a, b) => a.instant_unix_ms! - b.instant_unix_ms!)
  const next = task ? track.tasks.find(item => !item.softStop && item.n === task.n + 1)?.startUnixMs ?? null : null
  const from = task?.startUnixMs ?? null
  const within = mine.filter(event => (from === null || event.instant_unix_ms! >= from) && (next === null || event.instant_unix_ms! < next))
  const origin = from ?? within[0]?.instant_unix_ms ?? 0
  return within.slice(-LOG_ROWS).map((event): LogRow => {
    const at = Math.max(0, (event.instant_unix_ms! - origin) / 1000), text = event.summary ?? event.subject_ref, reading = retrospectiveOf(event)
    return reading ? {at, kind: 'reading', reading, text} : {at, kind: 'tool', tool: event.kind ?? event.stream ?? 'event', text}
  })
}

const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

export interface FactoryClipInput {
  /** THE selection's ref. */
  readonly ref: string | null
  /** The agency reading's session tracks. */
  readonly tracks: readonly AgentSessionTrack[]
  /** The session's temporal events (the sessions provider's one read); null when no provider reads them here. */
  readonly events: readonly TemporalEventLike[] | null
  /** The selected clip's track colour, as the tracks pane gives it. */
  readonly colour?: string | null
  /** The clip stands on Arrangement view's ruler: no Launch tab. */
  readonly placed?: boolean
  /** The selected session's settings on their owner, and where they are written; null where nothing reads them. */
  readonly settings?: TaskSeamContext | null
  /** The wiki's constellations, which name the task's source (owners/constellations.ts). */
  readonly constellations?: readonly Constellation[] | null
  /** What the task's returned attempts named, as Factory resolved it, and how one opens; null where nothing reads it here. */
  readonly returned?: ReturnedPort | null
  /** The task's plan in its Run's plan of record, as Factory reads it, and the person's Lock; null where nothing reads it here. */
  readonly plan?: PlanPort | null
  /** The song's score as Factory reads it, on the track's Agent rack, and the owners' writes it goes through; null where nothing reads it. */
  readonly score?: ScorePort | null
  /** The intent: the Development Field of the task's Run, as Factory reads it (readDevelopmentField); null where nothing reads it here. */
  readonly intent?: IntentReading | null
  /** Each note's task, by the unit's key (unitTasksOf): where a note selected moves Clip view. */
  readonly unitTasks?: ReadonlyMap<string, UnitTask> | null
  /** THE selection's one writer (projections/timelinePaneHost.ts selectTrackItem). */
  readonly select?: ((to: UnitTask) => void) | null
}

// ---------------------------------------------------------------------------------------------------------------- each note's task

/** A unit's task as THE selection names it: its task clip on its session's track. */
export interface UnitTask {readonly kind: 'clip'; readonly ref: string; readonly title: string; readonly track: string}

/** The sessions whose tasks may work the score's notes: those of the track's Agent rack (its group's, else its own), then every session
 * whose agent is a row of the song, or a member of the group that runs an agent set on a row of it. Pure. */
export function noteSessionsOf(track: AgentSessionTrack | null, tracks: readonly AgentSessionTrack[], reading: ScoreReading | null): string[] {
  if (!track) return []
  const real = (item: AgentSessionTrack) => !item.group && item.tasks.some(task => !task.softStop)
  const group = track.parentRef ? tracks.find(item => item.group && item.sessionRef === track.parentRef) ?? null : null
  const rack = group ? tracks.filter(item => !item.group && item.parentRef === group.sessionRef) : [track]
  const rows = new Set<string>()
  if (reading?.state === 'read') {
    const units = Array.isArray(reading.reading.units) ? reading.reading.units : []
    for (const unit of units) { const row = (unit as {row?: unknown} | null)?.row; if (typeof row === 'string' && row) rows.add(row) }
  }
  const sets = new Set(tracks.filter(item => item.group && item.agentSet && rows.has(item.agentSet.ref)).map(item => item.sessionRef))
  const onRows = tracks.filter(item => (item.agentRef && rows.has(item.agentRef)) || (item.parentRef && sets.has(item.parentRef)))
  return [...new Set([...rack, ...onRows].filter(real).map(item => item.sessionRef))]
}

/** Each note's task (manual §19.1 "Select another note and Clip view moves to that unit's task"): for each unit of the score's Run, the
 * task whose latest attempt names it there, as a task's own note is the unit its latest attempt names (wavePlan.ts planTargetOf) — the
 * attempt's task on its session's track, else the track's first (the session's owner holds one bound task). Where two tasks work one
 * unit, the one whose attempt began last. A unit no task's latest attempt names has none. Pure. */
export function unitTasksOf(reading: ScoreReading | null, tracks: readonly AgentSessionTrack[],
  takesOf: (sessionRef: string) => readonly FactoryTake[] | null): Map<string, UnitTask> {
  const tasks = new Map<string, UnitTask>()
  if (reading?.state !== 'read') return tasks
  const keyOf = new Map<string, string>()
  for (const unit of Array.isArray(reading.reading.units) ? reading.reading.units : []) {
    const {key, unitRef} = (unit ?? {}) as {key?: unknown; unitRef?: unknown}
    if (typeof key === 'string' && key && typeof unitRef === 'string' && unitRef) keyOf.set(unitRef, key)
  }
  const began = new Map<string, number>()
  for (const track of tracks) {
    if (track.group) continue
    const take = [...(takesOf(track.sessionRef) ?? [])].reverse().find(item => item.unitRef && item.runRef && item.statePath)
    if (!take || take.runRef !== reading.target.runRef || take.statePath !== reading.target.statePath) continue
    const key = keyOf.get(take.unitRef!)
    const task = track.tasks.find(item => !item.softStop && item.taskRef === take.taskRef) ?? track.tasks.find(item => !item.softStop)
    if (!key || !task) continue
    const at = take.startUnixMs ?? Number.NEGATIVE_INFINITY
    if (tasks.has(key) && (began.get(key) ?? Number.NEGATIVE_INFINITY) >= at) continue
    const id = trackKey(track)
    tasks.set(key, {kind: 'clip', ref: factoryTaskRef(id, task.n), title: task.title ?? track.purpose ?? track.agentName ?? `task ${task.n}`, track: id})
    began.set(key, at)
  }
  return tasks
}

// ---------------------------------------------------------------------------------------------------------------- what the run returned

/** One ref a returned attempt's Return names, as Factory resolved it (O-I #759; `factory attempt artifacts`, factory.attempt-artifact-
 * reading/v1, through the kernel's factory_owner `attempt-artifacts`). Manual §19.1 The Intent panel: "After the run returns, each
 * condition carries its answer: met or not met with the evidence that shows it"; DLW.md:397-398: "the files it touched … click any of
 * them and it opens beside you". `opens` is how Central's file route reaches it: a file Factory resolved in its Project's ground, by
 * Central's listing of its folder (`path` under Central's root, the ground's path then the file's); Central's own path identity, by
 * Central's resolver. Null when it does not open, and `why` then says why in the owner's words: Factory's reason for a ref it refused,
 * or why its Project's ground is not one Central discloses. */
export interface ReturnedFile {
  readonly ref: string
  readonly name: string
  readonly roles: readonly string[]
  readonly attemptRef: string
  readonly opens: {readonly via: 'listing'; readonly path: string} | {readonly via: 'resolve'; readonly ref: string} | null
  readonly why: string | null
}

/** The task's Return as read: every ref its returned attempts name, or why it is not read here. */
export type ReturnedReading = {readonly state: 'read'; readonly files: readonly ReturnedFile[]} | {readonly state: 'absent'; readonly why: string}

/** The reading and the open the clip's `open` act goes through (openReturnedFile over the window's owners and its focused pane). */
export interface ReturnedPort {
  readonly reading: ReturnedReading
  readonly open: (file: ReturnedFile) => Promise<void>
}

const joined = (ground: string, path: string): string => (ground ? `${ground.replace(/\/+$/, '')}/${path}` : path)

/** One attempt's Return as Factory resolved it, with the kernel's placement of its Project's ground in Central's World. Pure. */
export function returnedFilesOf(answer: FactoryAttemptArtifacts): ReturnedFile[] {
  const {reading, ground} = answer
  return reading.artifacts.map((row): ReturnedFile => {
    const base = {ref: row.ref, roles: row.roles, attemptRef: reading.attemptRef}
    if (row.state === 'file') {
      return ground.state === 'placed'
        ? {...base, name: row.file.path, opens: {via: 'listing', path: joined(ground.path, row.file.path)}, why: null}
        : {...base, name: row.file.path, opens: null, why: ground.why}
    }
    if (row.state === 'central-path') return {...base, name: parseCentralPathRef(row.centralPath)?.path ?? row.ref, opens: {via: 'resolve', ref: row.centralPath}, why: null}
    return {...base, name: row.ref, opens: null, why: row.reason}
  })
}

/** Read the Return of each returned take (`call` is Factory's read through the kernel, attemptArtifacts). A take that has not returned
 * has no Return to read. A refused read stays as one row naming the attempt, with the owner's words. Never throws. */
export async function readReturnedFiles(call: (take: FactoryTake) => Promise<FactoryAttemptArtifacts>, takes: readonly FactoryTake[]): Promise<ReturnedReading> {
  const files: ReturnedFile[] = []
  for (const take of takes.filter(item => item.state === 'returned')) {
    try {
      for (const file of returnedFilesOf(await call(take))) if (!files.some(item => item.ref === file.ref)) files.push(file)
    } catch (cause) {
      files.push({ref: take.attemptRef, name: `${take.attemptRef}'s Return`, roles: [], attemptRef: take.attemptRef, opens: null,
        why: cause instanceof Error ? cause.message : String(cause)})
    }
  }
  return {state: 'read', files}
}

/** The owners an open goes through: Central's listing of a folder, Central's resolver of its own path identity, and the window's open of
 * a listed file into the focused pane (useOpenCentralDocument.ts openFile). */
export interface ReturnedOpenPorts {
  readonly list: (path: string) => Promise<NativeDirectory>
  readonly resolve: (ref: string) => Promise<CentralLocation>
  readonly open: (entry: DocumentEntry) => Promise<void>
}

const baseName = (path: string): string => path.split('/').filter(Boolean).pop() ?? path

/** Open one returned file beside you. A file Factory resolved is found in Central's listing of its folder, so Central mints its location
 * (files.rs resolve_material's law: a name not in a real Central listing is never reached); a Central path is resolved by Central. A ref
 * that does not open throws its reason. */
export async function openReturnedFile(file: ReturnedFile, ports: ReturnedOpenPorts): Promise<void> {
  if (!file.opens) throw new Error(`${file.name} does not open: ${file.why ?? 'no owner resolves it to a file'}`)
  if (file.opens.via === 'resolve') {
    const location = await ports.resolve(file.opens.ref)
    return ports.open({name: baseName(location.path), location, kind: 'file', retrieval_allowed: true})
  }
  const path = file.opens.path
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  const directory = await ports.list(folder)
  const entry = directory.entries.find(item => item.location?.path === path)
  if (!entry) throw new Error(`Central's listing of ${folder || 'its root'} holds no ${baseName(path)}, so it does not open.`)
  return ports.open(entry)
}

/** The rows the design draws (clips/factory.tsx Returned): each ref once, its role, whether it opens, and why not. Pure. */
export function returnedRowsOf(files: readonly ReturnedFile[]): {id: string; name: string; role: string; opens: boolean; why?: string}[] {
  return files.map(file => ({id: file.ref, name: file.name, role: file.roles.join(', '), opens: file.opens !== null, ...(file.opens ? {} : {why: file.why ?? ''})}))
}

const RETURNED_ONE_TASK = 'The session\'s owner holds one bound task: what its attempts returned is the first task\'s on the track.'
const RETURNED_NOT_HERE = 'What the task\'s attempts returned is not read here: no sessions provider reads the session\'s attempts.'
const RETURNED_NO_TASK = 'No task is selected: select a task on a session\'s track.'

/** Why the task's Return is not on the clip, or null when it is. */
function returnedWhy(task: TaskAddress | null, returned: ReturnedPort | null | undefined): string | null {
  if (!task) return RETURNED_NO_TASK
  if (task.n !== 1) return RETURNED_ONE_TASK
  if (!returned) return RETURNED_NOT_HERE
  return returned.reading.state === 'absent' ? returned.reading.why : null
}

/** The task's readings on the design's keys. A key no owner reports is left out (the design draws "—"). Pure. */
export function factoryClipValues(track: AgentSessionTrack, task: TaskClip | null, input: Pick<FactoryClipInput, 'tracks' | 'events' | 'colour' | 'settings' | 'constellations' | 'returned' | 'plan' | 'score' | 'intent'>): Values {
  const values: Record<string, Value> = {}
  // The task's source, the constellation it was made of, named from the wiki (taskSourceOf).
  Object.assign(values, madeOfValues(taskSourceOf(task ? {sessionRef: track.sessionRef, n: task.n} : null, input.settings ?? null), input.constellations))
  put(values, 'name', task?.title ?? track.purpose)
  put(values, 'colour', input.colour)
  // The bound task's settings, as the owner states them (its name as set, else its purpose; a colour set, else the track's).
  if (task && task.n === 1) Object.assign(values, clipValuesOfSettings(input.settings?.settings ?? null))
  // How the task stands is Factory's reading of the owners' evidence (agent/taskActivity.ts): its word, the evidence that decided it,
  // and the closure a closed custody carries. Where Factory decided no word, State is left out and `state.why` says why.
  if (task?.standing?.word) values.state = task.standing.word
  put(values, 'state.why', task?.standing?.why ?? (task && !task.softStop ? task.disclosure : null))
  if (task?.standing?.retry) values['state.retry'] = true
  put(values, 'closure', task?.standing?.closure)
  // The turns are the session's budget reading: the agency reading budgets a session, and a task runs on its session's turns.
  put(values, 'turns.used', track.budget.used)
  put(values, 'turns.cap', track.budget.max)
  // What the task's returned attempts named: the session's bound task is the first on its track (returnedWhy).
  const returned = input.returned?.reading
  if (task && !returnedWhy({sessionRef: track.sessionRef, n: task.n}, input.returned) && returned?.state === 'read') {
    values.returned = JSON.stringify(returnedRowsOf(returned.files))
  }
  // The task's plan: its unit's rung and the wave it builds in, as Factory reads its Run's plan (agent/wavePlan.ts). The session's
  // attempts are its bound task's, the first on its track.
  const plan = planPortOf(task ? {sessionRef: track.sessionRef, n: task.n} : null, input.plan ?? null)
  if (plan) Object.assign(values, planValuesOf(plan.reading))
  // The intent: the required difference of the task's Run, in Factory's words (readDevelopmentField); the bound task's, the first.
  if (task && !intentWhy({sessionRef: track.sessionRef, n: task.n}, input.intent ?? null) && input.intent?.state === 'read') {
    values.intent = input.intent.difference
    // Its From: the plan the Run answers to, as its Development Field names it (manual §19.1: "The spec a song answers to stands in the
    // Intent panel's From").
    put(values, 'intent.source', input.intent.from)
  }
  // The song's score: its Run's song as Factory reads it, on the track's Agent rack, this task's note lit (agent/scoreBinding.ts).
  const score = scorePortOf(task, input.score ?? null)
  if (score) Object.assign(values, scoreValuesOf(score.reading, score.rack, score.picks, score.word, score.compose?.state ?? null, score.steps ?? null))
  if (input.events) {
    const log = taskLogOf(track, task, input.events)
    values.log = JSON.stringify(log)
    if (task?.startUnixMs != null && task.lastActivityUnixMs != null) values.elapsed = Math.max(0, Math.round((task.lastActivityUnixMs - task.startUnixMs) / 1000))
    else if (log.length) values.elapsed = Math.round(log[log.length - 1]!.at)
  }
  return values
}

/** The design's keys, each to the seam it writes through (taskBindings.ts TASK_SEAMS). */
const SETTING_OF: Readonly<Record<string, TaskSetting>> = {
  name: 'name', colour: 'colour', active: 'active', 'style.register': 'register', 'style.form': 'form', loop: 'loop', 'loop.until': 'loopUntil',
  'loop.cap': 'loopCap', launch: 'launch', then: 'then', quantize: 'quantize', 'repeat.variable': 'repeatVariable', 'repeat.levels': 'repeatLevels',
  'repeat.repeats': 'repeatRepeats', 'repeat.stop': 'repeatStop', 'env.agent.effort': 'effort', 'env.scope.toolCalls': 'toolCalls', 'env.mode': 'envelopeMode',
  'env.linked': 'envelopeLink', criterion: 'success', compare: 'compare',
}

/** The Intent panel's readings (manual §19.1 "The Intent panel"; clip:factory, D3): what the task is for, its source, its context and
 * constraints. Factory keeps them — the required difference in the Development Field of the task's Run, the context and the constraints
 * in the bounded intent of its project-development ledger. The intent is read (readDevelopmentField); no kernel route reaches the
 * ledger: the kernel's factory_development_read carries project, journey, run, workflow-units, workflow-unit, execution-telemetry and
 * commission-read only. Each of its keys is absent, with the read it waits for. The Success conditions are not among them (O-I 795):
 * "the words stay in the source they come from", and a condition typed in Add comes from the person, so its words are the task's own
 * settings on AIKit (`success`, beside the bound task, as its source and its Repeat are); Factory's bounded intent keeps only refs to
 * conditions (success_condition_refs), never their words. */
const LEDGER_READ = 'a read of the project-development ledger (bounded intent, success criteria, PraxisCondition) through the kernel (T-COVERAGE §1.2)'
// REPLACED (O-I 795, round 14): INTENT_ABSENT.intent, "no reading reaches it yet — missing op: `factory development field read` through
// the kernel (factory_development_read carries no Development Field)": Factory reads a Run's Development Field by the state that holds
// the Run (`factory development field read --state`, the kernel's factory_owner development-field-read), and the clip reads it.
// REPLACED (O-I 844, round 16): INTENT_ABSENT['intent.source'], "Where the intent is written: no reading reaches it yet — missing op:
// ${LEDGER_READ} (Software Factory)": the From is the plan the Run answers to, which its Development Field names (targets.planRef) and
// Factory reads with the intent (readDevelopmentField).
export const INTENT_ABSENT: Readonly<Record<string, string>> = {
  constraints: `The constraints the task keeps: no reading reaches them yet — missing op: ${LEDGER_READ} (Software Factory).`,
  context: `The context the task resolves in: no reading reaches it yet — missing op: ${LEDGER_READ} (Software Factory).`,
}
// REPLACED (O-I 795, round 13): INTENT_REFUSED.criterion, "a success-condition write on the bounded intent of the project-development
// ledger": Add writes the task's settings on AIKit (taskBindings.ts TASK_SEAMS.success).
/** The Intent panel's writes, each refused with the operation it lacks. */
export const INTENT_REFUSED: Readonly<Record<string, string>> = {
  intent: 'Intent: no owner operation carries it yet — missing op: `factory development field set` through the kernel (Software Factory).',
}
/** The Success conditions from an AIKit that keeps none for a task. */
const CRITERIA_UNKEPT = 'The success conditions: this AIKit keeps none for a task — missing op: the task settings\' `success` (AIKit).'
/** "The revision cannot change them" (§19.7): while a set of takes runs, its conditions hold, in AIKit's words. */
const conditionsHeld = (trace: string) => `The takes ${trace} are read against the task's Success conditions as they stood at their first run: a change to them waits until the takes end.`

/** The takes (manual §19.1 The Launch panel): Loop, the launch mode and what a Repeat varies are the session's settings (AIKit
 * `encounter-session-settings`), and so is the set of takes a Repeat runs (`task.takes`, O-I 795): the takes it made are read once the
 * set ends. Before a set stands, the takes are absent. Compare is the takes' own setting, kept with them on AIKit (`task.compare`). */
export const LAUNCH_ABSENT: Readonly<Record<string, string>> = {
  // REPLACED (O-I 795): "not handed to Clip view — the take lanes read them": a Repeat's set of takes is now the task's settings on AIKit.
  takes: 'The takes a Repeat made: no set of takes stands yet — a Repeat\'s press starts one on AIKit (encounter-session-settings task.takes), its takes made by Actuation\'s comparison run (AIKit).',
}
// REPLACED (O-I 795 round 14): LAUNCH_ABSENT.compare and LAUNCH_REFUSED.compare, "no owner compares takes side by side" and "missing op: a
// comparison of takes (Software Factory)": Compare is the takes' own setting (§19.1: None, a second take, or every take of a Repeat), and
// AIKit keeps it with the task's settings beside its Success conditions (ai-kit encounter_task_settings.rs COMPARES), written through its
// seam (taskBindings.ts TASK_SEAMS.compare). It draws the takes and moves while they run.
/** Compare from an AIKit that keeps none for a task. */
const COMPARE_UNKEPT = 'Compare: this AIKit keeps no Compare for a task\'s takes — missing op: the task settings\' `compare` (AIKit).'

// ---------------------------------------------------------------------------------------------------------------- the intent

/** Factory's reading of a Run's Development Field (factory development_field.rs DEVELOPMENT_FIELD_READING_CONTRACT). */
export const DEVELOPMENT_FIELD_READING = 'factory.development-field-reading/v1'

/** The intent as read: the required difference of the task's Run, in Factory's words, or why it is not read. */
export type IntentReading = {readonly state: 'read'; readonly difference: string; readonly from: string | null; readonly target: PlanTarget}
  | {readonly state: 'absent'; readonly why: string}

export const INTENT_NOT_HERE = 'The intent: not read here — no sessions provider reads the session\'s attempts, which name the Run whose Development Field Factory keeps.'
export const INTENT_NO_RUN = 'The intent: no attempt of the task names its Run yet, so Factory is asked for no Development Field (the intent is its Run\'s required difference).'
export const INTENT_READING = 'The intent: Factory is reading the Development Field of the task\'s Run.'
const INTENT_ONE_TASK = 'The intent: the session\'s owner holds one bound task, whose attempts name the Run; the intent is the first task\'s on the track.'

/** The kernel op as the read calls it. */
type IntentCall = (op: Record<string, unknown>) => Promise<{error?: string; outcome?: {result: string; data?: unknown} | null}>

/** One read of the Development Field of the task's Run (factory_owner `development-field-read` → `factory development field read --state
 * <state> <run-ref>`): its required difference and the plan it answers to (its From), or why there is none in Factory's words — a Run
 * its state does not hold, a Run whose field was never set. Never throws. */
export async function readDevelopmentField(call: IntentCall, target: PlanTarget): Promise<IntentReading> {
  const read = await call({op: 'factory_owner', request: {kind: 'development-field-read', state_path: target.statePath, run_ref: target.runRef}})
    .catch((cause: unknown) => ({error: cause instanceof Error ? cause.message : String(cause), outcome: null}))
  if (read.error) return {state: 'absent', why: `The intent: Factory did not read the Run's Development Field: ${refusalText(read.error)}`}
  const data = read.outcome?.result === 'factory_development_reading'
    ? read.outcome.data as {contract?: unknown; field?: {requiredDifference?: unknown; targets?: {planRef?: unknown}}} | null : null
  if (data?.contract !== DEVELOPMENT_FIELD_READING) {
    return {state: 'absent', why: `The intent: Factory answered no Development Field reading (${DEVELOPMENT_FIELD_READING}): the Factory installed here may predate the field read by its state.`}
  }
  const difference = data.field?.requiredDifference
  const plan = data.field?.targets?.planRef
  return typeof difference === 'string' && difference.trim() ? {state: 'read', difference, from: typeof plan === 'string' && plan.trim() ? plan : null, target}
    : {state: 'absent', why: `The intent: the Development Field of ${target.runRef} names no required difference.`}
}

/** Why the intent is not on the clip, or null where it is read. */
function intentWhy(task: TaskAddress | null, intent: IntentReading | null): string | null {
  if (!task) return 'No task is selected: select a task on a session\'s track.'
  if (task.n !== 1) return INTENT_ONE_TASK
  if (!intent) return INTENT_NOT_HERE
  return intent.state === 'absent' ? intent.why : null
}

/** The intent's keys on the wiring, the intent and its From: read from Factory, absent with why where they are not. Its write stays
 * refused (INTENT_REFUSED). */
function withIntent(wiring: ClipWiring, task: TaskAddress | null, intent: IntentReading | null): ClipWiring {
  const why = intentWhy(task, intent)
  const fromWhy = why ?? (intent?.state === 'read' && !intent.from ? `The From: the Development Field of ${intent.target.runRef} names no plan it answers to.` : null)
  return {
    ...wiring,
    reads: {...wiring.reads, intent: 'Factory\'s Development Field of the task\'s Run (factory development field read, by the state that holds the Run): the required difference, in its words',
      'intent.source': 'Factory\'s Development Field of the task\'s Run: the plan the Run answers to (targets.planRef) — the spec, the map or the page its intent is written in'},
    absent: {...wiring.absent, ...(why ? {intent: why} : {}), ...(fromWhy ? {'intent.source': fromWhy} : {})},
  }
}

// REPLACED (O-I #843): SCORE_ABSENT, SCORE_REFUSED and SCORE_VIEW, which stood the score absent and every score write refused ("no
// Factory operation writes a workflow source", "`aikit decide invoke` … not served"). The score is now Factory's reading, its edits
// Factory's writes and Fill heads AIKit's: agent/scoreBinding.ts scoreWiring.

/** Repeat's fields, which do not change while its takes run (§19.1 The Launch panel: "Once the first run starts, these do not change. A
 * change starts a new set of takes"; AIKit refuses them in the same words). */
const REPEAT_KEYS: ReadonlySet<string> = new Set(['repeat.variable', 'repeat.levels', 'repeat.repeats', 'repeat.stop'])
const takesRunning = (trace: string) => `Once the first run starts, these do not change: the takes ${trace} are running. A change starts a new set of takes once they end.`

/** A task's source (manual §19.1 The Clip panel: "Constellation — The one the task was made of — The task's source, as a sample is an
 * audio clip's"): the task's own settings on AIKit keep it (encounter-session-settings `task.source`, ai-kit encounter_task_settings.rs:
 * the constellation the task was made with, until the person sets another; null when it was made of none). It REPLACES part one's
 * TASK_SOURCE, which stood absent naming a missing `task_source` op. Where the settings are not read here, or name no task, the key is
 * unread with that reason (sessionSettings.ts settingsRefusal). Pure. */
export function taskSourceOf(task: TaskAddress | null, context: TaskSeamContext | null): ClipSource {
  const why = task ? settingsRefusal(context, task.n) : 'No task is selected: select a task on a session\'s track.'
  const settings = context?.settings?.task
  if (why || !settings) return {made: 'unread', why: why ?? SETTINGS_WHY_NO_TASK}
  // An AIKit installed before it kept a task's source reads no `source` at all: unread, never None.
  if (!('source' in settings)) return {made: 'unread', why: SOURCE_UNKEPT}
  return settings.source ? {made: 'of', ref: settings.source, by: SOURCE_BY} : {made: 'none', by: SOURCE_BY}
}
const SOURCE_BY = 'the task\'s settings on AIKit (encounter-session-settings task.source)'
const SETTINGS_WHY_NO_TASK = 'No task is bound to this session: its owner keeps no settings for a task it does not hold.'
/** The settings reading of an AIKit that does not keep a task's source yet (installed before ai-kit a3f43f84). */
export const SOURCE_UNKEPT = 'The task\'s source is not read: the AIKit installed here keeps no source in a task\'s settings (its reading names none); install an AIKit that does.'

/** clip:factory's wiring: every key the design draws or sets. `choice` reads the view's holds when a tool is pressed. */
export function factoryWiring(task: TaskAddress | null, context: TaskSeamContext | null = null, returned: ReturnedPort | null = null,
  plan: PlanPort | null = null, score: ScorePort | null = null, choice: (key: string) => Value | undefined = () => undefined,
  intent: IntentReading | null = null): ClipWiring {
  return withScore(withPlan(withReturned(withIntent(withMadeOf(taskWiring(task, context), taskSourceOf(task, context)), task, intent), task, returned),
    planPortOf(task, plan)), scorePortOf(task, score), choice, task && context ? {task, context} : null)
}

/** The score's keys on the wiring (agent/scoreBinding.ts scoreWiring): read from Factory, its edits Factory's, Fill heads AIKit's.
 * Loop turned on with a song's note chosen (a canon unit of the score) names that song on AIKit, whose task executor makes each of
 * the loop's passes a take of it (songClips.ts loopSongChange); Loop off, or on with the task's own note, takes the song away. */
function withScore(wiring: ClipWiring, score: ScorePort | null, choice: (key: string) => Value | undefined,
  seat: {task: TaskAddress; context: TaskSeamContext} | null): ClipWiring {
  const own = scoreWiring(score, choice)
  const acts: Record<string, (value: Value) => Promise<void>> = {...wiring.acts, ...own.acts}
  const loop = wiring.acts.loop
  if (loop && seat) acts.loop = async value => {
    const read = score?.reading.state === 'read' ? score.reading : null
    const unit = choice('unit')
    const song = value === true && read && typeof unit === 'string' && canonNoteOf(read.reading, unit)
      ? {state_path: read.target.statePath, run_ref: read.target.runRef, unit} : null
    const change = loopSongChange(seat.context.settings, value, song)
    if (!change) return loop(value)
    if ('refused' in change) throw new Error(change.refused)
    if (seat.task.n !== 1) throw new Error(SETTINGS_WHY.oneTask)
    await seat.context.holdFirst?.(settingSubject(seat.task.sessionRef, 'loop'))
    await writeSessionSettings(seat.context.transport, seat.context.project, seat.task.sessionRef, change.change)
  }
  return {
    reads: {...wiring.reads, ...own.reads},
    absent: {...wiring.absent, ...own.absent},
    acts,
    view: {...wiring.view, ...own.view},
    refused: {...wiring.refused, ...own.refused},
  }
}

const PLAN_ONE_TASK = 'The session\'s owner holds one bound task: its plan is the first task\'s on the track, whose attempts name its Run and unit.'

/** The plan this task reads: the session's attempts are its bound task's, the first on its track. Pure. */
function planPortOf(task: TaskAddress | null, plan: PlanPort | null): PlanPort | null {
  if (!plan) return null
  if (!task) return {...plan, reading: {state: 'absent', why: RETURNED_NO_TASK}}
  return task.n === 1 ? plan : {...plan, reading: {state: 'absent', why: PLAN_ONE_TASK}}
}

/** The plan's keys on the wiring (agent/wavePlan.ts planWiring): read from Factory, Lock the person's act, the rung the planner's. */
function withPlan(wiring: ClipWiring, plan: PlanPort | null): ClipWiring {
  const own = planWiring(plan)
  return {
    reads: {...wiring.reads, ...own.reads},
    absent: {...wiring.absent, ...own.absent},
    acts: {...wiring.acts, ...own.acts},
    view: {...wiring.view, ...own.view},
    refused: {...wiring.refused, ...own.refused},
  }
}

/** The Return's rows on the wiring: `returned` read from Factory, `open` the act that opens one beside you, `returned.page` the view's.
 * Where nothing is read, `returned` is absent and `open` refused, both in the same words. */
function withReturned(wiring: ClipWiring, task: TaskAddress | null, returned: ReturnedPort | null): ClipWiring {
  const why = returnedWhy(task, returned)
  const files = returned?.reading.state === 'read' ? returned.reading.files : []
  const open = async (value: Value) => {
    const file = files.find(item => item.ref === value)
    if (!file || !returned) throw new Error(`The task's Return names no ${String(value)}, so nothing opens.`)
    await returned.open(file)
  }
  return {
    ...wiring,
    reads: {...wiring.reads, returned: 'Factory\'s reading of what the task\'s returned attempts name (factory attempt artifacts): each ref, the file it resolves to, or Factory\'s reason'},
    acts: why ? wiring.acts : {...wiring.acts, open},
    view: {...wiring.view, 'returned.page': 'the page of returned files Clip view shows'},
    absent: why ? {...wiring.absent, returned: why} : wiring.absent,
    refused: why ? {...wiring.refused, open: why} : wiring.refused,
  }
}

function taskWiring(task: TaskAddress | null, context: TaskSeamContext | null): ClipWiring {
  const acts: Record<string, (value: Value) => Promise<void>> = {}
  const refused: Record<string, string> = {}
  const why = task ? settingsRefusal(context, task.n) : 'No task is selected: select a task on a session\'s track.'
  const takes = why ? null : context?.settings?.task?.takes ?? null
  const criteriaWhy = why ? `The success conditions: ${why}` : context?.settings?.task?.success === undefined ? CRITERIA_UNKEPT : null
  // An AIKit that keeps no Compare reads none and would refuse it: Compare stands absent and refused, naming the AIKit it needs.
  const compareWhy = !why && context?.settings?.task && context.settings.task.compare === undefined ? COMPARE_UNKEPT : null
  for (const [key, setting] of Object.entries(SETTING_OF)) {
    const seam = TASK_SEAMS[setting]
    if (seam.refused) refused[key] = seam.refused
    else if (why || !task || !context) refused[key] = why ?? 'No task is selected: select a task on a session\'s track.'
    else if (key === 'compare' && compareWhy) refused[key] = compareWhy
    else if (takes?.running && REPEAT_KEYS.has(key)) refused[key] = takesRunning(takes.trace_ref)
    else if (takes?.running && key === 'criterion') refused[key] = conditionsHeld(takes.trace_ref)
    else acts[key] = value => seam.send(task, value, context)
  }
  return {
    reads: {
      name: 'the task\'s name as set on the session\'s settings, else its purpose (the task\'s title)', colour: 'the colour set on the session\'s settings, else the session track\'s colour (the tracks pane)',
      active: 'the session\'s settings: the task\'s activator', 'style.register': 'the session\'s settings: the task\'s register', 'style.form': 'the session\'s settings: the task\'s form',
      launch: 'the session\'s settings: Launch mode — trigger · gate · toggle · repeat, the owner\'s words as the design\'s',
      then: 'the session\'s settings: Then, the follow action on the task\'s own track — next · again · stop',
      loop: 'the session\'s settings: Loop, which runs the task again after each finish (On) or not (Off)',
      'loop.until': 'the session\'s settings: Loop\'s stop condition — done · pass', 'loop.cap': 'the session\'s settings: Loop\'s cap, the most runs (absent: none)',
      'loop.pass': 'the session\'s settings: what AIKit\'s executor did with Loop\'s last pass of a song (task.loop_pass) — the take Factory started and its Run, or why the loop stopped (left out before a song\'s first pass)',
      'repeat.variable': 'the session\'s settings: Repeat\'s Variable', 'repeat.levels': 'the session\'s settings: Repeat\'s Levels, comma-separated (absent: none chosen, and Actuation\'s comparison run takes its own default three conditions)',
      'repeat.repeats': 'the session\'s settings: Repeat\'s Repeats', 'repeat.stop': 'the session\'s settings: Repeat\'s Stop when',
      quantize: 'the session\'s settings: Quantize', 'env.mode': 'the session\'s settings: the envelopes\' mode', 'env.linked': 'the session\'s settings: the envelopes\' link',
      'env.agent.effort': 'the session\'s settings: the Effort envelope', 'env.scope.toolCalls': 'the session\'s settings: Scope\'s Tool calls envelope',
      state: 'how the task stands, Factory\'s word — queued · running · stalled · stopped · done (factory development task-activity, agent/taskActivity.ts) — left out where no evidence decides',
      'state.why': 'the evidence Factory read the state from, in its words: the check-in bound, AIKit\'s session state, a pending permission request, or why nothing decides',
      'state.retry': 'Factory\'s reading: the task stalled, so its track lights a retry',
      closure: 'the closure Factory\'s custody of the task\'s work carries once it closed: its state and OpenRig\'s closure reason, with its target',
      'turns.used': 'the session\'s budget: turns used', 'turns.cap': 'the session\'s budget: turns allowed',
      log: 'the session\'s temporal events inside the task\'s span',
      elapsed: 'the task\'s start to its last activity, in seconds',
      ...(takes ? {takes: 'the session\'s settings: the Repeat\'s set of takes (task.takes) — the takes it made, read once the set ends'} : {}),
      compare: 'the session\'s settings: Compare, the takes\' own setting (task.compare) — none · second · every, how a Repeat\'s takes are drawn side by side',
      criteria: 'the session\'s settings: the Success conditions typed for the task (task.success), each without an answer until a run returns one',
    },
    absent: {...INTENT_ABSENT, ...(criteriaWhy ? {criteria: criteriaWhy} : {}), ...(compareWhy ? {compare: compareWhy} : {}), ...(takes ? {} : LAUNCH_ABSENT)},
    acts,
    view: {
      fold: 'Fold keeps only the lanes of the tools the agent used: how the log shows, not the log',
      event: 'the log row selected in Clip view', 'env.control': 'which of the Agent\'s controls the envelope editor shows',
      'criteria.page': 'the page of success conditions Clip view shows',
    },
    refused: {...refused, ...INTENT_REFUSED},
  }
}

/** Factory's clip binding: the task THE selection names, or null when it names none. Pure. */
export function factoryClipBinding(input: FactoryClipInput): ClipBinding | null {
  const chosen = factoryTaskOf(input.ref, input.tracks)
  if (!chosen) return null
  const {track, task, trackId} = chosen
  const address: TaskAddress | null = task ? {sessionRef: track.sessionRef, n: task.n} : null
  const ref = task ? `${trackId}#task/${task.n}` : trackId
  const viewDefaults = {'view.panel': 'launch', 'view.editor': 'log', fold: true} as const
  // A tool's press reads the choices the view holds at that moment: the note selected, the tool and what it gives or ties.
  const choice = (key: string): Value | undefined => ({...viewDefaults, ...viewHoldsOf(clipHostId('factory', ref))} as Record<string, Value>)[key]
  const binding = clipBinding({mode: 'factory', ref, values: factoryClipValues(track, task, input),
    wiring: factoryWiring(address, input.settings ?? null, input.returned ?? null, input.plan ?? null, input.score ?? null, choice, input.intent ?? null), placed: input.placed,
    viewDefaults})
  const {unitTasks, select} = input
  const view = binding.local
  if (!unitTasks?.size || !select || !view) return binding
  // The note selected in the score: another task's unit moves THE selection to that task, whose Clip view holds the note (and so names
  // it for Routine…, chosenNoteOf); this task's own note, and a note no task works, stay selected here, where the tools act on them.
  const local = new Proxy(view, {get: (held, key, receiver) => key !== 'unit' ? Reflect.get(held, key, receiver) : (value: Value | undefined) => {
    // A song opened inside a note (`score.open`) shows that song's notes, none a unit of this Run: nothing moves.
    const to = typeof value === 'string' && choice('score.open') === undefined ? unitTasks.get(value) : undefined
    if (!to || to.ref === ref) return held.unit?.(value)
    setViewHold(clipHostId('factory', to.ref), 'unit', value)
    select(to)
  }})
  return {...binding, local}
}

/** What a file opens through: the shell's workspace (its file route) and the book whose focused pane it opens in. */
interface PaneHold {
  readonly workspace: WorkspaceReading | null
  readonly book: {setLayout: (update: (layout: LayoutState) => LayoutState) => void} | null
}

/** Open a listed file beside you, as the browser's Files rows open one (useOpenCentralDocument.ts centralDocumentOpener openFile: a Flow
 * in its pane, any other file through the Workbench's file route, in the focused pane). The opener is loaded when a file is opened, so
 * the clip's module does not carry the document panes. */
async function openInPane(held: PaneHold, entry: DocumentEntry): Promise<void> {
  const workspace = held.workspace
  if (!workspace) throw new Error('No shell workspace is mounted here, so no file opens.')
  const {centralDocumentOpener} = await import('../central/documents/useOpenCentralDocument')
  return centralDocumentOpener({workspace: {current: workspace}, book: {current: held.book}}).openFile(entry)
}

const RETURNED_READING = 'Factory is reading what the task\'s returned attempts name.'
const RETURNED_TAKES_UNREAD = 'What the task returned is not read: AIKit has not said which attempts the session\'s bound task serves.'

/** The selected session's returned takes, each Return read through Factory (attemptArtifacts) once per set of takes. */
function useReturnedFiles(transport: KernelTransportStatus, takes: readonly FactoryTake[] | null): ReturnedReading {
  const returned = takes?.filter(take => take.state === 'returned') ?? null
  const key = returned ? JSON.stringify(returned.map(take => [take.statePath, take.runRef, take.attemptRef])) : null
  const transportKey = JSON.stringify(transport)
  const [reading, setReading] = useState<{key: string | null; value: ReturnedReading}>({key: null, value: {state: 'absent', why: RETURNED_READING}})
  useEffect(() => {
    if (key === null || !returned) return
    let live = true
    void readReturnedFiles(take => attemptArtifacts(transport, take.statePath, take.runRef, take.attemptRef), returned)
      .then(value => { if (live) setReading({key, value}) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, transportKey])
  if (key === null) return {state: 'absent', why: RETURNED_TAKES_UNREAD}
  return reading.key === key ? reading.value : {state: 'absent', why: RETURNED_READING}
}

/** The selected task's clip binding, from the frame's detail reading, THE selection and the sessions provider. */
export function useFactoryClip(): ClipBinding | null {
  const {factory} = useDetailReading()
  const selected = useSelectedClip()
  const sessions = useAgentSessionsOptional()
  const presentation = useTimelinePanePresentation()
  useViewHoldsVersion()
  const trackId = selected.ref ? parseFactoryTaskRef(selected.ref)?.trackId ?? selected.ref : null
  const colour = selected.set?.tracks.find(item => item.id === trackId)?.color ?? selected.track?.color ?? null
  const sessionTrack = factoryTaskOf(selected.ref, factory.tracks)?.track ?? null
  const sessionRef = sessionTrack?.sessionRef ?? null
  const transport = sessions?.transport ?? UNAVAILABLE
  const project = sessionProjectOf(sessions?.rows, sessionRef)
  const answer = useSettingsAnswer(transport, sessions ? sessionRef : null, project)
  // An edit of what the agent holds takes the hold first, in the edit path itself (§19.4: "the agent does not overwrite your edit"; DLW
  // build ruling 2026-11-05): the session's custody, the same reading its chain's Custody draws (devices/sessionCustody.ts).
  const agentRef = sessionTrack?.agentRef ?? null
  const custodyAt = useMemo(() => (sessions && sessionRef ? {sessionRef, project, agentRef} : null), [sessions != null, sessionRef, project, agentRef]) // eslint-disable-line react-hooks/exhaustive-deps
  const {holdFirst} = useSessionCustody(transport, custodyAt)
  const settings: TaskSeamContext | null = sessions && sessionRef
    ? {transport, project, settings: answer.reading.status === 'answered' ? answer.reading.value : null, refused: answer.reading.error, holdFirst} : null
  const constellations = useConstellations().rows
  // What the task's attempts returned: the session's takes (AIKit says which attempts its bound task serves, Factory what each is),
  // each returned one's Return read through Factory, and a file opened beside you through Central's file route.
  const takes = useAttemptTakes(transport, sessions && sessionRef ? [sessionRef] : [], project)
  const files = useReturnedFiles(transport, sessionRef ? takes?.of(sessionRef) ?? null : null)
  // The task's plan: its latest attempt names its Run and unit, and Factory reads that Run's plan of record (agent/wavePlan.ts).
  const target = planTargetOf(sessionRef ? takes?.of(sessionRef) ?? null : null)
  const wave = useWavePlan(transport, target)
  const plan = useMemo<PlanPort | null>(() => sessions && sessionRef ? {reading: wave.plan, lock: async () => {
    if (!target) throw new Error(wave.plan.state === 'absent' ? wave.plan.why : 'No Run and unit are named, so no plan is locked.')
    await lockPlan(transport, target)
    wave.reread()
  }} : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [wave.plan, sessions, sessionRef, JSON.stringify(target), JSON.stringify(transport)])
  // The intent: the same Run's Development Field, as Factory keeps it beside the state that holds the Run (readDevelopmentField).
  const intent = useDevelopmentField(transport, target)
  // The song's score: the Run its latest attempt names, read by Factory, on the rows of the track's Agent rack (agent/scoreBinding.ts).
  const chosen = factoryTaskOf(selected.ref, factory.tracks)
  const rack = useMemo(() => rackRowsOf(chosen?.track ?? null, factory.tracks), [chosen?.track, factory.tracks])
  const scoredOnly = useScore(transport, target, rack, sessionRef, true)
  // Compose (O-I 844): the session's orchestrator, from Central's agent set its group's space runs and AIKit's population, asked with
  // the task's Intent and its source; its proposal read in Central's receiving ledger (agent/scoreBinding.ts useCompose).
  const groupTrack = chosen?.track.parentRef ? factory.tracks.find(item => item.group && item.sessionRef === chosen.track.parentRef) ?? null : null
  const setRef = groupTrack?.agentSet?.ref ?? null
  const setInput = useMemo(() => (setRef ? {scope: 'root', ref: setRef} : null), [setRef])
  const groupSet = useCentralAction(transport, 'central.agent-set.read', setInput)
  const population = usePopulationAnswer(transport, project)
  const composeTo = useMemo(() => composeAddressOf(chosen?.track ?? null, factory.tracks, {set: setRef ? groupSet : null, population}),
    [chosen?.track, factory.tracks, setRef, groupSet, population])
  const source = taskSourceOf(chosen?.task ? {sessionRef: chosen.track.sessionRef, n: chosen.task.n} : null, settings)
  const sourceRef = source.made === 'of' ? source.ref : null
  const words = useMemo((): ComposeWords => {
    const named = sourceRef ? constellationNamed(constellations, sourceRef) : null
    return {intent: intent.state === 'read' ? intent.difference : null, intentWhy: intent.state === 'absent' ? intent.why : null,
      from: intent.state === 'read' ? intent.from : null,
      constellation: sourceRef, sources: named?.members.map(member => member.ref) ?? []}
  }, [intent, sourceRef, constellations])
  const compose = useCompose(transport, project, composeTo, words, scoredOnly.reading, scoredOnly.edit)
  // The note the task's Clip view holds (its view's `unit` hold): Vāk reads QL's breakdown of its heads, this task's own when none is held.
  const note = sessions ? chosenNoteOf(selected.ref, factory.tracks, project) : null
  const steps = useUnitSteps(transport, scoredOnly.reading, note?.key ?? null)
  const scored = useMemo((): ScorePort => ({...scoredOnly, compose, steps}), [scoredOnly, compose, steps])
  // Each note's task: the takes of the rack's sessions and of the sessions on the song's rows, each read in its own register.
  const noteSessions = useMemo(() => sessions && sessionRef ? noteSessionsOf(chosen?.track ?? null, factory.tracks, scored.reading).filter(ref => ref !== sessionRef) : [],
    [sessions, sessionRef, chosen?.track, factory.tracks, scored.reading])
  const others = useAttemptTakes(transport, noteSessions, ref => sessionProjectOf(sessions?.rows, ref))
  const unitTasks = useMemo(() => unitTasksOf(scored.reading, factory.tracks, ref => (ref === sessionRef ? takes : others)?.of(ref) ?? null),
    [scored.reading, factory.tracks, sessionRef, takes, others])
  // File › Export Song… (menus.rs `file.export.song`; App.tsx hands it to the mode that stands as MENU_ACT): the song the selected task's
  // Run performs, made one clip by Factory; its answer, or its refusal, on the Info line.
  const exported = useRef<() => Promise<WorldActionReceipt>>(async () => ({ok: false, error: ''}))
  exported.current = async () => {
    // The range: the stretch the Arrangement's ruler selects at the press (frame/tracks/tracksDoor.ts), as the units that ran in it.
    const ranged = unitsInSpan(shownSpanNow(), sessions && sessionRef ? scored.reading : null)
    if (ranged && 'refused' in ranged) return {ok: false, error: ranged.refused}
    return exportSong(transport, sessions && sessionRef ? scored.reading : null, exportChoiceOf(selected.ref, chosen, ranged?.units))
  }
  // The note the task's Clip view holds, for Routine… on a song (read at its press under Material › Songs).
  const noteKey = note ? JSON.stringify(note) : null
  useEffect(() => {
    publishChosenNote(noteKey ? JSON.parse(noteKey) as ChosenNote : null)
    return () => publishChosenNote(null)
  }, [noteKey])
  useEffect(() => {
    const act = (event: Event) => {
      if ((event as CustomEvent<{id?: unknown}>).detail?.id !== 'file.export.song') return
      event.preventDefault()
      void exported.current().then(answer => sayOnInfoLine(document.body, 'Export Song…', answer.ok ? answer.note ?? 'The song is one clip.' : answer.error))
    }
    window.addEventListener(MENU_ACT, act)
    return () => window.removeEventListener(MENU_ACT, act)
  }, [])
  const held = useRef<PaneHold>({workspace: null, book: null})
  held.current = {workspace: useContext(Workspace), book: useOptionalContinuity()}
  const returned = useMemo<ReturnedPort | null>(() => sessions && sessionRef ? {reading: files, open: file => openReturnedFile(file, {
    list: path => listFiles(transport, path), resolve: ref => resolveFileLocation(transport, ref), open: entry => openInPane(held.current, entry)})} : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [files, sessions, sessionRef, JSON.stringify(transport)])
  return factoryClipBinding({ref: selected.ref, tracks: factory.tracks, events: sessions ? sessions.events : null, colour, placed: presentation === 'arrangement', settings,
    constellations, returned, plan, score: sessions && sessionRef ? scored : null, intent: sessions && sessionRef ? intent : null, unitTasks,
    select: to => timelineReading()?.selectTrackItem(to)})
}

/** The task's intent, read once per Run (its latest attempt's) and kept until the next answer, so it never flickers to unread. */
function useDevelopmentField(transport: KernelTransportStatus, target: PlanTarget | null): IntentReading {
  const key = target ? JSON.stringify([transport, target.statePath, target.runRef]) : null
  const [answer, setAnswer] = useState<{key: string; reading: IntentReading} | null>(null)
  useEffect(() => {
    if (!key || !target || transport.kind === 'unavailable') return
    let live = true
    void readDevelopmentField(op => kernelOp(transport, op as Parameters<typeof kernelOp>[1]) as unknown as ReturnType<IntentCall>, target)
      .then(reading => { if (live) setAnswer({key, reading}) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!target) return {state: 'absent', why: INTENT_NO_RUN}
  if (transport.kind === 'unavailable') return {state: 'absent', why: `The intent: Factory is not reached: ${transport.reason ?? 'the shell has no kernel carrier'}.`}
  return answer?.key === key ? answer.reading : {state: 'absent', why: INTENT_READING}
}

// ---------------------------------------------------------------------------------------------------------------- the drop

/** Factory's clip of a constellation (manual §10.3: "Drag it onto a track and this mode makes its own clip of it, with the constellation as
 * its source: … a task in Factory"; §16.7 Make this mode's clip; §19.1 the Clip panel's Constellation: "The one the task was made of"):
 * a session's track holds the one task AIKit binds to the session, so the drop makes that task of the constellation — the task's own
 * settings take it as their `source` on AIKit, written against the revision read (the owner's CAS), and AIKit's reading gives the source
 * back. A session that holds no task is given a new one made of the constellation through AIKit's task creation (makeNewTaskOf). Every
 * reader of the session's settings is asked again. */
export async function makeTaskOf(transport: KernelTransportStatus, session: SessionAddress,
  constellation: {readonly ref: string; readonly title: string}, project: string): Promise<WorldActionReceipt> {
  const {ref, title} = constellation
  const owner = readSettingsOf(transport, project, session.sessionRef)
  const read = async (): Promise<{reading: EncounterSessionSettingsReading} | {error: string}> => {
    const answer = await owner()
    return 'error' in answer ? {error: answer.error} : {reading: answer.value}
  }
  const before = await read()
  if ('error' in before) return {ok: false, error: `${session.label}'s settings were not read, so no task is made of ${title}: ${before.error}`}
  const task = before.reading.task
  if (!task) return makeNewTaskOf(transport, session, constellation, project)
  const written = await kernelOp(transport, {op: 'encounter_session_settings', project, agent_session: session.sessionRef,
    request: {task: {task_ref: task.task_ref, set: {source: ref}}}, ...(before.reading.revision ? {expected_revision: before.reading.revision} : {})})
  if (written.error || written.outcome?.result !== SETTINGS_RESULT) return {ok: false, error: `AIKit did not make ${task.name} of ${title}: ${written.error ?? 'it gave no reading'}`}
  const after = await read()
  // Every reader of the session's settings is asked again (the Clip panel, the mixer row), as a settings write does (sessionSettings.ts).
  const entry = settingsReadingEntry(transport, project, session.sessionRef)
  const epoch = entry.snapshot().epoch
  if (epoch !== null) void entry.refresh(epoch)
  if ('error' in after) return {ok: false, error: `AIKit kept ${title} as ${task.name}'s source, but did not read it back: ${after.error}`}
  const kept = after.reading.task
  if (!kept || kept.task_ref !== task.task_ref) return {ok: false, error: `AIKit kept the change, but its settings now read another task than ${task.name}.`}
  if (kept.source !== ref) return {ok: false, error: `AIKit kept the change, but reads ${task.name}'s source as ${kept.source ?? 'none'}, not ${ref}.`}
  return {ok: true, note: `${task.name} on ${session.label} is made of ${title}; AIKit reads the task's source as ${title}.`}
}

/** The session a drop lands on: its ref and its name in words. */
export interface SessionAddress {
  readonly sessionRef: string
  readonly label: string
}

/** A new task's ref: the constellation's name, slugged, and the moment it was made (base 36), so two drops never name one task. */
export function newTaskRef(title: string, at = Date.now()): string {
  const slug = title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '')
  return `task:${slug || 'constellation'}-${at.toString(36)}`
}

/** A session that holds no task, given a new one made of the constellation (manual §10.3 "a task in Factory"). The drop names only what is
 * the task's own — its ref, its purpose (the constellation's name) and its source (the constellation) — and AIKit's task creation
 * (`encounter_task_configure`, kernel agency.rs task_configure; ai-kit encounter_task_derive.rs) completes the rest from the session's own
 * standing: the agent and authority its Agency holds, the Central World and Project it works in, the agent it opened on and where, and the
 * Workcell boundary. AIKit allocates the task's NOW with Central and has Workcell inspect its boundary, and refuses in its own words what it
 * cannot derive or the session's Agency does not authorise; AIKit's settings give the source back. */
export async function makeNewTaskOf(transport: KernelTransportStatus, session: SessionAddress, constellation: {readonly ref: string; readonly title: string},
  project: string): Promise<WorldActionReceipt> {
  const {ref, title} = constellation
  const taskRef = newTaskRef(title)
  const request = {purpose: title, source: ref, task_ref: taskRef}
  const made = await kernelOp(transport, {op: 'encounter_task_configure', project, agent_session: session.sessionRef, request})
  // Every reader of the session's task and settings is asked again (the track's clips, the Clip panel, the mixer row), whatever AIKit
  // answered: a refused preparation may still have left its record.
  for (const entry of [settingsReadingEntry(transport, project, session.sessionRef), taskReadingEntry(transport, project, session.sessionRef)]) {
    const epoch = entry.snapshot().epoch
    if (epoch !== null) void entry.refresh(epoch)
  }
  if (made.error || made.outcome?.result !== 'encounter_task_reading') return {ok: false, error: `AIKit did not make a task of ${title} on ${session.label}: ${made.error ?? 'it gave no task record'}`}
  const after = await readSettingsOf(transport, project, session.sessionRef)()
  if ('error' in after) return {ok: false, error: `AIKit made a task of ${title} on ${session.label}, but its settings were not read back: ${after.error}`}
  const kept = after.value.task
  if (!kept || kept.task_ref !== taskRef) return {ok: false, error: `AIKit made a task of ${title}, but ${session.label}'s settings read ${kept ? `another task (${kept.task_ref})` : 'no task'}.`}
  if (kept.source !== ref) return {ok: false, error: `AIKit made ${kept.name} on ${session.label}, but reads its source as ${kept.source ?? 'none'}, not ${ref}.`}
  return {ok: true, note: `${session.label} has a new task made of ${title} (${kept.task_ref}); AIKit reads its source as ${title}.`}
}

