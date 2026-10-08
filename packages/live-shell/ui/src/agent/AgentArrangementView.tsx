import {useEffect, useState, type CSSProperties} from 'react'
import {sharedAxis, trackKey, type AgentSessionTrack, type TaskClip} from './agentRunModel'
import {useAgentShell} from './AgentShellContext'
import './agentShell.css'

/**
 * The Arrangement is the run viewer: one live needle per thread at its last
 * activity on a shared time axis — absolute positions, no predicted ends.
 * Everything rendered comes from the provider's readings (tracks carry the
 * model's needles and clips); the only thing this view adds is the clock the
 * stalled ages count against.
 */
export function AgentArrangementView({tracks, nowUnixMs, error, temporalError, onHardStop, onRetry}: {
  tracks: AgentSessionTrack[]
  nowUnixMs?: number
  error?: string | null
  temporalError?: string | null
  onHardStop?: (track: AgentSessionTrack) => void
  onRetry?: (track: AgentSessionTrack) => void
}) {
  const shell = useAgentShell()
  const [tick, setTick] = useState(() => Date.now())
  const anyStalled = tracks.some(track => track.needle?.state === 'stalled')

  useEffect(() => {
    if (!anyStalled) return
    // The count-up is text derived from a real reading (last activity vs the
    // clock); no motion is animated, so reduced-motion needs no suppression.
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [anyStalled])

  // The axis is the provider's reading instant; the count-up runs on the tick.
  const axisNow = nowUnixMs ?? tick
  const axis = sharedAxis(tracks, axisNow)
  const span = axis.endUnixMs - axis.startUnixMs
  const x = (ms: number) => ((Math.min(Math.max(ms, axis.startUnixMs), axis.endUnixMs) - axis.startUnixMs) / span) * 100

  const ticks: {left: number; label: string}[] = []
  const STEP = 5 * 60 * 1000
  for (let t = Math.ceil(axis.startUnixMs / STEP) * STEP; t <= axis.endUnixMs; t += STEP) {
    ticks.push({left: x(t), label: new Date(t).toTimeString().slice(0, 5)})
  }

  const nameOf = (track: AgentSessionTrack) => track.agentName ?? track.purpose ?? track.spaceLabel ?? track.sessionRef

  const clipBar = (clip: TaskClip, color: string) => {
    if (clip.softStop || clip.state === 'queued' || clip.state === 'unknown') return null
    const left = x(clip.startUnixMs ?? axis.startUnixMs)
    const right = clip.lastActivityUnixMs !== null ? x(clip.lastActivityUnixMs) : left
    const width = Math.max(0.4, right - left)
    return (
      <div
        key={`${clip.n}`}
        role="button"
        tabIndex={0}
        title={clip.disclosure ?? `${clip.title ?? 'Task'} · ${clip.state}`}
        style={{
          position: 'absolute',
          top: 5,
          bottom: 5,
          left: `${left}%`,
          width: `${width}%`,
          background: clip.state === 'stalled' ? 'var(--stall)' : clip.state === 'done' ? 'var(--green)' : color,
          // Running draws no end: fade out, no right edge.
          backgroundImage: clip.state === 'running' ? `linear-gradient(90deg, transparent 0%, ${color} 30%)` : undefined,
          opacity: clip.state === 'done' ? 0.75 : 1,
          fontSize: 0,
        } as CSSProperties}
      />
    )
  }

  const queuedMark = (clip: TaskClip, color: string) => {
    if (clip.softStop || clip.state !== 'queued') return null
    return (
      <span
        key={`q${clip.n}`}
        title={clip.disclosure ?? 'Queued: waiting behind the running task. No length is drawn: nobody knows how long it will take.'}
        style={{position: 'absolute', top: 5, left: `calc(${x(axis.endUnixMs - 60_000)}% + 6px)`, color, fontSize: 10}}
      >
        ▸ {clip.title ?? 'queued'}
      </span>
    )
  }

  const needleEl = (track: AgentSessionTrack) => {
    const needle = track.needle
    if (!needle || needle.atUnixMs === null) {
      return needle ? (
        <span
          className="agent-disclosed"
          style={{position: 'absolute', top: 6, left: 6}}
          title={needle.disclosure ?? undefined}
        >
          idle — {needle.disclosure ?? 'no activity in the axis window'}
        </span>
      ) : null
    }
    const stalled = needle.state === 'stalled'
    const ageS = Math.max(0, Math.round((tick - needle.atUnixMs) / 1000))
    const label = stalled
      ? `${nameOf(track)} · stalled ${Math.floor(ageS / 60)}m ${String(ageS % 60).padStart(2, '0')}s`
      : needle.state === 'live'
        ? `${nameOf(track)} · live edge`
        : `${nameOf(track)} · idle`
    return (
      <div
        className={'needle' + (stalled ? ' stall' : '')}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${x(needle.atUnixMs)}%`,
          width: 2,
          background: stalled ? 'var(--stall)' : 'var(--accent)',
        } as CSSProperties}
        title={needle.disclosure ?? `Last activity ${new Date(needle.atUnixMs).toTimeString().slice(0, 8)}`}
      >
        <span
          className="rd"
          style={{
            position: 'absolute',
            left: 5,
            top: 2,
            fontSize: 9,
            whiteSpace: 'nowrap',
            background: '#1d1f22d8',
            color: stalled ? 'var(--stall)' : 'var(--text)',
            padding: '0 4px',
            borderLeft: `2px solid ${stalled ? 'var(--stall)' : 'var(--accent)'}`,
          }}
        >
          {label}
        </span>
      </div>
    )
  }

  const readout = (track: AgentSessionTrack, index: number) => {
    const key = trackKey(track)
    const telemetry = shell.telemetryOn[key] !== false && track.telemetryOn
    const stalled = track.tasks.some(clip => clip.state === 'stalled')
      || (track.group && tracks.some(item => item.parentRef === track.spaceRef && item.tasks.some(clip => clip.state === 'stalled')))
    return (
      <div
        key={`ahead-${key}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '100px 66px 52px',
          gap: 2,
          padding: 2,
          fontSize: 10,
          alignItems: 'center',
          borderTop: '1px solid var(--line)',
          background: 'var(--bg-1)',
        }}
      >
        <span
          style={{
            background: track.group ? 'var(--bg-3)' : 'var(--bg-0)',
            color: 'var(--text)',
            height: 16,
            padding: '0 4px',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            marginLeft: track.depth * 8,
            cursor: 'pointer',
          }}
          onClick={() => shell.setSelectedTrackId(key)}
        >
          {track.group ? '▾ ' : ''}{nameOf(track)}
        </span>
        <span style={{color: 'var(--text-dim)', overflow: 'hidden'}} title="Model not disclosed by any native source">
          {track.group ? 'group' : '—'}
        </span>
        <span style={{display: 'flex', gap: 2}}>
          <button
            type="button"
            onClick={() => shell.toggleTelemetry(key)}
            title={telemetry ? 'Telemetry on' : 'Telemetry off'}
            style={{height: 16, minWidth: 16, fontSize: 9, background: telemetry ? 'var(--accent)' : 'var(--bg-0)', color: telemetry ? '#21282e' : 'var(--text-dim)', border: '1px solid var(--line)', cursor: 'pointer'}}
          >
            {index}
          </button>
          <button
            type="button"
            title="Hard stop"
            aria-label="Hard stop"
            onClick={() => onHardStop?.(track)}
            style={{height: 16, minWidth: 16, fontSize: 9, background: 'var(--bg-0)', color: 'var(--text-dim)', border: '1px solid var(--line)', cursor: onHardStop ? 'pointer' : 'default'}}
          >
            ■
          </button>
          <button
            type="button"
            title="Retry stalled lane"
            aria-label="Retry"
            onClick={() => onRetry?.(track)}
            style={{height: 16, minWidth: 16, fontSize: 9, background: stalled ? 'var(--stall)' : 'var(--bg-0)', color: stalled ? '#1d1f22' : 'var(--text-dim)', border: '1px solid var(--line)', cursor: onRetry ? 'pointer' : 'default'}}
          >
            ↻
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="agent-arr" data-region="centre">
      <p><b>Run viewer</b> — one needle per thread at its last temporal activity (`oi.temporal-events/v1`). No predicted ends: running tasks draw no right edge, queued tasks no length.</p>
      {(error || temporalError) && <p className="native-error" role="alert">{error ?? temporalError}</p>}
      {!tracks.length && <p className="agent-disclosed">No sessions to plot.</p>}
      <div
        role="separator"
        aria-label="Time ruler"
        style={{position: 'relative', height: 22, borderBottom: '1px solid var(--line)', fontSize: 10, color: 'var(--text-dim)'}}
      >
        {ticks.map((tickItem, i) => (
          <span key={i} style={{position: 'absolute', top: 4, left: `${tickItem.left}%`, paddingLeft: 3, borderLeft: '1px solid var(--text-faint)', height: 14, lineHeight: '12px'}}>
            {tickItem.label}
          </span>
        ))}
        <span style={{position: 'absolute', top: 4, right: 4, color: 'var(--text-dim)'}}>{new Date(axisNow).toTimeString().slice(0, 8)}</span>
      </div>
      {tracks.map((track, index) => {
        const key = trackKey(track)
        const members = track.group ? tracks.filter(item => item.parentRef === track.spaceRef) : []
        return (
          <div key={key} style={{marginBottom: 6}}>
            <div
              className={'lane' + (track.depth ? ' sub' : '')}
              style={{
                position: 'relative',
                minHeight: track.group ? 26 : 40,
                background: 'var(--bg-0)',
                borderBottom: '1px solid var(--line)',
                marginLeft: track.depth * 8,
                boxShadow: track.depth ? `inset ${3 * track.depth}px 0 0 var(--line)` : undefined,
                overflow: 'hidden',
              } as CSSProperties}
            >
              {track.group
                ? members.flatMap(member => (member.tasks ?? []).map(clip => clip ? clipBar(clip, 'var(--accent)') : null))
                : (track.tasks ?? []).map(clip => clipBar(clip, 'var(--accent)'))}
              {!track.group && (track.tasks ?? []).map(clip => queuedMark(clip, 'var(--text-dim)'))}
              <div style={{position: 'absolute', top: 0, bottom: 0, left: `${x(axisNow)}%`, width: 1, background: 'var(--text-faint)', opacity: 0.7}} />
              {needleEl(track)}
            </div>
            {readout(track, index)}
          </div>
        )
      })}
    </div>
  )
}
