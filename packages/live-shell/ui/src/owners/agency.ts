// The agency reading — AIKit's session spaces for a project (`agency_read`), each read 3–5 owner processes (the World when
// its 4 s horizon has lapsed, the session-space discovery, the harness disclosure). One answer for the window
// (owners/ownerReading.ts), read by the agent shell's sessions provider, the World cut's run lanes and the legacy hook.
//
// It used to be read every 3 s whatever happened, hidden or not. Now it is read when something says it may have moved:
//   - on mount, and when the spine's epoch moves (a new native access or World);
//   - when the person comes back to the window (sessions start and end outside the shell);
//   - after the shell's own acts that change sessions, on their receipt (`tellOwnerChanged({topic: 'agency'})`: a harness
//     control, a prepared session, a conversation turn sent or cancelled);
//   - on a kernel receipt that can move it (`receiptMovesAgency`: a working surface attaching to or releasing a session, a
//     routine's returned action);
//   - and otherwise at a floor, AGENCY_FLOOR_MS after the last completed read, only while the window can be seen — never while
//     it is hidden; coming back is a notice of its own.
// A notice that arrives while a read is in flight asks for one more read after it (the read may have started before the act).
//
// The driver is mounted once (AgentSessionsProvider); every other reader only subscribes.
//
// Ported from the provider's own cadence (agent/AgentSessionsProvider.tsx at 98385f92d, :97-140: `readAgency` behind the
// `agencyInFlight` guard, every 3 s) and the read itself (desktop/cradle/src/agency/agencySources.ts:25 `readAgency`); the
// floor's hidden rule follows the encounter loop's (desktop/cradle/src/encounter/session.ts `hidden()`).

