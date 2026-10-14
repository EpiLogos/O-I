// The doors the window's keys press through (FOUNDATION F9). A key owns no write of its own: it reaches what its control
// reaches, through the control's own door. Some doors already exist and are read where they are — the selected device
// (frame/devices/deviceDoor.ts), opening an instrument (frame/instrumentDoor.ts). The rest are published here by the part
// that holds the thing, the way the instrument opener and the timeline reading are, and read when a key is pressed:
//   • the transport bar publishes the bindings it draws, so Space and Esc press the Play and Stop the bar shows;
//   • the Session pane publishes the set it draws and which view it is in, so a number key launches that grid's row;
//   • the browser's rows publish what Enter would open for the row selected in them;
//   • the one browser registers its search box, so ⌘F reaches it.
// Nothing here is state a key writes: each entry is a reference to the owner's own, replaced as the owner renders.
import {useEffect, type RefObject} from 'react'
import type {TransportBindings} from '../transport/slots'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'

// ---- the transport: Space and Esc

let transport: TransportBindings | null = null
/** The bindings the transport bar draws now (null when it leaves). Space and Esc press the Play and Stop slots in them. */
export function publishTransportKeys(next: TransportBindings | null): void { transport = next }
export const transportKeys = (): TransportBindings | null => transport

// ---- the Session grid: the row keys

/** The set a Session or Arrangement pane draws, and which of the two it is showing. Rows exist in the Session grid only. */
export interface TrackRows {
  set: WorldTrackSet
  presented: 'session' | 'arrangement'
}
let rows: TrackRows | null = null
/** The tracks pane publishes what it draws (null when it leaves). */
export function publishTrackRows(next: TrackRows | null): void { rows = next }
export const trackRows = (): TrackRows | null => rows

// ---- the selected thing: Enter and ⌥Enter

/** What Enter opens for the thing selected in a place that holds a selection of its own. `open` does what that place's own
 * double-click does; `at` is the pane to open beside, when asked. It throws a refusal in the owner's words. */
export interface Openable {
  label: string
  open(at?: {groupId: string; edge: 'right'}): void
}
let openable: Openable | null = null
/** A browser row (or any place that keeps a selection) publishes what Enter opens for it, and withdraws it (null) when the
 * selection goes. The latest publisher wins. */
export function publishOpenable(next: Openable | null): void { openable = next }
export const openableNow = (): Openable | null => openable

// ---- ⌘F: the one browser's search

interface SearchHost { focus(): void }
const searchHosts = new Set<SearchHost>()

/** Register the browser's search box. The returned function withdraws it. */
export function registerBrowserSearch(host: SearchHost): () => void {
  searchHosts.add(host)
  return () => { searchHosts.delete(host) }
}
export const browserSearchAvailable = (): boolean => searchHosts.size > 0

/** Focus the browser's search box, showing the browser first when it is hidden. False when no browser is registered, so the key
 * is left to whoever else wants it. */
export function requestBrowserSearch(reveal?: () => void): boolean {
  if (searchHosts.size === 0) return false
  reveal?.()
  for (const host of [...searchHosts]) host.focus()
  return true
}

/** The browser's side of ⌘F: register its search input once. A hidden browser cannot take focus until it is shown, so the focus
 * is tried again for a short while after the request. */
export function useBrowserSearchRequest(input: RefObject<HTMLInputElement | null>): void {
  useEffect(() => registerBrowserSearch({
    focus() {
      const attempt = (left: number) => {
        const el = input.current
        if (!el) return
        el.focus()
        if (el.ownerDocument.activeElement === el) { el.select(); return }
        if (left > 0) setTimeout(() => attempt(left - 1), 16)
      }
      attempt(6)
    },
  }), [input])
}
