// The pool's contents (manual §16.7 The pool): the frames and lenses taken out of constellations, which groove each clip is read through,
// the sublens each lens is turned to, and the clip Clip view holds now (the pool lights the groove it uses, Hot-swap and Commit act on it).
//
// The pool keeps references, never readings: each groove names the constellation it came out of and is its owner's verbatim (the wiki's
// frame, QL's lens), and a clip's choice names the groove by its id. "How the window stands is kept with the set" (§16.7): the DLW's set
// file does not exist yet, so the pool is kept where the shell keeps the window between launches, in this window's storage, and is read
// again from it as the shell opens. Choosing a groove asks no owner and writes nothing: only Commit writes (owners/grooveOwners.ts).
import {useSyncExternalStore} from 'react'
import type {Groove} from './grooves'

/** The clip Clip view holds: its host id, its mode, and the constellation it is made of (its source), where its owner names one. */
export interface PoolClip {
  readonly id: string
  readonly mode: string
  readonly sourceRef: string | null
}

export interface PoolState {
  readonly grooves: readonly Groove[]
  /** clip host id → the groove it is read through. */
  readonly chosen: Readonly<Record<string, string>>
  /** lens groove id → the sublens it is turned to (0–5); absent, the whole lens. */
  readonly sublens: Readonly<Record<string, number>>
  readonly clip: PoolClip | null
}

export const POOL_KEY = 'oi.live-shell.pool.v1'
const EMPTY: PoolState = {grooves: [], chosen: {}, sublens: {}, clip: null}

function restored(): PoolState {
  try {
    const raw = globalThis.localStorage?.getItem(POOL_KEY)
    if (!raw) return EMPTY
    const kept = JSON.parse(raw) as Partial<PoolState>
    return {grooves: Array.isArray(kept.grooves) ? kept.grooves.filter(g => g && (g.kind === 'frame' || g.kind === 'lens') && typeof g.id === 'string') : [],
      chosen: kept.chosen && typeof kept.chosen === 'object' ? kept.chosen : {}, sublens: kept.sublens && typeof kept.sublens === 'object' ? kept.sublens : {}, clip: null}
  } catch { return EMPTY }
}

let state: PoolState = restored()
const listeners = new Set<() => void>()
function change(next: PoolState, keep = true): void {
  state = next
  if (keep) try { globalThis.localStorage?.setItem(POOL_KEY, JSON.stringify({grooves: next.grooves, chosen: next.chosen, sublens: next.sublens})) } catch { /* kept for this session only */ }
  for (const listener of [...listeners]) listener()
}

export const poolNow = (): PoolState => state
export function usePool(): PoolState {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, poolNow, poolNow)
}

/** Grooves taken out of a constellation join the pool; one it already holds stands once. Returns how many joined. */
export function addGrooves(grooves: readonly Groove[]): number {
  const held = new Set(state.grooves.map(g => g.id))
  const joining = grooves.filter(g => !held.has(g.id) && (held.add(g.id), true))
  if (joining.length) change({...state, grooves: [...state.grooves, ...joining]})
  return joining.length
}

/** The groove a clip is read through, or none. */
export const chosenOf = (clipId: string): string | null => state.chosen[clipId] ?? null
export function chooseGroove(clipId: string, grooveId: string | null): void {
  if (grooveId !== null && !state.grooves.some(g => g.id === grooveId)) throw new Error('That groove is not in the pool: drop its constellation on the pool first.')
  const chosen = {...state.chosen}
  if (grooveId === null) delete chosen[clipId]
  else chosen[clipId] = grooveId
  change({...state, chosen})
}

/** A lens's sublens: one of its six (0–5), or null for the whole lens. */
export const sublensOf = (grooveId: string): number | null => state.sublens[grooveId] ?? null
export function setSublens(grooveId: string, sublens: number | null): void {
  const next = {...state.sublens}
  if (sublens === null) delete next[grooveId]
  else next[grooveId] = sublens
  change({...state, sublens: next})
}

/** Clip view says which clip it holds (frame/detail/clipGroove.ts), or none. */
export function publishPoolClip(clip: PoolClip | null): void {
  if (state.clip?.id === clip?.id && state.clip?.sourceRef === clip?.sourceRef) return
  change({...state, clip}, false)
}

/** Hot-swap (§16.5, §16.7): the clip tries the groove after the one it uses, round the pool. */
export function nextGroove(clipId: string): string | null {
  if (!state.grooves.length) return null
  const at = state.grooves.findIndex(g => g.id === state.chosen[clipId])
  return state.grooves[(at + 1) % state.grooves.length]!.id
}

/** For tests: an empty pool. */
export function resetPool(): void { change(EMPTY) }
