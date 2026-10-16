// The keyboard at the head of Live's chain, through the device runtime (FOUNDATION F5): the notes start here, pass the note
// devices and reach the torus (manual §10.4: "the material always passes through them in that order"). Its picture is the
// playing surface itself (live/janko/JankoDevice.tsx: one input path, the owner's window), in every place it is drawn: on the chain,
// whole in the pool, full in a pane, small on the rail (DEVICE-UI §2). Its one control is the layout, held in the shell
// (keyboardLayout.ts) so every place draws the same one. One keyboard hears MIDI — the chain's plate; every other drawing of it plays
// from the pointer and the computer keys only, so a hardware note is struck once.
import {useCallback, useMemo} from 'react'
import {DeviceView} from '../frame/devices/DeviceView'
import {selectDevice} from '../frame/devices/deviceDoor'
import {JankoDevice} from './janko/JankoDevice'
import {KEYBOARD_DEVICE_ID, keyboardDevice} from './liveChainDevices'
import {setKeyboardLayout, useKeyboardLayout} from './keyboardLayout'
import {usePublishedDevice} from './usePublishedDevice'

export function KeyboardOnChain() {
  const layout = useKeyboardLayout()
  const device = useMemo(() => keyboardDevice(layout, setKeyboardLayout), [layout])
  // The surface the pool, a pane and the rail draw: the same keyboard, deaf to MIDI (the chain's plate hears it).
  const picture = useCallback(() => <JankoDevice plate layout={layout} midi={false} />, [layout])
  usePublishedDevice(KEYBOARD_DEVICE_ID, device, picture)
  return <div className="chain-side keyboard-plate" data-chain-instrument={KEYBOARD_DEVICE_ID}>
    <DeviceView device={device} size="compact" picture={<JankoDevice plate layout={layout} />}
      actions={[{icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(KEYBOARD_DEVICE_ID)}]} />
  </div>
}
