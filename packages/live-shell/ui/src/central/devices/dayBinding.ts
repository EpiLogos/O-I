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
//     `ensure-day` with the time policy's revision (centralDeviceWrites.ts openToday) — a press the person makes, never a timer;
//   - `closeNow` (proposed to the catalogue: day.tsx draws Close now disabled) closes the Day Central names: the `central` op
//     `close-day` on its content and relations revisions (centralDeviceWrites.ts closeDay), the person's press as Open today is.
// The Day's own settings and moves (manual §18.2; T-COVERAGE §1.3), Central's two readings carried by the kernel's invoke_action:
//   - `central.day.settings.read` (central.day-settings-reading/v1): Rollover, Agent writes, Sources, Close routine, and each move's
//     effective Prompt and Runs at — the defaults where the person saved nothing, each the owner's own reading;
//   - `central.day.moves.read` {day_ref} (central.day-moves-reading/v1), for the Day shown when its document stands: each move's open
//     run (`running`) and its last ended run (`last`: when it ended, what it gave).
// The writes (W2: the kernel carries the person's own presses through invoke_action, action.rs PERSON_ACTS):
//   - every setting of the Day's own — Rollover, Agent writes, Sources, Close routine, each move's Prompt and Runs at — through
//     `central.day.settings.write` on the settings revision read (`absent` before the first save), only the setting changed (daySettingsPatch);
//   - a pad's press records the move's begin through `central.day.move.record` {event begin, trigger press} on the Day shown;
//   - Close now (the Close pad) is the close routine through `central.day.close-carry` on the Day's two revisions: it carries face 5's
//     proposal into tomorrow's face 0 when Close routine is On, and closes the Day either way;
//   - `openTomorrow` opens tomorrow's Day beside today's through `central.day.rollover` (proposed to the catalogue: day.tsx has no control).
// Each is checked by Central against the revision read; a refusal comes back in Central's words, and the readings are asked again behind
// every write (the kernel's write notice retires the held answers).
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {validateDocumentBasis} from '../../../../../../desktop/cradle/src/central/dayForm'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import {DAY_INITIALISE_OP, DAY_OWNER, DAY_INITIALISE_REMEDY, type DayDocumentStanding} from '../centralVertical'

/** The value keys the Day design reads that an owner reports or takes (day.tsx `defaults`), and the three this binding adds for the
 * catalogue to draw (`refusal`, `canOpenToday`, `canClose`) and the two it takes (`openToday`, `closeNow`). */
export const DAY_KEYS = ['light', 'date', 'face', 'dayStart', 'rollover', 'c0', 'c1', 'c2done', 'refusal', 'canOpenToday', 'canClose', 'tomorrow', 'tomorrowOpen'] as const

/** Keys the owner takes a change of (the settings', the pads' and the presses'). Every other key of the design is a reading or has no
 * owner (manual §16.13). */
export const DAY_WRITES: ReadonlySet<string> = new Set(['face', 'openToday', 'closeNow', 'openTomorrow', 'rollover', 'agentWrites', 'closeRoutine',
  'src_central', 'src_factory', 'src_expressions', 'src_techne', 'src_live',
  ...['tasks', 'patterns', 'context', 'synthesis', 'close'].flatMap(move => [`at_${move}`, `prompt_${move}`]),
  ...['tasks', 'patterns', 'context', 'synthesis'].map(move => `run_${move}`)])

/** The Day's moves (manual §18.2 Moves): the pads of the design, each with its press, its Runs at and its Prompt, and its run record.
 * Close is the close routine, whose press is Close now (`closeNow`), the one move an owner already takes. */
export const DAY_MOVES = ['tasks', 'patterns', 'context', 'synthesis', 'close'] as const

// What faces 2 and 4 still wait on: the machines' own NOWs are Workcell's (EpiLogos/Workcell #72, portable NOW work), their delivery to
// the Day AIKit's (EpiLogos/ai-kit #275); Central's Day/NOW contract is Central #150 and #153.
const NO_NOWS = 'every machine\'s NOW and its child NOWs, which no owner reports to the Day yet (Central #150, #153; the machines\' NOWs are Workcell #72\'s, their delivery ai-kit #275)'

