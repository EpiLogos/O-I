// lane-5 T24: palace bookmarks, the named start, region-family Open routes, and Return to ground.
//   - a bookmark (name and board viewport) round-trips through the real presence save and restore, and a session that holds it
//     restores it unchanged;
//   - a jump restores board viewport, walk index and focus from one result, and one save keeps all three;
//   - an entry saved before naming, or with no bookmarks at all, loads unchanged; a corrupt bookmark field refuses the whole entry;
//   - the named start is the default landing when no walk position is saved, and a saved position resumes where it stood;
//   - each region family's Open routes to the instrument its M′ office names, or to the source surface for provenance;
//   - Return to ground re-opens the M0′ ground with no object ref, and an accepted Return's receipt is kept on the session only.
// Run after `npm run build:journeys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {provingReading} from '../../../src/techne/m0m5/journey/proving-reading.ts';
import {beats} from '../../../src/techne/m0m5/journey/beats.ts';
import {
  addBookmark, deriveComposition, palaceComposition, removeBookmark, renameBookmark, resetPalaceCompositions, storeComposition,
} from '../../../src/techne/m0m5/palace/palace-state.ts';
import {
  PALACE_PRESENCE_KEY, loadPalacePresence, restorePalaceComposition, savePalaceComposition,
} from '../../../src/techne/m0m5/palace/presence.ts';
import {palaceRegions} from '../../../src/techne/m0m5/palace/regions.ts';
import {returnGroundInstrument} from '../../../src/techne/m0m5/palace/return.ts';
import {
  PALACE_WIRED_INSTRUMENTS, palaceInstrumentOpenRequest, palaceOpenRoute, palaceSourceOpenRequest, palaceWalkSteps,
} from '../src/palaceWhole.ts';
import {
  PALACE_BOOKMARK_NAME_LIMIT, palaceBookmarkAdd, palaceBookmarkJump, palaceBookmarkLabel, palaceBookmarkName,
  palaceBookmarkRename, palaceLandingIndex, palaceStartStep,
} from '../src/palaceBookmarks.ts';

function memoryStorage() {
  const map = new Map();
  return {map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value))};
}

const VIEW_A = {x: 12, y: -4, zoom: 1.5};
const VIEW_B = {x: 0, y: 0, zoom: 1};

// Two bookmarks at two different walk steps, the first with a viewport and a name, the second with a name only.
function bookmarked() {
  resetPalaceCompositions();
  const reading = provingReading();
  const steps = palaceWalkSteps(reading);
  assert.ok(steps.length >= 3, 'the proving reading composes at least three walk steps');
  let composition = palaceComposition(reading);
  composition = addBookmark(composition, steps[2].region, steps[2].ref, {name: 'Gate', viewport: VIEW_A});
  composition = addBookmark(composition, steps[1].region, steps[1].ref, {name: 'Night'});
  composition = {...composition, walk_index: 1, viewport: VIEW_B};
  storeComposition(composition);
  return {reading, steps, composition};
}

test('a named bookmark with its viewport round-trips through the real presence save and restore', () => {
  const {reading, steps, composition} = bookmarked();
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, composition, reading), true);
  const [entry] = Object.values(JSON.parse(storage.map.get(PALACE_PRESENCE_KEY)));
  assert.equal(entry.bookmarks[0].name, 'Gate');
  assert.deepEqual(entry.bookmarks[0].viewport, VIEW_A);
  // A fresh session (the reload): the stored bookmarks come back exactly, names and viewports included.
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.standing, 'current');
  assert.deepEqual(restored.composition.bookmarks, composition.bookmarks);
  assert.equal(restored.composition.bookmarks[0].name, 'Gate');
  assert.deepEqual(restored.composition.bookmarks[0].viewport, VIEW_A);
  assert.equal(restored.composition.bookmarks[1].viewport, undefined, 'a bookmark with no viewport stays without one');
});

test('a jump restores the board viewport, the walk index and the focus from one result, and one save keeps all three', () => {
  const {reading, steps, composition} = bookmarked();
  const placementsBefore = JSON.stringify(composition.placements);
  const [gate] = composition.bookmarks;
  const jump = palaceBookmarkJump(composition, gate, steps);
  assert.equal(jump.kind, 'jumped');
  assert.equal(jump.walk_index, 2, 'the walk index is the bookmarked step');
  assert.deepEqual(jump.focus, steps[2], 'the focus is the bookmarked step');
  assert.deepEqual(jump.viewport, VIEW_A, 'the board viewport is the bookmark’s');
  assert.equal(jump.composition.walk_index, 2);
  assert.deepEqual(jump.composition.viewport, VIEW_A);
  assert.equal(JSON.stringify(jump.composition.placements), placementsBefore, 'a jump moves no arrangement');
  // One save carries all three into the stored presence and back.
  resetPalaceCompositions();
  storeComposition(jump.composition);
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, jump.composition, reading), true);
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.composition.walk_index, 2);
  assert.deepEqual(restored.composition.viewport, VIEW_A);
  assert.deepEqual(palaceWalkSteps(reading)[restored.composition.walk_index], steps[2]);
});

