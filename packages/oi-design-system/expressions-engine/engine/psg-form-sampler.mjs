/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
const FORM_SAMPLES_CONTRACT = "ql.psg-form-samples/v1";
const FOLD_SEQUENCE_CONTRACT = "ql.psg-form-sequence/v1";
const FOLD_PROGRESS_CONTRACT = "ql.psg-fold-progress/v1";
const FOLD_STAGE_EFFECT_CONTRACT = "ql.psg-fold-stage-effect/v1";
const FORM_INSTRUMENT_CONTRACT = "ql.psg-form-instrument/v1";
const RESIDENT_GEOMETRY_CONTRACT = "ql.psg-resident-geometry/v1";
const RESIDENT_OBSERVATION_CONTRACT = "ql.psg-resident-observation/v1";
const MAX_RESOLUTION = 64;
const MAX_LAYERS = 16;
const MAX_UNITS = 1e6;
class FormLawError extends Error {
  constructor(message) {
    super(message);
    this.name = "FormLawError";
  }
}
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const FNV_MASK = 0xffffffffffffffffn;
function fnv1a64(bytes) {
  let hash = FNV_OFFSET;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= BigInt(bytes[i]);
    hash = hash * FNV_PRIME & FNV_MASK;
  }
  return hash;
}
function sampleIdOf(prepRef, layerIndex, uIndex, vIndex) {
  const prefix = new TextEncoder().encode(FORM_SAMPLES_CONTRACT + "\0" + prepRef + "\0");
  const bytes = new Uint8Array(prefix.length + 6);
  bytes.set(prefix, 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(prefix.length, layerIndex, false);
  view.setUint16(prefix.length + 2, uIndex, false);
  view.setUint16(prefix.length + 4, vIndex, false);
  return fnv1a64(bytes);
}
const K256 = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
function sha256Hex(bytes) {
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array((bytes.length + 8 >> 6) + 1 << 6);
  padded.set(bytes);
  padded[bytes.length] = 128;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 4294967296), false);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);
  let h0 = 1779033703, h1 = 3144134277, h2 = 1013904242, h3 = 2773480762;
  let h4 = 1359893119, h5 = 2600822924, h6 = 528734635, h7 = 1541459225;
  const w = new Uint32Array(64);
  for (let block = 0; block < padded.length; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(block + t * 4, false);
    for (let t = 16; t < 64; t++) {
      const s0 = (w[t - 15] >>> 7 | w[t - 15] << 25) ^ (w[t - 15] >>> 18 | w[t - 15] << 14) ^ w[t - 15] >>> 3;
      const s1 = (w[t - 2] >>> 17 | w[t - 2] << 15) ^ (w[t - 2] >>> 19 | w[t - 2] << 13) ^ w[t - 2] >>> 10;
      w[t] = w[t - 16] + s0 + w[t - 7] + s1 >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = e & f ^ ~e & g;
      const temp1 = h + S1 + ch + K256[t] + w[t] >>> 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = a & b ^ a & c ^ b & c;
      const temp2 = S0 + maj >>> 0;
      h = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    h0 = h0 + a >>> 0;
    h1 = h1 + b >>> 0;
    h2 = h2 + c >>> 0;
    h3 = h3 + d >>> 0;
    h4 = h4 + e >>> 0;
    h5 = h5 + f >>> 0;
    h6 = h6 + g >>> 0;
    h7 = h7 + h >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
}
function boundedRef(name, value) {
  if (value.length === 0 || value.length > 2048 || [...value].some((c) => {
    const code = c.charCodeAt(0);
    return code < 32 || code === 127;
  })) {
    throw new FormLawError(`invalid ${name} reference`);
  }
}
function finitePositive(name, value) {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_UNITS) {
    throw new FormLawError(`declared unit ${name} must be finite, positive and within ${MAX_UNITS}`);
  }
}
function allocationCount(preparation) {
  return preparation.layers.length * preparation.resolution * preparation.resolution;
}
function validatePreparation(preparation) {
  if (preparation.schema !== FORM_SAMPLES_CONTRACT) {
    throw new FormLawError(
      `unsupported sample preparation contract ${preparation.schema}; expected ${FORM_SAMPLES_CONTRACT}`
    );
  }
  boundedRef("preparation", preparation.prepRef);
  if (preparation.layers.length === 0 || preparation.layers.length > MAX_LAYERS) {
    throw new FormLawError(`a sample preparation carries 1..=${MAX_LAYERS} layers`);
  }
  const seen = /* @__PURE__ */ new Set();
  for (const layer of preparation.layers) {
    boundedRef("layer", layer.layerRef);
    if (!Number.isFinite(layer.restDepthW) || layer.restDepthW < 0 || layer.restDepthW > 1) {
      throw new FormLawError(
        `layer ${layer.layerRef} rest depth must be finite within the normalised domain 0..1`
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
  finitePositive("extent_units", preparation.units.extentUnits);
  finitePositive("depth_units", preparation.units.depthUnits);
  finitePositive("metres_per_unit", preparation.units.metresPerUnit);
  if (preparation.treatment === "glyph-mask") {
    const mask = preparation.mask;
    if (!mask) {
      throw new FormLawError(
        "glyph-mask occupancy is a declared determination: the preparation must carry the mask (mask_ref and one coverage per sample) the application rasteriser produced \u2014 the mask is cited here, never invented"
      );
    }
    boundedRef("mask", mask.maskRef);
    const count = allocationCount(preparation);
    if (mask.coverages.length !== count) {
      throw new FormLawError(
        `the declared glyph mask carries ${mask.coverages.length} coverages for ${count} allocation points; one coverage per retained sample, in allocation order`
      );
    }
    if (mask.coverages.some((c) => !Number.isFinite(c) || c < 0 || c > 1)) {
      throw new FormLawError("glyph-mask coverage must be finite within 0..1");
    }
  } else if (preparation.mask) {
    throw new FormLawError(
      "a sheet carrier covers every allocation point by law; a declared mask belongs to glyph-mask occupancy"
    );
  }
}
function canonicalPreparationJson(preparation) {
  const parts = [];
  const str = (s) => JSON.stringify(s);
  const num = (n) => Object.is(n, -0) ? "0" : String(n);
  parts.push(`"schema":${str(preparation.schema)}`);
  parts.push(`"prep_ref":${str(preparation.prepRef)}`);
  parts.push(`"treatment":${str(preparation.treatment)}`);
  parts.push(`"layers":[${preparation.layers.map((l) => `{"layer_ref":${str(l.layerRef)},"rest_depth_w":${num(l.restDepthW)}}`).join(",")}]`);
  parts.push(`"resolution":${num(preparation.resolution)}`);
  parts.push(`"units":{"extent_units":${num(preparation.units.extentUnits)},"depth_units":${num(preparation.units.depthUnits)},"metres_per_unit":${num(preparation.units.metresPerUnit)}}`);
  if (preparation.mask) {
    parts.push(`"mask":{"mask_ref":${str(preparation.mask.maskRef)},"coverages":[${preparation.mask.coverages.map(num).join(",")}]}`);
  }
  return `{${parts.join(",")}}`;
}
function prepareSamples(preparation) {
  validatePreparation(preparation);
  const n = preparation.resolution;
  const layerCount = preparation.layers.length;
  const samples = new Array(layerCount * n * n);
  let index = 0;
  for (let layer = 0; layer < layerCount; layer++) {
    for (let v = 0; v < n; v++) {
      for (let u = 0; u < n; u++) {
        const coverage = preparation.treatment === "sheet-carrier" ? 1 : preparation.mask.coverages[index];
        samples[index] = {
          sampleId: sampleIdOf(preparation.prepRef, layer, u, v),
          layerIndex: layer,
          uIndex: u,
          vIndex: v,
          coverage
        };
        index++;
      }
    }
  }
  const preparationSha256 = sha256Hex(new TextEncoder().encode(canonicalPreparationJson(preparation)));
  return { preparation, preparationSha256, samples };
}
function restUv(body, sample) {
  const n = body.preparation.resolution;
  return [(sample.uIndex + 0.5) / n, (sample.vIndex + 0.5) / n];
}
function restW(body, sample) {
  return body.preparation.layers[sample.layerIndex].restDepthW;
}
function restUnits(body, sample) {
  const [u, v] = restUv(body, sample);
  const w = restW(body, sample);
  const units = body.preparation.units;
  return [(u - 0.5) * units.extentUnits, (v - 0.5) * units.extentUnits, (w - 0.5) * units.depthUnits];
}
function remapSamples(previous, successor) {
  if (previous.preparation.prepRef !== successor.preparation.prepRef) {
    throw new FormLawError(
      `the explicit remap is a body's own continuation (${previous.preparation.prepRef}); a different preparation reference (${successor.preparation.prepRef}) is a new correspondence, not a remap`
    );
  }
  if (successor.preparationSha256 === previous.preparationSha256) {
    return {
      fromPrepRef: previous.preparation.prepRef,
      toPrepRef: successor.preparation.prepRef,
      pairs: successor.samples.map((s) => s.sampleId)
    };
  }
  const pairs = new Array(successor.samples.length);
  const successorsUv = successor.samples.map((s) => restUv(successor, s));
  for (let i = 0; i < successor.samples.length; i++) {
    const sample = successor.samples[i];
    const [u, v] = successorsUv[i];
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestId = null;
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
function assertFoldProgress(progress) {
  if (!progress || progress.schema !== FOLD_PROGRESS_CONTRACT) {
    throw new FormLawError(
      `unsupported fold progress contract ${progress?.schema}; expected ${FOLD_PROGRESS_CONTRACT}`
    );
  }
  if (!Number.isSafeInteger(progress.cursor_steps) || progress.cursor_steps < 0) {
    throw new FormLawError("fold progress cursor_steps must be a safe unsigned integer");
  }
  for (let site = 0; site < 3; site++) {
    const angle = progress.site_angles_deg10?.[site];
    if (!Number.isFinite(angle) || !Number.isInteger(angle)) {
      throw new FormLawError(`fold progress site_angles_deg10[${site}] must be a finite integer (tenths of a degree)`);
    }
  }
  const form = progress.resolved_form;
  if (form != null && (!Number.isInteger(form.address) || form.address < 0 || form.address >= 64)) {
    throw new FormLawError("fold progress resolved_form.address must sit in the six-bit field 0..64");
  }
}
const DEG10_TO_RAD = Math.PI / 1800;
function applyFold(body, progress) {
  assertFoldProgress(progress);
  const [ax, ay, az] = progress.site_angles_deg10;
  const cx = ax * DEG10_TO_RAD, cy = ay * DEG10_TO_RAD, cz = az * DEG10_TO_RAD;
  const cosX = Math.cos(cx), sinX = Math.sin(cx);
  const cosY = Math.cos(cy), sinY = Math.sin(cy);
  const cosZ = Math.cos(cz), sinZ = Math.sin(cz);
  const out = new Float64Array(body.samples.length * 3);
  for (let i = 0; i < body.samples.length; i++) {
    let [x, y, z] = restUnits(body, body.samples[i]);
    let y2 = y * cosX - z * sinX;
    let z2 = y * sinX + z * cosX;
    let z3 = z2 * cosY - x * sinY;
    let x3 = z2 * sinY + x * cosY;
    let x4 = x3 * cosZ - y2 * sinZ;
    let y4 = x3 * sinZ + y2 * cosZ;
    out[i * 3] = x4;
    out[i * 3 + 1] = y4;
    out[i * 3 + 2] = z3;
  }
  return out;
}
const RETAINED_EVENTS = 64;
function f64BeBytes(value) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return new Uint8Array(view.buffer);
}
function observeBody(body) {
  const digest = [];
  let occupied = 0;
  let coverageSum = 0;
  let min = null;
  let max = null;
  for (const sample of body.samples) {
    const rest = restUnits(body, sample);
    digest.push(
      Number(sample.sampleId >> 56n) & 255,
      Number(sample.sampleId >> 48n & 0xffn),
      Number(sample.sampleId >> 40n & 0xffn),
      Number(sample.sampleId >> 32n & 0xffn),
      Number(sample.sampleId >> 24n & 0xffn),
      Number(sample.sampleId >> 16n & 0xffn),
      Number(sample.sampleId >> 8n & 0xffn),
      Number(sample.sampleId & 0xffn)
    );
    digest.push(sample.layerIndex >> 8 & 255, sample.layerIndex & 255);
    digest.push(sample.uIndex >> 8 & 255, sample.uIndex & 255);
    digest.push(sample.vIndex >> 8 & 255, sample.vIndex & 255);
    for (const b of f64BeBytes(sample.coverage)) digest.push(b);
    for (const axis of rest) for (const b of f64BeBytes(axis)) digest.push(b);
    if (sample.coverage > 0) occupied++;
    coverageSum += sample.coverage;
    min = min ? [Math.min(min[0], rest[0]), Math.min(min[1], rest[1]), Math.min(min[2], rest[2])] : rest;
    max = max ? [Math.max(max[0], rest[0]), Math.max(max[1], rest[1]), Math.max(max[2], rest[2])] : rest;
  }
  return {
    schema: RESIDENT_GEOMETRY_CONTRACT,
    preparation_sha256: body.preparationSha256,
    sample_count: body.samples.length,
    resident_sha256: sha256Hex(new Uint8Array(digest)),
    occupied_samples: occupied,
    coverage_sum: coverageSum,
    rest_bounds_units: [min ?? [0, 0, 0], max ?? [0, 0, 0]],
    standing: "observed resident geometry: read from the retained body, not from the commanded state; the identity digest moves only when a resident point moves"
  };
}
class FormInstrument {
  counters = /* @__PURE__ */ new Map();
  /** The cache keys whose preparation this instrument issued — the cache-hit
   * decision's own basis. */
  issued = /* @__PURE__ */ new Set();
  /** The retained receipts, oldest first. Held under a private name so the
   * public `events()` reader is never shadowed by the field. */
  retained = [];
  countersOf(key) {
    let entry = this.counters.get(key);
    if (!entry) {
      entry = { rasterisations: 0, cacheHits: 0, reseeds: 0, progressReads: 0 };
      this.counters.set(key, entry);
    }
    return entry;
  }
  retain(event) {
    this.retained.push(event);
    const excess = this.retained.length - RETAINED_EVENTS;
    if (excess > 0) this.retained.splice(0, excess);
  }
  /** Prepares the body through the instrument: the first request under a cache
   * key records the rasterisation receipt; a repeat records a cache hit — the
   * rasteriser did not run. */
  prepare(preparation) {
    const body = prepareSamples(preparation);
    const key = body.preparationSha256;
    if (this.issued.has(key)) {
      this.countersOf(key).cacheHits++;
      this.retain({ event: "cache-hit", preparation_sha256: key });
      return { body, receipt: "cache-hit" };
    }
    this.issued.add(key);
    this.countersOf(key).rasterisations++;
    this.retain({
      event: "rasterised",
      preparation_sha256: key,
      mask_ref: body.preparation.mask?.maskRef ?? null,
      samples: body.samples.length
    });
    return { body, receipt: "rasterised" };
  }
  /** Records one fold-progress read against the resident body. No path from
   * here moves rasterisations or reseeds: a progress update is not a
   * preparation dependency. Refuses a foreign receipt by name and counts
   * nothing for it. */
  progressUpdate(body, progress) {
    assertFoldProgress(progress);
    const observed = observeBody(body);
    this.countersOf(body.preparationSha256).progressReads++;
    this.retain({ event: "progress-read", preparation_sha256: body.preparationSha256, cursor_steps: progress.cursor_steps });
    return {
      schema: RESIDENT_OBSERVATION_CONTRACT,
      preparation_sha256: body.preparationSha256,
      cursor_steps: progress.cursor_steps,
      commanded_site_angles_deg10: progress.site_angles_deg10,
      commanded_form_address: progress.resolved_form?.address ?? null,
      observed
    };
  }
  /** Admits a reseed through a genuine topology change only, through the
   * samples owner's explicit mapping. Refusals are by name: the same cache
   * key never reseeds itself; residents continuing by identity (the coating
   * moved, the topology did not) are refused a reseed. */
  reseed(previous, successor) {
    if (successor.preparationSha256 === previous.preparationSha256) {
      throw new FormLawError("the successor body is the same cache key; a reseed without a preparation change is a law violation");
    }
    const mapping = remapSamples(previous, successor);
    const identity = successor.samples.every((sample, i) => mapping.pairs[i] === sample.sampleId);
    if (identity) {
      throw new FormLawError(
        `the residents continue by identity across cache key ${successor.preparationSha256} (topology unchanged; the explicit mapping is the identity); a reseed without a genuine topology change is refused \u2014 the coating moved, the body did not`
      );
    }
    const continued = mapping.pairs.filter((p) => p !== null).length;
    const fresh = mapping.pairs.length - continued;
    this.countersOf(successor.preparationSha256).reseeds++;
    this.retain({
      event: "reseeded",
      preparation_sha256: successor.preparationSha256,
      predecessor_sha256: previous.preparationSha256,
      continued_samples: continued,
      fresh_samples: fresh
    });
    return {
      schema: FORM_INSTRUMENT_CONTRACT,
      predecessor_sha256: previous.preparationSha256,
      preparation_sha256: successor.preparationSha256,
      continued_samples: continued,
      fresh_samples: fresh
    };
  }
  counterOf(preparationSha256) {
    return this.counters.get(preparationSha256) ?? null;
  }
  events() {
    return this.retained;
  }
  /** The whole instrument's proof line across every cache key. */
  totals() {
    const totals = { rasterisations: 0, cacheHits: 0, reseeds: 0, progressReads: 0 };
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
  state() {
    return {
      schema: FORM_INSTRUMENT_CONTRACT,
      counters: [...this.counters.entries()].map(([key, c]) => ({
        preparation_sha256: key,
        rasterisations: c.rasterisations,
        cache_hits: c.cacheHits,
        reseeds: c.reseeds,
        progress_reads: c.progressReads
      })),
      events: this.retained,
      standing: "rasterisation/reseed instrumentation over dependency-correct cache keys; the counters are the proof surface, the events the receipts"
    };
  }
}
class PsgFormSampler {
  instrument = new FormInstrument();
  standing = null;
  declare(preparation) {
    const { body, receipt } = this.instrument.prepare(preparation);
    let reseed = null;
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
  get body() {
    return this.standing;
  }
  /** Applies the commanded crease path: the deformed positions per sample plus
   * the observation receipt. The read is counted; the body stands untouched. */
  applyFold(progress) {
    if (!this.standing) throw new FormLawError("no retained sample body; declare a preparation first");
    const observation = this.instrument.progressUpdate(this.standing, progress);
    return { deformed: applyFold(this.standing, progress), observation };
  }
  /** The observed resident geometry — read from the retained body, never from
   * the commanded state. Pure. */
  observe() {
    return this.standing ? observeBody(this.standing) : null;
  }
  /** Bounded disclosure for diagnostics: the instrument state (counters per
   * key, retained receipts) plus the standing body's identity line. */
  disclose() {
    return {
      instrument: this.instrument.state(),
      body: this.standing ? {
        prep_ref: this.standing.preparation.prepRef,
        preparation_sha256: this.standing.preparationSha256,
        sample_count: this.standing.samples.length
      } : null
    };
  }
}
function coveragesFromAlpha(alpha, width, height, resolution, stride = 1) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new FormLawError("the cited raster must carry positive integer dimensions");
  }
  if (!Number.isInteger(resolution) || resolution <= 0 || resolution > MAX_RESOLUTION) {
    throw new FormLawError(`sample resolution must be within 1..=${MAX_RESOLUTION} per side`);
  }
  const coverages = new Array(resolution * resolution);
  const alphaOffset = stride - 1;
  for (let v = 0; v < resolution; v++) {
    const py = Math.min(height - 1, Math.floor((v + 0.5) / resolution * height));
    for (let u = 0; u < resolution; u++) {
      const px = Math.min(width - 1, Math.floor((u + 0.5) / resolution * width));
      const value = alpha[(py * width + px) * stride + alphaOffset];
      coverages[v * resolution + u] = Math.max(0, Math.min(1, (Number.isFinite(value) ? value : 0) / 255));
    }
  }
  return coverages;
}
function glyphPreparation(declaration) {
  return {
    schema: FORM_SAMPLES_CONTRACT,
    prepRef: declaration.prepRef,
    treatment: "glyph-mask",
    layers: declaration.layers ?? [{ layerRef: "glyph:front", restDepthW: 0.5 }],
    resolution: declaration.resolution,
    units: {
      extentUnits: declaration.units?.extentUnits ?? 400,
      depthUnits: declaration.units?.depthUnits ?? 20,
      metresPerUnit: declaration.units?.metresPerUnit ?? 1e-3
    },
    mask: { maskRef: declaration.maskRef, coverages: declaration.coverages }
  };
}
export {
  FOLD_PROGRESS_CONTRACT,
  FOLD_SEQUENCE_CONTRACT,
  FOLD_STAGE_EFFECT_CONTRACT,
  FORM_INSTRUMENT_CONTRACT,
  FORM_SAMPLES_CONTRACT,
  FormInstrument,
  FormLawError,
  MAX_LAYERS,
  MAX_RESOLUTION,
  PsgFormSampler,
  RESIDENT_GEOMETRY_CONTRACT,
  RESIDENT_OBSERVATION_CONTRACT,
  RETAINED_EVENTS,
  allocationCount,
  applyFold,
  assertFoldProgress,
  canonicalPreparationJson,
  coveragesFromAlpha,
  fnv1a64,
  glyphPreparation,
  observeBody,
  prepareSamples,
  remapSamples,
  restUnits,
  restUv,
  restW,
  sampleIdOf,
  sha256Hex,
  validatePreparation
};
