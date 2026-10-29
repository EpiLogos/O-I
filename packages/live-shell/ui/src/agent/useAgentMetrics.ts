import {useMemo} from 'react'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {useTaskAnswer} from '../owners/readers'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {projectOfSession} from './worldScope'

// The task record's one read is the shared answer's (owners/readers.ts `readTaskOf`, moved from here): every reader of a
// session's task record subscribes to it instead of asking the owner itself.

/** The session's turn budget, from whatever fields the reading actually
 * carries — nulls where the owner discloses none. */
export function budgetFromReading(data: unknown): {used: number | null; max: number | null} {
  if (!data || typeof data !== 'object') return {used: null, max: null}
  const record = data as Record<string, unknown>
  const turns = record.turns as Record<string, unknown> | undefined
  const used = turns?.used ?? record.turns_used
  const cap = turns?.cap ?? record.turn_budget ?? record.budget_cap
  return {
    used: typeof used === 'number' ? used : null,
    max: typeof cap === 'number' ? cap : null,
  }
}

const NO_METRICS = {tokensIn: '—', tokensOut: '—', spend: null, budgetUsed: null, budgetCap: null, position: '— . — . —'} as const

/** The metrics a task record discloses — nulls and dashes where it discloses none. Pure. */
export function metricsFromReading(reading: unknown): {tokensIn: string; tokensOut: string; spend: number | null; budgetUsed: number | null; budgetCap: number | null; position: string} {
  if (!reading || typeof reading !== 'object') return NO_METRICS
  const data = reading as Record<string, unknown>
  const usage = data.usage as Record<string, unknown> | undefined
  const inTok = usage?.tokens_in ?? data.tokens_in
  const outTok = usage?.tokens_out ?? data.tokens_out
  const cap = usage?.spend_cap ?? data.spend_cap
  const fill = usage?.spend_fill ?? data.spend_fill
  const budget = budgetFromReading(data)
  const taskIndex = data.task_index ?? data.task
  const turn = data.turn_index ?? data.turn
  const step = data.step_index ?? data.step
  return {
    tokensIn: inTok === undefined ? '—' : String(inTok),
    tokensOut: outTok === undefined ? '—' : String(outTok),
    spend: typeof fill === 'number' ? fill : typeof cap === 'number' ? cap : null,
    budgetUsed: budget.used,
    budgetCap: budget.max,
    position: [taskIndex, turn, step].every(value => value === undefined) ? '— . — . —' : `${taskIndex ?? '—'} . ${turn ?? '—'} . ${step ?? '—'}`,
  }
}

/** The selected session's metrics, from the shared task record (owners/readers.ts `useTaskAnswer`): the same answer the
 * sessions provider, the Factory chain and the dock read — one owner read between them, re-read when a notice reaches it. */
export function useAgentMetrics(transport: KernelTransportStatus, sessionRef: string | null) {
  // The session's own register (agent/worldScope.ts), as the provider reads its task record.
  const project = projectOfSession(useAgentSessionsOptional()?.rows ?? [], sessionRef)
  const {reading} = useTaskAnswer(transport, transport.kind === 'unavailable' ? null : sessionRef, project)
  return useMemo(() => reading.status === 'answered' ? metricsFromReading(reading.value) : NO_METRICS, [reading])
}
