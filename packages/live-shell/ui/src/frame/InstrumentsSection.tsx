// Instruments in the browser (manual §10.3, FOUNDATION F2): "To open it, double-click it or drag it into a pane." A row
// previews on select, opens in the focused pane on double-click, and drags into any pane — onto its middle to open there,
// onto an edge to open beside it. A stage lens opens the stage and turns it to that lens, by either road: the row carries
// its lens in the drag, and the door that opens the instrument turns the stage (instrumentDoor.ts).
import {useState} from 'react'
import {INSTRUMENT_DRAG_TYPE} from '../../../../../desktop/cradle/src/surface/dropEdge'
import {Icon} from '../inhabitants/sdk/Icon'
import {instrumentEntries, instrumentPayload, type InstrumentEntry} from './instruments'
import {openInstrument, reportInstrumentFault, useInstrumentFault} from './instrumentDoor'

export function InstrumentsSection() {
  const [selected, select] = useState<string | null>(null)
  const fault = useInstrumentFault()
  const keyOf = instrumentPayload
  const open = (entry: InstrumentEntry) => {
    reportInstrumentFault(null)
    try { openInstrument(instrumentPayload(entry)) } catch (cause) { reportInstrumentFault(cause instanceof Error ? cause.message : String(cause)) }
  }
  const entries = instrumentEntries()
  return <section className="browser-instruments" aria-label="Instruments" data-browser-category="instruments">
    <header className="browser-sets-head"><span>Instruments</span></header>
    <ul>
      {entries.map(entry => <li key={keyOf(entry)}>
        <button type="button" draggable data-instrument={keyOf(entry)} aria-pressed={selected === keyOf(entry)} title={entry.note}
          onClick={() => select(keyOf(entry))} onDoubleClick={() => open(entry)}
          onKeyDown={event => { if (event.key === 'Enter') open(entry) }}
          onDragStart={event => { reportInstrumentFault(null); event.dataTransfer.setData(INSTRUMENT_DRAG_TYPE, instrumentPayload(entry)); event.dataTransfer.effectAllowed = 'copy' }}>
          <Icon name={entry.mark} size={13} /><b>{entry.label}</b>{entry.lens && <span>stage lens</span>}
        </button>
      </li>)}
    </ul>
    {selected && <p className="browser-instruments-preview" role="status">{entries.find(entry => keyOf(entry) === selected)?.note} Double-click or drag it into a pane.</p>}
    {fault && <p className="browser-instruments-fault" role="alert">{fault}</p>}
  </section>
}
