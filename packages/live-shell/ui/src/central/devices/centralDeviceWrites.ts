// The owner paths the Central devices write through (DEVICE-SEMANTICS-LOCK §0.4 owners write, faces read; §5.3 a device-
// instrument declares the owner op that generates; manual §10.4 "all three show the same live settings"). Each path is the
// one the device's hosted body already uses, ported — none is invented here:
//   - the Day die turns its open face the way the die's own Save writes a field: the owner's document reading, the
//     retained draft held by the imported `DayFormSession` (central/dayForm), and one `receiving` `mutate-field` per mapped
//     field, CAS-checked against the revision the reading gave (inhabitants/DocumentDayDieFace.tsx `saveToNative`; the
//     owner's own docstring calls this "the die face's write route", receiving/client.ts `mutateField`: Central's Action
//     `central.document.mutate`, through the kernel's `act`, O-I 1002);
//   - the conversation binds the way the encounter surface binds it before a turn: the kernel's `nara_dialogue` op in its
//     `resolve` operation (`acquireNativeDialogue`, nara/nativeDialogue.ts; nara/NaraSurface.tsx `ensureDialogue`). The
//     hosted face only looks the binding up (`lookupNativeDialogue`) and names this operation in its unbound notice;
//   - the Day opens itself on its civil date and closes itself at its turn, by Central's civil clock (`central.day.turn`, run as the
//     kernel's Day reading is made, O-I 1005): nothing here opens or closes a Day. Close now is the close routine (closeCarry below);
//   - the Flow takes the person's next entry the way the Flow's own surface writes one: the owner's file read again, the entry
//     appended through the template's own contract (flow/instance.ts appendEntry, relations and the composing basis on the current
//     form), and the Flow's revision-checked file write (flow/instances.ts writeFlowInstance — Central's Action central.files.write
//     through the kernel's `act`), whose conflict keeps the words and says so (desktop/cradle/src/flow/FlowSurface.tsx:153-165 `save`).
//   - the Day's own settings, a move's press, tomorrow's opening and the close with its carry are Central's actions through the kernel's
//     invoke_action, which carries the person's own presses (action.rs PERSON_ACTS: central.day.settings.write, move.record, rollover,
//     close-carry), each on the revision Central gave (centralWrite; W2);
//   - a law statement written on the root world's tier 0 is adopted on the revision Central gives for it now (adoptLaw: central.files.read,
//     then control.law.adopt as the person's press), and Central renders the root's floor again (manual §18.5, O-I ticket 1005);
// A refusal is the owner's own words, thrown as they came; the device keeps the change and says so. Pure of React.
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {kernelOp, kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {modelSlice, sliceValue, type ModelSliceReading} from '../../owners/model'
import {readWorlds, type CentralWorldsReading} from '../centralWorlds'
import {DAY_ENTRY_PART_ACTION, DAY_FIELD_RECORD_ACTION, dayFromModel, type DayFieldRecord, type DaySettingsPatch} from './dayBinding'
import {actionAnswerOf, centralActionOp} from './centralActions'
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
import {centralsOpenToday, NO_CIVIL_TIME, wantsCivilTime} from './dayBinding'
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

/** The Day's writes as Central's Actions (O-I ticket 1005): the ids these writes send, and the Day's declaration names
 * (agentChainDevices.ts CENTRAL_CHAIN_DECLARATIONS `day`). The die's turn goes as `central.document.mutate` through the receiving client
 * (desktop/cradle/src/receiving/client.ts receivingAction, `mutate-field`), its open face set on the page's revision read. */
export const DAY_ACTIONS = Object.freeze({
  face: 'central.document.mutate',
  closeNow: 'central.day.close-carry',
  settings: 'central.day.settings.write',
  begin: 'central.day.move.record',
  openTomorrow: 'central.day.rollover',
} as const)

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

/** The root world's tier 0: the law statements the person's agents work under (manual §18.5), as Central keeps them. */
export const LAW_DIR = 'Control/agents/governance'
/** The floor Central renders at the root from the adopted law; the instruction files the agents read are made links to it. */
export const LAW_FLOOR = 'AGENTS.md'

/** The instruction files the agents on this machine read at the root (the World Model's agents slice, census.rs: each agent's floor,
 * `carries.law.file`), each once; none while the slice is not held. Pure. */
export function lawFilesOf(reading: ModelSliceReading): string[] {
  const held = sliceValue<{agents?: readonly {carries?: {law?: {file?: unknown}}}[]}>(reading)
  if (!held.ok) return []
  return [...new Set((held.value.agents ?? []).flatMap(agent => (typeof agent.carries?.law?.file === 'string' ? [agent.carries.law.file] : [])))]
}

/** Adopt one law statement written on the root world's tier 0 (manual §18.5: "Adopting it writes it into the instructions every harness
 * reads"): the statement read through Central at its revision now (central.files.list, then central.files.read — the revision the
 * adoption is checked against), the agents on this machine read afresh from the World Model (`agents`, the read that precedes a write),
 * then Central's control.law.adopt as the person's press (action.rs PERSON_ACTS; Central admits it on the person's native credential
 * only): the statement stands durable and human-authored, and Central renders the root's floor again, each instruction file the agents
 * read (other than the floor itself) made a link to it. Central's receipt, or its refusal in its words. */
export async function adoptLaw(transport: KernelTransportStatus, statement: string,
  agents: () => Promise<ModelSliceReading> = () => modelSlice(transport, 'agents', {fresh: true})): Promise<unknown> {
  const path = statement.startsWith(`${LAW_DIR}/`) ? statement : `${LAW_DIR}/${statement}`
  const folder = path.slice(0, path.lastIndexOf('/'))
  const listed = actionAnswerOf(await readCall(transport, 'central.files.list', {path: folder}), 'central.files.list')
  if (listed.status !== 'answered') throw new Error(listed.status === 'refused' ? listed.error : 'Central did not list the statement\'s folder.')
  const entries = (listed.value as {entries?: {kind?: string; location?: CentralLocation}[]} | null)?.entries ?? []
  const location = entries.find(entry => entry.kind === 'file' && entry.location?.path === path)?.location
  if (!location) throw new Error(`${path} is not written on tier 0, so there is nothing to adopt: write the statement first.`)
  const read = actionAnswerOf(await readCall(transport, 'central.files.read', {location}), 'central.files.read')
  if (read.status !== 'answered') throw new Error(read.status === 'refused' ? read.error : `Central did not read ${path}.`)
  const revision = (read.value as {revision?: unknown} | null)?.revision
  if (typeof revision !== 'string' || !revision) throw new Error(`Central read ${path} without its revision, so its adoption cannot be checked against it; nothing was adopted.`)
  const links = lawFilesOf(await agents()).filter(file => file !== LAW_FLOOR)
  return centralWrite(transport, 'control.law.adopt', {statement: path, expected_revision: revision, files: links})
}

/** One of Central's readings asked of Central itself (the read that precedes a write): its data, or its refusal in its own words, thrown. */
export async function centralRead(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>>): Promise<unknown> {
  const answer = actionAnswerOf(await readCall(transport, action, input), action)
  if (answer.status === 'answered') return answer.value
  throw new Error(answer.status === 'refused' ? answer.error : `${action} did not answer.`)
}

/** One of Central's readings through invoke_action, asked of Central itself (the read that precedes a write). */
async function readCall(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>>): Promise<Parameters<typeof actionAnswerOf>[0]> {
  const call = await kernelRead(transport, centralActionOp(action, input), {fresh: true})
  if (call.error) return {status: 'refused', value: null, error: call.error}
  return {status: 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: null}
}

/** Save settings of the Day's own on the revision read (central.day.settings.write: exact revision, `absent` before the first save). */
export const writeDaySettings = (transport: KernelTransportStatus, patch: DaySettingsPatch, expectedRevision: string): Promise<unknown> =>
  centralWrite(transport, DAY_ACTIONS.settings, {expected_revision: expectedRevision, ...patch})

/** Central's answer for one record of a batch (central.day-field-records/v1 `results`): made, kept already (`created: false`), or refused
 * in its words. */
export interface FieldRecordAnswer {
  readonly item_ref: string
  readonly created: boolean
  readonly refused?: string
}

/** Central's bound on one call (ctrl day_moves.rs FIELD_BATCH_MAX). */
export const FIELD_BATCH_MAX = 64

/** What waits for the Day, recorded under its field source in one call (central.day.field.record `records`, Central#324; DLW build ruling
 * 2026-11-08): each who sent it, how it came, what it is, its words and when, the Day named once. Central runs it under one lock and one
 * rewrite and answers each record on its own, so one refused refuses none of the others; a refusal of the call itself is thrown in its
 * words. */
export async function recordFieldItems(transport: KernelTransportStatus, dayRef: string, records: readonly DayFieldRecord[]): Promise<FieldRecordAnswer[]> {
  const answer = await centralWrite(transport, DAY_FIELD_RECORD_ACTION, {day_ref: dayRef, records: records.map(({day_ref: _, ...record}) => record)})
  const results = answer && typeof answer === 'object' ? (answer as {results?: unknown}).results : undefined
  if (!Array.isArray(results)) throw new Error(`${DAY_FIELD_RECORD_ACTION} answered no record of what it was given.`)
  return results.filter((result): result is FieldRecordAnswer => !!result && typeof result === 'object' && typeof (result as FieldRecordAnswer).item_ref === 'string')
}

/** How long a record Central refused, or one a failed call carried, waits before a later reading offers it again: the readings are asked
 * again behind every write (the kernel's write notice), so without it a refused record would be asked again behind its own refusal. */
export const FIELD_RETRY_MS = 30_000
/** How long one call may stay out before what it carried is released as failed (DLW build ruling 2026-11-08), so a call that never
 * settles never stalls the queue for the window. */
export const FIELD_SEND_BOUND_MS = 30_000
/** Waits `ms` on the window's clock, never holding a process open for it; `stop` clears the timer (the wait is then never over). */
const afterOnTheClock = (ms: number, stop?: AbortSignal): Promise<void> => new Promise(resolve => {
  const timer = setTimeout(resolve, ms)
  ;(timer as {unref?: () => void}).unref?.()
  stop?.addEventListener('abort', () => clearTimeout(timer), {once: true})
})

/** Records what waits for the Day, one loop at a time (DLW build ruling 2026-11-08): `offer` gives it what the Day reads now waits
 * (dayBinding.ts dayFieldRecords), for the Day that reading answered for (null until it has); what arrives while a call is out joins the
 * queue, and the same loop sends it next, at most FIELD_BATCH_MAX to a call and one Day to a call. What Central keeps is not offered again.
 * A record Central refuses, and every record a failed call carried, is released: a later reading, once FIELD_RETRY_MS has passed, offers
 * it again, so none is stuck. A call still out after FIELD_SEND_BOUND_MS has failed: what it carried is released and the loop goes on;
 * if it settles later, what Central kept of it is kept, never offered again (DLW build ruling 2026-11-09). A call that settles clears
 * its bound's timer. Refusals are per Day: `say` is told Central's words for a Day's latest refusal, and null once a later record of that Day is accepted
 * or that Day's reading has nothing waiting; another Day's reading leaves it. `now` is the clock and `after` waits on it until its signal
 * stops it (both injected for tests). Pure of React. */
export class FieldRecorder {
  private readonly waiting = new Map<string, DayFieldRecord>()
  private readonly asked = new Set<string>()
  private readonly kept = new Set<string>()
  private readonly held = new Map<string, number>()
  private running = false
  private readonly words = new Map<string, string>()
  constructor(private readonly send: (dayRef: string, records: readonly DayFieldRecord[]) => Promise<readonly FieldRecordAnswer[]>,
    private readonly say: (dayRef: string, words: string | null) => void, private readonly now: () => number = Date.now,
    private readonly after: (ms: number, stop: AbortSignal) => Promise<void> = afterOnTheClock) {}

  offer(dayRef: string | null, records: readonly DayFieldRecord[]): void {
    const at = this.now()
    for (const record of records) {
      const key = FieldRecorder.key(record)
      if (this.kept.has(key) || this.asked.has(key) || this.waiting.has(key) || (this.held.get(key) ?? -Infinity) > at) continue
      this.held.delete(key)
      this.waiting.set(key, record)
    }
    if (dayRef !== null && !records.length && !this.busy(dayRef)) this.tell(dayRef, null)
    if (!this.running && this.waiting.size) void this.run()
  }

  private static key(record: DayFieldRecord): string { return `${record.day_ref}\n${record.item_ref}` }

  /** Whether anything of that Day waits or is out. */
  private busy(dayRef: string): boolean {
    return [...this.waiting.values()].some(record => record.day_ref === dayRef) || [...this.asked].some(key => key.startsWith(`${dayRef}\n`))
  }

  private tell(dayRef: string, words: string | null): void {
    if (words === (this.words.get(dayRef) ?? null)) return
    if (words === null) this.words.delete(dayRef)
    else this.words.set(dayRef, words)
    this.say(dayRef, words)
  }

  private async run(): Promise<void> {
    this.running = true
    try {
      while (this.waiting.size) {
        const dayRef = this.waiting.values().next().value!.day_ref
        const batch = [...this.waiting.entries()].filter(([, record]) => record.day_ref === dayRef).slice(0, FIELD_BATCH_MAX)
        for (const [key] of batch) { this.waiting.delete(key); this.asked.add(key) }
        let answers: readonly FieldRecordAnswer[] | null
        const bound = new AbortController()
        let sending: Promise<readonly FieldRecordAnswer[]>
        try { sending = this.send(dayRef, batch.map(([, record]) => record)) } catch (error) { sending = Promise.reject(error) }
        try {
          answers = await Promise.race([sending, this.after(FIELD_SEND_BOUND_MS, bound.signal).then(() => null)])
        } catch (error) {
          this.release(batch.map(([key]) => key))
          this.tell(dayRef, error instanceof Error ? error.message : String(error))
          continue
        } finally { bound.abort() }
        if (answers === null) {
          this.release(batch.map(([key]) => key))
          this.tell(dayRef, `Central did not answer ${DAY_FIELD_RECORD_ACTION} within ${FIELD_SEND_BOUND_MS / 1000} s, so what it carried is offered again later.`)
          // Settled late, what Central kept is kept all the same.
          sending.then(late => this.keepLate(batch, late), () => {})
          continue
        }
        const answered = new Map(answers.map(answer => [answer.item_ref, answer]))
        let refusal: string | null = null, accepted = false
        for (const [key, record] of batch) {
          const answer = answered.get(record.item_ref)
          if (answer && !answer.refused) { this.asked.delete(key); this.kept.add(key); accepted = true; continue }
          this.release([key])
          refusal ??= answer?.refused ?? `${DAY_FIELD_RECORD_ACTION} gave no answer for ${record.item_ref}.`
        }
        if (refusal) this.tell(dayRef, refusal)
        else if (accepted) this.tell(dayRef, null)
      }
    } finally { this.running = false }
  }

  /** What a call released at its bound kept when it settled: kept, never offered again. */
  private keepLate(batch: readonly (readonly [string, DayFieldRecord])[], answers: readonly FieldRecordAnswer[]): void {
    const kept = new Set(answers.filter(answer => !answer.refused).map(answer => answer.item_ref))
    for (const [key, record] of batch) {
      if (!kept.has(record.item_ref)) continue
      this.held.delete(key)
      this.waiting.delete(key)
      this.kept.add(key)
    }
  }

  private release(keys: readonly string[]): void {
    const until = this.now() + FIELD_RETRY_MS
    for (const key of keys) { this.asked.delete(key); this.held.set(key, until) }
  }
}

/** One entry of the Day as the shared field would receive it if you showed it (central.day.entry.part): an opaque part ref, its kind and
 * its label, and nothing else of the Day — whatever more Central's answer carries stays here. Asked only on the person's Show (SF06), on
 * the revision the entry was offered from: Central refuses a Day that moved since, one closed, or one that is not today. The first part
 * read in a world has Central write its salt, once, outside every Day. */
export async function dayEntryPart(transport: KernelTransportStatus, dayRef: string, expectedRevision: string, select: Readonly<Record<string, string | number>>): Promise<{id: string; kind: string; label: string}> {
  const answer = await centralWrite(transport, DAY_ENTRY_PART_ACTION, {day_ref: dayRef, expected_revision: expectedRevision, ...select})
  const read = answer && typeof answer === 'object' ? answer as {schema?: unknown; part?: {id?: unknown; kind?: unknown; label?: unknown}} : null
  const part = read?.schema === 'central.day-entry-part/v1' ? read.part : null
  if (!part || typeof part.id !== 'string' || typeof part.kind !== 'string' || typeof part.label !== 'string') throw new Error(`${DAY_ENTRY_PART_ACTION} answered no part to show.`)
  return {id: part.id, kind: part.kind, label: part.label}
}

/** Whether Central's label of an entry is the label it was offered under (be2m.7; DLW build ruling 2026-11-12). The two are compared with
 * every joiner (U+200C, U+200D) left out: the offer keeps a joiner in its place, and Central's label leaves every joiner out until it
 * keeps one too, so either order of the two changes is safe. Where both are cut ("…"), the joiners counted on one side and not
 * the other move the cut, so the two cut heads need only begin alike. Pure. */
const JOINERS = /[\u200c\u200d]/g
export function sameEntryLabel(central: string, offered: string): boolean {
  const theirs = central.replace(JOINERS, ''), ours = offered.replace(JOINERS, '')
  if (theirs === ours) return true
  if (!theirs.endsWith('…') || !ours.endsWith('…')) return false
  const a = theirs.slice(0, -1), b = ours.slice(0, -1)
  return a.startsWith(b) || b.startsWith(a)
}

/** Central's root ground read again, as the World Model's day slice holds it (world_model.rs `day`, read fresh): the one reading every
 * Day write checks its basis against (O-I ticket 1005). A ground the slice does not hold is refused in its words, and nothing is written. */
export async function groundReadAgain(transport: KernelTransportStatus): Promise<CentralGroundReading> {
  const model = dayFromModel(await modelSlice(transport, 'day', {fresh: true}))
  if (!model.ground) throw new Error(model.groundError ?? 'Central\'s ground is not read yet; nothing was written.')
  return model.ground
}

/** The press of Show on an entry of today's Day (SF06; DLW build ruling 2026-11-09): Central's ground read again, so the Day must still be
 * the open one Central names as today; the part read on the revision it was offered from; and Central's label compared with the label
 * offered, joiners aside (sameEntryLabel). Central's label is the one passed on. Any of these refused is said in words, and nothing
 * reaches the field. */
export async function bringDayEntry(transport: KernelTransportStatus, offered: {readonly dayRef: string; readonly revision: string},
  offer: {readonly kind: string; readonly label: string; readonly select: Readonly<Record<string, string | number>> | null; readonly why?: string}): Promise<{id: string; kind: string; label: string}> {
  if (offer.why || !offer.select) throw new Error(offer.why ?? 'That entry of the Day is not offered to show.')
  const ground = await groundReadAgain(transport)
  const day = ground.day.data
  if (centralsOpenToday(ground)?.day_ref !== offered.dayRef) {
    const today = ground.time.state === 'ready' ? ground.time.data?.civil_date : null
    throw new Error(day?.day_ref === offered.dayRef && day.temporal.lifecycle === 'closed'
      ? `The Day of ${day.temporal.civil_date} is closed now, so none of its entries is shown; nothing reached the field.`
      : `This entry was offered from a Day that is not Central's today${today ? ` (${today})` : ''} now: look again; nothing reached the field.`)
  }
  const part = await dayEntryPart(transport, offered.dayRef, offered.revision, offer.select)
  if (part.kind !== offer.kind || !sameEntryLabel(part.label, offer.label)) {
    throw new Error(`Central reads this entry as “${part.label}” now, not “${offer.label}” as it was offered: look again; nothing reached the field.`)
  }
  return part
}

/** A pad's press: the move's begin on the Day named, pressed at `atUnixMs` (central.day.move.record {event begin, trigger press}). Central
 * refuses a move already running, in its words. */
export const beginDayMove = (transport: KernelTransportStatus, move: string, dayRef: string, atUnixMs = Date.now()): Promise<unknown> =>
  centralWrite(transport, DAY_ACTIONS.begin, {event: 'begin', move, at_unix_ms: atUnixMs, trigger: 'press', day_ref: dayRef})

/** Open tomorrow's Day beside today's (central.day.rollover) on the civil-time policy's revision, read again first. */
export async function openTomorrow(transport: KernelTransportStatus): Promise<unknown> {
  const ground = await groundReadAgain(transport)
  if (wantsCivilTime(ground)) throw new Error(`${NO_CIVIL_TIME}, then open tomorrow's Day.`)
  if (ground.time.state !== 'ready' || !ground.time.data) throw new Error(`Central's civil time is ${ground.time.state}${ground.time.error?.message ? `: ${ground.time.error.message}` : ''}; tomorrow's Day cannot be opened`)
  return centralWrite(transport, DAY_ACTIONS.openTomorrow, {expected_time_policy_revision: ground.time.data.revision})
}

/** Close now, the close routine: the Day Central names closed through central.day.close-carry on its content and relations revisions,
 * read again first — face 5's proposal carried into tomorrow's face 0 when Close routine is On (Central opens tomorrow's Day if it must). */
export async function closeCarry(transport: KernelTransportStatus): Promise<{closed: string; civilDate: string; carry: unknown}> {
  const ground = await groundReadAgain(transport)
  const day = ground.day.data
  if (!day) throw new Error(`Central's Day reading is ${ground.day.state}${ground.day.error?.message ? `: ${ground.day.error.message}` : ''}; there is no Day to close`)
  if (day.temporal.lifecycle === 'closed') throw new Error(`The Day of ${day.temporal.civil_date} is closed already.`)
  if (!day.relations_revision) throw new Error('Central\'s Day reading carries no relations revision, so the close cannot be checked against it; nothing was closed')
  const answer = await centralWrite(transport, DAY_ACTIONS.closeNow, {day_ref: day.day_ref, expected_revision: day.revision.revision, expected_relations_revision: day.relations_revision}) as {carry?: unknown} | null
  return {closed: day.day_ref, civilDate: day.temporal.civil_date, carry: answer?.carry ?? null}
}

/** Append the person's entry to a Flow: read the file again (the revision the write is checked against), append the entry as the
 * person through the template's contract — connected to an earlier entry by its relation on the current form — and write it with
 * the owner's revision check. Resolves with the owner's new revision; a conflict is refused in words (the entry is not lost: the
 * hand still holds it). The person is the Flow's person participant who has not left (FlowSurface.tsx writerOf); a Flow with none
 * is refused by the template's own words. `html`, when given, is the entry as the page draws it (the template's own `html` option,
 * flow/instance.ts appendEntry; the page's form cleans it as it draws it, ql-flow.html `clean`) — a passage the search line sends
 * carries its link back so (central/searchLine.tsx, O-I #820); without it the words become paragraphs, as before. */
export async function appendFlowEntry(transport: KernelTransportStatus, location: CentralLocation, entry: {readonly text: string; readonly html?: string; readonly speaker?: string;
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
  const given = entry.html?.trim() ? {html: entry.html} : {}
  const {html} = appendEntry(instance.html, text, plural ? {participant: writer, relations, basisRevision: instance.doc.meta.revision, ...(kind ? {kind} : {}), ...given}
    : entry.html?.trim() ? given : undefined)
  const result = await writeFlowInstance(transport, instance.location, instance.revision, html)
  if (result.outcome === 'conflict') throw new Error(`The Flow moved while the entry was written (the owner holds ${result.current?.revision ?? 'a newer revision'}): nothing was overwritten. Re-read the Flow and write the entry again.`)
  return {revision: result.revision ?? null}
}

/** What Play's answer is kept as in the page (world-shell.md §9.3 Overdub): a new entry, or one that replaces the agent's last entry on the page —
 * written as its correction, so the Flow keeps both (flow/plural.ts relation `correct`). */
export type AnswerTake = 'new' | 'replace'

/** Keep an agent's answer in a Flow as its own entry (Play with Arm on, world-shell.md §9.3; the Flow's own keep, FlowSurface.tsx
 * `appendAgentResponse`): the file read again, the answer appended as the agent's entry — the agent a participant of the page by its session
 * (the letter it has there, else the first free one), the answer's sources named under it (what the packet carried) — and written with the
 * owner's revision check, read again once if the page moved. `take` `replace` writes it as the correction of the agent's last entry. Resolves
 * with the owner's new revision; refuses in words, the answer kept in them, when the page moved twice. */
export async function keepAgentAnswer(transport: KernelTransportStatus, location: CentralLocation, answer: AgentAnswer): Promise<{revision: string | null; entryId: string | null}> {
  const text = answer.text.trim()
  if (!text) throw new Error(`${answer.agent} answered without words; nothing was kept in the page.`)
  let instance = await readFlowInstance(transport, location)
  for (let attempt = 0; attempt < 2; attempt++) {
    const written = agentEntry(instance, text, answer)
    const result = await writeFlowInstance(transport, instance.location, instance.revision, written.html)
    if (result.outcome !== 'conflict') return {revision: result.revision ?? null, entryId: written.entryId}
    instance = await readFlowInstance(transport, location)
  }
  throw new Error(`${answer.agent} answered, but the page moved twice while the answer was kept; nothing was overwritten. The answer, unlost:\n\n${text}`)
}

/** An agent's answer to Play, as the page keeps or is proposed it: its words, the agent and its session, the packet's items it answered
 * from, and Overdub's take. */
export interface AgentAnswer {readonly text: string; readonly agent: string; readonly session: string; readonly sources: readonly string[]; readonly take: AnswerTake}

/** The page's bytes with the answer appended as the agent's entry (keepAgentAnswer, proposeAgentAnswer): the agent a participant of the page
 * by its session (the letter it has there, else the first free one), the answer's sources named under it, and with `take` `replace` the
 * correction of the agent's last entry. Pure over the page read. */
function agentEntry(instance: Awaited<ReturnType<typeof readFlowInstance>>, text: string, answer: AgentAnswer): {html: string; entryId: string | null} {
  const escape = (words: string) => words.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = [...text.split(/\n{2,}/).map(part => `<p>${escape(part.trim()).replace(/\n/g, '<br>')}</p>`),
    ...(answer.sources.length ? [`<p><em>Sources:</em> ${answer.sources.map(escape).join(' · ')}</p>`] : [])].join('')
  const plural = isCurrentFormat(instance.doc)
  const participants = (instance.doc.meta.participants ?? []) as PluralParticipant[]
  const known = participants.find(person => person.kind === 'agent' && person.ref === answer.session)
  const taken = new Set(participants.map(person => person.initial))
  const initial = known?.initial ?? ([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(letter => !taken.has(letter)) ?? 'Z')
  const participant = known ?? {initial, name: answer.agent, kind: 'agent' as const, ref: answer.session}
  // The agent's last entry here: by its participant's key on the plural form, by its letter on an earlier one.
  const last = answer.take === 'replace' && known ? [...instance.doc.entries].reverse()
    .find(entry => (known.key && (entry as {authorKey?: string}).authorKey === known.key) || entry.author === known.initial) : undefined
  if (answer.take === 'replace' && !last) throw new Error(`Replace: ${answer.agent} has no entry on this page to replace; switch Overdub to a new entry.`)
  const relations: Relation[] = plural && last ? [{type: 'correct', entryId: last.id, revision: instance.doc.meta.revision, anchor: null}] : []
  const written = appendEntry(instance.html, text, {participant, html, ...(plural ? {basisRevision: instance.doc.meta.revision, ...(relations.length ? {relations} : {})} : {})})
  return {html: written.html, entryId: written.entry?.id ?? null}
}

/** Propose an agent's answer for a page (Play with Arm off, world-shell.md §9.3 "Arm (direct or proposal)"): the page with the answer as the
 * agent's entry, filed as Central's source Return on the revision read (projectcentral.source.return: the agent's session its provenance,
 * the packet's items its evidence), which Approvals lists among Central's source returns and accepts or refuses (return_accept, as the
 * person's press, or return_reject). Nothing is written in the page. The page's project is the world whose folder holds it (the World Model's
 * worlds, read afresh); Central keeps Returns for a project's sources only, so a page of your own world is refused in words, the answer kept
 * in them. Resolves with Central's return ref and the project it waits in. */
export async function proposeAgentAnswer(transport: KernelTransportStatus, location: CentralLocation, answer: AgentAnswer,
  worlds: () => Promise<CentralWorldsReading> = () => readWorlds(transport, {fresh: true})): Promise<{returnRef: string | null; project: string}> {
  const text = answer.text.trim()
  if (!text) throw new Error(`${answer.agent} answered without words; nothing was proposed for the page.`)
  const unlost = `The answer, unlost:\n\n${text}`
  const read = await worlds()
  if (read.state !== 'read') throw new Error(`${answer.agent} answered, but Central's worlds were not read (${read.state === 'unavailable' ? read.reason : 'still reading'}), so the page's project is not known; nothing was proposed. ${unlost}`)
  const relative = (folder: string) => (folder.startsWith(`${location.root}/`) ? folder.slice(location.root.length + 1) : folder)
  const world = read.worlds.find(candidate => candidate.kind === 'project' && candidate.project && location.path.startsWith(`${relative(candidate.folder)}/`))
  if (!world?.project) throw new Error(`Arm is off, so ${answer.agent}'s answer is a proposal, but ${location.path} is a page of your own world: Central keeps proposals (source Returns, which Approvals lists) for a project's pages only. Nothing was written. ${unlost}`)
  const project = world.project
  const horizon = await centralRead(transport, 'projectcentral.change.horizon', {project}).catch((cause: unknown) => {
    throw new Error(`${cause instanceof Error ? cause.message : String(cause)}; nothing was proposed. ${unlost}`)
  })
  const sources = (horizon as {sources?: {binding?: {ref?: unknown; path?: unknown; roles?: unknown}; revision?: {revision?: unknown}}[]} | null)?.sources ?? []
  // The page as the project's source: its path within the project, the longest that ends the page's path.
  const source = sources.filter(row => typeof row.binding?.path === 'string' && location.path.endsWith(`/${row.binding.path}`))
    .sort((a, b) => String(b.binding!.path).length - String(a.binding!.path).length)[0]
  const sourceRef = typeof source?.binding?.ref === 'string' ? source.binding.ref : null
  const revision = typeof source?.revision?.revision === 'string' ? source.revision.revision : null
  if (!sourceRef || !revision) throw new Error(`${location.path} is not among ${project}'s sources in Central's change horizon, so no Return can be filed on it; nothing was proposed. ${unlost}`)
  const instance = await readFlowInstance(transport, location)
  if (instance.revision !== revision) throw new Error(`The page moved while the proposal was made (Central's horizon holds ${revision}, the page read ${instance.revision}); nothing was proposed. Play again. ${unlost}`)
  const proposed = agentEntry(instance, text, answer)
  // A page of the project's human ground changes only on the person's authenticated acceptance: Central's commissioned-maintenance
  // Return (v2), which captures the page's binding and is accepted on the person's credential (sourceReturnAccept.ts acceptSourceReturn).
  const humanGround = Array.isArray(source?.binding?.roles) && source.binding.roles.includes('project-human-source-aperture')
  const filed = await centralWrite(transport, 'projectcentral.source.return', {project, source_ref: sourceRef, expected_revision: revision, proposed_content: proposed.html,
    ...(humanGround ? {acceptance: 'commissioned-maintenance'} : {}),
    reason: `${answer.agent}'s answer to Play, proposed for ${location.path.split('/').pop()} as ${answer.take === 'replace' ? 'the correction of its last entry' : 'a new entry'}`,
    agent_session_ref: answer.session, evidence_refs: [...answer.sources]}) as {outcome?: unknown; return_ref?: unknown; proposal?: {return_ref?: unknown}} | null
  if (filed?.outcome === 'conflict') throw new Error(`The page moved before Central filed the proposal; nothing was proposed. Play again. ${unlost}`)
  const returnRef = typeof filed?.return_ref === 'string' ? filed.return_ref : typeof filed?.proposal?.return_ref === 'string' ? filed.proposal.return_ref : null
  return {returnRef, project}
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
  readonly afterWrite?: {readonly day?: () => void; readonly page?: () => void}
  /** The document the hand reached: its face's own Save (documentDoor.ts DocumentInPane). */
  readonly page?: {readonly save?: () => void; readonly location?: CentralLocation | null; readonly dirty?: boolean | null} | null
}): CentralWriters {
  const {transport, day, afterWrite, page} = input
  return {
    'document': {
      save: async value => {
        if (value !== true) throw new Error('Save is a press: it sends the page to its owner.')
        if (!page) throw new Error('No document is reached: open one from the browser, or press in its pane.')
        if (!page.save) throw new Error('The page\'s face has not answered its first read yet, or is waiting for its owner.')
        page.save()
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
  }
}
