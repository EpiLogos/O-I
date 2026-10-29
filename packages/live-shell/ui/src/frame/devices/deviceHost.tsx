// The host: one device's views on one binding (manual §16.3 "A device has one set of values and six views. A change in one view
// shows in the others at once"; §5.2 "A change and its answer"). Ported from the gallery's host (inhabitants/catalogue/
// main.tsx:103-134 DesignedViews: one set of values, a set that writes a key or drops it, the page and the fold the host owns) onto
// the owner's values and writes, and from the plate's release law (frame/devices/plateControls.tsx:56-81 useOwnerDraft: a draft
// while the hand moves, sent on release or on a key, pending until the owner's reading changes).
//
// The state of a device's host is kept per device id, outside any one view, so the chain, the pool, the pane and the rail draw the
// same draft while the hand moves, and the same waiting value after:
//   • while you drag, the control shows the value you set (a draft); nothing is sent;
//   • when you let go — or press a key, click a toggle, choose from a menu — the drafts go to the binding's write in one change;
//   • until the owner's reading confirms a sent value it is drawn waiting (the kit's standing: italics, the arc dashed); a reading
//     that moves to anything else ends the wait and the owner's value stands; a write that resolves with no new reading ends it
//     after a short grace, and the owner's value stands;
//   • a refusal returns the control to the owner's value and gives the owner's reason to the status bar's Info line.
// No Send button anywhere (§11). A key the view holds itself (DesignBinding.local: a raised reach, an ask) is no draft: each set of
// it, its drop included, goes to the binding's own hand at once.
//
// Each view is drawn as its own component inside the place's boundary: a view that throws stands down for the generic plate's view
// of the same device, which says why on the status bar's Info line — never a blank place.
import {Component, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps,
  type CSSProperties, type MouseEvent, type ReactElement, type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {ControlWrapContext, Panel, PlaceContext, Tile, type ControlWrap, type PanelProps, type RackPart, type RackShown, type Standing} from '../../inhabitants/sdk/panel'
import type {PublishedDevice} from './deviceDoor'
import {DeviceMenu, headMenu, type DeviceMenuState, type HeadMenuItem} from './DeviceMenu'
import type {DesignBinding, DesignedDevice, DeviceViewName, HostNav, HostedViewProps, Value, ValueChange, Values} from './designed'
import {DEVICE_VIEWS} from './designed'
import type {Frame, Room} from '../../inhabitants/catalogue/panels/design'
import {popoutOf} from '../../inhabitants/catalogue/panels/popout'

// ---------------------------------------------------------------------------------------------------------------- the host's state

interface Sent {readonly value: Value; readonly base: Value | undefined; readonly resolved: boolean}
interface Refusal {readonly reason: string; readonly base: Value | undefined}
export interface HostState {
  /** What the hand has set and not yet sent. */
  readonly drafts: Readonly<Record<string, Value>>
  /** What was sent and the owner has not yet confirmed, with the owner's reading at the time it was sent. */
  readonly sent: Readonly<Record<string, Sent>>
  /** The owner's last refusal of a key, with its reading then; it stands until the next move or a new reading. */
  readonly refused: Readonly<Record<string, Refusal>>
  readonly page: string | null
  readonly folded: boolean
  /** A rack's parts its head hides (Live's rack head: macros, chain list, devices), kept with the device as its fold is; absent, all show. */
  readonly rack?: Partial<RackShown>
}

const EMPTY: HostState = {drafts: {}, sent: {}, refused: {}, page: null, folded: false}
const states = new Map<string, HostState>()
const listeners = new Map<string, Set<() => void>>()

export function hostState(id: string): HostState {
  return states.get(id) ?? EMPTY
}

function update(id: string, change: (state: HostState) => HostState): void {
  const was = hostState(id), next = change(was)
  if (next === was) return
  states.set(id, next)
  for (const listener of listeners.get(id) ?? []) listener()
}

function useHostState(id: string): HostState {
  const subscribe = useCallback((listener: () => void) => {
    let held = listeners.get(id)
    if (!held) listeners.set(id, held = new Set())
    held.add(listener)
    return () => { held!.delete(listener) }
  }, [id])
  return useSyncExternalStore(subscribe, () => hostState(id), () => hostState(id))
}

const without = <T,>(record: Readonly<Record<string, T>>, keys: Iterable<string>): Record<string, T> => {
  const next = {...record}
  for (const key of keys) delete next[key]
  return next
}

/** The owner's reading ends a wait it answers and a refusal it supersedes (the owner's value stands, never a copy). Pure. */
export function reconcile(state: HostState, owner: Values): HostState {
  const done = Object.keys(state.sent).filter(key => owner[key] !== state.sent[key]!.base)
  const cleared = Object.keys(state.refused).filter(key => owner[key] !== state.refused[key]!.base)
  if (!done.length && !cleared.length) return state
  return {...state, sent: without(state.sent, done), refused: without(state.refused, cleared)}
}

/** The values a view draws: the owner's readings, under them what waits on the owner, over them what the hand holds. Pure. */
export function hostedValues(state: HostState, owner: Values): Values {
  const shown: Record<string, Value> = {...owner}
  for (const [key, sent] of Object.entries(state.sent)) shown[key] = sent.value
  for (const [key, value] of Object.entries(state.drafts)) shown[key] = value
  return shown
}

/** The standing of each value (manual §16.10) from the host's state and the binding. Pure. */
export function hostedStanding(state: HostState, binding: DesignBinding, keys: Iterable<string>): Record<string, Standing> {
  const all = new Set<string>([...keys, ...Object.keys(binding.values), ...Object.keys(state.sent), ...Object.keys(state.refused),
    ...Object.keys(binding.heldBy ?? {}), ...Object.keys(binding.standing ?? {})])
  const out: Record<string, Standing> = {}
  for (const key of all) {
    const holder = binding.heldBy?.[key]
    // Who moved it, when something other than the hand does: the owner's word, else whoever holds or modulates the value. The kit shows
    // the name only with the ring of a change, never from the first draw.
    const mover = binding.movedBy?.[key] ?? holder ?? binding.modulatedBy?.[key]
    const waits = binding.waiting === true || (Array.isArray(binding.waiting) && binding.waiting.includes(key))
    // A key the view holds is the binding's own: it neither waits on an owner nor is a reading.
    const local = !!binding.local?.[key]
    const disabled = local ? undefined : !binding.write ? 'No owner takes a change here.' : binding.writes && !binding.writes(key) ? 'A reading: the owner reports it; nothing here changes it.' : undefined
    const standing: Standing = {
      ...binding.standing?.[key],
      ...(key in state.sent && !(key in state.drafts) ? {pending: true} : {}),
      ...(state.refused[key] ? {refused: state.refused[key]!.reason} : {}),
      ...(holder ? {heldBy: holder, ...(binding.handBack ? {onHandBack: () => void binding.handBack!(key)} : {})} : {}),
      ...(binding.modulatedBy?.[key] ? {modulatedBy: binding.modulatedBy[key]} : {}),
      ...(mover ? {movedBy: mover} : {}),
      ...(waits && !local && !(key in binding.values) ? {waiting: true} : {}),
      ...(disabled && !binding.standing?.[key]?.disabled ? {disabled} : {}),
    }
    if (Object.keys(standing).length) out[key] = standing
  }
  return out
}

/** The standing of each key the place wraps, naming its key (sdk/panel.tsx Standing.valueKey): the kit control that spreads it is
 * drawn inside the place's wrap (ControlWrapContext). A key with no other standing gets one that only names it. Pure. */
export function namedStanding(standing: Readonly<Record<string, Standing>>, keys: Iterable<string>): Record<string, Standing> {
  const out: Record<string, Standing> = {...standing}
  for (const key of keys) out[key] = {...standing[key], valueKey: key}
  return out
}

/** How long a resolved write waits for the owner's reading before the owner's value stands again. */
export const CONFIRM_GRACE_MS = 4000

/** Send what the hand holds to the owner (one change), and hold it waiting. Resolves with the owner's refusal, if any. */
export async function flushDrafts(binding: DesignBinding, grace: number = CONFIRM_GRACE_MS): Promise<string | null> {
  const state = hostState(binding.id)
  const changes: ValueChange[] = Object.entries(state.drafts).filter(([key, value]) => value !== binding.values[key]).map(([key, value]) => ({key, value}))
  if (!Object.keys(state.drafts).length) return null
  if (!changes.length) { update(binding.id, was => ({...was, drafts: {}})); return null }
  const refusal = !binding.write ? 'No owner takes a change of this device here.'
    : changes.find(change => binding.writes && !binding.writes(change.key)) ? 'A reading: the owner reports it; nothing here changes it.' : null
  if (refusal) { refuse(binding, changes, refusal); return refusal }
  update(binding.id, was => {
    const sent = {...was.sent}
    for (const change of changes) sent[change.key] = {value: change.value, base: binding.values[change.key], resolved: false}
    return {...was, drafts: without(was.drafts, changes.map(change => change.key)), sent, refused: without(was.refused, changes.map(change => change.key))}
  })
  try {
    await binding.write!(changes)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'The owner refused the change.'
    refuse(binding, changes, reason)
    return reason
  }
  // Accepted: the wait ends when the owner's reading moves. If it never does, the owner's value stands again after the grace.
  update(binding.id, was => {
    const sent = {...was.sent}
    for (const change of changes) if (sent[change.key]?.value === change.value) sent[change.key] = {...sent[change.key]!, resolved: true}
    return {...was, sent}
  })
  setTimeout(() => update(binding.id, was => {
    const stale = changes.filter(change => was.sent[change.key]?.resolved && was.sent[change.key]!.value === change.value).map(change => change.key)
    return stale.length ? {...was, sent: without(was.sent, stale)} : was
  }), grace)
  return null
}

function refuse(binding: DesignBinding, changes: readonly ValueChange[], reason: string): void {
  update(binding.id, was => {
    const refused = {...was.refused}
    for (const change of changes) refused[change.key] = {reason, base: binding.values[change.key]}
    return {...was, drafts: without(was.drafts, changes.map(change => change.key)), sent: without(was.sent, changes.map(change => change.key)), refused}
  })
}

/** A view's set on its binding: a key the view holds goes to the binding's own hand at once, its drop (undefined) included
 * (designed.ts DesignBinding.local) — nothing waits for the hand's release and nothing reaches the owner; any other key is a draft,
 * or the drop of one. Whether a draft moved (the host sends drafts when the hand lets go). */
export function setHosted(binding: DesignBinding, key: string, value: Value | undefined): boolean {
  const hand = binding.local?.[key]
  if (hand) { hand(value); return false }
  setDraft(binding.id, key, value)
  return true
}

/** Set a value from a view: a draft, or a drop of the draft (undefined). The refusal of a key ends with its next move. */
export function setDraft(id: string, key: string, value: Value | undefined): void {
  update(id, was => {
    const drafts = {...was.drafts}
    if (value === undefined) delete drafts[key]; else drafts[key] = value
    return {...was, drafts, refused: key in was.refused ? without(was.refused, [key]) : was.refused}
  })
}

export function setHostPage(id: string, page: string): void {
  update(id, was => (was.page === page ? was : {...was, page}))
}

export function setHostFolded(id: string, folded: boolean): void {
  update(id, was => (was.folded === folded ? was : {...was, folded}))
}

/** Show or hide one part of a rack (its head's mark): every place the rack stands in draws the same, and the chain that draws the rack's
 * members beside it reads the same (rackShownOf). */
export function setHostRack(id: string, part: RackPart, shown: boolean): void {
  update(id, was => ((was.rack?.[part] ?? true) === shown ? was : {...was, rack: {...was.rack, [part]: shown}}))
}

/** The rack's shown parts and their hand that a hosted view hands its place (HostedDevice → DrawnView). */
const RackHost = createContext<{readonly shown: Partial<RackShown>; readonly onShow: (part: RackPart, shown: boolean) => void} | undefined>(undefined)

/** Whether a rack shows a part now (all show until its mark hides one). */
export const rackShownOf = (id: string, part: RackPart): boolean => hostState(id).rack?.[part] ?? true

/** The same, for a chain that draws a rack's members beside it (Live: the devices of the chosen chain), redrawn when the mark moves. */
export function useRackShown(id: string, part: RackPart): boolean {
  return useHostState(id).rack?.[part] ?? true
}

/** Drop a device's host state (tests; a device withdrawn for good). */
export function resetHost(id?: string): void {
  if (id === undefined) states.clear(); else states.delete(id)
}

// ---------------------------------------------------------------------------------------------------------------- the Info line

/** Say the owner's words on the status bar's Info line. The Info view reads whatever `data-i` the last `mouseover` reached
 * (components/StatusBar.tsx:33-46 useInfoView, the shell's one info law); the host says a refusal through that same law, from the
 * plate the change was made on, and takes its words off again at once so pointing elsewhere reads as before. */
export function sayOnInfoLine(from: Element | null, label: string, words: string): void {
  if (!from || typeof MouseEvent === 'undefined') return
  const had = from.getAttribute('data-i')
  from.setAttribute('data-i', `${label}|${words}`)
  try { from.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})) } finally {
    if (had === null) from.removeAttribute('data-i'); else from.setAttribute('data-i', had)
  }
}

