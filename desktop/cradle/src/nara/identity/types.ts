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
export type IdentityCompositionPolicy = 'draft-core-birthdate-decanic-40-60-v1';
export interface IdentityCompositionReading {
  schema: 'ql.nara-identity-composition/v1'; selected: boolean;
  policy: IdentityCompositionPolicy | null; status: string; standing: string;
  source: JsonValue; inputs: JsonValue; weights: number[];
  q_core: {w: number; x: number; y: number; z: number} | null;
  basis: string[]; caps: JsonValue; missing_inputs: string[];
  canonical_policy: false; effect_authority_granted: false;
}
export interface EncodingPolicy {
  policy_ref: string; y_policy: 'consonant' | 'vowel';
  full_pass_factor: number; anchor_factor: number; inverse_factor: number;
  square_factor: number; mobius_factor: number; spanda_factor: number; tritone_factor: number;
  position_element_factor: number; lens_element_factor: number; cap_factor: number;
  direct_element_multiplier: number;
  roles: Record<string, {weight: number; lens_affinities: number[]}>;
}
export interface BirthdateEncoding {
  schema: 'ql.nara-birthdate-encoding/v1'; status: string; standing: string;
  policy: EncodingPolicy; selected: boolean; policy_notes: string[];
  source: {repository: string; path: string; commit: string; blob: string; standing: string};
  numeric: {full_name_total: number | null; date_digit_total: number | null};
  lens_order: string[]; matrices: Record<string, Record<string, number[]>>;
  elemental: {status: string; raw_efwa: number[]; balance_efwa: number[] | null;
    quaternion: {w: number; x: number; y: number; z: number} | null; [key: string]: unknown};
  evidence: {id: string; role: string; raw: number; mod6: number; inverse: number;
    mod12: number; anchor_lens: string; direct_cell_meaning: string; weighted: boolean;
    unweighted_reason: string | null; cells: {lens: string; position: number; total: number; meaning: string}[]}[];
  absence_reasons: string[];
}
export interface IdentityProfile {
  schema: 'ql.nara-identity-profile/v1'; person_ref: string; nara_ref: string;
  name: string; birth: BirthData; jungian: IdentityReport | null;
  gene_keys: IdentityReport | null; human_design: IdentityReport | null;
  quintessence: IdentityReport | null;
  encoding_policy?: EncodingPolicy;
  composition_policy?: IdentityCompositionPolicy;
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
  presentation_partition?: import('./evidencePartition').NativeEvidencePartition;
  schema: 'ql.nara-natal-composition/v1'; policy: string; basis_order: string[];
  elemental_balance_l1: number[]; raw_efwa: number[];
  q_natal: {w: number; x: number; y: number; z: number}; quaternion_role: string;
  policy_source: {repository: string; revision: string; path: string; standing: string};
  planetary_contributions: {native_planet_id: number; body: string; sign: string;
    element: string; keplerian_weight: number; dignity: string; dignity_multiplier: number;
    weighted_contribution: number; receiving_centre_ordinal: number | null; role: string;
    m2_source_coordinate: string; native_cousto_frequency_hz: number;
    retained_m2_chakra_id?: number;
    planetary_chakra_route?: {planet_coordinate: string; chakra_coordinate: string;
      chakra_index: number; registry_revision: string; source_revision: string;
      relations: {relation_ref: string; source_kind: string; record: number}[]} | null}[];
  centre_evidence: {ordinal: number; label: string; planet_ids: number[];
    native_m2_chakra_id: number;
    body: {ordinal: number; body_zone: {source_ref: string; registry_revision: string;
      repository: string; revision: string; path: string; git_blob: string;
      record_index: number; payload_sha256: string; anatomical_location: string}};
    raw_efwa_evidence: number[]; standing: string;
    natal_orientation?: {status: 'available' | 'unavailable';
      quaternion: {w: number; x: number; y: number; z: number} | null;
      reason: string | null; role: string; effect_authority_granted: boolean;
      derivation: {method: string; input: string; normalization: string;
        mapping: {w: string; x: string; y: string; z: string}; snapshot_ref: string;
        policy: string; source_revision: string; source_blob: string;
        native_m2_registry_revision: string; native_m2_chakra_id: number; planet_ids: number[]}}}[];
  dynamics_standing: string;
  decanic_channel?: DecanicReading;
}
export interface DecanicReading {
  presentation_partition?: import('./evidencePartition').NativeEvidencePartition;
  schema: 'ql.nara-decan-ruler-reception/v1'; snapshot_ref: string;
  status: 'available' | 'partial';
  basis_order: string[]; weighting_policy: string; weighting_source: string;
  source_conflict: {reference: string; source_revision: string; path: string; section: string; detail: string};
  method_source: {repository: string; revision: string; path: string; blob: string; sections: string[]; standing: string};
  native_source: {table: string; registry_revision: string; sources: {path: string; sha256: string}[]};
  planetary_contributions: {native_planet_id: number; body: string; longitude_degrees: number;
    decan_global_index: number; decan_index_within_sign: number;
    faces: {face: number; native_decan_index: number; native_axes: number[];
      source_coordinate: string | null; descriptor: number[]}[]; selected_face: null;
    element: string; raw_efwa: number[]; weighted_contribution: number;
    decan_ruler_planet_id: number | null; decan_ruler: string | null; receiving_centre_ordinal: number | null;
    ruler_resolution: string; graph_decan_route: JsonValue;
    retained_c_ruler_planet_id: number; retained_c_ruler: string; retained_c_agrees_with_graph: boolean | null;
    decan_ruler_chakra_route: NatalComposition['planetary_contributions'][number]['planetary_chakra_route'];
    role: string; ruler_authority: string}[];
  centre_evidence: {ordinal: number; native_m2_chakra_id: number; source_coordinate: string;
    natal_planet_ids: number[]; raw_efwa_evidence: number[]; weighted_power: number;
    decan_ruler_orientation: {status: 'available' | 'unavailable';
      quaternion: {w: number; x: number; y: number; z: number} | null;
      normalization: string; role: string}}[];
  method_notes: string[]; effect_authority_granted: false;
}
export interface IdentityReading {
  schema: 'ql.nara-identity-reading/v1'; person_ref: string; nara_ref: string;
  input_revision: string; profile: IdentityProfile; matrix: IdentityMatrixRow[];
  natal: NatalResult | null; natal_composition?: NatalComposition | null;
  birthdate_encoding?: BirthdateEncoding;
  identity_composition?: IdentityCompositionReading;
  derived_identity_contributions?: {
    schema: 'ql.nara-derived-identity-contributions/v1';
    jungian: {status: string; absence_reason: string | null; raw_efwa?: number[] | null;
      balance_efwa?: number[] | null; quaternion: {w: number; x: number; y: number; z: number} | null;
      score_basis?: string | null; missing_functions?: string[]; unprojected_score_keys?: string[];
      caps?: {aether_gate: number | null; mineral_cap: number | null}; source?: JsonValue};
    gene_keys: {status: string; absence_reason: string; source?: JsonValue;
      spheres?: {name: string; key: NumericIdentityTrace; line_projection: {line: number; element: string; standing: string}}[]};
    human_design: {status: string; absence_reason: string; source?: JsonValue;
      gates?: {side: string; gate: NumericIdentityTrace; line_projection: null}[]};
    identity_blend: IdentityCompositionReading | null; blend_absence_reason: string | null;
  };
  identity: JsonValue;
  material: {value: string; standing: string; supplied_offices: string[];
    identity_quaternion_ref: JsonValue; m3_form_address_ref: string | null};
  private: boolean; public_export: boolean;
}
export interface NumericIdentityTrace {number: number; mod6: number; inverse: number; mod12: number; anchor_lens: string}
export interface IdentitySource {source_ref: string; revision: string}
export interface SavedIdentity extends IdentitySource {name: string; person_ref: string}
export interface SkyRequest {
  schema: 'ql.sky-request/v1'; epoch: string; timezone: string;
  mode: 'current' | 'historical'; perspective: 'Apparent Geocentric';
  zodiac: 'Tropical'; ayanamsha: null; observer: null;
  max_age_seconds: number; backend_policy: 'require-swiss-files' | 'allow-moshier';
}
/** Complete owner snapshot is carried unchanged; QL validates its provider,
 * receipt, body order and registry before deriving a personal current. */
