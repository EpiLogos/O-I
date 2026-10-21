// The Knowledge graph's Aperture page on its owner: Quaternal Logic's living-wiki plan (`plan_living_wiki_refraction`, crates/ql-wiki/src/
// living.rs; `ql wiki living-plan -`, QL-MEF #346), reached through the kernel's ql_read {kind: 'wiki-living-plan'} (desktop/cradle/kernel/
// src/owner_routes.rs QlRead::WikiLivingPlan, admitted on its profile). The plan is a computation, not a store: the request is the view's
// own (aperture.mode, aperture.positions, aperture.context, aperture.full, aperture.budget, held in the shell), and each new request is
// asked once. QL's answer gives the readings: aperture.admitted (the positions admitted, in order), aperture.omitted (those the budget left
// out), aperture.depth, and aperture.refraction (whether a refraction request stands in the plan: the shell sends none, so Formal is refused
// in QL's own words). The relevance QL does not infer: without a position, context, frame or budget held, the library's default stands.
// Pure apart from the one kernel call, which takes the call it is given, and the small store the views share.
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../../desktop/cradle/src/kernel/types'
import type {Value} from '../../frame/devices/designed'

export const LIVING_PLAN_PROFILE = 'ql-mef/living-wiki-refraction/v1'
/** The request's keys, the view's own. */
export const APERTURE_REQUEST = ['aperture.mode', 'aperture.positions', 'aperture.context', 'aperture.full', 'aperture.budget'] as const
/** The plan's readings. */
export const APERTURE_READINGS = ['aperture.admitted', 'aperture.omitted', 'aperture.depth', 'aperture.refraction'] as const
export const NO_MODE = 'Choose a mode: QL plans the aperture for the mode you choose (ordinary, explain or formal).'
const MODES = ['ordinary', 'explain', 'formal'] as const

export interface LivingPlanRequest {
  readonly mode: (typeof MODES)[number]
  readonly relevance?: {readonly relevant_positions: number[]; readonly requires_context: boolean; readonly full_context_frame: boolean; readonly position_budget: number}
}

const positionsOf = (value: Value | undefined): number[] | null => {
  if (value === undefined) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value
    return Array.isArray(parsed) && parsed.every(p => Number.isInteger(p)) ? parsed as number[] : null
  } catch { return null }
}

/** The request the held keys make, or why there is none. QL validates it again (positions 0..5, a budget that keeps the entry). */
export function livingPlanRequest(held: Readonly<Record<string, Value>>): {ok: true; request: LivingPlanRequest} | {ok: false; reason: string} {
  const mode = held['aperture.mode']
  if (typeof mode !== 'string' || !(MODES as readonly string[]).includes(mode)) return {ok: false, reason: NO_MODE}
  const positions = positionsOf(held['aperture.positions'])
  if (positions === null) return {ok: false, reason: 'The positions you name are a list of whole numbers.'}
  const named = ['aperture.positions', 'aperture.context', 'aperture.full', 'aperture.budget'].some(key => held[key] !== undefined)
  if (!named) return {ok: true, request: {mode: mode as LivingPlanRequest['mode']}}
  const budget = held['aperture.budget']
  // The library's own default budget is six (LivingWikiRelevance::default).
  return {ok: true, request: {mode: mode as LivingPlanRequest['mode'], relevance: {relevant_positions: positions, requires_context: held['aperture.context'] === true,
    full_context_frame: held['aperture.full'] === true, position_budget: typeof budget === 'number' ? Math.round(budget) : 6}}}
}

export interface LivingPlan {readonly admitted: number[]; readonly omitted: number[]; readonly depth: string; readonly refraction: boolean}
export type LivingPlanReading = {readonly ok: true; readonly plan: LivingPlan} | {readonly ok: false; readonly reason: string}

const ints = (x: unknown): x is number[] => Array.isArray(x) && x.every(p => Number.isInteger(p))

