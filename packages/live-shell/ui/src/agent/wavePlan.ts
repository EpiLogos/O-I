// A task's plan, as Factory keeps it (O-I #741, OpenRig's planning dial and wave SDLC; Factory wave_sdlc.rs). The task's latest attempt
// names its Run and the workflow unit it works (factoryTakes.ts); Factory's plan of record for that Run (`factory development wave read`,
// factory.wave-reading/v1, through the kernel's factory_owner `wave-read`) says how much planning the unit gets and the wave it builds in:
//   - the planning dial: the unit's rung (P0 pointers · P1 spec · P2 research · P3 adversarial · P4 blind design), the reason it was set
//     with, the rounds the rung still needs before the plan locks, the rounds that returned, the territory it declares and its lock;
//   - the wave: its state (waiting · planning · building · in review · fix round · sealed · unread), what gates it and the next lawful
//     step, each in Factory's words, and the unit's ladder (plan locked, built, merged, reviewed), each rung with the basis Factory read.
// Every status is Factory's, derived when it reads; the shell draws it and adds none. The planner sets the rung with its reason; the
// person locks the plan (`factory development wave act` lock, through factory_owner `wave-act`, under the grant the host resolves), and
// Factory refuses a lock whose rung's rounds have not returned, in its words. Pure, apart from the hook at the end.
import {useEffect, useState} from 'react'
import type {Value} from '../frame/devices/designed'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {factoryOwnerWrite} from './devices/ownerRoutes'
import type {FactoryTake} from './factoryTakes'

/** Factory's reading of a Run's plan (Factory wave_sdlc.rs). */
export const WAVE_READING = 'factory.wave-reading/v1'

/** The Run and unit a task's plan is read for: its latest attempt's. */
export interface PlanTarget {
  readonly statePath: string
  readonly runRef: string
  readonly unitRef: string
}

/** The rung's name in a person's words (Factory's `asks` says what it asks). */
export const RUNG_WORD: Readonly<Record<string, string>> = {P0: 'Pointers', P1: 'Spec', P2: 'Research', P3: 'Adversarial', P4: 'Blind design'}
const ROUND_WORD: Readonly<Record<string, string>> = {research: 'Research', adversarial: 'Adversarial pass', 'blind-design': 'Blind design', 'design-session': 'Design session'}
const STATE_WORD: Readonly<Record<string, string>> = {waiting: 'Waiting', planning: 'Planning', building: 'Building', 'in-review': 'In review', 'fix-round': 'Fix round',
  sealed: 'Sealed', unread: 'Unread'}
const LADDER: readonly (readonly [string, string])[] = [['locked', 'Plan locked'], ['built', 'Built'], ['merged', 'Merged'], ['reviewed', 'Reviewed']]

const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const roundWords = (rounds: unknown): string => list(rounds).map(round => ROUND_WORD[String(round)] ?? String(round)).join(', ')

/** The task's latest attempt that names its unit by Factory's own ref: the Run and unit its plan is read for. Pure. */
export function planTargetOf(takes: readonly FactoryTake[] | null | undefined): PlanTarget | null {
  for (const take of [...(takes ?? [])].reverse()) {
    if (take.unitRef && take.runRef && take.statePath) return {statePath: take.statePath, runRef: take.runRef, unitRef: take.unitRef}
  }
  return null
}

/** What the plan panel reads, or why nothing is read. */
export type PlanReading = {readonly state: 'read'; readonly reading: Record<string, unknown>; readonly target: PlanTarget} | {readonly state: 'absent'; readonly why: string}

export const PLAN_NO_TAKE = 'No plan is read: the task has no attempt that names its Run and workflow unit, so Factory is asked for none (a task\'s plan is its unit\'s, in its Run\'s plan of record).'
export const PLAN_READING = 'Factory is reading the plan of the task\'s Run.'
export const PLAN_NOT_HERE = 'No plan is read here: no sessions provider reads the session\'s attempts.'

/** The kernel op as the read calls it. */
export type PlanCall = (op: Record<string, unknown>) => Promise<{error?: string; outcome?: {result: string; data?: unknown} | null}>
const carried = (transport: KernelTransportStatus): PlanCall => op =>
  kernelOp(transport, op as Parameters<typeof kernelOp>[1]) as unknown as ReturnType<PlanCall>

