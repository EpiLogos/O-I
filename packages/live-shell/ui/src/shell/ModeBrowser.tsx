/**
 * The per-mode browser — the frame's left column wearing a mode's declared
 * categories (WORLD-SHELL-DESIGN Revision 3's left-column table, as data in
 * `modeGrammar.ts`; §12/§16: the families declare the entries, the shell's
 * door is neutral).
 *
 * This component WRAPS the browser frame and swaps the category/content
 * DATA; it never edits the Expressions browser's internals (WorldBrowser
 * stays the Expressions and Live modes' browser — the audit holds that one
 * correct). The composition composes only through landed identities:
 *
 * - Days — the day records listed through the same owner route the L7
 *   detail craft reads (`listFiles` → central.directory-reading/v1), at the
 *   owner's day surface (`Control/user/day`, central/daySurface.ts). Each row reads as
 *   the mockup's `bi()` (world-shell-mockup.html :1478, :1484): the day in
 *   words ("Thu 08 Oct"), its standing from the owner's own Day reading
 *   (`day_read`: open / closed, the Day document's short revision), read once
 *   per listing. Under them, the NOW section: the machines the agency reading
 *   places sessions on, and what runs there now. Selecting a day selects the
 *   Document detail's subject.
 * - Flows — the owner's Flow listing (`Control/user/flows`, the route the Flow
 *   pane reads, flow/instances.ts listFlowInstances): each Flow by the title
 *   its own payload gives, its agents and its revision.
 * - Files — the ground's own listing through the workspace's directory
 *   resource (the same listing WorldBrowser's Files category reads);
 *   selecting a folder or note selects the subject; navigating walks the
 *   ground. A file's size is hover words, never its standing.
 * - Sources (Technē) — the retained app's own work list
 *   (`nativeWorks`); a row opens the work in the instrument
 *   (`requestExpression` — the existing door).
 * - World (Technē: Bodies, Locations, Places, Journeys) — the landed owners'
 *   own subjects (techne/subject/worldRows.ts): the project spaces and the
 *   declared places the suite reading publishes (provider/suiteStanding.ts),
 *   the World's walks. Selecting a row makes it THE selection (the book's one
 *   writer, so the title line, the trail and the aperture name it in words);
 *   double-click or Enter opens it through N2's subject door
 *   (techne/subject/openSubject.ts `openWorldSubject`): the Scene asked for and
 *   the others that carry it stand under the row, an absence in the owner's
 *   words in its standing. A group its owners have not answered says what it
 *   waits on, in the standing's words.
 * - New — the four document forms (the mockup's `.newforms`), each made
 *   through the Workbench's own opener when it publishes one.
 * - Family-declared categories compose after the mockup's own entries in the modes they name
 *   (`composeModeBrowser`, modeGrammar.ts; `allInhabitantBrowserEntries`, manifest.ts). A declared category with no
 *   row source here is `waiting` (a designed empty category) or a named fault when declared `cut`.
 * - Every declared-waiting category renders as a DESIGNED empty category:
 *   mark, name, the owner it waits for, and the affordance that would fill
 *   it (the widget guide's empty-state law) — never another mode's content,
 *   never a bare sentence.
 *
 * Every control states its function (`data-i="label|fn"`, the F2 law).
 * Pure composition: no second store, no new owner op, and no mode branch —
 * a category's difference is its id in the tables below.
 */

