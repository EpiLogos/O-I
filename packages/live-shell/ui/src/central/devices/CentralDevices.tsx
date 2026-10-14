// Central's Device side: the family's devices through the one device runtime (FOUNDATION F5, T-DEVICES-CENTRAL; manual
// §3 "Device view shows the chain … In Central that means the tools at work on the open document", §10.4 "Every device
// comes in three sizes, and all three show the same live settings"). Compact here on the chain — a small live picture and
// the device's controls — whole in the pool when chosen, full in a pane when opened; each published to the device door
// under `central:<face>` so the three sizes read one device, with the one `submit` that writes it.
//
// The pictures and bodies are the family's own, ported unchanged: the Day die draws its die (DayDieNet, the face's own net),
// and each device opened full carries the body its face already had — the Day die's hosted form (DocumentDayDieFace), the
// Nara conversation (NaraConversationFace), the ground hygiene and the impact readings (CentralHygieneDevice,
// CentralImpactDevice) — under the same owners, none reimplemented. The instruments (the die, the conversation) keep their
// Live semantic at every size: their write rows go through the owner paths their bodies already use (centralDeviceWrites.ts).
// The Flow is a clip, not a device: it stands on the Clip side (FlowClip.tsx), off this chain. A device whose aperture is not
// standing says so in its rows and keeps its light dark; no device is a text card.
import {useEffect, useMemo, type ReactNode} from 'react'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {openInstrument} from '../../frame/instrumentDoor'
import {CentralHygieneDevice} from '../../inhabitants/CentralHygieneDevice'
import {CentralImpactDevice} from '../../inhabitants/CentralImpactDevice'
import {DocumentDayDieFace} from '../../inhabitants/DocumentDayDieFace'
import {NaraConversationFace} from '../../inhabitants/ConversationNaraFace'
import type {DeviceWindowHost} from '../../inhabitants/inhabitantRack'
import {faceStandsAlone, inhabitantManifest, type InhabitantFaceDeclaration, type InhabitantManifest} from '../../inhabitants/manifest'
import type {ImpactSubject} from '../../inhabitants/centralImpactModel'
import {KindMark, PopOut} from '../../inhabitants/sdk/marks'
import {popOutApertureFault, type DeviceDetachIdentity} from '../../native/detachedKinds'
import type {DayDocumentStanding} from '../centralVertical'
import {CENTRAL_FAMILY, centralDevice, centralDeviceId, centralPicture, chainFaces, type CentralReads, type CentralWriters} from './centralDeviceModel'
import {centralWriters} from './centralDeviceWrites'
import {DayDieNet} from './DayDieNet'
import {DieFaceList} from './DieFaceList'
import {dieFaceLabel} from './dayDie'
import {useDayDieReading, useNaraReading, useRosterReading, useWorkcellReading, type DayDieAperture} from './useCentralReadings'
import './centralDevices.css'

export interface CentralConversationAperture {
  readonly project: string | null
  readonly expressionRef: string | null
  readonly conversation?: string | null
}

/** Everything the devices read: the apertures (the Day, the conversation, the flow, the impact subject), the Day's owner
 * standing and the owners' readings the hooks hand in. */
export interface CentralDeviceInput {
  readonly transport: KernelTransportStatus
  readonly faces: readonly InhabitantFaceDeclaration[]
  readonly manifest?: InhabitantManifest
  readonly reads: CentralReads
  readonly day: DayDieAperture | null
  readonly conversation: CentralConversationAperture | null
  readonly flow: {readonly location: CentralLocation} | null
  readonly impact: ImpactSubject | null
  readonly projects?: readonly {name?: string; path?: string}[]
  readonly deviceWindows: DeviceWindowHost | null
  /** The owners' write paths the devices hold; absent, they are built over the apertures (centralDeviceWrites.ts). */
  readonly writers?: CentralWriters
  /** Read the owner again after a device wrote (the chain's hooks hand these in). */
  readonly afterWrite?: {readonly day?: () => void; readonly conversation?: () => void}
}

type Size = 'compact' | 'whole' | 'full'

export interface CentralDeviceEntry {
  readonly id: string
  readonly device: DeviceInstance
  readonly picture: (size: Size) => ReactNode
}

