import { useContext, useEffect, useState } from 'react'
import {InstrumentsSection} from '../frame/InstrumentsSection'
import type { PanelContext } from '../shell/panels'
import { getPanels } from '../shell/panels'
import { displayDeviceName } from '../shell/document'
import {Icon as Mark} from '../inhabitants/sdk/Icon'
import type {IconName} from '../inhabitants/sdk/icons'
import type {BrowserCategory, ControlledBrowser} from '../frame/browser/browserKinds'
import {SET_INSTRUMENT_ELEMENTS, NOTE_DEVICE_KEPT} from '../live/liveChainDevices'
import {addNoteDevice} from '../live/noteDevices/noteDeviceHold'
import {NOTE_DEVICE_MIME} from '../live/noteDevices/noteDeviceDrag'
import {trackDeviceFaceTitle} from '../live/liveChain'
import {NOTE_DEVICE_LABEL, NOTE_DEVICES_WAITING, type NoteDeviceKind} from '../live/noteDevices/noteDevices'
import {withoutExtension} from '../frame/browser/rowWords'
import {Workspace} from '../shell/workspaceContext'
import {useOwnerOp} from '../owners/ownerCall'
import type {LiveSetsReading} from '../../../../../desktop/cradle/src/kernel/types'
const RECENTS_KEY = 'live-shell.recent.sets'
function loadRecents(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]'); return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string').slice(0, 8) : [] } catch { return [] }
}
/** The Live browser's categories (T-LIVE-TORUS-INSTRUMENT): the instrument's Presets, its Instruments (the expanded torus and the legacy
 * generators), the Chain devices (the effects), the Samples and the Views. There is no catalogue of generators or drums. */
export const LIVE_BROWSER_CATEGORIES: readonly string[] = Object.freeze(['Presets', 'Instruments', 'Chain devices', 'Samples', 'Views'])
const CATEGORIES = LIVE_BROWSER_CATEGORIES
/** The Live views the browser names (the transport's view switch chooses between them), each with its mark from the cut. */
const LIVE_VIEWS: readonly {name: string; mark: IconName}[] = [{name: 'Session', mark: 'session'}, {name: 'Arrangement', mark: 'arrangement'}]
const INSTRUMENTS = SET_INSTRUMENT_ELEMENTS
/** Each category's mark, from the cut (icon-cut.html; the mockup's BCATS.live marks ♪ ▦ ≈ ∿ ▦, world-shell-mockup.html:1702). */
const LIVE_CATEGORY_MARKS: Readonly<Record<string, IconName>> = {
  'Sets': 'lib', 'Open set': 'plus', 'Samples': 'live', 'Presets': 'diamond', 'Instruments': 'keys', 'Chain devices': 'chain', 'Views': 'session',
}
const mark = (category: string) => LIVE_CATEGORY_MARKS[category] ? <Mark name={LIVE_CATEGORY_MARKS[category]} size={12} /> : undefined
/** Live's categories in the one browser (F6), each under its kind: the sets and samples are material, the set's instruments,
 * chain devices and presets are devices (they go on a chain), Session and Arrangement are instruments (views in a pane). */
export function liveBrowserCategories(): BrowserCategory[] {
  const sections = getPanels('browser-section').filter(panel => !CATEGORIES.includes(panel.id))
  return [
    {id: 'Sets', label: 'Live sets', kind: 'material', mark: mark('Sets'), hint: 'your sets in the Music folder and Live\'s places, and the recent ones'},
    {id: 'Open set', label: 'Open set', kind: 'material', mark: mark('Open set'), hint: 'open a set by its path'},
    {id: 'Samples', label: 'Samples', kind: 'material', mark: mark('Samples'), hint: 'samples disclosed by the opened set'},
    ...sections.map((panel): BrowserCategory => ({id: panel.id, label: panel.title, kind: 'material'})),
    {id: 'Presets', label: 'Presets', kind: 'devices', mark: mark('Presets'), hint: "the instrument's presets"},
    {id: 'Instruments', label: 'Instruments', kind: 'devices', mark: mark('Instruments'), hint: 'the instruments present in the opened set'},
    {id: 'Chain devices', label: 'Chain devices', kind: 'devices', mark: mark('Chain devices'), hint: 'the note devices before the torus, and the other devices in the opened set'},
    {id: 'Views', label: 'Views', kind: 'instruments', mark: mark('Views'), hint: 'Session and Arrangement'},
  ]
}