import {InstrumentsSection} from '../frame/InstrumentsSection'
import {trackRows, type TrackRows} from '../frame/keys/keyDoors'
import {useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode} from 'react'
import {openSettings, setupRequest} from '../settings/host'
import type {SettingsRequest} from '../settings/adapter'
import {chooseFolder} from '../settings/folderChooser'
import {subscribeSuiteStanding, suiteStanding} from '../projections/atlas/provider/suiteStanding'
import {useTimelineReading} from '../projections/timelinePaneHost'
import {worldReadingOf} from '../timeline/techneTrackAdapter'
import {techneControls} from '../frame/tracks/useTechneTracks'
import {useOptionalContinuity} from '../continuity/workspace'
import {isWorldGroup, openingWords, palaceWorldGroup, sceneRowsOf, worldGroupOf, type SceneRow, type WorldGroup, type WorldGroupId, type WorldRow} from '../techne/subject/worldRows'
import {enterFromOutside, palacesWaiting, readPalaces, usePalaces} from '../projections/atlas/palaces/palacesWorld'
import {bringInstrumentIntoView} from '../frame/instrumentDoor'
import {chooseBody, subscribeWorldBody, worldBodyState} from '../projections/atlas/body/worldBody'
import {subscribeSystem, systemReading} from '../projections/atlas/system/systemStore'
import {chooseHeldScene, openHeldSubject, useSubjectOpenings, type SubjectOpening} from '../techne/subject/subjectOpenings'
import type {NativeDirectory, NativeFileEntry, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {listFiles} from '../../../../../desktop/cradle/src/files/client'
import {dayRead} from '../../../../../desktop/cradle/src/day/client'
import {USER_FLOWS_DIR} from '../../../../../desktop/cradle/src/flow/flowsDir'
// A Flow's own parser (flow/instances.ts readFlowInstance, which carries the Flow's form page) loads when a row first reads a Flow on
// its own, never with the shell's first frame (O-I #740).
const readFlowInstance = async (...args: Parameters<typeof import('../../../../../desktop/cradle/src/flow/instances').readFlowInstance>) =>
  (await import('../../../../../desktop/cradle/src/flow/instances')).readFlowInstance(...args)
import {listWorldPages, type PageForm, type PageListing} from '../../../../../desktop/cradle/src/personal/pageOwner'
import {readWorlds, type CentralWorld, type CentralWorldsReading} from '../central/centralWorlds'
import {CENTRAL_WORLD_DRAG} from '../timeline/centralTrackAdapter'
import {DOCUMENT_FORMS, type DocumentForm} from '../../../../../desktop/cradle/src/flow/documentForms'
import {useCentralDocumentOpener} from '../central/documents/useOpenCentralDocument'
import {dayRefOfDate} from '../central/documents/centralDocuments'
import {composeModeBrowser, ROW_SOURCE_OWNERS, type ModeBrowserCategory, type SurfMode} from './modeGrammar'
import {allInhabitantBrowserEntries} from '../inhabitants/manifest'
import {useWorkspace} from './workspace'
import {ShellConfigContext} from './useSet'
import {useAgentSessionsOptional} from '../agent/AgentSessionsProvider'
import {useWorkbenchOpeners, type WorkbenchOpener} from '../native/workbenchDoor'
import {Icon} from '../inhabitants/sdk/Icon'
import {KindMark, type KindShapeName} from '../inhabitants/sdk/marks.tsx'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {civilDateOfDayFile, dayStandingHover, dayStandingOf, dayStandingWords, dayWords, flowOrder, flowReadingOf, flowRowWords, hostOfSpace,
  nowRows, sessionState, sizeWords, type DayStanding, type FlowReading, type NowRow} from '../frame/browser/rowWords'
import './modeSurface.css'
import type {BrowserCategory, ControlledBrowser} from '../frame/browser/browserKinds'
import {CENTRAL_DAYS_PATH, dayEntriesOf} from '../central/daySurface'
import {useOwnerReading, useOwnerReadingsOf, type OwnerReading} from '../owners/ownerReading'
import {useSpineEpoch} from '../owners/spine'

/** The root register's day surface — where the civil calendar's records
 * live (`centralDayNowModel`'s subjectDayRef reads this shape). */
const DAY_RECORDS_PATH = CENTRAL_DAYS_PATH
/** How many listed rows a category reads its owner for, once per listing (the newest first); rows past it keep their listed words. */
const ROWS_READ = 31

/** The category's mark — the cut rail's kind drawing when the grammar
 * assigns one, the mono mark otherwise (icon-cut §7 "Browser rail"). */
function CategoryMark({category, size = 13}: {category: ModeBrowserCategory; size?: number}) {
  if (category.kindMark) return <KindMark kind={category.kindMark} size={size} />
  return <Icon name={category.mark} size={size} />
}

/** What selecting a row of a category does, beyond its hint — the words the browser's lower panel used to hold above the
 * aperture (the category's context), now the category's own Info words (manual §10.1: the status bar reads what any control
 * does). Keyed by the category's id; a category not named here has its hint alone. */
const CATEGORY_WORDS: Readonly<Record<string, string>> = {
  'central-days': 'Selecting a day opens its record in the Document detail — CAS identity, basis, save-router standing. Double-click or Enter opens the Day itself in the focused pane.',
  'central-flows': 'Selecting a Flow opens it in the Document detail; double-click or Enter opens the Flow in the focused pane.',
  'central-files': 'Selecting a note selects it as the Document detail\'s subject; folders walk the ground. Double-click or Enter opens a file in the focused pane — a Flow as its Flow, any other file as its own tab.',
  'techne-sources': 'A source opens in its instrument over the current encounter.',
}
/** A waiting category's words, by the group it stands in. */
const WAITING_WORDS: Readonly<Record<string, string>> = {
  World: 'The World groups wait for their owners; the lens surface holds their places.',
}
/** The right-hand word of a category's results head (the mockup's `.bhead`: "State" over the Days, "Rev" over the Sources);
 * a category not named here has none. */
const RESULT_HEAD: Readonly<Record<string, string>> = {'central-days': 'State', 'central-flows': 'State', 'techne-sources': 'Rev'}
/** A note under a Files category's rows, by its id. */
const ROW_NOTES: Readonly<Record<string, string>> = {'techne-files': 'Reference files select from the ground; the lens takes them to hand.'}

/** A category's Info words (the row's data-i): its hint, what selecting a row does, and whether it reads or waits. */
export function categoryInfo(category: ModeBrowserCategory): string {
  const waiting = category.state === 'waiting'
  return [category.hint, CATEGORY_WORDS[category.id], waiting ? WAITING_WORDS[category.group] : undefined, waiting ? '(Declared, waiting.)' : undefined]
    .filter(Boolean).join(' ')
}

/** A mode's grammar categories in the one browser (F6): the ground's and the world's categories are material to open. */
export function modeBrowserCategories(mode: SurfMode): BrowserCategory[] {
  return composeModeBrowser(mode, allInhabitantBrowserEntries()).map(category => ({id: category.id, label: category.label, kind: 'material',
    mark: <CategoryMark category={category} />, hint: category.hint, info: categoryInfo(category), waiting: category.state === 'waiting'}))
}

export function ModeBrowser({mode, onSelectSubject, selectedSubject, controlled}: {
  mode: SurfMode
  /** Held by the one browser (F6): the category and the search are its. */
  controlled?: ControlledBrowser
  /** Selecting a ground subject (a day, folder or note) opens its craft in
   * the mode's Document detail. */
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
}) {
  // The one composition: the mockup's static categories, then the admitted families' declared categories for this mode.
  const categories = useMemo(() => composeModeBrowser(mode, allInhabitantBrowserEntries()), [mode])
  const groups = useMemo(() => {
    const seen: {group: string; categories: ModeBrowserCategory[]}[] = []
    for (const category of categories) {
      const found = seen.find(entry => entry.group === category.group)
      if (found) found.categories.push(category)
      else seen.push({group: category.group, categories: [category]})
    }
    return seen
  }, [categories])
  const [active, setActive] = useState(categories[0]?.id ?? '')
  const [ownNeedle, setNeedle] = useState('')
  const needle = controlled?.query ?? ownNeedle
  // Selecting a category keeps its rows; the needle filters them.
  const activeCategory = categories.find(category => category.id === (controlled?.category ?? active)) ?? categories[0] ?? null
  const results = <>
        <div className="mode-browser-resulthead" aria-hidden="true">
          <span>Name</span>
          <span>{activeCategory ? RESULT_HEAD[activeCategory.id] ?? '' : ''}</span>
        </div>
        {activeCategory && <CategoryRows category={activeCategory} needle={needle} mode={mode}
          onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} />}
  </>
  // The browser's lower panel is the focused pane's own context (the aperture slot, frame/browser/apertureViews.tsx), in every
  // mode; a category's words are its row's Info (categoryInfo), so these rows portal nothing into the pool.
  if (controlled) return <div className="mode-browser-body" data-mode-browser={mode}>{results}</div>

  return <aside className="world-browser world-browser-categories mode-browser" data-mode-browser={mode} aria-label="Mode browser">
    <div className="world-browser-searchrow">
      <label className="world-browser-search"><span className="sr-only">Search {activeCategory?.label ?? ''}</span>
        <input type="search" value={needle} onChange={event => setNeedle(event.target.value)} placeholder="Search (⌘ F)"
          data-i={`Search ${activeCategory?.label ?? ''}|filter the category's rows`} /></label>
      <output className="world-browser-count" aria-live="polite">{activeCategory?.state === 'waiting' ? 'waiting' : ''}</output>
    </div>
    <div className="world-browser-main">
      <nav className="world-category-list" aria-label="Mode browser categories">
        {groups.map(({group, categories: list}) => <div key={group}>
          <h3>{group}</h3>
          {list.map(category => <button type="button" key={category.id} aria-pressed={activeCategory?.id === category.id}
            data-i={`${category.label}|${categoryInfo(category)}`}
            title={`${category.label} — ${category.hint}${category.state === 'waiting' ? ' (declared, waiting)' : ''}`}
            onClick={() => {setActive(category.id); setNeedle('')}}>
            <span aria-hidden="true"><CategoryMark category={category} /></span><span>{category.label}</span>
            {isWorldGroup(category.id) ? <WorldGroupDot id={category.id} hint={category.hint} />
              : category.state === 'waiting' && <span className="mode-browser-waiting-dot" aria-label="declared, waiting" />}
          </button>)}
        </div>)}
      </nav>
      <div className="world-browser-results">{results}</div>
    </div>
    <InstrumentsSection />
  </aside>
}

// ————————————————————————————————————————————————————————————————————————
// One category's rows — composed from the landed owner, or designed empty.

function CategoryRows({category, needle, mode, onSelectSubject, selectedSubject}: {
  category: ModeBrowserCategory
  needle: string
  /** The mode the browser stands in: a row it selects is THE selection in this mode. */
  mode: SurfMode
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
}) {
  // The ownership law at the render: a row source draws rows only for the category its owner declares. Composition already
  // hides a foreign declaration of its id; this names the fault if one ever reaches the renderer, instead of dispatching it.
  const rowOwner = ROW_SOURCE_OWNERS.get(category.id)
  if (rowOwner !== undefined && rowOwner !== (category.family ?? null)) {
    return <div className="mode-browser-fault" role="alert">The {category.label} category is declared by {category.family ?? 'the shell'}, but its rows belong to {rowOwner ?? 'the shell'} — the composition refuses the declaration.</div>
  }
  // Technē's World groups draw from their owners whenever those answer, and say what they wait on while they do not — whatever
  // the grammar declares, so a waiting group still names its input in the standing's words.
  if (category.id === PALACES_GROUP) return <PalaceGroupRows category={category} mode={mode} needle={needle} />
  if (isWorldGroup(category.id)) return <WorldGroupRows category={category} id={category.id} mode={mode} needle={needle} />
  if (category.state === 'waiting') {
    return <DesignedEmptyCategory category={category} />
  }
  if (category.id === 'central-worlds') return <WorldsRows needle={needle} />
  if (category.id === 'central-days') return <DaysRows needle={needle} onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} />
  if (category.id === 'central-flows') return <FlowsRows needle={needle} onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} />
  if (category.id === 'central-beings') return <PageRows form="being" label="Beings" needle={needle} onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} />
  if (category.id === 'central-things') return <PageRows form="thing" label="Things" needle={needle} onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} />
  if (category.id === 'central-files' || category.id === 'techne-files') return <GroundRows needle={needle} onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} opens={category.id === 'central-files'} note={ROW_NOTES[category.id]} />
  if (category.id === 'techne-sources') return <SourceRows needle={needle} />
  if (category.id === 'central-new') return <NewForms />
  // A `cut` category without a composed row source is a lane fault, named —
  // never silently empty.
  return <div className="mode-browser-fault" role="alert">The {category.label} category is declared `cut` but composes no rows here — the composition owes its owner read.</div>
}

