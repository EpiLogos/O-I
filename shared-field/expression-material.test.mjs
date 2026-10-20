import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterExpressionComposition, validateExpressionComposition, frozenExpressionHtml} from './expression-projection.mjs';
import {blankJourney, validateJourney} from '../packages/oi-design-system/expressions-engine/shell/model.mjs';

const authored = () => JSON.parse(readFileSync(new URL('../desktop/cradle/material/factory-expressions/scene/work-passage.expression.json', import.meta.url), 'utf8'));

test('publication preserves explicitly admitted native Factory scene, body and motion', () => {
  const doc = authored();
  const {composition} = filterExpressionComposition(doc, {include_scene_material: true});
  const held = composition.scenes[0].presentation;
  assert.equal(held?.schema, 'oi.journey-scene/v1');
  assert.deepEqual(held.scene.entities, doc.scenes[0].presentation.scene.entities);
  assert.deepEqual(held.scene.automation, doc.scenes[0].presentation.scene.automation);
  assert.deepEqual(held.scene.text, doc.scenes[0].presentation.scene.text);
  assert.deepEqual(validateExpressionComposition(composition), composition);
});

test('scene admission never copies adjacent native originals, credentials or unknown nested payloads', () => {
  const doc = authored(), material = doc.scenes[0].presentation.scene;
  material.native = {original: {private: 'PRIVATE-ORIGINAL'}, config: {secret: 'PRIVATE-CONFIG'}};
  material.privateNote = 'PRIVATE-NOTE';
  material.entities[0].native = {private: 'PRIVATE-ENTITY'};
  material.entities[0].sequence.steps[0].unknown = 'PRIVATE-STEP';
  material.engine.credentials = 'PRIVATE-CREDENTIAL';
  const {composition} = filterExpressionComposition(doc, {include_scene_material: true});
  assert.doesNotMatch(JSON.stringify(composition), /PRIVATE-/);
  assert.equal(filterExpressionComposition(doc).composition.scenes[0].presentation, undefined);
});

test('admission refuses an absent or foreign required native body instead of synthesising one', () => {
  const doc = authored();
  doc.scenes[0].presentation.scene.entities.pop();
  assert.throws(() => filterExpressionComposition(doc, {include_scene_material: true}), /body|occurrence/i);
  const foreign = authored();
  foreign.scenes[0].presentation.scene.entities[0].id = 'expression:neighbour:entity:private';
  assert.throws(() => filterExpressionComposition(foreign, {include_scene_material: true}), /body|occurrence/i);
});

test('receiving admission rejects unknown material payloads and duplicate native occurrences', () => {
  const {composition} = filterExpressionComposition(authored(), {include_scene_material: true});
  composition.scenes[0].presentation.scene.entities[0].private = 'private';
  assert.throws(() => validateExpressionComposition(composition), /unsupported|unknown/i);
  const next = filterExpressionComposition(authored(), {include_scene_material: true}).composition;
  next.scenes[0].presentation.scene.entities[1].id = next.scenes[0].presentation.scene.entities[0].id;
  assert.throws(() => validateExpressionComposition(next), /body|occurrence|duplicate/i);
});

test('static edition retains the actual admitted glyph and authored inscriptions without effect code', () => {
  const doc = authored();
  doc.scenes[0].presentation.scene.text[0].title = 'Carry the explanation to review';
  const {composition} = filterExpressionComposition(doc, {include_scene_material: true});
  const html = frozenExpressionHtml(composition);
  assert.match(html, /▤/);
  assert.match(html, /Carry the explanation to review/);
  assert.doesNotMatch(html, /<script|onload=|onclick=/i);
});

test('static edition uses admitted native bodies when earlier scalar parameters disagree', () => {
  const doc = authored();
  const body = doc.scenes[0].presentation.scene.entities[0];
  doc.entities[body.id].parameters = {glyph: {value: 'OBSOLETE', automation: null}, share: {value: 0, automation: null}};
  const html = frozenExpressionHtml(filterExpressionComposition(doc, {include_scene_material: true}).composition);
  assert.doesNotMatch(html, /OBSOLETE/);
  assert.ok(html.includes('>' + body.text + '</span>'));
});

