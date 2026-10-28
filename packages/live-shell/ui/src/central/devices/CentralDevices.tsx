// Central's Device side: the family's devices through the one device runtime (FOUNDATION F5, T-DEVICES-CENTRAL; manual
// §3 "Device view shows the chain … In Central that means the tools at work on the open document", §10.4 "Every device
// comes in three sizes, and all three show the same live settings"). Compact here on the chain — a small live picture and
// the device's controls — whole in the pool when chosen, full in a pane when opened; each published to the device door
// under `central:<face>` so the three sizes read one device, with the one `submit` that writes it.
//
// The pictures and bodies are the family's own, ported unchanged: the Day die opened full carries the body its face already had — its
// hosted form (DocumentDayDieFace) — under the same owner, not reimplemented. The die keeps its Live semantic at every size: its write rows
// go through the owner paths its body already uses (centralDeviceWrites.ts). A device whose aperture is not standing says so in its rows
// and keeps its light dark; no device is a text card.
//
// The Day (lane BC; DLW §16.2 "On the Main track: the Day"; §18.1) is the catalogue's designed device (`central:day-die`,
// inhabitants/catalogue/panels/day.tsx) on Central's own readings and writes (dayBinding.ts): the Day the person selected, else
// today as Central's ground reads it — the civil-time policy and the Day pointer, whose stale state the well is given in the
// owner's words, with "Open today" offered as the person's press on the owner's ensure. Its Full is the Day's own page as the
// owner stands it — the hosted form, or the Day pane's DayView — published as the device's own Full (deviceDoor.ts PublishedDevice
// `full`), which the pane draws over the design's; its chain picture — the net and the face list it drew before — is the design's.
// A device's pop-out (or redock) is a mark of its place: it stands in the device's head, the generic plate's and the design's alike.
//
// The chains are exactly §16.2's (R4; lock §0.3.4; centralChainSlots): a world's chain is the Packet, the agent of the world and its Scope,
// then Docs, the world's account on six tiers (§18.5); the Main track's chain is the Day, then Approvals. Ground hygiene, Machine and
// Impact were retired as devices of their own in the 22 Oct manual rewrite: the seats and checkouts are Git / landing's Checkouts page
// (§19.16), the machine the Remote carrier's Machine page (§18.7, §19.18), what a change reaches the Knowledge graph's, the NOWs' and Docs'
// Meaning (§18.6). Whether a world's folder holds code (Central's git reading, kernel git_repository_read) is still read and said on the
// chain. Which chain Device view shows follows THE selection, as Live's follows the selected track (centralChainOf): the Main track (the
// grid's Main head, or the Day's stream and its clips) shows the Day's; a world's track or page shows that world's; with no Central
// selection both stand, the Main track's first, the world's naming no world. The page family — the Document — is no chain's (§16.1: a
// page's Clip panel, editor tabs and tools in Clip view; the Workspace, the Flow, Beings, Things, Text, Highlight and Notes were retired as
// faces of their own, the world's settings standing on its track head and its account in Docs, §18.1): their bindings stay
// (pageBindings.ts, pageDevices.ts), and only the document the hand reached is still read here, for the Agent's and Scope's page. Search is
// no chain device (§18.4: a pane, and the line where you type @: searchPane.tsx).
//
// One Agent, one Scope (R4; §16.1, §19.4, §19.12; lock §0.3.5): the agent that answers is Actuation's Agent (actuation:harness-model) on
// the Answer's owners (answerBinding.ts centralAgentBinding), carrying its Custody, Identity, Thread and Voice pages (oneAgentBinding.ts;
// the Answer and Voice were retired as devices of their own in the 22 Oct manual rewrite: "Answer is the Agent on a page's chain",
// PROGRAMME R25 item 5; Voice is the Agent's Voice page, §19.21); what
// it may read and write is Software Factory's Scope (software-factory:context-write-mode) on Context & world's owners
// (contextWorldBinding.ts centralScopeBinding). The Packet and the Agent share the encounter observers mounted here: one per session
// (lane BF2's EncounterObservers.tsx), never a session read twice.
import {useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode} from 'react'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice, type OwnFull, type PublishedDevice} from '../../frame/devices/deviceDoor'
import {registerRelayedFull, type RelayedFull} from '../../frame/devices/relayedFulls'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {openInstrument} from '../../frame/instrumentDoor'
import {DocumentDayDieFace} from '../../inhabitants/DocumentDayDieFace'
import type {DeviceWindowHost} from '../../inhabitants/inhabitantRack'
import {faceStandsAlone, inhabitantManifest, type InhabitantFaceDeclaration, type InhabitantManifest} from '../../inhabitants/manifest'
import {KindMark} from '../../inhabitants/sdk/marks'
import {popOutApertureFault, type DeviceDetachIdentity} from '../../native/detachedKinds'
import {ownerReadings} from '../../owners/ownerReading'
import {dayStandingKey} from '../../owners/day'
import {useSpineEpoch} from '../../owners/spine'
import type {DayDocumentStanding} from '../centralVertical'
import {DayView} from '../documents/CentralDocumentPane'
import {CENTRAL_FAMILY, centralDevice, centralDeviceId, centralPicture, chainFaces, type CentralReads, type CentralWriters} from './centralDeviceModel'
import {beginDayMove, centralWrite, centralWriters, closeCarry, openToday, openTomorrow, turnDieFace, writeDaySettings} from './centralDeviceWrites'
import {turnDay, useDayInPane} from '../documents/documentDoor'
import {dayDesignBinding, dayFactsOf, dayValuesOf, type DayFacts} from './dayBinding'
import {useCentralAction, useCentralGroundAnswer, useDayDieReading, useDayOwnReadings, useNaraReading, useRosterReading, type DayDieAperture} from './useCentralReadings'
import {usePageDevices} from './pageDevices'
import {docsBinding, holdsVersion, subscribeHolds} from './pageBindings'
import {CENTRAL_AGENT_ID, centralAgentBinding, centralAgentRef} from './answerBinding'
import {useAnswerVoice} from './useAnswerVoice'
import {observedState, useEncounterSessions, type ObservedSession} from '../../agent/devices/EncounterObservers'
import {composeAgentBinding} from '../../agent/devices/oneAgentBinding'
import {custodyBinding} from '../../agent/devices/sessionChainBindings'
import {shownSession, threadBinding} from '../../agent/devices/threadBinding'
import {holdView, useChainHolds, viewHolds} from '../../agent/devices/designBindings'
import {familyFaceDevice} from '../../agent/devices/mainTrackBindings'
import {APPROVALS_ID, approvalsBinding} from '../../agent/devices/receiptBindings'
import {useSourceReturnsAnswer} from '../../agent/devices/workcellReads'
import {RACK_PROJECT as APPROVALS_PROJECT} from '../../agent/devices/useRackReading'
import {useAgentSessionsOptional} from '../../agent/AgentSessionsProvider'
import {MAIN_TRACK_REF} from '../../frame/tracks/SessionGrid'
import {CENTRAL_DAY_TRACK_ID} from '../../timeline/centralTrackAdapter'
import {centralWorldTrackId} from '../../timeline/centralTrackAdapter'
import {useHeldRead, useOwnerOp} from '../../owners/ownerCall'
import {readWorlds, type CentralWorld, type CentralWorldsReading} from '../centralWorlds'
import {voiceBinding} from '../../agent/devices/voiceBinding'
import {voiceBodyReadings, type AnswerVoiceState, type VoiceKey} from './answerVoice'
import {PERSONAL_ANCHOR_ACTION, acceptSourceReturn, personRefOf} from './sourceReturnAccept'
import {commentSourceReturn, withReturnComments} from './sourceReturnComment'
import {useRosterAgents} from '../../owners/readers'
import {bindConversation} from './centralDeviceWrites'
import {useAgencySessions} from '../../agent/useAgencySessions'
import {useOptionalContinuity} from '../../continuity/workspace'
import {COMPANIONS} from '../../shell/modeDockTiles'
import {usePacketReading} from '../../shell/transports/useCentralTransport'
import {conversationOf} from '../../widgets/agentConversation'
import {CENTRAL_SCOPE_ID, CONTEXT_WORLD_DEVICE_ID, IDENTITY_DEVICE_ID, PACKET_DEVICE_ID, SEARCH_DEVICE_ID, useIdentityDevice, usePacketDevice, useScopeDevice} from './agentChainDevices'
import {EFFECTIVE_SOURCES_ACTION, ROOT_WORLD_RELATIONS, WORLD_RELATIONS_READ, WORLD_RELATIONS_SAVE, type ChangeHorizon} from './contextWorldBinding'
import {useAtSearch} from '../searchPane'
import {openNotificationTarget, useOwnerRequests} from '../../widgets/railDevices'
import {openedHold, openedOf, withOwnerRequests} from '../../widgets/railBindings'
import './centralDevices.css'

