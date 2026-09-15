/**
 * The frozen C0 contract documents (docs/cradle/
 * 09-CONFIGURATION-PLANE.md, #299 Gate A) as TypeScript types.
 *
 * These mirror the wire shapes the JSON Schemas freeze
 * (`schemas/oi.configuration-contribution-v1.schema.json` and kin); the
 * conformance fixtures (`suite/configuration/cases/`) are the behaviour
 * examples every lane shares. This file only states types — it never
 * re-decides the contract, and unknown fields MUST stay tolerated
 * (§15), so every document type keeps an index signature.
 */

// ---------------------------------------------------------------------------
// scope addressing (§5)

export type ScopeKind =
  | "world"
  | "ground"
  | "project"
  | "machine"
  | "workcell"
  | "agency"
  | "agent"
  | "session-space"
  | "agent-session"
  | "provider"
  | "connector-relation"
  | "invocation";

/** §5: singular kinds may carry `scope_ref: null` (the one instance);
 * every other kind needs a non-empty ref in its own namespace. */
export const SINGULAR_SCOPE_KINDS: ReadonlySet<string> = new Set(["world", "ground", "machine"]);

export interface ScopeAddress {
  scope_kind: ScopeKind;
  scope_ref: string | null;
}

/** Compact form — CLI/grammar only, never wire (§5). Used for keys. */
export function compactScope(scope: ScopeAddress): string {
  return scope.scope_ref ? `${scope.scope_kind}:${scope.scope_ref}` : scope.scope_kind;
}

export interface AllowedScope {
  scope_kind: ScopeKind;
  /** null = any instance of this kind. */
  scope_ref: string | null;
}

// ---------------------------------------------------------------------------
// value schemas (§2.3)

export interface EnumOption {
  value: string;
  title?: string;
  description?: string;
}

export interface TableColumn {
  name: string;
  type: string;
}

export type ValueSchema =
  | { type: "boolean" }
  | { type: "scalar"; pattern?: string; format?: string }
  | { type: "number"; minimum?: number; maximum?: number }
  | { type: "integer"; minimum?: number; maximum?: number }
  | { type: "enum"; options: EnumOption[] }
  | { type: "path"; pattern?: string; format?: string }
  | { type: "reference"; subject_kind?: string }
  | { type: "table"; columns: TableColumn[] }
  | { type: "list"; items?: { type: string } }
  | { type: "secret" };

// ---------------------------------------------------------------------------
// contribution (§1, §2) — the operability plane

export type OwnerKind = "product" | "oi" | "connector";

export interface ContributionOwnerDescriptor {
  owner_ref: string;
  owner_kind: OwnerKind;
  owner_version?: string;
  contribution_command: string[];
  disclosed_at_unix_ms?: number;
  reading_digest?: string | null;
  reading_digest_covers?: string;
}

export type EffectKind =
  | "none"
  | "value-change"
  | "restart-required"
  | "session-restart-required"
  | "provider-reconnect-required"
  | "material-effect"
  | "pending"
  | "unknown";

export interface ExpectedEffect {
  kind: EffectKind;
  summary?: string | null;
  ref?: string | null;
}

export type OperationName = "validate" | "plan" | "apply" | "reset";

export interface SettingOperations {
  validate: boolean;
  plan: boolean;
  apply: boolean;
  reset: boolean;
}

export interface SettingSpec {
  setting_ref: string;
  section_ref: string;
  title: string;
  description?: string;
  value_schema: ValueSchema;
  allowed_scopes: AllowedScope[];
  writable: boolean;
  profileable: boolean;
  sensitive: boolean;
  /** Only when `default_semantics` is "constant" (§2.2). */
  default?: unknown;
  default_semantics: "constant" | "computed" | "none";
  effect: ExpectedEffect;
  operations: SettingOperations;
  native_ref: string;
  [field: string]: unknown; // §15: unknown fields tolerated, never dropped
}

export interface ContributionSection {
  id: string;
  title: string;
  settings: SettingSpec[];
}

export interface ContributionDocument {
  schema: "oi.configuration-contribution/v1";
  contract_revision: string;
  owner: ContributionOwnerDescriptor;
  about?: string;
  sections: ContributionSection[];
  operations: {
    transport: string;
    validate: { availability: string; reason?: string | null };
    plan: { availability: string; reason?: string | null };
    apply: { availability: string; reason?: string | null };
    reset: { availability: string; reason?: string | null };
  };
  availability: { state: "available" | "degraded" | "unavailable" | "unknown"; reason: string | null };
  degradations?: { subject_ref?: string; state: string; reason?: string; native_error?: string }[];
  obligations?: string[];
  [field: string]: unknown;
}

// ---------------------------------------------------------------------------
// resolution (§7) — desired/native reading and the frozen reconciliation
// vocabulary

export type ReconciliationStatus =
  | "satisfied"
  | "drifted"
  | "pending"
  | "blocked"
  | "unsupported"
  | "unknown";

