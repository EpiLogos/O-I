// The one browser (FOUNDATION F6; manual §10.3): one search, the categories grouped by the four kinds, a category's rows,
// and the pool beneath. It knows no mode: the frame hands it the mode's row sources (shell/modeBrowsers.tsx) and the
// sources every mode shares, and each source's body draws its rows under the browser's control. The pool is the aperture
// slot first — the focused pane's own context (apertureViews.tsx) — then a body's own pool content (a material's detail, a
// native device, the agent chain's readings), portalled in, then the selected device whole (frame/devices/DevicePool.tsx),
// which takes the slot's place while it is chosen. A category's words are its row's Info (data-i). Drawn at the mockup's
// floor (world-shell-mockup .bsearch/.bcats/.bres/.bitem/.slot; browser.css, apertureViews.css).
import {useEffect, useMemo, useRef, useState} from 'react'
import {DevicePool} from '../devices/DevicePool'
import {useBrowserSearchRequest} from '../keys/keyDoors'
import {BROWSER_KINDS, type BrowserCategory, type BrowserSource} from './browserKinds'
import {EMPTY_TRAIL, visitCategory, walkTrail} from './browserTrail'
import {ApertureSlot} from './apertureViews'
import '../../components/WorldBrowser.css'
import './browser.css'

interface Placed extends BrowserCategory { source: BrowserSource }

export interface BrowserProps {
  sources: readonly BrowserSource[]
  /** The category the book holds, as `categoryKey` spells it. Passing `onCategory` makes the browser controlled: the chosen
   * category is the book's (FOUNDATION F1: a mode returns to the category it was left on), and a key that names no category
   * here falls back to the first. Left out, the browser holds the choice itself. */
  category?: string | null
  onCategory?: (key: string) => void
}

/** How a category is named in the book: its source and its own id. */
export const categoryKey = (source: {id: string}, category: {id: string}): string => `${source.id}:${category.id}`

export function Browser({sources, category, onCategory}: BrowserProps) {
  const categories = useMemo<Placed[]>(() => sources.flatMap(source => source.categories.map(entry => ({...entry, source}))), [sources])
  const [held, hold] = useState<string | null>(null)
  const active = onCategory ? category ?? null : held
  const [query, setQuery] = useState('')
  const [poolHost, setPoolHost] = useState<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  useBrowserSearchRequest(searchRef)
  const current = categories.find(item => key(item) === active) ?? categories[0] ?? null
  const Body = current?.source.Body
  // Back and forward walk the categories this browser has shown, whoever chose them (a press here, or the book).
  const [trail, setTrail] = useState(EMPTY_TRAIL)
  const shown = current ? key(current) : null
  useEffect(() => { setTrail(before => visitCategory(before, shown)) }, [shown])
  const walk = (direction: 'back' | 'forward') => {
    const step = walkTrail(trail, direction)
    if (!step) return
    setTrail(step.trail); hold(step.show); onCategory?.(step.show); setQuery('')
  }
  const nameOf = (to: string | undefined) => categories.find(item => key(item) === to)?.label ?? 'a category no longer here'
  const back = trail.back[trail.back.length - 1], forward = trail.forward[trail.forward.length - 1]
  return <aside className="world-browser world-browser-categories one-browser" aria-label="Browser" data-browser-category={current?.id}>
    <div className="world-browser-searchrow">
      <button type="button" className="one-browser-step" aria-label="Back" disabled={back === undefined} onClick={() => walk('back')}
        title={back === undefined ? 'Back — nothing shown before this category yet' : `Back — to ${nameOf(back)}`}>‹</button>
      <button type="button" className="one-browser-step" aria-label="Forward" disabled={forward === undefined} onClick={() => walk('forward')}
        title={forward === undefined ? 'Forward — nothing to go forward to' : `Forward — to ${nameOf(forward)}`}>›</button>
      <label className="world-browser-search"><span className="sr-only">Search {current?.label ?? ''}</span>
        <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search (⌘ F)" /></label>
      <output className="world-browser-count" aria-live="polite">{current?.waiting ? 'waiting' : ''}</output>
    </div>
    <div className="world-browser-main">
      <nav className="world-category-list" aria-label="Browser categories">
        {BROWSER_KINDS.map(({kind, label, hint}) => {
          const list = categories.filter(item => item.kind === kind)
          return list.length ? <div key={kind} data-browser-kind={kind}>
            <h3 title={`${label} — ${hint}`}>{label}</h3>
            {list.map(item => <button type="button" key={key(item)} aria-pressed={current !== null && key(current) === key(item)}
              data-i={`${item.label}|${item.info ?? item.hint ?? ''}`}
              title={item.hint ? `${item.label} — ${item.hint}${item.waiting ? ' (declared, waiting)' : ''}` : item.label}
              onClick={() => { hold(key(item)); onCategory?.(key(item)); setQuery('') }}>
              <span aria-hidden="true">{item.mark ?? '▸'}</span><span>{item.label}</span>
              {item.count !== undefined && <span className="one-browser-category-count" aria-label={`${item.count} in ${item.label}`}>{item.count}</span>}
              {item.waiting && <span className="mode-browser-waiting-dot" aria-label="declared, waiting" />}
            </button>)}
          </div> : null
        })}
      </nav>
      <div className="world-browser-results">
        {current && Body && <Body key={key(current)} controlled={{category: current.id, query, poolHost}} />}
      </div>
    </div>
    <section className="world-context-pool one-browser-pool" aria-label="Pool">
      <ApertureSlot />
      <div ref={setPoolHost} className="one-browser-pool-host" />
      <DevicePool />
    </section>
  </aside>
}

const key = (category: Placed): string => categoryKey(category.source, category)
