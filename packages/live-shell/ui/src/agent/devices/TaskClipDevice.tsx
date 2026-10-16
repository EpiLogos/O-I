// The selected task on the Clip side (DLW §19.1: "In Clip view, the task is the clip"; lane BF3): the Tasks device the chain publishes
// (taskBindings.ts, factory:tasks — the same binding, so the clip and the chain move together), at its compact size beside the task's
// log, as Live's clip box stands beside its editor. It reads the door: a Tasks device no chain has published draws nothing, and the
// log stands alone as before.
import {DeviceView} from '../../frame/devices/DeviceView'
import {DEVICE_PANE_KIND, selectDevice, useDeviceDoor} from '../../frame/devices/deviceDoor'
import {openInstrument} from '../../frame/instrumentDoor'
import {TASKS_ID} from './taskBindings'
import './factoryDevices.css'

export function TaskClipDevice() {
  const entry = useDeviceDoor().device(TASKS_ID)
  if (!entry) return null
  return <div className="factory-task-clip" data-device={TASKS_ID}>
    <DeviceView device={entry.device} size="compact" binding={entry.binding} actions={[
      {icon: 'detail', label: 'Show the task whole in the pool', onPress: () => selectDevice(TASKS_ID)},
      {icon: 'pane', label: 'Open the task full size in a pane', onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: TASKS_ID, title: 'Tasks'})},
    ]} />
  </div>
}
