// The Central family's devices as devices of the runtime (FOUNDATION F5; manual §10.4): the Day die, the Nara conversation,
// and the Context-world, Agent identity, Ground hygiene and Impact readings, each a `DeviceInstance` the three sizes draw;
// and the Flow, which the family declares a `clip` (worldShellFamilies.ts) and so stands on the Clip side with its states as
// a row (`centralDevice` builds its instance too, so one gate reads every declared face). Pure: no React, no transport. The
// family declares the faces (inhabitants/worldShellFamilies.ts, centralFamilyManifest.ts); this module reads them from the
// door, adds nothing the family did not declare, and turns the owners' readings (passed in) into the instance's values.
//
// Owners write, faces read (lock §0.4), and a device keeps its Live semantic at every size (lock §0.1; manual §10.4 "all three
// show the same live settings"). A `device-instrument` declares the owner op that generates (`invariant.generates`), so its
// instance carries a write row on that path and a `submit`, and the compact, whole and full sizes all draw it:
//   - the Day die: the open face, written through `kernel:receiving` (mutate-field on the Day document; centralDeviceWrites.ts);
//   - the Nara conversation: the binding, resolved through `kernel:nara_dialogue` (centralDeviceWrites.ts).
// Every other row is a reading. A light is the owner's reading and stays dark when the owner has not answered. A row whose
// writer has no aperture refuses by name, and the draft is kept (the runtime's own law).
import type {DeviceDeclaration, SdkParamRow} from '../../inhabitants/sdk/define'
import type {IconName, KindShapeName} from '../../inhabitants/sdk/icons'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import type {InhabitantFaceDeclaration} from '../../inhabitants/manifest'
import {AGENT_SHELL_ADDRESS_TABLE} from '../../inhabitants/agentParamAddresses'
import {casShort} from '../../inhabitants/centralDayNowModel'
import type {DayDocumentStanding} from '../centralVertical'
import {DIE_POSITIONS, dieFaceLabel} from './dayDie'

export const CENTRAL_FAMILY = 'central'

/** The device faces this module knows, in the order the chain draws them: the Day and the conversation (the work), then the
 * readings. A device face the family declares that is not named here is still drawn, generically, after these. A face the
 * family declares a `clip` (the Flow) is not a device: it stands on the Clip side (`clipFaces`). */
export const CENTRAL_DEVICE_FACES = ['day-die', 'nara-conversation', 'context-world', 'agent-identity', 'ground-hygiene', 'impact'] as const

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
  /** The Flow the aperture selects, the revision the owner holds, and the state the hosted form discloses (one of the clip's
   * declared states; absent while nothing discloses one). */
  readonly flow?: {readonly path: string; readonly revision: string | null; readonly state?: string | null} | null
  /** The conversation face: where the binding stands, and the binding's own fields once bound. */
  readonly nara?: {readonly state: NaraState; readonly conversation: string | null; readonly gap: string | null; readonly expression: string | null; readonly session: string | null}
  /** The accepted agents on Central's roster (central.agent-profile-roster/v1). */
  readonly roster?: {readonly answer: Answer; readonly identity: string | null; readonly accepted: number; readonly total: number; readonly fault: string | null}
  /** The workcell status reading (op workcell_status_read). */
  readonly workcell?: {readonly answer: Answer; readonly ref: string | null; readonly health: string | null; readonly ok: boolean | null; readonly fault: string | null}
  /** The subject the Impact reads: the browser's selected folder, note or day. */
  readonly impact?: {readonly kind: string; readonly path: string} | null
}

/** One owner write: the value the row carries in, the owner's own refusal thrown out (centralDeviceWrites.ts). */
export type CentralWrite = (value: ParamValue) => Promise<void>
/** The owners' write paths the devices hold, by face id and row key. A writable row whose writer is absent (its aperture does
 * not stand) refuses by name. */
export type CentralWriters = Readonly<Record<string, Readonly<Record<string, CentralWrite>>>>

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

/** A row the owner writes: the write path is the one the family declared its instrument generates through
 * (`invariant.generates`, lock §5.3) — nothing is added that the family did not declare. A face that declares none gets a
 * reading, the grammar's own rule for a row with no writer. */
const writing = (face: InhabitantFaceDeclaration, key: string, title: string, group: string, type: string, extra: RowExtra = {}): SdkParamRow => {
  const row = reading(face.id, key, title, group, type, extra)
  const path = face.invariant?.generates
  return path ? {...row, writePath: path} : row
}

/** The family's declared rows for one chain device (inhabitants/agentParamAddresses.ts), as readings of this chain. */
function tableRows(deviceInstance: string, group: string, extra: Readonly<Record<string, RowExtra>>): SdkParamRow[] {
  return AGENT_SHELL_ADDRESS_TABLE
    .filter(row => row.family === CENTRAL_FAMILY && row.deviceInstance === deviceInstance)
    .map(row => ({...row, title: humanise(row.key), group, ...extra[row.key]}) as SdkParamRow)
}

const DAY_ABSENT = 'No Day is selected. Select one in the browser\'s ground.'

function dayRows(face: InhabitantFaceDeclaration, standing: DayDocumentStanding | null | undefined): SdkParamRow[] {
  const absent = standing?.state === 'uninitialised'
    ? `Day ${standing.civilDate} has no Day document yet; the owner's ${standing.op} admits it.`
    : standing?.state === 'refused' ? `The owner refused Day ${standing.civilDate}: ${standing.message}` : DAY_ABSENT
  return [
    reading(face.id, 'day', 'Day', 'Die', 'string', {compact: true, disclosure: absent}),
    writing(face, 'face', 'Open face', 'Die', 'enumerated', {
      compact: true, values: DIE_POSITIONS.map(position => dieFaceLabel(position.n)),
      disclosure: absent,
    }),
    reading(face.id, 'revision', 'Revision', 'Source', 'string', {compact: true, disclosure: 'The owner\'s CAS revision of the Day document.'}),
    reading(face.id, 'source', 'Source', 'Source', 'string', {disclosure: 'The Day document\'s native source ref.'}),
  ]
}

