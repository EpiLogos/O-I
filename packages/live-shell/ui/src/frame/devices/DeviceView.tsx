// One device in its places (DEVICE-UI §2, §11; manual §16.1): every view drawn by the panel kit through the host
// (deviceHost.tsx), on one binding, so a change in one view shows in the others at once. The device's own views when the catalogue
// holds a design for its `<family>:<face>` and the device is published (designs.ts), else the generic plate of its rows
// (genericDevice.tsx). A change goes to the owner when you let go of the control (§5.2); no plate has a Send button.
//
// The places:
//   ChainDevice — compact, or folded by ▾ (§2: "Press ▾ in the head to fold the device. Press the folded title to open it"), on a
//                 chain; the press on the plate shows the device whole in the pool; it scales 80–125 % with the detail area's height;
//   DeviceView size="whole" — the pool's view (DevicePool.tsx); size="full" — the pane's (devicePane.tsx): the material, no controls;
//   DeviceWidgetView — the rail's tile (frame/widgets/deviceWidgets.tsx).
// DeviceView keeps the runtime's earlier API (device, size, picture, actions, wrapRow; ported from the former DeviceView.tsx:18-30)
// so every chain site draws on the kit at once.
import {useMemo, useRef, type ReactNode, type RefObject} from 'react'
import {Icon} from '../../inhabitants/sdk/Icon'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import {openInstrument} from '../instrumentDoor'
import {DEVICE_PANE_KIND, publishedDevice, putOnRail, selectDevice, takeOffRail, useIsPublished, useSelectedDeviceId} from './deviceDoor'
import {bindingOf, type DesignBinding, type DesignedDevice, type DeviceViewName, type HostNav} from './designed'
import {designKey, isRegisteredDesign, useDesign} from './designs'
import {genericDevice} from './genericDevice'
import {HostedDevice, sayOnInfoLine} from './deviceHost'
import {lightOf, type DeviceInstance, type DeviceSize} from './deviceRuntime'
import {chainScale, poolScale, useContainerScale} from './plateScale'
import './devices.css'

export type DeviceAction = {icon: 'detail' | 'pane' | 'back' | 'cmd' | 'plus'; label: string; onPress: () => void}

export interface DeviceViewProps {
  device: DeviceInstance
  size: DeviceSize
  /** The device's own live picture (the torus, the die, the field): small on the rack, full in a pane. */
  picture?: ReactNode
  /** What the place offers the plate. `detail` (show every setting in the pool) is the press on the plate itself; `pane` (open
   * full size in a pane) is the head's ⤢; the rest stand on the head by their marks. */
  actions?: readonly DeviceAction[]
  /** The host's own wrap for a control (Live maps a macro to a key or a MIDI control through it). */
  wrapRow?: (row: SdkParamRow, control: ReactNode) => ReactNode
  /** The wiring of the device's designed views to its owner, where its family has written one (designed.ts DesignBinding). */
  binding?: DesignBinding
  /** Draw the generic plate even where a design exists (the gallery's `&generic=1`). */
  generic?: boolean
}

