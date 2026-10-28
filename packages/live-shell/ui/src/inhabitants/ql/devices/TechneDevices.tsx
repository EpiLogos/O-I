// The Technē instruments' devices on the Device side (T-DEVICES-TECHNE; manual §3: "Wherever you are, the instrument in the focused pane
// brings its own controls into the chain"; §10.4: three sizes, one set of live settings). The families' faces — the QL field/PCM owner and
// its waiting kin, the atlas's four faces, the knowledge graph's three — stand on the chain as compact devices through DeviceView: the
// face's own body is its picture, and up to four controls sit under it. Each device is published to the device door by id, so choosing
// one shows it whole in the pool under the browser and opening it full puts it in a pane, with the same live settings in all three.
//
// The rack is the instruments (lock §2.5: "drawn as one instrument frame with sections; the focused lens expanded, the others folded";
// the mockup's Technē device side, world-shell-mockup.html:1647-1650 and :1442-1461): the six Technē instruments in their order, each
// folded to its title by the kit's fold (panel.tsx Folded — manual §10.4 "A device can also fold down to its title. Click the
// title to open it again"), or standing as its Compact where the row has room, around the ONE open instrument: the focused pane's,
// drawn as one plate whose columns are the families whose devices it holds. Clicking a folded instrument opens it on the focused pane
// through the instrument door (the mockup's `data-instr`), and stands it open here whatever the door answers. With no instrument
// focused, the faces no Technē instrument holds (the QL field/PCM owner and its waiting kin, and the M′ matrices, which the app layers'
// racks hold: #801) stand after the folds as they did before: the admitted ones open, the waiting ones folded.
//
// Every head is the panel kit's (inhabitants/sdk/panel.tsx; manual §16.9): a fold is the kit's Folded strip (its light, its name, its
// readings, read downward), the open plate's head carries ▾ (fold it to its title: every instrument then stands as its Compact or its
// fold) and ⤢ (open it on the focused pane). The instrument standing open is published (standingInstrument.ts) so the Device side's head
// names it, not the pane's.
//
// The open instrument is a chain (manual §16.2 Technē: "The instrument it plays through, then its lens and filter effects"; T-COVERAGE
// §1.4, lane W4-Technē): the catalogue's design of the instrument stands at its head on its own owner — the Canvas, the Journey, the
// Palace, the Knowledge graph — then the holder's own plate where it keeps controls no design carries yet (the frame's chrome, the
// palace's composition), then its effects: the Lens after every instrument a reading plays through (techne/devices/techneDesigns.ts
// TECHNE_CHAINS). The Timeline and Light were retired as devices of their own in the 22 Oct manual rewrite: the timeline is Technē's
// Arrangement view (§17.5), so the Timeline's own plate stands first; Light is the Canvas's Light page (§17.4). The knowledge graph's three faces (scope, filters, display) no longer stand on its
// chain: the Knowledge graph's design carries their parameters on its Reach, Filters and Display pages, on the same owner.
import {useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject} from 'react'
import {DeviceView} from '../../../frame/devices/DeviceView'
import {publishDevice, publishedDevice, selectDevice} from '../../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../../frame/devices/devicePane'
import {driveStageLens, openInstrument, reportInstrumentFault} from '../../../frame/instrumentDoor'
import {InstrumentPlate, SectionNote, type PlateSection, type SectionDevice} from '../../../frame/devices/InstrumentPlate'
import {sameSet} from '../../../frame/devices/plateFit'
import {HOSTED_INSTRUMENT, instrumentOfPane, type HostedLens} from '../../../shell/paneInstrument'
import {HOLDERS, TECHNE_INSTRUMENTS, type HolderDeclaration} from '../../sdk/semantics'
import type {IconName} from '../../sdk/icons'
import {lightOf, type DeviceInstance, type DeviceSize} from '../../../frame/devices/deviceRuntime'
import {commitLiveInstrumentEdit, liveInstrumentWritable, useLiveTorusReading, type LiveTorusState} from '../../../live/torusInstrument'
import {useAtlasHandle, useAtlasView} from '../../../projections/atlas/AtlasProjectionPanel'
import {PlacesPlate} from '../../../projections/atlas/places/PlacesPlate'
import {PalacePlate} from '../../../projections/atlas/palaces/PalacePlate'; import {STAGE_OWN_PLATES} from '../../../projections/stageInstruments/StageInstrumentPlate'
import {palaceState, subscribePalace} from '../../../projections/atlas/palaces/palaceSession'
import {knowledgeGraphSurface, subscribeKnowledgeGraph} from '../../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import type {KnowledgeGraphSurface} from '../../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {Folded} from '../../sdk/panel'
import {Icon} from '../../sdk/Icon'
import type {InhabitantFaceDeclaration, InhabitantManifest} from '../../manifest'
import {AtlasFaceBody, isAtlasFaceId} from '../../atlasFaceBodies'
import {KnowledgeFaceBody, isKnowledgeFaceId} from '../../knowledgeGraphFaceBodies'
import {QlInstrumentBody, QlInstrumentControl, qlInstrumentStanding, type QlInstrumentChange} from '../../qlInstrumentDevice'
import {atlasDevice, atlasGlobeBinding, atlasReading, ATLAS_FAMILY, type AtlasReading} from './atlasDevices'
import {knowledgeDevice, KNOWLEDGE_FAMILY} from './knowledgeDevices'
import {qlInstrumentDevice, waitingDevice, QL_FAMILY, QL_INSTRUMENT_FACE} from './qlDevices'
import {qlSkyBinding, qlSkyDevice, useQlSky, QL_SKY_FACE, type QlSkyState} from './qlSky'
import {useSkyPresences, type SkyPresences} from './skyPresences'
import {qlM3Binding, qlM3Device, useQlM3, QL_M3_FACE, type QlM3State} from './qlM3Clock'
import {qlDeckBinding, qlDeckDevice, useQlDeck, useQlDeckCast, QL_DECK_FACE, type DeckCastState, type QlDeckState} from './qlDeck'
import {qlChakraBinding, qlChakraDevice, useQlChakra, QL_CHAKRA_FACE, type QlChakraState} from './qlChakra'
import {qlBindingBinding, QL_BINDING_DEVICE_ID} from './qlBinding'
import {carryPages, type CarriedPage} from '../../../agent/devices/oneAgentBinding'
import {qlMatricesBinding, qlMatricesDevice, QL_MATRICES_DEVICE_ID, QL_MATRICES_FACE} from './qlMatrices'
import {useQlM1, type QlM1State} from './qlM1'
import {useQlCentres, type QlCentresState} from './qlCentres'
import {useQlRack, type QlRackState} from './qlRack'
import {useKernelApply, type KernelApplyState} from './qlKernelApply'
import {heldFor, useHolds} from '../../../techne/devices/designDevices'
import {useLiveModeCatalogue, useLiveModeHold, type LiveModeCatalogueState, type LiveModeHold} from '../../../native/liveModeCatalogue'
import type {Value} from '../../../frame/devices/designed'
import './practiceLaunch'
import type {DesignBinding} from '../../../frame/devices/designed'
import {startsExpanded, TECHNE_FACE_ICONS} from './faces'
import {ProjectPlate} from './ProjectPlate'
import {InstrumentCompact, hasCompact} from './techneCompacts'
import {publishStandingInstrument} from './standingInstrument'
import {DESIGN_DEVICES, DESIGN_FACES, TECHNE_CHAINS, designsOn, useTechneDesignBindings} from '../../../techne/devices/techneDesigns'
import './techneDevices.css'

