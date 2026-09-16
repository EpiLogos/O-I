/**
 * ql.techne/v1 — the O:I TypeScript mirror of the canonical QL-MEF Technē
 * contract (L5 Technē Instrument Constellation, T0 seam).
 *
 * Canonical sources (QL-MEF repo, `schemas/techne/`):
 *   - ql-techne-reading-v1.schema.json   ($id ql.techne/reading/v1)
 *   - ql-techne-session-v1.schema.json   ($id ql.techne/session/v1)
 *   - fixtures: QL-MEF `fixtures/techne/*.json`
 *   - contract text: QL-MEF `docs/L5-TECHNE-INSTRUMENT-WAYFINDER.md` §2–§5, §17
 *
 * This file is a mirror; drift is a contract bug. Native refs are opaque and
 * carried verbatim — never translated, re-keyed or shortened. Missing
 * QL/temporal/spatial/Expression facets are data, not errors. View, layout,
 * camera and lane state are presentation state and are deliberately
 * inexpressible here (§3). Native Actions are routed to their owner, never
 * executed through an adapter (§1.2).
 *
 * Written in erasable TypeScript (no enums/namespaces) so the same mirror is
 * loadable by the renderer, by Vite, and directly by `node --test` type
 * stripping.
 */

/** The contract tag every reading and session carries. */
export const TECHNE_CONTRACT = "ql.techne/v1";

// ---------------------------------------------------------------------------
// Reading (ql.techne/reading/v1)
// ---------------------------------------------------------------------------

/** The instrument set of the one M′ field's two readings (amended
 * 2026-09-16, owner-ratified; grounds: QL-MEF #73/#201/#42). The six 4:2
 * deep instruments bind M0′–M5′; `expressions` is the conjugate 3:3
 * Expression reading, not a deep instrument. */
export type TechneInstrument =
  | "project"
  | "canvas"
  | "timeline"
  | "journey"
  | "place"
  | "palace"
  | "expressions";

export const TECHNE_INSTRUMENTS: readonly TechneInstrument[] = [
  "project",
  "canvas",
  "timeline",
  "journey",
  "place",
  "palace",
  "expressions",
] as const;

/** Which reading of the one M′ field an aperture carries. Crossing changes
 * the mode of disclosure and available operations, never the subject. */
export type TechneReadingKind = "4:2-deep" | "3:3-conjugate";

/** One labelled native time fact. Occurrence, receipt, validity and
 * continuity stay distinct; consumers never collapse them to created_at. */
export type TechneTemporalKind =
  | "occurrence"
  | "receipt"
  | "valid"
  | "source-created"
  | "source-modified"
  | "day"
  | "now"
  | "session"
  | "run"
  | "generation"
  | "presentation";

export type TechneTemporalPrecision =
  | "millennium"
  | "century"
  | "decade"
  | "year"
  | "month"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "subsecond";

/** Place precision: exact, approximate, regional, or honestly unlocated. */
export type TechnePlacePrecision = "exact" | "approximate" | "region" | "unlocated";

/** QL lens refs, e.g. `mef:lens:L5@1` / `mef:lens:L5'@1`. */
export type TechneLensRef = string;
/** QL sublens refs, e.g. `mef:sublens:L5.3@1`. */
export type TechneSublensRef = string;

export type TechneQlResultClass =
  | "canonical"
  | "deterministic"
  | "semantic-stochastic"
  | "research";

/** Shared snapshot/revision basis for one coherent cross-view reading. */
export interface TechneReadingSnapshot {
  revision: string | null;
  basis_ref?: string | null;
}

export interface TechneSubjectReading {
  ref: string;
  revision?: string | null;
}

export interface TechneSubject {
  subject_ref: string;
  native_owner: string;
  native_revision?: string | null;
  readings?: TechneSubjectReading[];
  kind?: string | null;
  standing?: string | null;
}

/** Provider-relation vocabulary is preserved verbatim, never relabelled. */
export interface TechneWholeRelation {
  relation: string;
  from_ref: string;
  to_ref: string;
  origin?: string | null;
  origin_ref?: string | null;
}

/** Bounded local whole; never a global graph. */
export interface TechneWhole {
  whole_ref: string;
  member_refs?: string[];
  relations?: TechneWholeRelation[];
  focus_refs?: string[];
}

/** A QL facet exists only when warranted; the warrant is the existing
 * QlProvenance + ResultClass + evidence discipline, not a new authority. */
export interface TechneQlWarrant {
  result_class: TechneQlResultClass;
  evidence_refs: [string, ...string[]];
  provenance_ref: string;
}

export interface WarrantedQlReading {
  address?: string | null;
  shape_ref?: string | null;
  constellation_ref?: string | null;
  lens_ref?: TechneLensRef | null;
  sublens_ref?: TechneSublensRef | null;
  context_frame_ref?: string | null;
  refraction_summary?: string | null;
  harmonic_reading?: string | null;
  geometric_reading?: string | null;
  vak_source_ref?: string | null;
  derivation_refs?: string[];
  warrant: TechneQlWarrant;
}

