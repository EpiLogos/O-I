import test from 'node:test';
import assert from 'node:assert/strict';
import {graphFitCamera} from '../src/knowledge/graph.ts';
import {GRAPH_ZOOM_LIMITS, screenPoint} from '../src/knowledge/camera.ts';

const limits = {minZoom: .15, maxZoom: 4};
const extent = {width: 800, height: 520};
const onScreen = (point, camera, margin) => {
  const s = screenPoint(point, camera, extent.width, extent.height);
  return s.x >= margin - 1e-9 && s.x <= extent.width - margin + 1e-9 && s.y >= margin - 1e-9 && s.y <= extent.height - margin + 1e-9;
};

test('fit-all centres the bounds and keeps every subject inside the margin at the tightest zoom', () => {
  const points = [{x: 100, y: 80}, {x: 700, y: 440}, {x: 400, y: 260}];
  const camera = graphFitCamera(points, extent, limits, 48);
  assert.ok(camera);
  assert.ok(Math.abs(camera.zoom - 704 / 600) < 1e-9, 'the width is the tighter axis here');
  for (const point of points) assert.ok(onScreen(point, camera, 48), `subject ${point.x},${point.y} sits inside the margin`);
  const centre = screenPoint({x: 400, y: 260}, camera, extent.width, extent.height);
  assert.ok(Math.abs(centre.x - extent.width / 2) < 1e-9 && Math.abs(centre.y - extent.height / 2) < 1e-9, 'the bounds centre lands on the canvas centre');
});

test('a single subject clamps to the maximum zoom and centres on that subject', () => {
  const camera = graphFitCamera([{x: 123, y: 45}], extent, limits, 48);
  assert.equal(camera.zoom, limits.maxZoom);
  assert.ok(onScreen({x: 123, y: 45}, camera, 0));
});

test('a very large reading clamps at the minimum zoom instead of leaving the camera unbounded', () => {
  const points = Array.from({length: 4096}, (_, i) => ({x: (i * 37) % 9000, y: (i * 91) % 7000}));
  const camera = graphFitCamera(points, extent, limits, 48);
  assert.equal(camera.zoom, limits.minZoom);
  assert.ok(Number.isFinite(camera.x) && Number.isFinite(camera.y));
});

test('nothing finite to fit yields no camera, and a degenerate extent is refused', () => {
  assert.equal(graphFitCamera([], extent, limits), undefined);
  assert.equal(graphFitCamera([{x: Number.NaN, y: 1}], extent, limits), undefined);
  assert.equal(graphFitCamera([{x: 1, y: 1}], {width: 0, height: 520}, limits), undefined);
});

test('the zoom limits the canvas passes are honoured exactly', () => {
  const camera = graphFitCamera([{x: 0, y: 0}, {x: 1000, y: 1000}], extent, {minZoom: .5, maxZoom: 1}, 48);
  assert.equal(camera.zoom, .5);
});

test('a budget-scale reading (4096 subjects over the layout reach) fits whole at the graph floor', () => {
  // The layout's reach about the centre is max(260, sqrt(n) * 48): 3072 world units for 4096 subjects.
  const reach = Math.max(260, Math.sqrt(4096) * 48);
  const points = Array.from({length: 4096}, (_, i) => ({x: 400 + (i * 37) % 6144 - reach, y: 260 + (i * 91) % 6144 - reach}));
  assert.equal(GRAPH_ZOOM_LIMITS.minZoom, .05, 'the graph floor is the Canvas floor');
  const camera = graphFitCamera(points, extent, GRAPH_ZOOM_LIMITS, 48);
  assert.ok(camera.zoom > GRAPH_ZOOM_LIMITS.minZoom, 'the fit is not clamped at the floor');
  for (const point of points) assert.ok(onScreen(point, camera, 48), `subject ${point.x},${point.y} is on screen`);
  assert.ok(camera.zoom < .15, 'the old .15 floor could not fit this reading whole');
});