/** What the devices are read from: the one mounted atlas, the open graph, the QL owner's reading — each the same reader its body reads. */
export interface TechneReadings {
  readonly atlas: AtlasReading
  readonly surface: KnowledgeGraphSurface | null
  readonly torus: LiveTorusState | null
  /** The QL owner's reading as the host received it (raw; the body parses it). */
  readonly instrumentReading: unknown
  /** The dated sky the kernel read for the Sky (qlSky.ts), with the view's own date and choices. */
  readonly sky?: QlSkyState
  /** The person's M3 form for the open Expression (qlM3Clock.ts), with the view's own choices. */
  readonly m3?: QlM3State
  /** The open journey's reading (qlDeck.ts), with the view's own choices. */
  readonly deck?: QlDeckState
  /** Your elements from your saved identity (qlChakra.ts), with the view's own choices. */
  readonly chakra?: QlChakraState
  /** The QL mode catalogue and the transport's mode in force (native/liveModeCatalogue.ts): the M′ matrices' Reading. */
  readonly modes?: QlModes
  /** The view's own holds of the designs that keep their own settings (techne/devices/designDevices.ts): Binding's, the matrices'. */
  readonly held?: Readonly<Record<string, Readonly<Record<string, Value>>>>
  /** QL's M1 engine's cells for the family the matrices hold (qlM1.ts). */
  readonly m1?: QlM1State
  /** The kernel's operators' answers for the address the matrices hold (qlKernelApply.ts). */
  readonly kernel?: KernelApplyState
  /** Today's centres, QL's scene of the sky the Sky shows (qlCentres.ts): the Chakra's. */
  readonly centres?: QlCentresState
  /** The Deck's cast hexagram's cell, QL's generation law asked of the person's M3 state (qlDeck.ts). */
  readonly cast?: DeckCastState
  /** M2′'s and M3′'s racks from the map's ledger, for the Sky's and the M3 clock's Rack pages (qlRack.ts). */
  readonly racks?: {readonly 2: QlRackState; readonly 3: QlRackState}
  /** The Sky's Share page: the presence consents SharedField lists, split by the person's Participants (skyPresences.ts). */
  readonly presences?: SkyPresences
}

/** The mode catalogue as the kernel served it and the transport's mode as held. */
export interface QlModes {readonly reading: LiveModeCatalogueState; readonly hold: LiveModeHold}

/** The knowledge graph family's faces the Knowledge graph's design carries now (knowledge-graph__graph.tsx Reach, Filters, Display): they
 * stand on no chain. Their rows stay declared (knowledgeDevices.ts) for the setters the design writes through. */
export const KNOWLEDGE_FACES_CARRIED: readonly string[] = ['knowledge-scope', 'knowledge-filters', 'knowledge-display']

/** One face on the chain: its declaration, the device the runtime draws, and the device's own picture at each size. */
export interface TechneEntry {
  readonly family: string
  readonly face: InhabitantFaceDeclaration
  readonly device: DeviceInstance
  readonly picture: (size: DeviceSize) => ReactNode
  /** What a folded device still says on its title: the owner's standing, where the owner has one. */
  readonly status?: ReactNode
  /** The wiring of the device's designed views to its owner, where the face has one (the Sky: qlSky.ts qlSkyBinding). */
  readonly binding?: DesignBinding
}

function Picture({size, face, children}: {size: DeviceSize; face: string; children: ReactNode}) {
  return <div className="techne-picture" data-size={size} data-picture={face}>{children}</div>
}

