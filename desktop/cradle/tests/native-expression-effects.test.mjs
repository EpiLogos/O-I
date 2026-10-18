// The torus's four effects (manual §21.5), owner side: their law (native-field/effectsLaw.ts), the graph that sounds them after the
// controller's level in the chain's order (native-field/presentationEffects.ts), and the controller's operations and reading
// (controller.ts setEffect, setEffectChain, `presentation_effects`). The graph runs on a recording audio context here: what is wired to what, and what each parameter holds.
// That the wired graph sounds as the law says is native-expression-effects-browser.mjs, in a real browser's offline context.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three';
import {ControlledAudio, ControlledSceneOwner} from './native-expression-fixture.mjs';

const src = resolve('expressions-app/field-studies-journeys/src');
const temp = await mkdtemp(join(tmpdir(), 'native-effects-tests-'));
await build({entryPoints: [join(src, 'native-field/controller.ts'), join(src, 'native-field/effectsLaw.ts'), join(src, 'native-field/presentationEffects.ts')],
  bundle: true, platform: 'node', format: 'esm', outdir: temp, outExtension: {'.js': '.mjs'}});
const {NativeFieldController} = await import(pathToFileURL(join(temp, 'controller.mjs')));
const law = await import(pathToFileURL(join(temp, 'effectsLaw.mjs')));
const {PresentationEffects, reverbImpulse, compressorOwnMakeupDb} = await import(pathToFileURL(join(temp, 'presentationEffects.mjs')));
test.after(() => rm(temp, {recursive: true, force: true}));

/** An audio context that records its nodes, their edges and their parameters. */
function recording() {
  const nodes = [];
  const param = value => ({value, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }});
  const node = (kind, extra = {}) => {
    const n = {kind, out: new Set(), connect(target) { this.out.add(target); return target; },
      disconnect(target) { if (target === undefined) this.out.clear(); else this.out.delete(target); }, ...extra};
    nodes.push(n); return n;
  };
  const context = {sampleRate: 48000, currentTime: 0, destination: {kind: 'destination', out: new Set()},
    createGain: () => node('gain', {gain: param(1)}),
    createBiquadFilter: () => node('biquad', {type: 'lowpass', frequency: param(350), Q: param(1)}),
    createDynamicsCompressor: () => node('compressor', {threshold: param(-24), ratio: param(12), attack: param(.003), release: param(.25), knee: param(30)}),
    createDelay: max => node('delay', {max, delayTime: param(0)}),
    createConvolver: () => node('convolver', {buffer: null, normalize: false}),
    createBuffer: (channels, length, rate) => ({channels, length, rate, data: [], copyToChannel(d, c) { this.data[c] = d; }}),
  };
  const of = kind => nodes.filter(n => n.kind === kind);
  const into = target => nodes.filter(n => n.out.has(target));
  return {context, nodes, of, into};
}

/** The graph's parts, found by their edges, not by their order of making: each effect's module, its way in and its way out. */
function parts(r) {
  const one = list => { assert.equal(list.length, 1); return list[0] }
  const first = node => [...node.out][0]
  const sixes = r.of('delay').filter(n => n.max === 6), pre = one(r.of('delay').filter(n => n.max === 0.3))
  const tone = one(r.of('biquad').filter(b => sixes.some(d => d.out.has(b)))), biquad = one(r.of('biquad').filter(b => b !== tone))
  const loop = one(sixes.filter(d => r.into(d).some(g => r.into(g).includes(tone)))), line = one(sixes.filter(d => d !== loop))
  const drive = one(r.into(biquad)), filterIn = one(r.into(drive)), filterWet = first(biquad), filterOut = first(filterWet)
  const filter = {in: filterIn, out: filterOut, biquad, drive, wet: filterWet, dry: [...filterIn.out].find(n => n !== drive)}
  const compressor = one(r.of('compressor')), convolver = one(r.of('convolver'))
  const makeup = first(compressor), dynWet = first(makeup), dynOut = first(dynWet), dynDry = r.into(dynOut).find(n => n !== dynWet), dynIn = one(r.into(compressor))
  const send = one(r.into(line).filter(n => n.kind === 'gain')), delayIn = one(r.into(send))
  const feedback = [...tone.out].find(n => n.out.has(loop)), delayWet = [...tone.out].find(n => n !== feedback), delayOut = first(delayWet)
  const reverbWet = first(convolver), reverbOut = first(reverbWet), reverbDry = r.into(reverbOut).find(n => n !== reverbWet), reverbIn = one(r.into(reverbDry))
  assert.ok(delayIn.out.has(delayOut), 'the delay\'s dry path is at full')
  return {filter, compressor, makeup, dynWet, dynDry, line, loop, tone, send, feedback, delayWet, pre, convolver, reverbWet, reverbDry,
    modules: {filter: filter, dynamics: {in: dynIn, out: dynOut}, delay: {in: delayIn, out: delayOut}, reverb: {in: reverbIn, out: reverbOut}}}
}
/** The path from the level to the output, through the modules' ways in and out. */
function path(graph, p, out) {
  const names = [], seen = new Set()
  let at = graph.input
  while (at !== out) {
    assert.equal(at.out.size, 1, 'one way on'); const next = [...at.out][0]
    if (next === out) break
    const name = Object.keys(p.modules).find(key => p.modules[key].in === next)
    assert.ok(name && !seen.has(name), `into a module, once: ${next.kind} after ${names.join(' → ') || 'the level'}`); names.push(name); seen.add(name); at = p.modules[name].out
  }
  return names
}
const all = ['filter', 'dynamics', 'delay', 'reverb']