/** The root register's world, whose effective sources Scope reads (central.world.effective-sources {scope, world_ref}). */
const ROOT_WORLD_SOURCES: Readonly<Record<string, unknown>> = {scope: 'root', world_ref: 'control:root'}
/** An action asked with no input (Central's personal anchor). */
const NO_INPUT: Readonly<Record<string, unknown>> = {}

export interface CentralConversationAperture {
  readonly project: string | null
  readonly expressionRef: string | null
  readonly conversation?: string | null
}

/** Everything the devices read: the apertures (the Day, the conversation, the flow), the Day's owner standing and the owners' readings
 * the hooks hand in. */
export interface CentralDeviceInput {
  readonly transport: KernelTransportStatus
  readonly faces: readonly InhabitantFaceDeclaration[]
  readonly manifest?: InhabitantManifest
  readonly reads: CentralReads
  readonly day: DayDieAperture | null
  readonly conversation: CentralConversationAperture | null
  readonly flow: {readonly location: CentralLocation} | null
  readonly projects?: readonly {name?: string; path?: string}[]
  readonly deviceWindows: DeviceWindowHost | null
  /** The owners' write paths the devices hold; absent, they are built over the apertures (centralDeviceWrites.ts). */
  readonly writers?: CentralWriters
  /** Read the owner again after a device wrote (the chain's hooks hand these in). */
  readonly afterWrite?: {readonly day?: () => void; readonly conversation?: () => void; readonly page?: () => void}
  /** The Day's standing when no aperture stands (today's Day with no document, the stale pointer): its Full is the owner's words. */
  readonly dayStanding?: DayDocumentStanding | null
  /** The reached document, for the Document's Save and the Flow's next entry (centralDeviceWrites.ts centralWriters). */
  readonly page?: {readonly save?: () => void; readonly location?: CentralLocation | null; readonly dirty?: boolean | null} | null
}

type Size = 'compact' | 'whole' | 'full'

export interface CentralDeviceEntry {
  readonly id: string
  readonly device: DeviceInstance
  readonly picture: (size: Size) => ReactNode
  /** The device's pop-out, or its redock once out: a mark of its place, in its head. */
  readonly marks?: ReactNode
  /** Its own Full named as data, for a Pop-out window to draw (relayedFulls.ts): the Day's page by its aperture. */
  readonly fullRelay?: RelayedFull
}

