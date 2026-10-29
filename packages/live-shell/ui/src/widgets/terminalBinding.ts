// The Terminal on its owners (DLW §17.9, widgets:terminal — "born on the rail"; Kind: instrument; §10.1 "Where a session lives"; O-I #749).
// The Terminal shows a room of a session space. The room is not the Terminal's: AIKit keeps it, as a working-surface binding of a
// SessionSpace (`aikit.session-space-application/v1` `working_surfaces`, read in the agency reading's spaces, kernel op agency_read), and a
// provider shows it — tmux, herdr or cmux (the binding's `provider`, `provider/<technology>/current`; the name the plan gives the room is
// the label its provider shows, never who it is: the binding's ref is). The room's screen is the owner's capture of it, read without focus
// or input (kernel op working_surface_read → `aikit session-space working-surface capture`, kernel/src/working_surface.rs; ported from
// the cradle's Factory Computer view, desktop/cradle/src/contributions/factory/ComputerView.tsx, which reads the same op on the same
// cadence). A capture the provider refuses is the provider not answering: the Terminal says so in the provider's words and the room
// stays, with the last lines it showed. Keys reach a room only when the person sets Input to Type: the native takeover client
// (desktop/cradle/src-tauri/src/working_surface_lease.rs, through workingSurfaceClient.ts) attaches to the exact room the owner resolves,
// after the native confirmation, and Watch only releases it; the run goes on either way. A message to the agent never goes through here.
//
// This computer's own terminal is a provider too ("This terminal", §17.9 Provider): each Terminal surface the Workbench opens over the PTY
// host (desktop/cradle/src/terminal/TerminalSurface.tsx, src-tauri/src/terminal.rs) stands as a room of its own, as before: its folder,
// command, process and lines through the surface that holds its lease (terminal/terminalReadings.ts), and Text size, Scrollback and Watch
// written through that surface. The surface publishes no screen text, so its room's screen stays unread.
//
// Follow, the pinned room, Wrap and, for a session room, Text size and Scrollback are the Terminal's own holds (it "holds no settings
// that change the work"): kept by the rail's publisher and across a reopen (widgets/railDevices.tsx), never sent to an owner. Pure.
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
      note: 'A room of a session space: the room of the run you select, kept by AIKit and shown by its provider (tmux, herdr, cmux), or a terminal the Workbench opened on this computer.',
      invariant: {generatesAbsent: 'Born on the rail: it reads its owners and draws what they report; nothing it shows is filled in.'}}}
}

/** The rail's Terminal tile when no room stands and no terminal runs: where one comes from. */
export const NO_TERMINAL = 'No room stands: no session space holds a room for a run, and no terminal is open. A run\'s room appears here when AIKit binds one; open a terminal of your own in the Workbench (New Terminal).'

/** A room of a session space, as AIKit persists it: one working-surface binding. */
export interface SessionRoom {
  /** The binding's ref (`working-surface/…`): who the room is. */
  readonly id: string
  /** The name the room's plan gives it: the label its provider shows, never who it is. */
  readonly name: string
  readonly space: string
  /** The agent session whose room it is (`agent-session/…`). */
  readonly session: string
  /** The register the space was read under: '' your world's root register, else the project's name (agent/worldScope.ts). */
  readonly project: string
  /** The provider's technology (`provider/<technology>/…`): tmux, herdr, cmux or another place technology. */
  readonly provider: string
  /** What the plan starts in the room's pane, as its argv joined. */
  readonly command?: string
  /** The plan's root, where the room starts. */
  readonly folder?: string
  /** The agent whose run the room is, by the name the agency reading gives the session's track. */
  readonly agent?: string
}

/** The room a Workbench terminal stands as: this computer's own provider. */
export const LOCAL_ROOM_PREFIX = 'terminal:'
const localRoomId = (entry: TerminalEntry) => `${LOCAL_ROOM_PREFIX}${entry.reading.id}`

/** What the Terminal holds of its own, kept across a reopen. */
export interface TerminalHolds {
  /** Follows (true) the run you select, or Pinned (false) to `shell`. */
  readonly follow?: boolean
  /** The room you pinned, by its id. */
  readonly shell?: string
  readonly wrap?: boolean
  /** Text size and Scrollback for a session room (a Workbench terminal keeps its own, in its surface). */
  readonly fontSize?: number
  readonly scrollback?: number
}

