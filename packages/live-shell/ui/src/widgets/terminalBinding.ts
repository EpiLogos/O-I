// The Terminal on its owner (lane W4; DLW §17.9, widgets:terminal — "born on the rail"; Kind: instrument). Its owner is the shell host's
// terminal: a real PTY (desktop/cradle/src-tauri/src/terminal.rs) that only the surface holding its lease reads and writes — the
// Workbench's Terminal surface (desktop/cradle/src/terminal/TerminalSurface.tsx, mounted by cradle surface/Workbench.tsx for a pane of
// kind `terminal`, which the candidate's Workbench opens: native/Workbench.tsx). The surface publishes what it holds
// (terminal/terminalReadings.ts), and the device reads the newest terminal attached. It stands on the rail (its widget, the rail's
// Terminal tile) and in a pane (its Full), never on a chain.
//
// What the owner reports, by key:
//   folder    the folder terminal_attach answered (the host's launch directory, or the process's last observed one)
//   command   the carried command; '' for the login shell
//   exited    whether the process ended (terminal_poll `eof`); light: lit while it runs, dark once it exited
//   fontSize, scrollback   the xterm's own options as the surface set them (12 px, 5000 lines at start)
//   lines     the lines the xterm keeps now
//   watch     whether keys reach the shell (the surface's stdin gate)
// The writes go through the same surface: Text size (the xterm refits, and the host resizes the PTY: terminal_resize), Scrollback, Watch.
// What nothing reports, each absent with what it waits for (the design's own keys, widgets__terminal.tsx): `rooms` (the rooms of the
// workcell's session space, each with its screen: the surface publishes its PTY's folder, command, process and line count, never the screen's
// text, and no provider room list reaches the shell), `selected` and `shell` (the room of the run you select, the room you pinned: the PTY host
// keys a terminal by its surface, not by a session), `provider` and `answers` (which provider gives the room, and whether it answers: the
// surface is this computer's own PTY, and no provider is read), Follow. Folder and Command name the terminal that runs; a new one starts in
// the Workbench (New Terminal). Pure.
import type {DesignBinding, Standing, Value, Values} from '../frame/devices/designed'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import type {TerminalEntry} from '../../../../../desktop/cradle/src/terminal/terminalReadings'

export const TERMINAL_DESIGN = 'widgets:terminal'
/** The Terminal on the door, which is also its design's key (frame/devices/designs.ts designKey). */
export const TERMINAL_ID = TERMINAL_DESIGN

/** The Terminal as the runtime holds it: born on the rail, no rows of its own (its design draws on the binding's keys). */
export function terminalDevice(): DeviceInstance {
  return {id: TERMINAL_ID, family: 'widgets', rows: [], values: {},
    face: {id: 'terminal', title: 'Terminal', icon: 'keys', liveSemantic: 'device-instrument',
      note: 'The newest Terminal surface the Workbench opened: its PTY host\'s folder, command, process and lines, through the surface that holds the lease (desktop/cradle/src/terminal/terminalReadings.ts).',
      invariant: {generatesAbsent: 'Born on the rail: it reads its owner and draws what the owner reports; nothing it shows is filled in.'}}}
}

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`
const unread = (what: string, op: string, owner: string) => `${what}: no reading reaches it yet — missing op: ${op} (${owner}).`

/** The rail's Terminal tile when no terminal runs: where one starts. */
export const NO_TERMINAL = 'No terminal is open. Open one in the Workbench (New Terminal), and its shell stands here.'

/** The readings nothing reports, each with what it waits for. */
export const TERMINAL_ABSENT = {
  selected: unread('The shell of the session you select', 'a terminal per session (the PTY host keys each terminal by its surface)', 'Desktop shell host'),
  shell: unread('The room you pinned', 'the rooms of the workcell\'s session space, each by its provider\'s id (the PTY host keys a terminal by its surface)', 'Desktop shell host'),
  rooms: unread('The rooms and their screens', 'the rooms of the workcell\'s session space with each room\'s last lines (terminalReadings.ts publishes the PTY\'s folder, command, process and line count, never the screen\'s text)', 'Desktop shell host'),
  provider: unread('The provider that gives the room', 'which provider (herdr, tmux, cmux or this terminal) holds the room the surface shows (the surface attaches this computer\'s own PTY and names no provider)', 'Desktop shell host'),
  answers: unread('Whether the provider answers', 'a provider\'s own health read (no provider is read; the PTY\'s own end is `exited`)', 'Desktop shell host'),
} as const

/** The controls no owner operation carries, each with the operation it lacks. */
export const TERMINAL_REFUSE = {
  follow: missing('Follow', 'a terminal per session, to move to the shell of the session you select (the PTY host keys each terminal by its surface)', 'Desktop shell host'),
  shell: missing('Pin a room', 'the rooms of the workcell\'s session space to choose among (the PTY host keys a terminal by its surface)', 'Desktop shell host'),
  folder: 'Folder: a running shell keeps its folder; a new shell starts in the Workbench (New Terminal), in the project\'s folder.',
  command: 'Command: a running shell keeps what it started with; a new shell starts in the Workbench (New Terminal).',
} as const

/** The Terminal's values from the newest terminal's reading, or none when no terminal runs. */
export function terminalValues(entry: TerminalEntry | null): Values {
  if (!entry) return {}
  const {reading} = entry
  const values: Record<string, Value> = {
    light: reading.exited ? 'dark' : 'lit',
    folder: reading.cwd,
    command: reading.command ?? '',
    exited: reading.exited,
    fontSize: reading.fontSize,
    scrollback: reading.scrollback,
    lines: reading.lines,
    watch: reading.watch,
  }
  return values
}

const whole = (value: Value, low: number, high: number): number | null => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.round(Math.min(high, Math.max(low, n))) : null
}

/** The Terminal's binding: the newest terminal's readings; Text size, Scrollback and Watch written through its surface; Follow, the shell
 * shown, Folder and Command refused in words; every absent reading with what it waits for. Null when no terminal runs (the rail says
 * where one starts: NO_TERMINAL). */
export function terminalBinding(entry: TerminalEntry | null): DesignBinding | null {
  if (!entry) return null
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries({...TERMINAL_ABSENT, ...TERMINAL_REFUSE}).map(([key, why]) => [key, {disabled: why}]))
  return {
    id: TERMINAL_ID,
    values: terminalValues(entry),
    standing,
    writes: key => key === 'fontSize' || key === 'scrollback' || key === 'watch' || key in TERMINAL_REFUSE,
    write: async changes => {
      for (const {key, value} of changes) {
        if (key === 'fontSize') {
          const px = whole(value, 6, 40)
          if (px === null) throw Error('Text size is a number of pixels.')
          entry.hand.fontSize(px)
          continue
        }
        if (key === 'scrollback') {
          const lines = whole(value, 0, 1_000_000)
          if (lines === null) throw Error('Scrollback is a number of lines.')
          entry.hand.scrollback(lines)
          continue
        }
        if (key === 'watch') {
          if (typeof value !== 'boolean') throw Error('Watch is on or off.')
          entry.hand.watch(value)
          continue
        }
        throw Error(TERMINAL_REFUSE[key as keyof typeof TERMINAL_REFUSE] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
