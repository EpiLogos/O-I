// The Day's binding (lane BC): the catalogue's Day design (inhabitants/catalogue/panels/day.tsx, id `central:day-die`) drawn on
// Central's own readings and writes (frame/devices/designed.ts DesignBinding). Owners write, faces read (lock §0.4): a key the owner
// reports is a reading; a key no owner reports is absent, never the design's default (manual §16.12); a key is written only where an
// owner op stands behind it (manual §16.13). Pure: no React, no transport.
//
// The readings, each from the owner that holds it:
//   - Central's ground (`central` op `inspect`, desktop/cradle/src/central/client.ts readGround): the civil-time policy — civil today,
//     the day boundary, automatic rollover, its revision — and today's Day reading, which the kernel marks `stale` when the Day
//     pointer belongs to an earlier civil Day (desktop/cradle/kernel/src/central.rs, Request::Inspect);
//   - a Day the person selected (the browser's ground, a Timeline clip): the owner's `open-day` standing (centralVertical.ts
//     interpretDayOpen), as the chain read it before;
//   - the shown Day's document (`receiving` kind:document, useCentralReadings.ts useDayDieReading): its open face (`meta.face`) and
//     its records — the capture ledger, the three task tiers, the sessions ledger (desktop/cradle/documents/ql-daily-die.html:329
//     `D.capture ||= []`, `D.sessions ||= []`; the `fields.p1_must|should|could` lists of its ql-doc island).
// The writes, each through the owner's own op:
//   - `face` turns the die: the die's write route (centralDeviceWrites.ts turnDieFace, receiving mutate-field, CAS-checked);
//   - `openToday` (proposed to the catalogue: day.tsx has no control for it yet) ensures the current Day: the `central` op
//     `ensure-day` with the time policy's revision (centralDeviceWrites.ts openToday) — a press the person makes, never a timer.
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import type {DesignBinding, Value, ValueChange} from '../../frame/devices/designed'
import {DAY_INITIALISE_OP, DAY_OWNER, DAY_INITIALISE_REMEDY, type DayDocumentStanding} from '../centralVertical'

/** The value keys the Day design reads that an owner reports or takes (day.tsx `defaults`), and the two this binding adds for the
 * catalogue to draw (`refusal`, `canOpenToday`) and the one it takes (`openToday`). */
export const DAY_KEYS = ['light', 'date', 'face', 'dayStart', 'rollover', 'c0', 'c1', 'c2done', 'refusal', 'canOpenToday'] as const

/** Keys the owner takes a change of. Every other key of the design is a reading or has no owner (manual §16.13). */
export const DAY_WRITES: ReadonlySet<string> = new Set(['face', 'openToday'])

/** Why each design key this binding leaves absent has no reading (manual §16.12: "When a reading is missing, say which one"). The
 * return names these; the views draw "—" where the kit draws them. */
export const DAY_ABSENT: Readonly<Record<string, string>> = {
  view: 'Die or flat is a way of looking: no owner keeps it.',
  tomorrow: 'Central reports one current Day; tomorrow\'s Day stands only after a rollover opens it, and no reading reports one (the design draws its page only when it is reported).',
  tomorrowOpen: 'Central reports one current Day; no reading says whether tomorrow\'s Day is open.',
  closeRoutine: 'The close routine is the owner\'s automation; no reading of it reaches the shell (the scheduled rollover is off, 13 Oct, pending the owner\'s validation).',
  agentWrites: 'No owner holds how agent entries arrive on a Day.',
  template: 'The Day keeps the template it opened with (meta.template), but the design\'s choices are not the owner\'s templates.',
  src_central: 'No owner holds which modes send entries to faces 2 and 4.',
  src_factory: 'No owner holds which modes send entries to faces 2 and 4.',
  src_expressions: 'No owner holds which modes send entries to faces 2 and 4.',
  src_techne: 'No owner holds which modes send entries to faces 2 and 4.',
  src_live: 'No owner holds which modes send entries to faces 2 and 4.',
  c1p: 'The Day document holds included contributions only; proposals that wait are no record of it.',
  c2run: 'The sessions ledger records a session with no done, running or queued state.',
  c2queue: 'The sessions ledger records a session with no done, running or queued state.',
  c3: 'Patterns are free text on face 3 (p3_patterns_noticed): the owner counts none.',
  c3p: 'The Day document holds included contributions only; proposals that wait are no record of it.',
  c4: 'Context is free text on face 4: the owner counts none.',
  c5: 'Synthesis is free text on face 5: the owner counts none.',
}

export interface DayAperture {
  readonly project: string | null
  readonly sourceRef: string
  readonly documentId: string
}

/** Today's Day as the ground reads it: its standing in the `open-day` words, and its document's aperture when one stands. Ported from
 * shell/transports/transportReadings.ts:97-113 (`dayDieOf`), which reads the same ground for the transport's die; this keeps the
 * standing and the aperture apart so a Day with no document still says why. */
