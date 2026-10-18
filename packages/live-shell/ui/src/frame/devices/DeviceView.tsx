// One device in its places (manual §16.3, §11; manual §16.1): every view drawn by the panel kit through the host
// (deviceHost.tsx), on one binding, so a change in one view shows in the others at once. The device's own views when the catalogue
// holds a design for its `<family>:<face>` and the device is published (designs.ts), else the generic plate of its rows
// (genericDevice.tsx). A change goes to the owner when you let go of the control (§5.2); no plate has a Send button.
//
// The places:
//   ChainDevice — compact, or folded by ▾ (§2: "Press ▾ in the head to fold the device. Press the folded title to open it"), on a
//                 chain; the press on the plate shows the device whole in the pool; it scales 80–125 % with the detail area's height;
//   DeviceView size="whole" — the band's view (above the chain; the pool holds no device); size="full" — the pane's (devicePane.tsx): the material, no controls;
//   DeviceWidgetView — the rail's tile (frame/widgets/deviceWidgets.tsx).
// DeviceView keeps the runtime's earlier API (device, size, picture, actions, wrapRow; ported from the former DeviceView.tsx:18-30)
// so every chain site draws on the kit at once.
//
// What the device's publisher gives every place (deviceDoor.ts PublishedDevice): the place's marks for the head (a pop-out), which
// the generic plate and a design's head both carry through the navigation; the device's own Full, which the pane draws over its
// design's, or whose act every ⤢ does; and its pop-out, which the head's ↗ does.
//
// The six views (d18c911a3, d75e5aa0c): a chain plate's ▸ shows its expanded view, Whole as a band above the chain (ChainDevice draws
// it into the frame's host, DeviceFlip.tsx, while its own plate stands shown), and ↗ opens the device's own window, where Pop-out
// draws (DeviceWindows.tsx; PlacedDevice view="popout": the design's own, or Full over Whole).
//
// Every view gets its frame and its room (design.ts ViewProps; manual §16.3): Compact on the chain ('chain', the chain row's box),
// Whole in its band above the chain ('flip', the band's box; manual §16.7: the pool holds no device), Full in a pane ('pane', the pane's box), Pop-out in its
// window ('window', the window's room), Widget on the rail ('rail', the tile's box) — each measured where it stands (useHolderRoom),
// at 100 %, never a fixed guess where a box exists.
import {useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react'
import {createPortal} from 'react-dom'
import {Icon} from '../../inhabitants/sdk/Icon'
import type {ControlWrap} from '../../inhabitants/sdk/panel'
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import {openInstrument} from '../instrumentDoor'
import {DEVICE_PANE_KIND, flipDevice, flippedDeviceId, openDeviceWindow, publishedDevice, putOnRail, selectDevice, takeOffRail, useFlipHost, useFlippedDeviceId,
  useIsPublished, useSelectedDeviceId, type PublishedDevice} from './deviceDoor'
import type {Frame, Room} from '../../inhabitants/catalogue/panels/design'
// The wide frame and the window's body (popout.tsx's `dp-wide`, `dp-window-*`): the designs' own layout sheet, which designsLoad.ts
// loads with a design; the band and the window need it for a generic plate too.
import '../../inhabitants/catalogue/panels/panels.css'
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
  /** The place's own marks for the head, before ⤢ (a pop-out, a redock); absent, the marks the device was published with. */
  marks?: ReactNode
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
  /** No design stands: the generic plate draws. */
  generic: boolean
  binding: DesignBinding
  keys: readonly string[]
  /** The place's wrapRow for a design's kit controls, by value key; absent where the generic plate draws (it wraps its rows itself). */
  wrap?: ControlWrap
  /** The head menu's acts the device's chain owner carries (deviceDoor.ts PublishedDevice.acts). */
  acts?: PublishedDevice['acts']
}

