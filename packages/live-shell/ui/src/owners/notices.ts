// What tells the shell an owner's answer may have changed — the notices its readers re-read on, so that no reader has to ask
// on a timer that outruns the owner. Three kinds, none invented here:
//
//   1. The kernel's own receipts (the event topic the kernel pushes, `oi:kernel-event`, published on the spine as
//      `WorkspaceReading.receipts` by native/Foundation.tsx `receive`). A receipt names what the kernel changed; the
//      classifiers below say which receipts can move which owner's answer, by the receipt's own fields.
//   2. The shell's own acts, after their receipt: an act that changes sessions (a harness control, a prepared session, a
//      conversation turn) tells the agency readers with `tellOwnerChanged`. The notice travels as a window event so the
//      shared engine's acts (desktop/cradle) can raise it without importing the shell; the name is `OWNER_CHANGED_EVENT`.
//   3. The window's attention (owners/attention.ts) — coming back to the window — and the spine's epoch (owners/spine.ts).
//
// The receipt kinds are the kernel's own (desktop/cradle/kernel/src/events.rs:94-200 `KernelEvent`); the instant rule is
// temporal_sources.rs `kernel_receipt_to_event` (only `observed_at_unix_ms` gives a kernel event a civil instant).
//
// Pure TypeScript: no view, no store.

import type {KernelReceipt} from '../../../../../desktop/cradle/src/kernel/types'

/** The window event an act raises after its receipt. desktop/cradle raises it by this literal (encounter/session.ts). */
export const OWNER_CHANGED_EVENT = 'oi:owner-changed'

/** Which owner's answer moved: the agency reading (sessions, their tasks), or the temporal field (Day, NOW, runs). */
export type OwnerTopic = 'agency' | 'temporal'

export interface OwnerChange {
  topic: OwnerTopic
  /** What happened, in words, for the reader's own disclosure. */
  cause: string
  /** The session the act was about, when it was about one. */
  agentSession?: string
}

/** Raise the notice after an act's receipt. Outside a window (a test without a DOM) it is a no-op. */
export function tellOwnerChanged(change: OwnerChange): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return
  window.dispatchEvent(new CustomEvent<OwnerChange>(OWNER_CHANGED_EVENT, {detail: change}))
}

/** The shared engine's own receipt that a session was prepared (desktop/cradle/src/agency/NativeAgentLauncher.tsx,
 * workspace/settings/sections/HarnessesSection.tsx raise it after the owner answered): an agency notice, reused as it is. */
export const SESSION_PREPARED_EVENT = 'oi:agent-session-prepared'

/** Listen for one topic's notices. */
export function onOwnerChanged(topic: OwnerTopic, listener: (change: OwnerChange) => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {}
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<OwnerChange>).detail
    if (detail && detail.topic === topic) listener(detail)
  }
  const prepared = (event: Event) => {
    const detail = (event as CustomEvent<{ref?: unknown}>).detail
    listener({topic: 'agency', cause: 'a session was prepared', ...(typeof detail?.ref === 'string' ? {agentSession: detail.ref} : {})})
  }
  window.addEventListener(OWNER_CHANGED_EVENT, handler)
  if (topic === 'agency') window.addEventListener(SESSION_PREPARED_EVENT, prepared)
  return () => {
    window.removeEventListener(OWNER_CHANGED_EVENT, handler)
    if (topic === 'agency') window.removeEventListener(SESSION_PREPARED_EVENT, prepared)
  }
}

// ---- which receipts move which answer --------------------------------------------------------------------------------

/** The grounds the temporal field reads (desktop/cradle/kernel/src/temporal_sources.rs `read_field`): the NOW field — its
 * clearings, their thoughts and the Day's lifecycle records, at the root and in every ProjectCentral register —, the wiki's
 * returns, and the civil time policy the field's days are derived under. A file or source change under one of them can move
 * the field. The Day document itself (Control/user/day) is not one: the field reads no stream from it; the Day's boundary
 * moves the window, which the poll reads at (UTC midnight). */
const TEMPORAL_GROUNDS = [/(?:^|\/)agents\/now\//, /(?:^|\/)agents\/wiki\/returns(?:\/|$)/, /(?:^|\/)user\/civil-time-policy\.json$/]

function changedPath(receipt: KernelReceipt): string | null {
  if (receipt.event === 'file_changed' && typeof receipt.path === 'string') return receipt.path
  if (receipt.event === 'source_changed') {
    const source = receipt.source as {ref?: unknown} | undefined
    return typeof source?.ref === 'string' ? source.ref : null
  }
  return null
}

/** A receipt that can move the temporal field's answer. `working_surface_driving` is the one kernel event that carries an
 * instant (`observed_at_unix_ms`), so it lands inside a window on the kernel-event-log stream; a routine's returned action can
 * write NOW and Factory runs; a file or source change counts only under a ground the field reads. Every other receipt either
 * carries no instant (a window never answers it) or changes nothing the field reads. */
export function receiptMovesTemporal(receipt: KernelReceipt): boolean {
  if (receipt.event === 'working_surface_driving' || receipt.event === 'routine_action_returned') return true
  const path = changedPath(receipt)
  return !!path && TEMPORAL_GROUNDS.some(ground => ground.test(path))
}

/** A receipt that can move the agency reading: a working surface attaching to or releasing an agent session, or a routine's
 * returned action (a routine runs agents). The kernel pushes nothing else about sessions. */
export function receiptMovesAgency(receipt: KernelReceipt): boolean {
  return receipt.event === 'working_surface_driving' || receipt.event === 'routine_action_returned'
}
