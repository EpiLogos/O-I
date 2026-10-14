// The Central family's devices as devices of the runtime (FOUNDATION F5; manual §10.4): the Day die, the Flow, the Nara
// conversation, and the Context-world, Agent identity, Ground hygiene and Impact readings, each a `DeviceInstance` the
// three sizes draw. Pure: no React, no transport. The family declares the faces (inhabitants/worldShellFamilies.ts,
// centralFamilyManifest.ts); this module reads them from the door, adds nothing the family did not declare, and turns the
// owners' readings (passed in) into the instance's values.
//
// Owners write, faces read (lock §0.4): every Central row here is a reading. The Day die and the Flow write through their
// bodies (`kernel:receiving` mutate-field per field; `central.files.write` under a CAS revision) and the conversation through
// the encounter surface; none declares a per-row owner write, so none is dressed as a control. A light is the owner's
// reading and stays dark when the owner has not answered.
import type {DeviceDeclaration, SdkParamRow} from '../../inhabitants/sdk/define'
import type {IconName, KindShapeName} from '../../inhabitants/sdk/icons'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import type {InhabitantFaceDeclaration} from '../../inhabitants/manifest'
import {AGENT_SHELL_ADDRESS_TABLE} from '../../inhabitants/agentParamAddresses'
import {casShort} from '../../inhabitants/centralDayNowModel'
import type {DayDocumentStanding} from '../centralVertical'
import {DIE_POSITIONS, dieFaceLabel} from './dayDie'

export const CENTRAL_FAMILY = 'central'

/** The faces this module knows, in the order the chain draws them: the documents and the conversation (the work), then the
 * readings. A face the family declares that is not named here is still drawn, generically, after these. */
export const CENTRAL_DEVICE_FACES = ['day-die', 'flow-document', 'nara-conversation', 'context-world', 'agent-identity', 'ground-hygiene', 'impact'] as const

export const centralDeviceId = (faceId: string): string => `${CENTRAL_FAMILY}:${faceId}`

/** The human names of the declared faces (inhabitants/inhabitantRack.tsx:337-343) and their marks from the cut
 * (inhabitants/sdk/adoptVerifiedRows.ts:38-39 for the two it already marks; the rest from icon-cut.html). */
const FACES: Readonly<Record<string, {title: string; icon: IconName}>> = {
  'day-die': {title: 'Day die', icon: 'die'},
  'flow-document': {title: 'Flow', icon: 'journey'},
  'nara-conversation': {title: 'Conversation', icon: 'dock'},
  'context-world': {title: 'Context · world', icon: 'orbit'},
  'agent-identity': {title: 'Agent identity', icon: 'contact'},
  'ground-hygiene': {title: 'Ground hygiene', icon: 'placed'},
  'impact': {title: 'Impact', icon: 'map'},
}

const humanise = (key: string): string => key.split('-').map(part => (part ? part[0]!.toUpperCase() + part.slice(1) : '')).join(' ')

/** The declaration a device carries: the family's own face (semantic, invariant, kind, note), titled and marked. */
export function centralDeclaration(face: InhabitantFaceDeclaration): DeviceDeclaration {
  const known = FACES[face.id]
  return {
    id: face.id, title: known?.title ?? humanise(face.id), icon: known?.icon ?? 'form', liveSemantic: face.liveSemantic,
    ...(face.invariant ? {invariant: face.invariant} : {}), ...(face.kind ? {kind: face.kind} : {}), ...(face.note ? {note: face.note} : {}),
  } as DeviceDeclaration
}

// ---------------------------------------------------------------------------
// the owners' readings, as the hooks (useCentralReadings.ts) hand them in

export type NaraState = 'no-identity' | 'no-expression' | 'resolving' | 'bound' | 'unbound' | 'refused'
type Answer = 'reading' | 'read' | 'refused'

export interface CentralReads {
  /** The Day: the owner's open-day standing, and what the document reading holds (the open face, the CAS revision). */
  readonly day?: {readonly standing: DayDocumentStanding | null; readonly face: number | null; readonly revision: string | null}
  /** The Flow the aperture selects, and the revision the owner holds. */
  readonly flow?: {readonly path: string; readonly revision: string | null} | null
  /** The conversation face: where the binding stands, and the binding's own fields once bound. */
  readonly nara?: {readonly state: NaraState; readonly conversation: string | null; readonly gap: string | null; readonly expression: string | null; readonly session: string | null}
  /** The accepted agents on Central's roster (central.agent-profile-roster/v1). */
  readonly roster?: {readonly answer: Answer; readonly identity: string | null; readonly accepted: number; readonly total: number; readonly fault: string | null}
  /** The workcell status reading (op workcell_status_read). */
  readonly workcell?: {readonly answer: Answer; readonly ref: string | null; readonly health: string | null; readonly ok: boolean | null; readonly fault: string | null}
  /** The subject the Impact reads: the browser's selected folder, note or day. */
  readonly impact?: {readonly kind: string; readonly path: string} | null
}