test('the chain opens empty; each effect stands on at first, every parameter at its initial value inside its law', () => {
  const state = law.initialEffects();
  assert.deepEqual(Object.keys(state), ['chain', 'filter', 'dynamics', 'delay', 'reverb']);
  assert.deepEqual(state.chain, [], 'nothing stands after the torus until you put it there');
  for (const effect of law.PRESENTATION_EFFECTS) {
    assert.equal(state[effect].on, true, `${effect}: On, as the manual's defaults say`);
    for (const [key, value] of Object.entries(state[effect])) assert.equal(law.effectRefusal(effect, key, value), null, `${effect}.${key}`);
  }
  assert.deepEqual(law.readEffectsState(state), state, 'a reading of it is the same state');
  assert.deepEqual(state.filter, {on: true, type: 'lowpass', cutoff: 8000, resonance: 20, drive: 0, mix: 100});
  assert.deepEqual(state.delay, {on: true, sync: true, division: '1/8', time: 250, feedback: 35, tone: 6000, mix: 25, tempo: 120});
});

test('an edit is refused in the owner\'s words and the state it was given stands', () => {
  const state = law.initialEffects();
  assert.throws(() => law.editEffects(state, 'dynamics', 'release', 2000), /Dynamics release goes from 5 to 1000 ms: the compressor the torus sounds through releases within a second/);
  assert.throws(() => law.editEffects(state, 'filter', 'type', 'comb'), /Filter type is one of lowpass, highpass, bandpass, notch/);
  assert.throws(() => law.editEffects(state, 'delay', 'feedback', 99), /Delay feedback goes from 0 to 95 %/);
  assert.throws(() => law.editEffects(state, 'reverb', 'width', 1), /Reverb has no parameter width; it has on, size, decay, damping, predelay, mix/);
  assert.throws(() => law.editEffects(state, 'chorus', 'on', true), /the torus has no such effect/);
  assert.throws(() => law.editEffects(state, 'filter', 'on', 'yes'), /Filter on takes on or off/);
  const next = law.editEffects(state, 'filter', 'cutoff', 900);
  assert.equal(next.filter.cutoff, 900); assert.equal(state.filter.cutoff, 8000, 'the given state is unchanged');
  assert.equal(next.delay, state.delay, 'the other effects are the same objects');
  const placed = law.editEffectChain(next, ['reverb', 'filter']);
  assert.deepEqual(placed.chain, ['reverb', 'filter']); assert.equal(placed.filter, next.filter, 'placing keeps the settings');
  assert.throws(() => law.editEffectChain(next, ['filter', 'filter']), /Each effect stands on the chain at most once/);
  assert.throws(() => law.editEffectChain(next, ['phaser']), /phaser: the torus has no such effect/);
  assert.deepEqual(next.chain, [], 'a refused chain changes nothing');
});

