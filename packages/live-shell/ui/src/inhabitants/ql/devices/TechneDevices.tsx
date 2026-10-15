// The Technē instruments' devices on the Device side (T-DEVICES-TECHNE; manual §3: "Wherever you are, the instrument in the focused pane
// brings its own controls into the chain"; §10.4: three sizes, one set of live settings). The families' faces — the QL field/PCM owner and
// its waiting kin, the atlas's four faces, the knowledge graph's three — stand on the chain as compact devices through DeviceView: the
// face's own body is its picture, and up to four controls sit under it. Each device is published to the device door by id, so choosing
// one shows it whole in the pool under the browser and opening it full puts it in a pane, with the same live settings in all three.
//
// The rack is the instruments (lock §2.5: "drawn as one instrument frame with sections; the focused lens expanded, the others folded";
// the mockup's Technē device side, world-shell-mockup.html:1647-1650 and :1442-1461): the six Technē instruments in their order, each
// folded to its title by the runtime's own fold (FacePlate folded — manual §10.4 "A device can also fold down to its title. Click the
// title to open it again"), around the ONE open instrument: the focused pane's, drawn as one plate whose columns are the families whose
// devices it holds. Clicking a folded instrument opens it on the focused pane through the instrument door (the mockup's `data-instr`),
// and stands it open here whatever the door answers. With no instrument focused, the faces no Technē instrument holds (the QL field/PCM
// owner and its waiting kin) stand after the folds as they did before: the admitted one open, the waiting ones folded.
import {useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react'
import {DeviceView} from '../../../frame/devices/DeviceView'
import {publishDevice, publishedDevice, selectDevice} from '../../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../../frame/devices/devicePane'
import {driveStageLens, openInstrument, reportInstrumentFault} from '../../../frame/instrumentDoor'
import {InstrumentPlate, SectionNote, type SectionDevice} from '../../../frame/devices/InstrumentPlate'
import {HOSTED_INSTRUMENT, instrumentOfPane, type HostedLens} from '../../../shell/paneInstrument'
import {HOLDERS, TECHNE_INSTRUMENTS, type HolderDeclaration} from '../../sdk/semantics'
import type {IconName} from '../../sdk/icons'
import {lightOf, type DeviceInstance, type DeviceSize} from '../../../frame/devices/deviceRuntime'
import {commitLiveInstrumentEdit, liveInstrumentWritable, useLiveTorusReading, type LiveTorusState} from '../../../live/torusInstrument'
import {useAtlasHandle, useAtlasView} from '../../../projections/atlas/AtlasProjectionPanel'
import {PlacesPlate} from '../../../projections/atlas/places/PlacesPlate'
import {knowledgeGraphSurface, subscribeKnowledgeGraph} from '../../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import type {KnowledgeGraphSurface} from '../../../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {FacePlate} from '../../sdk/controls'
import {Icon} from '../../sdk/Icon'
import type {InhabitantFaceDeclaration, InhabitantManifest} from '../../manifest'
import {AtlasFaceBody, isAtlasFaceId} from '../../atlasFaceBodies'
import {KnowledgeFaceBody, isKnowledgeFaceId} from '../../knowledgeGraphFaceBodies'
import {QlInstrumentBody, QlInstrumentControl, qlInstrumentStanding, type QlInstrumentChange} from '../../qlInstrumentDevice'
import {atlasDevice, atlasReading, ATLAS_FAMILY, type AtlasReading} from './atlasDevices'
import {knowledgeDevice, KNOWLEDGE_FAMILY} from './knowledgeDevices'
import {qlInstrumentDevice, waitingDevice, QL_FAMILY, QL_INSTRUMENT_FACE} from './qlDevices'
import {startsExpanded, TECHNE_FACE_ICONS} from './faces'
import './techneDevices.css'

/** What the devices are read from: the one mounted atlas, the open graph, the QL owner's reading — each the same reader its body reads. */
export interface TechneReadings {
  readonly atlas: AtlasReading
  readonly surface: KnowledgeGraphSurface | null
  readonly torus: LiveTorusState | null
  /** The QL owner's reading as the host received it (raw; the body parses it). */
  readonly instrumentReading: unknown
}

/** One face on the chain: its declaration, the device the runtime draws, and the device's own picture at each size. */
export interface TechneEntry {
  readonly family: string
  readonly face: InhabitantFaceDeclaration
  readonly device: DeviceInstance
  readonly picture: (size: DeviceSize) => ReactNode
  /** What a folded device still says on its title: the owner's standing, where the owner has one. */
  readonly status?: ReactNode
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
  return manifests.flatMap(manifest => manifest.faces.map((face): TechneEntry => {
    const waiting = face.admission === 'waiting'
    if (manifest.id === QL_FAMILY) return qlFaceEntry(face, readings.torus, readings.instrumentReading)
    if (!waiting && manifest.id === ATLAS_FAMILY && isAtlasFaceId(face.id)) {
      const faceId = face.id
      return {family: manifest.id, face, device: atlasDevice(face, readings.atlas), picture: size => <Picture size={size} face={faceId}><AtlasFaceBody faceId={faceId} /></Picture>}
    }
    if (!waiting && manifest.id === KNOWLEDGE_FAMILY && isKnowledgeFaceId(face.id)) {
      const faceId = face.id
      return {family: manifest.id, face, device: knowledgeDevice(face, readings.surface), picture: size => <Picture size={size} face={faceId}><KnowledgeFaceBody faceId={faceId} /></Picture>}
    }
    return {family: manifest.id, face, device: waitingDevice(face, manifest.id), picture: size => <WaitingPicture size={size} face={face} />}
  }))
}

/** One Quaternal Logic face as a device: the field/PCM owner over its reading, any other face as the waiting device it is declared.
 * The Expressions Studio's Body · 3:3 holds two of them (sdk/semantics.ts STUDIO_SECTIONS) and draws them from here. */
export function qlFaceEntry(face: InhabitantFaceDeclaration, torus: LiveTorusState | null, instrumentReading: unknown): TechneEntry {
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
    publishDevice(entry.device.id, {device: entry.device, picture: entry.picture})
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

/** The instruments the atlas is (T-PLACES-ONTO-ATLAS): the 0 instrument, the Earth and solar system with its graph (shell/
 * paneInstrument.ts), and M4′ World / Places — "Places is the Archetypal-Earth atlas, alone" (owner, 14 Oct; FOUNDATION §4). The
 * frame's own Places lens retires, so M4′ opens the atlas, never the stage. */
const ATLAS_INSTRUMENTS: readonly string[] = [instrumentOfPane('projection.earth', null, 'earth') ?? 'techne:m0', 'techne:m4']

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
 * lane T, 15 Oct (code-reading): pressing M4′ while another pane was focused opened the Earth, the focus moved to M0, and M4′ folded
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
function OpenDevice({entry}: {entry: TechneEntry}) {
  const {device, face} = entry
  const title = device.face.title
  return <div className="techne-device" data-face-id={face.id} data-expanded="true" data-family={device.family} data-device-id={device.id}>
    <DeviceView device={device} size="compact" picture={entry.picture('compact')} actions={[
      {icon: 'detail', label: `Show every setting of ${title} in the pool`, onPress: () => selectDevice(device.id)},
      {icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: device.id, title})},
    ]} />
  </div>
}

