/**
 * The per-mode detail compositions and the Technē lens bar — the shell
 * frame's reading of WORLD-SHELL-DESIGN Revision 4's detail table and
 * Revision 3's lens navigation, drawn only from what the landed lanes
 * declared.
 *
 * - Base · Devices: the ground's family chain through the device runtime
 *   (src/central/devices) — the Day die, the Flow, the conversation, the
 *   context-world, agent identity, hygiene and impact readings, each compact on
 *   the chain, whole in the pool, full in a pane. With no material selected a
 *   device's rows name what would dock and its light stays dark.
 * - Base · Document: the selected subject as data through the one Clip view
 *   (frame/detail/ClipView.tsx) — file, revision, state, bindings, Highlights
 *   and Notes; one line saying what it waits for until a subject is selected.
 * - Factory · Task log: the selected task as data through the same Clip view —
 *   its session, agent, status, attempt, workcell, budget and its Log.
 * - Technē · Instruments: the Quaternal Logic family's faces through the
 *   device runtime (inhabitants/ql/devices) — the admitted field/PCM owner's
 *   device with its honest refusing state, the declared-waiting faces as dark
 *   devices that name their owners. With a focused instrument (owner ruling,
 *   13 Oct 2026) the chain is the instrument families' devices (Quaternal
 *   Logic, the atlas and the knowledge graph): each compact on the chain with
 *   its body as its picture, whole in the pool, full in a pane; the devices
 *   that instrument holds stand open, the others fold to their titles.
 *   The Device side follows the focused pane's instrument in every mode
 *   (paneInstrument.ts); this chain is the instrument's devices in any mode.
 * - Technē lens bar: the six lenses by their plain actual names (the
 *   programme's naming ruling) — timeline and journey drive the landed
 *   World cut's two presentations; project / graph and places drive the
 *   Earth atlas's two views; the other two hold their places as declared
 *   waiting lenses. The bar stands over the centre in every mode whose
 *   centre holds an instrument pane (paneInstrument.ts showsLensBar).
 *
 * Nothing here invents an owner: every waiting state names its owner, and
 * the rack renders what the manifests declare — no more.
 */

import {useEffect, useState} from 'react'
import {loadWorldShellFamilies, QUATERNAL_LOGIC_FAMILY_ID} from '../inhabitants/worldShellFamilies'
import {inhabitantManifest, type InhabitantManifest} from '../inhabitants/manifest'
import {useQlInstrumentFeed} from '../live/torusInstrument'
import {useDeviceWindowHost} from '../native/detachedKinds'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import {Icon, type IconName} from '../inhabitants/sdk/Icon'
import {useAtlasView, type AtlasView} from '../projections/atlas/AtlasProjectionPanel'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {ATLAS_FAMILY_ID} from '../projections/atlas/atlasFamilyManifest'
import {admitKnowledgeGraphFamily} from '../inhabitants/knowledgeGraphFamilyManifest'
import {hostedLensOfBarId, type HostedLens, type PaneInstrumentId} from './paneInstrument'
import type {DayDocumentStanding} from '../central/centralVertical'
import {centralRackApertures} from '../central/centralRack'
import {useCentralSelection} from '../central/useCentralSelection'
import {useCentralDayStanding} from '../central/useCentralDayStanding'
import {CentralDayNotice} from '../central/CentralDayNotice'
import {CentralDevicesChain} from '../central/devices/CentralDevices'
import {TechneDevices} from '../inhabitants/ql/devices/TechneDevices'
import type {AgentSessionTrack} from '../agent/useAgencySessions'
import type {TemporalEventLike} from '../agent/agentRunModel'
import {ClipNone, ClipLine, ClipView, ClipWaiting, type ClipRow} from '../frame/detail/ClipView'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {standingOf} from '../../../../../desktop/cradle/src/techne/m0m5/timeline/standing'
import {CentralSubjectClip} from '../central/CentralClipDetail'
import './modeSurface.css'

// The door is idempotent (a second identical load composes nothing new);
// the shell frame admits the declared families once per module load.
loadWorldShellFamilies()

const qlManifests = (): readonly InhabitantManifest[] => {
  const ql = inhabitantManifest(QUATERNAL_LOGIC_FAMILY_ID)
  return ql ? [ql] : []
}

