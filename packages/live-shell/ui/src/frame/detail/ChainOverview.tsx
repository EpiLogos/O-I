// The chain's overview (manual §10.1 "the selected track's name and a small picture of its chain"; §16.4): the whole chain in
// miniature beside the Device switch, as Live draws the selected track's devices after its name at the bottom right
// (reverse-engineering evidence/ui/live-arrangement-real.png). A box over it marks what Device view shows, as the outline of
// Live's Arrangement overview "represents the currently displayed part" (Live 12 manual, Arrangement View, Layout 1). Drag in it
// to scroll the chain; press outside the box to bring that part into view; the wheel scrolls it too.
//
// It reads the chain it is given as drawn: every plate (a device on its chain, a folded device, a rack and the devices inside it)
// by its place in the row, and the parts each plate draws (its title bar, its display, its sections and its controls), measured
// again when the row resizes or changes. The picture is that drawing at one scale in both directions, as Live's (and the shell
// mockup's) is the chain itself made small, not a block for each device (O-I ticket 748). It writes nothing but the row's scroll.
// The row Device view shows also turns under the wheel, as Live's Device View does (publishShownChain).
import {Fragment, useEffect, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type WheelEvent} from 'react'
import './chainOverview.css'

/** The plates a chain draws, of every family: the kit's panels and folds, the runtime's generic plate, Technē's faces, the
 * Expressions rack card, and the chain's end. */
const PLATE = 'section.dp, section.dp-folded, .device, .techne-device, .native-rack-card, .dropz'
/** The parts of a plate the picture draws, by kind: its title bar, its display (a picture, a screen, a thumbnail), the sections its
 * body is ruled into, and its controls. */
const PART_HEAD = '.dp-head, .dp-tile-head, .sdk-face__head'
const PART_DISPLAY = '.dp-display, .dp-thumb, canvas'
const PART_SECTION = '.dp-sec'
const PART_CONTROL = '.dp-dial, .dp-meter, .dp-pad, .dp-toggle, .dp-radio, .dp-lamp, .dp-swatch, .dp-action, .dp-row, .dp-tile'
const PARTS = [PART_HEAD, PART_DISPLAY, PART_SECTION, PART_CONTROL].join(', ')
/** The most parts one reading measures: a long chain stays a cheap read. */
const MOST_PARTS = 600

