// lane-5 T5 (production compositor): the produced render honours each edge's curve and switch mode as live playback does, and an edge
// without them exports exactly as it always did. Pure law and source reads only; the WebGL field itself is not run under node.
// Run after `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SWITCH_MODES, CURVE_TYPES, curveProgress, curveOf, edgeBlend, dipWeights, wipeHoldRect, paintedPassParams, validateTransitionSpec,
} from '../build/transitions.js';

const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const production = readFileSync(new URL('../src/production.ts', import.meta.url), 'utf8');
const pass = readFileSync(new URL('../../src/engine/transitionPass.ts', import.meta.url), 'utf8');

const smoothstep = u => u * u * (3 - 2 * u);
// The live law (app.ts blendProgress): a seam's curve, or the linear identity for an edge without one.
const live = (spec, f) => curveProgress(curveOf(spec) ?? {type: 'linear'}, f);
const FRACTIONS = [0, .1, .25, .5, .75, .9, 1];

// Each curve the editor can write, with and without handles, as the stored (validated) spec carries it.
const CURVES = [
  {type: 'hold'},
  {type: 'smooth'},
  {type: 'bezier'},
  {type: 'bezier', out: {dt: .3, dv: .1}, in: {dt: -.3, dv: -.1}},
  {type: 'bezier', out: {dt: .1, dv: .4}},
];
const KINDS = [
  {kind: 'crossfade'},
  {kind: 'dip-to-colour', at: .5},
  {kind: 'wipe', direction: 'right'},
];

test('an absent edge exports exactly as it always did: the raw fraction and the smoothstep, bit for bit', () => {
  for (const spec of [undefined, null, {kind: 'crossfade'}, {kind: 'dip-to-colour', at: .3}, {kind: 'wipe', direction: 'up'}, {kind: 'cut'}]) {
    for (const f of FRACTIONS) {
      const {progress, blend} = edgeBlend(spec, f);
      assert.equal(progress, f, `progress is the raw fraction at ${f}`);
      assert.equal(blend, f * f * (3 - 2 * f), `blend is today's smoothstep at ${f}`);
    }
  }
});

test('a switch mode alone is not a curve: an edge with only a switch exports as an absent edge does', () => {
  for (const switchMode of SWITCH_MODES) {
    const spec = validateTransitionSpec({kind: 'crossfade', switchMode});
    for (const f of FRACTIONS) {
      const {progress, blend} = edgeBlend(spec, f);
      assert.equal(progress, f, `${switchMode} keeps the raw progress at ${f}`);
      assert.equal(blend, smoothstep(f), `${switchMode} keeps the smoothstep at ${f}`);
    }
  }
});

test('a linear curve is never stored, and even an unvalidated one blends as the absent edge does', () => {
  assert.equal(validateTransitionSpec({kind: 'crossfade', curve: {type: 'linear'}}), undefined);
  for (const f of FRACTIONS) assert.equal(edgeBlend({kind: 'crossfade', curve: {type: 'linear'}}, f).blend, smoothstep(f));
});

test('export equals live for each switch mode and each curve: the produced blend is the live curve progress', () => {
  for (const base of KINDS) for (const switchMode of SWITCH_MODES) for (const curve of CURVES) {
    const spec = validateTransitionSpec({...base, switchMode, curve});
    assert.ok(spec, `${base.kind} with ${switchMode} and ${curve.type} is a valid edge`);
    for (const f of FRACTIONS) {
      const produced = edgeBlend(spec, f);
      const lived = live(spec, f);
      assert.equal(produced.progress, lived, `${base.kind}/${switchMode}/${curve.type} progress at ${f}`);
      assert.equal(produced.blend, lived, `${base.kind}/${switchMode}/${curve.type} particle blend at ${f}`);
    }
  }
});