export interface NativeSkySnapshot {
  schema: 'ql.sky-snapshot/v1'; snapshot_ref: string;
  [key: string]: JsonValue;
}
export type SnapshotPurpose = 'requested' | 'retained-occasion';
export interface SkyAdmission {
  schema:'ql.sky-admission/v1'; purpose:SnapshotPurpose; snapshot_ref:string;
  original_mode:'current'|'historical'; epoch_utc:string; receipt_utc:string;
  fresh_current_attested:boolean; validation:'immutable-snapshot-and-current-native-source';
  validator_source:{source_ref:'providers/sky/kerykeion_snapshot.py';revision:string}; standing:string;
}
export type NativePersonalSkySource =
  | {sky_request: SkyRequest; sky_snapshot?: never; snapshot_purpose?:'requested'}
  | {sky_snapshot: NativeSkySnapshot; sky_request?: never; snapshot_purpose?:SnapshotPurpose};
export interface NaraTransitReading {
  schema: 'ql.nara-transit/v1'; status: string;
  sky: {snapshot_ref: string; epoch_utc: string; request: SkyRequest; provider: JsonValue; bodies: {body: string; longitude_degrees: number; retrograde: boolean}[]} | null;
  q_transit: {w: number; x: number; y: number; z: number} | null;
  basis: string[]; elemental_counts: number[]; planetary_contributions: JsonValue;
  source: JsonValue; effect_authority_granted: false;
}
export interface PersonalCurrentReading {
  sky_admission?:SkyAdmission;
  schema: 'ql.nara-personal-current/v1'; identity: IdentityReading; transit: NaraTransitReading;
  q_identity: {w: number; x: number; y: number; z: number} | null;
  q_identity_transit: {w: number; x: number; y: number; z: number} | null;
  q_activity: {w:number;x:number;y:number;z:number}|null;
  q_composed: {w:number;x:number;y:number;z:number}|null; activity_status: string;
  activity?:{schema:'ql.nara-m3-activity/v1';policy:'historical-personal-frame-sprite-v1';status:string;
    subject_ref:string;event_ref:string;identity_source_ref:string;identity_revision:string;[key:string]:unknown};
  baseline_available: boolean; standing: string;
  resonance?: {signed_dot: number; score: number; source: JsonValue; standing: string} | null;
}
export type NaraIdentityRequest =
  | {operation: 'inspect' | 'calculate'; profile: IdentityProfile}
  | {operation: 'transit'; request: SkyRequest}
  | ({operation: 'personal_current'; source_ref: string; expected_revision: string} & NativePersonalSkySource)
  | {operation: 'list'}
  | {operation: 'open'; source_ref: string}
  | {operation: 'save'; profile: IdentityProfile; source_ref: string | null; expected_revision: string | null};
export interface NaraIdentityResult {
  schema: 'oi.nara-identity/v1'; reading?: IdentityReading; source?: IdentitySource;
  profiles?: SavedIdentity[]; state?: string; error?: string;
  errors?: {source_ref: string; error: string}[];
  transit?: NaraTransitReading; personal_current?: PersonalCurrentReading;
}
