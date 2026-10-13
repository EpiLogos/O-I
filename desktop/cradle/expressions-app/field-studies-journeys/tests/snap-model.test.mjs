// lane-3 E25: the timeline snap model (snapModel.ts). Candidates, the closest-candidate law, the pixel threshold scaled by
// the timeline's own scale, the exclusions a drag applies, the next and previous navigation, and the app's wiring: every
// timeline drag asks the model and bypasses it on Alt. Run after `npm run build:journeys` (imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  SNAP_TOLERANCE_PX, snapCandidates, closestSnap, snapTime, nextSnapPoint, prevSnapPoint,
} from '../build/snapModel.js';
import {snapToBoundary, sceneBoundaries} from '../build/journeyMarkers.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const appSource = readFileSync(join(here, '../src/app.ts'), 'utf8');

const point = (time, kind, id = `${kind}:${time}`) => ({time, kind, id});

test('candidates come from every source, in their tie order, and drop non-finite times', () => {
  const points = snapCandidates({
    boundaries: [0, 10, 20],
    markers: [{id: 'm1', time: 5}],
    playhead: 7,
    loop: {from: 12, to: 18},
    keyframes: [{id: 'key:t:0', time: 3}],
  });
  assert.deepEqual(points.map(p => [p.kind, p.time, p.id]), [
    ['scene', 0, 'scene:0'], ['scene', 10, 'scene:1'], ['scene', 20, 'scene:2'],
    ['marker', 5, 'marker:m1'], ['playhead', 7, 'playhead'],
    ['loop-in', 12, 'loop:from'], ['loop-out', 18, 'loop:to'],
    ['keyframe', 3, 'key:t:0'],
  ]);
  assert.equal(snapCandidates({playhead: Number.NaN}).length, 0, 'a non-finite playhead is not a candidate');
});

test('the closest candidate within the tolerance wins, whatever its kind', () => {
  const points = [point(10, 'scene'), point(10.5, 'marker')];
  const hit = closestSnap(points, 10.4, 0.1);
  assert.equal(hit.kind, 'marker', 'the marker at 0.1 s beats the scene start at 0.4 s');
  assert.equal(closestSnap(points, 10.2, 0.1).kind, 'scene', 'and the scene start wins when it is nearer');
});

test('on a tie the earlier candidate stands, so the candidate order is the tie law', () => {
  // At 0.5 s per px the reach is 3 s, so both candidates are inside it, each exactly 1 s from 11.
  const points = [point(10, 'scene'), point(12, 'marker')];
  assert.equal(closestSnap(points, 11, 0.5).kind, 'scene');
  assert.equal(closestSnap([point(12, 'marker'), point(10, 'scene')], 11, 0.5).kind, 'marker');
});

test('the threshold is SNAP_TOLERANCE_PX converted by the timeline scale, inclusive at its edge', () => {
  assert.equal(SNAP_TOLERANCE_PX, 6);
  const points = [point(10, 'scene')];
  // 6 px at 1 s per px is a 6 s reach; at 0.1 s per px it is 0.6 s. The same 3 s gap snaps only at the coarser scale.
  assert.equal(snapTime(points, 13, 1), 10);
  assert.equal(snapTime(points, 13, 0.1), 13);
  // The reach doubles with the scale, and the edge itself is inside it.
  assert.equal(snapTime(points, 13, 0.5), 10, 'exactly 3 s is 6 px at 0.5 s per px');
  assert.equal(closestSnap(points, 13.0001, 0.5), null, 'just past the edge does not snap');
});

test('a point is never snapped without a finite time or a positive scale', () => {
  const points = [point(10, 'scene')];
  assert.equal(snapTime(points, Number.NaN, 1), Number.NaN);
  assert.equal(snapTime(points, 10.1, 0), 10.1);
  assert.equal(snapTime(points, 10.1, -1), 10.1);
  assert.equal(snapTime([], 10.1, 1), 10.1);
});

