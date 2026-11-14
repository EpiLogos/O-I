/** What AIKit's gateway can and cannot carry for a harness binding's rack (`aikit gateway agent --binding <REF> <OP>`, aikit-cli cli.rs
 * GatewayAgentArgs, gateway_ops.rs conversation_operation). One table, read by the dispatch (agentNativeDispatch.ts, which refuses these
 * keys before anything is sent) and by the device bindings (designBindings.ts, which stand their controls disabled with the same words).
 * No imports: the frame's first load carries it. */

/** The operations AIKit's gateway takes on a binding's conversation (`aikit gateway agent --binding B <OP>`, aikit-cli cli.rs
 * GatewayAgentArgs): the words the refusals below name. */
export const AIKIT_AGENT_OPS = 'status, stop, new, sessions, restart, pause, resume, model, harness, skills'

/** The rack settings a binding's conversation does not carry, each with AIKit's words for what owns it, or that nothing does (aikit-cli
 * gateway_ops.rs OWNED_ELSEWHERE, O-I 1006: `aikit gateway agent` refuses each with its owner, never as an unknown word). The Agent's
 * Effort and Scope's Tool calls are written by their owner where a chain holds the session's settings (sessionSettings.ts taskLevelOf). */
const OWNED_ELSEWHERE: Readonly<Record<string, {readonly what: string; readonly owner: string}>> = {
  transport: {what: 'Transport', owner: 'a binding\'s conversation has no transport of its own: the transport is the whole gateway\'s, its entry mode, chosen by `aikit gateway setup` (AIKit).'},
  approvals: {what: 'Tool calls (approvals)', owner: 'a harness\'s approvals are its own and read only; a session\'s answer to its requests to use a tool is its task\'s Tool calls (inherit, ask, session or always), which the Action aikit.session.settings writes (`task.set.tool_calls`): Scope\'s Tool calls, on its Asks page (AIKit).'},
  'stall-after': {what: 'Stall after', owner: 'no AIKit operation holds a stall-after: AIKit keeps no time without progress after which a session counts as stalled (AIKit).'},
  effort: {what: 'Effort', owner: 'a session\'s Effort for its task is the task\'s Effort envelope (inherit, low, medium, high or max), played into the harness\'s own reasoning effort, which the Action aikit.session.settings writes (`task.set.effort`): the Agent\'s Effort, on a chain that holds the session\'s settings (AIKit).'},
  input: {what: 'Input (steer or queue)', owner: 'input goes with each Communique, not with the conversation: the Action aikit.gateway.send takes it as `handling`, queue or steer (AIKit); the window\'s words reach the agent as its conversation\'s next turn through its encounter\'s one send, which takes none.'},
}

/** The rack settings AIKit's gateway has no operation for and AIKit names no owner of, by row key: refused before anything is sent,
 * naming the missing operation. */
const NO_AIKIT_OP: Readonly<Record<string, string>> = {
  'interrupt-quantize': 'Interrupt timing',
  'steer-line': 'A steer line into the running turn',
  'new-task': 'A new task\'s words (`new` carries none)',
  'auto-continue': 'Auto-continue',
  'fan-out': 'Fan-out',
}

/** Why a harness row's key cannot be set through a binding's conversation: AIKit's words for what owns it (no operation is missing — its
 * owner is elsewhere), or the operation AIKit's gateway lacks; undefined where the gateway carries it. The shell stands the control
 * disabled with these words rather than pressing it only to be refused. */
export function harnessKeyUncarried(key: string): {reason: string; missingOp?: string} | undefined {
  const owned = OWNED_ELSEWHERE[key]
  if (owned) return {reason: `${owned.what}: ${owned.owner}`}
  const what = NO_AIKIT_OP[key]
  if (!what) return undefined
  return {
    reason: `${what}: AIKit's gateway has no operation that carries it — \`aikit gateway agent\` takes ${AIKIT_AGENT_OPS}, and only \`model\` takes a value.`,
    missingOp: `aikit gateway agent: no operation for ${key} (AIKit)`,
  }
}