/** The open gestures of the Central rows (manual §10.3): a row previews on select; double-click, or Enter, opens its document
 * in the focused pane — a Days row its Day, a Files row its Flow or its own file tab (central/documents). A refusal is the
 * owner's own words, said by the rows. */
function useOpening() {
  const {openDay, openFile, openPage} = useCentralDocumentOpener()
  const [openFault, setOpenFault] = useState<string | null>(null)
  const said = (opening: Promise<void>) => opening.catch(reason => setOpenFault(reason instanceof Error ? reason.message : String(reason)))
  return {
    openFault,
    openDay: (entry: NativeFileEntry, path: string) => { setOpenFault(null); void said(openDay(entry, path)) },
    openFile: (entry: NativeFileEntry, path: string) => { setOpenFault(null); void said(openFile(entry, path)) },
    openPage: (entry: NativeFileEntry, kind: 'being' | 'thing') => { setOpenFault(null); void said(openPage(entry, kind)) },
  }
}

const message = (reason: unknown): string => reason instanceof Error ? reason.message : String(reason)

/** One owner reading per listed row, through the window's owner readings (owners/ownerReading.ts): asked one row after another,
 * so the carrier never sees a pile; each row's last answer drawn at once when the rows come back, and read again behind it. */
function useRowReadings<T>(family: string, transport: KernelTransportStatus, keys: readonly string[], read: (key: string) => Promise<T>): ReadonlyMap<string, T> {
  const epoch = useSpineEpoch()
  return useOwnerReadingsOf<T>(transport.kind === 'unavailable' ? [] : keys, key => JSON.stringify([family, transport, key]),
    key => async () => ({value: await read(key)}), epoch)
}

/** A listing a category draws, through the window's owner readings: its last answer drawn at once when the rows come back and read
 * again behind it, one read shared by the categories that list the same place (Flows, Beings and Things list your world's pages).
 * `absent` turns a refusal that means "nothing here yet" into the empty listing; any other refusal is the owner's words. With no
 * carrier nothing is read, unless `always` (a read that answers the carrier's absence itself). */
function useListing<T>(family: string, transport: KernelTransportStatus, place: string, read: () => Promise<T>,
  absent: (reason: unknown) => T | null = () => null, always = false): OwnerReading<T> {
  const epoch = useSpineEpoch()
  const key = transport.kind === 'unavailable' && !always ? null : JSON.stringify([family, transport, place])
  return useOwnerReading<T>(key, async () => {
    try { return {value: await read()} } catch (reason) {
      const empty = absent(reason)
      return empty === null ? {error: message(reason)} : {value: empty}
    }
  }, epoch).reading
}

/** The owner refuses a listing of a folder that does not exist: that is exactly "nothing written yet" (flow/instances.ts). */
const notYet = (reason: unknown): boolean => /No such file or directory/i.test(String(reason))
const NO_PAGES: PageListing = {schema: 'oi.page-list/v1', path: USER_FLOWS_DIR, pages: [], not_pages: [], more: false}
const NO_READINGS: ReadonlyMap<string, FlowReading> = new Map()

/** The Days rows: the day records at the root register's day surface, read
 * through the same owner route the L7 craft uses; each day's standing from
 * the owner's Day reading; then the NOW section. */
function DaysRows({needle, onSelectSubject, selectedSubject}: {
  needle: string
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
}) {
  const {transport} = useWorkspace()
  const listed = useListing<NativeDirectory>('files_list', transport, DAY_RECORDS_PATH, () => listFiles(transport, DAY_RECORDS_PATH))
  const directory = listed.status === 'answered' ? listed.value : null
  const fault = listed.status === 'refused' ? listed.error : null
  const {openDay, openFault} = useOpening()
  const records = useMemo(() => dayEntriesOf(directory?.entries ?? [])
    .filter(entry => civilDateOfDayFile(entry.name) !== null)
    .sort((a, b) => b.name.localeCompare(a.name)), [directory])
  const dates = useMemo(() => records.slice(0, ROWS_READ).map(entry => civilDateOfDayFile(entry.name) as string), [records])
  const standings = useRowReadings<DayStanding>('day_standing', transport, dates, date => dayRead(transport, dayRefOfDate(date)).then(dayStandingOf,
    (reason): DayStanding => ({state: 'refused', message: message(reason)})))
  const now = useNowRows()
  const needleText = needle.trim().toLocaleLowerCase()
  const days = records.filter(entry => !needleText || entry.name.toLocaleLowerCase().includes(needleText)
    || (dayWords(civilDateOfDayFile(entry.name) ?? '') ?? '').toLocaleLowerCase().includes(needleText))
  if (transport.kind === 'unavailable') {
    return <DesignedRead absence="The kernel carrier is unavailable" reason={transport.reason} affordance={`The day records list at ${DAY_RECORDS_PATH} when the carrier answers.`} />
  }
  if (fault) return <DesignedRead absence="The day-records read refused" reason={fault} affordance={`op files_list at ${DAY_RECORDS_PATH} — the same route the Document detail reads through.`} />
  if (!directory) return <p className="native-empty" role="status">Reading the day records…</p>
  return <>
    {days.length
      ? <DayRowList days={days} standings={standings} selectedSubject={selectedSubject} onSelectSubject={onSelectSubject} openDay={openDay} openFault={openFault} />
      : <p className="native-empty">{needleText ? 'No day records match this search.' : 'No day records at the root register yet.'}</p>}
    <NowSection rows={now} />
  </>
}

/** The Days rows as drawn (the mockup's `DAYS` rows): the day's mark, the day in words, the owner's standing; the record's path
 * and size are hover words. Select previews; double-click or Enter opens the Day. */
export function DayRowList({days, standings, selectedSubject, onSelectSubject, openDay, openFault}: {
  days: readonly NativeFileEntry[]
  standings: ReadonlyMap<string, DayStanding>
  selectedSubject: CentralSubjectSelection | null
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  openDay: (entry: NativeFileEntry, path: string) => void
  openFault: string | null
}) {
  return <section className="mode-browser-rows" aria-label="Days"><ul>
    {days.map(entry => {
      const path = entry.location?.path ?? `${DAY_RECORDS_PATH}/${entry.name}`
      const date = civilDateOfDayFile(entry.name) ?? entry.name
      const name = dayWords(date) ?? date
      const standing = standings.get(date)
      const size = sizeWords(entry.byte_len)
      const selected = selectedSubject?.kind === 'day' && selectedSubject.path === path
      return <li key={entry.location?.ref ?? entry.name}>
        <button type="button" data-browser-row className={`mode-browser-row${selected ? ' selected' : ''}`}
          aria-current={selected || undefined} data-day={date}
          data-i={`${name} (${date})|select the day — its record opens in the Document detail (CAS identity, basis, save-router standing); double-click or Enter opens the Day in the focused pane. ${dayStandingHover(standing)}`}
          title={`${path}${size ? ` · ${size}` : ''} — select the day; its craft opens in the Document detail. Double-click or Enter opens the Day in the focused pane. ${dayStandingHover(standing)}`}
          onClick={() => onSelectSubject({kind: 'day', path, location: entry.location ?? undefined})}
          onDoubleClick={() => openDay(entry, path)}
          onKeyDown={event => { if (event.key === 'Enter') openDay(entry, path) }}>
          <span aria-hidden="true"><KindMark kind="day" size={12} /></span><span>{name}</span>
          <span className="mode-browser-row-meta">{dayStandingWords(standing)}</span>
        </button>
      </li>
    })}
  </ul>{openFault && <p className="native-error" role="alert" data-open-fault>{openFault}</p>}</section>
}

/** The NOW section's rows from what the shell already holds: the agency reading's sessions (each space's host), their agents'
 * names and states (the one agent-sessions provider: the roster, the task reads, the needles), and the World scope's workcell. */
function useNowRows(): NowRow[] {
  const sessions = useAgentSessionsOptional()
  const config = useContext(ShellConfigContext)
  return useMemo(() => {
    if (!sessions) return []
    const tracks = new Map(sessions.tracks.filter(track => !track.group).map(track => [track.sessionRef, track]))
    const needleKnown = !sessions.temporalError
    return nowRows(sessions.rows.map(row => {
      const track = tracks.get(row.sessionRef)
      return {host: hostOfSpace(row.raw), agent: track?.agentName ?? null, state: track ? sessionState(track, needleKnown) : null}
    }), config?.world_scope?.workcell_ref ?? null)
  }, [sessions, config])
}

