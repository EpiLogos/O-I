/** The tool bridge — the write-path grammar's `<tool>:<command>` arm made
 * dispatchable (the P0 work order's WO-0.2 ligament).
 *
 * The audit found zero dispatch sites for the declared tool paths
 * (`workcell-cli:git commit`, `ctrl:…`, `aikit:…`, `oi:…`) — honest
 * placeholders awaiting this bridge. Port law: this module COMPOSES with
 * the tool-execution surface that exists — the shell host's terminal
 * (Tauri `terminal_attach`, a real bounded PTY: one program and its
 * arguments, validated and spawned in front of the person) — and builds no
 * second runner. Where that surface is not reachable (the browser bundle,
 * no open terminal surface) the bridge refuses and NAMES what a real
 * runner needs — the aperture law's honest refusal, never a fake fire.
 *
 * Receipt per dispatch: the command's own output as the receipt, the
 * runner's error as a named refusal. Pure grammar + injected runner; the
 * Tauri wiring is the default runner, testable through the injected one.
 *
 * Pure module: no view, no store; the registry-free dispatch needs no
 * admission state. */

import {detectTransport, tauriInvoke} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {DispatchReceipt} from '../inhabitants/sdk/shellSetters.ts'

/** The parsed `<tool>:<command>` grammar — the same shape the gate's
 * `isWritePath` admits: one known tool, one command word, plain args. */
export interface ToolCommand {
  readonly tool: string
  readonly argv: readonly string[]
  /** The verbatim write path this parse came from. */
  readonly writePath: string
}

export function parseToolCommand(writePath: string): ToolCommand | {error: string} {
  const at = writePath.indexOf(':')
  if (at <= 0) return {error: `writePath "${writePath}" is not a <tool>:<command> path`}
  const tool = writePath.slice(0, at)
  const rest = writePath.slice(at + 1).trim()
  if (!rest) return {error: `writePath "${writePath}" names no command`}
  const argv = rest.split(/\s+/)
  return {tool, argv, writePath}
}

/** What one dispatch needs to reach the real runner. `terminalSurfaceId`
 * names an OPEN terminal surface of the workspace (the Tauri terminal
 * refuses a carried command without one — "Open the terminal surface
 * first"); `cwd` grounds the command. Absent surface = the honest refusal,
 * not a hidden fallback. */
export interface ToolRunContext {
  readonly terminalSurfaceId?: string
  readonly cwd?: string
}

/** The runner interface: the real channel (Tauri terminal) or the test
 * double. A runner resolves when the command finished; its receipt is the
 * command output, its refusal the runner's own error. */
export type ToolRunner = (command: ToolCommand, context: ToolRunContext) => Promise<
  {ok: true; output: string} | {ok: false; error: string}
>

/** The real runner: the shell host's terminal surface, composed — attach a
 * carried command to the open terminal, poll until the child exits, return
 * the output. Guarded: no Tauri channel → refusal naming the channel; no
 * surface id → refusal naming the surface (the Tauri terminal's own law). */
export const terminalToolRunner: ToolRunner = async (command, context) => {
  if (detectTransport().kind !== 'tauri') {
    return {
      ok: false,
      error: 'No tool runner is admitted in this context: the terminal surface runs only in the Tauri shell host. '
        + 'A device-side tool dispatch needs the shell host (tauri) or a kernel tool-dispatch op — neither exists in the browser bundle.',
    }
  }
  if (!context.terminalSurfaceId) {
    return {
      ok: false,
      error: 'The terminal runner needs an open terminal surface: open a terminal in the workspace, then dispatch — '
        + 'the terminal owner admits carried commands only on an existing surface (its own guard: "Open the terminal surface first").',
    }
  }
  try {
    const attachment = await tauriInvoke<{lease: number} | string>('terminal_attach', {
      id: context.terminalSurfaceId,
      cwd: context.cwd ?? null,
      command: [...command.argv],
      dimensions: {Kind: 'Physical', width: 80, height: 24},
    })
    if (typeof attachment === 'string' || !attachment || typeof attachment.lease !== 'number') {
      return {ok: false, error: `The terminal refused the carried command: ${typeof attachment === 'string' ? attachment : 'no lease returned'}`}
    }
    // Poll until the surface reports the child's exit (eof), bounded.
    const deadline = Date.now() + 30_000
    let output = ''
    let seq = 0
    for (;;) {
      const batch = await tauriInvoke<{snapshot?: string; base?: number; eof?: boolean; closed?: boolean}>('terminal_poll', {
        id: context.terminalSurfaceId, lease: attachment.lease, seq,
      })
      if (typeof batch?.snapshot === 'string' && batch.snapshot.length > output.length) output = batch.snapshot
      if (typeof batch?.base === 'number') seq = batch.base
      if (batch?.eof || batch?.closed) break
      if (Date.now() > deadline) return {ok: false, error: 'The carried command outlived the bridge\'s 30 s bound — read its output on the terminal surface.'}
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    return {ok: true, output: output.trim()}
  } catch (cause) {
    return {ok: false, error: `The terminal runner refused: ${cause instanceof Error ? cause.message : String(cause)}`}
  }
}

/** Dispatch one `<tool>:<command>` write path. The receipt is uniform with
 * the other channels' (DispatchReceipt) so the refusal/reading card
 * grammar renders every channel alike. */
export async function dispatchToolCommand(
  writePath: string,
  context: ToolRunContext = {},
  runner: ToolRunner = terminalToolRunner,
): Promise<DispatchReceipt> {
  const parsed = parseToolCommand(writePath)
  if ('error' in parsed) {
    return {kind: 'refused', channel: 'tool', writePath, reason: parsed.error}
  }
  const outcome = await runner(parsed, context)
  if (!outcome.ok) {
    return {kind: 'refused', channel: 'tool', writePath, reason: outcome.error}
  }
  return {
    kind: 'fired', channel: 'tool', writePath,
    note: `${parsed.tool} ${parsed.argv.slice(1).join(' ')} → ${outcome.output.slice(0, 400) || '(no output)'}`,
    outcome: outcome.output,
  }
}
