// Each mode's tracks for the one Session and Arrangement (FOUNDATION F3), by registration: the mode's adapter over the
// reading the frame publishes. A table, never a branch in the frame. Live's adapter is the reference (the open set);
// Central's are its workspaces, with the Day as the Main track (useCentralTracks.ts, R3); Factory's its agent sessions and their tasks (useFactoryTracks.ts);
// Technē's its native streams with the walks' stops as rows (useTechneTracks.ts); Expressions' the open work's scenes.
// The three modes whose tracks are the World cut (shell/modeFrames.ts MODE_TRACK_SOURCES 'world') are wrapped by `worldCut`
// (useWorldCut.ts): their sets also carry the time spine's cron firings, the occasion stood in and the rails' stop focus, as the
// World cut presentation drew them beside its tracks.
// R3: Expressions' tracks also read the presented composition (the frame's `session` / `arrangement` source, the one the transport
// reads): the owner's playback for each scene's state, its scene transport for launch, Stop All and Back to Arrangement, the presented
// scene's recorded moves and generator lanes as automation lanes, and the frame's held count and Re-enable (native/frameTakes.ts, the
// link the transport's Re-enable presses — shell/transports/useExpressionsTransport.tsx:183-188).
// W4: from the same readings, the playing scene's progress (its elapsed seconds over the length it plays) and the saved sequence's
// loop flag, so the Session draws the fill and the Arrangement the loop brace.
import type {SurfMode} from '../../shell/modeGrammar'
import type {NativeCompositionViewSource} from '../../shell/compositionViews'
import type {NativeEditorReading} from '../../../../../expressions-boundary/src/editor'
import {readFrameTakeLink, type FrameTakeLink} from '../../native/frameTakes'
import {STAGE_AUTOMATION_RESUME} from '../../native/stageCommands'
import {sceneDuration} from '../../components/nativeScenePlayback'
import type {ExpressionsControls, ExpressionsWorkReading} from '../../timeline/expressionsTrackAdapter'
import type {SetDocument} from '../../shell/document'
import type {SetSummary} from '../../shell/useSet'
import type {NativeExpressionsContent} from '../../shell/nativeContent'
import type {WorldTimelineView} from '../../projections/useWorldTemporalReading'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {KernelTransportStatus, LiveClipAt} from '../../../../../../desktop/cradle/src/kernel/types'
import {liveSetTrackAdapter} from '../../timeline/liveSetTrackAdapter'
import {liveSetWrites} from '../../live/liveWrites'
import {frameSoundReading, readStudioArm, setExpressionMuted, setExpressionSolo} from '../../native/frameSound'
import {expressionsTrackAdapter} from '../../timeline/expressionsTrackAdapter'
import {FACTORY_WAITING} from '../../timeline/factoryTrackAdapter'
import {CENTRAL_WAITING} from '../../timeline/centralTrackAdapter'
import {withTaskActs} from '../../agent/factoryTaskActs'
import {TECHNE_WAITING} from '../../timeline/techneTrackAdapter'
import {useFactoryTracks} from './useFactoryTracks'
import {useCentralTracks} from './useCentralTracks'
import {useTechneTracks} from './useTechneTracks'
import {worldCut} from './useWorldCut'
import {withClipMaker} from './clipMakers'
import {sceneMaker} from '../../components/expressions/clip/clipBinding'
import {liveClipMaker} from '../../live/constellationClip'
import type {JourneyPresentation} from '../../timeline/journeyWalks'

export interface TracksReading {
  /** The kernel carrier, for a mode whose tracks read their own owner. */
  transport?: KernelTransportStatus
  set: SetSummary | null
  document: SetDocument | null
  colors?: readonly string[]
  world?: WorldTimelineView
  native?: NativeExpressionsContent | null
  /** The shell's door to open an Expression a walk stop carries (the World modes' journey). */
  journey?: JourneyPresentation
  workName?: string
  /** The open Expression's presented composition (Expressions' scene transport and its current reading). */
  session?: NativeCompositionViewSource
  arrangement?: NativeCompositionViewSource
}

/** Several sets as one: their tracks and clips side by side, their rows in first-seen order. */
export function mergeSets(sets: readonly WorldTrackSet[]): WorldTrackSet {
  const columns = new Map<string, WorldTrackSet['columns'][number]>()
  for (const set of sets) for (const column of set.columns) if (!columns.has(column.id)) columns.set(column.id, column)
  return {columns: [...columns.values()], tracks: sets.flatMap(set => set.tracks), clips: sets.flatMap(set => set.clips)}
}