/** The owner's standing, named as the rack's header named it: a word, and the reader's own reason as its title. */
function StandingChip({reading}: {reading: unknown}) {
  const standing = qlInstrumentStanding(reading)
  return <span className="techne-standing" data-ql-standing={standing.state} title={standing.title}>{standing.label}</span>
}

/** The QL owner's body as the device's picture: the owner's standing on top, then the body unchanged. The one write the stage channel
 * carries for it (sound) is the body's own control; hold and recover have no path in this host and are not drawn. */
function QlPicture({size, face, reading, torus}: {size: DeviceSize; face: string; reading: unknown; torus: LiveTorusState | null}) {
  const apply = liveInstrumentWritable(torus)
    ? async (change: QlInstrumentChange) => {
        if (change.operation !== 'set-muted') throw Error(`${change.operation}: the hosted stage channel carries no such operation`)
        const result = await commitLiveInstrumentEdit({kind: 'muted', muted: change.muted})
        if (!result.ok) throw Error(result.error)
      }
    : null
  return <Picture size={size} face={face}>
    <StandingChip reading={reading} />
    <QlInstrumentBody reading={reading} apply={apply}
      renderControl={path => path === 'muted' ? <QlInstrumentControl path="muted" reading={reading} apply={apply} /> : null} />
  </Picture>
}

/** A waiting face's picture: its mark from the cut, dim. Nothing is drawn that the owner has not landed. */
function WaitingPicture({size, face}: {size: DeviceSize; face: InhabitantFaceDeclaration}) {
  return <Picture size={size} face={face.id}><span className="techne-waiting" data-waiting="true"><Icon name={TECHNE_FACE_ICONS[face.id] ?? 'form'} size={size === 'compact' ? 24 : 40} /></span></Picture>
}

/** The devices of the given manifests' faces, over the owners' readings. Pure: the chain, the tests and the door all read this. */
export function techneEntries(manifests: readonly InhabitantManifest[], readings: TechneReadings): TechneEntry[] {
  // A Technē chain device is an instrument, never an effect (lock §5.2): a family's effects (the Resonator bank) stand on Live's chain.
  return manifests.flatMap(manifest => manifest.faces.filter(face => face.liveSemantic !== 'device-audio-fx')
    .filter(face => !(manifest.id === KNOWLEDGE_FAMILY && KNOWLEDGE_FACES_CARRIED.includes(face.id))).map((face): TechneEntry => {
    const waiting = face.admission === 'waiting'
    if (manifest.id === QL_FAMILY) return qlFaceEntry(face, readings.torus, readings.instrumentReading, readings.sky, readings.m3, readings.deck, readings.chakra,
      {modes: readings.modes, held: readings.held, m1: readings.m1, centres: readings.centres, cast: readings.cast, racks: readings.racks, kernel: readings.kernel, presences: readings.presences})
    if (!waiting && manifest.id === ATLAS_FAMILY && isAtlasFaceId(face.id)) {
      const faceId = face.id
      return {family: manifest.id, face, device: atlasDevice(face, readings.atlas), picture: size => <Picture size={size} face={faceId}><AtlasFaceBody faceId={faceId} /></Picture>,
        // The World's designed face (its Body page among them) over the atlas's own readings and the body record (T-WORLDS W3).
        ...(faceId === 'globe-engine' ? {binding: atlasGlobeBinding(readings.atlas)} : {})}
    }
    if (!waiting && manifest.id === KNOWLEDGE_FAMILY && isKnowledgeFaceId(face.id)) {
      const faceId = face.id
      return {family: manifest.id, face, device: knowledgeDevice(face, readings.surface), picture: size => <Picture size={size} face={faceId}><KnowledgeFaceBody faceId={faceId} /></Picture>}
    }
    return {family: manifest.id, face, device: waitingDevice(face, manifest.id), picture: size => <WaitingPicture size={size} face={face} />}
  }))
}

/** The catalogue designs that stand on these holders' chains, each on its binding (techne/devices/techneDesigns.ts), in the chains' order.
 * A design whose binding is not handed stands nowhere. */
export function designEntries(holders: readonly string[], bindings: Readonly<Record<string, DesignBinding>> | undefined): TechneEntry[] {
  if (!bindings) return []
  return designsOn(holders).flatMap(design => {
    const device = DESIGN_DEVICES.get(design), face = DESIGN_FACES.get(design), binding = bindings[design]
    return device && face && binding ? [{family: device.family, face, device, binding, picture: () => null}] : []
  })
}

/** An instrument's chain on the rack: its design at the head, then its effects (TECHNE_CHAINS). */
export function chainOf(holder: string, designs: readonly TechneEntry[]): {head: TechneEntry | null; effects: TechneEntry[]} {
  const chain = TECHNE_CHAINS[holder]
  const find = (design: string) => designs.find(entry => entry.device.id === design) ?? null
  return {head: chain?.head ? find(chain.head) : null, effects: (chain?.effects ?? []).flatMap(design => find(design) ?? [])}
}

/** The M3 clock's Binding skin (catalogue quaternal-logic__m3-clock.tsx `binding.` keys): Binding's own keys under `binding.`, sharing none. */
const BINDING_SKIN: CarriedPage = {prefix: 'binding.', shared: []}

/** One Quaternal Logic face as a device: the field/PCM owner over its reading, any other face as the waiting device it is declared.
 * The Expressions Studio's Body · 3:3 holds two of them (sdk/semantics.ts STUDIO_SECTIONS) and draws them from here. */
