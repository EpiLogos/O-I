/** The ligaments' fire path — a declared binding or row, resolved to its
 * owner operation and dispatched with a receipt (lane zcode:agent-native-p0,
 * 2026-10-11).
 *
 * Port law: ONE dispatch path, composing the channels that exist — the
 * kernel's harness control (`harnessAgentControl`/`harnessAgentModel`),
 * the shell's armed setters (`sdk/shellSetters.ts` registry), and the tool
 * bridge (`toolBridge.ts`). No second dispatch system: the §14 row's
 * `writePath` decides the channel, and every channel answers in the SAME
 * receipt shape (`DispatchReceipt`), so the UI's refusal/reading grammar
 * renders them alike.
 *
 * Aperture law: where the owner operation cannot carry the value (a rack
 * setting AIKit's `gateway agent` has no operation for; heartbeat whose
 * owner is the cron stratum; write-arm whose enforcement owner is Factory
 * receiving), the dispatch refuses before anything is sent, naming the
 * missing op — the kernel's own refusal verbatim where the kernel answers.
 * Never a fake fire.
 *
 * Pure of views: the transport/binding context arrives injected, so the
 * whole path is testable without a kernel. */

import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {DispatchReceipt} from '../inhabitants/sdk/shellSetters.ts'
import {shellSetter} from '../inhabitants/sdk/shellSetters.ts'
import {allTransportBindings, sdkParamRows, transportBindingForSlot, transportBindingRow, type SdkParamRow} from '../inhabitants/sdk/define.ts'
import type {SdkModeName} from '../inhabitants/sdk/modes.ts'
import {harnessAgentControlOutcome, harnessAgentModel, type HarnessAgentControl, type KernelInvoke} from './harnessAgentControl.ts'
import {dispatchToolCommand, type ToolRunContext} from './toolBridge.ts'
import {AIKIT_AGENT_OPS, harnessKeyUncarried} from './aikitGatewayOps.ts'

export {harnessKeyUncarried}

/** Everything a dispatch needs to reach its owner: the kernel transport,
 * the harness binding (which gateway/session the control addresses), the
 * tool runner's context (an open terminal surface, when one is), and —
 * for tests — the kernel call itself, so a capture can prove the value
 * arrives at the dispatch boundary. */
export interface DispatchContext {
  readonly transport: KernelTransportStatus
  readonly binding: string
  readonly tool?: ToolRunContext
  readonly invoke?: KernelInvoke
}

export {allTransportBindings}

/** The bare lifecycle controls the harness control union carries — the task-control row's values, dispatched without any value. */
const BARE_CONTROLS: readonly HarnessAgentControl[] = ['new', 'stop', 'restart', 'pause', 'resume']

/** Dispatch one §14 row's writePath with a value. This is the single
 * resolver every caller shares (transport slots, device controls, tests). */
export async function fireWritePath(row: SdkParamRow, value: unknown, ctx: DispatchContext): Promise<DispatchReceipt> {
  const writePath = row.writePath
  if (!writePath) {
    return {
      kind: 'refused', channel: 'none', writePath: '(none)',
      reason: `The row ${row.family}/${row.deviceInstance}/${row.key} is a reading — it declares no writer.`,
    }
  }
  if (writePath.startsWith('shell.')) {
    const dispatch = shellSetter(writePath)
    if (!dispatch) {
      return {
        kind: 'refused', channel: 'shell', writePath,
        reason: `The row is armed at the gate but the shell has not registered the setter "${writePath}" — its owner wires it when it adopts the kit.`,
        missingOp: writePath,
      }
    }
    return dispatch(value)
  }
  if (writePath.startsWith('kernel:')) {
    return fireKernelRow(row, value, ctx)
  }
  // <tool>:<command> — the tool bridge (the Tauri terminal surface is the
  // real runner; the bridge refuses honestly where it is unreachable).
  return dispatchToolCommand(writePath, ctx.tool ?? {})
}