/** The note devices the chain can take (live/noteDevices): a row each that adds it before the torus on a double-click or
 * Enter (manual §10.3: "double-click"), and the ones whose owners have not served them, named and not offered. */
function NoteDeviceRows({filter}: {filter: string}) {
  const kinds = (Object.keys(NOTE_DEVICE_LABEL) as NoteDeviceKind[]).filter(kind => NOTE_DEVICE_LABEL[kind].toLowerCase().includes(filter))
  const waiting = NOTE_DEVICES_WAITING.filter(item => item.label.toLowerCase().includes(filter))
  return <>
    {kinds.map(kind => <button key={kind} type="button" className="browser-item" data-browser-note-device={kind}
      title={`${NOTE_DEVICE_LABEL[kind]} — a note device before the torus. Double-click, Enter or a drag onto the chain's end puts it on the chain. ${NOTE_DEVICE_KEPT}`}
      draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData(NOTE_DEVICE_MIME, kind); event.dataTransfer.setData('text/plain', NOTE_DEVICE_LABEL[kind]) }}
      onDoubleClick={() => addNoteDevice(kind)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addNoteDevice(kind) } }}>
      <Mark name="direct" size={12} /><span>{NOTE_DEVICE_LABEL[kind]}</span><span className="mode-browser-row-meta">note device</span>
    </button>)}
    {waiting.map(item => <button key={item.label} type="button" className="browser-item" disabled data-browser-note-device-waiting={item.label}
      title={`${item.label} is ${item.waiting}; it is not offered yet`}>
      <Mark name="direct" size={12} /><span>{item.label}</span><span className="mode-browser-row-meta">waiting</span>
    </button>)}
  </>
}
/** One row of Live sets: a set by its name, standing open, yours (the owner listed it), a template, the host's default, or recent. */
export interface LiveSetRow {readonly path: string; readonly name: string; readonly standing: 'open' | 'yours' | 'template' | 'default' | 'recent'; readonly place?: string}

/** Live sets (manual §10.3, "What leads the browser — Live: Your sets"): the person's own sets as the Live document owner lists them
 * (kernel live_set_owner.rs sets_reading, op live_sets_list: the Music folder and Live's places, newest first, templates marked), then the
 * host's default set and this device's recent sets where the owner did not list them; each set once, found by its name. Before the owner
 * answers, or where it refused, the default and the recents stand alone. Pure. */
export function liveSetRows(listing: LiveSetsReading | null, defaultSet: string, recents: readonly string[], openPath: string | null, query: string): LiveSetRow[] {
  const rows: LiveSetRow[] = [], seen = new Set<string>()
  const standingOf = (path: string, own: LiveSetRow['standing']): LiveSetRow['standing'] => (path === openPath ? 'open' : own)
  for (const set of listing?.sets ?? []) {
    if (seen.has(set.path)) continue
    seen.add(set.path)
    rows.push({path: set.path, name: set.name, standing: standingOf(set.path, set.template ? 'template' : set.path === defaultSet ? 'default' : 'yours'), place: set.place})
  }
  for (const path of [defaultSet, ...recents]) {
    if (!path || seen.has(path)) continue
    seen.add(path)
    rows.push({path, name: withoutExtension(path.split('/').pop() ?? path), standing: standingOf(path, path === defaultSet ? 'default' : 'recent')})
  }
  const needle = query.toLowerCase()
  return needle ? rows.filter(row => row.name.toLowerCase().includes(needle)) : rows
}

