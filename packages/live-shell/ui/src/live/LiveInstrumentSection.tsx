// The expanded instrument in the Live browser pool (T-LIVE-TORUS-INSTRUMENT, the expanded presentation). It is the Instruments category's
// section, registered in the browser-section slot the browser already renders. It shows every parameter the owner's native field groups,
// read from the same owner reading as the rack widget, and writes each one through the hosted channel (torusInstrument.ts). It renders
// nothing until the owner has published a reading.

import {useState} from 'react'
import {registerPanel, type PanelContext} from '../shell/panels'
import type {InstrumentEdit} from '@epilogos/expressions-boundary'
import {
  commitLiveInstrumentEdit, LIVE_CADENCE_OPTIONS, liveInstrumentWritable, liveTorusMacroRows, useLiveTorusReading, type LiveTorusState,
} from './torusInstrument'
import {legacyGeneratorPanels} from './liveChain'
import './liveInstrumentSection.css'

/** The owner's status line, as the native field words it (nativeField.ts statusLine). */
function statusLine(state: Extract<LiveTorusState, {ok: true}>): string {
  const {value, parameters} = state
  const sound = parameters.muted ? 'sound off' : 'sound on'
  if (value.standing === 'manual') return value.reason ?? 'Not open.'
  if (value.standing === 'opening') return 'Opening — composing the event with QL…'
  if (value.standing === 'following') return `Live · ${sound}`
  if (value.standing === 'held') return `Held — ${value.reason ?? 'explicit hold'}. Resume field to continue.`
  return `Unavailable — ${value.reason ?? 'native owner unavailable'}`
}

export function LiveInstrumentSectionView({state}: {state: LiveTorusState | null}) {
  const [refusal, setRefusal] = useState<string | null>(null)
  if (state === null) return null
  if (!state.ok) {
    return <section className="live-instrument-section is-fault" data-live-instrument="refused" aria-label="M1 torus, expanded">
      <p role="alert">{`Refused reading: ${state.fault}. A plausible owner state is never rendered.`}</p>
    </section>
  }
  const writable = liveInstrumentWritable(state)
  const {parameters} = state
  const rows = liveTorusMacroRows(state)
  const write = (edit: InstrumentEdit) => {
    setRefusal(null)
    void commitLiveInstrumentEdit(edit).then(result => { if (!result.ok) setRefusal(result.error) })
  }
  const cadence = parameters.cadence
  const cadenceValue = cadence?.playing ? String(cadence.rate) : 'hold'
  return (
    <section className="live-instrument-section" data-live-instrument={state.value.standing} data-standing={state.value.standing} aria-label="M1 torus, expanded">
      <header className="live-instrument-head">
        <span className="live-instrument-title">M1 torus</span>
        <span className="live-instrument-sub">expanded · every parameter</span>
      </header>
      <p className="live-instrument-status" role="status" data-live-instrument-status>{statusLine(state)}</p>
      {parameters.refusal !== null && <p className="live-instrument-refusal" role="alert" data-live-instrument-owner-refusal>{`The owner refused: ${parameters.refusal}`}</p>}
      {refusal !== null && <p className="live-instrument-refusal" role="alert" data-live-instrument-refusal>{`Refused by the owner: ${refusal}`}</p>}

      <section className="live-instrument-group" aria-label="What is acting">
        <h4>What is acting</h4>
        {rows.map(row => (
          <label key={row.macro.id} className="live-instrument-row" data-live-param={row.macro.id}>
            <span>{row.macro.label}</span>
            {row.selected === null
              ? <b>not in owner reading</b>
              : <select aria-label={row.macro.label} value={row.selected} disabled={!writable} onChange={event => write(row.edit(event.target.value))}>
                  {row.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>}
          </label>
        ))}
      </section>

      <section className="live-instrument-group" aria-label="Play">
        <h4>Play</h4>
        <div className="live-instrument-segments" role="group" aria-label="Tick cadence">
          {LIVE_CADENCE_OPTIONS.map(option => (
            <button key={option.value} type="button" aria-pressed={cadenceValue === option.value} disabled={!writable || cadence === null}
              onClick={() => write({kind: 'cadence', rate: option.value === 'hold' ? 'hold' : Number(option.value) as 1 | 12})}>{option.label}</button>
          ))}
        </div>
        {cadence === null && <p className="live-instrument-note">No scene is open, so there is no cadence to set.</p>}
      </section>

      <section className="live-instrument-group" aria-label="See and hear">
        <h4>See and hear</h4>
        <button type="button" aria-pressed={!parameters.muted} disabled={!writable} onClick={() => write({kind: 'muted', muted: !parameters.muted})}>
          {parameters.muted ? 'Sound on' : 'Sound off'}
        </button>
        <label className="live-instrument-range">
          <span>Level · presentation gain {parameters.level.toFixed(2)}×</span>
          <input type="range" min={0} max={4} step={0.05} value={parameters.level} disabled={!writable}
            onChange={event => write({kind: 'level', value: Number(event.target.value)})}/>
        </label>
        <label className="live-instrument-range">
          <span>Scale · units per metre {parameters.scale.unitsPerMetre ?? '—'} ({parameters.scale.mode})</span>
          <input type="range" min={40} max={400} step={5} value={parameters.scale.unitsPerMetre ?? 120} disabled={!writable || parameters.scale.unitsPerMetre === null}
            onChange={event => write({kind: 'scale', units_per_metre: Number(event.target.value)})}/>
        </label>
        <button type="button" disabled={!writable} onClick={() => write({kind: 'follow-scale'})}>Use the instrument's scale</button>
      </section>
    </section>
  )
}

/** The Instruments category's section of the Live browser: the expanded instrument, when the owner has published it. */
function LiveInstrumentSectionPanel() {
  const state = useLiveTorusReading()
  return <LiveInstrumentSectionView state={state}/>
}

/** The ported generator faces, kept reachable under one labelled section until their capacities have a home in the torus's chain. */
export function LegacyGeneratorsSection(props: PanelContext) {
  const panels = legacyGeneratorPanels()
  return (
    <section className="live-legacy" aria-label="Legacy generators" data-live-legacy>
      <h4>Legacy generators</h4>
      <p className="live-legacy-note">The torus is the instrument; these faces remain until its chain carries their capacities.</p>
      {panels.map(panel => { const Panel = panel.component; return <div key={panel.id} className="live-legacy-face" data-legacy-generator={panel.id}><Panel {...props}/></div> })}
    </section>
  )
}

/** The Instruments section: the expanded instrument, then the legacy generators. */
function InstrumentsSection(props: PanelContext) {
  return <><LiveInstrumentSectionPanel/><LegacyGeneratorsSection {...props}/></>
}

registerPanel({
  id: 'Instruments',
  title: 'Instruments',
  slot: 'browser-section',
  component: InstrumentsSection,
  order: 5,
  navigation: false,
  note: 'The one instrument, expanded: its parameters grouped as the native field groups them, read from the owner reading.',
})
