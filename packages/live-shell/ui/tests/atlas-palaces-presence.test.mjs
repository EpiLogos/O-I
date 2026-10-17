// lane-5 T15 x T21: the palace's held points and viewport persist through the palace's own presence owner. Moved from the frame's
// field-studies-journeys/tests/palace-board-presence.test.mjs with its module (T-PALACES-ONTO-ATLAS; board.ts is the owner seam's
// now, desktop/cradle/src/techne/m0m5/palace/). Retired with the frame's board view, each replaced: 'one board gesture is one apply …'
// and 'the board saves on the gesture end only …' → atlas-palaces-session.test.mjs 'a floor drag is one move, saved once …' (the floor
// holds a drag as its own preview and hands the release to the session once); 'the parent saves the board once per gesture, and
// restores it on mount …' → atlas-palaces-session.test.mjs 'entering restores the saved arrangement …'.
//   - an entry saved before the board carries no board or viewport, and loads unchanged;
//   - a move, then reopen, restores the same positions and viewport through the real save and restore;
//   - a non-finite board point is refused by name, and its entry is not restored;
//   - one board gesture is one apply (one save), and the kernel document is byte-identical across moves and the save.
import test from 'node:test';
import assert from 'node:assert/strict';
import {provingReading} from '../../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts';
import {deriveComposition, palaceComposition, resetPalaceCompositions, storeComposition} from '../../../../desktop/cradle/src/techne/m0m5/palace/palace-state.ts';
import {
  PALACE_PRESENCE_KEY, loadPalacePresence, refusedBoardPoint, restorePalaceComposition, savePalaceComposition,
} from '../../../../desktop/cradle/src/techne/m0m5/palace/presence.ts';
import {discoverRegions, planRegions} from '../../../../desktop/cradle/src/techne/m0m5/palace/composition.ts';
import {boardPositions, moveBoardRegion, snapBoardPoint, validateBoardPositions} from '../../../../desktop/cradle/src/techne/m0m5/palace/board.ts';

const NAMES = ['Walk', 'Gate', 'Night'];

function memoryStorage() {
  const map = new Map();
  return {map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value))};
}

// A kernel-shaped Palace document: two region Scenes with one contained Expression each, one of them with its portal trigger.
function kernelDocument() {
  return {
    expression_ref: 'expression:palace-board',
    revision: 4,
    scenes: [
      {
        scene_ref: 'expression:palace-board:scene:region-Walk', title: 'Walk',
        body: {carrier: 'expression_ref', subject_ref: 'expression:walk'},
        triggers: [{trigger_ref: 'expression:palace-board:trigger:region-Walk-portal', target: {kind: 'portal', subject_ref: 'expression:walk'}}],
      },
      {scene_ref: 'expression:palace-board:scene:region-Gate', title: 'Gate', body: null},
      {scene_ref: 'expression:palace-board:scene:region-Night', title: 'Night', body: null},
    ],
  };
}

test('an entry saved before the board carries no board or viewport, and loads unchanged', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const base = deriveComposition(reading);
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, palaceComposition(reading), reading), true);
  const stored = JSON.parse(storage.map.get(PALACE_PRESENCE_KEY));
  const [entry] = Object.values(stored);
  assert.deepEqual(
    Object.keys(entry).sort(),
    ['bookmarks', 'bound', 'expressions', 'placements', 'reading_ref', 'schema', 'snapshot_revision', 'subject_ref'],
    'the pre-T15 entry shape is unchanged: no board, no viewport',
  );
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.standing, 'current');
  assert.equal(restored.composition.board, undefined);
  assert.equal(restored.composition.viewport, undefined);
  assert.deepEqual(restored.composition.placements, base.placements, 'the arrangement still restores as before');
});

test('a ref a region names twice keeps each of its own saved loci on restore, never the last one', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const base = deriveComposition(reading);
  const rows = base.placements.expression;
  const refs = rows.map((row) => row.ref);
  const second = refs.findIndex((ref, index) => refs.indexOf(ref) !== index);
  assert.ok(second >= 0, 'the fixture names one Expression twice in the region');
  const first = refs.indexOf(refs[second]);
  const moved = rows.map((row, index) => (index === second ? {...row, locus: {room: {column: 2, row: 1}, locus: 3}} : row));
  const composition = {...palaceComposition(reading), placements: {...base.placements, expression: moved}};
  storeComposition(composition);
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, composition, reading), true);
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.deepEqual(restored.composition.placements.expression, moved, 'each occurrence restores its own locus');
  assert.notDeepEqual(restored.composition.placements.expression[first].locus, restored.composition.placements.expression[second].locus);
});