export interface TechneTemporalInterval {
  from?: string | null;
  to?: string | null;
  from_precision?: TechneTemporalPrecision;
  to_precision?: TechneTemporalPrecision;
}

/** A temporal facet must carry at least one carrier: instant, interval,
 * day_ref, now_ref, session_ref or run_ref. */
export interface TechneTemporalFacet {
  facet_ref?: string | null;
  kind: TechneTemporalKind;
  instant?: string;
  interval?: TechneTemporalInterval;
  precision?: TechneTemporalPrecision;
  day_ref?: string;
  now_ref?: string;
  session_ref?: string;
  run_ref?: string;
  timezone_policy_ref?: string | null;
  uncertainty?: string | null;
  source_ref?: string | null;
}

export interface TechnePlaceName {
  name: string;
  valid_from?: string | null;
  valid_to?: string | null;
}

export interface TechnePlaceGeometry {
  type: "point" | "polygon";
  coordinates: unknown;
}

export interface TechnePlaceHierarchyEntry {
  place_ref: string;
  relation: string;
  valid_from?: string | null;
  valid_to?: string | null;
}

/** Temporally valid Place identity independent of coordinates; uncertainty
 * is data. */
export interface TechnePlaceFacet {
  place_ref: string;
  identity?: { names?: TechnePlaceName[] };
  geometry?: TechnePlaceGeometry;
  precision: TechnePlacePrecision;
  hierarchy?: TechnePlaceHierarchyEntry[];
  valid_from?: string | null;
  valid_to?: string | null;
  observer_frame?: string | null;
  source_ref?: string | null;
}

/** Exact source selector where the native producer supplies one. */
export type TechneSourceSelector =
  | { unit: "text_span"; start: number; end: number; anchor_ref?: string | null }
  | { unit: "timestamp_range"; from: string; to: string }
  | { unit: "image_region"; x: number; y: number; width: number; height: number }
  | { unit: "other"; kind: string; value: string };

export interface TechneSourceProvenance {
  source_ref: string;
  source_revision?: string | null;
  native_owner: string;
  selector?: TechneSourceSelector | null;
  standing?: string | null;
  evidence_refs?: string[];
}

export interface TechneExpressionBinding {
  expression_ref: string;
  revision?: string | null;
  scene_ref?: string | null;
  composition_ref?: string | null;
  profile_ref?: string | null;
}

/** A native owner's disclosed Action. The adapter routes; only the native
 * owner executes, under its own authority. */
export interface NativeActionRef {
  action_ref: string;
  native_owner: string;
  authority: string;
  summary?: string | null;
  expected_effects?: string[];
  input_schema_ref?: string | null;
}

export interface TechneDisclosureEntry {
  instrument: TechneInstrument;
  available: boolean;
  /** Required when available is false; capability honesty, never hidden. */
  reason?: string;
  /** The M′ office this instrument is the Technē face of. Absent on the
   * conjugate 3:3 reading. */
  m_prime?: number;
  reading?: TechneReadingKind;
}

export interface TechneDisclosureNote {
  instrument: TechneInstrument;
  reason: string;
}

/** Capability honesty: available instruments and explicit degraded/unavailable
 * reasons. Drives every instrument affordance; availability is never
 * hard-coded per route. */
export interface TechneDisclosure {
  instruments: TechneDisclosureEntry[];
  degraded?: TechneDisclosureNote[];
  suggestions?: TechneDisclosureNote[];
}

/** The portable Technē reading: attributable facts over native owners. */
export interface TechneReading {
  contract: typeof TECHNE_CONTRACT;
  reading_ref: string;
  snapshot?: TechneReadingSnapshot;
  subject: TechneSubject;
  whole?: TechneWhole;
  ql?: WarrantedQlReading;
  temporal?: TechneTemporalFacet[];
  spatial?: TechnePlaceFacet[];
  provenance?: TechneSourceProvenance[];
  expressions?: TechneExpressionBinding[];
  actions?: NativeActionRef[];
  disclosure: TechneDisclosure;
}

// ---------------------------------------------------------------------------
// Session (ql.techne/session/v1)
// ---------------------------------------------------------------------------

/** The K9 selection-standing discipline, carried across instruments. */
export type DisclosureStanding = "current" | "field-advanced" | "stale";

/** Source-qualified selection co-referenced by every instrument. */
export interface DisclosureSelection {
  selection_ref: string;
  subject_ref: string;
  coordinate_ref?: string | null;
  source_ref?: string | null;
  source_revision?: string | null;
  disclosure_ref?: string | null;
  focus_refs?: string[];
  reading_ref: string;
  snapshot_revision?: string | null;
  instrument: TechneInstrument;
  /** Ref into the owner's real agent-session grammar; never a desktop-owned
   * session record, never minted here. */
  agent_session_ref?: string | null;
  selection_standing?: DisclosureStanding | null;
}