export function qlFaceEntry(face: InhabitantFaceDeclaration, torus: LiveTorusState | null, instrumentReading: unknown, sky?: QlSkyState, m3?: QlM3State,
  deck?: QlDeckState, chakra?: QlChakraState, more: {modes?: QlModes; held?: TechneReadings['held']; m1?: QlM1State; centres?: QlCentresState; cast?: DeckCastState; racks?: TechneReadings['racks']; kernel?: KernelApplyState; presences?: SkyPresences} = {}): TechneEntry {
  // The Sky draws its catalogue design on the dated sky the kernel reads (qlSky.ts); its picture is the design's own ring.
  if (face.id === QL_SKY_FACE && sky) return {family: QL_FAMILY, face, device: qlSkyDevice(face, sky), binding: qlSkyBinding(sky, more.racks?.[2], more.presences), picture: () => null}
  const held = (id: string) => more.held?.[id] ?? heldFor(id)
  // The M3 clock draws its catalogue design on the person's M3 form (qlM3Clock.ts), and carries its Binding skin under `binding.` (manual §22.3
  // "The Binding skin", which took in §22.8's Binding device in the 22 Oct manual rewrite): Binding's own binding over the same form, with its
  // own physics and choices held as before (qlBinding.ts).
  if (face.id === QL_M3_FACE && m3) {
    const binding = carryPages(qlM3Binding(m3, more.racks?.[3]), [{page: BINDING_SKIN, binding: qlBindingBinding({m3, held: held(QL_BINDING_DEVICE_ID)})}])
    return {family: QL_FAMILY, face, device: qlM3Device(face, m3), binding, picture: () => null}
  }
  // The Deck draws its catalogue design on the open journey (qlDeck.ts); the Chakra on your elements (qlChakra.ts).
  if (face.id === QL_DECK_FACE && deck) return {family: QL_FAMILY, face, device: qlDeckDevice(face, deck), binding: qlDeckBinding(deck, m3, more.cast), picture: () => null}
  if (face.id === QL_CHAKRA_FACE && chakra) return {family: QL_FAMILY, face, device: qlChakraDevice(face, chakra), binding: qlChakraBinding(chakra, sky, more.centres), picture: () => null}
  // The M′ matrices draw on the mode catalogue, the mode in force and the M3 form (qlMatrices.ts), keeping their own settings in the view's
  // holds. (The Sitting and Binding were retired as faces of their own in the 22 Oct manual rewrite: a sitting is a clip of the practice
  // world's track, §24.3; Binding is the M3 clock's skin, above.)
  if (face.id === QL_MATRICES_FACE && m3 && more.modes) {
    return {family: QL_FAMILY, face, device: qlMatricesDevice(face), binding: qlMatricesBinding({m3, modes: more.modes, held: held(QL_MATRICES_DEVICE_ID), ...(more.m1 ? {m1: more.m1} : {}), ...(more.kernel ? {kernel: more.kernel} : {})}), picture: () => null}
  }
  if (face.admission !== 'waiting' && face.id === QL_INSTRUMENT_FACE) {
    return {family: QL_FAMILY, face, device: qlInstrumentDevice(face, torus), status: <StandingChip reading={instrumentReading} />,
      picture: size => <QlPicture size={size} face={face.id} reading={instrumentReading} torus={torus} />}
  }
  return {family: QL_FAMILY, face, device: waitingDevice(face, QL_FAMILY), picture: size => <WaitingPicture size={size} face={face} />}
}

/** The one mounted atlas and the lens bar's view, re-read on the atlas's own notices (the clock's, the controller's), never on a poll. */
function useAtlasReading(): AtlasReading {
  const handle = useAtlasHandle()
  const view = useAtlasView()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!handle) return
    const bump = () => setTick(count => count + 1)
    const offClock = handle.time.subscribe(bump)
    const offFaces = handle.ctl.subscribeFaces(bump)
    return () => { offClock(); offFaces() }
  }, [handle])
  // the tick is the atlas's own change notice: the reading is taken again when it comes
  return useMemo(() => atlasReading(handle, view), [handle, view, tick])
}

function useKnowledgeSurface(): KnowledgeGraphSurface | null {
  return useSyncExternalStore(subscribeKnowledgeGraph, knowledgeGraphSurface, knowledgeGraphSurface)
}

/** Publish each device to the door by id, remembering what this chain published. */
export function publishTechneEntries(entries: readonly TechneEntry[], mine: Map<string, DeviceInstance>): void {
  for (const entry of entries) {
    publishDevice(entry.device.id, {device: entry.device, picture: entry.picture, ...(entry.binding ? {binding: entry.binding} : {})})
    mine.set(entry.device.id, entry.device)
  }
}

/** Withdraw what this chain published and nothing newer replaced (another chain of the same device keeps its own). */
export function withdrawTechneEntries(mine: Map<string, DeviceInstance>): void {
  for (const [id, device] of mine) if (publishedDevice(id)?.device === device) publishDevice(id, null)
  mine.clear()
}

/** Publish the chain's devices while it stands, so the pool and a pane read the same devices by id. */
function usePublished(entries: readonly TechneEntry[]): void {
  const mine = useRef(new Map<string, DeviceInstance>())
  useEffect(() => { publishTechneEntries(entries, mine.current) }, [entries])
  useEffect(() => {
    const held = mine.current
    return () => withdrawTechneEntries(held)
  }, [])
}

/** The holders the rack stands, in order: the six Technē instruments; or, when the focus is another holder — the knowledge graph, a
 * standalone instrument and not one of the six (lock §8.1), or a Studio section such as Body · 3:3 — that holder alone, open. */
