/**
 * System Settings types (docs/cradle/06-SYSTEM-SETTINGS.md).
 *
 * Two layers:
 *  - `CompositionReading` — the native census projection, moved here from
 *    SystemPanel (which re-exports it for kernel/types).
 *  - The settings-page model — P1 is cradle-composed from the reads the
 *    kernel already serves; every value carries its provenance or its
 *    honest native path. Native per-product descriptors
 *    (`oi.product-settings-disclosure/v1`, §4 of the design) replace this
 *    composition one product at a time without page changes (law L6).
 */

export interface NativeReading {data?:Record<string,unknown>;error?:string;command:string[]}

/** The native six-owner census + owner-capability aggregate. */
export interface CompositionReading {schema:string;suite_executable?:string;current_world:NativeReading;status:NativeReading;positions:{product_id:string;availability:"missing"|"discovered"|"unavailable";native_state:string;current_world:Record<string,unknown>}[];integration_obligations:string[];observed_at_unix_ms:number}

export type Availability = "missing" | "discovered" | "unavailable";

/** One configuration row, P1 shape: a value with provenance, or a native
 * path when the setting is set through the owner's own surface (L4). */
export interface SettingRow {
  title: string;
  /** Rendered value. Absent → the row renders only its native path. */
  value?: string;
  /** Owner ref / reading that produced the value (L2). */
  provenance?: string;
  /** Where the setting is authored when not mutable here (L4). */
  native_path?: string;
}

export interface ActivityRow {
  title: string;
  value: string;
  error?: string;
  raw?: unknown;
}

/** One disclosed or named-missing engagement (L3: empty is proof). */
export interface ActionRow {
  title: string;
  availability: "native_only" | "missing_native_obligation" | "unavailable";
  note?: string;
}

/** The uniform product-section model (design §6.1). */
export interface ProductSectionModel {
  product_id: string;
  name: string;
  about: string;
  availability: Availability;
  /** Exact source fact from the census; registration is never readiness. */
  native_state: string;
  version?: string;
  configuration: SettingRow[];
  activity: ActivityRow[];
  actions: ActionRow[];
  /** The whole owner row — raw record stays behind disclosure (L5). */
  raw: Record<string, unknown>;
}

/** The four user needs the rail serves (design §1). */
export type SettingsView = "health" | "activity" | "config" | "bootstrap";

/** Project-scoped live activity extras (AIKit agency + providers). */
export interface ActivityExtras {
  project?: string;
  spaces?: {count: number; project_ref: string; raw: unknown};
  spacesError?: string;
  providers?: {count: number; raw: unknown};
  providersError?: string;
}

/**
 * Native per-owner disclosure (`oi.product-settings-disclosure/v2`,
 * docs/cradle/07-WAVE-5-SYSTEM-CONTRIBUTION.md §3). Freezes the field
 * names the owner tracks ship against; the UI renders exactly this shape
 * and fabricates none of it.
 */
export interface DisclosureProvenance {
  owner_ref?: string;
  path?: string;
  observed_at_unix_ms?: number;
}

/** declared/effective axis: a value the owner resolved, with its own
 * provenance. Present even when it agrees with the other axes — the
 * agreement is the information (07 §4.1). */
export interface DisclosedAxis {
  value?: unknown;
  provenance?: DisclosureProvenance;
}

export interface ActiveAxis extends DisclosedAxis {
  /** Apply receipt / generation id this axis materialised from. */
  materialisation_ref?: string;
}

export type StageState = "none" | "prepared" | "previewed" | "discardable";

export interface StagedAxis extends DisclosedAxis {
  stage_ref?: string;
  stage_state: StageState;
}

export interface ExpectedEffect {
  summary?: string;
  ref?: string;
}

export type DriftState = "none" | "diverged" | "unknown";

export interface Drift {
  state: DriftState;
  between: [string, string];
  remediation_action_ref?: string | null;
}

export interface DisclosedSettingAxes {
  declared?: DisclosedAxis;
  effective?: DisclosedAxis;
  active?: ActiveAxis;
  staged?: StagedAxis;
  expected_effect?: ExpectedEffect;
}

/** One disclosed configuration row across its axes. `kind: "secret"`
 * (07 §4.4) is presence-only — the UI never renders its `value`. */
export interface DisclosedSetting {
  key: string;
  title: string;
  kind: string;
  axes: DisclosedSettingAxes;
  mutable?: boolean;
  native_path?: string;
  bootstrap?: boolean;
  drift?: Drift;
}

export interface DisclosedSection {
  id: string;
  title: string;
  settings: DisclosedSetting[];
}

export type ActionAvailabilityV2 = "disclosed" | "missing_native_obligation" | "unavailable";

export interface ActionAuthority {
  requires?: string[];
  granted_by?: string;
  evidence_ref?: string | null;
}

export interface ActionExposure {
  ui?: boolean;
  agent?: boolean;
  headless?: boolean;
}

export interface ActionCommandRef {
  ref?: string;
  command?: string[];
}

export interface DisclosedActionArg {
  name: string;
  kind: string;
}

export interface DisclosedAction {
  action_ref: string;
  title: string;
  args?: DisclosedActionArg[];
  availability: ActionAvailabilityV2;
  unavailable_reason?: string | null;
  subject_kinds?: string[];
  authority?: ActionAuthority;
  exposure?: ActionExposure;
  explain?: ActionCommandRef;
  history?: ActionCommandRef;
}

export type OwnerAvailabilityState = "available" | "degraded" | "unavailable" | "unknown";

export interface DisclosureOwner {
  owner_id: string;
  owner_ref?: string;
  owner_version?: string;
  reading_command?: string[];
  reading_digest?: string | null;
  reading_digest_covers?: string;
  observed_at_unix_ms?: number;
}

export interface Degradation {
  subject_ref?: string;
  state: string;
  reason?: string;
  native_error?: string;
}

/** The owner's own document, mounted unmodified (07 §5.1). */
export interface ProductDisclosureV2 {
  schema: "oi.product-settings-disclosure/v2";
  product_id: string;
  contract_revision?: string;
  disclosed_at_unix_ms?: number;
  owner: DisclosureOwner;
  about?: string;
  sections: DisclosedSection[];
  actions: DisclosedAction[];
  availability: {state: OwnerAvailabilityState; reason?: string | null};
  degradations?: Degradation[];
  obligations?: string[];
}

/** One mounted (or honestly not-mounted) owner position (Rust
 * `system_composition::OwnerMount`). `reason`, `descriptor` and `error` are
 * always present on the wire (`null` when absent) — absence is data. */
export interface OwnerMount {
  product_id: string;
  availability: "available" | "degraded" | "unavailable" | "unknown";
  reason: string | null;
  reading_command: string[];
  descriptor: ProductDisclosureV2 | null;
  error: string | null;
  provenance: {observed_at_unix_ms: number; digest: string | null};
}

/** The mounted composition reading (`oi.system-composition/v1`, Rust
 * `system_composition::Reading`). Always seven positions — the composition
 * layer (`oi`, composed from its own already-resolved census) plus the six
 * products. A mount failure is `error` plus a degraded availability, never
 * a dropped position or a fabricated descriptor. */
export interface SystemCompositionReading {
  schema: "oi.system-composition/v1";
  contract_revision: string;
  observed_at_unix_ms: number;
  census: {schema: string; positions: CompositionReading["positions"]};
  owners: OwnerMount[];
  obligations: string[];
}
