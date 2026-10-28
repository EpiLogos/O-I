import {useMemo, useState, type DragEvent, type ReactNode} from 'react'
import {Icon as CutIcon} from '../inhabitants/sdk/Icon'
import {KindMark, WoodMark} from '../inhabitants/sdk/marks.tsx'
import type {BrowserCategory, BrowserKind, ControlledBrowser} from '../frame/browser/browserKinds'
import {InstrumentsSection} from '../frame/InstrumentsSection'
import type {AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import {useAgentShell} from './AgentShellContext'
import {useAgentSessionsOptional, type AgentSessionsValue} from './AgentSessionsProvider'
import {agentState, sessionState, type SessionWord} from '../frame/browser/rowWords'
import {useWorkspace} from '../shell/workspaceContext'
import {useRosterAnswer, useWorkcellAnswer} from '../owners/readers'
import {AGENT_CHAIN_MIME, encodeChainDrag, setActiveChainDrag, type AgentChainDrag} from './agentChainDrag'
import {missingOpRemedy, OWNER_BINDINGS, ownerRefusalLine} from './agentChainDrag'
import {FactoryChatsRows} from './FactoryChatsRows'
import './agentShell.css'

const CATEGORIES = [
  {id: 'sess', label: 'Sessions'},
  {id: 'context', label: 'Context'},
  {id: 'agents', label: 'Agents'},
  {id: 'skillsets', label: 'Skillsets'},
  {id: 'git', label: 'Git'},
  {id: 'projects', label: 'Projects'},
] as const
// No Runs category (ticket 788): the Run and the Runs it listed were retired as devices (tickets 725 and 772), and no chain publishes
// them. A session's course is its track in Arrangement view and its attempts are the track's take lanes, the take that stands on the main
// lane (DLW §19.1 "Takes and Arrangement lanes"; timeline/factoryTrackAdapter.ts, agent/factoryTakes.ts).

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
 * empty track is seated); the context tiles open in a pane; skillsets go on the agent chain; the git seat is material; the
 * projects' chats (agent/FactoryChatsRows.tsx, DLW §19.1) are material to pick up again — dragged onto an empty track or the rail,
 * double-clicked for the thread — not things already running. */
const AGENT_KINDS: Record<(typeof CATEGORIES)[number]['id'], BrowserKind> = {sess: 'running', agents: 'running', context: 'instruments', skillsets: 'devices', git: 'material', projects: 'material'}
/** Each category's mark from the icon cut (the agents wear the cut's agent kind). */
const AGENT_MARKS: Record<(typeof CATEGORIES)[number]['id'], ReactNode> = {
  sess: <CutIcon name="session" size={12} />, context: <CutIcon name="pane" size={12} />, agents: <KindMark kind="agent" size={12} />,
  skillsets: <CutIcon name="chain" size={12} />, git: <CutIcon name="lib" size={12} />,
  projects: <KindMark kind="world" size={12} />,
}
export const AGENT_BROWSER_CATEGORIES: readonly BrowserCategory[] = CATEGORIES.map(category => ({id: category.id, label: category.label, kind: AGENT_KINDS[category.id], mark: AGENT_MARKS[category.id]}))

/** Each category's row mark, from the cut (the mockup's bee for sessions and agents is the cut's agent kind). */
const ROW_MARKS: Record<(typeof CATEGORIES)[number]['id'], ReactNode> = {
  sess: <KindMark kind="agent" size={12} />, agents: <KindMark kind="agent" size={12} />, context: <CutIcon name="pane" size={12} />,
  skillsets: <WoodMark kind="skillset" size={12} />, git: <CutIcon name="lib" size={12} />,
  projects: <KindMark kind="world" size={12} />,
}

/** A skillset or git row's standing, by the row its reading gave (skillsetRowsFromRoster, gitRowsFromWorkcell): what was admitted
 * or seated, or how the reading failed — the row's label carries the owner's words. */
const READING_STANDING: Readonly<Record<string, string>> = {
  'skillsets-unadmitted': 'refused', 'skillsets-empty': 'waiting',
  seat: 'seat', 'seat-unavailable': 'refused', 'seat-no-ref': 'no ref', 'seat-unread': 'unread',
}

/** The right-edge action the results header names (mockup .bhead law). */
const RESULT_HEADER: Record<(typeof CATEGORIES)[number]['id'], string> = {
  sess: 'State',
  context: 'Open',
  agents: 'State',
  skillsets: 'Admitted',
  git: 'Seat',
  projects: 'State',
}

