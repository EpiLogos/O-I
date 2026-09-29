import type {ForceEmitterState} from './forceRuntime';
import type {NativeEvidencePartition, NatalEvidenceChannel} from '../../../src/nara/identity/evidencePartition';

/** Replaceable presentation policy, not a chakra activation or coupling law. */
export const NARA_EVIDENCE_FORCE_POLICY = 'oi.nara-evidence-force-share/v1' as const;

export interface NaraEvidenceForceProjection {
  policy: typeof NARA_EVIDENCE_FORCE_POLICY;
  channel: NatalEvidenceChannel;
  partition: NativeEvidencePartition;
  /** Native centre identities are bound explicitly by the owning host. */
  bindings: readonly {ordinal: number; entityId: string}[];
}

const near = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 1e-10;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const present = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function validatePartition(p: NativeEvidencePartition, channel: NatalEvidenceChannel): Map<number, number> {
  if (p?.schema !== 'ql.nara-planetary-evidence-partition/v1' || p.channel !== channel
    || !['direct-planetary-resonance', 'decan-ruler-reception'].includes(channel)
    || p.available !== true || p.effect_authority_granted !== false
    || JSON.stringify(p.basis_order) !== '["Earth","Fire","Water","Air"]') {
    throw new Error('A selected native natal evidence partition is required');
  }
  const denominator = p.denominator;
  if (!denominator || !nonnegative(denominator.weighted_total) || denominator.weighted_total === 0
    || denominator.normalization !== 'L1' || denominator.source_field !== 'raw_efwa'
    || !Array.isArray(denominator.input_planet_ids) || denominator.input_planet_ids.length !== 10
    || new Set(denominator.input_planet_ids).size !== 10
    || denominator.input_planet_ids.some(id => !Number.isInteger(id) || id < 0 || id > 9)
    || !p.source || ![p.source.snapshot_ref, p.source.weighting_policy, p.source.registry_revision,
      p.source.route, p.source.arithmetic].every(present)) {
    throw new Error('Natal evidence must retain its all-planet denominator and source basis');
  }
  if (!Array.isArray(p.centres) || p.centres.length !== 7 || !p.unrouted || !p.unresolved) {
    throw new Error('Natal evidence must retain seven centres and both residuals');
  }
  const factors = new Map<number, number>();
  let total = 0;
  for (const row of [...p.centres, p.unrouted, p.unresolved]) {
    if (!Array.isArray(row.raw_efwa) || row.raw_efwa.length !== 4 || !row.raw_efwa.every(nonnegative)
      || !Array.isArray(row.elemental_share_l1) || row.elemental_share_l1.length !== 4
      || !row.elemental_share_l1.every(nonnegative) || !nonnegative(row.weighted_power)
      || !nonnegative(row.mass_share_l1) || row.mass_share_l1 > 1
      || !near(row.raw_efwa.reduce((a:number, b:number) => a + b, 0), row.weighted_power)
      || !near(row.weighted_power / denominator.weighted_total, row.mass_share_l1)
      || row.raw_efwa.some((v:number, i:number) => !near(v / denominator.weighted_total, row.elemental_share_l1![i]))) {
      throw new Error('Natal evidence shares disagree with their original denominator');
    }
    total += row.mass_share_l1;
  }
  if (!near(total, 1)) throw new Error('Natal evidence partition does not conserve its input');
  for (const row of p.centres) {
    if (!Number.isInteger(row.ordinal) || row.ordinal < 0 || row.ordinal > 6 || factors.has(row.ordinal)
      || row.native_m2_chakra_id !== row.ordinal + 1 || row.source_coordinate !== `#2-5-0/1-${row.ordinal + 1}`) {
      throw new Error('Natal evidence centre identity is invalid or duplicated');
    }
    factors.set(row.ordinal, row.mass_share_l1!);
  }
  return factors;
}

/**
 * Apply AFTER compileEntityForceEmitters has resolved evaluated per-link forces.
 * The caller owns currentness, identity/disclosure and explicit policy selection.
 * Null returns the original array: disconnection cannot overwrite authored state.
 * A zero share omits the emitter, because a zero-strength planar vortex still has
 * a fixed inward shader term. No phase, radius, law, position or medium is changed.
 */
export function projectNaraEvidenceForces(
  emitters: readonly ForceEmitterState[],
  projection: NaraEvidenceForceProjection | null,
): readonly ForceEmitterState[] {
  if (projection === null) return emitters;
  if (projection.policy !== NARA_EVIDENCE_FORCE_POLICY) throw new Error('Unknown Nara force presentation policy');
  const factors = validatePartition(projection.partition, projection.channel);
  if (!Array.isArray(projection.bindings) || projection.bindings.length === 0) {
    throw new Error('Nara force presentation requires explicit centre bindings');
  }
  const byEntity = new Map<string, number>();
  const boundOrdinals = new Set<number>();
  for (const binding of projection.bindings) {
    if (!present(binding.entityId) || !factors.has(binding.ordinal) || byEntity.has(binding.entityId)
      || boundOrdinals.has(binding.ordinal)) throw new Error('Invalid or duplicate Nara force centre binding');
    byEntity.set(binding.entityId, factors.get(binding.ordinal)!);
    boundOrdinals.add(binding.ordinal);
  }
  return emitters.flatMap(emitter => {
    const factor = emitter.sourceEntityId === undefined ? undefined : byEntity.get(emitter.sourceEntityId);
    if (factor === undefined) return [emitter];
    if (factor === 0) return [];
    return [{...emitter, strength: emitter.strength * factor, spin: emitter.spin * factor}];
  });
}
