// Songs (O-I #844; manual §19.1 Songs: "Export Song… (File menu) writes the song … as one clip. The clip is a render: it names its set,
// Remake makes it again, and it is never edited in place. It stands under Material in the browser, under the project that made it";
// "Drop the clip on a track, in this project or another, and it becomes a task with the thread form canon"; §10.3: "An import keeps
// where it came from"). Everything here is Software Factory's (factory song_clip.rs, workflow-sdk/README.md "Songs: one clip, made
// again, used whole"), reached through the kernel's factory_owner:
//   - Export Song… — `factory workflow export <state> <entry>` (factory.song-clip/v1, kind `workflow-export`): the song the selected
//     task's Run performs, from its file under the project root (the score names it, scoreBinding.ts), rendered once into one clip.
//   - Material › Songs — `factory workflow songs <state>` for every Factory source Central discloses (factory.song-clips/v1, gathered by
//     the kernel as oi.factory-songs/v1, kind `workflow-songs-read`), grouped by the project that keeps each clip, each with whether its
//     set has moved since it was rendered.
//   - Remake — `factory workflow remake <state> <name>` (kind `workflow-remake`).
//   - The drop — `factory workflow edit`'s `canon` op (factory.workflow-edit/v1, kind `workflow-edit`) on the song the dropped-on
//     session's Run performs: one unit of that song, given to the track's agent, naming the clip; a clip from another project is
//     imported into the receiving one first, which keeps where it came from.
// The clip selected under Songs is the browser's own selection (as the constellation's is: frame/browser/constellationFocus.ts); the
// Skillset rack's Capture page reads it as its "A selected clip" source (devices/captureSkillBinding.ts). Nothing here executes a song:
// a Run, Repeat or a routine performs it again, and the song keeps no schedule. Pure, apart from the kernel calls and the selection.
import {useSyncExternalStore} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldActionReceipt} from '../timeline/worldTrackAdapter'
import {readAttemptTakes, type TakesCall} from '../owners/attemptTakes'
import {tellOwnerChanged} from '../owners/notices'
import {factoryOwnerWrite, refusalWords} from './devices/ownerRoutes'
import {EDIT_REQUEST, readScore, type ScoreReading} from './scoreBinding'
import {planTargetOf, type PlanCall} from './wavePlan'

/** Factory's clip of a song, a project's clips, and the kernel's gathering of every disclosed project's. */
export const SONG_CLIP = 'factory.song-clip/v1'
export const SONG_CLIPS = 'factory.song-clips/v1'
export const SONGS_GATHERED = 'oi.factory-songs/v1'
/** A clip's ref (`factory-song:<project key>/<name>`). */
export const SONG_REF = 'factory-song:'
/** The drag a song's row carries: the clip's ref, its file and its name, as JSON. */
export const SONG_CLIP_DRAG = 'application/x-oi-song-clip'

const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []

/** Where a clip's set stands since it was rendered, as Factory says it (song_clip.rs songs). */
export type SongStanding = 'current' | 'moved' | 'missing' | 'another-song' | 'does-not-compile' | 'imported' | 'unreadable'
export const STANDING_WORD: Readonly<Record<SongStanding, string>> = {
  current: 'current', moved: 'set moved', missing: 'set missing', 'another-song': 'another song', 'does-not-compile': 'set refused',
  imported: 'imported', unreadable: 'unreadable',
}

/** One clip under Songs. */
export interface SongRow {
  readonly key: string
  readonly name: string
  readonly clipRef: string | null
  /** The clip's file (what a drop names), and the state of the project that keeps it (what Remake asks). */
  readonly path: string
  readonly statePath: string
  /** The project that keeps it, as Central names it (null: your own world's root). */
  readonly project: string | null
  readonly standing: SongStanding
  readonly why: string
  readonly units: number
  readonly rows: number
  readonly renders: number
  readonly importedFrom: string | null
  readonly entry: string | null
  /** The clip as Factory wrote it, for the Capture page. */
  readonly clip: Record<string, unknown> | null
}

/** One project's songs, or why they are not here. */
export interface SongsGroup {
  readonly project: string | null
  readonly label: string
  readonly state: 'read' | 'absent' | 'refused'
  readonly why?: string
  readonly songs: readonly SongRow[]
}

export type SongsReading = {readonly state: 'read'; readonly groups: readonly SongsGroup[]} | {readonly state: 'absent'; readonly why: string}

const STANDINGS = new Set<string>(Object.keys(STANDING_WORD))
const projectLabel = (project: string | null): string => project ?? 'Your world'

/** The kernel's gathering of every disclosed project's songs, as rows grouped by project: a project with no Factory source is left out,
 * one Factory refused says so. Pure. */
