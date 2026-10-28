// The one browser (FOUNDATION F6; manual §10.3, §16.7): one search, the categories grouped by the four kinds, a category's rows,
// a selected row's preview at the foot of the list ("its preview shows at the foot of the list, where Live plays a sample you
// select"), and the pool beneath. It knows no mode: the frame hands it the mode's row sources (shell/modeBrowsers.tsx), the
// sources every mode shares, and the pool's other face where the mode has one (Live's grooves); each source's body draws its
// rows under the browser's control and portals its preview into the foot. The pool holds QL frames and MEF lenses, and in Live the
// set's grooves beside them, and nothing else (GroovePool.tsx): a device stands whole in its band above the chain, an instrument in a
// pane, and a reusable arrangement is a template among the rows (TemplateRows.tsx). A category's words are its
// row's Info (data-i). Drawn at the mockup's floor (world-shell-mockup .bsearch/.bcats/.bres/.bitem; browser.css).
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import {useBrowserSearchRequest} from '../keys/keyDoors'
import {BROWSER_KINDS, type BrowserCategory, type BrowserSource} from './browserKinds'
import {EMPTY_TRAIL, visitCategory, walkTrail} from './browserTrail'
import {GroovePool} from './GroovePool'
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
  /** The set's grooves, where the mode registers them (Live's, manual §16.7): their caption and face, beside the frames and lenses. */
  poolFace?: {label: string; face: ReactNode} | null
  /** Whether the pool stands under the browser (⌥⌘6 shows or hides it, as Live's Groove Pool). */
  pool?: boolean
}

/** How a category is named in the book: its source and its own id. */
export const categoryKey = (source: {id: string}, category: {id: string}): string => `${source.id}:${category.id}`

export function Browser({sources, category, onCategory, poolFace = null, pool = true}: BrowserProps) {
  const categories = useMemo<Placed[]>(() => sources.flatMap(source => source.categories.map(entry => ({...entry, source}))), [sources])
  const [held, hold] = useState<string | null>(null)
  const active = onCategory ? category ?? null : held
  const [query, setQuery] = useState('')
  const [previewHost, setPreviewHost] = useState<HTMLDivElement | null>(null)
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
        {current && Body && <Body key={key(current)} controlled={{category: current.id, query, previewHost}} />}
        <div ref={setPreviewHost} className="one-browser-preview" aria-label="Preview" />
      </div>
    </div>
    {pool && <section className="one-browser-pool" aria-label="Pool"><GroovePool face={poolFace} /></section>}
  </aside>
}

const key = (category: Placed): string => categoryKey(category.source, category)
