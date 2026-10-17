// Instruments in the browser (manual §10.3, FOUNDATION F2): "To open it, double-click it or drag it into a pane." A row
// previews on select, opens in the focused pane on double-click, and drags into any pane — onto its middle to open there,
// onto an edge to open beside it. A stage lens opens the stage and turns it to that lens, by either road: the row carries
// its lens in the drag, and the door that opens the instrument turns the stage (instrumentDoor.ts).
// Changing instrument keeps the subject (G2): the stage's lenses turn the one stage, which keeps its open Scene, and the Graph
// opens on the subject held now — THE selection — saying on this section's line when it draws no node for it
// (techne/subject/graphFocus.ts). The preview says so before the open.
import {useState} from 'react'
import {INSTRUMENT_DRAG_TYPE} from '../../../../../desktop/cradle/src/surface/dropEdge'
import {Icon} from '../inhabitants/sdk/Icon'
import {useOptionalContinuity} from '../continuity/workspace'
import {heldSubjectWords, instrumentEntries, instrumentPayload, type InstrumentEntry} from './instruments'
import {openInstrument, reportInstrumentFault, useInstrumentFault} from './instrumentDoor'

export function InstrumentsSection() {
  const [selected, select] = useState<string | null>(null)
  const fault = useInstrumentFault()
  const held = useOptionalContinuity()?.current.context?.selection ?? null
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
    {selected && <InstrumentPreview entry={entries.find(entry => keyOf(entry) === selected)} held={held} />}
    {fault && <p className="browser-instruments-fault" role="alert">{fault}</p>}
  </section>
}

/** The selected row's preview: what the instrument is for, what it does with the subject held now, and how to open it. */
export function InstrumentPreview({entry, held}: {entry: InstrumentEntry | undefined; held: {title: string} | null}) {
  const keeps = entry ? heldSubjectWords(entry, held) : null
  // The notes are one line each with no full stop of their own (instruments.ts); the preview gives the sentence its end.
  return <p className="browser-instruments-preview" role="status">{entry?.note ? `${entry.note.replace(/[.\s]+$/, '')}.` : ''}{keeps ? ` ${keeps}` : ''} Double-click or drag it into a pane.</p>
}
