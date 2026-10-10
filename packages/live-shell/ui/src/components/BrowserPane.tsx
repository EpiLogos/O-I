import { useEffect, useState } from 'react'
import type { PanelContext } from '../shell/panels'
import { getPanels } from '../shell/panels'
import { displayDeviceName } from '../shell/document'
import { Icon } from './Icon'
const RECENTS_KEY = 'live-shell.recent.sets'
function loadRecents(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]'); return Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string').slice(0, 8) : [] } catch { return [] }
}
const CATEGORIES = ['All', 'Sounds', 'Drums', 'Instruments', 'Audio Effects', 'MIDI Effects', 'Modulators', 'Max for Live', 'Plug-ins', 'Clips', 'Samples', 'Grooves', 'Tunings']
const INSTRUMENTS = new Set(['Operator', 'Wavetable', 'Simpler', 'Sampler', 'OriginalSimpler', 'InstrumentVector', 'Collision', 'DrumRack', 'InstrumentRack', 'Analog', 'Drift'])
export function BrowserPane({ defaultSet, ctx }: { defaultSet: string; ctx: PanelContext }) {
  const [recents, setRecents] = useState(loadRecents)
  const [path, setPath] = useState('')
  const [filter, setFilter] = useState('')
  const [category, setCategory] = useState('All')
  useEffect(() => {
    if (!ctx.set) return
    const next = [ctx.set.path, ...loadRecents().filter(p => p !== ctx.set!.path)].slice(0, 8)
    setRecents(next)
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)) } catch { /* optional device recents */ }
  }, [ctx.set?.path])
  const sets = [...new Set([defaultSet, ...recents].filter(Boolean))]
  const devices = [...new Set(ctx.set?.tracks.flatMap(track => track.devices) ?? [])].sort()
  const filtered = devices.filter(name => category === 'All' || category === 'Plug-ins' && name === 'PluginDevice' || category === 'Instruments' && INSTRUMENTS.has(name) || category === 'Audio Effects' && name !== 'PluginDevice' && !INSTRUMENTS.has(name)).filter(name => displayDeviceName(name).toLowerCase().includes(filter.toLowerCase()))
  return <aside className="browser" aria-label="Browser"><div className="browser-search"><button disabled aria-label="Browser back">‹</button><button disabled aria-label="Browser forward">›</button><input aria-label="Search browser" placeholder="Search (⌘ F)" value={filter} onChange={e => setFilter(e.target.value)} /></div>
    <div className="browser-columns"><nav className="browser-categories">
      <details open><summary>Collections</summary><button onClick={() => setCategory('Sets')} className={category === 'Sets' ? 'active' : ''}><span className="collection-square" />Favorites</button></details>
      <details open><summary>Library</summary>{CATEGORIES.map((name, i) => <button key={name} onClick={() => setCategory(name)} className={category === name ? 'active' : ''} title="Browse material disclosed by the opened set"><span className="category-icon">{['▥', '♫', '⊞', '◯', '▥', '▤', '〰', '▣', '♧', '▹', '▰', '≋', '♯'][i]}</span>{name}</button>)}</details>
      <details open><summary>Places</summary><button onClick={() => setCategory('Sets')}><Icon name="folder" size={12} />Sets</button><button onClick={() => setCategory('Open set')} className={category === 'Open set' ? 'active' : ''}><Icon name="folder" size={12} />Open set</button>{getPanels('browser-section').map(panel => <button key={panel.id} onClick={() => setCategory(panel.id)}>{panel.title}</button>)}</details>
    </nav><div className="browser-results"><div className="browser-filters"><span>◯ Filters</span><span title={ctx.set ? `Sources: ${ctx.set.path}` : 'Open a set to browse its material'}>{category === 'Sets' ? 'Sets' : 'In set'}</span></div><div className="browser-list-heading">Name <span>▴</span></div>
      {category === 'Sets' && sets.filter(p => p.toLowerCase().includes(filter.toLowerCase())).map(p => <button key={p} className={'browser-item' + (p === ctx.set?.path ? ' browser-item-active' : '')} onClick={() => ctx.openSet(p)} title={p}><Icon name="set" size={12} /><span>{p.split('/').pop()}</span></button>)}
      {CATEGORIES.includes(category) && filtered.map(name => <div key={name} className="browser-item" title={`${name} · present in this set · insertion requires native device owner`}><span>▸</span><Icon name="device" size={13} /><span>{displayDeviceName(name)}</span></div>)}
      {CATEGORIES.includes(category) && !filtered.length && <div className="browser-empty">{filter ? 'No matching material.' : `No ${category.toLowerCase()} disclosed by this set.`}</div>}
      {category === 'Open set' && <form className="browser-open" onSubmit={event => { event.preventDefault(); ctx.openSet(path) }}><label>Set path<input aria-label="Set path" placeholder="/path/to/set.als" value={path} onChange={e => setPath(e.target.value)} /></label><button type="submit">Open</button></form>}
      {getPanels('browser-section').filter(p => p.id === category).map(panel => { const Panel = panel.component; return <Panel key={panel.id} {...ctx} /> })}
    </div></div><div className="browser-pool"><div className="groove-columns"><span>Groove Name</span><span>Base</span><span>Quantize</span><span>Timing</span><span>Random</span><span>Velocity</span></div><div className="groove-empty" title="Groove material and drop operations require the document owner">No grooves in this reading.</div><div className="groove-footer"><span>Groove Pool</span><span>Global Amount</span><input readOnly value="—" aria-label="Global groove amount" title="Groove amount not disclosed" /></div></div></aside>
}
