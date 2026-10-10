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
  lead: 'Lead|The group’s lead session.',
  groupFold: 'Group|Fold or unfold the crew.',
  approvals: 'Approvals|Proposals waiting for you. Read from the Factory receiving owner.',
  stalledLb: 'Stalled|Lanes past the stall horizon, named.',
  ledger: 'Ledger|Every task with its receipt.',
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
/** The mockup's slot count per track: a grid of 8, even when the readings
 * are few. */
const MIN_SLOTS = 8
// The shipped batch-row count (the suite pins the main column to the data's
// shape, not a constant 8; the mockup draws 8, we draw the shipped 4).
const MAIN_ROWS = [1, 2, 3, 4]

/** The mockup's track widths: group 132px; sessions narrow with depth. */
const trackWidth = (track: AgentSessionTrack): number =>
  track.group ? 132 : [124, 118, 110][Math.min(track.depth, 2)]

const trackName = (track: AgentSessionTrack): string =>
  track.purpose ?? (track.group
    ? track.spaceLabel ?? track.spaceRef
    : track.agentName ? `${track.agentName} · ${track.sessionRef.slice(0, 10)}` : track.sessionRef.slice(0, 12))

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
    return (
      <div className="agent-shell-centre" data-region="centre">
        <div className="view-empty">No SessionSpace sessions disclosed by agency_read for O-I.</div>
      </div>
    )
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
  const ancestorsOf = (track: AgentSessionTrack): AgentSessionTrack[] => {
    const out: AgentSessionTrack[] = []
    let ref = track.parentRef
    while (ref) {
      const parent = tracks.find(item => item.group && item.spaceRef === ref)
      if (!parent) break
      out.unshift(parent)
      ref = parent.parentRef
    }
    return out
  }

  const clipSlot = (track: AgentSessionTrack, clip: TaskClip | undefined, key: string) => {
    if (!clip) {
      // A grid filler: the designed empty state — a square, nothing claimed.
      return <div key={key} className="agent-slot"><span className="sg" /></div>
    }
    if (clip.softStop) {
      return (
        <div key={key} className="agent-slot" data-i={ORACLE.emptySlot}
          title={ORACLE.emptySlot.split('|')[1]}
          onDoubleClick={() => shell.openThread(trackKey(track))}
          role="button" tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter') shell.openThread(trackKey(track)) }}
        >
          <span className="sg" />
        </div>
      )
    }
    const stateClass = clip.state === 'running' ? 'run'
      : clip.state === 'stalled' ? 'stall'
      : clip.state === 'queued' ? 'queued'
      : clip.state === 'done' ? 'done' : ''
    return (
      <div
        key={key}
        className={`agent-slot task ${stateClass}`}
        data-i={ORACLE.task(clip.n, clip)}
        title={clip.disclosure ?? ORACLE.task(clip.n, clip).split('|')[1]}
        onDoubleClick={() => shell.openThread(trackKey(track))}
        role="button"
        tabIndex={0}
        onKeyDown={event => { if (event.key === 'Enter') shell.openThread(trackKey(track)) }}
      >
        <span className="tri" />
        <span className="n">{clip.title ?? `task ${clip.n}`}</span>
        <button
          type="button" className="op" data-i={AGENT_DATA_I.openThread}
          onClick={event => { event.stopPropagation(); shell.openThread(trackKey(track)) }}
        >↗</button>
      </div>
    )
  }

  return (
    <div className="agent-shell-centre" data-region="centre">
      <div className="session-scroll" style={{display: 'flex', flexDirection: 'row', alignItems: 'stretch', overflow: 'auto', flex: 1}}>
        {tracks.map((track, index) => {
          if (!visible(track)) return null
          const key = trackKey(track)
          const color = PALETTE[index % PALETTE.length]
          const selected = shell.selectedTrackId === key
          const telemetry = shell.telemetryOn[key] !== false && track.telemetryOn
          const stalled = stalledHere(track)
          const members = track.group ? membersOf(track) : []
          const ancestors = ancestorsOf(track)
          const slots = track.group
            ? Math.max(MIN_SLOTS, ...members.map(member => member.tasks.length))
            : Math.max(MIN_SLOTS, track.tasks.length)
          const watchMode = watch[key] ?? 'Auto'
          const budgetPct = track.budget.used !== null && track.budget.max
            ? Math.min(1, track.budget.used / track.budget.max) : 0
          return (
            <section
              key={key}
              className={`agent-track${track.group ? ' group-track' : ''}`}
              data-track-key={key}
              style={{'--track-color': color, width: trackWidth(track)} as CSSProperties}
            >
              {ancestors.length > 0 && (
                <span className="agent-rails" aria-hidden>
                  {ancestors.map(a => <i key={trackKey(a)} style={{background: PALETTE[tracks.indexOf(a) % PALETTE.length]}} />)}
                </span>
              )}
              <button
                type="button"
                className={'agent-track-hd' + (track.group ? ' group' : '') + (selected ? ' sel' : '')}
                style={{paddingLeft: 4 + ancestors.length * 4}}
                data-i={ORACLE.header(track)}
                title={ORACLE.header(track).split('|')[1]}
                onClick={() => shell.setSelectedTrackId(key)}
              >
                {track.group && (
                  <span
                    role="button" tabIndex={0} className="gf"
                    data-i={ORACLE.groupFold}
                    title="Fold or unfold the crew"
                    onClick={event => { event.stopPropagation(); setFolded(current => ({...current, [key]: !current[key]})) }}
                    onKeyDown={event => { if (event.key === 'Enter') setFolded(current => ({...current, [key]: !current[key]})) }}
                  >
                    {folded[key] ? '▶' : '▼'}
                  </span>
                )}
                {track.group && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--track-ink)" strokeWidth="2.4" aria-hidden>
                    <path d="M3 6h18M3 12h18M3 18h18" />
                  </svg>
                )}
                <span className="nm">{trackName(track)}</span>
                {track.disclosure && <span className="agent-disclosed" title={track.disclosure}> ⚑</span>}
              </button>
              <div className="track-slots" style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                {Array.from({length: slots}, (_, i) => {
                  if (track.group) {
                    const kids = members.map(member => member.tasks[i]).filter((clip): clip is TaskClip => !!clip && !clip.softStop)
                    return (
                      <div
                        key={i}
                        className={`agent-slot${kids.length ? ' grp' : ''}`}
                        data-i={kids.length ? ORACLE.groupSlot : undefined}
                        title={kids.length ? ORACLE.groupSlot.split('|')[1] : undefined}
                      >
                        {kids.length
                          ? kids.map((clip, k) => (
                            <i key={k} className={clip.state === 'stalled' ? 's' : clip.state ? '' : 'e'} />
                          ))
                          : <span className="sg" />}
                      </div>
                    )
                  }
                  return clipSlot(track, track.tasks[i], String(i))
                })}
              </div>
              <div className="agent-stoprow">
                <button type="button" className="hs" title="Hard stop" aria-label="Hard stop" data-i={ORACLE.hardStop(track.group)} onClick={() => onHardStop?.(track)}>
                  <i />
                </button>
                <button
                  type="button"
                  className={'rt' + (stalled ? ' lit' : '')}
                  title="Retry stalled lane"
                  aria-label="Retry"
                  data-i={ORACLE.retry(stalled)}
                  onClick={() => onRetry?.(track)}
                >
                  ↻
                </button>
                <span className="tc" />
              </div>
              {track.group ? (
                <div className="agent-strip">
                  <span className="lb">Lead</span>
                  <div className="agent-dd"><span className="t">{members.find(member => member.agentName)?.agentName ?? '—'}</span></div>
                  <span className="lb" data-i={ORACLE.subagentModel} title={ORACLE.subagentModel.split('|')[1]}>Subagent model</span>
                  <div className="agent-dd"><span className="t">—</span></div>
                  <span className="lb">Members</span>
                  <div className="agent-dd"><span className="t">{members.length}</span></div>
                  <div className="agent-vol">
                    <div className="agent-mc">
                      <button
                        type="button"
                        className={'agent-num' + (telemetry ? '' : ' off')}
                        data-i={ORACLE.telemetryGroup}
                        title="Telemetry — track activator"
                        onClick={() => shell.toggleTelemetry(key)}
                      >
                        {index}
                      </button>
                    </div>
                    <div className="agent-fcol" data-i={ORACLE.activityBudget} title={ORACLE.activityBudget.split('|')[1]}>
                      <div className="agent-rail"><i style={{height: telemetry ? `${Math.round(55)}%` : 0}} /></div>
                      <div className="agent-rail"><span className="agent-cap" style={{bottom: '40%'}} /></div>
                      <div className="agent-scale"><span style={{whiteSpace: 'pre', textAlign: 'right'}}>{'12\n8\n4\n0'}</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="agent-strip">
                  <span className="lb">Agent</span>
                  <div className="agent-dd"><span className="t">{track.agentName ?? '—'}{track.agentAccepted === false ? ' (not accepted)' : ''}</span></div>
                  <span className="lb" data-i={ORACLE.model} title={ORACLE.model.split('|')[1]}>Model</span>
                  <div className="agent-dd" title="Not disclosed by any native source"><span className="t">—</span></div>
                  <span className="lb" data-i={ORACLE.watch} title={ORACLE.watch.split('|')[1]}>Watch</span>
                  <div className="agent-mon" role="group" aria-label="Watch">
                    {(['In', 'Auto', 'Off'] as const).map(mode => (
                      <span
                        key={mode}
                        className={watchMode === mode ? 'on' : ''}
                        data-i={ORACLE.watch}
                        title={ORACLE.watch.split('|')[1]}
                        onClick={() => setWatch(current => ({...current, [key]: mode}))}
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                  <div className="agent-vol">
                    <div className="agent-mc">
                      <button
                        type="button"
                        className={'agent-num' + (telemetry ? '' : ' off')}
                        data-i={ORACLE.telemetrySession}
                        title="Telemetry — context source"
                        onClick={() => shell.toggleTelemetry(key)}
                      >
                        {index}
                      </button>
                      <span className="agent-sbtn" data-i={ORACLE.solo} title={ORACLE.solo.split('|')[1]}
                        onClick={() => setSoloed(current => ({...current, [key]: !current[key]}))}
                        style={soloed[key] ? {background: 'var(--accent)', color: 'var(--accent-ink)'} : undefined}
                      >S</span>
                      <span
                        className={'agent-sbtn arm' + (armed[key] ? ' on' : '')}
                        data-i={ORACLE.arm}
                        title={ORACLE.arm.split('|')[1]}
                        onClick={() => setArmed(current => ({...current, [key]: !current[key]}))}
                      >●</span>
                      <span className="agent-ctxv" title={track.budget.used === null || track.budget.max === null
                        ? 'Turn budget not disclosed for this session'
                        : `${track.budget.used} of ${track.budget.max} turns used`}
                      >
                        {track.budget.used !== null && track.budget.max ? `${Math.round(budgetPct * 100)}%` : '—'}
                      </span>
                    </div>
                    <div className="agent-fcol" data-i={ORACLE.activityBudget} title={ORACLE.activityBudget.split('|')[1]}>
                      <div className="agent-rail"><i style={{height: telemetry ? `${Math.round(budgetPct * 100)}%` : 0}} /></div>
                      <div className="agent-rail"><span className="agent-cap" style={{bottom: `${Math.round(budgetPct * 100)}%`}} /></div>
                      <div className="agent-scale"><span style={{whiteSpace: 'pre', textAlign: 'right'}}>{'12\n8\n4\n0'}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
      <section className="agent-track main" style={{width: 96, minWidth: 96}}>
        <div className="agent-track-hd" style={{background: 'var(--bg-3)', color: 'var(--text)'}} data-i={ORACLE.main} title={ORACLE.main.split('|')[1]}>Main</div>
        <div className="track-slots" style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
          {MAIN_ROWS.map(r => (
            <div key={r} className="agent-slot" data-i={ORACLE.row(r)} title={ORACLE.row(r).split('|')[1]} role="button" tabIndex={0}>
              <span className="tri" style={{borderLeftColor: 'var(--text-faint)'}} />
              <span>{r} ▸</span>
            </div>
          ))}
        </div>
        <div className="agent-stoprow">
          <button type="button" className="hs" title="Stop all" aria-label="Stop all" data-i={AGENT_DATA_I.stop} onClick={() => onHardStop?.(tracks[0])}>
            <i />
          </button>
          <button
            type="button" className="agent-num" style={{marginLeft: 'auto'}}
            data-i={ORACLE.mainTelemetry} title={ORACLE.mainTelemetry.split('|')[1]}
            onClick={() => shell.toggleTelemetry('main')}
          >M</button>
        </div>
        <div className="agent-strip" style={{height: 228}}>
          <span className="lb" data-i={ORACLE.approvals} title={ORACLE.approvals.split('|')[1]}>Approvals</span>
          <div className="agent-dd"><span className="t">no receiving owner in O-I yet</span></div>
          <span className="lb" data-i={ORACLE.stalledLb} title={ORACLE.stalledLb.split('|')[1]}>Stalled</span>
          <div className={'agent-dd' + (tracks.some(t => stalledHere(t)) ? ' warn' : '')}>
            <span className="t">{tracks.filter(t => !t.group && stalledHere(t)).map(trackName).join(', ') || 'none'}</span>
          </div>
          <span className="lb" data-i={ORACLE.ledger} title={ORACLE.ledger.split('|')[1]}>Ledger</span>
          <div className="agent-dd"><span className="t">—</span></div>
          <div className="agent-vol">
            <div className="agent-mc">
              <span className="agent-num" style={{cursor: 'default'}} data-i={ORACLE.mainTelemetry} title={ORACLE.mainTelemetry.split('|')[1]}>M</span>
            </div>
            <div className="agent-fcol">
              <div className="agent-rail"><i style={{height: 0}} /></div>
              <div className="agent-rail"><span className="agent-cap" style={{bottom: '70%'}} /></div>
              <div className="agent-scale"><span style={{whiteSpace: 'pre', textAlign: 'right'}}>{'12\n8\n4\n0'}</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
