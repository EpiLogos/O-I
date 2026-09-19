/**
 * The typed relation proposal path (L5 Technē M1′, QL-MEF #214) — Canvas as
 * a relation-AUTHORING surface that never mutates semantics itself.
 *
 * The law this module keeps (issue #214 §4; dual-reading lock §7):
 *   - the relation TYPE is chosen from the authority the reading actually
 *     discloses — the provider's own relation vocabulary in use on this
 *     whole. A type outside that vocabulary is carried verbatim but flagged
 *     `outside_disclosed_vocabulary` (the Research Canvas pattern of a
 *     distinguished unclassified connection that is never a factual claim);
 *     nothing here collapses relations to a generic edge type;
 *   - a proposal is a SUGGESTION with its own minted presentation ref
 *     (`ql.techne:canvas-proposal:` namespace) — never a native relation
 *     ref, never written into the reading or the whole;
 *   - endpoints must be refs the reading actually discloses: Canvas relates
 *     addressed material, it does not invent field residents;
 *   - evidence/source/standing ride the proposal exactly as the contract's
 *     relation fields name them, so a committed proposal can be judged by
 *     the owner on the same terms as a native relation;
 *   - commit ROUTES through the reading's own disclosed native Actions
 *     (`resolveActionRoute`): the receipt — routed or refused, with the
 *     owner's reason — is attached to the proposal and shown. Routing is
 *     not execution; the receipt says so;
 *   - reject touches NOTHING: no reading mutation, no session mutation, no
 *     residue. The reject-once-prove-no-mutation case is directly testable.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  validateActionRoute,
  type NativeActionRef,
  type TechneActionReceipt,
  type TechneActionRoute,
  type TechneReading,
} from "../../contract.ts";
import { resolveActionRoute } from "../adapter.ts";

export type ProposalDirectionality = "forward" | "backward" | "bidirectional" | "none";

export type ProposalStatus = "draft" | "proposed" | "rejected" | "routed";

/** One authored relation proposal. Presentation/proposal artifact: its ref
 * is minted in the canvas namespace and never impersonates a native
 * relation. */
export interface RelationProposal {
  proposal_ref: string;
  from_ref: string;
  to_ref: string;
  /** The actual relation type, verbatim — provider vocabulary, never a
   * generic relabelling. */
  relation: string;
  directionality: ProposalDirectionality;
  status: ProposalStatus;
  /** Evidence discipline carried exactly as the contract's relation fields
   * name them, so the owner judges a committed proposal on native terms. */
  standing?: string | null;
  source_ref?: string | null;
  evidence_refs: string[];
  note?: string;
  /** The disclosed native Action the commit routed through. */
  action_ref?: string;
  /** The routing receipt, attached on commit; `routed: false` carries the
   * owner-side refusal reason verbatim. */
  receipt?: TechneActionReceipt;
  /** Set on reject or on an unrouted commit; the surface shows it. */
  resolution_note?: string;
  /** True when the chosen type is not in the reading's disclosed relation
   * vocabulary — carried verbatim, flagged honestly. */
  outside_disclosed_vocabulary: boolean;
}

const PROPOSAL_REF_PREFIX = "ql.techne:canvas-proposal";

export function mintProposalRef(): string {
  return `${PROPOSAL_REF_PREFIX}:${crypto.randomUUID()}`;
}

export interface CreateProposalInput {
  from_ref: string;
  to_ref: string;
  relation: string;
  directionality?: ProposalDirectionality;
  standing?: string | null;
  source_ref?: string | null;
  evidence_refs?: string[];
  note?: string;
}

/** The relation vocabulary the reading's own authority demonstrates: the
 * distinct relation types in use on this whole, in first-appearance order.
 * This — never a hard-coded generic set — is what the authoring UI offers
 * first. */
export function disclosedRelationVocabulary(reading: TechneReading): string[] {
  const vocabulary: string[] = [];
  for (const relation of reading.whole?.relations ?? []) {
    if (!vocabulary.includes(relation.relation)) vocabulary.push(relation.relation);
  }
  return vocabulary;
}

/** The disclosed native Actions a relation-shaped commit could legitimately
 * route through. The surface offers exactly these; nothing is invented. */
export function disclosedRelationActions(reading: TechneReading): NativeActionRef[] {
  return reading.actions ?? [];
}

/** Create a draft proposal. Both endpoints must be refs the reading
 * discloses (whole members, the whole itself, the warranted QL address, or
 * any relation endpoint — the reading's addressed material); the relation
 * type must be non-empty. Vocabulary standing is computed, never asserted
 * by the caller. */
export function createProposal(reading: TechneReading, input: CreateProposalInput): RelationProposal {
  if (!input.relation?.trim()) throw new Error("A relation proposal needs the actual relation type — none is offered");
  if (!input.from_ref?.trim() || !input.to_ref?.trim()) throw new Error("A relation proposal needs both endpoints");
  const addressed = disclosedAddressedRefs(reading);
  for (const endpoint of [input.from_ref, input.to_ref]) {
    if (!addressed.has(endpoint)) {
      throw new Error(`Proposal endpoint ${endpoint} is not disclosed by reading ${reading.reading_ref} — Canvas relates addressed material only`);
    }
  }
  const vocabulary = disclosedRelationVocabulary(reading);
  const proposal: RelationProposal = {
    proposal_ref: mintProposalRef(),
    from_ref: input.from_ref,
    to_ref: input.to_ref,
    relation: input.relation,
    directionality: input.directionality ?? "forward",
    status: "draft",
    standing: input.standing ?? null,
    source_ref: input.source_ref ?? null,
    evidence_refs: [...(input.evidence_refs ?? [])],
    ...(input.note !== undefined ? { note: input.note } : {}),
    outside_disclosed_vocabulary: !vocabulary.includes(input.relation),
  };
  return proposal;
}