/** One read of a Run's plan through the kernel. Factory's reading, or why there is none in Factory's words. */
export async function readWavePlan(call: PlanCall, target: PlanTarget): Promise<PlanReading> {
  const read = await call({op: 'factory_owner', request: {kind: 'wave-read', state_path: target.statePath, run_ref: target.runRef}})
  if (read.error) return {state: 'absent', why: `Factory did not read the Run's plan: ${read.error}`}
  const data = object(read.outcome?.result === 'factory_development_reading' ? read.outcome.data : null)
  if (data?.schema !== WAVE_READING) return {state: 'absent', why: `Factory answered no plan reading (${WAVE_READING}): the Factory installed here may predate the planning dial.`}
  return {state: 'read', reading: data, target}
}

/** The unit's row in the reading, and its wave's. */
function unitOf(reading: Record<string, unknown>, unitRef: string): {unit: Record<string, unknown> | null; wave: Record<string, unknown> | null} {
  const unit = list(reading.units).map(object).find(row => row?.workflow_unit_ref === unitRef) ?? null
  const waveId = text(unit?.wave)
  const wave = waveId ? list(reading.waves).map(object).find(row => row?.wave === waveId) ?? null : null
  return {unit, wave}
}

/** Why a key of the plan has no reading, or null where it has one. Pure. */
export function planWhy(plan: PlanReading | null): string | null {
  if (!plan) return PLAN_NOT_HERE
  if (plan.state === 'absent') return plan.why
  const {unit} = unitOf(plan.reading, plan.target.unitRef)
  return unit ? null : `No plan is set for the task's unit: Factory's plan of ${plan.target.runRef} holds no rung for ${plan.target.unitRef}. The planner sets one with its reason (factory development wave act, dial).`
}

/** The plan's values on the design's keys (clip:factory, the Plan panel). A key with no reading is left out. Pure. */
export function planValuesOf(plan: PlanReading | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (!plan || plan.state !== 'read') return values
  const {unit, wave} = unitOf(plan.reading, plan.target.unitRef)
  if (!unit) return values
  const dial = object(unit.dial)
  const rung = text(dial?.rung)
  if (rung) values.plan = rung
  const put = (key: string, value: string | null) => { if (value !== null) values[key] = value }
  put('plan.asks', text(dial?.asks))
  put('plan.why', text(dial?.reason))
  put('plan.territory', list(dial?.territory).map(String).join(', ') || null)
  const lock = object(dial?.lock)
  if (lock) put('plan.locked', `${text(lock.rung) ?? rung ?? ''} · by ${text(object(lock.by)?.actor_ref) ?? 'someone unnamed'}`)
  else values['plan.needs'] = list(dial?.needs).length ? roundWords(dial?.needs) : 'Nothing: the rung\'s rounds have returned.'
  values['plan.rounds'] = JSON.stringify(list(dial?.rounds).map(object).filter(Boolean).map((round, i) => ({
    id: `r${i}`, name: ROUND_WORD[String(round!.round)] ?? String(round!.round),
    note: [text(round!.verdict), text(object(round!.by)?.actor_ref)].filter(Boolean).join(' · '),
    does: [text(round!.evidence_ref), ...list(round!.amendments).map(String).map(item => `amends: ${item}`)].filter(Boolean).join('; '),
  })))
  if (wave) {
    const state = text(wave.state)
    put('wave', `${text(wave.wave) ?? ''} · ${state ? STATE_WORD[state] ?? state : ''}`)
    put('wave.gate', text(wave.gate))
    put('wave.next', text(wave.next))
  } else values.wave = 'In no wave yet'
  const ladder = object(unit.ladder)
  values.ladder = JSON.stringify(LADDER.map(([key, name]) => {
    const rungRead = object(ladder?.[key])
    return {id: key, name, value: text(rungRead?.value) ?? 'unknown', why: text(rungRead?.basis) ?? ''}
  }))
  return values
}

/** What Clip view holds of a task's plan: Factory's reading of it, and the person's Lock. */
export interface PlanPort {
  readonly reading: PlanReading
  readonly lock: () => Promise<void>
}

/** Every key the Plan panel draws or sets (clip:factory). */
export const PLAN_READ_KEYS = ['plan', 'plan.asks', 'plan.why', 'plan.territory', 'plan.needs', 'plan.locked', 'plan.rounds', 'wave', 'wave.gate',
  'wave.next', 'ladder'] as const
export const PLAN_KEYS = [...PLAN_READ_KEYS, 'plan.lock', 'plan.rounds.page'] as const