// ---------------------------------------------------------------------------------------------------------------- one view, hosted

/** The words for a view that did not draw, for the status bar's Info line. */
export function faultWords(view: DeviceViewName, cause: string, standsIn: boolean): string {
  return `Its own ${view} view did not draw: ${cause}.${standsIn ? ' The generic plate stands in.' : ''}`
}

const causeOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause)).replace(/\.$/, '')

/** A view that throws stands down for `fallback` (the generic plate's view of the same device): one design that does not draw
 * never takes the device off its place (the catalogue's own rule, panels/index.ts: "one device that does not build never stops
 * another"). */
export class ViewBoundary extends Component<{id: string; fallback: (cause: string) => ReactNode; onFault?: (cause: string) => void; children: ReactNode},
  {failed: string | null}> {
  state: {failed: string | null} = {failed: null}
  static getDerivedStateFromError(cause: unknown) { return {failed: causeOf(cause)} }
  componentDidCatch(cause: unknown) {
    console.warn(`A view of ${this.props.id} did not draw; the generic plate draws it.`, cause)
    this.props.onFault?.(causeOf(cause))
  }
  render() { return this.state.failed === null ? this.props.children : this.props.fallback(this.state.failed) }
}

/** Hand a design's kit head the place's marks it does not draw itself — the place's marks and the rail mark on a Panel, the ✕ on
 * a Tile — through the kit's own props, as the generic plate passes them (genericDevice.tsx `head`). A design that draws them is
 * left as it is. */