export interface DisclosureNavigationHop {
  from_instrument: TechneInstrument;
  to_instrument: TechneInstrument;
  selection_ref: string;
}

/** The ephemeral cross-instrument disclosure session. Not a canonical domain
 * object; every hop preserves subject, source basis and selection unless the
 * person deliberately refreshed. */
export interface DisclosureSession {
  contract: typeof TECHNE_CONTRACT;
  session_ref: string;
  subject_ref: string;
  selection: DisclosureSelection;
  instrument: TechneInstrument;
  reading_ref: string;
  time_window?: { from: string | null; to: string | null };
  spatial_focus_ref?: string;
  expression_focus_ref?: string;
  navigation?: DisclosureNavigationHop[];
}

/** A mutation request entering the adapter: routing only, never execution.
 * Execution crosses the native authority seam (desktop KernelOp invoke_action
 * / owner CLI). */
export interface TechneActionRoute {
  action_ref: string;
  subject_ref: string;
  selection_ref?: string | null;
  input?: unknown;
}

/** The routing receipt: what the owner would execute and under what
 * authority. `routed: false` carries the reason. */
export interface TechneActionReceipt {
  action_ref: string;
  native_owner: string;
  routed: boolean;
  reason?: string | null;
  authority?: string | null;
  expected_effects?: string[];
}

// ---------------------------------------------------------------------------
// Runtime validators — the schema laws, executable
// ---------------------------------------------------------------------------

export interface TechneValidation {
  valid: boolean;
  errors: string[];
}

const ok: TechneValidation = { valid: true, errors: [] };
const invalid = (errors: string[]): TechneValidation => ({ valid: false, errors });

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ref(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function nullableRef(value: unknown): boolean {
  return value === null || ref(value);
}

function stringOrNull(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function stringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function refArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(ref);
}

/** Unknown keys are refused: the schema's additionalProperties:false, which is
 * what keeps presentation state (camera, layout, lanes) inexpressible. */
function keysAllowed(value: Record<string, unknown>, allowed: readonly string[], label: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${label}: unknown field "${key}"`);
  }
}

function isInstrument(value: unknown): value is TechneInstrument {
  return typeof value === "string" && (TECHNE_INSTRUMENTS as readonly string[]).includes(value);
}

const TEMPORAL_PRECISIONS: readonly string[] = ["millennium", "century", "decade", "year", "month", "day", "hour", "minute", "second", "subsecond"];
const PLACE_PRECISIONS: readonly string[] = ["exact", "approximate", "region", "unlocated"];
const RESULT_CLASSES: readonly string[] = ["canonical", "deterministic", "semantic-stochastic", "research"];
const TEMPORAL_KINDS: readonly string[] = ["occurrence", "receipt", "valid", "source-created", "source-modified", "day", "now", "session", "run", "generation", "presentation"];
const LENS_PATTERN = /^mef:lens:L[0-5]'?@1$/;
const SUBLENS_PATTERN = /^mef:sublens:L[0-5]'?\.[0-5]@1$/;
const STANDINGS: readonly string[] = ["current", "field-advanced", "stale"];
const TEMPORAL_CARRIERS: readonly string[] = ["instant", "interval", "day_ref", "now_ref", "session_ref", "run_ref"];

function validateQlWarrant(value: unknown, label: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${label}: warrant must be an object`); return; }
  keysAllowed(value, ["result_class", "evidence_refs", "provenance_ref"], label, errors);
  if (!RESULT_CLASSES.includes(value.result_class as string)) errors.push(`${label}.result_class: not a QL result class`);
  if (!Array.isArray(value.evidence_refs) || value.evidence_refs.length < 1 || !value.evidence_refs.every(ref)) {
    errors.push(`${label}.evidence_refs: a QL warrant requires at least one evidence ref`);
  }
  if (!ref(value.provenance_ref)) errors.push(`${label}.provenance_ref: required`);
}

