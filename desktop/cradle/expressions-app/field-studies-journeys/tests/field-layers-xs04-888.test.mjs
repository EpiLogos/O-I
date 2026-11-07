// O-I #747 round 888, XS04 slice 1 ("I launch a scene, loop it and layer it over a scene of another Expression": §7, §20.1 Session view,
// a scene's ▶): the scenes play together on the field, picture and sound from one state; a scene of an Expression whose Activator is off
// does not launch (§20.1 The mixer row).
//
// The field holds another Expression over the presented one (fieldLayers.ts; DLW build ruling 2026-11-06, the lane's structural proposal
// accepted): `hold` reads it onto the field, `start` launches one of its scenes (looping when asked), `stop` stops it, `release` lets it go.
// The layered scene's symbols join the one Scene the engine draws and sounds (production.ts reads picture and object sound off that one
// Scene). The vocabulary is the stage's one closed list (stageCommands.ts), which the boundary and the shell import.
// SCRIPTED: the sources are bundled with the app's own esbuild; the held Expression is read through a recorder; nothing plays.
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
const out = mkdtempSync(join(tmpdir(), 'layers-888-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
};
const model = await bundle(join(journeys, 'src/model.ts'), 'model');
const stage = await bundle(join(journeys, 'src/stageCommands.ts'), 'stage');
const {createFieldLayers} = await bundle(join(journeys, 'src/fieldLayers.ts'), 'fieldLayers');

const PRESENTED = 'expression:dawn', TIDE = 'expression:tide';
/** An Expression of two scenes of 6 and 4 s; its first scene holds `symbols` symbols, the first of them sounding. */
function expression(ref, title, {symbols = 2, active, tracks = false} = {}) {
  const journey = model.fieldStudies();
  journey.scenes = journey.scenes.slice(0, 2).map((scene, i) => ({...scene, id: `${ref}:scene:s${i + 1}`, name: `${title} ${i + 1}`, duration: [6, 4][i]}));
  const first = journey.scenes[0], template = first.entities[0] ?? model.blankScene('x').entities[0];
  first.entities = Array.from({length: symbols}, (_, i) => ({...model.clone(template), id: `symbol-${i}`, name: `Symbol ${i}`, position: {x: i, y: 0, z: 0},
    ...(i === 0 ? {sound: {enabled: true}} : {})}));
  first.propertyTracks = tracks ? [{id: 'track-x', bind: 'entity.position.x', entityId: 'symbol-0', points: [{time: 0, value: 0}, {time: 6, value: 6}]}] : undefined;
  if (active !== undefined) journey.mix = {active};
  return {expression_ref: ref, title, revision: 4, journey};
}
function field({documents = {[TIDE]: expression(TIDE, 'Tide')}} = {}) {
  const reads = [], shown = {ref: PRESENTED};
  const layers = createFieldLayers({presented: () => shown.ref, read: async ref => {
    reads.push(ref);
    if (!documents[ref]) throw Error(`The kernel has no Expression ${ref}.`);
    return model.clone(documents[ref]);
  }});
  return {layers, reads, shown};
}
const base = () => ({...model.blankScene('Dawn 1'), id: `${PRESENTED}:scene:s1`});

test('XS04: the stage reads the layer acts exactly, and the hosted reading of the held Expressions exactly', () => {
  const read = command => stage.readStageRequest({v: 1, kind: 'host-command', req: 1, command: 'layer', ...command})?.command ?? null;
  assert.deepEqual(read({action: 'hold', expression_ref: TIDE}), {command: 'layer', action: 'hold', expression_ref: TIDE});
  assert.deepEqual(read({action: 'start', expression_ref: TIDE, scene_ref: `${TIDE}:scene:s1`, loop: true}),
    {command: 'layer', action: 'start', expression_ref: TIDE, scene_ref: `${TIDE}:scene:s1`, loop: true});
  for (const action of ['stop', 'release']) assert.deepEqual(read({action, expression_ref: TIDE}), {command: 'layer', action, expression_ref: TIDE});
  for (const bad of [{action: 'play', expression_ref: TIDE}, {action: 'hold'}, {action: 'hold', expression_ref: ''}, {action: 'hold', expression_ref: TIDE, scene_ref: 's'},
    {action: 'start', expression_ref: TIDE}, {action: 'start', expression_ref: TIDE, scene_ref: 's', loop: 'yes'}, {action: 'stop', expression_ref: 'a\u0000b'}])
    assert.equal(read(bad), null, JSON.stringify(bad));
  assert.ok(stage.STAGE_COMMANDS.includes('layer'));
  const reading = [{expression_ref: TIDE, title: 'Tide', revision: 4, active: true, scenes: [{scene_ref: 's1', title: 'Tide 1', duration: 6}],
    playing: {scene_ref: 's1', elapsed: 1.5, loop: false}}];
  assert.deepEqual(stage.readFieldLayers(reading), reading);
  assert.deepEqual(stage.readFieldLayers([]), []);
  for (const bad of [{}, [{...reading[0], extra: 1}], [{...reading[0], playing: {scene_ref: 's9', elapsed: 0, loop: false}}], [{...reading[0], revision: 0}],
    Array.from({length: stage.FIELD_LAYERS_MAX + 1}, (_, i) => ({...reading[0], expression_ref: `e${i}`}))])
    assert.equal(stage.readFieldLayers(bad), null, JSON.stringify(bad).slice(0, 80));
});

test('XS04: an Expression is held over the field by its own read; the presented one, or one more than the field holds, is refused', async () => {
  const {layers, reads} = field({documents: Object.fromEntries(['a', 'b', 'c', 'd'].map(n => [`expression:${n}`, expression(`expression:${n}`, n)]).concat([[TIDE, expression(TIDE, 'Tide')]]))});
  assert.equal(await layers.hold(TIDE), 'Tide is held over the field: launch one of its scenes.');
  assert.deepEqual(reads, [TIDE]);
  assert.deepEqual(layers.reading(), [{expression_ref: TIDE, title: 'Tide', revision: 4, active: true, mix: {active: true, solo: false, level: 1},
    scenes: [{scene_ref: `${TIDE}:scene:s1`, title: 'Tide 1', duration: 6}, {scene_ref: `${TIDE}:scene:s2`, title: 'Tide 2', duration: 4}], playing: null}]);
  await assert.rejects(layers.hold(PRESENTED), {message: 'That Expression is the one presented: its scenes play on the field already.'});
  await assert.rejects(layers.hold('expression:missing'), {message: 'The kernel has no Expression expression:missing.'});
  await layers.hold('expression:a'); await layers.hold('expression:b');
  await assert.rejects(layers.hold('expression:c'), {message: 'The field holds 3 Expressions over the presented one: release one first.'});
  assert.equal(layers.reading().length, 3, 'a refused hold changes nothing');
  assert.equal(await layers.hold(TIDE), 'Tide is held over the field: launch one of its scenes.', 'holding it again reads it afresh');
  assert.deepEqual(reads.filter(ref => ref === TIDE).length, 2);
});

test('XS04: a launched scene plays on the field with the presented one: its symbols join the one Scene, picture and sound together', async () => {
  const {layers} = field();
  const presented = base();
  assert.equal(layers.over(presented), presented, 'nothing layered: the presented Scene itself');
  await assert.rejects(async () => layers.start(TIDE, `${TIDE}:scene:s1`), {message: 'That Expression is not held over the field: hold it first.'});
  await layers.hold(TIDE);
  await assert.rejects(async () => layers.start(TIDE, `${TIDE}:scene:s9`), {message: 'Tide has no scene expression:tide:scene:s9.'});
  assert.equal(layers.over(presented), presented, 'held, nothing launched: the presented Scene itself');
  assert.equal(await layers.start(TIDE, `${TIDE}:scene:s1`), 'Tide 1 plays over the field.');
  const scene = layers.over(presented);
  assert.equal(scene.id, presented.id, 'the presented Scene stands: its field, its id');
  assert.equal(scene.field, presented.field);
  assert.deepEqual(scene.entities.slice(0, presented.entities.length), presented.entities, 'its own symbols first, untouched');
  const layered = scene.entities.slice(presented.entities.length);
  assert.deepEqual(layered.map(entity => entity.id), [`${TIDE}#symbol-0`, `${TIDE}#symbol-1`], 'the layered symbols, each named by its Expression');
  assert.deepEqual(layered[0].sound, {enabled: true}, 'its sound rides with its picture, in the one Scene');
  assert.deepEqual(layers.reading()[0].playing, {scene_ref: `${TIDE}:scene:s1`, elapsed: 0, loop: false});
  const {layers: again, shown} = field();
  await again.hold(TIDE); await again.start(TIDE, `${TIDE}:scene:s1`);
  shown.ref = TIDE;
  assert.equal(again.over(presented), presented, 'an Expression held and then presented plays as the presented one, never twice');
  assert.equal(layers.stop(TIDE), 'Tide stops: the field plays the presented Expression alone.');
  assert.equal(layers.over(presented), presented);
  assert.equal(layers.release(TIDE), 'Tide is let go from the field.');
  assert.deepEqual(layers.reading(), []);
  assert.throws(() => layers.stop(TIDE), {message: 'That Expression is not held over the field: hold it first.'});
});

test('XS04: a scene of an Expression whose Activator is off does not launch; nor one with more symbols than a layered scene holds', async () => {
  const {layers} = field({documents: {[TIDE]: expression(TIDE, 'Tide', {active: false}), 'expression:crowd': expression('expression:crowd', 'Crowd', {symbols: 33})}});
  await layers.hold(TIDE);
  assert.equal(layers.reading()[0].active, false, 'the reading says the Activator is off');
  await assert.rejects(async () => layers.start(TIDE, `${TIDE}:scene:s1`), {message: 'This Expression\'s Activator is off: its scenes do not launch.'});
  assert.equal(layers.reading()[0].playing, null);
  await layers.hold('expression:crowd');
  await assert.rejects(async () => layers.start('expression:crowd', 'expression:crowd:scene:s1'),
    {message: 'Crowd 1 holds 33 symbols: a scene layered over the field holds at most 32.'});
});

test('XS04: the layered scene keeps its own clock: it plays to its end and stops, or loops; its automation reads its own time', async () => {
  const {layers} = field({documents: {[TIDE]: expression(TIDE, 'Tide', {tracks: true})}});
  await layers.hold(TIDE);
  await layers.start(TIDE, `${TIDE}:scene:s1`);
  const before = layers.revision();
  assert.equal(layers.advance(1.5), false, 'it plays on');
  assert.equal(layers.reading()[0].playing.elapsed, 1.5);
  assert.notEqual(layers.revision(), before, 'the field draws the layer afresh as its automation moves');
  assert.equal(layers.over(base()).entities.find(entity => entity.id === `${TIDE}#symbol-0`).position.x, 1.5, 'its track at its own 1.5 s');
  assert.equal(layers.advance(5), true, 'the frame is told it stopped, so it says so to the shell');
  assert.equal(layers.reading()[0].playing, null, 'at its end the scene stops');
  await layers.start(TIDE, `${TIDE}:scene:s1`, true);
  layers.advance(4); layers.advance(4);
  assert.deepEqual(layers.reading()[0].playing, {scene_ref: `${TIDE}:scene:s1`, elapsed: 2, loop: true}, 'looping, it goes round on its own 6 s');
  layers.advance(0);
  const still = layers.revision();
  layers.advance(0);
  assert.equal(layers.revision(), still, 'a still clock draws nothing new');
});

test('XS04: the frame runs the layer acts on its field, draws the layered scenes in the one Scene it hands the engine, and reports them', () => {
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');
  const at = name => { const i = app.indexOf(name); assert.ok(i >= 0, name); return app.slice(i, app.indexOf('\n}', i)) };
  const draw = at('function frameData(delta:number):EngineFrame{');
  for (const fact of ['fieldLayers.advance(delta)', 'announceHostState()', 'presentedFrameData(delta)', 'scene:fieldLayers.over(frame.scene)', 'fieldLayers.revision()'])
    assert.ok(draw.includes(fact), `frameData: ${fact}`);
  const run = app.slice(app.indexOf("  case 'layer':"), app.indexOf("  case 'sound':"));
  for (const fact of ['fieldLayers.hold(command.expression_ref)', 'await fieldLayers.start(command.expression_ref,command.scene_ref,command.loop===true)',
    'fieldLayers.stop(command.expression_ref)', 'fieldLayers.release(command.expression_ref)', 'needsFrame=true'])
    assert.ok(run.includes(fact), `the layer command: ${fact}`);
  assert.match(app, /automationHolds:liveOverrides\.heldValues\(\),\.\.\.layerState\(\),/, 'the announcement carries the layers');
  assert.match(app, /function layerState\(\)\{const layers=fieldLayers\.reading\(\);return layers\.length\?\{layers\}:\{\};\}/);
  assert.match(app, /presented:\(\)=>nativeWorkspace\?\.nativeView\(\)\?\.document\.expression_ref\?\?null/);
  assert.match(app, /kernelDocumentToJourney\(await readKernelExpression\(ref\)\)/, 'a held Expression is read and converted as an opened one is');
});
