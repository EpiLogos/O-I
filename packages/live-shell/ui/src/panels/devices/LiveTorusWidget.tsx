// The Live rack widget for the one instrument, the M1 torus (T-LIVE-TORUS-INSTRUMENT, the compact presentation). It sits at the head of
// the Live device chain, and only once the owner has published a reading (DeviceChainPanel's mount gate).
//
// It presents the shared reading handle (live/torusInstrument.ts) and never draws a torus: the visible torus is only ever the
// simulation's own render in the hosted frame. Its four macros are the owner's determinants; choosing one sends the owner's own
// determinant edit through the hosted channel, and a refusal is named here.

import {useState} from 'react'
import type {InstrumentEdit} from '@epilogos/expressions-boundary'
import {
  commitLiveInstrumentEdit, liveInstrumentWritable, liveTorusMacroRows, useLiveTorusReading, type LiveTorusState,
} from '../../live/torusInstrument'
import './liveTorusWidget.css'

export function LiveTorusWidget() {
  const state = useLiveTorusReading()
  return <LiveTorusWidgetView state={state}/>
}

export function LiveTorusWidgetView({state}: {state: LiveTorusState | null}) {
  const kind = state === null ? 'absent' : state.ok ? state.value.standing : 'refused'
  const standing = state !== null && state.ok ? state.value.standing : undefined
  const rows = liveTorusMacroRows(state)
  const [refusal, setRefusal] = useState<string | null>(null)
  const choose = (edit: (value: string) => InstrumentEdit, value: string) => {
    setRefusal(null)
    void commitLiveInstrumentEdit(edit(value)).then(result => { if (!result.ok) setRefusal(result.error) })
  }
  return (
    <section className="live-torus" data-live-torus={kind} data-standing={standing} aria-label="M1 torus instrument">
      <header className="live-torus-head">
        <span className="live-torus-title">M1 torus</span>
        <span className="live-torus-sub">the one instrument · Body 3:3</span>
      </header>
      <div className="live-torus-read">
        {state === null && <p className="live-torus-note">No owner reading in this host. The stage is the Expressions frame's native field; it is not open here.</p>}
        {state !== null && !state.ok && <p className="live-torus-note is-fault" role="alert">{`Refused reading: ${state.fault}. A plausible owner state is never rendered.`}</p>}
        {state !== null && state.ok && (
          <dl className="live-torus-facts">
            <dt>standing</dt><dd>{state.value.standing}</dd>
            <dt>event</dt><dd>{state.value.identity.event_ref}</dd>
          </dl>
        )}
      </div>
      <ul className="live-torus-macros" aria-label="Macros">
        {rows.map(row => (
          <li key={row.macro.id} className="live-torus-macro" data-macro={row.macro.id} data-value={row.value ?? 'none'} title={row.macro.source}>
            <span className="live-torus-macro-name">{row.macro.label}</span>
            {row.selected === null
              ? <b className="live-torus-macro-value">not in owner reading</b>
              : <select className="live-torus-macro-select" aria-label={row.macro.label} value={row.selected} disabled={!liveInstrumentWritable(state)}
                  onChange={event => choose(row.edit, event.target.value)}>
                  {row.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>}
          </li>
        ))}
      </ul>
      {refusal !== null && <p className="live-torus-note is-fault" role="alert" data-live-torus-refusal>{`Refused by the owner: ${refusal}`}</p>}
    </section>
  )
}
