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
//   - the Day's "Open today" opens the current Day the way the cradle's Today does (desktop/cradle/src/CradleFrame.tsx:734-754
//     `openToday`): Central's ground read again; the `central` op `ensure-day` with the civil-time policy's revision when today's Day
//     is not current; then, when today's Day has no document yet, `initialise-day` from the roster's own Day form
//     (ql-daily-die.html, read through Central's file route, its revision checked) with the placement policy's revision (T-WORLDS W2
//     "New Day calls initialise-day"). It is the person's press: nothing calls it on a timer, and it closes no old Day. When the
//     Day Central named before is closed, the Day made now carries what still plays (daySet.ts carriedSet, written as the set is);
//   - the Day's "Close now" closes the Day Central names on its exact content and relations revisions (the `central` op
//     `close-day`, central.day.lifecycle `closed`; the central-day-close method's root close), the person's press as Open today is;
//   - the Flow takes the person's next entry the way the Flow's own surface writes one: the owner's file read again, the entry
//     appended through the template's own contract (flow/instance.ts appendEntry, relations and the composing basis on the current
//     form), and the Flow's revision-checked file write (flow/instances.ts writeFlowInstance — central.files.write, op
//     file_operation), whose conflict keeps the words and says so (desktop/cradle/src/flow/FlowSurface.tsx:153-165 `save`).
//   - the Day's own settings, a move's press, tomorrow's opening and the close with its carry are Central's actions through the kernel's
//     invoke_action, which carries the person's own presses (action.rs PERSON_ACTS: central.day.settings.write, move.record, rollover,
//     close-carry), each on the revision Central gave (centralWrite; W2);
// A refusal is the owner's own words, thrown as they came; the device keeps the change and says so. Pure of React.
import {central, readGround} from '../../../../../../desktop/cradle/src/central/client'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {DaySettingsPatch} from './dayBinding'
import {actionAnswerOf, centralActionOp} from './centralActions'
import {readFile} from '../../../../../../desktop/cradle/src/files/client'
import {DayFormSession, isObject, unmappedChanges, validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {appendEntry, embedDocument} from '../../../../../../desktop/cradle/src/flow/instance'
import {readFlowInstance, writeFlowInstance} from '../../../../../../desktop/cradle/src/flow/instances'
import {circleHolder, containerOf, isCurrentFormat, type EntryKind, type PluralParticipant, type Relation} from '../../../../../../desktop/cradle/src/flow/plural'
import {clipHostId, viewHoldsOf} from '../../frame/detail/clipBinding'
import type {CentralLocation} from '../../../../../../desktop/cradle/src/kernel/types'
import {acquireNativeDialogue, currentTurnBasis, lookupNativeDialogue, type NativeDialogue, type NativeDialogueRequest} from '../../../../../../desktop/cradle/src/nara/nativeDialogue'
import type {NaraDialogueContext} from '../../../../../../desktop/cradle/src/nara/dialogueContext'
import {announceContext, nativeContext, type ContextMutation, type PreparedContext} from '../../../../../../desktop/cradle/src/context/nativeContext'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {conversationGap} from '../centralVertical'
import {DIE_POSITIONS, dieFaceLabel, dieFaceOf} from './dayDie'
import {canEnsureDay, currentDayOf} from './dayBinding'
import {carriedSet, daySetOf, writeDaySet, type DaySet} from '../daySet'
import {readWorlds} from '../centralWorlds'
import {nowReading, type NowListing} from '../../../../../../desktop/cradle/src/receiving/now'
import {playingOf} from '../../timeline/centralTrackAdapter'
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
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

/** Open today: ensure the current Day through Central when the owner's own reading says that is the act that stands, then make its
 * document from the Day form when it has none. Central's ground is read again first, so each decision is the owner's present one
 * (CradleFrame.tsx:735 reads it before it ensures): a Day someone else already ensured is not ensured twice (`ensured: false`), a
 * document someone else made is not made twice (`initialised: false`). Resolves once the owner has answered; rejects with its
 * words. */
export async function openToday(transport: KernelTransportStatus): Promise<{ensured: boolean; initialised: boolean; carried: CarriedInto | null}> {
  let ground = await readGround(transport, null, true)
  if (ground.time.state !== 'ready' || !ground.time.data) {
    throw new Error(`Central's civil time is ${ground.time.state}${ground.time.error?.message ? `: ${ground.time.error.message}` : ''}; the current Day cannot be ensured`)
  }
  // The Day Central named before this press: when it is an earlier Day, closed, what still plays carries into the Day made now.
  const closed = closedEarlierDayOf(ground)
  let ensured = false
  if (!(ground.day.state === 'ready' && ground.day.data?.temporal.civil_date === ground.time.data.civil_date)) {
    if (!canEnsureDay(ground)) {
      throw new Error(`Central's Day reading is ${ground.day.state}${ground.day.error?.message ? `: ${ground.day.error.message}` : ''}; the owner admits no ensure from here`)
    }
    await central(transport, null, {kind: 'ensure-day', expected_time_policy_revision: ground.time.data.revision})
    ensured = true
    ground = await readGround(transport, null, true)
  }
  const day = ground.day.data
  if (!day || ground.day.state !== 'ready') throw new Error(`Central's Day reading is ${ground.day.state} after the ensure; there is no Day to make a document for`)
  if (day.document_state === 'ready') return {ensured, initialised: false, carried: null}
  // The Day's document from the roster's own Day form — never an invented payload (CradleFrame.tsx:744-752). The roster is read
  // only when a document is to be made (it carries the forms' JSON, which the rest of this module's readers never need).
  const {DOCUMENT_FORMS, resolveDocumentForm} = await import('../../../../../../desktop/cradle/src/flow/documentForms')
  const form = DOCUMENT_FORMS.find(candidate => candidate.kind === 'document-42' && candidate.file === 'ql-daily-die.html')
  if (!form) throw new Error('The Day form is missing from the document roster')
  if (ground.placement.state !== 'ready' || !ground.placement.data) throw new Error('Central\'s native placement authority is unavailable; the Day document cannot be made')
  const world = await kernelOp(transport, {op: 'world_browse'})
  const projects = world.outcome?.result === 'world_read' ? world.outcome.snapshot.navigator?.root?.work.projects : undefined
  const formLocation = await resolveDocumentForm(transport, form, projects)
  const original = await readFile(transport, formLocation, true)
  await central(transport, null, {kind: 'initialise-day', day_ref: day.day_ref, document_id: `document:${crypto.randomUUID()}`, expected_revision: day.revision.revision,
    expected_policy_revision: ground.placement.data.revision, form: formLocation, expected_form_revision: original.revision})
  const carried = closed ? await carryInto(transport, closed) : null
  return {ensured, initialised: true, carried}
}

/** What the close carried into the Day made now: the closed Day it came from, and what tomorrow's grid holds of it. */
export interface CarriedInto {
  readonly from: string
  readonly worlds: number
  readonly rows: number
  readonly pages: number
}

/** The Day Central's ground names when it is an earlier Day than civil today, closed, with its document: its ref and the set it kept.
 * Any other Day carries nothing (an open earlier Day was never closed: close it first). Pure. */
export function closedEarlierDayOf(ground: CentralGroundReading): {readonly dayRef: string; readonly set: DaySet} | null {
  const day = ground.day.data
  const today = ground.time.state === 'ready' ? ground.time.data?.civil_date ?? null : null
  if (!day || !today || day.temporal.civil_date === today || day.temporal.lifecycle !== 'closed') return null
  if (day.document_state !== 'ready' || !day.document) return null
  const basis = validateDocumentBasis(day.document, day.document.source.ref, day.document.document_id)
  return {dayRef: day.day_ref, set: daySetOf(basis.payload)}
}

/** Carry a closed Day's set into the Day Central now names (daySet.ts carriedSet): the pages that still play, read from NOW at your
 * register and at each project world the closed set held; each page's world by the folder that holds it (centralWorlds.ts). Written
 * through the Day's own meta on the revision read, as today's set is written. */
async function carryInto(transport: KernelTransportStatus, closed: {readonly dayRef: string; readonly set: DaySet}): Promise<CarriedInto> {
  const ground = await readGround(transport, null, true)
  const aperture = currentDayOf(ground).aperture
  if (!aperture) throw new Error('Today\'s Day was made, but Central names no document for it yet; nothing was carried into its set')
  const worlds = await readWorlds(transport, undefined, true)
  if (worlds.state !== 'read') throw new Error(`Today's Day was made, but Central's worlds are ${worlds.state}${worlds.state === 'unavailable' ? `: ${worlds.reason}` : ''}; nothing was carried into its set`)
  const projects = worlds.worlds.filter(world => world.project && closed.set.tracks.some(track => track.world === world.ref)).map(world => world.project!)
  const listings = await Promise.all([null, ...projects].map(project => nowReading(transport, project, {kind: 'list'})
    .then(listing => ({project, listing: listing as NowListing}), (cause: unknown) => {
      throw new Error(`Today's Day was made, but NOW at ${project ?? 'your register'} did not answer (${cause instanceof Error ? cause.message : String(cause)}); nothing was carried into its set`)
    })))
  const playing = playingOf(listings).map(item => item.pageRef)
  const worldOfPage = (pageRef: string) => {
    const path = pageRef.replace(/^central:path:[^:]*:/, '')
    const world = worlds.worlds.find(candidate => path.startsWith(`${candidate.folder}/`))
    return world ? {ref: world.ref, name: world.name, yours: world.kind === 'yours'} : null
  }
  const next = carriedSet(closed.set, closed.dayRef, playing, worldOfPage)
  await writeDaySet(transport, aperture, () => next)
  return {from: closed.dayRef, worlds: next.tracks.length, rows: next.rows.length, pages: playing.length}
}

/** Close now (manual §18.2: "Close now: Runs the close routine"): Central closes the Day it names, on its exact content and
 * relations revisions read here (the central-day-close method's root close, central.day.lifecycle `closed`). A Day already closed is
 * refused in words; Central keeps every authored byte, and what still plays carries into the next Day when Open today makes it. */
export async function closeDay(transport: KernelTransportStatus): Promise<{closed: string; civilDate: string}> {
  const ground = await readGround(transport, null, true)
  const day = ground.day.data
  if (!day) throw new Error(`Central's Day reading is ${ground.day.state}${ground.day.error?.message ? `: ${ground.day.error.message}` : ''}; there is no Day to close`)
  if (day.temporal.lifecycle === 'closed') throw new Error(`The Day of ${day.temporal.civil_date} is closed already.`)
  if (!day.relations_revision) throw new Error('Central\'s Day reading carries no relations revision, so the close cannot be checked against it; nothing was closed')
  await central(transport, null, {kind: 'close-day', day_ref: day.day_ref, expected_revision: day.revision.revision, expected_relations_revision: day.relations_revision})
  return {closed: day.day_ref, civilDate: day.temporal.civil_date}
}

/** One Central write through the kernel's invoke_action (the person's own presses carry the host's native token: action.rs PERSON_ACTS,
 * owner_write.rs): Central's data, or its refusal in its own words. Through kernelOp, so the window's held readings retire behind it and
 * are asked again. */
export async function centralWrite(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>>, project?: string): Promise<unknown> {
  const call = await kernelOp(transport, centralActionOp(action, input, project))
  if (call.error) throw new Error(call.error)
  const answer = actionAnswerOf({status: 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: null}, action)
  if (answer.status === 'answered') return answer.value
  throw new Error(answer.status === 'refused' ? answer.error : `${action} did not answer.`)
}

/** Open and Reveal (manual §10.9): a page's file or a world's folder, named by its Central-relative path (a page's `location.path`, a
 * world's `folder`), handed to Central's work.open or work.reveal (ctrl/src/action.rs select_path, EpiLogos/Central#289), which asks the
 * computer to open it with its application or show it in Finder. Neither changes the world; a path outside the root's Control or Work,
 * or one that names nothing, is refused in Central's words. */
export const CENTRAL_OPEN_ACTS = {open: 'work.open', reveal: 'work.reveal'} as const
export function openOrRevealInCentral(transport: KernelTransportStatus, act: keyof typeof CENTRAL_OPEN_ACTS, path: string): Promise<unknown> {
  const named = path.trim()
  if (!named.includes('/')) return Promise.reject(new Error(`${act === 'open' ? 'Open' : 'Reveal'}: "${path}" is no Central-relative path (a page's file or a world's folder names its home, Control/… or Work/…).`))
  return centralWrite(transport, CENTRAL_OPEN_ACTS[act], {query: named})
}

/** Save settings of the Day's own on the revision read (central.day.settings.write: exact revision, `absent` before the first save). */
export const writeDaySettings = (transport: KernelTransportStatus, patch: DaySettingsPatch, expectedRevision: string): Promise<unknown> =>
  centralWrite(transport, 'central.day.settings.write', {expected_revision: expectedRevision, ...patch})

/** A pad's press: the move's begin on the Day named, pressed at `atUnixMs` (central.day.move.record {event begin, trigger press}). Central
 * refuses a move already running, in its words. */
export const beginDayMove = (transport: KernelTransportStatus, move: string, dayRef: string, atUnixMs = Date.now()): Promise<unknown> =>
  centralWrite(transport, 'central.day.move.record', {event: 'begin', move, at_unix_ms: atUnixMs, trigger: 'press', day_ref: dayRef})

/** Open tomorrow's Day beside today's (central.day.rollover) on the civil-time policy's revision, read again first. */
export async function openTomorrow(transport: KernelTransportStatus): Promise<unknown> {
  const ground = await readGround(transport, null, true)
  if (ground.time.state !== 'ready' || !ground.time.data) throw new Error(`Central's civil time is ${ground.time.state}${ground.time.error?.message ? `: ${ground.time.error.message}` : ''}; tomorrow's Day cannot be opened`)
  return centralWrite(transport, 'central.day.rollover', {expected_time_policy_revision: ground.time.data.revision})
}

/** Close now, the close routine: the Day Central names closed through central.day.close-carry on its content and relations revisions,
 * read again first — face 5's proposal carried into tomorrow's face 0 when Close routine is On (Central opens tomorrow's Day if it must). */
export async function closeCarry(transport: KernelTransportStatus): Promise<{closed: string; civilDate: string; carry: unknown}> {
  const ground = await readGround(transport, null, true)
  const day = ground.day.data
  if (!day) throw new Error(`Central's Day reading is ${ground.day.state}${ground.day.error?.message ? `: ${ground.day.error.message}` : ''}; there is no Day to close`)
  if (day.temporal.lifecycle === 'closed') throw new Error(`The Day of ${day.temporal.civil_date} is closed already.`)
  if (!day.relations_revision) throw new Error('Central\'s Day reading carries no relations revision, so the close cannot be checked against it; nothing was closed')
  const answer = await centralWrite(transport, 'central.day.close-carry', {day_ref: day.day_ref, expected_revision: day.revision.revision, expected_relations_revision: day.relations_revision}) as {carry?: unknown} | null
  return {closed: day.day_ref, civilDate: day.temporal.civil_date, carry: answer?.carry ?? null}
}

/** Append the person's entry to a Flow: read the file again (the revision the write is checked against), append the entry as the
 * person through the template's contract — connected to an earlier entry by its relation on the current form — and write it with
 * the owner's revision check. Resolves with the owner's new revision; a conflict is refused in words (the entry is not lost: the
 * hand still holds it). The person is the Flow's person participant who has not left (FlowSurface.tsx writerOf); a Flow with none
 * is refused by the template's own words. */
export async function appendFlowEntry(transport: KernelTransportStatus, location: CentralLocation, entry: {readonly text: string; readonly speaker?: string;
  readonly relation: {readonly type: 'reply' | 'branch' | 'correct'; readonly entryId: string} | null;
  /** In a container, what the entry is (manual §24.5: observe, interpret, choose), as Clip view's Entry sets it; written with the entry. */
  readonly kind?: EntryKind | null}): Promise<{revision: string | null}> {
  const text = entry.text.trim()
  if (!text) throw new Error('The entry has no words.')
  const instance = await readFlowInstance(transport, location)
  const plural = isCurrentFormat(instance.doc)
  const people = ((instance.doc.meta.participants ?? []) as PluralParticipant[]).filter(person => person.kind === 'person' && !person.left)
  // Speak as names a participant by initial or name; unnamed, in a Circle the word is with its holder (flow/plural.ts circleHolder), else
  // with you. The circle's own rule refuses anyone else.
  const holder = plural && containerOf(instance.doc) === 'circle' ? circleHolder(instance.doc) : undefined
  const writer = people.find(person => person.initial === entry.speaker || (!!entry.speaker && person.name === entry.speaker))
    ?? (!entry.speaker && holder && people.some(person => person.key === holder.key) ? holder : undefined) ?? people[0]
  if (entry.relation && !instance.doc.entries.some(candidate => candidate.id === entry.relation!.entryId)) throw new Error('The entry this one connects to is no longer in the Flow.')
  const relations: Relation[] = plural && entry.relation ? [{type: entry.relation.type, entryId: entry.relation.entryId, revision: instance.doc.meta.revision, anchor: null}] : []
  // The kind is the container's: written only while the Flow is held in one (outside one the form refuses it, plural.ts checkContainer).
  const kind = entry.kind && containerOf(instance.doc) ? entry.kind : undefined
  const {html} = appendEntry(instance.html, text, plural ? {participant: writer, relations, basisRevision: instance.doc.meta.revision, ...(kind ? {kind} : {})} : undefined)
  const result = await writeFlowInstance(transport, instance.location, instance.revision, html)
  if (result.outcome === 'conflict') throw new Error(`The Flow moved while the entry was written (the owner holds ${result.current?.revision ?? 'a newer revision'}): nothing was overwritten. Re-read the Flow and write the entry again.`)
  return {revision: result.revision ?? null}
}

/** The controls for the next entry as Clip view holds them for this Flow (manual §18.1 "In a Flow, the controls for the next entry stand
 * at the head of the editor": Speak as; in a container, Entry): the view's own holds of the page's clip (central/clipBinding.ts, ref
 * `subject:note:<path>`), none when Clip view has not held them. */
export function composerOf(location: CentralLocation): {speaker?: string; kind: EntryKind} {
  const held = viewHoldsOf(clipHostId('central', `subject:note:${location.path}`))
  // The Entry control's default is Observe (manual §24.5; the clip design's `entryKind`): a kind is written only in a container.
  const kind = typeof held.entryKind === 'string' && ['observe', 'interpret', 'choose'].includes(held.entryKind) ? held.entryKind as EntryKind : 'observe'
  return {...(typeof held.speakAs === 'string' && held.speakAs ? {speaker: held.speakAs} : {}), kind}
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

/** The voice's open request for the bound conversation (the kernel op nara_voice `open`; the legacy panel's `prepare`,
 * desktop/cradle/src/nara/NaraSurface.tsx:209): the dialogue binding as it stands — looked up, never created, so a voice opens only on
 * a conversation already bound — and the turn's context, read now (the identity and the Expression again, as every turn reads them).
 * The Answer's Hears and Speaks write through it (answerVoice.ts). */
export async function voiceOpening(transport: KernelTransportStatus, conversation: ConversationWriteAperture): Promise<{binding: NativeDialogueRequest; context: NaraDialogueContext}> {
  const identity = currentIdentity()
  if (!identity) throw new Error('No Nara identity is current: the voice waits for its person. Select an identity through the identity owner.')
  if (!conversation.expressionRef) throw new Error(conversation.conversation ? conversationGap(conversation.conversation) : 'No expression is selected: the voice opens on the encounter\'s subject once one is.')
  const dialogue = await lookupNativeDialogue(transport, conversation.project ?? '', identity, conversation.expressionRef, 'nara')
  if (!dialogue) throw new Error('The conversation is not bound: bind it (the light) before the voice can open on it.')
  const basis = await currentTurnBasis(transport, dialogue, identity, conversation.expressionRef)
  return {binding: {...dialogue.binding, operation: 'lookup'}, context: basis.context}
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
        await appendFlowEntry(transport, page.location, {text: String(value ?? ''), relation: null, ...composerOf(page.location)})
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
