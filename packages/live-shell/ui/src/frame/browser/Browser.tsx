// The one browser (FOUNDATION F6; manual §10.3, §16.7): one search, the categories grouped by the four kinds, a category's rows,
// a selected row's preview at the foot of the list ("its preview shows at the foot of the list, where Live plays a sample you
// select"), and the pool beneath. It knows no mode: the frame hands it the mode's row sources (shell/modeBrowsers.tsx), the
// sources every mode shares, and the pool's other face where the mode has one (Live's grooves); each source's body draws its
// rows under the browser's control and portals its preview into the foot. The pool holds QL frames and MEF lenses, and in Live the
// set's grooves beside them, and nothing else (GroovePool.tsx): a device stands whole in its band above the chain, an instrument in a
// pane, and a reusable arrangement is a template among the rows (TemplateRows.tsx). A category's words are its
// row's Info (data-i). Down the left side the Collections lead, the four kinds follow, and the Places close the column (browserKinds.ts);
// a source whose categories follow its owner (the Collections, CollectionRows.tsx) says when they move, and its Keeper holds its
// owner read while the browser stands. A category with acts has Live's menu on its label (manual §10.9: right-click, the menu key or
// ⇧F10; Rename on ⌘R renames it in place, Hide takes it out of the column), and a group whose source lists its categories for Live's Edit
// carries Edit on its heading: every category, hidden ones too, each with a box ticked where the column shows it, until Done. Drawn at
// the mockup's floor (world-shell-mockup .bsearch/.bcats/.bres/.bitem; browser.css).
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode} from 'react'
import {Refusal} from '../../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {useBrowserSearchRequest} from '../keys/keyDoors'
import {ObjectMenu} from '../menu/ObjectMenu'
import {useObjectMenu, type ObjectMenuItem} from '../menu/useObjectMenu'
import {BROWSER_KINDS, type BrowserCategory, type BrowserKind, type BrowserSource} from './browserKinds'
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
  // A source whose categories follow its owner (the Collections) says when they move; its categories are read again then.
  const subscribeMoves = useCallback((listener: () => void) => {
    const offs = sources.flatMap(source => source.moves ? [source.moves.subscribe(listener)] : [])
    return () => { for (const off of offs) off() }
  }, [sources])
  const movesOf = useCallback(() => sources.map(source => source.moves?.version() ?? 0).join(':'), [sources])
  const moved = useSyncExternalStore(subscribeMoves, movesOf, movesOf)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `moved` is when a moving source's categories change
  const categories = useMemo<Placed[]>(() => sources.flatMap(source => source.categories.map(entry => ({...entry, source}))), [sources, moved])
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
  // A category's own acts (its menu, its rename in place) and a group's Edit; an owner's refusal stands under the column.
  const menu = useObjectMenu()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [editing, setEditing] = useState<BrowserKind | null>(null)
  const [fault, setFault] = useState<{readonly said: string; readonly error: unknown} | null>(null)
  const act = (said: string, run: () => Promise<void>) => { setFault(null); void run().catch(error => setFault({said, error})) }
  const actsOf = (item: Placed): ObjectMenuItem[] => [
    ...(item.acts?.rename ? [{id: 'rename', label: 'Rename', shortcut: '⌘R', onSelect: () => setRenaming(key(item))}] : []),
    ...(item.acts?.hide ? [{id: 'hide', label: 'Hide', onSelect: () => act(`${item.label} was not hidden.`, item.acts!.hide!)}] : []),
  ]
  const menuAt = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, item: Placed) => {
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    const pointer = event.type === 'contextmenu' && 'clientX' in event
    menu.openAt(pointer ? (event as MouseEvent).clientX : box.left + 12, pointer ? (event as MouseEvent).clientY : box.bottom, actsOf(item), item.label,
      event.currentTarget, pointer ? 'pointer' : 'keyboard')
  }
  const rename = (item: Placed, name: string) => {
    setRenaming(null)
    if (name.trim() !== item.label && item.acts?.rename) act(`${item.label} was not renamed.`, () => item.acts!.rename!(name))
  }
  const editOf = (kind: BrowserKind) => sources.find(source => source.edit?.kind === kind)?.edit ?? null
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
          const edit = editOf(kind)
          if (!list.length && !edit) return null
          const editWords = editing === kind ? `Done — the ${label} the column shows stand as ticked` : `Edit — choose which ${label} the column shows`
          return <div key={kind} data-browser-kind={kind}>
            <h3 title={`${label} — ${hint}`}>{label}</h3>
            {edit && <button type="button" className="one-browser-edit" data-browser-edit={kind} aria-pressed={editing === kind} title={editWords}
              data-i={`${editing === kind ? 'Done' : 'Edit'}|${editWords}.`} onClick={() => setEditing(editing === kind ? null : kind)}>{editing === kind ? 'Done' : 'Edit'}</button>}
            {edit && editing === kind ? edit.entries().map(entry => <label key={entry.id} className="one-browser-edit-entry" data-browser-edit-entry={entry.id}
              data-i={`${entry.label}|${entry.shown ? `${entry.label} stands in the column: untick to hide it.` : `${entry.label} is hidden: tick to show it in the column.`}`}>
              <input type="checkbox" checked={entry.shown}
                onChange={event => { const shown = event.currentTarget.checked; act(`${entry.label} was not ${shown ? 'shown' : 'hidden'}.`, () => entry.show(shown)) }} />
              <span aria-hidden="true">{entry.mark ?? '▸'}</span><span>{entry.label}</span>
            </label>)
            : list.map(item => renaming === key(item)
              ? <input key={key(item)} className="one-browser-rename" aria-label={`Rename ${item.label}`} defaultValue={item.label} autoFocus
                onFocus={event => event.currentTarget.select()}
                onBlur={event => { if (event.currentTarget.dataset.cancel) setRenaming(null); else rename(item, event.currentTarget.value) }}
                onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
                  // Esc keeps the name it had: the field is let go without a rename.
                  if (event.key === 'Escape') { event.preventDefault(); event.currentTarget.dataset.cancel = 'yes'; event.currentTarget.blur() }
                }} />
              : <button type="button" key={key(item)} aria-pressed={current !== null && key(current) === key(item)}
              data-i={`${item.label}|${item.info ?? item.hint ?? ''}`}
              title={item.hint ? `${item.label} — ${item.hint}${item.waiting ? ' (declared, waiting)' : ''}` : item.label}
              {...(item.acts ? {'aria-keyshortcuts': 'Meta+R ContextMenu Shift+F10', onContextMenu: (event: MouseEvent<HTMLElement>) => menuAt(event, item),
                onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
                  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'r' && item.acts?.rename) { event.preventDefault(); setRenaming(key(item)) }
                  else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) menuAt(event, item)
                }} : {})}
              onClick={() => { hold(key(item)); onCategory?.(key(item)); setQuery('') }}>
              <span aria-hidden="true">{item.mark ?? '▸'}</span><span>{item.label}</span>
              {item.count !== undefined && <span className="one-browser-category-count" aria-label={`${item.count} in ${item.label}`}>{item.count}</span>}
              {item.waiting && <span className="mode-browser-waiting-dot" aria-label="declared, waiting" />}
            </button>)}
          </div>
        })}
        {fault && <Refusal said={fault.said} error={fault.error} className="oi-refusal one-browser-category-refusal" />}
      </nav>
      <ObjectMenu menu={menu} />
      <div className="world-browser-results">
        {current && Body && <Body key={key(current)} controlled={{category: current.id, query, previewHost}} />}
        <div ref={setPreviewHost} className="one-browser-preview" aria-label="Preview" />
      </div>
    </div>
    {pool && <section className="one-browser-pool" aria-label="Pool"><GroovePool face={poolFace} /></section>}
    {sources.map(source => source.Keeper ? <source.Keeper key={source.id} /> : null)}
  </aside>
}

const key = (category: Placed): string => categoryKey(category.source, category)