/** A device folded to its title by the runtime's own fold: the plate's strip, its light and name; pressing it opens it. */
function FoldedDevice({entry, onOpen}: {entry: TechneEntry; onOpen: () => void}) {
  const {device, face} = entry
  return <div className="techne-device" data-face-id={face.id} data-expanded="false" data-family={device.family} data-device-id={device.id}>
    <FacePlate presentation={{family: device.family, faceId: face.id, title: device.face.title, icon: device.face.icon, owner: device.family}}
      power={lightOf(device)} admission={face.admission} folded onFold={onOpen} />
  </div>
}

/** A device the open instrument holds, as a section of its plate draws it: its picture, its mark and the place's marks. */
function sectionDeviceOf(entry: TechneEntry): SectionDevice & {face: string} {
  const {device, face} = entry
  const title = device.face.title
  return {device, face: face.id, mark: TECHNE_FACE_ICONS[face.id] ?? 'form', picture: entry.picture('compact'), actions: [
    {icon: 'detail', label: `Show every setting of ${title} in the pool`, onPress: () => selectDevice(device.id)},
    {icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: device.id, title})},
  ]}
}

/** The instruments whose plate is their own (a registration by holder, never a mode branch): M4′ World / Places, the atlas's planet
 * plate in the mockup's six sections (projections/atlas/places/PlacesPlate.tsx). Every other instrument stands as the plate of the
 * families whose devices it holds. */
const OWN_PLATES: Readonly<Record<string, (props: {held: readonly (SectionDevice & {face: string})[]; focused: boolean}) => ReactNode>> = {
  'techne:m4': props => <PlacesPlate {...props} />,
}