export function withPlaceMarks(node: ReactNode, nav: HostNav): ReactNode {
  if (!isValidElement(node)) return node
  if (node.type === Panel) {
    const given = node.props as PanelProps
    const fill: Partial<PanelProps> = {
      ...(given.marks === undefined && nav.marks !== undefined && nav.marks !== null ? {marks: nav.marks} : {}),
      ...(given.onRail === undefined && nav.rail ? {onRail: nav.rail} : {}),
    }
    return Object.keys(fill).length ? cloneElement(node as ReactElement<PanelProps>, fill) : node
  }
  if (node.type === Tile) {
    const given = node.props as ComponentProps<typeof Tile>
    return given.onClose === undefined && nav.close ? cloneElement(node as ReactElement<ComponentProps<typeof Tile>>, {onClose: nav.close}) : node
  }
  return node
}

/** The room a window gives Pop-out when its host names none (the gallery's window, catalogue/main.tsx). */
const POPOUT_ROOM: Room = {w: 1180, h: 620}

// ---------------------------------------------------------------------------------------------------------------- views by place
// Manual §16.3: "A device has one set of values and up to six views. It has the views of the places it stands in". A design declares
// its kind and its views (design.ts `kind`, `views`; absent views: all six); the host draws no view of a place the device does not
// stand in, and offers no mark that would take it there — a monitor has no fold, no ▸ and no chain plate, only its tile and its
// Full, and its window holds its Full.