export interface BrowserRow {
  readonly key: string
  readonly label: string
  readonly meta: string
  /** The row's standing in words (the mockup's .st: running / done / stalled, working / idle, open, admitted …) where it is not
   * the meta itself; '—' when no reading discloses one. */
  readonly standing?: string
  /** The row's hover words (refs, the space, what the standing was read from). */
  readonly hover?: string
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

/** What the Sessions and Agents rows read of the one agent-sessions provider (AgentSessionsProvider): each session's track (its
 * task clips from encounter_task_read, its needle from the temporal read), the roster's names, and whether the temporal read
 * answered. Null where no provider is mounted: the rows then disclose no state. */
export type SessionsReading = Pick<AgentSessionsValue, 'tracks' | 'roster' | 'temporalError'> | null

/** Each session's state word by its ref (rowWords.ts sessionState); a needle says nothing when the temporal read refused. */
function sessionStates(sessions: SessionsReading): ReadonlyMap<string, SessionWord | null> {
  const states = new Map<string, SessionWord | null>()
  const needleKnown = !sessions?.temporalError
  for (const track of sessions?.tracks ?? []) if (!track.group) states.set(track.sessionRef, sessionState(track, needleKnown))
  return states
}

/** The Sessions rows (the mockup's `SESS` rows, renderBrowser() :1492): the agent's mark, the session by its purpose (the name
 * its track wears on the grid), else its agent's roster name or its space's label; its state — running, stalled, done, queued,
 * idle — from its own readings, '—' when none discloses one. */
export function sessionBrowserRows(rows: readonly AgencySessionRow[], sessions: SessionsReading): BrowserRow[] {
  const states = sessionStates(sessions)
  return rows.map(row => {
    const state = states.get(row.sessionRef) ?? null
    const agent = row.agentRef ? sessions?.roster.get(row.agentRef)?.name ?? null : null
    const label = row.purpose ?? agent ?? row.spaceLabel ?? row.sessionRef
    return {
      key: `${row.spaceRef}:${row.sessionRef}`,
      label,
      meta: row.agentRef ?? row.spaceLabel ?? '',
      standing: state ?? '—',
      hover: [label, row.spaceLabel && row.spaceLabel !== label ? `in ${row.spaceLabel}` : null, agent ? `agent ${agent}` : row.agentRef ? `agent ${row.agentRef}` : null,
        state ? `${state}, from the session's task reads and its needle` : 'no reading discloses its state', row.sessionRef].filter(Boolean).join(' · '),
      drag: {family: 'session' as const, ref: `${row.spaceRef}:${row.sessionRef}`, label: row.purpose ?? row.sessionRef},
    }
  })
}

/** The Agents rows (the mockup's agents, renderBrowser() :1493): the agent's mark, its roster name (else its ref), and its state
 * over its own sessions — working, stalled, idle — '—' when none of them discloses one. */
export function agentBrowserRows(rows: readonly AgencySessionRow[], sessions: SessionsReading, loading: boolean): BrowserRow[] {
  const states = sessionStates(sessions)
  const refs = [...new Set(rows.map(row => row.agentRef).filter((value): value is string => !!value))]
  if (!refs.length) return [{key: 'empty-agents', label: loading ? 'Reading…' : 'No agent_ref disclosed yet.', meta: '', standing: ''}]
  return refs.map((ref): BrowserRow => {
    const name = sessions?.roster.get(ref)?.name ?? ref
    const state = agentState(rows.filter(row => row.agentRef === ref).map(row => states.get(row.sessionRef) ?? null))
    return {key: ref, label: name, meta: 'agent', standing: state ?? '—',
      hover: `${name}${name !== ref ? ` (${ref})` : ''} · ${state ? `${state}, over its sessions' states` : 'no reading discloses its sessions\' states'}`,
      drag: {family: 'agent' as const, ref, label: name}}
  })
}

export function AgentShellBrowser({rows, error, loading, controlled}: {rows: AgencySessionRow[]; error: string | null; loading: boolean; controlled?: ControlledBrowser}) {
  const [ownCategory, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('sess')
  // Held by the one browser (F6), the category and the search are its.
  const category = (controlled?.category as (typeof CATEGORIES)[number]['id'] | undefined) ?? ownCategory
  const needle = controlled?.query.trim().toLowerCase() ?? ''
  const shell = useAgentShell()
  // The sessions' states and the agents' names, from the one agent-sessions provider (its task reads, its needles, its roster).
  const sessions = useAgentSessionsOptional()
  const {transport} = useWorkspace()
  // The gateway is not read here: the Gateway on the chain reads harness_agent_read itself (devices/useAgentChainReading.ts). The
  // Git seat's settings and its Land are the landing device's (workcell:git-seat), whole in its band above the chain (W1).
  // The roster and the seat are the window's shared answers (owners/readers.ts): the same ones the Factory chain, the sessions
  // provider and the Central devices read — one owner read between them, a refusal remembered for its epoch.
  const rosterAnswer = useRosterAnswer(transport, null).reading
  const seatAnswer = useWorkcellAnswer(transport).reading
  const unreached = transport.kind === 'unavailable' ? transport.reason ?? 'Transport unavailable' : null
  const rosterOutcome = useMemo<KernelOutcome>(() => rosterAnswer.status === 'answered' ? {result: 'agent_definition_reading', data: rosterAnswer.value} : null, [rosterAnswer])
  const rosterError = unreached ?? (rosterAnswer.status === 'refused' ? rosterAnswer.error : null)
  const seatOutcome = useMemo<KernelOutcome>(() => seatAnswer.status === 'answered' ? {result: 'workcell_status_reading', data: seatAnswer.value} : null, [seatAnswer])
  const seatError = unreached ?? (seatAnswer.status === 'refused' ? seatAnswer.error : null)


  // Rows that carry a drag payload are exactly the rows a real owner reading
  // disclosed: sessions (the track key), agents (the roster/session ref),
  // skillsets (the accepted skill refs), git (the workcell seat). Refusal and
  // empty rows drag nothing — nothing to drop.
  const list = useMemo((): BrowserRow[] => {
    if (category === 'sess') return sessionBrowserRows(rows, sessions)
    if (category === 'context') return CONTEXT_TILES.map((tile): BrowserRow => ({key: tile.id, label: tile.name, meta: shell.openTiles.includes(tile.id) ? '● open' : '', standing: shell.openTiles.includes(tile.id) ? 'open' : ''}))
    if (category === 'git') {
      const seat = seatOutcome?.result === 'workcell_status_reading' && isObj(seatOutcome.data)
        ? seatOutcome.data as {workcell_ref?: unknown} : null
      const workcellRef = typeof seat?.workcell_ref === 'string' && seat.workcell_ref ? seat.workcell_ref : null
      return gitRowsFromWorkcell(seatOutcome, seatError).map(row => ({...row, standing: READING_STANDING[row.key] ?? row.meta})).map(row => row.key === 'seat' && workcellRef
        ? {...row, drag: {family: 'git' as const, ref: workcellRef, label: row.label}}
        : row)
    }
    if (category === 'skillsets') {
      const answered = rosterOutcome?.result === 'agent_definition_reading'
      return skillsetRowsFromRoster(rosterOutcome, rosterError).map(row =>
        answered && row.meta === 'skillset'
          ? {...row, standing: 'admitted', drag: {family: 'skillset' as const, ref: row.key, label: row.label}}
          : {...row, standing: READING_STANDING[row.key] ?? row.meta})
    }
    if (category === 'agents') return agentBrowserRows(rows, sessions, loading)
    return [{key: 'empty', label: loading ? 'Reading…' : 'Nothing disclosed for this category yet.', meta: '', standing: ''}]
  }, [category, rows, shell.openTiles, loading, rosterOutcome, rosterError, seatOutcome, seatError, sessions])

  const shown = needle ? list.filter(item => item.label.toLowerCase().includes(needle) || item.meta.toLowerCase().includes(needle)) : list
  const results = <>
          <div className="agent-bhead"><span>Name</span><span>{RESULT_HEADER[category]}</span></div>
          {error && <p className="native-error" role="alert">{error}</p>}
          {shown.map(item => (
            <button
              key={item.key}
              type="button"
              className="agent-bitem"
              aria-current={category === 'sess' && shell.selectedTrackId === item.key ? 'true' : undefined}
              title={item.hover ?? item.label}
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
              {item.key.startsWith('empty') ? null : <span aria-hidden="true">{ROW_MARKS[category]}</span>}
              <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.label}</span>
              <span className="st">{item.standing ?? item.meta}</span>
            </button>
          ))}
          <p id={`chain-drag-hint-${category}`} hidden>Drag onto the device chain: through → who → how → where → lands.</p>
  </>
  // The Projects category draws its own rows (agent/FactoryChatsRows.tsx): the owner's projects, each opened to read its chats.
  const body = category === 'projects' ? <FactoryChatsRows needle={needle} /> : results
  if (controlled) return <div className="agent-browser-body">{body}</div>
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
          {body}
        </div>
      </div>
      <InstrumentsSection />
    </aside>
  )
}
