import {useEffect, useMemo, useState} from 'react'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import {AgentDevicePool} from './AgentDevicePool'
import {useAgentShell} from './AgentShellContext'
import {useWorkspace} from '../shell/workspaceContext'
import {useHarnessBinding} from './useHarnessBinding'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {refusalLine, safeJson} from './RefusalCard'
import './agentShell.css'

const CATEGORIES = [
  {id: 'sess', label: 'Sessions'},
  {id: 'context', label: 'Context'},
  {id: 'agents', label: 'Agents'},
  {id: 'skillsets', label: 'Skillsets'},
  {id: 'git', label: 'Git'},
] as const

const CONTEXT_TILES = [
  {id: 'sessions' as const, name: 'Sessions'},
  {id: 'terminal' as const, name: 'Terminal'},
  {id: 'files' as const, name: 'Files'},
  {id: 'web' as const, name: 'Web'},
  {id: 'graph' as const, name: 'Graph'},
  {id: 'diff' as const, name: 'Diff'},
  {id: 'frames' as const, name: 'Frames'},
  {id: 'ledger' as const, name: 'Ledger'},
  {id: 'approvals' as const, name: 'Approvals'},
  {id: 'agents' as const, name: 'Agents'},
]

/** The right-edge action the results header names (mockup .bhead law). */
const RESULT_HEADER: Record<(typeof CATEGORIES)[number]['id'], string> = {
  sess: 'State',
  context: 'Open',
  agents: 'Seated',
  skillsets: 'Admitted',
  git: 'Seat',
}

export interface BrowserRow {
  readonly key: string
  readonly label: string
  readonly meta: string
}

type KernelOutcome = {result?: string; data?: unknown; document?: unknown} | null | undefined

const isObj = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Skill refs carried by ACCEPTED roster profiles — the ai-kit skillset
 * registry's admitted instances, the same reading the chain's skillset admit
 * light consumes (central.agent-profile-roster/v1). */
function skillRefsOfAcceptedProfiles(data: unknown): string[] {
  if (!isObj(data) || !Array.isArray(data.profiles)) return []
  const refs = new Set<string>()
  for (const entry of data.profiles) {
    if (!isObj(entry) || entry.accepted !== true) continue
    const profile = isObj(entry.profile) ? entry.profile : {}
    if (!Array.isArray(profile.skill_refs)) continue
    for (const ref of profile.skill_refs) if (typeof ref === 'string' && ref) refs.add(ref)
  }
  return [...refs].sort()
}

/** The Skillsets rows derive from their one admitted source: the roster
 * reading's accepted profiles and their skill_refs (the ai-kit skillset
 * registry, as the pool derives from manifests). A refused read renders the
 * refusal by name; nothing admitted renders the honest empty state naming
 * what would supply it. Never a fabricated crowd. */
export function skillsetRowsFromRoster(outcome: KernelOutcome, error: string | null): BrowserRow[] {
  if (error || outcome?.result !== 'agent_definition_reading') {
    const reason = error ?? 'roster reading unavailable'
    return [{
      key: 'skillsets-unadmitted',
      label: `No skillsets admitted through the door yet — the ai-kit skillset registry (accepted roster skill_refs) refused: ${reason}`.slice(0, 240),
      meta: 'ai-kit · refused',
    }]
  }
  const refs = skillRefsOfAcceptedProfiles(outcome.data)
  if (!refs.length) {
    return [{
      key: 'skillsets-empty',
      label: 'No skillsets admitted through the door yet — accepted agent profiles carrying skill_refs would supply them.',
      meta: 'ai-kit',
    }]
  }
  return refs.map(ref => ({key: ref, label: ref, meta: 'skillset'}))
}

/** The Git rows derive from the workcell family's own reading:
 * `workcell_status_read` — the machine's registered workcell state, the same
 * reading the chain's git admit light consumes. A refused reading renders the
 * refusal by name; never a seat literal about the machine this was written
 * on. */
export function gitRowsFromWorkcell(
  seatOutcome: KernelOutcome,
  seatError: string | null,
): BrowserRow[] {
  const seat = seatOutcome?.result === 'workcell_status_reading' && isObj(seatOutcome.data)
    ? seatOutcome.data as {workcell_ref?: unknown}
    : null
  const workcellRef = typeof seat?.workcell_ref === 'string' && seat.workcell_ref ? seat.workcell_ref : null
  if (!workcellRef) {
    const reason = seatError
      ?? (seat ? 'workcell_status_read disclosed no workcell_ref' : 'workcell status unavailable')
    return [{
      key: 'seat-unavailable',
      label: `Git seat unavailable — workcell_status_read (the workcell family's seat reading) answered: ${reason}`.slice(0, 240),
      meta: 'workcell · refused',
    }]
  }
  return [{key: 'seat', label: `Git · ${workcellRef}`, meta: 'workcell'}]
}

