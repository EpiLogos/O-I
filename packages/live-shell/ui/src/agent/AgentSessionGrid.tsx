import {useState, type CSSProperties} from 'react'
import type {AgentSessionTrack, TaskClip} from './agentRunModel'
import {trackKey} from './agentRunModel'
import {useAgentShell} from './AgentShellContext'
import {AGENT_DATA_I} from './agentFidelity'
import './agentShell.css'

/**
 * Session-grid oracle strings (fidelity.json controls + mockup session view).
 * agentFidelity.ts does not yet export per-task/per-row helpers (taskN/rowN),
 * so they are defined here verbatim from the oracle — flagged for promotion
 * into agentFidelity.ts.
 */
const ORACLE = {
  groupSlot: 'Group slot|The children’s tasks in this row; launching fires them all. Amber = stalled.',
  emptySlot: 'Empty slot|Its square stops the session after the current task (soft stop). Double-click to write a task; arm and press ● to speak one.',
  hardStop: (group: boolean) =>
    `Hard stop|Stops ${group ? 'the group and every session in it' : 'this session'} now — mid-tool if needed — and keeps what was written as a draft.`,
  retry: (lit: boolean) =>
    `Retry|Restarts a stalled or failed task from its last good step, same basis.${lit ? ' Lit: a lane in here has stalled.' : ''}`,
  main: 'Main|The whole work: Ledger and Approvals live on its chain.',
  row: (r: number) => `Row · ${r}|Launch the row: fires every task in it across sessions — a batch.`,
  mainTelemetry: 'Main telemetry|Everything into the dock and the ledger stream.',
  telemetryGroup: 'Telemetry|Live’s track activator, on the number: the whole group as a context source. Off: it keeps running but stops feeding the dock, the ledger stream and other agents’ context.',
  telemetrySession: 'Telemetry · context source|Live’s track activator. On: this session feeds the dock, the ledger stream and other agents’ context. Off: it keeps working, silently.',
  solo: 'Solo|Only soloed sessions may run.',
  arm: 'Arm|Who you are talking to: voice and the composer send here.',
  model: 'Model|This session’s model. Subagents can run a different one.',
  watch: 'Watch|Live’s monitor. In: always stream this session into the dock. Auto: when armed or selected. Off: never.',
  activityBudget: 'Activity · budget|Meter: live activity (empty when telemetry is off). Fader: this session’s share of the budget, in turns.',
  subagentModel: 'Subagent model|Default model for everything this group spawns; a member’s strip can override it.',
  groupFold: 'Group|Fold or unfold the crew.',
  task: (n: number, clip: TaskClip) => {
    const word = clip.state === 'done' ? 'Finished.'
      : clip.state === 'running' ? 'Running.'
      : clip.state === 'queued' ? 'Queued.'
      : clip.state === 'stalled' ? 'Stalled — no output past the stall limit.'
      : (clip.disclosure ?? 'Unknown.')
    return `Task · ${n}|Click: its log below. Double-click or ↗: open the thread in the main space. Triangle: run. ${word}`
  },
  header: (track: AgentSessionTrack) =>
    `${track.purpose ?? track.sessionRef}|${
      track.group
        ? 'A group: the lead and every session it spawned. Fold to collapse; its slots show the children’s tasks.'
        : track.parentRef
          ? 'A session in the group. Double-click a clip to open its thread.'
          : 'A session. Its clips are tasks.'
    }`,
} as const

const PALETTE = ['#79b6ce', '#779dcc', '#9885bc', '#8baf9c', '#b096b2', '#6caaa9']
const MAIN_ROWS = [1, 2, 3, 4]

const lbStyle: CSSProperties = {color: 'var(--text-faint)', flex: 'none'}
const ddStyle: CSSProperties = {color: 'var(--text-dim)', overflow: 'hidden', whiteSpace: 'nowrap'}

function clipBackground(clip: TaskClip): string | undefined {
  if (clip.state === 'stalled') return 'var(--stall)'
  if (clip.state === 'done') return 'var(--green)'
  if (clip.state === 'queued' || clip.softStop) return undefined
  return undefined
}

