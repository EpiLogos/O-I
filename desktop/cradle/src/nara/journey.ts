/** A journey on its Flow page (manual §24.4, §22.4; T-WORLDS §6, W4): the kernel's `nara_journey` (kernel/src/nara_journey.rs) over
 * QL's `nara.journey.open|apply|read` (`ql.nara-oracle-journey/v1`). QL computes; the page keeps the journey on the revision read;
 * every act that rests on chance needs the person's consent to chance, each time, and the chance is the kernel's own (`getrandom`),
 * never this module's. The types follow QL's contract (crates/ql-mef/src/nara/domain/oracle_journey.rs). */
import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";

export interface SourceRevision {source_ref: string; revision: string; standing_ref: string}
export interface JourneyConcern {concern_ref: string; title: string; basis_sources: SourceRevision[]}
export interface DeckDefinition {
  deck_ref: string;
  system: "tarot-rws" | "tarot-thoth" | "tarot-marseille" | "tarot-ql";
  register: "thoth" | "rws";
  extra_cards: string[];
  source_refs: string[];
}
export type SpreadKind =
  | {kind: "sphere"} | {kind: "torus-day"} | {kind: "klein-night"; day_spread_ref: string}
  | {kind: "lemniscate"; within_placement_ref: string} | {kind: "single"; count: number} | {kind: "closing"};
export interface SpreadPosition {arc: "day" | "night"; index: number}
export interface NewReading {
  reading_ref: string; kind: "original" | "development" | "correction" | "retrospective"; actor_kind: "human" | "agent";
  author_ref?: string | null; text: string; supersedes: string | null; source_refs: string[]; occurred_at_unix_ms: number;
}
export interface ProtectedRef {ref_id: string; revision: string; owner_ref: string}
/** A cast as the person asks it; its entropy and consent are the kernel's to fill (nara_journey.rs). */
export interface IChingCast {
  coins: boolean; query_ref: ProtectedRef; original_payload_ref: ProtectedRef; cast_degree: number | null; vak_ref: string | null;
  hygiene: "clear" | "warning" | "blocked";
}
export type JourneyRequest =
  | {op: "draw"; spread: SpreadKind; day_ref: string; basis_sources: SourceRevision[]}
  | {op: "assign-symbol"; card: number; reversed: boolean; position: SpreadPosition | null; reason: string; day_ref: string}
  | {op: "relate-event"; placement_ref: string; source: SourceRevision; entry_selector: string | null; relation: string; occurred_at_unix_ms: number}
  | {op: "read"; placement_ref: string; reading: NewReading}
  | {op: "cast-iching"; cast: IChingCast; day_ref: string; basis_sources: SourceRevision[]; related_placement_refs: string[]}
  | {op: "read-iching"; reading_ref: string; reading: NewReading}
  | {op: "close"; reason: string};
export interface JourneyAct {request_id: string; actor_ref: string; at_unix_ms: number; day_ref?: string | null; request: JourneyRequest}

export type NaraJourneyRequest =
  | {operation: "open"; location: CentralLocation; expected_revision: string; subject_ref: string; concern: JourneyConcern; deck: DeckDefinition;
    day_ref: string; actor_ref: string; consent_to_chance: boolean}
  | {operation: "apply"; location: CentralLocation; expected_revision: string; act: JourneyAct; consent_to_chance?: boolean}
  | {operation: "read"; location: CentralLocation; window_unix_ms?: [number, number]};

export interface CardIdentity {deck_index: number; token_ref: string; name: string; arcana: "minor" | "major" | "extra"; kernel_card_ref: string | null; codons: number[]}
export interface PlacementView {
  placement_ref: string; card: CardIdentity; reversed: boolean; position: string | null; basis: {basis: "drawn" | "symbolic-assignment"; [detail: string]: unknown};
  klein_face: string; live_state: string; person_disposition: string | null; day_ref: string; placed_at_unix_ms: number;
  recognitions: unknown[]; current_readings: unknown[]; reading_history: unknown[];
}
export interface SpreadView {spread_ref: string; kind: SpreadKind; day_ref: string; basis_sources: SourceRevision[]; janus_resolved: boolean; placements: PlacementView[]}
export interface IChingReading {reading_ref: string; lines: number[]; primary: number; changing_mask: number; resulting: number | null; nuclear: number; day_ref: string; [field: string]: unknown}
export interface JourneyReading {
  schema: "ql.nara-oracle-journey-reading/v1"; journey_ref: string; journey_revision: number; subject_id: string; concern: JourneyConcern;
  status: "open" | "deck-complete" | "closed";
  deck: {deck_ref: string; register: string; card_count: number; dealt: number; remaining: number; shuffle_ref: string; shuffled_at_unix_ms: number; protocol_ref: string};
  day_refs: string[]; spreads: SpreadView[]; symbolic_assignments: PlacementView[]; iching: IChingReading[]; live_placement_refs: string[];
}
export interface NaraJourneyResult {
  schema: "oi.nara-journey/v1"; operation: "open" | "apply" | "read"; reading: JourneyReading; effect?: {request_id: string; op: string; replayed: boolean; effect_refs: string[]; journey_revision: number} | null;
  page: {location: CentralLocation; revision: string; before_revision?: string; outcome?: string}; receipt?: unknown;
}

/** One journey operation through the kernel; a refusal comes back in its owner's words. */
export async function naraJourney(transport: KernelTransportStatus, request: NaraJourneyRequest): Promise<NaraJourneyResult> {
  const response = await kernelOp(transport, {op: "nara_journey", request});
  if (response.error || response.outcome?.result !== "nara_journey") throw new Error(response.error ?? "The journey's owner did not answer.");
  const data = response.outcome.data;
  if (data.schema !== "oi.nara-journey/v1" || data.operation !== request.operation || data.reading?.schema !== "ql.nara-oracle-journey-reading/v1"
    || data.page?.location?.ref !== request.location.ref) throw new Error("The journey's owner answered another journey or another operation.");
  return data;
}