/** What the presented composition adds to the open Expression's tracks (R3). */
export interface NativeTracksExtra {
  /** The presented scene's full reading (its property tracks and automation lanes). */
  reading?: NativeEditorReading | null
  controls?: ExpressionsControls
  /** Values held off their automation by hand (the frame's `automationHeld`). */
  held?: number
}

/** A recorded property track's device and parameter, from its binding (ported from expressions-boundary/src/nativeTrackEdits.ts:27-57
 * readNativeTakeTracks, which labels the same tracks through the Scene's own parameter names; the binding's words stand here). */
const bindWords = (bind: string): {device: string; parameter: string} => {
  if (bind.startsWith('field.params.')) return {device: 'Field', parameter: bind.slice('field.params.'.length)}
  const [head, ...rest] = bind.split('.')
  return {device: head === 'entity' ? 'Symbol' : head || 'Scene', parameter: rest.join('.') || bind}
}

/** The presented scene's automation lanes: each recorded property track (an armed take's moves) with its points normalised to the
 * span it recorded, and each enabled generator lane (Scene.automation) naming what moves its parameter. */
export function sceneAutomationOf(reading: NativeEditorReading): NonNullable<ExpressionsWorkReading['automation']>[number]['lanes'] {
  const scene = reading.scene as unknown as {propertyTracks?: {id: string; bind: string; points: {time: number; value: number}[]}[]
    automation?: {id: string; enabled: boolean; target: string; type: string; wave: string; rate: number; min: number; max: number; blend: string}[]}
  const recorded = (scene.propertyTracks ?? []).map(track => {
    const values = track.points.map(point => point.value)
    const min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 0
    const spread = max - min
    return {id: track.id, ...bindWords(track.bind), range: {min, max},
      points: track.points.map(point => ({at: point.time, value: spread > 0 ? (point.value - min) / spread : .5}))}
  })
  const generated = (scene.automation ?? []).filter(lane => lane.enabled).map(lane => ({id: lane.id, ...bindWords(lane.target), points: [],
    range: {min: lane.min, max: lane.max},
    modulatedBy: `${lane.type} · ${lane.wave} · ${lane.rate} Hz · ${lane.blend === 'replace' ? 'automation' : `modulation (${lane.blend})`}`}))
  return [...recorded, ...generated]
}

/** The open Expression as a track, its scenes as clips (lock §9.1: an Expression is a track; its scenes are its clips). */
export function nativeTracks(content: NativeExpressionsContent | null | undefined, workName?: string, extra: NativeTracksExtra = {}): WorldTrackSet | null {
  const scenes = content?.scenes?.scenes
  if (!content || !scenes) return null
  const expressionId = content.basis.expression_ref
  const playback = content.playback
  // How each scene stands, from the owner's playback: the scene that plays runs, a scene with material stands ready, one without
  // says why. A scene playing outside the saved sequence differs from the ruler.
  // How far the playing scene has got (W4): the owner's elapsed seconds over the length the scene plays — its saved snapshot's while
  // the saved sequence plays, else its working length (the Expressions app's own timing, propertyTracks.ts expressionTiming) — and
  // only when that length is read (nativeScenePlayback.ts sceneDuration). Nothing is estimated for a scene whose length is unread.
  const progressOf = (scene: (typeof scenes)[number]) => {
    const expected = playback ? sceneDuration(playback.saved_sequence_playing ? scene.snapshot.duration : scene.working?.duration) : null
    return playback && expected !== null && Number.isFinite(playback.scene_elapsed_seconds) ? {progress: {elapsed: playback.scene_elapsed_seconds, expected}} : {}
  }
  const statusOf = (scene: (typeof scenes)[number]) => playback && playback.scene_playing && playback.scene_ref === scene.scene_ref ? {status: 'running' as const, ...progressOf(scene)}
    : scene.material?.available ? {status: 'stopped' as const} : scene.material?.reason ? {note: scene.material.reason} : {}
  const presented = extra.reading && extra.reading.basis.expression_ref === expressionId ? extra.reading : null
  // The saved sequence's loop flag (the Journey's, expressions-boundary/src/scenes.ts `loop`), where a saved sequence stands to loop.
  const loops = content.scenes?.loop === true && content.scenes.timing.saved.available
  // The Expression's description, as its owner's scenes inventory reads it (O-I #747): its track head's info text. Unread, it is not passed.
  const description = content.scenes?.description
  return expressionsTrackAdapter.project({expressions: [{id: expressionId, name: workName ?? expressionId,
    ...(typeof description === 'string' ? {description} : {}),
    scenes: scenes.map(scene => ({id: scene.scene_ref, name: scene.title || scene.native_title, duration: scene.working?.duration ?? scene.snapshot.duration ?? 0, ...statusOf(scene)}))}],
    ...(presented ? {automation: [{expressionId, sceneId: presented.basis.scene_ref, lanes: sceneAutomationOf(presented)}]} : {}),
    ...(playback ? {differs: playback.scene_playing && !playback.saved_sequence_playing} : {}),
    ...(loops ? {loop: true} : {}),
    ...(extra.held !== undefined ? {held: extra.held} : {}),
    ...(extra.controls ? {controls: extra.controls} : {})})
}

