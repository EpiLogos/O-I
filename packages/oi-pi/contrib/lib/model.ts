// Semantic projection types for O:I/AIKit application models.
//
// These are *views into* native-owner models, never a Pi-specific semantic
// subsystem. Refs (`ResourceRef`) are opaque canonical identities owned by the
// native product; the package never mints semantic identity for
// World/Run/Activity/Attention, and never stores process/endpoint/provider
// identity as semantic identity.

export type ResourceRef = string;

export interface WorldSummary {
  world: ResourceRef;
  agent: ResourceRef;
  run: ResourceRef;
  workcell: ResourceRef;
}

/** One activity row, projected from `aikit recent`. */
export interface Activity {
  ref: ResourceRef; // native event id
  action: string;
  at: string;
  outcome: string;
  capability?: ResourceRef;
  session?: ResourceRef;
  sessionName?: string;
  mux?: string;
  state?: string | null;
}

/** A notification in the Activity → Notification → Attention chain. */
export interface AttentionNotification {
  ref: ResourceRef;
  kind: string;
  requiresAttention: boolean;
  acknowledged: boolean;
  evidenceRef?: ResourceRef;
  summary: string;
}

/** The derived attention fact; never a prose guess. */
export interface Attention {
  count: number;
  refs: ResourceRef[];
  derivedFrom: "activity-notification-attention";
  notifications: AttentionNotification[];
}

export type CensusStage =
  | "eligible"
  | "selected"
  | "loaded"
  | "granted"
  | "invoked"
  | "realised";

export interface CensusEntry {
  ref: ResourceRef;
  stage: CensusStage;
  label: string;
  evidenceRef?: ResourceRef;
}

export interface CapabilityCensus {
  stages: Record<CensusStage, CensusEntry[]>;
  counts: Record<CensusStage, number>;
  totalEligible: number;
  provenance: string[];
}

export type SurfaceLifecycleState =
  | "discovered"
  | "staged"
  | "previewed"
  | "eligible"
  | "selected"
  | "active"
  | "withheld"
  | "removed";

export interface SurfaceLifecycleProof {
  state: SurfaceLifecycleState;
  contribution: ResourceRef;
  evidence: string[];
  authority: string;
  reason?: string;
}

export interface ObservatorySection {
  key: string;
  title: string;
  semantic: string[];
  raw: string;
  provenance: string[];
}

/** The same semantic object consumable from a human surface and an Agent surface. */
export interface ObservatoryView {
  schema: "oi.observatory-view/v1";
  world: WorldSummary;
  activity: Activity[];
  evidenceCount: number;
  attention: Attention;
  census: CapabilityCensus;
  lifecycle: SurfaceLifecycleProof[];
  sections: ObservatorySection[];
  provenance: string[];
  /** Structured projection for an Agent consumer (same refs as the TUI view). */
  agentProjection: Record<string, unknown>;
}
