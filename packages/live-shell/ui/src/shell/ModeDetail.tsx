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
 * (L7): identity, basis, and the save router's outcomes as honest rows. */
export function BaseDocumentDetail({transport, subject}: {transport: KernelTransportStatus; subject: CentralSubjectSelection | null}) {
  return (
    <div className="mode-detail" data-mode-detail="base-document">
      <CentralSubjectDetail transport={transport} subject={subject} />
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

/** Factory · Task log — the honest form of the selected task's tool-run log:
 * the readings the agency surface already holds, and the named wait for the
 * log's own owner (no fabricated run rows). */
export function FactoryTaskLogDetail({taskLabel}: {taskLabel: string | null}) {
  return (
    <div className="mode-detail" data-mode-detail="factory-task-log" role="status">
      <p className="mode-detail-note">
        <b>Task log{taskLabel ? ` · ${taskLabel}` : ''}.</b> The selected task's tool-run log docks here —
        the thread's tool rows are the log's material. The log leg waits for the Factory owner's
        task-log read; the agent chain (the detail's other side) is live now.
      </p>
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