export function AgentSessionGrid({tracks, onHardStop, onRetry}: {
  tracks: AgentSessionTrack[]
  onHardStop?: (track: AgentSessionTrack) => void
  onRetry?: (track: AgentSessionTrack) => void
}) {
  const shell = useAgentShell()
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [watch, setWatch] = useState<Record<string, 'In' | 'Auto' | 'Off'>>({})
  const [soloed, setSoloed] = useState<Record<string, boolean>>({})
  const [armed, setArmed] = useState<Record<string, boolean>>({})

  if (!tracks.length) {
    return <div className="agent-shell-centre" data-region="centre"><div className="view-empty">No SessionSpace sessions disclosed by agency_read for O-I.</div></div>
  }

  const membersOf = (track: AgentSessionTrack) => tracks.filter(item => !item.group && item.parentRef === track.spaceRef)
  const visible = (track: AgentSessionTrack) => {
    if (!track.parentRef) return true
    const parent = tracks.find(item => item.group && item.spaceRef === track.parentRef)
    return !parent || !folded[trackKey(parent)]
  }
  const stalledHere = (track: AgentSessionTrack) =>
    track.group
      ? membersOf(track).some(member => member.tasks.some(clip => clip.state === 'stalled'))
      : track.tasks.some(clip => clip.state === 'stalled')

  return (
    <div className="agent-shell-centre" data-region="centre">
      <div className="session-scroll" style={{display: 'flex', flexDirection: 'row', alignItems: 'stretch', overflow: 'auto'}}>
        {tracks.map((track, index) => {
          if (!visible(track)) return null
          const key = trackKey(track)
          const color = PALETTE[index % PALETTE.length]
          const selected = shell.selectedTrackId === key
          const telemetry = shell.telemetryOn[key] !== false && track.telemetryOn
          const stalled = stalledHere(track)
          const members = track.group ? membersOf(track) : []
          const slots = track.group
            ? Math.max(1, ...members.map(member => member.tasks.length))
            : track.tasks.length
          const depthRails = Array.from({length: track.depth}, (_, d) => `inset ${3 * (d + 1)}px 0 0 var(--line)`).join(', ')
          return (
            <section
              key={key}
              className="agent-track"
              data-track-key={key}
              style={{
                '--track-color': color,
                marginLeft: track.depth * 8,
                minWidth: Math.max(96, 118 - track.depth * 10),
                boxShadow: depthRails || undefined,
              } as CSSProperties}
            >
              <button
                type="button"
                className={'agent-track-hd' + (selected ? ' sel' : '')}
                style={{background: track.group ? 'var(--bg-3)' : color, color: track.group ? 'var(--text)' : undefined, paddingLeft: 4 + track.depth * 4}}
                data-i={ORACLE.header(track)}
                title={ORACLE.header(track).split('|')[1]}
                onClick={() => shell.setSelectedTrackId(key)}
              >
                {track.group && (
                  <span
                    role="button"
                    tabIndex={0}
                    data-i={ORACLE.groupFold}
                    title="Fold or unfold the crew"
                    style={{cursor: 'pointer', fontSize: 8}}
                    onClick={event => { event.stopPropagation(); setFolded(current => ({...current, [key]: !current[key]})) }}
                  >
                    {folded[key] ? '▶' : '▼'}
                  </span>
                )}
                {track.group && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#21282e" strokeWidth="2.4" aria-hidden>
                    <path d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                )}
                <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {track.purpose ?? (track.group ? track.spaceLabel ?? track.spaceRef : track.agentName ? `${track.agentName} · ${track.sessionRef.slice(0, 10)}` : track.sessionRef.slice(0, 12))}
                </span>
                {track.disclosure && <span className="agent-disclosed" title={track.disclosure}> ⚑</span>}
              </button>
              <div className="track-slots">
                {Array.from({length: slots}, (_, i) => {
                  if (track.group) {
                    const kids = members.map(member => member.tasks[i]).filter((clip): clip is TaskClip => !!clip && !clip.softStop)
                    const kidStalled = kids.some(clip => clip.state === 'stalled')
                    return (
                      <div
                        key={i}
                        className="agent-slot"
                        data-i={kids.length ? ORACLE.groupSlot : undefined}
                        title={kids.length ? ORACLE.groupSlot.split('|')[1] : undefined}
                        style={{gap: 2, background: kidStalled ? 'color-mix(in srgb, var(--stall) 18%, transparent)' : undefined}}
                      >
                        {kids.length
                          ? kids.map((clip, k) => (
                            <i
                              key={k}
                              style={{
                                width: 8,
                                height: 10,
                                display: 'inline-block',
                                background: clip.state === 'stalled' ? 'var(--stall)' : clip.state === 'running' ? color : 'var(--line-strong)',
                                opacity: clip.state === 'running' ? 1 : 0.85,
                              }}
                            />
                          ))
                          : <span className="tag" title="No child task in this row" />}
                      </div>
                    )
                  }
                  const clip = track.tasks[i]
                  if (!clip) return <div key={i} className="agent-slot" />
                  if (clip.softStop) {
                    return (
                      <div
                        key={i}
                        className="agent-slot"
                        data-i={ORACLE.emptySlot}
                        onDoubleClick={() => shell.openThread(key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={event => { if (event.key === 'Enter') shell.openThread(key) }}
                        title={ORACLE.emptySlot.split('|')[1]}
                      >
                        <span className="tag" title="Soft stop after current task">■</span>
                      </div>
                    )
                  }
                  const running = clip.state === 'running'
                  const background = clipBackground(clip)
                  return (
                    <div
                      key={i}
                      className={'agent-slot task' + (clip.state === 'stalled' ? ' stall' : '')}
                      data-i={ORACLE.task(clip.n, clip)}
                      title={(clip.disclosure ?? ORACLE.task(clip.n, clip).split('|')[1])}
                      onDoubleClick={() => shell.openThread(key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={event => { if (event.key === 'Enter') shell.openThread(key) }}
                      style={{
                        background: background ?? color,
                        color: background ? '#1d1f22' : '#252a2d',
                        // Running draws no end: the bar fades out towards the right — no right edge.
                        backgroundImage: running ? `linear-gradient(90deg, ${color} 55%, color-mix(in srgb, ${color} 20%, transparent) 100%)` : undefined,
                        borderRight: running ? 'none' : undefined,
                        opacity: clip.state === 'queued' ? 0.9 : undefined,
                      } as CSSProperties}
                    >
                      <span className="tri" style={clip.state === 'stalled' ? {borderLeftColor: '#5a3a17'} : undefined} />
                      <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {clip.state === 'queued' ? '▸ ' : ''}{clip.n}{clip.title ? ` · ${clip.title}` : ''}
                      </span>
                      <button
                        type="button"
                        className="tag"
                        style={{marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer'}}
                        onClick={event => { event.stopPropagation(); shell.openThread(key) }}
                        title="Open thread"
                      >
                        ↗
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="agent-stoprow">
                <button type="button" title="Hard stop" aria-label="Hard stop" data-i={ORACLE.hardStop(track.group)} onClick={() => onHardStop?.(track)}>
                  <i style={{display: 'block', width: 8, height: 8, background: 'var(--text-dim)'}} />
                </button>
                <button
                  type="button"
                  title="Retry stalled lane"
                  aria-label="Retry"
                  data-i={ORACLE.retry(stalled)}
                  onClick={() => onRetry?.(track)}
                  style={stalled ? {background: 'var(--stall)', color: '#1d1f22'} : undefined}
                >
                  ↻
                </button>
                <button
                  type="button"
                  className={telemetry ? '' : 'off'}
                  style={{marginLeft: 'auto', width: 24, height: 20, background: telemetry ? color : 'var(--bg-0)', color: telemetry ? '#292c31' : 'var(--text-faint)', fontWeight: 500, fontSize: 11}}
                  title={track.group ? 'Telemetry — track activator' : 'Telemetry — context source'}
                  data-i={track.group ? ORACLE.telemetryGroup : ORACLE.telemetrySession}
                  onClick={() => shell.toggleTelemetry(key)}
                >
                  {index}
                </button>
              </div>
              {track.group ? (
                <div style={{display: 'flex', gap: 6, padding: '3px 4px', fontSize: 10, borderTop: '1px solid var(--line)', alignItems: 'center'}}>
                  <span className="agent-disclosed" style={lbStyle}>Lead</span>
                  <span style={ddStyle}>{members.find(member => member.agentName)?.agentName ?? '—'}</span>
                  <span className="agent-disclosed" style={{...lbStyle, marginLeft: 'auto'}} data-i={ORACLE.subagentModel} title={ORACLE.subagentModel.split('|')[1]}>Subagent model</span>
                  <span style={ddStyle}>—</span>
                  <span className="agent-disclosed" style={lbStyle}>Members</span>
                  <span style={ddStyle}>{members.length}</span>
                </div>
              ) : (
                <div style={{display: 'flex', gap: 4, padding: '3px 4px', fontSize: 10, borderTop: '1px solid var(--line)', alignItems: 'center', flexWrap: 'wrap'}}>
                  <span className="agent-disclosed" style={lbStyle}>Agent</span>
                  <span style={ddStyle}>{track.agentName ?? '—'}{track.agentAccepted === false ? ' (not accepted)' : ''}</span>
                  <span className="agent-disclosed" style={{...lbStyle, marginLeft: 'auto'}} data-i={ORACLE.model} title={ORACLE.model.split('|')[1]}>Model</span>
                  <span style={ddStyle} title="Not disclosed by any native source">—</span>
                  <span className="agent-disclosed" style={lbStyle} data-i={ORACLE.watch} title={ORACLE.watch.split('|')[1]}>Watch</span>
                  <span style={{display: 'inline-flex', gap: 2}} role="group" aria-label="Watch">
                    {(['In', 'Auto', 'Off'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        data-i={ORACLE.watch}
                        title={ORACLE.watch.split('|')[1]}
                        onClick={() => setWatch(current => ({...current, [key]: mode}))}
                        style={{
                          fontSize: 9,
                          padding: '0 3px',
                          background: (watch[key] ?? 'Auto') === mode ? 'var(--accent)' : 'var(--bg-0)',
                          color: (watch[key] ?? 'Auto') === mode ? '#21282e' : 'var(--text-dim)',
                          border: '1px solid var(--line)',
                          cursor: 'pointer',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </span>
                  <span style={{display: 'inline-flex', gap: 2, alignItems: 'center'}}>
                    <button
                      type="button"
                      data-i={ORACLE.solo}
                      title={ORACLE.solo.split('|')[1]}
                      onClick={() => setSoloed(current => ({...current, [key]: !current[key]}))}
                      style={{fontSize: 9, padding: '0 4px', background: soloed[key] ? 'var(--accent)' : 'var(--bg-0)', color: soloed[key] ? '#21282e' : 'var(--text-dim)', border: '1px solid var(--line)', cursor: 'pointer'}}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      data-i={ORACLE.arm}
                      title={ORACLE.arm.split('|')[1]}
                      aria-label="Arm"
                      onClick={() => setArmed(current => ({...current, [key]: !current[key]}))}
                      style={{fontSize: 9, padding: '0 4px', background: armed[key] ? 'var(--rec)' : 'var(--bg-0)', color: armed[key] ? '#21282e' : 'var(--text-dim)', border: '1px solid var(--line)', cursor: 'pointer'}}
                    >
                      ●
                    </button>
                  </span>
                  <span
                    data-i={ORACLE.activityBudget}
                    title={track.budget.used === null || track.budget.max === null
                      ? 'Turn budget not disclosed for this session'
                      : `${track.budget.used} of ${track.budget.max} turns used`}
                    style={{display: 'inline-flex', gap: 2, alignItems: 'flex-end', height: 16}}
                  >
                    <i style={{
                      display: 'block',
                      width: 5,
                      height: telemetry ? Math.round(16 * (track.budget.used !== null && track.budget.max ? Math.min(1, track.budget.used / track.budget.max) : 0)) : 0,
                      background: 'var(--accent)',
                    }} />
                    <i style={{display: 'block', width: 5, height: 16, background: 'var(--bg-0)', border: '1px solid var(--line)', position: 'relative'}} />
                  </span>
                </div>
              )}
            </section>
          )
        })}
      </div>
      <section className="agent-track session-main" style={{minWidth: 96}}>
        <div className="agent-track-hd" data-i={ORACLE.main} title={ORACLE.main.split('|')[1]}>Main</div>
        <div className="track-slots">
          {MAIN_ROWS.map(r => (
            <div key={r} className="agent-slot" data-i={ORACLE.row(r)} title={ORACLE.row(r).split('|')[1]} role="button" tabIndex={0}>
              <span className="tri" />
              <span>{r}</span>
            </div>
          ))}
        </div>
        <div className="agent-stoprow">
          <button type="button" title="Stop all" aria-label="Stop all" data-i={AGENT_DATA_I.stop} onClick={() => onHardStop?.(tracks[0])}>
            <i style={{display: 'block', width: 8, height: 8, background: 'var(--text-dim)'}} />
          </button>
          <button type="button" title="Main telemetry" aria-label="Main telemetry" data-i={ORACLE.mainTelemetry} style={{marginLeft: 'auto', width: 24, height: 20, background: 'var(--bg-3)', color: 'var(--text)', fontWeight: 500, fontSize: 11}}>
            M
          </button>
        </div>
        <div className="agent-disclosed" style={{padding: 6}}>Ledger · Approvals (software-factory global rack).</div>
      </section>
    </div>
  )
}