export function currentDayOf(ground: CentralGroundReading): {standing: DayDocumentStanding | null; aperture: DayAperture | null; pointer: string | null} {
  const day = ground.day
  const pointer = day.data?.temporal.civil_date ?? null
  const civilDate = ground.time.state === 'ready' ? ground.time.data?.civil_date ?? pointer : pointer
  const dayRef = day.data?.day_ref ?? `today`
  if (day.state !== 'ready' || !day.data) {
    const words = day.error?.message ?? `Central's Day reading is ${day.state}.`
    return {standing: {state: 'refused', dayRef, civilDate: civilDate ?? 'today', message: words}, aperture: null, pointer}
  }
  const reading = day.data
  if (reading.document_state !== 'ready' || !reading.document) {
    return {standing: {state: 'uninitialised', dayRef, civilDate: reading.temporal.civil_date, owner: DAY_OWNER, op: DAY_INITIALISE_OP, remedy: DAY_INITIALISE_REMEDY,
      message: `Central's Day reading holds no Day document for ${reading.temporal.civil_date} (document_state ${reading.document_state ?? 'not given'}).`}, aperture: null, pointer}
  }
  try {
    const documentId = String((reading.document as {document_id?: unknown}).document_id)
    const basis = validateDocumentBasis(reading.document, reading.source.ref, documentId)
    return {standing: {state: 'ready', dayRef, civilDate: reading.temporal.civil_date, sourceRef: reading.source.ref, documentId, revision: basis.revision},
      aperture: {project: null, sourceRef: reading.source.ref, documentId}, pointer}
  } catch (cause) {
    return {standing: {state: 'refused', dayRef, civilDate: reading.temporal.civil_date, message: cause instanceof Error ? cause.message : String(cause)}, aperture: null, pointer}
  }
}

/** Whether the owner's ensure is the act that stands: the civil-time policy answered and today's Day reading is stale, or its source is
 * unavailable. Ported from desktop/cradle/src/central/CentralGround.tsx:49 (`canEnsure`), the ground panel's own rule for its
 * "Ensure current Day through Central" press. */
export function canEnsureDay(ground: CentralGroundReading | null): boolean {
  if (!ground || ground.time.state !== 'ready' || !ground.time.data) return false
  return ground.day.state === 'stale' || ground.day.error?.code === 'source_or_scope_unavailable'
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const civilParts = (civilDate: string | null | undefined): [number, number, number] | null => {
  const match = civilDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** A civil date as the design writes it (`Fri 16 Oct`): the date's own calendar, never a clock. Null for anything else. */
export function civilDayName(civilDate: string | null | undefined): string | null {
  const parts = civilParts(civilDate)
  if (!parts) return null
  const [year, month, day] = parts
  const at = new Date(Date.UTC(year, month - 1, day))
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null
  return `${WEEKDAYS[at.getUTCDay()]} ${day} ${MONTHS[month - 1]}`
}

/** The civil date after `civilDate` (`2026-10-16` → `2026-10-17`), by the calendar alone. */
export function nextCivilDate(civilDate: string | null | undefined): string | null {
  const parts = civilParts(civilDate)
  if (!parts) return null
  const at = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1))
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}-${String(at.getUTCDate()).padStart(2, '0')}`
}

const listLength = (value: unknown): number | null => (Array.isArray(value) ? value.length : null)
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** The counts the Day's own records give its faces (the ql-doc island of ql-daily-die.html): face 0 the capture ledger's rows, face 1
 * the tasks in its three tiers, face 2 the sessions ledger's rows. A record the payload does not carry as a list gives no count. */
export function dayCountsOf(payload: unknown): {c0?: number; c1?: number; c2done?: number} {
  if (!isObject(payload)) return {}
  const fields = isObject(payload.fields) ? payload.fields : {}
  const out: {c0?: number; c1?: number; c2done?: number} = {}
  const capture = listLength(payload.capture)
  if (capture !== null) out.c0 = capture
  const tiers = [fields.p1_must, fields.p1_should, fields.p1_could].map(listLength)
  if (tiers.every(tier => tier !== null)) out.c1 = tiers.reduce<number>((sum, tier) => sum + tier!, 0)
  const sessions = listLength(payload.sessions)
  if (sessions !== null) out.c2done = sessions
  return out
}

export interface DayFacts {
  /** The civil date of the Day the device shows: the one the person selected, else Central's civil today. */
  readonly civilDate: string | null
  /** The owner's standing for that Day (ready, no document yet, refused), null while it answers. */
  readonly standing: DayDocumentStanding | null
  /** Why no Day document stands for the Day shown, in the owner's words; null when one stands or nothing has answered. */
  readonly refusal: string | null
  readonly canOpenToday: boolean
  /** The Day document the die turns, when one stands. */
  readonly aperture: DayAperture | null
  /** The civil-time policy: minutes after civil midnight the day turns at, and whether rollover is automatic. */
  readonly boundary: number | null
  readonly automaticRollover: boolean | null
}

export interface DayFactsInput {
  readonly ground: CentralGroundReading | null
  /** The ground read's refusal, in the owner's (or the carrier's) words. */
  readonly groundError: string | null
  /** A Day the person selected, with the owner's `open-day` standing for it (null while it answers), or null for today. */
  readonly selected: {readonly standing: DayDocumentStanding | null; readonly aperture: DayAperture | null} | null
}

/** The facts the Day stands on, from its owners' readings. */
export function dayFactsOf({ground, groundError, selected}: DayFactsInput): DayFacts {
  const time = ground?.time.state === 'ready' ? ground.time.data ?? null : null
  const boundary = time && Number.isInteger(time.policy.day_boundary_minutes) ? time.policy.day_boundary_minutes : null
  const automaticRollover = time ? time.policy.automatic_day_rollover === true : null
  const canOpenToday = canEnsureDay(ground)
  if (selected) {
    const standing = selected.standing
    return {civilDate: standing?.civilDate ?? null, standing, refusal: refusalOf(standing, null, null), canOpenToday,
      aperture: standing?.state === 'ready' ? selected.aperture : null, boundary, automaticRollover}
  }
  if (!ground) return {civilDate: null, standing: null, refusal: groundError ? `Central's ground did not answer: ${groundError}` : null, canOpenToday: false, aperture: null, boundary, automaticRollover}
  const current = currentDayOf(ground)
  const civilDate = time?.civil_date ?? current.pointer
  return {civilDate, standing: current.standing, refusal: refusalOf(current.standing, current.pointer, time?.civil_date ?? null), canOpenToday,
    aperture: current.aperture, boundary, automaticRollover}
}