function validateQlReading(value: unknown, errors: string[]): void {
  if (!isObject(value)) { errors.push("ql: must be an object"); return; }
  keysAllowed(value, ["address", "shape_ref", "constellation_ref", "lens_ref", "sublens_ref", "context_frame_ref", "refraction_summary", "harmonic_reading", "geometric_reading", "vak_source_ref", "derivation_refs", "warrant"], "ql", errors);
  for (const key of ["address", "shape_ref", "constellation_ref", "context_frame_ref", "vak_source_ref"]) {
    if (value[key] !== undefined && !nullableRef(value[key])) errors.push(`ql.${key}: must be a ref or null`);
  }
  if (value.lens_ref !== undefined && value.lens_ref !== null && !(typeof value.lens_ref === "string" && LENS_PATTERN.test(value.lens_ref))) errors.push("ql.lens_ref: not a lens ref");
  if (value.sublens_ref !== undefined && value.sublens_ref !== null && !(typeof value.sublens_ref === "string" && SUBLENS_PATTERN.test(value.sublens_ref))) errors.push("ql.sublens_ref: not a sublens ref");
  for (const key of ["refraction_summary", "harmonic_reading", "geometric_reading"]) {
    if (value[key] !== undefined && !stringOrNull(value[key])) errors.push(`ql.${key}: must be a string or null`);
  }
  if (value.derivation_refs !== undefined && !refArray(value.derivation_refs)) errors.push("ql.derivation_refs: must be an array of refs");
  if (value.warrant === undefined) errors.push("ql.warrant: a QL facet exists only when warranted");
  else validateQlWarrant(value.warrant, "ql.warrant", errors);
}

function validateTemporalFacet(value: unknown, label: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${label}: must be an object`); return; }
  keysAllowed(value, ["facet_ref", "kind", "instant", "interval", "precision", "day_ref", "now_ref", "session_ref", "run_ref", "timezone_policy_ref", "uncertainty", "source_ref"], label, errors);
  if (!TEMPORAL_KINDS.includes(value.kind as string)) errors.push(`${label}.kind: not a temporal kind`);
  if (value.facet_ref !== undefined && !nullableRef(value.facet_ref)) errors.push(`${label}.facet_ref: must be a ref or null`);
  if (value.precision !== undefined && !TEMPORAL_PRECISIONS.includes(value.precision as string)) errors.push(`${label}.precision: not a temporal precision`);
  for (const key of ["day_ref", "now_ref", "session_ref", "run_ref"]) {
    if (value[key] !== undefined && !ref(value[key])) errors.push(`${label}.${key}: must be a ref`);
  }
  for (const key of ["timezone_policy_ref", "source_ref"]) {
    if (value[key] !== undefined && !nullableRef(value[key])) errors.push(`${label}.${key}: must be a ref or null`);
  }
  if (value.uncertainty !== undefined && !stringOrNull(value.uncertainty)) errors.push(`${label}.uncertainty: must be a string or null`);
  if (value.instant !== undefined && !ref(value.instant)) errors.push(`${label}.instant: must be a timestamp`);
  if (value.interval !== undefined) {
    const interval = value.interval;
    if (!isObject(interval)) { errors.push(`${label}.interval: must be an object`); return; }
    keysAllowed(interval, ["from", "to", "from_precision", "to_precision"], `${label}.interval`, errors);
    for (const key of ["from", "to"]) if (interval[key] !== undefined && !stringOrNull(interval[key])) errors.push(`${label}.interval.${key}: must be a timestamp or null`);
    for (const key of ["from_precision", "to_precision"]) if (interval[key] !== undefined && !TEMPORAL_PRECISIONS.includes(interval[key] as string)) errors.push(`${label}.interval.${key}: not a temporal precision`);
  }
  if (!TEMPORAL_CARRIERS.some((carrier) => value[carrier] !== undefined)) {
    errors.push(`${label}: a temporal facet carries at least one of instant, interval, day_ref, now_ref, session_ref, run_ref`);
  }
}

function validatePlaceFacet(value: unknown, label: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${label}: must be an object`); return; }
  keysAllowed(value, ["place_ref", "identity", "geometry", "precision", "hierarchy", "valid_from", "valid_to", "observer_frame", "source_ref"], label, errors);
  if (!ref(value.place_ref)) errors.push(`${label}.place_ref: required`);
  if (!PLACE_PRECISIONS.includes(value.precision as string)) errors.push(`${label}.precision: not a place precision`);
  for (const key of ["valid_from", "valid_to"]) if (value[key] !== undefined && !stringOrNull(value[key])) errors.push(`${label}.${key}: must be a string or null`);
  for (const key of ["observer_frame", "source_ref"]) if (value[key] !== undefined && !nullableRef(value[key])) errors.push(`${label}.${key}: must be a ref or null`);
  if (value.identity !== undefined) {
    const identity = value.identity;
    if (!isObject(identity)) { errors.push(`${label}.identity: must be an object`); return; }
    keysAllowed(identity, ["names"], `${label}.identity`, errors);
    if (identity.names !== undefined) {
      if (!Array.isArray(identity.names)) { errors.push(`${label}.identity.names: must be an array`); return; }
      identity.names.forEach((entry, index) => {
        if (!isObject(entry)) { errors.push(`${label}.identity.names[${index}]: must be an object`); return; }
        keysAllowed(entry, ["name", "valid_from", "valid_to"], `${label}.identity.names[${index}]`, errors);
        if (!ref(entry.name)) errors.push(`${label}.identity.names[${index}].name: required`);
        for (const key of ["valid_from", "valid_to"]) if (entry[key] !== undefined && !stringOrNull(entry[key])) errors.push(`${label}.identity.names[${index}].${key}: must be a string or null`);
      });
    }
  }
  if (value.geometry !== undefined) {
    const geometry = value.geometry;
    if (!isObject(geometry)) { errors.push(`${label}.geometry: must be an object`); return; }
    keysAllowed(geometry, ["type", "coordinates"], `${label}.geometry`, errors);
    if (geometry.type !== "point" && geometry.type !== "polygon") errors.push(`${label}.geometry.type: point or polygon`);
    if (!("coordinates" in geometry)) errors.push(`${label}.geometry.coordinates: required`);
  }
  if (value.hierarchy !== undefined) {
    if (!Array.isArray(value.hierarchy)) { errors.push(`${label}.hierarchy: must be an array`); return; }
    value.hierarchy.forEach((entry, index) => {
      if (!isObject(entry)) { errors.push(`${label}.hierarchy[${index}]: must be an object`); return; }
      keysAllowed(entry, ["place_ref", "relation", "valid_from", "valid_to"], `${label}.hierarchy[${index}]`, errors);
      if (!ref(entry.place_ref)) errors.push(`${label}.hierarchy[${index}].place_ref: required`);
      if (!ref(entry.relation)) errors.push(`${label}.hierarchy[${index}].relation: required`);
      for (const key of ["valid_from", "valid_to"]) if (entry[key] !== undefined && !stringOrNull(entry[key])) errors.push(`${label}.hierarchy[${index}].${key}: must be a string or null`);
    });
  }
}

