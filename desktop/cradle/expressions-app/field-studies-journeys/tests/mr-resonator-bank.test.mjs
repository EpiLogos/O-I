// MR (DLW §22.7 Resonator bank): the effect after the torus that gives the M3 clock's cut a sound. The owner's law of it
// (native-field/effectsLaw.ts, the fifth effect `resonator`), the pitches of its bodies, and the graph that rings them
// (native-field/presentationEffects.ts), proved in two ways:
//   - the law, the bodies and the impulse response the graph convolves with are pure and are read here in node;
//   - the graph itself is rendered in a real browser's OfflineAudioContext, in Chromium and in WebKit (the desktop host is WebKit on
//     macOS), and what comes out is measured: Off is the input exactly, Mix 0 is the dry, Gain scales the ringing, each body rings at its
//     pitch and for Decay seconds (the -60 dB time), Tilt is a slope across the span, a stereo sound rings on its own sides. WebKit on Linux
//     (CI's) leaks each block's Nyquist bin through its convolver; the bank corrects it where the page's measure finds it, and the measure's
//     verdict is printed with each engine's measurements.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/mr-resonator-bank.test.mjs
//
// The sources are TypeScript: they are bundled once with the app's own esbuild into a temporary directory. The browsers are
// Playwright's (desktop/cradle/node_modules); a browser that cannot start fails the test, it is never skipped.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const {chromium, webkit} = await import('playwright');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const native = join(journeys, 'src/native-field');
const out = mkdtempSync(join(tmpdir(), 'mr-resonator-'));
after(() => rmSync(out, {recursive: true, force: true}));

await esbuild.build({absWorkingDir: journeys, entryPoints: [join(native, 'effectsLaw.ts'), join(native, 'presentationEffects.ts')], bundle: true, format: 'esm',
  platform: 'node', outdir: out, outExtension: {'.js': '.mjs'}, logLevel: 'silent'});
const law = await import(pathToFileURL(join(out, 'effectsLaw.mjs')));
const fx = await import(pathToFileURL(join(out, 'presentationEffects.mjs')));
const browserBundle = (await esbuild.build({absWorkingDir: journeys, bundle: true, format: 'iife', globalName: 'bank', write: false, logLevel: 'silent',
  stdin: {resolveDir: native, loader: 'ts', contents: `export {PresentationEffects, resonatorImpulse, convolverLeaksNyquist} from './presentationEffects.ts';
    export {initialEffects, editEffects, editEffectChain, resonatorBodies, resonatorRootHz} from './effectsLaw.ts';`}})).outputFiles[0].text;

const RATE = 48000;
const C3 = 130.81279;
const db = x => 20 * Math.log10(x);
/** The magnitude of the discrete transform of `data` at `hz` (Goertzel's measure, scaled by the length). */
function at(data, hz, rate = RATE) {
  const w = 2 * Math.PI * hz / rate, k = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < data.length; i++) { const s = data[i] + k * s1 - s2; s2 = s1; s1 = s; }
  return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2);
}
/** How long a ringing takes to fall 60 dB: the slope of its energy decay curve (Schroeder's backward integral of x²) between 5 and 35 dB under
 * its start. It reads a body's ring without the cycle-by-cycle peak, which a short ring (Decay 0.05 s) smears. */
function fall60(data, rate = RATE) {
  const edc = new Float64Array(data.length); let sum = 0;
  for (let i = data.length - 1; i >= 0; i--) { sum += data[i] * data[i]; edc[i] = sum; }
  const level = i => 10 * Math.log10(edc[i] / edc[0]);
  let a = 0; while (a < edc.length && level(a) > -5) a++;
  let b = a; while (b < edc.length && level(b) > -35) b++;
  return b >= edc.length ? null : -60 * ((b - a) / rate) / (level(b) - level(a));
}
const near = (actual, expected, tolerance, what) => assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

// ── the law ─────────────────────────────────────────────────────────────────