/** The rung is the planner's: Clip view reads it and never turns it. */
export const RUNG_SET_BY_PLANNER = 'The rung is the planner\'s, set with its reason through Factory (`factory development wave act`, dial): Clip view reads it and never turns it.'

/** The plan's wiring on the clip: what each key reads, why one is absent, Lock where Factory may be asked, and each refusal. Pure. */
export function planWiring(port: PlanPort | null): {
  reads: Record<string, string>; absent: Record<string, string>; acts: Record<string, () => Promise<void>>; refused: Record<string, string>; view: Record<string, string>
} {
  const why = planWhy(port?.reading ?? null)
  const reads: Record<string, string> = {
    plan: 'Factory\'s plan of the task\'s Run (factory development wave read): the unit\'s rung, P0 pointers · P1 spec · P2 research · P3 adversarial · P4 blind design',
    'plan.asks': 'Factory\'s words for what the rung asks of the plan', 'plan.why': 'the reason the planner set the rung with, as Factory keeps it',
    'plan.territory': 'the files the unit declares, which its candidates keep inside', 'plan.needs': 'the rounds Factory reads the rung still needs before the plan locks',
    'plan.locked': 'the lock Factory keeps on the plan: its rung and who locked it', 'plan.rounds': 'the planning rounds that returned: research, adversarial pass, blind design, design session, each with who ran it and its evidence',
    wave: 'the wave the unit builds in, and its state as Factory derives it now', 'wave.gate': 'what holds the wave where it stands, in Factory\'s words',
    'wave.next': 'the next lawful step, in Factory\'s words', ladder: 'the unit\'s ladder as Factory reads it now: plan locked, built, merged, reviewed, each with its basis',
  }
  const refused: Record<string, string> = {plan: RUNG_SET_BY_PLANNER}
  const acts: Record<string, () => Promise<void>> = {}
  const row = port?.reading.state === 'read' ? unitOf(port.reading.reading, port.reading.target.unitRef).unit : null
  const locked = object(object(row?.dial)?.lock)
  if (why || !port) refused['plan.lock'] = why ?? PLAN_NOT_HERE
  else if (locked) refused['plan.lock'] = `The plan is locked at ${text(locked.rung) ?? 'its rung'} by ${text(object(locked.by)?.actor_ref) ?? 'someone unnamed'}: a lock is never rewritten.`
  else acts['plan.lock'] = port.lock
  return {
    reads,
    absent: why ? Object.fromEntries(PLAN_READ_KEYS.map(key => [key, why])) : {},
    acts,
    refused,
    view: {'plan.rounds.page': 'the page of planning rounds Clip view shows'},
  }
}

/** Lock the plan as the person (factory_owner `wave-act`): Factory admits it, or refuses in its words, which the press shows. */
export async function lockPlan(transport: KernelTransportStatus, target: PlanTarget): Promise<void> {
  await factoryOwnerWrite(transport, {kind: 'wave-act', state_path: target.statePath,
    request: {act: 'lock', run_ref: target.runRef, workflow_unit_ref: target.unitRef}}, '`factory development wave act` lock')
}

/** The task's plan, read once per Run and unit, and again after a lock. */
export function useWavePlan(transport: KernelTransportStatus, target: PlanTarget | null): {readonly plan: PlanReading; readonly reread: () => void} {
  const key = target ? JSON.stringify([transport, target.statePath, target.runRef, target.unitRef]) : null
  const [epoch, setEpoch] = useState(0)
  const [answer, setAnswer] = useState<{key: string; epoch: number; plan: PlanReading} | null>(null)
  useEffect(() => {
    if (!key || !target || transport.kind === 'unavailable') return
    let live = true
    void readWavePlan(carried(transport), target).then(plan => { if (live) setAnswer({key, epoch, plan}) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, epoch])
  const reread = () => setEpoch(n => n + 1)
  if (!target) return {plan: NO_TAKE, reread}
  if (transport.kind === 'unavailable') return {plan: {state: 'absent', why: `Factory is not reached: ${transport.reason ?? 'the shell has no kernel carrier'}.`}, reread}
  // The last answer stands until the next arrives, so the plan never flickers to unread between reads.
  return {plan: answer?.key === key ? answer.plan : READING, reread}
}

const NO_TAKE: PlanReading = {state: 'absent', why: PLAN_NO_TAKE}
const READING: PlanReading = {state: 'absent', why: PLAN_READING}
