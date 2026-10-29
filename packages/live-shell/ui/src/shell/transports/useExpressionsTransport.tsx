// Expressions' bindings of the one transport (T-TRANSPORT-BINDINGS; FOUNDATION F7; manual §10.5, the Expressions column).
// The working controls of the native Scene bar (components/NativeTransportBar.tsx, now retired: the frame's one bar,
// frame/transport/Transport.tsx, is drawn in Expressions too) fold in here, slot by slot. The bar owns no clock and no playback
// state, and neither does this hook: each press is one owner request on the captured basis, and each light and readout is the
// owner's reading. Nothing is new — the old bar's own words name the slots it filled (the Draw-mode slot, the Map slot, the
// CPU-light slot), and the grammar (shell/modeGrammar.ts, `expressions`) names the rest.
//
// What this hook reads beyond TransportReading is the native transport source the old bar took as its prop (`nativeTransport`,
// a NativeCompositionViewSource). With none, or with no native content standing, the slots show only the frame's readouts and
// wait, as they did while the old bar was not drawn.
//
// Not here, because §10.5 gives them no slot: the Scene ‹ name › selector, Saved scenes, Save, Guide, the pinned-controls strip
// and the Expression time readout. A Scene is a clip (lock §9.1), so they stand on the Clip side of the detail, where manual §3
// puts "everything you can do to it": components/expressions/clip/SceneControls.tsx. Two things of the Scene must not wait for
// that side to be shown, and are mounted here (the one part of Expressions that stands whenever the mode does): the Ctrl or ⌘ S
// chord of Save, and the focus a selected scene clip asks of the owner (components/expressions/clip/sceneKeepers.ts).
import {useEffect, useMemo, useRef, useState} from 'react'
import type {NativeEditorReply} from '../../../../../expressions-boundary/src/editor'
import {STAGE_TAKE_MODES, type StageTakeMode} from '@epilogos/expressions-boundary'
import {publishStudioArm} from '../../native/frameSound'
import {BarEngineLight, BarPointerGroup, BarTools, BarValue, type BarApply} from '../../components/NativeBarControls'
import {barEngineLight, barParameter, barPlayRoute, barResume} from '../../components/nativeBarModel'
import {createLiveSession} from '../../components/nativeBarSession'
import {PinModeToggle} from '../../components/NativePinControls'
import {clampSeek, scrubRequest, scrubStep, sceneFocused, sceneTransportModel, spaceTogglesPlayback} from '../../components/nativeScenePlayback'
import type {TransportBindings, TransportSlotId} from '../../frame/transport/slots'
import {frameTakeReason, TAKE_MODE_LABELS, takeStart, takeStop, useFrameTakeLink, type FrameStageRun} from '../../native/frameTakes'
import {STAGE_AUTOMATION_RESUME} from '../../native/stageCommands'
import {useSceneKeepers} from '../../components/expressions/clip/sceneKeepers'
import {currentCompositionReply, currentNativeSceneReply, type NativeCompositionViewSource} from '../compositionViews'
import type {NativeContentActions, NativeSceneAction} from '../nativeContent'
import type {ModeTransportReadouts} from '../ModeTransportBar'
import type {TransportReading} from '../modeTransports'
import {holdRatio} from './transportReadings'
import '../../components/NativeTransportBar.css'

type Actions = NonNullable<NativeContentActions>

/** About 4 Hz, the old bar's cadence (NativeTransportBar.tsx:16): fast enough to watch a lane move, slow enough that a full read stays cheap. */
const EFFECTIVE_POLL_MS = 250

/** What the hook reads from the frame: the common reading and the native transport source the old bar took as its prop. */
export type ExpressionsTransportReading = TransportReading & {nativeTransport?: NativeCompositionViewSource | null}

/** The owner readouts a frame publishes for a slot, as slot readouts — what the registry's default hook shows. */
const readoutBindings = (readouts: ModeTransportReadouts | undefined): TransportBindings =>
  Object.fromEntries(Object.entries(readouts ?? {}).map(([id, readout]) => [id, {readout}])) as TransportBindings

/** The last thing the owner said about a slot's gesture (a refusal, a fault), under the slot's own title. */
type Said = {slot: TransportSlotId; text: string}
const noted = (base: string, ...said: (Said | null)[]): string => {
  const lines = said.filter((line): line is Said => line !== null).map(line => `↳ ${line.text}`)
  return lines.length ? `${base} ${lines.join(' ')}` : base
}

