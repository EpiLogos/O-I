/** Native QL evidence accounting. These shares are not receiver dynamics. */
export type NatalEvidenceChannel = 'direct-planetary-resonance' | 'decan-ruler-reception';
export type Efwa = readonly [number, number, number, number];

export interface EvidenceShare {
  raw_efwa: Efwa;
  weighted_power: number;
  elemental_share_l1: Efwa | null;
  mass_share_l1: number | null;
}

export interface NativeEvidencePartition {
  schema: 'ql.nara-planetary-evidence-partition/v1';
  channel: NatalEvidenceChannel;
  available: boolean;
  basis_order: readonly ['Earth', 'Fire', 'Water', 'Air'];
  denominator: {
    weighted_total: number;
    input_planet_ids: readonly number[];
    source_field: 'raw_efwa';
    normalization: 'L1';
    scope: string;
  };
  source: {
    snapshot_ref: string;
    weighting_policy: string;
    registry_revision: string;
    route: string;
    arithmetic: string;
    weighting_source: unknown;
  };
  centres: readonly (EvidenceShare & {
    ordinal: number;
    native_m2_chakra_id: number;
    source_coordinate: string;
  })[];
  unrouted: EvidenceShare & {planet_ids: readonly number[]};
  unresolved: EvidenceShare & {planet_ids: readonly number[]};
  standing: string;
  channel_combination: string;
  effect_authority_granted: false;
}