test('the law: the Resonator bank is the fifth effect, opens as the manual says, and the owner refuses what is outside it in words', () => {
  assert.deepEqual(law.PRESENTATION_EFFECTS, ['filter', 'dynamics', 'delay', 'reverb', 'resonator']);
  assert.equal(law.EFFECT_TITLES.resonator, 'Resonator bank');
  const state = law.initialEffects();
  assert.deepEqual(state.resonator, {on: true, division: 300, root: 0, decay: 1, tilt: 0, span: 2, mix: 50, gain: 0},
    'On, 30° x 12 (300 tenths), the root C, Decay 1 s, Tilt 0, Span 2, Mix 50 %, Gain 0 dB: §22.7');
  assert.deepEqual(state.chain, [], 'the bank stands on no chain until you put it there');
  assert.deepEqual(law.readEffectsState(JSON.parse(JSON.stringify(state))), state);
  const refused = (key, value) => law.effectRefusal('resonator', key, value);
  assert.equal(refused('decay', 0.05), null); assert.equal(refused('decay', 10), null);
  assert.match(refused('decay', 0.04), /^Resonator bank decay goes from 0\.05 to 10 s/);
  assert.match(refused('decay', 10.5), /goes from 0\.05 to 10 s/);
  assert.match(refused('tilt', 1.2), /^Resonator bank tilt goes from -1 to 1/);
  assert.match(refused('mix', 101), /goes from 0 to 100 %/);
  assert.match(refused('gain', -25), /goes from -24 to 12 dB/);
  assert.match(refused('span', 5), /goes from 1 to 4/);
  assert.match(refused('span', 2.5), /whole number/);
  assert.match(refused('root', 12), /goes from 0 to 11/);
  assert.match(refused('root', 3.5), /whole number/);
  assert.equal(refused('division', 10), null, '1° x 360 is the finest cut');
  assert.equal(refused('division', 3600), null, '360° x 1 is the coarsest');
  assert.equal(refused('division', 240), null, '24° x 15');
  assert.match(refused('division', 11), /equal parts/, 'a cut that does not divide the circle evenly makes unequal parts');
  assert.match(refused('division', 5), /goes from 10 to 3600/);
  assert.match(law.effectRefusal('resonator', 'aperture', 3), /has no parameter aperture; it has on, division, root, decay, tilt, span, mix, gain/);
  assert.throws(() => law.editEffects(state, 'resonator', 'division', 11), /equal parts/);
  assert.equal(law.editEffects(state, 'resonator', 'division', 240).resonator.division, 240);
  assert.deepEqual(law.editEffectChain(state, ['reverb', 'resonator']).chain, ['reverb', 'resonator'], 'it takes its place on the chain like the others');
  assert.deepEqual(law.readEffectOperands({effect: 'resonator', key: 'span', value: 3}), {effect: 'resonator', key: 'span', value: 3});
  assert.equal(law.readEffectOperands({effect: 'resonator', key: 'on', value: 1}), null);
  assert.match(law.readEffectsState({...state, resonator: undefined}), /^resonator: expected its parameters/);
});

// ── the bodies ──────────────────────────────────────────────────────────────

test('the bodies: a cut of d° makes 360/d bodies to the octave at root · 2^(k/parts), repeated over the span', () => {
  const rootAt = pc => C3 * 2 ** (pc / 12);
  near(law.resonatorRootHz(0), C3, 1e-9, 'C is QL\'s C3');
  near(law.resonatorRootHz(9), 220, 1e-3, 'A is 220 Hz in the lowest octave');
  for (const [name, division, parts, root] of [['30° x 12', 300, 12, 0], ['24° x 15', 240, 15, 9], ['8° x 45', 80, 45, 4], ['360° x 1', 3600, 1, 7], ['1° x 360', 10, 360, 11]]) {
    const bodies = law.resonatorBodies({root, division, span: 2, tilt: 0});
    assert.equal(bodies.length, parts * 2, `${name}: ${parts} bodies in each of 2 octaves, none dropped`);
    bodies.forEach((body, index) => {
      const octave = Math.floor(index / parts), part = index % parts;
      assert.equal(body.octave, octave); assert.equal(body.part, part);
      near(body.hz / (rootAt(root) * 2 ** (octave + part / parts)), 1, 1e-12, `${name} body ${index}`);
    });
  }
  // The bank does not round a cut to the semitones: the 24° x 15 bodies sit 80 cents apart.
  const fifteen = law.resonatorBodies({root: 0, division: 240, span: 1, tilt: 0});
  near(1200 * Math.log2(fifteen[1].hz / fifteen[0].hz), 80, 1e-9, '24° x 15: 80 cents a step');
  const twelve = law.resonatorBodies({root: 0, division: 300, span: 1, tilt: 0});
  near(1200 * Math.log2(twelve[1].hz / twelve[0].hz), 100, 1e-9, '30° x 12: 100 cents, the semitone');
  const one = law.resonatorBodies({root: 9, division: 3600, span: 3, tilt: 0});
  assert.deepEqual(one.map(body => Math.round(body.hz * 1000) / 1000), [220, 440, 880], '360° x 1: the root alone, once an octave');
});