/** The views that draw a device and the binding they read: its design where one stands for a published device, else its generic
 * plate; the place's wrap reaches the generic plate by its rows, and a design's kit controls by their value keys (a design key that is
 * one of the device's rows is wrapped as that row is). A device published with its own Full draws that as Full, over either. */
function useHosting(device: DeviceInstance, picture: ((size: 'compact' | 'whole' | 'full') => ReactNode) | undefined, actions: readonly DeviceAction[] | undefined,
  wrapRow: DeviceViewProps['wrapRow'], given: DesignBinding | undefined, generic: boolean | undefined, selected: boolean, relayed = false): Hosting {
  // A relayed device is published on the main window's door, not this window's (a Pop-out is its own page): it counts as published.
  const published = useIsPublished(device.id) || relayed
  const entry = published ? publishedDevice(device.id) : undefined
  const key = designKey(device.family, device.face.id)
  // A catalogue design reads its own value keys (`num(v, 'face')`, `str(v, 'date')`), so it draws once the device's family has
  // wired those keys to its owner — a DesignBinding given here or published with the device. Hosted on the device's row keys
  // instead it would draw "NaN" and "undefined" in its well (seen in the candidate, 16 Oct: the Day's net as NaN·NaN·NaN);
  // until then the generic plate draws the owner's real rows. A design the shell registers itself draws on the rows at once.
  const wired = given ?? entry?.binding
  const own = useDesign(key, published && !generic && !!wired)
  const rowBinding = useMemo(() => bindingOf(device), [device])
  const plain = genericDevice({id: key, title: device.face.title, rows: device.rows, enabledKey: device.enabledKey, picture, wrapRow, selected,
    fullLabel: actions?.find(action => action.icon === 'pane')?.label, hint: actions?.find(action => action.icon === 'detail')?.label})
  const designed = own && !generic && (wired || isRegisteredDesign(key)) ? own : plain
  // A design reads its own value keys through the family's binding; a shell-registered design, the device's rows.
  const binding = designed === plain ? rowBinding : wired ?? rowBinding
  const draw = entry?.full && 'draw' in entry.full ? entry.full.draw : undefined
  const withOwnFull = (views: DesignedDevice): DesignedDevice => (draw ? {...views, full: () => <div className="dv-full"
    data-i={`${device.face.title}|The device at pane size, as its owner draws it. Its controls stay in Device view.`}>{draw()}</div>} : views)
  const shownPlain = withOwnFull(plain)
  // The place's wrap, keyed by value key, for a design's controls (deviceHost.tsx HostedDevice `wrap`; sdk/panel.tsx ControlWrapContext).
  const wrap = useMemo<ControlWrap | undefined>(() => (wrapRow ? (valueKey, control) => {
    const row = device.rows.find(candidate => candidate.key === valueKey)
    return row ? wrapRow(row, control) : control
  } : undefined), [wrapRow, device.rows])
  return {designed: designed === plain ? shownPlain : withOwnFull(designed), plain: shownPlain, generic: designed === plain, binding, keys: device.rows.map(row => row.key),
    ...(designed !== plain && wrap ? {wrap} : {}), ...(entry?.acts ? {acts: entry.acts} : {})}
}

/** The navigation every place shares: the press shows the device whole in the pool; ⤢ opens it full — the device's own act where it
 * was published with one, else its pane; the rail mark keeps it on the rail; the place's marks stand in the head. A place's own
 * `detail` and `pane` acts stand over these; its other acts are marks. */
