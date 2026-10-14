// The Expressions pane's host door (T-EXPRESSIONS-PANE-LEASE): the one published seam between the centre's Expressions panel
// (panels/expressions.tsx), which owns the single ExpressionsHost, its single native lease and its single iframe, and the
// Expressions pane bodies (expressionsPane.tsx) that the Factory pane tree mounts through the projection door.
//
// Nothing here holds a frame, a host or a lease. It carries four things, each by value:
// - the frame's reading (the expression's title and ref), which a pane body shows in its header;
// - the frame's chrome (stage tools, faults), which a pane body shows beside that header while the frame is placed in a pane;
// - the placement: which presented pane's slot the one frame is drawn over (one claimant at a time);
// - the centre residence's style while the frame is placed (zero-size, out of flow; the frame's own container is what moves).

import {useSyncExternalStore} from 'react'
import type {ComponentProps, CSSProperties} from 'react'
import type {HostedAppState} from '@epilogos/expressions-boundary'
import type {NativeStageTools} from '../components/NativeStageTools'
import {NATIVE_PRESENT_EXPRESSIONS} from '../native/openStudio'

/** What the one hosted frame presents: the native Expression's ref and its document's name, or null when no native Expression
 * is open. The whole reading is null until the frame has reported its first state. */
export interface HostedExpressionsReading {
  expression_ref: string | null
  title: string | null
}

/** The frame's chrome, published by value: the stage state and runner the toolbar reads, and the faults the panel shows. */
export interface HostedExpressionsChrome {
  state: HostedAppState | null
  run: ComponentProps<typeof NativeStageTools>['run']
  faults: readonly string[]
  /** Reopen the native work when the frame's host is gone (the old centre residence's "Reopen native work", hidden since
   * F2): the Studio carries it as a mark on its head. */
  reopen?: (() => void) | null
}

/** A pane whose slot the frame is drawn over. */
export interface FramePlacement {
  paneId: string
  slot: HTMLElement
}

/** The centre residence while the frame is placed in a pane: out of flow, zero-size, with no hit area. The container inside it is
 * the one that moves (framePlacement.ts). It is applied only while a pane holds the frame, and never removes the frame. */
export const PLACED_RESIDENCE_STYLE: CSSProperties = {position: 'fixed', left: 0, top: 0, width: 0, height: 0, overflow: 'visible', pointerEvents: 'none'}

let reading: HostedExpressionsReading | null = null
const readingListeners = new Set<() => void>()

/** Publish the centre frame's reading (or null when the frame is not mounted or not ready). A value equal to the current reading
 * notifies nobody, so a frame that re-reports an unchanged state does not re-render the pane. */
export function publishHostedExpressions(next: HostedExpressionsReading | null): void {
  if (JSON.stringify(next) === JSON.stringify(reading)) return
  reading = next
  for (const listener of [...readingListeners]) listener()
}

/** The published reading as a plain read. */
export function hostedExpressions(): HostedExpressionsReading | null {
  return reading
}

/** The published reading as a hook: the pane body re-renders when the centre's frame reports a new one. */
export function useHostedExpressions(): HostedExpressionsReading | null {
  return useSyncExternalStore(
    listener => {
      readingListeners.add(listener)
      return () => { readingListeners.delete(listener) }
    },
    () => reading,
    () => reading,
  )
}

let chrome: HostedExpressionsChrome | null = null
const chromeListeners = new Set<() => void>()

/** Publish the frame's chrome. Called by the centre panel when its stage state, runner or faults change. */
export function publishHostedChrome(next: HostedExpressionsChrome | null): void {
  chrome = next
  for (const listener of [...chromeListeners]) listener()
}

/** The published chrome as a hook. */
export function useHostedChrome(): HostedExpressionsChrome | null {
  return useSyncExternalStore(
    listener => {
      chromeListeners.add(listener)
      return () => { chromeListeners.delete(listener) }
    },
    () => chrome,
    () => chrome,
  )
}

// --- placement -------------------------------------------------------------------------------------------------------------------

interface PaneRecord {slot: HTMLElement | null; presented: boolean; order: number}
const panes = new Map<string, PaneRecord>()
let registrations = 0
let preferred: string | null = null
let placement: FramePlacement | null = null
const placementListeners = new Set<() => void>()

/** The claimant: the preferred pane when it is presented with a slot; otherwise the first presented pane with a slot. */
function settle(): void {
  const ready = [...panes].filter(([, record]) => record.presented && record.slot).sort((a, b) => a[1].order - b[1].order)
  const chosen = ready.find(([id]) => id === preferred) ?? ready[0]
  const next: FramePlacement | null = chosen ? {paneId: chosen[0], slot: chosen[1].slot!} : null
  if (next?.paneId === placement?.paneId && next?.slot === placement?.slot) return
  placement = next
  for (const listener of [...placementListeners]) listener()
}

/** A pane body is admitted (its module mounted). It holds no slot and is not presented until it says so. */
export function registerExpressionsPane(paneId: string): void {
  if (!panes.has(paneId)) panes.set(paneId, {slot: null, presented: false, order: registrations++})
}

/** The pane body is gone: its slot and presentation go with it, and the frame returns to another presented pane if one stands. */
export function unregisterExpressionsPane(paneId: string): void {
  panes.delete(paneId)
  if (preferred === paneId) preferred = null
  settle()
}

/** The pane's rectangle for the frame: its slot element, or null when the pane has none (its body is leaving). */
export function attachExpressionsSlot(paneId: string, slot: HTMLElement | null): void {
  const record = panes.get(paneId)
  if (!record) return
  record.slot = slot
  settle()
}

/** The pane's presentation (its wrapper is shown to the user, or concealed by a tab switch or by Factory being left). */
export function setExpressionsPanePresented(paneId: string, presented: boolean): void {
  const record = panes.get(paneId)
  if (!record || record.presented === presented) return
  record.presented = presented
  settle()
}

/** The user chose this pane (a press on its body, or its Show here control): the frame moves to it when it is presented. */
export function preferExpressionsPane(paneId: string): void {
  if (preferred === paneId) return
  preferred = paneId
  settle()
}

/** The pane the frame is drawn over, or null when no presented pane can hold it. */
export function framePlacement(): FramePlacement | null {
  return placement
}

/** The frame placement as a hook: the centre panel re-follows, and the centre residence is released, when the claimant changes. */
export function useFramePlacement(): FramePlacement | null {
  return useSyncExternalStore(
    listener => {
      placementListeners.add(listener)
      return () => { placementListeners.delete(listener) }
    },
    () => placement,
    () => placement,
  )
}

/** The centre frame's own surface: present the one hosted Expressions surface in the centre. The centre's existing reveal
 * (App.tsx, NATIVE_PRESENT_EXPRESSIONS) moves the presentation: the centre's frame is shown, and it is retained, never remounted,
 * never re-leased. */
export function presentHostedExpressions(): void {
  window.dispatchEvent(new Event(NATIVE_PRESENT_EXPRESSIONS))
}
