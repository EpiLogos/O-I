// Each mode's rows in the one browser (FOUNDATION F6), by registration: the frame's browser (frame/browser/Browser.tsx)
// knows no mode; this table names the row sources a mode stands on, every one keeping the source it had. The old
// browsers are the row bodies — Live's set browser, the Expressions library, the ground and world categories of the mode
// grammar, the agent browser — each drawn under the one browser's control. Every mode also browses the running agent
// sessions, the named sets and the instruments. The bodies read what the App hands them through BrowserReadingContext,
// so the sources stay the same objects across renders.
import {createContext, useContext, type ReactNode} from 'react'
import type {SurfMode} from './modeGrammar'
import type {PanelContext} from './panels'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import type {BrowserSource, ControlledBrowser} from '../frame/browser/browserKinds'
import {BrowserPane, liveBrowserCategories} from '../components/BrowserPane'
import {WorldBrowser, WORLD_BROWSER_CATEGORIES} from '../components/WorldBrowser'
import {ModeBrowser, modeBrowserCategories} from './ModeBrowser'
import {AgentShellBrowser, AGENT_BROWSER_CATEGORIES} from '../agent/AgentShellBrowser'
import {SetsSection} from './SetsSection'
import {Icon} from '../inhabitants/sdk/Icon'
import {InstrumentsSection} from '../frame/InstrumentsSection'
import {useWorkbenchOpeners} from '../native/workbenchDoor'

/** What the bodies read from the App: Live's panel context, the ground subject the browser selects, the agency reading. */
export interface BrowserReading {
  mode: SurfMode
  ctx: PanelContext
  defaultSet: string
  selectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
  agency: {rows: AgencySessionRow[]; error: string | null; loading: boolean}
}

const BrowserReadingContext = createContext<BrowserReading | null>(null)
export function BrowserReadingProvider({value, children}: {value: BrowserReading; children: ReactNode}) {
  return <BrowserReadingContext.Provider value={value}>{children}</BrowserReadingContext.Provider>
}
const useBrowserReading = (): BrowserReading | null => useContext(BrowserReadingContext)

function LiveRows({controlled}: {controlled: ControlledBrowser}) {
  const reading = useBrowserReading()
  return reading ? <BrowserPane defaultSet={reading.defaultSet} ctx={reading.ctx} controlled={controlled} /> : null
}
function ExpressionsRows({controlled}: {controlled: ControlledBrowser}) {
  return <WorldBrowser controlled={controlled} />
}
function GrammarRows({controlled}: {controlled: ControlledBrowser}) {
  const reading = useBrowserReading()
  return reading ? <ModeBrowser mode={reading.mode} onSelectSubject={reading.selectSubject} selectedSubject={reading.selectedSubject} controlled={controlled} /> : null
}
function AgentRows({controlled}: {controlled: ControlledBrowser}) {
  const reading = useBrowserReading()
  return reading ? <AgentShellBrowser rows={reading.agency.rows} error={reading.agency.error} loading={reading.agency.loading} controlled={controlled} /> : null
}
function SetsRows() { return <SetsSection /> }
/** The surfaces the Workbench can open (native/workbenchDoor.ts): a row each; double-click or Enter opens it in the focused
 * pane (manual §10.3: "To open it, double-click it or drag it into a pane"). */
function SurfacesRows({controlled}: {controlled: ControlledBrowser}) {
  const openers = useWorkbenchOpeners()
  const needle = controlled.query.trim().toLowerCase()
  const shown = needle ? openers.filter(opener => opener.title.toLowerCase().includes(needle)) : openers
  if (!openers.length) return <p className="browser-empty">The Workbench is not mounted, so there is nothing to open here yet.</p>
  return <div className="browser-results" data-browser-surfaces>
    <div className="browser-list-heading">Name <span>Opens</span></div>
    {shown.map(opener => <button key={opener.id} type="button" className="browser-item" data-surface={opener.id}
      title={`${opener.title} — ${opener.hint}. Double-click or Enter opens it in the focused pane.`}
      onDoubleClick={opener.open} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); opener.open() } }}>
      <span>▸</span><span>{opener.title}</span>
    </button>)}
    {!shown.length && <p className="browser-empty">No surface matches.</p>}
  </div>
}
function InstrumentsRows() { return <InstrumentsSection /> }

const AGENTS: BrowserSource = {id: 'agents', categories: AGENT_BROWSER_CATEGORIES, Body: AgentRows}
/** Outside Factory, the running agent sessions only (Factory browses the whole agent browser). */
const SESSIONS: BrowserSource = {id: 'sessions', categories: AGENT_BROWSER_CATEGORIES.filter(category => category.id === 'sess'), Body: AgentRows}
const SHARED: readonly BrowserSource[] = [
  {id: 'sets', categories: [{id: 'sets', label: 'Sets', kind: 'material', mark: <Icon name="pane" size={12} />, hint: 'named arrangements of panes, detail and browser'}], Body: SetsRows},
  {id: 'instruments', categories: [{id: 'instruments', label: 'Instruments', kind: 'instruments', mark: <Icon name="techne" size={12} />, hint: 'open one in a pane'}], Body: InstrumentsRows},
  {id: 'surfaces', categories: [{id: 'surfaces', label: 'Surfaces', kind: 'instruments', mark: <Icon name="browser" size={12} />, hint: 'sources, hosted surfaces, a terminal, a web page — open in a pane'}], Body: SurfacesRows},
]

const grammar = (mode: SurfMode): BrowserSource => ({id: `grammar-${mode}`, categories: modeBrowserCategories(mode), Body: GrammarRows})

export const MODE_BROWSERS: Readonly<Record<SurfMode, () => readonly BrowserSource[]>> = {
  live: () => [{id: 'live', categories: liveBrowserCategories(), Body: LiveRows}, SESSIONS],
  base: () => [grammar('base'), SESSIONS],
  techne: () => [grammar('techne'), SESSIONS],
  expressions: () => [{id: 'expressions', categories: WORLD_BROWSER_CATEGORIES, Body: ExpressionsRows}, SESSIONS],
  factory: () => [AGENTS],
}

/** A mode's row sources, then the ones every mode shares. */
export const browserSourcesOf = (mode: SurfMode): readonly BrowserSource[] => [...MODE_BROWSERS[mode](), ...SHARED]
