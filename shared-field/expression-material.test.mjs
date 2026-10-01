import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterExpressionComposition, validateExpressionComposition, frozenExpressionHtml} from './expression-projection.mjs';

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