/** The shown room's screen, as the owner last captured it. */
export interface RoomScreen {
  readonly room: string
  /** The screen's lines, the last capture that answered (kept while the provider does not answer). */
  readonly lines?: readonly string[]
  /** The provider's words when its last capture refused: it does not answer. */
  readonly refused?: string
  /** Keys reach the room now: the takeover lease is held. */
  readonly driving?: boolean
}

/** The hands the publisher gives the binding. */
export interface TerminalHands {
  /** Keep one of the Terminal's own holds. */
  readonly hold: (key: keyof TerminalHolds, value: Value | undefined) => void
  /** Take (true) or release (false) the room's keyboard through the takeover client. Rejects in the owner's words. */
  readonly type: (room: SessionRoom, on: boolean) => Promise<void>
  /** Send keys to the room whose keyboard is held. */
  readonly keys: (data: string) => Promise<void>
}

export interface TerminalInput {
  readonly rooms: readonly SessionRoom[]
  /** The Workbench's own terminals, newest first. */
  readonly locals: readonly TerminalEntry[]
  /** The run you select (its session), and the agency's words where none stands. */
  readonly followed: {readonly session: string | null; readonly words: string | null}
  readonly holds: TerminalHolds
  readonly screen: RoomScreen | null
  readonly hands: TerminalHands
  /** Whether the native takeover client stands (the desktop app's main window). */
  readonly native: boolean
}

const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const word = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? x : undefined)

/** The provider's technology from its ref: `provider/tmux/current` → `tmux`. */
export const providerWordOf = (ref: string): string => ref.split('/')[1] || ref

/** The argv the plan starts in the binding's pane (`plan_key` `<view>/<pane>`), joined. */
function commandOf(plan: Record<string, unknown>, key: string): string | undefined {
  const [view, pane] = key.split('/')
  for (const candidate of Array.isArray(plan.views) ? plan.views : []) {
    if (!rec(candidate) || candidate.id !== view) continue
    for (const step of Array.isArray(candidate.steps) ? candidate.steps : []) {
      if (rec(step) && step.pane === pane && Array.isArray(step.command)) return step.command.filter((part): part is string => typeof part === 'string').join(' ')
    }
  }
  return undefined
}

/** The rooms of the session spaces the agency reading carries (each row's unparsed space, `raw`): one room per working-surface binding,
 * each once however many sessions its space holds, its agent the name the agency reading gives the session's track. Pure. */
export function sessionRoomsOf(rows: readonly {readonly project?: string; readonly raw?: unknown}[],
  tracks: readonly {readonly sessionRef: string; readonly agentName: string | null}[]): SessionRoom[] {
  const rooms = new Map<string, SessionRoom>()
  for (const row of rows) {
    const space = row.raw
    if (!rec(space) || !rec(space.working_surfaces)) continue
    const spaceRef = rec(space.definition) ? word(space.definition.id) : undefined
    if (!spaceRef) continue
    for (const binding of Object.values(space.working_surfaces)) {
      if (!rec(binding)) continue
      const id = word(binding.binding), session = word(binding.agent_session), provider = word(binding.provider)
      if (!id || !session || !provider || rooms.has(id)) continue
      const plan = rec(binding.plan) ? binding.plan : {}
      const agent = tracks.find(track => track.sessionRef === session)?.agentName ?? undefined
      const command = commandOf(plan, word(binding.plan_key) ?? ''), folder = word(plan.root)
      rooms.set(id, {id, name: word(plan.name) ?? id, space: spaceRef, session, project: row.project ?? '', provider: providerWordOf(provider),
        ...(command !== undefined ? {command} : {}), ...(folder ? {folder} : {}), ...(agent ? {agent} : {})})
    }
  }
  return [...rooms.values()]
}

// CSI (ESC [ … final), OSC (ESC ] … BEL or ESC \), and the two-byte escapes; the capture's format is `ansi` (AIKit's capture).
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]|\r/g
/** A capture's text as the screen's lines: the escapes taken out (colour is not drawn here), the blank lines under the last one dropped. */
export function screenOf(text: string): string[] {
  const lines = text.replace(ANSI, '').split('\n')
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop()
  return lines
}

