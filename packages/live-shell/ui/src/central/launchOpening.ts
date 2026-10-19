// Where a launched page opens (manual §18.1 Launch panel: "Opens as — Dialogue · Flow · Journal for a flow; Page · Reading · Walk · Sky
// for a being or thing; Opens in"; T-WORLDS §4 W2 "A page plays when launched"). The page keeps its own launch (its island's `launch`
// record, written by the page owner's `launch` field, kernel/src/page.rs launch_field): Opens as, and Opens in — the focused pane, a
// pane beside it, or a window. A page that keeps none opens as itself in the focused pane.
//   - A Being or a Thing opens as its page. As Reading, it opens its occurrence's reading on the Earth, when the Earth stands and holds
//     it (central/pageOccurrences.ts, central/earthReading.ts); otherwise it opens as its page, and the words say why. Walk and Sky
//     open as its page for now, and say so.
//   - A Flow opens as its Flow. Dialogue, Flow and Journal are the Flow's own views, chosen at its head; it opens on its own.
//   - Opens in a window: a pane becomes a window through its own ↗; the launch opens the page in the focused pane and says so.
// Pure apart from `openLaunched`, which reads the page through its owner and opens it in the pane tree.
import type {CentralLocation, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'
import {focusedGroup} from '../../../../../desktop/cradle/src/surface/engine'
import {readPageOwned} from '../../../../../desktop/cradle/src/personal/pageOwner'
import {earthReading} from './earthReading'
// The document opener is loaded when a page opens: its module carries the Flow template, which nothing that reads tracks needs.
import type {CentralDocumentTarget, openCentralDocumentAt as OpenAt} from './documents/centralDocuments'

export type OpensIn = 'focused' | 'pane' | 'window'

export interface LaunchOpening {
  /** The document the launch opens, and where; null when the page is no page the shell opens. */
  readonly open: {readonly target: CentralDocumentTarget; readonly beside: boolean} | null
  /** What the opening was, in words for the launch's note. */
  readonly words: string
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {})

/** How a launched page opens, from its form and the launch its island keeps. */
export function launchOpeningOf(form: string, location: CentralLocation, island: unknown): LaunchOpening {
  const launch = record(record(island).launch)
  const opensIn: OpensIn = launch.opensIn === 'pane' || launch.opensIn === 'window' ? launch.opensIn : 'focused'
  const where = opensIn === 'pane' ? 'in a pane beside the focused one' : 'in the focused pane'
  const windowWords = opensIn === 'window' ? '; a window is the pane\'s own ↗' : ''
  if (form === 'being' || form === 'thing') {
    const opensAs = launch.opensAs === 'reading' || launch.opensAs === 'walk' || launch.opensAs === 'sky' ? launch.opensAs : 'page'
    const waits = opensAs === 'page' || opensAs === 'reading' ? '' : `; ${opensAs[0].toUpperCase()}${opensAs.slice(1)} does not open from a launch yet, so it opens as its page`
    return {open: {target: {form: 'page', kind: form, location}, beside: opensIn === 'pane'}, words: `opened as its page ${where}${waits}${windowWords}`}
  }
  if (form === 'flow') {
    const view = launch.opensAs === 'dialogue' || launch.opensAs === 'journal' ? launch.opensAs : null
    return {open: {target: {form: 'flow', location}, beside: opensIn === 'pane'}, words: `opened as its Flow ${where}${view ? `; ${view === 'dialogue' ? 'Dialogue' : 'Journal'} is chosen at its head` : ''}${windowWords}`}
  }
  return {open: null, words: `a ${form || 'file'} is no page the shell opens`}
}

/** The layout with a launched page open where its launch says, through the document opener: in the focused pane, or in a pane
 * beside it. Pure. */
export function placeLaunched(openAt: typeof OpenAt, layout: LayoutState, open: NonNullable<LaunchOpening['open']>): LayoutState {
  const focused = open.beside ? focusedGroup(layout) : undefined
  return focused ? openAt(layout, open.target, {groupId: focused.id, edge: 'right'}) : openAt(layout, open.target)
}

/** After the page owner's launch: read the page's own launch through its owner and open it there, saying how. The launch has already
 * happened; a page that cannot be read opens as its form says, and a shell with no pane tree opens nothing and says so. */
export async function openLaunched(transport: KernelTransportStatus, setLayout: ((update: (layout: LayoutState) => LayoutState) => void) | null,
  page: {readonly location: CentralLocation; readonly form?: string}): Promise<{opened: string}> {
  if (!setLayout) return {opened: 'no pane tree is mounted to open it in'}
  let form = page.form ?? '', island: unknown = null
  try { const reading = await readPageOwned(transport, page.location); form = reading.form; island = reading.island } catch { /* the launch stands; the page opens as its form */ }
  // As Reading, the Earth opens the page's reading when it stands and holds the page; otherwise the page opens as itself.
  if ((form === 'being' || form === 'thing') && (island as {launch?: {opensAs?: unknown}} | null)?.launch?.opensAs === 'reading') {
    const reading = earthReading()
    const read = reading ? reading(page.location.ref) : {ok: false as const, why: 'no Earth stands in this session'}
    if (read.ok) return {opened: 'opened as its reading on the Earth'}
    const asPage = launchOpeningOf(form, page.location, {launch: {opensAs: 'page', opensIn: (island as {launch?: {opensIn?: unknown}}).launch?.opensIn}})
    if (asPage.open) {
      const {openCentralDocumentAt} = await import('./documents/centralDocuments')
      const open = asPage.open
      setLayout(layout => placeLaunched(openCentralDocumentAt, layout, open))
    }
    return {opened: `${asPage.words}; its reading did not open: ${read.why}`}
  }
  const opening = launchOpeningOf(form, page.location, island)
  const open = opening.open
  if (open) {
    const {openCentralDocumentAt} = await import('./documents/centralDocuments')
    setLayout(layout => placeLaunched(openCentralDocumentAt, layout, open))
  }
  return {opened: opening.words}
}

