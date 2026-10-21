/* What each open Terminal surface reads from its PTY host, and the hand it offers (lane W4; DLW §17.9 Terminal). Only the surface that
 * holds a terminal's lease can read or write its PTY (src-tauri/src/terminal.rs: terminal_poll, terminal_input, terminal_resize and
 * terminal_checkpoint each take the lease terminal_attach issued), so the surface publishes here what it holds — the folder the host
 * started it in and how the host stands that folder, the carried command, whether the process exited, whether the host restored an
 * archived reading, the xterm's text size and scrollback, the lines it keeps, whether keys reach the shell — and the device that reads a
 * terminal (live-shell widgets/terminalBinding.ts) writes back through the same surface: the text size (the xterm refits and the host
 * resizes the PTY: terminal_resize), the scrollback, and Watch (the xterm's stdin gate, so no key reaches terminal_input). */
export interface TerminalReading {
  /** The surface binding's id: the PTY host keys the terminal by it. */
  readonly id: string
  readonly title: string
  /** The folder terminal_attach answered, and how the host stands it (launch-directory | last-observed-process-cwd). */
  readonly cwd: string
  readonly cwdStanding: string | null
  /** The carried command, or null for the login shell. */
  readonly command: string | null
  readonly exited: boolean
  readonly archived: boolean
  readonly fontSize: number
  readonly scrollback: number
  /** The lines the xterm keeps now (its active buffer's length). */
  readonly lines: number
  /** Keys do not reach the shell (the hand's Watch). */
  readonly watch: boolean
  /** The order the surfaces attached in: the newest stands first. */
  readonly attachedAt: number
}

/** The surface's own hand on its xterm and PTY. */
export interface TerminalHand {
  readonly fontSize: (px: number) => void
  readonly scrollback: (lines: number) => void
  readonly watch: (on: boolean) => void
}

export interface TerminalEntry {readonly reading: TerminalReading; readonly hand: TerminalHand}

const entries = new Map<string, TerminalEntry>()
const listeners = new Set<() => void>()
let snapshot: readonly TerminalEntry[] = []
let order = 0

function changed(): void {
  snapshot = [...entries.values()].sort((a, b) => b.reading.attachedAt - a.reading.attachedAt)
  for (const listener of [...listeners]) listener()
}

/** The next attach order. */
export const nextAttachOrder = (): number => ++order

/** A surface's reading and hand, published again whenever either moves. */
export function publishTerminal(reading: TerminalReading, hand: TerminalHand): void {
  entries.set(reading.id, {reading, hand})
  changed()
}

/** The surface retired: its terminal stands here no more. */
export function retireTerminal(id: string): void {
  if (entries.delete(id)) changed()
}

/** The open terminals, the newest attached first: the same array while nothing moves. */
export const terminalsNow = (): readonly TerminalEntry[] => snapshot

export function subscribeTerminals(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
