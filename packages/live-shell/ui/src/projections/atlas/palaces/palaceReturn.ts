// The Palace's Return on its route (O-I 761; manual §17.7 Return: "The Palace sends the objects in the order you arranged them, with
// your intent for each room. It sends them to the route that the reading names for new knowledge. The owner of the sources receives a
// proposal that carries your name. The owner accepts it or not."; Rules: "Return is a proposal. It does not write to a source. It
// carries the name of its author." and "A private room is under cloud for every audience but you, and for every portal and every
// export"). Pure: the request the Palace sends and the checks on what the owner answers. No transport, no store.
//
// The route: Central's receiving. The register's reading names it (wikiReadingProvider.ts knowledgeReturnAction: `central.receiving.submit`,
// governed-write), and it is the wiki's own door — "the return is the only door in … At the root register … the native
// `central.receiving.*` path — submit, human review, include" (the central-wiki-return skill). A Palace's Return is a request Return of
// kind proposal: it targets no document, names the sources' owner it is proposed to (`proposed_owner_ref`) and the reading it was made
// from (`proposal_ref`), and Central authenticates its carrier, the person, as its author: that is "your name", read back from the owner,
// never written by the Palace. The owner's acceptance is `central.receiving.review` (accepted or rejected), its receipt the record
// `central.receiving.read` returns. Run against the real owner on a scratch root (ctrl, 28 Oct 2026): submit answers
// `central.receiving-reading/v1` with `record.kind: request`, `record.author` the authenticated principal and `status: pending`; review
// answers `status: accepted` with `review.reviewer_ref`; read returns the same.
//
// Ported, not recreated: the submission and its read-back are nativeReturn.ts's (desktop/cradle/src/nara/nativeReturn.ts
// proposeAnswerForDay :269-295 — the request shape, the producer key, the reading checked against what was sent, validateDayQuotation
// :238); the decision and its read-back are ContributionPanel.tsx's (desktop/cradle/src/explore/ContributionPanel.tsx:114 decide — a review
// pinned to the Return's revision, then the owner's reading). The FNV digest is composition.ts's (sanitiseSuffix :105-113).

import type {ReceivingRequest} from '../../../../../../../desktop/cradle/src/receiving/client'
import type {PalaceReturnProposal} from '../../../../../../../desktop/cradle/src/techne/m0m5/palace/return'
import type {TechneReading} from '../../../../../../../desktop/cradle/src/techne/contract'
import type {PalaceRoom} from './palacesModel'

/** The one route a Palace carries its Return on: Central's receiving, the wiki's door. */
export const PALACE_RETURN_ROUTE = 'central.receiving.submit'

/** Central's bounds on a request Return (Central ctrl continuous_work/receiving.rs: a subject is one line of at most 280 bytes, a body
 * at most 16 KiB, a summary at most 8 KiB, at most 128 evidence refs). */
const SUBJECT_BYTES = 280, BODY_BYTES = 16 * 1024, EVIDENCE_REFS = 128

const KIND_WORDS: Readonly<Record<PalaceRoom['kind'], string>> = {overview: 'the overview', constellation: 'a constellation', region: 'a region', scene: 'a Scene'}

const bytes = (text: string) => new TextEncoder().encode(text).length

/** Cut text to a byte budget at a character boundary, marking the cut. */
function bounded(text: string, budget: number): string {
  if (bytes(text) <= budget) return text
  let out = text
  while (out.length && bytes(`${out}…`) > budget) out = out.slice(0, -1)
  return `${out}…`
}

/** composition.ts sanitiseSuffix's FNV-1a, as hex: the same content always names the same Return. */
function fnv(text: string): string {
  let a = 2166136261
  for (let index = 0; index < text.length; index += 1) a = Math.imul(a ^ text.charCodeAt(index), 16777619) >>> 0
  return a.toString(16).padStart(8, '0')
}

/** What a room holds, as the Return sends it: its one Expression, then its subjects, in the room's own order. */
function objectsOf(room: PalaceRoom): string[] {
  return [...(room.holds ? [room.holds.title] : []), ...room.members.map(member => member.title)]
}

/** One room's line in the Return: its place on your path, its name and kind, and what it holds, in order. A private room sends nothing of
 * itself: it is under cloud for every export. */
export function returnLine(room: PalaceRoom, index: number): string {
  if (room.private) return `${index + 1}. A private room, under cloud: nothing of it is sent.`
  const objects = objectsOf(room)
  return `${index + 1}. ${room.name} (${KIND_WORDS[room.kind]}): ${objects.length ? objects.join('; ') : 'nothing in it yet'}.`
}

/** The refs a Return carries as evidence: the composed refs the routing law shaped, without any a private room holds. */
function evidenceOf(proposal: PalaceReturnProposal, rooms: readonly PalaceRoom[]): string[] {
  const clouded = new Set(rooms.filter(room => room.private).flatMap(room => [room.key, ...room.members.map(member => member.subject_ref), ...(room.holds ? [room.holds.expression_ref] : [])]))
  const composed = (proposal.route?.input as {composed_refs?: unknown} | undefined)?.composed_refs
  return (Array.isArray(composed) ? composed : []).filter((ref): ref is string => typeof ref === 'string' && !!ref.trim() && ref.length <= 4096 && !clouded.has(ref)).slice(0, EVIDENCE_REFS)
}

