/**
 * The Factory queue advancement join — the pure model of "a Return is
 * received, and the queue advances exactly once to the next queued Run".
 *
 * Owners write, faces read. This module writes nothing and dispatches
 * nothing. It is the conformance model the Factory owner's advancement
 * operation must match; that owner operation is not built yet (see the
 * T-FACTORY-2 receipt). A face may render an advance only from a receipt
 * the owner returned, never from this function's output.
 *
 * The snapshot is one owner-read, ordered queue of Runs. Exactly one item is
 * `running` at a time; the rest are `queued` or `done`. A Return names the
 * Run it came back for, the queue it belongs to, and the queue revision the
 * sender read.
 */

export type QueueItemState = 'queued' | 'running' | 'done'

export interface QueueItem {
  runRef: string
  state: QueueItemState
}

export interface AdvanceReceipt {
  queueRef: string
  returnRef: string
  runRef: string
  revisionBefore: number
  revisionAfter: number
  /** The Run now running, or null when the queue has drained. */
  advancedTo: string | null
}

export interface QueueSnapshot {
  queueRef: string
  /** Increases by exactly one for each applied advance. */
  revision: number
  items: QueueItem[]
  /** Applied returns keyed by return ref: the exactly-once record. */
  receipts: Record<string, AdvanceReceipt>
}

export interface ReturnEvent {
  queueRef: string
  returnRef: string
  runRef: string
  /** The queue revision the sender read before it received this Return. */
  expectedRevision: number
}

export type RefusalReason =
  | 'foreign-queue'
  | 'unknown-run'
  | 'not-running'
  | 'stale'
  | 'conflicting-replay'

export type AdvanceOutcome =
  | {outcome: 'applied'; snapshot: QueueSnapshot; receipt: AdvanceReceipt}
  | {outcome: 'already-applied'; snapshot: QueueSnapshot; receipt: AdvanceReceipt}
  | {outcome: 'refused'; reason: RefusalReason; ownerRef: string; message: string; snapshot: QueueSnapshot}

/** The first Run is running; the rest are queued, in the given order. */
export function startQueue(queueRef: string, runRefs: readonly string[]): QueueSnapshot {
  if (runRefs.length === 0) throw new Error(`Queue ${queueRef} has no Runs to advance through.`)
  if (new Set(runRefs).size !== runRefs.length) throw new Error(`Queue ${queueRef} names a Run more than once.`)
  return {
    queueRef,
    revision: 0,
    items: runRefs.map((runRef, index): QueueItem => ({runRef, state: index === 0 ? 'running' : 'queued'})),
    receipts: {},
  }
}

function refuse(snapshot: QueueSnapshot, reason: RefusalReason, message: string): AdvanceOutcome {
  return {outcome: 'refused', reason, ownerRef: snapshot.queueRef, message, snapshot}
}

/**
 * Receive one Return against a queue snapshot. Returns a new snapshot; the
 * input is never mutated. Order of checks: replay first (a duplicate Return
 * legitimately carries an old revision), then identity, then staleness.
 */
export function receiveReturn(snapshot: QueueSnapshot, event: ReturnEvent): AdvanceOutcome {
  if (event.queueRef !== snapshot.queueRef) {
    return refuse(snapshot, 'foreign-queue', `The Factory owner for queue ${snapshot.queueRef} does not hold this Return; it names queue ${event.queueRef}.`)
  }

  const prior = snapshot.receipts[event.returnRef]
  if (prior) {
    if (prior.runRef === event.runRef) return {outcome: 'already-applied', snapshot, receipt: prior}
    return refuse(snapshot, 'conflicting-replay', `Return ${event.returnRef} was already received for ${prior.runRef}; it cannot name ${event.runRef}.`)
  }

  if (!snapshot.items.some(item => item.runRef === event.runRef)) {
    return refuse(snapshot, 'unknown-run', `Run ${event.runRef} is not in queue ${snapshot.queueRef}.`)
  }

  const runningIndex = snapshot.items.findIndex(item => item.state === 'running')
  if (runningIndex < 0 || snapshot.items[runningIndex].runRef !== event.runRef) {
    return refuse(snapshot, 'not-running', `Run ${event.runRef} is not the running item in ${snapshot.queueRef}; its Return cannot advance this queue.`)
  }

  if (event.expectedRevision !== snapshot.revision) {
    return refuse(snapshot, 'stale', `The Return was read at queue revision ${event.expectedRevision}; ${snapshot.queueRef} is at ${snapshot.revision}. Re-read the queue before receiving it.`)
  }

  const nextIndex = snapshot.items.findIndex((item, index) => index > runningIndex && item.state === 'queued')
  const items = snapshot.items.map((item, index): QueueItem => {
    if (index === runningIndex) return {runRef: item.runRef, state: 'done'}
    if (index === nextIndex) return {runRef: item.runRef, state: 'running'}
    return item
  })
  const receipt: AdvanceReceipt = {
    queueRef: snapshot.queueRef,
    returnRef: event.returnRef,
    runRef: event.runRef,
    revisionBefore: snapshot.revision,
    revisionAfter: snapshot.revision + 1,
    advancedTo: nextIndex >= 0 ? items[nextIndex].runRef : null,
  }
  const next: QueueSnapshot = {
    queueRef: snapshot.queueRef,
    revision: receipt.revisionAfter,
    items,
    receipts: {...snapshot.receipts, [event.returnRef]: receipt},
  }
  return {outcome: 'applied', snapshot: next, receipt}
}
