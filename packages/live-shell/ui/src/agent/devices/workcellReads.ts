// The three owner reads lane K1 gave the kernel (desktop/cradle/src/kernel/types.ts; 2aa4ffa39), each held once for the window in the
// shared owner readings (owners/ownerReading.ts), as owners/readers.ts holds the workcell and roster answers — ported from its
// readWorkcellOf/useWorkcellAnswer pattern (owners/readers.ts:157-161), one entry per op and its arguments:
//   - `seat_status_read` → central.workcell-status/v1, the seat instrument's own reading (`seat status --json`). It is slow (22–30 s on this
//     machine: lane K1's shapes/seat-status.time), so it is read once when first asked and again only on demand — never on the spine's
//     epoch, never polled. It feeds the Seat (workcellBindings.ts seatBinding) and Ground hygiene's seats (central/devices/groundDevices.ts);
//   - `source_returns_read` {project} → central.source-returns/v1, Central's returned-work proposals of one project (Central requires the
//     project: the root register refuses "project is required"). It feeds Approvals' proposals (receiptBindings.ts);
//   - `gateway_remotes_read` → aikit.gateway-remotes/v1, AIKit's declared gateway endpoints of the other Workcells. It feeds the Link's
//     endpoints and whether the link is joined (workcellBindings.ts linkBinding).
// A refusal is the owner's words, carried as the reading's error.
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {GatewayRemotesReading, KernelTransportStatus, SeatStatusReading, SourceReturnsReading} from '../../../../../../desktop/cradle/src/kernel/types'
import {ownerReadings, useOwnerReading, type OwnerRead, type OwnerReadings, type OwnerReadingEntry} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'

const unavailable = (transport: KernelTransportStatus): string | null => (transport.kind === 'unavailable' ? transport.reason ?? 'Transport unavailable' : null)

export const SEAT_STATUS_OP = 'seat_status_read'
export const SOURCE_RETURNS_OP = 'source_returns_read'
export const GATEWAY_REMOTES_OP = 'gateway_remotes_read'

export const seatStatusKey = (transport: KernelTransportStatus): string => JSON.stringify([SEAT_STATUS_OP, transport])
export const sourceReturnsKey = (transport: KernelTransportStatus, project: string): string => JSON.stringify([SOURCE_RETURNS_OP, transport, project])
export const gatewayRemotesKey = (transport: KernelTransportStatus): string => JSON.stringify([GATEWAY_REMOTES_OP, transport])

/** The seat instrument's reading through the kernel. */
export function readSeatStatusOf(transport: KernelTransportStatus): OwnerRead<SeatStatusReading> {
  return async () => {
    const down = unavailable(transport)
    if (down) return {error: down}
    const result = await kernelRead(transport, {op: 'seat_status_read'})
    if (result.error || result.outcome?.result !== 'seat_status_reading') return {error: result.error ?? 'The seat instrument did not return its status reading.'}
    return {value: result.outcome.data}
  }
}

/** One project's source returns through the kernel. */
export function readSourceReturnsOf(transport: KernelTransportStatus, project: string): OwnerRead<SourceReturnsReading> {
  return async () => {
    const down = unavailable(transport)
    if (down) return {error: down}
    const result = await kernelRead(transport, {op: 'source_returns_read', project})
    if (result.error || result.outcome?.result !== 'source_returns_reading') return {error: result.error ?? 'Central did not return its source returns.'}
    return {value: result.outcome.data}
  }
}

/** AIKit's declared gateway remotes through the kernel. */
export function readGatewayRemotesOf(transport: KernelTransportStatus): OwnerRead<GatewayRemotesReading> {
  return async () => {
    const down = unavailable(transport)
    if (down) return {error: down}
    const result = await kernelRead(transport, {op: 'gateway_remotes_read'})
    if (result.error || result.outcome?.result !== 'gateway_remotes_reading') return {error: result.error ?? 'AIKit did not return its gateway remotes.'}
    return {value: result.outcome.data}
  }
}

/** The slow read's epoch: it is read once, and again only when a reader asks (`refresh`/`retry`), never on the spine's epoch. */
const ONCE = 'once'

/** The seat instrument's entry in the shared readings, for a reader outside React (Ground hygiene's census). */
export const seatStatusEntry = (transport: KernelTransportStatus, registry: OwnerReadings = ownerReadings): OwnerReadingEntry<SeatStatusReading> =>
  registry.entry(seatStatusKey(transport), readSeatStatusOf(transport))
export {ONCE as SEAT_STATUS_EPOCH}

/** The seat instrument's reading, shared; `enabled` false defers it (nothing subscribes, nothing is asked). */
export function useSeatStatusAnswer(transport: KernelTransportStatus, enabled = true) {
  return useOwnerReading(enabled ? seatStatusKey(transport) : null, readSeatStatusOf(transport), ONCE)
}

/** One project's source returns, shared; read again on the spine's epoch (an act that may have returned work). */
export function useSourceReturnsAnswer(transport: KernelTransportStatus, project: string | null) {
  const epoch = useSpineEpoch()
  return useOwnerReading(project ? sourceReturnsKey(transport, project) : null, readSourceReturnsOf(transport, project ?? ''), epoch)
}

/** AIKit's declared gateway remotes, shared; read again on the spine's epoch. */
export function useGatewayRemotesAnswer(transport: KernelTransportStatus) {
  const epoch = useSpineEpoch()
  return useOwnerReading(gatewayRemotesKey(transport), readGatewayRemotesOf(transport), epoch)
}
