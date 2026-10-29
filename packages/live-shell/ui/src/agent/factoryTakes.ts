// Factory attempts as takes (manual §3: "Takes stack under a clip so you can choose the one that stands"; lock §9.1 Factory row:
// takes = attempts). A session's track carries a take lane for each Software Factory attempt its bound task serves, and the
// attempt that stands is the one whose Return Central has received.
//
// Three owners answer, and none is asked to say more than it knows:
//   - AIKit says which attempts a session's task serves (`encounter_task_attempts_list`, aikit.encounter-task-attempts/v1): the
//     Factory dispatcher recorded each on the task it dispatched on, with the Run and the Factory state that holds it;
//   - Factory says what each attempt is (`factory_attempt_read`, factory.attempt-reading/v1): when it was admitted, whether it
//     has returned or failed, and whether its Return carries a Central receiving receipt;
//   - choosing a take is Factory's own op (`factory_owner` attempt-receiving, desk/factoryReads.ts `receiveAttempt`): the Return
//     proposed to Central's receiving field. Factory receives a whole attempt, so a stretch dragged across a take chooses the take.
//
// Pure TypeScript. No React.
import type {EncounterTaskAttemptsList, ServedAttempt} from '../../../../../desktop/cradle/src/kernel/types'

/** How an attempt stands, in Factory's terms: running (dispatched, no Return and no failure), returned, failed, or prepared
 * (admitted, not yet dispatched). A chosen attempt is a returned one whose Return Central has received. */
export type TakeState = 'prepared' | 'running' | 'returned' | 'failed'

/** One attempt as a take under its session. */
export interface FactoryTake {
  sessionRef: string
  attemptRef: string
  runRef: string
  statePath: string
  taskRef: string
  /** The workflow unit the attempt works, in short readable words; null when the owner's ref is an opaque identity. */
  unit: string | null
  /** The owner's own ref of that unit (`workflow-unit:…`), by which Factory keeps its plan (agent/wavePlan.ts); null where none is named. */
  unitRef?: string | null
  state: TakeState
  /** Admission time, when the owner disclosed one (older states carry none). */
  startUnixMs: number | null
  /** The Return's, else the failure's admission time; absent while the attempt runs. */
  endUnixMs: number | null
  /** The Return's summary, as the owner wrote it. */
  summary: string | null
  /** Central's receiving receipt for the Return: this take stands. */
  receivingRef: string | null
  /** The Workcell world the attempt ran in (its execution body's materialWorldRef), where Factory names one. */
  materialWorldRef?: string | null
}

const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const time = (value: unknown): number | null => { const at = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(at) ? at : null }

/** The key a Run's attempts are read under: the Factory state that holds it, and its ref. */
export const runKey = (statePath: string, runRef: string): string => JSON.stringify([statePath, runRef])

/** The unit in short words, when its ref says something: a key (`inspect-source`), not the opaque identity Factory mints for a unit
 * (`workflow-unit:3C73CMWMP7956ZN0XFWD5FMFYW`), which tells takes apart no better than their number does. */
export function unitWords(unit: unknown): string | null {
  if (typeof unit === 'string') {
    const tail = unit.split(/[:/]/).filter(Boolean).pop() ?? ''
    return !tail || /^[0-9A-Z]{20,}$/.test(tail) ? null : tail
  }
  const row = object(unit)
  const named = row && (text(row.unit) ?? text(row.key) ?? text(row.unitKey) ?? text(row.reference) ?? text(row.ref))
  return named ? unitWords(named) : null
}

/** The unit's own ref as Factory names it (`workflow-unit:…`), from a ref or a row that carries one; null where none is named. */
export function unitRefOf(unit: unknown): string | null {
  if (typeof unit === 'string') return /^workflow-unit:\S+$/.test(unit) ? unit : null
  const row = object(unit)
  return row ? unitRefOf(row.workflowUnitRef ?? row.workflow_unit_ref ?? row.reference ?? row.ref) : null
}

/** Each session's served attempts, in the order the owner gave them. A session the owner refused, or whose bound task serves
 * none, is absent from the map: it is not a session with no takes, it is one with nothing read. */
