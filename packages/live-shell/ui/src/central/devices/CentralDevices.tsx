// Central's Device side: the family's devices through the one device runtime (FOUNDATION F5, T-DEVICES-CENTRAL; manual
// §3 "Device view shows the chain … In Central that means the tools at work on the open document", §10.4 "Every device
// comes in three sizes, and all three show the same live settings"). Compact here on the chain — a small live picture and
// the device's controls — whole in the pool when chosen, full in a pane when opened; each published to the device door
// under `central:<face>` so the three sizes read one device, with the one `submit` that writes it.
//
// The pictures and bodies are the family's own, ported unchanged: each device opened full carries the body its face already had —
// the Day die's hosted form (DocumentDayDieFace), the Nara conversation (NaraConversationFace), the ground hygiene and the impact
// readings (CentralHygieneDevice, CentralImpactDevice) — under the same owners, none reimplemented. The instruments (the die, the
// conversation) keep their Live semantic at every size: their write rows go through the owner paths their bodies already use
// (centralDeviceWrites.ts). The Flow is a clip, not a device: it stands on the Clip side (FlowClip.tsx), off this chain. A device
// whose aperture is not standing says so in its rows and keeps its light dark; no device is a text card.
//
// The Day (lane BC; DLW §16.2 "On the Main track: the Day"; §18.1) is the catalogue's designed device (`central:day-die`,
// inhabitants/catalogue/panels/day.tsx) on Central's own readings and writes (dayBinding.ts): the Day the person selected, else
// today as Central's ground reads it — the civil-time policy and the Day pointer, whose stale state the well is given in the
// owner's words, with "Open today" offered as the person's press on the owner's ensure. Its Full is the Day's own page as the
// owner stands it (dayDesign.tsx); its chain picture — the net and the face list it drew before — is the design's now.
import {useEffect, useMemo, useRef, type ReactNode} from 'react'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import type {DesignBinding} from '../../frame/devices/designed'
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
import {ownerReadings} from '../../owners/ownerReading'
import {dayStandingKey} from '../../owners/day'
import {useSpineEpoch} from '../../owners/spine'
import type {DayDocumentStanding} from '../centralVertical'
import {DayView} from '../documents/CentralDocumentPane'
import {CENTRAL_FAMILY, centralDevice, centralDeviceId, centralPicture, chainFaces, type CentralReads, type CentralWriters} from './centralDeviceModel'
import {centralWriters, openToday, turnDieFace} from './centralDeviceWrites'
import {dayDesignBinding, dayFactsOf, dayValuesOf, type DayFacts} from './dayBinding'
import {DAY_DESIGN_ID, standDayDesign, useShellDayDesign} from './dayDesign'
import {useCentralGroundAnswer, useDayDieReading, useNaraReading, useRosterReading, useWorkcellReading, type DayDieAperture} from './useCentralReadings'
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
  /** The Day's standing when no aperture stands (today's Day with no document, the stale pointer): its Full is the owner's words. */
  readonly dayStanding?: DayDocumentStanding | null
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
    // The Day's page: its hosted form where a Day document stands, else the owner's own words for why none does (the Day pane's
    // DayView, central/documents/CentralDocumentPane.tsx:80-86) — never a blank and never a stand-in.
    case 'day-die': return day
      ? <DocumentDayDieFace transport={transport} project={day.project} sourceRef={day.sourceRef} documentId={day.documentId} projects={projects} />
      : <DayView transport={transport} standing={input.dayStanding ?? input.reads.day?.standing ?? null} />
    case 'nara-conversation': return <NaraConversationFace transport={transport} project={conversation?.project ?? null} expressionRef={conversation?.expressionRef ?? null} conversation={conversation?.conversation ?? null} />
    case 'ground-hygiene': return <CentralHygieneDevice transport={transport} expanded />
    case 'impact': return impact ? <CentralImpactDevice transport={transport} subject={impact} expanded /> : null
    default: return null
  }
}

