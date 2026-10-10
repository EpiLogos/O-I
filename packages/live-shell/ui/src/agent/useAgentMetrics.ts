import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

/** One raw `encounter_task_read` for a session — the model consumes this
 * shape directly. `null` is the honest absence: no task is bound. */
export async function readEncounterTask(transport: KernelTransportStatus, project: string, sessionRef: string): Promise<{reading: unknown} | {error: string}> {
  if (transport.kind === 'unavailable') return {error: transport.reason ?? 'Transport unavailable'}
  const result = await kernelOp(transport, {op: 'encounter_task_read', project, agent_session: sessionRef})
  if (result.error || result.outcome?.result !== 'encounter_task_reading') {
    return {error: result.error ?? 'AIKit did not return a task reading'}
  }
  return {reading: result.outcome.data ?? null}
}

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

export function useAgentMetrics(transport: KernelTransportStatus, sessionRef: string | null) {
  const [tokensIn, setTokensIn] = useState<string>('—')
  const [tokensOut, setTokensOut] = useState<string>('—')
  const [spend, setSpend] = useState<number | null>(null)
  const [budgetUsed, setBudgetUsed] = useState<number | null>(null)
  const [budgetCap, setBudgetCap] = useState<number | null>(null)
  const [position, setPosition] = useState('— . — . —')

  useEffect(() => {
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable' || !sessionRef) {
        if (live) {
          setTokensIn('—')
          setTokensOut('—')
          setSpend(null)
          setBudgetUsed(null)
          setBudgetCap(null)
          setPosition('— . — . —')
        }
        return
      }
      const outcome = await readEncounterTask(transport, 'O-I', sessionRef)
      if (!live) return
      if ('error' in outcome || !outcome.reading) {
        setTokensIn('—')
        setTokensOut('—')
        setSpend(null)
        setBudgetUsed(null)
        setBudgetCap(null)
        setPosition('— . — . —')
      } else {
        const data = outcome.reading as Record<string, unknown>
        const usage = data.usage as Record<string, unknown> | undefined
        const inTok = usage?.tokens_in ?? data.tokens_in
        const outTok = usage?.tokens_out ?? data.tokens_out
        setTokensIn(inTok === undefined ? '—' : String(inTok))
        setTokensOut(outTok === undefined ? '—' : String(outTok))
        const cap = usage?.spend_cap ?? data.spend_cap
        const fill = usage?.spend_fill ?? data.spend_fill
        setSpend(typeof fill === 'number' ? fill : typeof cap === 'number' ? cap : null)
        const budget = budgetFromReading(data)
        setBudgetUsed(budget.used)
        setBudgetCap(budget.max)
        const taskIndex = data.task_index ?? data.task
        const turn = data.turn_index ?? data.turn
        const step = data.step_index ?? data.step
        setPosition([taskIndex, turn, step].every(value => value === undefined) ? '— . — . —' : `${taskIndex ?? '—'} . ${turn ?? '—'} . ${step ?? '—'}`)
      }
    })()
    return () => { live = false }
  }, [transport, sessionRef])

  return {tokensIn, tokensOut, spend, budgetUsed, budgetCap, position}
}