export function servedBySession(list: EncounterTaskAttemptsList): Map<string, ServedAttempt[]> {
  const served = new Map<string, ServedAttempt[]>()
  for (const reading of list.readings) {
    if (!('attempts' in reading)) continue
    served.set(reading.agent_session, reading.attempts.filter(attempt => attempt.task_ref === reading.task_ref))
  }
  return served
}

/** The Runs to read: each distinct Factory state and Run the served attempts name. */
export function runsOf(served: ReadonlyMap<string, readonly ServedAttempt[]>): {statePath: string; runRef: string}[] {
  const runs = new Map<string, {statePath: string; runRef: string}>()
  for (const attempts of served.values()) for (const attempt of attempts) runs.set(runKey(attempt.state_path, attempt.run_ref), {statePath: attempt.state_path, runRef: attempt.run_ref})
  return [...runs.values()]
}

/** One attempt as Factory reads it: its record in the Run's attempt reading, joined to the session that serves it. */
export function takeOf(sessionRef: string, served: ServedAttempt, record: unknown): FactoryTake | null {
  const row = object(record)
  if (!row || row.attemptRef !== served.attempt_ref) return null
  const returned = object(row.readableReturn)
  const failed = time(row.failureRecordedAt) !== null || (Array.isArray(row.failureEvidenceRefs) && row.failureEvidenceRefs.length > 0)
  const state: TakeState = returned ? 'returned' : failed ? 'failed' : row.executionRef || row.dispatch ? 'running' : 'prepared'
  return {
    sessionRef, attemptRef: served.attempt_ref, runRef: served.run_ref, statePath: served.state_path, taskRef: served.task_ref,
    unit: unitWords(row.workflowUnitRef ?? served.workflow_unit), unitRef: unitRefOf(row.workflowUnitRef ?? served.workflow_unit), state,
    startUnixMs: time(row.attemptRecordedAt),
    endUnixMs: returned ? time(row.returnRecordedAt) : failed ? time(row.failureRecordedAt) : null,
    summary: returned ? text(returned.summary) : null,
    receivingRef: returned ? text(returned.receivingRef) : null,
    materialWorldRef: text(object(object(row.disposition)?.body)?.materialWorldRef),
  }
}

/** Every session's takes, from what AIKit served and what Factory read. An attempt Factory's reading does not hold (the Run was
 * not read, or the state moved on) is left out: a take is only drawn from what its owner says. */
export function takesBySession(served: ReadonlyMap<string, readonly ServedAttempt[]>, runs: ReadonlyMap<string, unknown>): Map<string, FactoryTake[]> {
  const out = new Map<string, FactoryTake[]>()
  for (const [session, attempts] of served) {
    const takes: FactoryTake[] = []
    for (const attempt of attempts) {
      const reading = object(runs.get(runKey(attempt.state_path, attempt.run_ref)))
      const record = Array.isArray(reading?.attempts) ? reading.attempts.find(row => object(row)?.attemptRef === attempt.attempt_ref) : undefined
      const take = record ? takeOf(session, attempt, record) : null
      if (take) takes.push(take)
    }
    out.set(session, takes)
  }
  return out
}

/** A take's name on its lane: its number among the takes of its unit, with the unit's key when the owner's ref carries one. Takes
 * are numbered in the order the owner served them. */
export function takeNames(takes: readonly FactoryTake[]): Map<string, string> {
  const seen = new Map<string, number>()
  return new Map(takes.map(take => {
    const n = (seen.get(take.unit ?? '') ?? 0) + 1
    seen.set(take.unit ?? '', n)
    return [take.attemptRef, take.unit ? `${take.unit} · take ${n}` : `take ${n}`]
  }))
}

/** What a take says it is, beside its name. */
export function takeWords(take: FactoryTake): string {
  switch (take.state) {
    case 'prepared': return 'prepared, not yet dispatched'
    case 'running': return 'running'
    case 'failed': return 'failed'
    case 'returned': return take.receivingRef ? `returned and chosen (${take.receivingRef})` : 'returned, not yet chosen'
  }
}