/** Central's Day readings the device reads through the kernel's invoke_action (owner_write.rs carries them as readings: they retire
 * nothing). */
export const DAY_SETTINGS_ACTION = 'central.day.settings.read'
export const DAY_MOVES_ACTION = 'central.day.moves.read'
const MOVE_NAMES: Readonly<Record<string, string>> = {tasks: 'Tasks', patterns: 'Patterns', context: 'Context', synthesis: 'Synthesis', close: 'Close'}
/** Why a setting cannot be written now: Central's write is checked against the revision its reading gave. */
const SETTINGS_UNREAD = (what: string, own: DayOwnReadings | null) => `${what}: Central's Day settings ${own?.settingsRefusal ? `refused — ${own.settingsRefusal}` : 'have not answered yet'}, and central.day.settings.write is checked against the revision they give.`
/** Why a pad cannot record its press now: a move begins on a Day that stands (central.day.move.record names it). */
const NO_DAY_FOR_MOVES = (move: string) => `${MOVE_NAMES[move]}: no Day document stands for the Day shown, so no move begins on it (central.day.move.record records a move on a Day that stands).`
const SOURCE_KEYS = ['src_central', 'src_factory', 'src_expressions', 'src_techne', 'src_live'] as const
/** The keys the Day's settings reading fills, and those its moves reading fills. */
export const DAY_SETTINGS_KEYS: readonly string[] = ['rollover', 'agentWrites', 'closeRoutine', ...SOURCE_KEYS, ...DAY_MOVES.flatMap(move => [`at_${move}`, `prompt_${move}`])]
export const DAY_RUN_KEYS: readonly string[] = DAY_MOVES.flatMap(move => [`last_${move}`, `running_${move}`, ...(move === 'close' ? [] : [`gave_${move}`])])
const NO_CLOSEOUT = 'Close-out is AIKit\'s reading of what the close left behind (`aikit work continuity closeout verify`): no kernel route reaches it yet (T-COVERAGE §1.2).'

/** Why each design key no owner reports has no reading (manual §16.12: "When a reading is missing, say which one"). The settings' and
 * the runs' keys have their reasons from their readings (dayOwnAbsent). The views draw "—" where the kit draws them. */
export const DAY_ABSENT: Readonly<Record<string, string>> = {
  view: 'Die or flat is a way of looking: no owner keeps it.',
  tomorrow: 'Central names no tomorrow\'s Day yet: it opens beside today\'s by Open tomorrow (central.day.rollover), at the Rollover you saved, or with the close\'s carry.',
  tomorrowOpen: 'Central names no tomorrow\'s Day yet, so none is open.',
  template: 'The Day keeps the template it opened with (meta.template), but the design\'s choices are not the owner\'s templates.',
  c1p: 'The Day document holds included contributions only; proposals that wait are no record of it.',
  c2run: `Face 2 lists the sessions of ${NO_NOWS}; the sessions ledger records a session with no done, running or queued state.`,
  c2queue: `Face 2 lists the sessions of ${NO_NOWS}; the sessions ledger records a session with no done, running or queued state.`,
  c3: 'Patterns are free text on face 3 (p3_patterns_noticed): the owner counts none.',
  c3p: 'The Day document holds included contributions only; proposals that wait are no record of it.',
  c4: `Face 4 gathers what the sessions of ${NO_NOWS} touched, each entry with its author; until then context is free text on face 4, and the owner counts none.`,
  c5: 'Synthesis is free text on face 5: the owner counts none.',
  closeout: NO_CLOSEOUT,
}

/** The design's controls no write reaches from here, closed with their reason: Verify (AIKit's close-out read has no kernel route). */
export const DAY_STANDING: Readonly<Record<string, Standing>> = {
  verifyCloseout: {disabled: NO_CLOSEOUT},
}

/** What each setting key is called, for its refusal. */
const SETTING_NAME = (key: string): string => key === 'rollover' ? 'Rollover' : key === 'agentWrites' ? 'Agent writes' : key === 'closeRoutine' ? 'Close routine'
  : key.startsWith('src_') ? 'Sources' : key.startsWith('at_') ? `${MOVE_NAMES[key.slice(3)]}'s Runs at` : key.startsWith('prompt_') ? `${MOVE_NAMES[key.slice(7)]}'s Prompt` : key

