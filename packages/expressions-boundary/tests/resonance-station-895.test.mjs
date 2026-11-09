// O-I #747 round 895, the port ledger's tune-station (DLW build ruling 2026-11-08): the app's station tick (app.ts case 'tune-station')
// tunes the plate to one of the engine's own stations in one labelled step, "Tune frequency": the drive frequency to the station's Hz,
// the Frequency driver to Manual, the sweep off, and every automation lane on field.frequency disabled. The owner's change is
// `resonance-station` (nativeResonanceStation.ts): the index is resolved against the engine's own station list, never a list the shell
// sends, and an index the engine does not hold is refused in words. Run by tests/run-tests.mjs (register-production-sources.mjs).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {applyNativeResonanceStation, TUNE_STATION_LABEL, validateResonanceStation} from '../src/nativeResonanceStation.ts';
import {parameterAddresses} from '../src/parameterAddress.ts';
import {blankJourney, clone, uid, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';

const author = new URL('../../../desktop/cradle/expressions-app/field-studies-journeys/src/', import.meta.url);
/** The engine's stations as it reports them (engine.ts stations(): index, name, Hz, mode). */
const STATIONS = [{index: 0, name: 'Station 1', frequencyHz: 200, m: 1, n: 2, color: '#aa0000'}, {index: 1, name: 'Station 2', frequencyHz: 400, m: 1, n: 3, color: '#00aa00'},
  {index: 2, name: 'Station 3', frequencyHz: 520, m: 2, n: 3, color: '#0000aa'}];
/** A scene the Torus drives, sweeping, with a frequency lane and one other lane. */
function sweeping() {
  const journey = blankJourney(), scene = journey.scenes[0];
  scene.composition.frequencyDriver = 'automation';
  scene.engine.autoSweep = true;
  const lane = (target, min, max) => ({id: uid('auto'), target, enabled: true, type: 'lfo', wave: 'sine', rate: 0.2, phase: 0, min, max, blend: 'replace',
    duration: 4, delay: 0, loop: 'loop', firedAt: null});
  scene.automation = [lane('field.frequency', 100, 900), lane('field.dominance', 0, 1)];
  validateJourney(journey);
  return journey;
}
const tune = station_index => ({kind: 'resonance-station', station_index});

test('a station tune writes what the app\'s tune writes, as one edit: the drive at the station\'s Hz, Manual, the sweep off, the frequency lanes off', () => {
  const before = sweeping(), scene = before.scenes[0];
  const after = applyNativeResonanceStation(before, scene.id, [tune(2)], STATIONS);
  const tuned = after.scenes[0];
  assert.equal(tuned.field.params.frequency, 520, 'the station\'s own frequency');
  assert.equal(tuned.composition.frequencyDriver, 'manual');
  assert.equal(tuned.engine.autoSweep, false);
  assert.deepEqual(tuned.automation.map(lane => [lane.target, lane.enabled]), [['field.frequency', false], ['field.dominance', true]], 'only the frequency lanes are disabled');
  assert.equal(before.scenes[0].composition.frequencyDriver, 'automation', 'the journey sent is not changed in place');
  validateJourney(after);
});

test('the engine\'s own stations decide: an index it does not hold, no stations at all, or a malformed change is refused, and nothing changes', () => {
  const before = sweeping(), scene = before.scenes[0], kept = clone(before);
  assert.throws(() => applyNativeResonanceStation(before, scene.id, [tune(7)], STATIONS), /no station 8.*1 to 3/i);
  assert.throws(() => applyNativeResonanceStation(before, scene.id, [tune(0)], []), /computes no stations/i);
  assert.throws(() => applyNativeResonanceStation(before, scene.id, [tune(0)], undefined), /computes no stations/i);
  assert.throws(() => applyNativeResonanceStation(before, scene.id, [tune(1.5)], STATIONS), /station by its number/i);
  assert.throws(() => applyNativeResonanceStation(before, scene.id, [{...tune(0), frequencyHz: 9000}], STATIONS), /carries only the station/i);
  assert.throws(() => applyNativeResonanceStation(before, scene.id, [tune(0), tune(1)], STATIONS), /one station at a time/i);
  assert.throws(() => applyNativeResonanceStation(before, 'scene:gone', [tune(0)], STATIONS), /no longer in this Expression/);
  assert.deepEqual(before, kept);
  assert.equal(validateResonanceStation(tune(2)), 2);
});

test('through the retained editor, a station tune is one step labelled "Tune frequency", resolved against the engine\'s stations, and sent alone', async () => {
  const [{DocumentStore}, {createRetainedNativeEditor}, {kernelDocumentToJourney}] = await Promise.all([
    import(new URL('store.ts', author)), import(new URL('hostEditor.ts', author)), import(new URL('kernelDocumentBridge.ts', author))]);
  const ref = 'expression:tune';
  const document = {schema: 'oi.expression/v1', expression_ref: ref, revision: 1, title: 'Tune', scenes: [{scene_ref: ref + ':scene:main', revision: 1, title: 'Main', entity_refs: []}],
    entities: {}, relations: {}, selection: {scene_ref: ref + ':scene:main', entity_ref: null}, provenance: [], representations: []};
  const view = kernelDocumentToJourney(document);
  const store = new DocumentStore(view.journey);
  const presented = store.document.scenes[0];
  presented.composition.frequencyDriver = 'automation'; presented.engine.autoSweep = true;
  const labels = [];
  let engine = STATIONS;
  const owner = createRetainedNativeEditor({
    store, sceneId: () => presented.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: async () => 'applied', commit: async () => true, change: (label, mutate) => { labels.push(label); mutate() }, afterHistory: () => {}, selectLocal: () => {}, openEditor: () => {},
    standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false, stations: () => engine,
  });
  const reading = owner.read();
  assert.deepEqual(reading.observation.stations.map(row => row.index), [0, 1, 2], 'the engine\'s stations are what the reading discloses');
  await owner.apply({operation: 'apply', basis: reading.basis, changes: [tune(1)]});
  assert.deepEqual(labels, [TUNE_STATION_LABEL], 'one step, with the app\'s label');
  assert.equal(TUNE_STATION_LABEL, 'Tune frequency');
  assert.equal(store.document.scenes[0].field.params.frequency, 400);
  assert.equal(store.document.scenes[0].composition.frequencyDriver, 'manual');
  assert.equal(store.document.scenes[0].engine.autoSweep, false);
  // The engine's list now holds two stations: index 2 is no longer the engine's, whatever the shell last read.
  engine = STATIONS.slice(0, 2);
  await assert.rejects(owner.apply({operation: 'apply', basis: owner.read().basis, changes: [tune(2)]}), /no station 3/i);
  await assert.rejects(owner.apply({operation: 'apply', basis: owner.read().basis, changes: [tune(0), {kind: 'field-material', value: 'ink'}]}), /one step of its own/i);
  assert.deepEqual(labels, [TUNE_STATION_LABEL], 'a refusal makes no step');
});

test('a station tune addresses the drive frequency, the driver and the sweep, as the parameter classifier names them', () => {
  const {addresses, structural} = parameterAddresses(tune(0));
  assert.equal(structural, undefined);
  assert.ok(addresses.every(row => row.family === 'resonance'), 'Resonance\'s values');
  assert.deepEqual(addresses.map(row => row.writePath).sort(), ['composition.frequencyDriver', 'engine.autoSweep', 'field.params.frequency']);
});

test('the change is the app\'s own tune: app.ts still writes the same four things under the same label', async () => {
  const app = await readFile(new URL('app.ts', author), 'utf8');
  assert.match(app, /case 'tune-station':\{const station=engine\.stations\?\.\(\)\.find\(x=>x\.index===Number\(el\.dataset\.index\)\);if\(station\)changed\(\(\)=>\{s\.field\.params\.frequency=station\.frequencyHz;s\.composition\.frequencyDriver='manual';s\.engine\.autoSweep=false;s\.automation\.filter\(l=>l\.target==='field\.frequency'\)\.forEach\(l=>l\.enabled=false\);\},true,'Tune frequency'\);break;\}/);
});
