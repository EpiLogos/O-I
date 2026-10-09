/**
 * The mode transport — the shell bar's fixed slots wearing a mode's meanings
 * (WORLD-SHELL-DESIGN Revision 5: one transport, five meanings).
 *
 * The SAME slot structure the Live transport draws — Link · Tap, tempo ·
 * signature, metronome · quantize, key/scale, the playback row, the
 * punch/loop row, the draw/keys/system row — re-meanied from the grammar
 * (`modeGrammar.ts`), never re-laid-out. Every control is a drawn waiting
 * state per the widget guide's law: reduced presence, and a tooltip that
 * names the function AND that it is not built here — no illuminated lie, no
 * faked reading. Where a real reading exists the caller passes it in
 * `readouts`; the slot then shows the owner's value and says so.
 *
 * Live keeps its own controls (the audio cut's), Expressions keeps the
 * native transport when the owner is attached; this component is the honest
 * body of the bar for Base·Central and Technē (and the Expressions bar
 * while no native reading stands).
 *
 * Pure presentation over the grammar: no store, no clock, no owner writes.
 */

import {MODE_GRAMMAR, slotDataI, slotMeaning, type SurfMode, type TransportSlotId} from './modeGrammar'
import './modeSurface.css'

/** One real reading a mode's transport may show: the owner's value and the
 * line that says whose reading it is. */
export type ModeTransportReadout = {value: string; title: string}
export type ModeTransportReadouts = Partial<Record<TransportSlotId, ModeTransportReadout>>

export function ModeTransportBar({mode, readouts}: {mode: SurfMode; readouts?: ModeTransportReadouts}) {
  const grammar = MODE_GRAMMAR[mode]
  const meaning = (id: TransportSlotId) => slotMeaning(mode, id)
  const dataI = (id: TransportSlotId) => ({'data-i': slotDataI(meaning(id))})
  const waiting = (id: TransportSlotId) => {
    const slot = meaning(id)
    return `${slot.label} — ${slot.fn}. Not wired here yet: ${grammar.waitingNote}`
  }
  const hold = (id: TransportSlotId) => ({...dataI(id), title: waiting(id), 'aria-label': meaning(id).label, 'aria-disabled': true} as const)
  const readout = (id: TransportSlotId, fallbackTitle?: string): ModeTransportReadout =>
    readouts?.[id] ?? {value: '—', title: fallbackTitle ?? waiting(id)}

  return <div className="mode-transport" data-mode-transport={mode} role="group" aria-label={`${grammar.title} transport`}>
    <div className="transport-group">
      <button type="button" className="native-control" disabled {...hold('link')}>{meaning('link').label}</button>
      <button type="button" className="native-control" disabled {...hold('tap')}>{meaning('tap').label}</button>
    </div>
    <div className="transport-group transport-tempo">
      <output className="tempo-field" {...dataI('tempo')} title={waiting('tempo')} aria-label={meaning('tempo').label}>{readout('tempo').value}</output>
      <button type="button" className="native-control" disabled {...hold('tempo')}>‹</button>
      <button type="button" className="native-control" disabled {...hold('tempo')}>›</button>
      <output className="meter-field" {...dataI('signature')} title={waiting('signature')} aria-label={meaning('signature').label}>{readout('signature').value}</output>
      <button type="button" className="native-control" disabled {...hold('metro')}>●◦</button>
      <button type="button" className="native-control" disabled {...hold('quantize')}>{meaning('quantize').label}</button>
    </div>
    <div className="transport-scale">
      <button type="button" className="native-control" disabled {...hold('key')}>♯</button>
      <output className="meter-field" {...dataI('root')} title={waiting('root')} aria-label={meaning('root').label}>{readout('root').value}</output>
      <output className="meter-field" {...dataI('scale')} title={waiting('scale')} aria-label={meaning('scale').label}>{readout('scale').value}</output>
    </div>
    <div className="transport-spacer" />
    <div className="transport-group transport-playback">
      <button type="button" className="native-control" disabled {...hold('follow')}>➜</button>
      <output className="position-field" {...dataI('position')} title={readout('position').title} aria-label={meaning('position').label}>{readout('position').value}</output>
      <button type="button" className="native-control transport-btn transport-play" disabled {...hold('play')} aria-label={meaning('play').label}>▶</button>
      <button type="button" className="native-control transport-btn" disabled {...hold('stop')} aria-label={meaning('stop').label}>■</button>
      <button type="button" className="native-control transport-btn transport-record" disabled {...hold('record')} aria-label={meaning('record').label}>●</button>
      <button type="button" className="native-control" disabled {...hold('overdub')}>+</button>
      <button type="button" className="native-control" disabled {...hold('arm')}>⌘</button>
      <button type="button" className="native-control" disabled {...hold('re-enable')}>←</button>
      <button type="button" className="native-control" disabled {...hold('capture')}>○</button>
    </div>
    <div className="transport-loop transport-group">
      <output className="position-field" {...dataI('punch-in')} title={waiting('punch-in')} aria-label={meaning('punch-in').label}>{readout('punch-in').value}</output>
      <button type="button" className="native-control" disabled {...hold('punch-in')}>⌁</button>
      <button type="button" className="native-control" disabled {...hold('loop')}>↔</button>
      <button type="button" className="native-control" disabled {...hold('punch-out')}>⌁</button>
      <output className="position-field" {...dataI('loop-length')} title={waiting('loop-length')} aria-label={meaning('loop-length').label}>{readout('loop-length').value}</output>
    </div>
    <div className="transport-spacer" />
    <div className="transport-system">
      <button type="button" className="native-control" disabled {...hold('draw')}>✎</button>
      <button type="button" className="native-control" disabled {...hold('keys')}>▥</button>
      <button type="button" className="native-control" disabled {...hold('key-map')}>{meaning('key-map').label}</button>
      <button type="button" className="native-control" disabled {...hold('midi-map')}>{meaning('midi-map').label}</button>
      <output {...dataI('rate')} title={readout('rate').title} aria-label={meaning('rate').label}>{readout('rate').value}</output>
      <output {...dataI('cpu')} title={readout('cpu').title} aria-label={meaning('cpu').label}>{readout('cpu').value}</output>
      <span className="cpu-meter" />
    </div>
  </div>
}