function refusalOf(standing: DayDocumentStanding | null, pointer: string | null, today: string | null): string | null {
  if (!standing || standing.state === 'ready') return null
  // The stale pointer: the owner's words, and the two dates it compares (central.rs Request::Inspect).
  if (pointer && today && pointer !== today) return `${standing.message} (Central's Day: ${civilDayName(pointer) ?? pointer}; civil today: ${civilDayName(today) ?? today})`
  return standing.message
}

/** The design's values from the facts and the shown Day's document. Only what an owner reports; nothing from the design's defaults. */
export function dayValuesOf(facts: DayFacts, document: {readonly face: number; readonly payload: unknown} | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  const date = civilDayName(facts.civilDate)
  if (date) values.date = date
  if (facts.standing) values.light = facts.standing.state === 'ready' ? 'lit' : 'dark'
  // The policy's day boundary is when tomorrow becomes today (DLW §18.2 Day start); with automatic rollover the owner opens the next
  // Day at that boundary, and without it no Day opens by itself: Off (the design's step below midnight, day.tsx TIME).
  if (facts.boundary !== null) {
    values.dayStart = facts.boundary
    if (facts.automaticRollover !== null) values.rollover = facts.automaticRollover ? facts.boundary : -15
  }
  if (facts.refusal) values.refusal = facts.refusal
  values.canOpenToday = facts.canOpenToday
  // The face and the counts belong to the Day document: none stands, none is drawn.
  if (facts.aperture && document) {
    values.face = document.face
    Object.assign(values, dayCountsOf(document.payload))
  }
  return values
}

export interface DayWriters {
  /** Turn the die of the Day document the aperture names. */
  readonly turn: (aperture: DayAperture, face: number) => Promise<void>
  /** Ensure the current Day through Central (the person's press). */
  readonly openToday: () => Promise<void>
}

/** The binding the runtime hosts the Day design on: the readings, and the two writes an owner takes. A change of any other key is
 * refused as a reading by the runtime (deviceHost.tsx flushDrafts); a write the owner cannot take now is refused in words. */
export function dayDesignBinding(id: string, facts: DayFacts, values: Readonly<Record<string, Value>>, writers: DayWriters): DesignBinding {
  return {
    id,
    values,
    writes: key => DAY_WRITES.has(key),
    write: async (changes: readonly ValueChange[]) => {
      for (const change of changes) {
        if (change.key === 'face') {
          const face = typeof change.value === 'number' ? change.value : Number(change.value)
          if (!Number.isInteger(face) || face < 0 || face > 5) throw new Error(`The die has six faces (0 to 5); ${String(change.value)} is none of them.`)
          if (!facts.aperture) throw new Error(facts.refusal ?? 'No Day document stands, so the die has nothing to turn.')
          await writers.turn(facts.aperture, face)
        } else if (change.key === 'openToday') {
          if (change.value !== true) throw new Error('Open today is a press: it ensures the current Day, and nothing here closes one.')
          await writers.openToday()
        } else {
          throw new Error(`${change.key}: a reading — the owner reports it, and nothing here changes it.`)
        }
      }
    },
  }
}