/** The NOW section under the Days (the mockup's `NOW` separator and its rows): where sessions run and what runs there now. Absent
 * when no reading places a session on a machine. */
export function NowSection({rows}: {rows: readonly NowRow[]}) {
  if (!rows.length) return null
  return <section className="mode-browser-rows" aria-label="Now" data-now>
    <div className="mode-browser-sep"><span>NOW</span></div>
    <ul>{rows.map(row => <li key={row.key}>
      <div className="mode-browser-row" data-now-machine={row.key} data-i={`${row.name}|${row.hover}`} title={row.hover}>
        <span aria-hidden="true"><Icon name="placed" size={12} /></span><span>{row.name}</span>
        <span className="mode-browser-row-meta">{row.standing}</span>
      </div>
    </li>)}</ul>
  </section>
}

/** The Flows rows: the page owner's listing of your world's folder (`page` list at Control/user/flows, its entries kept whole so
 * the open gesture has the owner's own entry) and each Flow's title, agents and revision — the words the owner's listing already
 * carries for a Flow it placed by its island (`flowReadingsOfListing`), so a Flow is read once, to be listed. A Flow whose words the
 * listing does not carry (a kernel that lists without them) is read on its own, one after another (flow/instances.ts
 * readFlowInstance — the Flow's own parser). */
function FlowsRows({needle, onSelectSubject, selectedSubject}: {
  needle: string
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
}) {
  const {transport} = useWorkspace()
  const listed = useListing<PageListing>('page_list', transport, USER_FLOWS_DIR, () => listWorldPages(transport, USER_FLOWS_DIR), reason => notYet(reason) ? NO_PAGES : null)
  // The page owner places each file by its island: only a Flow lists here (a Being or a Thing in the same folder is no Flow).
  const listing = useMemo(() => listed.status === 'answered' && listed.value ? entriesOfForm(listed.value, 'flow') : null, [listed])
  const fault = listed.status === 'refused' ? listed.error : null
  const {openFile, openFault} = useOpening()
  const flows = useMemo(() => [...(listing ?? [])].sort(flowOrder), [listing])
  const byRef = useMemo(() => new Map(flows.map(entry => [entry.location.ref, entry])), [flows])
  // What the listing read of each Flow is what its row draws: it comes and goes with the listing's own reading, so a return or a
  // relaunch draws the rows' words with the rows. Only a Flow the listing gives no words for is read on its own.
  const carried = useMemo(() => listed.status === 'answered' && listed.value ? flowReadingsOfListing(listed.value) : NO_READINGS, [listed])
  const refs = useMemo(() => flows.slice(0, ROWS_READ).map(entry => entry.location.ref).filter(ref => !carried.has(ref)), [flows, carried])
  const own = useRowReadings<FlowReading>('flow_read', transport, refs, ref => readFlowInstance(transport, byRef.get(ref)!.location)
    .then(instance => flowReadingOf(instance.doc), (reason): FlowReading => ({state: 'refused', message: message(reason)})))
  const readings = carried.size ? new Map([...own, ...carried]) : own
  if (transport.kind === 'unavailable') {
    return <DesignedRead absence="The kernel carrier is unavailable" reason={transport.reason} affordance={`The Flows list at ${USER_FLOWS_DIR} when the carrier answers.`} />
  }
  if (fault) return <DesignedRead absence="The Flow listing refused" reason={fault} affordance={`op files_list at ${USER_FLOWS_DIR} — the route the Flow pane reads through.`} />
  if (!listing) return <p className="native-empty" role="status">Reading the Flows…</p>
  const needleText = needle.trim().toLocaleLowerCase()
  const shown = flows.filter(entry => !needleText || `${entry.name} ${flowRowWords(entry.name, readings.get(entry.location.ref)).name}`.toLocaleLowerCase().includes(needleText))
  if (!shown.length) return <p className="native-empty">{needleText ? 'No Flows match this search.' : 'No Flow written yet.'}</p>
  return <FlowRowList flows={shown} readings={readings} selectedSubject={selectedSubject} onSelectSubject={onSelectSubject} openFile={openFile} openFault={openFault} />
}

/** Each Flow's row words, by ref, from the words the page owner's listing carries for it: beside a Flow's place, a `flow` record of
 * the `meta` keys its row draws — `title`, `revision`, and each participant's `kind`, `name` and `initial` (kernel page.rs
 * list_pages). They are read by the Flow's own row parser (rowWords.ts flowReadingOf), as the Flow's payload is. A Flow whose
 * listing gives no such record (a kernel that lists without it) has no entry here. Pure. */
export function flowReadingsOfListing(listing: PageListing): Map<string, FlowReading> {
  const readings = new Map<string, FlowReading>()
  for (const page of listing.pages) {
    const words = (page as {readonly flow?: unknown}).flow
    if (page.form === 'flow' && words && typeof words === 'object') readings.set(page.location.ref, flowReadingOf({meta: words}))
  }
  return readings
}

/** The pages of one form in a page listing, as the rows' file entries. Pure. */
export function entriesOfForm(listing: PageListing, form: PageForm): NativeFileEntry[] {
  return listing.pages.filter(page => page.form === form)
    .map(page => ({name: page.name, location: page.location, kind: 'file' as const, byte_len: 0, retrieval_allowed: true}))
}

/** The Worlds rows (manual §18.1 "The track": "To bring a world into today, drag it from the browser onto an empty track"): your
 * world and each project's, from Central's disclosure of its registers. A row is not opened: it carries the world's ref onto the
 * set, dragged onto the empty track or, as Live loads a browser item, double-clicked or Entered (seatWorldFromBrowser). */
function WorldsRows({needle}: {needle: string}) {
  const {transport} = useWorkspace()
  const listed = useListing<CentralWorldsReading>('world_browse', transport, 'worlds', () => readWorlds(transport), () => null, true)
  const worlds: CentralWorldsReading = listed.status === 'answered' && listed.value ? listed.value
    : listed.status === 'refused' ? {state: 'unavailable', reason: listed.error ?? 'Central did not answer'} : {state: 'reading'}
  // The set's last answer: a world brought in is a status; a refusal (today's Day not open, in the Day's words) an alert (#806).
  const [said, setSaid] = useState<{readonly ok: boolean; readonly words: string} | null>(null)
  if (worlds.state === 'reading') return <p className="native-empty" role="status">Reading the worlds…</p>
  if (worlds.state === 'unavailable') return <DesignedRead absence="Central did not disclose its worlds" reason={worlds.reason} affordance="op world_browse — the root register and each project's ProjectCentral." />
  const needleText = needle.trim().toLocaleLowerCase()
  const shown = worlds.worlds.filter(world => !needleText || `${world.name} ${world.ref}`.toLocaleLowerCase().includes(needleText))
  if (!shown.length) return <p className="native-empty">No world matches this search.</p>
  return <WorldRowList worlds={shown} said={said?.ok ? said.words : null} fault={said && !said.ok ? said.words : null} onSeat={world => {
    setSaid(null)
    void seatWorldFromBrowser(world).then(answer => setSaid(answer.ok ? {ok: true, words: answer.note ?? `${world.name} is in today's set.`}
      : {ok: false, words: answer.error ?? `${world.name} did not come into today.`}))
  }} onAddFolder={() => {
    setSaid(null)
    void addFolderFromBrowser(() => chooseFolder('work'), openSettings).then(fault => { if (fault) setSaid({ok: false, words: fault}) })
  }} />
}

/** The Work place's Add folder… (manual §10.11, Projects: "The browser's Work place: Add folder… opens this step for that folder"): the
 * system's folder chooser, then Settings on Setup's Projects step for the folder chosen; nothing is brought in or made until its Accept.
 * Resolves to why nothing opened (the chooser refused, in its words), or null; a cancel opens nothing. */