export interface AxisProvenance {
  owner_ref?: string;
  path?: string;
  observed_at_unix_ms?: number;
}

export interface NativeAxis {
  value?: unknown;
  provenance?: AxisProvenance;
}

export interface DesiredState {
  value?: unknown;
  source_ref?: string | null;
  set_at_unix_ms?: number;
  /** §14: secret-kind desired entries carry a reference, never a value. */
  secret_reference?: { ref: string } | null;
}

export interface ConfigResolution {
  schema: "oi.config-resolution/v1";
  setting_ref: string;
  scope: ScopeAddress;
  desired: DesiredState | null;
  native: {
    declared?: NativeAxis;
    effective?: NativeAxis;
    active?: NativeAxis;
    staged?: (NativeAxis & { stage_ref?: string; stage_state: string }) | null;
  };
  native_reading: { reading_digest: string | null; observed_at_unix_ms: number | null };
  reconciliation: { status: ReconciliationStatus; reason: string | null; detail_ref?: string | null };
  [field: string]: unknown;
}

// ---------------------------------------------------------------------------
// plan / validation / error (§6)

export interface PlanChange {
  summary: string;
  native_ref?: string | null;
  before_ref?: string | null;
  after_ref?: string | null;
}

export interface PlanAuthority {
  requires?: string[];
  granted_by?: string | null;
}

/** `oi.config-plan/v1` — owner-minted; `plan_digest` is the idempotency
 * anchor (§9). */
export interface PlanDocument {
  schema: "oi.config-plan/v1";
  plan_id: string;
  plan_digest: string;
  setting_ref: string;
  scope: ScopeAddress;
  changes: PlanChange[];
  expected_effect: ExpectedEffect;
  expires_at_unix_ms?: number | null;
  explain_ref?: string | null;
  authority?: PlanAuthority | null;
  [field: string]: unknown;
}

export interface ConfigErrorDocument {
  schema: "oi.config-error/v1";
  error_code:
    | "unsupported_setting"
    | "unsupported_scope"
    | "unknown_scope_kind"
    | "invalid_value"
    | "validation_failed"
    | "owner_unavailable"
    | "plan_expired"
    | "not_authorised"
    | "unsupported_schema"
    | "internal";
  message: string;
  setting_ref?: string | null;
  scope_kind?: string | null;
  retryable?: boolean;
  detail_ref?: string | null;
}

// ---------------------------------------------------------------------------
// ChangeSet (§8) and receipts (§9)

export type ChangeSetOpStatus = "planned" | "validated" | "applied" | "verified" | "failed";

export interface ChangeSetOperation {
  op_id: string;
  depends_on: string[];
  owner_ref: string;
  setting_ref: string;
  scope: ScopeAddress;
  kind: "apply" | "reset";
  plan_digest: string | null;
  status: ChangeSetOpStatus;
  receipt_ref: string | null;
  error: { code: string; message: string; retryable?: boolean } | null;
  [field: string]: unknown;
}

export type ChangeSetStatus =
  | "planned"
  | "validated"
  | "applied"
  | "verified"
  | "partially_applied"
  | "failed";

export interface ChangeSetDocument {
  schema: "oi.config-changeset/v1";
  changeset_id: string;
  created_at_unix_ms: number;
  profile_ref?: string | null;
  requested: {
    setting_ref: string;
    scope: ScopeAddress;
    value?: unknown;
    secret_reference?: { ref: string } | null;
  }[];
  operations: ChangeSetOperation[];
  verification: {
    reading_digest: string | null;
    observed_at_unix_ms: number | null;
    reconciliations: { setting_ref: string; status: ReconciliationStatus }[];
  } | null;
  status: ChangeSetStatus;
  [field: string]: unknown;
}

export interface ReceiptDocument {
  schema: "oi.config-receipt/v1";
  receipt_id: string;
  owner_ref: string;
  changeset_id: string;
  plan_digest: string | null;
  setting_ref: string;
  scope: ScopeAddress;
  operation: "apply" | "reset";
  outcome: "applied" | "no_op" | "failed";
  applied_at_unix_ms: number;
  native_ref?: string | null;
  expected_effect: ExpectedEffect;
  original_receipt_id?: string | null;
  error?: ConfigErrorDocument | null;
  [field: string]: unknown;
}

// ---------------------------------------------------------------------------
// profiles (§12, §13)

export interface ProfileNativeProfile {
  owner_ref: string;
  native_profile_ref: string;
}

export interface ProfileDesiredEntry {
  setting_ref: string;
  scope: ScopeAddress;
  value?: unknown;
  secret_reference?: { ref: string } | null;
}

export interface ProfileDocument {
  schema: "oi.profile/v1";
  profile_ref: string;
  title?: string | null;
  description?: string | null;
  created_at_unix_ms: number;
  revised_at_unix_ms: number;
  native_profiles: ProfileNativeProfile[];
  desired: ProfileDesiredEntry[];
  provenance?: { authored_by?: string; notes_ref?: string | null; imported_from_ref?: string | null };
  [field: string]: unknown;
}
