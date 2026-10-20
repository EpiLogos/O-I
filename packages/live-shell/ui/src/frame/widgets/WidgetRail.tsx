// The one widget rail (FOUNDATION F8): every widget the world registers, one open set for the whole world held in the
// book (open a terminal in Factory and it is still there in Central), each widget's pin, the launcher at the bottom and the
// rail's presets. It knows no mode: the frame hands it the registered widgets and the book.
//
// Drawn to the mockup's right column (world-shell-mockup.html `.tilesh` 140, `.tiles` 141, `.tile`/`.tlh`/`.tlb` 142–145,
// `.launch`/`.lh`/`.lgrid`/`.lcell`/`.pv` 379–387): the open widgets as tiles under one head, each tile's head its mark, its
// name, the count its owner disclosed and the pin and close marks; below, the launcher's two columns of cells, each a live
// miniature of what the open widget read (its glance) or, with no reading standing, the widget's designed mark.
import {useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent} from 'react'
import type {ReactNode} from 'react'
import {Icon} from '../../inhabitants/sdk/Icon'
import {publishRail} from '../devices/deviceDoor'
import {claimedWidget, deviceWidgets} from './deviceWidgets'
import {sameGlance, type WidgetDeclaration, type WidgetGlance, type WidgetRailBook} from './widgets'

/** What a drop onto the rail needs, handed in by the shell (the rail knows no mode): the handlers, and the words the last drop answered with. */
export interface RailDrop {
  readonly dropProps: {onDragOver(event: DragEvent<HTMLElement>): void; onDrop(event: DragEvent<HTMLElement>): void}
  readonly note: string | null
}