/** The standing the Nara face states for each binding state (inhabitants/ConversationNaraFace.tsx:138-147, unchanged). */
export function naraStandingLabel(state: NaraState): string {
  switch (state) {
    case 'bound': return 'bound'
    case 'resolving': return 'resolving…'
    case 'unbound': return 'unbound — declared, waiting'
    case 'no-identity': return 'no identity — disclosed absence'
    case 'no-expression': return 'no subject — disclosed absence'
    case 'refused': return 'refused'
  }
}

// ---------------------------------------------------------------------------
// rows

type RowExtra = Partial<Pick<SdkParamRow, 'compact' | 'disclosure' | 'values'>>
const reading = (faceId: string, key: string, title: string, group: string, type: string, extra: RowExtra = {}): SdkParamRow =>
  ({family: CENTRAL_FAMILY, deviceInstance: faceId, key, title, type, group, ...extra}) as SdkParamRow

/** The family's declared rows for one chain device (inhabitants/agentParamAddresses.ts), as readings of this chain. */
function tableRows(deviceInstance: string, group: string, extra: Readonly<Record<string, RowExtra>>): SdkParamRow[] {
  return AGENT_SHELL_ADDRESS_TABLE
    .filter(row => row.family === CENTRAL_FAMILY && row.deviceInstance === deviceInstance)
    .map(row => ({...row, title: humanise(row.key), group, ...extra[row.key]}) as SdkParamRow)
}

const DAY_ABSENT = 'No Day is selected. Select one in the browser\'s ground.'

function dayRows(standing: DayDocumentStanding | null | undefined): SdkParamRow[] {
  const absent = standing?.state === 'uninitialised'
    ? `Day ${standing.civilDate} has no Day document yet; the owner's ${standing.op} admits it.`
    : standing?.state === 'refused' ? `The owner refused Day ${standing.civilDate}: ${standing.message}` : DAY_ABSENT
  return [
    reading('day-die', 'day', 'Day', 'Die', 'string', {compact: true, disclosure: absent}),
    reading('day-die', 'face', 'Open face', 'Die', 'enumerated', {
      compact: true, values: DIE_POSITIONS.map(position => dieFaceLabel(position.n)),
      disclosure: 'The die turns inside its own form; the host declares no turn channel, so the face is a reading.',
    }),
    reading('day-die', 'revision', 'Revision', 'Source', 'string', {compact: true, disclosure: 'The owner\'s CAS revision of the Day document.'}),
    reading('day-die', 'source', 'Source', 'Source', 'string', {disclosure: 'The Day document\'s native source ref.'}),
  ]
}

function naraRows(reads: CentralReads['nara']): SdkParamRow[] {
  return [
    reading('nara-conversation', 'standing', 'Standing', 'Binding', 'enumerated', {compact: true, values: (['bound', 'resolving', 'unbound', 'no-identity', 'no-expression', 'refused'] as const).map(naraStandingLabel)}),
    reading('nara-conversation', 'conversation', 'Conversation', 'Binding', 'string', {compact: true, disclosure: 'No conversation is selected.'}),
    reading('nara-conversation', 'expression', 'Expression', 'Binding', 'string', {disclosure: reads?.gap ?? 'No expression is bound.'}),
    reading('nara-conversation', 'session', 'Session', 'Binding', 'string', {disclosure: 'AIKit holds the session once the binding resolves.'}),
  ]
}

function rowsFor(faceId: string, reads: CentralReads): SdkParamRow[] {
  switch (faceId) {
    case 'day-die': return dayRows(reads.day?.standing)
    case 'flow-document': return [
      reading(faceId, 'document', 'Document', 'Flow', 'string', {compact: true, disclosure: 'No flow document is selected.'}),
      reading(faceId, 'revision', 'Revision', 'Flow', 'string', {compact: true, disclosure: 'The owner\'s CAS revision (central.files.write).'}),
    ]
    case 'nara-conversation': return naraRows(reads.nara)
    case 'context-world': return tableRows('world', 'Reach', {
      reads: {compact: true, disclosure: 'The scope an agent reads is its session\'s context; this chain holds no session, so there is no reading.'},
      writes: {compact: true, disclosure: 'The scope an agent writes is its session\'s context; this chain holds no session, so there is no reading.'},
    })
    case 'agent-identity': return [
      ...tableRows('agent', 'Identity', {identity: {compact: true}}),
      reading(faceId, 'roster', 'Roster', 'Identity', 'string', {compact: true, disclosure: 'Accepted agents on the roster (central.agent-profile-roster/v1).'}),
    ]
    case 'ground-hygiene': return [
      reading(faceId, 'workcell', 'Workcell', 'Ground', 'string', {compact: true, disclosure: 'The workcell status reading (op workcell_status_read).'}),
      reading(faceId, 'health', 'Health', 'Ground', 'string', {compact: true, disclosure: 'The workcell\'s own health word.'}),
    ]
    case 'impact': return [
      reading(faceId, 'subject', 'Subject', 'Neighbourhood', 'string', {compact: true, disclosure: 'Select a folder or note in the browser.'}),
      reading(faceId, 'neighbourhood', 'Neighbourhood', 'Neighbourhood', 'string', {compact: true, disclosure: 'Read when the Impact opens full: the graph, files and NOW legs each name their owner op.'}),
    ]
    default: return []
  }
}

