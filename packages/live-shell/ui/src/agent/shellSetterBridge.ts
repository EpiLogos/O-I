/** The shell setters' honest wiring — ligament 4 (WO-0.4) for lane
 * zcode:agent-native-p0, 2026-10-11.
 *
 * The audit's finding 4: `shell.setEffort/setSteer/setHeartbeat/
 * setWriteArm` armed presentation state only — the values provably reached
 * no harness, and the rows' COVERED status was true at the grammar and
 * misleading at the world level. This bridge closes that honestly, value
 * by value, each traced to its ACTUAL destination:
 *
 * - effort → the armed session's harness, through the value-carrying
 *   harness control (`configure {effort}` — the kernel patch). Local state
 *   stays (the control's own presentation); the harness answer or refusal
 *   comes back as the receipt. Until the carrier lands, the kernel's own
 *   unknown-variant refusal IS the honest state, verbatim.
 * - input (steer vs queue) → the same carrier, `{input_mode}`.
 * - quantize → the carrier, `{quantize}`; its consumption (stop/steer
 *   reading the armed timing) is WO-A5 and stays owner-named.
 * - heartbeat → NO dispatch: its owner is the cron stratum (§15.3 /
 *   WO-A3), a cadence the gateway owns — a shell toggle scheduling
 *   check-ins would be a family scheduler, which §15 forbids. The value
 *   stays presentation-state and the dispatch refuses naming that owner.
 * - write arm → NO dispatch: no shell write flow reads it yet; its owner
 *   is the device apply path gating proposals vs direct-with-receipt
 *   (WO-SF2, Factory receiving). Presentation-state, refusal names it.
 *
 * The registration runs where the agent shell mounts its transport (the
 * hook below); tests register the same dispatchers directly. Registry
 * shape and receipt vocabulary are the SDK's (`sdk/shellSetters.ts`) —
 * no second grammar. */

import {useEffect, useRef, useState} from 'react'
import type {DispatchReceipt} from '../inhabitants/sdk/shellSetters.ts'
import {registerShellSetter} from '../inhabitants/sdk/shellSetters.ts'
import {fireHarnessControlByKey, familyParamRows} from './agentNativeDispatch.ts'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {AgentShellState} from './AgentShellContext.tsx'

/** The rows the bridge's setters dispatch through — resolved from the kit
 * registries by (family, deviceInstance, key), so the dispatch always
 * carries the row's own declared writePath. */
function agentRow(family: string, key: string): ReturnType<typeof familyParamRows>[number] | undefined {
  return familyParamRows(family).find(row => row.deviceInstance === 'agent' && row.key === key)
    ?? familyParamRows(family).find(row => row.key === key)
}

export interface ShellSetterBridgeConfig {
  /** Reads the CURRENT transport/binding at dispatch time (the harness the
   * value should reach), not a mount-time snapshot. */
  readonly transport: () => KernelTransportStatus
  readonly binding: () => string
  /** The agent shell state: the bridge keeps each control's presentation
   * true (the shell state remains the visible value) while the dispatch
   * runs beside it. */
  readonly shell: Pick<AgentShellState, 'setEffort' | 'setSteer' | 'setHeartbeat' | 'setWriteArm' | 'setQuantize'> & {
    quantize: AgentShellState['quantize']
  }
  /** Receipt sink — the transport's note line. */
  readonly onReceipt?: (receipt: DispatchReceipt) => void
  /** The kernel call, injectable (tests capture the payload here). */
  readonly invoke?: Parameters<typeof fireHarnessControlByKey>[2]['invoke']
}

/** Register the agent shell's setters into the SDK registry. Idempotent per
 * path (registration replaces); returns an unregister (tests use it). */
export function registerAgentShellSetters(config: ShellSetterBridgeConfig): () => void {
  const dispatchFor = async (family: string, key: string, presentation: () => void, value: unknown): Promise<DispatchReceipt> => {
    presentation()
    const row = agentRow(family, key)
    if (!row) {
      const receipt: DispatchReceipt = {
        kind: 'refused', channel: 'none', writePath: '(unresolved)',
        reason: `No §14 row for ${family}/agent/${key} — the setter refuses rather than dispatch past the grammar.`,
      }
      config.onReceipt?.(receipt)
      return receipt
    }
    // A registered setter IS the shell channel's terminal: dispatch the
    // harness-carrier semantics for its KEY directly — re-entering
    // fireWritePath would recurse through this very registry (the row's
    // writePath IS this setter). The key semantics are the dispatch's one
    // shared map, refusals included.
    const receipt = await fireHarnessControlByKey(key, value, {transport: config.transport(), binding: config.binding(), ...(config.invoke ? {invoke: config.invoke} : {})})
    config.onReceipt?.(receipt)
    return receipt
  }
  registerShellSetter('shell.setEffort', value => dispatchFor('actuation', 'effort', () => config.shell.setEffort(value as never), value))
  registerShellSetter('shell.setSteer', value => dispatchFor('actuation', 'input', () => config.shell.setSteer(value as never), value))
  registerShellSetter('shell.setQuantize', value => dispatchFor('actuation', 'interrupt-quantize', () => config.shell.setQuantize(value as never), value))
  registerShellSetter('shell.setHeartbeat', value => dispatchFor('actuation', 'heartbeat', () => config.shell.setHeartbeat(value as never), value))
  registerShellSetter('shell.setWriteArm', value => dispatchFor('software-factory', 'write-mode', () => config.shell.setWriteArm(value as never), value))
  return () => {}
}

/** The hook the agent shell's transport mounts: registers the setters with
 * the live transport/binding readers and keeps the latest receipt for the
 * note line. */
export function useShellSetterBridge(
  shell: Pick<AgentShellState, 'setEffort' | 'setSteer' | 'setHeartbeat' | 'setWriteArm' | 'setQuantize' | 'quantize'>,
  transport: KernelTransportStatus,
  binding: string,
): {receipt: DispatchReceipt | null} {
  const [receipt, setReceipt] = useState<DispatchReceipt | null>(null)
  const latest = useRef({transport, binding, shell})
  latest.current = {transport, binding, shell}
  useEffect(() => {
    registerAgentShellSetters({
      transport: () => latest.current.transport,
      binding: () => latest.current.binding,
      shell: latest.current.shell,
      onReceipt: setReceipt,
    })
  }, [])
  return {receipt}
}
