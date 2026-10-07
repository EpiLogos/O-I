/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The app's PS-G sampler half (O-I, QL-MEF #296 / ticket #299): the Expressions
 * glyph sampler consuming the landed native form law.
 *
 * Law consumed, read-only, from QL-MEF main:
 *   crates/ql-mef/src/form_samples.rs     ql.psg-form-samples/v1
 *   crates/ql-mef/src/form_sequence.rs    ql.psg-form-sequence/v1 + ql.psg-fold-progress/v1
 *   crates/ql-mef/src/form_instrument.rs  ql.psg-form-instrument/v1 (+ resident geometry/observation)
 *
 * What this half owns, under the same law the native side proves:
 *
 *  - Retained correspondence. Every retained sample carries a stable per-point
 *    identity derived exactly as the native law derives it — FNV-1a 64 over
 *    `contract \0 prep_ref \0 layer_be u_be v_be` — so a sample ID computed here
 *    equals the native one for the same preparation reference and allocation
 *    point. Re-resolving the same preparation yields the identical body: same
 *    IDs, same order (layer-major, then row v, then column u), same rest
 *    coordinates.
 *
 *  - The dependency-correct cache key. The preparation's content digest covers
 *    exactly the declared preparation (treatment, layers, resolution, units,
 *    mask determination) and nothing else: fold progress, cursor and camera are
 *    not preparation inputs, so updating them never re-rasterises and never
 *    reseeds. (The digest here is the app-canonical serialisation — same
 *    dependency set, deterministic; byte-parity with the native serde digest is
 *    NOT claimed. Sample IDs ARE native-parity.)
 *
 *  - Fold progress is a pure deformation input. `applyFold` is a pure function
 *    of the retained body and the fold-progress receipt's commanded crease
 *    angles: the three M3 sites as the three orthogonal hinges through the body
 *    centre. No path from a progress read touches the rasterisation or reseed
 *    counters — the law is enforced by construction, not by discipline.
 *
 *  - Reseed only on genuine topology change. A resolution or layer change
 *    reseeds through the explicit old-to-new mapping (nearest predecessor per
 *    layer, ties by allocation order — the native remap law). A coating change
 *    (mask moved, topology stood) is refused by name: the residents continue by
 *    identity and nothing resets.
 *
 *  - Counters surfaced in the native instrument's shapes: rasterisations,
 *    cache hits, reseeds and progress reads per cache key, with receipts —
 *    so both halves read the same proof surface.
 *
 * This module is DOM-free and three-free: the rasterisation itself stays with
 * GlyphSampler (the app's rasteriser), which cites its output into the declared
 * mask — the mask is carried here, never invented.
 */

/** Contracts consumed (native law, QL-MEF main). */
export const FORM_SAMPLES_CONTRACT = 'ql.psg-form-samples/v1';
export const FOLD_SEQUENCE_CONTRACT = 'ql.psg-form-sequence/v1';
export const FOLD_PROGRESS_CONTRACT = 'ql.psg-fold-progress/v1';
export const FOLD_STAGE_EFFECT_CONTRACT = 'ql.psg-fold-stage-effect/v1';
export const FORM_INSTRUMENT_CONTRACT = 'ql.psg-form-instrument/v1';
export const RESIDENT_GEOMETRY_CONTRACT = 'ql.psg-resident-geometry/v1';
export const RESIDENT_OBSERVATION_CONTRACT = 'ql.psg-resident-observation/v1';

/** The bounded preparation envelope, as the native law bounds it. */
export const MAX_RESOLUTION = 64;
export const MAX_LAYERS = 16;
const MAX_UNITS = 1_000_000;

/** Refusals name the law they refuse under. */
export class FormLawError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormLawError';
  }
}

// ---------------------------------------------------------------------------
// Identity law — byte-exact with the native FNV-1a 64 layout.
// ---------------------------------------------------------------------------

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;

export function fnv1a64(bytes: Uint8Array): bigint {
  let hash = FNV_OFFSET;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= BigInt(bytes[i]);
    hash = (hash * FNV_PRIME) & FNV_MASK;
  }
  return hash;
}

/**
 * The stable per-point identity: FNV-1a 64 over the contract, the preparation
 * reference and the big-endian allocation indices — the native law's exact
 * byte layout (`form_samples.rs::sample_id`). Never derived from call order,
 * coverage values or any preparation content that can change compatibly.
 */