const SET_STANDING_WORDS: Readonly<Record<LiveSetRow['standing'], string>> = {
  open: 'the set open now', yours: 'one of your sets', default: 'the host\'s default set', recent: 'a set this device opened recently', template: 'a template',
}
/** Why a template is not opened from here: opening it would write your changes into the template itself. */
const TEMPLATE_WORDS = 'A template of Live\'s: opening it here would write your changes into the template itself. A new set from it needs the template copied into your project first, and no owner op makes that copy yet.'

/** Live sets as rows: select opens a set; a template stands dimmed with its reason; none says the owner's words. */
export function LiveSetList({rows, words, openSet}: {rows: readonly LiveSetRow[]; words: string | null; openSet: (path: string) => void}) {
  if (!rows.length) return <div className="browser-empty" data-i={`Live sets|${words ?? 'No set stands here yet.'}`}>{words ?? 'No set stands here yet.'}</div>
  return <>{rows.map(row => {
    const meta = row.place ? `${row.standing === 'yours' ? '' : `${row.standing} · `}${row.place}` : row.standing
    if (row.standing === 'template') return <button key={row.path} type="button" className="browser-item" data-live-set={row.path} aria-disabled="true" data-i={`${row.name}|${TEMPLATE_WORDS}`}
      title={`${row.path} — ${TEMPLATE_WORDS}`}><Mark name="lib" size={12} /><span>{row.name}</span><span className="mode-browser-row-meta">{meta}</span></button>
    return <button key={row.path} type="button" className={'browser-item' + (row.standing === 'open' ? ' browser-item-active' : '')} data-live-set={row.path} onClick={() => openSet(row.path)}
      title={`${row.path} — ${SET_STANDING_WORDS[row.standing]}; select opens it`}><Mark name="lib" size={12} /><span>{row.name}</span><span className="mode-browser-row-meta">{meta}</span></button>
  })}</>
}

/** What Live sets say when no row stands: the owner's refusal, its reading, or the places it read. */
function liveSetsWords(reading: {status: string; error?: string | null}, listing: LiveSetsReading | null): string | null {
  if (reading.status === 'refused') return `The Live document owner did not list your sets: ${reading.error ?? 'no reason given'}`
  if (!listing) return reading.status === 'reading' ? 'Reading your sets…' : null
  const places = listing.places.filter(place => place.present).map(place => place.label)
  return `No set stands in ${places.length ? places.join(', ') : 'your Music folder or Live\'s places'}.`
}

