// The Technē instruments' devices on the Device side (T-DEVICES-TECHNE; manual §3: "Wherever you are, the instrument in the focused pane
// brings its own controls into the chain"; §10.4: three sizes, one set of live settings). The families' faces — the QL field/PCM owner and
// its waiting kin, the atlas's four faces, the knowledge graph's three — stand on the chain as compact devices through DeviceView: the
// face's own body is its picture, and up to four controls sit under it. Each device is published to the device door by id, so choosing
// one shows it whole in the pool under the browser and opening it full puts it in a pane, with the same live settings in all three.
//
// A device folds down to its title; click the title to open it again (manual §10.4). The focused instrument's faces start open and
// the others folded (lock §2.5); with no focus, every admitted face starts open and the waiting ones folded.
import {useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode} from 'react'
import {DeviceView} from '../../../frame/devices/DeviceView'
import {publishDevice, publishedDevice, selectDevice} from '../../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../../frame/devices/devicePane'
import {openInstrument} from '../../../frame/instrumentDoor'
import {lightOf, type DeviceInstance, type DeviceSize} from '../../../frame/devices/deviceRuntime'
import {commitLiveInstrumentEdit, liveInstrumentWritable, useLiveTorusReading, type LiveTorusState} from '../../../live/torusInstrument'
import {useAtlasHandle, useAtlasView} from '../../../projections/atlas/AtlasProjectionPanel'
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
    if (!waiting && manifest.id === QL_FAMILY && face.id === QL_INSTRUMENT_FACE) {
      return {family: manifest.id, face, device: qlInstrumentDevice(face, readings.torus), status: <StandingChip reading={readings.instrumentReading} />,
        picture: size => <QlPicture size={size} face={face.id} reading={readings.instrumentReading} torus={readings.torus} />}
    }
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

function TechneDevice({entry, expanded, onToggle}: {entry: TechneEntry; expanded: boolean; onToggle: () => void}) {
  const {device, face} = entry
  const title = device.face.title
  return <div className="techne-device" data-face-id={face.id} data-expanded={String(expanded)} data-family={device.family} data-device-id={device.id}
    onClick={event => { if ((event.target as HTMLElement).closest('.sdk-face__title')) onToggle() }}>
    {expanded
      ? <DeviceView device={device} size="compact" picture={entry.picture('compact')} actions={[
          {icon: 'detail', label: `Show every setting of ${title} in the pool`, onPress: () => selectDevice(device.id)},
          {icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: device.id, title})},
        ]} />
      : <>
          <FacePlate presentation={{family: device.family, faceId: face.id, title, icon: device.face.icon, owner: device.family}} power={lightOf(device)} admission={face.admission} />
          {entry.status}
          <button type="button" className="techne-device-unfold" aria-expanded={false} aria-label={`Open ${title}`} onClick={onToggle} />
        </>}
  </div>
}

export function TechneDevices({manifests, focusInstrument = null, instrumentReading}: {
  manifests: readonly InhabitantManifest[]
  /** The focused pane's instrument (a `techne:*` holder id, or `knowledge-graph`): the faces it holds start open. */
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
  // The person's folds hold until the focus changes; a new focus stands every face anew.
  const [folds, setFolds] = useState<{focus: string | null; open: Readonly<Record<string, boolean>>}>({focus: focusInstrument, open: {}})
  const open = folds.focus === focusInstrument ? folds.open : {}
  const isOpen = (entry: TechneEntry): boolean => open[entry.device.id] ?? startsExpanded(entry.face, focusInstrument)
  return <div className="techne-devices" data-techne-devices data-device-count={entries.length}>
    {manifests.map(manifest => <section key={manifest.id} className="techne-family" data-family={manifest.id}>
      {entries.filter(entry => entry.family === manifest.id).map(entry =>
        <TechneDevice key={entry.device.id} entry={entry} expanded={isOpen(entry)}
          onToggle={() => setFolds({focus: focusInstrument, open: {...open, [entry.device.id]: !isOpen(entry)}})} />)}
    </section>)}
  </div>
}