export function rackInstruments(focusInstrument: string | null): readonly HolderDeclaration[] {
  if (!focusInstrument || TECHNE_INSTRUMENTS.some(holder => holder.id === focusInstrument)) return TECHNE_INSTRUMENTS
  const other = HOLDERS.find(holder => holder.id === focusInstrument)
  return other ? [other] : TECHNE_INSTRUMENTS
}

/** The marks of the cut each instrument wears, as the lens bar and the browser's instrument rows give them (shell/ModeDetail.tsx
 * LENSES, frame/instruments.ts). */
const INSTRUMENT_MARKS: Readonly<Record<string, IconName>> = {
  'techne:m0': 'lib', 'techne:m1': 'form', 'techne:m2': 'arrangement', 'techne:m3': 'journey', 'techne:m4': 'placed', 'techne:m5': 'palace',
  'knowledge-graph': 'search', 'studio:body': 'expr',
}

/** The plain names of the families whose devices an instrument holds — a family id is not a name. */
const FAMILY_NAMES: Readonly<Record<string, string>> = {
  [QL_FAMILY]: 'Quaternal Logic', [ATLAS_FAMILY]: 'Earth atlas', [KNOWLEDGE_FAMILY]: 'Knowledge graph',
}

/** The instruments the atlas is (T-PLACES-ONTO-ATLAS, T-PALACES-ONTO-ATLAS): the 0 instrument, the Earth and solar system with its graph
 * (shell/paneInstrument.ts); World / Places — "Places is the Archetypal-Earth atlas, alone" (owner, 14 Oct; FOUNDATION §4); and the
 * Palace / Integral Whole — "Palaces live in the atlas … There is no separate palace surface" (FOUNDATION §3 N4). The frame's own Places
 * and Palace lenses retire, so World / Places and the Palace open the atlas, never the stage. */
const ATLAS_INSTRUMENTS: readonly string[] = [instrumentOfPane('projection.earth', null, 'earth') ?? 'techne:m0', 'techne:m4', 'techne:m5']

/** The atlas instrument the rack stands open while a palace is entered: the Palace, whose plate holds the palace's controls (the atlas's
 * palace scale is the Palace's, lock §2.5 "scales system · body · region · palace"). A registration by the atlas's own state, never a mode branch. */
export function atlasInstrumentNow(focus: string | null, palace: 'outside' | 'entering' | 'inside'): string | null {
  return focus && ATLAS_INSTRUMENTS.includes(focus) && palace !== 'outside' ? 'techne:m5' : focus
}

/** Where an instrument opens on the focused pane: the pane kind that holds it (the Earth pane holds the atlas's instruments) and, for
 * the hosted stage, the lens it turns to (HOSTED_INSTRUMENT, read backwards). */
export function instrumentDoorOf(id: string): {kind: string; lens?: HostedLens} | null {
  if (ATLAS_INSTRUMENTS.includes(id)) return {kind: 'projection.earth'}
  const lens = (Object.keys(HOSTED_INSTRUMENT) as HostedLens[]).find(key => HOSTED_INSTRUMENT[key] === id)
  return lens ? {kind: 'projection.expressions', lens} : null
}

/** Open an instrument on the focused pane through the one door; a refusal is said on the door's fault line (the browser's Instruments
 * section says it, in the owner's words — frame/instrumentDoor.ts). */
function openOnFocusedPane(id: string): void {
  const door = instrumentDoorOf(id)
  if (!door) { reportInstrumentFault('This instrument has no pane to open in yet.'); return }
  try {
    reportInstrumentFault(null)
    openInstrument(door.kind)
    if (door.lens) driveStageLens(door.lens, reportInstrumentFault)
  } catch (cause) {
    reportInstrumentFault(cause instanceof Error ? cause.message : String(cause))
  }
}

/** The instrument the focused pane stands once a fold's press has opened its door: the Earth pane's for the atlas's instruments (the
 * one already focused when it is the atlas's), the pressed lens itself on the stage. A press holds across the focus change it causes —
 * lane T, 15 Oct (code-reading): pressing World / Places while another pane was focused opened the Earth, the focus moved to the Project,
 * and World / Places folded
 * again, so a second press was needed. */
export function focusAfterOpening(id: string, current: string | null): string | null {
  const door = instrumentDoorOf(id)
  if (!door) return current
  if (door.kind === 'projection.earth') return current && ATLAS_INSTRUMENTS.includes(current) ? current : instrumentOfPane('projection.earth', null, 'earth') ?? current
  return id
}

const holderTitle = (holder: HolderDeclaration) => holder.title
const holds = (entry: TechneEntry, holder: string) => (entry.face.heldBy ?? []).includes(holder)

/** One device standing open on the chain, compact through the runtime, with the marks its place gives it. */
function OpenDevice({entry, place}: {entry: TechneEntry; place?: 'head' | 'effect'}) {
  const {device, face} = entry
  const title = device.face.title
  return <div className="techne-device" data-face-id={face.id} data-expanded="true" data-family={device.family} data-device-id={device.id} data-chain-place={place}>
    <DeviceView device={device} size="compact" binding={entry.binding} picture={entry.picture('compact')} actions={[
      {icon: 'detail', label: `Select ${title}: the keys and the status bar speak to it; its expanded view stands whole above the chain`, onPress: () => selectDevice(device.id)},
      {icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: device.id, title})},
    ]} />
  </div>
}

/** The kit's activator for a device's own light (manual §16.9: amber on, grey off, hollow while the owner has not said). */
const kitLight = (light: 'on' | 'off' | 'unknown') => (light === 'on' ? 'lit' : light === 'off' ? 'dark' : 'unknown')

