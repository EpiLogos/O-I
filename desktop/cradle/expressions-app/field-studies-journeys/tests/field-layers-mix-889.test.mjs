// O-I #747 round 889: an Expression held over the field (XS04, fieldLayers.ts) reads its Activator live, has its own mixer row, and sounds
// in the Main mix with the presented one (DLW.md §20.1 The mixer row: "Activator | The Expression plays, or it does not. Off, its scenes do
// not launch, and its track is dimmed", "Solo | Lets you hear only this Expression's sound", "Volume | The level of the Expression's
// sound"; The Main track: its mixer row "sets the level of every Expression's sound together").
//   - a launch reads the held Expression afresh: its Activator as its document stands now, not as it stood when it was held;
//   - `mix` writes the held Expression's own mixer through its owner (the scene edit `mix`, as the presented one's is written) and reads it
//     afresh; the stage reads the act exactly;
//   - each voice on the field sounds at its own Expression's level × the Main level × the Field's Level; a held Expression switched off is
//     silent; a Solo on the field leaves only the soloed Expressions heard, the presented one's Torus too.
// SCRIPTED: the sources are bundled with the app's own esbuild; the owner is a recorder; the audio graph is a recording context (no
// device is opened, nothing sounds).
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
const out = mkdtempSync(join(tmpdir(), 'layers-889-'));
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
const sound = await bundle(join(journeys, 'src/native-field/entitySound.ts'), 'sound');
const {SymbolVoices} = await bundle(join(journeys, 'src/native-field/symbolVoices.ts'), 'voices');
const {parseModeCatalogue} = await bundle(join(journeys, 'src/native-field/modeCatalogue.ts'), 'catalogue');

const PRESENTED = 'expression:dawn', TIDE = 'expression:tide', REEF = 'expression:reef';
function expression(ref, title, mix) {
  const journey = model.fieldStudies();
  journey.scenes = journey.scenes.slice(0, 2).map((scene, i) => ({...scene, id: `${ref}:scene:s${i + 1}`, name: `${title} ${i + 1}`, duration: [6, 4][i],
    entities: scene.entities.slice(0, 2)}));
  if (mix) journey.mix = mix;
  return {expression_ref: ref, title, revision: 4, journey};
}
/** The field over a kernel of `documents`: reads give the document as it stands; `mix` writes are recorded and land in the document. */
function field(documents) {
  const reads = [], writes = [];
  const layers = createFieldLayers({presented: () => PRESENTED,
    read: async ref => { reads.push(ref); if (!documents[ref]) throw Error(`The kernel has no Expression ${ref}.`); return model.clone(documents[ref]) },
    mix: async (ref, set) => {
      writes.push([ref, set]);
      const mix = {...documents[ref].journey.mix};
      for (const [key, value] of Object.entries(set)) if (value === null) delete mix[key]; else mix[key] = value;
      documents[ref] = {...documents[ref], revision: documents[ref].revision + 1, journey: {...documents[ref].journey, mix}};
    }});
  return {layers, reads, writes};
}

test('item 4: a held Expression\'s Activator is read live: each launch reads the Expression afresh, so a change after it was held counts', async () => {
  const documents = {[TIDE]: expression(TIDE, 'Tide')};
  const {layers, reads} = field(documents);
  await layers.hold(TIDE);
  documents[TIDE] = {...documents[TIDE], revision: 5, journey: {...documents[TIDE].journey, mix: {active: false}}};
  await assert.rejects(async () => layers.start(TIDE, `${TIDE}:scene:s1`), {message: 'This Expression\'s Activator is off: its scenes do not launch.'},
    'switched off after it was held, its scene does not launch');
  assert.equal(layers.reading()[0].active, false, 'and the field reports it off');
  assert.equal(layers.reading()[0].revision, 5, 'as the document now stands');
  documents[TIDE] = {...documents[TIDE], revision: 6, journey: {...documents[TIDE].journey, mix: {}}};
  assert.equal(await layers.start(TIDE, `${TIDE}:scene:s1`), 'Tide 1 plays over the field.', 'switched on again while held, it launches');
  assert.equal(layers.reading()[0].active, true);
  assert.deepEqual(reads, [TIDE, TIDE, TIDE], 'one read at the hold and one at each launch');
});

