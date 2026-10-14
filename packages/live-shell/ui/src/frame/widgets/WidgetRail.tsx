// The one widget rail (FOUNDATION F8): every widget the world registers, one open set for the whole world held in the
// book (open a terminal in Factory and it is still there in Central), each widget's pin, the launcher at the bottom and the
// rail's presets. It knows no mode: the frame hands it the registered widgets and the book.
import {useState, type PointerEvent as ReactPointerEvent} from 'react'
import type {ReactNode} from 'react'
import {Icon} from '../../inhabitants/sdk/Icon'
import type {WidgetDeclaration, WidgetRailBook} from './widgets'

export function WidgetRail({widgets, book, selectionRef}: {widgets: readonly WidgetDeclaration[]; book: WidgetRailBook; selectionRef: string | null}) {
  const [needle, setNeedle] = useState('')
  const [naming, setNaming] = useState<string | null>(null)
  const byId = new Map(widgets.map(widget => [widget.id, widget]))
  const open = book.rail.open.map(id => byId.get(id)).filter((widget): widget is WidgetDeclaration => widget !== undefined)
  const query = needle.trim().toLocaleLowerCase()
  const launcher = widgets.filter(widget => !query || widget.name.toLocaleLowerCase().includes(query))
  const drag = (event: ReactPointerEvent) => {
    const startX = event.clientX, startWidth = book.rail.width ?? 300
    const move = (moved: PointerEvent) => book.widen(startWidth + (startX - moved.clientX))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const save = () => { if (naming?.trim()) book.savePreset(naming); setNaming(null) }
  return <aside className="mode-dock widget-rail" aria-label="Widgets">
    <div className="mode-dock-wedge" onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="Widen the widget rail"
      title="Drag to widen the rail; widgets reflow." />
    <div className="mode-dock-tilesh"><span>Widgets</span><span className="mode-dock-count">{open.length} open</span></div>
    <div className="mode-dock-tiles">
      {open.length === 0 && <div className="mode-dock-empty">Open a widget from the launcher below.</div>}
      {open.map(widget => {
        const pinnedAt = book.rail.pinned?.[widget.id] ?? null
        const Body = widget.Body
        return <section key={widget.id} className="mode-dock-tile" data-widget={widget.id} data-pinned={pinnedAt !== null || undefined}>
          <header className="mode-dock-tile-head">
            <span className="mode-dock-tile-mark">{markOf(widget, 12)}</span>
            <span className="mode-dock-tile-name">{widget.name}</span>
            <span className="mode-dock-tile-marks">
              <button type="button" aria-pressed={pinnedAt !== null} aria-label={`Pin ${widget.name}`}
                title={pinnedAt !== null ? `Pinned at ${pinnedAt} — press to follow the selection again.` : 'Pin — stop following the selection; keep this view.'}
                onClick={() => book.pin(widget.id, pinnedAt !== null ? null : selectionRef ?? '')}>⌖</button>
              <button type="button" aria-label={`Close ${widget.name}`} title="Close — it stays in the launcher." onClick={() => book.toggle(widget.id)}>✕</button>
            </span>
          </header>
          <div className="mode-dock-tile-body"><Body subject={pinnedAt !== null ? pinnedAt || null : selectionRef} pinned={pinnedAt !== null} /></div>
        </section>
      })}
    </div>
    <section className="mode-dock-launch" aria-label="Launcher">
      <div className="mode-dock-launch-head">
        <input type="search" value={needle} onChange={event => setNeedle(event.target.value)} placeholder="Open a widget…" aria-label="Open a widget" />
      </div>
      <div className="mode-dock-launch-grid">
        {launcher.map(widget => {
          const isOpen = book.rail.open.includes(widget.id)
          return <button key={widget.id} type="button" className={`mode-dock-cell${isOpen ? ' open' : ''}`} aria-pressed={isOpen} data-launch={widget.id}
            title={`${widget.name}${widget.hint ? ` — ${widget.hint}` : ''}. ${isOpen ? 'Close it above.' : 'Open it above.'}`} onClick={() => book.toggle(widget.id)}>
            <span className="mode-dock-cell-preview" aria-hidden="true">{markOf(widget, 17)}</span>
            <span className="mode-dock-cell-name">{widget.name}{isOpen && <span className="mode-dock-cell-dot" aria-label="open" />}</span>
          </button>
        })}
      </div>
      <div className="widget-presets" aria-label="Presets">
        {(book.rail.presets ?? []).map(preset => <button key={preset.id} type="button" className="mode-dock-preset" data-preset={preset.id}
          title={`Open exactly ${preset.open.length} widget${preset.open.length === 1 ? '' : 's'}: ${preset.open.join(', ')}`} onClick={() => book.applyPreset(preset.id)}>{preset.name}</button>)}
        {naming === null
          ? <button type="button" className="mode-dock-preset" data-action="save-widget-preset" disabled={book.rail.open.length === 0}
              title="Keep the open widgets as a preset" onClick={() => setNaming('')}>+ Save as preset…</button>
          : <form onSubmit={event => { event.preventDefault(); save() }}>
              <input autoFocus aria-label="Preset name" value={naming} placeholder="Name this preset" onChange={event => setNaming(event.target.value)}
                onKeyDown={event => { if (event.key === 'Escape') setNaming(null) }} />
            </form>}
      </div>
    </section>
  </aside>
}

const markOf = (widget: WidgetDeclaration, size: number): ReactNode => typeof widget.mark === 'string' ? <Icon name={widget.mark} size={size} /> : widget.mark
