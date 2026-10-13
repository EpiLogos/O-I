// lane-5 T15 x T21: the Palace board's held points and viewport persist through the Palace's own presence owner.
//   - an entry saved before the board carries no board or viewport, and loads unchanged;
//   - a move, then reopen, restores the same positions and viewport through the real save and restore;
//   - a non-finite board point is refused by name, and its entry is not restored;
//   - one board gesture is one apply (one save), and the kernel document is byte-identical across moves and the save.
// Run after `npm run build:journeys` (the board's pure module is read from build/).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {provingReading} from '../../../src/techne/m0m5/journey/proving-reading.ts';
import {deriveComposition, palaceComposition, resetPalaceCompositions, storeComposition} from '../../../src/techne/m0m5/palace/palace-state.ts';
import {
  PALACE_PRESENCE_KEY, loadPalacePresence, refusedBoardPoint, restorePalaceComposition, savePalaceComposition,
} from '../../../src/techne/m0m5/palace/presence.ts';
import {discoverRegions, planRegions} from '../../../src/techne/m0m5/palace/composition.ts';
import {boardPositions, commitBatch, moveBoardRegion, snapBoardPoint, validateBoardPositions} from '../build/palaceBoard.js';

const here = fileURLToPath(new URL('.', import.meta.url));
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

test('one board gesture is one apply, and a preview is never a save', () => {
  const applied = [];
  const tasks = [];
  const batch = commitBatch((points) => applied.push(points), (task) => tasks.push(task));
  // A three-region release: the canvas commits each dragged region in one synchronous pass.
  batch('Walk', {x: 700, y: 300});
  batch('Gate', {x: 412, y: 88});
  batch('Night', {x: -120, y: 640});
  assert.equal(applied.length, 0, 'nothing is applied during the release pass');
  assert.equal(tasks.length, 1, 'one flush is scheduled for the whole gesture');
  tasks[0]();
  assert.equal(applied.length, 1, 'the gesture is applied once');
  assert.deepEqual(applied[0], {Walk: {x: 700, y: 300}, Gate: {x: 412, y: 88}, Night: {x: -120, y: 640}});
  batch('Gate', {x: 0, y: 0});
  tasks[1]();
  assert.equal(applied.length, 2, 'a second gesture is its own apply');
});

test('the kernel document stays byte-identical across the moves and the save', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const doc = kernelDocument();
  const regions = discoverRegions(doc);
  const names = regions.map((region) => region.name);
  const before = JSON.stringify(doc);
  const planBefore = planRegions(doc, regions, []);

  // Two gestures on the board: three regions, then one, each applied once.
  const tasks = [];
  let held = {};
  const apply = (points) => {
    for (const [name, point] of Object.entries(points)) held = moveBoardRegion(held, names, name, point);
  };
  const gesture = commitBatch(apply, (task) => tasks.push(task));
  gesture('Walk', {x: 700, y: 300});
  gesture('Gate', snapBoardPoint({x: 412, y: 88}, true));
  gesture('Night', {x: -120, y: 640});
  tasks.splice(0).forEach((task) => task());
  gesture('Walk', {x: 900, y: 40});
  tasks.splice(0).forEach((task) => task());

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

test('the board saves on the gesture end only: the preview path never reaches the save', () => {
  const view = readFileSync(join(here, '../src/palaceBoardView.tsx'), 'utf8');
  const preview = view.slice(view.indexOf('const preview='), view.indexOf('const release='));
  assert.ok(preview.length > 0, 'the preview path is present');
  assert.doesNotMatch(preview, /movesRef|onMoves|persist/, 'a preview holds the drag and does not save it');
  assert.match(view, /commit:\(name,point\)=>\{batch\(name,point\);return Promise\.resolve\(\);\}/, 'the commit is batched, one per gesture');
});

test('the parent saves the board once per gesture, and restores it on mount through the presence owner', () => {
  const panel = readFileSync(join(here, '../src/palaceInstrument.tsx'), 'utf8');
  assert.match(panel, /if\(reading\)persist\(\{\.\.\.palaceComposition\(reading\),board:next\},reading\);/);
  assert.match(panel, /validateBoardPositions\(composition\.board,regions\.map\(region=>region\.name\)\)/);
  assert.match(panel, /setRestoredViewport\(composition\.viewport\?\?null\)/);
  assert.match(panel, /persist\(\{\.\.\.palaceComposition\(current\),viewport\},current\)/);
});
