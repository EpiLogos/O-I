import { useEffect, useState } from 'react'
import {DevicePool} from '../frame/devices/DevicePool'
import {InstrumentsSection} from '../frame/InstrumentsSection'
import {SetsSection} from '../shell/SetsSection'
import type { PanelContext } from '../shell/panels'
import { getPanels } from '../shell/panels'
import { displayDeviceName } from '../shell/document'
import { Icon } from './Icon'
import type {BrowserCategory, ControlledBrowser} from '../frame/browser/browserKinds'
const RECENTS_KEY = 'live-shell.recent.sets'
function loadRecents(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]'); return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string').slice(0, 8) : [] } catch { return [] }
}
/** The Live browser's categories (T-LIVE-TORUS-INSTRUMENT): the instrument's Presets, its Instruments (the expanded torus and the legacy
 * generators), the Chain devices (the effects), the Samples and the Views. There is no catalogue of generators or drums. */
export const LIVE_BROWSER_CATEGORIES: readonly string[] = Object.freeze(['Presets', 'Instruments', 'Chain devices', 'Samples', 'Views'])
const CATEGORIES = LIVE_BROWSER_CATEGORIES
/** The Live views the browser names (the transport's view switch chooses between them). */
const LIVE_VIEWS = ['Session', 'Arrangement']
const INSTRUMENTS = new Set(['Operator', 'Wavetable', 'Simpler', 'Sampler', 'OriginalSimpler', 'InstrumentVector', 'Collision', 'DrumRack', 'InstrumentRack', 'Analog', 'Drift'])
/** Live's categories in the one browser (F6), each under its kind: the sets and samples are material, the set's instruments,
 * chain devices and presets are devices (they go on a chain), Session and Arrangement are instruments (views in a pane). */
export function liveBrowserCategories(): BrowserCategory[] {
  const sections = getPanels('browser-section').filter(panel => !CATEGORIES.includes(panel.id))
  return [
    {id: 'Sets', label: 'Live sets', kind: 'material', mark: <Icon name="set" size={12} />, hint: 'the default set and the recent ones'},
    {id: 'Open set', label: 'Open set', kind: 'material', mark: <Icon name="folder" size={12} />, hint: 'open a set by its path'},
    {id: 'Samples', label: 'Samples', kind: 'material', mark: '▥', hint: 'samples disclosed by the opened set'},
    ...sections.map((panel): BrowserCategory => ({id: panel.id, label: panel.title, kind: 'material'})),
    {id: 'Presets', label: 'Presets', kind: 'devices', mark: '◇', hint: "the instrument's presets"},
    {id: 'Instruments', label: 'Instruments', kind: 'devices', mark: '◉', hint: 'the instruments present in the opened set'},
    {id: 'Chain devices', label: 'Chain devices', kind: 'devices', mark: '≋', hint: 'every other device present in the opened set'},
    {id: 'Views', label: 'Views', kind: 'instruments', mark: '◫', hint: 'Session and Arrangement'},
  ]
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
  const filtered = devices.filter(name => category === 'Instruments' ? INSTRUMENTS.has(name) : category === 'Chain devices' && !INSTRUMENTS.has(name)).filter(name => displayDeviceName(name).toLowerCase().includes(filter.toLowerCase()))
  const results = <div className="browser-results"><div className="browser-list-heading">Name <span>▴</span></div>
      {category === 'Sets' && sets.filter(p => p.toLowerCase().includes(filter.toLowerCase())).map(p => <button key={p} className={'browser-item' + (p === ctx.set?.path ? ' browser-item-active' : '')} onClick={() => ctx.openSet(p)} title={p}><Icon name="set" size={12} /><span>{p.split('/').pop()}</span></button>)}
      {(category === 'Chain devices' || category === 'Instruments') && filtered.map(name => <div key={name} className="browser-item" data-browser-set-device={name} title={`${name} · present in this set · insertion requires native device owner`}><span>▸</span><Icon name="device" size={13} /><span>{displayDeviceName(name)}</span></div>)}
      {(category === 'Chain devices' || category === 'Instruments' || category === 'Samples') && !filtered.length && <div className="browser-empty">{filter ? 'No matching material.' : `No ${category === 'Samples' ? 'samples' : category === 'Instruments' ? 'instruments' : 'chain devices'} disclosed by this set.`}</div>}
      {category === 'Views' && LIVE_VIEWS.map(view => <div key={view} className="browser-item" title="The transport's view switch chooses the Live view"><span>▸</span><span>{view}</span></div>)}
      {category === 'Open set' && <form className="browser-open" onSubmit={event => { event.preventDefault(); ctx.openSet(path) }}><label>Set path<input aria-label="Set path" placeholder="/path/to/set.als" value={path} onChange={e => setPath(e.target.value)} /></label><button type="submit">Open</button></form>}
      {getPanels('browser-section').filter(p => p.id === category).map(panel => { const Panel = panel.component; return <Panel key={panel.id} {...ctx} /> })}
    </div>
  if (controlled) return results
  return <aside className="browser" aria-label="Browser"><div className="browser-search"><button disabled aria-label="Browser back">‹</button><button disabled aria-label="Browser forward">›</button><input aria-label="Search browser" placeholder="Search (⌘ F)" value={filter} onChange={e => setFilter(e.target.value)} /></div>
    <div className="browser-columns"><nav className="browser-categories">
      <details open><summary>Collections</summary><button onClick={() => setCategory('Sets')} className={category === 'Sets' ? 'active' : ''}><span className="collection-square" />Favorites</button></details>
      <details open><summary>Library</summary>{CATEGORIES.map((name, i) => <button key={name} onClick={() => setCategory(name)} className={category === name ? 'active' : ''} title="Browse material disclosed by the opened set"><span className="category-icon">{['◇', '◉', '≋', '▥', '◫'][i]}</span>{name}</button>)}</details>
      <details open><summary>Places</summary><button onClick={() => setCategory('Sets')}><Icon name="folder" size={12} />Sets</button><button onClick={() => setCategory('Open set')} className={category === 'Open set' ? 'active' : ''}><Icon name="folder" size={12} />Open set</button>{getPanels('browser-section').filter(panel => !CATEGORIES.includes(panel.id)).map(panel => <button key={panel.id} onClick={() => setCategory(panel.id)}>{panel.title}</button>)}</details>
    </nav>{results}</div><div className="browser-pool"><DevicePool /></div><InstrumentsSection /><SetsSection /></aside>
}