/** The Day's page as its own Full in a Pop-out window (relayedFulls.ts): the face the chain's pane draws, by the Day's aperture,
 * on that window's own carrier (r23: the Day popped out drew a blank Full). */
export const DAY_PAGE_RELAY = 'central:day-page'
registerRelayedFull(DAY_PAGE_RELAY, (data, transport) => {
  const day = data as DayDieAperture
  return <div className="central-device-body" data-central-body="day-die">
    <DocumentDayDieFace transport={transport} project={day.project} sourceRef={day.sourceRef} documentId={day.documentId} />
  </div>
})

/** The Day device's id on the chain (its design is `central:day-die`, inhabitants/catalogue/panels/day.tsx). */
export const DAY_DEVICE_ID = centralDeviceId('day-die')

/** What the chain publishes for one device (deviceDoor.ts PublishedDevice): its picture and marks; its binding, where one stands; the
 * Day its page as its own Full — the Day the owner stands, never the design's template — and a page device the page's own pane
 * (`full`, pageDevices.ts). */
export function centralPublication(entry: CentralDeviceEntry, binding: DesignBinding | null, full?: OwnFull): PublishedDevice {
  return {
    device: entry.device, picture: entry.picture,
    ...(entry.marks ? {marks: entry.marks} : {}),
    ...(binding ? {binding} : {}),
    ...(entry.id === DAY_DEVICE_ID ? {full: {draw: () => entry.picture('full'), ...(entry.fullRelay ? {relay: entry.fullRelay} : {})}} : full ? {full} : {}),
  }
}

/** The family's faces that stand on a chain (DLW §16.2; centralDeviceModel.ts CENTRAL_DEVICE_FACES): the Day on the Main track; the
 * Packet and Docs on a world's track. Every other face the family declares stands on no chain (R4). */
export function placedFaces(faces: readonly InhabitantFaceDeclaration[]): InhabitantFaceDeclaration[] {
  return chainFaces(faces)
}

/** Which track's chain Device view shows (Live: the selected track's): the Main track's for the grid's Main head and for the Day — its
 * track, or a clip of it (§18.1 "The Day is the Main track") —, a workspace's for a workspace's track or clip, and both with no Central
 * track selected. Pure. */
export function centralChainOf(selection: {readonly kind: string; readonly ref: string; readonly track?: string} | null | undefined): 'main' | 'workspace' | 'both' {
  // A track or a clip is Central's by its own ref (its tracks are `central:…`, timeline/centralTrackAdapter.ts), never by a mode word.
  const at = selection?.kind === 'track' ? selection.ref : selection?.kind === 'clip' ? selection.track : undefined
  if (at === undefined) return 'both'
  if (MAIN_TRACKS.has(at)) return 'main'
  return at.startsWith('central:') ? 'workspace' : 'both'
}
/** The refs that name Central's Main track: the grid's Main head (frame/tracks/SessionGrid.tsx MAIN_TRACK_REF) and the Day's own track
 * (timeline/centralTrackAdapter.ts CENTRAL_DAY_TRACK_ID: "the Day is the Main track"). */
const MAIN_TRACKS: ReadonlySet<string> = new Set([MAIN_TRACK_REF, CENTRAL_DAY_TRACK_ID])

/** The world a chain stands for (DLW §16.2 "Track: a world"): none while no world's track is selected; your own world; or a project's, with
 * whether its folder holds code — Central's git reading of the project (kernel git_repository_read) found its repository (`holds`), said it
 * has none (`none`), has not answered (`reading`), or refused in its own words. */
export type ChainWorld =
  | {readonly kind: 'none'}
  | {readonly kind: 'yours'; readonly name: string}
  | {readonly kind: 'project'; readonly name: string; readonly project: string; readonly code: 'holds' | 'none' | 'reading' | {readonly refused: string}}

/** The world THE selection's track holds: a world's track (`central:world:<ref>`, timeline/centralTrackAdapter.ts centralWorldTrackId) or a
 * page on it, found among the worlds Central discloses. Null for any other selection, or a world not (yet) disclosed. Pure. */
export function centralWorldOf(selection: {readonly kind: string; readonly ref: string; readonly track?: string} | null | undefined, worlds: CentralWorldsReading | null): CentralWorld | null {
  const at = selection?.kind === 'track' ? selection.ref : selection?.kind === 'clip' ? selection.track : undefined
  if (!at || worlds?.state !== 'read') return null
  return worlds.worlds.find(world => centralWorldTrackId(world.ref) === at) ?? null
}

/** The chain's world from the selected world and the git reading of its project. Pure. */
export function chainWorldOf(world: CentralWorld | null, git: {readonly status: string; readonly error?: string | null} | null): ChainWorld {
  if (!world) return {kind: 'none'}
  if (world.kind === 'yours' || !world.project) return {kind: 'yours', name: world.name}
  const code = !git || git.status === 'reading' ? 'reading' as const : git.status === 'answered' ? 'holds' as const
    : /no git repository/i.test(git.error ?? '') ? 'none' as const : {refused: git.error ?? 'Central\'s git reading did not answer.'}
  return {kind: 'project', name: world.name, project: world.project, code}
}

/** Whether the world's folder holds code: a project's world whose repository Central's git reading found. */
export const worldHoldsCode = (world: ChainWorld): boolean => world.kind === 'project' && world.code === 'holds'

