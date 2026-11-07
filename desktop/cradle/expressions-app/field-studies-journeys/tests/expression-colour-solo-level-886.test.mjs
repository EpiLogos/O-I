// O-I #747 round 886, as the frame keeps and hears them:
//
//   - the Expression's colour (DLW.md:8911 "The track head shows the Expression's title and colour"): kept in its document beside its
//     title and description, a palette colour (#RRGGBB), carried by composition_set and read back on load;
//   - Solo (DLW build ruling 2026-11-06, the lead's derivation: the mixer row maps Live's controls, DLW.md:8919–8929, and a Live Set keeps
//     its solo states): kept in Journey.mix with the Activator. Another Expression's Solo is still what is heard here (`silenced`), and an
//     Expression's own Solo silences nothing of its own;
//   - the Field's Level (§20.2 Field, "Level | −60 to 0 dB | −12 dB | Sets the loudness of the whole field"): the scene's own
//     (Scene.composition.fieldLevel, in dB), absent −12 dB, and everything the field sounds is heard under it — the voices and the Torus's
//     mix stage alike, so the one gain the desktop's engine takes with the Torus carries it too;
//   - the Torus in the desktop's one engine: the frame announces that one gain beside the Torus's effects (parameters.mix), so level × Main
//     reaches the engine's Torus as it reaches the frame's.
//   - a held launch's receipt says where it lands (walk 886): where the playing scene ends, when that comes before the Quantize's
//     boundary, since it lands there (heldLaunchVerdict), never a second past the scene's end.
//
// SCRIPTED: the sources are bundled with the app's own esbuild; no audio device is opened and nothing sounds.
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
const out = mkdtempSync(join(tmpdir(), 'expression-886-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
};
const model = await bundle(join(journeys, 'src/model.ts'), 'model');
const sound = await bundle(join(journeys, 'src/native-field/entitySound.ts'), 'entitySound');
const composition = await bundle(join(journeys, 'src/kernelComposition.ts'), 'kernelComposition');
const bridge = await bundle(join(journeys, 'src/kernelDocumentBridge.ts'), 'kernelDocumentBridge');
const {announceInstrument} = await import(pathToFileURL(join(journeys, 'src/native-field/ql/instrumentAnnouncement.mjs')).href);

const close = (a, b, words) => assert.ok(Math.abs(a - b) < 1e-9, `${words}: ${a} is not ${b}`);

test('r886: the Expression keeps its colour in its document, a palette colour, carried and read back as it keeps it', () => {
  const j = model.fieldStudies();
  j.colour = '#5480E4';
  assert.equal(model.validateJourney(model.clone(j)).colour, '#5480E4');
  assert.equal(composition.compositionProperties(j).colour, '#5480E4', 'composition_set carries it beside the title\'s description');
  assert.equal('colour' in composition.compositionProperties(model.fieldStudies()), false, 'none kept: none carried');
  for (const bad of ['blue', '#12345', '#1234567', 7, null, 'var(--accent)']) {
    j.colour = bad;
    assert.throws(() => model.validateJourney(model.clone(j)), /An Expression's colour is a palette colour \(#RRGGBB\)\./, JSON.stringify(bad));
  }
  const scene = model.blankScene('Scene 1'); scene.id = 'expression:c:scene:s1';
  const doc = colour => ({schema: 'oi.expression/v1', expression_ref: 'expression:c', revision: 2, title: 'C', entities: {}, relations: {},
    scenes: [{scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}}],
    selection: {scene_ref: scene.id, entity_ref: null}, provenance: [], representations: [], refinements: [],
    presentation: {schema: 'oi.journey-properties/v1', description: '', loop: false, ...(colour === undefined ? {} : {colour})}});
  assert.equal(bridge.kernelDocumentToJourney(doc('#FF94A6')).journey.colour, '#FF94A6', 'the document\'s colour is read on load');
  assert.equal(bridge.kernelDocumentToJourney(doc(undefined)).journey.colour, undefined);
});

test('r886: Solo is kept in the Expression\'s mixer with the Activator; its own Solo silences nothing of its own', () => {
  assert.deepEqual(sound.EXPRESSION_MIX_DEFAULT, {level: 1, main: 1, active: true, solo: false}, 'an Expression that keeps none is not soloed');
  assert.equal(sound.expressionMixRefusal({solo: true, active: false}), null);
  assert.equal(sound.expressionMixRefusal({solo: 'on'}), 'Solo is on or off (true or false).');
  assert.deepEqual(sound.expressionMixOf({solo: true}), {level: 1, main: 1, active: true, solo: true});
  const j = model.fieldStudies(); j.mix = {solo: true};
  assert.deepEqual(model.validateJourney(model.clone(j)).mix, {solo: true});
  try {
    assert.equal(sound.setExpressionMix({solo: true}), null);
    assert.equal(sound.expressionMixReading().solo, true);
    assert.equal(sound.expressionSilencedHere(), false, 'soloed itself: it is heard');
    sound.setSoloSilenced(true);
    assert.equal(sound.expressionSilencedHere(), true, 'another Expression soloed: it is silent here');
  } finally { sound.setSoloSilenced(false); sound.setExpressionMix(undefined); }
});

test('r886: the Field\'s Level is the scene\'s own, −60 to 0 dB, −12 dB where it keeps none', () => {
  assert.deepEqual(sound.FIELD_LEVEL_DB, {min: -60, max: 0, default: -12});
  const j = model.fieldStudies();
  for (const db of [-60, -12, -0.5, 0]) {
    j.scenes[0].composition.fieldLevel = db;
    assert.equal(model.validateJourney(model.clone(j)).scenes[0].composition.fieldLevel, db);
  }
  for (const bad of [-61, 0.5, '-12', null]) {
    j.scenes[0].composition.fieldLevel = bad;
    assert.throws(() => model.validateJourney(model.clone(j)), /Invalid composition\./, JSON.stringify(bad));
  }
  for (const bad of [NaN, Infinity]) {
    j.scenes[0].composition.fieldLevel = bad;
    assert.throws(() => model.validateJourney(model.clone(j)), /Non-finite value\./, String(bad));
  }
  close(sound.fieldLevelGain(undefined), 10 ** (-12 / 20), 'a scene that keeps none: −12 dB');
  close(sound.fieldLevelGain(0), 1, '0 dB: unity');
  close(sound.fieldLevelGain(-60), 0.001, '−60 dB');
});

test('r886: everything the field sounds is heard under its Level — the voices and the Torus\'s one gain alike', () => {
  const told = [];
  const stop = sound.onExpressionGain(gain => told.push(gain));
  try {
    close(told.at(-1), 10 ** (-12 / 20), 'before any scene: the default Level, at unity level and Main');
    assert.equal(sound.setFieldLevel(-6), null);
    close(sound.objectSoundLevels().field, 10 ** (-6 / 20), 'the voices\' levels carry it');
    close(sound.soundingGain(0.5, false, {level: 1, main: 2, field: 0.5}), 0.5, 'a voice: its gain × level × Main × the Field\'s Level');
    close(told.at(-1), 10 ** (-6 / 20), 'the Torus\'s mix stage is told');
    sound.setExpressionMix({level: 0.5, main: 2});
    close(told.at(-1), 10 ** (-6 / 20), 'level × Main × Level');
    assert.equal(sound.setFieldLevel(3), 'The Field\'s Level runs from −60 to 0 dB.');
    close(sound.objectSoundLevels().field, 10 ** (-6 / 20), 'refused: the Level stands');
    const n = told.length;
    sound.setFieldLevel(-6);
    assert.equal(told.length, n, 'the same Level is no change');
  } finally { stop(); sound.setFieldLevel(undefined); sound.setExpressionMix(undefined); }
});

test('r886: the frame takes the playing scene\'s Level on each frame, and announces the one gain for the engine\'s Torus', () => {
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');
  const tick = app.slice(app.indexOf('function tick(now:number)'), app.indexOf('rafId=requestAnimationFrame(tick);\n}'));
  assert.match(tick, /setFieldLevel\(activeScene\(\)\.composition\.fieldLevel\)/, 'a landed scene is heard at its own Level');
  assert.match(app, /function renderAll\(\)\{setExpressionMix\(store\.document\.mix\);setFieldLevel\(activeScene\(\)\.composition\.fieldLevel\);/, 'and on each edit');
  const reading = {native: {audio: null, acknowledged: true, presented: true, available: true, held: false, in_flight: 0, queued_blocks: 0, queued_bytes: 0,
    coalesced_presentation_frames: 0, views: [], disposed: false}, status: 'following', presentation_level: {value: 1}, expression_mix: {gain: 0.5}};
  assert.equal(announceInstrument(reading).parameters.mix, 0.5, 'the Expression\'s one gain, beside the Torus\'s effects');
  assert.equal('mix' in announceInstrument({...reading, expression_mix: undefined}).parameters, false, 'a frame that keeps none announces none');
});

test('r886: a held launch lands at its boundary or where the playing scene ends, whichever comes first, and says so', async () => {
  const workflow = await bundle(join(journeys, 'src/sceneWorkflow.ts'), 'sceneWorkflow')
  const lands = over => workflow.launchLandsAt({quantize: '1 bar', playing: true, rate: 1, elapsed: 5.28, timeScale: 1, ...over})
  assert.equal(lands(), 7.5, 'no end given: the next bar, as before')
  assert.equal(lands({end: 10}), 7.5, 'the bar comes first')
  assert.equal(lands({end: 6}), 6, 'the scene ends first: it lands where it ends (walk 886 said 7.50 s of a 6 s scene)')
  assert.equal(lands({end: 5.28}), null, 'at its end already: at once')
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8')
  assert.match(app, /launchLandsAt\(\{quantize:sceneLaunchQuantize\(target,store\.document\),playing:scenePlaying\|\|journeyPlaying,rate:transportRate\(workingTransport\),elapsed:sceneElapsed,timeScale:fieldTimeScale\(\),end:playingSceneEnd\(\)\}\)/,
    'the frame gives it the playing scene\'s end')
  assert.match(app, /function playingSceneEnd\(\):number\|undefined\{if\(activeLoopRegion\(store\.document\)\)return undefined;const s=scene\(\);return journeyPlaying\?store\.document\.savedScenes\?\.\[s\.id\]\?\.duration:s\.duration;\}/,
    'the end the transport ends it at: saved in the sequence, working otherwise, none under a brace')
})
