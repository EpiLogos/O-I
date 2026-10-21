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
import {useMemo} from 'react'
import {scopesOf, useHeldRead, useOwnerOp} from '../../owners/ownerCall'
import {kernelRead} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {GatewayRemotesReading, KernelOp, KernelTransportStatus, SeatStatusReading, SourceReturnsReading} from '../../../../../../desktop/cradle/src/kernel/types'
import {ownerReadings, scoped, useOwnerReading, type OwnerRead, type OwnerReadings, type OwnerReadingEntry} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'
import {ROUTE_WORDS, aikitReadOp, refusalWords, routeAnswerOf, workcellReadOp} from './ownerRoutes'
import type {AikitAnswer} from './aikitPages'
import type {ConnectionShows, WorkcellAnswer} from './workcellBindings'
import type {JournalAsk} from './mainTrackBindings'
import {PROCESS_RUNNING, usagePid} from './workcellMaterial'

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
    return {value: result.outcome.data, ...scopesOf(result.outcome)}
  }
}

/** One project's source returns through the kernel. */
export function readSourceReturnsOf(transport: KernelTransportStatus, project: string): OwnerRead<SourceReturnsReading> {
  return async () => {
    const down = unavailable(transport)
    if (down) return {error: down}
    const result = await kernelRead(transport, {op: 'source_returns_read', project})
    if (result.error || result.outcome?.result !== 'source_returns_reading') return {error: result.error ?? 'Central did not return its source returns.'}
    return {value: result.outcome.data, ...scopesOf(result.outcome)}
  }
}

