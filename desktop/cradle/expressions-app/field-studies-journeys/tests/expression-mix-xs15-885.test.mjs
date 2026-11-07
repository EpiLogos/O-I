// O-I #747 round 885, XS15's limits (DLW build ruling 2026-11-06, the lead's), as the frame hears them. The manual's mixer row (DLW.md
// §20.1): "Volume | The level of the Expression's sound"; "Activator | The Expression plays, or it does not"; "Solo | Lets you hear only
// this Expression's sound"; "Its sound goes to the Main track". So:
//
//   - the frame takes the Expression's Volume, Main and Activator from its document (setExpressionMix, on each load and change), never
//     from a stage command; a mixer that says more than the law is not taken;
//   - Solo of another Expression and the frame's "Mute all object sound here" (the Field's Sound, "Lets the field sound. The picture stays
//     when sound is off", §20.2) are what is heard here: each silences the Expression's sound, neither is saved, and neither reads as the
//     Activator, nor the Activator as them;
//   - everything the Expression sounds is heard at level × Main, or not at all: the symbols' voices by their gain rule, and the Torus
//     through the controller's mix stage, after its effects and before the device. The voices' tap stays before that stage, so a voice is
//     not levelled twice.
//
// SCRIPTED: the sources are bundled with the app's own esbuild; the audio context is the controlled fixture's, inert — no device is
// opened and nothing sounds.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'expression-mix-885-'));
after(() => rmSync(out, {recursive: true, force: true}));
const cache = new Map();
const bundle = (entry, name) => {
  if (!cache.has(name)) cache.set(name, (async () => {
    const outfile = join(out, `${name}.mjs`);
    await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
      loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
    return import(pathToFileURL(outfile).href);
  })());
  return cache.get(name);
};
const sound = () => bundle(join(journeys, 'src/native-field/entitySound.ts'), 'entitySound');
const stage = () => bundle(join(journeys, 'src/stageCommands.ts'), 'stage');
const fixture = () => import(pathToFileURL(join(journeys, '../../tests/native-expression-fixture.mjs')).href);

test('the frame takes the Expression\'s mixer from its document: a change is heard once, a mixer past the law is not taken', async () => {
  const s = await sound();
  const heard = [];
  const stop = s.onObjectSoundMuted(() => heard.push(s.expressionMixReading()));
  try {
    assert.deepEqual(s.expressionMixReading(), {level: 1, main: 1, active: true}, 'before any document: unity, unity, on');
    assert.equal(s.setExpressionMix({level: 0.5, active: false}), null);
    assert.deepEqual(s.expressionMixReading(), {level: 0.5, main: 1, active: false});
    assert.deepEqual(s.objectSoundLevels(), {level: 0.5, main: 1}, 'the levels the voices are heard at');
    assert.equal(s.setExpressionMix({level: 0.5, active: false}), null);
    assert.equal(heard.length, 1, 'the same mixer again is no change');
    assert.equal(s.setExpressionMix({level: 3}), 'A sound level runs from silence to +6 dB.');
    assert.deepEqual(s.expressionMixReading(), {level: 0.5, main: 1, active: false}, 'refused: the mixer stands as it was');
    assert.equal(s.setExpressionMix(undefined), null);
    assert.deepEqual(s.expressionMixReading(), {level: 1, main: 1, active: true}, 'a document that keeps none: the defaults');
    assert.equal(heard.length, 2);
    assert.equal(typeof s.setObjectSoundLevels, 'undefined', 'no command sets the levels apart from the document');
  } finally { stop(); s.setExpressionMix(undefined); }
});

test('Solo, the mute here and the Activator are three states: each silences the Expression\'s sound, none reads as another', async () => {
  const s = await sound();
  try {
    assert.equal(s.expressionSilencedHere(), false);
    s.setSoloSilenced(true);
    assert.deepEqual([s.expressionSilencedHere(), s.objectSoundIsMuted(), s.expressionMixReading().active], [true, false, true], 'another soloed: silent here, the Activator on');
    s.setSoloSilenced(false); s.setObjectSoundMuted(true);
    assert.deepEqual([s.expressionSilencedHere(), s.soloSilencedHere(), s.expressionMixReading().active], [true, false, true], 'muted here: silent, the Activator on');
    s.setObjectSoundMuted(false); s.setExpressionMix({active: false});
    assert.deepEqual([s.expressionSilencedHere(), s.objectSoundIsMuted(), s.soloSilencedHere()], [true, false, false], 'switched off: silent, nothing muted or soloed');
    s.setExpressionMix({active: true});
    assert.equal(s.expressionSilencedHere(), false);
  } finally { s.setSoloSilenced(false); s.setObjectSoundMuted(false); s.setExpressionMix(undefined); }
});

