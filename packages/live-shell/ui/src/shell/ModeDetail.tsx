/**
 * The per-mode detail compositions and the Technē lens bar — the shell
 * frame's reading of WORLD-SHELL-DESIGN Revision 4's detail table and
 * Revision 3's lens navigation, drawn only from what the landed lanes
 * declared.
 *
 * - Base · Devices: the ground's family chain through the ONE inhabitant
 *   rack (L2's manifest door + L7's bodies) — hygiene, impact, the Day die,
 *   the Flow, the conversation, the day/now civil controls. With no material
 *   selected the rack's own empty slots name what would dock.
 * - Base · Document: the L7 subject detail (CAS identity, basis, the save
 *   router's named outcomes) over the encounter's subject — honest absence
 *   until a subject is selected.
 * - Technē · Instruments: the Quaternal Logic family's faces through the
 *   same rack — the six lenses' instruments, the admitted field/PCM owner's
 *   face with its honest refusing state, the declared-waiting faces with
 *   their named owners and dark lamps.
 * - Technē lens bar: the six lenses by their plain actual names (the
 *   programme's naming ruling) — timeline and journey drive the landed
 *   World cut's two presentations; the other four hold their places as
 *   declared waiting lenses (the instrument bodies are not mounted here).
 *
 * Nothing here invents an owner: every waiting state names its owner, and
 * the rack renders what the manifests declare — no more.
 */