test('the switch mode never changes the blend: an edge with a switch blends as the same edge without one', () => {
  for (const curve of CURVES) for (const f of FRACTIONS) {
    const plain = edgeBlend(validateTransitionSpec({kind: 'wipe', direction: 'down', curve}), f);
    for (const switchMode of SWITCH_MODES) {
      const switched = edgeBlend(validateTransitionSpec({kind: 'wipe', direction: 'down', switchMode, curve}), f);
      assert.deepEqual(switched, plain, `${switchMode} does not alter the blend at ${f}`);
    }
  }
});

test('the painted pass in the produced render takes the live curve progress: the dip weights and the wipe hold match live', () => {
  const W = 1440, H = 900;
  for (const curve of CURVES) for (const f of FRACTIONS) {
    const dip = validateTransitionSpec({kind: 'dip-to-colour', at: .4, curve});
    const dipProgress = edgeBlend(dip, f).progress;
    // live: the 2D overlay weighs the dip by its curve progress (app.ts paintTransition).
    assert.deepEqual(paintedPassParams(dip, dipProgress, W, H, false), paintedPassParams(dip, live(dip, f), W, H, false), `dip pass at ${f}`);
    assert.equal(paintedPassParams(dip, dipProgress, W, H, false).colourW, dipWeights(live(dip, f), .4).colour, `dip colour at ${f}`);

    const wipe = validateTransitionSpec({kind: 'wipe', direction: 'right', curve});
    const wipeProgress = edgeBlend(wipe, f).progress;
    const rect = wipeHoldRect('right', live(wipe, f), W, H);
    const pass = paintedPassParams(wipe, wipeProgress, W, H, true);
    assert.deepEqual(pass.holdRect, [rect.x, H - (rect.y + rect.height), rect.width, rect.height], `wipe hold at ${f}`);
  }
});

test('the curve-free dip and wipe still paint at the raw fraction, as the produced pass always did', () => {
  const W = 1280, H = 720;
  for (const f of FRACTIONS) {
    const dip = {kind: 'dip-to-colour', at: .5};
    assert.deepEqual(paintedPassParams(dip, edgeBlend(dip, f).progress, W, H, false), paintedPassParams(dip, f, W, H, false));
    const wipe = {kind: 'wipe', direction: 'left'};
    assert.deepEqual(paintedPassParams(wipe, edgeBlend(wipe, f).progress, W, H, true), paintedPassParams(wipe, f, W, H, true));
  }
});

test('every curve the editor can write is a curve the produced blend can read', () => {
  for (const type of CURVE_TYPES) {
    const curve = type === 'linear' ? undefined : {type};
    for (const f of FRACTIONS) assert.ok(Number.isFinite(edgeBlend(curve ? {kind: 'crossfade', curve} : undefined, f).blend));
  }
});

test('source: the produced compositor reads the edge\'s blend and no longer hard-codes the blend for a curved edge', () => {
  assert.match(production, /import \{[^}]*\bedgeBlend\b[^}]*\} from '\.\/transitions';/);
  assert.match(production, /const \{progress,blend:t\}=edgeBlend\(spec,fraction\);/);
  assert.match(production, /fraction:progress,colour:transitionColourOf\(target\.backgroundColor\)/, 'the painted overlay carries the curve progress');
  assert.match(production, /transitionKindOf\(this\.seam\)==='dip-to-colour'\?Math\.min\(1,progress\/\(this\.seam\?\.at\?\?DIP_AT_DEFAULT\)\):t\)/,
    'the dip ground follows the same progress');
  assert.doesNotMatch(production, /const t=fraction\*fraction\*\(3-2\*fraction\)/, 'the smoothstep lives only in edgeBlend, for an absent edge');
});

test('source: live playback reads the same curve law the produced render reads, and the painted pass is unchanged', () => {
  assert.match(app, /function blendProgress\(f:number\)\{return transitionCurveNow\?curveProgress\(transitionCurveNow,f\):applyEasing\(f,transitionEasing\);\}/);
  assert.match(app, /transitionCurveNow=curveOf\(target\.transitionSpec\)\?\?LINEAR_SEAM_CURVE;/);
  assert.match(pass, /export function paintedPassParams|paintedPassParams\(overlay\.spec,overlay\.fraction/, 'the pass takes the overlay fraction it is given');
});
