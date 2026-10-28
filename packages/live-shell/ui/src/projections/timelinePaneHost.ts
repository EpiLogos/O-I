// The Timeline pane's host reading (T-FACTORY-TIMELINE-PANE): the one published door between the App frame and a Timeline
// pane body that the engine mounts in a Factory (or any) pane tree.
//
// The App owns the data: the set, its document, the selection, the colours and the World cut's temporal reading
// (`worldView`). The App publishes the reading each render, and the pane body (frame/tracks/TracksPane.tsx) draws the mode's
// tracks from it. Nothing is copied into a second store: this module holds the App's last published reading by reference, the
// way the atlas publishes its handle (AtlasProjectionPanel).
//
// The pane's own presentation (Session or Arrangement) is pane state: it lives here beside the reading, so the App, the pane
// body and the aperture's view chooser (frame/browser/apertureViews.tsx) read one value.

import {useLayoutEffect, useSyncExternalStore} from 'react'
import type {SurfMode} from '../shell/modeGrammar'
import type {NativeExpressionsContent} from '../shell/nativeContent'
import type {NativeCompositionViewSource} from '../shell/compositionViews'
import type {SetDocument} from '../shell/document'
import type {SetSummary} from '../shell/useSet'
import type {SetSelection} from '../shell/liveSelection'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {TimeSpine} from '../timeline/timeSpine'
import type {JourneyPresentation} from '../timeline/journeyWalks'
import type {WorldTimelineView} from './useWorldTemporalReading'

/** The Session · Arrangement pane's two presentations of one set of tracks (FOUNDATION F3). */
export type TimelinePresentation = 'session' | 'arrangement'

/** What the App publishes for a tracks pane: the mode's tracks (FOUNDATION F2 — the pane is the centre in every mode; which
 * material it shows is the mode's registration, shell/modeFrames.ts MODE_TRACK_SOURCES: the open set, the World cut, or the
 * open Expression's native sources). The presentation is the pane's own. `mode` names the mode whose tracks the pane draws. */
export interface TimelineHostReading {
  /** The open Live set and its document (Live's tracks). */
  set: SetSummary | null
  document: SetDocument | null
  /** Live's selection in the open set, and its writer. */
  selection: SetSelection
  select: (value: SetSelection) => void
  colors: string[]
  setColor: (track: number, value: string) => void
  /** The World cut: World material as tracks over the kernel's temporal read. Undefined means the civil field is unread. */
  world?: WorldTimelineView
  /** The shell's door to open an Expression a walk stop carries; present only over the World cut. */
  journey?: JourneyPresentation
  /** The open Expression's native composition sources, already qualified by the App (undefined unless its tracks are native). */
  session: NativeCompositionViewSource | undefined
  arrangement: NativeCompositionViewSource | undefined
  mode: SurfMode
  /** The World cut's time spine in every mode (its civil Now and the occasion stood in), whatever the mode's tracks are — the
   * aperture slot's occasion reads it in Expressions and Live too (lane F). */
  spine?: TimeSpine | null
  /** The open Expression's content and title (Expressions' tracks, F3). */
  native?: NativeExpressionsContent | null
  workName?: string
  /** THE selection's ref, and the one writer the shared views select through (FOUNDATION F1, F3). */
  selectedRef?: string
  selectTrackItem: (target: {kind: 'clip' | 'track'; ref: string; title: string; track?: string}) => void
  /** Why the mode has no tracks yet, in its own words, when it has none. */
  waiting?: string
  /** The kernel carrier, for a mode whose tracks read their own owner (frame/tracks/modeTracks.ts). */
  transport?: KernelTransportStatus
}

let reading: TimelineHostReading | null = null
// Session, as every mode's frame opens (shell/modeFrames.ts); the App moves it with the mode's restored view.
let presentation: TimelinePresentation = 'session'
const readingListeners = new Set<() => void>()
const presentationListeners = new Set<() => void>()

function notify(listeners: Set<() => void>): void {
  for (const listener of listeners) listener()
}

function subscribeTo(listeners: Set<() => void>, listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Publish the App's current reading to every pane body. Called by the App each render (usePublishTimelineReading). */
export function publishTimelineReading(next: TimelineHostReading | null): void {
  reading = next
  notify(readingListeners)
}

/** The published reading, as a plain read: null until the App has published one. */
export function timelineReading(): TimelineHostReading | null {
  return reading
}

/** Hear each publish, as a plain subscription (a host outside React: the World's walk follows the spine it publishes,
 * projections/atlas/walks/walksHost.ts). Returns the release. */
export function subscribeTimelineReading(listener: () => void): () => void {
  return subscribeTo(readingListeners, listener)
}

/** The published reading, as a hook: a pane body re-renders when the App publishes a new one. */
export function useTimelineReading(): TimelineHostReading | null {
  return useSyncExternalStore(listener => subscribeTo(readingListeners, listener), () => reading, () => reading)
}

/** Publish the reading from the App's render. The effect runs after each App commit, so a pane body re-reads what the App
 * shows; the publish holds no subscription of its own, so nothing needs disposing when the App re-renders. */
export function usePublishTimelineReading(next: TimelineHostReading): void {
  useLayoutEffect(() => {
    publishTimelineReading(next)
  })
}

/** The Timeline pane's own presentation. Defaults to the Arrangement (the Timeline lens, m2). */
export function timelinePanePresentation(): TimelinePresentation {
  return presentation
}

/** Set the Timeline pane's own presentation. Pane-local: the App's World cut `tab` is never written from here. */
export function setTimelinePanePresentation(next: TimelinePresentation): void {
  if (next === presentation) return
  presentation = next
  notify(presentationListeners)
}

/** The Timeline pane's presentation, as a hook: the lens bar and the Device side re-read it when a lens press changes it. */
export function useTimelinePanePresentation(): TimelinePresentation {
  return useSyncExternalStore(listener => subscribeTo(presentationListeners, listener), () => presentation, () => presentation)
}
