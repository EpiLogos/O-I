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
   * detail craft reads (`listFiles` → central.directory-reading/v1), at the
   * root register's day surface (`Control/agents/now/day`). Selecting a day
   * selects the Document detail's subject.
 * - Files — the ground's own listing through the workspace's directory
   * resource (the same listing WorldBrowser's Files category reads);
   * selecting a folder or note selects the subject; navigating walks the
   * ground.
 * - Sources (Technē) — the retained app's own work list
   * (`nativeWorks`); a row opens the work in the instrument
   * (`requestExpression` — the existing door).
 * - Family-declared categories compose after the mockup's own entries in the modes they name
 *   (`composeModeBrowser`, modeGrammar.ts; `allInhabitantBrowserEntries`, manifest.ts). A declared category with no
 *   row source here is `waiting` (a designed empty category) or a named fault when declared `cut`.
 * - Every declared-waiting category renders as a DESIGNED empty category:
   * mark, name, the owner it waits for, and the affordance that would fill
   * it (the widget guide's empty-state law) — never another mode's content,
   * never a bare sentence.
 *
 * Every control states its function (`data-i="label|fn"`, the F2 law).
 * Pure composition: no second store, no new owner read, no per-mode
 * conditional sprawl beyond the categories the grammar already declares.
 */

import {InstrumentsSection} from '../frame/InstrumentsSection'
import {SetsSection} from './SetsSection'
import {useEffect, useMemo, useState} from 'react'
import type {NativeDirectory, NativeFileEntry} from '../../../../../desktop/cradle/src/kernel/types'
import {listFiles} from '../../../../../desktop/cradle/src/files/client'
import {useCentralDocumentOpener} from '../central/documents/useOpenCentralDocument'
import {composeModeBrowser, ROW_SOURCE_OWNERS, type ModeBrowserCategory, type SurfMode} from './modeGrammar'
import {allInhabitantBrowserEntries} from '../inhabitants/manifest'
import {useWorkspace} from './workspace'
import {carrierOf} from './runContext'
import {Icon} from '../inhabitants/sdk/Icon'
import {KindMark} from '../inhabitants/sdk/marks.tsx'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import './modeSurface.css'
import {createPortal} from 'react-dom'
import type {BrowserCategory, ControlledBrowser} from '../frame/browser/browserKinds'

/** The root register's day surface — where the civil calendar's records
 * live (`centralDayNowModel`'s subjectDayRef reads this shape). */
const DAY_RECORDS_PATH = 'Control/agents/now/day'

/** The category's mark — the cut rail's kind drawing when the grammar
 * assigns one, the mono mark otherwise (icon-cut §7 "Browser rail"). */
function CategoryMark({category, size = 13}: {category: ModeBrowserCategory; size?: number}) {
  if (category.kindMark) return <KindMark kind={category.kindMark} size={size} />
  return <Icon name={category.mark} size={size} />
}

/** A mode's grammar categories in the one browser (F6): the ground's and the world's categories are material to open. */
export function modeBrowserCategories(mode: SurfMode): BrowserCategory[] {
  return composeModeBrowser(mode, allInhabitantBrowserEntries()).map(category => ({id: category.id, label: category.label, kind: 'material',
    mark: <CategoryMark category={category} />, hint: category.hint, waiting: category.state === 'waiting'}))
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
          <span>{activeCategory?.id === 'central-days' ? 'State' : activeCategory?.id === 'techne-sources' ? 'Rev' : 'Size'}</span>
        </div>
        {activeCategory && <CategoryRows category={activeCategory} mode={mode} needle={needle}
          onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} />}
  </>
  const pool = <section className="world-context-pool" aria-label="Browser context">
      <header><button type="button" data-i="Context|the selected category's standing — what its rows read, and what selecting a row does"
        title="Context — the category's standing"><span aria-hidden="true">▾</span> {activeCategory ? `${activeCategory.label} · ${activeCategory.state === 'waiting' ? 'declared, waiting' : 'reads'}` : 'Context'}</button></header>
      <div className="world-pool-body">
        {activeCategory && <CategoryContext category={activeCategory} mode={mode} />}
        <ApertureSlot mode={mode} selectedSubject={selectedSubject} />
      </div>
    </section>
  if (controlled) return <div className="mode-browser-body" data-mode-browser={mode}>{results}{controlled.poolHost && createPortal(pool, controlled.poolHost)}</div>

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
            data-i={`${category.label}|${category.hint}`}
            title={`${category.label} — ${category.hint}${category.state === 'waiting' ? ' (declared, waiting)' : ''}`}
            onClick={() => {setActive(category.id); setNeedle('')}}>
            <span aria-hidden="true"><CategoryMark category={category} /></span><span>{category.label}</span>
            {category.state === 'waiting' && <span className="mode-browser-waiting-dot" aria-label="declared, waiting" />}
          </button>)}
          {mode === 'base' && group === 'Project' && <button type="button" className="mode-browser-new" disabled
            data-i="New|exactly Day · Flow · Beings · Things — the four document forms. The create operation is not wired here yet; the button holds its place."
            title="New — exactly Day · Flow · Beings · Things. The create operation is not wired here yet; the button holds its place.">
            <span aria-hidden="true">+</span><span>New</span>
          </button>}
        </div>)}
      </nav>
      <div className="world-browser-results">{results}</div>
    </div>
    {pool}
    <InstrumentsSection /><SetsSection />
  </aside>
}

