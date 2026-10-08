import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

export type HarnessAgentControl = 'new' | 'stop' | 'restart' | 'pause' | 'resume'

export async function harnessAgentControl(
  transport: KernelTransportStatus,
  binding: string,
  control: HarnessAgentControl,
): Promise<{ok: true; note: string} | {ok: false; error: string}> {
  if (transport.kind === 'unavailable') {
    return {ok: false, error: transport.reason ?? 'Native transport unavailable'}
  }
  const outcome = await kernelOp(transport, {op: 'harness_agent_control', binding, control})
  if (outcome.error) return {ok: false, error: outcome.error}
  if (outcome.outcome?.result !== 'harness_agent_outcome') {
    return {ok: false, error: `Unexpected harness control outcome: ${JSON.stringify(outcome.outcome?.result ?? outcome.outcome)}`}
  }
  const doc = outcome.outcome.document
  const note = typeof doc === 'object' && doc && 'refused' in (doc as object)
    ? `Refused (${control}): ${JSON.stringify(doc).slice(0, 240)}`
    : `${control} → ${JSON.stringify(doc).slice(0, 240)}`
  return {ok: true, note}
}