/** The views a design has. Pure. */
export function viewsOf(design: Pick<DesignedDevice, 'views'>): readonly DeviceViewName[] {
  return design.views ?? DEVICE_VIEWS
}

/** The view a place draws of a design, or null where the device does not stand in that place. Its window stands wherever it has a
 * Full: "Its window holds its Full" (§16.3). Pure. */
export function viewIn(design: Pick<DesignedDevice, 'views'>, asked: DeviceViewName): DeviceViewName | null {
  const has = viewsOf(design)
  if (has.includes(asked)) return asked
  return asked === 'popout' && has.includes('full') ? 'popout' : null
}

/** The navigation a design's views allow (§16.4): ▸ and the press to the pool only with Whole, the fold only with Folded, the rail mark
 * only with Widget, ⤢ only with Full, ↗ only with a window. Pure. */
export function navWithin(design: Pick<DesignedDevice, 'views'>, nav: HostNav): HostNav {
  const has = new Set(viewsOf(design))
  if (has.size === DEVICE_VIEWS.length) return nav
  const {select, expand, expanded, full, popout, fold, unfold, rail, ...rest} = nav
  return {
    ...rest,
    ...(has.has('whole') ? {select, expand, expanded} : {}),
    ...(has.has('folded') ? {fold, unfold} : {}),
    ...(has.has('widget') ? {rail} : {}),
    ...(has.has('full') ? {full} : {}),
    ...(has.has('popout') || has.has('full') ? {popout} : {}),
  }
}