/** The instrument families: Quaternal Logic and the ported atlas (its graph
 * tools, mode switch, globe and time control are held by Technē instruments
 * in the family declarations, `heldBy`). */
const instrumentManifests = (): readonly InhabitantManifest[] => {
  const atlas = inhabitantManifest(ATLAS_FAMILY_ID)
  return [...qlManifests(), ...(atlas ? [atlas] : [])]
}

/** Base · Devices — the ground's family on the chain (Rev 4's table). With a
 * selected Central occasion (a Timeline clip, when no browser subject stands) the
 * Day die and the conversation take their apertures from the same selection and
 * owner read the Document row uses (src/central); with none, the chain is unchanged. */
export function BaseDevicesDetail({transport, world = null, subject = null, standing}: {
  transport: KernelTransportStatus
  world?: WorldTimelineView | null
  subject?: CentralSubjectSelection | null
  /** A Day standing the caller has already read; absent, the occasion's Day is read here. */
  standing?: DayDocumentStanding | null
}) {
  const selection = useCentralSelection(world, subject)
  const read = useCentralDayStanding(transport, selection?.dayRef ?? null)
  const deviceWindows = useDeviceWindowHost()
  const dayStanding = standing !== undefined ? standing : read
  const apertures = centralRackApertures(selection, dayStanding)
  return (
    <div className="mode-detail" data-mode-detail="base-devices">
      {apertures.dayNotice && <CentralDayNotice notice={apertures.dayNotice} />}
      <CentralDevicesChain transport={transport} dayStanding={apertures.day || apertures.dayNotice ? dayStanding : null} deviceWindows={deviceWindows}
        day={apertures.day ?? null} conversation={apertures.conversation ?? null} impact={subject} />
    </div>
  )
}

/** Base · Document — the selected Central subject as data, through the one Clip view (frame/detail/ClipView.tsx): its form,
 * file, revision, state and bindings beside its Highlights and Notes (central/CentralClipDetail.tsx CentralSubjectClip, which
 * reads the owner's file route). With no subject the side says what it waits for in one line (`waits`, the mode's own words,
 * shell/modeDetails.tsx); the document's devices stand on the Device side, never as cards here. */
export function BaseDocumentDetail({transport, subject, waits = 'Select a document to see it as data here.', colour}: {
  transport: KernelTransportStatus
  subject: CentralSubjectSelection | null
  /** The one line shown while no subject is selected. */
  waits?: string
  /** The selected clip's track colour, when the subject came from the shown tracks. */
  colour?: string | null
}) {
  if (!subject) return <ClipWaiting line={waits} />
  return <CentralSubjectClip key={`${subject.kind}:${subject.path}`} transport={transport} subject={subject} colour={colour} />
}

/** Technē · Instruments — the instruments rack (lock §2.5; the mockup's Technē device side): the six instruments in their order,
 * folded to their titles by the runtime's fold around the one open instrument — the focused pane's — drawn as one plate whose
 * columns are the families whose devices it holds (inhabitants/ql/devices/TechneDevices.tsx). With no instrument focused, the six
 * stand folded and the faces none of them holds stand after them: the admitted field/PCM owner open, the waiting faces folded. */
export function TechneInstrumentsDetail({focusInstrument}: {
  transport: KernelTransportStatus
  /** The focused pane's instrument (paneInstrument.ts); absent → every instrument folds. */
  focusInstrument?: string | null
}) {
  const manifests = instrumentManifests()
  // The QL instrument's reading is the one reader's (live/torusInstrument.ts), read here and never passed in by a caller.
  const instrumentReading = useQlInstrumentFeed()
  return (
    <div className="mode-detail" data-mode-detail="techne-instruments" data-focus-instrument={focusInstrument ?? undefined}>
      <TechneDevices manifests={manifests} focusInstrument={focusInstrument ?? null} instrumentReading={instrumentReading} />
    </div>
  )
}

/** Factory · Task log — the selected task as data, through the one Clip view (frame/detail/ClipView.tsx; world-shell-mockup.html
 * clipDetail(), its Factory branch, :1669-1671): the props column holds the task's session, agent, status, attempt, workcell and
 * budget, then the clip box's facts (where it ran, when a launch lands, what follows it); the Log column lays the session's
 * thread activity along the task's time — each row the owner's own event (time · kind · what it says), from the one temporal
 * read the task's span is derived from (agent/agentRunModel.ts buildTaskClips, eventsForSession). A fact no owner discloses is
 * "—". Legacy: this function's own task-identity rows, task list and log rows over the session's clips (and the Desk's run
 * join beneath — retired, and deleted on 15 Oct: nothing in the candidate selects a Desk run). */