export async function addFolderFromBrowser(choose: () => Promise<string | null>, open: (request: SettingsRequest) => void): Promise<string | null> {
  try {
    const folder = await choose()
    if (folder) open(setupRequest('Back to work', folder))
    return null
  } catch (cause) { return cause instanceof Error ? cause.message : String(cause) }
}

/** The Worlds rows as drawn: each world's mark, name and kind; dragged, double-clicked or Entered to bring it into today; the set's
 * last answer under them — a world brought in as a status, a refusal as an alert in the owner's words. */
export function WorldRowList({worlds, onSeat, said, fault = null, onAddFolder}: {readonly worlds: readonly CentralWorld[]; onSeat(world: CentralWorld): void; readonly said: string | null
  readonly fault?: string | null; onAddFolder?(): void}) {
  return <section className="mode-browser-rows" aria-label="Worlds"><ul>
    {worlds.map(world => {
      const hover = `${world.name} — ${world.kind === 'yours' ? 'your own world' : `${world.project}'s world`}; its pages are kept in ${world.folder}. Drag it onto the empty track, or double-click it or press Enter, to bring it into today.`
      return <li key={world.ref}>
        <div className="mode-browser-row" data-world={world.ref} draggable tabIndex={0} data-i={`${world.name}|${hover}`} title={hover}
          onDragStart={event => { event.dataTransfer.setData(CENTRAL_WORLD_DRAG, world.ref); event.dataTransfer.setData('text/plain', world.name); event.dataTransfer.effectAllowed = 'copy' }}
          onDoubleClick={() => onSeat(world)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.altKey && !event.metaKey && !event.ctrlKey) { event.preventDefault(); onSeat(world) } }}>
          <span aria-hidden="true"><KindMark kind="world" size={12} /></span><span>{world.name}</span>
          <span className="mode-browser-row-meta">{world.kind === 'yours' ? 'yours' : 'project'}</span>
        </div>
      </li>
    })}
  </ul>{onAddFolder && <button type="button" className="mode-browser-row" data-add-folder
    data-i="Add folder…|Choose a folder of your work: Setup's Projects step opens for it, to bring it into your ground's Work. Nothing moves until you accept."
    title="Choose a folder of your work: Setup's Projects step opens for it, to bring it into your ground's Work. Nothing moves until you accept."
    onClick={onAddFolder}>Add folder…</button>}
  {said && <p className="native-empty" role="status">{said}</p>}{fault && <p className="native-error" role="alert" data-seat-fault>{fault}</p>}</section>
}

/** Bring a world into today's set from its browser row (Live: double-click or Enter loads a browser item): through the set the Session
 * pane draws, the same seat its empty track takes a drop on, so it writes what a drop writes. With no such set drawn nothing is
 * written, and it says where a world is seated. */
export async function seatWorldFromBrowser(world: Pick<CentralWorld, 'ref' | 'name'>, rows: TrackRows | null = trackRows()): Promise<{ok: boolean; note?: string; error?: string}> {
  const seat = rows?.set.actions?.seat
  if (!seat || seat.accepts !== CENTRAL_WORLD_DRAG) return {ok: false, error: `Open Central's Session to bring ${world.name} into today: a world is seated on its empty track.`}
  try {
    const answer = await seat.run(world.ref) as {ok?: boolean; note?: string; error?: string} | undefined
    return answer && typeof answer.ok === 'boolean' ? {ok: answer.ok, ...(answer.note ? {note: answer.note} : {}), ...(answer.error ? {error: answer.error} : {})} : {ok: true}
  } catch (error) {
    return {ok: false, error: error instanceof Error ? error.message : String(error)}
  }
}

/** The Beings or Things rows: the pages of that form in your world, placed by their island through the page owner. Select previews
 * the page in Clip view; double-click or Enter opens it in the focused pane. */
function PageRows({form, label, needle, onSelectSubject, selectedSubject}: {
  form: PageForm
  label: string
  needle: string
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
}) {
  const {transport} = useWorkspace()
  const listed = useListing<PageListing>('page_list', transport, USER_FLOWS_DIR, () => listWorldPages(transport, USER_FLOWS_DIR), reason => notYet(reason) ? NO_PAGES : null)
  const listing = listed.status === 'answered' ? listed.value : null
  const fault = listed.status === 'refused' ? listed.error : null
  const {openPage, openFault} = useOpening()
  if (transport.kind === 'unavailable') return <DesignedRead absence="The kernel carrier is unavailable" reason={transport.reason} affordance={`The ${label} of your world list when the carrier answers.`} />
  if (fault) return <DesignedRead absence={`The ${label} listing refused`} reason={fault} affordance={`op page {operation: list} at ${USER_FLOWS_DIR}.`} />
  if (!listing) return <p className="native-empty" role="status">Reading the {label}…</p>
  const needleText = needle.trim().toLocaleLowerCase()
  const pages = listing.pages.filter(page => page.form === form && (!needleText || `${page.title ?? ''} ${page.name}`.toLocaleLowerCase().includes(needleText)))
  if (!pages.length) return <p className="native-empty">{needleText ? `No ${label} match this search.` : `Your world holds no ${label} yet: make one from New….`}</p>
  return <section className="mode-browser-rows" aria-label={label}><ul>
    {pages.map(page => {
      const path = page.location.path
      const selected = selectedSubject?.path === path
      const name = page.title || page.name.replace(/\.html$/i, '')
      const entry: NativeFileEntry = {name: page.name, location: page.location, kind: 'file', byte_len: 0, retrieval_allowed: true}
      return <li key={page.location.ref}>
        <button type="button" data-browser-row className={`mode-browser-row${selected ? ' selected' : ''}`} aria-current={selected || undefined} data-page={page.name}
          data-i={`${name}|select the page — it opens in Clip view; double-click or Enter opens it in the focused pane. ${path}`} title={`${path} — double-click or Enter opens it in the focused pane.`}
          onClick={() => onSelectSubject({kind: 'note', path, location: page.location})}
          onDoubleClick={() => openPage(entry, form === 'thing' ? 'thing' : 'being')}
          onKeyDown={event => { if (event.key === 'Enter') openPage(entry, form === 'thing' ? 'thing' : 'being') }}>
          <span aria-hidden="true"><KindMark kind={form === 'being' ? 'agent' : 'source'} size={12} /></span><span>{name}</span>
          <span className="mode-browser-row-meta">{form === 'being' ? 'being' : 'thing'}{page.world ? ` · ${page.world.replace(/^central:wiki:(project:)?/, '')}` : ''}</span>
        </button>
      </li>
    })}
  </ul>{openFault && <p className="native-error" role="alert" data-open-fault>{openFault}</p>}</section>
}

/** The Flows rows as drawn (the mockup's `FLOWS` rows): the Flow's mark, its title, its agents and revision. Select previews in
 * the Document detail; double-click or Enter opens the Flow in the focused pane. */
export function FlowRowList({flows, readings, selectedSubject, onSelectSubject, openFile, openFault}: {
  flows: readonly NativeFileEntry[]
  readings: ReadonlyMap<string, FlowReading>
  selectedSubject: CentralSubjectSelection | null
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  openFile: (entry: NativeFileEntry, path: string) => void
  openFault: string | null
}) {
  return <section className="mode-browser-rows" aria-label="Flows"><ul>
    {flows.map(entry => {
      const path = entry.location.path
      const words = flowRowWords(entry.name, readings.get(entry.location.ref))
      const size = sizeWords(entry.byte_len)
      const selected = selectedSubject?.path === path
      return <li key={entry.location.ref}>
        <button type="button" data-browser-row className={`mode-browser-row${selected ? ' selected' : ''}`} aria-current={selected || undefined}
          data-flow={entry.name}
          data-i={`${words.name}|select the Flow — it opens in the Document detail; double-click or Enter opens it in the focused pane. ${words.hover}`}
          title={`${path}${size ? ` · ${size}` : ''} — ${words.hover} Double-click or Enter opens it in the focused pane.`}
          onClick={() => onSelectSubject({kind: 'note', path, location: entry.location})}
          onDoubleClick={() => openFile(entry, path)}
          onKeyDown={event => { if (event.key === 'Enter') openFile(entry, path) }}>
          <span aria-hidden="true"><KindMark kind="doc" size={12} /></span><span>{words.name}</span>
          <span className="mode-browser-row-meta">{words.standing}</span>
        </button>
      </li>
    })}
  </ul>{openFault && <p className="native-error" role="alert" data-open-fault>{openFault}</p>}</section>
}

