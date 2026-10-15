import {tellOwnerChanged} from '../owners/notices'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

export type HarnessAgentControl = 'new' | 'stop' | 'restart' | 'pause' | 'resume'

/** The value carrier the gateway rows' values ride (the P0 ligament's
 * kernel patch: new-shell/evidence/agent-native-p0-20261011/kernel-control-value-carriers.patch).
 * The patch extends `harness_agent_control` with a `configure` control
 * carrying these fields; every field is optional and the gateway judges
 * each. Against the UNPATCHED kernel this dispatch returns the kernel's own
 * unknown-variant refusal — named, verbatim, never faked. The fields are
 * the work order's exact list (WO-0.3) plus the two text carriers the
 * agent-chain rows need (steer text, the new-task prompt). */
export interface HarnessAgentControlValue {
  transport?: 'stdio' | 'ws' | 'remote'
  approvals?: 'ask' | 'session' | 'always'
  stall_after_seconds?: number
  connect?: boolean
  effort?: 'low' | 'medium' | 'high' | 'max'
  model?: string
  quantize?: 'now' | 'next tool' | 'next turn'
  input_mode?: 'steer' | 'queue'
  steer?: string
  prompt?: string
}

/** The extended wire shape the patch introduces. Declared here (not
 * imported from kernel/types.ts) because the patch file, not this tree,
 * carries the kernel type — this module is the shell-side declaration
 * consuming it, and the cast at the dispatch boundary is the ONE place the
 * patch's landing is awaited. */
export interface HarnessAgentConfigureCall {
  op: 'harness_agent_control'
  binding: string
  control: 'configure'
  value: HarnessAgentControlValue
}

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

/** The kernel call, injectable: the dispatch tests capture the payload at
 * this boundary (the value ARRIVES, or the kernel's own refusal comes
 * back); production leaves it unset and the real bridge carries the call. */
export type KernelInvoke = (
  transport: KernelTransportStatus,
  op: {op: string; [field: string]: unknown},
) => Promise<{outcome: {result?: string; document?: unknown} | null; error?: string}>

async function controlOutcome(
  transport: KernelTransportStatus,
  call: {op: 'harness_agent_control'; binding: string; control: string; value?: HarnessAgentControlValue},
  invoke?: KernelInvoke,
): Promise<{ok: true; note: string; document: unknown} | {ok: false; error: string}> {

  if (transport.kind === 'unavailable') {
    return {ok: false, error: transport.reason ?? 'Native transport unavailable'}
  }
  const outcome = invoke
    ? await invoke(transport, call)
    : await kernelOp(transport, call as Parameters<typeof kernelOp>[1])
  if (outcome.error) return {ok: false, error: outcome.error}
  if (outcome.outcome?.result !== 'harness_agent_outcome') {
    return {ok: false, error: `Unexpected harness control outcome: ${outcome.outcome?.result ?? 'no result named'}`}
  }
  // The control changed the harness's sessions (new, stop, resume, restart, configure): on its receipt the agency readers are
  // told, rather than waiting for the agency floor (owners/notices.ts).
  tellOwnerChanged({topic: 'agency', cause: `a harness control: ${String(call.control)}`})
  return {ok: true, note: controlLine(String(call.control), outcome.outcome.document), document: outcome.outcome.document}
}

export async function harnessAgentControl(
  transport: KernelTransportStatus,
  binding: string,
  control: HarnessAgentControl,
): Promise<{ok: true; note: string; document?: unknown} | {ok: false; error: string}> {
  const outcome = await controlOutcome(transport, {op: 'harness_agent_control', binding, control})
  // The owner's outcome document rides folded — surfaces that receipt their
  // operation (the chain drop) fold it; the note stays the one-line summary.
  return outcome.ok ? {ok: true, note: outcome.note, document: outcome.document} : outcome
}

/** The value-carrying control (ligament 3's shell half): one configure
 * dispatch carrying the gateway/agent rows' values. The receipt is the
 * gateway's own answer or refusal, verbatim. */
export async function harnessAgentConfigure(
  transport: KernelTransportStatus,
  binding: string,
  value: HarnessAgentControlValue,
  invoke?: KernelInvoke,
): Promise<{ok: true; note: string; document: unknown} | {ok: false; error: string}> {
  return controlOutcome(transport, {op: 'harness_agent_control', binding, control: 'configure', value}, invoke)
}

/** Fire a bare lifecycle control and return the owner's outcome document —
 * the task-control row's fire path (the union carries all five controls
 * today; the play/stop transport slots dispatch resume/stop through it). */
export async function harnessAgentControlOutcome(
  transport: KernelTransportStatus,
  binding: string,
  control: HarnessAgentControl,
  invoke?: KernelInvoke,
): Promise<{ok: true; note: string; document: unknown} | {ok: false; error: string}> {
  return controlOutcome(transport, {op: 'harness_agent_control', binding, control}, invoke)

}
