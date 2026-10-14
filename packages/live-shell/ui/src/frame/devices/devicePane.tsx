// A device at full size in a pane (manual §10.4: "Full — a pane — the device at full size, to work in"). The pane kind
// `projection.device` holds one device by id (the binding's subject); its settings are the same live settings the rack and
// the pool show, read through the device door.
import {createRoot} from 'react-dom/client'
import {registerProjectionModule} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {useDeviceDoor} from './deviceDoor'
import {DeviceView} from './DeviceView'

export const DEVICE_PANE_KIND = 'projection.device'

export function DeviceFullPane({id}: {id: string | undefined}) {
  const door = useDeviceDoor()
  const held = id ? door.device(id) : undefined
  if (!held) return <p role="status" className="source-note">This device is not on any chain right now. It returns when its chain does.</p>
  return <DeviceView device={held.device} size="full" picture={held.picture?.('full')} />
}

let registered = false
export function registerDevicePane(): void {
  if (registered) return
  registered = true
  registerProjectionModule({id: 'device-full', kind: DEVICE_PANE_KIND, create: ({element, binding}) => {
    const root = createRoot(element)
    root.render(<div style={{position: 'absolute', inset: 0}}><DeviceFullPane id={binding.subject_ref} /></div>)
    return {unmount: () => root.unmount()}
  }})
}
