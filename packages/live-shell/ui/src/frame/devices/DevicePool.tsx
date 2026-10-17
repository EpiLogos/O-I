// The pool under the browser (manual §10.3: "The pool under the browser shows the selected device in full. Changes you
// make in the pool apply at once and do not add the device to your rack."; manual §16.3 Whole: "Every parameter, grouped, and the
// display with all its handles"; "The pool shows the device you select in the browser, and changes there apply without adding it to
// a chain"): the device last chosen on a chain or in the browser (deviceDoor.ts selectDevice, holdInPool), whole, on the same binding
// its other places read — a value moved here moves there. The plate is 400 wide and scales to the pool's width; it never scrolls
// (pages stand in its head). Its frame is 'pool' and its room the pool's box (DeviceView.tsx PlacedDevice, useHolderRoom).
import {useDeviceDoor} from './deviceDoor'
import {PlacedDevice} from './DeviceView'

export function DevicePool() {
  const door = useDeviceDoor()
  const held = door.selected ? door.device(door.selected) : undefined
  return <section className="device-pool" aria-label="Device pool" data-device-pool={door.selected ?? 'empty'}>
    {held
      ? <PlacedDevice device={held.device} view="whole" picture={held.picture} binding={held.binding} />
      : <p className="device-pool-empty">Choose a device on a chain to see every setting here.</p>}
  </section>
}
