// Which sides of the detail area show (manual §16.4: "The detail area holds Clip view above Device view, both at once when there is
// room, as Live 12 does. Hide either one, or switch between them when only one shows"; Live 12.0.25 cap 31: both ticked in the View
// menu, stacked; ⇧⇥ made no visible change while both showed; cap 29: ⌥⌘E gives Clip view the main area). The frame (App.tsx) holds
// which sides the person keeps (`front`, the one ⇧Tab names, and which are hidden); the host measures its own height and asks this
// module what stands. Pure, apart from the one published reading of what stands (the status bar's switches read it).
import {useSyncExternalStore} from 'react'
import {CLIP_ROOM} from '../../inhabitants/catalogue/clips/design'

export type DetailSide = 'clip' | 'device'

/** The person's choice: the side ⇧Tab brings to the front, and the sides hidden from the status bar's switches. */
export interface DetailSides {
  readonly front: DetailSide
  readonly hidden: Readonly<Record<DetailSide, boolean>>
}

/** A chain plate is 191 px high at 100 % and scales down to 80 % (frame/devices/plateScale.ts), in the chain's 8 px padding and
 * under its head line (detail.css `.detail-head`, 22 px): the least the Device view needs. */
export const CHAIN_MIN_H = Math.ceil(191 * 0.8) + 16 + 22
/** The chain at its natural size (100 %): what the Device view takes when both stand. */
export const CHAIN_H = 191 + 16 + 22
/** The least Clip view needs: its head, a tab strip and a panel's first rows (clipKit.tsx HEAD_H, STRIP_H; the panels keep Live's
 * measures and only the editor's content scrolls). */
export const CLIP_MIN_H = 220

/** Both sides fit in a detail area this high. Pure. */
export const fitsBoth = (height: number): boolean => height >= CLIP_MIN_H + CHAIN_MIN_H

/** What stands: both where both are kept and fit; otherwise the front side, or the one kept. With Clip view expanded into the main
 * area (⌥⌘E) the detail area shows Device view alone, as Live's does. Pure. */
export function shownSides(sides: DetailSides, height: number, expanded = false): Record<DetailSide, boolean> {
  const kept = {clip: !sides.hidden.clip && !expanded, device: !sides.hidden.device}
  if (kept.clip && kept.device) return fitsBoth(height) ? {clip: true, device: true} : {clip: sides.front === 'clip', device: sides.front === 'device'}
  if (expanded && !kept.device) return {clip: false, device: false}
  return kept
}

/** ⇧Tab (Live's Toggle Clip/Device View): the other side comes to the front, and shows where it was hidden. While both stand it
 * changes nothing on screen (cap 31), but the front is the one kept if the area later narrows. Pure. */
export function switchSide(sides: DetailSides): DetailSides {
  const front: DetailSide = sides.front === 'clip' ? 'device' : 'clip'
  return {front, hidden: {...sides.hidden, [front]: false}}
}

/** A status bar switch: show its side, or hide it while the other stands. The last side standing is not hidden: pressing it again
 * keeps it (⌘⌥L hides the whole area). `shown` is what stands now. Pure. */
export function toggleSide(sides: DetailSides, side: DetailSide, shown: Readonly<Record<DetailSide, boolean>>): DetailSides {
  if (!shown[side]) return {front: side, hidden: {...sides.hidden, [side]: false}}
  const other: DetailSide = side === 'clip' ? 'device' : 'clip'
  if (!shown[other]) return sides
  return {front: other, hidden: {...sides.hidden, [side]: true}}
}

/** The side the person hid, as the frame keeps it across a relaunch (the application view's `hiddenSide`, beside `detail` and the rail's
 * `dock`: each part's fold its own; manual §10.1 "Show it again and it comes back … as you left it"). The front side always shows, so at
 * most the other one is hidden. Pure. */
export function hiddenSideOf(sides: DetailSides): DetailSide | undefined {
  const other: DetailSide = sides.front === 'clip' ? 'device' : 'clip'
  return sides.hidden[other] ? other : undefined
}

/** The sides a kept view restores: the side it hid, never its front (a view without the field hides nothing). Pure. */
export function restoredSides(front: DetailSide, hiddenSide: DetailSide | undefined): DetailSides['hidden'] {
  return {clip: hiddenSide === 'clip' && front !== 'clip', device: hiddenSide === 'device' && front !== 'device'}
}

/** The room Clip view takes in the detail area when both stand: the area less the chain at its size, never under its least. Pure. */
export function clipHeightIn(height: number, both: boolean): number {
  return both ? Math.max(CLIP_MIN_H, height - CHAIN_H) : height
}

/** ⌥⌘E (Live's Expand Clip View): Option and Command with E, nothing else. Pure. */
export function expandsClip(event: {readonly key: string; readonly code?: string; readonly shiftKey: boolean; readonly metaKey: boolean; readonly altKey: boolean;
  readonly ctrlKey: boolean}): boolean {
  return event.altKey && event.metaKey && !event.ctrlKey && !event.shiftKey && (event.code === 'KeyE' || event.key.toLowerCase() === 'e' || event.key === '´')
}

/** The designed clip's own size in the detail area (clips/design.ts CLIP_ROOM.detail) — the gallery's floor. */
export const CLIP_DETAIL_ROOM = CLIP_ROOM.detail

// ---------------------------------------------------------------------------------------------------------------- what stands now

let standing: Record<DetailSide, boolean> = {clip: false, device: true}
const listeners = new Set<() => void>()
/** The host says what stands (DetailHost), for the status bar's switches. */
export function publishShownSides(next: Readonly<Record<DetailSide, boolean>>): void {
  if (next.clip === standing.clip && next.device === standing.device) return
  standing = {...next}
  for (const listener of listeners) listener()
}
export const shownSidesNow = (): Readonly<Record<DetailSide, boolean>> => standing
export const useShownSides = (): Readonly<Record<DetailSide, boolean>> =>
  useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => standing, () => standing)