/** EXPORTED for the setter bridge: a registered setter IS the shell
 * channel's terminal — it dispatches the harness semantics for its KEY
 * directly (never re-entering fireWritePath, which would recurse through
 * the registry). The key semantics are the SAME map the kernel channel
 * runs: AIKit's operations, and the honest refusals for keys it has none
 * for. */
export async function fireHarnessControlByKey(key: string, value: unknown, ctx: DispatchContext, writePath = 'kernel:harness_agent_control'): Promise<DispatchReceipt> {
  return fireHarnessKey(key, value, ctx, writePath)
}

/** The kernel channel: `kernel:harness_agent_control` dispatches by the
 * row key's grammar — AIKit's own operations, and the honest refusals for
 * keys AIKit has no operation for. Any OTHER kernel op
 * on a row refuses (no dispatch grammar is invented here). */
async function fireKernelRow(row: SdkParamRow, value: unknown, ctx: DispatchContext): Promise<DispatchReceipt> {
  const writePath = row.writePath!
  if (writePath !== 'kernel:harness_agent_control') {
    return {
      kind: 'refused', channel: 'kernel', writePath,
      reason: `No dispatch grammar maps "${writePath}" to a payload — the row declares the op, the payload shape is its owner's to land.`,
      missingOp: writePath,
    }
  }
  return fireHarnessKey(row.key, value, ctx, writePath)
}

/** The harness-control key semantics — ONE map, shared by the kernel
 * channel and the registered setters. */
async function fireHarnessKey(key: string, value: unknown, ctx: DispatchContext, writePath: string): Promise<DispatchReceipt> {
  // Heartbeat: the toggle's owner is the cron stratum (§15.3) — a cadence,
  // not a harness control. No carrier pretends otherwise.
  if (key === 'heartbeat') {
    return {
      kind: 'refused', channel: 'kernel', writePath,
      reason: 'Heartbeat is presentation-state: its owner op is the cron-stratum cadence (WO-A3) — the gateway\'s check-in schedule. No harness control carries it; scheduling it shell-side would be a family scheduler, which §15 forbids.',
      missingOp: 'kernel/actuation: the cron-stratum heartbeat cadence (WO-A3)',
    }
  }
  // Write arm: the toggle's enforcement owner is Factory receiving + the
  // world devices' apply path (WO-SF2). The value stays presentation-state.
  if (key === 'write-mode') {
    return {
      kind: 'refused', channel: 'kernel', writePath,
      reason: 'Write arm is presentation-state: no shell write flow reads it yet. Its owner op is the world devices\' apply path gating proposals vs direct-with-receipt (WO-SF2, Factory receiving) — enforcement, not this toggle, is the honest wiring moment.',
      missingOp: 'kernel/software-factory: write-arm enforcement on the device apply path (WO-SF2)',
    }
  }
  // A new task with words: AIKit's `new` forks a fresh turn context and carries no words, so the words are refused, never dropped.
  if (key === 'new-task' && typeof value === 'string' && value.trim()) {
    const uncarried = harnessKeyUncarried('new-task')!
    return {kind: 'refused', channel: 'kernel', writePath, reason: `${uncarried.reason} The task's words would be dropped: AIKit's \`new\` carries no words.`, missingOp: uncarried.missingOp}
  }
  // The bare lifecycle controls: dispatch exactly the control word.
  if (key === 'task-control' || key === 'new-task') {
    const control = (key === 'new-task' ? 'new' : String(value)) as HarnessAgentControl
    if (!BARE_CONTROLS.includes(control)) {
      return {
        kind: 'refused', channel: 'kernel', writePath,
        reason: `"${String(value)}" is not one of the control union's verbs (${BARE_CONTROLS.join(' | ')}).`,
      }
    }
    return kernelReceipt(writePath, await harnessAgentControlOutcome(ctx.transport, ctx.binding, control, ctx.invoke))
  }
  // Connect: the binding's connector ingress — AIKit's `resume` admits it again, `pause` stops admitting it.
  if (key === 'connect') {
    if (typeof value !== 'boolean') return {kind: 'refused', channel: 'kernel', writePath, reason: `Connect takes on or off, not "${String(value)}".`}
    return kernelReceipt(writePath, await harnessAgentControlOutcome(ctx.transport, ctx.binding, value ? 'resume' : 'pause', ctx.invoke))
  }
  // Model: AIKit's `model --model <ID>`, the harness's native model selector.
  if (key === 'model') {
    if (typeof value !== 'string' || !value.trim()) return {kind: 'refused', channel: 'kernel', writePath, reason: 'Model: choose a model first.'}
    return kernelReceipt(writePath, await harnessAgentModel(ctx.transport, ctx.binding, value.trim(), ctx.invoke))
  }
  const uncarried = harnessKeyUncarried(key)
  if (uncarried) return {kind: 'refused', channel: 'kernel', writePath, ...uncarried}
  return {
    kind: 'refused', channel: 'kernel', writePath,
    reason: `The row key "${key}" has no operation in AIKit's gateway (\`aikit gateway agent\` takes ${AIKIT_AGENT_OPS}).`,
    missingOp: `aikit gateway agent: no operation for ${key} (AIKit)`,
  }
}

