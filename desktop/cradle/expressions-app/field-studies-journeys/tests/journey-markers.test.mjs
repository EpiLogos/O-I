// lane-3 E12/E13: journey markers (locators) and the loop region (brace).
// The pure model, its validation, the wrap of journey playback at out -> in, and the rule that
// markers and the region never reach the stage. Run after `npm run build:journeys`
// (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  MARKER_LIMIT, MARKER_NAME_MAX, MARKER_SNAP_PX, LOOP_MIN_SECONDS,
  sceneBoundaries, sceneAtJourneyTime, snapToBoundary, validateMarkers, validateLoopRegion,
  markerAdd, markerRename, markerMove, markerRemove, nextMarkerTime, prevMarkerTime,
  setLoopEdge, dragLoopEdge, moveLoopRegion, regionWrap,
} from '../build/journeyMarkers.js';
import {advanceSceneTransport} from '../build/sceneTransport.js';
import {compositionProperties} from '../build/kernelComposition.js';
import {blankJourney, validateJourney} from '../build/model.js';

const DURATIONS = [10, 4, 6];            // journey clock: scene 0 [0,10), scene 1 [10,14), scene 2 [14,20)
const TOTAL = 20;
// Wrap times are float sums of the clock; compare them to the frame, not by bit.
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label ?? ''} ${actual} != ${expected}`);
const marker = (id, time, name = id, colour = 'amber') => ({id, name, time, colour});

test('scene boundaries and scene lookup agree on the half-open clock', () => {
  assert.deepEqual(sceneBoundaries(DURATIONS), [0, 10, 14, 20]);
  assert.deepEqual(sceneAtJourneyTime(DURATIONS, 0), {sceneIndex: 0, local: 0});
  assert.deepEqual(sceneAtJourneyTime(DURATIONS, 10), {sceneIndex: 1, local: 0});   // a boundary starts the next scene
  assert.deepEqual(sceneAtJourneyTime(DURATIONS, 13.5), {sceneIndex: 1, local: 3.5});
  assert.deepEqual(sceneAtJourneyTime(DURATIONS, 20), {sceneIndex: 2, local: 6});   // the end stays in the last scene
});

test('snapping to a scene boundary is within 6 px and never beyond', () => {
  const spp = 0.1;                          // 0.1 s per pixel
  assert.equal(MARKER_SNAP_PX, 6);
  assert.equal(snapToBoundary(10.5, [0, 10, 14, 20], spp), 10);   // 5 px away: snaps
  assert.equal(snapToBoundary(10.7, [0, 10, 14, 20], spp), 10.7); // 7 px away: free
  assert.equal(snapToBoundary(13.6, [0, 10, 14, 20], spp), 14);
  assert.equal(snapToBoundary(7, [0, 10], 0), 7);                 // no width, no snap
});

test('markers validate as data: palette colour, bounded name, safe unique identity, finite time, count', () => {
  const ok = validateMarkers([marker('b', 12), marker('a', 3)], TOTAL);
  assert.deepEqual(ok.map(m => m.id), ['a', 'b'], 'sorted by time');
  assert.throws(() => validateMarkers([marker('m', 1, 'x', '#ff0000')], TOTAL), /palette key/);
  assert.throws(() => validateMarkers([marker('m', 1, 'x', 'teal')], TOTAL), /palette key/);
  assert.throws(() => validateMarkers([marker('m', 1, '')], TOTAL), /names are 1/);
  assert.throws(() => validateMarkers([marker('m', 1, 'x'.repeat(MARKER_NAME_MAX + 1))], TOTAL), /names are 1/);
  assert.throws(() => validateMarkers([marker('bad id', 1)], TOTAL), /identities/);
  assert.throws(() => validateMarkers([marker('m', 1), marker('m', 2)], TOTAL), /identities/);
  assert.throws(() => validateMarkers([marker('m', NaN)], TOTAL), /finite/);
  assert.throws(() => validateMarkers([{...marker('m', 1), extra: true}], TOTAL), /Invalid journey marker/);
  assert.throws(() => validateMarkers(Array.from({length: MARKER_LIMIT + 1}, (_, i) => marker('m' + i, i % TOTAL)), TOTAL), /at most 64/);
  assert.equal(validateMarkers(Array.from({length: MARKER_LIMIT}, (_, i) => marker('m' + i, i % TOTAL)), TOTAL).length, MARKER_LIMIT);
  assert.equal(validateMarkers([], TOTAL).length, 0, 'an empty list is a real state');
});

test('a marker outside a trimmed journey is clamped into [0, duration], not lost', () => {
  const clamped = validateMarkers([marker('late', 99), marker('early', -4)], TOTAL);
  assert.deepEqual(clamped.map(m => [m.id, m.time]), [['early', 0], ['late', TOTAL]]);
});

test('the loop region validates to 0 <= from < to <= duration; a collapsed region is dropped', () => {
  assert.equal(validateLoopRegion(undefined, TOTAL), undefined);
  assert.equal(validateLoopRegion(null, TOTAL), undefined);
  assert.deepEqual(validateLoopRegion({from: 2, to: 9}, TOTAL), {from: 2, to: 9});
  assert.deepEqual(validateLoopRegion({from: 2, to: 99}, TOTAL), {from: 2, to: TOTAL}, 'out clamps to the journey end');
  assert.equal(validateLoopRegion({from: 5, to: 5}, TOTAL), undefined);
  assert.throws(() => validateLoopRegion({from: 5}, TOTAL), /Invalid loop region/);
  assert.throws(() => validateLoopRegion({from: 5, to: 9, extra: 1}, TOTAL), /Invalid loop region/);
  assert.throws(() => validateLoopRegion({from: NaN, to: 9}, TOTAL), /Invalid loop region/);
});

test('create, rename, move and delete are pure: each returns a new list and leaves the old one alone', () => {
  const base = [marker('a', 5)];
  const added = markerAdd(base, marker('b', 2, 'Drop'));
  assert.deepEqual(added.map(m => m.id), ['b', 'a']);
  assert.equal(base.length, 1, 'the original list is untouched');
  assert.equal(markerRename(added, 'b', '  Arrival  ').find(m => m.id === 'b').name, 'Arrival');
  assert.throws(() => markerRename(added, 'b', '   '), /names are 1/);
  assert.throws(() => markerRename(added, 'nope', 'x'), /no longer on the journey/);
  assert.equal(markerMove(added, 'a', 1, TOTAL).find(m => m.id === 'a').time, 1);
  assert.equal(markerMove(added, 'a', 99, TOTAL).find(m => m.id === 'a').time, TOTAL, 'moves clamp to the journey');
  assert.deepEqual(markerRemove(added, 'a').map(m => m.id), ['b']);
  assert.throws(() => markerRemove(added, 'zz'), /no longer on the journey/);
  const full = Array.from({length: MARKER_LIMIT}, (_, i) => marker('m' + i, i));
  assert.throws(() => markerAdd(full, marker('extra', 1)), /at most 64/);
});

test('previous and next jump past the marker under the playhead, to the exact time', () => {
  const list = [marker('a', 3), marker('b', 8), marker('c', 15)];
  assert.equal(nextMarkerTime(list, 0), 3);
  assert.equal(nextMarkerTime(list, 3), 8, 'a marker under the playhead is passed');
  assert.equal(nextMarkerTime(list, 15), null);
  assert.equal(prevMarkerTime(list, 20), 15);
  assert.equal(prevMarkerTime(list, 8), 3, 'the marker under the playhead is passed going back');
  assert.equal(prevMarkerTime(list, 3), null);
  assert.equal(prevMarkerTime([], 4), null);
});

test('in and out set from the playhead; an inverted or empty region is refused with the reason', () => {
  const inResult = setLoopEdge(undefined, 'from', 4, TOTAL);
  assert.deepEqual(inResult.region, {from: 4, to: TOTAL}, 'in with no region runs to the journey end');
  const outResult = setLoopEdge(undefined, 'to', 12, TOTAL);
  assert.deepEqual(outResult.region, {from: 0, to: 12}, 'out with no region starts at the journey start');
  const region = {from: 4, to: 12};
  assert.match(setLoopEdge(region, 'from', 12, TOTAL).refusal, /before the loop out/);
  assert.match(setLoopEdge(region, 'to', 4, TOTAL).refusal, /after the loop in/);
  assert.deepEqual(setLoopEdge(region, 'to', 15.25, TOTAL).region, {from: 4, to: 15.25});
  assert.ok(LOOP_MIN_SECONDS > 0);
});

test('dragging an edge keeps the minimum length; dragging the body keeps the length inside the journey', () => {
  const region = {from: 4, to: 12};
  const pinned = dragLoopEdge(region, 'from', 11.99, TOTAL);
  near(pinned.to - pinned.from, LOOP_MIN_SECONDS, 'the minimum length holds');
  assert.deepEqual(dragLoopEdge(region, 'to', 0, TOTAL), {from: 4, to: 4 + LOOP_MIN_SECONDS});
  assert.deepEqual(moveLoopRegion(region, 3, TOTAL), {from: 7, to: 15});
  assert.deepEqual(moveLoopRegion(region, 50, TOTAL), {from: TOTAL - 8, to: TOTAL});
  assert.deepEqual(moveLoopRegion(region, -50, TOTAL), {from: 0, to: 8});
});

test('journey playback wraps exactly at out to in, carrying the frame overshoot', () => {
  const region = {from: 4, to: 12};
  // scene 0 at local 9.9 of [0,10); a 0.25 s frame goes to journey 10.15, which is scene 1 local 0.15,
  // but out is 12 and the playhead is at 10.15: no wrap yet
  assert.equal(regionWrap(DURATIONS, 0, 9.9, 0.25, region), null);
  // scene 1 local 1.9 (journey 11.9); a 0.25 s frame reaches 12.15: 0.15 s past out, so in + 0.15 = 4.15 (scene 0 local 4.15)
  const over = regionWrap(DURATIONS, 1, 1.9, 0.25, region);
  assert.equal(over.sceneIndex, 0);
  near(over.local, 4.15, 'overshoot carried to in');
  // exactly on out wraps to the in point itself
  assert.deepEqual(regionWrap(DURATIONS, 1, 1.75, 0.25, region), {sceneIndex: 0, local: 4});
  // a playhead already outside the region (after out) does not wrap here
  assert.equal(regionWrap(DURATIONS, 2, 1, 0.25, region), null);
  // no region, or no advance, never wraps
  assert.equal(regionWrap(DURATIONS, 1, 1.9, 0.25, undefined), null);
  assert.equal(regionWrap(DURATIONS, 1, 1.9, 0, region), null);
});

test('a region over a still scene holds: the wrap stays in that scene and asks for no scene change', () => {
  // scene 1 (journey [10,14)) is still, the region is [11,13) inside it
  const region = {from: 11, to: 13};
  const first = regionWrap(DURATIONS, 1, 2.9, 0.25, region);
  assert.equal(first.sceneIndex, 1, 'the same scene');
  near(first.local, 1.15, 'its own local time');
  assert.equal(regionWrap(DURATIONS, 1, 0.5, 0.25, region), null, 'no wrap before out, so nothing changes');
});

test('a long frame that overshoots the whole region wraps as many times as it needs to', () => {
  const region = {from: 4, to: 6};   // length 2
  // 5.9 + 2.2 = 8.1: 2.1 past out, which is one whole length (2) and 0.1 more, so in + 0.1
  const r = regionWrap(DURATIONS, 0, 5.9, 2.2, region);
  assert.equal(r.sceneIndex, 0);
  near(r.local, 4.1, 'two-length overshoot reduces to 0.1');
});

test('scene transport wraps journey playback at out, in the saved sequence only', () => {
  const journey = {
    schema: 'oi.journey', version: 1, id: 'j', name: 'j', description: '', loop: true, updatedAt: '',
    scenes: DURATIONS.map((duration, i) => ({id: 's' + i, name: 's' + i, duration, transition: 0})),
    savedScenes: {s0: {id: 's0', duration: 10}, s1: {id: 's1', duration: 4}, s2: {id: 's2', duration: 6}},
  };
  const common = {playing: true, libraryOpen: false, hidden: false, propertyRecording: false, editing: false};
  const region = {from: 4, to: 12};
  const frame = advanceSceneTransport(journey, 0, 9.9, 0.25, {...common, savedSequence: true, loopRegion: region});
  assert.equal(frame.seek_local_seconds ?? null, null, 'no wrap for 9.9 -> 10.15 (out is 12)');
  const wrapped = advanceSceneTransport(journey, 1, 1.9, 0.25, {...common, savedSequence: true, loopRegion: region});
  assert.equal(wrapped.advance_to_scene_index, 0, 'the wrap crosses back to scene 0');
  near(wrapped.seek_local_seconds, 4.15, 'exact to the frame');
  assert.equal(wrapped.completed, false, 'a wrap is not an end of the journey');
  // a still scene wrap in the same scene carries no scene change
  const still = advanceSceneTransport(journey, 1, 1.9, 0.25, {...common, savedSequence: true, loopRegion: {from: 11, to: 12}});
  assert.equal(still.advance_to_scene_index, null);
  near(still.elapsed_seconds, 1.15, 'same scene, local seek');
  // no region: unchanged behaviour (scene 1 ends at 4 s and advances to scene 2)
  const plain = advanceSceneTransport(journey, 1, 3.9, 0.25, {...common, savedSequence: true});
  assert.equal(plain.advance_to_scene_index, 2);
  assert.equal(plain.seek_local_seconds, undefined);
});

test('markers and the loop region are presentation: no stage code reads them', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const engineRoot = join(here, '..', '..', 'src', 'engine');
  const files = [];
  const walk = dir => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx|js|mjs)$/.test(name)) files.push(p); } };
  walk(engineRoot);
  const offenders = files.filter(f => /\b(markers|loopRegion|journeyMarkers)\b/.test(readFileSync(f, 'utf8')))
    .map(f => relative(join(here, '..', '..'), f));
  assert.deepEqual(offenders, [], 'the engine (the stage) must not read markers or the loop region');
});

test('the journey envelope carries markers and the region only when they exist; an empty list still persists a deletion', () => {
  const journey = blankJourney();
  assert.equal('markers' in compositionProperties(journey), false, 'no markers: no key, so no spurious composition_set');
  assert.equal('loopRegion' in compositionProperties(journey), false);
  journey.markers = [];
  assert.deepEqual(compositionProperties(journey).markers, [], 'all markers deleted is carried as an empty list');
  journey.markers = [marker('m-1', 2, 'Intro', 'sky')];
  journey.loopRegion = {from: 1, to: 4};
  const carried = compositionProperties(journey);
  assert.equal(carried.schema, 'oi.journey-properties/v1');
  assert.deepEqual(carried.markers, journey.markers);
  assert.deepEqual(carried.loopRegion, {from: 1, to: 4});
});

test('a journey validates its markers and region against its own length, clamping rather than losing them', () => {
  const journey = blankJourney();
  journey.scenes[0].duration = 10;
  journey.markers = [marker('m-1', 50, 'Late', 'rose')];
  journey.loopRegion = {from: 2, to: 50};
  const checked = validateJourney(journey);
  assert.equal(checked.markers[0].time, 10, 'the marker sits at the journey end');
  assert.deepEqual(checked.loopRegion, {from: 2, to: 10});
  journey.loopRegion = {from: 10, to: 50};
  assert.equal('loopRegion' in validateJourney(journey), false, 'a region squeezed to nothing is dropped');
  journey.markers = [marker('m-2', 1, 'x', '#ff0000')];
  assert.throws(() => validateJourney(journey), /palette key/);
});
