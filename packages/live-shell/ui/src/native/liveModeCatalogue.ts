/**
 * The Live transport's mode catalogue, read from the owner through the kernel
 * (T-LIVE-MODE-SCALES, leg 2). The kernel's `music_modes_read` op runs the
 * installed quaternal-logic's `music modes --json` (ql.music-modes/v1) and passes
 * the owner's document through; the shell validates it strictly and never runs
 * ql itself. Read once per session; a refresh is on demand, never polled.
 *
 * The hold below is the Live transport's choice for this session. No owner write
 * path exists for a set-level mode yet, so the choice is not persisted: it is held
 * in this module, never in browser storage.
 */
import {useEffect, useSyncExternalStore} from 'react'
import {detectTransport, kernelOp, type KernelOpCall} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp} from '../../../../../desktop/cradle/src/kernel/types'
import {parseQlMusicModes, type QlMusicModes} from '../live/modes'

export type LiveModeCatalogueState =
  | {readonly state: 'loading'}
  | {readonly state: 'refused'; readonly reason: string}
  | {readonly state: 'ready'; readonly catalogue: QlMusicModes}

export type KernelCall = (op: KernelOp) => Promise<KernelOpCall>

/** One answer from the kernel, validated; every refusal is named. */
export async function readQlMusicModes(call: KernelCall): Promise<LiveModeCatalogueState> {
  let answer: KernelOpCall
  try {
    answer = await call({op: 'music_modes_read'})
  } catch (error) {
    return {state: 'refused', reason: `the kernel could not be asked for the ql music catalogue: ${String(error)}`}
  }
  if (answer.outcome == null) return {state: 'refused', reason: answer.error ?? 'the kernel did not serve the ql music catalogue'}
  const outcome = answer.outcome as {result?: string; document?: unknown}
  if (outcome.result !== 'music_modes_reading') {
    return {state: 'refused', reason: `the kernel answered \`${outcome.result ?? 'unknown'}\`, not \`music_modes_reading\``}
  }
  const parsed = parseQlMusicModes(outcome.document)
  return parsed.ok ? {state: 'ready', catalogue: parsed.catalogue} : {state: 'refused', reason: parsed.refusal}
}

let snapshot: LiveModeCatalogueState = {state: 'loading'}
let inFlight: Promise<void> | null = null
const catalogueListeners = new Set<() => void>()

function publish(next: LiveModeCatalogueState) {
  snapshot = next
  for (const listener of catalogueListeners) listener()
}

/** Read the catalogue: once per session, or again when forced. Concurrent callers share one read. */
export function requestLiveModeCatalogue(force = false): Promise<void> {
  if (inFlight) return inFlight
  if (!force && snapshot.state !== 'loading') return Promise.resolve()
  inFlight = readQlMusicModes(op => kernelOp(detectTransport(), op))
    .then(publish)
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** The catalogue reading for the transport, read once on first mount, and a refresh on demand. */
export function useLiveModeCatalogue(): {readonly reading: LiveModeCatalogueState; readonly refresh: () => void} {
  const reading = useSyncExternalStore(
    listener => {
      catalogueListeners.add(listener)
      return () => catalogueListeners.delete(listener)
    },
    () => snapshot,
    () => snapshot,
  )
  useEffect(() => {
    void requestLiveModeCatalogue()
  }, [])
  return {reading, refresh: () => void requestLiveModeCatalogue(true)}
}

/** The Live transport's choice: the root pitch class and the scale (catalogue key) on it. */
export interface LiveModeHold {
  readonly key: string | null
  readonly root: number
}

let hold: LiveModeHold = {key: null, root: 0}
const holdListeners = new Set<() => void>()

export function setLiveModeHold(patch: Partial<LiveModeHold>) {
  hold = {...hold, ...patch}
  for (const listener of holdListeners) listener()
}

/** The held choice for this session. Not persisted: no owner write path for a set-level mode yet. */
export function useLiveModeHold(): LiveModeHold {
  return useSyncExternalStore(
    listener => {
      holdListeners.add(listener)
      return () => holdListeners.delete(listener)
    },
    () => hold,
    () => hold,
  )
}