/** Who owns the sources a palace's reading stands on: the source its reading names as its basis, else its subject. */
export function sourcesOwnerOf(reading: TechneReading): string {
  return reading.snapshot?.basis_ref ?? reading.subject.subject_ref
}

/** The request Return the Palace sends: the rooms in the order you arranged them, each with what it holds, as one proposal to the
 * sources' owner, made from this reading. `now` is the second it is sent (Central keeps it as the occurrence). Null when the proposal
 * routes nothing, or routes it somewhere other than Central's receiving. Pure. */
export function palaceReturnAsk(input: {palace: string; rooms: readonly PalaceRoom[]; reading: TechneReading; proposal: PalaceReturnProposal; now: number}):
  Extract<ReceivingRequest, {kind: 'ask'}> | null {
  const {palace, rooms, reading, proposal} = input
  if (!proposal.route || !proposal.receipt?.routed || proposal.route.action_ref !== PALACE_RETURN_ROUTE) return null
  const subject = bounded(`Return from ${palace}: ${rooms.length} room${rooms.length === 1 ? '' : 's'} in your order`.replace(/\s+/g, ' '), SUBJECT_BYTES)
  const body = bounded([
    `The rooms of ${palace}, in the order you arranged them, each with what it holds:`,
    ...rooms.map(returnLine),
    `Made from reading ${reading.reading_ref}; the sources are not changed by this proposal.`,
  ].join('\n'), BODY_BYTES)
  const owner = sourcesOwnerOf(reading)
  const occurred = Math.floor(input.now / 1000)
  return {
    kind: 'ask', producer_key: `palace-return:${fnv(JSON.stringify([owner, reading.reading_ref, subject, body]))}:${occurred}`, occurred_at_unix_seconds: occurred,
    request: {kind: 'proposal', subject, body, proposed_owner_ref: owner, proposal_ref: reading.reading_ref},
    summary: bounded(`A Palace Return from ${palace}: ${rooms.length} rooms, proposed to ${owner}.`, 8192),
    evidence_refs: evidenceOf(proposal, rooms),
  }
}

/** A Return the owner holds: its ref and revision, who it names as its author, whom it is proposed to, and where it stands. */
export interface PalaceReturnSent {
  readonly return_ref: string
  readonly revision: string
  readonly author: string
  readonly owner: string
  readonly status: string
}

type Reading = {schema?: unknown; return_ref?: unknown; revision?: unknown; record?: {kind?: unknown; status?: unknown; author?: {principal_ref?: unknown};
  request?: {kind?: unknown; proposed_owner_ref?: unknown; proposal_ref?: unknown} | null; review?: {disposition?: unknown; reviewer_ref?: unknown; reviewed_at_unix_seconds?: unknown} | null}}

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0

/** The owner's answer to the submission, checked against what was sent (validateDayQuotation's law): a request Return of kind proposal,
 * to the same owner, from the same reading, with an author the owner authenticated. Throws the mismatch in words. */
export function palaceReturnSent(raw: unknown, sent: Extract<ReceivingRequest, {kind: 'ask'}>): PalaceReturnSent {
  const reading = raw as Reading | null
  const record = reading?.record
  if (reading?.schema !== 'central.receiving-reading/v1' || !text(reading.return_ref) || !text(reading.revision) || !record) throw Error('Central did not answer with its reading of the Return')
  if (record.kind !== 'request' || record.request?.kind !== 'proposal' || record.request.proposed_owner_ref !== sent.request.proposed_owner_ref
    || record.request.proposal_ref !== sent.request.proposal_ref) throw Error('Central holds a different Return under this producer key')
  if (!text(record.author?.principal_ref)) throw Error('Central names no author for the Return')
  return {return_ref: reading.return_ref, revision: reading.revision, author: record.author.principal_ref, owner: String(record.request.proposed_owner_ref), status: String(record.status)}
}

/** The owner's decision read back: the same Return, at the disposition asked, with the reviewer the owner authenticated. The receipt's
 * line names them. Throws when the owner's reading says anything else. */
export function palaceReturnDecided(raw: unknown, sent: PalaceReturnSent, disposition: 'accepted' | 'rejected'): {line: string; receipt: {return_ref: string; revision: string; reviewer: string}} {
  const reading = raw as Reading | null
  const record = reading?.record
  if (reading?.schema !== 'central.receiving-reading/v1' || reading.return_ref !== sent.return_ref || !text(reading.revision) || !record) throw Error('Central did not read back this Return')
  if (record.status !== disposition || record.review?.disposition !== disposition) throw Error(`Central reads the Return as ${String(record.status)}, not ${disposition}`)
  if (!text(record.review.reviewer_ref)) throw Error('Central names no reviewer for the decision')
  const reviewer = record.review.reviewer_ref
  const line = disposition === 'accepted'
    ? `Accepted: ${sent.owner} keeps ${sent.return_ref} as accepted, by ${reviewer} (revision ${reading.revision}). The sources are unchanged; the knowledge waits on its owner.`
    : `Refused: ${sent.owner} keeps ${sent.return_ref} as rejected, by ${reviewer}. Nothing changed in the sources.`
  return {line, receipt: {return_ref: sent.return_ref, revision: reading.revision, reviewer}}
}
