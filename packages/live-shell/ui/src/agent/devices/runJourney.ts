// The Journey a Run belongs to (lane W8; the Run map's Journey, software-factory__run-map.tsx `journey`), read from Factory's
// own developmental readings through the kernel's factory_development_read (desktop/cradle/kernel/src/factory.rs), which exist:
//   `run` <run-ref>          factory.run-reading/v1: owningJourneyRefs (the Journey the Run belongs to), lifecycle, nativeAttempts?;
//   `journey` <journey-ref>  factory.journey-reading/v1: commission {purpose, commission_ref}, status, runRefs (in the order Factory keeps
//                            them: a continued Run joins its Journey after the Run it continues), returns [{return_ref, run_refs,
//                            recognition_ref?, summary}], recognitions [{recognition_ref, subject_ref}].
// Real shapes in tests/fixtures/factory-journey-2026-10-21.json (Central's root Factory state, read-only). The Run shown is the one the
// take lanes name (owners/attemptTakes.ts: each take carries its Run's state path and ref). Every other Run of the Journey is read once
// for its lifecycle and attempts. Nothing is invented: a Run with no Return has no `recognised`; a Run whose reading refused keeps only
// its ref; a name is not given, because a run reading carries none (its `destination` is where it goes, not what it is called). The
// Commission's own reading (`commission-read`) is not needed: the journey reading carries the Commission's purpose and the Runs' order.
// The shown Run's units are read beside it (O-I 745): `factory workflow inspect <state> <run-ref>` through the kernel's factory_owner
// `workflow-inspect` (factory.workflow-inspection/v1; Factory's workflow_authoring/inspect.rs): `legs` by workflow unit ({status, standing}:
// status null while the unit has not started), `barriers` [{key, notReturned}], `attempts` [{workflowUnitRef}], and `nextCursor` while more
// pages stand. Real shape in tests/fixtures/factory-workflow-inspection-2026-11-12.json. Its refusal (a Run with no native attempt
// field) does not refuse the Run: the map is drawn without legs, and the refusal is kept in Factory's words.
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useHeldRead} from '../../owners/ownerCall'
import {refusalWords} from './ownerRoutes'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

/** One developmental reading through the kernel's held reads: Factory's document, or its refusal in its words. */
export async function developmentReading(transport: KernelTransportStatus, statePath: string, read: 'run' | 'journey', subject: string): Promise<unknown> {
  if (transport.kind === 'unavailable') throw new Error(`The kernel carrier is unavailable: ${transport.reason}`)
  const call = await kernelRead(transport, {op: 'factory_development_read', state_path: statePath, read, subject})
  if (call.error) throw new Error(refusalWords(call.error))
  if (call.outcome?.result !== 'factory_development_reading') throw new Error(`factory development ${read} did not answer with its reading.`)
  return call.outcome.data
}

/** What Factory's workflow inspection says of the shown Run's units: each unit's leg by its workflow unit ref (its status as Factory
 * names it, none while the unit has not started; how many attempts Factory keeps for it), and each barrier's units still out. */
export interface RunInspection {
  readonly legs: Readonly<Record<string, {readonly status?: string; readonly attempts: number}>>
  readonly barriers: readonly {readonly key: string; readonly notReturned: readonly string[]}[]
}
export const INSPECTION_CONTRACT = 'factory.workflow-inspection/v1'
/** The most units Factory hands in one page (inspect.rs `range`: 1..100). */
const INSPECTION_PAGE = 100
/** More pages than any Run's map draws: past it the reading is refused by name, never cut short in silence. */
const INSPECTION_PAGES = 64

/** Read the shown Run's inspection, every page Factory names (its own cursor handed back as given). Throws Factory's refusal. */
export async function readRunInspection(transport: KernelTransportStatus, statePath: string, runRef: string): Promise<RunInspection> {
  if (transport.kind === 'unavailable') throw new Error(`The kernel carrier is unavailable: ${transport.reason}`)
  const legs: Record<string, {status?: string; attempts: number}> = {}
  const tried: Record<string, number> = {}
  const barriers: {key: string; notReturned: readonly string[]}[] = []
  let cursor: unknown = null
  for (let page = 0; ; page++) {
    if (page >= INSPECTION_PAGES) throw new Error(`Factory's workflow inspection of this Run runs past ${INSPECTION_PAGES * INSPECTION_PAGE} units; the Run map reads no further.`)
    const call = await kernelRead(transport, {op: 'factory_owner', request: {kind: 'workflow-inspect', state_path: statePath, run_ref: runRef, limit: INSPECTION_PAGE, ...(cursor ? {cursor} : {})}})
    if (call.error) throw new Error(refusalWords(call.error))
    const data = call.outcome?.result === 'factory_development_reading' ? call.outcome.data : null
    if (!isObj(data) || data.contract !== INSPECTION_CONTRACT) throw new Error(`factory workflow inspect did not answer with its reading (${INSPECTION_CONTRACT}).`)
    for (const [unit, leg] of Object.entries(isObj(data.legs) ? data.legs : {})) {
      const status = isObj(leg) ? str(leg.status) : undefined
      legs[unit] = {...(status ? {status} : {}), attempts: 0}
    }
    for (const row of Array.isArray(data.attempts) ? data.attempts : []) {
      const unit = isObj(row) ? str(row.workflowUnitRef) : undefined
      if (unit) tried[unit] = (tried[unit] ?? 0) + 1
    }
    for (const row of Array.isArray(data.barriers) ? data.barriers : []) {
      const key = isObj(row) ? str(row.key) : undefined
      if (key && isObj(row) && Array.isArray(row.notReturned)) barriers.push({key, notReturned: row.notReturned.filter((ref): ref is string => typeof ref === 'string' && !!ref)})
    }
    cursor = data.nextCursor ?? null
    if (!cursor) break
  }
  // An attempt of a unit on a later page than its leg still counts for it.
  for (const [unit, count] of Object.entries(tried)) if (legs[unit]) legs[unit] = {...legs[unit], attempts: count}
  return {legs, barriers}
}

