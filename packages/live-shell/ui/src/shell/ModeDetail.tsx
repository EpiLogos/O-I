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
import {useAtlasView, type AtlasView} from '../projections/atlas/AtlasProjectionPanel'
import {ChevronFold, PopOut} from '../inhabitants/sdk/marks.tsx'
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
 * density: the document's device chain drawn as the guide's §3.7 cards —
 * power lamp dark (no illuminated lie), name, owner, fold/pop marks, the
 * honest reason line — and the selection route named. Never a bare
 * sentence in a void. */
export function BaseDocumentDetail({transport, subject}: {transport: KernelTransportStatus; subject: CentralSubjectSelection | null}) {
  if (subject) {
    return (
      <div className="mode-detail" data-mode-detail="base-document">
        <CentralSubjectDetail transport={transport} subject={subject} />
      </div>
    )
  }
  const deviceChips = [
    {name: 'Text', owner: 'document', note: 'the text device — the document\'s text with its form'},
    {name: 'Highlight', owner: 'highlight context', note: 'the forms\' own selection tool: Highlight · Note · To packet · Answer this'},
    {name: 'Notes', owner: 'document', note: 'the document\'s notes — during and after'},
    {name: 'Packet', owner: 'agent', note: 'exactly what the agent receives — selection · entry · document'},
    {name: 'Answer', owner: 'agent', note: 'the answer device — the agent\'s reply lands on the document'},
    {name: 'Form device', owner: 'the forms', note: 'die faces · participants · bindings — the open document\'s own form'},
  ]
  return (
    <div className="mode-detail" data-mode-detail="base-document" data-subject-selected="false">
      <section className="mode-detail-frame mode-detail-frame-wide" data-detail-empty="document" role="status">
        <header className="mode-detail-frame-head">
          <span className="mode-detail-frame-mark"><Icon name="detail" size={14} /></span>
          <strong>Document</strong>
          <span className="mode-detail-frame-sub">form · file · revision · bindings · highlights · notes · packet</span>
          <span className="mode-detail-frame-state">no subject selected</span>
        </header>
        <div className="mode-detail-chain" aria-label="The document devices that dock here">
          {deviceChips.map(device => (
            <div key={device.name} className="mode-detail-devcard" data-i={`${device.name} device|${device.note} — docks when a document is selected`}>
              <div className="mode-detail-devcard-head">
                <span className="mode-detail-devcard-lamp" aria-hidden="true" />
                <strong>{device.name}</strong>
                <span className="mode-detail-devcard-owner">{device.owner}</span>
                <span className="mode-detail-devcard-marks" aria-hidden="true"><ChevronFold /><PopOut /></span>
              </div>
              <p className="mode-detail-devcard-note">{device.note}</p>
              <p className="mode-detail-devcard-reason">dark — waits for its subject</p>
            </div>
          ))}
          <div className="mode-detail-dropzone" data-i="Drop zone|the document's devices dock here — left to right: through → who → how → where → lands">
            Drop the document's devices here
          </div>
        </div>
        <p className="mode-detail-frame-note">
          No ground material is selected. Select a folder, note or <b>day</b> in the browser's
          <b> Files</b> or <b>Days</b> categories — the document's craft opens here: CAS identity,
          basis, and the save router's five named outcomes.
        </p>
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
 * drawn at device density from the agency surface's OWN readings: the task
 * column is the track's real clip list (n · title · state · times), the
 * log column carries those clips' facts as entries. The deeper tool-run
 * rows wait for the Factory owner's task-log read — named, never
 * fabricated. The agent chain (the detail's other side) is live. */
export function FactoryTaskLogDetail({taskLabel, task}: {
  taskLabel: string | null
  task?: {
    sessionRef: string
    purpose: string | null
    agentName: string | null
    needleState: string | null
    /** The track's real clips — the agency reading's own task list. */
    tasks?: readonly {n: number; title: string | null; state: string; startUnixMs: number | null; lastActivityUnixMs: number | null; disclosure: string | null}[]
    /** Turns used / allowed — the track's budget reading. */
    budget?: {used: number | null; max: number | null} | null
  } | null
}) {
  const tasks = task?.tasks ?? []
  const clock = (unixMs: number | null) => unixMs == null ? null
    : new Date(unixMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'})
  const rows: {op: string; value: string | null; hint: string}[] = [
    {op: 'session', value: task?.sessionRef ?? null, hint: 'the selected session (the agency surface\'s own reading)'},
    {op: 'agent', value: task?.agentName ?? null, hint: 'the agent seated on the task'},
    {op: 'status', value: task?.needleState ?? null, hint: 'the thread needle\'s state — live · stalled · idle'},
    {op: 'attempt', value: null, hint: 'attempts come from the Factory owner (op factory_attempt_read) — declared, waiting here'},
    {op: 'workcell', value: null, hint: 'where the work runs (op workcell_status_read) — declared, waiting here'},
    {op: 'budget', value: task?.budget && (task.budget.used != null || task.budget.max != null)
      ? `${task.budget.used ?? '—'} / ${task.budget.max ?? '—'} turns`
      : null, hint: 'turns used / allowed — the track strip and the agent chain carry the live budget reading'},
  ]
  return (
    <div className="mode-detail" data-mode-detail="factory-task-log" role="status">
      <section className="mode-detail-frame mode-detail-frame-wide" data-detail="task-log">
        <header className="mode-detail-frame-head">
          <span className="mode-detail-frame-mark"><Icon name="session" size={14} /></span>
          <strong>Task log{taskLabel ? ` · ${taskLabel}` : ''}</strong>
          <span className="mode-detail-frame-sub">the selected task's tool-run log</span>
        </header>
        <div className="mode-detail-tasklog">
          <div className="mode-detail-tasklog-side">
            <ul className="mode-detail-rows" aria-label="Task identity">
              {rows.map(row => (
                <li key={row.op} className="mode-detail-row" title={row.hint} data-i={`${row.op}|${row.hint}`}>
                  <span className="mode-detail-row-op">{row.op}</span>
                  <span className={`mode-detail-row-value${row.value ? '' : ' is-waiting'}`}>{row.value ?? 'declared, waiting'}</span>
                </li>
              ))}
            </ul>
            {tasks.length > 0 && <div className="mode-detail-tasklist" aria-label="The session's tasks">
              <div className="mode-detail-tasklist-head">tasks <span>state</span></div>
              {tasks.map(clip => <div key={clip.n} className="mode-detail-tasklist-row"
                data-i={`Task ${clip.n}|${clip.title ?? 'untitled'} — ${clip.state}. ${clip.disclosure ?? ''}`}
                title={clip.disclosure ?? clip.title ?? undefined}>
                <span className="mode-detail-tasklist-n">{clip.n}</span>
                <span className="mode-detail-tasklist-title">{clip.title ?? 'untitled'}</span>
                <span className={`mode-detail-tasklist-state mode-detail-task-${clip.state}`}>{clip.state}</span>
              </div>)}
            </div>}
          </div>
          <div className="mode-detail-tasklog-log" aria-label="Tool-run log">
            {tasks.length > 0 ? tasks.map(clip => <div key={clip.n} className="mode-detail-logrow">
              <span className="mode-detail-logrow-time">{clock(clip.startUnixMs) ?? '—'}</span>
              <span className={`mode-detail-logrow-state mode-detail-task-${clip.state}`}>{clip.state}</span>
              <span className="mode-detail-logrow-text">{clip.title ?? 'untitled'}
                {clip.lastActivityUnixMs != null && <span className="mode-detail-logrow-meta"> · last activity {clock(clip.lastActivityUnixMs)}</span>}
              </span>
            </div>) : <p className="mode-detail-frame-note">
              No task clips in this session's reading yet. The thread's tool rows are the log's
              material; the log leg waits for the Factory owner's task-log read — the{' '}
              <b>agent chain</b> (the detail's other side) is live now.
            </p>}
            {tasks.length > 0 && <p className="mode-detail-frame-note mode-detail-logrow-wait">
              The thread's tool rows (read · edit · bash …) wait for the Factory owner's task-log
              read — the clips above are the agency surface's own readings.
            </p>}
          </div>
        </div>
      </section>
    </div>
  )
}

/** Technē · Clip — the focused encounter's clip craft (Rev 4's table) at
 * the mockup's four-craft anatomy (world-shell-mockup-techne-clip):
 * identity card · typed relations with standing chips · the bounded
 * constellation · the source — honest rows over the one temporal reading's
 * retained occasion, each waiting row naming its owner. Placement never
 * upgrades standing. */
export function TechneClipDetail({world}: {world: WorldTimelineView | null}) {
  const [, setTick] = useState(0)
  useEffect(() => world?.spine.subscribe(() => setTick(value => value + 1)), [world])
  const occasion = world?.spine.occasion() ?? null
  const standing = occasion?.admission ?? null
  const identity: {op: string; value: ReactNode; hint: string}[] = [
    {
      op: 'kind',
      value: occasion ? 'occurrence' : <span className="is-waiting">—</span>,
      hint: 'the retained occasion is an occurrence of its subject — one-field identity',
    },
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
  ]
  const relations = [
    {op: 'INSTANTIATES', standing: 'ghost'},
    {op: 'SOURCED_FROM', standing: 'ghost'},
    {op: 'CONTAINS', standing: 'ghost'},
    {op: 'SEQUENCE', standing: 'ghost'},
    {op: 'ARRANGES', standing: 'ghost'},
    {op: 'ECHOES', standing: 'ghost'},
    {op: 'CAUSES', standing: 'ghost'},
    {op: 'OCCURRED_AT', standing: 'ghost'},
  ]
  return (
    <div className="mode-detail" data-mode-detail="techne-clip">
      <section className="mode-detail-frame mode-detail-frame-wide" data-detail="techne-clip">
        <header className="mode-detail-frame-head">
          <span className="mode-detail-frame-mark"><Icon name="trav" size={14} /></span>
          <strong>Clip</strong>
          <span className="mode-detail-frame-sub">identity · place and time · disclosure · typed relations · constellation · source</span>
          {standing && <span className="mode-detail-frame-state" data-admission={standing.admitted ? 'admitted' : 'refused'}>{standing.admitted ? 'admitted' : 'past the reading'}</span>}
        </header>
        <div className="mode-detail-craft">
          <div className="mode-detail-craft-col" data-craft="identity" aria-label="Identity">
            <div className="mode-detail-craft-head">identity</div>
            <ul className="mode-detail-rows">
              {identity.map(row => (
                <li key={row.op} className="mode-detail-row" title={row.hint} data-i={`${row.op}|${row.hint}`}>
                  <span className="mode-detail-row-op">{row.op}</span>
                  <span className="mode-detail-row-value">{row.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mode-detail-craft-col" data-craft="relations" aria-label="Typed relations, in standing">
            <div className="mode-detail-craft-head">relations · typed, in standing</div>
            <ul className="mode-detail-rows">
              {relations.map(relation => (
                <li key={relation.op} className="mode-detail-row" data-i={`${relation.op}|the typed relation binds through the graph owner — the clip invents no edges; a ghost is shown honestly`}>
                  <span className="mode-detail-row-op">{relation.op}</span>
                  <span className="mode-detail-row-value"><span className={`mode-detail-standing-chip mode-detail-standing-${relation.standing}`} /> <span className="is-waiting">the graph owner's reading — declared, waiting</span></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mode-detail-craft-col" data-craft="constellation" aria-label="Bounded constellation">
            <div className="mode-detail-craft-head">constellation · bounded whole</div>
            <div className="mode-detail-constellation" aria-hidden="true">
              <span className="mode-detail-constellation-ghost" />
              <span className="mode-detail-constellation-core" />
            </div>
            <p className="mode-detail-craft-note">the bounded local whole — the constellation owner's; the ghost ring holds its place</p>
          </div>
          <div className="mode-detail-craft-col" data-craft="source" aria-label="Source">
            <div className="mode-detail-craft-head">source</div>
            <p className="mode-detail-craft-note">event → source at its anchor — the evidence route opens the source leg; declared, waiting here</p>
          </div>
        </div>
      </section>
    </div>
  )
}

// ————————————————————————————————————————————————————————————————————————
// The Technē lens bar (Revision 3: lens navigation is its own axis — never
// the transport's, never the surf's).

/** One lens: a `cut` opens the World cut's presentation (`presentation`) or the Earth atlas in one of its views (`atlas`);
 * a `waiting` lens holds its place and names its owner. */
export interface TechneLens {
  id: string
  name: string
  mark: string
  state: 'cut' | 'waiting'
  presentation?: 'session' | 'arrangement'
  atlas?: AtlasView
  owner: string
}

/** The six lenses by their plain actual names, with the declared mark each would wear. */
const LENSES: readonly TechneLens[] = [
  {id: 'project-graph', name: 'Project / graph', mark: 'lib', state: 'cut', atlas: 'graph', owner: 'the Earth atlas — its Graph view (the constellation, lock §8.1)'},
  {id: 'canvas', name: 'Canvas', mark: 'pane', state: 'waiting', owner: 'the canvas owner (the instrument-editors packet)'},
  {id: 'timeline', name: 'Timeline', mark: 'arrangement', state: 'cut', presentation: 'arrangement', owner: 'the World cut — the Timeline (M2′)'},
  {id: 'journey', name: 'Journey', mark: 'journey', state: 'cut', presentation: 'session', owner: 'the World cut — the Journey (M3′)'},
  {id: 'places', name: 'Places', mark: 'placed', state: 'cut', atlas: 'earth', owner: 'the Earth atlas — the globe (Places, M4′)'},
  {id: 'palace', name: 'Palace', mark: 'palace', state: 'waiting', owner: 'the Palace owner (the integral composition)'},
]

export function TechneLensBar({presentation, atlasOpen, onLens}: {
  presentation: 'session' | 'arrangement'
  /** the Earth atlas is the open centre pane: the World cut's lenses are not pressed while it is */
  atlasOpen: boolean
  onLens: (lens: TechneLens) => void
}) {
  const atlasView = useAtlasView()
  const pressed = (lens: TechneLens) => lens.atlas
    ? atlasOpen && atlasView === lens.atlas
    : !atlasOpen && lens.presentation === presentation
  const focused = LENSES.find(lens => lens.state === 'cut' && pressed(lens))
  return <nav className="techne-lens-bar" data-lens={focused?.id ?? null} aria-label="Technē lenses">
    <span className="techne-lens-title">Lenses</span>
    {LENSES.map(lens => (
      <button key={lens.id} type="button" className="techne-lens" data-lens-state={lens.state}
        aria-pressed={lens.state === 'cut' && pressed(lens)}
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