test('the wire takes typed operands and leaves the range to the owner; a reading is checked whole', () => {
  assert.deepEqual(law.readEffectOperands({effect: 'reverb', key: 'decay', value: 99}), {effect: 'reverb', key: 'decay', value: 99});
  assert.equal(law.readEffectOperands({effect: 'reverb', key: 'decay', value: '2'}), null);
  assert.equal(law.readEffectOperands({effect: 'reverb', key: 'colour', value: 2}), null);
  const state = law.editEffectChain(law.editEffects(law.initialEffects(), 'reverb', 'on', false), ['delay', 'reverb']);
  assert.deepEqual(law.readEffectsState(JSON.parse(JSON.stringify(state))), state);
  assert.match(law.readEffectsState({...state, chain: ['delay', 'delay']}), /^chain: Each effect stands on the chain at most once/);
  assert.match(law.readEffectsState({...state, chain: undefined}), /^chain: The chain is a list of effects/);
  assert.match(law.readEffectsState({...state, delay: {...state.delay, tempo: 400}}), /^delay\.tempo: Delay tempo goes from 40 to 300 BPM/);
  assert.match(law.readEffectsState({chain: [], filter: state.filter}), /^dynamics: expected its parameters/);
});

test('the delay\'s time is the note length at its tempo when synced, its own time when not; the filter\'s Q is the design\'s', () => {
  const delay = law.initialEffects().delay;
  assert.equal(law.delaySeconds(delay), 0.25, 'an eighth at 120');
  assert.equal(law.delaySeconds({...delay, division: '1', tempo: 60}), 4, 'a bar at 60');
  assert.equal(law.delaySeconds({...delay, sync: false, time: 900}), 0.9);
  assert.ok(Math.abs(law.filterQ('lowpass', 0) - -3.0103) < 1e-3, 'a low-pass rings to −3 dB at 0 %');
  assert.ok(Math.abs(law.filterQ('highpass', 100) - 20.9897) < 1e-3, '+21 dB at 100 %');
  assert.ok(Math.abs(law.filterQ('bandpass', 0) - Math.SQRT1_2) < 1e-9, 'a band-pass Q is the plain factor');
});

test('the room falls 60 dB in Decay, its bright part faster with Damping, and the same settings make the same room', () => {
  const rate = 8000, decay = 1.5
  const [left, right] = reverbImpulse(rate, 50, decay, 0);
  assert.equal(left.length, Math.ceil((decay * 1.1 + 0.05) * rate));
  assert.deepEqual(reverbImpulse(rate, 50, decay, 0)[0], left, 'seeded');
  assert.notDeepEqual(left, right, 'two channels, two noises');
  const rms = (data, from, to) => Math.sqrt(data.slice(from, to).reduce((s, x) => s + x * x, 0) / (to - from));
  const early = rms(left, Math.round(0.1 * rate), Math.round(0.15 * rate)), late = rms(left, Math.round((decay - 0.05) * rate), Math.round((decay + 0.05) * rate));
  const fall = 20 * Math.log10(late / early);
  assert.ok(fall < -48 && fall > -62, `about 60 dB down over the decay less 0.1 s: ${fall.toFixed(1)} dB`);
  // Damping, at the device's rate: what changes sample to sample (the bright part) is far less at half the decay in a damped room.
  const device = 48000, highs = data => { let s = 0; const from = Math.round(decay / 2 * device), to = from + 4000; for (let i = from + 1; i < to; i++) s += (data[i] - data[i - 1]) ** 2; return s }
  assert.ok(highs(reverbImpulse(device, 50, decay, 100)[0]) < highs(reverbImpulse(device, 50, decay, 0)[0]) / 10, 'a damped room is darker');
});