export function BrowserPane({ defaultSet, ctx, controlled }: { defaultSet: string; ctx: PanelContext; controlled?: ControlledBrowser }) {
  const [recents, setRecents] = useState(loadRecents)
  const [path, setPath] = useState('')
  const [ownFilter, setFilter] = useState('')
  const [ownCategory, setCategory] = useState('Instruments')
  // Held by the one browser (F6), the category and the search are its; standing alone, they are this pane's own.
  const filter = controlled?.query ?? ownFilter
  const category = controlled?.category ?? ownCategory
  useEffect(() => {
    if (!ctx.set) return
    const next = [ctx.set.path, ...loadRecents().filter(p => p !== ctx.set!.path)].slice(0, 8)
    setRecents(next)
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)) } catch { /* optional device recents */ }
  }, [ctx.set?.path])
  // The person's own sets, from the Live document owner (read while Live sets is the category shown).
  const transport = useContext(Workspace)?.transport
  const listed = useOwnerOp(transport, category === 'Sets' ? {op: 'live_sets_list'} : null, 'live_sets_reading', 'The Live document owner did not answer.').reading
  const listing = listed.status === 'answered' ? (listed.value?.reading ?? null) : null
  const setRows = liveSetRows(listing, defaultSet, recents, ctx.set?.path ?? null, filter)
  const devices = [...new Set(ctx.set?.tracks.flatMap(track => track.devices) ?? [])].sort()
  // The opened set's own devices stay browsable: its instruments under Instruments (beside the expanded torus), and every other device,
  // plug-ins included, under Chain devices. Nothing the set contains is hidden by the instrument's categories.
  const filtered = devices.filter(name => category === 'Instruments' ? INSTRUMENTS.has(name) : category === 'Chain devices' && !INSTRUMENTS.has(name)).filter(name => (trackDeviceFaceTitle(name) ?? displayDeviceName(name)).toLowerCase().includes(filter.toLowerCase()))
  const results = <div className="browser-results"><div className="browser-list-heading">Name <span>▴</span></div>
      {category === 'Sets' && <LiveSetList rows={setRows} words={filter && !setRows.length ? 'No matching set.' : liveSetsWords(listed, listing)} openSet={ctx.openSet} />}
      {category === 'Chain devices' && <NoteDeviceRows filter={filter.toLowerCase()} />}
      {(category === 'Chain devices' || category === 'Instruments') && filtered.map(name => <div key={name} className="browser-item" data-browser-set-device={name} title={`${name} · present in this set · insertion requires native device owner`}><Mark name={INSTRUMENTS.has(name) ? 'keys' : 'chain'} size={12} /><span>{trackDeviceFaceTitle(name) ?? displayDeviceName(name)}</span><span className="mode-browser-row-meta">in this set</span></div>)}
      {(category === 'Chain devices' || category === 'Instruments' || category === 'Samples') && !filtered.length && <div className="browser-empty">{filter ? 'No matching material.' : `No ${category === 'Samples' ? 'samples' : category === 'Instruments' ? 'instruments' : 'other chain devices'} disclosed by this set.`}</div>}
      {category === 'Views' && LIVE_VIEWS.map(view => <div key={view.name} className="browser-item" title="The transport's view switch chooses the Live view"><Mark name={view.mark} size={12} /><span>{view.name}</span></div>)}
      {category === 'Open set' && <form className="browser-open" onSubmit={event => { event.preventDefault(); ctx.openSet(path) }}><label>Set path<input aria-label="Set path" placeholder="/path/to/set.als" value={path} onChange={e => setPath(e.target.value)} /></label><button type="submit">Open</button></form>}
      {getPanels('browser-section').filter(p => p.id === category).map(panel => { const Panel = panel.component; return <Panel key={panel.id} {...ctx} /> })}
    </div>
  if (controlled) return results
  return <aside className="browser" aria-label="Browser"><div className="browser-search"><button disabled aria-label="Browser back">‹</button><button disabled aria-label="Browser forward">›</button><input aria-label="Search browser" placeholder="Search (⌘ F)" value={filter} onChange={e => setFilter(e.target.value)} /></div>
    <div className="browser-columns"><nav className="browser-categories">
      <details open><summary>Collections</summary><button onClick={() => setCategory('Sets')} className={category === 'Sets' ? 'active' : ''}><span className="collection-square" />Favorites</button></details>
      <details open><summary>Library</summary>{CATEGORIES.map(name => <button key={name} onClick={() => setCategory(name)} className={category === name ? 'active' : ''} title="Browse material disclosed by the opened set"><span className="category-icon">{mark(name)}</span>{name}</button>)}</details>
      <details open><summary>Places</summary><button onClick={() => setCategory('Sets')}>{mark('Sets')}Sets</button><button onClick={() => setCategory('Open set')} className={category === 'Open set' ? 'active' : ''}>{mark('Open set')}Open set</button>{getPanels('browser-section').filter(panel => !CATEGORIES.includes(panel.id)).map(panel => <button key={panel.id} onClick={() => setCategory(panel.id)}>{panel.title}</button>)}</details>
    </nav>{results}</div><InstrumentsSection /></aside>
}
