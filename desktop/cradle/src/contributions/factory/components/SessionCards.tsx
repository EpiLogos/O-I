import { orderedTraces } from '../read-model'
import type { ExecutionTraceView } from '../types'

function runtime(trace: ExecutionTraceView): string {
  if (!trace.startedAt) return '—'
  const a = Date.parse(trace.startedAt)
  const b = trace.endedAt ? Date.parse(trace.endedAt) : Date.now()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '—'
  const seconds = Math.max(0, b - a) / 1000
  return seconds < 60 ? `${seconds.toFixed(seconds < 10 ? 1 : 0)}s` : `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

export function SessionCards({ traces, selectedExecutionRef, onSelect }: {
  traces: ExecutionTraceView[]
  selectedExecutionRef?: string
  onSelect?: (executionRef: string) => void
}) {
  return <div className="fb-session-grid">
    {orderedTraces(traces).map((trace) => {
      const agents = [...new Set(trace.spans.map((span) => span.ownerLabel).filter(Boolean))]
      const toolCount = trace.spans.reduce((n, span) => n + span.events.filter((event) => event.kind === 'tool_call').length, 0)
      return <button
        type="button"
        key={trace.executionRef}
        className={`fb-session-card fb-status-${trace.status}${selectedExecutionRef === trace.executionRef ? ' is-selected' : ''}`}
        onClick={() => onSelect?.(trace.executionRef)}
      >
        <div className="fb-card-top"><code>{trace.executionRef}</code><span className="fb-status">{trace.status}</span></div>
        <strong className="fb-card-request">{trace.request ?? trace.runRef}</strong>
        <div className="fb-mini-lanes">{agents.slice(0, 4).map((agent) => <span key={agent}>{agent}</span>)}{agents.length > 4 ? <span>+{agents.length - 4}</span> : null}</div>
        <div className="fb-phase-dots">{trace.spans.map((span) => <span title={`${span.name} — ${span.status}`} className={`fb-dot fb-status-${span.status}`} key={span.spanRef} />)}</div>
        <div className="fb-card-stats"><span>{runtime(trace)}</span><span>{trace.totalTokens?.toLocaleString() ?? '—'} tok</span><span>{trace.totalCost == null ? '—' : `$${trace.totalCost.toFixed(3)}`}</span><span>{toolCount} tools</span></div>
      </button>
    })}
  </div>
}