/** QL's plan, admitted on its profile and for the mode asked; else its refusal, in its words. */
export function readLivingPlan(answer: KernelOpCall, request: LivingPlanRequest): LivingPlanReading {
  if (answer.outcome == null) return {ok: false, reason: answer.error ?? 'Quaternal Logic did not answer `ql wiki living-plan`.'}
  const outcome = answer.outcome as {result?: string; data?: Record<string, unknown>}
  const data = outcome.data
  if (outcome.result !== 'owner_route_reading' || data?.profile !== LIVING_PLAN_PROFILE) return {ok: false, reason: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not QL's living-wiki plan.`}
  if (data.mode !== request.mode || !ints(data.positions) || !ints(data.omitted_relevant_positions) || typeof data.depth !== 'string')
    return {ok: false, reason: 'QL\'s plan answers another request, or carries no positions.'}
  return {ok: true, plan: {admitted: data.positions, omitted: data.omitted_relevant_positions, depth: data.depth, refraction: data.refraction !== undefined && data.refraction !== null}}
}

// ── the store the views share ───────────────────────────────────────────────

export interface LivingPlanState {readonly key: string | null; readonly reading: LivingPlanReading; readonly busy: boolean}
export type LivingPlanCall = (op: KernelOp) => Promise<KernelOpCall>
const INITIAL: LivingPlanState = {key: null, reading: {ok: false, reason: NO_MODE}, busy: false}
let state: LivingPlanState = INITIAL
let sequence = 0
let call: LivingPlanCall = op => kernelOp(detectTransport(), op)
const listeners = new Set<() => void>()
const setState = (next: LivingPlanState) => { state = next; for (const listener of [...listeners]) listener() }

export function livingPlanState(): LivingPlanState { return state }

/** Ask QL for the plan of the held request, once per request; only the newest answer stands. */
export async function syncLivingPlan(held: Readonly<Record<string, Value>>): Promise<void> {
  const asked = livingPlanRequest(held)
  if (!asked.ok) { if (state.key !== null || state.reading.ok || state.reading.reason !== asked.reason) setState({key: null, reading: {ok: false, reason: asked.reason}, busy: false}); return }
  const key = JSON.stringify(asked.request)
  if (key === state.key) return
  const ticket = ++sequence
  setState({key, reading: state.reading, busy: true})
  let reading: LivingPlanReading
  try {
    reading = readLivingPlan(await call({op: 'ql_read', request: {kind: 'wiki-living-plan', request: asked.request}}), asked.request)
  } catch (error) {
    reading = {ok: false, reason: `The kernel could not be asked for QL's plan: ${error instanceof Error ? error.message : String(error)}`}
  }
  if (ticket !== sequence) return
  setState({key, reading, busy: false})
}

/** Tests: start again, with another call. */
export function resetLivingPlan(next: {call?: LivingPlanCall} = {}): void {
  sequence++; state = INITIAL; call = next.call ?? (op => kernelOp(detectTransport(), op))
  for (const listener of [...listeners]) listener()
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The plan of the request the Aperture page holds. */
export function useLivingPlan(held: Readonly<Record<string, Value>> | undefined): LivingPlanState {
  const key = JSON.stringify(APERTURE_REQUEST.map(name => held?.[name] ?? null))
  useEffect(() => { void syncLivingPlan(held ?? {}) }, [key])
  return useSyncExternalStore(subscribe, livingPlanState, livingPlanState)
}

/** The plan's readings as the design's keys carry them. */
export function livingPlanValues(plan: LivingPlanState): Record<string, Value> {
  if (!plan.reading.ok) return {}
  const {admitted, omitted, depth, refraction} = plan.reading.plan
  return {'aperture.admitted': JSON.stringify(admitted), 'aperture.omitted': JSON.stringify(omitted), 'aperture.depth': depth, 'aperture.refraction': refraction}
}

/** Why the plan's readings are not drawn, or that they are QL's. */
export function livingPlanWhy(plan: LivingPlanState): string {
  return plan.reading.ok ? 'A reading: QL\'s plan for the request you hold; change the request to read another.' : plan.busy ? 'Asking QL for the plan…' : plan.reading.reason
}
