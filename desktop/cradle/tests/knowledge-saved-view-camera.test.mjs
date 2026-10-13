// lane-1 D3: a saved graph view restores its camera with its filters. The camera is the surface's own visit camera
// (applySavedGraphView writes the visit); a view saved before cameras existed restores its filters and leaves the
// visit's camera and focus exactly as they stand.
import assert from 'node:assert/strict';
import test from 'node:test';
import {accommodate} from '../src/knowledge/camera.ts';
import {captureSavedGraphView, defaultGraphFilters, restoreSavedGraphViews} from '../src/knowledge/filters.ts';
import {applySavedGraphView} from '../src/knowledge/graphNavigation.ts';

const extent = {width: 960, height: 680};
const fullRegion = {x: 0, y: 0, ...extent};

test('a view saved after travelling reloads with its filters and restores the rendered camera at the same node', () => {
  const filters = {...defaultGraphFilters(), scope: 'local', depth: 2, text: 'Alpha'};
  const anchor = {x: 300, y: 210};
  const visitCamera = {zoom: 1.6, x: -40, y: 90};
  // The surface saves what it renders: the camera accommodated to the selected subject's panel region.
  const rendered = accommodate(visitCamera, anchor, fullRegion, extent);
  const saved = captureSavedGraphView('Working graph', filters, rendered, 'Alpha.md');

  const reloaded = restoreSavedGraphViews(JSON.parse(JSON.stringify([saved])))[0];
  assert.deepEqual(reloaded, saved);

  const elsewhere = {query: 'other', selected: 'Beta.md', camera: {zoom: .5, x: 8, y: 9}, detail: true, detailReturn: {query: 'back', camera: {zoom: 1, x: 0, y: 0}}};
  const liveNode = {x: 870, y: -120};
  const applied = applySavedGraphView(elsewhere, reloaded, {point: liveNode, extent});
  assert.deepEqual(applied.filters, saved.filters);
  assert.equal(applied.selected, 'Alpha.md');
  assert.equal(applied.detail, false);
  assert.equal(applied.detailReturn, undefined);
  assert.deepEqual(accommodate(applied.camera, liveNode, fullRegion, extent), saved.camera, 'the same viewport renders at the node live position');
  assert.equal(elsewhere.selected, 'Beta.md', 'the visit the view applies to is not mutated');
});

test('a view saved without a camera restores its filters and keeps the visit camera and focus', () => {
  const visit = {query: 'native scope', selected: 'opaque:actual-subject', camera: {zoom: .6, x: 81, y: -19}, detail: true};
  const [legacy] = restoreSavedGraphViews([{name: 'Filters only', filters: {...defaultGraphFilters(), text: 'Alpha'}}]);
  const applied = applySavedGraphView(visit, legacy);
  assert.deepEqual(applied.camera, visit.camera);
  assert.equal(applied.selected, visit.selected);
  assert.equal(applied.detail, true);
  assert.equal(applied.filters.text, 'Alpha');
});

test('a camera outside the graph zoom bounds is dropped on restore, so the view restores filters only', () => {
  const [corrupt] = restoreSavedGraphViews([{name: 'Out of range', filters: {...defaultGraphFilters(), text: 'Bravo'}, camera: {zoom: 9, x: 3, y: 4}, focus: 'Alpha.md'}]);
  assert.equal(corrupt.camera, undefined);
  assert.equal(corrupt.focus, undefined);
  const visit = {query: '', camera: {zoom: 1, x: 5, y: 6}};
  assert.deepEqual(applySavedGraphView(visit, corrupt).camera, visit.camera);
});