/** The aperture slot (Revision 3) — where Live keeps the groove pool: the
 * encounter concepts the focused pane follows, and the pane line. Honest
 * values only: the carrier's kind, the selected subject's path, the
 * reading's state — never an invented encounter. */
function ApertureSlot({mode, selectedSubject}: {mode: SurfMode; selectedSubject: CentralSubjectSelection | null}) {
  const {transport} = useWorkspace()
  const carrier = transport.kind === 'unavailable' ? '—' : carrierOf(transport)
  const rows = [
    {name: 'Field', value: mode === 'base' ? 'central' : 'the encounter\'s field', title: 'the field the pane follows'},
    {name: 'World', value: carrier, title: transport.kind === 'unavailable' ? `the carrier is unavailable: ${transport.reason}` : `${carrier} serves this ground`},
    {name: 'Subject', value: selectedSubject ? selectedSubject.path.split('/').pop() ?? selectedSubject.path : 'not selected', title: selectedSubject ? selectedSubject.path : 'select a subject in the results — the pane follows the encounter'},
    {name: 'Occasion', value: 'the day\'s Now', title: 'the pane follows the day\'s civil Now'},
  ]
  return <div className="mode-browser-aperture" aria-label="Aperture slot">
    <div className="mode-browser-aperture-head">aperture <span>pane (1) · follows</span></div>
    {rows.map(row => <div key={row.name} className="mode-browser-aperture-row" data-i={`${row.name}|${row.title}`}>
      <span className="mode-browser-aperture-name">{row.name}</span>
      <span className="mode-browser-aperture-value">{row.value}</span>
    </div>)}
  </div>
}

// ————————————————————————————————————————————————————————————————————————
// One category's rows — composed from the landed owner, or designed empty.

function CategoryRows({category, mode, needle, onSelectSubject, selectedSubject}: {
  category: ModeBrowserCategory
  mode: SurfMode
  needle: string
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
}) {
  // The ownership law at the render: a row source draws rows only for the category its owner declares. Composition already
  // hides a foreign declaration of its id; this names the fault if one ever reaches the renderer, instead of dispatching it.
  const rowOwner = ROW_SOURCE_OWNERS.get(category.id)
  if (rowOwner !== undefined && rowOwner !== (category.family ?? null)) {
    return <div className="mode-browser-fault" role="alert">The {category.label} category is declared by {category.family ?? 'the shell'}, but its rows belong to {rowOwner ?? 'the shell'} — the composition refuses the declaration.</div>
  }
  if (category.state === 'waiting') {
    return <DesignedEmptyCategory category={category} />
  }
  if (category.id === 'central-days') return <DaysRows needle={needle} onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} />
  if (category.id === 'central-files' || category.id === 'techne-files') return <GroundRows needle={needle} onSelectSubject={onSelectSubject} selectedSubject={selectedSubject} mode={mode} opens={category.id === 'central-files'} />
  if (category.id === 'techne-sources') return <SourceRows needle={needle} />
  // A `cut` category without a composed row source is a lane fault, named —
  // never silently empty.
  return <div className="mode-browser-fault" role="alert">The {category.label} category is declared `cut` but composes no rows here — the composition owes its owner read.</div>
}

