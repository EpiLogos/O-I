/**
 * Agency — shared read-model and draft types (no owner wire types live
 * here; those stay in kernel/types.ts). Everything below is either a
 * pure UI shape or a receiving-adapter payload shape — never a second
 * copy of an owner contract.
 */

/** The truthful disclosure vocabulary (COMMON-BRIEF law): each state
 * renders as its own `.oi-state` text, never a generic green badge. */
export type DisclosureState =
  | "Selected"
  | "Projected"
  | "Brokered"
  | "Observed effective"
  | "Adapter-inferred"
  | "Unknown"
  | "Withheld"
  | "Pending reload";

export type AgentDurability = "team" | "temporary";

/** The mint draft. `intentExpression` is retained byte-for-byte: it is
 * shown back unedited in review and is never paraphrased or trimmed by
 * this surface. */
export interface AgentDraft {
  intentExpression: string;
  name?: string;
  /** Where to keep it — a project/profile/placement reference, held as
   * the person typed it; this surface does not invent a placement grammar. */
  keepIn?: string;
  durability: AgentDurability;
  /** Candidate refs the person has included from search/proposal, kept on
   * the draft so the review step and the module-level store agree on one
   * list. Additive to the fields the brief names explicitly. */
  includedSkillRefs: string[];
}

export function emptyDraft(): AgentDraft {
  return { intentExpression: "", durability: "temporary", includedSkillRefs: [] };
}

export type SuggestionRequirement = "required" | "optional" | "missing";
export type TargetCompatibility = "compatible" | "partial" | "unknown" | "incompatible";

export interface SetupSuggestion {
  candidateRef: string;
  /** The exact revision this suggestion was proposed against (rendered mono). */
  revision: string;
  /** Concise relation to the stated intent — the adapter's own words. */
  reason: string;
  requirement: SuggestionRequirement;
  prerequisites: string[];
  targetCompatibility: TargetCompatibility;
  proposedScope: string;
  /** Source or Guardian stewardship label, verbatim from the adapter. */
  stewardship: string;
  sourceLabel: string;
}

/** The reviewable proposal (never evidence, never permission). */
export interface SetupProposalRecord {
  suggestions: SetupSuggestion[];
  gaps: string[];
  conflicts: string[];
  duplicates: string[];
  /** What the proposal was computed against — staleness is a comparison
   * against this, never a timer. */
  basis: { intent: string; catalogueRevision: string; target: string };
}

export type GuardianProduct =
  | "Central"
  | "Actuation"
  | "AIKit"
  | "Software Factory"
  | "Workcell"
  | "Quaternal Logic";

export const GUARDIAN_PRODUCTS: GuardianProduct[] = [
  "Central",
  "Actuation",
  "AIKit",
  "Software Factory",
  "Workcell",
  "Quaternal Logic",
];

export interface GuardianPracticeProposal {
  ref: string;
  summary: string;
  state: DisclosureState;
}

export interface GuardianVerifiedChange {
  ref: string;
  summary: string;
  evidenceRef?: string;
}

/** One resolved Guardian. Resolution only — never minted here. */
export interface GuardianRecord {
  agentRef: string;
  name: string;
  product: GuardianProduct;
  repertoireSourceRef?: string;
  readiness: DisclosureState;
  pendingPracticeProposals: GuardianPracticeProposal[];
  verifiedChanges: GuardianVerifiedChange[];
}

/** One live SessionSpace session as the desktop already parses `agency_read`
 * (the real shape observed in EncounterList.tsx / SettingsPage.tsx:
 * `{definition:{id}, label?, agent_sessions:Record<ref,{purpose?}>}`).
 * Nothing beyond `spaceRef`, `spaceLabel`, `sessionRef` and `purpose` is
 * disclosed by that reading, so every other Agent-detail field renders the
 * honest "Not disclosed by the owner reading" fallback. */
export interface AgencySessionRow {
  spaceRef: string;
  spaceLabel?: string;
  sessionRef: string;
  purpose?: string;
  /** The canonical Agent the session attachment names, when the owner
   * reading discloses one (`agent_ref`); the human card is derived from it. */
  agentRef?: string;
  /** The unparsed space payload, kept only so a section can double-check
   * for a field it did not expect rather than silently dropping it. */
  raw: unknown;
}

export interface AgencyReading {
  harnessDisclosure?: unknown;
  projectRef: string;
  rows: AgencySessionRow[];
  observedAtUnixMs?: number;
}
