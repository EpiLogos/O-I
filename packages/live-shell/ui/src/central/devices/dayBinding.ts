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
//     run (`running`) and its last ended run (`last`: when it ended, what it gave);
//   - `central.day.field.read` {day_ref} (central.day-field-reading/v1, EpiLogos/Central#324), for the Day shown when its document
//     stands: the Day's field source (On or Off) and what reached you from the field that the Day keeps, on its face 4.
// The writes (W2: the kernel carries the person's own presses through invoke_action, action.rs PERSON_ACTS):
//   - every setting of the Day's own — Rollover, Agent writes, Sources, Close routine, each move's Prompt and Runs at — through
//     `central.day.settings.write` on the settings revision read (`absent` before the first save), only the setting changed (daySettingsPatch);
//   - a pad's press records the move's begin through `central.day.move.record` {event begin, trigger press} on the Day shown;
//   - Close now (the Close pad) is the close routine through `central.day.close-carry` on the Day's two revisions: it carries face 5's
//     proposal into tomorrow's face 0 when Close routine is On, and closes the Day either way;
//   - `openTomorrow` opens tomorrow's Day beside today's through `central.day.rollover` (proposed to the catalogue: day.tsx has no control).
//   - what reached you from the field is recorded into today's open Day through `central.day.field.record` (Central#324), once each and
//     only while the Day's field source is On, all that waits in one call (dayFieldRecords; centralDeviceWrites.ts FieldRecorder): the
//     source is the person's own standing setting, as each mode's is, and Central records each as received through the shared field.
//   - Refine (`refinePattern`) on the Patterns move opens a refinement of the one skill or method its pattern points at (Central's
//     `gave.points_at`) on the Skillset rack's Refining page, through the chain's hand: it writes nothing to any owner.
// Each is checked by Central against the revision read; a refusal comes back in Central's words, and the readings are asked again behind
// every write (the kernel's write notice retires the held answers).
import type {CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import type {DayDocumentField} from '../../../../../../desktop/cradle/src/central/dayForm'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import {canCloseDay, canEnsureDay, civilDayName, currentDayOf, offersEntries, type DayAperture, type DayDocumentStanding} from '../centralVertical'
import type {ReachedCame, ReachedRow} from '../../projections/atlas/system/fieldModel'
import {CONTROL, DAY_ENTRY_CANDIDATE, INVISIBLE, proseFault, proseText, shownProse} from '../plainParts'

/** The value keys the Day design reads that an owner reports or takes (day.tsx `defaults`), and the three this binding adds for the
 * catalogue to draw (`refusal`, `canOpenToday`, `canClose`) and the two it takes (`openToday`, `closeNow`). */
export const DAY_KEYS = ['light', 'date', 'face', 'dayStart', 'rollover', 'c0', 'c1', 'c2done', 'refusal', 'notice', 'canOpenToday', 'canClose', 'tomorrow', 'tomorrowOpen', 'fieldDay', 'fieldWhy',
  'fieldKept', 'fieldRefusal', 'fieldSkipped'] as const

/** The held field beside the Day (SF06, SF08; DLW build ruling 2026-11-06): the field as the Day reads it (system/fieldModel.ts
 * dayFieldReading: each star your world is at with its day, and what has reached you), or why it is not read; Central's refusal to
 * record what reached you (`fieldRefusal`, in its words), where it refused; and what was never sent because Central would refuse it by
 * its bounds (`fieldSkipped`, how many and why: fieldSkippedWords). The Day keeps what reached you under its field source (Central#324:
 * `fieldKept` is how many, central.day.field.read). */
export type DayFieldValues = ({readonly fieldDay: string} | {readonly fieldWhy: string}) & {readonly fieldRefusal?: string; readonly fieldSkipped?: string}

/** Keys the owner takes a change of (the settings', the pads' and the presses'). Every other key of the design is a reading or has no
 * owner (manual §16.13). */
export const DAY_WRITES: ReadonlySet<string> = new Set(['face', 'openToday', 'closeNow', 'openTomorrow', 'refinePattern', 'rollover', 'agentWrites', 'closeRoutine',
  'src_central', 'src_factory', 'src_expressions', 'src_techne', 'src_live', 'src_field',
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
/** The Day's field (Central#324): its reading, and the record of one thing that reached you (a person's act: action.rs PERSON_ACTS). */
export const DAY_FIELD_ACTION = 'central.day.field.read'
export const DAY_FIELD_RECORD_ACTION = 'central.day.field.record'
export const DAY_ENTRY_PART_ACTION = 'central.day.entry.part'
const MOVE_NAMES: Readonly<Record<string, string>> = {tasks: 'Tasks', patterns: 'Patterns', context: 'Context', synthesis: 'Synthesis', close: 'Close'}
/** Why a setting cannot be written now: Central's write is checked against the revision its reading gave. */
const SETTINGS_UNREAD = (what: string, own: DayOwnReadings | null) => `${what}: Central's Day settings ${own?.settingsRefusal ? `refused — ${own.settingsRefusal}` : 'have not answered yet'}, and central.day.settings.write is checked against the revision they give.`
/** Why a pad cannot record its press now: a move begins on a Day that stands (central.day.move.record names it). */
const NO_DAY_FOR_MOVES = (move: string) => `${MOVE_NAMES[move]}: no Day document stands for the Day shown, so no move begins on it (central.day.move.record records a move on a Day that stands).`
/** The Day's Sources: each mode's, and the field's (Central#324: what reaches you from the field, recorded into face 4). */
const SOURCE_KEYS = ['src_central', 'src_factory', 'src_expressions', 'src_techne', 'src_live', 'src_field'] as const
/** The keys the Day's settings reading fills, and those its moves reading fills. */
export const DAY_SETTINGS_KEYS: readonly string[] = ['rollover', 'agentWrites', 'closeRoutine', ...SOURCE_KEYS, ...DAY_MOVES.flatMap(move => [`at_${move}`, `prompt_${move}`])]
export const DAY_RUN_KEYS: readonly string[] = DAY_MOVES.flatMap(move => [`last_${move}`, `running_${move}`, ...(move === 'close' ? [] : [`gave_${move}`])])
/** The close-out (design package D5, §18.2 Close): AIKit's own reading. Central keeps no close-out verify (its action list has none), and the
 * kernel's AIKit reads (kernel/src/owner_routes.rs AikitRead: inbox, wiki shape, gateway ecology and replay) do not include it. */
export const NO_CLOSEOUT = 'Close-out is AIKit\'s reading of what the close left behind (`aikit work continuity closeout verify --json`); Central keeps no close-out verify of its own, and no kernel route reaches AIKit\'s — missing op: an aikit_read route for `work continuity closeout verify` (kernel/src/owner_routes.rs AikitRead; T-COVERAGE §1.2).'

/** The Patterns pad's refinement (manual §18.2: "A pattern whose items point at one skill or method can open a refinement of it (§19.7)"):
 * Central keeps it as what the Patterns move gave, `gave.points_at`, the one skill or method's ref (ctrl continuous_work/day_moves.rs; no
 * other move names one), and Refine opens a refinement of it on the Skillset rack's Refining page (`refine`, the chain's hand:
 * agent/devices/designBindings.ts openRefinement). REPLACED (O-I 772, round 13): PATTERN_POINTS_ABSENT, "missing field: the skill or method
 * the pattern's items point at, on the Patterns move's gave". */
export const PATTERN_POINTS_UNREAD = 'The one skill or method a pattern\'s items point at is what the Patterns move gave (gave.points_at), read from '
  + 'Central\'s Day moves (central.day.moves.read), which are not read here.'
export const PATTERN_POINTS_NONE = 'The Patterns move\'s last run named no one skill or method its pattern\'s items point at (Central keeps it as the '
  + 'move\'s gave.points_at), so Refine has nothing to open.'
export const PATTERN_POINTS_NOT_YET = 'No run of the Patterns move has ended in this Day, so no pattern names a skill or method yet.'
/** Refine where the chain hands no opener of the Skillset rack's Refining page (DayWriters.refine). */
export const REFINE_UNWIRED = 'Refine: no hand opens the Skillset rack\'s Refining page here.'

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
  patternPoints: PATTERN_POINTS_UNREAD,
  dayStart: 'Closes: Central\'s civil-time policy has not answered (central.time.policy), so no day boundary is read.',
  fieldDay: 'The held field is read beside the Day where the World\'s readings stand (system/SystemReadings.tsx); the Day keeps what reached you under its field source (central.day.field.read).',
  fieldWhy: 'Why the field is not read beside the Day: handed in with the field\'s reading (system/fieldModel.ts dayFieldReading).',
  fieldRefusal: 'Central refused no record of what reached you; where it refuses one, its words stand here (central.day.field.record).',
  fieldSkipped: 'Nothing that reached you was beyond what Central takes; where something is, how many and why stand here (dayFieldRecords).',
}

/** The bounds the Day reads and never writes: the policy's day boundary (§18.2 "no hours are set on the Day"). */
const BOUND_READINGS: ReadonlySet<string> = new Set(['dayStart'])

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
  // Closes, while the policy gives no boundary: why, in Central's words where it refused (O-I 772).
  if (facts.boundary === null) standing.dayStart = {disabled: facts.boundaryRefusal ?? DAY_ABSENT.dayStart!}
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
  /** The Day's field records (central.day.field.read, Central#324) for the Day shown; null when that Day has no document, absent while
   * it has not answered or before the window reads it. */
  readonly field?: unknown
  readonly fieldRefusal?: string | null
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

/** The one skill or method the Patterns move's last run named (Central's `gave.points_at`), or undefined. */
function pointsAtOf(run: unknown): string | undefined {
  const gave = isRecord(run) && isRecord(run.end) ? run.end.gave : undefined
  return isRecord(gave) && typeof gave.points_at === 'string' && gave.points_at ? gave.points_at : undefined
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
  const field = fieldReadingOf(own)
  if (field) values.fieldKept = field.items.length
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
        const points = move === 'patterns' ? pointsAtOf(row.last) : undefined
        if (points) values.patternPoints = points
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
  if (values.patternPoints === undefined) {
    why.patternPoints = values.last_patterns === -1 ? PATTERN_POINTS_NOT_YET : values.last_patterns !== undefined ? PATTERN_POINTS_NONE : runs
  }
  // A settings reading from a Central before the field source (Central#324) names no field source: neither On nor Off.
  if (values.src_field === undefined && settingsRevisionOf(own)) why.src_field = FIELD_SOURCE_UNNAMED
  if (values.fieldKept === undefined) {
    why.fieldKept = own.fieldRefusal ? `Central refused the Day's field: ${own.fieldRefusal}`
      : own.field === null ? 'The Day shown has no document, so what it keeps of the field is not read (central.day.field.read reads one Day).'
        : 'The Day\'s field has not answered yet (central.day.field.read).'
  }
  return why
}

/** Why the field source stands neither On nor Off where Central's Day settings answered without it. */
export const FIELD_SOURCE_UNNAMED = 'Central\'s Day settings name no field source, so whether the Day records what reaches you from the field is not read (central.day.settings.read).'

/** Central's reading of the Day's field records, where it answered as one. */
function fieldReadingOf(own: DayOwnReadings | null): {reading: Record<string, unknown>; source: Record<string, unknown>; items: readonly Record<string, unknown>[]} | null {
  const reading = own && isRecord(own.field) && own.field.schema === 'central.day-field-reading/v1' ? own.field : null
  if (!reading || !isRecord(reading.source) || !Array.isArray(reading.items)) return null
  return {reading, source: reading.source, items: reading.items.filter(isRecord)}
}

/** One thing that reached you, as central.day.field.record takes it (Central#324): who sent it, how it came (a star names itself), what
 * it is, its words and when, on the Day named. Nothing else: no count of looks, no rank. */
export interface DayFieldRecord {
  readonly day_ref: string
  readonly item_ref: string
  readonly from: {readonly world_ref: string; readonly name: string}
  readonly how: ReachedCame
  readonly star?: {readonly star_ref: string; readonly name: string}
  readonly what: string
  readonly words: string
  readonly at_unix_ms: number
}

/** Central's bounds on a field record (ctrl continuous_work/day_moves.rs field_item, is_ref and bounded_words; DLW build ruling 2026-11-09):
 * a ref is not empty, at most 512 bytes, with no whitespace or control character; a name is not blank and has no control or invisible
 * character; the words are not blank and have none but line breaks and tabs (a `\r` only before a `\n`), and no invisible one but a joiner
 * in its place (be2m; DLW build ruling 2026-11-10): inside an emoji sequence Unicode lists or inside a word of a script that joins or
 * conjoins, where it changes how the characters beside it are drawn (plainParts.ts proseFault, Central's names.rs prose_fault written
 * once more over the same data and held to it by the same cases); when it reached you is a whole
 * number of milliseconds. Invisible are the characters that make text read other than it is: U+2028/2029 and every format character
 * (general category Cf), derived as Central derives them (plainParts.ts). In a name U+200D (the zero-width joiner) is one on purpose,
 * as Central's names refuse it; a variation selector is none, so an emoji keeps its presentation.
 * Blank is counted as Rust counts whitespace (`char::is_whitespace`),
 * as Central trims. No string sent holds a lone surrogate, which no Rust string can: the whole call would be refused. Each is checked as
 * it is sent, clipped (`within`), and each reason is said as the skip names it. */
const FIELD_REF_BYTES = 512, FIELD_NAME_CHARS = 120, STAR_NAME_CHARS = 160, FIELD_WORDS_CHARS = 4096
/** At most `max` characters, the clipped ending said with "…". A line break written `\r\n` is never split: a `\r` cut from its `\n`
 * would be a lone one, which Central refuses (DLW build ruling 2026-11-09). */
const within = (text: string, max: number): string => {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  const cut = chars[max - 2] === '\r' && chars[max - 1] === '\n' ? max - 2 : max - 1
  return `${chars.slice(0, cut).join('')}…`
}
/** Rust's White_Space set (`char::is_whitespace`): JS `\s` also counts U+FEFF and not U+0085. */
const RUST_SPACE = /[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/
const lone = (c: string): boolean => { const point = c.codePointAt(0)!; return point >= 0xd800 && point <= 0xdfff }
const blank = (text: string): boolean => Array.from(text).every(c => RUST_SPACE.test(c))
const takenRef = (text: string): boolean => !!text && new TextEncoder().encode(text).length <= FIELD_REF_BYTES
  && !Array.from(text).some(c => RUST_SPACE.test(c) || CONTROL.test(c) || lone(c))
const takenName = (text: string): boolean => !blank(text) && !Array.from(text).some(c => CONTROL.test(c) || INVISIBLE.test(c) || lone(c))
const takenWords = (text: string): boolean => !blank(text) && !Array.from(text).some(lone) && proseFault(text) === null
const SKIP_WHY: Readonly<Record<string, string>> = {ref: 'a ref is at most 512 bytes, with no spaces, control characters or broken characters',
  name: 'a name is not blank and has no control, invisible or broken characters',
  words: 'the words have no NUL, control, invisible or broken characters but line breaks, tabs and a joiner inside an emoji or a joined word',
  at: 'when it reached you is a whole number of milliseconds'}
/** Why words are left out, naming what stood in the way in a person's terms where the rule names it (a soft hyphen, a joiner outside
 * an emoji or a joined word; be2m item 7), so the words can be given again without it. */
const wordsWhy = (words: string): string => { const kind = proseFault(words); return kind ? `${SKIP_WHY.words}; they hold ${kind}` : SKIP_WHY.words! }
/** A name as a skip says it: its control, invisible and broken characters shown as spaces. */
const plainName = (text: string): string => Array.from(text).map(c => (CONTROL.test(c) || INVISIBLE.test(c) || lone(c) ? ' ' : c)).join('').trim()

/** One span of instants, ms since the epoch, as Central names it ({from_unix_ms, until_unix_ms}), or null where it names none whole. */
function spanOf(value: unknown): {from: number; until: number} | null {
  const from = isRecord(value) ? value.from_unix_ms : undefined, until = isRecord(value) ? value.until_unix_ms : undefined
  return typeof from === 'number' && typeof until === 'number' && Number.isFinite(from) && Number.isFinite(until) && until > from ? {from, until} : null
}

/** What the Day takes, as Central's field reading bounds it (`takes`): the spans on which the Day's own civil date stands (`spans`: one on
 * most Days, two where an autumn fold carries the wall back across its boundary; a Central before them names one, from and until), each
 * from the later of its start and when the field last turned On; null where the reading names no bounds whole. */
function fieldTakesOf(field: {reading: Record<string, unknown>; source: Record<string, unknown>}): {spans: {from: number; until: number}[]} | null {
  const takes = isRecord(field.reading.takes) ? field.reading.takes : null
  if (!takes) return null
  const named = Array.isArray(takes.spans) ? takes.spans.map(spanOf) : [spanOf(takes)]
  if (!named.length || named.some(span => span === null)) return null
  const since = field.source.on_since_unix_ms
  const after = typeof since === 'number' && Number.isFinite(since) ? since : -Infinity
  return {spans: (named as {from: number; until: number}[]).map(span => ({from: Math.max(span.from, after), until: span.until})).filter(span => span.until > span.from)}
}

/** What reached you that the Day does not keep yet, each as central.day.field.record takes it (`records`): only on today's open Day
 * (`canClose`: never a Day you selected or one closed), only once Central's field reading has answered and its field source is On, and only
 * what reached you within what the Day takes (DLW build ruling 2026-11-08): on the Day's own civil date, and not before the field last
 * turned On, so turning it Off then On records nothing from while it was Off. The bound is Central's (`takes`); a reading that names none
 * records nothing. Its ref names the thing, what it is and when, so what moved since (a task taken, then brought back) is a thing of its
 * own. What Central would refuse by its bounds is never sent: each is `skipped`, with why, to be said once on the Field page. `dayRef` is
 * the Day this reading answered for (null until it has, and while there is no reading of the World: `reached` null, unbound or not read):
 * a Day with nothing waiting, Off included, clears its own refusal (FieldRecorder), and no other Day's. Pure. */
export function dayFieldRecords(reached: readonly ReachedRow[] | null, own: DayOwnReadings | null, facts: Pick<DayFacts, 'canClose' | 'standing'>): {dayRef: string | null; records: DayFieldRecord[]; skipped: string[]} {
  const field = fieldReadingOf(own)
  const takes = field ? fieldTakesOf(field) : null
  // No reading of the World (unbound, or its readings not read): no answer for any Day, so a refusal standing neither clears nor flaps.
  if (!reached || !field || !takes || !facts.canClose || facts.standing?.state !== 'ready') return {dayRef: null, records: [], skipped: []}
  const dayRef = facts.standing.dayRef
  if (field.source.on !== true) return {dayRef, records: [], skipped: []}
  const kept = new Set(field.items.map(item => item.item_ref))
  const records: DayFieldRecord[] = [], skipped: string[] = []
  for (const row of reached) {
    const at = row.at
    if (at === null || !takes.spans.some(span => at >= span.from && at < span.until)) continue
    const itemRef = `${row.id}|${row.what}|${at}`
    if (kept.has(itemRef)) continue
    const star = row.came === 'star' && row.star ? row.star : null
    // Who sent it goes by the name the field shows for its world, as it stands (be2k ruling 7): `unnamed world <mark>` for one with
    // nothing visible left (fieldModel whoOf), never its ref. What is sent, clipped, is what is checked. The words a world wrote (what
    // it said, contributed or answered, what a task asks, what came back and a work's name) are as their world gave them, never as a
    // row shows them: an item whose given words hold what Central refuses is left out and said, whatever its kind (be2k ruling 5; DLW
    // build ruling 2026-11-10). A part's label, a star's name and a world's name are their shown forms: the field reads those plain
    // where it reads the snapshot and keeps no other (be2l ruling 8).
    const name = within(row.from.name, FIELD_NAME_CHARS), starName = star ? within(star.name, STAR_NAME_CHARS) : ''
    const words = within(row.words ? `${row.given}: “${row.words}”` : row.given, FIELD_WORDS_CHARS)
    const beyond = ([[!takenRef(itemRef), 'item_ref', 'ref'], [!takenRef(row.from.ref), 'from.world_ref', 'ref'], [!takenName(name), 'from.name', 'name'],
      [!!star && !takenRef(star.ref), 'star.star_ref', 'ref'], [!!star && !takenName(starName), 'star.name', 'name'], [!takenWords(words), 'words', 'words'],
      [!Number.isSafeInteger(at) || at < 0, 'at_unix_ms', 'at']] as const).filter(([fails]) => fails)
    if (beyond.length) {
      const why = [...new Set(beyond.map(([, , reason]) => (reason === 'words' ? wordsWhy(words) : SKIP_WHY[reason])))].join(', and ')
      skipped.push(`${row.what} from ${within(plainName(row.from.name) || 'a world unnamed', FIELD_NAME_CHARS)} (${beyond.map(([, key]) => key).join(', ')}: ${why})`)
      continue
    }
    records.push({day_ref: dayRef, item_ref: itemRef, from: {world_ref: row.from.ref, name}, how: row.came,
      ...(star ? {star: {star_ref: star.ref, name: starName}} : {}),
      what: row.what, words, at_unix_ms: at})
  }
  return {dayRef, records, skipped}
}

/** What was skipped, said once: how many, and why each (null where nothing was). */
export const fieldSkippedWords = (skipped: readonly string[]): string | null =>
  skipped.length ? `${skipped.length} ${skipped.length === 1 ? 'thing' : 'things'} couldn't be recorded: ${skipped.join('; ')}.` : null

/** One entry of today's Day the World may show (O-I #858 SF06), as the Day offers it: its id here, its kind, its label (its words as
 * Central reads them for the part, at most 160 characters) and how central.day.entry.part names it (a field, one item of a list field, or
 * a contribution). The part shown is Central's answer on the press, never this offer. An entry Central would refuse is no offer: where the
 * person would look for it, its row says why (`why`), and it names nothing to ask (`select` null). */
export interface DayEntryCandidate {
  readonly id: string
  readonly kind: 'page'
  readonly label: string
  readonly select: {readonly field_id: string; readonly item_id?: string; readonly index?: number} | {readonly contribution_id: string} | null
  readonly why?: string
}
/** The field's bound on a part's label (shared-field clearing `shown.label`; Central's PART_LABEL_MAX). */
const PART_LABEL_CHARS = 160
/** A JSON Pointer as Central resolves it (serde_json `Value::pointer`): `~1` and `~0` unescaped, a list's place written without a sign
 * or a leading zero, and only a record's own keys. */
const pointed = (payload: unknown, pointer: string | undefined): unknown => {
  if (pointer === undefined || !pointer.startsWith('/')) return undefined
  let at: unknown = payload
  for (const step of pointer.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (Array.isArray(at)) at = /^(0|[1-9][0-9]*)$/.test(step) ? at[Number(step)] : undefined
    else if (isRecord(at)) at = Object.hasOwn(at, step) ? at[step] : undefined
    else return undefined
  }
  return at
}
/** Words as Central reads them for a part (day_moves.rs plain_text_words, DLW build ruling 2026-11-09): a control character, or a line or
 * paragraph separator, stands as a space; the other invisible characters (a bidi control or mark, a zero-width one, a soft hyphen, a tag
 * character, a letter that draws as blank space) are left out, save a joiner in its place, which is part of the words (plainParts.ts
 * proseText; be2m item 4: Central's label leaves every joiner out until its own patch lands, and the press compares the two with
 * joiners aside, centralDeviceWrites.ts sameEntryLabel); then the whitespace Rust counts is collapsed. */
const readableWords = (text: string): string => proseText(text)
  .split(new RegExp(`${RUST_SPACE.source}+`, 'u')).filter(Boolean).join(' ')
/** A field's own value as words: only text (Central reads a field's value only as text; a record or a number holds no words). */
const fieldWords = (value: unknown): string => (typeof value === 'string' ? readableWords(value) : '')
/** A list item's words: the item when it is text, else its `text` (Central's item_words). */
const itemWords = (item: unknown): string => (typeof item === 'string' ? readableWords(item) : isRecord(item) && typeof item.text === 'string' ? readableWords(item.text) : '')
/** A contribution's words as Central reads them for its label: its markup dropped (each tag a space), the five escapes read, `&amp;`
 * last, then read as words (day_moves.rs plain_words). */
const contributionWords = (html: unknown): string => typeof html !== 'string' ? '' : readableWords(html.replace(/<[^>]*>?/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'))
/** The label the field receives, as Central cuts it (day_moves.rs part_label): the words whole when they fit, else the first 159
 * characters cut back to the last space, with "…". The cut never ends inside a joined sequence (be2m.7; DLW build ruling
 * 2026-11-12): what is left is read once more (shownProse), so a joiner whose partner the cut took away goes with it, and the
 * label holds no joiner out of its place. */
export function partLabel(words: string): string {
  const chars = Array.from(words)
  if (chars.length <= PART_LABEL_CHARS) return words
  const head = chars.slice(0, PART_LABEL_CHARS - 1).join('')
  const at = head.lastIndexOf(' ')
  return `${shownProse(at > 0 ? head.slice(0, at).replace(new RegExp(`${RUST_SPACE.source}+$`, 'u'), '') : head)}…`
}
/** A list item's own id as Central counts it (list_identities): a string that is not blank as Rust trims. */
const ownId = (item: unknown): string | null => (isRecord(item) && typeof item.id === 'string' && !blank(item.id) ? item.id : null)
/** Whether Central names the item by its own id as it stands: a ref, and not one of Central's own forms (`words:`, `id:`). Else the
 * item is named by where it stands now. */
const namesByOwnId = (own: string | null): own is string => !!own && takenRef(own) && !own.startsWith('words:') && !own.startsWith('id:')

/** The prefix of the ids the Day device gives its offers (plainParts.ts, a leaf both this first frame's module and the World's field model
 * read, so the field model stays out of the first load). */
export {DAY_ENTRY_CANDIDATE}
/** The entries of the Day as it offers them to show: one per field that holds text, one per item of a list field, and one per
 * contribution standing in the Day; a blank one offers nothing, and what Central would refuse is no offer. A list whose items repeat an
 * own id is refused whole by Central (list_identities), so it offers none of its items, and one row says why. A field's words are text
 * as they stand ("5 < 6" stays so). Pure: nothing is asked of Central here. */
export function dayEntryCandidates(fields: readonly DayDocumentField[], payload: unknown, contributions: readonly unknown[] = []): DayEntryCandidate[] {
  const offers: DayEntryCandidate[] = []
  const offer = (id: string, words: string, select: NonNullable<DayEntryCandidate['select']>) => { if (words) offers.push({id, kind: 'page', label: partLabel(words), select}) }
  for (const field of fields) {
    if (!takenRef(field.id)) continue
    const value = pointed(payload, field.template_pointer)
    if (!Array.isArray(value)) {
      offer(`${DAY_ENTRY_CANDIDATE}${field.id}`, fieldWords(value), {field_id: field.id})
      continue
    }
    const ids = value.map(ownId).filter((id): id is string => id !== null)
    const twice = ids.find((id, at) => ids.indexOf(id) !== at)
    if (twice !== undefined) {
      const name = readableWords(field.label ?? '') || field.id
      if (value.some(item => itemWords(item))) {
        offers.push({id: `${DAY_ENTRY_CANDIDATE}${field.id}`, kind: 'page', label: partLabel(name), select: null,
          why: `${name} holds more than one item with the id ${readableWords(twice)}: an id names one item, so none of its items is shown until each has its own.`})
      }
      continue
    }
    value.forEach((item, index) => {
      const own = ownId(item)
      if (namesByOwnId(own)) offer(`${DAY_ENTRY_CANDIDATE}${field.id}@${own}`, itemWords(item), {field_id: field.id, item_id: own})
      else offer(`${DAY_ENTRY_CANDIDATE}${field.id}#${index}`, itemWords(item), {field_id: field.id, index})
    })
  }
  for (const row of contributions) {
    if (!isRecord(row) || typeof row.id !== 'string' || !takenRef(row.id) || row.removed === true) continue
    offer(`${DAY_ENTRY_CANDIDATE}contribution:${row.id}`, contributionWords(row.html), {contribution_id: row.id})
  }
  return offers
}

/** The Day Central names, as its ground reads it, is centralVertical.ts's (the first frame reads it there: the transport and today's set),
 * so this binding stays out of the first load. */
export {canCloseDay, canEnsureDay, centralsOpenToday, civilDayName, currentDayOf, nextCivilDate, NO_CIVIL_TIME, offersEntries, wantsCivilTime, type DayAperture} from '../centralVertical'

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
  /** Whether the Day shown offers its entries to the World's Show (O-I #858 SF06; DLW build ruling 2026-11-09): only the open Day Central
   * names as today, its civil-time policy's own date (`offersEntries`), never a Day the person selected, one closed, or yesterday's
   * still open past the boundary. */
  readonly offersEntries: boolean
  /** The Day document the die turns, when one stands. */
  readonly aperture: DayAperture | null
  /** The civil-time policy: minutes after civil midnight the day turns at, and whether rollover is automatic. */
  readonly boundary: number | null
  readonly automaticRollover: boolean | null
  /** Why the policy gives no boundary, in Central's words where it refused (null while it answers, or has not). */
  readonly boundaryRefusal?: string | null
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
  const policy = ground?.time
  const boundaryRefusal = boundary !== null || !policy || policy.state === 'ready' ? null
    : `Closes: Central refused its civil-time policy: ${policy.error?.message ?? `it answered ${policy.state}`} (central.time.policy).`
  const canOpenToday = canEnsureDay(ground)
  if (selected) {
    const standing = selected.standing
    return {civilDate: standing?.civilDate ?? null, standing, refusal: refusalOf(standing, null, null), canOpenToday, canClose: false, offersEntries: false,
      aperture: standing?.state === 'ready' ? selected.aperture : null, boundary, automaticRollover, boundaryRefusal}
  }
  if (!ground) return {civilDate: null, standing: null, refusal: groundError ? `Central's ground did not answer: ${groundError}` : null, canOpenToday: false, canClose: false, offersEntries: false, aperture: null, boundary, automaticRollover, boundaryRefusal}
  const current = currentDayOf(ground)
  const civilDate = time?.civil_date ?? current.pointer
  // Tomorrow's Day, where Central names one after the Day shown (a stale name, on or before today, is no tomorrow).
  const named = (ground.day.data as {tomorrow?: {civil_date?: unknown} | null} | null | undefined)?.tomorrow?.civil_date
  const tomorrow = typeof named === 'string' && civilDate && named > civilDate ? named : null
  return {civilDate, standing: current.standing, refusal: refusalOf(current.standing, current.pointer, time?.civil_date ?? null), canOpenToday,
    canClose: canCloseDay(ground), offersEntries: offersEntries(ground), aperture: current.aperture, boundary, automaticRollover, boundaryRefusal, tomorrow}
}

function refusalOf(standing: DayDocumentStanding | null, pointer: string | null, today: string | null): string | null {
  if (!standing || standing.state === 'ready') return null
  if (standing.state === 'unopened') return standing.message
  // The stale pointer: the owner's words, and the two dates it compares (central.rs Request::Inspect).
  if (pointer && today && pointer !== today) return `${standing.message} (Central's Day: ${civilDayName(pointer) ?? pointer}; civil today: ${civilDayName(today) ?? today})`
  return standing.message
}

/** The design's values from the facts, the shown Day's document and the Day's own settings and moves. Only what an owner reports;
 * nothing from the design's defaults. */
export function dayValuesOf(facts: DayFacts, document: {readonly face: number; readonly payload: unknown} | null, own: DayOwnReadings | null = null,
  field: DayFieldValues | null = null): Record<string, Value> {
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
  // Today not opened yet (a fresh ground, or past the boundary) is no refusal: it stands in the well as a notice, beside Open today.
  if (facts.refusal) { if (facts.standing?.state === 'unopened') values.notice = facts.refusal; else values.refusal = facts.refusal }
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
  // The held field beside the Day, and Central's refusal to record what reached you, where it refused (Central#324).
  if (field) Object.assign(values, field)
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
  /** Open a refinement of the one skill or method the Patterns move's pattern points at, on the Skillset rack's Refining page (§19.7). */
  readonly refine?: (member: string) => void | Promise<void>
}

/** The binding the runtime hosts the Day design on: the readings, and the writes its owners take. A change of any other key is refused
 * as a reading by the runtime (deviceHost.tsx flushDrafts); a write the owner cannot take now is refused in words. */
export function dayDesignBinding(id: string, facts: DayFacts, values: Readonly<Record<string, Value>>, writers: DayWriters, own: DayOwnReadings | null = null): DesignBinding {
  const standing = dayStanding(facts, own)
  // Refine: the one skill or method Central names for the Patterns move's pattern, opened through the chain's hand.
  const points = typeof values.patternPoints === 'string' ? values.patternPoints : null
  if (!points) standing.refinePattern = {disabled: (own ? dayOwnAbsent(own, values).patternPoints : undefined) ?? PATTERN_POINTS_UNREAD}
  else if (!writers.refine) standing.refinePattern = {disabled: REFINE_UNWIRED}
  return {
    id,
    values,
    standing,
    // A control closed for now still goes to `write`, so its refusal says why.
    writes: key => DAY_WRITES.has(key) || (!!standing[key]?.disabled && !BOUND_READINGS.has(key)),
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
        } else if (change.key === 'refinePattern') {
          if (change.value !== points) throw new Error(`Refine opens a refinement of the one skill or method the pattern's items point at: it points at ${points}, not ${String(change.value)}.`)
          await writers.refine!(points!)
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