test('the tilt: a weight 2^(2·tilt·(place − 1/2)) across the span, the loudest body at 1, none above it', () => {
  const flat = law.resonatorBodies({root: 0, division: 300, span: 2, tilt: 0});
  assert.ok(flat.every(body => body.weight === 1), 'Tilt 0: every body at one weight');
  const bright = law.resonatorBodies({root: 0, division: 300, span: 2, tilt: 1}), dark = law.resonatorBodies({root: 0, division: 300, span: 2, tilt: -1});
  assert.equal(Math.max(...bright.map(b => b.weight)), 1); assert.equal(Math.max(...dark.map(b => b.weight)), 1);
  assert.ok(bright[bright.length - 1].weight === 1 && bright[0].weight < bright[bright.length - 1].weight, 'above 0 the high octaves are the brighter');
  assert.ok(dark[0].weight === 1 && dark[dark.length - 1].weight < dark[0].weight, 'below 0 the low octaves are');
  // From the lowest body (place 0) to the highest (place 23/24): 2^(2·tilt·23/24) between them.
  near(bright[0].weight / bright[23].weight, 2 ** (-2 * 23 / 24), 1e-12, 'the slope');
  near(db(bright[0].weight / bright[23].weight), -11.54, 0.01, 'about 11.5 dB across two octaves at Tilt 1');
});

// ── the impulse response ────────────────────────────────────────────────────

test('the impulse response: a body rings at its pitch for Decay (−60 dB), every body is in it, and a sliced build is the whole build', () => {
  const rate = 48000;
  for (const decay of [0.05, 0.5, 1, 10]) {
    const ir = fx.resonatorImpulse(rate, {root: 0, division: 3600, span: 1, decay, tilt: 0});
    assert.ok(ir.length >= Math.ceil(decay * rate), `Decay ${decay}: the response lasts at least the decay`);
    const measured = fall60(ir, rate);
    assert.ok(measured !== null, `Decay ${decay}: the response falls 35 dB inside its length`);
    near(measured / decay, 1, 0.05, `Decay ${decay}: the −60 dB time of a body is ${measured.toFixed(4)} s`);
  }
  // Each body at its pitch: 30° x 12 and 24° x 15, the response is far stronger at every body than between two.
  for (const [division, parts, root] of [[300, 12, 0], [240, 15, 9]]) {
    const ir = fx.resonatorImpulse(rate, {root, division, span: 1, decay: 4, tilt: 0}), f0 = C3 * 2 ** (root / 12);
    const peak = k => at(ir, f0 * 2 ** (k / parts), rate), valley = k => at(ir, f0 * 2 ** ((k + 0.5) / parts), rate);
    const lowest = Math.min(...Array.from({length: parts}, (_, k) => peak(k))), highest = Math.max(...Array.from({length: parts - 1}, (_, k) => valley(k)));
    assert.ok(db(lowest / highest) > 15, `${parts} to the octave: the weakest body ${db(lowest / highest).toFixed(1)} dB over the strongest gap`);
    const above = at(ir, f0 * 2.5, rate), under = at(ir, f0 * 0.7, rate);
    assert.ok(db(lowest / Math.max(above, under)) > 20, 'and nothing rings outside the span');
  }
  // A body's peak gain is one: a sine at its pitch passes at the weight (its transform at the pitch).
  const single = fx.resonatorImpulse(rate, {root: 0, division: 3600, span: 1, decay: 1, tilt: 0});
  near(at(single, C3, rate), 1, 0.01, 'the transform of a lone body at its pitch is its weight, 1');
  // Every body is in: the sliced build adds them all and equals the one-piece build, bit for bit.
  const params = {root: 5, division: 80, span: 3, decay: 0.5, tilt: 0.4};
  const whole = fx.resonatorImpulse(rate, params), build = new fx.ResonatorImpulse(rate, params);
  let slices = 1; while (!build.step(5e5) && slices < 1000) slices++;
  assert.ok(slices < 1000, 'the build finishes: it never stops one body short');
  assert.ok(slices > 3, `the 135 bodies took ${slices} slices: the build is cut into pieces the page can breathe between`);
  assert.equal(build.bodies, 135, '45 to the octave over 3 octaves, none dropped');
  assert.deepEqual(build.data, whole, 'the sliced response is the whole one');
});

