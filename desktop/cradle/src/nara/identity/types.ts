/** Native QL intake and Central source ownership; no renderer-side identity solver. */
export type JsonValue = null | boolean | number | string | JsonValue[] | {[key: string]: JsonValue};
export interface SourceRevision {source_ref: string; revision: string; standing_ref: string}
export type TimePrecision = 'exact' | 'approximate' | 'unknown';
export interface BirthPlace {
  label: string; latitude_degrees: number; longitude_degrees: number;
  timezone: string; source_ref: string;
}
export interface BirthData {
  date: string | null; time: string | null; precision: TimePrecision;
  uncertainty_minutes: number | null; fold: 0 | 1 | null; place: BirthPlace | null;
}
export interface IdentityReport {
  source: SourceRevision; method: string; route: 'import' | 'self-report';
  data: {[key: string]: JsonValue};
}
export type ReportKey = 'jungian' | 'gene_keys' | 'human_design' | 'quintessence';
export interface IdentityProfile {
  schema: 'ql.nara-identity-profile/v1'; person_ref: string; nara_ref: string;
  name: string; birth: BirthData; jungian: IdentityReport | null;
  gene_keys: IdentityReport | null; human_design: IdentityReport | null;
  quintessence: IdentityReport | null;
}
export interface IdentityMatrixRow {
  kind: string; coordinate: string; available: boolean;
  route: string; source: SourceRevision | null; method: string | null;
  data: JsonValue; absence_reason: string | null;
}
export interface NatalPoint {name: string; abs_pos: number; sign: string; position: number; retrograde?: boolean | null}
export interface NatalResult {
  schema: 'ql.nara-natal/v1'; status: 'available' | 'partial' | 'unavailable';
  reason: string | null; epoch_utc: string | null; request_ref: string;
  time_resolution: {local_datetime: string; timezone: string; precision: TimePrecision;
    fold: 0 | 1 | null; uncertainty_minutes: number | null;
    uncertainty_window_utc: [string, string] | null} | null;
  chart: {svg: string; sha256: string; media_type: 'image/svg+xml'; precision: TimePrecision;
    conditional: boolean; uncertainty_minutes: number | null; houses_system_name: string;
    zodiac: string; perspective: string; bodies: NatalPoint[]; houses: NatalPoint[];
    angles: NatalPoint[]} | null;
  sky: {snapshot_ref: string; provider: {name: string; version: string};
    bodies: {body: string; longitude_degrees: number; retrograde: boolean}[]} | null;
  provider: {name: string; kerykeion_version: string; network: string};
}
export interface NatalComposition {
  schema: 'ql.nara-natal-composition/v1'; policy: string; basis_order: string[];
  elemental_balance_l1: number[]; raw_efwa: number[];
  q_natal: {w: number; x: number; y: number; z: number}; quaternion_role: string;
  policy_source: {repository: string; revision: string; path: string; standing: string};
  planetary_contributions: {native_planet_id: number; body: string; sign: string;
    element: string; keplerian_weight: number; dignity: string; dignity_multiplier: number;
    weighted_contribution: number; receiving_centre_ordinal: number | null; role: string;
    m2_source_coordinate: string; native_cousto_frequency_hz: number}[];
  centre_evidence: {ordinal: number; label: string; planet_ids: number[];
    raw_efwa_evidence: number[]; standing: string;
    natal_orientation?: {status: 'available' | 'unavailable';
      quaternion: {w: number; x: number; y: number; z: number} | null;
      reason: string | null; role: string; effect_authority_granted: boolean;
      derivation: {method: string; input: string; normalization: string;
        mapping: {w: string; x: string; y: string; z: string}; snapshot_ref: string;
        policy: string; source_revision: string; source_blob: string;
        native_m2_registry_revision: string; native_m2_chakra_id: number; planet_ids: number[]}}}[];
  dynamics_standing: string;
}
export interface IdentityReading {
  schema: 'ql.nara-identity-reading/v1'; person_ref: string; nara_ref: string;
  input_revision: string; profile: IdentityProfile; matrix: IdentityMatrixRow[];
  natal: NatalResult | null; natal_composition?: NatalComposition | null;
  identity: JsonValue;
  material: {value: string; standing: string; supplied_offices: string[];
    identity_quaternion_ref: JsonValue; m3_form_address_ref: string | null};
  private: boolean; public_export: boolean;
}
export interface IdentitySource {source_ref: string; revision: string}
export interface SavedIdentity extends IdentitySource {name: string; person_ref: string}
export type NaraIdentityRequest =
  | {operation: 'inspect' | 'calculate'; profile: IdentityProfile}
  | {operation: 'list'}
  | {operation: 'open'; source_ref: string}
  | {operation: 'save'; profile: IdentityProfile; source_ref: string | null; expected_revision: string | null};
export interface NaraIdentityResult {
  schema: 'oi.nara-identity/v1'; reading?: IdentityReading; source?: IdentitySource;
  profiles?: SavedIdentity[]; state?: string; error?: string;
  errors?: {source_ref: string; error: string}[];
}