import {useEffect, useState, type ReactNode} from 'react'
import {loadWorldShellFamilies, QUATERNAL_LOGIC_FAMILY_ID} from '../inhabitants/worldShellFamilies'
import {inhabitantManifest, type InhabitantManifest} from '../inhabitants/manifest'
import {InhabitantRack} from '../inhabitants/inhabitantRack'
import {CentralSubjectDetail, type CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {Icon, type IconName} from '../inhabitants/sdk/Icon'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import './modeSurface.css'

// The door is idempotent (a second identical load composes nothing new);
// the shell frame admits the declared families once per module load.
loadWorldShellFamilies()

const centralManifests = (): readonly InhabitantManifest[] => {
  const central = inhabitantManifest('central')
  return central ? [central] : []
}

const qlManifests = (): readonly InhabitantManifest[] => {
  const ql = inhabitantManifest(QUATERNAL_LOGIC_FAMILY_ID)
  return ql ? [ql] : []
}

/** Base · Devices — the ground's family on the chain (Rev 4's table). */
export function BaseDevicesDetail({transport}: {transport: KernelTransportStatus}) {
  return (
    <div className="mode-detail" data-mode-detail="base-devices">
      <InhabitantRack manifests={centralManifests()} transport={transport} />
    </div>
  )
}

/** Base · Document — the selected Central subject's clip-view-grade craft
 * (L7): identity, basis, and the save router's outcomes as honest rows.
 * With no subject selected the designed empty state stands at device
 * density: the document's device chips (the affordance that fills it) and
 * the selection route named — never a bare sentence in a void. */
export function BaseDocumentDetail({transport, subject}: {transport: KernelTransportStatus; subject: CentralSubjectSelection | null}) {
  if (subject) {
    return (
      <div className="mode-detail" data-mode-detail="base-document">
        <CentralSubjectDetail transport={transport} subject={subject} />
      </div>
    )
  }
  const deviceChips = ['Text', 'Highlight', 'Notes', 'Packet', 'Answer', 'Form device (die · participants · bindings)']
  return (
    <div className="mode-detail" data-mode-detail="base-document" data-subject-selected="false">
      <section className="mode-detail-frame" data-detail-empty="document" role="status">
        <header className="mode-detail-frame-head">
          <span className="mode-detail-frame-mark"><Icon name="detail" size={14} /></span>
          <strong>Document</strong>
          <span className="mode-detail-frame-sub">form · file · revision · bindings · highlights · notes · packet</span>
        </header>
        <p className="mode-detail-frame-note">
          No ground material is selected. Select a folder, note or <b>day</b> in the browser's
          <b> Files</b> or <b>Days</b> categories — the document's craft opens here: CAS identity,
          basis, and the save router's five named outcomes.
        </p>
        <ul className="mode-detail-chips" aria-label="The document devices that dock here">
          {deviceChips.map(chip => (
            <li key={chip} className="mode-detail-chip" data-i={`${chip} device|docks on the Device side when a document is selected`}>{chip}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Technē · Instruments — the six lenses' instruments (Rev 4's table): the
 * admitted field/PCM owner's face reads its owner; the declared faces wait,
 * named. */
export function TechneInstrumentsDetail({transport, instrumentReading}: {transport: KernelTransportStatus; instrumentReading?: unknown}) {
  return (
    <div className="mode-detail" data-mode-detail="techne-instruments">
      <InhabitantRack manifests={qlManifests()} transport={transport} instrumentReading={instrumentReading} />
    </div>
  )
}

/** Factory · Task log — the selected task's tool-run log (Rev 4's table),
 * drawn at device density: the task's identity rows from the agency
 * surface's own track reading, and the log column honestly declaring the
 * read it waits for (the Factory owner's task-log read — no fabricated run
 * rows). The agent chain (the detail's other side) is live. */
export function FactoryTaskLogDetail({taskLabel, task}: {
  taskLabel: string | null
  task?: {
    sessionRef: string
    purpose: string | null
    agentName: string | null
    needleState: string | null
    tasks?: readonly unknown[]
    budget?: { used: number | null; max: number | null }
  } | null
}) {
  const rows: {op: string; value: string | null; hint: string}[] = [
    {op: 'session', value: task?.sessionRef ?? null, hint: 'the selected session (the agency surface\'s own reading)'},
    {op: 'agent', value: task?.agentName ?? null, hint: 'the agent seated on the task'},
    {op: 'status', value: task?.needleState ?? null, hint: 'the thread needle\'s state — live · stalled · idle'},
    {op: 'attempt', value: null, hint: 'attempts come from the Factory owner (op factory_attempt_read) — declared, waiting here'},
    {op: 'workcell', value: null, hint: 'where the work runs (op workcell_status_read) — declared, waiting here'},
    {op: 'budget', value: null, hint: 'turns used / allowed — the track strip and the agent chain carry the live budget reading'},
  ]
  return (
    <div className="mode-detail" data-mode-detail="factory-task-log" role="status">
      <section className="mode-detail-frame" data-detail="task-log">
        <header className="mode-detail-frame-head">
          <span className="mode-detail-frame-mark"><Icon name="session" size={14} /></span>
          <strong>Task log{taskLabel ? ` · ${taskLabel}` : ''}</strong>
          <span className="mode-detail-frame-sub">the selected task's tool-run log</span>
        </header>
        <div className="mode-detail-tasklog">
          <ul className="mode-detail-rows" aria-label="Task identity">
            {rows.map(row => (
              <li key={row.op} className="mode-detail-row" title={row.hint} data-i={`${row.op}|${row.hint}`}>
                <span className="mode-detail-row-op">{row.op}</span>
                <span className={`mode-detail-row-value${row.value ? '' : ' is-waiting'}`}>{row.value ?? 'declared, waiting'}</span>
              </li>
            ))}
          </ul>
          <div className="mode-detail-tasklog-log" aria-label="Tool-run log">
            <p className="mode-detail-frame-note">
              The thread's tool rows are the log's material. The log leg waits for the Factory
              owner's task-log read; the <b>agent chain</b> (the detail's other side) is live now.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Technē · Clip — the focused encounter's clip craft (Rev 4's table):
 * identity, place and time, disclosure, typed relations, bounded
 * constellation, source — honest rows over the one temporal reading's
 * retained occasion, each waiting row naming its owner. */
export function TechneClipDetail({world}: {world: WorldTimelineView | null}) {
  const [, setTick] = useState(0)
  useEffect(() => world?.spine.subscribe(() => setTick(value => value + 1)), [world])
  const occasion = world?.spine.occasion() ?? null
  const standing = occasion?.admission ?? null
  const rows: {op: string; value: ReactNode; hint: string}[] = [
    {
      op: 'identity',
      value: occasion
        ? <span title={occasion.basis.ref}>{occasion.basis.summary?.slice(0, 72) ?? occasion.basis.ref}</span>
        : <span className="is-waiting">no occasion retained</span>,
      hint: occasion ? 'the retained occasion\'s subject ref — identity preserved across readings' : 'select an event in the Relation Field or the Journey — its occasion retains here',
    },
    {
      op: 'place · time',
      value: occasion?.basis.instantUnixMs != null
        ? new Date(occasion.basis.instantUnixMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
        : <span className="is-waiting">the occasion carries no civil instant</span>,
      hint: 'the occasion\'s placed time — a retained occasion keeps its snapshot; current admission qualifies separately',
    },
    {
      op: 'disclosure',
      value: standing
        ? <span data-admission={standing.admitted ? 'admitted' : 'refused'}>{standing.admitted ? 'admitted' : 'no longer in the reading'} — {standing.disclosure}</span>
        : <span className="is-waiting">admission not yet qualified</span>,
      hint: 'current admission: the occasion\'s standing against the newest reading',
    },
    {
      op: 'typed relations',
      value: <span className="is-waiting">the graph owner's reading — declared, waiting</span>,
      hint: 'typed relations bind through the graph owner; the clip invents no edges',
    },
    {
      op: 'constellation',
      value: <span className="is-waiting">the bounded local whole — the constellation owner's</span>,
      hint: 'the bounded constellation of the subject, as the constellation module lands',
    },
    {
      op: 'source',
      value: <span className="is-waiting">the source leg — evidence-grounded opening, declared</span>,
      hint: 'event → source at its anchor; the source leg opens with the evidence route',
    },
  ]
  return (
    <div className="mode-detail" data-mode-detail="techne-clip">
      <section className="mode-detail-frame" data-detail="techne-clip">
        <header className="mode-detail-frame-head">
          <span className="mode-detail-frame-mark"><Icon name="trav" size={14} /></span>
          <strong>Clip</strong>
          <span className="mode-detail-frame-sub">identity · place and time · disclosure · typed relations · constellation · source</span>
        </header>
        <ul className="mode-detail-rows" aria-label="Clip craft">
          {rows.map(row => (
            <li key={row.op} className="mode-detail-row" title={row.hint} data-i={`${row.op}|${row.hint}`}>
              <span className="mode-detail-row-op">{row.op}</span>
              <span className="mode-detail-row-value">{row.value}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ————————————————————————————————————————————————————————————————————————
// The Technē lens bar (Revision 3: lens navigation is its own axis — never
// the transport's, never the surf's).

/** The six lenses by their plain actual names, with the declared mark each
 * would wear. `cut` lenses drive the landed World cut; `waiting` lenses hold
 * their places and name their owners. */
const LENSES = [
  {id: 'project-graph', name: 'Project / graph', mark: 'lib', state: 'waiting', owner: 'the graph owner (the constellation module)'},
  {id: 'canvas', name: 'Canvas', mark: 'pane', state: 'waiting', owner: 'the canvas owner (the instrument-editors packet)'},
  {id: 'timeline', name: 'Timeline', mark: 'arrangement', state: 'cut', presentation: 'arrangement' as const, owner: 'the World cut — M2′ Relation Field'},
  {id: 'journey', name: 'Journey', mark: 'journey', state: 'cut', presentation: 'session' as const, owner: 'the World cut — M3′ Journey'},
  {id: 'places', name: 'Places', mark: 'placed', state: 'waiting', owner: 'the Places owner (the Atlas port)'},
  {id: 'palace', name: 'Palace', mark: 'palace', state: 'waiting', owner: 'the Palace owner (the integral composition)'},
] as const

export function TechneLensBar({presentation, onLens}: {
  presentation: 'session' | 'arrangement'
  onLens: (lens: (typeof LENSES)[number]) => void
}) {
  const focused = LENSES.find(lens => lens.state === 'cut' && lens.presentation === presentation)
  return <nav className="techne-lens-bar" data-lens={focused?.id ?? null} aria-label="Technē lenses">
    <span className="techne-lens-title">Lenses</span>
    {LENSES.map(lens => (
      <button key={lens.id} type="button" className="techne-lens" data-lens-state={lens.state}
        aria-pressed={lens.state === 'cut' && lens.presentation === presentation}
        disabled={lens.state !== 'cut'}
        title={lens.state === 'cut'
          ? `${lens.name} — ${lens.owner}`
          : `${lens.name} (planned) — the button holds its place; ${lens.owner} is still to be mounted here`}
        onClick={() => onLens(lens)}>
        <Icon name={lens.mark as IconName} size={13} />
        <span>{lens.name}</span>
      </button>
    ))}
  </nav>
}

/** The World cut's honest status line — one reading, for the mode
 * transports (Base/Technē position slot): the civil Now the kernel's own
 * read derived, never the wall clock. */
export function worldNowReadout(world: WorldTimelineView | null): {value: string; title: string} {
  const source = world?.source
  if (!source || source.status === 'unavailable') {
    return {value: '—', title: source?.error ? `The civil field read refused: ${source.error}` : 'No civil-field reading stands — the Now slot stays empty rather than show the wall clock'}
  }
  if (source.status === 'reading') return {value: '…', title: 'Reading the civil field (the kernel\'s temporal read)'}
  const now = source.now
  const label = now ? new Date(now.instantUnixMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) + (now.dayRef ? '' : '') : null
  return {
    value: label ?? '—',
    title: now ? `Now — derived from the kernel's own temporal read (${now.source}${now.dayRef ? ` · ${now.dayRef}` : ''})` : 'The reading stands but carries no civil instant',
  }
}
