/**
 * The per-mode detail compositions and the Technē lens bar — the shell
 * frame's reading of WORLD-SHELL-DESIGN Revision 4's detail table and
 * Revision 3's lens navigation, drawn only from what the landed lanes
 * declared.
 *
 * - Base · Devices: the ground's family chain through the device runtime
 *   (src/central/devices) — the Day and Approvals on the Main track; the
 *   Packet, the Agent, Scope and Docs on a world's (DLW §16.2), each compact on
 *   the chain, whole in the pool, full in a pane. With no material selected a
 *   device's rows name what would dock and its light stays dark.
 * - The Clip side of every mode is the one clip host's (frame/detail/ClipHost.tsx,
 *   T-REALIGN R2): the Central document, the Factory task log and the Technē
 *   event that were drawn here as data rows now open in Clip view after Live,
 *   on their clip bindings (central/, agent/, techne/clipBinding.ts).
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
        day={apertures.day ?? null} conversation={apertures.conversation ?? null} />
    </div>
  )
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
  {id: 'timeline', name: 'Timeline', mark: 'arrangement', state: 'cut', presentation: 'arrangement', owner: 'the World cut — the Timeline'},
  {id: 'journey', name: 'Journey', mark: 'journey', state: 'cut', presentation: 'session', owner: 'the World cut — the Journey'},
  {id: 'places', name: 'Places', mark: 'placed', state: 'cut', atlas: 'earth', owner: 'the Earth atlas — the globe (Places)'},
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
