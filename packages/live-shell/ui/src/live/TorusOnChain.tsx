// The torus at the head of Live's chain, through the device runtime (FOUNDATION F5): compact here, whole in the pool, full
// in a pane — one device, its live settings the same in all three, and its picture drawn at each size (manual §10.4: a small
// live picture on the rack, the device at full size in a pane). The picture is the torus's outline, tinted by the owner's
// standing; the oscillation itself is only ever the simulation's own render on the stage (lock §0.2.2), never redrawn here.
// Its own Full is the torus at the pane's size with the Jankó keyboard under it (manual §16.15 Full; DLW §21.2 Full): the pane is
// the instrument you play.
//
// The plate is the catalogue's design of the Torus (inhabitants/catalogue/panels/torus.tsx, `quaternal-logic:torus`), drawn on the
// owner's readings and writes (torusDevice.ts torusDesignBinding), published with the device so the pool, a pane and the rail draw it
// too. The design draws the manual's four macros on the compact (Rate, Fundamental, Carrier, Damping: DLW §21.2, O-I 850) and every
// parameter on the whole, in the manual's groups: the owner's four determinants in Mode and tuning, its See and hear (sound, cadence,
// scale, level) in Notes and output; what the owner does not announce stands absent with its reason. The chain frames for the MIDI map
// what its compact draws, by each control's id (lead, 16 Oct: an established behaviour is never removed for an adjacent one): the
// chain's wrap reaches a design's kit controls by their value keys (DeviceView.tsx useHosting → deviceHost.tsx → sdk/panel.tsx
// ControlWrapContext) as it reaches the generic plate's rows (torusMapWrap); a place that wraps the whole frames the determinants and
// its See and hear by the ids the instrument section uses (midiMap/midiMapTargets.ts), so a mapping made by id still holds.
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react'
import type {SdkParamRow} from '../inhabitants/sdk/define'
import {DeviceView} from '../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../frame/devices/devicePane'
import {openInstrument} from '../frame/instrumentDoor'
import {followSetTempoOnTorus, torusTempoEdit, TORUS_DESIGN_ID, TORUS_HEAD_ACTS, TORUS_DEVICE, TORUS_DEVICE_ID, torusBodyEdits, torusBodySourceOf, torusDesignBinding, torusDevice, torusFigure, torusTone, torusSessionOf,
  torusFollowed, torusFollowEdits, torusFollowMoved, torusLaneStanding, torusViewOf, TORUS_FOLLOW, type TorusFigureSize, type TorusFollow, type TorusView} from './torusDevice'
import {liveClipActs, type ClipLaneStanding} from './clipPlayer'
import {refusalWords} from '../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {commitLiveInstrumentEdit, LIVE_TORUS_ABSENT_REASON, liveInstrumentWritable, subscribeAcceptedLiveWrites, useLiveTorusReading, type LiveTorusState} from './torusInstrument'
import {JankoDevice} from './janko/JankoDevice'
import {useKeyboardLayout} from './keyboardLayout'
import {MidiMapTarget} from './midiMap/midiMapControls'
import {skyHeldTorusKeys, skyTargets, useSkyModulationPlan} from './designBindings/skyModulation'
import {useHostedChrome} from '../projections/expressionsPaneHost'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {useQlRack} from '../inhabitants/ql/devices/qlRack'
import {useHolds} from '../techne/devices/designDevices'
import {useBodyTable, useCoordinateName} from '../inhabitants/ql/devices/qlCoordinateName'
import {useLiveModeInForce} from '../native/liveModeCatalogue'
import {clipAtOf, useLiveClipWhole} from './liveWrites'
import type {SetSelection} from '../shell/liveSelection'

// Colour is the tokens' alone: the near side takes the instrument's accent when it is at work, the far side is fainter.
const STROKE = {lit: 'var(--accent)', rising: 'var(--text-dim)', unlit: 'var(--text-faint)'} as const

