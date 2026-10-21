// W6: what the frame holds of the live scene and its field, announced to the shell and admitted exactly. The live scene's M2 condition
// (its tattva coordinate and material fibre, verbatim from the coupled basis the native field inspected) rides the hosted state as
// `instrumentCondition`; the field engine's morph phases (its telemetry drive.theta and drive.phi) and the resonance plate's stations
// (its stations()) ride the editor reading's observation. A malformed one refuses the whole reading, as every field of these readers does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readHostedState} from '../src/index.ts';
import {reading} from '../src/editorHost.ts';
import {conditionReadingOf, readFrameCondition} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/instrumentCondition.ts';

// REAL (packages/live-shell/ui/tests/fixtures/field-announcements-2026-10-21.json): the installed ql's scene world basis
// m2.condition.source_path, and the stations the frame's own engine code computes.
const fixture = JSON.parse(readFileSync(new URL('../../live-shell/ui/tests/fixtures/field-announcements-2026-10-21.json', import.meta.url), 'utf8'));

test('the live scene\'s M2 condition is read verbatim from the sources the native field inspected, and admitted exactly', () => {
  const condition = conditionReadingOf({original: {}, current: {m2: {condition: {source_path: fixture.source_path}}}});
  assert.deepEqual(condition, {tattva_ref: '#2-2-2-5-5', material_fibre: 'earth'}, 'the tattva by its coordinate, the fibre as QL gives it');
  assert.equal(conditionReadingOf({current: {m2: {}}}), undefined, 'no condition path: nothing is announced');
  assert.deepEqual(conditionReadingOf({current: {m2: {condition: {source_path: {tattva_coordinate: null, material_fibre: null}}}}}), {tattva_ref: null, material_fibre: null});
  const state = readHostedState({hostMode: 'techne', sceneIndex: 0, sceneCount: 1, instrumentCondition: condition});
  assert.deepEqual(state.instrumentCondition, condition, 'the host admits it');
  for (const bad of [{tattva_ref: '#2-2-2-5-5'}, {tattva_ref: 'Prithvi', material_fibre: 'earth'}, {tattva_ref: '#2-2-2-5-5', material_fibre: 'ether'},
    {tattva_ref: '#2-2-2-5-5', material_fibre: 'earth', name: 'Prithvi'}]) {
    assert.equal(readFrameCondition(bad), null, JSON.stringify(bad));
    assert.equal(readHostedState({hostMode: 'techne', sceneIndex: 0, sceneCount: 1, instrumentCondition: bad}), null, `${JSON.stringify(bad)}: the whole state is refused`);
  }
  assert.equal(readHostedState({hostMode: 'techne', sceneIndex: 0, sceneCount: 1}).instrumentCondition, undefined, 'absent is valid');
});

const editorReading = observation => ({
  basis: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:1', authored_revision: 2},
  scene: {id: 'scene:1', name: 'Plate', engine: {}, field: {params: {}}, composition: {}, morph: {}, entities: []},
  history: {canUndo: false, canRedo: false}, selection: {entity_ids: [], step_id: null}, standing: {dirty: false, pending: false, notice: null},
  entityOccurrences: {}, chosenControls: {available: false, entries: [], controls: []}, ...(observation !== undefined ? {observation} : {}),
});

test('the engine\'s morph phases and the plate\'s stations ride the editor reading\'s observation, admitted exactly', () => {
  assert.equal(reading(editorReading(undefined)), true, 'a reading with no observation is still a reading');
  assert.equal(reading(editorReading({fieldPaused: false, simTime: 2.5})), true, 'an observation with neither is still admitted');
  // The phases are two numbers the engine reports; the stations are the engine's own, verbatim (fixture).
  assert.equal(reading(editorReading({phases: {theta: 7.4, phi: 2.1}, stations: fixture.stations})), true);
  assert.equal(fixture.stations.length, 7, 'the plate\'s seven anchors');
  for (const bad of [{phases: {theta: 1}}, {phases: {theta: 1, phi: Infinity}}, {phases: {theta: 1, phi: 2, signal: 0}}, {stations: [{index: 0, name: 'Mode 1:1', frequencyHz: 80, m: 1, n: 1}]},
    {stations: [{...fixture.stations[0], frequencyHz: -1}]}, {stations: [{...fixture.stations[0], extra: true}]}, {stations: Array.from({length: 65}, () => fixture.stations[0])}])
    assert.equal(reading(editorReading(bad)), false, JSON.stringify(bad).slice(0, 80));
});
