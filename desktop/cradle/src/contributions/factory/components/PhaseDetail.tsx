import { eventDurationMs } from '../read-model'
import type { TraceEvent, TraceSpan } from '../types'

function durationLabel(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
}

function printable(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return '—'
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

function EventRow({ event }: { event: TraceEvent }) {
  const call = event.toolCall
  const failed = event.status === 'fail' || event.severity === 'error' || call?.ok === false
  return <details className={`fb-event-row${failed ? ' is-error' : ''}`}>
    <summary>
      <span className="fb-event-kind">{event.kind}</span>
      <strong>{call?.tool ?? event.name ?? event.eventRef}</strong>
      {call?.agentRef ?? event.agentRef ? <code>{call?.agentRef ?? event.agentRef}</code> : null}
      <span>{durationLabel(eventDurationMs(event))}</span>
      <span className="fb-event-state">{failed ? 'failed' : call?.ok === true ? 'ok' : event.status ?? ''}</span>
    </summary>
    <div className="fb-event-detail">
      {call ? <>
        <section><h4>arguments</h4><pre>{printable(call.args)}</pre></section>
        {call.error ? <section><h4>error</h4><pre>{call.error}</pre></section> : null}
        {call.result !== undefined ? <section><h4>result</h4><pre>{printable(call.result)}</pre></section> : null}
      </> : <section><h4>payload</h4><pre>{printable(event.payload)}</pre></section>}
      <dl className="fb-ref-grid">
        <div><dt>event</dt><dd><code>{event.eventRef}</code></dd></div>
        {event.nativeRef ? <div><dt>native</dt><dd><code>{event.nativeRef}</code></dd></div> : null}
        {event.executionRef ? <div><dt>execution</dt><dd><code>{event.executionRef}</code></dd></div> : null}
        {event.agencyRef ? <div><dt>agency</dt><dd><code>{event.agencyRef}</code></dd></div> : null}
      </dl>
    </div>
  </details>
}

export function PhaseDetail({ span, onClose }: { span: TraceSpan; onClose?: () => void }) {
  const events = [...span.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.eventRef.localeCompare(b.eventRef))
  const tools = events.filter((event) => event.kind === 'tool_call')
  const processes = events.filter((event) => event.kind === 'process')
  const other = events.filter((event) => event.kind !== 'tool_call' && event.kind !== 'process')

  return <section className="fb-phase-detail" aria-label={`Phase detail: ${span.name}`}>
    <header>
      <div><span className={`fb-status fb-status-${span.status}`}>{span.status}</span><h3>{span.name}</h3></div>
      <div className="fb-detail-meta"><span>{span.ownerLabel ?? span.kind}</span>{span.modelLabel ? <span>{span.modelLabel}</span> : null}<span>attempt {span.attempt ?? 0}/{span.retries ?? 0}</span></div>
      {onClose ? <button type="button" className="fb-close" aria-label="Close phase detail" onClick={onClose}>×</button> : null}
    </header>
    {span.description ? <p className="fb-phase-description">{span.description}</p> : null}
    {span.error ? <pre className="fb-error-bar">{span.error}</pre> : null}

    <div className="fb-detail-columns">
      <section>
        <h4>tool calls <span>{tools.length}</span></h4>
        {tools.length ? tools.map((event) => <EventRow key={event.eventRef} event={event} />) : <p className="fb-empty">no tool calls recorded</p>}
      </section>
      <section>
        <h4>events <span>{other.length}</span></h4>
        {other.length ? other.map((event) => <EventRow key={event.eventRef} event={event} />) : <p className="fb-empty">no additional events</p>}
        {processes.length ? <><h4>process/native events <span>{processes.length}</span></h4>{processes.map((event) => <EventRow key={event.eventRef} event={event} />)}</> : null}
      </section>
    </div>

    <footer className="fb-native-strip">
      <span>span</span><code>{span.spanRef}</code>
      {span.nativeSpanRef ? <><span>native</span><code>{span.nativeSpanRef}</code></> : null}
      {span.agentRef ? <><span>agent</span><code>{span.agentRef}</code></> : null}
      {span.agencyRef ? <><span>agency</span><code>{span.agencyRef}</code></> : null}
    </footer>
  </section>
}
