// O-I #747 round 885, Pulse (DLW §20.2 Field, "Pulse | On · Off | Off | Pulses the field on the beat"; the transport's Metronome in
// Expressions, §10.5 "Pulse the field"), now that the beat exists (DLW build ruling 2026-11-06: Tempo = 96 × time scale, a bar 2.5 s at
// ×1). The switch is the scene's composition.pulse, an optional boolean, Off when absent. Under On, while the scene plays forward, the field
// pulses each time the scene's clock reaches a beat of its Tempo, its start counted as the first: one outward pulse from the field's
// centre over the whole field, the engine's own Pulse (the click effect's, app.ts firePointerClick). SCRIPTED: the pure law and the
// model's admission, bundled with the app's own esbuild; the tick's use of the law is read from its source. No audio, no GPU.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'field-pulse-885-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
};
const workflow = await bundle(join(journeys, 'src/sceneWorkflow.ts'), 'sceneWorkflow');
const model = await bundle(join(journeys, 'src/model.ts'), 'model');

const at = (before, after, more = {}) => workflow.beatPulse({pulse: true, playing: true, rate: 1, before, after, timeScale: 1, ...more});
const PULSE = {kind: 'pulse', strength: 1, radius: 1.25};

test('Pulse On pulses the field when the scene\'s clock reaches a beat of its Tempo, the scene\'s start the first', () => {
  assert.deepEqual(workflow.FIELD_PULSE, {strength: 1, radius: 1.25});
  // Tempo 96 at ×1: a beat is 0.625 s, four to the 2.5 s bar.
  assert.deepEqual(at(0.61, 0.63), PULSE, 'the clock reached 0.625 s');
  assert.deepEqual(at(0.6, 0.625), PULSE, 'on the beat itself');
  assert.equal(at(0.625, 0.64), null, 'the beat already pulsed is not pulsed again');
  assert.equal(at(0.1, 0.2), null, 'between beats: nothing');
  assert.deepEqual(at(2.49, 2.51), PULSE, 'the bar\'s downbeat, where a held launch lands');
  assert.deepEqual(at(0, 0.016), PULSE, 'the scene\'s start is its first beat');
  assert.equal(at(0, 0), null, 'a held clock pulses nothing, at its start or anywhere');
  assert.deepEqual(at(5.98, 0.01), PULSE, 'the clock started again (a loop, a seek back): its start is a beat');
  // Tempo 192 (×2): a beat is 0.3125 s.
  assert.deepEqual(at(0.3, 0.32, {timeScale: 2}), PULSE);
  assert.equal(at(0.3, 0.32), null, 'at ×1 that is no beat');
});

test('Off, absent, stopped, played backwards or with no beat, the field does not pulse', () => {
  assert.equal(at(0.61, 0.63, {pulse: false}), null, 'Off');
  assert.equal(at(0.61, 0.63, {pulse: undefined}), null, 'a scene that never set it is Off');
  assert.equal(at(0.61, 0.63, {playing: false}), null, 'the scene is not playing');
  for (const rate of [0, -1, NaN]) assert.equal(at(0.61, 0.63, {rate}), null, `rate ${rate}`);
  for (const timeScale of [0, NaN]) assert.equal(at(0.61, 0.63, {timeScale}), null, `time scale ${timeScale}: the field holds and has no beat`);
  assert.equal(at(NaN, 0.63), null);
});

test('the scene carries Pulse as On or Off in its composition, and nothing else', () => {
  const journey = model.blankJourney();
  for (const pulse of [true, false]) {
    const j = model.clone(journey); j.scenes[0].composition.pulse = pulse;
    assert.equal(model.validateJourney(j).scenes[0].composition.pulse, pulse);
  }
  assert.equal('pulse' in model.validateJourney(model.clone(journey)).scenes[0].composition, false, 'absent: Off');
  for (const bad of ['on', 1, null, {on: true}]) {
    const j = model.clone(journey); j.scenes[0].composition.pulse = bad;
    assert.throws(() => model.validateJourney(j), /Invalid composition\./, JSON.stringify(bad));
  }
});

test('the frame\'s tick fires the due pulse as the engine\'s Pulse at the field\'s centre, on the clock the launches are counted on', () => {
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');
  const tick = app.slice(app.indexOf('function tick(now:number'), app.indexOf('\n}\n', app.indexOf('function tick(now:number')));
  assert.match(tick, /const beatFrom=sceneElapsed;/, 'the clock before this frame');
  assert.match(tick, /beatPulse\(\{pulse:activeScene\(\)\.composition\.pulse,playing:scenePlaying,rate,before:beatFrom,after:sceneElapsed,timeScale:fieldTimeScale\(\)\}\)/);
  assert.match(tick, /engine\.command\?\.\(\{type:'pointer-effect',kind:due\.kind,strength:due\.strength,radius:due\.radius\*WORLD_SCALE,x:0,y:0,z:0\}\)/);
  assert.ok(tick.indexOf('beatPulse(') < tick.indexOf('if(pendingLaunch!==null)'), 'counted before a held launch lands and restarts the clock');
});
