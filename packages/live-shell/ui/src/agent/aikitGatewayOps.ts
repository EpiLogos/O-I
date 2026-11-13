/** What AIKit's gateway can and cannot carry for a harness binding's rack (`aikit gateway agent --binding <REF> <OP>`, aikit-cli cli.rs
 * GatewayAgentArgs, gateway_ops.rs conversation_operation). One table, read by the dispatch (agentNativeDispatch.ts, which refuses these
 * keys before anything is sent) and by the device bindings (designBindings.ts, which stand their controls disabled with the same words).
 * No imports: the frame's first load carries it. */

/** The operations AIKit's gateway takes on a binding's conversation (`aikit gateway agent --binding B <OP>`, aikit-cli cli.rs
 * GatewayAgentArgs): the words the refusals below name. */
export const AIKIT_AGENT_OPS = 'status, stop, new, sessions, restart, pause, resume, model, harness, skills'

/** The rack settings AIKit's gateway has no operation for, by row key: refused before anything is sent, naming the missing operation.
 * A control that reads one of these stands disabled with the same words (harnessKeyUncarried). */
const NO_AIKIT_OP: Readonly<Record<string, string>> = {
  transport: 'Transport',
  approvals: 'Tool calls (approvals)',
  'stall-after': 'Stall after',
  effort: 'Effort',
  'interrupt-quantize': 'Interrupt timing',
  input: 'Input (steer or queue)',
  'steer-line': 'A steer line into the running turn',
  'new-task': 'A new task\'s words (`new` carries none)',
  'auto-continue': 'Auto-continue',
  'fan-out': 'Fan-out',
}

/** Why a harness row's key cannot be set, where AIKit's gateway has no operation for it; undefined where it has one. The shell stands the
 * control disabled with these words rather than pressing it only to be refused. */
export function harnessKeyUncarried(key: string): {reason: string; missingOp: string} | undefined {
  const what = NO_AIKIT_OP[key]
  if (!what) return undefined
  return {
    reason: `${what}: AIKit's gateway has no operation that carries it — \`aikit gateway agent\` takes ${AIKIT_AGENT_OPS}, and only \`model\` takes a value.`,
    missingOp: `aikit gateway agent: no operation for ${key} (AIKit)`,
  }
}

