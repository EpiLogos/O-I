// Prompt pads on their owner (lanes W7, W8; DLW §19.22, software-factory:prompt-pads — "Kind: instrument · Chain: Factory's Main track").
// The bank is Factory's (factory/src/prompt_pads.rs), reached through the kernel's factory_owner (lane W3 round 3):
//   locate {project}        where the shell's project keeps its Factory state (a project with no `.factory` is `absent`);
//   pads-read {state_path, project_ref}   factory.prompt-pads-reading/v1: revision (`absent` before the first write), slots [{index, pad:
//                           null | {name, prompt, session {kind new | session, session_ref}, agent_ref, scope_ref, seat, runs_at {kind off |
//                           daily, time, days? | every, hours}, choke}, next_at_unix_ms, running, last {state, ended_at_unix_ms, reason,
//                           task_ref}}]; real shape in desktop/cradle/kernel/tests/fixtures/owner-routes/factory-pads-2026-10-21.json;
//   pads-write {state_path, project_ref, index, expected_revision, pad | null}   one slot written or emptied on the bank's revision. The
//                           kernel presents the person's human grant its own token holds; the desk never asserts one.
// Each setting of the pad you read is written alone, as Factory's own pad with that one field changed (a prompt on an empty pad makes the
// pad: §19.22 "Writing a prompt on an empty pad makes the pad"); Clear empties the slot. Run now stands disabled: Factory never runs a
// pad — "the launch goes through the gateway as any launch does" — and no route launches a pad's task, so recording a begin
// (`pads-run`) here would claim a run that never started. The choosers' rows (sessions, agents, scopes, seats) have no reading.
// A pad the bank schedules (`runs_at`) shows that schedule as its routine's `when` and its next time (`next_at_unix_ms`), as readings: the
// pad keeps no time of its own (§16.8). Make routine is the shell's own act (O-I #748): Settings, Automations, opened on the bank's project
// for the pad you read, through the `makeRoutine` port; it writes nothing here.
// The bank shown and the pad you read are the shell's own holds. Pure, apart from the view holds.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'
import {refusalWords} from './ownerRoutes'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

export const PROMPT_PADS_DESIGN = 'software-factory:prompt-pads'
export const PROMPT_PADS_ID = 'factory:main:prompt-pads'

/** Prompt pads as a device of the runtime: Software Factory's admitted `prompt-pads` face (softwareFactoryFamilyManifest.ts). */
export const promptPadsDevice = (): DeviceInstance | null => familyFaceDevice(PROMPT_PADS_ID, 'software-factory', 'prompt-pads', 'Prompt pads', 'keys')

const missing = (what: string, op: string) => `${what}: no owner operation carries it yet — missing op: ${op} (Software Factory).`
const unread = (what: string, op: string) => `${what}: no reading reaches it yet — missing op: ${op} (Software Factory).`

/** The choosers' rows, each absent with the reading it waits for. */
export const PADS_ABSENT: Readonly<Record<string, string>> = {
  sessions: unread('The sessions a pad may start on', 'a listing of the project\'s sessions for the bank (the bank reading names a pad\'s own session, not the ones to choose from)'),
  agents: unread('The agents a pad may open a session with', 'a listing of the project\'s agents for the bank'),
  scopes: unread('The scopes a pad may run under', 'a listing of the project\'s scopes for the bank'),
  seats: unread('The seats a pad may work in', 'a listing of the machine\'s seats for the bank'),
}

/** The selected pad's settings: each is the bank's reading and is written alone through pads-write. */
export const PAD_SETTINGS: readonly string[] = ['name', 'prompt', 'session', 'agent', 'scope', 'seat', 'runsAt', 'at', 'days', 'every', 'choke']