function validateSourceSelector(value: unknown, label: string, errors: string[]): void {
  if (value === null) return;
  if (!isObject(value)) { errors.push(`${label}: must be an object or null`); return; }
  switch (value.unit) {
    case "text_span":
      keysAllowed(value, ["unit", "start", "end", "anchor_ref"], label, errors);
      if (!Number.isInteger(value.start) || (value.start as number) < 0) errors.push(`${label}.start: non-negative integer`);
      if (!Number.isInteger(value.end) || (value.end as number) < 0) errors.push(`${label}.end: non-negative integer`);
      if (value.anchor_ref !== undefined && !nullableRef(value.anchor_ref)) errors.push(`${label}.anchor_ref: must be a ref or null`);
      return;
    case "timestamp_range":
      keysAllowed(value, ["unit", "from", "to"], label, errors);
      if (!ref(value.from) || !ref(value.to)) errors.push(`${label}.from/to: timestamps required`);
      return;
    case "image_region":
      keysAllowed(value, ["unit", "x", "y", "width", "height"], label, errors);
      for (const key of ["x", "y", "width", "height"]) if (typeof value[key] !== "number" || Number.isNaN(value[key] as number)) errors.push(`${label}.${key}: number`);
      return;
    case "other":
      keysAllowed(value, ["unit", "kind", "value"], label, errors);
      if (!ref(value.kind) || !ref(value.value)) errors.push(`${label}.kind/value: required`);
      return;
    default:
      errors.push(`${label}.unit: text_span, timestamp_range, image_region or other`);
  }
}

function validateProvenance(value: unknown, label: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${label}: must be an object`); return; }
  keysAllowed(value, ["source_ref", "source_revision", "native_owner", "selector", "standing", "evidence_refs"], label, errors);
  if (!ref(value.source_ref)) errors.push(`${label}.source_ref: required`);
  if (!ref(value.native_owner)) errors.push(`${label}.native_owner: required`);
  if (value.source_revision !== undefined && !stringOrNull(value.source_revision)) errors.push(`${label}.source_revision: must be a string or null`);
  if (value.selector !== undefined) validateSourceSelector(value.selector, `${label}.selector`, errors);
  if (value.standing !== undefined && !stringOrNull(value.standing)) errors.push(`${label}.standing: must be a string or null`);
  if (value.evidence_refs !== undefined && !refArray(value.evidence_refs)) errors.push(`${label}.evidence_refs: must be an array of refs`);
}

function validateExpressionBinding(value: unknown, label: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${label}: must be an object`); return; }
  keysAllowed(value, ["expression_ref", "revision", "scene_ref", "composition_ref", "profile_ref"], label, errors);
  if (!ref(value.expression_ref)) errors.push(`${label}.expression_ref: required`);
  if (value.revision !== undefined && !stringOrNull(value.revision)) errors.push(`${label}.revision: must be a string or null`);
  for (const key of ["scene_ref", "composition_ref", "profile_ref"]) if (value[key] !== undefined && !nullableRef(value[key])) errors.push(`${label}.${key}: must be a ref or null`);
}

