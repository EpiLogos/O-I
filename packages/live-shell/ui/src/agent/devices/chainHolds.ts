// The hold store (split from designBindings.ts so the frame's first load carries it without the device bindings, O-I #740):
// what the hand holds before an owner is asked, one store for the chain, the pool, the pane and the rail.
import {useSyncExternalStore} from 'react'
import type {Value} from '../../frame/devices/designed'

// What the hand holds before an owner is asked. One store for the chain, so the chain, the pool, the pane and the rail draw the
// same hold. Nothing here is an owner reading; each hold ends when the owner answers the act it waits for.

export type ComposeScope = 'home' | 'project' | 'session'
export interface ComposePlan {readonly changeset: unknown; readonly plans: readonly unknown[]}

export interface ChainHolds {
  /** The composer's text, and the last line an owner accepted from it (the shell's record of what it sent). */
  readonly composer: {readonly draft?: string; readonly sent?: string}
  /** The composition before Apply: your requests by member, the scope and profile it applies under, and the owner's plan once
   * previewed (§19.6 "A change applies only after Preview and Apply"). */
  readonly compose: {
    readonly requests: Readonly<Record<string, boolean>>
    readonly scope?: ComposeScope
    readonly profile?: string
    readonly target?: string
    readonly plan?: ComposePlan
  }
  /** A raised reach waiting for Confirm (DEVICE-UI §5.2). */
  readonly reachPending?: number
  /** The member device's asks: a review before Trust, a run after its preflight. */
  readonly member: {readonly reviewAsk?: boolean; readonly run?: 'asked'}
  /** Each device's view-held keys, by device id (DesignBinding.local): what the person chose of a device's own view — the Thread's
   * pin and filters, the rack's chosen chain, the Frames monitor's filters — never an owner reading and never sent to one. */
  readonly views: Readonly<Record<string, Readonly<Record<string, Value>>>>
}

const EMPTY: ChainHolds = Object.freeze({composer: {}, compose: {requests: {}}, member: {}, views: {}})
let holds: ChainHolds = EMPTY
const listeners = new Set<() => void>()

export const chainHolds = (): ChainHolds => holds
export function updateHolds(change: (was: ChainHolds) => ChainHolds): void {
  const next = change(holds)
  if (next === holds) return
  holds = next
  for (const listener of [...listeners]) listener()
}
export function subscribeHolds(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function resetHolds(): void { updateHolds(() => EMPTY) }
/** Set (or drop, with undefined) one view-held key of one device. */
export function holdView(id: string, key: string, value: Value | undefined): void {
  updateHolds(was => {
    const view = was.views[id] ?? {}
    if (view[key] === value || (value === undefined && !(key in view))) return was
    const next: Record<string, Value> = {...view}
    if (value === undefined) delete next[key]; else next[key] = value
    return {...was, views: {...was.views, [id]: next}}
  })
}
/** One device's view-held keys. */
export const viewHolds = (held: ChainHolds, id: string): Readonly<Record<string, Value>> => held.views[id] ?? {}
export function useChainHolds(): ChainHolds {
  return useSyncExternalStore(subscribeHolds, chainHolds, chainHolds)
}
