// The keyboard at the head of Live's chain, through the device runtime (FOUNDATION F5): the notes start here, pass the note
// devices and reach the torus (manual §10.4: "the material always passes through them in that order"). Its picture is the
// playing surface itself (live/janko/JankoDevice.tsx, unchanged: one input path, the owner's window, MIDI while mounted); its one
// control is the layout, held by the plate. The pool shows the plate's settings without a second surface: one keyboard plays.
import {useCallback, useMemo, useState} from 'react'
import {DeviceView} from '../frame/devices/DeviceView'
import {selectDevice} from '../frame/devices/deviceDoor'
import {JankoDevice} from './janko/JankoDevice'
import {KEYBOARD_DEVICE_ID, keyboardDevice, type KeyboardLayoutName} from './liveChainDevices'
import {usePublishedDevice} from './usePublishedDevice'

export function KeyboardOnChain() {
  const [layout, setLayout] = useState<KeyboardLayoutName>('janko')
  const choose = useCallback((next: KeyboardLayoutName) => setLayout(next), [])
  const device = useMemo(() => keyboardDevice(layout, choose), [layout, choose])
  usePublishedDevice(KEYBOARD_DEVICE_ID, device)
  return <div className="chain-side keyboard-plate" data-chain-instrument={KEYBOARD_DEVICE_ID}>
    <DeviceView device={device} size="compact" picture={<JankoDevice plate layout={layout} />}
      actions={[{icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(KEYBOARD_DEVICE_ID)}]} />
  </div>
}