/** The Files rows: the ground's listing through the workspace's directory
 * resource — the same listing the WorldBrowser's Files category reads. */
function GroundRows({needle, onSelectSubject, selectedSubject, opens, note}: {
  needle: string
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
  /** Central's Files open into its panes on double-click or Enter; Technē's take the file to hand (its lens), as they did. */
  opens: boolean
  /** The category's own note under its rows (ROW_NOTES). */
  note?: string
}) {
  const workspace = useWorkspace()
  const {transport, workspaceId, accessEpoch, accessReady, sourceRecoveryReady, resources, browserPath: path, navigateFiles, selectedRef} = workspace
  const [directory, setDirectory] = useState<NativeDirectory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const {openFile, openFault} = useOpening()
  const origin = useMemo(() => ({current: workspace}), [workspace])
  origin.current = workspace
  useEffect(() => {
    let live = true
    setDirectory(null); setError(null)
    if (transport.kind === 'unavailable' || !accessReady || !sourceRecoveryReady
      || origin.current.workspaceId !== workspaceId || !workspace.nativeAccessCurrent(accessEpoch)) {setLoading(false); return}
    const listing = resources.directory(workspaceId)
    const listingKey = listing.activeWorkspaceKey
    const sync = () => {
      if (!live || listing.activeWorkspaceKey !== listingKey || origin.current.workspaceId !== workspaceId || !workspace.nativeAccessCurrent(accessEpoch)) return
      const entry = listing.entry(path)
      setDirectory(entry.reading ?? null); setError(entry.error ?? null); setLoading(entry.status === 'pending')
      if (entry.status === 'pending') resources.ensureDirectory(workspaceId, path)
    }
    const unsubscribe = listing.subscribe(sync)
    if (workspace.nativeAccessCurrent(accessEpoch)) resources.ensureDirectory(workspaceId, path)
    sync()
    return () => {live = false; unsubscribe()}
  }, [transport, path, workspaceId, accessEpoch, accessReady, sourceRecoveryReady, resources])
  const parts = (directory?.location.path ?? path).split('/').filter(Boolean)
  const needleText = needle.trim().toLocaleLowerCase()
  const entries = (directory?.entries ?? [])
    .filter(entry => !entry.name.startsWith('.'))
    .filter(entry => !needleText || entry.name.toLocaleLowerCase().includes(needleText))
    .sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name.localeCompare(b.name))
  if (transport.kind === 'unavailable') {
    return <DesignedRead absence="The kernel carrier is unavailable" reason={transport.reason} affordance="The ground's listing walks from the ground root when the carrier answers." />
  }
  return <section className="mode-browser-rows" aria-label="Ground files">
    <div className="mode-browser-crumbs" aria-label="Ground path">
      <button type="button" onClick={() => navigateFiles('')} aria-current={!parts.length ? 'location' : undefined}
        data-i="Ground root|walk to the ground root" title="Ground root">⌂</button>
      {parts.map((part, index) => <span key={parts.slice(0, index + 1).join('/')}>
        <span aria-hidden="true">›</span>
        <button type="button" onClick={() => navigateFiles(parts.slice(0, index + 1).join('/'))}
          aria-current={index === parts.length - 1 ? 'location' : undefined}
          data-i={`${part}|walk to this folder`} title={part}>{part}</button>
      </span>)}
    </div>
    {error && <p className="native-error" role="alert">{error}</p>}
    {openFault && <p className="native-error" role="alert" data-open-fault>{openFault}</p>}
    {loading && <p className="native-empty" role="status">Reading the ground…</p>}
    {directory && <ul>
      {parts.length > 0 && <li><button type="button" className="mode-browser-row" onClick={() => navigateFiles(parts.slice(0, -1).join('/'))}
        data-i="Parent folder|walk up one folder" title="Parent folder"><span aria-hidden="true">↰</span><span>Parent folder</span></button></li>}
      {entries.map(entry => {
        const isDirectory = entry.kind === 'directory'
        const entryPath = entry.location?.path ?? (parts.concat(entry.name).join('/'))
        const selected = selectedSubject?.path === entryPath
        // A file's size is hover words; the row stands on nothing the mockup's Files rows do not draw.
        const size = isDirectory ? null : sizeWords(entry.byte_len)
        return <li key={entry.location?.ref ?? entry.name}>
          <button type="button" data-browser-row
            className={`mode-browser-row${selected || selectedRef === entry.location?.ref ? ' selected' : ''}`}
            aria-current={selected || undefined}
            data-i={isDirectory ? `${entry.name}|open the folder's listing` : `${entry.name}|select the ${entry.kind} — its craft opens in the Document detail${opens ? '; double-click or Enter opens it in the focused pane' : ''}${size ? `. ${size}` : ''}`}
            title={`${entryPath}${size ? ` · ${size}` : ''} — ${isDirectory ? 'open the folder' : `select; the craft opens in the Document detail${opens ? '. Double-click or Enter opens it in the focused pane' : ''}`}`}
            onClick={() => isDirectory ? navigateFiles(entryPath) : onSelectSubject(entryPath.endsWith('.md') && /\/now\/day\/\d{4}-\d{2}-\d{2}\.md$/.test(entryPath) ? {kind: 'day', path: entryPath, location: entry.location ?? undefined} : {kind: 'note', path: entryPath, location: entry.location ?? undefined})}
            onDoubleClick={opens && !isDirectory ? () => openFile(entry, entryPath) : undefined}
            onKeyDown={opens && !isDirectory ? event => { if (event.key === 'Enter') openFile(entry, entryPath) } : undefined}>
            <span aria-hidden="true">{isDirectory ? <Icon name="lib" size={12} /> : <KindMark kind="doc" size={12} />}</span>
            <span>{entry.name}</span>
          </button>
        </li>
      })}
    </ul>}
    {directory && !entries.length && <p className="native-empty">{needleText ? 'No entries match in this folder.' : 'This folder has no visible entries.'}</p>}
    {note && <p className="native-empty" role="note">{note}</p>}
  </section>
}

/** The Technē Sources rows: the retained app's own work list; a row opens
 * the work in the instrument (the existing request door). Under the
 * mockup's separator (`vault · sources`), named for what the rows are. */
function SourceRows({needle}: {needle: string}) {
  const workspace = useWorkspace()
  const needleText = needle.trim().toLocaleLowerCase()
  const works = workspace.nativeWorks.filter(work => !needleText || work.title.toLocaleLowerCase().includes(needleText))
  if (!workspace.nativeWorks.length) {
    return <DesignedRead absence="No works disclosed" reason="The retained app has not disclosed its works in this reading."
      affordance="Sources to hand lists the open works; each opens in its instrument." />
  }
  if (!works.length) return <p className="native-empty">No sources match this search.</p>
  return <section className="mode-browser-rows" aria-label="Sources to hand">
    <div className="mode-browser-sep"><span>works · the retained app</span><span>open in an instrument</span></div>
    <ul>
    {works.map(work => <li key={work.expression_ref}>
      <button type="button" data-browser-row className="mode-browser-row"
        data-i={`Open ${work.title}|open the source in its instrument (the retained field) — ${work.expression_ref}, revision ${work.revision}`}
        title={`${work.expression_ref} · revision ${work.revision} — opens in the instrument`}
        onClick={() => workspace.requestExpression(work.expression_ref)}>
        <span aria-hidden="true"><KindMark kind="expression" size={12} /></span><span>{work.title}</span>
        <span className="mode-browser-row-meta mono">r{work.revision}</span>
      </button>
    </li>)}
  </ul></section>
}

/** Technē's World groups (the ticket N; manual §8 "Everything starts from the world"): the owners' own subjects as rows, read from
 * the suite reading's standing (the store the atlas and the tracks read; the suite is read once per session, sharing a read in
 * flight — provider/suiteProvider.ts `ensureSuiteStanding`) and from the World reading's walks. A row selects THE selection
 * through the book's one writer; it opens through N2's subject door, and the door's answer is held for every face
 * (techne/subject/subjectOpenings.ts). A journey opens by standing its first stop, the Session grid's own act
 * (frame/tracks/useTechneTracks.ts `techneControls`). */
