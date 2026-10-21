// The rail's Terminal tile (DLW §17.9: "born on the rail"): the Terminal device's own widget, on the binding the pane reads
// (widgets/terminalBinding.ts, published by widgets/railDevices.tsx while a terminal runs); with none running, where one starts.
import {useDeviceDoor} from '../frame/devices/deviceDoor'
import {PlacedDevice} from '../frame/devices/DeviceView'
import type {WidgetBodyProps} from '../frame/widgets/widgets'
import {NO_TERMINAL, TERMINAL_ID} from './terminalBinding'

export function TerminalRailWidget({close}: WidgetBodyProps) {
  const door = useDeviceDoor()
  const entry = door.device(TERMINAL_ID)
  if (!entry) return <p className="device-widget-away" data-i={`Terminal|${NO_TERMINAL}`}>{NO_TERMINAL}</p>
  return <PlacedDevice device={entry.device} view="widget" picture={entry.picture} binding={entry.binding} onClose={close} />
}