/** The Day's standing now: Verify closed; every setting closed while Central's settings have not answered (a write is checked against
 * their revision); every pad closed while no Day document stands for the Day shown. */
export function dayStanding(facts: DayFacts, own: DayOwnReadings | null): Record<string, Standing> {
  const standing: Record<string, Standing> = {...DAY_STANDING}
  if (!settingsRevisionOf(own)) for (const key of DAY_SETTINGS_KEYS) standing[key] = {disabled: SETTINGS_UNREAD(SETTING_NAME(key), own)}
  if (facts.standing?.state !== 'ready') for (const move of DAY_MOVES) if (move !== 'close') standing[`run_${move}`] = {disabled: NO_DAY_FOR_MOVES(move)}
  return standing
}

/** The revision of Central's Day settings as read (`absent` before the first save), or null while they have not answered. */
export function settingsRevisionOf(own: DayOwnReadings | null): string | null {
  const reading = own && isRecord(own.settings) && own.settings.schema === 'central.day-settings-reading/v1' ? own.settings : null
  return reading && typeof reading.revision === 'string' && reading.revision ? reading.revision : null
}

/** A patch of Central's Day settings, as central.day.settings.write takes it: only the settings given are saved. */
export interface DaySettingsPatch {
  readonly rollover?: string | null
  readonly agent_writes?: 'off' | 'propose' | 'write'
  readonly close_routine?: boolean
  readonly sources?: Readonly<Record<string, boolean>>
  readonly moves?: Readonly<Record<string, {readonly prompt?: string | null; readonly runs_at?: Readonly<Record<string, string>>}>>
}

const clockOf = (minutes: number): string => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(Math.round(minutes) % 60).padStart(2, '0')}`

/** A design key's new value as the one setting central.day.settings.write saves, in Central's words: Rollover a time or null (Off, the
 * step below midnight), Agent writes one of its three, Close routine on or off, a Source on or off, a move's Runs at (Off, Day start,
 * Rollover, or a daily time: day.tsx RUNS_AT) and its Prompt (empty is the move's own, null). Refused in words for any other value. Pure. */
export function daySettingsPatch(key: string, value: Value): DaySettingsPatch | {readonly refused: string} {
  if (key === 'rollover') return typeof value === 'number' && Number.isFinite(value) ? {rollover: value < 0 ? null : clockOf(value)} : {refused: `Rollover is a time, or Off; ${String(value)} is neither.`}
  if (key === 'agentWrites') return value === 'off' || value === 'propose' || value === 'write' ? {agent_writes: value} : {refused: `Agent writes is Off, Propose or Write; ${String(value)} is none of them.`}
  if (key === 'closeRoutine') return typeof value === 'boolean' ? {close_routine: value} : {refused: 'Close routine is On or Off.'}
  if ((SOURCE_KEYS as readonly string[]).includes(key)) return typeof value === 'boolean' ? {sources: {[key.slice(4)]: value}} : {refused: 'A Source is On or Off.'}
  const at = key.match(/^at_(tasks|patterns|context|synthesis|close)$/)
  if (at) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return {refused: `Runs at is Off, Day start, Rollover or a time; ${String(value)} is none of them.`}
    const runsAt: Readonly<Record<string, string>> = value <= -45 ? {kind: 'off'} : value <= -30 ? {kind: 'day_start'} : value < 0 ? {kind: 'rollover'} : {kind: 'daily', time: clockOf(value)}
    return {moves: {[at[1]!]: {runs_at: runsAt}}}
  }
  const prompt = key.match(/^prompt_(tasks|patterns|context|synthesis|close)$/)
  if (prompt) return typeof value === 'string' ? {moves: {[prompt[1]!]: {prompt: value.trim() ? value : null}}} : {refused: 'A Prompt is text.'}
  return {refused: `${key} is no setting of the Day's.`}
}

// ---------------------------------------------------------------------------------------------------------------- the Day's own

/** Central's two Day readings as the window holds them: each answer's data (null while it has not answered or refused) and its
 * refusal in the owner's words; the policy's timezone, which a run's instant is read in. */