/** A native reply in the receipt words the views show. */
const said = (reply: {ok: boolean; error?: string}, note: string) => reply.ok ? {ok: true, note} : {ok: false, error: reply.error ?? 'The owner refused and gave no reason.'}

/** The owner's scene transport and the frame's Re-enable, through the presented composition and the frame's link. */
export function expressionsControls(source: NativeCompositionViewSource | undefined, link: FrameTakeLink): ExpressionsControls {
  const controls: ExpressionsControls = {}
  const actions = source?.actions
  if (actions && source.isPresented()) {
    controls.playScene = {op: 'expressions scene · play-scene (the presented composition\'s scene transport)', run: (_expression, scene) =>
      actions.scene({action: 'play-scene', scene_ref: scene}).then(reply => said(reply, 'The scene plays.'))}
    controls.stopAll = {op: 'expressions scene · pause, and stop-saved when the saved sequence plays', run: async () => {
      const paused = await actions.scene({action: 'pause'})
      if (!paused.ok) return said(paused, '')
      return source.content?.playback?.saved_sequence_playing ? actions.scene({action: 'stop-saved'}).then(reply => said(reply, 'Every scene stopped.')) : said(paused, 'Every scene stopped.')
    }}
    controls.playSaved = {op: 'expressions scene · play-saved (the saved sequence: the ruler)', run: () => actions.scene({action: 'play-saved'}).then(reply => said(reply, 'The saved sequence plays again.'))}
    controls.sceneEdit = {op: 'expressions scene-edit (the presented composition)', run: intent => actions.sceneEdit(intent).then(reply => said(reply, 'The Expression changed.'))}
  }
  const run = link.run
  if (run) controls.reenable = {op: 'expressions stage · automation resume (native/stageCommands.ts STAGE_AUTOMATION_RESUME)', run: () =>
    run(STAGE_AUTOMATION_RESUME).then(result => result.ok ? {ok: true, note: 'Every held value went back to its automation.'} : {ok: false, error: result.error})}
  // The Expression's own sound: the open Expression's frame is the one that sounds.
  const presented = link.state?.nativeScene?.expression_ref ?? null
  if (run && presented) {
    const reading = frameSoundReading(link)
    const answer = (note: string) => (result: {ok: boolean; error?: string}) => result.ok ? {ok: true, note} : {ok: false, error: result.error}
    controls.sound = {op: 'expressions stage · sound {muted} (the open Expression\'s object sound, native-field/entitySound.ts)', ...reading,
      mute: (_expression, muted) => setExpressionMuted(link, presented, muted).then(answer(muted ? 'The Expression\'s sound is silenced; its picture plays on.' : 'The Expression sounds again.')),
      solo: (expression, on) => setExpressionSolo(link, presented, expression, on).then(answer(on ? 'Only this Expression sounds.' : 'Every Expression sounds again.'))}
  }
  const arm = readStudioArm()
  if (arm) controls.arm = {op: 'the transport\'s Studio arm (shell/transports/useExpressionsTransport.tsx): armed, Play records a take', on: arm.on,
    set: on => { arm.set(on); return {ok: true, note: on ? 'Armed: Play records a take of the chosen properties.' : 'Disarmed: Play plays.'} }}
  return controls
}