/** The Terminal's holds as kept between reopenings (localStorage, railDevices.tsx), read back with only what has a shape. */
export function holdsFrom(raw: string | null): TerminalHolds {
  try {
    const held: unknown = JSON.parse(raw ?? '{}')
    if (!rec(held)) return {}
    return {
      ...(typeof held.follow === 'boolean' ? {follow: held.follow} : {}), ...(word(held.shell) ? {shell: held.shell as string} : {}),
      ...(typeof held.wrap === 'boolean' ? {wrap: held.wrap} : {}),
      ...(Number.isFinite(held.fontSize) ? {fontSize: held.fontSize as number} : {}), ...(Number.isFinite(held.scrollback) ? {scrollback: held.scrollback as number} : {}),
    }
  } catch { return {} }
}

type Shown = {kind: 'session'; room: SessionRoom} | {kind: 'local'; entry: TerminalEntry}

/** The room the Terminal follows: the selected run's first room; with no run selected, the newest Workbench terminal. */
function followedRoomId(input: TerminalInput): string | undefined {
  const {session} = input.followed
  if (session) return input.rooms.find(room => room.session === session)?.id
  return input.locals[0] ? localRoomId(input.locals[0]) : undefined
}

/** The room the Terminal shows: the followed one, or the one pinned. */
function shownOf(input: TerminalInput): Shown | undefined {
  const id = input.holds.follow === false ? input.holds.shell : followedRoomId(input)
  if (!id) return undefined
  const room = input.rooms.find(candidate => candidate.id === id)
  if (room) return {kind: 'session', room}
  const entry = input.locals.find(candidate => localRoomId(candidate) === id)
  return entry ? {kind: 'local', entry} : undefined
}

const PROVIDER_WORDS: Record<string, string> = {herdr: 'herdr', tmux: 'tmux', cmux: 'cmux', terminal: 'This terminal'}
const providerName = (provider: string) => PROVIDER_WORDS[provider] ?? provider

/** Why keys cannot reach a session room from here. */
export const NO_TAKEOVER = 'Input: keys reach a room only through the desktop app\'s takeover client (working_surface_takeover), which this window does not have; the room is read here, Watch only.'
/** What the Terminal never changes in a session room. */
export const ROOM_REFUSE = {
  command: 'Command: the room\'s plan names what starts in it, and the plan is AIKit\'s (its session space); the Terminal does not change the room.',
  folder: 'Folder: the room starts where its plan\'s root says; the Terminal does not move it.',
} as const
/** What the Terminal never changes in a Workbench terminal that already runs. */
export const LOCAL_REFUSE = {
  command: 'Command: a running shell keeps what it started with; a new shell starts in the Workbench (New Terminal).',
  folder: 'Folder: a running shell keeps its folder; a new shell starts in the Workbench (New Terminal), in the project\'s folder.',
} as const

/** The defaults the manual gives the Terminal's own display (§17.9 Parameters), for a session room. */
export const ROOM_DISPLAY = {fontSize: 12, scrollback: 10000} as const

const whole = (value: Value | undefined, low: number, high: number): number | null => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.round(Math.min(high, Math.max(low, n))) : null
}

/** The Terminal's values and standing from its owners: every room (session rooms and the Workbench's terminals), the one shown with its
 * screen, provider and whether it answers, and the holds. A key no owner reports is absent, with its words where it waits. Pure. */