export function sampleIdOf(prepRef: string, layerIndex: number, uIndex: number, vIndex: number): bigint {
  const prefix = new TextEncoder().encode(FORM_SAMPLES_CONTRACT + '\0' + prepRef + '\0');
  const bytes = new Uint8Array(prefix.length + 6);
  bytes.set(prefix, 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(prefix.length, layerIndex, false);
  view.setUint16(prefix.length + 2, uIndex, false);
  view.setUint16(prefix.length + 4, vIndex, false);
  return fnv1a64(bytes);
}

// ---------------------------------------------------------------------------
// SHA-256 — synchronous, dependency-free, for the app-canonical cache key.
// ---------------------------------------------------------------------------

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of `bytes`, as lowercase hex. Self-checked against known vectors in the sampler test. */
export function sha256Hex(bytes: Uint8Array): string {
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(block + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << 25)) ^ ((w[t - 15] >>> 18) | (w[t - 15] << 14)) ^ (w[t - 15] >>> 3);
      const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << 15)) ^ ((w[t - 2] >>> 19) | (w[t - 2] << 13)) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K256[t] + w[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join('');
}

// ---------------------------------------------------------------------------
// The declared preparation and the retained body (ql.psg-form-samples/v1).
// ---------------------------------------------------------------------------

export type MaterialTreatment = 'glyph-mask' | 'sheet-carrier';

export interface SampleUnits {
  /** The square domain's side, in stage units. */
  extentUnits: number;
  /** The body's full depth (the w span 0..1), in stage units. */
  depthUnits: number;
  /** Declared metres per stage unit — the scene geometry's own convention. */
  metresPerUnit: number;
}

export interface SampleLayer {
  layerRef: string;
  restDepthW: number;
}

/** The declared glyph-mask determination: the application rasteriser's own
 * output, cited (mask_ref + one coverage per allocation point, in allocation
 * order). Carried, never performed, here. */
export interface MaskDeclaration {
  maskRef: string;
  coverages: number[];
}

/** A declared sample preparation: the retained body's complete dependency set. */
export interface SamplePreparation {
  schema: string;
  /** The caller's stable preparation identity; sample IDs derive from it. */
  prepRef: string;
  treatment: MaterialTreatment;
  layers: SampleLayer[];
  /** The square grid's side: resolution × resolution points per layer. */
  resolution: number;
  units: SampleUnits;
  mask?: MaskDeclaration;
}

export interface RestSample {
  readonly sampleId: bigint;
  readonly layerIndex: number;
  readonly uIndex: number;
  readonly vIndex: number;
  /** Density/coverage 0..1: 1.0 across a sheet carrier, the declared glyph-mask
   * value where the rasteriser found occupancy. */
  readonly coverage: number;
}

export interface SampleBody {
  readonly preparation: SamplePreparation;
  /** The dependency-correct cache key: the digest over exactly the declared
   * preparation. Preparation changes move it; progress and camera never do. */
  readonly preparationSha256: string;
  /** The samples in the deterministic allocation order: layer, then row v,
   * then column u. */
  readonly samples: readonly RestSample[];
}

function boundedRef(name: string, value: string): void {
  if (
    value.length === 0 ||
    value.length > 2048 ||
    [...value].some((c) => {
      const code = c.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    throw new FormLawError(`invalid ${name} reference`);
  }
}

function finitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_UNITS) {
    throw new FormLawError(`declared unit ${name} must be finite, positive and within ${MAX_UNITS}`);
  }
}

export function allocationCount(preparation: SamplePreparation): number {
  return preparation.layers.length * preparation.resolution * preparation.resolution;
}

