// The torus at the head of Live's chain, through the device runtime (FOUNDATION F5): compact here, whole in the pool, full
// in a pane — one device, its live settings the same in all three, and its picture drawn at each size (manual §10.4: a small
// live picture on the rack, the device at full size in a pane). The picture is the torus's outline, tinted by the owner's
// standing; the oscillation itself is only ever the simulation's own render on the stage (lock §0.2.2), never redrawn here.
// Its own Full is the torus at the pane's size with the Jankó keyboard under it (DEVICE-UI §9.2 Full; DLW §21.1 Full): the pane is
// the instrument you play.
//
// The plate stays the generic plate of the device's rows — the four determinants (lens, context frame, harmonic basis, M3
// transcription) and the presentation parameters, each MIDI-mappable — until the catalogue's design of the Torus
// (inhabitants/catalogue/panels/torus.tsx, `quaternal-logic:torus`) draws those keys: hosting the design today would take the
// four working determinant controls off the chain (lead, 16 Oct: an established behaviour is never removed for an adjacent one).
// Its binding is ready (torusDevice.ts torusDesignBinding); publish it with the device once the design carries them.
import {useEffect, useMemo} from 'react'
import {DeviceView} from '../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../frame/devices/devicePane'
import {openInstrument} from '../frame/instrumentDoor'
import {TORUS_DEVICE, TORUS_DEVICE_ID, torusDevice, torusFigure, torusTone, type TorusFigureSize} from './torusDevice'
import {LIVE_TORUS_ABSENT_REASON, useLiveTorusReading, type LiveTorusState} from './torusInstrument'
import {JankoDevice} from './janko/JankoDevice'
import {useKeyboardLayout} from './keyboardLayout'
import {MidiMapTarget} from './midiMap/midiMapControls'

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

export function TorusOnChain({state}: {state: LiveTorusState}) {
  const device = useMemo(() => torusDevice(state), [state])
  useEffect(() => {
    publishDevice(TORUS_DEVICE_ID, {device, picture: size => <TorusPicture state={state} size={size} />, full: {draw: () => <TorusFull />}})
  }, [device, state])
  useEffect(() => () => publishDevice(TORUS_DEVICE_ID, null), [])
  return <div className="chain-side" data-chain-instrument={TORUS_DEVICE_ID} data-live-torus={state.ok ? state.value.standing : 'refused'}>
    <DeviceView device={device} size="compact" picture={<TorusPicture state={state} size="compact" />} actions={[
      {icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(TORUS_DEVICE_ID)},
      {icon: 'pane', label: 'Open the torus full size in a pane', onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: TORUS_DEVICE_ID, title: TORUS_DEVICE.title})},
    ]} wrapRow={(row, control) => <MidiMapTarget id={mapId(row.key)}>{control}</MidiMapTarget>} />
  </div>
}