// ── the graph, wired ────────────────────────────────────────────────────────

/** An audio context that records its nodes and their edges (the shape of tests/native-expression-effects.test.mjs). As a browser does, it
 * refuses to part a node from one it is not joined to. */
function recording() {
  const nodes = [];
  const param = value => ({value, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }});
  const node = (kind, extra = {}) => {
    const n = {kind, out: new Set(), connect(target) { this.out.add(target); return target; },
      disconnect(target) {
        if (target === undefined) this.out.clear();
        else if (!this.out.delete(target)) throw new Error(`InvalidAccessError: the ${this.kind} is not connected to that ${target.kind}`);
      }, ...extra};
    nodes.push(n); return n;
  };
  const context = {sampleRate: 48000, currentTime: 0, destination: {kind: 'destination', out: new Set()},
    createGain: () => node('gain', {gain: param(1)}),
    createBiquadFilter: () => node('biquad', {type: 'lowpass', frequency: param(350), Q: param(1)}),
    createDynamicsCompressor: () => node('compressor', {threshold: param(-24), ratio: param(12), attack: param(.003), release: param(.25), knee: param(30)}),
    createDelay: max => node('delay', {max, delayTime: param(0)}),
    createConvolver: () => node('convolver', {buffer: null, normalize: true}),
    createBuffer: (channels, length, rate) => ({channels, length, rate, data: [], copyToChannel(d, c) { this.data[c] = d; }}),
  };
  return {context, nodes, of: kind => nodes.filter(n => n.kind === kind)};
}

