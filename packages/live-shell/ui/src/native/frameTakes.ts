import {useSyncExternalStore} from 'react'
import type {HostedAppState, StageCommand, StageResult, StageTakeMode} from '@epilogos/expressions-boundary'

/** Property takes and recorded-track preview, driven through the Expressions frame's
 * own stage commands (stageCommands.ts take/tracks). Pure apart from the link store:
 * the frame is reached only through the link the Expressions panel publishes. */
export type FrameStageRun = (command: StageCommand) => Promise<StageResult>

export const TAKE_MODE_LABELS: Record<StageTakeMode, string> = {replace: 'Replace last take', append: 'Next section'}
export const takeStart = (mode: StageTakeMode): StageCommand => ({command: 'take', action: 'start', mode})
export const takeStop: StageCommand = {command: 'take', action: 'stop'}
export const tracksPreview = (on: boolean): StageCommand => ({command: 'tracks', action: on ? 'preview' : 'stop-preview'})

/** The frame's readings for the take controls. `recording` is the silent video; a take reads `propertyRecording`. */
export interface FrameTakeLink {state: HostedAppState | null; run: FrameStageRun | null}
const DETACHED: FrameTakeLink = {state: null, run: null}
let linked: FrameTakeLink = DETACHED
const listeners = new Set<() => void>()
export function publishFrameTakeLink(next: FrameTakeLink): void {
  if (next.state === linked.state && next.run === linked.run) return
  linked = next
  for (const listener of [...listeners]) listener()
}
export const readFrameTakeLink = (): FrameTakeLink => linked
export function subscribeFrameTakeLink(listener: () => void): () => void {
  listeners.add(listener)
  return () => {listeners.delete(listener)}
}
export function useFrameTakeLink(): FrameTakeLink {
  return useSyncExternalStore(subscribeFrameTakeLink, readFrameTakeLink, () => DETACHED)
}

export type FrameTakeWant = 'start' | 'stop' | 'preview' | 'stop-preview'
/** Why a take or preview control is off, or null. Every reason names the thing the user does first. */
export function frameTakeReason(input: {link: FrameTakeLink; busy: boolean; sceneRef: string | null; want: FrameTakeWant; chosen?: number | null; tracks?: number}): string | null {
  const {state, run} = input.link
  if (!run) return 'No Expressions application is mounted.'
  if (input.busy) return 'The application is still answering the last take command.'
  if (!state) return 'The Expressions application has not reported its state yet.'
  if (!state.nativeScene) return 'Open a native Expression to record its properties.'
  if (input.sceneRef !== null && state.nativeScene.scene_ref !== input.sceneRef) return 'The Expressions application is presenting another Scene. Focus this Scene there first.'
  switch (input.want) {
    case 'start':
      if (state.propertyRecording) return 'A property take is already recording.'
      if (state.recording) return 'Stop the video recording before a property take.'
      if (input.chosen === 0) return 'Choose a local numeric property in the toolbelt first.'
      return null
    case 'stop':
      return state.propertyRecording ? null : 'No property take is recording.'
    case 'preview':
      if (state.propertyRecording) return 'Finish the property take before previewing its tracks.'
      if (input.tracks === 0) return 'Record a take first; its tracks appear here.'
      return null
    case 'stop-preview':
      return state.propertyPreview ? null : 'Preview is not playing.'
  }
}

/** A mini envelope of one track's own keyframes, in view-box units. Derived only: the path
 * is drawn from the Scene's points, normalised to that track's own time and value span. */
export const ENVELOPE_POINT_LIMIT = 240
export interface TakeEnvelope {path: string; min: number; max: number; start: number; end: number; drawn: number}
export function takeEnvelope(points: readonly {time: number; value: number}[], width = 160, height = 36): TakeEnvelope | null {
  if (!points.length) return null
  let min = Infinity, max = -Infinity
  for (const point of points) {if (point.value < min) min = point.value; if (point.value > max) max = point.value}
  const start = points[0].time, end = points[points.length - 1].time, span = end - start, range = max - min
  const stride = Math.max(1, Math.ceil(points.length / ENVELOPE_POINT_LIMIT))
  const drawn = points.filter((_, index) => index % stride === 0 || index === points.length - 1)
  const x = (time: number) => span > 0 ? ((time - start) / span) * width : 0
  const y = (value: number) => range > 0 ? height - ((value - min) / range) * height : height / 2
  const path = drawn.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.time).toFixed(2)} ${y(point.value).toFixed(2)}`).join(' ')
  return {path, min, max, start, end, drawn: drawn.length}
}