test('everything the Expression sounds is heard at level × Main, or not at all: the voices\' rule and the Torus\'s gain are one', async () => {
  const s = await sound();
  const mix = {level: 0.5, main: 2, active: true};
  assert.equal(s.expressionGain(mix, false), 1);
  assert.equal(s.expressionGain({...mix, level: 0.25}, false), 0.5);
  assert.equal(s.expressionGain({...mix, active: false}, false), 0, 'switched off');
  assert.equal(s.expressionGain(mix, true), 0, 'silenced here');
  assert.equal(s.soundingGain(0.8, false, mix), 0.8, 'a voice: its gain × level × Main');
  const torus = [];
  const stop = s.onExpressionGain(gain => torus.push(gain));
  try {
    assert.deepEqual(torus, [1], 'told at once');
    s.setExpressionMix({level: 0.5, main: 0.5});
    s.setSoloSilenced(true); s.setSoloSilenced(false);
    s.setObjectSoundMuted(true); s.setObjectSoundMuted(false);
    s.setExpressionMix({level: 0.5, main: 0.5, active: false});
    assert.deepEqual(torus, [1, 0.25, 0, 0.25, 0, 0.25, 0]);
  } finally { stop(); s.setSoloSilenced(false); s.setObjectSoundMuted(false); s.setExpressionMix(undefined); }
});

test('the frame\'s `sound` command says what is heard here — the mute here and another\'s Solo — and nothing of the document\'s mixer', async () => {
  const {readStageRequest} = await stage();
  const read = raw => readStageRequest({v: 1, kind: 'host-command', req: 3, command: 'sound', ...raw});
  assert.deepEqual(read({silenced: true}), {req: 3, command: {command: 'sound', silenced: true}});
  assert.deepEqual(read({muted: false}), {req: 3, command: {command: 'sound', muted: false}});
  assert.deepEqual(read({muted: true, silenced: false}), {req: 3, command: {command: 'sound', muted: true, silenced: false}});
  for (const bad of [{}, {level: 0.5}, {main: 1}, {active: false}, {silenced: 'yes'}, {muted: true, level: 1}])
    assert.equal(read(bad), null, JSON.stringify(bad));
});

test('the Torus passes the mix stage after its effects, before the device; the voices\' tap stays before it', async () => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await bundle(join(journeys, 'src/native-field/controller.ts'), 'controller');
  class Recording extends ControlledAudio {
    created = [];
    createGain() { const node = {kind: 'gain', gain: {value: 1, setValueAtTime(v) { this.value = v; }}, out: new Set(), connect(t) { this.out.add(t); return t; }, disconnect() {}}; this.created.push(node); return node; }
  }
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const audio = new Recording(), c = new NativeFieldController(new ControlledSceneOwner(), renderer, () => audio);
  c.setMix(0.5);
  assert.equal(c.reading.expression_mix.gain, 0.5, 'taken while nothing is open: heard when the instrument opens');
  assert.throws(() => c.setMix(4.5), /The Expression's sound is heard from silence to \+12 dB \(level × Main\)\./);
  assert.throws(() => c.setMix(NaN), /level × Main/);
  await c.compose({sky: 'none'});
  try {
    const [level, mix] = audio.created;
    assert.equal(mix.gain.value, 0.5, 'opened at the mix it was given');
    assert.ok(mix.out.has(audio.destination), 'the mix stage feeds the device');
    assert.equal(level.out.has(audio.destination), false, 'the Torus reaches the device only through it');
    const tap = c.voiceTap().input;
    assert.ok(level.out.has(tap), 'the voices listen before the mix stage: their own rule levels them once');
    assert.equal(mix.out.has(tap), false);
    c.setMix(0);
    assert.equal(mix.gain.value, 0); assert.equal(c.reading.expression_mix.gain, 0);
  } finally { await c.dispose(); }
});