test('slice 2: a held Expression\'s own mixer is written through its owner and read afresh; the field reports its Activator, Solo and Volume', async () => {
  const documents = {[TIDE]: expression(TIDE, 'Tide')};
  const {layers, writes, reads} = field(documents);
  await layers.hold(TIDE);
  assert.deepEqual(layers.reading()[0].mix, {active: true, solo: false, level: 1}, 'its mixer as its document keeps it, defaults where it keeps none');
  assert.equal(await layers.mix(TIDE, {active: false}), 'Tide\'s mixer is set.');
  assert.deepEqual(writes, [[TIDE, {active: false}]]);
  assert.equal(reads.length, 2, 'read afresh after the write');
  assert.deepEqual(layers.reading()[0].mix, {active: false, solo: false, level: 1});
  assert.equal(layers.reading()[0].active, false);
  await layers.mix(TIDE, {solo: true, level: 0.5});
  assert.deepEqual(layers.reading()[0].mix, {active: false, solo: true, level: 0.5});
  await layers.mix(TIDE, {active: null});
  assert.deepEqual(layers.reading()[0].mix, {active: true, solo: true, level: 0.5}, 'null returns a setting to its default');
  await assert.rejects(async () => layers.mix(REEF, {active: false}), {message: 'That Expression is not held over the field: hold it first.'});
  await assert.rejects(async () => layers.mix(TIDE, {level: 3}), {message: 'A sound level runs from silence to +6 dB.'}, 'the mixer\'s law, before any write');
  await assert.rejects(async () => layers.mix(TIDE, {main: 1}), {message: 'The Main level is the presented Expression\'s: set it on the Main track.'});
  assert.equal(writes.length, 3, 'a refused setting writes nothing');
  assert.deepEqual(layers.mixes(), new Map([[TIDE, {level: 0.5, main: 1, active: true, solo: true}]]), 'what the field sounds each held Expression at');
});

test('slice 2: the stage reads the mix act exactly, and the hosted reading carries each held Expression\'s mixer', () => {
  const read = command => stage.readStageRequest({v: 1, kind: 'host-command', req: 1, command: 'layer', ...command})?.command ?? null;
  assert.ok(stage.STAGE_LAYER_ACTIONS.includes('mix'));
  assert.deepEqual(read({action: 'mix', expression_ref: TIDE, set: {active: false}}), {command: 'layer', action: 'mix', expression_ref: TIDE, set: {active: false}});
  assert.deepEqual(read({action: 'mix', expression_ref: TIDE, set: {solo: true, level: 0.25, active: null}}),
    {command: 'layer', action: 'mix', expression_ref: TIDE, set: {solo: true, level: 0.25, active: null}});
  for (const bad of [{action: 'mix', expression_ref: TIDE}, {action: 'mix', expression_ref: TIDE, set: {}}, {action: 'mix', expression_ref: TIDE, set: {main: 1}},
    {action: 'mix', expression_ref: TIDE, set: {level: 'loud'}}, {action: 'mix', expression_ref: TIDE, set: {active: 'yes'}}, {action: 'mix', expression_ref: TIDE, set: [1]},
    {action: 'hold', expression_ref: TIDE, set: {active: false}}])
    assert.equal(read(bad), null, JSON.stringify(bad));
  const reading = [{expression_ref: TIDE, title: 'Tide', revision: 4, active: true, mix: {active: true, solo: false, level: 0.5},
    scenes: [{scene_ref: 's1', title: 'Tide 1', duration: 6}], playing: null}];
  assert.deepEqual(stage.readFieldLayers(reading), reading);
  for (const bad of [[{...reading[0], mix: {active: true, solo: false}}], [{...reading[0], mix: {active: true, solo: false, level: 9}}],
    [{...reading[0], mix: {active: true, solo: 'no', level: 1}}], [{...reading[0], mix: {active: false, solo: false, level: 1}}]])
    assert.equal(stage.readFieldLayers(bad), null, JSON.stringify(bad).slice(0, 120));
});

test('slice 3: each voice on the field sounds in the Main mix at its own Expression\'s level; switched off, silent; a Solo hears only the soloed', () => {
  const presented = sound.expressionMixOf({level: 0.8, main: 0.5});
  const heard = {muted: false, silenced: false, field: 0.25};
  const tide = sound.expressionMixOf({level: 0.5}), reef = sound.expressionMixOf({active: false});
  const layers = new Map([[TIDE, tide], [REEF, reef]]);
  const mixOf = (id, over = {}) => sound.voiceMixOf(id, over.presented ?? presented, over.layers ?? layers, {...heard, ...over.heard});
  assert.deepEqual(mixOf('symbol-1'), {muted: false, levels: {level: 0.8, main: 0.5, field: 0.25}}, 'a presented symbol: its own Expression\'s level × Main × Field');
  assert.deepEqual(mixOf(`${TIDE}#symbol-1`), {muted: false, levels: {level: 0.5, main: 0.5, field: 0.25}}, 'a held one\'s: its own level, under the one Main and Field');
  assert.equal(mixOf(`${REEF}#symbol-1`).muted, true, 'a held Expression switched off is silent');
  assert.equal(mixOf('symbol-1', {heard: {muted: true}}).muted, true, 'the field\'s Sound off silences everything on it');
  assert.equal(mixOf(`${TIDE}#symbol-1`, {heard: {muted: true}}).muted, true);
  const soloed = new Map([[TIDE, sound.expressionMixOf({level: 0.5, solo: true})], [REEF, sound.expressionMixOf({})]]);
  assert.equal(mixOf('symbol-1', {layers: soloed}).muted, true, 'another Expression on the field soloed: the presented one is not heard');
  assert.equal(mixOf(`${TIDE}#symbol-1`, {layers: soloed}).muted, false, 'the soloed one is');
  assert.equal(mixOf(`${REEF}#symbol-1`, {layers: soloed}).muted, true, 'and no other');
  assert.equal(mixOf('symbol-1', {layers: soloed, presented: sound.expressionMixOf({solo: true})}).muted, false, 'two soloed: both heard');
  assert.equal(mixOf('expression:gone#symbol-1').muted, false, 'a symbol named by no held Expression is the presented one\'s');
  // The field's own state: the held Expressions' mixers are told to it, and the presented one's Torus hears a held Solo.
  sound.setExpressionMix({});
  sound.setLayerMixes(new Map());
  assert.equal(sound.expressionSilencedHere(), false);
  const told = [];
  const stop = sound.onExpressionGain(gain => told.push(gain));
  sound.setLayerMixes(soloed);
  assert.equal(sound.expressionSilencedHere(), true, 'a held Expression soloed: the presented one is silent here, its Torus too');
  assert.equal(told.at(-1), 0);
  assert.deepEqual(sound.fieldVoiceMix(`${TIDE}#symbol-1`).levels.level, 0.5, 'the field reads each voice through the mixers told to it');
  sound.setLayerMixes(new Map());
  assert.equal(sound.expressionSilencedHere(), false);
  assert.ok(told.at(-1) > 0, 'let go, the presented one sounds again');
  stop();
});

