// The owner paths the Central devices write through (DEVICE-SEMANTICS-LOCK §0.4 owners write, faces read; §5.3 a device-
// instrument declares the owner op that generates; manual §10.4 "all three show the same live settings"). Each path is the
// one the device's hosted body already uses, ported — none is invented here:
//   - the Day die turns its open face the way the die's own Save writes a field: the owner's document reading, the
//     retained draft held by the imported `DayFormSession` (central/dayForm), and one `receiving` `mutate-field` per mapped
//     field, CAS-checked against the revision the reading gave (inhabitants/DocumentDayDieFace.tsx `saveToNative`; the
//     owner's own docstring calls this "the die face's write route", receiving/client.ts `mutateField`);
//   - the conversation binds the way the encounter surface binds it before a turn: the kernel's `nara_dialogue` op in its
//     `resolve` operation (`acquireNativeDialogue`, nara/nativeDialogue.ts; nara/NaraSurface.tsx `ensureDialogue`). The
//     hosted face only looks the binding up (`lookupNativeDialogue`) and names this operation in its unbound notice;
//   - the Day's "Open today" ensures the current Day the way the ground panel and the cradle's Today do: Central's ground read
//     again, then the `central` op `ensure-day` with the civil-time policy's revision (desktop/cradle/src/CradleFrame.tsx:734-740
//     `openToday`; desktop/cradle/src/central/CentralGround.tsx:49,75 `canEnsure` and its press). It is the person's press: nothing
//     calls it on a timer, and it neither closes an old Day nor initialises the new Day's document;
//   - the Flow takes the person's next entry the way the Flow's own surface writes one: the owner's file read again, the entry
//     appended through the template's own contract (flow/instance.ts appendEntry, relations and the composing basis on the current
//     form), and the Flow's revision-checked file write (flow/instances.ts writeFlowInstance — central.files.write, op
//     file_operation), whose conflict keeps the words and says so (desktop/cradle/src/flow/FlowSurface.tsx:153-165 `save`).
// A refusal is the owner's own words, thrown as they came; the device keeps the change and says so. Pure of React.
import {central, readGround} from '../../../../../../desktop/cradle/src/central/client'
import {DayFormSession, isObject, unmappedChanges, validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {appendEntry, embedDocument} from '../../../../../../desktop/cradle/src/flow/instance'
import {readFlowInstance, writeFlowInstance} from '../../../../../../desktop/cradle/src/flow/instances'
import {isCurrentFormat, type PluralParticipant, type Relation} from '../../../../../../desktop/cradle/src/flow/plural'
import type {CentralLocation} from '../../../../../../desktop/cradle/src/kernel/types'
import {acquireNativeDialogue, type NativeDialogue} from '../../../../../../desktop/cradle/src/nara/nativeDialogue'
import {announceContext, nativeContext, type ContextMutation, type PreparedContext} from '../../../../../../desktop/cradle/src/context/nativeContext'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {conversationGap} from '../centralVertical'
import {DIE_POSITIONS, dieFaceLabel, dieFaceOf} from './dayDie'
import {canEnsureDay} from './dayBinding'
import type {CentralWriters} from './centralDeviceModel'

export interface DayDieWriteAperture {
  readonly project: string | null
  readonly sourceRef: string
  readonly documentId: string
}

export interface ConversationWriteAperture {
  readonly project: string | null
  readonly expressionRef: string | null
  readonly conversation?: string | null
}

/** The die position a face label names (`#3 Pattern — Observations`), or null for a word that is no position of the die. */
export function dieFaceOfLabel(label: string): number | null {
  const position = DIE_POSITIONS.find(candidate => dieFaceLabel(candidate.n) === label)
  return position ? position.n : null
}

/** Turn the Day die to `face`: write the Day document's open face (`meta.face`) through the owner. Resolves to the revision
 * the owner holds afterwards. Nothing is written when the face is already open; a document whose field map carries no field
 * for the face is refused by name rather than written nowhere. */
export async function turnDieFace(transport: KernelTransportStatus, day: DayDieWriteAperture, face: number): Promise<{revision: string; wrote: boolean}> {
  if (!Number.isInteger(face) || face < 0 || face >= DIE_POSITIONS.length) throw new Error(`The die has six positions (#0 to #5); ${String(face)} is none of them.`)
  const reading = await receiving<unknown>(transport, day.project, {kind: 'document', source_ref: day.sourceRef, document_id: day.documentId})
  const basis = validateDocumentBasis(reading, day.sourceRef, day.documentId)
  if (!isObject(basis.payload) || !isObject(basis.payload.meta)) throw new Error('This Day document carries no meta, so the owner holds no open face to turn.')
  if (dieFaceOf(basis.payload) === face) return {revision: basis.revision, wrote: false}
  const draft = JSON.parse(JSON.stringify(basis.payload)) as {meta: Record<string, unknown>}
  draft.meta.face = face
  const session = new DayFormSession(basis)
  session.stage(draft)
  const unmapped = unmappedChanges(session.basis, draft)
  if (unmapped.length) throw new Error(`This Day document's field map carries no field for the die's open face (${unmapped.join(', ')}); the owner admits no turn here.`)
  await session.save(input => receiving<unknown>(transport, day.project, {kind: 'mutate-field', ...input}))
  return {revision: session.basis.revision, wrote: true}
}

/** Open today: ensure the current Day through Central, when the owner's own reading says that is the act that stands. Central's
 * ground is read again first, so the decision is the owner's present one (CradleFrame.tsx:735 reads it before it ensures): a Day
 * someone else already ensured is not ensured twice (`ensured: false`). Resolves once the owner has answered the ensure; rejects
 * with the owner's words. */
export async function openToday(transport: KernelTransportStatus): Promise<{ensured: boolean}> {
  const ground = await readGround(transport, null)
  if (ground.time.state !== 'ready' || !ground.time.data) {
    throw new Error(`Central's civil time is ${ground.time.state}${ground.time.error?.message ? `: ${ground.time.error.message}` : ''}; the current Day cannot be ensured`)
  }
  if (ground.day.state === 'ready' && ground.day.data?.temporal.civil_date === ground.time.data.civil_date) return {ensured: false}
  if (!canEnsureDay(ground)) {
    throw new Error(`Central's Day reading is ${ground.day.state}${ground.day.error?.message ? `: ${ground.day.error.message}` : ''}; the owner admits no ensure from here`)
  }
  await central(transport, null, {kind: 'ensure-day', expected_time_policy_revision: ground.time.data.revision})
  return {ensured: true}
}

/** Append the person's entry to a Flow: read the file again (the revision the write is checked against), append the entry as the
 * person through the template's contract — connected to an earlier entry by its relation on the current form — and write it with
 * the owner's revision check. Resolves with the owner's new revision; a conflict is refused in words (the entry is not lost: the
 * hand still holds it). The person is the Flow's person participant who has not left (FlowSurface.tsx writerOf); a Flow with none
 * is refused by the template's own words. */
export async function appendFlowEntry(transport: KernelTransportStatus, location: CentralLocation, entry: {readonly text: string; readonly speaker?: string;
  readonly relation: {readonly type: 'reply' | 'branch' | 'correct'; readonly entryId: string} | null}): Promise<{revision: string | null}> {
  const text = entry.text.trim()
  if (!text) throw new Error('The entry has no words.')
  const instance = await readFlowInstance(transport, location)
  const plural = isCurrentFormat(instance.doc)
  const people = ((instance.doc.meta.participants ?? []) as PluralParticipant[]).filter(person => person.kind === 'person' && !person.left)
  const writer = people.find(person => person.initial === entry.speaker) ?? people[0]
  if (entry.relation && !instance.doc.entries.some(candidate => candidate.id === entry.relation!.entryId)) throw new Error('The entry this one connects to is no longer in the Flow.')
  const relations: Relation[] = plural && entry.relation ? [{type: entry.relation.type, entryId: entry.relation.entryId, revision: instance.doc.meta.revision, anchor: null}] : []
  const {html} = appendEntry(instance.html, text, plural ? {participant: writer, relations, basisRevision: instance.doc.meta.revision} : undefined)
  const result = await writeFlowInstance(transport, instance.location, instance.revision, html)
  if (result.outcome === 'conflict') throw new Error(`The Flow moved while the entry was written (the owner holds ${result.current?.revision ?? 'a newer revision'}): nothing was overwritten. Re-read the Flow and write the entry again.`)
  return {revision: result.revision ?? null}
}

/** A Flow's own metadata — its title and the view it opens in — written the way its entries are: the owner's file read again, the
 * document's meta set and the document embedded back (flow/instance.ts embedDocument, its revision advanced), and the Flow's
 * revision-checked file write, whose conflict overwrites nothing and says so. */
export async function setFlowMeta(transport: KernelTransportStatus, location: CentralLocation, change: {readonly title?: string; readonly view?: string}): Promise<{revision: string | null}> {
  const instance = await readFlowInstance(transport, location)
  const meta = instance.doc.meta
  if (change.title !== undefined) {
    const title = change.title.trim()
    if (!title || title.length > 160 || /[\u0000-\u001f]/.test(title)) throw new Error('A Flow\'s title is 1–160 characters of text.')
    meta.title = title
  }
  if (change.view !== undefined) {
    if (!['dialogue', 'flow', 'journal'].includes(change.view)) throw new Error('A Flow opens as a Dialogue, a Flow or a Journal.')
    meta.view = change.view as typeof meta.view
  }
  meta.revision = meta.revision + 1
  const result = await writeFlowInstance(transport, instance.location, instance.revision, embedDocument(instance.html, instance.doc))
  if (result.outcome === 'conflict') throw new Error(`The Flow moved while its title or view was written (the owner holds ${result.current?.revision ?? 'a newer revision'}): nothing was overwritten. Re-read the Flow and set it again.`)
  return {revision: result.revision ?? null}
}

/** Bind the conversation: resolve (create or return) the dialogue binding for the current Nara identity and the aperture's
 * expression. The absences are the face's own words (inhabitants/ConversationNaraFace.tsx), so a refusal reads as the face reads. */
export async function bindConversation(transport: KernelTransportStatus, conversation: ConversationWriteAperture): Promise<NativeDialogue> {
  const identity = currentIdentity()
  if (!identity) throw new Error('No Nara identity is current. The binding waits for its person: select an identity through the identity owner; nothing is fabricated here.')
  if (!conversation.expressionRef) {
    throw new Error(conversation.conversation ? conversationGap(conversation.conversation)
      : 'No expression is selected. A conversation binds to the encounter\'s subject: select one, and the binding resolves through its owner.')
  }
  return acquireNativeDialogue(transport, conversation.project ?? '', identity, conversation.expressionRef, 'nara')
}

/** Take one item out of the packet, or empty it: AIKit's prepared context edited at the revision the reading gave (op encounter,
 * action context, operation edit — nativeContext.ts), in the scope the reading names, and the owner's answer announced so every reader
 * of the packet (the Packet widget, the transport's Key slot, this device) holds the same items. Ported from the Context plane's own
 * remove and clear (desktop/cradle/src/context/PreparedContextView.tsx:30 `perform`, :39-40). A stale basis is the owner's refusal. */
export async function editPacket(transport: KernelTransportStatus, context: PreparedContext, mutation: Extract<ContextMutation, {operation: 'remove' | 'clear'}>): Promise<PreparedContext> {
  const {project, agent_session: session} = context.scope
  const next = await nativeContext(transport, project, session ?? undefined, {operation: 'edit', basis: context.revision, mutation})
  announceContext(project, next)
  return next
}

/** The Central devices' writers over the apertures they hold: one owner path per writable row, by face and row key. A device
 * whose aperture does not stand has no writer, and its row refuses by name. `afterWrite` lets the chain read the owner again. */
export function centralWriters(input: {
  readonly transport: KernelTransportStatus
  readonly day: DayDieWriteAperture | null
  readonly conversation: ConversationWriteAperture | null
  readonly afterWrite?: {readonly day?: () => void; readonly conversation?: () => void; readonly page?: () => void}
  /** The document the hand reached: its face's own Save, and a Flow's location (documentDoor.ts DocumentInPane). */
  readonly page?: {readonly save?: () => void; readonly location?: CentralLocation | null; readonly dirty?: boolean | null} | null
}): CentralWriters {
  const {transport, day, conversation, afterWrite, page} = input
  return {
    'document': {
      save: async value => {
        if (value !== true) throw new Error('Save is a press: it sends the page to its owner.')
        if (!page) throw new Error('No document is reached: open one from the browser, or press in its pane.')
        if (!page.save) throw new Error('The page\'s face has not answered its first read yet, or is waiting for its owner.')
        page.save()
      },
    },
    'flow-document': {
      entry: async value => {
        if (!page?.location) throw new Error('No Flow document is reached: open one from the browser, or press in its pane.')
        if (page.dirty) throw new Error('The page holds edits its owner does not: save or re-read them first, so the entry joins the revision you read.')
        await appendFlowEntry(transport, page.location, {text: String(value ?? ''), relation: null})
        afterWrite?.page?.()
      },
    },
    'day-die': {
      face: async value => {
        if (!day) throw new Error('No Day is selected. Select one in the browser\'s ground, and the die turns on its document.')
        const face = typeof value === 'string' ? dieFaceOfLabel(value) : null
        if (face === null) throw new Error(`"${String(value)}" is no position of the die.`)
        await turnDieFace(transport, day, face)
        afterWrite?.day?.()
      },
    },
    'nara-conversation': {
      bound: async value => {
        if (value !== true) throw new Error('A face cannot unbind a conversation: AIKit holds the session, and the nara_dialogue op declares no release.')
        if (!conversation) throw new Error('No conversation is selected. The binding resolves for the encounter\'s subject once one is.')
        await bindConversation(transport, conversation)
        afterWrite?.conversation?.()
      },
    },
  }
}