export interface DayOwnReadings {
  readonly settings: unknown
  readonly settingsRefusal: string | null
  /** The moves of the Day shown; null when that Day has no document (central.day.moves.read reads one Day). */
  readonly moves: unknown
  readonly movesRefusal: string | null
  readonly timezone: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const hhmm = (value: unknown): number | undefined => {
  const match = typeof value === 'string' ? value.match(/^(\d{2}):(\d{2})$/) : null
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined
}

/** A move's Runs at in the design's steps (day.tsx RUNS_AT: Off −45, Day start −30, Rollover −15, else minutes after midnight), from
 * Central's `runs_at` ({kind: off | day_start | rollover | daily, time}). Another kind is not read. */
export function runsAtOf(runsAt: unknown): number | undefined {
  if (!isRecord(runsAt)) return undefined
  if (runsAt.kind === 'off') return -45
  if (runsAt.kind === 'day_start') return -30
  if (runsAt.kind === 'rollover') return -15
  return runsAt.kind === 'daily' ? hhmm(runsAt.time) : undefined
}

/** Minutes after midnight of an instant on the policy's own clock (its timezone). Undefined for an unknown zone or instant. */
export function localMinutes(atUnixMs: unknown, timezone: string | null): number | undefined {
  if (typeof atUnixMs !== 'number' || !Number.isFinite(atUnixMs) || !timezone) return undefined
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(new Date(atUnixMs))
    const hour = Number(parts.find(part => part.type === 'hour')?.value), minute = Number(parts.find(part => part.type === 'minute')?.value)
    return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : undefined
  } catch { return undefined }
}

/** What a run gave, as a count the pad draws: the refs it proposed and wrote (Central's `gave` {summary, proposals?, writes?}). */
function gaveOf(run: unknown): number | undefined {
  const gave = isRecord(run) && isRecord(run.end) ? run.end.gave : undefined
  if (!isRecord(gave)) return undefined
  return (Array.isArray(gave.proposals) ? gave.proposals.length : 0) + (Array.isArray(gave.writes) ? gave.writes.length : 0)
}

/** The design's values from Central's Day settings and the shown Day's moves. Only what the owner reports. */
export function dayOwnValuesOf(own: DayOwnReadings): Record<string, Value> {
  const values: Record<string, Value> = {}
  const reading = isRecord(own.settings) && own.settings.schema === 'central.day-settings-reading/v1' ? own.settings : null
  const settings = reading && isRecord(reading.settings) ? reading.settings : null
  if (reading && settings) {
    // Rollover: a time, or Off when the person saved none (Central's own default) — the design's step below midnight.
    if (settings.rollover === null) values.rollover = -15
    else { const at = hhmm(settings.rollover); if (at !== undefined) values.rollover = at }
    if (settings.agent_writes === 'off' || settings.agent_writes === 'propose' || settings.agent_writes === 'write') values.agentWrites = settings.agent_writes
    if (typeof settings.close_routine === 'boolean') values.closeRoutine = settings.close_routine
    const sources = isRecord(settings.sources) ? settings.sources : {}
    for (const key of SOURCE_KEYS) { const on = sources[key.slice(4)]; if (typeof on === 'boolean') values[key] = on }
    const moves = isRecord(settings.moves) ? settings.moves : {}
    const prompts = isRecord(reading.effective_prompts) ? reading.effective_prompts : {}
    for (const move of DAY_MOVES) {
      const at = runsAtOf(isRecord(moves[move]) ? (moves[move] as Record<string, unknown>).runs_at : undefined)
      if (at !== undefined) values[`at_${move}`] = at
      if (typeof prompts[move] === 'string') values[`prompt_${move}`] = prompts[move] as string
    }
  }
  const day = isRecord(own.moves) && own.moves.schema === 'central.day-moves-reading/v1' && isRecord(own.moves.moves) ? own.moves.moves : null
  if (day) {
    for (const move of DAY_MOVES) {
      const row = isRecord(day[move]) ? day[move] as Record<string, unknown> : null
      if (!row) continue
      values[`running_${move}`] = isRecord(row.running)
      // No run of the move has ended in this Day: "not yet" (day.tsx -1), the owner's own answer.
      if (row.last === null) values[`last_${move}`] = -1
      else if (isRecord(row.last)) {
        const at = localMinutes(row.last.ended_at_unix_ms, own.timezone)
        if (at !== undefined) values[`last_${move}`] = at
        const gave = move === 'close' ? undefined : gaveOf(row.last)
        if (gave !== undefined) values[`gave_${move}`] = gave
      }
    }
  }
  return values
}

