// The set's Groove Pool, Live's own (manual §16.7: "In Live the pool's other face is Live's own: Groove, Base, Quantize, Timing,
// Random and Velocity for each of the set's grooves, Global Amount at the foot … Each groove is the set's, read from it and written
// into it"). The owner is the set's (kernel live_groove_pool_read, live_groove_pool_write; packages/live-set/src/edit.rs reads and
// writes Live's GroovePool/Grooves/Groove and the Main track's GlobalGrooveAmount). Every write is made on the set's standing revision
// and refused in the owner's words when the file moved since; after any write, or a refusal, the set is read again (liveWrites.ts
// onRevision), and the pool with it. The pool's face draws on these; it holds no groove of its own.
import {useEffect, useState} from 'react'
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {LiveGrooveField, LiveGroovePool} from '../../../../../desktop/cradle/src/kernel/types'
import {subscribeSet} from '../native/application'
import {onRevision} from './liveWrites'

export type {LiveGroove, LiveGrooveField, LiveGroovePool} from '../../../../../desktop/cradle/src/kernel/types'

/** Base, in Live's own order (its Grid index): the words the owner reads and takes. */
export const GROOVE_BASES: readonly string[] = ['1/4', '1/8', '1/8t', '1/16', '1/16t', '1/32']

export interface LiveGrooves {
  /** The set's pool as the owner read it; null until read, or when nothing names a set. An empty pool has no grooves. */
  readonly pool: LiveGroovePool | null
  /** The owner's refusal of the read, in its words. */
  readonly error: string | null
}

/** The set's Groove Pool, read again whenever the set is (a write, Live saving it). Nothing while no set is open. */
export function useLiveGrooves(path: string | null): LiveGrooves {
  const [grooves, setGrooves] = useState<LiveGrooves>({pool: null, error: null})
  useEffect(() => {
    if (!path) { setGrooves({pool: null, error: null}); return }
    let live = true
    const read = () => {
      const transport = detectTransport()
      if (transport.kind === 'unavailable') { setGrooves({pool: null, error: transport.reason}); return }
      void kernelOp(transport, {op: 'live_groove_pool_read', path}).then(answer => {
        if (!live) return
        if (answer.error || answer.outcome?.result !== 'live_groove_pool_reading') setGrooves({pool: null, error: answer.error ?? 'The set\'s owner did not answer the groove pool'})
        else {
          const {revision: _revision, ...pool} = answer.outcome.reading
          setGrooves({pool, error: null})
        }
      })
    }
    read()
    const off = subscribeSet(path, read)
    return () => { live = false; off() }
  }, [path])
  return grooves
}

async function writePool(path: string, change: {groove?: number; field: LiveGrooveField | 'amount'; value: number | string}): Promise<LiveGroovePool> {
  return onRevision(path, async (expected_revision, transport) => {
    const answer = await kernelOp(transport, {op: 'live_groove_pool_write', path, expected_revision, ...change})
    if (answer.error || answer.outcome?.result !== 'live_groove_pool_reading') throw new Error(answer.error ?? 'The set\'s owner did not answer the groove pool')
    const {revision: _revision, ...pool} = answer.outcome.reading
    return pool
  })
}

/** Write one groove's setting: Base by its word (GROOVE_BASES), Quantize, Timing, Random or Velocity 0–100. Answers the pool. */
export function writeLiveGroove(path: string, groove: number, field: LiveGrooveField, value: number | string): Promise<LiveGroovePool> {
  return writePool(path, {groove, field, value})
}

/** Write the set's Global Amount (a percentage within the range the set keeps beside it). Answers the pool. */
export function writeLiveGlobalGroove(path: string, value: number): Promise<LiveGroovePool> {
  return writePool(path, {field: 'amount', value})
}