function SmallPicture({faceId, reads, size}: {faceId: string; reads: CentralReads; size: Size}) {
  const picture = centralPicture(faceId, reads)
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
    // The Day's chain picture is its design's (day.tsx: the net, the face dial); the generic plate that stands while no Day binding
    // does keeps only its pop-out here.
    const designed = face.id === 'day-die'
    return {
      id: centralDeviceId(face.id),
      device,
      picture: size => {
        if (size === 'full') {
          const body = popOut?.popped ? null : bodyOf(face.id, input)
          return <div className="central-device-body" data-central-body={face.id} data-popped-out={popOut?.popped ? 'true' : undefined}>
            {popOut?.popped
              ? <p className="inhabitant-device-notice" role="status">Popped out: this device lives in its own native window. Redock returns it to this chain.</p>
              : body ?? <SmallPicture faceId={face.id} reads={input.reads} size="full" />}
          </div>
        }
        if (designed && !popOut) return null
        return <div className="central-picture-slot">
          {!designed && <SmallPicture faceId={face.id} reads={input.reads} size={size} />}
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
  /** A Day the person selected: the owner's open-day standing (null while it answers, or when no Day is selected — the Day device
   * then stands on today, as Central's ground reads it) and its aperture. */
  readonly dayStanding: DayDocumentStanding | null
  readonly day?: DayDieAperture | null
  readonly conversation?: CentralConversationAperture | null
  readonly flow?: {readonly location: CentralLocation} | null
  /** The browser's selected folder, note or day: the subject the Impact reads. */
  readonly impact?: ImpactSubject | null
  readonly projects?: readonly {name?: string; path?: string}[]
  readonly deviceWindows?: DeviceWindowHost | null
}

/** The Day device's own readings and writes: the facts its owners give, the shown Day's document, and the binding the design reads
 * (null until the Day's date is known — before that the design would draw its date as missing words, so the generic plate stands). */
export function useDayDevice(transport: KernelTransportStatus, selected: {standing: DayDocumentStanding | null; aperture: DayDieAperture | null} | null): {
  facts: DayFacts
  document: {face: number | null; revision: string | null; payload: unknown; refresh: () => void}
  binding: DesignBinding | null
} {
  const ground = useCentralGroundAnswer(transport)
  const epoch = useSpineEpoch()
  const selectedKey = selected ? `${selected.standing?.state ?? ''}|${selected.standing?.dayRef ?? ''}|${selected.aperture?.sourceRef ?? ''}|${selected.aperture?.documentId ?? ''}` : null
  const facts = useMemo(() => dayFactsOf({ground: ground.reading, groundError: ground.error, selected}),
    // The selection is identity: a fresh object with the same parts is the same Day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ground.reading, ground.error, selectedKey])
  const document = useDayDieReading(transport, facts.aperture)
  const refreshGround = ground.refresh, refreshDocument = document.refresh
  const binding = useMemo(() => {
    if (!facts.civilDate) return null
    const values = dayValuesOf(facts, facts.aperture && document.face !== null ? {face: document.face, payload: document.payload} : null)
    return dayDesignBinding(DAY_DESIGN_ID, facts, values, {
      turn: async (aperture, face) => { await turnDieFace(transport, aperture, face); refreshDocument() },
      openToday: async () => {
        try { await openToday(transport) } finally {
          // The owner's answer moved the Day: read the ground again, and the current Day's answer the Day's page reads, whose stale
          // refusal is otherwise remembered for its epoch (owners/day.ts).
          refreshGround()
          void ownerReadings.entries().find(entry => entry.key === dayStandingKey(transport, null))?.retry(epoch)
        }
      },
    })
  }, [facts, document.face, document.payload, transport, refreshDocument, refreshGround, epoch])
  return {facts, document, binding}
}

/** Central's chain: every device the family declares, compact, each published so the pool and a pane show the same device. The Day
 * stands first — the Main track's device (DLW §16.2) — on its design when its binding stands. */
export function CentralDevicesChain({transport, dayStanding, day = null, conversation = null, flow = null, impact = null, projects, deviceWindows = null}: CentralDevicesProps) {
  const manifest = inhabitantManifest(CENTRAL_FAMILY)
  const dayDevice = useDayDevice(transport, dayStanding ? {standing: dayStanding, aperture: day} : null)
  const dayDesign = useShellDayDesign(!!dayDevice.binding)
  const holder = useRef({})
  const dayBinding = dayDesign ? dayDevice.binding : null
  const dayAperture = dayDevice.facts.aperture
  const nara = useNaraReading(transport, conversation?.project ?? null, conversation?.expressionRef ?? null, conversation?.conversation ?? null)
  const roster = useRosterReading(transport)
  const workcell = useWorkcellReading(transport)
  const impactKind = impact?.kind, impactPath = impact?.path
  const refreshDay = dayDevice.document.refresh, refreshConversation = nara.refresh
  const afterWrite = useMemo(() => ({day: refreshDay, conversation: refreshConversation}), [refreshDay, refreshConversation])
  const reads = useMemo<CentralReads>(() => ({
    day: {standing: dayDevice.facts.standing, face: dayDevice.document.face, revision: dayDevice.document.revision},
    nara, roster, workcell,
    impact: impactPath ? {kind: impactKind!, path: impactPath} : null,
  }), [dayDevice.facts.standing, dayDevice.document.face, dayDevice.document.revision, nara, roster, workcell, impactKind, impactPath])
  const entries = useMemo(
    () => centralDeviceEntries({transport, faces: manifest?.faces ?? [], manifest, reads, day: dayAperture, conversation, flow, impact, projects, deviceWindows, afterWrite,
      dayStanding: dayDevice.facts.standing}),
    // The apertures are identity: a fresh object with the same parts is the same device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transport, manifest, reads, afterWrite, dayAperture?.sourceRef, dayAperture?.documentId, dayAperture?.project, conversation?.conversation, conversation?.expressionRef, conversation?.project, flow?.location.ref, impact?.path, impact?.kind, projects, deviceWindows],
  )
  useEffect(() => {
    // The Day's design stands over the catalogue's before its binding is published, and goes when the binding does.
    standDayDesign(holder.current, dayBinding ? dayDesign : null)
    for (const entry of entries) {
      const binding = entry.id === DAY_DESIGN_ID ? dayBinding ?? undefined : undefined
      publishDevice(entry.id, {device: entry.device, picture: entry.picture, ...(binding ? {binding} : {})})
    }
  }, [entries, dayBinding, dayDesign])
  useEffect(() => () => {
    standDayDesign(holder.current, null)
    for (const face of manifest?.faces ?? []) publishDevice(centralDeviceId(face.id), null)
  }, [manifest])
  return <div className="central-devices-chain" data-central-devices={entries.length}>
    {entries.map(entry => <div key={entry.id} className="central-device-slot" data-face-id={entry.id.slice(CENTRAL_FAMILY.length + 1)}><DeviceView device={entry.device} size="compact" picture={entry.picture('compact')}
      binding={entry.id === DAY_DESIGN_ID ? dayBinding ?? undefined : undefined} actions={[
        {icon: 'detail', label: 'Show every setting in the pool', onPress: () => selectDevice(entry.id)},
        {icon: 'pane', label: `Open ${entry.device.face.title} full size in a pane`, onPress: () => openInstrument(DEVICE_PANE_KIND, undefined, {ref: entry.id, title: entry.device.face.title})},
      ]} /></div>)}
  </div>
}
