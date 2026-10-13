// lane-5 T21: presentation persistence for the Palace and the Journey.
//   The Palace's arrangement, walk position and bookmarks persist under their own key, keyed by subject and reading,
//   validated strictly on restore; standing is disclosed (current / field-advanced / stale); a corrupt payload restores
//   nothing; refused storage degrades to an unpersisted session, told once. Only refs and presentation values are stored.
// Run after `npm run build:journeys` (the Journey presence module is read from build/).
import test from 'node:test';
import assert from 'node:assert/strict';
import {provingReading} from '../../../src/techne/m0m5/journey/proving-reading.ts';
import {placeAt, addBookmark, deriveComposition, palaceComposition, resetPalaceCompositions} from '../../../src/techne/m0m5/palace/palace-state.ts';
import {
  PALACE_PRESENCE_KEY, PALACE_FIELD_ADVANCED_NOTICE, PALACE_STALE_NOTICE, PALACE_UNPERSISTED_NOTICE,
  loadPalacePresence, restorePalaceComposition, savePalaceComposition,
} from '../../../src/techne/m0m5/palace/presence.ts';
import {reconcileJourneyPresence} from '../build/journeyPresence.js';

function memoryStorage(seed) {
  const map = new Map(seed === undefined ? [] : [[PALACE_PRESENCE_KEY, seed]]);
  return {map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value))};
}
const refusedStorage = () => ({getItem() { throw new Error('storage refused'); }, setItem() { throw new Error('storage refused'); }});
const byRef = (rows) => [...rows].sort((a, b) => a.ref.localeCompare(b.ref));

function arranged() {
  const reading = provingReading();
  const base = deriveComposition(reading);
  const region = base.regions.find((candidate) => candidate.entries.length >= 2);
  const [first, second] = region.entries;
  let composition = placeAt(base, region.key, first.ref, {room: {column: 2, row: 1}, locus: 3});
  composition = addBookmark(composition, region.key, first.ref);
  composition = addBookmark(composition, region.key, second.ref);
  composition = {...composition, walk_index: 1};
  return {reading, region, first, second, composition};
}

test('T21: an arrangement, its walk position and two bookmarks survive a reload with a current standing', () => {
  resetPalaceCompositions();
  const {reading, region, composition} = arranged();
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, composition, reading), true);
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.standing, 'current');
  assert.equal(restored.notice, undefined);
  assert.equal(restored.persisted, true);
  assert.equal(restored.composition.walk_index, 1);
  assert.equal(restored.composition.bookmarks.length, 2);
  assert.deepEqual(restored.composition.bookmarks, composition.bookmarks);
  assert.deepEqual(byRef(restored.composition.placements[region.key]), byRef(composition.placements[region.key]));
  assert.deepEqual(palaceComposition(reading).bookmarks, composition.bookmarks, 'the session composition now holds the restored state');
});

test('T21: what is stored is refs and presentation values only, never a reading, a region or a document', () => {
  resetPalaceCompositions();
  const {reading, composition} = arranged();
  const storage = memoryStorage();
  savePalaceComposition(storage, composition, reading);
  const entries = JSON.parse(storage.map.get(PALACE_PRESENCE_KEY));
  const [entry] = Object.values(entries);
  assert.deepEqual(Object.keys(entry).sort(), ['bookmarks', 'bound', 'expressions', 'placements', 'reading_ref', 'schema', 'snapshot_revision', 'subject_ref', 'walk_index'].sort());
  assert.equal(entry.reading_ref, reading.reading_ref);
  assert.equal(entry.subject_ref, reading.subject.subject_ref);
  assert.ok(!('regions' in entry) && !('reading' in entry));
});