/** Open a device full size in a pane; the reason in words when no pane tree is mounted (instrumentDoor.ts refuses then). */
export function openDeviceFull(id: string, title: string): string | null {
  try {
    openInstrument(DEVICE_PANE_KIND, undefined, {ref: id, title})
    return null
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
}

interface Hosting {
  designed: DesignedDevice
  plain: DesignedDevice
  binding: DesignBinding
  keys: readonly string[]
}

/** The views that draw a device and the binding they read: its design where one stands for a published device, else its generic
 * plate; the place's wrap and marks reach the generic plate. */
function useHosting(device: DeviceInstance, picture: ((size: 'compact' | 'whole' | 'full') => ReactNode) | undefined, actions: readonly DeviceAction[] | undefined,
  wrapRow: DeviceViewProps['wrapRow'], given: DesignBinding | undefined, generic: boolean | undefined, selected: boolean): Hosting {
  const published = useIsPublished(device.id)
  const key = designKey(device.family, device.face.id)
  // A catalogue design reads its own value keys (`num(v, 'face')`, `str(v, 'date')`), so it draws once the device's family has
  // wired those keys to its owner — a DesignBinding given here or published with the device. Hosted on the device's row keys
  // instead it would draw "NaN" and "undefined" in its well (seen in the candidate, 16 Oct: the Day's net as NaN·NaN·NaN);
  // until then the generic plate draws the owner's real rows. A design the shell registers itself draws on the rows at once.
  const wired = given ?? (published ? publishedDevice(device.id)?.binding : undefined)
  const own = useDesign(key, published && !generic && !!wired)
  const rowBinding = useMemo(() => bindingOf(device), [device])
  const marks = actions?.filter(action => action.icon !== 'detail' && action.icon !== 'pane')
  const marksNode = marks?.length ? marks.map(action => <button key={action.icon} type="button" className="dp-full" aria-label={action.label}
    data-i={`${action.label}|${action.label}.`} onClick={action.onPress}><Icon name={action.icon} size={10} /></button>) : undefined
  const plain = genericDevice({id: key, title: device.face.title, rows: device.rows, enabledKey: device.enabledKey, picture, wrapRow, marks: marksNode, selected,
    fullLabel: actions?.find(action => action.icon === 'pane')?.label, hint: actions?.find(action => action.icon === 'detail')?.label})
  const designed = own && !generic && (wired || isRegisteredDesign(key)) ? own : plain
  // A design reads its own value keys through the family's binding; a shell-registered design, the device's rows.
  const binding = designed === plain ? rowBinding : wired ?? rowBinding
  return {designed, plain, binding, keys: device.rows.map(row => row.key)}
}

/** The navigation every place shares: the press shows the device whole in the pool; ⤢ opens it full in a pane; the rail mark keeps
 * it on the rail. A place's own `detail` and `pane` acts stand over these. */
function useNav(device: DeviceInstance, actions: readonly DeviceAction[] | undefined, root: RefObject<HTMLDivElement | null>): HostNav {
  const published = useIsPublished(device.id)
  const say = (words: string | null) => { if (words) sayOnInfoLine(root.current, device.face.title, words) }
  const detail = actions?.find(action => action.icon === 'detail')
  const pane = actions?.find(action => action.icon === 'pane')
  return {
    select: detail?.onPress ?? (published ? () => selectDevice(device.id) : undefined),
    full: pane?.onPress ?? (published ? () => say(openDeviceFull(device.id, device.face.title)) : undefined),
    rail: published ? () => say(putOnRail(device.id)) : undefined,
  }
}

const sizeOf = (view: DeviceViewName): DeviceSize => (view === 'whole' ? 'whole' : view === 'full' ? 'full' : 'compact')

/** A device on a chain: compact, or folded; scaled with the detail area's height (DEVICE-UI §3). */
export function ChainDevice({device, picture, actions, wrapRow, binding, generic}: Omit<DeviceViewProps, 'size'>) {
  const root = useRef<HTMLDivElement>(null)
  const selected = useSelectedDeviceId() === device.id
  const draw = picture === undefined || picture === null || picture === false ? undefined : () => picture
  const hosting = useHosting(device, draw, actions, wrapRow, binding, generic, selected)
  const nav = useNav(device, actions, root)
  const scale = useContainerScale(root, '.detail-chain', box => chainScale(box.height))
  return <div ref={root} className="device-place device-place--chain" style={scale !== 1 ? {zoom: scale} : undefined} data-plate-scale={scale}>
    <HostedDevice designed={hosting.designed} fallback={hosting.plain} binding={hosting.binding} view="compact" chain keys={hosting.keys} title={device.face.title}
      nav={nav} className="device device--compact"
      data={{'data-device': device.id, 'data-device-size': 'compact', 'data-device-light': lightOf(device), 'data-device-selected': selected ? 'true' : undefined,
        'data-device-design': hosting.designed === hosting.plain ? 'generic' : hosting.designed.id}} />
  </div>
}

/** One device in one of its three runtime sizes (the earlier API): compact on a chain, whole in the pool, full in a pane. */
export function DeviceView({device, size, picture, actions, wrapRow, binding, generic}: DeviceViewProps) {
  if (size === 'compact') return <ChainDevice device={device} picture={picture} actions={actions} wrapRow={wrapRow} binding={binding} generic={generic} />
  return <PlacedDevice device={device} view={size} picture={picture === undefined || picture === null || picture === false ? undefined : () => picture}
    actions={actions} wrapRow={wrapRow} binding={binding} generic={generic} />
}

/** A device whole (the pool), full (a pane) or as its widget (the rail). The pool's plate is 400 wide, scaled to the pool's width. */
export function PlacedDevice({device, view, picture, actions, wrapRow, binding, generic, onClose}: {device: DeviceInstance; view: 'whole' | 'full' | 'widget';
  picture?: (size: 'compact' | 'whole' | 'full') => ReactNode; actions?: readonly DeviceAction[]; wrapRow?: DeviceViewProps['wrapRow']; binding?: DesignBinding
  generic?: boolean; onClose?: () => void}) {
  const root = useRef<HTMLDivElement>(null)
  const hosting = useHosting(device, picture, actions, wrapRow, binding, generic, false)
  const nav = useNav(device, actions, root)
  const scale = useContainerScale(root, '.device-pool', (box, natural) => poolScale(box.width, box.height, natural.height || undefined))
  const zoom = view === 'whole' && scale !== 1 ? scale : undefined
  return <div ref={root} className={`device-place device-place--${view}`} style={zoom ? {zoom} : undefined} data-plate-scale={view === 'whole' ? scale : undefined}>
    <HostedDevice designed={hosting.designed} fallback={hosting.plain} binding={hosting.binding} view={view} keys={hosting.keys} title={device.face.title}
      nav={view === 'widget' ? {full: nav.full, select: nav.select, close: onClose ?? (() => takeOffRail(device.id))} : view === 'full' ? {} : {full: nav.full, rail: nav.rail}}
      className={`device device--${view}`}
      data={{'data-device': device.id, 'data-device-size': view === 'widget' ? 'widget' : sizeOf(view), 'data-device-light': lightOf(device),
        'data-device-design': hosting.designed === hosting.plain ? 'generic' : hosting.designed.id}} />
  </div>
}