/** The harness answered, and its own document says it refused (`{refused: …}` — the shape the gateway reading uses, and the
 * control line renders as "Refused (…)"). An answer that refuses is not an acceptance: a receipt of it is a refusal, so the shell
 * flag behind the setter never moves for it (shellSetterBridge.ts moves it only on a fired receipt). */
function refusedDocument(document: unknown): string | null {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return null
  // AIKit's gateway answers a model select it cannot make as {result: {available: false, reason}} (a binding with no agent backing):
  // the gateway's own words, a refusal.
  const result = (document as {result?: unknown}).result
  if (result && typeof result === 'object' && (result as {available?: unknown}).available === false) {
    const reason = (result as {reason?: unknown}).reason
    return `AIKit's gateway: ${typeof reason === 'string' && reason ? reason : 'the operation is not available on this binding'}`
  }
  if (!('refused' in document)) return null
  const refused = (document as {refused: unknown}).refused
  if (typeof refused === 'string' && refused) return refused
  const message = refused && typeof refused === 'object' ? (refused as {message?: unknown}).message : undefined
  return typeof message === 'string' && message ? message : 'the harness refused the control'
}

/** Uniform kernel receipt: the harness's own answer line, or its refusal
 * verbatim. */
function kernelReceipt(
  writePath: string,
  outcome: {ok: true; note: string; document: unknown} | {ok: false; error: string},
): DispatchReceipt {
  if (outcome.ok) {
    const refusal = refusedDocument(outcome.document)
    if (refusal) return {kind: 'refused', channel: 'kernel', writePath, reason: refusal}
    return {kind: 'fired', channel: 'kernel', writePath, note: outcome.note, outcome: outcome.document}
  }
  return {kind: 'refused', channel: 'kernel', writePath, reason: outcome.error}
}

/** Fire one mode's transport slot: resolve the binding (row- or slot-
 * shaped), resolve its §14 row, dispatch the value. Undefined binding =
 * the slot is honestly unbound (the caller keeps its waiting state). */
export async function fireTransportSlot(
  mode: SdkModeName,
  slot: string,
  value: unknown,
  ctx: DispatchContext,
): Promise<{kind: 'unbound'} | {kind: 'receipt'; receipt: DispatchReceipt}> {
  const binding = transportBindingForSlot(mode, slot)
  if (!binding) return {kind: 'unbound'}
  const row = transportBindingRow(binding)
  if (!row) {
    return {
      kind: 'receipt',
      receipt: {
        kind: 'refused', channel: 'none', writePath: '(unresolved)',
        reason: `The binding ${binding.family} ${binding.mode}/${binding.row} → ${binding.face}/${binding.key} resolves no §14 row — the declaration and the rows have drifted; the gate should have refused it.`,
      },
    }
  }
  return {kind: 'receipt', receipt: await fireWritePath(row, value, ctx)}
}

/** The §14 rows one family carries (the disclosure surfaces' reader). */
export function familyParamRows(family: string): readonly SdkParamRow[] {
  return sdkParamRows(family as never)
}
