import {tellOwnerChanged} from '../owners/notices'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

export type HarnessAgentControl = 'new' | 'stop' | 'restart' | 'pause' | 'resume'

/** The conversation operations AIKit's gateway takes that change a binding (`aikit gateway agent --binding <REF> <OP>`, aikit-cli
 * cli.rs GatewayAgentArgs, gateway_ops.rs conversation_operation), as the kernel's harness_agent_control carries them: the lifecycle
 * controls above, and `model`, the one that carries a value (`--model <ID>`). AIKit has no other value-carrying conversation operation —
 * no effort, approvals, transport, stall, steer or prompt — so none is declared here. */
export type HarnessAgentCall = {op: 'harness_agent_control'; binding: string; control: HarnessAgentControl | 'model'; model?: string}

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
  call: HarnessAgentCall,
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
  // The control changed the harness's sessions (new, stop, resume, restart, model): on its receipt the agency readers are
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

/** The binding's harness model, selected through AIKit's own operation (`aikit gateway agent --binding B model --model ID`, the
 * kernel's harness_agent_control `model`). The receipt is the gateway's own answer or refusal, verbatim. */
export async function harnessAgentModel(
  transport: KernelTransportStatus,
  binding: string,
  model: string,
  invoke?: KernelInvoke,
): Promise<{ok: true; note: string; document: unknown} | {ok: false; error: string}> {
  return controlOutcome(transport, {op: 'harness_agent_control', binding, control: 'model', model}, invoke)
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

/** The sender kinds AIKit's gateway rules by (aikit-adapters gateway_connector.rs SenderKind), and what a rule decides. */
export type IngressSenderKind = 'human' | 'agent' | 'bot' | 'system' | 'unknown'
export type IngressDecision = 'allow' | 'pair' | 'deny'

/** Who of one kind may reach a gateway binding's conversation (§19.12 Asks, Calls to other agents): AIKit's ingress rule by sender kind
 * (`aikit gateway ingress --binding B --kind K --decision D`; no decision clears it, and the binding's one default decides again), through
 * the kernel's harness_ingress_rule. AIKit's answer, or its refusal in its words, thrown. */
export async function harnessIngressRule(
  transport: KernelTransportStatus,
  binding: string,
  kind: IngressSenderKind,
  decision: IngressDecision | null,
  invoke?: KernelInvoke,
): Promise<unknown> {
  if (transport.kind === 'unavailable') throw new Error(transport.reason ?? 'Native transport unavailable')
  const call = {op: 'harness_ingress_rule' as const, binding, kind, decision}
  const outcome = invoke ? await invoke(transport, call) : await kernelOp(transport, call)
  if (outcome.error) throw new Error(outcome.error)
  if (outcome.outcome?.result !== 'harness_ingress_outcome') throw new Error(`AIKit did not answer the ingress rule: ${outcome.outcome?.result ?? 'no result named'}`)
  return outcome.outcome.document
}