function useNav(device: DeviceInstance, actions: readonly DeviceAction[] | undefined, root: RefObject<HTMLDivElement | null>, marks?: ReactNode): HostNav {
  const published = useIsPublished(device.id)
  const entry = published ? publishedDevice(device.id) : undefined
  const say = (words: string | null) => { if (words) sayOnInfoLine(root.current, device.face.title, words) }
  const detail = actions?.find(action => action.icon === 'detail')
  const pane = actions?.find(action => action.icon === 'pane')
  const open = entry?.full && 'open' in entry.full ? entry.full.open : undefined
  const acts = actions?.filter(action => action.icon !== 'detail' && action.icon !== 'pane')
  const place = marks ?? entry?.marks
  const shown = acts?.length || (place !== undefined && place !== null && place !== false)
  const flipped = useFlippedDeviceId() === device.id
  return {
    select: detail?.onPress ?? (published ? () => selectDevice(device.id) : undefined),
    // ▸ beside the activator: the expanded view, a band above the chain; ▾ folds it back (one device at a time).
    expand: published ? () => flipDevice(flippedDeviceId() === device.id ? null : device.id) : undefined,
    expanded: flipped,
    full: pane?.onPress ?? open ?? (published ? () => say(openDeviceFull(device.id, device.face.title)) : undefined),
    // ↗ at the right: the device's own window (its publisher's own pop-out, where it gives one); any number stand at once.
    ...(entry?.popout ? {popout: entry.popout} : published ? {popout: () => openDeviceWindow(device.id)} : {}),
    rail: published ? () => say(putOnRail(device.id)) : undefined,
    ...(shown ? {marks: <>
      {acts?.map(action => <button key={action.icon} type="button" className="dp-full" aria-label={action.label}
        data-i={`${action.label}|${action.label}.`} onClick={action.onPress}><Icon name={action.icon} size={10} /></button>)}
      {place}
    </>} : {}),
  }
}

const sizeOf = (view: DeviceViewName): DeviceSize => (view === 'whole' ? 'whole' : view === 'full' ? 'full' : 'compact')

/** A device on a chain: compact, or folded; scaled with the detail area's height (manual §16.8). */
export function ChainDevice({device, picture, actions, wrapRow, binding, generic, marks}: Omit<DeviceViewProps, 'size'>) {
  const root = useRef<HTMLDivElement>(null)
  const selected = useSelectedDeviceId() === device.id
  const draw = picture === undefined || picture === null || picture === false ? undefined : () => picture
  const hosting = useHosting(device, draw, actions, wrapRow, binding, generic, selected)
  const nav = useNav(device, actions, root, marks)
  const scale = useContainerScale(root, '.detail-chain', box => chainScale(box.height))
  // The chain's room: the chain row's box at 100 % (Compact stands at the chain's height; its width comes from its sections).
  const chainRoom = useHolderRoom(root, 'chain', scale)
  // Expanded (▸), the device's Whole stands as a band above the chain while this plate stands shown (a concealed chain expands
  // nothing); the band claims Esc, which folds it (DeviceFlip.tsx).
  const host = useFlipHost()
  const shown = useShownBox(root)
  return <div ref={root} className="device-place device-place--chain" style={scale !== 1 ? {zoom: scale} : undefined} data-plate-scale={scale}>
    <HostedDevice designed={hosting.designed} fallback={hosting.plain} binding={hosting.binding} view="compact" chain keys={hosting.keys} title={device.face.title}
      wrap={hosting.wrap} nav={nav} className="device device--compact" frame="chain" room={chainRoom ?? undefined} acts={hosting.acts}
      data={{'data-device': device.id, 'data-device-size': 'compact', 'data-device-light': lightOf(device), 'data-device-selected': selected ? 'true' : undefined,
        'data-device-design': hosting.generic ? 'generic' : hosting.designed.id, 'data-device-flipped': nav.expanded ? 'true' : undefined}} />
    {/* The band's Whole reads the band's own room: its content box, as wide as the detail area (PlacedDevice measures the 'flip'
      holder), so a design grows its display into it (design.ts ViewProps.room; popout.tsx flippedOf). */}
    {bandStands(nav.expanded, host, shown) && createPortal(<div className="dp-wide dp-flip device-flip" data-device-flip={device.id} data-claims-keys="escape">
      <PlacedDevice device={device} view="whole" frame="flip" picture={draw} actions={actions}
        wrapRow={wrapRow} binding={binding} generic={generic} marks={marks} />
    </div>, host!)}
  </div>
}

