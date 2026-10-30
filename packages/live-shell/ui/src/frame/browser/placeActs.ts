// What a row of the browser's Places does, wherever it stands (manual §16.7 "The browser and the pool": Open — "Double-click it, or drag it
// into a pane"; Bring into the set — "Drag material onto an empty track … a world joins today"; Start a track — "An agent dropped there
// takes the seat"; Keep at hand — "Drag a running thing or a chat onto the rail. Its tile opens on the rail"). PlaceRows.tsx draws the
// places' rows with these acts, and a collection's rows (CollectionRows.tsx) open a collected thing the same way, by reading its row again
// from its owner (placeRowOf) and running the row's own act (openPlaceRow).
//
// A row drags what the target the manual names for it takes, in the payload the browser's other rows already carry there:
//   - a world, onto the empty track: its world ref (CENTRAL_WORLD_DRAG, as the Worlds rows drag it; the track's seat writes it into today);
//   - an agent, onto an empty track or the agent chain: the chain's own agent payload (AGENT_CHAIN_MIME, as Factory's browser drags it);
//   - a Day, into a pane: its subject (CENTRAL_DOCUMENT_DRAG, the pane's subject grammar; the pane opens the Day there);
//   - a machine or a workcell, onto the rail: the running thing (RUNNING_DRAG); the rail opens the Workcells tile, which holds each workcell
//     and every gateway your machines reach (agent/agentDockTiles.ts DEVICE_TILES).
// The identity you share, a harness and a folder that is no world name no target, so they do not drag.
import {useEffect, useState, type DragEvent} from 'react'
import type {NativeFileEntry, RootWorld} from '../../../../../../desktop/cradle/src/kernel/types'
import {refusalWords} from '../../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {AGENT_CHAIN_MIME, encodeChainDrag, setActiveChainDrag} from '../../agent/agentChainDrag'
import {CENTRAL_DAYS_PATH} from '../../central/daySurface'
import {CENTRAL_DOCUMENT_DRAG, documentTargetOf} from '../../central/documents/centralDocuments'
import {CENTRAL_WORLD_DRAG} from '../../timeline/centralTrackAdapter'
import type {RailDrop} from '../widgets/WidgetRail'
import {dayRows, workRows, yourWorldRow, type PlaceRow} from './places'

/** The drag type a running thing (a machine, a workcell) carries onto the rail. */
export const RUNNING_DRAG = 'application/x-oi-running'
/** The rail's tile for workcells and machines (agent/agentDockTiles.ts DEVICE_TILES `workcells`). */
const WORKCELLS_TILE = 'workcells'

/** The reads a collected thing's row is made from again: Central's root disclosure, and your Days as the day surface lists them. */
export interface PlaceReads {
  root(): Promise<RootWorld>
  /** Your Days' entries (central/daySurface.ts dayEntriesOf of the day surface's listing). */
  days(): Promise<readonly NativeFileEntry[]>
}

/** The place's row a collected thing is, read again from its owner: your world, a project of your Work, or one of your Days. Null for
 * a thing whose row opens nothing (an agent, a harness, a machine, a workcell, the identity). Rejects, in words, when the owner no
 * longer holds it. */
export async function placeRowOf(item: {readonly ref: string; readonly kind?: string; readonly label?: string}, reads: PlaceReads): Promise<PlaceRow | null> {
  const named = (rows: readonly PlaceRow[], where: string): PlaceRow => {
    const row = rows.find(entry => entry.ref === item.ref)
    if (!row) throw new Error(`${item.label ?? item.ref.replace(/^project:/, '')} is no longer among your ${where}.`)
    return row
  }
  if (item.kind === 'world' && item.ref === 'control:root') return yourWorldRow(await reads.root())
  if (item.kind === 'project') return named(workRows(await reads.root()), 'Work')
  if (item.kind === 'day') return named(dayRows(await reads.days()), 'Days')
  return null
}

/** What a row's act needs: the set's seat for a world (shell/ModeBrowser.tsx seatWorldFromBrowser), the Day's opener. */
export interface PlaceActPorts {
  seat(world: {ref: string; name: string}): Promise<{ok: boolean; note?: string; error?: string}>
  openDay(entry: NativeFileEntry, path: string): Promise<void>
}

/** A row's own act, as a double-click or Enter makes it: a world comes into today, a Day opens in the focused pane. Answers what was
 * said (the set's note, or a refusal in plain words), or null when the row opened without a word or has no act. */
export async function openPlaceRow(row: PlaceRow, ports: PlaceActPorts): Promise<{readonly ok: boolean; readonly words: string} | null> {
  if (row.seat) {
    const world = row.seat
    const answer = await ports.seat(world)
    return answer.ok ? {ok: true, words: answer.note ?? `${world.name} is in today's set.`} : {ok: false, words: refusalWords(`${world.name} did not come into today.`, answer.error)}
  }
  if (row.day) {
    const path = row.day.location?.path ?? `${CENTRAL_DAYS_PATH}/${row.day.name}`
    try { await ports.openDay(row.day, path); return null } catch (cause) { return {ok: false, words: refusalWords(`${row.label} did not open.`, cause)} }
  }
  return null
}

