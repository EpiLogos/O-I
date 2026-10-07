/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sampler-level proof for the app's PS-G sampler half (QL-MEF #296, #299):
 * the retained glyph body's correspondence and the instrument's counters,
 * against the law landed on QL-MEF main.
 *
 * Runs under node's own test runner:
 *   node --test desktop/cradle/expressions-app/src/engine/psg-form-sampler.test.mjs
 * The engine module is TypeScript; the test bundles it once with the app's own
 * esbuild into a temporary directory and imports the bundle. Nothing is written
 * inside the tree.
 *
 * The identity vectors below were computed independently of both this module
 * and the native crate (Python, FNV-1a 64 over the native byte layout:
 * contract \0 prep_ref \0 layer_be u_be v_be, with the contract constants read
 * straight from the native sources) — so passing here pins byte-exact parity
 * with the native sample_id law, not self-consistency.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const outfile = join(mkdtempSync(join(tmpdir(), 'psg-form-sampler-')), 'psg-form-sampler.mjs');
await esbuild.build({
  entryPoints: [fileURLToPath(new URL('./psg-form-sampler.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
});
const M = await import(pathToFileURL(outfile).href);

const PREP_REF = 'oi:psg:glyph-test@1';
/** Native sample_id law, computed independently (see header). */
const NATIVE_IDS = {
  '0,0,0': 10783746745061511463n,
  '0,1,0': 10159581481681457788n,
  '0,0,1': 10783745645549883252n,
  '0,1,1': 10159582581193085999n,
};
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function sheetPrep(overrides = {}) {
  return {
    schema: M.FORM_SAMPLES_CONTRACT,
    prepRef: PREP_REF,
    treatment: 'sheet-carrier',
    layers: [{ layerRef: 'glyph:front', restDepthW: 0.5 }],
    resolution: 2,
    units: { extentUnits: 2, depthUnits: 0.5, metresPerUnit: 0.5 },
    mask: undefined,
    ...overrides,
  };
}

function glyphPrep(coverages, overrides = {}) {
  return sheetPrep({
    treatment: 'glyph-mask',
    mask: { maskRef: 'app:rasteriser:text-glyph@1', coverages },
    ...overrides,
  });
}

function bodyFingerprint(body) {
  return {
    sha: body.preparationSha256,
    samples: body.samples.map((s) => [String(s.sampleId), s.layerIndex, s.uIndex, s.vIndex, s.coverage]),
  };
}

/** A law-shaped fold-progress receipt with hand-declared commanded angles
 * (the specimen walk's values: hold 7, the eased mid, the resolved end). */
function progressAt(cursorSteps, angles, resolvedAddress = null) {
  return {
    schema: M.FOLD_PROGRESS_CONTRACT,
    sequence_ref: 'oi:psg:fold-test',
    revision: 1,
    cursor_steps: cursorSteps,
    site_angles_deg10: angles,
    resolved_form: resolvedAddress === null ? null : { address: resolvedAddress },
    standing: 'test receipt',
  };
}

const HOLD = [225, -225, -225];
const MID = [225, -225, 0];
const END = [225, -225, 225];

test('the digest is the standard function', () => {
  assert.equal(M.sha256Hex(new TextEncoder().encode('abc')), SHA_ABC);
  assert.equal(
    M.sha256Hex(new Uint8Array(0)),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});

test('sample identity is the native law, byte for byte', () => {
  const body = M.prepareSamples(sheetPrep());
  assert.equal(body.samples.length, 4);
  // Allocation order: row v, then column u (layer-major across layers).
  const keys = ['0,0,0', '0,1,0', '0,0,1', '0,1,1'];
  body.samples.forEach((sample, i) => {
    assert.equal(
      sample.sampleId,
      NATIVE_IDS[keys[i]],
      `sample ${i} (${keys[i]}) must carry the native identity`,
    );
  });
  // The identity is a per-point law, not an index into one call.
  assert.equal(new Set(body.samples.map((s) => String(s.sampleId))).size, 4);
});

test('re-resolution is identity: same IDs, same order, same key', () => {
  const first = M.prepareSamples(glyphPrep([1, 0.5, 0.25, 0]));
  const second = M.prepareSamples(glyphPrep([1, 0.5, 0.25, 0]));
  assert.deepEqual(bodyFingerprint(second), bodyFingerprint(first));
  assert.equal(first.preparationSha256.length, 64);
});

test('the cache key moves with the preparation and never with progress', () => {
  const sampler = new M.PsgFormSampler();
  const first = sampler.declare(glyphPrep([1, 0.5, 0.25, 0]));
  assert.equal(first.preparation, 'rasterised');
  const recoated = sampler.declare({
    ...glyphPrep([0.5, 0.5, 0.5, 0.5]),
    mask: { maskRef: 'app:rasteriser:text-glyph@2', coverages: [0.5, 0.5, 0.5, 0.5] },
  });
  assert.equal(recoated.preparation, 'rasterised', 'a moved coating is a new cache key');
  assert.notEqual(recoated.body.preparationSha256, first.body.preparationSha256);
  // Same preparation reference and topology: the residents continue by identity.
  assert.deepEqual(
    recoated.body.samples.map((s) => String(s.sampleId)),
    first.body.samples.map((s) => String(s.sampleId)),
  );
  // Rest coordinates derive from the indices alone; the coating never moves them.
  assert.deepEqual(
    [...first.body.samples].map((s) => M.restUnits(first.body, s)),
    [...recoated.body.samples].map((s) => M.restUnits(recoated.body, s)),
  );

  // The full progress walk over the recoated body: holds, the transition's
  // interior, the resolved quanta, and a seek back. Every step is a read.
  const cursors = [
    progressAt(0, HOLD, 7),
    progressAt(719, HOLD, 7),
    progressAt(720, HOLD, 7),
    progressAt(1080, MID, null),
    progressAt(1200, [225, -225, 112], null),
    progressAt(1439, END, null),
    progressAt(1440, END, 6),
    progressAt(2160, END, 6),
    progressAt(1080, MID, null),
  ];
  const observations = cursors.map((progress) => sampler.applyFold(progress).observation);

  const counters = sampler.instrument.counterOf(recoated.body.preparationSha256);
  assert.deepEqual(counters, { rasterisations: 1, cacheHits: 0, reseeds: 0, progressReads: 9 });
  assert.deepEqual(sampler.instrument.totals(), { rasterisations: 2, cacheHits: 0, reseeds: 0, progressReads: 9 });

  // Commanded moved; the observed body stood. One resident digest across all nine.
  const digests = new Set(observations.map((o) => o.observed.resident_sha256));
  assert.equal(digests.size, 1);
  assert.equal(observations[0].observed.schema, M.RESIDENT_GEOMETRY_CONTRACT);
  assert.equal(observations[0].schema, M.RESIDENT_OBSERVATION_CONTRACT);
  assert.notDeepEqual(observations[0].commanded_site_angles_deg10, observations[3].commanded_site_angles_deg10);
  assert.equal(observations[0].commanded_form_address, 7);
  assert.equal(observations[3].commanded_form_address, null, 'no form is named mid-transition');
  assert.equal(observations[6].commanded_form_address, 6);
  assert.equal(observations[8].cursor_steps, 1080, 'seek is re-reading');
  // The events receipt the reads under their cache key.
  const events = sampler.instrument.events();
  assert.equal(events.length, 11);
  assert.equal(events.filter((e) => e.event === 'progress-read').length, 9);
  assert.deepEqual(
    events[events.length - 1],
    { event: 'progress-read', preparation_sha256: recoated.body.preparationSha256, cursor_steps: 1080 },
  );
});

test('fold progress applied twice deforms identically and touches no resident', () => {
  const sampler = new M.PsgFormSampler();
  const { body } = sampler.declare(glyphPrep([1, 0.5, 0.25, 0]));
  const before = bodyFingerprint(body);
  const receipt = progressAt(1080, MID);
  const one = sampler.applyFold(receipt);
  const two = sampler.applyFold(receipt);
  assert.deepEqual([...two.deformed], [...one.deformed], 'the deformer is pure in its inputs');
  assert.deepEqual(bodyFingerprint(body), before, 'applying a fold never moves the retained body');
  assert.equal(sampler.instrument.totals().progressReads, 2);
});

test('the crease application is the exact orthogonal-hinge walk', () => {
  const body = M.prepareSamples(glyphPrep([1, 1, 1, 1]));
  // Resolution 2, extent 2, depth 0.5, w = 0.5: every rest z is 0, corners at (±0.5, ±0.5, 0).
  const corner = body.samples[1]; // u=1, v=0 → (0.5, −0.5, 0)
  assert.deepEqual(M.restUnits(body, corner), [0.5, -0.5, 0]);

  const at = (angles, sample) => [...M.applyFold(body, progressAt(0, angles)).slice(sampleIndex(body, sample) * 3, sampleIndex(body, sample) * 3 + 3)];
  const near = (actual, expected, epsilon = 1e-9) => {
    expected.forEach((value, i) => assert.ok(Math.abs(actual[i] - value) < epsilon, `${actual[i]} ≈ ${value}`));
  };
  function sampleIndex(b, s) {
    return b.samples.indexOf(s);
  }

  // Zero command: the rest body stands exactly.
  assert.deepEqual([...M.applyFold(body, progressAt(0, [0, 0, 0]))], [...body.samples.flatMap((s) => M.restUnits(body, s))]);

  // Site 0 at 900 deg10 = 90°: the (y,z) hinge turns (0.5, −0.5, 0) → (0.5, 0, −0.5).
  near(at([900, 0, 0], corner), [0.5, 0, -0.5]);
  // Site 1 at 90°: site 0 (idle) first, then the (z,x) hinge turns
  // (0.5, −0.5, 0) → (0, −0.5, −0.5).
  near(at([0, 900, 0], corner), [0, -0.5, -0.5]);
  // Site 2 at 90°: the in-plane turn sends (0.5, −0.5) → (0.5, 0.5).
  near(at([0, 0, 900], corner), [0.5, 0.5, 0]);
});

test('a coating change is refused a reseed: the residents continue by identity', () => {
  const sampler = new M.PsgFormSampler();
  const first = sampler.declare(glyphPrep([1, 0.5, 0.25, 0]));
  const recoated = sampler.declare({
    ...glyphPrep([0.25, 0.25, 0.25, 0.25]),
    mask: { maskRef: 'app:rasteriser:text-glyph@2', coverages: [0.25, 0.25, 0.25, 0.25] },
  });
  assert.equal(typeof recoated.reseed, 'string');
  assert.match(recoated.reseed, /continue by identity/);
  assert.match(recoated.reseed, /the coating moved, the body did not/);
  assert.equal(sampler.instrument.totals().reseeds, 0, 'no reseed was admitted');
  assert.equal(sampler.instrument.counterOf(recoated.body.preparationSha256).rasterisations, 1);
  assert.equal(first.preparation, 'rasterised');
});

test('a topology change admits the reseed through the explicit mapping', () => {
  const sampler = new M.PsgFormSampler();
  const fine = sampler.declare(glyphPrep([1, 0.5, 0.25, 0, 1, 0, 0.5, 0.25, 1, 0, 0, 1, 0.5, 1, 0, 0.25], { resolution: 4 }));
  assert.equal(fine.body.samples.length, 16);

  // Resolution halves: a genuine topology change.
  const coarse = sampler.declare(glyphPrep([1, 0.5, 0.25, 0], { resolution: 2 }));
  assert.equal(typeof coarse.reseed, 'object');
  assert.equal(coarse.reseed.schema, M.FORM_INSTRUMENT_CONTRACT);
  assert.equal(coarse.reseed.continued_samples, 4, 'every coarse point continues from its nearest predecessor');
  assert.equal(coarse.reseed.fresh_samples, 0);
  assert.equal(sampler.instrument.counterOf(coarse.body.preparationSha256).reseeds, 1);

  // A genuinely new layer reseeds with fresh points named.
  const deeper = sampler.declare(
    glyphPrep([1, 0.5, 0.25, 0, 0.5, 0.5, 0.5, 0.5], {
      resolution: 2,
      layers: [
        { layerRef: 'glyph:front', restDepthW: 0.5 },
        { layerRef: 'glyph:back', restDepthW: 0.75 },
      ],
    }),
  );
  assert.equal(typeof deeper.reseed, 'object');
  assert.equal(deeper.reseed.continued_samples, 4);
  assert.equal(deeper.reseed.fresh_samples, 4, 'the new layer carries fresh points, not pretended continuations');
  assert.deepEqual(sampler.instrument.totals(), { rasterisations: 3, cacheHits: 0, reseeds: 2, progressReads: 0 });
});

test('the same cache key never reseeds itself, and another reference is a new correspondence', () => {
  const sampler = new M.PsgFormSampler();
  const { body } = sampler.declare(glyphPrep([1, 0.5, 0.25, 0]));
  assert.throws(() => sampler.instrument.reseed(body, body), /same cache key/);
  const elsewhere = sampler.declare(glyphPrep([1, 0.5, 0.25, 0], { prepRef: 'oi:psg:elsewhere' }));
  assert.equal(typeof elsewhere.reseed, 'string');
  assert.match(elsewhere.reseed, /new correspondence/);
});

test('the observed geometry reads the retained body', () => {
  const body = M.prepareSamples(glyphPrep([1, 0.5, 0, 1]));
  const geometry = M.observeBody(body);
  assert.equal(geometry.schema, M.RESIDENT_GEOMETRY_CONTRACT);
  assert.equal(geometry.preparation_sha256, body.preparationSha256);
  assert.equal(geometry.sample_count, 4);
  assert.equal(geometry.occupied_samples, 3);
  assert.ok(Math.abs(geometry.coverage_sum - 2.5) < 1e-12);
  // Extent 2 over resolution 2: centres at ±0.5; w = 0.5 → z = 0.
  assert.deepEqual(geometry.rest_bounds_units, [[-0.5, -0.5, 0], [0.5, 0.5, 0]]);
  // Reading is pure.
  assert.deepEqual(M.observeBody(body), geometry);
});

test('refusals name the law they refuse under', () => {
  const refusal = (fn, pattern) => assert.throws(fn, (error) => error instanceof M.FormLawError && pattern.test(error.message), pattern);
  refusal(() => M.prepareSamples(sheetPrep({ schema: 'ql.psg-form-samples/v0' })), /unsupported sample preparation contract/);
  refusal(() => M.prepareSamples({ ...glyphPrep([1, 1, 1, 1]), mask: undefined }), /the mask is cited here, never invented/);
  refusal(() => M.prepareSamples(glyphPrep([1, 1, 1])), /one coverage per retained sample/);
  refusal(() => M.prepareSamples(glyphPrep([2, 0, 0, 0])), /coverage must be finite within 0..1/);
  refusal(() => M.prepareSamples(sheetPrep({ mask: { maskRef: 'm', coverages: [] } })), /sheet carrier covers every allocation point/);
  refusal(() => M.prepareSamples(sheetPrep({ resolution: 0 })), /per side/);
  refusal(() => M.prepareSamples(sheetPrep({ resolution: 65 })), /per side/);
  refusal(() => M.prepareSamples(sheetPrep({ layers: [] })), /1\.\.=16 layers/);
  refusal(() => M.prepareSamples(sheetPrep({
    layers: [
      { layerRef: 'glyph:front', restDepthW: 0.5 },
      { layerRef: 'glyph:front', restDepthW: 0.25 },
    ],
  })), /layer identity must be unique/);
  refusal(() => M.prepareSamples(sheetPrep({ layers: [{ layerRef: 'glyph:front', restDepthW: 1.5 }] })), /normalised domain 0..1/);
  refusal(() => M.prepareSamples(sheetPrep({ units: { extentUnits: 0, depthUnits: 1, metresPerUnit: 1 } })), /extent_units/);
  refusal(() => M.prepareSamples(sheetPrep({ units: { extentUnits: 1, depthUnits: -1, metresPerUnit: 1 } })), /depth_units/);
  refusal(() => M.prepareSamples(sheetPrep({ prepRef: '' })), /invalid preparation reference/);

  const body = M.prepareSamples(glyphPrep([1, 0.5, 0.25, 0]));
  refusal(() => M.applyFold(body, { ...progressAt(0, HOLD), schema: 'ql.psg-fold-progress/v0' }), /unsupported fold progress contract/);
  refusal(() => M.applyFold(body, progressAt(-1, HOLD)), /safe unsigned integer/);
  refusal(() => M.applyFold(body, progressAt(0, [225, 0.5, 0])), /finite integer/);
  refusal(() => M.applyFold(body, { ...progressAt(0, HOLD), resolved_form: { address: 64 } }), /six-bit field/);
  refusal(() => M.coveragesFromAlpha(new Uint8Array(16), 0, 4, 2), /positive integer dimensions/);
});

test('coverages read the cited raster at the point centres', () => {
  // A 4×4 RGBA raster whose top-left quadrant is ink.
  const alpha = new Uint8Array(4 * 4 * 4);
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) alpha[(y * 4 + x) * 4 + 3] = 255;
  }
  const coverages = M.coveragesFromAlpha(alpha, 4, 4, 2, 4);
  assert.deepEqual(coverages, [1, 0, 0, 0]);
  // Alpha-only rasters (stride 1) work the same way. Cell (0,0)'s centre is
  // pixel (1,1) in a 4×4 raster — index 5.
  const plain = new Uint8Array(16);
  plain[5] = 128;
  assert.deepEqual(M.coveragesFromAlpha(plain, 4, 4, 2, 1), [128 / 255, 0, 0, 0]);
});

test('the glyph declaration builds the law-shaped preparation', () => {
  const prep = M.glyphPreparation({
    prepRef: PREP_REF,
    maskRef: 'app:rasteriser:text-glyph@1',
    coverages: [1, 0.5, 0.25, 0],
    resolution: 2,
  });
  assert.equal(prep.schema, M.FORM_SAMPLES_CONTRACT);
  assert.equal(prep.treatment, 'glyph-mask');
  assert.equal(prep.layers[0].layerRef, 'glyph:front');
  assert.equal(prep.units.extentUnits, 400);
  const body = M.prepareSamples(prep);
  assert.equal(body.samples.length, 4);
});

test('the disclosure is bounded and names the contract', () => {
  const sampler = new M.PsgFormSampler();
  sampler.declare(glyphPrep([1, 0.5, 0.25, 0]));
  sampler.applyFold(progressAt(0, HOLD, 7));
  const disclosure = sampler.disclose();
  assert.equal(disclosure.instrument.schema, M.FORM_INSTRUMENT_CONTRACT);
  assert.equal(disclosure.instrument.counters.length, 1);
  assert.equal(disclosure.instrument.counters[0].progress_reads, 1);
  assert.equal(disclosure.instrument.counters[0].rasterisations, 1);
  assert.equal(disclosure.body.prep_ref, PREP_REF);
  assert.equal(disclosure.body.sample_count, 4);
});