/** Every ref the reading actually addresses: subject, whole, members,
 * warranted QL address, and any relation endpoint (an adrift relation still
 * discloses both of its ends). */
export function disclosedAddressedRefs(reading: TechneReading): Set<string> {
  const refs = new Set<string>();
  refs.add(reading.subject.subject_ref);
  if (reading.whole) {
    refs.add(reading.whole.whole_ref);
    for (const member of reading.whole.member_refs ?? []) refs.add(member);
    for (const relation of reading.whole.relations ?? []) {
      refs.add(relation.from_ref);
      refs.add(relation.to_ref);
    }
  }
  const address = reading.ql?.address;
  if (typeof address === "string" && address.trim()) refs.add(address);
  return refs;
}

/** Draft → proposed: the suggestion becomes a visible, rejectable,
 * committable proposal. Idempotence is not offered — a proposal moves
 * forward one way at a time, honestly. */
export function proposeRelation(proposal: RelationProposal): RelationProposal {
  assertStatus(proposal, "draft", "proposed");
  return { ...proposal, status: "proposed" };
}

/** Reject: the proposal is refused and NOTHING ELSE happens. The reading,
 * the session, the whole — untouched; this function has no parameter for
 * any of them. */
export function rejectProposal(proposal: RelationProposal, reason?: string): RelationProposal {
  if (proposal.status === "routed") throw new Error(`Proposal ${proposal.proposal_ref} was already routed to its native owner and cannot be rejected locally`);
  if (proposal.status === "rejected") return proposal;
  return {
    ...proposal,
    status: "rejected",
    resolution_note: reason ?? "rejected without mutation — the field is unchanged",
  };
}

export interface CommitProposalOutcome {
  proposal: RelationProposal;
  route: TechneActionRoute;
  receipt: TechneActionReceipt;
}

/** Commit: route the proposal through the reading's OWN disclosed native
 * Action. The reading is only read; the native owner owns any actual
 * mutation, under its own authority, and the receipt — routed or refused —
 * is attached verbatim to the proposal.
 *
 * `routeAction` is the adapter seam (default `resolveActionRoute`);
 * tests substitute a recording stub to prove the exact route. */
export async function commitProposal(
  reading: TechneReading,
  proposal: RelationProposal,
  actionRef: string,
  routeAction: (reading: TechneReading, route: TechneActionRoute) => Promise<TechneActionReceipt> = async (candidate, route) => resolveActionRoute(candidate, route),
): Promise<CommitProposalOutcome> {
  if (proposal.status === "routed") throw new Error(`Proposal ${proposal.proposal_ref} is already routed`);
  if (proposal.status === "rejected") throw new Error(`Proposal ${proposal.proposal_ref} was rejected and cannot be committed`);
  if (proposal.status === "draft") throw new Error(`Proposal ${proposal.proposal_ref} is still a draft — propose it before committing`);
  const route: TechneActionRoute = {
    action_ref: actionRef,
    subject_ref: reading.subject.subject_ref,
    selection_ref: null,
    input: {
      proposal_ref: proposal.proposal_ref,
      relation: proposal.relation,
      relation_directionality: proposal.directionality,
      from_ref: proposal.from_ref,
      to_ref: proposal.to_ref,
      standing: proposal.standing ?? null,
      source_ref: proposal.source_ref ?? null,
      evidence_refs: [...proposal.evidence_refs],
      ...(proposal.note !== undefined ? { note: proposal.note } : {}),
    },
  };
  const checked = validateActionRoute(route);
  if (!checked.valid) throw new Error(`Relation proposal route is malformed: ${checked.errors.join("; ")}`);
  const receipt = await routeAction(reading, route);
  const next: RelationProposal = receipt.routed
    ? { ...proposal, status: "routed", action_ref: actionRef, receipt }
    : { ...proposal, status: "proposed", action_ref: actionRef, receipt, resolution_note: receipt.reason ?? "the native owner refused the route" };
  return { proposal: next, route, receipt };
}

function assertStatus(proposal: RelationProposal, expected: ProposalStatus, next: ProposalStatus): void {
  if (proposal.status !== expected) {
    throw new Error(`Proposal ${proposal.proposal_ref} is ${proposal.status}, not ${expected} — cannot move to ${next}`);
  }
}

// ---------------------------------------------------------------------------
// The proposal store — Cradle-seam presentation state with subscribe
// ---------------------------------------------------------------------------

export interface ProposalStore {
  proposals(): RelationProposal[];
  put(proposal: RelationProposal): RelationProposal;
  find(proposalRef: string): RelationProposal | undefined;
  subscribe(listener: () => void): () => void;
}

export function createProposalStore(): ProposalStore {
  const proposals = new Map<string, RelationProposal>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  return {
    proposals() {
      return [...proposals.values()];
    },
    put(proposal) {
      proposals.set(proposal.proposal_ref, structuredClone(proposal) as unknown as RelationProposal);
      notify();
      return structuredClone(proposals.get(proposal.proposal_ref)) as unknown as RelationProposal;
    },
    find(proposalRef) {
      const found = proposals.get(proposalRef);
      return found ? (structuredClone(found) as unknown as RelationProposal) : undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