test('slice 3: the native renderer\'s voices take each voice\'s own mix: a held Expression\'s symbol at its level, a switched-off one at nothing', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/ql-music-modes-trimmed.json', import.meta.url), 'utf8'));
  const parsed = parseModeCatalogue(structuredClone(fixture));
  assert.ok(parsed.ok, parsed.refusal);
  const nodes = [];
  const param = value => ({value, events: [], setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]) }, setTargetAtTime(v, t) { this.value = v; this.events.push(['target', v, t]) },
    linearRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]) }, cancelScheduledValues(t) { this.events.push(['cancel', t]) }});
  const node = (kind, extra = {}) => { const n = {kind, out: new Set(), connect(target) { this.out.add(target); return target }, disconnect(target) { if (target === undefined) this.out.clear(); else this.out.delete(target) }, ...extra}; nodes.push(n); return n };
  const context = {sampleRate: 48000, currentTime: 0, destination: {kind: 'destination', out: new Set()},
    createGain: () => node('gain', {gain: param(1)}), createBiquadFilter: () => node('biquad', {type: 'lowpass', frequency: param(350), Q: param(1)}),
    createStereoPanner: () => node('panner', {pan: param(0)}),
    createOscillator() { throw Error('no oscillator') }, createBufferSource() { throw Error('no source') }};
  const bank = new SymbolVoices(() => () => {});
  bank.attach({context, input: {kind: 'tap', out: new Set(), connect(t) { this.out.add(t); return t }, disconnect() {}}});
  const carry = {kind: 'mode', ref: "chromatic/L0'/aeolian"};
  const entities = [{id: 'a', sound: {enabled: true, carry, gain: 0.4, attack: 0.5, release: 2}}, {id: `${TIDE}#a`, sound: {enabled: true, carry, gain: 0.4, attack: 0.5, release: 2}},
    {id: `${REEF}#a`, sound: {enabled: true, carry, gain: 0.4, attack: 0.5, release: 2}}];
  const mixes = {a: {muted: false, levels: {level: 1, main: 0.5, field: 1}}, [`${TIDE}#a`]: {muted: false, levels: {level: 0.5, main: 0.5, field: 1}},
    [`${REEF}#a`]: {muted: true, levels: {level: 1, main: 0.5, field: 1}}};
  bank.sync({plan: sound.entitySoundPlan({entities}), catalogue: parsed.catalogue, catalogueWhy: null, root: {hz: 130.81279, absentBecause: null}, torusSilentBecause: null,
    places: new Map(entities.map(entity => [entity.id, 0])), muted: false, levels: {level: 1, main: 1}, mixOf: id => mixes[id]});
  const envelopes = nodes.filter(n => n.kind === 'gain' && n.out.size && [...n.out].every(t => t.kind === 'panner'));
  assert.equal(envelopes.length, 3, 'one envelope for each voice');
  const ramps = envelopes.map(env => env.gain.events.find(e => e[0] === 'ramp')[1]);
  const near = (actual, expected, what) => assert.ok(Math.abs(actual - expected) < 1e-9, `${what}: ${actual} is not ${expected}`);
  near(ramps[0], 0.4 * 1 * 0.5, 'the presented symbol: its gain × its level × Main');
  near(ramps[1], 0.4 * 0.5 * 0.5, 'the held one: its gain × its own level × Main');
  near(ramps[2], 0, 'the switched-off one: nothing');
  const production = readFileSync(join(journeys, 'src/production.ts'), 'utf8');
  assert.match(production, /mixOf:fieldVoiceMix/, 'the renderer hands its voices the field\'s mix of each');
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');
  assert.match(app, /setLayerMixes\(fieldLayers\.mixes\(\)\)/, 'the frame tells the field each held Expression\'s mixer');
});
