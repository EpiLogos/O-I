import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';
import {
  DEFAULT_CAMERA,
  equirectBounds,
  precisionMarker,
  projectEquirect,
  projectPlaces,
} from '../src/techne/place/project.ts';

const observatoryOf = async () => {
  const reading = await loadFixture('representative-subject-v1.json');
  return reading.spatial[0];
};

// Synthetic parent facets standing in for the hierarchy refs the fixture
// names — carried verbatim, never re-keyed.
const greenwich = {
  place_ref: 'place:fixture:greenwich',
  identity: { names: [{ name: 'Greenwich', valid_from: null, valid_to: null }] },
  geometry: { type: 'point', coordinates: [0.0, 51.48] },
  precision: 'exact',
};

const london = {
  place_ref: 'place:fixture:london',
  identity: { names: [{ name: 'London', valid_from: null, valid_to: null }] },
  geometry: { type: 'point', coordinates: [-0.1276, 51.5072] },
  precision: 'approximate',
};

test('Greenwich projects with its own approximate styling data — precision is data, never upgraded', async () => {
  const observatory = await observatoryOf();
  const projection = projectPlaces([observatory], { width: 720, height: 360 });
  assert.equal(projection.places.length, 1);
  const place = projection.places[0];
  assert.equal(place.place_ref, 'place:fixture:royal-observatory-greenwich');
  assert.equal(place.precision, 'approximate');
  assert.deepEqual(
    { kind: place.marker.kind, uncertainty: place.marker.uncertainty },
    { kind: 'halo', uncertainty: true },
    'approximate renders the halo marker, visibly uncertain',
  );
  assert.equal(place.shape, 'point');
  // Equirectangular: x = (lon+180)/360*720, y = (90-lat)/180*360.
  assert.ok(Math.abs(place.position.x - 360.003) < 1e-9, 'lon 0.0015 lands at x 360.003');
  assert.ok(Math.abs(place.position.y - 77.0462) < 1e-9, 'lat 51.4769 lands at y 77.0462');
  assert.equal(place.label, 'Royal Observatory, Greenwich');
  assert.equal(place.valid_from, '1675');
  assert.equal(place.valid_to, null);
});

test('both hierarchy edges (greenwich, london) draw parent→child and carry their validity', async () => {
  const observatory = await observatoryOf();
  const projection = projectPlaces([greenwich, london, observatory], { width: 720, height: 360 });
  assert.equal(projection.edges.length, 2);
  const [toGreenwich, toLondon] = projection.edges;
  assert.deepEqual(
    { from: toGreenwich.from_ref, to: toGreenwich.to_ref, relation: toGreenwich.relation },
    { from: 'place:fixture:greenwich', to: 'place:fixture:royal-observatory-greenwich', relation: 'within' },
  );
  assert.deepEqual(
    { from: toLondon.from_ref, to: toLondon.to_ref, relation: toLondon.relation },
    { from: 'place:fixture:london', to: 'place:fixture:royal-observatory-greenwich', relation: 'within' },
  );
  assert.equal(toGreenwich.valid_from, '1675');
  assert.equal(toGreenwich.valid_to, null);
  assert.equal(toLondon.valid_from, '1675');
  assert.equal(toLondon.valid_to, null);
  assert.ok(toGreenwich.from && toGreenwich.to, 'both endpoints project when both facets carry geometry');
});

test('an absent parent is listed honestly: the edge stands, its endpoint is null', async () => {
  const observatory = await observatoryOf();
  const projection = projectPlaces([observatory], { width: 720, height: 360 });
  assert.equal(projection.edges.length, 2);
  for (const edge of projection.edges) {
    assert.equal(edge.from, null, `parent ${edge.from_ref} has no facet in this list`);
    assert.ok(edge.to, 'the child endpoint still projects');
  }
});

test('an unlocated facet takes the no-coordinate marker and keeps its identity name', async () => {
  const unlocated = {
    place_ref: 'place:test:the-house-that-moved',
    identity: { names: [{ name: 'The House That Moved', valid_from: '1900', valid_to: null }] },
    precision: 'unlocated',
    valid_from: '1900',
    valid_to: null,
  };
  const projection = projectPlaces([unlocated], { width: 720, height: 360 });
  const place = projection.places[0];
  assert.equal(place.marker.kind, 'no-coordinate');
  assert.equal(place.marker.uncertainty, true);
  assert.equal(place.shape, 'none');
  assert.ok(place.position, 'the honest register gives the marker a slot in the view');
  assert.equal(place.label, 'The House That Moved', 'the identity name is still shown');
});

test('a region facet projects its polygon as outline rendering data', () => {
  const region = {
    place_ref: 'place:test:marsh',
    identity: { names: [{ name: 'The Marsh', valid_from: null, valid_to: null }] },
    geometry: { type: 'polygon', coordinates: [[[-1, 51], [0, 51], [0, 52], [-1, 52], [-1, 51]]] },
    precision: 'region',
  };
  const projection = projectPlaces([region], { width: 720, height: 360 });
  const place = projection.places[0];
  assert.equal(place.marker.kind, 'outline');
  assert.equal(place.shape, 'polygon');
  assert.equal(place.rings.length, 1);
  assert.equal(place.rings[0].length, 5);
});

test('the projection reads facets and never writes them', async () => {
  const observatory = await observatoryOf();
  const snapshot = JSON.parse(JSON.stringify(observatory));
  projectPlaces([greenwich, london, observatory], { width: 720, height: 360, camera: { lon: 10, lat: 20, zoom: 2 } });
  assert.deepEqual(observatory, snapshot);
  assert.deepEqual(precisionMarker('exact'), { kind: 'solid', uncertainty: false, note: 'exact position' });
  assert.deepEqual(precisionMarker('unlocated').kind, 'no-coordinate');
});

test('the camera moves the equirect window; zoom 1 is the whole world', () => {
  assert.deepEqual(equirectBounds(DEFAULT_CAMERA), { west: -180, east: 180, south: -90, north: 90 });
  const bounds = equirectBounds({ lon: 10, lat: 20, zoom: 2 });
  assert.deepEqual(bounds, { west: -80, east: 100, south: -25, north: 65 });
  const view = { width: 720, height: 360 };
  const centre = projectEquirect(10, 20, bounds, view.width, view.height);
  assert.ok(Math.abs(centre.x - 360) < 1e-9 && Math.abs(centre.y - 180) < 1e-9, 'the camera centre is the view centre');
});