test('an empty chain joins the level to the device; the chain\'s order is the path the sound takes, and a new order rewires it', () => {
  const r = recording(), out = {kind: 'out', out: new Set()};
  let state = law.initialEffects();
  const graph = new PresentationEffects(r.context, out, state, () => () => {});
  const p = parts(r);
  assert.deepEqual([...graph.input.out], [out], 'nothing between the level and the device');
  assert.equal(p.convolver.buffer, null, 'no room is made for a reverb off the chain');
  state = law.editEffectChain(state, ['reverb', 'filter']); graph.apply(state);
  assert.deepEqual(path(graph, p, out), ['reverb', 'filter']); assert.ok(p.modules.filter.out.out.has(out));
  assert.ok(p.modules.reverb.in.out.has(p.pre), 'the room joins once its reverb sounds'); assert.ok(p.convolver.buffer, 'and its room is made');
  state = law.editEffectChain(state, ['filter', 'dynamics', 'delay']); graph.apply(state);
  assert.deepEqual(path(graph, p, out), ['filter', 'dynamics', 'delay']);
  assert.equal(p.modules.reverb.in.out.has(p.pre), false, 'off the chain, the room leaves the path');
  assert.equal(p.modules.reverb.out.out.size, 0, 'and the reverb leads nowhere');
  const back = law.editEffectChain(state, []); graph.apply(back);
  assert.deepEqual([...graph.input.out], [out], 'the last effect taken off: the level joins the device again');
  assert.equal(p.modules.delay.out.out.size, 0, 'and no module leads anywhere');
  graph.apply(state);
  const edges = r.nodes.reduce((n, node) => n + node.out.size, 0);
  state = law.editEffects(state, 'filter', 'cutoff', 500); graph.apply(state);
  assert.equal(r.nodes.reduce((n, node) => n + node.out.size, 0), edges, 'a parameter edit rewires nothing');
});

test('on the chain but off, every effect passes its input: the dry paths at full, the effect paths silent, the room disconnected', () => {
  const r = recording(), out = {kind: 'out', out: new Set()};
  let state = law.editEffectChain(law.initialEffects(), all);
  for (const effect of all) state = law.editEffects(state, effect, 'on', false);
  const graph = new PresentationEffects(r.context, out, state, () => () => {});
  const p = parts(r);
  assert.deepEqual(path(graph, p, out), all);
  assert.equal(p.filter.dry.gain.value, 1); assert.equal(p.filter.wet.gain.value, 0);
  assert.equal(p.dynDry.gain.value, 1); assert.equal(p.dynWet.gain.value, 0);
  assert.equal(p.send.gain.value, 0); assert.equal(p.delayWet.gain.value, 0);
  assert.equal(p.reverbDry.gain.value, 1); assert.equal(p.reverbWet.gain.value, 0);
  assert.equal(p.modules.reverb.in.out.has(p.pre), false, 'an off reverb is not on the path');
  assert.equal(p.convolver.buffer, null, 'no room is made for an off reverb');
});