/** Why each of the Day's own keys stands absent, in the owner's words where it refused (manual §16.12). */
export function dayOwnAbsent(own: DayOwnReadings, values: Readonly<Record<string, Value>> = dayOwnValuesOf(own)): Record<string, string> {
  const why: Record<string, string> = {}
  const settings = own.settingsRefusal ? `Central refused its Day settings: ${own.settingsRefusal}` : 'Central\'s Day settings have not answered yet (central.day.settings.read).'
  const runs = own.movesRefusal ? `Central refused the Day's moves: ${own.movesRefusal}`
    : own.moves === null ? 'The Day shown has no document, so its moves are not read (central.day.moves.read reads one Day).' : 'The Day\'s moves have not answered yet (central.day.moves.read).'
  for (const key of DAY_SETTINGS_KEYS) if (values[key] === undefined) why[key] = settings
  for (const key of DAY_RUN_KEYS) if (values[key] === undefined) {
    const last = key.startsWith('gave_') ? values[`last_${key.slice(5)}`] : undefined
    why[key] = last === -1 ? 'No run of this move has ended in this Day, so it has given nothing yet.'
      : last !== undefined ? 'Its last run ended without saying what it gave (a run refused or stalled says why, not what it gave).' : runs
  }
  return why
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

/** Whether Close now stands: Central names a Day, open, whose reading gives the relations revision a close is checked against. Today's
 * or an earlier one (a Day is often closed after its boundary); only the Day Central names, never one the person selected. */
export function canCloseDay(ground: CentralGroundReading | null): boolean {
  const day = ground?.day.data
  return !!day && (ground!.day.state === 'ready' || ground!.day.state === 'stale') && day.temporal.lifecycle !== 'closed' && !!day.relations_revision
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
  /** Whether Close now stands for the Day shown (canCloseDay; never for a Day the person selected). */
  readonly canClose: boolean
  /** The Day document the die turns, when one stands. */
  readonly aperture: DayAperture | null
  /** The civil-time policy: minutes after civil midnight the day turns at, and whether rollover is automatic. */
  readonly boundary: number | null
  readonly automaticRollover: boolean | null
  /** Tomorrow's Day as Central names it beside today's (central.day-reading/v1 `tomorrow`, set by central.day.rollover): its civil date. */
  readonly tomorrow?: string | null
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
    return {civilDate: standing?.civilDate ?? null, standing, refusal: refusalOf(standing, null, null), canOpenToday, canClose: false,
      aperture: standing?.state === 'ready' ? selected.aperture : null, boundary, automaticRollover}
  }
  if (!ground) return {civilDate: null, standing: null, refusal: groundError ? `Central's ground did not answer: ${groundError}` : null, canOpenToday: false, canClose: false, aperture: null, boundary, automaticRollover}
  const current = currentDayOf(ground)
  const civilDate = time?.civil_date ?? current.pointer
  // Tomorrow's Day, where Central names one after the Day shown (a stale name, on or before today, is no tomorrow).
  const named = (ground.day.data as {tomorrow?: {civil_date?: unknown} | null} | null | undefined)?.tomorrow?.civil_date
  const tomorrow = typeof named === 'string' && civilDate && named > civilDate ? named : null
  return {civilDate, standing: current.standing, refusal: refusalOf(current.standing, current.pointer, time?.civil_date ?? null), canOpenToday,
    canClose: canCloseDay(ground), aperture: current.aperture, boundary, automaticRollover, tomorrow}
}

function refusalOf(standing: DayDocumentStanding | null, pointer: string | null, today: string | null): string | null {
  if (!standing || standing.state === 'ready') return null
  // The stale pointer: the owner's words, and the two dates it compares (central.rs Request::Inspect).
  if (pointer && today && pointer !== today) return `${standing.message} (Central's Day: ${civilDayName(pointer) ?? pointer}; civil today: ${civilDayName(today) ?? today})`
  return standing.message
}