export function FactoryTaskLogDetail({track, n, name, colour, box = [], events}: {
  /** The task's session: the agency reading's own track. */
  track: AgentSessionTrack
  /** The task's ordinal in its session (`#task/<n>`); absent, the session's first real task. */
  n?: number | null
  /** The session's name as the tracks pane shows it. */
  name?: string
  /** The session's track colour. */
  colour?: string | null
  /** The clip box's rows for the selected clip (frame/detail/ClipBox.tsx clipBoxRows). */
  box?: readonly ClipRow[]
  /** The session's temporal events (the sessions provider's one read); null when no provider reads them here. */
  events: readonly TemporalEventLike[] | null
}) {
  const task = track.tasks.find(clip => !clip.softStop && (n == null || clip.n === n)) ?? null
  const clock = (unixMs: number | null | undefined) => unixMs == null ? '—'
    : new Date(unixMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})
  const budget = track.budget.used != null || track.budget.max != null ? `${track.budget.used ?? '—'} / ${track.budget.max ?? '—'} turns` : null
  const rows: ClipRow[] = [
    {key: 'session', value: name ?? track.purpose ?? track.sessionRef, title: track.sessionRef},
    {key: 'agent', value: track.agentName, title: track.agentRef ?? 'The agency reading names no agent for this session'},
    {key: 'status', value: task && task.state !== 'unknown' ? task.state : null, title: task?.disclosure ?? 'How the task stands, as its owner or its activity says'},
    {key: 'attempt', value: null, title: 'Attempts come from the Factory owner (factory_attempt_read), addressed by run; the sessions reading names none'},
    {key: 'workcell', value: null, title: 'No reading names the workcell this session runs in'},
    {key: 'budget', value: budget, title: 'Turns used / allowed — the track\'s budget reading'},
    ...box.filter(row => row.key !== 'track' && row.key !== 'state'),
  ]
  const log = events ? [...events].sort((a, b) => (a.instant_unix_ms ?? Infinity) - (b.instant_unix_ms ?? Infinity)) : null
  const shown = log ? log.slice(-LOG_ROWS) : null
  return <ClipView kind="factory-task" name={task?.title ?? track.purpose ?? 'untitled task'} colour={colour} rows={rows} columns={[{name: 'Log', body: !shown
    ? <ClipNone>The thread's activity is not read here: no agent sessions reading stands above the detail row.</ClipNone>
    : !shown.length
      ? <ClipNone>No temporal event names this session in the last day's reading (temporal_events_read).</ClipNone>
      : <div data-task-log={shown.length}>
          {log!.length > shown.length && <ClipNone>{log!.length - shown.length} earlier rows are not shown.</ClipNone>}
          {shown.map((event, index) => <ClipLine key={`${event.subject_ref}:${event.instant_unix_ms ?? 'none'}:${index}`} lead={clock(event.instant_unix_ms)}
            chip={event.kind ?? event.stream ?? 'event'} title={`${event.stream ?? 'stream'} · ${event.subject_ref}`}>{event.summary ?? event.subject_ref}</ClipLine>)}
        </div>}]} />
}

/** The Log column keeps the latest rows of a long thread. */
const LOG_ROWS = 200

/** Technē · Clip — the event in focus as a clip (manual §3: "Open an event in Technē and you see its span, what it gathered, and how
 * sure anyone is of it"; lock §2.5 Clip detail: identity, place and time, disclosure, typed relations, bounded constellation, source;
 * the mockup's clipDetail() techne branch, world-shell-mockup.html:1653-1659) through the one Clip view (frame/detail/ClipView.tsx).
 * Fed only from the World cut's reading (projections/useWorldTemporalReading.ts): the retained occasion's basis and its current
 * admission, and the event row it was retained from. A field that reading does not carry shows "—"; standing is the owner's verbatim
 * word or none (techne/m0m5/timeline/standing.ts: a class never upgrades it); no relation is drawn that the event does not name. */