/** What the chain read: the Run shown, its Journey (null when the Run belongs to none), each of the Journey's Runs by ref (its reading,
 * or Factory's refusal), and the shown Run's inspection (or Factory's refusal of it; absent where none was asked). */
export interface RunJourneyRead {
  readonly run: unknown
  readonly journey: unknown | null
  readonly runs: Readonly<Record<string, {readonly value?: unknown; readonly error?: string}>>
  readonly inspection?: {readonly value?: RunInspection; readonly error?: string}
}

/** Read the chain: the Run, its owning Journey, the Journey's Runs, and the Run's inspection. Throws Factory's refusal of the Run or of
 * the Journey. */
export async function readRunJourney(transport: KernelTransportStatus, statePath: string, runRef: string): Promise<RunJourneyRead> {
  const run = await developmentReading(transport, statePath, 'run', runRef)
  // The Run's units, asked once the Run answered and read beside its Journey; a refusal is kept, never thrown.
  const inspecting = readRunInspection(transport, statePath, runRef).then(value => ({value}), cause => ({error: cause instanceof Error ? cause.message : String(cause)}))
  const journeyRef = isObj(run) && Array.isArray(run.owningJourneyRefs) ? run.owningJourneyRefs.find((ref): ref is string => typeof ref === 'string' && !!ref) : undefined
  if (!journeyRef) return {run, journey: null, runs: {}, inspection: await inspecting}
  const journey = await developmentReading(transport, statePath, 'journey', journeyRef)
  const refs = isObj(journey) && Array.isArray(journey.runRefs) ? journey.runRefs.filter((ref): ref is string => typeof ref === 'string' && !!ref) : []
  const runs = Object.fromEntries(await Promise.all(refs.map(async ref => {
    if (ref === runRef) return [ref, {value: run}] as const
    try { return [ref, {value: await developmentReading(transport, statePath, 'run', ref)}] as const }
    catch (cause) { return [ref, {error: cause instanceof Error ? cause.message : String(cause)}] as const }
  })))
  return {run, journey, runs, inspection: await inspecting}
}

/** The Journey as the design reads it ({purpose, status, runs: [{ref, lifecycle?, attempts?, recognised?}]}), from the chain's readings.
 * A Run is recognised when one of its Returns names a Recognition, or a Recognition names one of its Returns; not recognised when it has
 * Returns and none is; and says nothing when it has no Return. Null when the Run belongs to no Journey or the reading is not a Journey's.
 * Pure. */
export function journeyOf(read: RunJourneyRead): Record<string, unknown> | null {
  const journey = read.journey
  if (!isObj(journey) || journey.contract !== 'factory.journey-reading/v1') return null
  const commission = isObj(journey.commission) ? journey.commission : {}
  const returns = (Array.isArray(journey.returns) ? journey.returns : []).filter(isObj)
  const recognised = new Set((Array.isArray(journey.recognitions) ? journey.recognitions : []).flatMap(link => (isObj(link) && str(link.subject_ref) ? [String(link.subject_ref)] : [])))
  const refs = Array.isArray(journey.runRefs) ? journey.runRefs.filter((ref): ref is string => typeof ref === 'string' && !!ref) : []
  const runs = refs.map(ref => {
    const reading = read.runs[ref]?.value
    const lifecycle = isObj(reading) ? str(reading.lifecycle) : undefined
    const attempts = isObj(reading) && isObj(reading.nativeAttempts) && Array.isArray(reading.nativeAttempts.attempts) ? reading.nativeAttempts.attempts.length : undefined
    const mine = returns.filter(row => Array.isArray(row.run_refs) && row.run_refs.includes(ref))
    const yes = mine.some(row => !!str(row.recognition_ref) || (!!str(row.return_ref) && recognised.has(String(row.return_ref))))
    return {ref, ...(lifecycle ? {lifecycle} : {}), ...(attempts !== undefined ? {attempts} : {}), ...(mine.length ? {recognised: yes} : {})}
  })
  return {...(str(commission.purpose) ? {purpose: commission.purpose} : {}), ...(str(journey.status) ? {status: journey.status} : {}), runs}
}

/** The Journey of the Run shown, held for the window (owners/ownerCall.ts useHeldRead: read again on the spine's epoch and after a write).
 * Nothing is asked without a Run and its state. */
export function useRunJourney(transport: KernelTransportStatus, statePath: string | null, runRef: string | null) {
  return useHeldRead<RunJourneyRead>(statePath && runRef ? ['run-journey', transport, statePath, runRef] : null, () => readRunJourney(transport, statePath!, runRef!))
}
