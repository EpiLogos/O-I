// ME1 (DLW §20.2 Field, §20.14 Resonance): the plate follows the torus. The Frequency driver gains Torus (the default of a new scene) and
// the Field gains a Key source (Torus · Sky · Manual, default Torus). Under Torus the plate's drive is the pitches of the voices the
// torus plays now, read from the native owner's own reading; the frame never makes a frequency up.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/me1-torus-drive.test.mjs
//
// The sources are TypeScript: each test bundles what it needs once with the app's own esbuild into a temporary directory (as
// src/engine/psg-form-sampler.test.mjs does), so it never depends on the shared build/ folder another session may be rebuilding.
// The GPU engine cannot run here; the drive is therefore proved on the pure module the engine calls (torusDrive.ts), on the resonator
// it steps (cymaticResonator.ts), and on the frame's reading of the owner (torusPlay.mjs).
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
const engine = fileURLToPath(new URL('../../src/engine/', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'me1-torus-'));
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
const model = () => bundle(join(journeys, 'src/model.ts'), 'model');
const bridge = () => bundle(join(journeys, 'src/nativeBridge.ts'), 'bridge');
const drive = () => bundle(join(engine, 'torusDrive.ts'), 'drive');
const resonator = () => bundle(join(engine, 'cymaticResonator.ts'), 'resonator');
const play = () => import(new URL('../src/native-field/torusPlay.mjs', import.meta.url));

const near = (a, b, tolerance = 1e-9, label = '') => assert.ok(Math.abs(a - b) <= tolerance, `${label} ${a} vs ${b}`);

// ---------------------------------------------------------------------------------------------------- the model

test('a new scene is driven by the torus and takes its key from the torus', async () => {
  const {blankScene, blankJourney, validateJourney} = await model();
  const scene = blankScene();
  assert.equal(scene.composition.frequencyDriver, 'torus');
  assert.equal(scene.composition.keySource, 'torus');
  const journey = validateJourney(JSON.parse(JSON.stringify(blankJourney())));
  assert.equal(journey.scenes[0].composition.frequencyDriver, 'torus');
  assert.equal(journey.scenes[0].composition.keySource, 'torus');
});

test('the validator takes every driver and key the manual names and refuses any it does not know', async () => {
  const {blankJourney, validateJourney} = await model();
  const withComposition = patch => { const journey = JSON.parse(JSON.stringify(blankJourney())); Object.assign(journey.scenes[0].composition, patch); return journey; };
  for (const frequencyDriver of ['torus', 'manual', 'focus', 'automation']) assert.doesNotThrow(() => validateJourney(withComposition({frequencyDriver})), frequencyDriver);
  for (const keySource of ['torus', 'sky', 'manual']) assert.doesNotThrow(() => validateJourney(withComposition({keySource})), keySource);
  assert.throws(() => validateJourney(withComposition({frequencyDriver: 'bogus'})), /Invalid composition/);
  assert.throws(() => validateJourney(withComposition({keySource: 'bogus'})), /Invalid composition/);
  assert.throws(() => validateJourney(withComposition({keySource: 7})), /Invalid composition/);
  const withDrive = resonanceDrive => { const journey = JSON.parse(JSON.stringify(blankJourney())); journey.scenes[0].resonanceDrive = resonanceDrive; return journey; };
  assert.doesNotThrow(() => validateJourney(withDrive({kind: 'torus', keySource: 'sky'})));
  assert.doesNotThrow(() => validateJourney(withDrive({kind: 'torus'})));
  assert.throws(() => validateJourney(withDrive({kind: 'torus', keySource: 'bogus'})), /resonance/i);
  assert.throws(() => validateJourney(withDrive({kind: 'bogus'})), /resonance/i);
});

test('a scene saved with a driver reloads with that driver, and a key it never carried is not written into it', async () => {
  const {blankJourney, validateJourney} = await model();
  for (const frequencyDriver of ['manual', 'focus', 'automation']) {
    const journey = blankJourney();
    journey.scenes[0].composition.frequencyDriver = frequencyDriver;
    delete journey.scenes[0].composition.keySource;
    const reloaded = validateJourney(JSON.parse(JSON.stringify(journey)));
    assert.equal(reloaded.scenes[0].composition.frequencyDriver, frequencyDriver, `${frequencyDriver} reloads ${frequencyDriver}`);
    assert.equal('keySource' in reloaded.scenes[0].composition, false, 'a scene saved before the key existed gains none');
  }
});

// ---------------------------------------------------------------------------------------------------- the native round trip

