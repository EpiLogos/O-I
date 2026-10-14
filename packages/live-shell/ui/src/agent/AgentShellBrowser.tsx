import {useEffect, useMemo, useState, type DragEvent} from 'react'
import {createPortal} from 'react-dom'
import type {BrowserCategory, BrowserKind, ControlledBrowser} from '../frame/browser/browserKinds'
import {InstrumentsSection} from '../frame/InstrumentsSection'
import {SetsSection} from '../shell/SetsSection'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import {AgentDevicePool} from './AgentDevicePool'
import {useAgentShell} from './AgentShellContext'
import {useWorkspace} from '../shell/workspaceContext'
import {useHarnessBinding} from './useHarnessBinding'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {refusalLine, safeJson} from './RefusalCard'
import {AGENT_CHAIN_MIME, encodeChainDrag, setActiveChainDrag, type AgentChainDrag} from './agentChainDrag'
import {missingOpRemedy, OWNER_BINDINGS, ownerRefusalLine} from './agentChainDrag'
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

/** Each Factory category's kind in the one browser (F6): sessions and agents are running things (an agent dragged onto an
 * empty track is seated); the context tiles open in a pane; skillsets go on the agent chain; the git seat is material. */
const AGENT_KINDS: Record<(typeof CATEGORIES)[number]['id'], BrowserKind> = {sess: 'running', agents: 'running', context: 'instruments', skillsets: 'devices', git: 'material'}
export const AGENT_BROWSER_CATEGORIES: readonly BrowserCategory[] = CATEGORIES.map(category => ({id: category.id, label: category.label, kind: AGENT_KINDS[category.id]}))

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
  /** Set when the row is a real disclosed item and may start a chain drag.
   * Refusal and empty rows never carry one — nothing to drop. */
  readonly drag?: AgentChainDrag
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
      // The refused reading is Central's roster Action, not the AIKit rack:
      // the refusal names the owner that actually answered.
      label: `No skillsets admitted through the door yet — ${ownerRefusalLine('roster', reason)}`.slice(0, 240),
      meta: 'central · refused',
    }]
  }
  const refs = skillRefsOfAcceptedProfiles(outcome.data)
  if (!refs.length) {
    return [{
      key: 'skillsets-empty',
      label: `No skillsets admitted through the door yet — accepted agent profiles carrying skill_refs would supply them; waiting on ${OWNER_BINDINGS.skillset.owner}: ${missingOpRemedy('skillset')}.`.slice(0, 240),
      meta: 'ai-kit · waiting',
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
  if (workcellRef) return [{key: 'seat', label: `Git · ${workcellRef}`, meta: 'workcell'}]
  // Refused only when the owner's read errored. A reading that answered
  // without a ref is disclosed as answered, never as a refusal.
  if (seatError) {
    return [{
      key: 'seat-unavailable',
      label: `Git seat unavailable — ${ownerRefusalLine('workcell', seatError)} (the workcell family's seat reading)`.slice(0, 240),
      meta: 'workcell · refused',
    }]
  }
  if (seat) {
    return [{
      key: 'seat-no-ref',
      label: `Git seat answered — workcell_status_read disclosed no workcell_ref (the workcell family's seat reading)`.slice(0, 240),
      meta: 'workcell · no ref',
    }]
  }
  return [{
    key: 'seat-unread',
    label: `Git seat not read — workcell_status_read gave no seat reading (the workcell family's seat reading)`.slice(0, 240),
    meta: 'workcell · unread',
  }]
}

export function AgentShellBrowser({rows, error, loading, controlled}: {rows: AgencySessionRow[]; error: string | null; loading: boolean; controlled?: ControlledBrowser}) {
  const [ownCategory, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('sess')
  // Held by the one browser (F6), the category and the search are its.
  const category = (controlled?.category as (typeof CATEGORIES)[number]['id'] | undefined) ?? ownCategory
  const needle = controlled?.query.trim().toLowerCase() ?? ''
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
          setGateway({line: ownerRefusalLine('gateway', reason, 'not-reached'), receipt: null, refused: true})
          setGit({line: ownerRefusalLine('workcell', reason, 'not-reached'), receipt: null, refused: true})
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
          : {line: ownerRefusalLine('gateway', refusalLine(gatewayOp.error, 'Harness gateway reading unavailable')), receipt: gatewayOp.error ? safeJson(gatewayOp.error) : null, refused: true})
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

  // Rows that carry a drag payload are exactly the rows a real owner reading
  // disclosed: sessions (the track key), agents (the roster/session ref),
  // skillsets (the accepted skill refs), git (the workcell seat). Refusal and
  // empty rows drag nothing — nothing to drop.
  const list = useMemo((): BrowserRow[] => {
    if (category === 'sess') return rows.map(row => ({
      key: `${row.spaceRef}:${row.sessionRef}`,
      label: row.purpose ?? row.sessionRef,
      meta: row.agentRef ?? row.spaceLabel ?? '',
      drag: {family: 'session' as const, ref: `${row.spaceRef}:${row.sessionRef}`, label: row.purpose ?? row.sessionRef},
    }))
    if (category === 'context') return CONTEXT_TILES.map((tile): BrowserRow => ({key: tile.id, label: tile.name, meta: shell.openTiles.includes(tile.id) ? '● open' : ''}))
    if (category === 'git') {
      const seat = seatOutcome?.result === 'workcell_status_reading' && isObj(seatOutcome.data)
        ? seatOutcome.data as {workcell_ref?: unknown} : null
      const workcellRef = typeof seat?.workcell_ref === 'string' && seat.workcell_ref ? seat.workcell_ref : null
      return gitRowsFromWorkcell(seatOutcome, seatError).map(row => row.key === 'seat' && workcellRef
        ? {...row, drag: {family: 'git' as const, ref: workcellRef, label: row.label}}
        : row)
    }
    if (category === 'skillsets') {
      const answered = rosterOutcome?.result === 'agent_definition_reading'
      return skillsetRowsFromRoster(rosterOutcome, rosterError).map(row =>
        answered && row.meta === 'skillset'
          ? {...row, drag: {family: 'skillset' as const, ref: row.key, label: row.label}}
          : row)
    }
    if (category === 'agents') {
      const names = [...new Set(rows.map(row => row.agentRef).filter((value): value is string => !!value))]
      return names.length ? names.map((name): BrowserRow => ({key: name, label: name, meta: 'agent', drag: {family: 'agent' as const, ref: name, label: name}})) : [{key: 'empty-agents', label: loading ? 'Reading…' : 'No agent_ref disclosed yet.', meta: ''}]
    }
    return [{key: 'empty', label: loading ? 'Reading…' : 'Nothing disclosed for this category yet.', meta: ''}]
  }, [category, rows, shell.openTiles, loading, rosterOutcome, rosterError, seatOutcome, seatError])

  // The pool's skillset rows read the same roster the Skillsets rows do —
  // admitted when accepted profiles carry skill refs, else waiting on the
  // owner of whichever reading left them dark (Central refused; AIKit empty).
  const skillAdmission = useMemo(() => {
    if (!rosterOutcome && !rosterError) return {count: null, note: null, waiting: null}
    const rows = skillsetRowsFromRoster(rosterOutcome, rosterError)
    const count = rows.filter(row => row.meta === 'skillset').length
    if (count > 0) return {count, note: `${count} skill ref${count === 1 ? '' : 's'} on accepted roster profiles.`, waiting: null}
    const refused = rows[0]?.key === 'skillsets-unadmitted'
    return {
      count: 0,
      note: rows[0]?.label ?? null,
      waiting: refused ? OWNER_BINDINGS.roster.owner : OWNER_BINDINGS.skillset.owner,
    }
  }, [rosterOutcome, rosterError])

  const shown = needle ? list.filter(item => item.label.toLowerCase().includes(needle) || item.meta.toLowerCase().includes(needle)) : list
  const results = <>
          <div className="agent-bfilt"><span>○ Filters</span><span>In set</span></div>
          <div className="agent-bhead"><span>Name</span><span>{RESULT_HEADER[category]}</span></div>
          {error && <p className="native-error" role="alert">{error}</p>}
          {shown.map(item => (
            <button
              key={item.key}
              type="button"
              className="agent-bitem"
              title={item.label}
              draggable={!!item.drag}
              aria-describedby={item.drag ? `chain-drag-hint-${category}` : undefined}
              onDragStart={item.drag ? (event: DragEvent<HTMLElement>) => {
                // The row's own card is the drag image (the browser's native
                // element snapshot) — never a substitute chip. The payload is
                // typed bytes; the gesture-held copy lives in the model.
                event.dataTransfer.effectAllowed = 'copy'
                event.dataTransfer.setData(AGENT_CHAIN_MIME, encodeChainDrag(item.drag!))
                event.dataTransfer.setData('text/plain', item.drag!.label)
                setActiveChainDrag({kind: 'chain-item', drag: item.drag!})
              } : undefined}
              onDragEnd={item.drag ? () => setActiveChainDrag(null) : undefined}
              onClick={() => {
                if (category === 'context') shell.toggleTile(item.key as typeof CONTEXT_TILES[number]['id'])
                if (category === 'git') shell.toggleTile('diff')
                if (category === 'sess') {
                  shell.setSelectedTrackId(item.key, item.label)
                  shell.openThread(item.key)
                }
              }}
            >
              <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.label}</span>
              <span className="st">{item.meta}</span>
            </button>
          ))}
          <p id={`chain-drag-hint-${category}`} hidden>Drag onto the device chain: through → who → how → where → lands.</p>
  </>
  const pool = (
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
        skillsAdmitted={skillAdmission.count}
        skillsNote={skillAdmission.note}
        skillsWaitingOn={skillAdmission.waiting}
      />
  )
  if (controlled) return <div className="agent-browser-body">{results}{controlled.poolHost && createPortal(pool, controlled.poolHost)}</div>
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
          {results}
        </div>
      </div>
      {pool}
      <InstrumentsSection /><SetsSection />
    </aside>
  )
}