/** The acts no route carries, and the refusals the writes give. */
export const PADS_REFUSE = {
  press: missing('Run now', 'a launch of the pad\'s task through the gateway (Factory never runs a pad; `pads-run` only records that a launched run began, and no route launches one)'),
  noCarrier: 'The kernel carrier is unavailable here, so Factory cannot be asked (`factory development pads-write` through the kernel\'s factory_owner).',
  noPad: 'Press a pad first: a setting is written on the pad you read.',
  emptyPad: 'Write the prompt first: writing a prompt on an empty pad makes the pad (§19.22).',
  emptyClear: 'Clear: the pad is empty; there is nothing to clear.',
  noBank: 'Factory\'s bank has not answered yet (`factory development pads`).',
} as const

/** Factory's answers, as the window holds them. */
export interface PadsAnswer {
  readonly status: 'reading' | 'answered' | 'refused'
  readonly value: unknown
  readonly error: string | null
}

/** Where the bank is kept: the located project's state and ref (factory_owner locate's first located row), or why not. Pure. */
export function padsLocation(located: unknown): {statePath: string; projectRef: string; project?: string} | {why: string} | null {
  if (!isObj(located) || !Array.isArray(located.locations)) return null
  const row = located.locations.find(isObj)
  if (!row) return {why: 'Factory located no project here (`factory development locate` answered no row).'}
  const location = isObj(row.location) ? row.location : null
  if (row.state === 'located' && location && str(location.statePath) && str(location.projectRef)) {
    return {statePath: String(location.statePath), projectRef: String(location.projectRef), ...(str(row.project) ? {project: String(row.project)} : {})}
  }
  return {why: row.state === 'absent' ? `Factory keeps no state for ${str(row.project) ?? 'this project'}: no project placement (\`.factory\`) stands there (factory development locate: absent).`
    : str(row.error) ?? 'Factory refused to locate the project.'}
}

/** Factory's runs_at as the design's Runs at, At (minutes after midnight), Days and Every. Days the design cannot say (a set other than every
 * day, weekdays or weekends) are left out. Pure. */
function schedule(runsAt: unknown): Record<string, Value> {
  if (!isObj(runsAt)) return {}
  if (runsAt.kind === 'every') return {runsAt: 'every', ...(num(runsAt.hours) !== undefined ? {every: num(runsAt.hours)!} : {})}
  if (runsAt.kind !== 'daily') return runsAt.kind === 'off' ? {runsAt: 'off'} : {}
  const time = /^(\d{1,2}):(\d{2})$/.exec(String(runsAt.time ?? ''))
  const days = Array.isArray(runsAt.days) ? [...runsAt.days].map(String).sort().join(',') : null
  const word = days === null ? 'all' : days === 'fri,mon,thu,tue,wed' ? 'weekdays' : days === 'sat,sun' ? 'weekends' : days === 'fri,mon,sat,sun,thu,tue,wed' ? 'all' : undefined
  return {runsAt: 'daily', ...(time ? {at: Number(time[1]) * 60 + Number(time[2])} : {}), ...(word ? {days: word} : {})}
}

/** A Factory pad as the design's pad (software-factory__prompt-pads.tsx Pad): the manual's words for what Factory leaves unnamed — a new
 * session, the project's agent, the session's scope and seat (§19.22's defaults), Off for no choke group. Pure. */
export function padOf(pad: unknown): Record<string, Value> | null {
  if (!isObj(pad) || !str(pad.prompt)) return null
  const session = isObj(pad.session) && pad.session.kind === 'session' && str(pad.session.session_ref) ? String(pad.session.session_ref) : 'new'
  return {...(str(pad.name) ? {name: String(pad.name)} : {}), prompt: String(pad.prompt), session, agent: str(pad.agent_ref) ?? 'project', scope: str(pad.scope_ref) ?? 'session',
    seat: str(pad.seat) ?? 'session', ...schedule(pad.runs_at), choke: num(pad.choke) ?? 0}
}

