import type { CSSProperties, KeyboardEvent } from 'react'
import { deriveLanes, durationMs, nextSpanRef, waterfallGeometry } from '../read-model'
import type { ExecutionTraceView, Status } from '../types'

export interface TraceWaterfallProps {
  trace: ExecutionTraceView
  selectedSpanRef?: string
  onSelectSpan?: (spanRef: string) => void
}

const glyph: Record<Status, string> = {
  queued: '○', running: '●', success: '✓', fail: '✕', blocked: '◇', cancelled: '–',
}

function msLabel(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value < 1000) return `${Math.round(value)}ms`
  if (value < 60_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`
  return `${Math.floor(value / 60_000)}m ${Math.round((value % 60_000) / 1000)}s`
}

export function TraceWaterfall({ trace, selectedSpanRef, onSelectSpan }: TraceWaterfallProps) {
  const lanes = deriveLanes(trace)
  const geometry = new Map(waterfallGeometry(trace).map((item) => [item.spanRef, item]))

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = nextSpanRef(trace, selectedSpanRef, event.key === 'ArrowRight' ? 1 : -1)
    if (next) onSelectSpan?.(next)
  }

  return (
    <div className="fb-waterfall" tabIndex={0} onKeyDown={keyDown} aria-label="Execution trace waterfall">
      <div className="fb-waterfall-axis"><span>lane</span><span>chronology →</span></div>
      {lanes.map((lane) => (
        <div className="fb-waterfall-row" key={lane.laneRef}>
          <div className="fb-lane-label">
            <strong>{lane.label}</strong>
            <span>{lane.modelLabel ?? lane.kind}</span>
          </div>
          <div className="fb-track">
            {lane.spans.map((span) => {
              const g = geometry.get(span.spanRef)
              if (!g) return null
              const style: CSSProperties = { left: `${g.leftPct}%`, width: `${g.widthPct}%` }
              const tools = span.events.filter((event) => event.kind === 'tool_call')
              return (
                <button
                  type="button"
                  className={`fb-span fb-status-${span.status}${selectedSpanRef === span.spanRef ? ' is-selected' : ''}`}
                  style={style}
                  key={span.spanRef}
                  title={`${span.name} — ${span.status}`}
                  onClick={() => onSelectSpan?.(span.spanRef)}
                >
                  <span className="fb-span-top"><span>{glyph[span.status]}</span><strong>{span.name}</strong><small>{msLabel(durationMs(span.startedAt, span.endedAt))}</small></span>
                  <span className="fb-span-description">{span.description ?? span.kind}</span>
                  {tools.map((event) => <span key={event.eventRef} className={`fb-tool-tick${event.status === 'fail' ? ' is-error' : ''}`} />)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
