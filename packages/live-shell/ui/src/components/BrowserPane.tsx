import { useEffect, useState } from 'react'
import {DevicePool} from '../frame/devices/DevicePool'
import {InstrumentsSection} from '../frame/InstrumentsSection'
import {SetsSection} from '../shell/SetsSection'
import type { PanelContext } from '../shell/panels'
import { getPanels } from '../shell/panels'
import { displayDeviceName } from '../shell/document'
import {Icon as Mark} from '../inhabitants/sdk/Icon'
import type {IconName} from '../inhabitants/sdk/icons'
import type {BrowserCategory, ControlledBrowser} from '../frame/browser/browserKinds'
import {SET_INSTRUMENT_ELEMENTS, NOTE_DEVICE_KEPT} from '../live/liveChainDevices'
import {addNoteDevice} from '../live/noteDevices/noteDeviceHold'
import {trackDeviceFaceTitle} from '../live/liveChain'
import {NOTE_DEVICE_LABEL, NOTE_DEVICES_WAITING, type NoteDeviceKind} from '../live/noteDevices/noteDevices'
import {withoutExtension} from '../frame/browser/rowWords'
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
    {id: 'Sets', label: 'Live sets', kind: 'material', mark: mark('Sets'), hint: 'the default set and the recent ones'},
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
      title={`${NOTE_DEVICE_LABEL[kind]} — a note device before the torus. Double-click or Enter puts it on the chain. ${NOTE_DEVICE_KEPT}`}
      onDoubleClick={() => addNoteDevice(kind)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addNoteDevice(kind) } }}>
      <Mark name="direct" size={12} /><span>{NOTE_DEVICE_LABEL[kind]}</span><span className="mode-browser-row-meta">note device</span>
    </button>)}
    {waiting.map(item => <button key={item.label} type="button" className="browser-item" disabled data-browser-note-device-waiting={item.label}
      title={`${item.label} is ${item.waiting}; it is not offered yet`}>
      <Mark name="direct" size={12} /><span>{item.label}</span><span className="mode-browser-row-meta">waiting</span>
    </button>)}
  </>
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
  const sets = [...new Set([defaultSet, ...recents].filter(Boolean))]
  const devices = [...new Set(ctx.set?.tracks.flatMap(track => track.devices) ?? [])].sort()
  // The opened set's own devices stay browsable: its instruments under Instruments (beside the expanded torus), and every other device,
  // plug-ins included, under Chain devices. Nothing the set contains is hidden by the instrument's categories.
  const filtered = devices.filter(name => category === 'Instruments' ? INSTRUMENTS.has(name) : category === 'Chain devices' && !INSTRUMENTS.has(name)).filter(name => (trackDeviceFaceTitle(name) ?? displayDeviceName(name)).toLowerCase().includes(filter.toLowerCase()))
  const results = <div className="browser-results"><div className="browser-list-heading">Name <span>▴</span></div>
      {category === 'Sets' && sets.filter(p => p.toLowerCase().includes(filter.toLowerCase())).map(p => {
        // A set by its name (the file's, without the extension), standing on what this browser holds of it: the set open now, the
        // host's default set, or one of this device's recent sets. The path is hover words.
        const standing = p === ctx.set?.path ? 'open' : p === defaultSet ? 'default' : 'recent'
        return <button key={p} className={'browser-item' + (p === ctx.set?.path ? ' browser-item-active' : '')} onClick={() => ctx.openSet(p)}
          title={`${p} — ${standing === 'open' ? 'the set open now' : standing === 'default' ? 'the host\'s default set' : 'a set this device opened recently'}; select opens it`}>
          <Mark name="lib" size={12} /><span>{withoutExtension(p.split('/').pop() ?? p)}</span><span className="mode-browser-row-meta">{standing}</span></button>
      })}
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
    </nav>{results}</div><div className="browser-pool"><DevicePool /></div><InstrumentsSection /><SetsSection /></aside>
}