export type PartKind = 'head' | 'display' | 'section' | 'control'
/** A part a plate draws, where it stands in the whole row (the row's own pixels, from its top left). */
export interface OverviewPart {
  readonly kind: PartKind
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export type PlateLight = 'lit' | 'dark' | 'unknown'
export interface OverviewPlate {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** 0 a plate of the row; 1 a device inside a rack's Devices view. */
  readonly depth: 0 | 1
  readonly name: string
  readonly folded: boolean
  readonly end: boolean
  readonly light: PlateLight
  /** What it draws, for the picture. */
  readonly parts: readonly OverviewPart[]
}
export interface OverviewReading {
  readonly scrollWidth: number
  readonly clientWidth: number
  readonly clientHeight: number
  readonly scrollLeft: number
  readonly plates: readonly OverviewPlate[]
}

const nameOf = (plate: Element): string => (plate.getAttribute('aria-label') ?? plate.querySelector('.dp-title, .sdk-face__title')?.textContent ?? '').replace(/, folded$/, '').trim()

/** The chain as drawn, read from its row: where each plate stands along the whole row. Pure over the DOM it is given. */
export function readChain(row: HTMLElement): OverviewReading {
  const box = row.getBoundingClientRect()
  const origin = box.left + row.clientLeft - row.scrollLeft, top = box.top + row.clientTop - row.scrollTop
  const found = [...row.querySelectorAll<HTMLElement>(PLATE)].filter(plate => plate.getClientRects().length > 0)
  const plates: (OverviewPlate & {parts: OverviewPart[]})[] = []
  const depthOf = new Map<Element, number>(), drawnAs = new Map<Element, number>()
  const foldedIs = (plate: Element) => plate.matches('.dp-folded') || plate.getAttribute('data-expanded') === 'false'
  for (const plate of found) {
    const rect = plate.getBoundingClientRect()
    if (rect.width < 1) continue
    const outer = plate.parentElement?.closest(PLATE)
    // A plate that wraps the same plate (the device host around a kit panel or its fold) is that plate once, folded if the inner is.
    if (outer && depthOf.has(outer) && Math.abs(outer.getBoundingClientRect().width - rect.width) < 4) {
      depthOf.set(plate, depthOf.get(outer)!)
      const at = drawnAs.get(outer)
      if (at !== undefined) { drawnAs.set(plate, at); if (foldedIs(plate)) plates[at] = {...plates[at]!, folded: true} }
      continue
    }
    const depth = outer && depthOf.has(outer) ? depthOf.get(outer)! + 1 : 0
    depthOf.set(plate, depth)
    if (depth > 1) continue
    const light = plate.querySelector('.dp-activator')?.getAttribute('data-light')
    drawnAs.set(plate, plates.length)
    plates.push({x: rect.left - origin, y: rect.top - top, w: rect.width, h: rect.height, depth: depth as 0 | 1, name: nameOf(plate),
      folded: foldedIs(plate), end: plate.matches('.dropz'),
      light: light === 'lit' || light === 'dark' ? light : 'unknown', parts: []})
  }
  // What each plate draws, given to the plate it stands in (a device inside a rack's to that device).
  let measured = 0
  for (const part of row.querySelectorAll<HTMLElement>(PARTS)) {
    if (measured >= MOST_PARTS) break
    const at = drawnAs.get(part.closest(PLATE) ?? row)
    if (at === undefined) continue
    const rect = part.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) continue
    measured += 1
    plates[at]!.parts.push({kind: partKind(part), x: rect.left - origin, y: rect.top - top, w: rect.width, h: rect.height})
  }
  return {scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, clientHeight: row.clientHeight, scrollLeft: row.scrollLeft, plates}
}

const partKind = (part: Element): PartKind =>
  part.matches(PART_HEAD) ? 'head' : part.matches(PART_DISPLAY) ? 'display' : part.matches(PART_SECTION) ? 'section' : 'control'

/** The one scale the picture draws the row at: the room along, or the overview's height over the row's, whichever is less. Pure. */
export const pictureScale = (reading: Pick<OverviewReading, 'scrollWidth' | 'clientHeight'>, room: number, tall: number): number =>
  Math.min(room / Math.max(1, reading.scrollWidth), tall / Math.max(1, reading.clientHeight))

/** The chain made small: each plate where it stands, and in it its title bar (lit as its activator is), its display, its sections and
 * its controls, all at one scale. Pure over the reading. */
export function ChainPicture({reading, room, tall}: {reading: OverviewReading; room: number; tall: number}) {
  const s = pictureScale(reading, room, tall)
  return <>{reading.plates.map((plate, i) => <Fragment key={i}>
    <span className="chain-overview-plate" data-name={plate.name || undefined} data-depth={plate.depth}
      data-folded={plate.folded ? 'true' : undefined} data-end={plate.end ? 'true' : undefined} data-light={plate.light}
      style={{left: plate.x * s, top: plate.y * s, width: Math.max(1, plate.w * s), height: Math.max(1, plate.h * s)}} />
    {plate.parts.map((part, j) => <span key={j} className="chain-overview-part" data-part={part.kind} data-depth={plate.depth}
      data-light={part.kind === 'head' ? plate.light : undefined}
      style={{left: part.x * s, top: part.y * s, width: Math.max(1, part.w * s), height: Math.max(1, part.h * s)}} />)}
  </Fragment>)}</>
}