test('the graph: the bank stands in the chain\'s order, its ringing joins only while it is on and on the chain, and a change of cut rebuilds after the edits pause', () => {
  const r = recording(), out = {kind: 'out', out: new Set()}, waiting = [];
  const defer = (run, ms) => { const entry = {run, ms}; waiting.push(entry); return () => { const at = waiting.indexOf(entry); if (at >= 0) waiting.splice(at, 1); }; };
  const settle = () => { while (waiting.length) waiting.shift().run(); };
  let state = law.initialEffects();
  const graph = new fx.PresentationEffects(r.context, out, state, defer);
  assert.deepEqual([...graph.input.out], [out], 'off every chain, the level joins the device');
  assert.equal(r.of('convolver').length, 1, 'only the reverb\'s room: no ringing is made for a bank that is not on the chain');
  state = law.editEffectChain(state, ['resonator', 'filter']); graph.apply(state);
  assert.equal(r.of('convolver').length, 2, 'on the chain and on, it has its ringing');
  const convolver = r.of('convolver')[1];
  assert.equal(convolver.normalize, false, 'the response is not renormalised: Tilt and Gain are the bank\'s own');
  assert.equal(convolver.buffer, null, 'the response is made off the call that asked for it');
  assert.equal(waiting.length, 1); assert.equal(waiting[0].ms, 0, 'the first one at once');
  settle();
  assert.equal(convolver.buffer.channels, 1);
  assert.equal(convolver.buffer.length, Math.ceil(1 * 1.25 * 48000) + 1, 'Decay 1 s, and its tail');
  // The order: the level, the bank, the filter, the device.
  const bankIn = [...graph.input.out][0], dry = [...bankIn.out].find(node => node !== convolver), wet = [...convolver.out][0], bankOut = [...dry.out][0];
  assert.ok(bankIn.out.has(convolver) && wet.out.has(bankOut), 'in → ringing → wet → out, beside in → dry → out');
  const filterIn = [...bankOut.out][0];
  assert.ok([...filterIn.out].some(node => [...node.out].some(next => next.kind === 'biquad')), 'the bank is followed by the filter');
  state = law.editEffectChain(state, ['filter', 'resonator']); graph.apply(state);
  assert.ok([...graph.input.out][0] === filterIn && bankOut.out.has(out), 'put after the filter: the bank is the last, into the device');
  // Mix and Gain act at once, and rebuild nothing.
  waiting.length = 0;
  state = law.editEffects(law.editEffects(state, 'resonator', 'mix', 30), 'resonator', 'gain', -6); graph.apply(state);
  near(dry.gain.value, 0.7, 1e-12, 'Mix 30 % leaves 70 % of the dry'); near(wet.gain.value, 0.3 * 10 ** (-6 / 20), 1e-12, 'and 30 % of the ringing, 6 dB down');
  assert.equal(waiting.length, 0, 'a change of Mix or Gain rebuilds nothing');
  // A change of cut, Span, root, Decay or Tilt rebuilds once the edits pause, for the last of them.
  for (const decay of [2, 3, 4]) { state = law.editEffects(state, 'resonator', 'decay', decay); graph.apply(state); }
  assert.equal(waiting.length, 1, 'one rebuild waits'); assert.equal(waiting[0].ms, 60, 'until the edits pause');
  const before = convolver.buffer;
  settle();
  assert.notEqual(convolver.buffer, before); assert.equal(convolver.buffer.length, Math.ceil(4 * 1.25 * 48000) + 1, 'made for the last Decay');
  state = law.editEffects(state, 'resonator', 'decay', 4); graph.apply(state);
  assert.equal(waiting.length, 0, 'the same settings make nothing again');
  // Off: nothing rings and nothing is spent; the input passes at full.
  state = law.editEffects(state, 'resonator', 'on', false); graph.apply(state);
  assert.ok(r.nodes.every(node => !node.out.has(convolver)), 'off: nothing feeds the ringing');
  assert.equal(dry.gain.value, 1); assert.equal(wet.gain.value, 0);
  state = law.editEffects(state, 'filter', 'cutoff', 2000);
  assert.doesNotThrow(() => graph.apply(state), 'an edit while the bank is off parts nothing twice');
  state = law.editEffects(state, 'resonator', 'on', true); state = law.editEffectChain(state, ['filter']); graph.apply(state);
  assert.ok(r.nodes.every(node => !node.out.has(convolver)), 'off the chain: nothing feeds the ringing');
  graph.dispose();
  assert.ok(r.nodes.every(node => node.out.size === 0), 'dispose takes the graph apart');
});

// ── the graph, in a real browser ────────────────────────────────────────────

