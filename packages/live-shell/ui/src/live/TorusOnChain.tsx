// The torus at the head of Live's chain, through the device runtime (FOUNDATION F5): compact here, whole in the pool, full
// in a pane — one device, its live settings the same in all three. Its picture is the owner's standing; the torus itself is
// only ever the simulation's own render on the stage (lock §0.2.2), never redrawn here.
import {useEffect, useMemo} from 'react'
import {DeviceView} from '../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../frame/devices/devicePane'
import {openInstrument} from '../frame/instrumentDoor'
import {TORUS_DEVICE, TORUS_DEVICE_ID, torusDevice} from './torusDevice'
import type {LiveTorusState} from './torusInstrument'
import {MidiMapTarget} from './midiMap/midiMapControls'

function TorusPicture({state}: {state: LiveTorusState}) {
  return <div className="torus-picture" data-live-torus={state.ok ? state.value.standing : 'refused'}>
    {state.ok ? <><b>{state.value.standing}</b><small>{state.value.identity.event_ref}</small></> : <span role="alert">Refused reading: {state.fault}</span>}
  </div>
}

export function TorusOnChain({state}: {state: LiveTorusState}) {
  const device = useMemo(() => torusDevice(state), [state])
  useEffect(() => {
    publishDevice(TORUS_DEVICE_ID, {device, picture: () => <TorusPicture state={state} />})
  }, [device, state])
  useEffect(() => () => publishDevice(TORUS_DEVICE_ID, null), [])
  return <div className="chain-side" data-chain-instrument={TORUS_DEVICE_ID} data-live-torus={state.ok ? state.value.standing : 'refused'}>
    <DeviceView device={device} size="compact" picture={<TorusPicture state={state} />} actions={[
      {icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(TORUS_DEVICE_ID)},
      {icon: 'pane', label: 'Open the torus full size in a pane', onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: TORUS_DEVICE_ID, title: TORUS_DEVICE.title})},
    ]} wrapRow={(row, control) => <MidiMapTarget id={row.key}>{control}</MidiMapTarget>} />
  </div>
}