/** A device folded to its title: the kit's Folded strip (manual §16.3 "Folded — the activator, the name, up to two short readings, read
 * downward"), its standing as its reading where it waits; pressing its title opens it. */
function FoldedDevice({entry, onOpen}: {entry: TechneEntry; onOpen: () => void}) {
  const {device, face} = entry
  return <div className="techne-device" data-face-id={face.id} data-expanded="false" data-family={device.family} data-device-id={device.id}>
    <Folded title={device.face.title} light={kitLight(lightOf(device))} readings={face.admission === 'waiting' ? ['waiting'] : []} onUnfold={onOpen} />
  </div>
}

/** A device the open instrument holds, as a section of its plate draws it: its picture, its mark and the place's marks. */
function sectionDeviceOf(entry: TechneEntry): SectionDevice & {face: string} {
  const {device, face} = entry
  const title = device.face.title
  return {device, face: face.id, mark: TECHNE_FACE_ICONS[face.id] ?? 'form', picture: entry.picture('compact'), actions: [
    {icon: 'detail', label: `Select ${title}: the keys and the status bar speak to it; its expanded view stands whole above the chain`, onPress: () => selectDevice(device.id)},
    {icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: device.id, title})},
  ]}
}

/** The instruments whose plate is their own (a registration by holder, never a mode branch): the Project, the Earth and its graph as one
 * plate — the globe, Graph tools, Earth ⇄ Graph and Deep time drawn as its sections, and the stage's own controls while the stage stands in
 * its project lens (ProjectPlate.tsx); the Canvas, the Timeline and the Journey, the hosted stage's instruments in the
 * manual's groups (projections/stageInstruments/StageInstrumentPlate.tsx STAGE_OWN_PLATES); World / Places, the atlas's planet plate
 * (projections/atlas/places/PlacesPlate.tsx); the Palace / Integral Whole, the palace's controls — its rooms, path, guide, whole,
 * composition, portals and Return (projections/atlas/palaces/PalacePlate.tsx). Every other instrument stands as its families' plate. */
const OWN_PLATES: Readonly<Record<string, (props: OwnPlateProps) => ReactNode>> = {
  'techne:m0': props => <ProjectPlate {...props} />,
  'techne:m4': props => <PlacesPlate {...props} />,
  'techne:m5': props => <PalacePlate {...props} />, ...STAGE_OWN_PLATES,
}

/** What the rack hands an instrument's own plate: the devices it holds, whether it is the focused pane's, the families' columns, and its
 * head's two acts — ▾ folds it to its title, ⤢ opens it on the focused pane. */
export interface OwnPlateProps {
  readonly held: readonly (SectionDevice & {face: string})[]
  readonly focused: boolean
  readonly families: readonly PlateSection[]
  readonly onFold?: () => void
  readonly onFull?: () => void
}

/** The open instrument: its chain — its design at the head, its plate (the families whose devices it holds, or its own), its effects. */
function OpenInstrument({holder, entries, chain, focused, onFold, onFull}: {holder: HolderDeclaration; entries: readonly TechneEntry[]; chain: ReturnType<typeof chainOf>; focused: boolean; onFold?: () => void; onFull?: () => void}) {
  const head = chain.head ? <OpenDevice key={chain.head.device.id} entry={chain.head} place="head" /> : null
  const effects = chain.effects.map(entry => <OpenDevice key={entry.device.id} entry={entry} place="effect" />)
  const plate = <InstrumentBody holder={holder} entries={entries} headed={!!head} focused={focused} onFold={onFold} onFull={onFull} />
  return <>{head}{plate}{effects}</>
}

/** The instrument's plate: its own where it has one, else one plate whose columns are the families whose devices it holds; nothing where a
 * design heads the chain and no family holds a device here. */
function InstrumentBody({holder, entries, headed, focused, onFold, onFull}: {holder: HolderDeclaration; entries: readonly TechneEntry[]; headed: boolean; focused: boolean; onFold?: () => void; onFull?: () => void}) {
  // Each family's devices stand side by side in its section, drawn flat there (techneDevices.css: the device's frame stands down, one
  // hairline between two devices) — never a boxed plate inside the plate.
  const families = [...new Set(entries.map(entry => entry.family))].map(family => ({id: family, title: FAMILY_NAMES[family] ?? family,
    note: entries.some(entry => entry.family === family && entry.face.admission === 'waiting') ? 'waiting' : undefined,
    children: <div className="techne-section-devices">{entries.filter(entry => entry.family === family).map(entry => <OpenDevice key={entry.device.id} entry={entry} />)}</div>}))
  // An own plate gets the family columns too, to stand after its own sections: the stage instruments' held faces stay open beside the
  // frame's controls (T-FRAME-CHROME-ONTO-PLATES), as they stood when the family columns were the whole plate.
  const own = OWN_PLATES[holder.id]
  if (own) return <>{own({held: entries.map(sectionDeviceOf), focused, families, onFold, onFull})}</>
  if (headed && !families.length) return null
  const owner = [holder.provenance, TECHNE_INSTRUMENTS.includes(holder) ? 'Technē' : null, focused ? 'open on the focused pane' : 'opened here'].filter(Boolean).join(' · ')
  return <InstrumentPlate presentation={{family: 'techne', faceId: holder.id, title: holderTitle(holder), icon: INSTRUMENT_MARKS[holder.id] ?? 'techne', owner}}
    onFold={onFold} onFull={onFull} fullLabel={`Open ${holderTitle(holder)} on the focused pane`}
    dataAttributes={{'data-instrument': holder.id, 'data-expanded': 'true'}}
    sections={families.length ? families : [{id: 'none', title: 'Controls', children: <SectionNote word="none">No family declares a device this instrument holds yet.</SectionNote>}]} />
}

