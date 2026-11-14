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
import {useContext, useEffect, useMemo, useRef, useState} from 'react'
import type {NativeEditorReply} from '../../../../../expressions-boundary/src/editor'
import type {ModeSet, ModeSetAct, ModeSetClip, ModeSetTrack} from '../../../../../../desktop/cradle/src/kernel/types'
import {noteSolo, syncSoloSilenced} from '../../native/frameSound'
import {BarEngineLight, BarPointerGroup, BarTools, BarValue, type BarApply} from '../../components/NativeBarControls'
import {barEngineLight, barParameter, tempoParameter, tempoSession} from '../../components/nativeBarModel'
import {createLiveSession, type LiveSessionDeps} from '../../components/nativeBarSession'
import {EXPRESSIONS_FOLLOW_WHY, RESONANCE_SLOT_PATHS, plateDriveOf, resonanceParameter, resonanceRefusal, resonanceTitle} from '../../components/resonanceTransport'
import {PinModeToggle} from '../../components/NativePinControls'
import {clampSeek, loopTitle, pulseSlot, quantizeSlot, scrubRequest, scrubStep, sceneFocused, sceneTransportModel, spaceTogglesPlayback} from '../../components/nativeScenePlayback'
import {expressionsSettingChange, expressionsSettingRead} from '../../components/devices/expressionsDevice'
import type {TransportBindings, TransportSlotId} from '../../frame/transport/slots'
import {useHostedChrome} from '../../projections/expressionsPaneHost'
import {Workspace} from '../workspaceContext'
import {useModeSet, type ModeSetReading} from '../../owners/modeSets'
import {runAct, setActRunner} from '../../frame/tracks/kernelSet'
import {useStudioHost} from '../../components/devices/ExpressionsDeviceView'
import {readPast} from '../../components/devices/fieldDeviceSend'
import {useSceneKeepers} from '../../components/expressions/clip/sceneKeepers'
import {currentCompositionReply, currentNativeSceneReply, type NativeCompositionViewSource} from '../compositionViews'
import type {NativeContentActions, NativeSceneAction} from '../nativeContent'
import type {ModeTransportReadouts} from './spineControls'
import type {TransportReading} from '../modeTransports'
import {holdRatio} from './transportReadings'
import '../../components/NativeTransportBar.css'

type Actions = NonNullable<NativeContentActions>
/** A key-row session's deps before its parameter is read: it sends nothing. */
const IDLE_LIVE: LiveSessionDeps = {run: null, apply: async () => false, automated: false}
/** The key row with no reading of the plate (round 895, OPEN 8). */
const UNTUNED = {none: 'No Expression is open here: open one to tune its plate.', unread: 'The open Expression has not been read yet: its plate tunes once its owner answers.',
  editor: 'The native editor is not attached, so the plate cannot be read or tuned here.'} as const

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

/** Why the field cannot be shown playing yet: the first reading of the frame the transport lacks, in the person's words. Pure. */
export function frameUnreadReason(source: NativeCompositionViewSource | null, content: NativeCompositionViewSource['content'] | null | undefined): string {
  if (!source) return 'No Expression is open here. Open one in the browser to play its scenes.'
  if (!content) return 'The open Expression has not been read yet. Its scenes play once its owner answers.'
  if (!content.scenes) return 'The Expression\'s owner has not disclosed its scenes, so there is nothing to play yet.'
  return 'The Expression\'s owner has not disclosed its playback, so Play cannot start or show where it is.'
}

/** The presented work as the kernel's Set gives it (O-I ticket 1008): its track, the clip of the Scene the field shows, the clip that plays or
 * records, and whether it is armed. What plays, records and is armed is the kernel's; the transport reads it here. Pure. */