/** The open instrument: one plate, its columns the families whose devices it holds, each family's devices side by side. */
function OpenInstrument({holder, entries, focused}: {holder: HolderDeclaration; entries: readonly TechneEntry[]; focused: boolean}) {
  const own = OWN_PLATES[holder.id]
  if (own) return <>{own({held: entries.map(sectionDeviceOf), focused})}</>
  const families = [...new Set(entries.map(entry => entry.family))]
  const owner = [holder.provenance, TECHNE_INSTRUMENTS.includes(holder) ? 'Technē' : null, focused ? 'open on the focused pane' : 'opened here'].filter(Boolean).join(' · ')
  return <InstrumentPlate presentation={{family: 'techne', faceId: holder.id, title: holderTitle(holder), icon: INSTRUMENT_MARKS[holder.id] ?? 'techne', owner}}
    dataAttributes={{'data-instrument': holder.id, 'data-expanded': 'true'}}
    sections={families.length
      ? families.map(family => ({id: family, title: FAMILY_NAMES[family] ?? family,
          note: entries.some(entry => entry.family === family && entry.face.admission === 'waiting') ? 'waiting' : undefined,
          children: <div className="techne-section-devices">{entries.filter(entry => entry.family === family).map(entry => <OpenDevice key={entry.device.id} entry={entry} />)}</div>}))
      : [{id: 'none', title: 'Controls', children: <SectionNote>No family declares a device this instrument holds yet.</SectionNote>}]} />
}

/** An instrument folded to its title: the runtime's fold; pressing it opens it on the focused pane. */
function InstrumentFold({holder, count, onOpen}: {holder: HolderDeclaration; count: number; onOpen: () => void}) {
  return <div className="techne-instrument" data-instrument={holder.id} data-expanded="false" data-device-count={count}
    title={`${holder.provenance ? `${holder.provenance} ` : ''}${holder.title} — ${count ? `${count} device${count === 1 ? '' : 's'}` : 'no device declared yet'}. Click to open it on the focused pane.`}>
    <FacePlate presentation={{family: 'techne', faceId: holder.id, title: holderTitle(holder), icon: INSTRUMENT_MARKS[holder.id] ?? 'techne', owner: holder.provenance ?? 'Technē'}}
      folded onFold={onOpen} />
  </div>
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
  const manifestKey = manifests.map(manifest => manifest.id).join('|')
  // The manifests are the door's, named by their ids; the QL reading the caller hands in is the one reader's own, derived from the same
  // `torus` state in the same render, so it changes exactly when `torus` does (its absent form is a new object each call, and would
  // otherwise re-publish every device on every render).
  const entries = useMemo(() => techneEntries(manifests, {atlas, surface, torus, instrumentReading}), [manifestKey, atlas, surface, torus])
  usePublished(entries)
  // The instrument opened here (a fold pressed) holds until the focus changes; a new focus stands its own instrument open.
  const [opened, setOpened] = useState<{focus: string | null; id: string} | null>(null)
  const open = opened && opened.focus === focusInstrument ? opened.id : focusInstrument
  // With no instrument open, the faces no instrument holds stand as their own devices; the person's folds of them hold until focus moves.
  const [folds, setFolds] = useState<{focus: string | null; open: Readonly<Record<string, boolean>>}>({focus: focusInstrument, open: {}})
  const unfolded = folds.focus === focusInstrument ? folds.open : {}
  const instruments = rackInstruments(focusInstrument)
  const unheld = open ? [] : entries.filter(entry => !instruments.some(holder => holds(entry, holder.id)))
  return <div className="techne-devices" data-techne-devices data-device-count={entries.length} data-open-instrument={open ?? undefined}>
    {instruments.map(holder => {
      const held = entries.filter(entry => holds(entry, holder.id))
      return holder.id === open
        ? <OpenInstrument key={holder.id} holder={holder} entries={held} focused={holder.id === focusInstrument} />
        : <InstrumentFold key={holder.id} holder={holder} count={held.length} onOpen={() => { setOpened({focus: focusAfterOpening(holder.id, focusInstrument), id: holder.id}); openOnFocusedPane(holder.id) }} />
    })}
    {unheld.map(entry => (unfolded[entry.device.id] ?? startsExpanded(entry.face, null))
      ? <OpenDevice key={entry.device.id} entry={entry} />
      : <FoldedDevice key={entry.device.id} entry={entry} onOpen={() => setFolds({focus: focusInstrument, open: {...unfolded, [entry.device.id]: true}})} />)}
  </div>
}
