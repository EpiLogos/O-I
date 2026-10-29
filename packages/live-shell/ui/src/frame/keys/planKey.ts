// What a key does, planned against the doors it presses through (FOUNDATION F9). A plan exists only where the control the key
// stands for is enabled: Space and Esc need a Play or Stop binding with a write path, a number key needs a Session grid whose
// set gives a row launch, a macro key needs a device whose owner takes the write, Enter needs something selected to open.
// No plan, no press: the key is left to whoever else wants it. A plan's `run` presses the control's own door and returns the
// owner's words when it has any. Pure over the doors it is given.
import type {SdkParamRow} from '../../inhabitants/sdk/define'
import type {DeviceInstance} from '../devices/deviceRuntime'
import {compactRows} from '../devices/deviceRuntime'
import type {SlotBinding, TransportBindings} from '../transport/slots'
import {answerOf} from '../tracks/SessionGrid'
import type {KeyIntent} from './keyMap'
import {macroTurn} from './keyMap'
import type {Openable, TrackRows} from './keyDoors'

/** What the owner said to a key, shown until it is dismissed or the next key answers. */
export interface KeyReceipt {
  ok: boolean
  /** The press: "Launch row 2", "Turn Reach", "Open Torus beside". */
  what: string
  text: string
}

/** The doors a plan reads. Each is read when a key is pressed. */
export interface KeyDoors {
  transport(): TransportBindings | null
  rows(): TrackRows | null
  /** The device selected on a chain (the one the pool shows). */
  device(): DeviceInstance | null
  /** What Enter opens: a browser row's selection, else the selected device in full size. */
  openable(): Openable | null
  searchAvailable(): boolean
  search(reveal?: () => void): boolean
  /** The search line's host is mounted (central/searchLineDoor.ts); ⌘K opens the line over the frame. */
  lineAvailable?(): boolean
  line?(): void
}

/** What only the App holds, handed in when the keys are mounted. */
export interface KeyOptions {
  /** The pane that has focus, for opening beside it. */
  focusedGroupId?: string | null
  /** Show the browser (it may be hidden) before its search takes focus. */
  revealBrowser?: () => void
}

export interface KeyPlan {
  /** Press the control's door. A receipt is the owner's answer worth showing; null says nothing. */
  run(): void | KeyReceipt | null | Promise<KeyReceipt | null>
}

/** A slot's press, if the slot is enabled the way the bar enables it: not refused, with a write path. */
const pressable = (binding: SlotBinding | undefined): (() => void) | null =>
  binding && !binding.refused && typeof binding.press === 'function' ? binding.press : null

const refusal = (what: string, cause: unknown): KeyReceipt => ({ok: false, what, text: cause instanceof Error ? cause.message : String(cause)})

/** The rack macros a device draws on its compact face, in the order the keys count them. */
export const macroRows = (device: DeviceInstance): SdkParamRow[] => compactRows(device.rows)

export function planKey(intent: KeyIntent, doors: KeyDoors, options: KeyOptions = {}): KeyPlan | null {
  switch (intent.id) {
    case 'play-stop': {
      // Space is the Play and Stop of the bar: Stop while Play's light reads on and Stop can be pressed, else Play.
      const bar = doors.transport()
      if (!bar) return null
      const stop = pressable(bar.stop), play = pressable(bar.play)
      const press = bar.play?.lit === true && stop ? stop : play
      return press ? {run: () => guarded('Play or stop', press)} : null
    }
    case 'stop': {
      const stop = pressable(doors.transport()?.stop)
      return stop ? {run: () => guarded('Stop', stop)} : null
    }
    case 'search':
      return doors.searchAvailable() ? {run: () => { doors.search(options.revealBrowser) }} : null
    case 'line':
      return doors.lineAvailable?.() && doors.line ? {run: () => { doors.line!() }} : null
    case 'row': {
      // A row is the Session grid's: its stop launches the whole row through the set's own launchStop.
      const grid = doors.rows()
      const launch = grid?.presented === 'session' ? grid.set.actions?.launchStop : undefined
      const column = grid?.set.columns[intent.row]
      if (!launch || !column) return null
      const what = `Launch row ${column.name || intent.row + 1}`
      // A row whose every clip stands on a read-only track (the cron firings) is read, not launched — as the grid's row button
      // says (frame/tracks/SessionGrid.tsx readOnlyRow); its number key refuses in the same words.
      const readOnly = new Set(grid!.set.tracks.filter(track => track.readOnly).map(track => track.id))
      const held = grid!.set.clips.filter(clip => clip.columnId === column.id)
      if (held.length > 0 && held.every(clip => readOnly.has(clip.trackId))) return {run: async () => refusal(what, 'every clip in this row is read, not launched')}
      return {run: async () => {
        const answer = await answerOf(() => launch.run(column.id))
        return answer && {...answer, what}
      }}
    }
    case 'macro': {
      const device = doors.device()
      const row = device && macroRows(device)[intent.macro]
      if (!device || !row) return null
      const turn = macroTurn(device, row, intent.direction)
      // A control that cannot be turned is not turned; one at the end of its range is a key that was heard and has nowhere to go.
      if (!turn.ok && turn.reason !== 'at-limit') return null
      return {run: async () => {
        if (!turn.ok) return null
        try {
          await device.submit!([{key: turn.key, value: turn.value}])
          return null
        } catch (cause) { return refusal(`Turn ${row.title}`, cause) }
      }}
    }
    case 'open': {
      const target = doors.openable()
      if (!target) return null
      const what = `Open ${target.label}${intent.beside ? ' beside' : ''}`
      return {run: () => {
        if (intent.beside && !options.focusedGroupId) return refusal(what, 'No pane has focus to open beside.')
        try {
          target.open(intent.beside ? {groupId: options.focusedGroupId!, edge: 'right'} : undefined)
          return null
        } catch (cause) { return refusal(what, cause) }
      }}
    }
  }
}

function guarded(what: string, press: () => void): KeyReceipt | null {
  try { press(); return null } catch (cause) { return refusal(what, cause) }
}