export function WidgetRail({widgets, book, selectionRef, drop}: {widgets: readonly WidgetDeclaration[]; book: WidgetRailBook; selectionRef: string | null; drop?: RailDrop}) {
  const [needle, setNeedle] = useState('')
  const [naming, setNaming] = useState<string | null>(null)
  const [glances, setGlances] = useState<Readonly<Record<string, WidgetGlance>>>({})
  // One stable hand per widget, so a body's glance effect runs only when its reading changes.
  const hands = useRef(new Map<string, (glance: WidgetGlance | null) => void>())
  const handOf = useCallback((id: string) => {
    let hand = hands.current.get(id)
    if (!hand) {
      hand = glance => setGlances(held => {
        if (sameGlance(held[id], glance)) return held
        const {[id]: _gone, ...rest} = held
        return glance ? {...rest, [id]: glance} : rest
      })
      hands.current.set(id, hand)
    }
    return hand
  }, [])
  // A device's head puts it on the rail through the door (deviceDoor.ts putOnRail): the rail hands the door its open set and its
  // toggle. Its device widgets (deviceWidgets.tsx) are widgets of the rail's own kind, `device:<id>`, in the same open set.
  const railOpen = book.rail.open, toggle = book.toggle
  useEffect(() => { publishRail({open: railOpen, toggle}) }, [railOpen, toggle])
  useEffect(() => () => publishRail(null), [])
  const devices = deviceWidgets(book.rail.open, needle)
  // A registered widget a device claims draws as that device's widget (deviceWidgets.tsx claimRailWidget: the Frames monitor, §23.8).
  const byId = new Map([...widgets.map(claimedWidget), ...devices.open].map(widget => [widget.id, widget]))
  const open = book.rail.open.map(id => byId.get(id)).filter((widget): widget is WidgetDeclaration => widget !== undefined)
  const query = needle.trim().toLocaleLowerCase()
  const launcher = [...widgets.filter(widget => !query || widget.name.toLocaleLowerCase().includes(query) || widget.hint?.toLocaleLowerCase().includes(query)),
    ...devices.found.filter(found => !widgets.some(widget => widget.id === found.id))]
  const drag = (event: ReactPointerEvent) => {
    const startX = event.clientX, startWidth = book.rail.width ?? 300
    const move = (moved: PointerEvent) => book.widen(startWidth + (startX - moved.clientX))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const save = () => { if (naming?.trim()) book.savePreset(naming); setNaming(null) }
  return <aside className="mode-dock widget-rail" aria-label="Widgets" {...drop?.dropProps}>
    <div className="mode-dock-wedge" onPointerDown={drag} role="separator" aria-orientation="vertical" aria-label="Widen the widget rail"
      title="Drag to widen the rail; widgets reflow." />
    <div className="mode-dock-tilesh"><span>Widgets</span><span className="mode-dock-count">{open.length} open</span></div>
    {drop?.note && <p className="native-empty" role="status" data-rail-drop>{drop.note}</p>}
    <div className="mode-dock-tiles">
      {open.length === 0 && <div className="mode-dock-empty">Open a widget from the launcher below.</div>}
      {open.map(widget => {
        const pinnedAt = book.rail.pinned?.[widget.id] ?? null
        const Body = widget.Body
        const count = glances[widget.id]?.count
        // A bare widget draws its own tile (a device's: the kit's Tile, with its light, name, ⤢ and ✕).
        if (widget.bare) return <section key={widget.id} className="mode-dock-tile mode-dock-tile--bare" data-widget={widget.id}>
          <Body subject={pinnedAt !== null ? pinnedAt || null : selectionRef} pinned={pinnedAt !== null} glance={handOf(widget.id)} close={() => book.toggle(widget.id)} />
        </section>
        return <section key={widget.id} className="mode-dock-tile" data-widget={widget.id} data-pinned={pinnedAt !== null || undefined}>
          <header className="mode-dock-tile-head">
            <span className="mode-dock-tile-mark">{markOf(widget, 11)}</span>
            <span className="mode-dock-tile-name">{nameOf(widget)}</span>
            {count !== undefined && <span className="mode-dock-tile-count" data-count={count}>{count}</span>}
            <span className="mode-dock-tile-marks">
              <button type="button" aria-pressed={pinnedAt !== null} aria-label={`Pin ${widget.name}`}
                title={pinnedAt !== null ? `Pinned at ${pinnedAt || 'nothing selected'} — press to follow the selection again.` : 'Pin — stop following the selection; keep this view.'}
                onClick={() => book.pin(widget.id, pinnedAt !== null ? null : selectionRef ?? '')}><Icon name={pinnedAt !== null ? 'placed' : 'follow'} size={11} /></button>
              <button type="button" aria-label={`Close ${widget.name}`} title="Close — it stays in the launcher." onClick={() => book.toggle(widget.id)}>✕</button>
            </span>
          </header>
          <div className="mode-dock-tile-body"><Body subject={pinnedAt !== null ? pinnedAt || null : selectionRef} pinned={pinnedAt !== null} glance={handOf(widget.id)} /></div>
        </section>
      })}
    </div>
    <section className="mode-dock-launch" aria-label="Launcher">
      <div className="mode-dock-launch-head">
        <span className="mode-dock-launch-mark" aria-hidden="true"><Icon name="plus" size={11} /></span>
        <input type="search" value={needle} onChange={event => setNeedle(event.target.value)} placeholder="Open a widget… agent, packet, trail, terminal" aria-label="Open a widget" />
      </div>
      <div className="mode-dock-launch-grid">
        {launcher.map(widget => {
          const isOpen = book.rail.open.includes(widget.id)
          const glance = isOpen ? glances[widget.id] : undefined
          return <button key={widget.id} type="button" className={`mode-dock-cell${isOpen ? ' open' : ''}`} aria-pressed={isOpen} data-launch={widget.id}
            data-preview={glance?.lines?.length ? 'reading' : 'mark'}
            title={`${widget.name}${widget.hint ? ` — ${widget.hint}` : ''}. ${isOpen ? 'Close it above.' : 'Open it above.'}`} onClick={() => book.toggle(widget.id)}>
            <span className="mode-dock-cell-preview" aria-hidden="true">{glance?.lines?.length
              ? <span className="mode-dock-cell-lines">{glance.lines.slice(0, 7).map((line, index) => <span key={index}>{line.lead && <i>{line.lead}</i>}{line.text}</span>)}</span>
              : <span className="mode-dock-cell-mark">{markOf(widget, 24)}</span>}</span>
            <span className="mode-dock-cell-name">
              <span className="mode-dock-cell-glyph" aria-hidden="true">{markOf(widget, 10)}</span>
              <span className="mode-dock-cell-label">{nameOf(widget)}</span>
              {isOpen ? <small aria-label="open">open</small> : glance?.status ? <small>{glance.status}</small> : null}
            </span>
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
const nameOf = (widget: WidgetDeclaration): ReactNode => { const Name = widget.Name; return Name ? <Name /> : widget.name }