/** The browser's World › Palaces: the atlas's palaces (FOUNDATION N4), read on demand and entered on the Earth. */
const PALACES_GROUP = 'techne-palaces'
const NO_OPENINGS: ReadonlyMap<string, SubjectOpening> = new Map()
function PalaceGroupRows({category, mode, needle}: {category: ModeBrowserCategory; mode: SurfMode; needle: string}) {
  const {rows, load} = usePalaces()
  const continuity = useOptionalContinuity()
  const [stood, setStood] = useState<ReadonlyMap<string, string>>(new Map())
  useEffect(() => { readPalaces() }, [])
  const group = palaceWorldGroup(rows, palacesWaiting(load, rows.length))
  const selection = continuity?.current.context?.selection ?? null
  const select = (row: WorldRow) => continuity?.select({mode, kind: row.kind, ref: row.subject.ref, title: row.subject.title})
  const open = (row: WorldRow) => {
    select(row)
    const palace = rows.find(candidate => `palace:${candidate.key}` === row.key)
    if (!palace) return
    setStood(before => new Map(before).set(row.key, 'entering…'))
    // the Earth into view, never behind the focused pane's held Canvas or document (instrumentDoor.ts bringInstrumentIntoView)
    void enterFromOutside(palace, () => bringInstrumentIntoView('projection.earth'))
      .then(said => setStood(before => new Map(before).set(row.key, said ?? 'entered on the Earth')))
  }
  return <WorldGroupBody category={category} group={group} needle={needle} openings={NO_OPENINGS} stood={stood}
    selected={selection ? {ref: selection.ref, kind: selection.kind} : null} onSelect={select} onOpen={open} onChoose={() => {}} />
}

/** One World group from its owners' readings: the suite standing, the World reading's walks, and (T-WORLDS §5 W3) your planet's body and
 * your system. The rows and the category's waiting dot both read it, so the dot stands only while the group itself waits. */
function useWorldGroup(id: WorldGroupId, hint: string) {
  const {transport} = useWorkspace()
  const standing = useSyncExternalStore(subscribeSuiteStanding, suiteStanding, suiteStanding)
  const body = useSyncExternalStore(subscribeWorldBody, worldBodyState, worldBodyState)
  const system = useSyncExternalStore(subscribeSystem, systemReading, systemReading)
  const reading = useTimelineReading()
  useEffect(() => {
    if (transport.kind === 'unavailable' || suiteStanding().phase !== 'idle') return
    // The provider is loaded on demand, as the atlas loads it: the shell's import of the standing stays light.
    void import('../projections/atlas/provider/suiteProvider').then(provider => provider.ensureSuiteStanding(transport))
  }, [transport])
  const world = reading?.world
  const group = worldGroupOf(id, {
    standing, world: worldReadingOf(world?.source), body, system,
    carrier: transport.kind === 'unavailable' ? {available: false, reason: transport.reason} : {available: true},
  }, hint)
  return {group, world, reading}
}

/** A World group's waiting dot in the category list, from the group's own state (not the grammar's declaration). */
function WorldGroupDot({id, hint}: {id: WorldGroupId; hint: string}) {
  const {group} = useWorldGroup(id, hint)
  return group.state === 'waiting' ? <span className="mode-browser-waiting-dot" aria-label={`waiting: ${group.words}`} /> : null
}

function WorldGroupRows({category, id, mode, needle}: {category: ModeBrowserCategory; id: WorldGroupId; mode: SurfMode; needle: string}) {
  const continuity = useOptionalContinuity()
  const openings = useSubjectOpenings()
  const [stood, setStood] = useState<ReadonlyMap<string, string>>(new Map())
  const {group, world, reading} = useWorldGroup(id, category.hint)
  const selection = continuity?.current.context?.selection ?? null
  const select = (row: WorldRow) => continuity?.select({mode, kind: row.kind, ref: row.subject.ref, title: row.subject.title})
  const open = (row: WorldRow) => {
    select(row)
    if (row.opens === 'subject') { void openHeldSubject(row.subject); return }
    // your planet: the World shows your own body, brought into view (the Earth's pane, never behind a held Canvas or document)
    if (row.opens === 'body') { chooseBody('own'); bringInstrumentIntoView('projection.earth'); return }
    const walk = row.walk, first = walk?.stops[0]
    if (!walk || !first) { setStood(before => new Map(before).set(row.key, 'This walk has no stop to stand.')); return }
    const controls = techneControls(() => ({view: world, door: reading?.journey?.openExpression}))
    void controls.stand(walk, first).then(absence => setStood(before => new Map(before).set(row.key, absence ?? 'at stop 1')))
  }
  const choose = (row: WorldRow, scene: SceneRow) => { select(row); chooseHeldScene(row.subject.ref, scene.scene, row.subject.title) }
  return <WorldGroupBody category={category} group={group} needle={needle} openings={openings} stood={stood}
    selected={selection ? {ref: selection.ref, kind: selection.kind} : null} onSelect={select} onOpen={open} onChoose={choose} />
}

/** A World group as drawn (the mockup's `bi()` rows, renderBrowser :1501–1505): each row its kind mark, its name in words and its standing —
 * the owner's own, or the door's answer once asked (the Scene asked for; an absence in the owner's words). The Scenes that carry an
 * opened subject stand under its row, one step in; pressing one opens it instead. While the owners have not answered, the group
 * says on what it waits, at the designed empty category's rhythm. */
export function WorldGroupBody({category, group, needle, openings, stood, selected, onSelect, onOpen, onChoose}: {
  category: ModeBrowserCategory
  group: WorldGroup
  needle: string
  openings: ReadonlyMap<string, SubjectOpening>
  /** What standing a journey's first stop answered (null: stood), by row. */
  stood: ReadonlyMap<string, string>
  /** THE selection, to mark its row. */
  selected: {ref: string; kind: string} | null
  onSelect: (row: WorldRow) => void
  onOpen: (row: WorldRow) => void
  onChoose: (row: WorldRow, scene: SceneRow) => void
}) {
  if (group.state === 'waiting') {
    return <section className="mode-browser-empty" data-waiting={category.id} data-world-group={category.id} aria-label={`${category.label} — ${group.word}`}>
      <header className="mode-browser-empty-head">
        <span className="mode-browser-empty-mark"><CategoryMark category={category} size={15} /></span>
        <strong>{category.label}</strong>
        <span className="mode-browser-empty-state">{group.word}</span>
      </header>
      <p className="mode-browser-empty-owner">{group.words}</p>
      {group.detail && <p className="mode-browser-empty-read" role="note">{group.detail}</p>}
    </section>
  }
  const needleText = needle.trim().toLocaleLowerCase()
  const rows = group.rows.filter(row => !needleText || row.name.toLocaleLowerCase().includes(needleText))
  return <section className="mode-browser-rows" aria-label={category.label} data-world-group={category.id}>
    <ul>{rows.map(row => {
      const opening = openings.get(row.subject.ref)
      const answered = row.opens === 'subject' ? openingWords(opening, row.name) : stood.has(row.key) ? {standing: stood.get(row.key)!, hover: stood.get(row.key)!} : null
      const standing = answered?.standing ?? row.standing
      const hover = answered ? `${answered.hover} ${row.hover}` : row.hover
      const isSelected = !!selected && selected.ref === row.subject.ref && selected.kind === row.kind
      const scenes = row.opens === 'subject' ? sceneRowsOf(opening, row.name) : []
      return <li key={row.key}>
        <button type="button" data-browser-row className={`mode-browser-row${isSelected ? ' selected' : ''}`} aria-current={isSelected || undefined}
          data-world-subject={row.key} data-opening={opening?.state}
          data-i={`${row.name}|${hover}`} title={hover}
          onClick={() => onSelect(row)} onDoubleClick={() => onOpen(row)}
          onKeyDown={event => { if (event.key === 'Enter') onOpen(row) }}>
          <span aria-hidden="true"><KindMark kind={row.mark} size={12} /></span><span>{row.name}</span>
          <span className="mode-browser-row-meta">{standing}</span>
        </button>
        {scenes.length > 0 && <ul aria-label={`Scenes that carry ${row.name}`}>{scenes.map(scene => <li key={scene.key}>
          <button type="button" data-browser-row className={`mode-browser-row ind1${scene.asked ? ' selected' : ''}`} data-subject-scene={scene.scene.scene_ref}
            data-i={`${scene.name}|${scene.hover}`} title={scene.hover} onClick={() => onChoose(row, scene)}>
            <span aria-hidden="true"><KindMark kind="expression" size={12} /></span><span>{scene.name}</span>
            <span className="mode-browser-row-meta">{scene.standing}</span>
          </button>
        </li>)}</ul>}
      </li>
    })}</ul>
    {!rows.length && <p className="native-empty">No {category.label.toLocaleLowerCase()} match this search.</p>}
    {group.note && <p className="native-empty" role="status">{group.note}</p>}
  </section>
}