export function songsOf(data: unknown): SongsReading {
  const gathered = object(data)
  if (gathered?.contract !== SONGS_GATHERED) return {state: 'absent', why: `The kernel answered no songs reading (${SONGS_GATHERED}): the shell's kernel may predate Songs.`}
  const groups: SongsGroup[] = []
  for (const entry of list(gathered.projects).map(object)) {
    if (!entry) continue
    const project = text(entry.project)
    if (entry.state === 'absent') continue
    if (entry.state !== 'read') {
      groups.push({project, label: projectLabel(project), state: 'refused', why: `Factory did not list ${projectLabel(project)}'s songs: ${refusalWords(text(entry.error) ?? 'it gave no reason')}`, songs: []})
      continue
    }
    const reading = object(entry.reading)
    if (reading?.contract !== SONG_CLIPS) {
      groups.push({project, label: projectLabel(project), state: 'refused', why: `Factory answered no list of songs (${SONG_CLIPS}): the Factory installed here may predate \`factory workflow songs\`.`, songs: []})
      continue
    }
    const statePath = text(entry.statePath) ?? ''
    const songs = list(reading.songs).map(object).flatMap((song): SongRow[] => {
      const name = text(song?.name)
      if (!song || !name) return []
      const standing = (STANDINGS.has(String(song.standing)) ? song.standing : 'unreadable') as SongStanding
      return [{key: `${statePath}\u0000${name}`, name, clipRef: text(song.clipRef), path: text(song.path) ?? '', statePath, project, standing,
        why: text(song.why) ?? '', units: Number(song.units) || 0, rows: Number(song.rows) || 0, renders: Number(object(song.render)?.renders) || 0,
        importedFrom: text(object(song.importedFrom)?.clipRef), entry: text(object(song.set)?.entry), clip: object(song.clip)}]
    })
    groups.push({project, label: projectLabel(project), state: 'read', songs})
  }
  return {state: 'read', groups}
}

/** A clip's words: what it is, what it was made from, and where its set stands. Pure. */
export function songWords(row: SongRow): string {
  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
  const made = row.importedFrom ? `imported from ${row.importedFrom}` : `rendered from ${row.entry ?? 'its set'}${row.renders > 1 ? `, ${plural(row.renders, 'render')}` : ''}`
  return `${row.name} — a song made into one clip (${row.clipRef ?? 'no ref'}), ${made}: ${plural(row.units, 'unit')} on ${plural(row.rows, 'row')}. ${row.why}`.trim()
}

/** The kernel op as the reads call it. */
const carried = (transport: KernelTransportStatus): PlanCall => op =>
  kernelOp(transport, op as Parameters<typeof kernelOp>[1]) as unknown as ReturnType<PlanCall>

/** One read of every disclosed project's songs through the kernel, or why there is none. */
export async function readSongs(call: PlanCall): Promise<SongsReading> {
  const read = await call({op: 'factory_owner', request: {kind: 'workflow-songs-read', all: true}})
  if (read.error) return {state: 'absent', why: `Factory's songs were not read: ${refusalWords(read.error)}`}
  return songsOf(read.outcome?.result === 'factory_development_reading' ? read.outcome.data : null)
}
export const readSongsThrough = (transport: KernelTransportStatus) => readSongs(carried(transport))

/** The export Factory takes: the song's file under the project root, and the clip's name, rows and range when they are chosen. */
export interface ExportChoice {readonly name?: string; readonly rows?: readonly string[]; readonly units?: readonly string[]}
export const exportRequest = (statePath: string, entry: string, choice: ExportChoice = {}) =>
  ({kind: 'workflow-export', state_path: statePath, entry, ...(choice.name ? {name: choice.name} : {}), ...(choice.rows?.length ? {rows: choice.rows} : {}),
    ...(choice.units?.length ? {units: choice.units} : {})})
export const remakeRequest = (statePath: string, name: string) => ({kind: 'workflow-remake', state_path: statePath, name})

export const EXPORT_NO_SCORE = 'Export Song…: select a task on a session\'s track whose Run Factory reads — the song exported is the one its Run performs.'
const songsMoved = () => tellOwnerChanged({topic: 'temporal', cause: 'a song was made into a clip, remade or dropped: Material\'s songs moved'})

/** Export Song…: the song the task's Run performs, from its file under the project root, as one clip the project keeps. Factory's
 * refusal (a render of that name already stands, a file that does not compile) is its words. */
export async function exportSong(transport: KernelTransportStatus, score: ScoreReading | null, choice: ExportChoice = {}): Promise<WorldActionReceipt> {
  if (score?.state !== 'read') return {ok: false, error: score?.state === 'absent' ? `${EXPORT_NO_SCORE} ${score.why}` : EXPORT_NO_SCORE}
  const song = object(score.reading.song), entry = text(object(song?.file)?.entry)
  if (!entry) return {ok: false, error: `Export Song…: Factory writes no clip of this song — ${text(song?.why) ?? 'no file under the project root holds it'}`}
  try {
    const made = object(await factoryOwnerWrite(transport, exportRequest(score.target.statePath, entry, choice), '`factory workflow export`'))
    const clip = object(made?.clip)
    if (made?.contract !== SONG_CLIP || !clip) return {ok: false, error: `Factory answered no clip (${SONG_CLIP}).`}
    songsMoved()
    return {ok: true, note: `${text(clip.name)} is a clip under Material › Songs, ${list(object(clip.score)?.units).length} units rendered from ${entry} (${text(clip.clipRef)}).`}
  } catch (cause) {
    return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}
  }
}

