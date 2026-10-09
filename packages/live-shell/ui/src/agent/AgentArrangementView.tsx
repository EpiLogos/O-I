import {useEffect, useState, type CSSProperties} from 'react'
import {sharedAxis, trackKey, type AgentSessionTrack, type TaskClip} from './agentRunModel'
import {useAgentShell} from './AgentShellContext'
import {RefusalCard} from './RefusalCard'
import './agentShell.css'

/**
 * The Arrangement is the run viewer: one live needle per thread at its last
 * activity on a shared time axis — absolute positions, no predicted ends
 * (a live task draws no right edge; the needle is the edge; a queued task
 * is a dash with no length). Everything rendered comes from the provider's
 * readings; the only thing this view adds is the clock the stalled ages
 * count against. Geometry per the mockup's #arr.
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
    const stateClass = clip.state === 'stalled' ? 'stall' : clip.state === 'done' ? 'done' : clip.state === 'running' ? 'run' : ''
    return (
      <div
        key={`${clip.n}`}
        role="button"
        tabIndex={0}
        className={`ac ${stateClass}`}
        style={{'--tc': color, left: `${left}%`, width: `${width}%`} as CSSProperties}
        title={clip.disclosure ?? `${clip.title ?? 'Task'} · ${clip.state}`}
      >
        {clip.title ?? 'task'}<small>{clip.state}</small>
      </div>
    )
  }

  const queuedMark = (clip: TaskClip, color: string) => {
    if (clip.softStop || clip.state !== 'queued') return null
    return (
      <span
        key={`q${clip.n}`}
        className="qd"
        style={{'--tc': color, left: `calc(${x(axis.endUnixMs - 60_000)}% + 6px)`} as CSSProperties}
        title={clip.disclosure ?? 'Queued: waiting behind the running task. No length is drawn: nobody knows how long it will take.'}
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
        style={{'--tc': 'var(--accent)', left: `${x(needle.atUnixMs)}%`} as CSSProperties}
        title={needle.disclosure ?? `Last activity ${new Date(needle.atUnixMs).toTimeString().slice(0, 8)}`}
      >
        <span className="rd" style={stalled ? undefined : {borderLeftColor: 'var(--accent)'}}>{label}</span>
      </div>
    )
  }

  const readout = (track: AgentSessionTrack, index: number) => {
    const key = trackKey(track)
    const telemetry = shell.telemetryOn[key] !== false && track.telemetryOn
    const stalled = track.tasks.some(clip => clip.state === 'stalled')
      || (track.group && tracks.some(item => item.parentRef === track.spaceRef && item.tasks.some(clip => clip.state === 'stalled')))
    return (
      <div className="ahead" key={`ahead-${key}`} style={{gridTemplateColumns: '100px 66px 52px'}}>
        <span
          className="nmc"
          style={{'--tc': track.group ? 'var(--bg-3)' : 'var(--track-color, var(--track-default))', color: track.group ? 'var(--text)' : undefined, marginLeft: track.depth * 8} as CSSProperties}
          role="button"
          tabIndex={0}
          onClick={() => shell.setSelectedTrackId(key)}
          onKeyDown={event => { if (event.key === 'Enter') shell.setSelectedTrackId(key) }}
        >
          {track.group ? '▾ ' : ''}{nameOf(track)}
        </span>
        <span className="agent-dd" title="Model not disclosed by any native source"><span className="t">{track.group ? 'group' : '—'}</span></span>
        <span className="mx">
          <span
            className={telemetry ? 'n' : ''}
            role="button" tabIndex={0}
            title={telemetry ? 'Telemetry on' : 'Telemetry off'}
            onClick={() => shell.toggleTelemetry(key)}
            onKeyDown={event => { if (event.key === 'Enter') shell.toggleTelemetry(key) }}
          >
            {index}
          </span>
          <span
            role="button" tabIndex={0}
            title="Hard stop"
            aria-label="Hard stop"
            onClick={() => onHardStop?.(track)}
            onKeyDown={event => { if (event.key === 'Enter') onHardStop?.(track) }}
            style={{cursor: onHardStop ? 'pointer' : 'default'}}
          >
            ■
          </span>
          <span
            role="button" tabIndex={0}
            title="Retry stalled lane"
            aria-label="Retry"
            className={stalled ? 'n' : ''}
            style={stalled ? {background: 'var(--stall)', color: 'var(--accent-ink)', borderColor: 'var(--stall)'} : {cursor: onRetry ? 'pointer' : 'default'}}
            onClick={() => onRetry?.(track)}
            onKeyDown={event => { if (event.key === 'Enter') onRetry?.(track) }}
          >
            ↻
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className="agent-arr" data-region="centre">
      <div className="ov"><i /></div>
      <div className="ruler">
        <div className="ticks" aria-label="Time ruler">
          {ticks.map((tickItem, i) => (
            <span key={i} style={{left: `${tickItem.left}%`}}>{tickItem.label}</span>
          ))}
        </div>
        <div className="rset">
          Run viewer · all threads
          <span style={{marginLeft: 'auto', fontFamily: 'var(--mono)', color: 'var(--text-dim)'}}>{new Date(axisNow).toTimeString().slice(0, 8)}</span>
        </div>
      </div>
      {(error || temporalError) && (
        <RefusalCard title="Temporal read refused" line={error ?? temporalError ?? ''} receipt={temporalError ?? error ?? null} />
      )}
      {!tracks.length && <p className="agent-disclosed" style={{padding: '6px 10px'}}>No sessions to plot.</p>}
      <div style={{flex: 1, minHeight: 0}}>
        {tracks.map((track, index) => {
          const key = trackKey(track)
          const members = track.group ? tracks.filter(item => item.parentRef === track.spaceRef) : []
          return (
            <div key={key} style={{display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 230px', borderBottom: '2px solid var(--line)'}}>
              <div
                className={'lane' + (track.depth ? ' sub' : '')}
                style={{minHeight: track.group ? 26 : 40, marginLeft: track.depth * 8, boxShadow: track.depth ? `inset ${3 * track.depth}px 0 0 var(--line)` : undefined} as CSSProperties}
              >
                {track.group
                  ? members.flatMap(member => (member.tasks ?? []).map(clip => clip ? clipBar(clip, 'var(--accent)') : null))
                  : (track.tasks ?? []).map(clip => clipBar(clip, 'var(--accent)'))}
                {!track.group && (track.tasks ?? []).map(clip => queuedMark(clip, 'var(--text-dim)'))}
                <div className="nowline" style={{left: `${x(axisNow)}%`}} />
                {needleEl(track)}
              </div>
              {readout(track, index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
