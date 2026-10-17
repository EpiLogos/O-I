// A device at full size in a pane (manual §16.3 Full: "The material itself … No controls"; DLW §16.1: "A pane is a device at full
// size. Its controls stay out of the pane and appear in Device view below it"). The pane kind `projection.device` holds one device
// by id (the binding's subject); it draws the device's Full view — its own, or its live picture at pane size — read through the
// device door on the same binding the chain and the pool read.
import {createRoot} from 'react-dom/client'
import {registerProjectionModule} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {DEVICE_PANE_KIND, useDeviceDoor} from './deviceDoor'
import {PlacedDevice} from './DeviceView'

export {DEVICE_PANE_KIND}

export function DeviceFullPane({id}: {id: string | undefined}) {
  const door = useDeviceDoor()
  const held = id ? door.device(id) : undefined
  if (!held) return <p role="status" className="source-note">This device is not on any chain right now. It returns when its chain does.</p>
  return <PlacedDevice device={held.device} view="full" picture={held.picture} binding={held.binding} />
}

let registered = false
export function registerDevicePane(): void {
  if (registered) return
  registered = true
  registerProjectionModule({id: 'device-full', kind: DEVICE_PANE_KIND, create: ({element, binding}) => {
    const root = createRoot(element)
    root.render(<div style={{position: 'absolute', inset: 0}}><DeviceFullPane id={binding.subject_ref} /></div>)
    // The pane session tears down inside a commit; the root leaves after it (its container is the session's own).
    return {unmount: () => queueMicrotask(() => root.unmount())}
  }})
}