export function TechneClipDetail({world}: {world: WorldTimelineView | null}) {
  const [, setTick] = useState(0)
  useEffect(() => world?.spine.subscribe(() => setTick(value => value + 1)), [world])
  const selected = useSelectedClip()
  const occasion = world?.spine.occasion() ?? null
  const admission = occasion?.admission ?? null
  const event = occasion ? world?.source.events.find(row => row.subject_ref === occasion.basis.ref
    && (row.instant_unix_ms ?? null) === occasion.basis.instantUnixMs) ?? null : null
  const evidence = occasion?.basis.evidenceRefs ?? event?.evidence_refs ?? []
  const standing = standingOf({standing: undefined, evidence_refs: evidence})
  const instant = occasion?.basis.instantUnixMs != null ? new Date(occasion.basis.instantUnixMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : null
  const day = occasion?.basis.civilDayRef ?? event?.day_ref ?? null
  const rows: ClipRow[] = [
    {key: 'kind', value: event?.kind ?? null, title: 'The event\'s kind as its stream names it'},
    {key: 'standing', value: standing.verbatim, title: `How sure anyone is of it: the owner's own word — ${standing.rule}`},
    {key: 'world', value: null, title: 'The World cut\'s reading names no world for an event'},
    {key: 'revision', value: null, title: 'The World cut\'s reading carries no revision for an event'},
    {key: 'occasion', value: instant ? `${instant}${day ? ` · ${day}` : ''}` : null, title: 'When it happened: the retained occasion\'s instant and civil day'},
    {key: 'place', value: null, title: 'The World cut\'s reading places no event'},
    {key: 'provenance', value: event?.stream ? `${event.stream}${event.stream_position ? ` @ ${event.stream_position}` : ''}` : null, title: 'Where the reading took it from: its stream and its place in that stream'},
    {key: 'admission', value: admission ? (admission.admitted ? 'admitted' : 'no longer in the reading') : null, title: admission?.disclosure ?? 'Current admission: not yet qualified against a newer reading'},
  ]
  // The disclosure ladder (the mockup's LADDER, :591): which rung the event stands on. The World cut's reading discloses none, so every
  // rung stays dark and the rung reads "—".
  const ladder = <div className="techne-ladder" title="The World cut's reading discloses no disclosure rung for an event">
    <span className="techne-ladder-head"><span>Disclosure</span><span>—</span></span>
    <span className="techne-ladder-rungs" aria-hidden="true">{DISCLOSURE_LADDER.map(rung => <i key={rung} title={rung} />)}</span>
  </div>
  const relations = evidence.length
    ? evidence.map(ref => <ClipLine key={ref} chip="evidence" right={standing.verbatim ?? '—'} title={`${ref} — ${standing.rule}`}>{ref}</ClipLine>)
    : <ClipNone>{occasion ? 'The reading names no relation of this event.' : 'Select an event: its relations stand here.'}</ClipNone>
  return (
    <div className="mode-detail" data-mode-detail="techne-clip">
      <ClipView kind="techne-event" name={occasion ? (occasion.basis.summary ?? occasion.basis.ref) : 'No event selected'} colour={selected.track?.color}
        rows={rows} note={ladder}
        columns={[
          {name: 'Relations · typed, in standing', width: 330, body: relations},
          {name: 'Constellation · bounded whole', width: 320, body: evidence.length
            ? <TechneConstellation focus={occasion?.basis.summary ?? occasion?.basis.ref ?? ''} neighbours={evidence} />
            : <ClipNone>{occasion ? 'The reading discloses no neighbours of this event.' : 'Select an event: its local whole stands here.'}</ClipNone>},
          {name: 'Source', body: occasion
            ? <div className="techne-source">
                <div className="techne-source-ref">{event?.stream ?? '—'}{event?.stream_position ? ` · ${event.stream_position}` : ''}</div>
                <p>{occasion.basis.summary ?? '—'}</p>
                <div className="techne-source-note">the event as the reading gives it{occasion.basis.retainedAtUnixMs ? ` · retained ${new Date(occasion.basis.retainedAtUnixMs).toISOString().slice(11, 16)} UTC` : ''}</div>
              </div>
            : <ClipNone>Select an event: its source stands here.</ClipNone>},
        ]} />
    </div>
  )
}

/** The disclosure ladder's rungs, as the mockup names them (world-shell-mockup.html:591). */
const DISCLOSURE_LADDER = ['local source', 'addressable', 'retrieved', 'rendered', 'selected for projection', 'admitted to field', 'public'] as const

/** The bounded local whole (the mockup's constellation, :1656): the event at the centre, what it names around it — only what the
 * reading gives, never a neighbour it does not name. */
function TechneConstellation({focus, neighbours}: {focus: string; neighbours: readonly string[]}) {
  const shown = neighbours.slice(0, 12)
  const label = (ref: string) => (ref.split(/[/:#]/).filter(Boolean).pop() ?? ref).slice(0, 18)
  return <svg className="techne-constellation" width="300" height="190" viewBox="0 0 300 190" role="img" aria-label={`${focus} and the ${shown.length} it names`}>
    {shown.map((ref, index) => {
      const angle = index / shown.length * Math.PI * 2 - Math.PI / 2, x = 150 + Math.cos(angle) * 112, y = 95 + Math.sin(angle) * 72
      return <g key={ref}><line x1="150" y1="95" x2={x} y2={y} /><circle cx={x} cy={y} r="4.5" /><text x={x} y={y + 13} textAnchor="middle">{label(ref)}</text><title>{ref}</title></g>
    })}
    <circle className="techne-constellation-focus" cx="150" cy="95" r="8"><title>{focus}</title></circle>
  </svg>
}

/** The instrument device side for a focused pane's instrument (owner ruling,
 * 13 Oct 2026). A Technē holder stands its instrument's devices. The knowledge
 * graph is a standalone instrument (T-KNOWLEDGE-GRAPH-DEVICE): its own family's
 * devices stand here, driving the open graph's own controls, and the
 * 0 instrument's devices are never shown for it. */
export function InstrumentDeviceDetail({transport, instrument, centralDevices = false}: {
  transport: KernelTransportStatus
  instrument: PaneInstrumentId
  /** Central's own devices lead the chain (never removed by the ruling): the
   * mode's material devices, then the focused pane's instrument. */
  centralDevices?: boolean
}) {
  const deviceWindows = useDeviceWindowHost()
  const instrumentReading = useQlInstrumentFeed()
  if (instrument === 'knowledge-graph') {
    return (
      <div className="mode-detail" data-mode-detail="knowledge-graph-device">
        {centralDevices && <CentralDevicesChain transport={transport} dayStanding={null} deviceWindows={deviceWindows} />}
        <TechneDevices manifests={[admitKnowledgeGraphFamily()]} focusInstrument="knowledge-graph" instrumentReading={instrumentReading} />
      </div>
    )
  }
  if (centralDevices) {
    return (
      <div className="mode-detail" data-mode-detail="techne-instruments" data-focus-instrument={instrument} data-central-devices="true">
        <CentralDevicesChain transport={transport} dayStanding={null} deviceWindows={deviceWindows} />
        <TechneDevices manifests={instrumentManifests()} focusInstrument={instrument} instrumentReading={instrumentReading} />
      </div>
    )
  }
  return <TechneInstrumentsDetail transport={transport} focusInstrument={instrument} />
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
export const LENSES: readonly TechneLens[] = [
  {id: 'project-graph', name: 'Project / graph', mark: 'lib', state: 'cut', atlas: 'graph', owner: 'the Earth atlas — its Graph view (the constellation, lock §8.1)'},
  {id: 'canvas', name: 'Canvas', mark: 'pane', state: 'waiting', owner: 'the canvas owner (the instrument-editors packet)'},
  {id: 'timeline', name: 'Timeline', mark: 'arrangement', state: 'cut', presentation: 'arrangement', owner: 'the World cut — the Timeline (M2′)'},
  {id: 'journey', name: 'Journey', mark: 'journey', state: 'cut', presentation: 'session', owner: 'the World cut — the Journey (M3′)'},
  {id: 'places', name: 'Places', mark: 'placed', state: 'cut', atlas: 'earth', owner: 'the Earth atlas — the globe (Places, M4′)'},
  {id: 'palace', name: 'Palace', mark: 'palace', state: 'waiting', owner: 'the Palace owner (the integral composition)'},
]

/** The Factory centre's Expressions lens (T-EXPRESSIONS-PANE-LEASE). It opens the Expressions pane beside the agent, which presents the
 * one hosted Expressions surface (the centre's frame, retained: no second frame, no second native lease). It is a Factory-bar entry
 * only: the six World cut lenses in every other mode are unchanged. */
export const FACTORY_EXPRESSIONS_LENS: TechneLens = {id: 'expressions', name: 'Expressions', mark: 'pane', state: 'cut', owner: 'the one hosted Expressions surface, presented from the centre (its frame and native lease are not duplicated)'}

/** The plain reason a lens cannot open as a pane in the Factory centre, or null when it can. Factory's Workbench tree admits the Earth
 * atlas (its Graph view, Project / graph, and its Earth view, Places), the Timeline projection's pane body (Timeline, m2, and
 * Journey, m3, its two presentations) and the Expressions pane (the one hosted surface, presented). Every other waiting lens names its owner. */
export function factoryLensReason(lens: TechneLens): string | null {
  if (lens.id === 'project-graph' || lens.id === 'places' || lens.id === 'timeline' || lens.id === 'journey' || lens.id === 'expressions') return null
  return `${lens.name} (planned) — the button holds its place; ${lens.owner} is still to be mounted here`
}

/** The instrument pane a Factory lens press opens inside the Workbench tree, or null when the press opens nothing. Timeline and
 * Journey both open the one Timeline pane (projection.timeline); the lens's presentation is that pane's own presentation. */
export function factoryLensPane(lens: TechneLens): 'projection.earth' | 'projection.constellation' | 'projection.timeline' | 'projection.expressions' | null {
  if (factoryLensReason(lens) !== null) return null
  if (lens.id === 'expressions') return 'projection.expressions'
  if (lens.presentation) return 'projection.timeline'
  return lens.atlas === 'graph' ? 'projection.constellation' : 'projection.earth'
}

export function TechneLensBar({presentation, atlasOpen, onLens, hosted = null, factory = false, expressionsFocused = false}: {
  /** The presentation lens in force; null when the focused pane holds no presentation (Factory's agent tab), so no Timeline or
   * Journey lens reads as pressed. */
  presentation: 'session' | 'arrangement' | null
  /** the Earth atlas is the open centre pane: the World cut's lenses are not pressed while it is */
  atlasOpen: boolean
  onLens: (lens: TechneLens) => void
  /** The hosted Expressions pane stands focused: the bar reads and drives its lens (null lens = none reported yet). Absent = the World cut / Earth bar. */
  hosted?: {lens: HostedLens | null} | null
  /** The Factory centre: a lens is reachable only when its pane is admitted (factoryLensReason); the rest stay visible, disabled, titled with their reason. */
  factory?: boolean
  /** The focused Factory pane is the Expressions pane: its Factory-bar entry reads pressed. */
  expressionsFocused?: boolean
}) {
  const atlasView = useAtlasView()
  // The Factory bar carries the Expressions entry beside the six World cut lenses; every other mode's bar is the six unchanged.
  const entries = factory ? [...LENSES, FACTORY_EXPRESSIONS_LENS] : LENSES
  // Hosted focus: the bar's entries are the hosted lenses (paneInstrument's one table); every entry with a hosted lens is reachable.
  const reachable = (lens: TechneLens) => factory ? factoryLensReason(lens) === null : hosted ? hostedLensOfBarId(lens.id) !== null : lens.state === 'cut'
  const pressed = (lens: TechneLens) => lens.id === 'expressions'
    ? expressionsFocused
    : hosted
    ? hostedLensOfBarId(lens.id) === hosted.lens
    : lens.atlas
      ? atlasOpen && atlasView === lens.atlas
      : !atlasOpen && lens.presentation === presentation
  const focused = entries.find(lens => reachable(lens) && pressed(lens))
  return <nav className="techne-lens-bar" data-lens={focused?.id ?? null} data-hosted={hosted ? 'true' : undefined} aria-label="Technē lenses">
    <span className="techne-lens-title">Lenses</span>
    {entries.map(lens => (
      <button key={lens.id} type="button" className="techne-lens" data-lens-state={factory ? (reachable(lens) ? 'cut' : 'waiting') : hosted && hostedLensOfBarId(lens.id) ? 'cut' : lens.state}
        aria-pressed={reachable(lens) && pressed(lens)}
        disabled={!reachable(lens)}
        title={factory
          ? (factoryLensReason(lens) ?? `${lens.name} — ${lens.owner}`)
          : hosted
          ? (hostedLensOfBarId(lens.id) ? `${lens.name} — the hosted Expressions lens` : `${lens.name} — not a hosted Expressions lens`)
          : lens.state === 'cut'
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
