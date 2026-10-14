// The pool under the browser (manual §10.3: "The pool under the browser shows the selected device in full. Changes you
// make in the pool apply at once and do not add the device to your rack."): the device last chosen on a chain, whole.
import {useDeviceDoor} from './deviceDoor'
import {DeviceView} from './DeviceView'

export function DevicePool() {
  const door = useDeviceDoor()
  const held = door.selected ? door.device(door.selected) : undefined
  return <section className="device-pool" aria-label="Device pool" data-device-pool={door.selected ?? 'empty'}>
    {held
      ? <DeviceView device={held.device} size="whole" picture={held.picture?.('whole')} />
      : <p className="device-pool-empty">Choose a device on a chain to see every setting here.</p>}
  </section>
}