/** Expressions' tracks: the open Expression and its scenes, with what the presented composition and the frame's link add. A plain
 * read, no hook (the registration stays callable outside a render, as the clip readers call it): the frame's link is read as it
 * stands when the pane draws, and the pane draws again whenever the presented reading is published. Its tracks take a constellation
 * dropped on them, which makes a scene of it in the open Expression (components/expressions/clip/clipBinding.ts sceneMaker). */
export function expressionsTracks(reading: TracksReading): WorldTrackSet | null {
  const link = readFrameTakeLink()
  const source = reading.session ?? reading.arrangement
  const current = source?.currentReading?.() ?? null
  const held = link.state?.automationHeld
  const set = nativeTracks(reading.native, reading.workName, {reading: current, controls: expressionsControls(source, link), ...(held !== undefined ? {held} : {})})
  return set ? withClipMaker(set, sceneMaker(source)) : set
}

/** A mode's tracks: a hook over the published reading (a mode may read its own owner — Central's streams, Factory's
 * sessions); called once per render from a component keyed by the mode, so each mode keeps its own hook order. */
export type UseModeTracks = (reading: TracksReading) => WorldTrackSet | ModeTracksWaiting | null

/** A mode's owner has not answered yet, or refused: the pane says why instead of drawing tracks. */
export interface ModeTracksWaiting { waiting: string }

/** The tracks, or nothing while the mode is waiting. */
export const tracksOf = (answer: WorldTrackSet | ModeTracksWaiting | null): WorldTrackSet | null =>
  answer && !('waiting' in answer) ? answer : null

export const MODE_TRACKS: Readonly<Record<SurfMode, UseModeTracks>> = {
  // With no set open Live is waiting — the empty Session says how to open one (the reading's waiting words), not "no tracks".
  // A constellation dropped on a part makes Live's clip of it (live/constellationClip.ts liveClipMaker, O-I #768).
  live: reading => reading.set ? liveTracks(reading.set, reading.document, reading.colors) : null,
  base: worldCut(useCentralTracks),
  // A session's and its task's own acts on AIKit (O-I #743: Delete, Paste, Insert, a session's Rename and Delete), over the carrier.
  factory: worldCut(withTaskActs(useFactoryTracks)),
  techne: worldCut(useTechneTracks),
  expressions: expressionsTracks,
}

/** Live's tracks: the open set's parts, its writes and its acts (O-I #743), Launch and Stop on the torus, and Live's clip of a
 * constellation dropped on a part. Pure. */
export function liveTracks(set: SetSummary, document: SetDocument | null, colors?: readonly string[], maker = liveClipMaker(set.path)): WorldTrackSet {
  // The clip player loads with Live's transport (O-I #740: a mode's code is not the first load), so its acts reach it when pressed.
  const player = () => import('../../live/clipPlayer').then(module => module.liveClipActs)
  const play = {launch: (track: number, at: LiveClipAt) => player().then(acts => acts.launch({path: set.path, track, at}, set.tempo_bpm)),
    stop: (track: number) => player().then(acts => acts.stop(set.path, track, set.tracks[track]?.name ?? 'the track')),
    stopAll: () => player().then(acts => acts.stopAll())}
  const tracks = liveSetTrackAdapter.project({set, document, colors, ...liveSetWrites(set.path), play})
  return maker ? withClipMaker(tracks, maker) : tracks
}

/** What each mode's acts no owner op carries wait for (O-I #743, round three), by the op the menu names: a registration, never a branch.
 * A mode's set may say more of its own (its `actions.waiting`, which stands over these). */
export const MODE_WAITING: Readonly<Partial<Record<SurfMode, Readonly<Record<string, string>>>>> = {
  base: CENTRAL_WAITING,
  factory: FACTORY_WAITING,
  techne: TECHNE_WAITING,
}

/** Whose operations each mode's object acts are, in the words a missing act names (manual §10.9; each mode's action table,
 * §17.1–§21.1). A registration, never a branch. */
export const MODE_OWNERS: Readonly<Record<SurfMode, string>> = {
  live: 'kernel · live-set, the open set\'s owner',
  base: 'Central · the page owner, kernel/src/page.rs, and today\'s set in the Day, central/daySet.ts',
  factory: 'AIKit · the encounter\'s session settings, and Factory',
  techne: 'Technē · the reading\'s owner',
  expressions: 'Expressions · the native composition',
}
