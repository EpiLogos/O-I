// The spine's notice for owner readers (WORLD-SHELL-DESIGN §2): an answer belongs to the kernel epoch and the world context
// it was read in. When either moves, every held answer and every remembered refusal is retired and read again; while they
// stand, an answer stands until something tells its reader it may have changed.
//
// The epoch is the access generation shell/workspace.tsx bumps on every new native access or transport (`accessEpoch`); the
// world context is the workspace book's `context.world` (cradle workspace/store.ts WorldContext). Both are read, never held.
// A reader inside the shell's providers reads them there and publishes the key it read; a reader the shell mounts in a root
// of its own (a projection module's pane, e.g. central/documents/CentralDocumentPane.tsx) has no provider above it and reads
// the published key, so it retires its answers on the same epoch as everything else.

// It reads the spine exactly as projections/encounterBridge.ts:39-60 does (the workspace's `accessEpoch`, the book's
// `context.world`) and keeps its epoch guard's meaning: an answer read under a retired epoch is never delivered as current.
import {useContext, useEffect, useSyncExternalStore} from 'react'
import {Workspace} from '../shell/workspaceContext'
import {useOptionalContinuity} from '../continuity/workspace'

/** The spine key one answer is read under. Pure, so a store outside React keys on the same words. */
export function spineEpochKey(accessEpoch: number, world: string | undefined | null): string {
  return `${accessEpoch}|${world ?? 'central'}`
}

let published = spineEpochKey(0, null)
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => published

/** The key a provider-held reader read, for the readers in roots of their own. */
export function publishSpineEpoch(key: string): void {
  if (key === published) return
  published = key
  for (const listener of [...listeners]) listener()
}

/** The current spine key: the providers' when they stand above the reader, else the last one a provider-held reader
 * published (a constant in a fixture or a test, where nothing moves the epoch). */
export function useSpineEpoch(): string {
  const workspace = useContext(Workspace)
  const book = useOptionalContinuity()
  const outside = useSyncExternalStore(subscribe, snapshot, snapshot)
  const inside = workspace ? spineEpochKey(workspace.accessEpoch, book?.current.context?.world) : null
  useEffect(() => { if (inside) publishSpineEpoch(inside) }, [inside])
  return inside ?? outside
}
