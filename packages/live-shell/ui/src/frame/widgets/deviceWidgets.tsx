// A device on the rail (manual §16.3 Widget: "A tile of 136 × 136 px … A small display and up to three readings or macros"; "A
// widget stays on the rail when you change mode"). A widget of the rail's own kind (widgets.ts WidgetDeclaration) whose id is
// `device:<device id>` (deviceDoor.ts deviceWidgetId): it stands in the rail's open set — the workspace book's, so it stays across
// modes — and its body draws the published device's Widget view on the same binding the chain, the pool and the pane read. The
// device's tile is its own (the kit's Tile: light, name, ⤢, ✕), so the rail draws it bare, without a second head.
import type {ComponentType} from 'react'
import {DEVICE_WIDGET_PREFIX, publishedDevices, useDeviceDoor} from '../devices/deviceDoor'
import {PlacedDevice} from '../devices/DeviceView'
import type {WidgetBodyProps, WidgetDeclaration} from './widgets'
import './deviceWidgets.css'

export const isDeviceWidget = (id: string): boolean => id.startsWith(DEVICE_WIDGET_PREFIX)

/** One body per device id, kept, so a render never remounts it. `name`: what the rail calls it (the registration's name, or the device's
 * face title), so a tile whose device is on no chain says which device is away by name (manual §16.3: a tile has a name), never by id. */
const bodies = new Map<string, ComponentType<WidgetBodyProps>>()
const names = new Map<string, string>()
/** The words an away tile says, by the name the rail gives it. */
export const awayWords = (name: string): string => `${name} is on no chain now. It returns here when its chain does.`
function deviceBody(deviceId: string, name?: string): ComponentType<WidgetBodyProps> {
  if (name) names.set(deviceId, name)
  const held = bodies.get(deviceId)
  if (held) return held
  const Body = function DeviceWidget({close}: WidgetBodyProps) {
    const door = useDeviceDoor()
    const entry = door.device(deviceId)
    if (!entry) {
      const said = awayWords(names.get(deviceId) ?? deviceId)
      return <p className="device-widget-away" data-i={`${names.get(deviceId) ?? deviceId}|${said}`}>{said}</p>
    }
    return <PlacedDevice device={entry.device} view="widget" picture={entry.picture} binding={entry.binding} onClose={close} />
  }
  bodies.set(deviceId, Body)
  return Body
}

/** A widget the rail registers under its own id that a device's widget draws (DLW §19.6: the rail's Frames is the Frames monitor's
 * widget) — of the rail's own device kind, bare, its body the device's Widget view on the device's binding — under the registration's
 * name and mark. A device's publisher claims it; the claim stays when the device leaves its chain (its body then says so). */
const claims = new Map<string, string>()
export function claimRailWidget(widgetId: string, deviceId: string): void { claims.set(widgetId, deviceId) }
/** The registered widget as the rail draws it: the claiming device's widget, else itself. */
export function claimedWidget(widget: WidgetDeclaration): WidgetDeclaration {
  const deviceId = claims.get(widget.id)
  return deviceId ? {...widget, bare: true, Body: deviceBody(deviceId, widget.name)} : widget
}

/** The device widget for a rail id `device:<id>`: named and marked from the device the door holds now. */
export function deviceWidget(widgetId: string): WidgetDeclaration {
  const deviceId = widgetId.slice(DEVICE_WIDGET_PREFIX.length)
  const entry = publishedDevices().find(published => published.device.id === deviceId)
  const name = entry?.device.face.title
  return {id: widgetId, name: name ?? names.get(deviceId) ?? deviceId, mark: entry?.device.face.icon ?? 'form', hint: 'a device, kept at hand',
    bare: true, Body: deviceBody(deviceId, name)}
}

/** The device widgets the rail holds open, then — for a search in the launcher — every published device whose name matches. */
export function deviceWidgets(open: readonly string[], query: string): {open: WidgetDeclaration[]; found: WidgetDeclaration[]} {
  const held = open.filter(isDeviceWidget).map(deviceWidget)
  const needle = query.trim().toLocaleLowerCase()
  // A claimed device answers a search through the registration that claims it (one Frames in the launcher, not two).
  const claimed = new Set(claims.values())
  const found = needle
    ? publishedDevices().filter(entry => !claimed.has(entry.device.id))
      .filter(entry => entry.device.face.title.toLocaleLowerCase().includes(needle) || entry.device.id.toLocaleLowerCase().includes(needle))
      .map(entry => deviceWidget(`${DEVICE_WIDGET_PREFIX}${entry.device.id}`))
    : []
  return {open: held, found}
}
