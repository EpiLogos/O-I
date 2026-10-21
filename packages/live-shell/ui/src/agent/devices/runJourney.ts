// The Journey a Run belongs to (lane W8; D3's Journey view on Runs, software-factory__attempt-review.tsx `journey`), read from Factory's
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

/** What the chain read: the Run shown, its Journey (null when the Run belongs to none), and each of the Journey's Runs by ref (its reading,
 * or Factory's refusal). */
export interface RunJourneyRead {
  readonly run: unknown
  readonly journey: unknown | null
  readonly runs: Readonly<Record<string, {readonly value?: unknown; readonly error?: string}>>
}

/** Read the chain: the Run, its owning Journey, the Journey's Runs. Throws Factory's refusal of the Run or of the Journey. */
export async function readRunJourney(transport: KernelTransportStatus, statePath: string, runRef: string): Promise<RunJourneyRead> {
  const run = await developmentReading(transport, statePath, 'run', runRef)
  const journeyRef = isObj(run) && Array.isArray(run.owningJourneyRefs) ? run.owningJourneyRefs.find((ref): ref is string => typeof ref === 'string' && !!ref) : undefined
  if (!journeyRef) return {run, journey: null, runs: {}}
  const journey = await developmentReading(transport, statePath, 'journey', journeyRef)
  const refs = isObj(journey) && Array.isArray(journey.runRefs) ? journey.runRefs.filter((ref): ref is string => typeof ref === 'string' && !!ref) : []
  const runs = Object.fromEntries(await Promise.all(refs.map(async ref => {
    if (ref === runRef) return [ref, {value: run}] as const
    try { return [ref, {value: await developmentReading(transport, statePath, 'run', ref)}] as const }
    catch (cause) { return [ref, {error: cause instanceof Error ? cause.message : String(cause)}] as const }
  })))
  return {run, journey, runs}
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