/** The devices of a Central chain, left to right (DLW §16.2 "The packet, the agent of the world, and its scope; then Docs, the world's
 * account on six tiers. On the Main track: the Day, then Approvals"): the same on every world, whether or not its folder holds code. Every
 * slot is an effect or an instrument of its family; no monitor and no connection stands on a Central chain. Voice is the Agent's Voice page
 * (§19.21); Ground hygiene, Machine and Impact were retired (§18.6, §18.7, §19.16). Pure. */
export function centralChainSlots(track: 'main' | 'world'): string[] {
  if (track === 'main') return [DAY_DEVICE_ID, CENTRAL_APPROVALS_ID]
  return [centralDeviceId('packet'), CENTRAL_AGENT_ID, CENTRAL_SCOPE_ID, DOCS_DEVICE_ID]
}

/** Docs on a world's chain (DLW §18.5; its design `central:docs`, inhabitants/catalogue/panels/central__docs.tsx). */
export const DOCS_DEVICE_ID = centralDeviceId('docs')

/** The devices of other families on Central's chains: the Agent and Scope on a workspace (§19.4, §19.12), Approvals on the Main track
 * (§18.1 "its chain holds the Day, then Approvals"; §19.14) — each its family's admitted face, drawn by that face's design. */
export const CENTRAL_SCOPE_DEVICE_ID = CENTRAL_SCOPE_ID
export const CENTRAL_APPROVALS_ID = 'central:main:approvals'
export const centralAgentDevices = () => ({
  agent: familyFaceDevice(CENTRAL_AGENT_ID, 'actuation', 'harness-model', 'Agent', 'form'),
  scope: familyFaceDevice(CENTRAL_SCOPE_ID, 'software-factory', 'context-write-mode', 'Scope', 'orbit'),
  approvals: familyFaceDevice(CENTRAL_APPROVALS_ID, 'software-factory', 'approvals', 'Approvals', 'arm'),
})

/** Voice on Central's chain (agent/devices/voiceBinding.ts) with what the open voice's own answers carry read over its absences
 * (answerVoice.ts voiceBodyReadings): a reading that answers stands as a reading, and Voice's chooser (voice.voice) stays a control no owner
 * operation carries (VOICE_REFUSE). Pure. */
export function centralVoiceBinding(state: AnswerVoiceState, why: string | null, write: (key: VoiceKey, value: unknown) => Promise<void>): DesignBinding {
  const binding = voiceBinding({state, why}, write)
  const readings = voiceBodyReadings(state)
  const standing = {...binding.standing}
  for (const key of Object.keys(readings)) if (key !== 'voice.voice') delete standing[key]
  return {...binding, values: {...binding.values, ...readings}, standing}
}