/** The design's values from the facts, the shown Day's document and the Day's own settings and moves. Only what an owner reports;
 * nothing from the design's defaults. */
export function dayValuesOf(facts: DayFacts, document: {readonly face: number; readonly payload: unknown} | null, own: DayOwnReadings | null = null): Record<string, Value> {
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
  // Tomorrow's Day stands beside today's once Central opened it (central.day.rollover, or the close's carry).
  const tomorrow = civilDayName(facts.tomorrow ?? null)
  if (tomorrow) { values.tomorrow = tomorrow; values.tomorrowOpen = true }
  values.canOpenToday = facts.canOpenToday
  values.canClose = facts.canClose
  // The face and the counts belong to the Day document: none stands, none is drawn.
  if (facts.aperture && document) {
    values.face = document.face
    Object.assign(values, dayCountsOf(document.payload))
  }
  // The Day's own settings and runs (Central's Day settings own Rollover: when they answer, theirs stands over the policy's).
  if (own) Object.assign(values, dayOwnValuesOf(own))
  return values
}

export interface DayWriters {
  /** Turn the die of the Day document the aperture names. */
  readonly turn: (aperture: DayAperture, face: number) => Promise<void>
  /** Ensure the current Day through Central (the person's press). */
  readonly openToday: () => Promise<void>
  /** Close the Day Central names (the person's press): the close routine, central.day.close-carry. */
  readonly closeNow: () => Promise<void>
  /** Save one setting of the Day's own on the revision read (central.day.settings.write). */
  readonly settings?: (patch: DaySettingsPatch, expectedRevision: string) => Promise<void>
  /** Record a move's begin on the Day shown, pressed now (central.day.move.record). */
  readonly begin?: (move: string, dayRef: string) => Promise<void>
  /** Open tomorrow's Day beside today's (central.day.rollover). */
  readonly openTomorrow?: () => Promise<void>
}

/** The binding the runtime hosts the Day design on: the readings, and the writes its owners take. A change of any other key is refused
 * as a reading by the runtime (deviceHost.tsx flushDrafts); a write the owner cannot take now is refused in words. */
export function dayDesignBinding(id: string, facts: DayFacts, values: Readonly<Record<string, Value>>, writers: DayWriters, own: DayOwnReadings | null = null): DesignBinding {
  const standing = dayStanding(facts, own)
  return {
    id,
    values,
    standing,
    // A control closed for now still goes to `write`, so its refusal says why.
    writes: key => DAY_WRITES.has(key) || !!standing[key]?.disabled,
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
        } else if (change.key === 'closeNow') {
          if (change.value !== true) throw new Error('Close now is a press: it closes the Day Central names, and nothing here reopens one.')
          if (!facts.canClose) throw new Error('No open Day stands for Close now: the Day shown is closed already, is one you selected, or Central gave no revision to close it on.')
          await writers.closeNow()
        } else if (standing[change.key]?.disabled) {
          throw new Error(standing[change.key]!.disabled!)
        } else if (change.key === 'openTomorrow') {
          if (change.value !== true) throw new Error('Open tomorrow is a press: it opens tomorrow\'s Day beside today\'s.')
          if (!writers.openTomorrow) throw new Error('Open tomorrow: no writer is handed to the Day here (central.day.rollover).')
          await writers.openTomorrow()
        } else if (change.key.startsWith('run_')) {
          if (change.value !== true) throw new Error('A pad is a press: it begins its move now.')
          if (!writers.begin || facts.standing?.state !== 'ready') throw new Error(NO_DAY_FOR_MOVES(change.key.slice(4)))
          await writers.begin(change.key.slice(4), facts.standing.dayRef)
        } else if (DAY_SETTINGS_KEYS.includes(change.key)) {
          const revision = settingsRevisionOf(own)
          if (!revision || !writers.settings) throw new Error(SETTINGS_UNREAD(SETTING_NAME(change.key), own))
          const patch = daySettingsPatch(change.key, change.value)
          if ('refused' in patch) throw new Error(patch.refused)
          await writers.settings(patch, revision)
        } else {
          throw new Error(`${change.key}: a reading — the owner reports it, and nothing here changes it.`)
        }
      }
    },
  }
}