test('the engine config names the torus drive with its key, and a manual scene still names the frequency drive', async () => {
  const {blankScene} = await model();
  const {toNativeConfig} = await bridge();
  const scene = blankScene();
  assert.deepEqual(toNativeConfig(scene).resonanceDrive, {kind: 'torus', keySource: 'torus'});
  scene.composition.keySource = 'sky';
  assert.deepEqual(toNativeConfig(scene).resonanceDrive, {kind: 'torus', keySource: 'sky'});
  delete scene.composition.keySource;
  assert.deepEqual(toNativeConfig(scene).resonanceDrive, {kind: 'torus', keySource: 'torus'}, 'a torus scene with no key written reads the manual\'s default key');
  scene.composition.frequencyDriver = 'manual';
  assert.deepEqual(toNativeConfig(scene).resonanceDrive, {kind: 'frequency'});
});

test('a scene saved with the torus drive reloads torus with its key, and one saved with manual reloads manual', async () => {
  const {blankScene} = await model();
  const {nativeExport, nativeSnapshotToJourney} = await bridge();
  const torus = blankScene();
  torus.composition.keySource = 'sky';
  const back = nativeSnapshotToJourney(JSON.parse(JSON.stringify(nativeExport(torus)))).scenes[0];
  assert.equal(back.composition.frequencyDriver, 'torus');
  assert.equal(back.composition.keySource, 'sky');
  const manual = blankScene();
  manual.composition.frequencyDriver = 'manual';
  assert.equal(nativeSnapshotToJourney(JSON.parse(JSON.stringify(nativeExport(manual)))).scenes[0].composition.frequencyDriver, 'manual');
});

test('a native configuration that names no drive keeps reading as the frequency drive: the old migration rule, not the new default', async () => {
  const {blankScene} = await model();
  const {nativeExport, nativeSnapshotToJourney} = await bridge();
  const manual = blankScene();
  manual.composition.frequencyDriver = 'manual';
  const raw = JSON.parse(JSON.stringify(nativeExport(manual)));
  delete raw.config.resonanceDrive;
  const back = nativeSnapshotToJourney(raw).scenes[0];
  assert.equal(back.composition.frequencyDriver, 'manual');
});

// ---------------------------------------------------------------------------------------------------- the drive

const reading = ({torus = [], silentBecause = null, sky = [], absentBecause = null} = {}) =>
  ({torus: {tonesHz: torus, silentBecause}, sky: {tonesHz: sky, absentBecause}});

test('under Torus a reading with three voices drives the plate with their pitches', async () => {
  const {TorusDriveState} = await drive();
  const state = new TorusDriveState();
  const resolved = state.resolve({keySource: 'torus', reading: reading({torus: [196.5, 247.5, 294.75]}), manualHz: 396});
  assert.deepEqual(resolved.tonesHz, [196.5, 247.5, 294.75]);
  assert.equal(resolved.silent, false);
  assert.equal(resolved.reason, null);
  assert.equal(resolved.source, 'torus');
});

test('while the torus plays nothing the plate holds its last drive and says the torus is silent', async () => {
  const {TorusDriveState} = await drive();
  const state = new TorusDriveState();
  state.resolve({keySource: 'torus', reading: reading({torus: [200, 300]}), manualHz: 396});
  const silent = state.resolve({keySource: 'torus', reading: reading({silentBecause: 'The torus has not been struck yet'}), manualHz: 396});
  assert.deepEqual(silent.tonesHz, [200, 300], 'the last drive is held');
  assert.equal(silent.silent, true);
  assert.equal(silent.held, true);
  assert.match(silent.reason, /torus is silent/i);
  assert.match(silent.reason, /holds its last drive/i);
  assert.match(silent.reason, /has not been struck yet/);
  const again = state.resolve({keySource: 'torus', reading: reading({torus: [440]}), manualHz: 396});
  assert.deepEqual(again.tonesHz, [440], 'a new strike replaces the held drive');
});

test('a torus that has never played gives the plate no drive at all: no tone is made up', async () => {
  const {TorusDriveState} = await drive();
  const state = new TorusDriveState();
  for (const given of [null, reading({silentBecause: 'No instrument is open'})]) {
    const resolved = state.resolve({keySource: 'torus', reading: given, manualHz: 396});
    assert.deepEqual(resolved.tonesHz, [], 'not the manual 396 Hz, not any default');
    assert.equal(resolved.silent, true);
    assert.equal(resolved.held, false);
    assert.match(resolved.reason, /torus is silent/i);
    assert.match(resolved.reason, /no drive yet/i);
  }
});