/** Where a device of each kind stands (manual §16.1's table), for the words of a place it does not stand in. */
const STANDS: Readonly<Record<string, string>> = {
  monitor: 'on the rail and full in a pane, never on a chain',
  connection: 'on its workcell\'s chain',
  instrument: 'at the head of a track\'s chain, or in a pane',
}

/** The words for a place a device does not stand in. Pure. */
export function notHereWords(design: Pick<DesignedDevice, 'views' | 'kind' | 'title'>, view: DeviceViewName): string {
  const where = STANDS[design.kind] ?? `in its places: ${viewsOf(design).join(', ')}`
  return `${design.title} has no ${view} view: it stands ${where}.`
}

/** One view of a device, drawn as its own component: what it throws is caught by the boundary around it, never in the host's
 * render. */
function DrawnView({device, view, props, wrap}: {device: DesignedDevice; view: DeviceViewName; props: HostedViewProps; wrap?: ControlWrap}) {
  // A rack's shown parts and their hand, kept by the host per device (HostedDevice's RackHost).
  const rack = useContext(RackHost)
  // The place reaches every Panel, PanelHead and Tile inside the view through the kit's PlaceContext (sdk/panel.tsx, the
  // documentation lane's c5afc4aa0) — a view whose root is a component too; a part's own props still win. The place's wrap reaches
  // every kit control whose standing names its key through ControlWrapContext; a view drawn without one (the generic plate, which
  // wraps its rows itself) gets none, even inside another's.
  // The place's ▸ (the expanded view, Whole above the chain) and ↗ (the device's own window) reach the kit's head the same way (d18c911a3:
  // "The kit's Place carries onExpand, expanded and onPopout, so no design passes them").
  const {nav} = props
  // Pop-out is composed by the host where the design writes none of its own: Full over Whole (catalogue/panels/popout.tsx); a device with
  // no Whole has its Full alone in its window.
  const room = props.room ?? POPOUT_ROOM
  const drawn = view !== 'popout' ? device[view](props)
    : device.popout || viewsOf(device).includes('whole') ? popoutOf(device, props, room)
      : <div className="dp-window-body">{device.full({...props, frame: 'window', room})}</div>
  return <PlaceContext.Provider value={{marks: nav.marks ?? undefined, onRail: nav.rail, onClose: nav.close, onExpand: nav.expand, expanded: nav.expanded,
    onPopout: nav.popout, ...(rack ? {rackShown: rack.shown, onRackShow: rack.onShow} : {})}}>
    <ControlWrapContext.Provider value={wrap ?? null}>{withPlaceMarks(drawn, nav)}</ControlWrapContext.Provider>
  </PlaceContext.Provider>
}

