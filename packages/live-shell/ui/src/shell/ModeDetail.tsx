/**
 * The per-mode detail compositions — the shell frame's reading of
 * WORLD-SHELL-DESIGN Revision 4's detail table, drawn only from what the
 * landed lanes declared.
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
 * - The Technē lens bar is retired (#762): it was reached only by tests once
 *   the instruments moved into the browser. Its instruments open from the
 *   browser's Instruments section and the instrument door
 *   (frame/instruments.ts, frame/instrumentDoor.ts), the atlas's two views
 *   from the Earth ⇄ Graph device and the Project plate's View.
 *
 * Nothing here invents an owner: every waiting state names its owner, and
 * the rack renders what the manifests declare — no more.
 */

import {loadWorldShellFamilies, QUATERNAL_LOGIC_FAMILY_ID} from '../inhabitants/worldShellFamilies'
import {inhabitantManifest, type InhabitantManifest} from '../inhabitants/manifest'
import {useQlInstrumentFeed} from '../live/torusInstrument'
import {useDeviceWindowHost} from '../native/detachedKinds'
import type {CentralSubjectSelection} from '../inhabitants/CentralSubjectDetail'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {ATLAS_FAMILY_ID} from '../projections/atlas/atlasFamilyManifest'
import {admitKnowledgeGraphFamily} from '../inhabitants/knowledgeGraphFamilyManifest'
import type {PaneInstrumentId} from './paneInstrument'
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