export function AgentShellBrowser({rows, error, loading}: {rows: AgencySessionRow[]; error: string | null; loading: boolean}) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('sess')
  const shell = useAgentShell()
  const {transport} = useWorkspace()
  const {binding} = useHarnessBinding(transport)
  const [gateway, setGateway] = useState<{line: string; receipt: string | null; refused: boolean}>({line: 'Reading gateway…', receipt: null, refused: false})
  const [git, setGit] = useState<{line: string; receipt: string | null; refused: boolean}>({line: 'Reading seat…', receipt: null, refused: false})
  const [rosterOutcome, setRosterOutcome] = useState<KernelOutcome>(null)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [seatOutcome, setSeatOutcome] = useState<KernelOutcome>(null)
  const [seatError, setSeatError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) {
          const reason = transport.reason ?? 'Transport unavailable'
          setGateway({line: reason, receipt: null, refused: true})
          setGit({line: 'Workcell unavailable', receipt: null, refused: true})
          setRosterOutcome(null)
          setRosterError(reason)
          setSeatOutcome(null)
          setSeatError(reason)
        }
        return
      }
      const gatewayOp = await kernelOp(transport, {op: 'harness_agent_read', binding})
      if (live) {
        const reading = !gatewayOp.error && gatewayOp.outcome?.result === 'harness_agent_reading' ? gatewayOp.outcome : null
        setGateway(reading
          ? {line: `binding ${reading.binding} answered — receipt holds the document`, receipt: safeJson(reading.document), refused: false}
          : {line: refusalLine(gatewayOp.error, 'Harness gateway reading unavailable'), receipt: gatewayOp.error ? safeJson(gatewayOp.error) : null, refused: true})
      }
      // The Skillsets rows' admitted source: the roster reading the chain's
      // skillset admit light consumes (accepted profiles' skill_refs).
      const roster = await kernelOp(transport, {op: 'agent_definition', project: null, request: {action: 'roster'}})
      if (live) {
        setRosterOutcome(roster.error ? null : roster.outcome)
        setRosterError(roster.error ?? null)
      }
      // The Git rows' admitted source: the workcell family's seat reading.
      const seat = await kernelOp(transport, {op: 'workcell_status_read'})
      if (live) {
        setSeatOutcome(seat.error ? null : seat.outcome)
        setSeatError(seat.error ?? null)
      }
      const gitOp = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      if (live) {
        const doc = gitOp.outcome?.result === 'git_repository_reading' ? gitOp.outcome.document : null
        setGit(doc
          ? {line: 'repository read answered — receipt holds the document', receipt: safeJson(doc), refused: false}
          : {line: refusalLine(gitOp.error, 'git_repository_read unavailable'), receipt: gitOp.error ? safeJson(gitOp.error) : null, refused: true})
      }
    })()
    return () => { live = false }
  }, [transport, binding])

  const list = useMemo(() => {
    if (category === 'sess') return rows.map(row => ({key: `${row.spaceRef}:${row.sessionRef}`, label: row.purpose ?? row.sessionRef, meta: row.agentRef ?? row.spaceLabel ?? ''}))
    if (category === 'context') return CONTEXT_TILES.map(tile => ({key: tile.id, label: tile.name, meta: shell.openTiles.includes(tile.id) ? '● open' : ''}))
    if (category === 'git') return gitRowsFromWorkcell(seatOutcome, seatError)
    if (category === 'skillsets') return skillsetRowsFromRoster(rosterOutcome, rosterError)
    if (category === 'agents') {
      const names = [...new Set(rows.map(row => row.agentRef).filter((value): value is string => !!value))]
      return names.length ? names.map(name => ({key: name, label: name, meta: 'agent'})) : [{key: 'empty-agents', label: loading ? 'Reading…' : 'No agent_ref disclosed yet.', meta: ''}]
    }
    return [{key: 'empty', label: loading ? 'Reading…' : 'Nothing disclosed for this category yet.', meta: ''}]
  }, [category, rows, shell.openTiles, loading, rosterOutcome, rosterError, seatOutcome, seatError])

  return (
    <aside className="agent-shell-browser" data-region="browser">
      <div className="browser-search"><input readOnly placeholder="Search (⌘F)" aria-label="Search browser" /></div>
      <div className="browser-columns">
        <nav className="agent-bcats" aria-label="Browser categories">
          {CATEGORIES.map(cat => (
            <button key={cat.id} type="button" className={'agent-bcat' + (category === cat.id ? ' on' : '')} onClick={() => setCategory(cat.id)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM12 7.5v4.5l3 2.5" /></svg>
              {cat.label}
            </button>
          ))}
        </nav>
        <div className="browser-results">
          <div className="agent-bfilt"><span>○ Filters</span><span>In set</span></div>
          <div className="agent-bhead"><span>Name</span><span>{RESULT_HEADER[category]}</span></div>
          {error && <p className="native-error" role="alert">{error}</p>}
          {list.map(item => (
            <button
              key={item.key}
              type="button"
              className="agent-bitem"
              title={item.label}
              onClick={() => {
                if (category === 'context') shell.toggleTile(item.key as typeof CONTEXT_TILES[number]['id'])
                if (category === 'git') shell.toggleTile('diff')
                if (category === 'sess') {
                  shell.setSelectedTrackId(item.key)
                  shell.openThread(item.key)
                }
              }}
            >
              <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.label}</span>
              <span className="st">{item.meta}</span>
            </button>
          ))}
        </div>
      </div>
      <AgentDevicePool
        gatewayLine={gateway.line}
        gatewayReceipt={gateway.receipt}
        gatewayRefused={gateway.refused}
        gitLine={git.line}
        gitReceipt={git.receipt}
        gitRefused={git.refused}
        effort={shell.effort}
        autonomy={shell.steer ? 'steer' : 'review'}
        budgetUsed={0}
        budgetCap={12}
      />
    </aside>
  )
}