/** An instrument folded to its title: the kit's Folded strip (the mockup's folds, world-shell-mockup.html:153 .ifold), its one reading the
 * holder's provenance where it has one (the Studio's Body: M1+M2+M3) — Technē's instruments carry no M′ number, so theirs is the name
 * alone; pressing its title opens it on the focused pane. */
function InstrumentFold({holder, count, onOpen}: {holder: HolderDeclaration; count: number; onOpen: () => void}) {
  return <div className="techne-instrument" data-instrument={holder.id} data-expanded="false" data-device-count={count} data-rack="strip"
    data-i={`${holder.title}|${holder.provenance ? `${holder.provenance} · ` : ''}${count ? `${count} device${count === 1 ? '' : 's'}` : 'no device declared yet'}. Click to open it on the focused pane.`}>
    <Folded title={holderTitle(holder)} light="unknown" readings={holder.provenance ? [holder.provenance] : []} onUnfold={onOpen} />
  </div>
}

/** The width a Compact instrument stands at before it is measured (techneDevices.css .techne-compact). */
const COMPACT_WIDTH = 228

/** Which instruments stand at their Compact size (manual §16.1 "Compact | In a chain | Play the device"), the rest folded to their titles:
 * the open plate first at the width its sections ask (InstrumentPlate.tsx `data-natural-width`), every other device as it stands, then
 * the Compacts nearest the open plate — or in their order when none is open — while the row has room. The row never scrolls: a Compact
 * that does not fit is its fold, pressed to open the instrument as before. Measured where the row stands, again on any resize. */
function useRackFit(compacts: readonly string[], order: readonly string[]): {ref: RefObject<HTMLDivElement>; shown: ReadonlySet<string>} {
  const ref = useRef<HTMLDivElement>(null)
  const widths = useRef(new Map<string, number>())
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set())
  const key = `${compacts.join('|')}>${order.join('|')}`
  useEffect(() => {
    const row = ref.current
    if (!row) return
    const fit = () => {
      const style = getComputedStyle(row)
      const gap = Number.parseFloat(style.columnGap) || 0
      const available = row.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0)
      let fixed = 0, strip = 26
      const items = [...row.children] as HTMLElement[]
      for (const item of items) {
        const width = item.getBoundingClientRect().width
        if (item.dataset.rack === 'compact' && item.dataset.instrument) { widths.current.set(item.dataset.instrument, width); continue }
        if (item.dataset.rack === 'strip') { if (compacts.includes(item.dataset.instrument ?? '')) { strip = width || strip; continue } }
        const natural = item.classList.contains('inst-plate') ? Number(item.dataset.naturalWidth) : NaN
        fixed += Number.isFinite(natural) && natural > 0 ? natural + 2 : width
      }
      let total = fixed + compacts.length * strip + Math.max(0, items.length - 1) * gap
      const next = new Set<string>()
      for (const id of order) {
        const width = widths.current.get(id) ?? COMPACT_WIDTH
        if (total + width - strip <= available) { next.add(id); total += width - strip }
      }
      setShown(previous => sameSet(previous, next) ? previous : next)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const resized = new ResizeObserver(fit)
    resized.observe(row)
    // the open plate's natural width arrives with its own fit, as an attribute
    const asked = typeof MutationObserver === 'undefined' ? null : new MutationObserver(fit)
    asked?.observe(row, {subtree: true, attributes: true, attributeFilter: ['data-natural-width']})
    return () => { resized.disconnect(); asked?.disconnect() }
  }, [key])
  return {ref, shown}
}