/** Why the scenes cannot play yet: the first reading the transport lacks, in the person's words. Pure. */
export function unreadReason(source: NativeCompositionViewSource | null, content: NativeCompositionViewSource['content'] | null | undefined): string {
  if (!source) return 'No Expression is open here. Open one in the browser to play its scenes.'
  if (!content) return 'The open Expression has not been read yet. Its scenes play once its owner answers.'
  if (!content.scenes) return 'The Expression\'s owner has not disclosed its scenes, so there is nothing to play yet.'
  return 'The Expression\'s owner has not disclosed its playback, so Play cannot start or show where it is.'
}

export const useExpressionsTransport = (reading: ExpressionsTransportReading): TransportBindings => {
  const source = reading.nativeTransport ?? null
  const latest = useRef(source); latest.current = source
  const lifetime = useRef({mounted: false, epoch: 0})
  useEffect(() => {const own = ++lifetime.current.epoch; lifetime.current.mounted = true; return () => {if (lifetime.current.epoch === own) {lifetime.current.mounted = false; lifetime.current.epoch++}}}, []) // :29
  const [fault, setFault] = useState<Said | null>(null), [busy, setBusy] = useState(false)                       // :30
  // The scrub draft is local presentation until release; it never reaches the owner (:34-35).
  const [draft, setDraft] = useState<number | null>(null); const draftRef = useRef<number | null>(null)
  const identity = source?.content?.basis.scene_ref
  // The take control reads the frame's own readings and starts its take in the mode chosen here (:38).
  const link = useFrameTakeLink()
  // Bar controls: each reads the owner's reading and sends one admitted request. Nothing here keeps a value of its own (:39-41).
  const editorReading = source?.currentReading?.() ?? null
  const barApply: BarApply = changes => source?.actions ? source.actions.applyChanges(changes) : Promise.resolve({ok: false, error: 'The native editor is not attached.'})
  const timeScale = editorReading ? barParameter(editorReading, 'fluid.timeScale') : null                       // :42
  // The scene's ratio of hold to change (signature): the field's morph hold share, the dwell readNativeGlyphTiming reads for a
  // morph clock (shell/nativeContent.ts) — the engine's effective value while automated, else the authored base.
  const hold = editorReading ? barParameter(editorReading, 'toroidalMorph.holdRatio') : null
  const holdShare = hold ? hold.effective ?? hold.base : null
  const ratio = holdRatio(holdShare)
  // The session is one object per parameter, reading the latest runner and automation state at each call, so a re-render never strands a drag (:43-46).
  const liveDeps = useRef<{run: typeof link.run; apply: (value: number) => Promise<boolean>; automated: boolean}>({run: null, apply: async () => false, automated: false})
  liveDeps.current = {run: link.run, automated: timeScale?.automated ?? false,
    apply: value => timeScale ? barApply([{kind: 'parameter', target: timeScale.target, value}]).then(answer => answer.ok, () => false) : Promise.resolve(false)}
  // Effective values come from engine telemetry and arrive only when the owner is read: while a lane runs or a take records, at about 4 Hz,
  // never while the page is hidden and never over a pending edit (:47-59).
  const pollLatest = useRef(source); pollLatest.current = source
  const polling = !!editorReading && !editorReading.standing.pending && (editorReading.scene.automation.some(lane => lane.enabled) || link.state?.propertyRecording === true)
  useEffect(() => {
    if (!polling) return
    const id = setInterval(() => {
      const now = pollLatest.current
      if (document.hidden || !now?.actions || !now.isPresented()) return
      void now.actions.readNow().catch(() => {})
    }, EFFECTIVE_POLL_MS)
    return () => clearInterval(id)
  }, [polling])
  const timeScaleTarget = timeScale?.target ?? null
  const timeScaleSession = useMemo(() => timeScaleTarget ? createLiveSession(timeScaleTarget, () => liveDeps.current) : null, [timeScaleTarget])
  const [takeMode, setTakeMode] = useState<StageTakeMode>('replace'), [takeBusy, setTakeBusy] = useState(false), [takeFault, setTakeFault] = useState<Said | null>(null) // :62
  // Arm is shell presentation only: it decides what Play does. It is never a document value and survives Scene changes like a transport toggle (:63-64).
  const [armed, setArmed] = useState(false)
  // The mixer row's Arm is this same arm (native/frameSound.ts): published while the transport stands.
  useEffect(() => { publishStudioArm({on: armed, set: setArmed}) }, [armed])
  useEffect(() => () => publishStudioArm(null), [])
  useEffect(() => {if (link.state?.takeMode) setTakeMode(link.state.takeMode)}, [link.state?.takeMode])          // :65
  useEffect(() => {setFault(null); setTakeFault(null); draftRef.current = null; setDraft(null)}, [identity])       // :66
  // Space reaches the transport only through this ref, so it is retired with the content (:67-84). Ctrl/⌘ S travelled with Save (sceneKeepers.ts).
  const playRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const active = document.activeElement
      const play = playRef.current
      if (!play || !spaceTogglesPlayback({key: event.key, repeat: event.repeat, altKey: event.altKey, ctrlKey: event.ctrlKey,
        metaKey: event.metaKey, shiftKey: event.shiftKey, focusIsBody: !active || active === document.body || active === document.documentElement})) return
      event.preventDefault(); play()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // The Scene's chord and the selection's focus stand with Expressions, not with its Clip side.
  useSceneKeepers(source)
  const content = source?.content, scenes = content?.scenes, playback = content?.playback
  // :86 — the old bar drew nothing here, so Play stood dimmed with no reason (walk 739, X2). Play and Stop now stay unpressable and say
  // why on the status bar (manual §16.10 "Disabled … The status bar says why"): the reading that is missing, named.
  if (!source || !content || !scenes || !playback) {
    playRef.current = null
    const refused = unreadReason(source, content)
    return {...readoutBindings(reading.readouts), play: {refused}, stop: {refused}}
  }
  const current = scenes.scenes.find(row => row.scene_ref === content.basis.scene_ref)
  const ready = !!source.actions && !content.standing.pending && !busy                                          // :88
  const model = sceneTransportModel({
    ready, focused: sceneFocused(content.native_selection, content.basis.scene_ref),
    scene: {scene_ref: content.basis.scene_ref, available: !!current?.material.available,
      reason: current ? current.material.reason : 'This Scene is not in the native inventory.', duration: current?.working?.duration ?? null},
    rows: scenes.scenes.map(row => ({scene_ref: row.scene_ref, available: row.material.available})),
    playback, savedAvailable: scenes.timing.saved.available, loop: scenes.loop,
  })

  // One request per gesture. A reply is adopted only while its captured presentation is still current (:97-112).
  const run = async (slot: TransportSlotId, request: (actions: Actions) => Promise<NativeEditorReply>,
    accept: (captured: NativeCompositionViewSource, reply: NativeEditorReply) => boolean) => {
    if (!source.isPresented() || !source.actions) return
    const captured = source, actions = source.actions, epoch = lifetime.current.epoch
    const live = () => lifetime.current.mounted && epoch === lifetime.current.epoch
    draftRef.current = null; setDraft(null)
    setBusy(true); setFault(null)
    try {
      const reply = await request(actions)
      if (live() && accept(captured, reply)) setFault(reply.ok ? null : {slot, text: reply.error})
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : String(cause)
      if (live() && accept(captured, {ok: false, error})) setFault({slot, text: error})
    } finally {if (live()) setBusy(false)}
  }
  const settle = (slot: TransportSlotId, action: NativeSceneAction) => run(slot, actions => actions.scene(action),
    (captured, reply) => { const now = latest.current; return !!now && currentNativeSceneReply(captured, now, reply, action) })
  const toggleLoop = () => {if (!model.loop.reason) void run('loop', actions => actions.setSceneLoop(!model.loop.on),
    (captured, reply) => { const now = latest.current; return !!now && currentCompositionReply(captured, now, reply) })}             // :115-116

  const duration = model.scrub.duration
  const shown = duration === null ? playback.scene_elapsed_seconds : clampSeek(draft ?? playback.scene_elapsed_seconds, duration) // :123-124
  // One released gesture is one seek. An unmoved press sends nothing (:125-131).
  const commit = () => {
    const value = draftRef.current; draftRef.current = null; setDraft(null)
    if (value === null || duration === null || model.scrub.block) return
    const request = scrubRequest(value, playback.scene_elapsed_seconds, content.basis.scene_ref, duration)
    if (request) void settle('position', request)
  }
  // Property take: start is refused for this Scene, stop is allowed from anywhere the frame stands. One request per gesture (:132-144).
  const recording = link.state?.propertyRecording === true
  const chosenCount = editorReading?.chosenControls.entries.length ?? null
  const toggleTake = (slot: TransportSlotId) => {
    const stage: FrameStageRun | null = link.run
    if (!stage || takeBusy || !lifetime.current.mounted) return
    const command = recording ? takeStop : takeStart(takeMode)
    setTakeBusy(true); setTakeFault(null)
    let answer: ReturnType<FrameStageRun>
    try {answer = stage(command)} catch (cause) {setTakeBusy(false); setTakeFault({slot, text: cause instanceof Error ? cause.message : String(cause)}); return}
    void answer.then(result => {if (!result.ok) setTakeFault({slot, text: result.error})}, cause => setTakeFault({slot, text: cause instanceof Error ? cause.message : String(cause)}))
      .finally(() => {if (lifetime.current.mounted) setTakeBusy(false)})
  }
  // Play and Stop route through the arm state. Armed Play starts a take (the frame plays the Scene while it records); Stop finishes it (:145-156).
  const startReason = frameTakeReason({link, busy: takeBusy || !ready, sceneRef: content.basis.scene_ref, want: 'start', chosen: chosenCount})
  const playRoute = barPlayRoute({armed, recording, startReason})
  const pressPlay = () => {
    if (playRoute.route === 'take-start') {setTakeFault(null); toggleTake('play'); return}
    if (armed && playRoute.blockedReason) setTakeFault({slot: 'play', text: `Playing without a take: ${playRoute.blockedReason}`})
    void settle('play', {action: model.play.action})
  }
  const pressStop = () => {
    if (recording) {toggleTake('stop'); return}
    if (model.stop.request) void settle('stop', model.stop.request)
  }
  playRef.current = model.play.disabled || recording ? null : pressPlay                                         // :157
  const resume = barResume(link.state)
  const resumeAutomation = () => {                                                                              // :158-164
    const stage: FrameStageRun | null = link.run
    if (!stage || takeBusy) return
    setTakeFault(null)
    void stage(STAGE_AUTOMATION_RESUME).then(result => {if (!result.ok && lifetime.current.mounted) setTakeFault({slot: 're-enable', text: result.error})}, cause => {if (lifetime.current.mounted) setTakeFault({slot: 're-enable', text: cause instanceof Error ? cause.message : String(cause)})})
  }
  const said = (slot: TransportSlotId) => [fault, takeFault].map(line => line?.slot === slot ? line : null)

  const playTitle = recording ? 'A take is recording. Press Stop to finish it.' : armed ? `${model.play.reason ?? model.play.label}: armed, so Play starts a take` : model.play.reason ?? model.play.label // :170
  const stopDisabled = recording ? takeBusy : model.stop.disabled
  const nextMode = STAGE_TAKE_MODES[(STAGE_TAKE_MODES.indexOf(takeMode) + 1) % STAGE_TAKE_MODES.length]
  const light = barEngineLight(link.state, playback)

  return {
    ...readoutBindings(reading.readouts),
    ...(ratio && hold ? {signature: {readout: {value: ratio, title: `${hold.label} — the scene's ratio of hold to change: the field holds ${Math.round((holdShare ?? 0) * 100)} % of each morph cycle (${hold.automated && hold.effective !== undefined ? 'the engine\'s effective value, automated' : 'the authored value'}).`}}} : {}),
    // Tempo: the field's time scale, the one numeric control the old bar kept in the bar (:176).
    ...(timeScale && timeScaleSession ? {tempo: {
      control: <BarValue parameter={timeScale} session={timeScaleSession} disabled={!ready} reason={ready ? null : 'The native editor is busy or not attached.'} />,
      title: `Tempo — the field's time scale (${timeScale.label}): drag the name, type a value, or use the arrow keys.`}} : {}),
    // Position: the Scene's scrub and its time (:213-222); the Expression time across the saved sequence rides in the title (:223-224).
    position: {title: noted(`Scene time — position within the working Scene. Expression time across the saved sequence: ${playback.expression_time_seconds.toFixed(2)} s.`, ...said('position')),
      control: <>
        <input type="range" className="native-transport-scrub" aria-label="Scene position"
          aria-valuetext={duration === null ? 'No working duration' : `${shown.toFixed(2)} of ${duration.toFixed(2)} seconds of Scene time`}
          min={0} max={duration ?? 0} step={0.01} value={shown} disabled={model.scrub.block !== null}
          title={model.scrub.block ?? 'Drag, or use arrow keys (Shift for 1 s, Home and End for the ends). Release seeks the working Scene and pauses it.'}
          onChange={event => {const next = clampSeek(Number(event.target.value), duration ?? 0); draftRef.current = next; setDraft(next)}}
          onPointerUp={commit} onBlur={commit}
          onKeyDown={event => {if (duration === null) return; const next = scrubStep(draftRef.current ?? shown, duration, event.key, event.shiftKey); if (next === null) return; event.preventDefault(); draftRef.current = next; setDraft(next)}}
          onKeyUp={() => {if (draftRef.current !== null) commit()}} />
        <output className="position-field" aria-label="Scene time" title="Scene time: position within the working Scene">{shown.toFixed(2)} / {duration === null ? '—' : duration.toFixed(2)} s</output>
      </>},
    // Play and Stop (:169-174): lit by the owner's playback reading (aria-pressed was `scene_playing`).
    play: {press: model.play.disabled || recording ? undefined : pressPlay, lit: playback.scene_playing,
      ...(recording ? {refused: 'A take is recording. Press Stop to finish it.'} : model.play.disabled ? {refused: model.play.reason ?? model.play.label} : {}),
      title: noted(playTitle, ...said('play'))},
    stop: {press: stopDisabled ? undefined : pressStop,
      ...(!recording && model.stop.disabled ? {refused: model.stop.reason ?? 'Nothing to stop.'} : {}),
      title: noted(recording ? 'Stop the property take and keep its keyframes' : model.stop.reason ?? 'Stop: rewind the working Scene to its start and pause', ...said('stop'))},
    // Record is never an immediate-record button: it enables only while a take records, to stop it (:181-183). Lit by the frame's take reading.
    record: {press: recording && !takeBusy ? () => toggleTake('record') : undefined, ...(link.state ? {lit: recording} : {}),
      title: noted(recording ? 'Stop the property take and keep its keyframes' : 'A take records while armed Play runs. Arm automation, then press Play.', ...said('record'))},
    // Overdub: the take mode the next take starts in (:195-198) — Replace last take or Next section. Lit when it layers on (Next section).
    overdub: {press: recording || takeBusy ? undefined : () => setTakeMode(nextMode), lit: takeMode === 'append',
      title: recording ? 'Finish the take to change its mode' : `Take mode: ${TAKE_MODE_LABELS[takeMode]}. Press for ${TAKE_MODE_LABELS[nextMode]}.`},
    // Arm: shell presentation that decides what Play does (:178-180).
    arm: {press: () => setArmed(value => !value), lit: armed,
      title: armed ? 'Armed: Play records a take of the chosen properties; Stop keeps it. Click to disarm.' : 'Arm automation recording: then Play records a take of the chosen properties.'},
    // Re-enable: the orange return, live only while the frame reports parameters held off their automation (:184-185).
    're-enable': {press: resume.visible && link.run ? resumeAutomation : undefined, ...(link.state ? {lit: resume.visible} : {}),
      title: noted(resume.visible ? `Re-enable automation: ${resume.count} parameter${resume.count === 1 ? ' is' : 's are'} held at a manual value` : 'Re-enable automation: nothing is held off its automation.', ...said('re-enable'))},
    // Loop: the saved Scene sequence returns to its first Scene (:209-210). Lit by the reading's Journey loop flag.
    loop: {press: model.loop.reason ? undefined : toggleLoop, lit: model.loop.on, ...(model.loop.reason ? {refused: model.loop.reason} : {}),
      title: noted('Loop the saved Scene sequence back to its first Scene at the end', ...said('loop'))},
    // Draw: the stage tool rail (the old bar's "Draw-mode slot", NativeBarControls.tsx:77) with the pointer group beside it while Interact is active (:187, :189).
    draw: {title: 'Draw — the stage tool rail: select, interact, pin, text, formation. Each is one command to the Expressions frame.',
      control: <><BarTools state={link.state} run={link.run} /><BarPointerGroup reading={editorReading} state={link.state} apply={barApply} disabled={!ready} /></>},
    // Map: Pin mode (the old bar's "Map slot", NativePinControls.tsx:9) (:188).
    'key-map': {title: 'Map — pin mode: every parameter shows a pin; pin it to the Scene\'s pinned controls (its Clip side) or the rack.', control: <PinModeToggle />},
    // The engine light, read-only (the old bar's "CPU-light slot", NativeBarControls.tsx:123) (:190).
    cpu: {title: light.title, control: <BarEngineLight state={link.state} playback={playback} />},
  }
}
