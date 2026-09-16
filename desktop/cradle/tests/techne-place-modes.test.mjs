import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';
import {
  facetsForView,
  placeState,
  renderForMode,
  renderGlobeModel,
  renderMapModel,
  renderStreetModel,
} from '../src/techne/place/modes.ts';

const facetsWith = async () => {
  const reading = await loadFixture('representative-subject-v1.json');
  const observatory = reading.spatial[0];
  const farSide = {
    place_ref: 'place:test:antipodean-station',
    identity: { names: [{ name: 'Antipodean Station', valid_from: null, valid_to: null }] },
    geometry: { type: 'point', coordinates: [100.0, 0.0] },
    precision: 'exact',
  };
  return { observatory, facets: [observatory, farSide] };
};

test('map, globe and street are three render models over the SAME facet list', async () => {
  const { facets } = await facetsWith();
  const snapshot = JSON.parse(JSON.stringify(facets));
  const map = renderMapModel(facets, {});
  const globe = renderGlobeModel(facets, {});
  const street = renderStreetModel(facets, {});
  assert.equal(map.mode, 'map');
  assert.equal(globe.mode, 'globe');
  assert.equal(street.mode, 'street');
  assert.equal(map.projection.places.length, 2);
  assert.equal(globe.places.length, 2);
  assert.equal(street.place_ref, facets[0].place_ref, 'street details the first facet when nothing is selected');
  assert.deepEqual(facets, snapshot, 'no presentation writes the reading');
  // No stores behind the modes: the same call is deterministic, nothing accumulates.
  const again = renderMapModel(facets, {});
  assert.deepEqual(again, map);
});

test('renderForMode dispatches the three presentations', async () => {
  const { facets } = await facetsWith();
  for (const [mode, checker] of [
    ['map', (model) => model.projection && model.mode === 'map'],
    ['globe', (model) => model.disc && model.mode === 'globe'],
    ['street', (model) => model.mode === 'street' && 'hierarchy' in model],
  ]) {
    const model = renderForMode(mode, facets, {});
    assert.ok(checker(model), `${mode} renders its own model`);
  }
});

test('the globe shows the front hemisphere only, by pure math', async () => {
  const { facets } = await facetsWith();
  const globe = renderGlobeModel(facets, { camera: { lon: 0, lat: 0, zoom: 1 }, width: 720, height: 360 });
  assert.deepEqual(globe.disc, { cx: 360, cy: 180, r: 168 }, 'the disc fills the schematic view');
  const greenwich = globe.places.find((place) => place.place_ref === 'place:fixture:royal-observatory-greenwich');
  assert.ok(greenwich.position, 'Greenwich stands on the front hemisphere');
  assert.ok(greenwich.position.y < globe.disc.cy, 'lat 51.5 sits above the equator on the disc');
  const far = globe.places.find((place) => place.place_ref === 'place:test:antipodean-station');
  assert.equal(far.position, null, 'lon 100 is behind the disc at centre 0 — not drawn, not faked');
});

test('street resolves identity, precision, hierarchy with parents, and sources', async () => {
  const reading = await loadFixture('representative-subject-v1.json');
  const observatory = reading.spatial[0];
  const greenwich = {
    place_ref: 'place:fixture:greenwich',
    identity: { names: [{ name: 'Greenwich', valid_from: null, valid_to: null }] },
    precision: 'exact',
  };
  const street = renderStreetModel([greenwich, observatory], {
    selectedRef: 'place:fixture:royal-observatory-greenwich',
    window: { from: '1675', to: '1700' },
  });
  assert.equal(street.standing_name, 'Royal Observatory, Greenwich', 'the name valid from 1675 resolves');
  assert.deepEqual(street.names, observatory.identity.names, 'names carried verbatim');
  assert.equal(street.precision, 'approximate');
  assert.equal(street.precision_note, 'approximate — halo, not a solid fix');
  assert.equal(street.geometry.kind, 'point');
  assert.deepEqual(street.geometry, { kind: 'point', lon: 0.0015, lat: 51.4769 });
  assert.equal(street.hierarchy.length, 2);
  assert.deepEqual(
    street.hierarchy.map((row) => [row.place_ref, row.relation, row.parent_name, row.valid_from]),
    [
      ['place:fixture:greenwich', 'within', 'Greenwich', '1675'],
      ['place:fixture:london', 'within', null, '1675'],
    ],
    'the hierarchy chain with validity; parents resolve only when the list carries them',
  );
  assert.equal(street.source_ref, 'aikit:source:fixture:place-gazetteer');
  assert.equal(street.observer_frame, null);
});

test('an empty street view is honest: no place, no invented detail', () => {
  const street = renderStreetModel([], {});
  assert.equal(street.place, null);
  assert.equal(street.place_ref, null);
  assert.equal(street.precision, null);
  assert.deepEqual(street.hierarchy, []);
});

test('placeState derives the aperture honestly from the reading’s own disclosure', async () => {
  assert.equal(placeState(null).status, 'no-reading');
  const representative = await loadFixture('representative-subject-v1.json');
  const present = placeState(representative);
  assert.equal(present.status, 'present');
  assert.equal(present.facets.length, 1);
  assert.equal(present.reason, null);
  const absent = await loadFixture('absent-facets-v1.json');
  const unavailable = placeState(absent);
  assert.equal(unavailable.status, 'unavailable', 'the disclosure says the place instrument is unavailable');
  assert.equal(unavailable.reason, 'no disclosed spatial reading');
  const stripped = { ...representative, spatial: [] };
  assert.equal(placeState(stripped).status, 'empty');
});

test('the window filter applies before projection, for every mode alike', async () => {
  const latePlace = {
    place_ref: 'place:test:later-arrival',
    identity: { names: [{ name: 'A Square That Came Later', valid_from: '1750', valid_to: null }] },
    geometry: { type: 'point', coordinates: [2.3522, 48.8566] },
    precision: 'exact',
    valid_from: '1750',
    valid_to: null,
  };
  const narrow = { from: '1500', to: '1700' };
  const hidden = facetsForView([latePlace], { window: narrow });
  assert.deepEqual(hidden, [], 'valid_from 1750 stands after the window — filtered before any projection');
  assert.equal(renderForMode('map', hidden, { window: narrow }).projection.places.length, 0);
  assert.deepEqual(renderForMode('globe', hidden, { window: narrow }).places.filter((place) => place.position), []);
  const widened = { from: '1500', to: '1800' };
  const shown = facetsForView([latePlace], { window: widened });
  assert.equal(shown.length, 1);
  assert.equal(renderForMode('map', shown, { window: widened }).projection.places.length, 1);
});
