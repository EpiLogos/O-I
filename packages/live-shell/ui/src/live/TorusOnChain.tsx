// The torus at the head of Live's chain, through the device runtime (FOUNDATION F5): compact here, whole in the pool, full
// in a pane — one device, its live settings the same in all three, and its picture drawn at each size (manual §10.4: a small
// live picture on the rack, the device at full size in a pane). The picture is the torus's outline, tinted by the owner's
// standing; the oscillation itself is only ever the simulation's own render on the stage (lock §0.2.2), never redrawn here.
// Its own Full is the torus at the pane's size with the Jankó keyboard under it (manual §16.15 Full; DLW §21.2 Full): the pane is
// the instrument you play.
//
// The plate is the catalogue's design of the Torus (inhabitants/catalogue/panels/torus.tsx, `quaternal-logic:torus`), drawn on the
// owner's readings and writes (torusDevice.ts torusDesignBinding), published with the device so the pool, a pane and the rail draw it
// too. The design draws the owner's four determinants (lens, context frame, harmonic basis, M3 transcription) on the compact and its
// See and hear (sound, cadence, scale, level, standing) on the whole; what the owner does not announce stands absent with its reason.
// Every control the chain framed for the MIDI map stays framed, by the same id (lead, 16 Oct: an established behaviour is never
// removed for an adjacent one): the chain's wrap reaches a design's kit controls by their value keys (DeviceView.tsx useHosting →
// deviceHost.tsx → sdk/panel.tsx ControlWrapContext) as it reaches the generic plate's rows (torusMapWrap); a place that wraps the
// whole frames its See and hear by the ids the instrument section uses (midiMap/midiMapTargets.ts).
import {useEffect, useMemo, type ReactNode} from 'react'
import type {SdkParamRow} from '../inhabitants/sdk/define'
import {DeviceView} from '../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../frame/devices/devicePane'
import {openInstrument} from '../frame/instrumentDoor'
import {TORUS_DEVICE, TORUS_DEVICE_ID, torusDesignBinding, torusDevice, torusFigure, torusTone, type TorusFigureSize} from './torusDevice'
import {LIVE_TORUS_ABSENT_REASON, useLiveTorusReading, type LiveTorusState} from './torusInstrument'
import {JankoDevice} from './janko/JankoDevice'
import {useKeyboardLayout} from './keyboardLayout'
import {MidiMapTarget} from './midiMap/midiMapControls'
import {skyHeldTorusKeys, useSkyModulationPlan} from './designBindings/skyModulation'
import {useHostedChrome} from '../projections/expressionsPaneHost'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {useQlRack} from '../inhabitants/ql/devices/qlRack'

// Colour is the tokens' alone: the near side takes the instrument's accent when it is at work, the far side is fainter.
const STROKE = {lit: 'var(--accent)', rising: 'var(--text-dim)', unlit: 'var(--text-faint)'} as const

/** The device's picture at a size: the torus outline, with the owner's standing under it where there is room to read it. A
 * refused reading draws the outline unlit and says the refusal in the owner's words. */
export function TorusPicture({state, size = 'compact'}: {state: LiveTorusState; size?: TorusFigureSize}) {
  const figure = useMemo(() => torusFigure(size), [size])
  const tone = torusTone(state)
  const standing = state.ok ? state.value.standing : 'refused'
  const {x, y, width, height} = figure.view
  return <div className="torus-picture" data-live-torus={standing} data-torus-size={size} style={{width: '100%', height: '100%'}}>
    <svg role="img" aria-label={`M1 torus, ${standing}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="xMidYMid meet"
      style={{flex: '1 1 auto', minHeight: 0, width: '100%'}} fill="none" strokeLinecap="round" data-torus-tone={tone}>
      <path d={figure.back} data-torus-side="far" style={{stroke: STROKE[tone], strokeOpacity: tone === 'lit' ? 0.3 : 0.18}} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
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
  return <div className="torus-full" data-torus-full={state === null ? 'absent' : state.ok ? state.value.standing : 'refused'}>
    <div className="torus-full-ring">
      {state === null ? <p className="torus-full-absent">{LIVE_TORUS_ABSENT_REASON}</p> : <TorusPicture state={state} size="full" />}
    </div>
    <div className="torus-full-keys"><JankoDevice plate layout={layout} midi={false} /></div>
  </div>
}

/** A row's map target: the owner's scale is mapped as its units per metre (midiMap/midiMapTargets.ts `scale-units`). */
const mapId = (key: string) => (key === 'scale' ? 'scale-units' : key)

/** The chain's wrap of a torus control, by its row: the control inside its MIDI-map target. The generic plate wraps its rows with it,
 * and the design's kit controls are wrapped with it by their value keys. */
export const torusMapWrap = (row: SdkParamRow, control: ReactNode): ReactNode => <MidiMapTarget id={mapId(row.key)}>{control}</MidiMapTarget>

/** The binding the chain draws the Torus on: the owner's readings, the Sky's held keys, the stage the frame announced and M1′'s rack
 * (qlRack.ts, its Rack page). The stage is
 * read from the hosted chrome as a dependency of the binding, so a stage disclosure redraws the Stage page when it comes, not with the
 * torus's next change (torusDevice.ts torusStageValues). */
export function useTorusChainBinding(state: LiveTorusState | null, device: DeviceInstance) {
  const plan = useSkyModulationPlan()
  const stage = useHostedChrome()?.state?.instrumentStage ?? null
  const rack = useQlRack(1)
  return useMemo(() => torusDesignBinding(state, device, skyHeldTorusKeys(plan), stage, rack), [state, device, plan, stage, rack])
}

export function TorusOnChain({state}: {state: LiveTorusState}) {
  const device = useMemo(() => torusDevice(state), [state])
  const binding = useTorusChainBinding(state, device)
  useEffect(() => {
    publishDevice(TORUS_DEVICE_ID, {device, binding, picture: size => <TorusPicture state={state} size={size} />, full: {draw: () => <TorusFull />}})
  }, [device, binding, state])
  useEffect(() => () => publishDevice(TORUS_DEVICE_ID, null), [])
  return <div className="chain-side" data-chain-instrument={TORUS_DEVICE_ID} data-live-torus={state.ok ? state.value.standing : 'refused'}>
    <DeviceView device={device} binding={binding} size="compact" picture={<TorusPicture state={state} size="compact" />} actions={[
      {icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(TORUS_DEVICE_ID)},
      {icon: 'pane', label: 'Open the torus full size in a pane', onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: TORUS_DEVICE_ID, title: TORUS_DEVICE.title})},
    ]} wrapRow={torusMapWrap} />
  </div>
}