export function terminalValues(input: TerminalInput): {values: Values; standing: Record<string, Standing>} {
  const values: Record<string, Value> = {}, standing: Record<string, Standing> = {}
  const shown = shownOf(input), screen = shown?.kind === 'session' && input.screen?.room === shown.room.id ? input.screen : null
  const rooms = [
    // A room's screen stands only where it was read: the shown room's capture. Another room, and a Workbench terminal (its surface
    // publishes no text), carry no lines, and the design says so.
    ...input.rooms.map(room => ({id: room.id, name: room.name, ...(room.agent ? {agent: room.agent} : {}),
      ...(screen?.lines && room.id === screen.room ? {lines: screen.lines.map(t => ({t}))} : {})})),
    ...input.locals.map(entry => ({id: localRoomId(entry), name: `This terminal · ${entry.reading.cwd.split('/').filter(Boolean).pop() ?? entry.reading.cwd}`})),
  ]
  values.rooms = JSON.stringify(rooms)
  values.follow = input.holds.follow !== false
  values.wrap = input.holds.wrap !== false
  const followed = followedRoomId(input)
  if (followed) values.selected = followed
  else standing.selected = {disabled: input.followed.session ? 'The run you selected has no room in its session space: AIKit binds none for it.'
    : input.followed.words ?? 'No run is selected, and no terminal is open.'}
  if (input.holds.follow === false && input.holds.shell && rooms.some(room => room.id === input.holds.shell)) values.shell = input.holds.shell
  else if (input.holds.follow === false) standing.shell = {disabled: 'The room you pinned no longer stands in its session space.'}
  if (!shown) return {values, standing}
  if (shown.kind === 'local') {
    const {reading} = shown.entry
    Object.assign(values, {provider: 'terminal', answers: true, light: reading.exited ? 'dark' : 'lit', folder: reading.cwd, command: reading.command ?? '',
      exited: reading.exited, fontSize: reading.fontSize, scrollback: reading.scrollback, lines: reading.lines, watch: reading.watch})
    standing.command = {disabled: LOCAL_REFUSE.command}
    standing.folder = {disabled: LOCAL_REFUSE.folder}
    return {values, standing}
  }
  const {room} = shown
  values.provider = room.provider
  if (room.command !== undefined) values.command = room.command
  if (room.folder) values.folder = room.folder
  values.fontSize = input.holds.fontSize ?? ROOM_DISPLAY.fontSize
  values.scrollback = input.holds.scrollback ?? ROOM_DISPLAY.scrollback
  values.watch = !screen?.driving
  values.driving = !!screen?.driving
  standing.command = {disabled: ROOM_REFUSE.command}
  standing.folder = {disabled: ROOM_REFUSE.folder}
  if (!input.native) standing.watch = {disabled: NO_TAKEOVER}
  if (screen?.refused !== undefined) {
    values.answers = false
    values.light = 'dark'
    values.reason = `${providerName(room.provider)} does not answer: ${screen.refused}. The room stays${screen.lines ? '; its last lines are shown' : ''}.`
  } else if (screen?.lines) {
    values.answers = true
    values.light = 'lit'
  }
  if (screen?.lines) values.lines = screen.lines.length
  return {values, standing}
}

/** The Terminal's binding: its values from the owners; Follow, the pinned room, Wrap and a session room's display kept as its own
 * holds; Input taking or releasing a session room's keyboard (or a Workbench terminal's Watch); keys sent only while the keyboard is
 * held; Command and Folder refused in words. Null when no room stands and no terminal runs (the rail says where one comes from:
 * NO_TERMINAL). */
export function terminalBinding(input: TerminalInput): DesignBinding | null {
  if (!input.rooms.length && !input.locals.length) return null
  const {values, standing} = terminalValues(input)
  const shown = shownOf(input)
  const {hold, type, keys} = input.hands
  const display = (key: 'fontSize' | 'scrollback', low: number, high: number) => (value: Value | undefined) => {
    const n = whole(value, low, high)
    if (n === null) return
    if (shown?.kind === 'local') shown.entry.hand[key](n)
    else hold(key, n)
  }
  return {
    id: TERMINAL_ID,
    values,
    standing,
    local: {
      follow: value => hold('follow', value === false ? false : true),
      shell: value => { hold('shell', typeof value === 'string' ? value : undefined); if (typeof value === 'string') hold('follow', false) },
      selected: value => { if (typeof value === 'string') { hold('shell', value); hold('follow', false) } },
      wrap: value => hold('wrap', value === false ? false : true),
      fontSize: display('fontSize', 6, 40),
      scrollback: display('scrollback', 0, 1_000_000),
      watch: value => {
        if (typeof value !== 'boolean') return
        if (shown?.kind === 'local') shown.entry.hand.watch(value)
        else if (shown?.kind === 'session' && input.native) void type(shown.room, !value)
      },
      keys: value => { if (typeof value === 'string' && value && values.driving === true) void keys(value) },
    },
    writes: key => key in ROOM_REFUSE,
    write: async changes => {
      for (const {key} of changes) {
        const refused = shown?.kind === 'local' ? LOCAL_REFUSE[key as keyof typeof LOCAL_REFUSE] : ROOM_REFUSE[key as keyof typeof ROOM_REFUSE]
        throw Error(refused ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
