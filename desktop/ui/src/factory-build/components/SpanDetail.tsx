import { eventDurationMs, processEvents, toolEvents } from '../read-model'
import type { TraceSpan } from '../types'

function fmt(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function duration(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(2)}s`
}

export function SpanDetail({ span, onClose }: { span: TraceSpan; onClose?: () => void }) {
  const tools = toolEvents(span)
  const processes = processEvents(span)
  return (
    <section className="fb-detail" aria-label={`Span detail ${span.name}`}>
      <header className="fb-detail-head">
        <div><strong>{span.name}</strong><span className={`fb-status fb-status-${span.status}`}>{span.status}</span></div>
        <div className="fb-detail-meta"><span>owner {span.ownerLabel ?? span.agentRef ?? '—'}</span><span>attempt {span.attempt ?? 0}/{span.retries ?? 0}</span><span>{span.kind}</span></div>
        {onClose ? <button type="button" className="fb-icon-button" onClick={onClose} aria-label="Close detail">×</button> : null}
      </header>
      {span.error ? <div className="fb-error">{span.error}</div> : null}
      <div className="fb-detail-grid">
        <div>
          <h4>tool calls <span>{tools.length}</span></h4>
          {tools.length ? tools.map((event) => {
            const call = event.toolCall
            return (
              <details className="fb-event" key={event.eventRef}>
                <summary>
                  <span className={call?.ok === false ? 'fb-event-fail' : 'fb-event-ok'}>{call?.ok === false ? '✕' : '✓'}</span>
                  <strong>{call?.tool ?? event.name ?? 'tool'}</strong>
                  <span>{duration(eventDurationMs(event))}</span>
                  <span>{event.agentRef ?? span.agentRef ?? '—'}</span>
                </summary>
                <div className="fb-event-body">
                  <label>arguments</label><pre>{fmt(call?.args)}</pre>
                  <label>{call?.error ? 'error' : 'result'}</label><pre>{call?.error ?? fmt(call?.result)}</pre>
                  <label>native ref</label><code>{call?.nativeRef ?? event.nativeRef ?? 'unavailable'}</code>
                </div>
              </details>
            )
          }) : <p className="fb-muted">No tool calls retained for this span.</p>}
        </div>
        <div>
          <h4>events <span>{span.events.length}</span></h4>
          <div className="fb-event-list">
            {span.events.map((event) => <div key={event.eventRef}><code>{event.kind}</code><span>{event.name ?? event.eventRef}</span><small>{event.nativeRef ?? 'portable only'}</small></div>)}
          </div>
          <h4>process material <span>{processes.length}</span></h4>
          {processes.length ? processes.map((event) => <pre key={event.eventRef}>{fmt(event.payload)}</pre>) : <p className="fb-muted">Unavailable in this trajectory. The pinned SSSF trace does not emit a process event type; richer native harnesses may.</p>}
        </div>
      </div>
    </section>
  )
}