export interface HostedDeviceProps {
  readonly designed: DesignedDevice
  /** The generic plate of the same device, drawn when `designed` is a design that fails. */
  readonly fallback?: DesignedDevice
  readonly binding: DesignBinding
  readonly view: DeviceViewName
  readonly nav: HostNav
  /** Keys whose standing the views ask for beyond the owner's readings (a generic plate's rows). */
  readonly keys?: readonly string[]
  readonly className?: string
  readonly style?: CSSProperties
  readonly data?: Readonly<Record<`data-${string}`, string | undefined>>
  /** The device's name, for the Info line's words. */
  readonly title?: string
  /** On a chain: the compact view folds to its strip by ▾ and opens by its title (the host keeps the fold, so every chain place of
   * the device folds together). */
  readonly chain?: boolean
  /** The place's wrap of `designed`'s kit controls, by value key (DeviceView fills it from the place's wrapRow): the controls of
   * `keys` are drawn inside it. Never the fallback's: the generic plate wraps its rows itself. */
  readonly wrap?: ControlWrap
  /** Where the view stands, for a design that arranges Whole differently in the pool and expanded (design.ts ViewProps.frame). */
  readonly frame?: Frame
  /** The room the place gives the view, in px at 100 % (design.ts ViewProps.room). */
  readonly room?: Room
  /** The head's context-menu acts the device's chain owner carries (deviceDoor.ts PublishedDevice.acts); Fold is the host's own. */
  readonly acts?: PublishedDevice['acts']
  /** A rack's door to its members, for its Full and its window (design.ts ViewProps.member; DeviceView.tsx PlacedDevice). */
  readonly member?: (id: string) => ReactNode | null
}

/** Where a right-click opens the device's menu: its head, its folded strip, its tile's head (manual §16.4 "Right-click the head"). */
const HEAD_SELECTOR = '.dp-head, .dp-folded, .dp-tile-head'

/** One view of one device on its binding. The element it draws listens for the hand's release (a pointer let go anywhere, a key, a
 * click, a menu's change) and sends what the hand set. */
