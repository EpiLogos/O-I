// Where a launched page opens (manual §18.1 Launch panel: "Opens as — Dialogue · Flow · Journal for a flow; Page · Reading · Walk · Sky
// for a being or thing; Opens in"; T-WORLDS §4 W2 "A page plays when launched"). The page keeps its own launch (its island's
// `meta.launch` record, written by the page owner's `launch` field, kernel/src/page.rs launch_field): Opens as, and Opens in — the
// focused pane, a pane beside it, or a window. A page that keeps none opens as itself in the focused pane.
//   - A Being or a Thing opens as its page. As Reading, it opens its occurrence's reading on the Earth; as Walk, its family's walk on the
//     Earth, from its own stop — each when the Earth stands and holds it (central/pageOccurrences.ts, central/earthReading.ts); otherwise
//     it opens as its page, and the words say why. As Sky, a Being opens as its page and the Sky reads its Subject's birth sky
//     (inhabitants/ql/devices/practiceLaunch.ts skyOfBeing); a Thing holds no placement in the sky, so it opens as its page and says so
//     ("a being or a thing with no … placement in the sky says so", manual §18.1).
//   - A Flow opens as its Flow. Dialogue, Flow and Journal are the Flow's own views, chosen at its head; it opens on its own.
//   - Opens in a window: a pane becomes a window through its own ↗; the launch opens the page in the focused pane and says so.
// Pure apart from `openLaunched`, which reads the page through its owner and opens it in the pane tree.
import type {CentralLocation, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'
import {focusedGroup} from '../../../../../desktop/cradle/src/surface/engine'
import {readPageOwned} from '../../../../../desktop/cradle/src/personal/pageOwner'
import {earthReading, earthWalk} from './earthReading'
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

/** The launch a page keeps: its island's `meta.launch`, where the page owner writes it (kernel/src/page.rs launch_field). */
export const launchOf = (island: unknown): Record<string, unknown> => record(record(record(island).meta).launch)

/** How a launched page opens, from its form and the launch its island keeps. */
export function launchOpeningOf(form: string, location: CentralLocation, island: unknown): LaunchOpening {
  const launch = launchOf(island)
  const opensIn: OpensIn = launch.opensIn === 'pane' || launch.opensIn === 'window' ? launch.opensIn : 'focused'
  const where = opensIn === 'pane' ? 'in a pane beside the focused one' : 'in the focused pane'
  const windowWords = opensIn === 'window' ? '; a window is the pane\'s own ↗' : ''
  if (form === 'being' || form === 'thing') {
    const opensAs = launch.opensAs === 'reading' || launch.opensAs === 'walk' || launch.opensAs === 'sky' ? launch.opensAs : 'page'
    const waits = opensAs !== 'sky' ? '' : form === 'being' ? '; the Sky reads its Being\'s birth sky'
      : '; a Thing holds no placement in the sky, so Sky stays closed for it'
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
  // As Reading or Walk, the Earth opens the page's reading, or its family's walk from its stop, when it stands and holds the page;
  // otherwise the page opens as itself.
  const asked = launchOf(island).opensAs
  if ((form === 'being' || form === 'thing') && (asked === 'reading' || asked === 'walk')) {
    const opener = asked === 'reading' ? earthReading() : earthWalk()
    const read = opener ? opener(page.location.ref) : {ok: false as const, why: 'no Earth stands in this session'}
    if (read.ok) return {opened: asked === 'reading' ? 'opened as its reading on the Earth' : 'opened its walk on the Earth, at its own stop'}
    const asPage = launchOpeningOf(form, page.location, {meta: {launch: {opensAs: 'page', opensIn: launchOf(island).opensIn}}})
    if (asPage.open) {
      const {openCentralDocumentAt} = await import('./documents/centralDocuments')
      const open = asPage.open
      setLayout(layout => placeLaunched(openCentralDocumentAt, layout, open))
    }
    return {opened: `${asPage.words}; its ${asked === 'reading' ? 'reading' : 'walk'} did not open: ${read.why}`}
  }
  const opening = launchOpeningOf(form, page.location, island)
  const open = opening.open
  if (open) {
    const {openCentralDocumentAt} = await import('./documents/centralDocuments')
    setLayout(layout => placeLaunched(openCentralDocumentAt, layout, open))
  }
  return {opened: opening.words}
}