// ME2 (DLW §20.2): the Torus driver, the Key source, Symbol voices and a symbol's voice reach the audience as plain data. A voice is a name or a
// mode carrying the torus's sound, never its own oscillator, so the oscillator's fields are not part of what travels.
const newScene = () => {
  const doc = authored(), material = doc.scenes[0].presentation.scene;
  Object.assign(material.composition, {frequencyDriver: 'torus', keySource: 'torus', symbolVoices: true});
  // A voice that carries a mode, and one that was written for an oscillator and migrated (it carries nothing, and is silent until chosen).
  material.entities[0].sound = {enabled: true, carry: {kind: 'mode', ref: 'maqam/00'}, gain: 0.3, attack: 0.05, release: 1.5};
  material.entities[1].sound = {enabled: true, gain: 0.3, attack: 0.12, release: 1.1};
  return doc;
};

test('a new scene (Torus driver, Torus key, a migrated voice) is admitted for an audience and reloads unchanged', () => {
  const doc = newScene(), held = doc.scenes[0].presentation.scene;
  const {composition} = filterExpressionComposition(doc, {include_scene_material: true});
  const admitted = composition.scenes[0].presentation.scene;
  assert.equal(admitted.composition.frequencyDriver, 'torus');
  assert.equal(admitted.composition.keySource, 'torus');
  assert.equal(admitted.composition.symbolVoices, true);
  assert.deepEqual(admitted.entities[0].sound, held.entities[0].sound);
  assert.deepEqual(admitted.entities[1].sound, held.entities[1].sound, 'the migrated voice travels as it is: no carry, and silent for the audience too');
  const reloaded = validateExpressionComposition(composition);
  assert.deepEqual(reloaded, composition, 'what the receiver admits is what was published');
  assert.deepEqual(validateExpressionComposition(filterExpressionComposition({...doc}, {include_scene_material: true}).composition), composition);
});

test('the audience\'s copy of the model admits a new scene as it is made (Torus driver, Torus key) and migrates a voice written for an oscillator, as the application does', () => {
  // site/src/expression/ExpressionApp.tsx imports this validateJourney: the vendored model is compiled from field-studies-journeys/src/model.ts.
  const fresh = blankJourney();
  assert.deepEqual([fresh.scenes[0].composition.frequencyDriver, fresh.scenes[0].composition.keySource], ['torus', 'torus']);
  assert.doesNotThrow(() => validateJourney(JSON.parse(JSON.stringify(fresh))));
  const old = JSON.parse(JSON.stringify(fresh));
  old.scenes[0].entities = [{...authored().scenes[0].presentation.scene.entities[0], sound: {enabled: true, followCymatic: false, frequencyHz: 330, gain: 0.3, waveform: 'triangle', attack: 0.12, release: 1.1, pan: -0.2}}];
  const opened = validateJourney(old);
  assert.deepEqual(opened.scenes[0].entities[0].sound, {enabled: true, gain: 0.3, attack: 0.12, release: 1.1});
  assert.deepEqual(opened.soundMigration[0].dropped.map(d => d.field), ['frequencyHz', 'followCymatic', 'waveform', 'pan']);
});

test('a voice written for an oscillator is published without its oscillator fields and a receiver refuses them', () => {
  const doc = newScene();
  doc.scenes[0].presentation.scene.entities[1].sound = {enabled: true, frequencyHz: 330, followCymatic: false, waveform: 'triangle', gain: 0.3, pan: -0.2, attack: 0.12, release: 1.1};
  const {composition} = filterExpressionComposition(doc, {include_scene_material: true});
  assert.deepEqual(composition.scenes[0].presentation.scene.entities[1].sound, {enabled: true, gain: 0.3, attack: 0.12, release: 1.1},
    'the publisher\'s admission drops the four fields (and the vendored validator migrates what is left)');
  const forged = structuredClone(composition);
  forged.scenes[0].presentation.scene.entities[1].sound.frequencyHz = 330;
  assert.throws(() => validateExpressionComposition(forged), /unsupported|unknown/i, 'a receiver refuses an oscillator it was not sent');
  const odd = newScene();
  odd.scenes[0].presentation.scene.entities[0].sound.carry = {kind: 'oscillator', ref: 'x'};
  assert.throws(() => filterExpressionComposition(odd, {include_scene_material: true}), /Invalid entity sound|carry/i);
  const off = newScene();
  off.scenes[0].presentation.scene.composition.symbolVoices = 'off';
  assert.throws(() => filterExpressionComposition(off, {include_scene_material: true}), /Invalid composition/);
});