/** The device's pop-out, where its face declares one: the native device window the host offers (seam 8). Its identity is the
 * family, the face and the aperture the face reads (inhabitants/inhabitantRack.tsx:186-207 — the rack's own rule). */
export function popOutOf(face: InhabitantFaceDeclaration, input: Pick<CentralDeviceInput, 'manifest' | 'deviceWindows' | 'day' | 'flow' | 'conversation'>): {identity: DeviceDetachIdentity; popped: boolean; fault: string | null} | null {
  const {manifest, deviceWindows} = input
  if (!manifest || !deviceWindows) return null
  const declared = (face.dock ?? ['dock']).includes('pop-out') && (manifest.detachedKinds ?? []).includes('device') && faceStandsAlone(face)
  if (!declared) return null
  const identity: DeviceDetachIdentity = {
    family: CENTRAL_FAMILY, face: face.id,
    aperture: {day: input.day, flow: input.flow, conversation: input.conversation, instrument: null},
  }
  return {identity, popped: deviceWindows.poppedOut(identity), fault: popOutApertureFault(face, identity.aperture)}
}

/** The working body of one device — what its face drew in the rack, under the same owners — or null where the face has none
 * (the readings with no body of their own, and any document whose aperture is not standing). */
function bodyOf(faceId: string, input: CentralDeviceInput): ReactNode | null {
  const {transport, day, conversation, impact, projects} = input
  switch (faceId) {
    case 'day-die': return day ? <DocumentDayDieFace transport={transport} project={day.project} sourceRef={day.sourceRef} documentId={day.documentId} projects={projects} /> : null
    case 'nara-conversation': return <NaraConversationFace transport={transport} project={conversation?.project ?? null} expressionRef={conversation?.expressionRef ?? null} conversation={conversation?.conversation ?? null} />
    case 'ground-hygiene': return <CentralHygieneDevice transport={transport} expanded />
    case 'impact': return impact ? <CentralImpactDevice transport={transport} subject={impact} expanded /> : null
    default: return null
  }
}

function SmallPicture({faceId, reads, size, turn}: {faceId: string; reads: CentralReads; size: Size; turn?: (face: number) => Promise<void>}) {
  const picture = centralPicture(faceId, reads)
  // The die at whole and full is its net over its face list (the mockup's form device); the compact rack keeps the net alone.
  if (picture.kind === 'die') {
    return size === 'compact'
      ? <DayDieNet face={reads.day?.face ?? null} caption={false} />
      : <div className="central-die-picture"><DayDieNet face={reads.day?.face ?? null} caption /><DieFaceList face={reads.day?.face ?? null} turn={turn} /></div>
  }
  return <div className="central-picture" data-central-picture={faceId}>
    <KindMark kind={picture.kind} size={size === 'compact' ? 26 : size === 'whole' ? 40 : 72} title={picture.caption} />
    <small>{picture.caption}</small>
  </div>
}

/** The devices of the Central family as the runtime draws them: one entry per device face the family declares (its clips
 * stand on the Clip side). Each carries the write door its declaration names. */
export function centralDeviceEntries(input: CentralDeviceInput): CentralDeviceEntry[] {
  const writers = input.writers ?? centralWriters({transport: input.transport, day: input.day, conversation: input.conversation, afterWrite: input.afterWrite})
  return chainFaces(input.faces).map(face => {
    const popOut = popOutOf(face, input)
    const device = centralDevice(face, input.reads, writers)
    // The die's face list turns it through the device's own write door (the same one its "Open face" row uses).
    const turn = face.id === 'day-die' && device.submit ? (n: number) => device.submit!([{key: 'face', value: dieFaceLabel(n)}]) : undefined
    return {
      id: centralDeviceId(face.id),
      device,
      picture: size => {
        if (size === 'full') {
          const body = popOut?.popped ? null : bodyOf(face.id, input)
          return <div className="central-device-body" data-central-body={face.id} data-popped-out={popOut?.popped ? 'true' : undefined}>
            {popOut?.popped
              ? <p className="inhabitant-device-notice" role="status">Popped out: this device lives in its own native window. Redock returns it to this chain.</p>
              : body
                ? <>{face.id === 'day-die' && <DieFaceList face={input.reads.day?.face ?? null} turn={turn} />}{body}</>
                : <SmallPicture faceId={face.id} reads={input.reads} size="full" turn={turn} />}
          </div>
        }
        return <div className="central-picture-slot">
          <SmallPicture faceId={face.id} reads={input.reads} size={size} turn={turn} />
          {popOut && (popOut.popped
            ? <button type="button" className="central-popout" data-action="redock" title="Redock — bring this device back from its own window" aria-label={`Redock ${face.id}`} onClick={() => input.deviceWindows?.redock(popOut.identity)}><PopOut size={10} /></button>
            : <button type="button" className="central-popout" data-action="pop-out" disabled={!!popOut.fault} title={popOut.fault ?? 'Pop out into its own native window'} aria-label={`Pop out ${face.id}`} onClick={() => input.deviceWindows?.popOut(popOut.identity)}><PopOut size={10} /></button>)}
        </div>
      },
    }
  })
}