test('a move, then reopen, restores the same positions and viewport through the real save and restore', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  let held = {};
  held = moveBoardRegion(held, NAMES, 'Walk', {x: 700, y: 300});
  held = moveBoardRegion(held, NAMES, 'Gate', snapBoardPoint({x: 412, y: 88}, true));
  held = moveBoardRegion(held, NAMES, 'Night', {x: -120, y: 640});
  const viewport = {x: -40, y: 12, zoom: 1.25};
  const moved = {...palaceComposition(reading), board: held, viewport};
  storeComposition(moved);
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, moved, reading), true);

  resetPalaceCompositions(); // reopen in a new session: nothing is held in memory
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.standing, 'current');
  assert.deepEqual(validateBoardPositions(restored.composition.board, NAMES), held, 'the same positions come back');
  assert.deepEqual(restored.composition.viewport, viewport, 'the same viewport comes back');
  assert.deepEqual(boardPositions(NAMES, restored.composition.board), held);
});

test('on reopen a held point for a region the Palace no longer holds is dropped, never repaired', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const held = {Walk: {x: 100, y: 100}, Gone: {x: 5, y: 5}};
  const moved = {...palaceComposition(reading), board: held};
  storeComposition(moved);
  const storage = memoryStorage();
  savePalaceComposition(storage, moved, reading);
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.deepEqual(validateBoardPositions(restored.composition.board, ['Walk', 'Gate']), {Walk: {x: 100, y: 100}});
});

test('a non-finite board point is refused by name, and its entry is not restored', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const held = moveBoardRegion({}, NAMES, 'Gate', {x: 412, y: 88});
  const moved = {...palaceComposition(reading), board: {...held, Walk: {x: 1, y: 2}}};
  storeComposition(moved);
  const storage = memoryStorage();
  savePalaceComposition(storage, moved, reading);

  // JSON writes a NaN or an infinite coordinate as null: that is what a corrupt store holds.
  const payload = JSON.parse(storage.map.get(PALACE_PRESENCE_KEY));
  const [entry] = Object.values(payload);
  entry.board.Gate.x = null;
  assert.equal(refusedBoardPoint(entry), 'Gate', 'the refusal names the region whose point is not finite');
  storage.map.set(PALACE_PRESENCE_KEY, JSON.stringify(payload));
  assert.deepEqual(loadPalacePresence(storage), {}, 'the whole entry is refused');
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.standing, 'none');
  assert.equal(restored.composition.board, undefined);
});

test('a non-positive or non-finite viewport zoom is refused as a whole entry', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const moved = {...palaceComposition(reading), viewport: {x: 0, y: 0, zoom: 1}};
  storeComposition(moved);
  const storage = memoryStorage();
  savePalaceComposition(storage, moved, reading);
  const payload = JSON.parse(storage.map.get(PALACE_PRESENCE_KEY));
  const [entry] = Object.values(payload);
  entry.viewport.zoom = 0;
  storage.map.set(PALACE_PRESENCE_KEY, JSON.stringify(payload));
  assert.deepEqual(loadPalacePresence(storage), {});
});

test('the kernel document stays byte-identical across the moves and the save', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const doc = kernelDocument();
  const regions = discoverRegions(doc);
  const names = regions.map((region) => region.name);
  const before = JSON.stringify(doc);
  const planBefore = planRegions(doc, regions, []);

  // Two gestures on the floor: three rooms, then one, each released once.
  let held = {};
  const release = (points) => {
    for (const [name, point] of Object.entries(points)) held = moveBoardRegion(held, names, name, point);
  };
  release({Walk: {x: 700, y: 300}, Gate: snapBoardPoint({x: 412, y: 88}, true), Night: {x: -120, y: 640}});
  release({Walk: {x: 900, y: 40}});

  // The save: the composition with the board is written to the presence owner, then read back in a new session.
  const storage = memoryStorage();
  const moved = {...palaceComposition(reading), board: held, viewport: {x: 0, y: 0, zoom: 1}};
  storeComposition(moved);
  assert.equal(savePalaceComposition(storage, moved, reading), true);
  resetPalaceCompositions();
  restorePalaceComposition(reading, storage);

  assert.equal(JSON.stringify(doc), before, 'the Palace document is byte-identical across the moves and the save');
  assert.equal(JSON.stringify(planBefore), JSON.stringify(planRegions(doc, regions, [])), 'the region plan is unchanged');
  assert.equal(planRegions(doc, regions, []), null, 'nothing is planned to save for the document');
});

test('an entry the next load would refuse is never saved: the last good entry stands', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const storage = memoryStorage();
  const good = {...palaceComposition(reading), board: {Walk: {x: 10, y: 20}}, viewport: {x: 0, y: 0, zoom: 1}};
  assert.equal(savePalaceComposition(storage, good, reading), true);
  const before = storage.getItem(PALACE_PRESENCE_KEY);
  assert.equal(savePalaceComposition(storage, {...good, board: {Walk: {x: Number.NaN, y: 20}}}, reading), false, 'a non-finite point is not written');
  assert.equal(savePalaceComposition(storage, {...good, viewport: {x: 0, y: 0, zoom: 0}}, reading), false, 'a zero zoom is not written');
  assert.equal(storage.getItem(PALACE_PRESENCE_KEY), before, 'the stored entry is the last good one');
  resetPalaceCompositions();
  assert.deepEqual(restorePalaceComposition(reading, storage).composition.board, {Walk: {x: 10, y: 20}});
});