/** How far the wheel moves the chain Device view shows sideways, as Live's Device View turns under the wheel (§16.4; the shell mockup's
 * chain), or null where it leaves the wheel alone: a chain that fits, a wheel already sideways (the row's own scroll), or a wheel over a
 * list inside a device that scrolls by itself. A wheel counted in lines moves sixteen pixels a line, one counted in pages a view. Pure. */
export function wheelAlong(chain: {readonly scrollWidth: number; readonly clientWidth: number},
  wheel: {readonly deltaX: number; readonly deltaY: number; readonly deltaMode?: number}, overOwnList: boolean): number | null {
  if (chain.scrollWidth <= chain.clientWidth + 1 || overOwnList || Math.abs(wheel.deltaX) >= Math.abs(wheel.deltaY)) return null
  return wheel.deltaMode === 1 ? wheel.deltaY * 16 : wheel.deltaMode === 2 ? wheel.deltaY * chain.clientWidth : wheel.deltaY
}

/** Whether the wheel's target stands in a list of the row that scrolls up and down by itself (a long text, a page of rows). */
function overOwnList(target: EventTarget | null, row: HTMLElement): boolean {
  for (let at = target instanceof Element ? target : null; at && at !== row; at = at.parentElement) {
    if (at.scrollHeight <= at.clientHeight + 1) continue
    const overflow = getComputedStyle(at).overflowY
    if (overflow === 'auto' || overflow === 'scroll') return true
  }
  return false
}

function onRowWheel(event: globalThis.WheelEvent): void {
  const row = event.currentTarget as HTMLElement
  const by = wheelAlong(row, event, overOwnList(event.target, row))
  if (by === null) return
  event.preventDefault()
  row.scrollLeft = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, row.scrollLeft + by))
}

/** The scroll that brings a point of the whole row (in the row's own pixels) to the middle of what Device view shows. Pure. */
export const centredOn = (x: number, reading: Pick<OverviewReading, 'scrollWidth' | 'clientWidth'>): number =>
  Math.max(0, Math.min(reading.scrollWidth - reading.clientWidth, x - reading.clientWidth / 2))

/** The row's reading, kept as it scrolls, resizes and changes. A timer gathers the changes: the in-app browser runs no frames. */
function useChainReading(row: HTMLElement | null): OverviewReading | null {
  const [reading, setReading] = useState<OverviewReading | null>(null)
  useEffect(() => {
    if (!row) { setReading(null); return }
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = () => { timer = undefined; setReading(row.clientWidth > 0 ? readChain(row) : null) }
    const soon = () => { if (timer === undefined) timer = setTimeout(read, 30) }
    // A scroll moves only the box: what the plates draw stands where it stood in the row.
    const scrolled = () => setReading(was => (was ? {...was, scrollLeft: row.scrollLeft} : was))
    read()
    row.addEventListener('scroll', scrolled, {passive: true})
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon)
    resize?.observe(row)
    for (const child of row.children) resize?.observe(child)
    const change = typeof MutationObserver === 'undefined' ? null : new MutationObserver(soon)
    change?.observe(row, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'data-view', 'data-light', 'data-expanded', 'aria-pressed']})
    return () => { row.removeEventListener('scroll', scrolled); resize?.disconnect(); change?.disconnect(); if (timer !== undefined) clearTimeout(timer) }
  }, [row])
  return reading
}

/** The overview's height inside its 1 px border (chainOverview.css: 18 px). */
const OVERVIEW_TALL = 16

/** The overview of one chain row, at most `width` px wide: the chain at one scale, so a short chain draws a short picture, as Live's.
 * Absent a row, or while the row is hidden, it draws nothing. */