export interface ExpressionsSetWork {
  readonly track: ModeSetTrack | null
  readonly clip: ModeSetClip | null
  readonly playing: ModeSetClip | null
  readonly recording: boolean
  readonly armed: boolean
}
export function expressionsSetWork(set: ModeSet | null, expressionRef: string | null, sceneRef: string | null): ExpressionsSetWork {
  const track = set && expressionRef ? set.tracks.find(row => row.id === expressionRef) ?? null : null
  const clips = set && track ? set.clips.filter(row => row.track === track.id) : []
  const playing = clips.find(row => row.status === 'running' || row.status === 'recording') ?? null
  return {track, clip: clips.find(row => row.id === sceneRef) ?? null, playing, recording: playing?.status === 'recording', armed: track?.mix?.arm === true}
}

/** Why the scenes cannot play: the kernel's Set of Expressions, read or not, its sources and why it holds no track of the open work; null
 * when it holds the work. Pure. */
export function unreadReason(set: ModeSetReading, expressionRef: string | null, work: ExpressionsSetWork): string | null {
  if (!expressionRef) return 'No Expression is open here. Open one in the browser to play its scenes.'
  if (set.state === 'reading') return 'The kernel has not given Expressions\' Set yet. Its scenes play once it answers.'
  if (set.state === 'unavailable') return `Expressions' Set is not read, so nothing plays from here: ${set.reason}`
  if (work.track) return null
  const failed = set.answer.set.sources.find(source => source.error)
  if (failed) return `Expressions' Set does not hold this Expression: its ${failed.slice} slice says ${failed.error}`
  return set.answer.set.absent ?? 'Expressions\' Set does not hold this Expression yet: it plays once the kernel lists it among the works.'
}

/** Overdub, as the kernel keeps takes (O-I ticket 1008): every take records on a lane of its own, so there is no mode to choose. */
export const OVERDUB_REFUSED = 'Takes are lanes: each take records on a lane of its own under its Scene, and keeping one is a comp. Keep it on its take lane in Arrangement view.'

