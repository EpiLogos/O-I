// The chain's overview (manual §10.1 "the selected track's name and a small picture of its chain"; §16.4): the whole chain in
// miniature beside the Device switch, as Live draws the selected track's devices after its name at the bottom right
// (reverse-engineering evidence/ui/live-arrangement-real.png). A box over it marks what Device view shows, as the outline of
// Live's Arrangement overview "represents the currently displayed part" (Live 12 manual, Arrangement View, Layout 1). Drag in it
// to scroll the chain; press outside the box to bring that part into view; the wheel scrolls it too.
//
// It reads the chain it is given as drawn: every plate (a device on its chain, a folded device, a rack and the devices inside it)
// by its place in the row, measured again when the row scrolls, resizes or changes. It writes nothing but the row's scroll.
import {useEffect, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type WheelEvent} from 'react'
import './chainOverview.css'

/** The plates a chain draws, of every family: the kit's panels and folds, the runtime's generic plate, Technē's faces, the
 * Expressions rack card, and the chain's end. */
const PLATE = 'section.dp, section.dp-folded, .device, .techne-device, .native-rack-card, .dropz'

export type PlateLight = 'lit' | 'dark' | 'unknown'
export interface OverviewPlate {
  readonly x: number
  readonly w: number
  /** 0 a plate of the row; 1 a device inside a rack's Devices view. */
  readonly depth: 0 | 1
  readonly name: string
  readonly folded: boolean
  readonly end: boolean
  readonly light: PlateLight
}
export interface OverviewReading {
  readonly scrollWidth: number
  readonly clientWidth: number
  readonly scrollLeft: number
  readonly plates: readonly OverviewPlate[]
}

const nameOf = (plate: Element): string => (plate.getAttribute('aria-label') ?? plate.querySelector('.dp-title, .sdk-face__title')?.textContent ?? '').replace(/, folded$/, '').trim()

/** The chain as drawn, read from its row: where each plate stands along the whole row. Pure over the DOM it is given. */
export function readChain(row: HTMLElement): OverviewReading {
  const box = row.getBoundingClientRect()
  const origin = box.left + row.clientLeft - row.scrollLeft
  const found = [...row.querySelectorAll<HTMLElement>(PLATE)].filter(plate => plate.getClientRects().length > 0)
  const plates: OverviewPlate[] = []
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
    plates.push({x: rect.left - origin, w: rect.width, depth: depth as 0 | 1, name: nameOf(plate),
      folded: foldedIs(plate), end: plate.matches('.dropz'),
      light: light === 'lit' || light === 'dark' ? light : 'unknown'})
  }
  return {scrollWidth: row.scrollWidth, clientWidth: row.clientWidth, scrollLeft: row.scrollLeft, plates}
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
    read()
    row.addEventListener('scroll', read, {passive: true})
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon)
    resize?.observe(row)
    for (const child of row.children) resize?.observe(child)
    const change = typeof MutationObserver === 'undefined' ? null : new MutationObserver(soon)
    change?.observe(row, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'data-view', 'data-light', 'data-expanded', 'aria-pressed']})
    return () => { row.removeEventListener('scroll', read); resize?.disconnect(); change?.disconnect(); if (timer !== undefined) clearTimeout(timer) }
  }, [row])
  return reading
}

/** The overview of one chain row, `width` px wide. Absent a row, or while the row is hidden, it draws nothing. */
export function ChainOverview({row, width = 168, name}: {row: HTMLElement | null; width?: number; /** Whose chain, for the status bar. */ name?: string}) {
  const reading = useChainReading(row)
  if (!row || !reading || reading.scrollWidth <= 0) return null
  // The miniature's room inside its 1 px border.
  const room = width - 2
  const scale = room / reading.scrollWidth
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
  return <div className="chain-overview" style={{width}} role="scrollbar" aria-orientation="horizontal" tabIndex={0}
    aria-label={`${name ? `${name}: ` : ''}the chain in miniature`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fits ? 0 : Math.round(reading.scrollLeft / most * 100)}
    data-fits={fits ? 'true' : undefined}
    data-i={`Chain overview|${name ? `${name}'s chain` : 'The whole chain'} in miniature; the box is what Device view shows. Drag to scroll the chain; press outside the box to bring that part into view.`}
    onPointerDown={press} onWheel={wheel} onKeyDown={key}>
    {reading.plates.map((plate, i) => <span key={i} className="chain-overview-plate" data-depth={plate.depth} data-folded={plate.folded ? 'true' : undefined}
      data-end={plate.end ? 'true' : undefined} data-light={plate.light}
      style={{left: plate.x * scale, width: Math.max(1, plate.w * scale)}} />)}
    <span className="chain-overview-box" aria-hidden="true" style={{left: reading.scrollLeft * scale, width: Math.min(room, reading.clientWidth * scale)}} />
  </div>
}

// ---------------------------------------------------------------- the row Device view shows now (DetailHost publishes it)

let shownRow: HTMLElement | null = null
const listeners = new Set<() => void>()
/** The host says which chain row Device view shows (null while it shows none), for the status bar's overview. */
export function publishShownChain(row: HTMLElement | null): void {
  if (row === shownRow) return
  shownRow = row
  for (const listener of listeners) listener()
}
export const useShownChain = (): HTMLElement | null =>
  useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => shownRow, () => null)