/** AIKit's declared gateway remotes through the kernel. */
export function readGatewayRemotesOf(transport: KernelTransportStatus): OwnerRead<GatewayRemotesReading> {
  return async () => {
    const down = unavailable(transport)
    if (down) return {error: down}
    const result = await kernelRead(transport, {op: 'gateway_remotes_read'})
    if (result.error || result.outcome?.result !== 'gateway_remotes_reading') return {error: result.error ?? 'AIKit did not return its gateway remotes.'}
    return {value: result.outcome.data, ...scopesOf(result.outcome)}
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

// Lane W3's reads the Remote carrier and the Frames monitor take, each through the kernel's route to the owner's own command
// (desktop/cradle/kernel/src/owner_routes.rs; ownerRoutes.ts), held for the window as one read of several (owners/ownerCall.ts useHeldRead),
// read again on the spine's epoch and after any write:
//   - `workcell connections show <label> --json` for each connection `workcell status` lists (workcell_read {connections-show}): the
//     Remote carrier's grant, credential reference, remote software and since (workcellBindings.ts connectionFields);
//   - `aikit gateway ecology --json` (aikit_read {gateway-ecology}): the sessions the gateway serves, each with its harness and Streams;
//   - `aikit gateway replay --stream S [--after N] --json` (aikit_read {gateway-replay}): one Stream's frames from the gateway's journal.
// A refusal is the owner's words (ownerRoutes.ts refusalWords).

/** One owner route's read through the kernel's held reads: the reading, or the owner's words thrown. */
async function routeRead(transport: KernelTransportStatus, op: KernelOp, asked: string): Promise<{data: unknown; read_scopes?: readonly string[]}> {
  const down = unavailable(transport)
  if (down) throw new Error(down)
  const call = await kernelRead(transport, op)
  const answer = routeAnswerOf(call, asked)
  return {data: answer.data, ...scopesOf(call.outcome)}
}

/** Each listed connection's record (`workcell connections show`), by label: its answer or Workcell's refusal. None asked for no label. */
export function useConnectionShows(transport: KernelTransportStatus, labels: readonly string[]): ConnectionShows {
  // A plain record, not a Map: the window keeps answers across a relaunch as JSON (owners/keptReadings.ts).
  const reading = useHeldRead<Record<string, {value?: unknown; error?: string}>>(labels.length ? ['connections-show', transport, [...labels].sort()] : null, async () => {
    const shown = await Promise.all(labels.map(async label => {
      try { return [label, {value: (await routeRead(transport, workcellReadOp({kind: 'connections-show', label}), ROUTE_WORDS.connectionsShow)).data}] as const }
      catch (cause) { return [label, {error: cause instanceof Error ? cause.message : String(cause)}] as const }
    }))
    return Object.fromEntries(shown)
  })
  return useMemo(() => new Map(reading.status === 'answered' && reading.value ? Object.entries(reading.value) : []), [reading])
}

/** An owner route's held reading as the bindings take it (workcellBindings.ts WorkcellAnswer): AIKit's gateway ecology. */
export function useGatewayEcology(transport: KernelTransportStatus, enabled: boolean): WorkcellAnswer {
  const reading = useHeldRead<unknown>(enabled ? ['gateway-ecology', transport] : null, async () => {
    const read = await routeRead(transport, aikitReadOp({kind: 'gateway-ecology'}), ROUTE_WORDS.ecology)
    return scoped(read.data, read.read_scopes)
  })
  return useMemo((): WorkcellAnswer => ({status: reading.status, value: reading.value, error: reading.error}), [reading])
}

/** The frames of each Stream asked, from AIKit's gateway journal (`aikit gateway replay --stream S --after N --limit L`), by Stream ref: its
 * answer or AIKit's refusal in its words (the installed AIKit may not carry `gateway replay` yet: its refusal is the reason drawn). Nothing
 * is asked for no Stream. A plain record, kept as JSON across a relaunch (owners/keptReadings.ts). */
export function useGatewayReplays(transport: KernelTransportStatus, asks: readonly JournalAsk[]): ReadonlyMap<string, {value?: unknown; error?: string}> | undefined {
  const reading = useHeldRead<Record<string, {value?: unknown; error?: string}>>(asks.length ? ['gateway-replay', transport, asks.map(ask => [ask.stream, ask.after, ask.limit])] : null, async () => {
    const replayed = await Promise.all(asks.map(async ask => {
      try {
        const read = await routeRead(transport, aikitReadOp({kind: 'gateway-replay', stream: ask.stream, ...(ask.after > 0 ? {after: ask.after} : {}), limit: ask.limit}), ROUTE_WORDS.replay)
        return [ask.stream, {value: read.data}] as const
      } catch (cause) { return [ask.stream, {error: cause instanceof Error ? cause.message : String(cause)}] as const }
    }))
    return Object.fromEntries(replayed)
  })
  return useMemo(() => (reading.status === 'answered' && reading.value ? new Map(Object.entries(reading.value)) : undefined), [reading])
}

/** One AIKit reading (aikit_read, lane W3 round 3) held for the window, as aikitPages.ts maps it: AIKit's envelope `data`, or its refusal in
 * its words. `request` null reads nothing. */
export function useAikitRead(transport: KernelTransportStatus, request: Extract<KernelOp, {op: 'aikit_read'}>['request'] | null): AikitAnswer {
  const op = useMemo(() => (request ? ({op: 'aikit_read', request} as KernelOp) : null), [JSON.stringify(request)]) // eslint-disable-line react-hooks/exhaustive-deps
  const {reading} = useOwnerOp(transport, op, 'owner_route_reading')
  return useMemo(() => ({status: reading.status, value: reading.value?.data ?? null, error: reading.error ? refusalWords(reading.error) : null}), [reading])
}

/** One Workcell reading through the kernel's workcell_read (lane W10: doctor, discover, plan, instances list, connections probe), as the
 * bindings take it (workcellBindings.ts WorkcellAnswer, Workcell's refusal in its words), and the way to ask it again. Nothing is asked for
 * no request. */
export function useWorkcellRead(transport: KernelTransportStatus, request: Extract<KernelOp, {op: 'workcell_read'}>['request'] | null): {answer: WorkcellAnswer; refresh: () => void} {
  const op = useMemo(() => (request ? workcellReadOp(request) : null), [JSON.stringify(request)]) // eslint-disable-line react-hooks/exhaustive-deps
  const {reading, refresh} = useOwnerOp(transport, op, 'owner_route_reading')
  const answer = useMemo((): WorkcellAnswer => ({status: reading.status, value: reading.value?.data ?? null, error: reading.error ? refusalWords(reading.error) : null}), [reading])
  return {answer, refresh}
}

/** Each live harness instance's cost (`workcell instances usage <ref> --pid <its newest pid> --interval-ms 0`, workcell_read
 * {instances-usage}), by instance ref: Workcell's answer or its refusal. A plain record, kept as JSON across a relaunch. Nothing is asked
 * for no live instance. */
export function useInstanceUsages(transport: KernelTransportStatus, list: WorkcellAnswer): Record<string, {value?: unknown; error?: string}> {
  const live = useMemo(() => (list.status === 'answered' && list.value && typeof list.value === 'object' && Array.isArray((list.value as {instances?: unknown}).instances)
    ? ((list.value as {instances: unknown[]}).instances).flatMap(row => {
      const item = row as {instance_ref?: unknown; liveness?: unknown}
      const pid = row && typeof row === 'object' ? usagePid(row as Record<string, unknown>) : undefined
      return typeof item.instance_ref === 'string' && item.liveness === PROCESS_RUNNING ? [{ref: item.instance_ref, ...(pid !== undefined ? {pid} : {})}] : []
    }) : []), [list])
  const reading = useHeldRead<Record<string, {value?: unknown; error?: string}>>(live.length ? ['instances-usage', transport, live] : null, async () => {
    const read = await Promise.all(live.map(async ({ref, pid}) => {
      try { return [ref, {value: (await routeRead(transport, workcellReadOp({kind: 'instances-usage', instance_ref: ref, ...(pid !== undefined ? {pid} : {}), interval_ms: 0}), '`workcell instances usage`')).data}] as const }
      catch (cause) { return [ref, {error: cause instanceof Error ? cause.message : String(cause)}] as const }
    }))
    return Object.fromEntries(read)
  })
  return useMemo(() => (reading.status === 'answered' && reading.value ? reading.value : {}), [reading])
}