export function HostedDevice({designed, fallback, binding, view: asked, nav: given, keys, className, style, data, title, chain, wrap, frame, room, acts, member}: HostedDeviceProps) {
  const id = binding.id
  const state = useHostState(id)
  // The view the place asks for, where the device stands there (folded on its chain when the hand folded it), else none.
  const folds = viewIn(designed, 'folded') !== null
  const placed = viewIn(designed, chain && asked === 'compact' && state.folded && folds ? 'folded' : asked)
  const view: DeviceViewName = placed ?? asked
  const nav: HostNav = useMemo(() => navWithin(designed, chain && folds ? {...given, fold: () => setHostFolded(id, true), unfold: () => setHostFolded(id, false)} : given),
    [chain, folds, given, id, designed])
  // A rack's head marks write here, so every place the rack stands in shows the same parts (manual §16.4).
  const rack = useMemo(() => (designed.kind === 'rack' ? {shown: state.rack ?? {}, onShow: (part: RackPart, shown: boolean) => setHostRack(id, part, shown)} : undefined), [designed.kind, state.rack, id])
  const root = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const wraps = !!wrap
  const live = useRef(binding)
  live.current = binding
  // The owner's new reading ends what it answers.
  useEffect(() => { update(id, was => reconcile(was, binding.values)) }, [id, binding.values])
  const scheduled = useRef(false)
  const send = useCallback(() => {
    if (scheduled.current) return
    scheduled.current = true
    queueMicrotask(() => {
      scheduled.current = false
      if (dragging.current) return
      void flushDrafts(live.current).then(refusal => {
        if (refusal) sayOnInfoLine(root.current, title ? `${title}: refused` : 'Refused', refusal)
      })
    })
  }, [title])
  const set = useCallback((key: string, value: Value | undefined) => {
    if (setHosted(live.current, key, value) && !dragging.current) send()
  }, [send])
  const props: HostedViewProps = useMemo(() => ({
    v: hostedValues(state, binding.values),
    set,
    nav,
    page: state.page ?? designed.firstPage ?? '',
    setPage: page => setHostPage(id, page),
    // Where the place wraps the design's controls, each key's standing names its key, so the control that spreads it is wrapped.
    standing: wraps ? namedStanding(hostedStanding(state, binding, keys ?? []), keys ?? []) : hostedStanding(state, binding, keys ?? []),
    owner: binding.values,
    ...(frame ? {frame} : {}),
    ...(room ? {room} : {}),
    ...(member ? {member} : {}),
  }), [state, binding, set, nav, designed.firstPage, id, keys, wraps, frame, room, member])
  const release = () => { if (!dragging.current) return; dragging.current = false; send() }
  // The place's boundary: the device's own view, else the generic plate's with the reason, else the reason alone.
  const plain = fallback && fallback !== designed ? fallback : null
  // A design and the generic plate share the device's id: the boundary starts afresh when either takes the place, or the view changes.
  const at = `${plain ? 'own' : 'generic'}:${designed.id}:${view}`
  const [fault, setFault] = useState<{at: string; words: string} | null>(null)
  const name = title ?? designed.title
  const note = (words: string) => <p className="device-fault" data-i={`${name}|${words}`}>{name}: {words}</p>
  const shown = fault?.at === at ? fault.words : undefined
  // The head's context menu: Fold where the device stands on its chain, then its chain owner's acts (DeviceMenu.tsx headMenu).
  const [menu, setMenu] = useState<DeviceMenuState | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const openMenu = (event: MouseEvent<HTMLDivElement>) => {
    const head = (event.target as Element).closest(HEAD_SELECTOR)
    if (!head || !root.current?.contains(head)) return
    event.preventDefault()
    event.stopPropagation()
    setMenu({x: event.clientX, y: event.clientY, subject: name, items: headMenu({onChain: !!chain && folds, folded: state.folded, acts})})
  }
  const invoke = (id: HeadMenuItem['id']) => {
    if (id === 'fold') (state.folded ? nav.unfold : nav.fold)?.()
    else acts?.[id]?.()
  }
  return <div ref={root} className={`${className ?? ''}${view === 'folded' ? ' device--folded' : ''}`} style={style} {...data} data-device-view={view}
    data-device-fault={shown} data-i={shown ? `${name}|${shown}` : undefined} onContextMenu={openMenu}
    onPointerDownCapture={event => {
      if (event.button !== 0) return
      dragging.current = true
      const end = () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); release() }
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    }}
    onClickCapture={() => queueMicrotask(send)} onChangeCapture={() => queueMicrotask(send)}>
    {placed === null ? <p className="device-fault" data-device-absent={asked} data-i={`${name}|${notHereWords(designed, asked)}`}>{notHereWords(designed, asked)}</p> :
    <RackHost.Provider value={rack}><ViewBoundary key={at} id={designed.id} onFault={cause => setFault({at, words: faultWords(view, cause, !!plain)})}
      fallback={cause => plain
        ? <ViewBoundary id={plain.id} fallback={again => note(faultWords(view, again, false))}>
          <DrawnView device={plain} view={view} props={{...props, fault: faultWords(view, cause, true)}} />
        </ViewBoundary>
        : note(faultWords(view, cause, false))}>
      <DrawnView device={designed} view={view} props={props} wrap={wrap} />
    </ViewBoundary></RackHost.Provider>}
    {menu && typeof document !== 'undefined' && createPortal(<DeviceMenu menu={menu} onInvoke={invoke} onClose={closeMenu} />, document.body)}
  </div>
}