export const useExpressionsTransport = (reading: ExpressionsTransportReading): TransportBindings => {
  const source = reading.nativeTransport ?? null
  const latest = useRef(source); latest.current = source
  const lifetime = useRef({mounted: false, epoch: 0})
  useEffect(() => {const own = ++lifetime.current.epoch; lifetime.current.mounted = true; return () => {if (lifetime.current.epoch === own) {lifetime.current.mounted = false; lifetime.current.epoch++}}}, []) // :29
  const [fault, setFault] = useState<Said | null>(null), [busy, setBusy] = useState(false)                       // :30
  // The scrub draft is local presentation until release; it never reaches the owner (:34-35).
  const [draft, setDraft] = useState<number | null>(null); const draftRef = useRef<number | null>(null)
  const identity = source?.content?.basis.scene_ref
  // The frame as the shell reaches it, its announced state and its stage runner: its readouts, its tools and the previews of a drag.
  const chrome = useHostedChrome()
  const link = {state: chrome?.state ?? null, run: chrome?.run ?? null}
  // What plays, records and is armed is the kernel's (O-I ticket 1008): the open work's track and clips in Expressions' Set, each press one
  // of their acts.
  const kernelTransport = useContext(Workspace)?.transport ?? null
  const setReading = useModeSet(kernelTransport, 'expressions')
  const runner = useMemo(() => kernelTransport ? setActRunner(kernelTransport) : undefined, [kernelTransport])
  const workRef = source?.content?.basis.expression_ref ?? null
  const work = expressionsSetWork(setReading.state === 'held' ? setReading.answer.set : null, workRef, identity ?? null)
  const setReason = unreadReason(setReading, workRef, work)
  // Bar controls: each reads the owner's reading and sends one admitted request. Nothing here keeps a value of its own (:39-41).
  const editorReading = source?.currentReading?.() ?? null
  const barApply: BarApply = changes => source?.actions ? source.actions.applyChanges(changes) : Promise.resolve({ok: false, error: 'The native editor is not attached.'})
  // Tempo, the Resonance's Freq, f0 and Modes and the Metronome's Pulse are the Studio's: each write one Action of its act (O-I ticket 1008),
  // answered once the field reads it, so a released value never draws the old one between the write and the field's reading.
  const studio = useStudioHost({reading: editorReading, apply: barApply})
  const readingNow = useRef(editorReading); readingNow.current = editorReading
  const studioApply: BarApply = changes => {
    const from = readingNow.current?.basis.revision ?? null
    return studio.apply(changes).then(async reply => {
      if (reply.ok && from !== null) await readPast(() => readingNow.current?.basis.revision ?? null, from)
      return reply
    })
  }
  const timeScale = editorReading ? barParameter(editorReading, 'fluid.timeScale') : null                       // :42
  // The scene's ratio of hold to change (signature): the field's morph hold share, the dwell readNativeGlyphTiming reads for a
  // morph clock (shell/nativeContent.ts) — the engine's effective value while automated, else the authored base.
  const hold = editorReading ? barParameter(editorReading, 'toroidalMorph.holdRatio') : null
  const holdShare = hold ? hold.effective ?? hold.base : null
  const ratio = holdRatio(holdShare)
  // The session is one object per parameter, reading the latest runner and automation state at each call, so a re-render never strands a drag (:43-46).
  const liveDeps = useRef<{run: typeof link.run; apply: (value: number) => Promise<boolean>; automated: boolean}>({run: null, apply: async () => false, automated: false})
  liveDeps.current = {run: link.run, automated: timeScale?.automated ?? false,
    apply: value => timeScale ? studioApply([{kind: 'parameter', target: timeScale.target, value}]).then(answer => answer.ok, () => false) : Promise.resolve(false)}
  // Effective values come from engine telemetry and arrive only when the owner is read: while a lane runs or a take records, at about 4 Hz,
  // never while the page is hidden and never over a pending edit (:47-59).
  const pollLatest = useRef(source); pollLatest.current = source
  const polling = !!editorReading && !editorReading.standing.pending && (editorReading.scene.automation.some(lane => lane.enabled) || work.recording)
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
  const tempo = timeScale ? tempoParameter(timeScale) : null
  // The Metronome is the open scene's Pulse (§10.5 "Pulse the field"; the Field's Pulse, §20.2): the scene's composition, as its owner reads it.
  const pulseRead = editorReading ? expressionsSettingRead('field', 'pulse', editorReading.scene) : undefined
  const pulseOn = typeof pulseRead === 'boolean' ? pulseRead : undefined
  const tempoDrive = useMemo(() => timeScaleSession ? tempoSession(timeScaleSession) : null, [timeScaleSession])
  // ☿ Resonance, Root and Scale (§10.5 "Key, root and scale | … | Tune the field's resonance"; round 895, OPEN 8): the Resonance's Freq, f0
  // and Modes (components/resonanceTransport.ts), each one owner request on the captured basis, driven as Tempo is, and clamped to the manual's
  // range as Tempo is (round 896, 0R-surface.7: resonanceParameter).
  const resonance = (['key', 'root', 'scale'] as const).map(slot => {
    const read = editorReading ? barParameter(editorReading, RESONANCE_SLOT_PATHS[slot]) : null
    return {slot, parameter: read ? resonanceParameter(slot, read) : null}
  })
  const resonanceDeps = useRef<Record<string, LiveSessionDeps>>({})
  for (const {parameter} of resonance) if (parameter) resonanceDeps.current[parameter.target] = {run: link.run, automated: parameter.automated,
    apply: value => studioApply([{kind: 'parameter', target: parameter.target, value}]).then(answer => answer.ok, () => false)}
  const resonanceTargets = resonance.map(row => row.parameter?.target ?? '').join(' ')
  const resonanceSessions = useMemo(() => Object.fromEntries(resonanceTargets.split(' ').filter(Boolean)
    .map(target => [target, createLiveSession(target, () => resonanceDeps.current[target] ?? IDLE_LIVE)])), [resonanceTargets])
  // The tone is the Resonance's Driver's unless it is Manual; the plate's ringing tone as the engine reports it (fieldDesignBinding.ts).
  // Who sets the plate's tone now, from the scene's own values (a settings row reads its label, "Manual", not the value).
  const drive = editorReading ? plateDriveOf(editorReading.scene) : null
  const ringing = editorReading?.observation?.effectiveValues?.['cymatics.frequencyHz'] ?? editorReading?.observation?.effectiveValues?.['field.cymatics.frequencyHz']
  // A press of the kernel's transport waits for its act's answer; a refusal stands under the slot that asked.
  const [actBusy, setActBusy] = useState(false), [actFault, setActFault] = useState<Said | null>(null)
  // Solo (round 886): the presented Expression's own, as its scenes reading says it; its frame hears it silenced while another open
  // Expression is soloed and it is not, told once per change (native/frameSound.ts syncSoloSilenced).
  const soloRef = source?.content?.basis.expression_ref ?? null, soloMix = source?.content?.scenes?.mix
  const soloOn = soloMix ? soloMix.solo === true : null
  const soloPresented = link.state?.nativeScene?.expression_ref ?? null
  useEffect(() => {
    if (!soloRef || soloRef !== soloPresented) return
    if (soloOn !== null) noteSolo(soloRef, soloOn)
    void syncSoloSilenced(link).catch(() => {})
  }, [soloRef, soloOn, soloPresented, link.run])
  useEffect(() => {setFault(null); setActFault(null); draftRef.current = null; setDraft(null)}, [identity])       // :66
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
    const refused = frameUnreadReason(source, content), untuned = source ? UNTUNED.unread : UNTUNED.none
    return {...readoutBindings(reading.readouts), play: {refused}, stop: {refused}, capture: {refused},
      key: {refused: untuned}, root: {refused: untuned}, scale: {refused: untuned}, follow: {refused: EXPRESSIONS_FOLLOW_WHY}}
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
  // The kernel's transport (O-I ticket 1008): Play is the Scene's launch, Stop the Expression's stop, Arm its arm, Capture the Scene's capture
  // and Re-enable its hand-back, each one act of the Set. With Arm on, Play records a take of the Studio from where the Scene lands, and Stop
  // closes it and lays it on its Scene, on a take lane of its own.
  const press = (slot: TransportSlotId, act: ModeSetAct | undefined, value?: unknown) => {
    if (!act || actBusy) return
    const epoch = lifetime.current.epoch, live = () => lifetime.current.mounted && epoch === lifetime.current.epoch
    setActBusy(true); setActFault(null)
    void runAct(runner, act, value).then(receipt => {if (live() && !receipt.ok) setActFault({slot, text: receipt.error})})
      .finally(() => {if (live()) setActBusy(false)})
  }
  const recording = work.recording
  const launch = work.clip?.acts?.launch, stopAct = work.track?.acts?.stopTrack, armAct = work.track?.acts?.arm
  const captureAct = work.clip?.acts?.capture, reenableAct = work.track?.acts?.reenable
  const playReason = setReason ?? (recording ? 'A take is recording. Press Stop to finish it.' : launch ? null
    : work.clip?.note ?? 'This Scene does not launch: it holds no material of the field, or its Expression\'s Activator is off.')
  const pressPlay = () => press('play', launch)
  const captureBlocked = recording ? 'A take is recording. Press Stop to finish it.' : setReason ?? (captureAct ? null
    : !current ? 'This Scene is not in the native inventory.' : 'This Scene holds no material of the field to keep yet.')
  const pressCapture = () => press('capture', captureAct)
  // Stop: the kernel's, while the Expression plays or records; with nothing playing it rewinds the field's own view of the Scene.
  const pressStop = () => {
    if (stopAct) {press('stop', stopAct); return}
    if (model.stop.request) void settle('stop', model.stop.request)
  }
  // Space plays the Scene, and stops the Expression while it plays or records (:157).
  playRef.current = actBusy ? null : work.playing && stopAct ? () => press('stop', stopAct) : playReason === null ? pressPlay : null
  const held = work.track?.studio?.held?.length ?? 0
  const said = (slot: TransportSlotId) => [fault, actFault].map(line => line?.slot === slot ? line : null)

  const playTitle = playReason ?? (work.armed ? `Play ${current?.title ?? 'the Scene'}: armed, so it records a take of the Studio from where it lands` : `Play ${current?.title ?? 'the Scene'}: it lands on its Quantize`)
  const stopDisabled = stopAct ? actBusy : model.stop.disabled
  const light = barEngineLight(link.state, playback, recording)

  return {
    ...readoutBindings(reading.readouts),
    ...(ratio && hold ? {signature: {readout: {value: ratio, title: `${hold.label} — the scene's ratio of hold to change: the field holds ${Math.round((holdShare ?? 0) * 100)} % of each morph cycle (${hold.automated && hold.effective !== undefined ? 'the engine\'s effective value, automated' : 'the authored value'}).`}}} : {}),
    // Tempo: the field's time scale, the one numeric control the old bar kept in the bar (:176), read as Tempo since round 885 (DLW build
    // ruling 2026-11-06): 96 × time scale in beats a minute; setting it sets time scale = Tempo ÷ 96, clamped to 20–240 here.
    ...(tempo && tempoDrive ? {tempo: {
      control: <BarValue parameter={tempo} session={tempoDrive} disabled={!ready} reason={ready ? null : 'The native editor is busy or not attached.'} />,
      title: `Tempo — the field's speed in beats a minute: 96 × its time scale (now ×${(timeScale?.base ?? 0).toFixed(2)}). Drag the name, type a value from 20 to 240, or use the arrow keys.`}} : {}),
    // ☿ Resonance, Root and Scale: they tune the plate the Resonance drives (round 895, OPEN 8).
    ...Object.fromEntries(resonance.map(({slot, parameter}) => {
      const session = parameter ? resonanceSessions[parameter.target] : undefined
      if (!parameter || !session) return [slot, {refused: UNTUNED.editor}]
      const refusal = resonanceRefusal(slot, drive, ready)
      return [slot, {control: <BarValue parameter={parameter} session={session} disabled={refusal !== null} reason={refusal} />, title: noted(resonanceTitle(slot, refusal, ringing), ...said(slot))}]
    })),
    // Follow (§10.5 "Keep views with the scene"): no switch here, and why (components/resonanceTransport.ts).
    follow: {refused: EXPRESSIONS_FOLLOW_WHY},
    // Quantize (§10.5 "Set when scenes launch"; XS08): the Quantize the Expression keeps, chosen from Live's values, one scene edit of its
    // owner; the frame holds each launch for its boundary (sceneWorkflow.ts launchLandsAt).
    quantize: (() => {
      const slot = quantizeSlot({value: scenes.launch_quantize, reason: ready ? null : 'The native editor is busy or not attached.',
        send: value => void run('quantize', actions => actions.sceneEdit({operation: 'launch-quantize', quantize: value}),
          (captured, reply) => { const now = latest.current; return !!now && currentCompositionReply(captured, now, reply) })})
      return slot.title ? {...slot, title: noted(slot.title, ...said('quantize'))} : slot
    })(),
    // Metronome (§10.5 "Pulse the field"): the open scene's Pulse, one panel setting of its owner; the frame pulses the field on each beat
    // of its Tempo while the scene plays (sceneWorkflow.ts beatPulse).
    metro: (() => {
      const slot = pulseSlot({on: pulseOn, reason: ready ? null : 'The native editor is busy or not attached.', scene: current?.title,
        send: on => void run('metro', () => studioApply([expressionsSettingChange('field', 'pulse', on)]),
          (captured, reply) => { const now = latest.current; return !!now && currentCompositionReply(captured, now, reply) })})
      return slot.title ? {...slot, title: noted(slot.title, ...said('metro'))} : slot
    })(),
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
    // Play and Stop: the kernel's (O-I ticket 1008). Play is lit while the Expression plays or records in the kernel.
    play: {press: playReason === null && !actBusy ? pressPlay : undefined, lit: work.playing !== null,
      ...(playReason !== null ? {refused: playReason} : {}), title: noted(playTitle, ...said('play'))},
    stop: {press: stopDisabled ? undefined : pressStop,
      ...(!stopAct && model.stop.disabled ? {refused: model.stop.reason ?? 'Nothing to stop.'} : {}),
      title: noted(recording ? 'Stop the take: it closes, and lies on its Scene on a take lane of its own' : stopAct ? `Stop ${work.track?.name ?? 'the Expression'}` : model.stop.reason ?? 'Stop: rewind the working Scene to its start and pause', ...said('stop'))},
    capture: {press: captureBlocked || actBusy ? undefined : pressCapture, ...(captureBlocked ? {refused: captureBlocked} : {}),
      title: noted('Capture — keep your gestures as a scene: the scene keeps them as they stand, and the next scene starts from them', ...said('capture'))},
    // Record is never an immediate-record button: lit while the kernel records a take, and pressed it stops it (Arm, then Play, records).
    record: {press: recording && stopAct && !actBusy ? () => press('record', stopAct) : undefined, ...(setReason === null ? {lit: recording} : {}),
      title: noted(recording ? 'Stop the take: it closes, and lies on its Scene on a take lane of its own' : 'A take records while armed Play runs. Arm, then press Play.', ...said('record'))},
    // Overdub: every take lies on a lane of its own, so there is no take mode to choose.
    overdub: {refused: OVERDUB_REFUSED},
    // Arm: the Expression's arm in the kernel (expressions.arm): with Arm on, Play records a take of the Studio.
    arm: {press: armAct && !actBusy ? () => press('arm', armAct, !work.armed) : undefined, lit: work.armed, ...(armAct ? {} : {refused: setReason ?? 'This Expression cannot be armed here.'}),
      title: noted(work.armed ? 'Armed: Play records a take of the Studio; Stop closes it on its own take lane. Click to disarm.' : 'Arm: then Play records a take of the Studio.', ...said('arm'))},
    // Re-enable: the values the kernel holds off their automation by hand, given back to it (expressions.studio.reenable).
    're-enable': {press: reenableAct && !actBusy ? () => press('re-enable', reenableAct) : undefined, ...(setReason === null ? {lit: !!reenableAct} : {}),
      title: noted(reenableAct ? `Re-enable automation: ${held} value${held === 1 ? ' is' : 's are'} held at a manual value` : 'Re-enable automation: nothing is held off its automation.', ...said('re-enable'))},
    // Loop: the saved Scene sequence returns to its first Scene (:209-210). Lit by the reading's Journey loop flag.
    loop: {press: model.loop.reason ? undefined : toggleLoop, lit: model.loop.on, ...(model.loop.reason ? {refused: model.loop.reason} : {}),
      title: noted(loopTitle(content.scenes?.loop_region, model.loop.on), ...said('loop'))},
    // Draw: the stage tool rail (the old bar's "Draw-mode slot", NativeBarControls.tsx:77) with the pointer group beside it while Interact is active (:187, :189).
    draw: {title: 'Draw — the stage tool rail: select, interact, pin, text, formation. Each is one command to the Expressions frame.',
      control: <><BarTools state={link.state} run={link.run} /><BarPointerGroup reading={editorReading} state={link.state} apply={barApply} disabled={!ready} /></>},
    // Map: Pin mode (the old bar's "Map slot", NativePinControls.tsx:9) (:188).
    'key-map': {title: 'Map — pin mode: every parameter shows a pin; pin it to the Scene\'s pinned controls (its Clip side) or the rack.', control: <PinModeToggle />},
    // The engine light, read-only (the old bar's "CPU-light slot", NativeBarControls.tsx:123) (:190).
    cpu: {title: light.title, control: <BarEngineLight state={link.state} playback={playback} recording={recording} />},
  }
}
