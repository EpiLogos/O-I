// The Live rack widget for the one instrument, the M1 torus (T-LIVE-TORUS-INSTRUMENT,
// the compact presentation). It sits at the head of the Live device chain, and only
// once the owner has published a reading (DeviceChainPanel's mount gate).
//
// It presents the shared reading handle (live/torusInstrument.ts). It draws no torus:
// the visible torus is only ever the simulation's own render in the hosted frame.

import {liveTorusMacroRows, useLiveTorusReading, type LiveTorusState} from '../../live/torusInstrument'
import './liveTorusWidget.css'

export function LiveTorusWidget() {
  const state = useLiveTorusReading()
  return <LiveTorusWidgetView state={state}/>
}

export function LiveTorusWidgetView({state}: {state: LiveTorusState | null}) {
  const kind = state === null ? 'absent' : state.ok ? state.value.standing : 'refused'
  const standing = state !== null && state.ok ? state.value.standing : undefined
  const rows = liveTorusMacroRows(state)
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
            <b className="live-torus-macro-value">{row.value ?? 'not in owner reading'}</b>
          </li>
        ))}
      </ul>
    </section>
  )
}
