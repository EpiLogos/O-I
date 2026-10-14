// The Timeline pane's host reading (T-FACTORY-TIMELINE-PANE): the one published door between the App frame and a Timeline
// pane body that the engine mounts in a Factory (or any) pane tree.
//
// The App owns the data: the set, its document, the selection, the colours and the World cut's temporal reading
// (`worldView`). The App publishes exactly the props its World cut residence reads (TimelineProjectionResidence), and the
// pane body renders them through the same residence component. Nothing is copied into a second store: this module holds
// the App's last published reading by reference, the way the atlas publishes its handle (AtlasProjectionPanel).
//
// The pane's own presentation (Session = Journey, m3; Arrangement = Timeline, m2) is pane state, not a World cut state:
// it lives here beside the reading so the lens bar and the Device side can read it, and it never touches the App's `tab`,
// which is the World cut's presentation.

import {useLayoutEffect, useSyncExternalStore} from 'react'
import type {TimelineResidenceProps} from './timelineResidence'
import type {TimelinePresentation} from './timelinePresentation'
import type {SurfMode} from '../shell/modeGrammar'
import type {NativeExpressionsContent} from '../shell/nativeContent'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

/** The props the Session · Arrangement residence reads, for a pane: the mode's tracks (FOUNDATION F2 — the pane is the
 * centre in every mode; which material it shows is the mode's registration, shell/modeFrames.ts MODE_TRACK_SOURCES: the
 * open set, the World cut, or the open Expression's native sources). The presentation is the pane's own. `mode` names
 * the mode whose designed empty frame stands while the World cut's reading is unread. */
export type TimelineHostReading = Pick<TimelineResidenceProps, 'set' | 'document' | 'selection' | 'select' | 'colors' | 'setColor' | 'world' | 'journey' | 'session' | 'arrangement'> & {
  mode: SurfMode
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
let presentation: TimelinePresentation = 'arrangement'
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