/** Remake: the clip made again from its set as it now stands. */
export async function remakeSong(transport: KernelTransportStatus, row: SongRow): Promise<WorldActionReceipt> {
  try {
    const made = object(await factoryOwnerWrite(transport, remakeRequest(row.statePath, row.name), '`factory workflow remake`'))
    if (made?.contract !== SONG_CLIP) return {ok: false, error: `Factory answered no clip (${SONG_CLIP}).`}
    songsMoved()
    return {ok: true, note: `${row.name} was made again from its set${made.moved ? ', which had moved' : ', which had not moved'}.`}
  } catch (cause) {
    return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}
  }
}

/** What a song's row carries when it is dragged. */
export interface SongPayload {readonly clipRef: string; readonly path: string; readonly name: string}
export const songPayload = (row: SongRow): string => JSON.stringify({clipRef: row.clipRef, path: row.path, name: row.name})
/** A dropped payload as a song's clip, or null when it is none (a constellation's ref, anything else). Pure. */
export function songOfPayload(payload: string): SongPayload | null {
  if (!payload.trim().startsWith('{')) return null
  try {
    const value = object(JSON.parse(payload))
    const clipRef = text(value?.clipRef), path = text(value?.path), name = text(value?.name)
    return clipRef?.startsWith(SONG_REF) && path && name ? {clipRef, path, name} : null
  } catch { return null }
}

/** The session a song is dropped on: its ref, its name in words, the agent it runs and its register. */
export interface DropTrack {readonly sessionRef: string; readonly label: string; readonly agentRef: string | null; readonly project: string}

export const DROP_NO_AGENT = 'A dropped song is given to the track\'s agent: this session names none, so Factory is not asked.'
export const dropNoRun = (label: string) => `${label}'s task has no attempt that names its Run and workflow unit, so there is no song here for the dropped one to join (a session's song is its Run's).`

/** The drop: the song the dropped-on session's Run performs gains one unit with the thread form canon, given to the track's agent and
 * naming the clip (Factory imports another project's clip into this one first). Read against the byte revision Factory read; every
 * reader of the score and of the songs is asked again. */
export async function dropSong(transport: KernelTransportStatus, track: DropTrack, song: SongPayload,
  call: PlanCall & TakesCall = carried(transport) as PlanCall & TakesCall): Promise<WorldActionReceipt> {
  if (!track.agentRef) return {ok: false, error: DROP_NO_AGENT}
  const takes = await readAttemptTakes(call, track.project, [track.sessionRef])
  if (!takes) return {ok: false, error: `AIKit did not say which attempts ${track.label}'s task serves, so the song it performs is not found.`}
  const target = planTargetOf(takes.get(track.sessionRef) ?? null)
  if (!target) return {ok: false, error: dropNoRun(track.label)}
  const score = await readScore(call, target)
  if (score.state !== 'read') return {ok: false, error: score.why}
  const revision = text(object(object(score.reading.song)?.file)?.byteRevision)
  if (!revision) return {ok: false, error: `Factory writes no edit of ${track.label}'s song: ${text(object(score.reading.song)?.why) ?? 'no file under the project root holds it'}`}
  const request = {contract: EDIT_REQUEST, expectedRevision: revision, edits: [{op: 'canon', clip: song.path, to: {kind: 'agent', ref: track.agentRef}}]}
  try {
    const receipt = object(await factoryOwnerWrite(transport, {kind: 'workflow-edit', state_path: target.statePath, run_ref: target.runRef, request}, '`factory workflow edit`'))
    const added = object(list(receipt?.added)[0])
    songsMoved()
    const imported = list(receipt?.imports).length ? `; this project keeps an import of ${song.clipRef}, which keeps where it came from` : ''
    return {ok: true, note: `${song.name} is a task of ${track.label}'s song with the thread form canon (${text(added?.key) ?? song.name})${imported}. Double-click its note in the score to open it.`}
  } catch (cause) {
    return {ok: false, error: cause instanceof Error ? cause.message : String(cause)}
  }
}

// ---------------------------------------------------------------------------------------------------------------- the selection

let focus: SongRow | null = null
const listeners = new Set<() => void>()

/** Select a clip under Songs (a press on its row), or none. */
export function selectSongClip(row: SongRow | null): void {
  if (focus?.key === row?.key && focus?.clip === row?.clip) return
  focus = row
  for (const listener of [...listeners]) listener()
}
export const songClipFocus = (): SongRow | null => focus
export function useSongClipFocus(): SongRow | null {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, songClipFocus, songClipFocus)
}