test('the Sky key drives the plate with the sky\'s voices and is absent, with its reason, when no dated sky is open', async () => {
  const {TorusDriveState} = await drive();
  const state = new TorusDriveState();
  const sky = [110, 123.5, 137.5, 146.75];
  const dated = state.resolve({keySource: 'sky', reading: reading({torus: [500], sky}), manualHz: 396});
  assert.deepEqual(dated.tonesHz, sky, 'Sky is the sky\'s voices, not what the torus plays');
  assert.equal(dated.source, 'sky');
  const absent = state.resolve({keySource: 'sky', reading: reading({torus: [500], absentBecause: 'No dated sky is open on the instrument'}), manualHz: 396});
  assert.equal(absent.silent, true);
  assert.deepEqual(absent.tonesHz, sky, 'the sky\'s last key is held');
  assert.match(absent.reason, /No dated sky is open/);
});

test('the Manual key is the resonance that was set, whatever the torus plays', async () => {
  const {TorusDriveState} = await drive();
  const state = new TorusDriveState();
  const resolved = state.resolve({keySource: 'manual', reading: reading({torus: [200, 300]}), manualHz: 523.25});
  assert.deepEqual(resolved.tonesHz, [523.25]);
  assert.equal(resolved.silent, false);
  assert.equal(resolved.source, 'manual');
  const held = state.resolve({keySource: 'torus', reading: reading({silentBecause: 'x'}), manualHz: 523.25});
  assert.deepEqual(held.tonesHz, [], 'Manual set the resonance; it was not the torus\'s last drive');
});

test('only the owner\'s own finite positive pitches reach the plate', async () => {
  const {TorusDriveState} = await drive();
  const resolved = new TorusDriveState().resolve({keySource: 'torus', reading: reading({torus: [220, 0, -5, NaN, Infinity, 330]}), manualHz: 396});
  assert.deepEqual(resolved.tonesHz, [220, 330]);
});

test('the eight audible roles and four nodes are named absent, with the reason, beside every torus drive', async () => {
  const {TorusDriveState} = await drive();
  const resolved = new TorusDriveState().resolve({keySource: 'torus', reading: reading({torus: [220]}), manualHz: 396});
  assert.equal(resolved.roles.standing, 'absent');
  assert.match(resolved.roles.reason, /eight audible roles and four nodes/);
  assert.match(resolved.roles.reason, /no source/i);
});

// ---------------------------------------------------------------------------------------------------- the plate

const plateOf = async () => {
  const {CymaticResonator} = await resonator();
  const plate = new CymaticResonator({plateSize: 700, baseFrequency: 40, dampingQ: 4.5, driveStrength: 1, modeCount: 64, dimension: '2D'});
  return plate;
};
const settle = (plate, tones) => { for (let i = 0; i < 600; i++) plate.step(0.016, tones); return {re: Array.from(plate.re), im: Array.from(plate.im)}; };

test('one tone in a list drives the plate exactly as the same tone alone', async () => {
  const [a, b] = [await plateOf(), await plateOf()];
  const alone = settle(a, 396), listed = settle(b, [396]);
  assert.ok(alone.re.every(Number.isFinite) && alone.im.every(Number.isFinite), 'the plate answers with numbers');
  assert.ok(alone.re.some(value => Math.abs(value) > 1e-6), 'and the tone moves it');
  assert.deepEqual(listed, alone);
});

test('a chord drives each mode with the mean of its tones\' own responses', async () => {
  const [chord, first, second] = [await plateOf(), await plateOf(), await plateOf()];
  const both = settle(chord, [220, 330]), one = settle(first, 220), two = settle(second, 330);
  assert.ok(both.re.some(value => Math.abs(value) > 1e-6), 'the chord moves the plate');
  for (let i = 0; i < both.re.length; i++) {
    // The modal state is held in Float32Array, so the sums agree to single precision, not double.
    near(both.re[i], (one.re[i] + two.re[i]) / 2, 1e-6, `re[${i}]`);
    near(both.im[i], (one.im[i] + two.im[i]) / 2, 1e-6, `im[${i}]`);
  }
});

test('a plate with no tones is not driven: it relaxes to rest and reports no frequency', async () => {
  const plate = await plateOf();
  settle(plate, 396);
  assert.ok(plate.re.some(value => Math.abs(value) > 1e-3));
  const telemetry = plate.step(0.016, []);
  assert.equal(telemetry.isLocked, false);
  assert.equal(telemetry.frequencyHz, 0);
  for (let i = 0; i < 2000; i++) plate.step(0.016, []);
  assert.ok(plate.re.every(value => Math.abs(value) < 1e-6) && plate.im.every(value => Math.abs(value) < 1e-6), 'rest');
});