export function TechneDevices({manifests, focusInstrument = null, instrumentReading}: {
  manifests: readonly InhabitantManifest[]
  /** The focused pane's instrument (a `techne:*` holder id, or `knowledge-graph`): it stands open, the others fold. */
  focusInstrument?: string | null
  /** The QL owner's reading as the host received it (raw; the body parses it). */
  instrumentReading: unknown
}) {
  const atlas = useAtlasReading()
  const surface = useKnowledgeSurface()
  const torus = useLiveTorusReading()
  const sky = useQlSky()
  const m3 = useQlM3()
  const deck = useQlDeck()
  const chakra = useQlChakra()
  // The M′ matrices' Reading: the kernel's mode catalogue (read once per session) and the transport's mode as held.
  const modeReading = useLiveModeCatalogue().reading
  const modeHold = useLiveModeHold()
  const modes = useMemo(() => ({reading: modeReading, hold: modeHold}), [modeReading, modeHold])
  const held = useHolds()
  // The Oscillator's cells, read from QL's M1 engine once you choose a family on the matrices (qlM1.ts).
  const m1 = useQlM1(held[QL_MATRICES_DEVICE_ID]?.['m1.family'])
  // The Kernel page: the kernel's operators on the address the matrices hold (qlKernelApply.ts).
  const kernel = useKernelApply(held[QL_MATRICES_DEVICE_ID])
  const presences = useSkyPresences()
  // Today's centres: QL's scene of the sky the Sky shows, composed once per sky (qlCentres.ts).
  const centres = useQlCentres(sky)
  // The Deck's cast hexagram's cell: QL's generation law at the cast, asked of the person's M3 state (qlDeck.ts).
  const cast = useQlDeckCast(deck, m3)
  // M2′'s and M3′'s racks, read once from the map's ledger for the Sky's and the M3 clock's Rack pages (qlRack.ts).
  const rack2 = useQlRack(2), rack3 = useQlRack(3)
  const racks = useMemo(() => ({2: rack2, 3: rack3}) as const, [rack2, rack3])
  const instruments = rackInstruments(focusInstrument)
  const holderKey = instruments.map(holder => holder.id).join('|')
  // The catalogue designs on their owners; the kernel's graph is read only while the Knowledge graph stands on this rack.
  const bindings = useTechneDesignBindings({graph: instruments.some(holder => holder.id === 'knowledge-graph'), surface})
  const designs = useMemo(() => designEntries(holderKey.split('|'), bindings), [holderKey, bindings])
  const manifestKey = manifests.map(manifest => manifest.id).join('|')
  // The manifests are the door's, named by their ids; the QL reading the caller hands in is the one reader's own, derived from the same
  // `torus` state in the same render, so it changes exactly when `torus` does (its absent form is a new object each call, and would
  // otherwise re-publish every device on every render).
  const entries = useMemo(() => techneEntries(manifests, {atlas, surface, torus, instrumentReading, sky, m3, deck, chakra, modes, held, m1, centres, cast, racks, kernel, presences}),
    [manifestKey, atlas, surface, torus, sky, m3, deck, chakra, modes, held, m1, centres, cast, racks, kernel, presences])
  const published = useMemo(() => [...entries, ...designs], [entries, designs])
  usePublished(published)
  // The instrument opened here (a fold pressed) holds until the focus changes; a new focus stands its own instrument open. While a palace
  // is entered the atlas stands at its palace scale, so the Earth pane's instrument stands as the Palace (atlasInstrumentNow).
  const palace = useSyncExternalStore(subscribePalace, () => palaceState().phase, () => palaceState().phase)
  // `id` null: the person folded the open instrument by its ▾, so none stands open until a fold or a Compact is pressed.
  const [opened, setOpened] = useState<{focus: string | null; id: string | null} | null>(null)
  // Entering a palace stands the Palace open over whatever atlas fold was pressed; leaving keeps it open, its plate back on the world's palaces.
  const wasInside = useRef(palace !== 'outside')
  useEffect(() => {
    const now = palace !== 'outside'
    if (now === wasInside.current) return
    wasInside.current = now
    if (!focusInstrument || !ATLAS_INSTRUMENTS.includes(focusInstrument)) return
    setOpened(now ? null : {focus: focusInstrument, id: 'techne:m5'})
  }, [palace, focusInstrument])
  const open = opened && opened.focus === focusInstrument ? opened.id : atlasInstrumentNow(focusInstrument, palace)
  // The Device side's head names the instrument standing, not the pane's (standingInstrument.ts).
  useEffect(() => {
    if (!focusInstrument) return
    publishStandingInstrument(focusInstrument, open)
    return () => publishStandingInstrument(focusInstrument, undefined)
  }, [focusInstrument, open])
  // With no instrument open, the faces no instrument holds stand as their own devices; the person's folds of them hold until focus moves.
  const [folds, setFolds] = useState<{focus: string | null; open: Readonly<Record<string, boolean>>}>({focus: focusInstrument, open: {}})
  const unfolded = folds.focus === focusInstrument ? folds.open : {}
  // (With an instrument focused and every one folded by its ▾, the row is the instruments' alone: their Compacts take the room.)
  const unheld = open || focusInstrument ? [] : entries.filter(entry => !instruments.some(holder => holds(entry, holder.id)))
  // The instruments not open stand Compact where the row has room (nearest the open plate first), folded to their titles elsewhere.
  const compacts = instruments.filter(holder => holder.id !== open && hasCompact(holder.id)).map(holder => holder.id)
  const openAt = instruments.findIndex(holder => holder.id === open)
  const order = openAt < 0 ? compacts : [...compacts].sort((a, b) => Math.abs(instruments.findIndex(h => h.id === a) - openAt) - Math.abs(instruments.findIndex(h => h.id === b) - openAt))
  const rack = useRackFit(compacts, order)
  return <div ref={rack.ref} className="techne-devices" data-techne-devices data-device-count={entries.length} data-open-instrument={open ?? undefined}>
    {instruments.map(holder => {
      const held = entries.filter(entry => holds(entry, holder.id))
      const press = () => { setOpened({focus: focusAfterOpening(holder.id, focusInstrument), id: holder.id}); openOnFocusedPane(holder.id) }
      return holder.id === open
        ? <OpenInstrument key={holder.id} holder={holder} entries={held} chain={chainOf(holder.id, designs)} focused={holder.id === focusInstrument}
            onFold={() => setOpened({focus: focusInstrument, id: null})} onFull={() => openOnFocusedPane(holder.id)} />
        : rack.shown.has(holder.id)
          ? <InstrumentCompact key={holder.id} holder={holder} mark={INSTRUMENT_MARKS[holder.id] ?? 'techne'} light="unknown" onOpen={press} />
          : <InstrumentFold key={holder.id} holder={holder} count={held.length} onOpen={press} />
    })}
    {unheld.map(entry => (unfolded[entry.device.id] ?? startsExpanded(entry.face, null))
      ? <OpenDevice key={entry.device.id} entry={entry} />
      : <FoldedDevice key={entry.device.id} entry={entry} onOpen={() => setFolds({focus: focusInstrument, open: {...unfolded, [entry.device.id]: true}})} />)}
  </div>
}