/** The thread page Central's Agent carries keeps its view (pin, the shown session, the filters) under its own hold. */
const CENTRAL_THREAD_HOLD = `${CENTRAL_AGENT_ID}/thread`
/** Approvals on Central: the default answer is the Gateway's (Factory's Main track); the dialogue binding carries none. */
const CENTRAL_DEFAULT_ANSWER = 'Default answer: no owner operation carries it for Central\'s agent yet — missing op: kernel:nara_dialogue {action: configure, session_ref, approvals: ask | session | always} (AIKit).'

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
  const {transport, day, projects} = input
  switch (faceId) {
    // The Day's page: its hosted form where a Day document stands, else the owner's own words for why none does (the Day pane's
    // DayView, central/documents/CentralDocumentPane.tsx:80-86) — never a blank and never a stand-in.
    case 'day-die': return day
      ? <DocumentDayDieFace transport={transport} project={day.project} sourceRef={day.sourceRef} documentId={day.documentId} projects={projects} />
      : <DayView transport={transport} standing={input.dayStanding ?? input.reads.day?.standing ?? null} />
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
  const writers = input.writers ?? centralWriters({transport: input.transport, day: input.day, afterWrite: input.afterWrite, page: input.page})
  return placedFaces(input.faces).map(face => {
    const popOut = popOutOf(face, input)
    const device = centralDevice(face, input.reads, writers)
    // The Day's chain picture is its design's (day.tsx: the net, the face dial); the generic plate that stands while no Day binding
    // does draws its rows alone.
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
        return designed ? null : <SmallPicture faceId={face.id} reads={input.reads} size={size} />
      },
      // No head mark of its own (R1): the door's ↗ — the device's own window — stands alone. A face the native host already holds popped
      // out says so in its Full above.
      ...(designed && input.day ? {fullRelay: {kind: DAY_PAGE_RELAY, data: {project: input.day.project, sourceRef: input.day.sourceRef, documentId: input.day.documentId}}} : {}),
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
  // The Day's own settings, and the moves of the Day shown when its document stands (T-COVERAGE §1.3).
  const timezone = ground.reading?.time.state === 'ready' ? ground.reading.time.data?.policy.timezone ?? null : null
  const own = useDayOwnReadings(transport, facts.standing?.state === 'ready' ? facts.standing.dayRef : null, timezone)
  // A Day held open in a pane shows its own face, which the owner holds at that Day's next Save: the device reads and turns that one.
  const inPane = useDayInPane(facts.aperture?.documentId ?? null)
  const shownFace = inPane?.face ?? document.face
  const refreshGround = ground.refresh, refreshDocument = document.refresh
  const binding = useMemo(() => {
    if (!facts.civilDate) return null
    const values = dayValuesOf(facts, facts.aperture && shownFace !== null ? {face: shownFace, payload: document.payload} : null, own)
    return dayDesignBinding(DAY_DEVICE_ID, facts, values, {
      turn: async (aperture, face) => { if (await turnDay(aperture.documentId, face, () => turnDieFace(transport, aperture, face)) === 'owner') refreshDocument() },
      openToday: async () => {
        try { await openToday(transport) } finally {
          // The owner's answer moved the Day: read the ground again, and the current Day's answer the Day's page reads, whose stale
          // refusal is otherwise remembered for its epoch (owners/day.ts).
          refreshGround()
          void ownerReadings.entries().find(entry => entry.key === dayStandingKey(transport, null))?.retry(epoch)
        }
      },
      // Close now is the close routine (W2): central.day.close-carry, which carries face 5's proposal when Close routine is On.
      closeNow: async () => {
        try { await closeCarry(transport) } finally {
          refreshGround()
          void ownerReadings.entries().find(entry => entry.key === dayStandingKey(transport, null))?.retry(epoch)
        }
      },
      // The Day's own settings, a pad's press and tomorrow's opening, through Central's actions on the revisions read (W2). The readings are
      // asked again behind each write (the kernel's write notice); the ground too, where a Day moved.
      settings: async (patch, revision) => { await writeDaySettings(transport, patch, revision) },
      begin: async (move, dayRef) => { await beginDayMove(transport, move, dayRef) },
      openTomorrow: async () => { try { await openTomorrow(transport) } finally { refreshGround() } },
    }, own)
  }, [facts, shownFace, document.payload, own, transport, refreshDocument, refreshGround, epoch])
  return {facts, document, binding}
}

/** Central's chains (DLW §16.2): the Main track's — the Day, then Approvals — and a world's — the Packet, the Agent, Scope, then Docs —,
 * compact, each published so the pool, a pane and the rail draw the same device on the same binding. Which stands follows THE selection
 * (centralChainOf, centralWorldOf). */
export function CentralDevicesChain({transport, dayStanding, day = null, conversation = null, flow = null, projects, deviceWindows = null}: CentralDevicesProps) {
  const manifest = inhabitantManifest(CENTRAL_FAMILY)
  const dayDevice = useDayDevice(transport, dayStanding ? {standing: dayStanding, aperture: day} : null)
  const dayBinding = dayDevice.binding
  const dayAperture = dayDevice.facts.aperture
  const selection = useOptionalContinuity()?.current.context?.selection ?? null
  const selectionRef = selection?.ref ?? null
  // The world the selected track holds (§16.2 "Track: a world"), from the worlds Central discloses — the one held reading the tracks read
  // (frame/tracks/useCentralTracks.ts) — and, for a project's world, whether its folder holds code: Central's git reading of the project.
  const worldsAnswer = useHeldRead(['worlds', transport], () => readWorlds(transport))
  const worlds = worldsAnswer.status === 'answered' ? worldsAnswer.value ?? null : null
  const selectedWorld = centralWorldOf(selection, worlds)
  const codeProject = selectedWorld?.kind === 'project' ? selectedWorld.project : null
  const git = useOwnerOp(transport, codeProject ? {op: 'git_repository_read', project: codeProject} : null, 'git_repository_reading').reading
  // The page readings (pageDevices.ts) read the selected world — its name, its folder — and the projects of Work that are worlds.
  const selectedWorldRef = selectedWorld?.ref ?? null
  const pageWorld = useMemo(() => ({
    world: selectedWorld ? {name: selectedWorld.name, project: selectedWorld.kind === 'project' ? selectedWorld.project : null} : null,
    folders: worlds?.state === 'read' ? worlds.worlds.flatMap(world => (world.kind === 'project' && world.project ? [world.project] : [])) : null,
  }), // eslint-disable-next-line react-hooks/exhaustive-deps -- the world is its ref
  [selectedWorldRef, worlds])
  // The document the hand reached, for the Agent's and Scope's page (the page family itself stands on no chain: R4).
  const pages = usePageDevices(transport, {aperture: dayAperture, face: dayDevice.document.face, payload: dayDevice.document.payload, civilDate: dayDevice.facts.civilDate}, pageWorld)
  const nara = useNaraReading(transport, conversation?.project ?? null, conversation?.expressionRef ?? null, conversation?.conversation ?? null)
  // The Agent (answerBinding.ts centralAgentBinding): the bound session's exchange through the ONE shared encounter observer (lane BF2's),
  // the roster's agent of the binding's role. The Packet goes with the conversation the Agent widget holds (THE selection's session, else
  // the companion's own: the read the Packet widget and the transport's Key slot make, useCentralTransport.tsx usePacketReading).
  const chainWorld = useMemo(() => chainWorldOf(selectedWorld, codeProject ? {status: git.status, error: git.error} : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the world is its ref
    [selectedWorld?.ref, codeProject, git.status, git.error])
  const packetReading = usePacketReading(transport, selectionRef)
  const agency = useAgencySessions(transport)
  const nowUnixMs = useAgentSessionsOptional()?.nowUnixMs ?? 0
  const companion = COMPANIONS.base.name
  const packetTrack = conversationOf(agency.tracks, companion, selectionRef).track
  const packetSessionRef = packetTrack?.sessionRef ?? null, packetSpaceRef = packetTrack?.spaceRef ?? null
  const observedSessions = useMemo(() => {
    const list: ObservedSession[] = nara.state === 'bound' && nara.session && nara.space ? [{ref: nara.session, space: nara.space}] : []
    if (packetSessionRef && packetSpaceRef && !list.some(session => session.ref === packetSessionRef)) list.push({ref: packetSessionRef, space: packetSpaceRef})
    return list
  }, [nara.state, nara.session, nara.space, packetSessionRef, packetSpaceRef])
  const encounters = useEncounterSessions(observedSessions)
  const packet = usePacketDevice(transport, packetReading, {companion, bound: !!packetTrack, handle: packetSessionRef ? encounters.handles[packetSessionRef] : undefined})
  const packetSession = packetReading?.context ? packetReading.context.scope.agent_session : null
  const answerHandle = nara.session ? encounters.handles[nara.session] : undefined
  const answerObserved = observedState(answerHandle)
  const answerRoster = useRosterAgents(transport)
  const roster = useRosterReading(transport)
  const refreshDay = dayDevice.document.refresh, refreshConversation = nara.refresh, refreshPage = pages.refresh
  const afterWrite = useMemo(() => ({day: refreshDay, conversation: refreshConversation, page: refreshPage}), [refreshDay, refreshConversation, refreshPage])
  const reads = useMemo<CentralReads>(() => ({
    day: {standing: dayDevice.facts.standing, face: dayDevice.document.face, revision: dayDevice.document.revision},
    nara, roster,
    page: pages.reads.page, workspace: pages.reads.workspace, flow: pages.reads.flow,
  }), [dayDevice.facts.standing, dayDevice.document.face, dayDevice.document.revision, nara, roster, pages.reads])
  const pageWrite = pages.page
  const entries = useMemo(
    () => centralDeviceEntries({transport, faces: manifest?.faces ?? [], manifest, reads, day: dayAperture, conversation, flow, projects, deviceWindows, afterWrite,
      dayStanding: dayDevice.facts.standing, page: pageWrite}),
    // The apertures are identity: a fresh object with the same parts is the same device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transport, manifest, reads, afterWrite, dayAperture?.sourceRef, dayAperture?.documentId, dayAperture?.project, conversation?.conversation, conversation?.expressionRef, conversation?.project, flow?.location.ref, projects, deviceWindows, pageWrite],
  )
  const answerAgents = answerRoster.state === 'ready' ? answerRoster.agents : null
  const refreshNara = nara.refresh
  const answerInput = useMemo(() => ({nara: {state: nara.state, session: nara.session, resume: nara.resume}, observed: answerObserved, roster: answerAgents, page: null}),
    [nara.state, nara.session, nara.resume, answerObserved, answerAgents])
  // The session's next turn: its encounter's own draft, then its Send (the thread pane's). A typed question and a spoken one go this way.
  const answerSend = useMemo(() => (answerHandle && 'actions' in answerHandle
    ? async (text: string) => { answerHandle.actions.change(text); await answerHandle.actions.send() } : null), [answerHandle])
  const own = useMemo(() => centralAgentBinding(CENTRAL_AGENT_ID, answerInput, {
    bind: conversation ? async () => { await bindConversation(transport, conversation); refreshNara() } : null,
    send: answerSend,
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the conversation is its parts
  [answerInput, answerSend, transport, refreshNara, conversation?.project, conversation?.expressionRef, conversation?.conversation])
  // The Agent's voice (useAnswerVoice.ts: Hears and Speaks through the kernel op nara_voice, the face's mouth following the spoken sound): the
  // Answer's voice is the one voice owner. Voice is the Agent's Voice page (§19.21; agent/devices/voiceBinding.ts), carried under `speech.`
  // (oneAgentBinding.ts VOICE_PAGE): what the open voice's own answers carry — its constitution's declared voice, duplex, barge-in and stop,
  // and the last speak's receipt (answerVoice.ts voiceBodyReadings) — is read over the binding's absences. The Answer was retired as a device
  // of its own in the 22 Oct manual rewrite ("Answer is the Agent on a page's chain", PROGRAMME R25 item 5).
  const voice = useAnswerVoice({transport, conversation, bound: nara.state === 'bound', session: nara.session, send: answerSend, reading: answerObserved?.reading})
  const voiceDesign = useMemo(() => centralVoiceBinding(voice.state, voice.why, voice.write), [voice.state, voice.why, voice.write])
  // Scope (one Scope): the Agent's session's scope over Central's ground (the one ground answer the Day reads) and the Packet.
  const ground = useCentralGroundAnswer(transport)
  // The world's effective sources as Central resolves them (T-COVERAGE §1.3): the root register's, the ground's world.
  const effective = useCentralAction(transport, EFFECTIVE_SOURCES_ACTION, ROOT_WORLD_SOURCES)
  // The world's authored relations, which a read place's include or exclude is saved on (W2: central.world-relations.save).
  const relations = useCentralAction(transport, WORLD_RELATIONS_READ, ROOT_WORLD_RELATIONS)
  const saveRelations = useMemo(() => async (record: Record<string, unknown>, expectedRevision: string) => {
    await centralWrite(transport, WORLD_RELATIONS_SAVE, {scope: 'root', record, expected_revision: expectedRevision})
  }, [transport])
  const scope = useScopeDevice({
    answer: {bound: nara.state === 'bound', session: nara.session},
    horizon: (ground.reading?.sources ?? null) as ChangeHorizon | null, groundError: ground.error,
    document: pages.reads.page?.title ?? null,
    packet: packetReading?.context ? {items: packetReading.context.items.length, session: packetSession} : null,
    effective, relations, saveRelations,
  })
  // The Agent's pages (oneAgentBinding.ts): Identity reads the agent that answers until you choose another (the hold Agent identity kept);
  // Custody the dialogue's session, which reports no custody (each setting disabled with the op it lacks; its write mode Scope's); the
  // Thread the bound session's conversation, on the same shared observer, its Approve and Hard stop that session's own encounter verbs;
  // Voice the Answer's voice, above.
  const identity = useIdentityDevice(transport, centralAgentRef(answerInput), IDENTITY_DEVICE_ID)
  const holds = useChainHolds()
  const custody = useMemo(() => custodyBinding({sessionRef: nara.session, autonomy: null, agent: own.values}, scope), [nara.session, own.values, scope])
  const thread = useMemo(() => {
    const shown = shownSession({selected: nara.session, holds}, CENTRAL_THREAD_HOLD)
    const handle = shown ? encounters.handles[shown] : undefined
    const state = observedState(handle)
    const actions = handle && 'actions' in handle ? handle.actions : undefined
    return threadBinding({selected: nara.session, chainSession: nara.session, tracks: agency.tracks, nowUnixMs,
      encounter: state ? {reading: state.reading, status: state.status} : null, agent: own.values, holds}, own, {
      ...(actions ? {permission: (id: string, decision: Parameters<typeof actions.permission>[1]) => actions.permission(id, decision), cancel: async () => actions.cancel()} : {}),
      // Central has no session selection of its own: choosing a session pins the Agent's Thread page to it.
      select: ref => { holdView(CENTRAL_THREAD_HOLD, 'session', ref); holdView(CENTRAL_THREAD_HOLD, 'pin', true) },
    }, CENTRAL_THREAD_HOLD)
  }, [nara.session, holds, encounters.handles, agency.tracks, nowUnixMs, own])
  const agent = useMemo(() => composeAgentBinding(own, {custody, identity, thread, voice: voiceDesign}), [own, custody, identity, thread, voiceDesign])
  // The line where you type @ (§18.4): an @ word in the Agent's composer opens Search in a pane on it (searchPane.tsx).
  useAtSearch(typeof agent.values.draft === 'string' ? agent.values.draft : undefined)
  const agentDraft = typeof agent.values.draft === 'string' ? agent.values.draft : null
  const agentWrite = agent.write
  // Approvals on the Main track (§18.1): the proposals the Agent's session waits on — its consent requests — answered through its own
  // encounter; the view's settings the one Approvals' (receiptBindings.ts).
  const naraTrack = nara.session ? agency.tracks.find(track => track.sessionRef === nara.session && !track.group) ?? null : null
  // The returned work that waits (Central's source returns, lane K1's source_returns_read): the project the window works in — the read
  // Factory's Approvals shares (Central refuses the root register: "project is required").
  const returns = useSourceReturnsAnswer(transport, APPROVALS_PROJECT).reading
  const returned = returns.status === 'answered' ? returns.value : null
  // Approve (W2, as Factory's Main track): the person who accepts is the principal Central's personal anchor names, asked only while a
  // proposal waits; the press is Central's projectcentral.source.return_accept (sourceReturnAccept.ts, action.rs PERSON_ACTS).
  const waiting = !!returned?.entries.some(entry => entry.status === 'pending')
  const anchor = useCentralAction(transport, PERSONAL_ANCHOR_ACTION, waiting ? NO_INPUT : null)
  const person = anchor.status === 'answered' ? personRefOf(anchor.value) : null
  // Notifications' readings, which wait in Approvals under Requests (§23.9; the Notifications device was retired into Approvals in the 22 Oct
  // manual rewrite): the requests Central keeps for personal.notify, Messages' waiting agents and the desktop's notice (railBindings.ts
  // withOwnerRequests), read through the rail's own reader (widgets/railDevices.tsx useOwnerRequests).
  const ownerRequests = useOwnerRequests(transport)
  const approvals = useMemo(() => {
    const actions = answerHandle && 'actions' in answerHandle ? answerHandle.actions : undefined
    const binding = approvalsBinding({gateway: {}, session: naraTrack, encounter: answerObserved?.reading ?? null, holds, returns: returned, tracks: agency.tracks, nowUnixMs: nowUnixMs || Date.now()}, null,
      {...(actions ? {permission: (id, decision) => actions.permission(id, decision)} : {}), approve: row => acceptSourceReturn(transport, APPROVALS_PROJECT, row, person)},
      CENTRAL_APPROVALS_ID)
    // Changes (W6): a comment on the return, in the words written in the thread — the Agent's composer here — through Central's
    // projectcentral.source.return_comment (sourceReturnComment.ts); once Central keeps it, the composer is cleared.
    const commented = withReturnComments(binding, {returns: returned, comment: agentDraft}, {
      send: (row, words) => commentSourceReturn(transport, APPROVALS_PROJECT, row, words, person),
      after: () => { void agentWrite?.([{key: 'draft', value: ''}]) },
    })
    // Open marks an item opened here (the one Approvals' view hold), after opening an owner's request where it belongs.
    const opened = openedOf(viewHolds(holds, APPROVALS_ID).opened)
    const requested = withOwnerRequests(commented, {...ownerRequests, nowUnixMs: nowUnixMs || Date.now()}, openNotificationTarget,
      {opened, hold: ids => holdView(APPROVALS_ID, 'opened', openedHold(ids))})
    return {...requested, standing: {...requested.standing, approvals: {disabled: CENTRAL_DEFAULT_ANSWER}}}
  }, [answerHandle, naraTrack, answerObserved, holds, returned, agency.tracks, nowUnixMs, transport, person, agentDraft, agentWrite, ownerRequests])
  const others = useMemo(() => centralAgentDevices(), [])
  // Docs (§18.5) on the selected world (pageBindings.ts docsBinding): its subject is the track's world; its readings of the account and its
  // acts wait for its binding to the six tiers (the PR #705 handoff's own item), each naming that.
  const docsWorld = pageWorld.world
  const holdsNow = useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const docs = useMemo(() => docsBinding(DOCS_DEVICE_ID, docsWorld), [docsWorld, holdsNow]) // eslint-disable-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  const bindingOf = (id: string): DesignBinding | null => (id === DAY_DEVICE_ID ? dayBinding : id === PACKET_DEVICE_ID ? packet : id === DOCS_DEVICE_ID ? docs : null)
  // What stands on the door now; a device that left the chain leaves the door too. The family's faces that stand on no chain (the page
  // family, Agent identity, Context & world, Search) are cleared once, so nothing stale of them stays on the door.
  const published = useRef(new Set<string>())
  useEffect(() => {
    const now = new Set(entries.map(entry => entry.id))
    for (const id of published.current) if (!now.has(id)) publishDevice(id, null)
    for (const entry of entries) publishDevice(entry.id, centralPublication(entry, bindingOf(entry.id)))
    published.current = now
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bindingOf reads the bindings named here
  }, [entries, dayBinding, packet, docs])
  useEffect(() => {
    if (others.agent) publishDevice(CENTRAL_AGENT_ID, {device: others.agent, binding: agent})
    if (others.scope) publishDevice(CENTRAL_SCOPE_ID, {device: others.scope, binding: scope})
    if (others.approvals) publishDevice(CENTRAL_APPROVALS_ID, {device: others.approvals, binding: approvals})
  }, [others, agent, scope, approvals])
  useEffect(() => {
    for (const id of [IDENTITY_DEVICE_ID, CONTEXT_WORLD_DEVICE_ID, SEARCH_DEVICE_ID]) publishDevice(id, null)
    return () => {
      for (const face of manifest?.faces ?? []) publishDevice(centralDeviceId(face.id), null)
      for (const id of [CENTRAL_AGENT_ID, CENTRAL_SCOPE_ID, CENTRAL_APPROVALS_ID]) publishDevice(id, null)
    }
  }, [manifest])
  const place = centralChainOf(selection)
  const openFull = (id: string, title: string) => openInstrument(DEVICE_PANE_KIND, undefined, {ref: id, title})
  const familySlot = (entry: CentralDeviceEntry) => <div key={entry.id} className="central-device-slot" data-face-id={entry.id.slice(CENTRAL_FAMILY.length + 1)}>
    <DeviceView device={entry.device} size="compact" picture={entry.picture('compact')} marks={entry.marks} binding={bindingOf(entry.id) ?? undefined} actions={[
      {icon: 'detail', label: 'Select it: the keys and the status bar speak to it; its expanded view stands whole above the chain', onPress: () => selectDevice(entry.id)},
      {icon: 'pane', label: `Open ${entry.device.face.title} full size in a pane`, onPress: () => openFull(entry.id, entry.device.face.title)},
    ]} /></div>
  const otherSlot = (id: string, device: DeviceInstance | null, binding: DesignBinding, title: string, full: string) => device && <div key={id} className="central-device-slot" data-device-id={id}>
    <DeviceView device={device} size="compact" binding={binding} actions={[
      {icon: 'detail', label: `Select ${title}: the keys and the status bar speak to it; its expanded view stands whole above the chain`, onPress: () => selectDevice(id)},
      {icon: 'pane', label: full, onPress: () => openFull(id, title)},
    ]} /></div>
  // Each slot of §16.2's chains, by its device's id: the family's own faces, and the Agent, Scope and Approvals of the families that own them.
  const otherSlots: Readonly<Record<string, ReactNode>> = {
    [CENTRAL_AGENT_ID]: otherSlot(CENTRAL_AGENT_ID, others.agent, agent, 'the Agent', 'Open the Agent full in a pane: its thread'),
    [CENTRAL_SCOPE_ID]: otherSlot(CENTRAL_SCOPE_ID, others.scope, scope, 'Scope', 'Open Scope full size in a pane'),
    [CENTRAL_APPROVALS_ID]: otherSlot(CENTRAL_APPROVALS_ID, others.approvals, approvals, 'Approvals', 'Open Approvals full size in a pane'),
  }
  const slot = (id: string): ReactNode => {
    if (id in otherSlots) return otherSlots[id]
    const entry = entries.find(candidate => candidate.id === id)
    return entry ? familySlot(entry) : null
  }
  const code = chainWorld.kind === 'project' ? chainWorld.code : null
  const codeWords = chainWorld.kind === 'none' ? 'No world\'s track is selected.'
    : chainWorld.kind === 'yours' ? 'Your world keeps its pages in Control/user/flows; its folder holds no code.'
      : code === 'holds' ? `${chainWorld.name}'s folder holds code: Central's git reading found its repository.`
        : code === 'none' ? `${chainWorld.name}'s folder holds no code: Central's git reading finds no repository.`
          : code === 'reading' ? `Reading whether ${chainWorld.name}'s folder holds code…`
            : `Whether ${chainWorld.name}'s folder holds code is unknown: ${code && typeof code === 'object' ? code.refused : ''}`
  return <div className="central-devices-chain" data-central-devices={entries.length} data-central-track={place}>
    {encounters.observers}
    {place !== 'workspace' && <div className="central-track-chain" data-track="main" aria-label="Main track"
      data-i="Main track|The Day's chain: the Day, then Approvals — the proposals the agents wait on, from every world.">
      {centralChainSlots('main').map(slot)}
    </div>}
    {place !== 'main' && <div className="central-track-chain" data-track="workspace" aria-label="World" data-world={chainWorld.kind}
      data-code={code === null ? undefined : typeof code === 'object' ? 'refused' : code}
      data-i={`World|A world's chain: the Packet, the agent of the world and its Scope, then Docs, the world's account on six tiers. ${codeWords}`}>
      {centralChainSlots('world').map(slot)}
      {code !== null && typeof code === 'object' && <p className="central-chain-note" role="status">{codeWords}</p>}
    </div>}
  </div>
}
