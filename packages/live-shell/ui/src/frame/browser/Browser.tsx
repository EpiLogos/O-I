// The one browser (FOUNDATION F6; manual §10.3): one search, the categories grouped by the four kinds, a category's rows,
// and the pool beneath. It knows no mode: the frame hands it the mode's row sources (shell/modeBrowsers.tsx) and the
// sources every mode shares, and each source's body draws its rows under the browser's control. The pool shows the
// selected device whole (frame/devices/DevicePool.tsx); a body's own pool content (a material's detail, a native
// device, the agent chain's readings) is portalled into the same pool.
import {useMemo, useState} from 'react'
import {DevicePool} from '../devices/DevicePool'
import {BROWSER_KINDS, type BrowserCategory, type BrowserSource} from './browserKinds'
import '../../components/WorldBrowser.css'
import './browser.css'

interface Placed extends BrowserCategory { source: BrowserSource }

export function Browser({sources}: {sources: readonly BrowserSource[]}) {
  const categories = useMemo<Placed[]>(() => sources.flatMap(source => source.categories.map(category => ({...category, source}))), [sources])
  const [active, setActive] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [poolHost, setPoolHost] = useState<HTMLDivElement | null>(null)
  const current = categories.find(category => key(category) === active) ?? categories[0] ?? null
  const Body = current?.source.Body
  return <aside className="world-browser world-browser-categories one-browser" aria-label="Browser" data-browser-category={current?.id}>
    <div className="world-browser-searchrow">
      <label className="world-browser-search"><span className="sr-only">Search {current?.label ?? ''}</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search (⌘ F)" /></label>
      <output className="world-browser-count" aria-live="polite">{current?.waiting ? 'waiting' : ''}</output>
    </div>
    <div className="world-browser-main">
      <nav className="world-category-list" aria-label="Browser categories">
        {BROWSER_KINDS.map(({kind, label, hint}) => {
          const list = categories.filter(category => category.kind === kind)
          return list.length ? <div key={kind} data-browser-kind={kind}>
            <h3 title={`${label} — ${hint}`}>{label}</h3>
            {list.map(category => <button type="button" key={key(category)} aria-pressed={current !== null && key(current) === key(category)}
              title={category.hint ? `${category.label} — ${category.hint}${category.waiting ? ' (declared, waiting)' : ''}` : category.label}
              onClick={() => { setActive(key(category)); setQuery('') }}>
              <span aria-hidden="true">{category.mark ?? '▸'}</span><span>{category.label}</span>
              {category.waiting && <span className="mode-browser-waiting-dot" aria-label="declared, waiting" />}
            </button>)}
          </div> : null
        })}
      </nav>
      <div className="world-browser-results">
        {current && Body && <Body key={key(current)} controlled={{category: current.id, query, poolHost}} />}
      </div>
    </div>
    <section className="world-context-pool one-browser-pool" aria-label="Pool">
      <div ref={setPoolHost} className="one-browser-pool-host" />
      <DevicePool />
    </section>
  </aside>
}

const key = (category: Placed): string => `${category.source.id}:${category.id}`