test('T21: a field that moved while away is disclosed once and the arrangement is kept where its refs still stand', () => {
  resetPalaceCompositions();
  const {reading, composition} = arranged();
  const storage = memoryStorage();
  savePalaceComposition(storage, composition, reading);
  resetPalaceCompositions();
  const moved = structuredClone(reading);
  moved.snapshot = {...moved.snapshot, revision: 'rev-advanced'};
  const restored = restorePalaceComposition(moved, storage);
  assert.equal(restored.standing, 'field-advanced');
  assert.equal(restored.notice, PALACE_FIELD_ADVANCED_NOTICE);
  assert.equal(restored.composition.bookmarks.length, 2);
});

test('T21: a palace saved for another reading is stale: disclosed, dropped, and never restored as current', () => {
  resetPalaceCompositions();
  const {reading, composition} = arranged();
  const storage = memoryStorage();
  savePalaceComposition(storage, composition, reading);
  resetPalaceCompositions();
  const other = structuredClone(reading);
  other.reading_ref = 'ql.techne:reading:another';
  const restored = restorePalaceComposition(other, storage);
  assert.equal(restored.standing, 'stale');
  assert.equal(restored.notice, PALACE_STALE_NOTICE);
  assert.deepEqual(restored.composition.bookmarks, [], 'the stale arrangement is not handed back');
});

test('T21: a corrupt or foreign payload restores nothing and raises no error', () => {
  resetPalaceCompositions();
  const {reading} = arranged();
  for (const payload of ['{not json', JSON.stringify({a: {schema: 'other/v1'}}), JSON.stringify([1, 2])]) {
    resetPalaceCompositions();
    const storage = memoryStorage(payload);
    assert.deepEqual(loadPalacePresence(storage), {});
    const restored = restorePalaceComposition(reading, storage);
    assert.equal(restored.standing, 'none');
    assert.equal(restored.composition.bookmarks.length, 0);
  }
});

test('T21: a drifted entry is dropped, not repaired; its valid neighbours still restore', () => {
  resetPalaceCompositions();
  const {reading, region, first, composition} = arranged();
  const storage = memoryStorage();
  savePalaceComposition(storage, composition, reading);
  const entries = JSON.parse(storage.map.get(PALACE_PRESENCE_KEY));
  const key = Object.keys(entries)[0];
  entries[key].bookmarks.push({region: region.key, ref: 'expression:no-longer-in-the-reading', locus: null});
  storage.map.set(PALACE_PRESENCE_KEY, JSON.stringify(entries));
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.composition.bookmarks.length, 2, 'the drifted bookmark is dropped');
  assert.ok(restored.composition.bookmarks.some((bookmark) => bookmark.ref === first.ref));
});

test('T21: refused storage degrades to an unpersisted session, told once, and the palace still works', () => {
  resetPalaceCompositions();
  const {reading, composition} = arranged();
  assert.equal(savePalaceComposition(refusedStorage(), composition, reading), false);
  assert.equal(savePalaceComposition(null, composition, reading), false);
  for (const storage of [refusedStorage(), null]) {
    resetPalaceCompositions();
    const restored = restorePalaceComposition(reading, storage);
    assert.equal(restored.persisted, false);
    assert.equal(restored.standing, 'none');
    assert.equal(restored.notice, PALACE_UNPERSISTED_NOTICE);
    assert.equal(restored.composition.regions.length, composition.regions.length, 'the session composition is still derived');
  }
});

test('T21 (Journey, unchanged): refused storage leaves the Journey position silent, as T9 pins it; the told-once is OPEN for the Journey', () => {
  // journey-presence.test.mjs (T9) pins `notice === undefined` for an unavailable store. This guard keeps that established
  // silence; the Journey's own told-once is reported OPEN until that pin is revisited by its owner.
  const reading = {contract: 'ql.techne/v1', reading_ref: 'ql.techne:reading:probe', snapshot: {revision: 'rev-1', basis_ref: null},
    subject: {subject_ref: 'expression:probe', native_owner: 'oi.cradle.kernel', kind: 'expression-scene'}};
  const refused = reconcileJourneyPresence({reading, expression_ref: 'expression:probe', scene_ref: 'expression:probe:scene:one', storage: refusedStorage()});
  assert.equal(refused.standing, 'none');
  assert.equal(refused.notice, undefined);
});