test('a drag excludes the candidates it moves itself', () => {
  const points = [point(10, 'marker', 'marker:dragged'), point(10.2, 'scene', 'scene:2')];
  assert.equal(closestSnap(points, 10.05, 0.1).id, 'marker:dragged');
  const hit = closestSnap(points, 10.05, 0.1, {exclude: new Set(['marker:dragged'])});
  assert.equal(hit.id, 'scene:2', 'the dragged marker is not its own snap target');
  assert.equal(closestSnap(points, 10.05, 0.1, {exclude: ['marker:dragged', 'scene:2']}), null);
});

test('next and previous walk the points in time order from the playhead, passing a point under it', () => {
  const points = [point(0, 'scene', 'a'), point(4, 'marker', 'b'), point(4.5, 'loop-in', 'c'), point(9, 'scene', 'd')];
  const forward = [];
  let t = 0;
  for (let hit = nextSnapPoint(points, t); hit; hit = nextSnapPoint(points, t)) { forward.push(hit.id); t = hit.time; }
  assert.deepEqual(forward, ['b', 'c', 'd'], 'the point under the playhead at 0 is passed');
  const backward = [];
  t = 9;
  for (let hit = prevSnapPoint(points, t); hit; hit = prevSnapPoint(points, t)) { backward.push(hit.id); t = hit.time; }
  assert.deepEqual(backward, ['c', 'b', 'a']);
  assert.equal(nextSnapPoint(points, 9), null, 'nothing lies after the last point');
  assert.equal(prevSnapPoint(points, 0), null, 'nothing lies before the first point');
});

test('the boundary-only snap keeps its law: it is a thin call into the model', () => {
  const boundaries = [0, 10, 20];
  assert.equal(snapToBoundary(10.04, boundaries, 0.1), 10);
  assert.equal(snapToBoundary(14, boundaries, 0.1), 14, 'outside the tolerance nothing moves');
  assert.equal(snapToBoundary(19.5, boundaries, 0.1), 20);
  assert.deepEqual(sceneBoundaries([4, 6]), [0, 4, 10]);
});

test('every timeline drag asks the model, and Alt bypasses it, through its own move handler', () => {
  const body = name => {
    const start = appSource.indexOf(`function ${name}(`);
    assert.ok(start > 0, `${name} exists`);
    const next = appSource.indexOf('\nfunction ', start + 10);
    return appSource.slice(start, next);
  };
  for (const name of ['moveSceneTrim', 'moveSceneRoll', 'moveLocatorDrag', 'moveCurveDrag']) {
    const text = body(name);
    assert.ok(text.includes('closestSnap(') || text.includes('pick('), `${name} snaps through the model`);
    assert.ok(text.includes('!ev.altKey'), `${name} bypasses snapping on Alt`);
    assert.ok(text.includes('timelineSnap'), `${name} honours the timeline toggle`);
  }
  for (const name of ['endSceneTrim', 'endSceneRoll', 'endLocatorDrag', 'endCurveDrag']) {
    assert.ok(body(name).includes('setSnapGuide(null,0)'), `${name} clears the snap indicator`);
  }
  assert.ok(!/snapToBoundary\(/.test(appSource), 'the drags no longer call the boundary-only snap');
});

test('the snap toggle is a timeline toolbar button with aria-pressed, and the indicator is drawn by drawGuides', () => {
  assert.ok(appSource.includes('data-action="timeline-snap" aria-pressed="${timelineSnap}"'), 'the magnet toggle reports its state');
  assert.ok(appSource.includes("case 'timeline-snap':toggleTimelineSnap()"), 'the toolbar action toggles snapping');
  assert.ok(appSource.includes('class="snap-guide"'), 'the snap indicator is a guide line');
  const guides = appSource.slice(appSource.indexOf('function drawGuides('), appSource.indexOf('function drawGuides(') + 900);
  assert.ok(guides.includes('snapGuideX'), 'drawGuides draws the snap line in the guides layer');
});