/** Validates the declared preparation; refusals are by name, as the native law refuses. */
export function validatePreparation(preparation: SamplePreparation): void {
  if (preparation.schema !== FORM_SAMPLES_CONTRACT) {
    throw new FormLawError(
      `unsupported sample preparation contract ${preparation.schema}; expected ${FORM_SAMPLES_CONTRACT}`,
    );
  }
  boundedRef('preparation', preparation.prepRef);
  if (preparation.layers.length === 0 || preparation.layers.length > MAX_LAYERS) {
    throw new FormLawError(`a sample preparation carries 1..=${MAX_LAYERS} layers`);
  }
  const seen = new Set<string>();
  for (const layer of preparation.layers) {
    boundedRef('layer', layer.layerRef);
    if (!Number.isFinite(layer.restDepthW) || layer.restDepthW < 0 || layer.restDepthW > 1) {
      throw new FormLawError(
        `layer ${layer.layerRef} rest depth must be finite within the normalised domain 0..1`,
      );
    }
    if (seen.has(layer.layerRef)) {
      throw new FormLawError(`two layers carry the layer_ref ${JSON.stringify(layer.layerRef)}; layer identity must be unique`);
    }
    seen.add(layer.layerRef);
  }
  if (!Number.isInteger(preparation.resolution) || preparation.resolution <= 0 || preparation.resolution > MAX_RESOLUTION) {
    throw new FormLawError(`sample resolution must be within 1..=${MAX_RESOLUTION} per side`);
  }
  finitePositive('extent_units', preparation.units.extentUnits);
  finitePositive('depth_units', preparation.units.depthUnits);
  finitePositive('metres_per_unit', preparation.units.metresPerUnit);
  if (preparation.treatment === 'glyph-mask') {
    const mask = preparation.mask;
    if (!mask) {
      throw new FormLawError(
        'glyph-mask occupancy is a declared determination: the preparation must carry the mask (mask_ref and one coverage per sample) the application rasteriser produced — the mask is cited here, never invented',
      );
    }
    boundedRef('mask', mask.maskRef);
    const count = allocationCount(preparation);
    if (mask.coverages.length !== count) {
      throw new FormLawError(
        `the declared glyph mask carries ${mask.coverages.length} coverages for ${count} allocation points; one coverage per retained sample, in allocation order`,
      );
    }
    if (mask.coverages.some((c) => !Number.isFinite(c) || c < 0 || c > 1)) {
      throw new FormLawError('glyph-mask coverage must be finite within 0..1');
    }
  } else if (preparation.mask) {
    throw new FormLawError(
      'a sheet carrier covers every allocation point by law; a declared mask belongs to glyph-mask occupancy',
    );
  }
}

/**
 * The app-canonical serialisation of the declared preparation: the complete
 * dependency set, in declared field order, mask omitted when absent, numbers in
 * ECMAScript's deterministic shortest form. This digest is the app's cache key —
 * the same dependency set the native digest covers, serialised this side's way.
 */
