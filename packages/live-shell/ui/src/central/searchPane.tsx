// Search (@) in a pane (DLW §18.4 "Pane: a pane (⌘F), or the line that opens where you type @ in a document"; Full: "The full Search is
// the search pane. The search line is at the top. The results are below it … The controls stay in Device view, below the pane"; R4 and
// lock §0.3.4: Search is no device on Central's chain). Replaces Search's place on Central's chain (central/devices/CentralDevices.tsx,
// lane BC3, e2cc4aed4): the same design (`central:search`, inhabitants/catalogue/panels/central__search.tsx) on the same binding (the
// held query asked of AIKit's knowledge search — central/devices/agentChainDevices.ts useSearchDevice over searchBinding.ts), now drawn
// as its Full in a pane of its own kind, registered as the other panes are (projection modules: registerCentralDocumentPane,
// registerDevicePane — ported from frame/devices/devicePane.tsx:20-28). While the pane stands, Search is published on the door, so
// Device view, the pool and the rail draw its controls on the same binding ("The controls stay in Device view, below the pane").
//
// The line where you type @: a composer's words (the Agent's, the page's) name a search when the word being typed starts with @
// (atQueryOf); the one who holds the composer opens this pane on that search and keeps the pane's line on what follows the @ (the hold
// the binding reads: heldOf(SEARCH_DEVICE_ID).query). The Agent's composer does it on both chains (CentralDevices.tsx,
// FactoryDeviceChain.tsx: useAtSearch).
import {useEffect, useMemo, useRef} from 'react'
import {createRoot} from 'react-dom/client'
import {registerProjectionModule} from '../../../../../desktop/cradle/src/surface/projectionModules'
import {detectTransport} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {PlacedDevice} from '../frame/devices/DeviceView'
import {publishDevice} from '../frame/devices/deviceDoor'
import {openInstrument} from '../frame/instrumentDoor'
import {familyFaceDevice} from '../agent/devices/mainTrackBindings'
import {SEARCH_DEVICE_ID, useSearchDevice} from './devices/agentChainDevices'
import {heldOf, setHeld} from './devices/pageBindings'

/** The Search pane's kind (a projection pane, surface/types.ts isProjectionPaneKind). */
export const SEARCH_PANE_KIND = 'projection.central-search'

/** The search a composer's words name: from the last word that starts with @ to the end of the line (`@ariadne`, `@1 founding positions`),
 * or null when the word being typed names none — an @ inside a word (an address) is no search. Pure. */
export function atQueryOf(text: string): string | null {
  const match = /(?:^|\s)(@[^@\n]*)$/.exec(text)
  return match ? match[1]! : null
}

/** Search as a device of the runtime: Central's admitted `search` face (worldShellFamilies.ts declareCentralAgentChain), its values the
 * binding's. Null when the family does not admit it. */
export const searchDevice = (): DeviceInstance | null => familyFaceDevice(SEARCH_DEVICE_ID, 'central', 'search', 'Search', 'search')

/** Open Search in a pane, on a search when one is given (the line the @ opened). */
export function openSearchPane(query?: string | null): void {
  if (query) setHeld(SEARCH_DEVICE_ID, 'query', query)
  openInstrument(SEARCH_PANE_KIND, undefined, {ref: SEARCH_DEVICE_ID, title: 'Search'})
}

/** The pane: Search's Full on its binding, Search published on the door while it stands. */
export function SearchPane({transport, projects = null}: {transport: KernelTransportStatus; projects?: readonly string[] | null}) {
  const binding = useSearchDevice(transport, projects)
  const device = useMemo(() => searchDevice(), [])
  useEffect(() => { if (device) publishDevice(SEARCH_DEVICE_ID, {device, binding}) }, [device, binding])
  useEffect(() => () => publishDevice(SEARCH_DEVICE_ID, null), [])
  if (!device) return <p role="status" className="source-note">Central's family admits no Search here, so there is nothing to search with.</p>
  return <div className="central-search-pane" data-pane-kind={SEARCH_PANE_KIND} style={{position: 'absolute', inset: 0}}>
    <PlacedDevice device={device} view="full" binding={binding} />
  </div>
}

let registered = false
/** Register the Search pane's kind (once). Called below at this module's load — the chains that open it import it — until the App
 * registers it beside the device and document panes (App.tsx registerDevicePane, registerCentralDocumentPane). */
export function registerSearchPane(): void {
  if (registered) return
  registered = true
  registerProjectionModule({id: 'central-search', kind: SEARCH_PANE_KIND, create: ({element}) => {
    const root = createRoot(element)
    root.render(<SearchPane transport={detectTransport()} />)
    // The pane session tears down inside a commit; the root leaves after it (its container is the session's own).
    return {unmount: () => queueMicrotask(() => root.unmount())}
  }})
}

registerSearchPane()

/** The line where you type @ in a composer: when the word being typed starts with @, open Search in a pane on it (once per @), and keep
 * the pane's search line on what follows while you type. `draft` is the composer's words (the Agent's `draft` reading). */
export function useAtSearch(draft: string | undefined): void {
  const open = useRef<string | null>(null)
  const query = typeof draft === 'string' ? atQueryOf(draft) : null
  useEffect(() => {
    if (query === null) { open.current = null; return }
    if (open.current === null) {
      open.current = query
      try { openSearchPane(query) } catch { /* no pane tree is mounted: the held search waits for the pane */ setHeld(SEARCH_DEVICE_ID, 'query', query) }
      return
    }
    if (heldOf(SEARCH_DEVICE_ID).query !== query) setHeld(SEARCH_DEVICE_ID, 'query', query)
    open.current = query
  }, [query])
}