export interface CentralDevicesProps {
  readonly transport: KernelTransportStatus
  /** The Day the die reads: the owner's open-day standing (null while it answers or when no Day stands) and its aperture. */
  readonly dayStanding: DayDocumentStanding | null
  readonly day?: DayDieAperture | null
  readonly conversation?: CentralConversationAperture | null
  readonly flow?: {readonly location: CentralLocation} | null
  /** The browser's selected folder, note or day: the subject the Impact reads. */
  readonly impact?: ImpactSubject | null
  readonly projects?: readonly {name?: string; path?: string}[]
  readonly deviceWindows?: DeviceWindowHost | null
}

/** Central's chain: every device the family declares, compact, each published so the pool and a pane show the same device. */
export function CentralDevicesChain({transport, dayStanding, day = null, conversation = null, flow = null, impact = null, projects, deviceWindows = null}: CentralDevicesProps) {
  const manifest = inhabitantManifest(CENTRAL_FAMILY)
  const dayReading = useDayDieReading(transport, day)
  const nara = useNaraReading(transport, conversation?.project ?? null, conversation?.expressionRef ?? null, conversation?.conversation ?? null)
  const roster = useRosterReading(transport)
  const workcell = useWorkcellReading(transport)
  const impactKind = impact?.kind, impactPath = impact?.path
  const refreshDay = dayReading.refresh, refreshConversation = nara.refresh
  const afterWrite = useMemo(() => ({day: refreshDay, conversation: refreshConversation}), [refreshDay, refreshConversation])
  const reads = useMemo<CentralReads>(() => ({
    day: {standing: dayStanding, face: dayReading.face, revision: dayReading.revision},
    nara, roster, workcell,
    impact: impactPath ? {kind: impactKind!, path: impactPath} : null,
  }), [dayStanding, dayReading.face, dayReading.revision, nara, roster, workcell, impactKind, impactPath])
  const entries = useMemo(
    () => centralDeviceEntries({transport, faces: manifest?.faces ?? [], manifest, reads, day, conversation, flow, impact, projects, deviceWindows, afterWrite}),
    // The apertures are identity: a fresh object with the same parts is the same device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transport, manifest, reads, afterWrite, day?.sourceRef, day?.documentId, day?.project, conversation?.conversation, conversation?.expressionRef, conversation?.project, flow?.location.ref, impact?.path, impact?.kind, projects, deviceWindows],
  )
  useEffect(() => {
    for (const entry of entries) publishDevice(entry.id, {device: entry.device, picture: entry.picture})
  }, [entries])
  useEffect(() => () => {
    for (const face of manifest?.faces ?? []) publishDevice(centralDeviceId(face.id), null)
  }, [manifest])
  return <div className="central-devices-chain" data-central-devices={entries.length}>
    {entries.map(entry => <div key={entry.id} className="central-device-slot" data-face-id={entry.id.slice(CENTRAL_FAMILY.length + 1)}><DeviceView device={entry.device} size="compact" picture={entry.picture('compact')} actions={[
      {icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(entry.id)},
      {icon: 'pane', label: `Open ${entry.device.face.title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: entry.id, title: entry.device.face.title})},
    ]} /></div>)}
  </div>
}