export function canonicalPreparationJson(preparation: SamplePreparation): string {
  const parts: string[] = [];
  const str = (s: string) => JSON.stringify(s);
  const num = (n: number) => (Object.is(n, -0) ? '0' : String(n));
  parts.push(`"schema":${str(preparation.schema)}`);
  parts.push(`"prep_ref":${str(preparation.prepRef)}`);
  parts.push(`"treatment":${str(preparation.treatment)}`);
  parts.push(`"layers":[${preparation.layers
    .map((l) => `{"layer_ref":${str(l.layerRef)},"rest_depth_w":${num(l.restDepthW)}}`)
    .join(',')}]`);
  parts.push(`"resolution":${num(preparation.resolution)}`);
  parts.push(`"units":{"extent_units":${num(preparation.units.extentUnits)},"depth_units":${num(preparation.units.depthUnits)},"metres_per_unit":${num(preparation.units.metresPerUnit)}}`);
  if (preparation.mask) {
    parts.push(`"mask":{"mask_ref":${str(preparation.mask.maskRef)},"coverages":[${preparation.mask.coverages.map(num).join(',')}]}`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * Prepares the retained body over the declared preparation: validation
 * refusals are by name; the allocation, its identities and its order are
 * deterministic in the preparation alone.
 */
export function prepareSamples(preparation: SamplePreparation): SampleBody {
  validatePreparation(preparation);
  const n = preparation.resolution;
  const layerCount = preparation.layers.length;
  const samples: RestSample[] = new Array(layerCount * n * n);
  let index = 0;
  for (let layer = 0; layer < layerCount; layer++) {
    for (let v = 0; v < n; v++) {
      for (let u = 0; u < n; u++) {
        const coverage =
          preparation.treatment === 'sheet-carrier'
            ? 1
            : (preparation.mask as MaskDeclaration).coverages[index];
        samples[index] = {
          sampleId: sampleIdOf(preparation.prepRef, layer, u, v),
          layerIndex: layer,
          uIndex: u,
          vIndex: v,
          coverage,
        };
        index++;
      }
    }
  }
  const preparationSha256 = sha256Hex(new TextEncoder().encode(canonicalPreparationJson(preparation)));
  return { preparation, preparationSha256, samples };
}

/** The sample's normalised square-domain rest coordinate, at the point's centre. */
export function restUv(body: SampleBody, sample: RestSample): [number, number] {
  const n = body.preparation.resolution;
  return [(sample.uIndex + 0.5) / n, (sample.vIndex + 0.5) / n];
}

/** The sample's normalised rest depth — its layer's declared depth. */
export function restW(body: SampleBody, sample: RestSample): number {
  return body.preparation.layers[sample.layerIndex].restDepthW;
}

/** The sample's rest position in stage units: the declared conversion, centred. */
export function restUnits(body: SampleBody, sample: RestSample): [number, number, number] {
  const [u, v] = restUv(body, sample);
  const w = restW(body, sample);
  const units = body.preparation.units;
  return [(u - 0.5) * units.extentUnits, (v - 0.5) * units.extentUnits, (w - 0.5) * units.depthUnits];
}

/**
 * The explicit old-to-new mapping of a genuine topology change: each successor
 * sample carries its nearest predecessor's ID within the same layer, ties
 * resolved by the predecessor's allocation order; `null` where the point is
 * new. A different preparation reference is a new correspondence, not a remap.
 */
export interface SampleMapping {
  fromPrepRef: string;
  toPrepRef: string;
  /** Per successor sample, in the successor's allocation order. */
  pairs: (bigint | null)[];
}

export function remapSamples(previous: SampleBody, successor: SampleBody): SampleMapping {
  if (previous.preparation.prepRef !== successor.preparation.prepRef) {
    throw new FormLawError(
      `the explicit remap is a body's own continuation (${previous.preparation.prepRef}); a different preparation reference (${successor.preparation.prepRef}) is a new correspondence, not a remap`,
    );
  }
  if (successor.preparationSha256 === previous.preparationSha256) {
    return {
      fromPrepRef: previous.preparation.prepRef,
      toPrepRef: successor.preparation.prepRef,
      pairs: successor.samples.map((s) => s.sampleId),
    };
  }
  const pairs: (bigint | null)[] = new Array(successor.samples.length);
  const successorsUv = successor.samples.map((s) => restUv(successor, s));
  for (let i = 0; i < successor.samples.length; i++) {
    const sample = successor.samples[i];
    const [u, v] = successorsUv[i];
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestId: bigint | null = null;
    for (const candidate of previous.samples) {
      if (candidate.layerIndex !== sample.layerIndex) continue;
      const [cu, cv] = restUv(previous, candidate);
      const distance = (cu - u) * (cu - u) + (cv - v) * (cv - v);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = candidate.sampleId;
      }
    }
    pairs[i] = bestId;
  }
  return { fromPrepRef: previous.preparation.prepRef, toPrepRef: successor.preparation.prepRef, pairs };
}

// ---------------------------------------------------------------------------
// The fold-progress receipt (ql.psg-fold-progress/v1) and the deformation it
// commands. The receipt crosses the boundary in the native wire shape;
// the deformer consumes it read-only.
// ---------------------------------------------------------------------------

/** The fold-progress receipt's wire shape (snake_case, as the native law serialises it). */
export interface FoldProgressReceipt {
  schema: string;
  sequence_ref?: string;
  revision?: number;
  cursor_steps: number;
  origin_steps?: number;
  segment_index?: number;
  phase?: 'hold' | 'transition';
  offset_steps?: number;
  length_steps?: number;
  eased_steps_num?: number;
  eased_steps_den?: number;
  /** The commanded crease path: tenths of a degree per site, body order X, Y, Z. */
  site_angles_deg10: [number, number, number];
  site_velocities_deg10?: [number, number, number] | null;
  /** The codon's form, present at the quanta only — never fabricated mid-transition. */
  resolved_form?: { address: number } | null;
  standing?: string;
}

/** Refuses anything that is not the fold-progress law's own receipt, by name. */
export function assertFoldProgress(progress: FoldProgressReceipt): void {
  if (!progress || progress.schema !== FOLD_PROGRESS_CONTRACT) {
    throw new FormLawError(
      `unsupported fold progress contract ${progress?.schema}; expected ${FOLD_PROGRESS_CONTRACT}`,
    );
  }
  if (!Number.isSafeInteger(progress.cursor_steps) || progress.cursor_steps < 0) {
    throw new FormLawError('fold progress cursor_steps must be a safe unsigned integer');
  }
  for (let site = 0; site < 3; site++) {
    const angle = progress.site_angles_deg10?.[site];
    if (!Number.isFinite(angle) || !Number.isInteger(angle)) {
      throw new FormLawError(`fold progress site_angles_deg10[${site}] must be a finite integer (tenths of a degree)`);
    }
  }
  const form = progress.resolved_form;
  if (form != null && (!Number.isInteger(form.address) || form.address < 0 || form.address >= 64)) {
    throw new FormLawError('fold progress resolved_form.address must sit in the six-bit field 0..64');
  }
}

const DEG10_TO_RAD = Math.PI / 1800;

/**
 * Applies the commanded crease path to the retained body: the three M3 sites
 * as the three orthogonal hinges through the body centre, applied in site
 * order — site 0 (X) folds (y,z), site 1 (Y) folds (z,x), site 2 (Z) turns
 * (x,y). Pure: the body and its counters stand untouched; a progress read
 * deforms nothing resident.
 *
 * Returns one xyz position per sample, in allocation order, in stage units.
 */
export function applyFold(body: SampleBody, progress: FoldProgressReceipt): Float64Array {
  assertFoldProgress(progress);
  const [ax, ay, az] = progress.site_angles_deg10;
  const cx = ax * DEG10_TO_RAD, cy = ay * DEG10_TO_RAD, cz = az * DEG10_TO_RAD;
  const cosX = Math.cos(cx), sinX = Math.sin(cx);
  const cosY = Math.cos(cy), sinY = Math.sin(cy);
  const cosZ = Math.cos(cz), sinZ = Math.sin(cz);
  const out = new Float64Array(body.samples.length * 3);
  for (let i = 0; i < body.samples.length; i++) {
    let [x, y, z] = restUnits(body, body.samples[i]);
    // Site 0 (X): the (y,z) hinge.
    let y2 = y * cosX - z * sinX;
    let z2 = y * sinX + z * cosX;
    // Site 1 (Y): the (z,x) hinge.
    let z3 = z2 * cosY - x * sinY;
    let x3 = z2 * sinY + x * cosY;
    // Site 2 (Z): the in-plane turn.
    let x4 = x3 * cosZ - y2 * sinZ;
    let y4 = x3 * sinZ + y2 * cosZ;
    out[i * 3] = x4;
    out[i * 3 + 1] = y4;
    out[i * 3 + 2] = z3;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The instrument (ql.psg-form-instrument/v1): counters and receipts per
// dependency-correct cache key, in the native disclosure's shapes.
// ---------------------------------------------------------------------------

export type PreparationReceipt = 'rasterised' | 'cache-hit';

export interface PreparationCounters {
  rasterisations: number;
  cacheHits: number;
  reseeds: number;
  progressReads: number;
}

export type InstrumentEvent =
  | { event: 'rasterised'; preparation_sha256: string; mask_ref: string | null; samples: number }
  | { event: 'cache-hit'; preparation_sha256: string }
  | { event: 'reseeded'; preparation_sha256: string; predecessor_sha256: string; continued_samples: number; fresh_samples: number }
  | { event: 'progress-read'; preparation_sha256: string; cursor_steps: number };

/** The takeover record's retained history: the last events, oldest first. */
export const RETAINED_EVENTS = 64;

export interface ResidentGeometry {
  schema: string;
  preparation_sha256: string;
  sample_count: number;
  /** SHA-256 over every resident row — sample ID, layer, indices, coverage,
   * rest position — in allocation order. Moves only when a resident point moves. */
  resident_sha256: string;
  occupied_samples: number;
  coverage_sum: number;
  rest_bounds_units: [[number, number, number], [number, number, number]];
  standing: string;
}

export interface ResidentObservation {
  schema: string;
  preparation_sha256: string;
  cursor_steps: number;
  commanded_site_angles_deg10: [number, number, number];
  commanded_form_address: number | null;
  observed: ResidentGeometry;
}

export interface ReseedReceipt {
  schema: string;
  predecessor_sha256: string;
  preparation_sha256: string;
  continued_samples: number;
  fresh_samples: number;
}

/** The big-endian IEEE-754 bytes of one number, as the identity digest reads them. */
function f64BeBytes(value: number): Uint8Array {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return new Uint8Array(view.buffer);
}

/**
 * Reads the resident geometry from a retained body: identity, occupancy and
 * rest extent over the allocation order. Pure — observing changes nothing.
 */
export function observeBody(body: SampleBody): ResidentGeometry {
  const digest: number[] = [];
  let occupied = 0;
  let coverageSum = 0;
  let min: [number, number, number] | null = null;
  let max: [number, number, number] | null = null;
  for (const sample of body.samples) {
    const rest = restUnits(body, sample);
    digest.push(
      Number(sample.sampleId >> 56n) & 0xff, Number((sample.sampleId >> 48n) & 0xffn),
      Number((sample.sampleId >> 40n) & 0xffn), Number((sample.sampleId >> 32n) & 0xffn),
      Number((sample.sampleId >> 24n) & 0xffn), Number((sample.sampleId >> 16n) & 0xffn),
      Number((sample.sampleId >> 8n) & 0xffn), Number(sample.sampleId & 0xffn),
    );
    digest.push((sample.layerIndex >> 8) & 0xff, sample.layerIndex & 0xff);
    digest.push((sample.uIndex >> 8) & 0xff, sample.uIndex & 0xff);
    digest.push((sample.vIndex >> 8) & 0xff, sample.vIndex & 0xff);
    for (const b of f64BeBytes(sample.coverage)) digest.push(b);
    for (const axis of rest) for (const b of f64BeBytes(axis)) digest.push(b);
    if (sample.coverage > 0) occupied++;
    coverageSum += sample.coverage;
    min = min ? ([Math.min(min[0], rest[0]), Math.min(min[1], rest[1]), Math.min(min[2], rest[2])] as [number, number, number]) : rest;
    max = max ? ([Math.max(max[0], rest[0]), Math.max(max[1], rest[1]), Math.max(max[2], rest[2])] as [number, number, number]) : rest;
  }
  return {
    schema: RESIDENT_GEOMETRY_CONTRACT,
    preparation_sha256: body.preparationSha256,
    sample_count: body.samples.length,
    resident_sha256: sha256Hex(new Uint8Array(digest)),
    occupied_samples: occupied,
    coverage_sum: coverageSum,
    rest_bounds_units: [min ?? [0, 0, 0], max ?? [0, 0, 0]],
    standing:
      'observed resident geometry: read from the retained body, not from the commanded state; the identity digest moves only when a resident point moves',
  };
}

/** The instrument over the retained-body lifecycle, mirroring the native
 * FormInstrument's counters, refusals and disclosure shapes. */
export class FormInstrument {
  private counters = new Map<string, PreparationCounters>();
  /** The cache keys whose preparation this instrument issued — the cache-hit
   * decision's own basis. */
  private issued = new Set<string>();
  /** The retained receipts, oldest first. Held under a private name so the
   * public `events()` reader is never shadowed by the field. */
  private retained: InstrumentEvent[] = [];

  private countersOf(key: string): PreparationCounters {
    let entry = this.counters.get(key);
    if (!entry) {
      entry = { rasterisations: 0, cacheHits: 0, reseeds: 0, progressReads: 0 };
      this.counters.set(key, entry);
    }
    return entry;
  }

  private retain(event: InstrumentEvent): void {
    this.retained.push(event);
    const excess = this.retained.length - RETAINED_EVENTS;
    if (excess > 0) this.retained.splice(0, excess);
  }

  /** Prepares the body through the instrument: the first request under a cache
   * key records the rasterisation receipt; a repeat records a cache hit — the
   * rasteriser did not run. */
  prepare(preparation: SamplePreparation): { body: SampleBody; receipt: PreparationReceipt } {
    const body = prepareSamples(preparation);
    const key = body.preparationSha256;
    if (this.issued.has(key)) {
      this.countersOf(key).cacheHits++;
      this.retain({ event: 'cache-hit', preparation_sha256: key });
      return { body, receipt: 'cache-hit' };
    }
    this.issued.add(key);
    this.countersOf(key).rasterisations++;
    this.retain({
      event: 'rasterised',
      preparation_sha256: key,
      mask_ref: body.preparation.mask?.maskRef ?? null,
      samples: body.samples.length,
    });
    return { body, receipt: 'rasterised' };
  }

  /** Records one fold-progress read against the resident body. No path from
   * here moves rasterisations or reseeds: a progress update is not a
   * preparation dependency. Refuses a foreign receipt by name and counts
   * nothing for it. */
  progressUpdate(body: SampleBody, progress: FoldProgressReceipt): ResidentObservation {
    assertFoldProgress(progress);
    const observed = observeBody(body);
    this.countersOf(body.preparationSha256).progressReads++;
    this.retain({ event: 'progress-read', preparation_sha256: body.preparationSha256, cursor_steps: progress.cursor_steps });
    return {
      schema: RESIDENT_OBSERVATION_CONTRACT,
      preparation_sha256: body.preparationSha256,
      cursor_steps: progress.cursor_steps,
      commanded_site_angles_deg10: progress.site_angles_deg10,
      commanded_form_address: progress.resolved_form?.address ?? null,
      observed,
    };
  }

  /** Admits a reseed through a genuine topology change only, through the
   * samples owner's explicit mapping. Refusals are by name: the same cache
   * key never reseeds itself; residents continuing by identity (the coating
   * moved, the topology did not) are refused a reseed. */
  reseed(previous: SampleBody, successor: SampleBody): ReseedReceipt {
    if (successor.preparationSha256 === previous.preparationSha256) {
      throw new FormLawError('the successor body is the same cache key; a reseed without a preparation change is a law violation');
    }
    const mapping = remapSamples(previous, successor);
    const identity = successor.samples.every((sample, i) => mapping.pairs[i] === sample.sampleId);
    if (identity) {
      throw new FormLawError(
        `the residents continue by identity across cache key ${successor.preparationSha256} (topology unchanged; the explicit mapping is the identity); a reseed without a genuine topology change is refused — the coating moved, the body did not`,
      );
    }
    const continued = mapping.pairs.filter((p) => p !== null).length;
    const fresh = mapping.pairs.length - continued;
    this.countersOf(successor.preparationSha256).reseeds++;
    this.retain({
      event: 'reseeded',
      preparation_sha256: successor.preparationSha256,
      predecessor_sha256: previous.preparationSha256,
      continued_samples: continued,
      fresh_samples: fresh,
    });
    return {
      schema: FORM_INSTRUMENT_CONTRACT,
      predecessor_sha256: previous.preparationSha256,
      preparation_sha256: successor.preparationSha256,
      continued_samples: continued,
      fresh_samples: fresh,
    };
  }

  counterOf(preparationSha256: string): PreparationCounters | null {
    return this.counters.get(preparationSha256) ?? null;
  }

  events(): readonly InstrumentEvent[] {
    return this.retained;
  }

  /** The whole instrument's proof line across every cache key. */
  totals(): PreparationCounters {
    const totals: PreparationCounters = { rasterisations: 0, cacheHits: 0, reseeds: 0, progressReads: 0 };
    for (const c of this.counters.values()) {
      totals.rasterisations += c.rasterisations;
      totals.cacheHits += c.cacheHits;
      totals.reseeds += c.reseeds;
      totals.progressReads += c.progressReads;
    }
    return totals;
  }

  /** The instrument's full disclosure in the native state shape: counters per
   * cache key and the retained receipts, oldest first. Deterministic in the
   * events alone. */
  state(): Record<string, unknown> {
    return {
      schema: FORM_INSTRUMENT_CONTRACT,
      counters: [...this.counters.entries()].map(([key, c]) => ({
        preparation_sha256: key,
        rasterisations: c.rasterisations,
        cache_hits: c.cacheHits,
        reseeds: c.reseeds,
        progress_reads: c.progressReads,
      })),
      events: this.retained,
      standing:
        'rasterisation/reseed instrumentation over dependency-correct cache keys; the counters are the proof surface, the events the receipts',
    };
  }
}

// ---------------------------------------------------------------------------
// The app-facing sampler owner: one glyph path end to end.
// ---------------------------------------------------------------------------

export interface DeclareOutcome {
  body: SampleBody;
  /** The instrument receipt for this declaration. */
  preparation: PreparationReceipt;
  /** When a body already stood under a different key: the reseed receipt if a
   * genuine topology change was admitted; the refusal text if the residents
   * continue by identity (coating change) or the reference is a new
   * correspondence; null when no body stood or the key did not move. */
  reseed: ReseedReceipt | string | null;
}

/** The app's PS-G sampler: declares, retains, deforms and discloses one glyph
 * body through the instrument — the first-vertical glyph path. */
export class PsgFormSampler {
  readonly instrument = new FormInstrument();
  private standing: SampleBody | null = null;

  declare(preparation: SamplePreparation): DeclareOutcome {
    const { body, receipt } = this.instrument.prepare(preparation);
    let reseed: ReseedReceipt | string | null = null;
    const previous = this.standing;
    if (previous && previous.preparationSha256 !== body.preparationSha256) {
      try {
        reseed = this.instrument.reseed(previous, body);
      } catch (error) {
        if (!(error instanceof FormLawError)) throw error;
        reseed = error.message;
      }
    }
    this.standing = body;
    return { body, preparation: receipt, reseed };
  }

  get body(): SampleBody | null {
    return this.standing;
  }

  /** Applies the commanded crease path: the deformed positions per sample plus
   * the observation receipt. The read is counted; the body stands untouched. */
  applyFold(progress: FoldProgressReceipt): { deformed: Float64Array; observation: ResidentObservation } {
    if (!this.standing) throw new FormLawError('no retained sample body; declare a preparation first');
    const observation = this.instrument.progressUpdate(this.standing, progress);
    return { deformed: applyFold(this.standing, progress), observation };
  }

  /** The observed resident geometry — read from the retained body, never from
   * the commanded state. Pure. */
  observe(): ResidentGeometry | null {
    return this.standing ? observeBody(this.standing) : null;
  }

  /** Bounded disclosure for diagnostics: the instrument state (counters per
   * key, retained receipts) plus the standing body's identity line. */
  disclose(): Record<string, unknown> {
    return {
      instrument: this.instrument.state(),
      body: this.standing
        ? {
            prep_ref: this.standing.preparation.prepRef,
            preparation_sha256: this.standing.preparationSha256,
            sample_count: this.standing.samples.length,
          }
        : null,
    };
  }
}

// ---------------------------------------------------------------------------
// The rasteriser seam: the app canvas rasteriser's own output, cited into the
// declared mask.
// ---------------------------------------------------------------------------

/**
 * Reads one coverage per allocation point from a rasterised alpha raster (the
 * application rasteriser's own output, RGBA or alpha-only), sampling at each
 * point's centre. Rows are v-major, matching the allocation order. The returned
 * coverages belong in `MaskDeclaration.coverages` — declared, never invented.
 */
export function coveragesFromAlpha(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  resolution: number,
  stride = 1,
): number[] {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new FormLawError('the cited raster must carry positive integer dimensions');
  }
  if (!Number.isInteger(resolution) || resolution <= 0 || resolution > MAX_RESOLUTION) {
    throw new FormLawError(`sample resolution must be within 1..=${MAX_RESOLUTION} per side`);
  }
  const coverages: number[] = new Array(resolution * resolution);
  // The raster's alpha is its last byte per pixel: +3 in an RGBA raster, +0
  // in an alpha-only one.
  const alphaOffset = stride - 1;
  for (let v = 0; v < resolution; v++) {
    const py = Math.min(height - 1, Math.floor(((v + 0.5) / resolution) * height));
    for (let u = 0; u < resolution; u++) {
      const px = Math.min(width - 1, Math.floor(((u + 0.5) / resolution) * width));
      const value = alpha[(py * width + px) * stride + alphaOffset];
      coverages[v * resolution + u] = Math.max(0, Math.min(1, (Number.isFinite(value) ? value : 0) / 255));
    }
  }
  return coverages;
}

/** The declared units of the text-glyph path: a glyph fills ~extent side units
 * of stage space, with the declared body depth; metres-per-unit is the scene's
 * own convention. */
export interface GlyphDeclaration {
  /** The caller's stable preparation identity (e.g. the glyph text's identity). */
  prepRef: string;
  /** The application rasteriser's own identity for this mask. */
  maskRef: string;
  coverages: number[];
  resolution: number;
  /** Optional second face; the first vertical is one layer. */
  layers?: SampleLayer[];
  units?: Partial<SampleUnits>;
}

/** Builds the declared preparation for the text-glyph path (glyph-mask
 * occupancy, one front layer by default, declared units). */
export function glyphPreparation(declaration: GlyphDeclaration): SamplePreparation {
  return {
    schema: FORM_SAMPLES_CONTRACT,
    prepRef: declaration.prepRef,
    treatment: 'glyph-mask',
    layers: declaration.layers ?? [{ layerRef: 'glyph:front', restDepthW: 0.5 }],
    resolution: declaration.resolution,
    units: {
      extentUnits: declaration.units?.extentUnits ?? 400,
      depthUnits: declaration.units?.depthUnits ?? 20,
      metresPerUnit: declaration.units?.metresPerUnit ?? 0.001,
    },
    mask: { maskRef: declaration.maskRef, coverages: declaration.coverages },
  };
}