test('a jump to a bookmark whose ref no longer stands in the walk is refused by name and moves nothing', () => {
  const {steps, composition} = bookmarked();
  const gone = {region: 'ground', ref: 'expression:no-longer-in-the-reading', locus: null, name: 'Ghost'};
  const jump = palaceBookmarkJump(composition, gone, steps);
  assert.equal(jump.kind, 'refused');
  assert.match(jump.reason, /Ghost no longer stands in the walk/);
});

test('an entry saved before naming loads unchanged: its rows carry no name and no viewport', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const steps = palaceWalkSteps(reading);
  // The pre-T24 shape: bookmarks with only region, ref and locus.
  const old = {...palaceComposition(reading), bookmarks: [{region: steps[0].region, ref: steps[0].ref, locus: steps[0].locus}]};
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, old, reading), true);
  const [entry] = Object.values(JSON.parse(storage.map.get(PALACE_PRESENCE_KEY)));
  assert.deepEqual(Object.keys(entry.bookmarks[0]).sort(), ['locus', 'ref', 'region']);
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.standing, 'current');
  assert.deepEqual(restored.composition.bookmarks, [{region: steps[0].region, ref: steps[0].ref, locus: steps[0].locus}]);
  assert.equal(palaceBookmarkLabel(restored.composition.bookmarks[0]), steps[0].ref, 'an unnamed bookmark reads by its ref');
});

test('an entry with no bookmarks key at all restores with none and its arrangement intact', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const base = deriveComposition(reading);
  const storage = memoryStorage();
  savePalaceComposition(storage, palaceComposition(reading), reading);
  const stored = JSON.parse(storage.map.get(PALACE_PRESENCE_KEY));
  for (const entry of Object.values(stored)) delete entry.bookmarks;
  storage.map.set(PALACE_PRESENCE_KEY, JSON.stringify(stored));
  resetPalaceCompositions();
  const restored = restorePalaceComposition(reading, storage);
  assert.equal(restored.standing, 'current');
  assert.deepEqual(restored.composition.bookmarks, []);
  assert.deepEqual(restored.composition.placements, base.placements);
});

test('a corrupt bookmark name or viewport refuses the whole entry, and nothing is restored', () => {
  const {reading, composition} = bookmarked();
  for (const corrupt of [{name: 42}, {name: '   '}, {viewport: {x: 1, y: 2, zoom: 0}}, {viewport: {x: Number.NaN, y: 0, zoom: 1}}]) {
    const storage = memoryStorage();
    savePalaceComposition(storage, composition, reading);
    const stored = JSON.parse(storage.map.get(PALACE_PRESENCE_KEY));
    Object.assign(Object.values(stored)[0].bookmarks[0], corrupt);
    storage.map.set(PALACE_PRESENCE_KEY, JSON.stringify(stored));
    assert.deepEqual(loadPalacePresence(storage), {}, `refused: ${JSON.stringify(corrupt)}`);
  }
});

test('the named start is the walk’s first step, and it is the default landing when no walk position is saved', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const steps = palaceWalkSteps(reading);
  const start = palaceStartStep(steps);
  assert.equal(start.index, 0);
  assert.deepEqual(start.step, steps[0]);
  // No saved presence: the restore carries no walk position, so the palace lands on the start.
  const restored = restorePalaceComposition(reading, memoryStorage());
  assert.equal(restored.composition.walk_index, undefined);
  assert.equal(palaceLandingIndex(restored.composition.walk_index, steps), start.index);
  // A saved position resumes where it stood, wrapped into the walk as it now stands.
  assert.equal(palaceLandingIndex(2, steps), 2);
  assert.equal(palaceLandingIndex(steps.length + 1, steps), 1);
  // An empty palace focuses nothing and lands on index 0.
  assert.equal(palaceStartStep([]).step, null);
  assert.equal(palaceLandingIndex(undefined, []), 0);
});

test('a bookmark is added under a name from the focused step, refused when blank, over-long or already bookmarked', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const steps = palaceWalkSteps(reading);
  const base = palaceComposition(reading);
  assert.equal(palaceBookmarkName('   ').ok, false);
  assert.equal(palaceBookmarkName('x'.repeat(PALACE_BOOKMARK_NAME_LIMIT + 1)).ok, false);
  assert.deepEqual(palaceBookmarkName('  Gate  '), {ok: true, name: 'Gate'});
  const added = palaceBookmarkAdd(base, steps[1], '  Gate  ', VIEW_A);
  assert.equal(added.kind, 'changed');
  assert.deepEqual(added.composition.bookmarks[0], {region: steps[1].region, ref: steps[1].ref, locus: added.composition.bookmarks[0].locus, name: 'Gate', viewport: VIEW_A});
  assert.equal(palaceBookmarkAdd(added.composition, steps[1], 'Again', VIEW_B).kind, 'refused', 'one bookmark per ref');
  assert.equal(palaceBookmarkAdd(base, steps[1], '', VIEW_B).kind, 'refused');
});