/** The open gestures of the Central rows (manual §10.3): a row previews on select; double-click, or Enter, opens its document
 * in the focused pane — a Days row its Day, a Files row its Flow or its own file tab (central/documents). A refusal is the
 * owner's own words, said by the rows. */
function useOpening() {
  const {openDay, openFile} = useCentralDocumentOpener()
  const [openFault, setOpenFault] = useState<string | null>(null)
  const said = (opening: Promise<void>) => opening.catch(reason => setOpenFault(reason instanceof Error ? reason.message : String(reason)))
  return {
    openFault,
    openDay: (entry: NativeFileEntry, path: string) => { setOpenFault(null); void said(openDay(entry, path)) },
    openFile: (entry: NativeFileEntry, path: string) => { setOpenFault(null); void said(openFile(entry, path)) },
  }
}

/** The Days rows: the day records at the root register's day surface, read
 * through the same owner route the L7 craft uses. */
function DaysRows({needle, onSelectSubject, selectedSubject}: {
  needle: string
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
}) {
  const {transport} = useWorkspace()
  const [directory, setDirectory] = useState<NativeDirectory | null>(null)
  const [fault, setFault] = useState<string | null>(null)
  const {openDay, openFault} = useOpening()
  useEffect(() => {
    let live = true
    setFault(null)
    if (transport.kind === 'unavailable') {setDirectory(null); return}
    listFiles(transport, DAY_RECORDS_PATH)
      .then(reading => {if (live) setDirectory(reading)})
      .catch(reason => {if (live) setFault(reason instanceof Error ? reason.message : String(reason))})
    return () => {live = false}
  }, [transport])
  const needleText = needle.trim().toLocaleLowerCase()
  const days = (directory?.entries ?? [])
    .filter(entry => /^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name))
    .filter(entry => !needleText || entry.name.toLocaleLowerCase().includes(needleText))
    .sort((a, b) => b.name.localeCompare(a.name))
  if (transport.kind === 'unavailable') {
    return <DesignedRead absence="The kernel carrier is unavailable" reason={transport.reason} affordance={`The day records list at ${DAY_RECORDS_PATH} when the carrier answers.`} />
  }
  if (fault) return <DesignedRead absence="The day-records read refused" reason={fault} affordance={`op files_list at ${DAY_RECORDS_PATH} — the same route the Document detail reads through.`} />
  if (!directory) return <p className="native-empty" role="status">Reading the day records…</p>
  if (!days.length) return <p className="native-empty">{needleText ? 'No day records match this search.' : 'No day records at the root register yet.'}</p>
  return <section className="mode-browser-rows" aria-label="Days"><h3>Day</h3><ul>
    {days.map(entry => {
      const path = entry.location?.path ?? `${DAY_RECORDS_PATH}/${entry.name}`
      const selected = selectedSubject?.kind === 'day' && selectedSubject.path === path
      return <li key={entry.location?.ref ?? entry.name}>
        <button type="button" data-browser-row className={`mode-browser-row${selected ? ' selected' : ''}`}
          aria-current={selected || undefined}
          data-i={`Day ${entry.name.replace(/\.md$/, '')}|select the day — its record opens in the Document detail (CAS identity, basis, save-router standing); double-click or Enter opens the Day in the focused pane`}
          title={`${path} — select the day; its craft opens in the Document detail. Double-click or Enter opens the Day in the focused pane.`}
          onClick={() => onSelectSubject({kind: 'day', path})}
          onDoubleClick={() => openDay(entry, path)}
          onKeyDown={event => { if (event.key === 'Enter') openDay(entry, path) }}>
          <span aria-hidden="true"><KindMark kind="day" size={12} /></span><span>{entry.name.replace(/\.md$/, '')}</span>
          <span className="mode-browser-row-meta">{entry.byte_len ?? '—'} B</span>
        </button>
      </li>
    })}
  </ul>{openFault && <p className="native-error" role="alert" data-open-fault>{openFault}</p>}</section>
}

/** The Files rows: the ground's listing through the workspace's directory
 * resource — the same listing the WorldBrowser's Files category reads. */