test('on, each effect holds the law\'s values: the filter\'s blend and Q, the compressor\'s hard knee, the delay\'s loop, the room', () => {
  const r = recording(), out = {kind: 'out', out: new Set()}, deferred = [];
  let state = law.initialEffects();
  const graph = new PresentationEffects(r.context, out, state, run => { deferred.push(run); return () => deferred.splice(deferred.indexOf(run), 1); });
  const p = parts(r);
  state = law.editEffectChain(state, all); graph.apply(state);
  for (const [effect, key, value] of [['filter', 'type', 'bandpass'], ['filter', 'cutoff', 900], ['filter', 'resonance', 70], ['filter', 'drive', 6], ['filter', 'mix', 80],
    ['dynamics', 'threshold', -30], ['dynamics', 'ratio', 12], ['dynamics', 'attack', 30], ['dynamics', 'release', 800], ['dynamics', 'makeup', 9],
    ['delay', 'sync', false], ['delay', 'time', 900], ['delay', 'feedback', 70], ['delay', 'tone', 900], ['delay', 'mix', 40]]) { state = law.editEffects(state, effect, key, value); graph.apply(state); }
  assert.equal(p.filter.biquad.type, 'bandpass'); assert.equal(p.filter.biquad.frequency.value, 900);
  assert.ok(Math.abs(p.filter.biquad.Q.value - Math.SQRT1_2 * 10 ** 0.84) < 1e-9);
  assert.ok(Math.abs(p.filter.drive.gain.value - 10 ** (6 / 20)) < 1e-9);
  assert.ok(Math.abs(p.filter.dry.gain.value - 0.2) < 1e-9); assert.equal(p.filter.wet.gain.value, 0.8);
  assert.equal(p.compressor.knee.value, 0); assert.equal(p.compressor.threshold.value, -30); assert.equal(p.compressor.ratio.value, 12);
  assert.equal(p.compressor.attack.value, 0.03); assert.equal(p.compressor.release.value, 0.8);
  assert.equal(compressorOwnMakeupDb(-30, 12), 16.5, 'the browser\'s own makeup: 0.6 of the 27.5 dB a full-level input loses');
  assert.ok(Math.abs(p.makeup.gain.value - 10 ** ((9 - 16.5) / 20)) < 1e-9, 'the makeup stage takes it back, then adds Makeup');
  assert.equal(p.dynDry.gain.value, 0); assert.equal(p.dynWet.gain.value, 1);
  assert.equal(p.line.delayTime.value, 0.9); assert.equal(p.tone.frequency.value, 900); assert.equal(p.feedback.gain.value, 0.7);
  assert.ok(p.feedback.out.has(p.loop) && p.loop.out.has(p.tone), 'the repeats feed back through the loop\'s own line');
  assert.ok(Math.abs(p.loop.delayTime.value - (0.9 - 128 / 48000)) < 1e-12, 'one render quantum shorter: the cycle adds it back');
  assert.equal(p.send.gain.value, 1); assert.equal(p.delayWet.gain.value, 0.4);
  assert.ok(p.modules.reverb.in.out.has(p.pre), 'the room joins the path');
  assert.equal(p.convolver.buffer.length, Math.ceil((2.4 * 1.1 + 0.05) * 48000), 'the first room is made at once');
  assert.ok(Math.abs(p.reverbDry.gain.value - 0.78) < 1e-9); assert.equal(p.reverbWet.gain.value, 0.22); assert.equal(p.pre.delayTime.value, 0.02);
  // A dial's drag: the room is made once the edits pause, for the last settings.
  for (const decay of [3, 4, 5]) { state = law.editEffects(state, 'reverb', 'decay', decay); graph.apply(state); }
  assert.equal(deferred.length, 1, 'one room waits'); deferred[0]();
  assert.equal(p.convolver.buffer.length, Math.ceil((5 * 1.1 + 0.05) * 48000));
  state = law.editEffects(state, 'reverb', 'on', false); graph.apply(state);
  assert.equal(p.modules.reverb.in.out.has(p.pre), false); assert.equal(p.reverbDry.gain.value, 1);
  graph.dispose();
  assert.ok(r.nodes.every(n => n.out.size === 0), 'dispose takes the graph apart');
});

function renderer() {
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), sets: 0, setTargetTextures(a, b) { this.actualA = a; this.actualB = b; this.sets++; }};
  return {port, native: false, retainedTopology() { return {tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}; }, retainedTargetPort() { return port; },
    setNativeDomain(v) { this.native = v; }, releaseRetainedField() {}, onRetainedRecoveryRequired() { return () => {}; },
    checkpointRetainedField() { return {schema: 'test', receipt: {}, width: 2, height: 2}; }, restoreRetainedField() {}};
}

test('the controller takes an effect edit, refuses one outside the law in words, and keeps the state across an instrument\'s lifetime', async () => {
  const owner = new ControlledSceneOwner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer(), () => audio);
  try {
    assert.deepEqual(c.reading.presentation_effects, law.initialEffects(), 'readable before any instrument opens');
    c.setEffectChain(['delay']); c.setEffect('delay', 'on', false);
    assert.deepEqual(c.reading.presentation_effects.chain, ['delay'], 'taken with no instrument open: it sounds when one opens');
    assert.throws(() => c.setEffectChain(['delay', 'delay']), /at most once/);
    await c.compose({sky: 'none'});
    assert.equal(c.status, 'following');
    c.setEffect('reverb', 'decay', 6);
    assert.equal(c.reading.presentation_effects.reverb.decay, 6);
    assert.throws(() => c.setEffect('reverb', 'decay', 60), /Reverb decay goes from 0.2 to 20 s/);
    assert.equal(c.reading.presentation_effects.reverb.decay, 6, 'a refusal changes nothing');
    assert.ok(c.reading.presentation_owned.includes('presentation effects'));
    await c.release();
    assert.equal(c.reading.presentation_effects.delay.on, false, 'the state outlives the lifetime, as the level does');
    assert.deepEqual(c.reading.presentation_effects.chain, ['delay']);
  } finally { await c.dispose(); }
});