/** The four document forms the New grid offers, in the mockup's order (Day · Flow · Beings · Things), by their kinds in the
 * owner's form roster (desktop/cradle/documents/forms.json), each wearing the cut rail's mark for its category. */
const NEW_FORMS: readonly {kind: string; mark: KindShapeName}[] = [
  {kind: 'document-42', mark: 'day'}, {kind: 'document-01', mark: 'doc'}, {kind: 'document-beings', mark: 'agent'}, {kind: 'document-things', mark: 'source'},
]
/** The Workbench opener that makes a new document of a form, by the id it publishes it under. */
export const formOpenerId = (kind: string): string => `form.${kind}`

/** New — the four document forms (the mockup's New… category, `.newforms`): a button per form, named and described by the
 * owner's form roster. A form is made through the Workbench's own opener for it (native/workbenchDoor.ts); while the Workbench
 * publishes none, the button stands drawn and says so — it lights only when its opener exists. */
export function NewForms({forms = DOCUMENT_FORMS, openers}: {forms?: readonly DocumentForm[]; openers?: readonly WorkbenchOpener[]}) {
  const published = useWorkbenchOpeners()
  const doors = openers ?? published
  const offered = NEW_FORMS.flatMap(({kind, mark}) => {
    const form = forms.find(entry => entry.kind === kind)
    return form ? [{form, mark, opener: doors.find(opener => opener.id === formOpenerId(kind)) ?? null}] : []
  })
  const practice = doors.filter(opener => opener.id.startsWith('form.practice-'))
  return <section className="mode-browser-rows" aria-label="New">
    <div className="mode-browser-sep"><span>New document — the four forms</span></div>
    <div className="mode-browser-newforms">
      {offered.map(({form, mark, opener}) => <NewTile key={form.kind} id={form.kind} name={`New ${form.label}`} opener={opener}
        idle={`New ${form.label}|${form.hint}. ${opener ? 'Makes a new one in the focused pane.' : 'The Workbench publishes no opener for this form yet, so it is not made from here.'}`}
        title={`${form.label} — ${form.hint}. ${opener ? 'Makes a new one in the focused pane.' : 'Not made from the browser yet: the Workbench publishes no opener for this form.'}`}>
        <b aria-hidden="true"><KindMark kind={mark} size={15} /></b>{form.label}
      </NewTile>)}
    </div>
    {/* Your practice (T-WORLDS W4; manual §24.5): the pages your practice keeps, made in your practice world through the Workbench's own
        openers for them (inhabitants/ql/devices/practiceLaunch.ts) — a journal, a dream journal, a journey. */}
    {practice.length > 0 && <>
      <div className="mode-browser-sep"><span>Your practice</span></div>
      <div className="mode-browser-newforms" data-new-practice>
        {practice.map(opener => <NewTile key={opener.id} id={opener.id} name={`New ${opener.title}`} opener={opener}
          idle={`New ${opener.title}|${opener.hint}. Makes it in your practice world and opens it in the focused pane.`}
          title={`${opener.title} — ${opener.hint}.`}>
          <b aria-hidden="true"><KindMark kind="doc" size={15} /></b>{opener.title}
        </NewTile>)}
      </div>
    </>}
  </section>
}

/** One New… tile (a form of the four, or a page of your practice): a press makes one thing through the Workbench's opener. While that
 * make is in flight the tile stands Waiting (manual §16.11: sent, not yet confirmed) and holds off every other press, so a double-click
 * makes one thing (walked 29 Oct: it acted twice, then said "nothing was made" when something was; O-I #750). When the opener answers,
 * the tile says on the status bar's Info line what was made, or the owner's own words when it refused — through its data-i, the one
 * channel the Info line reads. */
export function NewTile({id, name, opener, idle, title, children}: {id: string; name: string; opener: WorkbenchOpener | null; idle: string; title: string; children: ReactNode}) {
  const [making, setMaking] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const self = useRef<HTMLButtonElement>(null)
  const press = useMemo(() => opener && makeOnce(name, () => opener.open(), {making: setMaking, say: setSaid}), [opener, name])
  // The Info line reads what the pointer enters: once the answer stands in the tile's data-i, the tile is read again where it stands.
  useEffect(() => { if (said !== null && typeof MouseEvent !== 'undefined') self.current?.dispatchEvent(new MouseEvent('mouseover', {bubbles: true})) }, [said])
  return <button ref={self} type="button" data-new-form={id} disabled={!opener} aria-busy={making || undefined} data-standing={making ? 'waiting' : undefined}
    onClick={press ? (event: ReactMouseEvent<HTMLButtonElement>) => press(event.detail) : undefined} onMouseLeave={() => setSaid(null)} data-i={said ?? idle} title={title}>{children}</button>
}

/** A press that makes one thing at a time (a New… tile's): the press of `detail` 1 asks `open`; the second click of a double-click
 * (detail 2 and on), and any press while the first is still being made, make nothing more. While it is made, `making` is true; when the
 * opener answers, `say` gets the tile's Info line — `name|what was made`, or `name|the owner's own words` when it refused. An opener that
 * answers nothing (it only opens a surface) says nothing. Returns the press. */
export function makeOnce(name: string, open: () => void | Promise<string>, on: {making: (making: boolean) => void; say: (line: string | null) => void}): (detail: number) => void {
  let held = false
  const words = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))
  return detail => {
    if (held || detail > 1) return
    held = true
    on.say(null)
    let answer: void | Promise<string>
    try { answer = open() } catch (cause) { held = false; on.say(`${name}|${words(cause)}`); return }
    if (!answer) { held = false; return }
    on.making(true)
    answer.then(made => on.say(`${name}|${made}`), cause => on.say(`${name}|${words(cause)}`)).finally(() => { held = false; on.making(false) })
  }
}

/** The designed empty category — the owner has not landed. Names the owner
 * and the affordance that would fill it (the widget guide's law), drawn at
 * browser density: mark, name, wait, read — never a bare sentence. */
function DesignedEmptyCategory({category}: {category: ModeBrowserCategory}) {
  return <section className="mode-browser-empty" data-waiting={category.id} aria-label={`${category.label} — declared, waiting`}>
    <header className="mode-browser-empty-head">
      <span className="mode-browser-empty-mark"><CategoryMark category={category} size={15} /></span>
      <strong>{category.label}</strong>
      <span className="mode-browser-empty-state">declared, waiting</span>
    </header>
    <p className="mode-browser-empty-owner">{category.hint}</p>
    {category.family && <p className="mode-browser-empty-read" role="note">Fills from the <b>{category.family}</b> family's declared entries when its owner lands — the category holds its place, honestly empty.</p>}
  </section>
}

/** The designed read-absence block — a `cut` category whose owner read
 * refused or has no carrier. Names the absence and the affordance. */
function DesignedRead({absence, reason, affordance}: {absence: string; reason: string; affordance: string}) {
  return <section className="mode-browser-empty" data-read="absent" aria-label={absence}>
    <header className="mode-browser-empty-head">
      <span className="mode-browser-empty-mark"><Icon name="search" size={15} /></span>
      <strong>{absence}</strong>
    </header>
    <p className="mode-browser-empty-owner">{reason}</p>
    <p className="mode-browser-empty-read" role="note">{affordance}</p>
  </section>
}