/** A day and time in the person's clock ('Thu 08:00'); nothing for no instant. */
function clockAt(atUnixMs: number | undefined, timezone: string | undefined): string | undefined {
  if (atUnixMs === undefined) return undefined
  try {
    return new Intl.DateTimeFormat('en-GB', {timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(atUnixMs)).replace(',', '')
  } catch { return undefined }
}

/** When Factory's bank says a pad runs by itself, in the design's words ('weekdays 08:00', 'every 6 h'); nothing for a pad that runs only
 * when pressed. The pad keeps no time of its own (§16.8, §19.22): this is the bank's reading of its schedule, shown as the pad's routine's
 * `when`. Pure. */
export function scheduleWords(runsAt: unknown): string | undefined {
  if (!isObj(runsAt)) return undefined
  if (runsAt.kind === 'every') return num(runsAt.hours) !== undefined ? `every ${num(runsAt.hours)} h` : undefined
  if (runsAt.kind !== 'daily' || !str(runsAt.time)) return undefined
  const days = Array.isArray(runsAt.days) ? [...runsAt.days].map(String).sort().join(',') : null
  const word = days === null || days === 'fri,mon,sat,sun,thu,tue,wed' ? 'daily' : days === 'fri,mon,thu,tue,wed' ? 'weekdays' : days === 'sat,sun' ? 'weekends' : days.replace(/,/g, ' ')
  return `${word} ${String(runsAt.time)}`
}

/** The bank's slots as the design's pads (sixteen rows {index, pad, next?, nextIn?, running, last?, routine?}): a pad the bank schedules
 * carries `routine.when`, the schedule as a reading (scheduleWords); the AIKit Routine's own state and its unattended grant are not read
 * here, so they stay absent. Null when the reading is not the bank. Pure. */
export function padRows(bank: unknown, timezone?: string): Record<string, unknown>[] | null {
  if (!isObj(bank) || bank.schema !== 'factory.prompt-pads-reading/v1' || !Array.isArray(bank.slots)) return null
  const now = num(bank.now_unix_ms)
  return bank.slots.flatMap(slot => {
    if (!isObj(slot) || num(slot.index) === undefined) return []
    const pad = padOf(slot.pad), next = num(slot.next_at_unix_ms), last = isObj(slot.last) ? slot.last : null
    const end = last && ['done', 'stalled', 'stopped', 'refused'].includes(String(last.state)) ? String(last.state) : undefined
    const when = pad && isObj(slot.pad) ? scheduleWords(slot.pad.runs_at) : undefined
    return [{index: num(slot.index), pad, running: isObj(slot.running), ...(when ? {routine: {when}} : {}), ...(next !== undefined ? {next: clockAt(next, timezone)} : {}),
      ...(next !== undefined && now !== undefined ? {nextIn: Math.max(0, Math.round((next - now) / 60_000))} : {}),
      ...(last ? {last: {...(end ? {end} : {}), ...(num(last.ended_at_unix_ms) !== undefined ? {at: clockAt(num(last.ended_at_unix_ms), timezone)} : {}),
        ...(str(last.reason) ? {reason: String(last.reason)} : {}), ...(str(last.task_ref) ? {task: String(last.task_ref)} : {})}} : {})}]
  })
}

/** Factory's pad with one of the design's settings changed (pads-write takes the whole pad). Throws why the change cannot be written. */
export function padWith(raw: unknown, key: string, value: Value | undefined): Obj {
  if (!isObj(raw) || !str(raw.prompt)) {
    if (key !== 'prompt') throw Error(PADS_REFUSE.emptyPad)
    if (typeof value !== 'string' || !value.trim()) throw Error('Prompt: write what the task asks.')
    return {prompt: value}
  }
  const runs = isObj(raw.runs_at) ? raw.runs_at : {kind: 'off'}
  const daily = (patch: Obj): Obj => ({kind: 'daily', ...(runs.kind === 'daily' ? {time: runs.time, ...(Array.isArray(runs.days) ? {days: runs.days} : {})} : {}), ...patch})
  switch (key) {
    case 'name': return {...raw, name: value === undefined || value === '' ? null : value}
    case 'prompt': return {...raw, prompt: value}
    case 'session': return {...raw, session: value === 'new' || value === undefined ? {kind: 'new'} : {kind: 'session', session_ref: value}}
    case 'agent': return {...raw, agent_ref: value === 'project' || value === undefined ? null : value}
    case 'scope': return {...raw, scope_ref: value === 'session' || value === undefined ? null : value}
    case 'seat': return {...raw, seat: value === 'session' || value === undefined ? null : value}
    case 'runsAt': return {...raw, runs_at: value === 'daily' ? daily({}) : value === 'every' ? {kind: 'every', ...(runs.kind === 'every' ? {hours: runs.hours} : {})} : {kind: 'off'}}
    case 'at': {
      const minutes = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(minutes)) throw Error('At: a time of day.')
      return {...raw, runs_at: daily({time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.round(minutes % 60)).padStart(2, '0')}`})}
    }
    case 'days': {
      const {days: _, ...rest} = daily({}) as Obj & {days?: unknown}
      return {...raw, runs_at: value === 'weekdays' ? {...rest, days: ['mon', 'tue', 'wed', 'thu', 'fri']} : value === 'weekends' ? {...rest, days: ['sat', 'sun']} : rest}
    }
    case 'every': return {...raw, runs_at: {kind: 'every', hours: typeof value === 'number' ? value : Number(value)}}
    case 'choke': return {...raw, choke: value === 0 || value === '0' || value === undefined ? null : Number(value)}
    default: throw Error(`${key} is a reading: its owner reports it; nothing here changes it.`)
  }
}

export interface PromptPadsInput {
  /** factory_owner locate {project} for the shell's project. */
  readonly located: PadsAnswer
  /** factory_owner pads-read for the located bank; absent while there is none to read. */
  readonly bank?: PadsAnswer
  readonly timezone?: string
  readonly holds: ChainHolds
}

/** The writes through Factory (factory_owner pads-write, the kernel's human grant). Absent: no carrier stands. */
export interface PromptPadsPorts {
  readonly write?: (request: {state_path: string; project_ref: string; index: number; expected_revision: string; pad: unknown}) => Promise<unknown>
  /** Make routine: Settings, Automations opened on a new routine for the pad you read, in the bank's project (§19.22 Running alone). The
   * shell's own act: it writes nothing here. */
  readonly makeRoutine?: (pad: {index: number; projectRef: string; project?: string; name?: string}) => void
}

const PADS_LOCAL = ['project', 'pad'] as const
/** Why Make routine stands closed where no Settings window is handed to the device. */
const NO_SETTINGS = 'Make routine opens Settings, Automations, and no Settings window is handed to the pads here.'

export function promptPadsValues(input: PromptPadsInput | ChainHolds): Values {
  const full = 'holds' in input ? input as PromptPadsInput : {located: {status: 'reading' as const, value: null, error: null}, holds: input as ChainHolds}
  const values: Record<string, Value> = {}
  const view = viewHolds(full.holds, PROMPT_PADS_ID)
  for (const key of PADS_LOCAL) if (view[key] !== undefined) values[key] = view[key]!
  const where = full.located.status === 'answered' ? padsLocation(full.located.value) : null
  if (where && 'projectRef' in where) {
    values.projects = JSON.stringify([{id: where.projectRef, name: where.project ?? where.projectRef}])
    if (values.project === undefined) values.project = where.projectRef
  }
  if (full.bank?.status === 'refused' || (full.located.status === 'answered' && where && 'why' in where)) values.light = 'dark'
  if (full.bank?.status !== 'answered') return values
  const rows = padRows(full.bank.value, full.timezone)
  if (!rows || !isObj(full.bank.value)) return values
  values.light = 'lit'
  values.pads = JSON.stringify(rows)
  if (str(full.bank.value.revision)) values.revision = String(full.bank.value.revision)
  const chosen = typeof values.pad === 'number' ? rows.find(row => row.index === values.pad) : undefined
  const pad = chosen && isObj(chosen.pad) ? chosen.pad : null
  if (pad) for (const key of PAD_SETTINGS) if (pad[key] !== undefined) values[key] = pad[key] as Value
  return values
}

export function promptPadsBinding(input: PromptPadsInput | ChainHolds, ports: PromptPadsPorts = {}): DesignBinding {
  const full = 'holds' in input ? input as PromptPadsInput : {located: {status: 'reading' as const, value: null, error: null}, holds: input as ChainHolds}
  const values = promptPadsValues(full)
  const where = full.located.status === 'answered' ? padsLocation(full.located.value) : null
  const bankWhy = full.located.status === 'refused' ? refusalWords(full.located.error ?? 'Factory refused to locate the project.')
    : full.located.status === 'reading' ? 'Factory has not located the project yet (`factory development locate`).'
      : !where ? '`factory development locate` answered something other than its locations.' : 'why' in where ? where.why
        : full.bank?.status === 'refused' ? refusalWords(full.bank.error ?? 'Factory refused its bank.')
          : full.bank?.status !== 'answered' ? PADS_REFUSE.noBank : !('pads' in values) ? '`factory development pads` answered something other than the bank.' : null
  const standing: Record<string, Standing> = {press: {disabled: PADS_REFUSE.press}}
  for (const [key, why] of Object.entries(PADS_ABSENT)) standing[key] = {disabled: why}
  for (const key of ['light', 'revision', 'pads', 'projects']) if (!(key in values)) standing[key] = {disabled: bankWhy ?? `${key}: Factory's bank names none.`}
  const writeWhy = !ports.write ? PADS_REFUSE.noCarrier : bankWhy ?? (typeof values.pad !== 'number' ? PADS_REFUSE.noPad : null)
  if (writeWhy) for (const key of [...PAD_SETTINGS, 'clear']) standing[key] = {disabled: writeWhy}
  // An empty slot: only a prompt makes the pad (§19.22); its other settings, and Clear, wait for one.
  else if (!('prompt' in values)) for (const key of [...PAD_SETTINGS.filter(key => key !== 'prompt'), 'clear']) standing[key] = {disabled: key === 'clear' ? PADS_REFUSE.emptyClear : PADS_REFUSE.emptyPad}
  const write = async (key: string, value: Value | undefined) => {
    if (writeWhy || !where || !('projectRef' in where) || !isObj(full.bank?.value)) throw Error(writeWhy ?? PADS_REFUSE.noBank)
    const index = Number(values.pad)
    const raw = (Array.isArray(full.bank!.value.slots) ? full.bank!.value.slots : []).find(slot => isObj(slot) && slot.index === index) as Obj | undefined
    const pad = key === 'clear' ? null : padWith(raw?.pad, key, value)
    await ports.write!({state_path: where.statePath, project_ref: where.projectRef, index, expected_revision: String(full.bank!.value.revision ?? 'absent'), pad})
  }
  // Make routine (§19.22 Running alone): the shell's own act, on the pad you read, in the bank's project.
  const projectRef = where && 'projectRef' in where ? where.projectRef : undefined
  if (!ports.makeRoutine) standing.makeRoutine = {disabled: NO_SETTINGS}
  else if (!projectRef) standing.makeRoutine = {disabled: bankWhy ?? PADS_REFUSE.noBank}
  const makeRoutine = (value: Value | undefined) => {
    const index = typeof value === 'number' ? value : Number(values.pad)
    const rows = typeof values.pads === 'string' ? JSON.parse(values.pads) as Record<string, unknown>[] : []
    const row = rows.find(item => item.index === index), pad = row && isObj(row.pad) ? row.pad : null
    if (!ports.makeRoutine || !projectRef || !Number.isInteger(index) || !pad) return
    ports.makeRoutine({index, projectRef, ...(where && 'project' in where && where.project ? {project: where.project} : {}), ...(str(pad.name) ? {name: String(pad.name)} : {})})
  }
  return {
    id: PROMPT_PADS_ID,
    values,
    standing,
    local: {...Object.fromEntries(PADS_LOCAL.map(key => [key, (value: Value | undefined) => holdView(PROMPT_PADS_ID, key, value)])), makeRoutine},
    writes: key => PAD_SETTINGS.includes(key) || key === 'clear' || key === 'press',
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'press') throw Error(PADS_REFUSE.press)
        await write(key, value)
      }
    },
  }
}