export function ChainOverview({row, width = 168, name}: {row: HTMLElement | null; width?: number; /** Whose chain, for the status bar. */ name?: string}) {
  const reading = useChainReading(row)
  if (!row || !reading || reading.scrollWidth <= 0) return null
  const scale = pictureScale(reading, width - 2, OVERVIEW_TALL)
  // The miniature's room inside its 1 px border: the whole row at that scale.
  const room = Math.max(8, Math.round(reading.scrollWidth * scale))
  const fits = reading.scrollWidth <= reading.clientWidth + 1
  const scrollTo = (left: number) => { row.scrollLeft = Math.max(0, Math.min(reading.scrollWidth - reading.clientWidth, left)) }
  const press = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const strip = event.currentTarget, at = (x: number) => (x - strip.getBoundingClientRect().left - strip.clientLeft) / scale
    const x = at(event.clientX)
    const inBox = x >= reading.scrollLeft && x <= reading.scrollLeft + reading.clientWidth
    // Outside the box, the press brings that part into view; then, as inside it, a drag carries the box.
    const start = inBox ? reading.scrollLeft : centredOn(x, reading)
    if (!inBox) scrollTo(start)
    const from = event.clientX
    strip.setPointerCapture?.(event.pointerId)
    const move = (next: globalThis.PointerEvent) => scrollTo(start + (next.clientX - from) / scale)
    const up = () => { strip.removeEventListener('pointermove', move); strip.removeEventListener('pointerup', up); strip.removeEventListener('pointercancel', up) }
    strip.addEventListener('pointermove', move)
    strip.addEventListener('pointerup', up)
    strip.addEventListener('pointercancel', up)
  }
  const wheel = (event: WheelEvent<HTMLDivElement>) => { scrollTo(reading.scrollLeft + (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY)) }
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = reading.clientWidth / 4
    const to = event.key === 'ArrowLeft' ? reading.scrollLeft - step : event.key === 'ArrowRight' ? reading.scrollLeft + step
      : event.key === 'Home' ? 0 : event.key === 'End' ? reading.scrollWidth : null
    if (to === null) return
    event.preventDefault()
    scrollTo(to)
  }
  const most = Math.max(1, reading.scrollWidth - reading.clientWidth)
  return <div className="chain-overview" style={{width: room + 2}} role="scrollbar" aria-orientation="horizontal" tabIndex={0}
    aria-label={`${name ? `${name}: ` : ''}the chain in miniature`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fits ? 0 : Math.round(reading.scrollLeft / most * 100)}
    data-fits={fits ? 'true' : undefined}
    data-i={`Chain overview|${name ? `${name}'s chain` : 'The whole chain'} in miniature; the box is what Device view shows. Drag to scroll the chain; press outside the box to bring that part into view.`}
    onPointerDown={press} onWheel={wheel} onKeyDown={key}>
    <ChainPicture reading={reading} room={width - 2} tall={OVERVIEW_TALL} />
    <span className="chain-overview-box" aria-hidden="true" style={{left: reading.scrollLeft * scale, width: Math.min(room, reading.clientWidth * scale)}} />
  </div>
}

/** A chain row that turns under the wheel while it stands: the gallery's chain rows (catalogue/main.tsx ChainRow). Device view's row
 * takes the wheel when the host publishes it (publishShownChain). */
export function useChainWheel(row: HTMLElement | null): void {
  useEffect(() => {
    if (!row) return
    row.addEventListener('wheel', onRowWheel, {passive: false})
    return () => row.removeEventListener('wheel', onRowWheel)
  }, [row])
}

// ---------------------------------------------------------------- the row Device view shows now (DetailHost publishes it)

let shownRow: HTMLElement | null = null
const listeners = new Set<() => void>()
/** The host says which chain row Device view shows (null while it shows none), for the status bar's overview. */
export function publishShownChain(row: HTMLElement | null): void {
  if (row === shownRow) return
  shownRow?.removeEventListener('wheel', onRowWheel)
  shownRow = row
  // The wheel over the row turns it, and is kept from the page while it does (a listener React would make passive cannot).
  row?.addEventListener('wheel', onRowWheel, {passive: false})
  for (const listener of listeners) listener()
}
export const useShownChain = (): HTMLElement | null =>
  useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => shownRow, () => null)