import {readAgency} from '../../../../../desktop/cradle/src/agency/agencySources'
import type {AgencyReading} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import type {KernelReceipt, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {ownerReadings, useOwnerReading, type OwnerRead, type OwnerReading, type OwnerReadingEntry, type OwnerReadings} from './ownerReading'
import {onAttentionRegained, windowVisible} from './attention'
import {onOwnerChanged, receiptMovesAgency} from './notices'
import {useSpineEpoch} from './spine'

/** The floor for session changes nothing tells the shell about, while the window is seen. */
export const AGENCY_FLOOR_MS = 30_000
/** Coming back to the window reads again unless a read completed this recently (focus and visibility arrive together). */
export const AGENCY_ATTENTION_MIN_AGE_MS = 5_000

export const AGENCY_OP = 'agency_read'
export const agencyReadingKey = (transport: KernelTransportStatus, project: string): string => JSON.stringify([AGENCY_OP, transport, project])

export function readAgencyOf(transport: KernelTransportStatus, project: string): OwnerRead<AgencyReading> {
  return async () => {
    if (transport.kind === 'unavailable') return {error: transport.reason ?? 'Native transport unavailable'}
    const outcome = await readAgency(transport, project)
    return 'error' in outcome ? {error: outcome.error} : {value: outcome.reading}
  }
}

export function agencyEntry(transport: KernelTransportStatus, project: string, registry: OwnerReadings = ownerReadings): OwnerReadingEntry<AgencyReading> {
  return registry.entry(agencyReadingKey(transport, project), readAgencyOf(transport, project))
}

/** Subscribe to the window's agency answer (it is read on mount and the epoch; the provider's driver reads it again). */
export function useAgencyAnswer(transport: KernelTransportStatus, project: string) {
  const epoch = useSpineEpoch()
  return useOwnerReading(agencyReadingKey(transport, project), readAgencyOf(transport, project), epoch)
}

/** The sessions an agency answer names, as one comparable line: a change of it is the agency reading moving. */
export function agencyFingerprint(reading: AgencyReading | null): string {
  return JSON.stringify((reading?.rows ?? []).map(row => [row.spaceRef, row.sessionRef, row.purpose ?? null, row.agentRef ?? null]))
}

export interface AgencyDriverOptions {
  epoch: string
  floorMs?: number
  attentionMinAgeMs?: number
  now?: () => number
  visible?: () => boolean
  onAttention?: (listener: () => void) => () => void
  onTold?: (listener: (cause: string) => void) => () => void
  /** Each completed read, with what asked for it — the provider re-reads the selected session's task record on it. */
  onRead?: (reading: OwnerReading<AgencyReading>, cause: string) => void
}

export interface AgencyDriver {
  /** The spine's receipts as they stand; a new one that can move the agency reading is a notice. Idempotent. */
  observe(receipts: readonly KernelReceipt[]): void
  /** A notice: read now, or once more after the read in flight. */
  notice(cause: string): void
  stop(): void
}

/** The one agency cadence over `entry` under one epoch (a new epoch is a new driver). */
export function createAgencyDriver(entry: OwnerReadingEntry<AgencyReading>, options: AgencyDriverOptions): AgencyDriver {
  const {epoch} = options
  const floorMs = options.floorMs ?? AGENCY_FLOOR_MS
  const attentionMinAgeMs = options.attentionMinAgeMs ?? AGENCY_ATTENTION_MIN_AGE_MS
  const now = options.now ?? Date.now
  const visible = options.visible ?? windowVisible
  const onAttention = options.onAttention ?? onAttentionRegained
  const onTold = options.onTold ?? (listener => onOwnerChanged('agency', change => listener(change.cause)))
  let stopped = false
  let floor: ReturnType<typeof setTimeout> | null = null
  let again: string | null = null
  let lastSeq: number | null = null

  const armFloor = () => {
    if (floor !== null) clearTimeout(floor)
    floor = null
    if (stopped) return
    const from = entry.snapshot().readAtUnixMs ?? now()
    floor = setTimeout(() => {
      floor = null
      // Hidden: nothing is shown and nothing is read; the window's return reads.
      if (visible()) read('floor')
    }, Math.max(0, from + floorMs - now()))
  }

  /** After a completed read: the provider's hook, the floor counted from this read, and a notice that waited behind it. */
  const settled = (cause: string) => {
    if (stopped) return
    options.onRead?.(entry.snapshot(), cause)
    armFloor()
    if (again !== null) { const next = again; again = null; read(next) }
  }

  /** A read is in flight (ours, or one another reader asked for): the notice waits for it, then reads once more. */
  let waiting: (() => void) | null = null
  const afterInFlight = () => {
    if (waiting) return
    waiting = entry.subscribe(() => {
      if (entry.snapshot().refreshing || !waiting) return
      const off = waiting
      waiting = null
      off()
      if (again !== null) { const next = again; again = null; read(next) }
    })
  }

  const read = (cause: string) => {
    if (stopped) return
    if (entry.snapshot().refreshing) { again = cause; afterInFlight(); return }
    void entry.refresh(epoch).then(() => settled(cause))
  }

  const detach = [
    onAttention(() => {
      const age = entry.ageAt(now())
      if (age === null || age >= attentionMinAgeMs) read('window regained')
    }),
    onTold(cause => read(cause)),
  ]
  // The mount's read: an answer standing for this epoch is used as it stands, and the floor counts from it.
  void entry.ensure(epoch).then(() => settled('mount'))

  return {
    observe(receipts) {
      const highest = receipts.reduce((max, receipt) => Math.max(max, receipt.seq), 0)
      // The first observation takes what stands as already read; a kernel that restarted numbers from 1 again.
      if (lastSeq === null || highest < lastSeq) { lastSeq = highest; return }
      const fresh = receipts.filter(receipt => receipt.seq > (lastSeq ?? 0))
      lastSeq = highest
      const moving = fresh.find(receiptMovesAgency)
      if (moving) read(`kernel receipt ${moving.event}`)
    },
    notice: read,
    stop() {
      stopped = true
      if (floor !== null) clearTimeout(floor)
      floor = null
      for (const off of detach) off()
      if (waiting) { const off = waiting; waiting = null; off() }
    },
  }
}
