// The pool under the browser (manual §10.3: "The pool under the browser shows the selected device in full. Changes you
// make in the pool apply at once and do not add the device to your rack."; manual §16.3 Whole: "Every parameter, grouped, and the
// display with all its handles"): the device last chosen on a chain, whole, on the same binding its chain plate reads — a value
// moved here moves there. The plate is 400 wide and scales to the pool's width; it never scrolls (pages stand in its head).
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