/** What a row carries when dragged: its drag type, its payload, and its words (the drag's plain text). Null: no target takes it. Pure. */
export function placeRowDrag(row: PlaceRow): {readonly type: string; readonly data: string; readonly words: string} | null {
  if (row.seat) return {type: CENTRAL_WORLD_DRAG, data: row.seat.ref, words: row.label}
  if (row.kind === 'agent') return {type: AGENT_CHAIN_MIME, data: encodeChainDrag({family: 'agent', ref: row.ref, label: row.label}), words: row.label}
  if (row.kind === 'day' && documentTargetOf(row.ref)) return {type: CENTRAL_DOCUMENT_DRAG, data: row.ref, words: row.label}
  if (row.kind === 'machine' || row.kind === 'workcell') return {type: RUNNING_DRAG, data: JSON.stringify({kind: row.kind, ref: row.ref, label: row.label}), words: row.label}
  return null
}

/** A row's drag begins: its payload, its words, a copy; an agent's is also held for the gesture, as the chain reads it on dragover. */
export function startPlaceDrag(event: DragEvent<HTMLElement>, drag: NonNullable<ReturnType<typeof placeRowDrag>>, row: PlaceRow): void {
  event.dataTransfer.setData(drag.type, drag.data)
  event.dataTransfer.setData('text/plain', drag.words)
  event.dataTransfer.effectAllowed = 'copy'
  if (drag.type === AGENT_CHAIN_MIME) setActiveChainDrag({kind: 'chain-item', drag: {family: 'agent', ref: row.ref, label: row.label}})
}

/** A row's drag ends: the agent held for the gesture is let go. */
export function endPlaceDrag(drag: ReturnType<typeof placeRowDrag>): void {
  if (drag?.type === AGENT_CHAIN_MIME) setActiveChainDrag(null)
}

// ── the rail ─────────────────────────────────────────────────────────────

/** The slice of a drag event the rail's handlers read (a harness can drive them). */
export interface RunningDragEvent {
  readonly dataTransfer: {readonly types: readonly string[]; getData(type: string): string; dropEffect: string} | null
  preventDefault(): void
}

/** The rail's book, as far as a running thing's drop needs it (frame/widgets/widgets.ts WidgetRailBook). */
export interface RunningRailBook {
  readonly rail: {readonly open: readonly string[]}
  toggle(id: string): void
}

const runningOf = (raw: string | undefined): {kind: 'machine' | 'workcell'; ref: string; label: string} | null => {
  try {
    const thing = JSON.parse(raw ?? '') as Record<string, unknown>
    return (thing.kind === 'machine' || thing.kind === 'workcell') && typeof thing.ref === 'string' && thing.ref && typeof thing.label === 'string' && thing.label
      ? {kind: thing.kind, ref: thing.ref, label: thing.label} : null
  } catch { return null }
}

/** A running thing dropped on the rail: the Workcells tile opens there (Keep at hand, §16.7). Each handler says whether it took the
 * gesture; what is not a running thing is left to the rail's other drops (a chat's, agent/factoryChatsRail.tsx). */
export function runningRailHandlers(ports: {readonly book: RunningRailBook; readonly said: (words: string) => void}) {
  return {
    onDragOver(event: RunningDragEvent): boolean {
      if (!event.dataTransfer?.types.includes(RUNNING_DRAG)) return false
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      return true
    },
    onDrop(event: RunningDragEvent): boolean {
      if (!event.dataTransfer?.types.includes(RUNNING_DRAG)) return false
      const thing = runningOf(event.dataTransfer.getData(RUNNING_DRAG))
      if (!thing) return false
      event.preventDefault()
      if (!ports.book.rail.open.includes(WORKCELLS_TILE)) ports.book.toggle(WORKCELLS_TILE)
      ports.said(`${thing.label} is at hand: the Workcells tile stands on the rail, with your workcells and the gateways your machines reach.`)
      return true
    },
  }
}

/** The rail's drop: a running thing's (above), else the chat's it is given; the words the last of them answered with. */
export function useRunningRailDrop(book: RunningRailBook, chat: RailDrop): RailDrop {
  const [note, setNote] = useState<string | null>(null)
  // A chat's answer is the newer one once it comes.
  useEffect(() => { setNote(null) }, [chat.note])
  const running = runningRailHandlers({book, said: setNote})
  return {
    dropProps: {
      onDragOver: event => { if (!running.onDragOver(event)) chat.dropProps.onDragOver(event) },
      onDrop: event => { if (!running.onDrop(event)) chat.dropProps.onDrop(event) },
    },
    note: note ?? chat.note,
  }
}