function GroundRows({needle, onSelectSubject, selectedSubject, mode, opens}: {
  needle: string
  onSelectSubject: (subject: CentralSubjectSelection | null) => void
  selectedSubject: CentralSubjectSelection | null
  mode: SurfMode
  /** Central's Files open into its panes on double-click or Enter; Technē's take the file to hand (its lens), as they did. */
  opens: boolean
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
        return <li key={entry.location?.ref ?? entry.name}>
          <button type="button" data-browser-row
            className={`mode-browser-row${selected || selectedRef === entry.location?.ref ? ' selected' : ''}`}
            aria-current={selected || undefined}
            data-i={isDirectory ? `${entry.name}|open the folder's listing` : `${entry.name}|select the ${entry.kind} — its craft opens in the Document detail${opens ? '; double-click or Enter opens it in the focused pane' : ''}`}
            title={`${entryPath} — ${isDirectory ? 'open the folder' : `select; the craft opens in the Document detail${opens ? '. Double-click or Enter opens it in the focused pane' : ''}`}`}
            onClick={() => isDirectory ? navigateFiles(entryPath) : onSelectSubject(entryPath.endsWith('.md') && /\/now\/day\/\d{4}-\d{2}-\d{2}\.md$/.test(entryPath) ? {kind: 'day', path: entryPath} : {kind: 'note', path: entryPath})}
            onDoubleClick={opens && !isDirectory ? () => openFile(entry, entryPath) : undefined}
            onKeyDown={opens && !isDirectory ? event => { if (event.key === 'Enter') openFile(entry, entryPath) } : undefined}>
            <span aria-hidden="true">{isDirectory ? <Icon name="lib" size={12} /> : <KindMark kind="doc" size={12} />}</span>
            <span>{entry.name}</span>
            {!isDirectory && entry.byte_len != null && <span className="mode-browser-row-meta">{entry.byte_len} B</span>}
          </button>
        </li>
      })}
    </ul>}
    {directory && !entries.length && <p className="native-empty">{needleText ? 'No entries match in this folder.' : 'This folder has no visible entries.'}</p>}
    {mode === 'techne' && <p className="native-empty" role="note">Reference files select from the ground; the lens takes them to hand.</p>}
  </section>
}

/** The Technē Sources rows: the retained app's own work list; a row opens
 * the work in the instrument (the existing request door). */
function SourceRows({needle}: {needle: string}) {
  const workspace = useWorkspace()
  const needleText = needle.trim().toLocaleLowerCase()
  const works = workspace.nativeWorks.filter(work => !needleText || work.title.toLocaleLowerCase().includes(needleText))
  if (!workspace.nativeWorks.length) {
    return <DesignedRead absence="No works disclosed" reason="The retained app has not disclosed its works in this reading."
      affordance="Sources to hand lists the open works; each opens in its instrument." />
  }
  if (!works.length) return <p className="native-empty">No sources match this search.</p>
  return <section className="mode-browser-rows" aria-label="Sources to hand"><h3>Source</h3><ul>
    {works.map(work => <li key={work.expression_ref}>
      <button type="button" data-browser-row className="mode-browser-row"
        data-i={`Open ${work.title}|open the source in its instrument (the retained field)`}
        title={`${work.expression_ref} · revision ${work.revision} — opens in the instrument`}
        onClick={() => workspace.requestExpression(work.expression_ref)}>
        <span aria-hidden="true"><Icon name="expr" size={12} /></span><span>{work.title}</span>
        <span className="mode-browser-row-meta mono">r{work.revision}</span>
      </button>
    </li>)}
  </ul></section>
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

/** The context pool's line: the category's standing (what it reads, what
 * selecting a row does). */
function CategoryContext({category, mode}: {category: ModeBrowserCategory; mode: SurfMode}) {
  return <div className="mode-browser-context">
    <strong>{category.label}</strong>
    <p>{category.hint}</p>
    {category.id === 'central-days' && <p>Selecting a day opens its record in the Document detail — CAS identity, basis, save-router standing. Double-click or Enter opens the Day itself in the focused pane.</p>}
    {category.id === 'central-files' && <p>Selecting a note selects it as the Document detail's subject; folders walk the ground. Double-click or Enter opens a file in the focused pane — a Flow as its Flow, any other file as its own tab.</p>}
    {category.id === 'techne-sources' && <p>A source opens in its instrument over the current encounter.</p>}
    {mode === 'techne' && category.state === 'waiting' && <p role="note">The World groups wait for their owners; the lens surface holds their places.</p>}
  </div>
}