test('rename changes only the named bookmark, and a blank rename is refused with the name kept', () => {
  const {composition} = bookmarked();
  const [gate, night] = composition.bookmarks;
  const renamed = palaceBookmarkRename(composition, gate.ref, 'Threshold');
  assert.equal(renamed.kind, 'changed');
  assert.equal(renamed.composition.bookmarks[0].name, 'Threshold');
  assert.deepEqual(renamed.composition.bookmarks[1], night, 'the other bookmark is untouched');
  assert.equal(palaceBookmarkRename(composition, gate.ref, '  ').kind, 'refused');
  assert.equal(palaceBookmarkRename(composition, 'expression:none', 'X').kind, 'refused');
  assert.equal(renameBookmark(composition, gate.ref, 'Threshold').bookmarks[0].name, 'Threshold');
  assert.equal(removeBookmark(composition, night.ref).bookmarks.length, 1);
});

test('each region family’s Open lands in the instrument its office names, on the same subject', () => {
  const reading = provingReading();
  const regions = palaceRegions(reading);
  const expected = {
    ground: 'project',
    canvas: 'canvas',
    relation: 'timeline',
    journey: 'journey',
    world: 'place',
    expression: 'expressions',
  };
  const seen = new Set(regions.map((region) => region.key));
  for (const key of Object.keys(expected)) assert.ok(seen.has(key), `the proving reading composes the ${key} family`);
  assert.ok(seen.has('sources'), 'the proving reading composes the sources family');
  for (const region of regions) {
    for (const entry of region.entries) {
      const route = palaceOpenRoute(entry, PALACE_WIRED_INSTRUMENTS);
      if (region.key === 'sources') {
        assert.deepEqual(route, {kind: 'source', ref: entry.ref}, 'provenance opens the source surface');
        continue;
      }
      assert.equal(route.kind, 'open', `${region.key} opens`);
      assert.equal(route.instrument, expected[region.key], `${region.key} lands in ${expected[region.key]}`);
      assert.equal(route.ref, entry.ref, `${region.key} keeps the subject ref verbatim`);
    }
  }
  // Journey: an Open names a scene that the journey instrument's beat list actually carries (the beat is the focus).
  const journey = regions.find((region) => region.key === 'journey');
  assert.ok(journey && journey.entries.length > 0, 'the proving reading composes journey beats');
  for (const entry of journey.entries) {
    assert.ok(beats(reading).beats.some((beat) => beat.scene_ref === entry.ref), `${entry.ref} is a beat of this journey`);
  }
  // Agency has no instrument surface: its depth stays in the palace, refused by name.
  assert.equal(palaceOpenRoute({kind: 'agency', ref: 'agent:x', label: 'agent', open_instrument: null}, PALACE_WIRED_INSTRUMENTS).kind, 'refused');
});

test('the frame asks for an instrument with its ref, and for a source with the Scene it stands in', () => {
  assert.deepEqual(palaceInstrumentOpenRequest('journey', 'expression:x:scene:one'), {request: 'summon', detail: {kind: 'instrument', lens: 'journey', ref: 'expression:x:scene:one'}});
  const source = palaceSourceOpenRequest('source:wiki/cite', {expression_ref: 'expression:x', revision: 7, scene_ref: 'expression:x:scene:one', title: 'Probe'});
  assert.deepEqual(source, {
    request: 'summon',
    detail: {
      kind: 'source',
      ref: 'source:wiki/cite',
      subject: {ref: 'expression:x', kind: 'expression', nativeOwner: 'oi', revision: 7, title: 'Probe', sceneRef: 'expression:x:scene:one', entityRef: null, relationRef: null},
    },
  });
});

test('Return to ground re-opens the M0′ ground with no object ref, and only when the reading discloses it', () => {
  const reading = provingReading();
  assert.equal(returnGroundInstrument(reading), 'project');
  const hidden = structuredClone(reading);
  for (const entry of hidden.disclosure.instruments) if (entry.instrument === 'project') entry.available = false;
  assert.equal(returnGroundInstrument(hidden), null, 'an undisclosed ground has nothing to return to');
  assert.deepEqual(palaceInstrumentOpenRequest('project'), {request: 'summon', detail: {kind: 'instrument', lens: 'project'}}, 'the ground names no ref');
});

test('an accepted Return’s receipt stays on the session and is never saved, so a reload does not carry it', () => {
  resetPalaceCompositions();
  const reading = provingReading();
  const line = 'Accepted: aikit.wiki.stage invoked by aikit. Returning to M0′.';
  storeComposition({...palaceComposition(reading), receipt: line});
  const storage = memoryStorage();
  assert.equal(savePalaceComposition(storage, palaceComposition(reading), reading), true);
  const [entry] = Object.values(JSON.parse(storage.map.get(PALACE_PRESENCE_KEY)));
  assert.equal(entry.receipt, undefined, 'the receipt is not a stored field');
  assert.ok(!storage.map.get(PALACE_PRESENCE_KEY).includes('Accepted:'), 'the receipt text is never written to storage');
  // The same session still holds the receipt when the palace is re-entered.
  assert.equal(restorePalaceComposition(reading, storage).composition.receipt, line);
  // A fresh session does not.
  resetPalaceCompositions();
  assert.equal(restorePalaceComposition(reading, storage).composition.receipt, undefined);
});