/** The device's picture at a size: the torus outline, with the owner's standing under it where there is room to read it. A
 * refused reading draws the outline unlit and says the refusal in the owner's words. The View you keep (manual §21.2) draws it: the
 * surface's body over its far side, the wire alone, or the wire over the body. */
export function TorusPicture({state, size = 'compact', view = 'surface'}: {state: LiveTorusState; size?: TorusFigureSize; view?: TorusView}) {
  const figure = useMemo(() => torusFigure(size), [size])
  const tone = torusTone(state)
  const standing = state.ok ? state.value.standing : 'refused'
  const {x, y, width, height} = figure.view
  // The surface: its silhouette filled, faint, edged in the standing's tone. Under Surface it lies over the far side; under Both, under it.
  const body = view === 'wire' ? null : <path d={figure.outline} data-torus-body="" style={{fill: STROKE[tone], fillOpacity: tone === 'lit' ? 0.16 : 0.1,
    stroke: STROKE[tone], strokeOpacity: 0.5}} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
  return <div className="torus-picture" data-live-torus={standing} data-torus-size={size} style={{width: '100%', height: '100%'}}>
    <svg role="img" aria-label={`M1 torus, ${standing}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
      style={{flex: '1 1 auto', minHeight: 0, width: '100%'}} fill="none" strokeLinecap="round" data-torus-tone={tone} data-torus-view={view}>
      {view === 'both' && body}
      <path d={figure.back} data-torus-side="far" style={{stroke: STROKE[tone], strokeOpacity: tone === 'lit' ? 0.3 : 0.18}} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      {view === 'surface' && body}
      <path d={figure.front} data-torus-side="near" style={{stroke: STROKE[tone]}} strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
    {state.ok
      ? size !== 'compact' && <small>{state.value.standing} · {state.value.identity.event_ref}</small>
      : <span role="alert" title={state.fault} style={{maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>Refused reading: {state.fault}</span>}
  </div>
}

/** The torus's own Full: the outline at the pane's size, tinted by the owner's standing, and under it the keyboard — the same
 * keyboard as the chain's (its layout held in the shell, keyboardLayout.ts), deaf to MIDI, which the chain's plate hears. A key
 * strikes the torus through the one input path; where on the ring it lands is the kernel's derivation (packet K), not drawn here. */
export function TorusFull() {
  const state = useLiveTorusReading()
  const layout = useKeyboardLayout()
  // The pane draws the View you keep on the device (manual §21.2 View: "What the pane draws").
  const view = torusViewOf(useHolds()[TORUS_DESIGN_ID])
  return <div className="torus-full" data-torus-full={state === null ? 'absent' : state.ok ? state.value.standing : 'refused'}>
    <div className="torus-full-ring">
      {state === null ? <p className="torus-full-absent">{LIVE_TORUS_ABSENT_REASON}</p> : <TorusPicture state={state} size="full" view={view} />}
    </div>
    <div className="torus-full-keys"><JankoDevice plate layout={layout} midi={false} /></div>
  </div>
}

/** A row's map target: the owner's scale is mapped as its units per metre (midiMap/midiMapTargets.ts `scale-units`). */
const mapId = (key: string) => (key === 'scale' ? 'scale-units' : key)

/** The chain's wrap of a torus control, by its row: the control inside its MIDI-map target. The generic plate wraps its rows with it,
 * and the design's kit controls are wrapped with it by their value keys. */
export const torusMapWrap = (row: SdkParamRow, control: ReactNode): ReactNode => <MidiMapTarget id={mapId(row.key)}>{control}</MidiMapTarget>

/** The take's lanes as the clip players publish them (O-I ticket 853): every player of the set's, a row's among them (O-I ticket 849, round 21). */
const laneReading = (): ClipLaneStanding => liveClipActs.lanes()
const NOT_REENABLED = 'The value did not go back to the take\'s lanes.'

/** The binding the chain draws the Torus on: the owner's readings, the Sky's held keys, the stage the frame announced and M1′'s rack
 * (qlRack.ts, its Rack page). The stage is
 * read from the hosted chrome as a dependency of the binding, so a stage disclosure redraws the Stage page when it comes, not with the
 * torus's next change (torusDevice.ts torusStageValues). */
export function useTorusChainBinding(state: LiveTorusState | null, device: DeviceInstance, follow: TorusFollow | null = null) {
  const plan = useSkyModulationPlan()
  const chrome = useHostedChrome()
  const stage = chrome?.state?.instrumentStage ?? null
  const run = chrome?.run ?? null
  const rack = useQlRack(1)
  // The procedure and budget the Stage page holds (techne/devices/designDevices.ts holds): a new choice redraws the binding.
  const held = useHolds()[TORUS_DESIGN_ID]
  // The live scene's M2 condition the frame announces, and the map's name for its tattva (qlCoordinateName.ts).
  const condition = chrome?.state?.instrumentCondition ?? null
  const tattvaName = useCoordinateName(condition?.tattva_ref ?? null)
  // M2's body constants (QL's table): the Body group reads their standing and what the fibre would set.
  const table = useBodyTable()
  // Under Tattva the body follows the tattva (manual §21.2): when the condition's fibre moves, or a determinant moves the voices the Q is
  // lowered on, its Damping and Strike are written again (the stage channel's damping, the owner's torus edit), once per target.
  const followed = useRef('')
  useEffect(() => {
    const session = torusSessionOf(state)
    const edits = liveInstrumentWritable(state) ? torusBodyEdits(condition, table, torusBodySourceOf(held ?? {}), session) : []
    if (!edits.length) { followed.current = ''; return }
    const target = JSON.stringify([edits, state?.ok ? state.determinants : null])
    if (target === followed.current) return
    followed.current = target
    const strikeHeld = typeof session?.settings.strike === 'number' && edits.every(edit => edit.kind !== 'torus' || edit.edit.strike === session.settings.strike)
    void (async () => {
      for (const edit of edits) {
        // The owner already holds the element's Strike: a session edit that moves nothing is not sent again.
        if (edit.kind === 'torus' && strikeHeld) continue
        const result = await commitLiveInstrumentEdit(edit)
        if (!result.ok) { followed.current = ''; return }
      }
    })().catch(() => { followed.current = '' })
  }, [state, condition, table, held])
  // Under Follow (manual §21.2 Lens and mode) the owner's lens and frame are kept on the clip's mode, or the set's: the owner's own lens
  // and context-frame edits, once per mode followed, so a refused one is not sent again until the mode or the clip moves, and an owner
  // that moves under a hand is not moved back. A Lens or Frame moved by hand or by a mapped control turns Follow off (torusFollowMoved,
  // DLW build ruling 2026-11-05); Follow's own edits go without the hand, so they do not.
  useEffect(() => subscribeAcceptedLiveWrites(torusFollowMoved), [])
  const followedMode = useRef('')
  useEffect(() => {
    const on = (held ?? {})[TORUS_FOLLOW] !== false
    const target = on && follow?.from ? JSON.stringify([follow.lens12, follow.context_frame]) : ''
    if (!target) { followedMode.current = ''; return }
    if (target === followedMode.current || !liveInstrumentWritable(state)) return
    followedMode.current = target
    const edits = torusFollowEdits(state, follow)
    void (async () => {
      for (const edit of edits) if (!(await commitLiveInstrumentEdit(edit)).ok) return
    })().catch(() => { /* named on the owner's reading */ })
  }, [state, follow, held])
  // A take's lanes on the face (O-I ticket 853; DLW build ruling 2026-11-05): what a playing take writes stands Automated, what you moved off
  // its lane Overridden with Re-enable on the control. A Re-enable the owner refused stands on that control until the lanes next change.
  const lanes = useSyncExternalStore(liveClipActs.subscribe, laneReading, laneReading)
  const [laneRefused, setLaneRefused] = useState<{lanes: ClipLaneStanding; words: Record<string, string>} | null>(null)
  const reenable = useCallback((id: string) => {
    const refuse = (words: string) => setLaneRefused({lanes: laneReading(), words: {[id]: words}})
    liveClipActs.reenable(id).then(answer => { if (!answer.ok) refuse(refusalWords(NOT_REENABLED, answer.error)) },
      (cause: unknown) => refuse(refusalWords(NOT_REENABLED, cause)))
  }, [])
  const laneStanding = useMemo(() => torusLaneStanding(lanes, reenable, laneRefused?.lanes === lanes ? laneRefused.words : undefined), [lanes, reenable, laneRefused])
  return useMemo(() => torusDesignBinding(state, device, skyHeldTorusKeys(plan, skyTargets(state)), stage, rack, run, held ?? {}, condition, tattvaName, table,
    undefined, undefined, follow, laneStanding),
    [state, device, plan, stage, rack, run, held, condition, tattvaName, table, follow, laneStanding])
}

/** The torus on the chain. `tempoBpm` is the set's tempo (the transport's reading): the owner's session is kept on it, so a tempo
 * change moves the pulse under Sync (DLW §21.2 Rate), as the Delay's is kept on it (designBindings/TorusEffectsOnChain.tsx).
 * `selection` names the clip you select, which the Torus plays (§21.2 Views: "In Clip view, the Torus plays the notes of the clip that
 * you select"), in the set at `setPath`: Follow reads its own mode from the set's owner, and the set's mode in force when it has none. */
export function TorusOnChain({state, tempoBpm = null, selection = null, setPath = null}: {state: LiveTorusState; tempoBpm?: number | null;
  selection?: SetSelection | null; setPath?: string | null}) {
  const device = useMemo(() => torusDevice(state), [state])
  const at = selection ? clipAtOf(selection) : null
  const clip = useLiveClipWhole(at ? setPath : null, at && selection ? selection.track : null, at).clip
  const {mode} = useLiveModeInForce()
  const follow = useMemo(() => torusFollowed(clip, mode), [clip, mode])
  const binding = useTorusChainBinding(state, device, follow)
  const view = torusViewOf(useHolds()[TORUS_DESIGN_ID])
  // Once per tempo: a refused one is not sent again until the set's tempo or the owner's moves (the owner's refusal stands on its
  // reading), and an accepted one reads back equal, so nothing more is sent.
  const followedTempo = useRef<number | null>(null)
  useEffect(() => {
    const edit = torusTempoEdit(state, tempoBpm)
    if (!edit) { followedTempo.current = null; return }
    if (edit.edit.tempo_bpm === followedTempo.current) return
    followedTempo.current = edit.edit.tempo_bpm ?? null
    followSetTempoOnTorus(state, tempoBpm).catch(() => { /* named on the owner's reading */ })
  }, [state, tempoBpm])
  useEffect(() => {
    publishDevice(TORUS_DEVICE_ID, {device, binding, picture: size => <TorusPicture state={state} size={size} view={view} />, acts: TORUS_HEAD_ACTS, full: {draw: () => <TorusFull />}})
  }, [device, binding, state, view])
  useEffect(() => () => publishDevice(TORUS_DEVICE_ID, null), [])
  return <div className="chain-side" data-chain-instrument={TORUS_DEVICE_ID} data-live-torus={state.ok ? state.value.standing : 'refused'}>
    <DeviceView device={device} binding={binding} size="compact" picture={<TorusPicture state={state} size="compact" view={view} />} actions={[
      {icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(TORUS_DEVICE_ID)},
      {icon: 'pane', label: 'Open the torus full size in a pane', onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: TORUS_DEVICE_ID, title: TORUS_DEVICE.title})},
    ]} wrapRow={torusMapWrap} />
  </div>
}
