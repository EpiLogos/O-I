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
//     calls it on a timer, and it neither closes an old Day nor initialises the new Day's document.
// A refusal is the owner's own words, thrown as they came; the device keeps the change and says so. Pure of React.
import {central, readGround} from '../../../../../../desktop/cradle/src/central/client'
import {DayFormSession, isObject, unmappedChanges, validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {acquireNativeDialogue, type NativeDialogue} from '../../../../../../desktop/cradle/src/nara/nativeDialogue'
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

/** The Central devices' writers over the apertures they hold: one owner path per writable row, by face and row key. A device
 * whose aperture does not stand has no writer, and its row refuses by name. `afterWrite` lets the chain read the owner again. */
export function centralWriters(input: {
  readonly transport: KernelTransportStatus
  readonly day: DayDieWriteAperture | null
  readonly conversation: ConversationWriteAperture | null
  readonly afterWrite?: {readonly day?: () => void; readonly conversation?: () => void}
}): CentralWriters {
  const {transport, day, conversation, afterWrite} = input
  return {
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
