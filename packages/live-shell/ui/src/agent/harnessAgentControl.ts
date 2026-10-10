import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

export type HarnessAgentControl = 'new' | 'stop' | 'restart' | 'pause' | 'resume'

/** A one-line named summary of a control outcome document — the fields the
 * owner actually discloses, never a JSON dump (the receipt belongs to the
 * reading surfaces, folded). */
function controlLine(control: string, doc: unknown): string {
  if (!doc || typeof doc !== 'object') return `${control} acknowledged`
  const record = doc as Record<string, unknown>
  if ('refused' in record) {
    const refused = record.refused
    const reason = typeof refused === 'object' && refused && typeof (refused as Record<string, unknown>).message === 'string'
      ? (refused as Record<string, unknown>).message as string
      : typeof refused === 'string' ? refused : 'the harness refused the control'
    return `Refused (${control}) — ${reason}`
  }
  const named = ['state', 'status', 'control', 'binding', 'session_ref']
    .map(key => (typeof record[key] === 'string' || typeof record[key] === 'number') ? `${key} ${String(record[key])}` : null)
    .filter(Boolean)
  return named.length ? `${control} → ${named.join(' · ')}` : `${control} acknowledged`
}

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
    return {ok: false, error: `Unexpected harness control outcome: ${outcome.outcome?.result ?? 'no result named'}`}
  }
  return {ok: true, note: controlLine(control, outcome.outcome.document)}
}