function valuesFor(faceId: string, reads: CentralReads): {values: Record<string, ParamValue>; enabledKey?: string} {
  const values: Record<string, ParamValue> = {}
  switch (faceId) {
    case 'day-die': {
      const day = reads.day
      if (day?.standing) values.day = day.standing.civilDate
      if (day?.face != null) values.face = dieFaceLabel(day.face)
      if (day?.revision) values.revision = casShort(day.revision)
      if (day?.standing?.state === 'ready') values.source = day.standing.sourceRef
      if (day?.standing) values.ready = day.standing.state === 'ready'
      return {values, enabledKey: 'ready'}
    }
    case 'flow-document': {
      if (reads.flow) { values.document = reads.flow.path; if (reads.flow.revision) values.revision = casShort(reads.flow.revision) }
      return {values}
    }
    case 'nara-conversation': {
      const nara = reads.nara
      if (!nara) return {values}
      values.standing = naraStandingLabel(nara.state)
      if (nara.conversation) values.conversation = nara.conversation
      if (nara.expression) values.expression = nara.expression
      if (nara.session) values.session = nara.session
      if (nara.state !== 'resolving') values.bound = nara.state === 'bound'
      return {values, enabledKey: 'bound'}
    }
    case 'agent-identity': {
      const roster = reads.roster
      if (roster?.answer !== 'read') return {values}
      if (roster.identity) values.identity = roster.identity
      values.roster = `${roster.accepted} accepted · ${roster.total} on the roster`
      values.accepted = roster.accepted > 0
      return {values, enabledKey: 'accepted'}
    }
    case 'ground-hygiene': {
      const workcell = reads.workcell
      if (workcell?.answer !== 'read') return {values}
      if (workcell.ref) values.workcell = workcell.ref
      if (workcell.health) values.health = workcell.health
      if (workcell.ok !== null) values.ok = workcell.ok
      return {values, enabledKey: 'ok'}
    }
    case 'impact': {
      if (reads.impact) values.subject = `${reads.impact.kind} · ${reads.impact.path}`
      return {values}
    }
    default: return {values}
  }
}

/** One Central face as a device of the runtime, over the owners' readings. */
export function centralDevice(face: InhabitantFaceDeclaration, reads: CentralReads): DeviceInstance {
  const {values, enabledKey} = valuesFor(face.id, reads)
  return {id: centralDeviceId(face.id), family: CENTRAL_FAMILY, face: centralDeclaration(face), rows: rowsFor(face.id, reads), values, ...(enabledKey ? {enabledKey} : {})}
}

/** The family's declared faces in chain order: the known ones first, then any other the family declares. */
export function orderedFaces(faces: readonly InhabitantFaceDeclaration[]): InhabitantFaceDeclaration[] {
  const known = CENTRAL_DEVICE_FACES.flatMap(id => faces.filter(face => face.id === id))
  return [...known, ...faces.filter(face => !(CENTRAL_DEVICE_FACES as readonly string[]).includes(face.id))]
}

// ---------------------------------------------------------------------------
// pictures

/** What each device draws as its small live picture: the Day die its die; every other the mark its card carried in the rack
 * (inhabitants/inhabitantRack.tsx:113-119), and the one-line standing the owner's reading gives it. */
export interface CentralPicture {
  readonly kind: KindShapeName | 'die'
  readonly caption: string
}

export function centralPicture(faceId: string, reads: CentralReads): CentralPicture {
  switch (faceId) {
    case 'day-die': return {kind: 'die', caption: reads.day?.face != null ? dieFaceLabel(reads.day.face) : reads.day?.standing ? `Day ${reads.day.standing.civilDate} · ${reads.day.standing.state}` : 'no Day stands'}
    case 'flow-document': return {kind: reads.flow ? 'doc' : 'ghost', caption: reads.flow ? reads.flow.path : 'no flow selected'}
    case 'nara-conversation': {
      const state = reads.nara?.state ?? 'no-expression'
      return {kind: state === 'bound' ? 'agent' : 'ghost', caption: naraStandingLabel(state)}
    }
    case 'context-world': return {kind: 'world', caption: 'Central ground reads · context writes'}
    case 'agent-identity': return {kind: 'agent', caption: reads.roster?.answer === 'read' ? (reads.roster.identity ?? 'no accepted agent') : reads.roster?.answer === 'refused' ? 'roster refused' : 'reading the roster…'}
    case 'ground-hygiene': return {kind: 'location', caption: reads.workcell?.answer === 'read' ? (reads.workcell.ref ?? 'workcell answered') : reads.workcell?.answer === 'refused' ? 'workcell refused' : 'reading the workcell…'}
    case 'impact': return {kind: 'expression', caption: reads.impact ? reads.impact.path : 'select a folder or note'}
    default: return {kind: 'ghost', caption: 'declared by the family'}
  }
}
