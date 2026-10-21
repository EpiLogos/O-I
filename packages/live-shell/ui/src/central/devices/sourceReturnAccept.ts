// Approvals' Approve (manual §19.13; W2): a returned-work proposal accepted through Central's `projectcentral.source.return_accept` —
// one of the person's own presses the kernel carries through invoke_action (action.rs PERSON_ACTS; the owner's human grant names the
// action) — in the declared collaborative mode, `acceptance: human-accepted` (Work/Central/docs/SOURCE-RETURN.md: "The default
// human-accepted variant remains a caller declaration"). Its inputs come from the return's row as Central lists it
// (`projectcentral.source.returns`, central.source-returns/v1: return_ref, source_ref, basis_revision, status, current_revision) and from
// the person: `accepted_by_ref` is the person's principal — the identity source Central's personal anchor names
// (`central.personal.anchor.inspect` person.identity_source_path, as a root source ref: the principal the human grant of
// Control/user/native-action-authority.json carries). `expected_revision` is the proposal's basis: Central compares it with the immutable
// proposal and the current source, and refuses a moved source, leaving the proposal pending. `expected_authority_revision` is required
// only by the commissioned-maintenance mode, and is given where the caller holds it.
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {centralWrite} from './centralDeviceWrites'

export const RETURN_ACCEPT_ACTION = 'projectcentral.source.return_accept'
/** Central's reading of the person, whose identity source is the principal that accepts. */
export const PERSONAL_ANCHOR_ACTION = 'central.personal.anchor.inspect'

/** One return as Central lists it (the fields an acceptance needs). */
export interface SourceReturnRow {
  readonly return_ref?: unknown
  readonly basis_revision?: unknown
  readonly current_revision?: unknown
  readonly status?: unknown
}

/** The person's principal ref from Central's personal anchor (central.personal-anchor/v1 `person.identity_source_path`, a root source):
 * `central:source:control:root:<path>`. Null when the anchor names no identity source. Pure. */
export function personRefOf(anchor: unknown): string | null {
  const path = (anchor as {person?: {identity_source_path?: unknown}} | null)?.person?.identity_source_path
  return typeof path === 'string' && path && !path.startsWith('/') && !path.includes('..') ? `central:source:control:root:${path}` : null
}

/** The input projectcentral.source.return_accept takes for one pending return, accepted by the person; or why it cannot be asked now, in
 * words. Pure. */
export function returnAcceptInput(project: string | null, row: SourceReturnRow | null, acceptedByRef: string | null, authorityRevision?: string | null):
  {readonly input: Record<string, string>} | {readonly refused: string} {
  if (!project) return {refused: 'Approve: a return belongs to a project, and none is named here.'}
  if (!row || typeof row.return_ref !== 'string' || !row.return_ref) return {refused: 'Approve: choose a returned proposal first.'}
  if (row.status !== 'pending') return {refused: `Approve: ${row.return_ref} is ${String(row.status ?? 'not pending')}, so it waits for no acceptance.`}
  if (typeof row.basis_revision !== 'string' || !row.basis_revision) return {refused: `Approve: Central lists no basis revision for ${row.return_ref}, so the acceptance cannot be checked against it.`}
  if (typeof row.current_revision === 'string' && row.current_revision && row.current_revision !== row.basis_revision) {
    return {refused: `Approve: the source moved since the agent proposed this (its basis ${row.basis_revision}, now ${row.current_revision}); Central keeps the proposal pending and would refuse it. Ask for a fresh return.`}
  }
  if (!acceptedByRef) return {refused: 'Approve: Central\'s personal anchor has not named the person (central.personal.anchor.inspect), and an acceptance names who accepts.'}
  return {input: {project, return_ref: row.return_ref, expected_revision: row.basis_revision, acceptance: 'human-accepted', accepted_by_ref: acceptedByRef,
    ...(authorityRevision ? {expected_authority_revision: authorityRevision} : {})}}
}

/** Accept the return through Central. Resolves with Central's receipt; throws the refusal, or Central's words. */
export async function acceptSourceReturn(transport: KernelTransportStatus, project: string | null, row: SourceReturnRow | null, acceptedByRef: string | null,
  authorityRevision?: string | null): Promise<unknown> {
  const asked = returnAcceptInput(project, row, acceptedByRef, authorityRevision)
  if ('refused' in asked) throw new Error(asked.refused)
  return centralWrite(transport, RETURN_ACCEPT_ACTION, asked.input, project ?? undefined)
}
