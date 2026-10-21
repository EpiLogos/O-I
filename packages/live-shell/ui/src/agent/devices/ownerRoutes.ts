// The kernel's routes to the owners' own commands (lane W3, desktop/cradle/kernel/src/owner_routes.rs; T-COVERAGE §1.2), as Factory's devices
// write and read through them. Each route runs the owner's own command and answers `owner_route_reading` {route, data, warnings}: the owner
// command in plain words, its reading verbatim. A refusal is the owner's words in the kernel's Error envelope, unwrapped to its message
// (desktop/cradle/src/contributions/factory/development.ts ownerRefusalText) where a person reads it.
//   - A write goes through kernelOp, never a held read (central/devices/centralDeviceWrites.ts centralWrite is the idiom): gateway_write,
//     workcell_write, seat_write and aikit_write are writing ops (desktop/cradle/src/kernel/bridge.ts WRITING_OPS), so a completed one
//     retires every held answer of the window, and the kernel's `owner_changed` receipt (owners/notices.ts OWNER_WRITE_RECEIPTS) moves the
//     temporal field: every reader asks its owner again.
//   - A read is a held answer for the window (owners/ownerCall.ts useOwnerOp, the knowledge route's idiom), read again on the spine's epoch
//     and after any write.
// Pure of React, apart from what the hooks module (useOwnerOp) gives.
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {ownerRefusalText} from '../../../../../../desktop/cradle/src/contributions/factory/development'
import type {
  AikitReadRequest, AikitWriteRequest, GatewayWriteRequest, KernelOp, KernelTransportStatus, SeatWriteRequest, WorkcellReadRequest, WorkcellWriteRequest,
} from '../../../../../../desktop/cradle/src/kernel/types'

/** What an owner route answers: the owner command in plain words and its reading, verbatim. */
export interface OwnerRouteAnswer {
  readonly route: string
  readonly data: unknown
}

/** The owner's words from a kernel refusal: the Error envelope's message, else the words as they came. */
export const refusalWords = (error: string): string => ownerRefusalText(error)

/** One owner route's answer from a kernel call: the reading, or the owner's refusal thrown in its words. */
export function routeAnswerOf(call: {readonly outcome: unknown; readonly error?: string}, asked: string): OwnerRouteAnswer {
  if (call.error) throw new Error(refusalWords(call.error))
  const outcome = call.outcome as {result?: unknown; route?: unknown; data?: unknown} | null
  if (outcome?.result !== 'owner_route_reading') throw new Error(`${asked} did not answer with its owner's reading.`)
  return {route: typeof outcome.route === 'string' ? outcome.route : asked, data: outcome.data}
}

/** One write through an owner route (kernelOp: the window's readings are asked again behind it). Throws the owner's words. */
export async function ownerRouteWrite(transport: KernelTransportStatus, op: KernelOp, asked: string): Promise<OwnerRouteAnswer> {
  if (transport.kind === 'unavailable') throw new Error(`The kernel carrier is unavailable, so ${asked} cannot be asked: ${transport.reason ?? 'no transport'}.`)
  return routeAnswerOf(await kernelOp(transport, op), asked)
}

/** The writes the kernel routes, each in its owner's own request (desktop/cradle/src/kernel/types.ts). */
export const gatewayWriteOp = (request: GatewayWriteRequest): KernelOp => ({op: 'gateway_write', request})
export const seatWriteOp = (request: SeatWriteRequest): KernelOp => ({op: 'seat_write', request})
export const workcellWriteOp = (request: WorkcellWriteRequest): KernelOp => ({op: 'workcell_write', request})
export const aikitWriteOp = (request: AikitWriteRequest): KernelOp => ({op: 'aikit_write', request})
/** The reads. */
export const workcellReadOp = (request: WorkcellReadRequest): KernelOp => ({op: 'workcell_read', request})
export const aikitReadOp = (request: AikitReadRequest): KernelOp => ({op: 'aikit_read', request})

/** The plain words of each write, for a refusal that names the command it could not ask. */
export const ROUTE_WORDS = {
  send: '`aikit gateway send`',
  delegate: '`aikit gateway delegate`',
  join: '`seat join`',
  release: '`seat release`',
  trust: '`aikit trust record`',
  connectionsShow: '`workcell connections show`',
  ecology: '`aikit gateway ecology`',
  replay: '`aikit gateway replay`',
} as const

/** The desktop's own actor, as the kernel attributes the person's file writes (desktop/cradle/kernel/src/files.rs `oi-desktop-user`), and
 * as the Deck names its acts when no identity is current (inhabitants/ql/devices/practiceLaunch.ts). */
export const DESKTOP_ACTOR = 'oi-desktop-user'

/** The desk's actor for an attributed claim: the person's ref when an identity is current, else the desktop's own actor — the Deck's rule
 * (practiceLaunch.ts `person ?? DESKTOP_ACTOR`). Pure. */
export const deskActorOf = (personRef: string | null | undefined): string => (typeof personRef === 'string' && personRef.trim() ? personRef : DESKTOP_ACTOR)