function validateNativeAction(value: unknown, label: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${label}: must be an object`); return; }
  keysAllowed(value, ["action_ref", "native_owner", "authority", "summary", "expected_effects", "input_schema_ref"], label, errors);
  if (!ref(value.action_ref)) errors.push(`${label}.action_ref: required`);
  if (!ref(value.native_owner)) errors.push(`${label}.native_owner: required`);
  if (!ref(value.authority)) errors.push(`${label}.authority: required`);
  if (value.summary !== undefined && !stringOrNull(value.summary)) errors.push(`${label}.summary: must be a string or null`);
  if (value.expected_effects !== undefined && !stringArray(value.expected_effects)) errors.push(`${label}.expected_effects: must be an array of strings`);
  if (value.input_schema_ref !== undefined && !nullableRef(value.input_schema_ref)) errors.push(`${label}.input_schema_ref: must be a ref or null`);
}

function validateDisclosure(value: unknown, label: string, errors: string[]): void {
  if (!isObject(value)) { errors.push(`${label}: must be an object`); return; }
  keysAllowed(value, ["instruments", "degraded", "suggestions"], label, errors);
  if (!Array.isArray(value.instruments)) { errors.push(`${label}.instruments: required array`); return; }
  value.instruments.forEach((entry, index) => {
    const entryLabel = `${label}.instruments[${index}]`;
    if (!isObject(entry)) { errors.push(`${entryLabel}: must be an object`); return; }
    keysAllowed(entry, ["instrument", "available", "reason", "m_prime", "reading"], entryLabel, errors);
    if (!isInstrument(entry.instrument)) errors.push(`${entryLabel}.instrument: not an instrument`);
    if (typeof entry.available !== "boolean") { errors.push(`${entryLabel}.available: boolean`); return; }
    if (entry.available === false && !ref(entry.reason)) errors.push(`${entryLabel}: an unavailable instrument requires a reason`);
    if (entry.reason !== undefined && !stringOrNull(entry.reason)) errors.push(`${entryLabel}.reason: must be a string or null`);
    if (entry.m_prime !== undefined && (typeof entry.m_prime !== "number" || !Number.isInteger(entry.m_prime) || entry.m_prime < 0 || entry.m_prime > 5)) {
      errors.push(`${entryLabel}.m_prime: must be an integer 0-5 (the field has M′0–M′5 only)`);
    }
    if (entry.reading !== undefined && entry.reading !== "4:2-deep" && entry.reading !== "3:3-conjugate") {
      errors.push(`${entryLabel}.reading: must be "4:2-deep" or "3:3-conjugate"`);
    }
  });
  for (const key of ["degraded", "suggestions"]) {
    if (value[key] === undefined) continue;
    if (!Array.isArray(value[key])) { errors.push(`${label}.${key}: must be an array`); continue; }
    (value[key] as unknown[]).forEach((entry, index) => {
      const noteLabel = `${label}.${key}[${index}]`;
      if (!isObject(entry)) { errors.push(`${noteLabel}: must be an object`); return; }
      keysAllowed(entry, ["instrument", "reason"], noteLabel, errors);
      if (!isInstrument(entry.instrument)) errors.push(`${noteLabel}.instrument: not an instrument`);
      if (!ref(entry.reason)) errors.push(`${noteLabel}.reason: required`);
    });
  }
}

/** Validate one ql.techne/v1 reading against the canonical schema laws. */
export function validateReading(value: unknown): TechneValidation {
  const errors: string[] = [];
  if (!isObject(value)) return invalid(["reading: must be an object"]);
  keysAllowed(value, ["contract", "reading_ref", "snapshot", "subject", "whole", "ql", "temporal", "spatial", "provenance", "expressions", "actions", "disclosure"], "reading", errors);
  if (value.contract !== TECHNE_CONTRACT) errors.push(`reading.contract: must be "${TECHNE_CONTRACT}"`);
  if (!ref(value.reading_ref)) errors.push("reading.reading_ref: required");
  if (value.snapshot !== undefined) {
    const snapshot = value.snapshot;
    if (!isObject(snapshot)) errors.push("reading.snapshot: must be an object");
    else {
      keysAllowed(snapshot, ["revision", "basis_ref"], "reading.snapshot", errors);
      if (!stringOrNull(snapshot.revision)) errors.push("reading.snapshot.revision: must be a string or null");
      if (snapshot.basis_ref !== undefined && !nullableRef(snapshot.basis_ref)) errors.push("reading.snapshot.basis_ref: must be a ref or null");
    }
  }
  const subject = value.subject;
  if (!isObject(subject)) errors.push("reading.subject: required object");
  else {
    keysAllowed(subject, ["subject_ref", "native_owner", "native_revision", "readings", "kind", "standing"], "reading.subject", errors);
    if (!ref(subject.subject_ref)) errors.push("reading.subject.subject_ref: required");
    if (!ref(subject.native_owner)) errors.push("reading.subject.native_owner: required");
    if (subject.native_revision !== undefined && !stringOrNull(subject.native_revision)) errors.push("reading.subject.native_revision: must be a string or null");
    for (const key of ["kind", "standing"]) if (subject[key] !== undefined && !stringOrNull(subject[key])) errors.push(`reading.subject.${key}: must be a string or null`);
    if (subject.readings !== undefined) {
      if (!Array.isArray(subject.readings)) errors.push("reading.subject.readings: must be an array");
      else subject.readings.forEach((entry, index) => {
        if (!isObject(entry)) { errors.push(`reading.subject.readings[${index}]: must be an object`); return; }
        keysAllowed(entry, ["ref", "revision"], `reading.subject.readings[${index}]`, errors);
        if (!ref(entry.ref)) errors.push(`reading.subject.readings[${index}].ref: required`);
        if (entry.revision !== undefined && !stringOrNull(entry.revision)) errors.push(`reading.subject.readings[${index}].revision: must be a string or null`);
      });
    }
  }
  if (value.whole !== undefined) {
    const whole = value.whole;
    if (!isObject(whole)) errors.push("reading.whole: must be an object");
    else {
      keysAllowed(whole, ["whole_ref", "member_refs", "relations", "focus_refs"], "reading.whole", errors);
      if (!ref(whole.whole_ref)) errors.push("reading.whole.whole_ref: required");
      for (const key of ["member_refs", "focus_refs"]) if (whole[key] !== undefined && !refArray(whole[key])) errors.push(`reading.whole.${key}: must be an array of refs`);
      if (whole.relations !== undefined) {
        if (!Array.isArray(whole.relations)) errors.push("reading.whole.relations: must be an array");
        else whole.relations.forEach((entry, index) => {
          const label = `reading.whole.relations[${index}]`;
          if (!isObject(entry)) { errors.push(`${label}: must be an object`); return; }
          keysAllowed(entry, ["relation", "from_ref", "to_ref", "origin", "origin_ref"], label, errors);
          if (!ref(entry.relation)) errors.push(`${label}.relation: required`);
          if (!ref(entry.from_ref)) errors.push(`${label}.from_ref: required`);
          if (!ref(entry.to_ref)) errors.push(`${label}.to_ref: required`);
          for (const key of ["origin"]) if (entry[key] !== undefined && !stringOrNull(entry[key])) errors.push(`${label}.${key}: must be a string or null`);
          for (const key of ["origin_ref"]) if (entry[key] !== undefined && !nullableRef(entry[key])) errors.push(`${label}.${key}: must be a ref or null`);
        });
      }
    }
  }
  if (value.ql !== undefined) validateQlReading(value.ql, errors);
  for (const key of ["temporal", "spatial", "provenance", "expressions", "actions"]) {
    const facet = value[key];
    if (facet === undefined) continue;
    if (!Array.isArray(facet)) { errors.push(`reading.${key}: must be an array`); continue; }
    facet.forEach((entry, index) => {
      if (key === "temporal") validateTemporalFacet(entry, `reading.temporal[${index}]`, errors);
      else if (key === "spatial") validatePlaceFacet(entry, `reading.spatial[${index}]`, errors);
      else if (key === "provenance") validateProvenance(entry, `reading.provenance[${index}]`, errors);
      else if (key === "expressions") validateExpressionBinding(entry, `reading.expressions[${index}]`, errors);
      else validateNativeAction(entry, `reading.actions[${index}]`, errors);
    });
  }
  if (value.disclosure === undefined) errors.push("reading.disclosure: required");
  else validateDisclosure(value.disclosure, "reading.disclosure", errors);
  return errors.length ? invalid(errors) : ok;
}

/** Validate one DisclosureSelection (the seam's source-qualified selection). */
export function validateSelection(value: unknown): TechneValidation {
  const errors: string[] = [];
  const label = "session.selection";
  if (!isObject(value)) return invalid([`${label}: must be an object`]);
  keysAllowed(value, ["selection_ref", "subject_ref", "coordinate_ref", "source_ref", "source_revision", "disclosure_ref", "focus_refs", "reading_ref", "snapshot_revision", "instrument", "agent_session_ref", "selection_standing"], label, errors);
  for (const key of ["selection_ref", "subject_ref", "reading_ref"]) if (!ref(value[key])) errors.push(`${label}.${key}: required`);
  if (!isInstrument(value.instrument)) errors.push(`${label}.instrument: not an instrument`);
  for (const key of ["coordinate_ref", "source_ref", "disclosure_ref"]) if (value[key] !== undefined && !nullableRef(value[key])) errors.push(`${label}.${key}: must be a ref or null`);
  for (const key of ["source_revision", "snapshot_revision"]) if (value[key] !== undefined && !stringOrNull(value[key])) errors.push(`${label}.${key}: must be a string or null`);
  if (value.focus_refs !== undefined && !refArray(value.focus_refs)) errors.push(`${label}.focus_refs: must be an array of refs`);
  if (value.agent_session_ref !== undefined && !stringOrNull(value.agent_session_ref)) errors.push(`${label}.agent_session_ref: must be a ref or null`);
  if (value.selection_standing !== undefined && value.selection_standing !== null && !STANDINGS.includes(value.selection_standing as string)) errors.push(`${label}.selection_standing: current, field-advanced or stale`);
  return errors.length ? invalid(errors) : ok;
}

/** Validate one ql.techne/v1 session against the canonical schema laws. */
export function validateSession(value: unknown): TechneValidation {
  const errors: string[] = [];
  if (!isObject(value)) return invalid(["session: must be an object"]);
  keysAllowed(value, ["contract", "session_ref", "subject_ref", "selection", "instrument", "reading_ref", "time_window", "spatial_focus_ref", "expression_focus_ref", "navigation"], "session", errors);
  if (value.contract !== TECHNE_CONTRACT) errors.push(`session.contract: must be "${TECHNE_CONTRACT}"`);
  if (!ref(value.session_ref)) errors.push("session.session_ref: required");
  if (!ref(value.subject_ref)) errors.push("session.subject_ref: required");
  if (!ref(value.reading_ref)) errors.push("session.reading_ref: required");
  if (!isInstrument(value.instrument)) errors.push("session.instrument: not an instrument");
  for (const key of ["spatial_focus_ref", "expression_focus_ref"]) if (value[key] !== undefined && !ref(value[key])) errors.push(`session.${key}: must be a ref`);
  if (value.time_window !== undefined) {
    const window = value.time_window;
    if (!isObject(window)) errors.push("session.time_window: must be an object");
    else {
      keysAllowed(window, ["from", "to"], "session.time_window", errors);
      for (const key of ["from", "to"]) if (window[key] !== undefined && !stringOrNull(window[key])) errors.push(`session.time_window.${key}: must be a timestamp or null`);
    }
  }
  if (value.selection === undefined) errors.push("session.selection: required");
  else errors.push(...validateSelection(value.selection).errors);
  if (value.navigation !== undefined) {
    if (!Array.isArray(value.navigation)) errors.push("session.navigation: must be an array");
    else value.navigation.forEach((hop, index) => {
      const label = `session.navigation[${index}]`;
      if (!isObject(hop)) { errors.push(`${label}: must be an object`); return; }
      keysAllowed(hop, ["from_instrument", "to_instrument", "selection_ref"], label, errors);
      for (const key of ["from_instrument", "to_instrument"]) if (!isInstrument(hop[key])) errors.push(`${label}.${key}: not an instrument`);
      if (!ref(hop.selection_ref)) errors.push(`${label}.selection_ref: required`);
    });
  }
  if (isObject(value.selection) && ref(value.subject_ref) && ref(value.selection.subject_ref) && value.subject_ref !== value.selection.subject_ref) {
    errors.push("session: one subject — session.subject_ref must equal selection.subject_ref");
  }
  return errors.length ? invalid(errors) : ok;
}

/** Validate one ActionRoute (routing request entering the adapter). */
export function validateActionRoute(value: unknown): TechneValidation {
  const errors: string[] = [];
  if (!isObject(value)) return invalid(["route: must be an object"]);
  keysAllowed(value, ["action_ref", "subject_ref", "selection_ref", "input"], "route", errors);
  if (!ref(value.action_ref)) errors.push("route.action_ref: required");
  if (!ref(value.subject_ref)) errors.push("route.subject_ref: required");
  if (value.selection_ref !== undefined && !nullableRef(value.selection_ref)) errors.push("route.selection_ref: must be a ref or null");
  return errors.length ? invalid(errors) : ok;
}

/** Validate one ActionRouteReceipt (routing outcome, never an execution). */
export function validateActionReceipt(value: unknown): TechneValidation {
  const errors: string[] = [];
  if (!isObject(value)) return invalid(["receipt: must be an object"]);
  keysAllowed(value, ["action_ref", "native_owner", "routed", "reason", "authority", "expected_effects"], "receipt", errors);
  if (!ref(value.action_ref)) errors.push("receipt.action_ref: required");
  if (!ref(value.native_owner)) errors.push("receipt.native_owner: required");
  if (typeof value.routed !== "boolean") errors.push("receipt.routed: boolean");
  for (const key of ["reason", "authority"]) if (value[key] !== undefined && !stringOrNull(value[key])) errors.push(`receipt.${key}: must be a string or null`);
  if (value.expected_effects !== undefined && !stringArray(value.expected_effects)) errors.push("receipt.expected_effects: must be an array of strings");
  return errors.length ? invalid(errors) : ok;
}