for (const [engine, launcher] of [['Chromium', chromium], ['WebKit', webkit]]) {
  test(`${engine}: Off is the input exactly, Mix 0 the dry, Gain scales the ringing, each body rings at its pitch for Decay, Tilt is a slope`, async t => {
    const browser = await launcher.launch();
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>mr</title>');
    await page.addScriptTag({content: browserBundle});
    const r = await page.evaluate(async FALL60Source => {
      const FALL60 = new Function('RATE', `return ${FALL60Source}`)(48000);
      const {PresentationEffects, initialEffects, editEffects, editEffectChain, resonatorImpulse, convolverLeaksNyquist} = window.bank;
      const RATE = 48000;
      // The bank makes its first response once the page has measured the convolver; the renders below give it no time, so it is awaited.
      const leaks = await convolverLeaksNyquist();
      const state = (edits, chain = ['resonator']) => edits.reduce((s, [key, value]) => editEffects(s, 'resonator', key, value), editEffectChain(initialEffects(), chain));
      async function render(edits, signal, seconds, chain) {
        const context = new OfflineAudioContext(1, Math.round(seconds * RATE), RATE);
        const buffer = context.createBuffer(1, context.length, RATE), data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = signal(i);
        const source = context.createBufferSource(); source.buffer = buffer;
        const graph = new PresentationEffects(context, context.destination, state(edits, chain), run => { run(); return () => {}; });
        source.connect(graph.input); source.start(0);
        const t0 = performance.now();
        const out = (await context.startRendering()).getChannelData(0);
        return {input: data, out, ms: Math.round(performance.now() - t0)};
      }
      const sine = (hz, amp = 0.5) => i => amp * Math.sin(2 * Math.PI * hz * i / RATE);
      const impulse = i => (i === 0 ? 1 : 0);
      const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
      const rms = (d, from, to) => { let s = 0; for (let i = from; i < to; i++) s += d[i] * d[i]; return Math.sqrt(s / (to - from)); };
      const goertzel = (data, hz) => { const w = 2 * Math.PI * hz / RATE, k = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 0; i < data.length; i++) { const s = data[i] + k * s1 - s2; s2 = s1; s1 = s; } return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2); };
      const C3 = 130.81279;
      const fall60 = FALL60;
      const out = {convolverLeaksNyquist: leaks};
      { // Off is the input exactly; so is Mix 0; and a bank off every chain.
        const off = await render([['on', false]], sine(997), 0.25); out.offDiff = maxDiff(off.out, off.input);
        const mix0 = await render([['mix', 0]], sine(997), 0.25); out.mix0Diff = maxDiff(mix0.out, mix0.input);
        const nowhere = await render([], sine(997), 0.25, []); out.nowhereDiff = maxDiff(nowhere.out, nowhere.input); }
      { // A lone body (360° x 1, one octave, C), a sine at its pitch: it passes at its weight once settled; Gain scales the ringing in dB.
        const lone = [['division', 3600], ['span', 1], ['decay', 0.05], ['mix', 100]];
        const a = await render(lone, sine(C3, 0.5), 0.5), b = await render([...lone, ['gain', -12]], sine(C3, 0.5), 0.5), c = await render([...lone, ['mix', 50]], sine(C3, 0.5), 0.5);
        out.loneDb = 20 * Math.log10(rms(a.out, 24000 - 4800, 24000) / rms(a.input, 24000 - 4800, 24000));
        out.gainDb = 20 * Math.log10(rms(b.out, 24000 - 4800, 24000) / rms(a.out, 24000 - 4800, 24000));
        out.mixHalfDiff = maxDiff(c.out.slice(20000), Float32Array.from(a.out.slice(20000), (x, i) => 0.5 * x + 0.5 * a.input[20000 + i])); }
      { // The ring: an impulse through a lone body, its −60 dB time against Decay.
        out.rings = [];
        for (const decay of [0.05, 1, 10]) {
          const y = await render([['division', 3600], ['span', 1], ['decay', decay], ['mix', 100]], impulse, decay * 1.5 + 0.2);
          out.rings.push({decay, measured: fall60(y.out), ms: y.ms});
        } }
      { // A stereo sound (a reverb before the bank makes one) rings on its own sides: an impulse on the left alone.
        const context = new OfflineAudioContext(2, Math.round(0.275 * RATE), RATE);
        const buffer = context.createBuffer(2, context.length, RATE); buffer.getChannelData(0)[0] = 1;
        const source = context.createBufferSource(); source.buffer = buffer;
        const graph = new PresentationEffects(context, context.destination, state([['division', 3600], ['span', 1], ['decay', 0.05], ['mix', 100]]),
          run => { run(); return () => {}; });
        source.connect(graph.input); source.start(0);
        const y = await context.startRendering();
        out.stereo = {left: fall60(y.getChannelData(0)), rightPeak: y.getChannelData(1).reduce((m, x) => Math.max(m, Math.abs(x)), 0)}; }
      { // The pitches: an impulse through 30° x 12 at C and 24° x 15 at A rings at every body and at nothing between.
        out.pitches = [];
        for (const [division, parts, root] of [[300, 12, 0], [240, 15, 9], [3600, 1, 4]]) {
          const f0 = C3 * 2 ** (root / 12);
          const y = await render([['division', division], ['root', root], ['span', 1], ['decay', 4], ['mix', 100]], impulse, 4);
          const peaks = Array.from({length: parts}, (_, k) => goertzel(y.out, f0 * 2 ** (k / parts)));
          const valleys = parts === 1 ? [goertzel(y.out, f0 * 1.5)] : Array.from({length: parts - 1}, (_, k) => goertzel(y.out, f0 * 2 ** ((k + 0.5) / parts)));
          out.pitches.push({parts, weakestPeakOverStrongestValleyDb: 20 * Math.log10(Math.min(...peaks) / Math.max(...valleys))});
        } }
      { // Tilt: 30° x 12 over 2 octaves, Tilt 1: the highest body against the lowest, by the transform of the response at each.
        const y = await render([['span', 2], ['decay', 6], ['tilt', 1], ['mix', 100]], impulse, 6);
        out.tiltDb = 20 * Math.log10(goertzel(y.out, C3 * 2 ** (23 / 12)) / goertzel(y.out, C3)); }
      { // The cost: 10 s of noise through 24 bodies (the default), 180 (8° x 45 over 4 octaves) and 1440 (1° x 360 over 4), Decay 1 s.
        const noise = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return (a / 4294967296 * 2 - 1) * 0.1; }; })();
        const samples = Float32Array.from({length: RATE * 10}, noise);
        out.cost = [];
        for (const [name, edits] of [['30° x 12, 2 oct = 24', [['mix', 100]]], ['8° x 45, 4 oct = 180', [['division', 80], ['span', 4], ['mix', 100]]], ['1° x 360, 4 oct = 1440', [['division', 10], ['span', 4], ['mix', 100]]]]) {
          const b0 = performance.now(); resonatorImpulse(RATE, {root: 0, division: edits.find(e => e[0] === 'division')?.[1] ?? 300, span: edits.find(e => e[0] === 'span')?.[1] ?? 2, decay: 1, tilt: 0});
          const build = Math.round(performance.now() - b0);
          const y = await render(edits, i => samples[i], 10);
          out.cost.push({name, impulseBuildMs: build, renderMsFor10sAudio: y.ms});
        } }
      return out;
    }, fall60.toString());
    console.log(`${engine} measured: ${JSON.stringify(r)}`);
    assert.equal(r.offDiff, 0, 'On = Off: the output is the input, exactly');
    assert.equal(r.nowhereDiff, 0, 'off every chain: the output is the input, exactly');
    assert.ok(r.mix0Diff < 1e-7, `Mix 0 is the dry: ${r.mix0Diff}`);
    near(r.loneDb, 0, 0.05, `${engine}: a lone body passes a sine at its pitch at its weight (0 dB)`);
    near(r.gainDb, -12, 0.01, `${engine}: Gain −12 dB lowers the ringing by 12 dB`);
    assert.ok(r.mixHalfDiff < 1e-6, `Mix 50 % is half the ringing and half the dry: ${r.mixHalfDiff}`);
    for (const ring of r.rings) {
      assert.ok(ring.measured !== null, `Decay ${ring.decay}: the ringing falls 60 dB inside the render`);
      near(ring.measured / ring.decay, 1, 0.05, `${engine}: Decay ${ring.decay} s rings 60 dB down in ${ring.measured} s`);
    }
    assert.ok(r.stereo.left !== null, 'a stereo sound: its left side falls 60 dB inside the render');
    near(r.stereo.left / 0.05, 1, 0.05, `${engine}: a stereo sound's left side rings 60 dB down in ${r.stereo.left} s, Decay 0.05 s`);
    assert.equal(r.stereo.rightPeak, 0, `${engine}: and its silent right side stays silent`);
    for (const pitch of r.pitches) assert.ok(pitch.weakestPeakOverStrongestValleyDb > 15, `${engine}: ${pitch.parts} to the octave, every body rings over every gap: ${pitch.weakestPeakOverStrongestValleyDb.toFixed(1)} dB`);
    near(r.tiltDb, 11.54, 0.5, `${engine}: Tilt 1 lifts the highest of two octaves 11.5 dB over the lowest`);
    for (const row of r.cost) assert.ok(row.renderMsFor10sAudio < 10000, `${engine}: ${row.name} renders 10 s of audio in ${row.renderMsFor10sAudio} ms, faster than it plays`);
  });
}