test('the plate\'s telemetry names its lowest tone as its frequency', async () => {
  const plate = await plateOf();
  assert.equal(plate.step(0.016, [330, 220]).frequencyHz, 220);
});

// ---------------------------------------------------------------------------------------------------- the frame's reading of the owner

const voice = (planet, hz) => ({index: 0, planet_ref: planet, longitude_degrees: 0, frequency_hz: hz, m: 1, n: 1, helix: 'x', ql_position: 1, weight: 1, phase_radians: 0});
const NINE = [['Sun', 130.8], ['Moon', 174.4], ['Mercury', 163.5], ['Venus', 147.2], ['Mars', 245.3], ['Jupiter', 218.0], ['Saturn', 196.2], ['Uranus', 261.6], ['Neptune', 235.4]];
const owner = ({status = 'following', struck = {at: 1, source: 'note', refs: []}, sky = {kind: 'dated', label: 'Dated sky now'}, voices = NINE} = {}) => ({
  status,
  instrument: {acting: {sky, voices: voices.map(([planet, hz]) => voice(planet, hz))}, struck},
});

test('what the torus plays is the pitches of the voices it was struck on, named by the owner\'s own mode references', async () => {
  const {torusPlayReading, voiceModeRef} = await play();
  assert.equal(voiceModeRef('Sun'), 'scene:planet/Sun');
  const read = torusPlayReading(owner({struck: {at: 5, source: 'note', refs: ['scene:planet/Mars', 'scene:planet/Sun', 'scene:planet/Moon']}}));
  assert.deepEqual(read.torus.tonesHz, [245.3, 130.8, 174.4], 'the owner\'s pitches in the order the note named them');
  assert.equal(read.torus.silentBecause, null);
});

test('a strike of every voice is the nine pitches the owner tuned', async () => {
  const {torusPlayReading, voiceModeRef} = await play();
  const read = torusPlayReading(owner({struck: {at: 5, source: 'event', refs: NINE.map(([planet]) => voiceModeRef(planet))}}));
  assert.deepEqual(read.torus.tonesHz, NINE.map(([, hz]) => hz));
});

test('the torus plays nothing, and says why in words, when no instrument is open, the field is held, or it was never struck', async () => {
  const {torusPlayReading} = await play();
  assert.match(torusPlayReading(null).torus.silentBecause, /No instrument is open/);
  assert.match(torusPlayReading({status: 'manual', instrument: null}).torus.silentBecause, /No instrument is open/);
  assert.match(torusPlayReading(owner({status: 'held'})).torus.silentBecause, /held/);
  assert.match(torusPlayReading(owner({status: 'opening'})).torus.silentBecause, /opening|not sounding/);
  const unstruck = torusPlayReading(owner({struck: null}));
  assert.match(unstruck.torus.silentBecause, /not been struck/);
  assert.deepEqual(unstruck.torus.tonesHz, []);
  const strangers = torusPlayReading(owner({struck: {at: 1, source: 'note', refs: ['scene:planet/Pluto']}}));
  assert.deepEqual(strangers.torus.tonesHz, [], 'a ref the owner no longer names gives no pitch');
  assert.match(strangers.torus.silentBecause, /none of the voices/i);
});

test('the sky\'s key is the dated sky\'s voices, and absent with its reason when the sky is not dated or nothing is open', async () => {
  const {torusPlayReading} = await play();
  assert.deepEqual(torusPlayReading(owner()).sky.tonesHz, NINE.map(([, hz]) => hz));
  assert.equal(torusPlayReading(owner()).sky.absentBecause, null);
  const undated = torusPlayReading(owner({sky: {kind: 'none', label: 'No dated sky requested'}}));
  assert.deepEqual(undated.sky.tonesHz, []);
  assert.match(undated.sky.absentBecause, /No dated sky is open/);
  assert.match(torusPlayReading(null).sky.absentBecause, /No instrument is open/);
  assert.equal(torusPlayReading(owner({status: 'held'})).sky.absentBecause, null, 'a held field still has its sky');
});

