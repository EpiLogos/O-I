/** The ligaments' fire path — a declared binding or row, resolved to its
 * owner operation and dispatched with a receipt (lane zcode:agent-native-p0,
 * 2026-10-11).
 *
 * Port law: ONE dispatch path, composing the channels that exist — the
 * kernel's harness control (`harnessAgentControl`/`harnessAgentConfigure`),
 * the shell's armed setters (`sdk/shellSetters.ts` registry), and the tool
 * bridge (`toolBridge.ts`). No second dispatch system: the §14 row's
 * `writePath` decides the channel, and every channel answers in the SAME
 * receipt shape (`DispatchReceipt`), so the UI's refusal/reading grammar
 * renders them alike.
 *
 * Aperture law: where the owner operation cannot carry the value (the
 * gateway rows before the kernel patch lands; heartbeat whose owner is the
 * cron stratum; write-arm whose enforcement owner is Factory receiving),
 * the dispatch returns the honest refusal naming the missing op — the
 * kernel's own refusal verbatim where the kernel answers, the named owner
 * where the value has no carrier at all. Never a fake fire.
 *
 * Pure of views: the transport/binding context arrives injected, so the
 * whole path is testable without a kernel. */

import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {DispatchReceipt} from '../inhabitants/sdk/shellSetters.ts'
import {shellSetter} from '../inhabitants/sdk/shellSetters.ts'
import {allTransportBindings, sdkParamRows, transportBindingForSlot, transportBindingRow, type SdkParamRow} from '../inhabitants/sdk/define.ts'
import type {SdkModeName} from '../inhabitants/sdk/modes.ts'
import {harnessAgentConfigure, harnessAgentControlOutcome, type HarnessAgentControl, type HarnessAgentControlValue, type KernelInvoke} from './harnessAgentControl.ts'
import {dispatchToolCommand, type ToolRunContext} from './toolBridge.ts'

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

/** The row keys whose kernel values ride the value carrier (the P0
 * kernel patch's configure fields), keyed to the carrier field. A key
 * absent from both maps has no kernel dispatch grammar — refused, named. */
const CARRIER_FIELD_BY_KEY: Record<string, keyof HarnessAgentControlValue> = {
  transport: 'transport',
  approvals: 'approvals',
  'stall-after': 'stall_after_seconds',
  connect: 'connect',
  effort: 'effort',
  model: 'model',
  'interrupt-quantize': 'quantize',
  input: 'input_mode',
  'steer-line': 'steer',
}

/** The bare lifecycle controls the harness control union carries TODAY —
 * the task-control row's values, dispatched without any carrier. */
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
 * channel's terminal — it dispatches the harness-carrier semantics for its
 * KEY directly (never re-entering fireWritePath, which would recurse
 * through the registry). The key semantics are the SAME map the kernel
 * channel runs: bare lifecycle controls, carrier fields, and the honest
 * refusals for keys whose owner has no carrier. */
export async function fireHarnessControlByKey(key: string, value: unknown, ctx: DispatchContext, writePath = 'kernel:harness_agent_control'): Promise<DispatchReceipt> {
  return fireHarnessKey(key, value, ctx, writePath)
}

/** The kernel channel: `kernel:harness_agent_control` dispatches by the
 * row key's grammar — bare lifecycle controls, carrier values, and the
 * honest refusals for keys whose owner has no carrier. Any OTHER kernel op
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
  // The bare lifecycle controls: dispatch exactly the control word.
  if (key === 'task-control' || key === 'new-task') {
    if (key === 'new-task' && typeof value === 'string' && value.trim()) {
      // The task text rides the value carrier (the patch); the bare
      // 'new' that exists today cannot carry it.
      const outcome = await harnessAgentConfigure(ctx.transport, ctx.binding, {prompt: value}, ctx.invoke)
      return kernelReceipt(writePath, outcome)
    }
    const control = (key === 'new-task' ? 'new' : String(value)) as HarnessAgentControl
    if (!BARE_CONTROLS.includes(control)) {
      return {
        kind: 'refused', channel: 'kernel', writePath,
        reason: `"${String(value)}" is not one of the control union's verbs (${BARE_CONTROLS.join(' | ')}).`,
      }
    }
    const outcome = await harnessAgentControlOutcome(ctx.transport, ctx.binding, control, ctx.invoke)
    return kernelReceipt(writePath, outcome)
  }
  // The carrier fields: one configure dispatch carrying the value.
  const field = CARRIER_FIELD_BY_KEY[key]
  if (!field) {
    return {
      kind: 'refused', channel: 'kernel', writePath,
      reason: `The row key "${key}" has no carrier field in the value-carrying control — declare the field with the kernel patch, never a silent drop.`,
      missingOp: `kernel:harness_agent_control configure {${key}}`,
    }
  }
  const carrier: HarnessAgentControlValue = {[field]: value} as HarnessAgentControlValue
  const outcome = await harnessAgentConfigure(ctx.transport, ctx.binding, carrier, ctx.invoke)
  return kernelReceipt(writePath, outcome)
}

/** The harness answered, and its own document says it refused (`{refused: …}` — the shape the gateway reading uses, and the
 * control line renders as "Refused (…)"). An answer that refuses is not an acceptance: a receipt of it is a refusal, so the shell
 * flag behind the setter never moves for it (shellSetterBridge.ts moves it only on a fired receipt). */
function refusedDocument(document: unknown): string | null {
  if (!document || typeof document !== 'object' || Array.isArray(document) || !('refused' in document)) return null
  const refused = (document as {refused: unknown}).refused
  if (typeof refused === 'string' && refused) return refused
  const message = refused && typeof refused === 'object' ? (refused as {message?: unknown}).message : undefined
  return typeof message === 'string' && message ? message : 'the harness refused the control'
}

/** Uniform kernel receipt: the harness's own answer line, or its refusal
 * verbatim (the unknown-variant refusal of the unpatched kernel included —
 * that refusal IS the honest state until the carrier lands). */
function kernelReceipt(
  writePath: string,
  outcome: {ok: true; note: string; document: unknown} | {ok: false; error: string},
): DispatchReceipt {
  if (outcome.ok) {
    const refusal = refusedDocument(outcome.document)
    if (refusal) return {kind: 'refused', channel: 'kernel', writePath, reason: refusal}
    return {kind: 'fired', channel: 'kernel', writePath, note: outcome.note, outcome: outcome.document}
  }
  return {kind: 'refused', channel: 'kernel', writePath, reason: outcome.error, missingOp: outcome.error.includes('configure') ? 'kernel:harness_agent_control configure (the value-carrier patch)' : undefined}
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
