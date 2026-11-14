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
import {centralRead, centralWrite} from './centralDeviceWrites'

export const RETURN_ACCEPT_ACTION = 'projectcentral.source.return_accept'
/** Central's reading of the person, whose identity source is the principal that accepts. */
export const PERSONAL_ANCHOR_ACTION = 'central.personal.anchor.inspect'

/** One return as Central lists it (the fields an acceptance needs). */
export interface SourceReturnRow {
  readonly return_ref?: unknown
  /** `central.source-return/v2`: a commissioned-maintenance Return (a proposal for a page of a project's human ground, as Play with Arm off
   * files one: centralDeviceWrites.ts proposeAgentAnswer), accepted on the person's credential in that mode. */
  readonly schema?: unknown
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
  const refused = rowRefusal(project, row)
  if (refused) return {refused}
  if (!acceptedByRef) return {refused: 'Approve: Central\'s personal anchor has not named the person (central.personal.anchor.inspect), and an acceptance names who accepts.'}
  return {input: {project: project!, return_ref: row!.return_ref as string, expected_revision: row!.basis_revision as string, acceptance: 'human-accepted', accepted_by_ref: acceptedByRef,
    ...(authorityRevision ? {expected_authority_revision: authorityRevision} : {})}}
}

/** Why a row cannot be accepted now, in words; null where it can be asked. Pure. */
function rowRefusal(project: string | null, row: SourceReturnRow | null): string | null {
  if (!project) return 'Approve: a return belongs to a project, and none is named here.'
  if (!row || typeof row.return_ref !== 'string' || !row.return_ref) return 'Approve: choose a returned proposal first.'
  if (row.status !== 'pending') return `Approve: ${row.return_ref} is ${String(row.status ?? 'not pending')}, so it waits for no acceptance.`
  if (typeof row.basis_revision !== 'string' || !row.basis_revision) return `Approve: Central lists no basis revision for ${row.return_ref}, so the acceptance cannot be checked against it.`
  if (typeof row.current_revision === 'string' && row.current_revision && row.current_revision !== row.basis_revision) {
    return `Approve: the source moved since the agent proposed this (its basis ${row.basis_revision}, now ${row.current_revision}); Central keeps the proposal pending and would refuse it. Ask for a fresh return.`
  }
  return null
}

/** Central's schema of a commissioned-maintenance Return. */
export const MAINTENANCE_RETURN = 'central.source-return/v2'

/** The input projectcentral.source.return_accept takes for a commissioned-maintenance Return (Central's source_return.rs: `acceptance:
 * commissioned-maintenance`, the authority's revision the acceptance is checked against, and `accepted_by_ref` the authenticated principal
 * itself), from Central's maintenance reading of it (`projectcentral.source.return_read` with that acceptance: `commissioned_maintenance`
 * {authority_revision, principal_refs}); `person`, where it is one of the principals Central names, is the one who accepts. Pure. */
export function maintenanceAcceptInput(project: string | null, row: SourceReturnRow | null, reading: unknown, person: string | null):
  {readonly input: Record<string, string>} | {readonly refused: string} {
  const refused = rowRefusal(project, row)
  if (refused) return {refused}
  const basis = (reading as {commissioned_maintenance?: {authority_revision?: unknown; principal_refs?: unknown}} | null)?.commissioned_maintenance
  const revision = typeof basis?.authority_revision === 'string' && basis.authority_revision ? basis.authority_revision : null
  if (!revision) return {refused: 'Approve: Central\'s reading of this proposal names no authority revision, so its acceptance cannot be checked against your grant.'}
  const principals = Array.isArray(basis?.principal_refs) ? basis.principal_refs.filter((ref): ref is string => typeof ref === 'string' && !!ref) : []
  const principal = person && principals.includes(person) ? person : principals.length === 1 ? principals[0] : null
  if (!principal) return {refused: principals.length ? `Approve: Central's authority grants this acceptance to ${principals.join(', ')}, and which of them you are is not known here.`
    : 'Approve: no grant of yours covers accepting in this project (Setup\'s Projects step extends it: central.ground.project.adopt).'}
  return {input: {project: project!, return_ref: row!.return_ref as string, expected_revision: row!.basis_revision as string, acceptance: 'commissioned-maintenance',
    accepted_by_ref: principal, expected_authority_revision: revision}}
}

/** Accept the return through Central. A commissioned-maintenance Return (`schema` v2) is read again in that mode first, for the authority
 * revision and the principal it is accepted by. Resolves with Central's receipt; throws the refusal, or Central's words. */
export async function acceptSourceReturn(transport: KernelTransportStatus, project: string | null, row: SourceReturnRow | null, acceptedByRef: string | null,
  authorityRevision?: string | null): Promise<unknown> {
  if (row?.schema === MAINTENANCE_RETURN && project && typeof row.return_ref === 'string') {
    const reading = await centralRead(transport, 'projectcentral.source.return_read', {project, return_ref: row.return_ref, acceptance: 'commissioned-maintenance'})
    const asked = maintenanceAcceptInput(project, row, reading, acceptedByRef)
    if ('refused' in asked) throw new Error(asked.refused)
    return centralWrite(transport, RETURN_ACCEPT_ACTION, asked.input, project)
  }
  const asked = returnAcceptInput(project, row, acceptedByRef, authorityRevision)
  if ('refused' in asked) throw new Error(asked.refused)
  return centralWrite(transport, RETURN_ACCEPT_ACTION, asked.input, project ?? undefined)
}

/** Approvals' Deny on a proposal (manual §19.14 "Approve, Changes or Deny"): Central declines a waiting return without touching its source
 * (`projectcentral.source.return_reject {project, return_ref}`, ctrl source_return.rs; the kernel's flow.rs source_return_reject reads the
 * same answer), through invoke_action as the person's press: the kernel carries the person's native credential for it (PERSON_ACTS), and
 * Central refuses a Deny without it (O-I #805). */
export const RETURN_REJECT_ACTION = 'projectcentral.source.return_reject'

/** Decline the return through Central. Resolves with Central's reading; throws the refusal, or Central's words. */
export async function rejectSourceReturn(transport: KernelTransportStatus, project: string | null, row: SourceReturnRow | null): Promise<unknown> {
  if (!project) throw new Error('Deny: a return belongs to a project, and none is named here.')
  if (!row || typeof row.return_ref !== 'string' || !row.return_ref) throw new Error('Deny: choose a returned proposal first.')
  return centralWrite(transport, RETURN_REJECT_ACTION, {project, return_ref: row.return_ref}, project)
}