/** Whether a chain plate draws its expanded band now: ▸ pressed for it, the frame's band host standing, and the plate itself shown —
 * a concealed chain (another mode's, a hidden detail area) expands nothing. Pure. */
export function bandStands(expanded: boolean | undefined, host: HTMLElement | null, shown: {width: number; height: number} | null): boolean {
  return !!expanded && !!host && !!shown
}

/** Where each place's room is read: the element the place stands in. The chain row, the window's room and the band (its
 * content box: as wide as the detail area, one wide Whole high — popout.tsx WIDE_WHOLE_H) are holders above the plate; a pane's Full
 * stands inset in its pane, and a widget's tile is the place itself, so those read their own box. */
const HOLDERS: Readonly<Record<Frame, (place: HTMLElement) => Element | null>> = {
  chain: place => place.parentElement?.closest('.detail-chain') ?? null,
  flip: place => place.parentElement?.closest('.device-flip') ?? null,
  window: place => place.parentElement?.closest('.device-window-room') ?? null,
  pane: place => place,
  rail: place => place,
}

/** The room a place gives its view (design.ts ViewProps.room): the content box of the element it stands in, at 100 % — over the zoom
 * the plate stands at. Null until measured, and while the place stands concealed. */
export function useHolderRoom(root: RefObject<HTMLElement | null>, frame: Frame, zoom = 1): Room | null {
  const [box, setBox] = useState<{w: number; h: number} | null>(null)
  useIsoLayoutEffect(() => {
    const place = root.current
    const holder = place ? HOLDERS[frame](place) : null
    if (!holder || typeof ResizeObserver === 'undefined') { setBox(null); return }
    const read = () => {
      const style = getComputedStyle(holder)
      const w = holder.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0')
      const h = holder.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0')
      const next = w > 0 && h > 0 ? {w, h} : null
      setBox(was => (was === next || (was && next && Math.abs(was.w - next.w) < 1 && Math.abs(was.h - next.h) < 1) ? was : next))
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(holder)
    return () => observer.disconnect()
  }, [root, frame])
  return useMemo(() => roomAt(box, zoom), [box, zoom])
}

/** A holder's box at 100 %: its size over the zoom the plate stands at, in whole px. Pure. */
export function roomAt(box: {w: number; h: number} | null, zoom = 1): Room | null {
  if (!box) return null
  const z = zoom > 0 ? zoom : 1
  return {w: Math.round(box.w / z), h: Math.round(box.h / z)}
}

/** The element's box while it is shown, null while it stands concealed (display none, or no element). */
export function useShownBox(element: RefObject<HTMLElement | null> | HTMLElement | null): {width: number; height: number} | null {
  const [box, setBox] = useState<{width: number; height: number} | null>(null)
  useIsoLayoutEffect(() => {
    const target = element && 'current' in element ? element.current : element
    if (!target || typeof ResizeObserver === 'undefined') { setBox(null); return }
    const read = () => {
      const rect = target.getBoundingClientRect()
      const next = rect.width > 0 && rect.height > 0 ? {width: rect.width, height: rect.height} : null
      setBox(was => (was === next || (was && next && Math.abs(was.width - next.width) < 1 && Math.abs(was.height - next.height) < 1) ? was : next))
    }
    read()
    const observer = new ResizeObserver(read)
    observer.observe(target)
    return () => observer.disconnect()
  }, [element])
  return box
}
const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

/** One device in one of its three runtime sizes (the earlier API): compact on a chain, whole in the pool, full in a pane. */
export function DeviceView({device, size, picture, actions, wrapRow, binding, generic, marks}: DeviceViewProps) {
  if (size === 'compact') return <ChainDevice device={device} picture={picture} actions={actions} wrapRow={wrapRow} binding={binding} generic={generic} marks={marks} />
  return <PlacedDevice device={device} view={size} picture={picture === undefined || picture === null || picture === false ? undefined : () => picture}
    actions={actions} wrapRow={wrapRow} binding={binding} generic={generic} marks={marks} />
}

/** A device whole (the pool, or its expanded view above the chain), full (a pane), in its own window (pop-out) or as its widget (the rail).
 * The pool's plate is 400 wide, scaled to the pool's width. The place's frame is the view's own place unless the caller names another
 * (Whole expanded is 'flip'); its room is the caller's, else the box it stands in (useHolderRoom). */
export function PlacedDevice({device, view, picture, actions, wrapRow, binding, generic, marks, onClose, frame, room, relayed}: {device: DeviceInstance;
  view: 'whole' | 'full' | 'popout' | 'widget'; picture?: (size: 'compact' | 'whole' | 'full') => ReactNode; actions?: readonly DeviceAction[]
  wrapRow?: DeviceViewProps['wrapRow']; binding?: DesignBinding; generic?: boolean; marks?: ReactNode
  /** Widget: take it off the rail (its tile's ✕). Pop-out: close its window (↗ in the window). */
  onClose?: () => void; frame?: Frame; room?: Room
  /** Drawn on the binding the main window relays (RelayedDevice.tsx): the device is published there, so its design draws here. */
  relayed?: boolean}) {
  const root = useRef<HTMLDivElement>(null)
  const hosting = useHosting(device, picture, actions, wrapRow, binding, generic, false, relayed)
  const nav = useNav(device, actions, root, marks)
  const scale = useContainerScale(root, '.device-pool', (box, natural) => poolScale(box.width, box.height, natural.height || undefined))
  const zoom = view === 'whole' && scale !== 1 ? scale : undefined
  const place = frame ?? FRAME_OF_VIEW[view]
  const measured = useHolderRoom(root, place, zoom ?? 1)
  return <div ref={root} className={`device-place device-place--${view}`} style={zoom ? {zoom} : undefined} data-plate-scale={view === 'whole' ? scale : undefined}
    data-device-frame={place}>
    <HostedDevice designed={hosting.designed} fallback={hosting.plain} binding={hosting.binding} view={view} keys={hosting.keys} title={device.face.title}
      wrap={hosting.wrap} frame={place} room={room ?? measured ?? undefined} nav={placedNav(view, nav, device.id, onClose)} acts={hosting.acts}
      className={`device device--${view}`}
      data={{'data-device': device.id, 'data-device-size': view === 'widget' || view === 'popout' ? view : sizeOf(view), 'data-device-light': lightOf(device),
        'data-device-design': hosting.generic ? 'generic' : hosting.designed.id}} />
  </div>
}

/** Each view's own place (design.ts Frame): Whole in its band above the chain, Full in a pane, Pop-out in its window, Widget on the rail. */
export const FRAME_OF_VIEW: Readonly<Record<'whole' | 'full' | 'popout' | 'widget', Frame>> = {whole: 'flip', full: 'pane', popout: 'window', widget: 'rail'}

/** What the head offers in each place (manual §16.4: activator, ▸, name; the rail, ▦ and ↗ at the right). Whole — in the pool, expanded,
 * docked in the window — carries ▸, the rail, ▦ and ↗; in its window ↗ closes the window. A widget opens full, pops out, and leaves
 * the rail by its ✕; Full holds no controls. Pure. */
export function placedNav(view: 'whole' | 'full' | 'popout' | 'widget', nav: HostNav, deviceId: string, onClose?: () => void): HostNav {
  const popout = view === 'popout' && onClose ? onClose : nav.popout
  const expand = nav.expand ? {expand: nav.expand, expanded: nav.expanded} : {}
  switch (view) {
    case 'full': return {}
    case 'widget': return {full: nav.full, select: nav.select, close: onClose ?? (() => takeOffRail(deviceId)), ...(popout ? {popout} : {})}
    case 'popout': return {full: nav.full, ...expand, ...(popout ? {popout} : {})}
    case 'whole': return {full: nav.full, rail: nav.rail, marks: nav.marks, ...expand, ...(popout ? {popout} : {})}
  }
}