// ---------------------------------------------------------------------------------------------------- the controller: what it records as struck
// Against the controlled scene owner of desktop/cradle/tests/native-expression-fixture.mjs (protocol only, not QL's numbers). The fixture
// has no `strike` operation; the owner below commits one generation for it, as the real owner does, so the controller's own record of a
// played note is what is under test.
const fixture = () => import(new URL('../../../tests/native-expression-fixture.mjs', import.meta.url));
const controller = () => bundle(join(journeys, 'src/native-field/controller.ts'), 'controller');
const openController = async (striking = true) => {
  const {ControlledAudio, ControlledSceneOwner} = await fixture();
  const THREE = await import('three');
  const {NativeFieldController} = await controller();
  const Owner = striking ? class extends ControlledSceneOwner {
    strikes = [];
    async request(request) {
      const command = request.request?.command;
      if (command?.operation !== 'strike') return super.request(request);
      const read = structuredClone(request);
      read.request.command = {operation: 'read'};
      const reply = await super.request(read);
      this.strikes.push(structuredClone(command.strikes));
      this.bump(1n);
      reply.field = structuredClone(this.frame);
      reply.field.audio = [];
      return reply;
    }
  } : ControlledSceneOwner;
  const texture = () => new THREE.DataTexture(new Float32Array(16), 2, 2, THREE.RGBAFormat, THREE.FloatType);
  const port = {texWidth: 2, texHeight: 2, particleCount: 4, targetA: texture(), targetB: texture(), setTargetTextures() {}};
  const renderer = {retainedTopology: () => ({tex_width: 2, tex_height: 2, particle_count: 4, slot_count: 4}), retainedTargetPort: () => port, setNativeDomain() {},
    releaseRetainedField() {}, onRetainedRecoveryRequired: () => () => {}, checkpointRetainedField() { return {receipt: {}}; }, restoreRetainedField() {}};
  const owner = new Owner(), audio = new ControlledAudio(), c = new NativeFieldController(owner, renderer, () => audio);
  await c.compose({sky: 'none'});
  return {owner, c};
};

test('an instrument that was opened and never struck has played nothing; its sky is not dated', async () => {
  const {torusPlayReading} = await play();
  const {c} = await openController();
  try {
    assert.equal(c.reading.instrument.struck, null);
    const read = torusPlayReading(c.reading);
    assert.deepEqual(read.torus.tonesHz, []);
    assert.match(read.torus.silentBecause, /not been struck yet/);
    assert.match(read.sky.absentBecause, /No dated sky is open/);
  } finally { await c.dispose(); }
});

test('an event the owner strikes on makes every voice it tunes the torus\'s play, at the owner\'s own pitches', async () => {
  const {torusPlayReading} = await play();
  const {c} = await openController();
  try {
    await c.m1Advance(1);
    const instrument = c.reading.instrument, voices = instrument.influence.voices;
    assert.equal(instrument.struck.source, 'event');
    assert.deepEqual(instrument.struck.refs, voices.map(voice => `scene:planet/${voice.planet_ref}`));
    assert.deepEqual(torusPlayReading(c.reading).torus.tonesHz, voices.map(voice => voice.frequency_hz), 'the owner\'s pitches, none made up');
  } finally { await c.dispose(); }
});

test('a played note narrows the torus\'s play to the voices it struck, and a refused note changes nothing', async () => {
  const {torusPlayReading} = await play();
  const {c, owner} = await openController();
  try {
    await c.m1Advance(1);
    const voices = c.reading.instrument.influence.voices;
    const refs = [voices[3], voices[1]].map(voice => `scene:planet/${voice.planet_ref}`);
    await c.playVoices(refs, 0.35);
    assert.deepEqual(owner.strikes.at(-1).map(act => act.mode_ref), refs, 'the owner was struck on exactly these voices');
    assert.equal(c.reading.instrument.struck.source, 'note');
    assert.deepEqual(torusPlayReading(c.reading).torus.tonesHz, [voices[3].frequency_hz, voices[1].frequency_hz]);
    owner.refuse = command => command.operation === 'read';
    await assert.rejects(c.playVoices([`scene:planet/${voices[0].planet_ref}`], 0.35));
    assert.deepEqual(c.reading.instrument.struck.refs, refs, 'a note the owner did not take is not what the torus plays');
  } finally { await c.dispose(); }
});

test('a held field plays nothing: the torus is silent until it runs again', async () => {
  const {torusPlayReading} = await play();
  const {c} = await openController();
  try {
    await c.m1Advance(1);
    assert.equal(torusPlayReading(c.reading).torus.silentBecause, null);
    c.hold('test');
    assert.equal(c.reading.status, 'held');
    assert.match(torusPlayReading(c.reading).torus.silentBecause, /held/);
  } finally { await c.dispose(); }
});