function naraRows(face: InhabitantFaceDeclaration, reads: CentralReads['nara']): SdkParamRow[] {
  return [
    reading(face.id, 'standing', 'Standing', 'Binding', 'enumerated', {compact: true, values: (['bound', 'resolving', 'unbound', 'no-identity', 'no-expression', 'refused'] as const).map(naraStandingLabel)}),
    reading(face.id, 'conversation', 'Conversation', 'Binding', 'string', {compact: true, disclosure: 'No conversation is selected.'}),
    writing(face, 'bound', 'Bound', 'Binding', 'boolean', {compact: true, disclosure: reads?.gap ?? 'Binding resolves the dialogue through AIKit (op nara_dialogue); the owner holds the session, and nothing here releases it.'}),
    reading(face.id, 'expression', 'Expression', 'Binding', 'string', {disclosure: reads?.gap ?? 'No expression is bound.'}),
    reading(face.id, 'session', 'Session', 'Binding', 'string', {disclosure: 'AIKit holds the session once the binding resolves.'}),
  ]
}

/** The Flow clip's rows: the material and its revision, and the clip's states as a row (lock §5.3: a clip binds material at a
 * revision with a state). The row names the states the family declared and reads the one the hosted form discloses. */
function flowRows(face: InhabitantFaceDeclaration): SdkParamRow[] {
  const states = face.invariant?.states
  return [
    reading(face.id, 'document', 'Document', 'Flow', 'string', {compact: true, disclosure: 'No flow document is selected.'}),
    reading(face.id, 'revision', 'Revision', 'Flow', 'string', {compact: true, disclosure: 'The owner\'s CAS revision (central.files.write).'}),
    reading(face.id, 'state', 'State', 'Flow', 'enumerated', {
      compact: true, ...(states ? {values: [...states]} : {}),
      disclosure: 'Saved: the owner holds this revision and the hosted form holds nothing it has not. Edited since save: the form holds edits the owner has not. Draft: a Flow not yet written has no owner revision, and no route here makes one.',
    }),
  ]
}

function rowsFor(face: InhabitantFaceDeclaration, reads: CentralReads): SdkParamRow[] {
  const faceId = face.id
  switch (faceId) {
    case 'day-die': return dayRows(face, reads.day?.standing)
    case 'flow-document': return flowRows(face)
    case 'nara-conversation': return naraRows(face, reads.nara)
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
      if (reads.flow) {
        values.document = reads.flow.path
        if (reads.flow.revision) values.revision = casShort(reads.flow.revision)
        if (reads.flow.state) values.state = reads.flow.state
      }
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

/** The write door of a device: each changed row goes to its own owner path and nowhere else. Present exactly where the
 * device has a row with a write path (the runtime reads a device with no `submit` as all readings). */
function submitOf(faceId: string, rows: readonly SdkParamRow[], writers: CentralWriters): DeviceInstance['submit'] | undefined {
  if (!rows.some(row => row.writePath)) return undefined
  return async changes => {
    for (const change of changes) {
      const row = rows.find(candidate => candidate.key === change.key)
      if (!row?.writePath) throw new Error(`${change.key}: no owner write is declared for this row`)
      const write = writers[faceId]?.[change.key]
      if (!write) throw new Error(`${row.title}: the owner path ${row.writePath} has no aperture in this chain`)
      await write(change.value)
    }
  }
}

/** One Central face as a device of the runtime, over the owners' readings and the owners' write paths it holds. */
export function centralDevice(face: InhabitantFaceDeclaration, reads: CentralReads, writers: CentralWriters = {}): DeviceInstance {
  const {values, enabledKey} = valuesFor(face.id, reads)
  const rows = rowsFor(face, reads)
  const submit = submitOf(face.id, rows, writers)
  return {id: centralDeviceId(face.id), family: CENTRAL_FAMILY, face: centralDeclaration(face), rows, values, ...(enabledKey ? {enabledKey} : {}), ...(submit ? {submit} : {})}
}

/** The family's declared faces in chain order: the known ones first, then any other the family declares. */
export function orderedFaces(faces: readonly InhabitantFaceDeclaration[]): InhabitantFaceDeclaration[] {
  const known = CENTRAL_DEVICE_FACES.flatMap(id => faces.filter(face => face.id === id))
  return [...known, ...faces.filter(face => !(CENTRAL_DEVICE_FACES as readonly string[]).includes(face.id))]
}

/** A face the family declares a `clip` is the Clip side's, not a device's (lock §0.1: an element that does not keep a
 * semantic's invariant may not claim it; §2.2: the Flow is a document, the Device chain is the effects on it). */
export const isClipFace = (face: Pick<InhabitantFaceDeclaration, 'liveSemantic'>): boolean => face.liveSemantic === 'clip'

/** The faces that stand on the Device chain: every declared face but the clips. */
export const chainFaces = (faces: readonly InhabitantFaceDeclaration[]): InhabitantFaceDeclaration[] => orderedFaces(faces).filter(face => !isClipFace(face))

/** The faces that stand on the Clip side: the family's clips (the Flow). */
export const clipFaces = (faces: readonly InhabitantFaceDeclaration[]): InhabitantFaceDeclaration[] => faces.filter(isClipFace)

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
