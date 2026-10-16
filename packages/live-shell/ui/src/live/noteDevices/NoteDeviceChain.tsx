// The note devices in Live's device chain, before the torus (T-LIVE-MODE-SCALES item 3; lock §0.2.5), each a plate of the one
// device runtime (FOUNDATION F5; live/liveChainDevices.ts noteDevice): its power ring and its tie rule write the session hold
// (noteDeviceHold.ts), what it does to the notes is read from the mode in force and drawn in its well (NoteFoldPicture.tsx), and the
// pool shows where it is kept. It moves as a device moves in Live: drag it along the chain, or Alt+← / Alt+→; Delete takes it off.
// It is added from the browser's Chain devices (components/BrowserPane.tsx). Faces read; the pitch set is the owner's (the mode in force).

import {useCallback, useMemo, type DragEvent, type KeyboardEvent} from 'react'
import type {ModeInForce} from '../modes'
import {useLiveModeInForce} from '../../native/liveModeCatalogue'
import {moveNoteDevice, removeNoteDevice, setNoteDevicePower, setScaleTie, useNoteDeviceChain} from './noteDeviceHold'
import {NOTE_DEVICE_LABEL, type NoteDevice} from './noteDevices'
import {MidiMapTarget} from '../midiMap/midiMapControls'
import {setMapRefusal} from '../midiMap/midiMapHold'
import {DeviceView} from '../../frame/devices/DeviceView'
import {selectDevice} from '../../frame/devices/deviceDoor'
import {usePublishedDevice} from '../usePublishedDevice'
import {noteDevice, noteDeviceReading, type NoteDeviceHold} from '../liveChainDevices'
import {NoteFoldPicture} from './NoteFoldPicture'
import './noteDevices.css'

/** The session hold, as the plates write it. A tie the face changes is an accepted write: any refusal the map named on it is stale. */
const HOLD: NoteDeviceHold = {
  setTie: (id, tie) => { setScaleTie(id, tie); setMapRefusal(`note-device:${id}:tie`, null) },
  setPower: setNoteDevicePower,
}

const DRAG_TYPE = 'application/x-oi-note-device'

/** The connected chain: the session hold, read with the set's mode in force. */
export function NoteDeviceChain() {
  const devices = useNoteDeviceChain()
  const {mode} = useLiveModeInForce()
  return <NoteDeviceChainView devices={devices} mode={mode}/>
}

/** The chain's plates, in chain order. An empty chain draws nothing: the notes reach the torus as they were played. */
export function NoteDeviceChainView({devices, mode}: {devices: readonly NoteDevice[]; mode: ModeInForce}) {
  if (!devices.length) return null
  return <div className="note-device-plates" data-note-device-chain="note-devices" data-note-devices={devices.length} aria-label="Note devices">
    {devices.map((device, index) => <NoteDevicePlate key={device.id} device={device} index={index} devices={devices} mode={mode}/>)}
  </div>
}

/** Move a device to a place in the chain, one step at a time through the hold's own move. */
function moveTo(devices: readonly NoteDevice[], id: string, target: number): void {
  const from = devices.findIndex(device => device.id === id)
  if (from < 0) return
  for (let at = from; at !== target; at += target > at ? 1 : -1) moveNoteDevice(id, target > at ? 1 : -1)
}

function NoteDevicePlate({device, index, devices, mode}: {device: NoteDevice; index: number; devices: readonly NoteDevice[]; mode: ModeInForce}) {
  const instance = useMemo(() => noteDevice(device, mode, HOLD), [device, mode])
  // Its live picture, in its well wherever it is drawn: the fold it makes of the twelve classes under the mode in force.
  const picture = useCallback(() => <NoteFoldPicture device={device} mode={mode}/>, [device, mode])
  usePublishedDevice(instance.id, instance, picture)
  const name = NOTE_DEVICE_LABEL[device.kind]
  const reading = noteDeviceReading(device, mode)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      moveNoteDevice(device.id, event.key === 'ArrowLeft' ? -1 : 1)
      event.preventDefault()
    } else if (!event.altKey && !event.metaKey && !event.ctrlKey && (event.key === 'Delete' || event.key === 'Backspace')) {
      removeNoteDevice(device.id)
      event.preventDefault()
    }
  }
  const carries = (event: DragEvent<HTMLDivElement>) => event.dataTransfer.types.includes(DRAG_TYPE)
  return <div className="chain-side note-plate" tabIndex={0} draggable data-note-device={device.kind} data-note-device-id={device.id}
    data-note-device-power={device.enabled ? 'on' : 'off'} data-note-device-reading={reading.state}
    aria-label={`${name} note device, ${index + 1} of ${devices.length}`} aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Delete"
    title={`${reading.line} Drag it along the chain or press Alt+← / Alt+→ to move it; Delete takes it off.`}
    onKeyDown={onKeyDown}
    onDragStart={event => { event.dataTransfer.setData(DRAG_TYPE, device.id); event.dataTransfer.effectAllowed = 'move' }}
    onDragOver={event => { if (carries(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }}
    onDrop={event => { if (!carries(event)) return; event.preventDefault(); moveTo(devices, event.dataTransfer.getData(DRAG_TYPE), index) }}>
    <DeviceView device={instance} size="compact" picture={<NoteFoldPicture device={device} mode={mode}/>}
      actions={[{icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(instance.id)}]}
      wrapRow={(row, control) => row.key === 'tie' ? <MidiMapTarget id={`note-device:${device.id}:tie`} writer="session">{control}</MidiMapTarget> : control}/>
  </div>
}
