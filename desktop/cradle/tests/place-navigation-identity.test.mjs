/**
 * Lane-4 T22–T24 — place navigation identity (pure proofs).
 *
 *   T22  a subject's disclosed place facets become one "fly here" offer per place
 *        (none → no offer); offline gazetteer hits are basemap context only.
 *   T23  "Open in Timeline" sets the session window from the facet's own validity
 *        and carries the place ref as spatial focus; the subject, reading basis and
 *        selection survive the hop, and reopening Places lands on the same facet.
 *   T24  the place named by the session's spatial focus is the one honoured on open;
 *        a stale ref resolves to null with no error.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSession} from '../src/techne/contract.ts';
import {createDisclosureSessionStore} from '../src/techne/session.ts';
import {selectionForPlace, placeFocusFromSession} from '../src/techne/m0m5/place/register.ts';
import {
  placeOffersOf,
  placeOffersOfPayload,
  validityWindowOf,
  timelineOpenPlan,
  basemapContextHits,
  flyHereLabel,
  openingPlaceSelection,
} from '../src/techne/m0m5/place/navigation.ts';

const SUBJECT = 'wiki:subject:expedition';
const READING = 'reading:expedition:4-2';
const SOURCE = 'wiki:source:field-notes';

const facetA = {
  place_ref: 'place:harbour',
  precision: 'exact',
  identity: {names: [{name: 'Harbour quarter'}]},
  source_ref: SOURCE,
  valid_from: '1850-03-04',
  valid_to: '1852-06-30',
};
const facetB = {
  place_ref: 'place:summit',
  precision: 'approximate',
  identity: {names: [{name: 'Summit camp'}]},
  source_ref: SOURCE,
};
const facetsOfSubject = [facetA, facetB];

function openSession() {
  const store = createDisclosureSessionStore();
  store.setSelection({
    selection_ref: `ql.techne:selection:${SUBJECT}:${SUBJECT}`,
    subject_ref: SUBJECT,
    reading_ref: READING,
    instrument: 'canvas',
    source_ref: SOURCE,
    selection_standing: 'current',
    agent_session_ref: null,
  });
  return store;
}

test('T22: a subject with two disclosed places offers both, in the reading order', () => {
  const offers = placeOffersOf(facetsOfSubject);
  assert.deepEqual(offers.map(offer => offer.place_ref), ['place:harbour', 'place:summit']);
  assert.deepEqual(offers.map(flyHereLabel), ['Fly here · Harbour quarter', 'Fly here · Summit camp']);
  assert.equal(offers[1].validity, null, 'a facet with no validity discloses no window');
});

test('T22: a subject with no disclosed place offers nothing — honest absence', () => {
  assert.deepEqual(placeOffersOf([]), []);
  assert.deepEqual(placeOffersOf(null), []);
  assert.deepEqual(placeOffersOf(undefined), []);
  assert.deepEqual(placeOffersOfPayload({}), []);
  assert.deepEqual(placeOffersOfPayload({spatial: 'not-an-array'}), []);
  assert.deepEqual(placeOffersOfPayload(null), []);
});

test('T22: a repeated or unnamed place facet never invents an extra offer', () => {
  const offers = placeOffersOf([facetA, {...facetA}, {place_ref: '   '}, {precision: 'exact'}]);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].place_ref, 'place:harbour');
  const unnamed = placeOffersOf([{place_ref: 'place:unnamed', precision: 'unlocated'}]);
  assert.equal(unnamed[0].title, 'place:unnamed', 'a place with no name reads under its own ref');
  assert.equal(unnamed[0].source_ref, null, 'no source disclosed stays null');
});

test('T22: the payload offers come from the reading’s own spatial array', () => {
  const offers = placeOffersOfPayload({spatial: facetsOfSubject});
  assert.deepEqual(offers.map(offer => offer.place_ref), ['place:harbour', 'place:summit']);
});

test('T22: offline gazetteer hits are basemap context, never subjects', () => {
  const entries = [
    {id: 'geonames:1', source: 'geonames', names: [{language: 'en', name: 'Harbour City'}], precision: 'exact', latitude: 51.5, longitude: -0.1},
    {id: 'pleiades:2', source: 'pleiades', names: [{language: 'la', name: 'Harbour Ruin'}], precision: 'region'},
  ];
  const index = {searchByName: (name, options) => entries.filter(entry => entry.names[0].name.toLowerCase().includes(name.toLowerCase())).slice(0, options?.limit ?? 10)};
  const hits = basemapContextHits(index, '  harbour ');
  assert.deepEqual(hits.map(hit => hit.label), ['Harbour City', 'Harbour Ruin']);
  assert.deepEqual(hits[0].coordinate, {latitude: 51.5, longitude: -0.1});
  assert.equal(hits[1].coordinate, null, 'a region hit carries no point, and none is fabricated');
  for (const hit of hits) {
    assert.deepEqual(Object.keys(hit).sort(), ['coordinate', 'id', 'label', 'precision', 'source']);
    assert.equal('subject_ref' in hit || 'place_ref' in hit, false, 'a gazetteer hit never names a subject or a place ref');
  }
  assert.deepEqual(basemapContextHits(index, '   '), [], 'a blank query asks nothing');
  assert.equal(basemapContextHits(index, 'harbour', 1).length, 1, 'the limit is honoured');
});

test('T23: the window is the facet’s own validity, exactly as disclosed', () => {
  assert.deepEqual(validityWindowOf(facetA), {from: '1850-03-04', to: '1852-06-30'});
  assert.deepEqual(validityWindowOf({valid_from: '1850'}), {from: '1850', to: null}, 'an open end stays open');
  assert.deepEqual(validityWindowOf({valid_to: '1900'}), {from: null, to: '1900'});
  assert.equal(validityWindowOf({valid_from: '', valid_to: null}), null, 'an empty bound is no bound');
  assert.equal(validityWindowOf({}), null);
});

test('T23: timelineOpenPlan carries the window and the place ref; a blank ref is refused', () => {
  const plan = timelineOpenPlan(facetA);
  assert.deepEqual(plan.window, {from: '1850-03-04', to: '1852-06-30'});
  assert.equal(plan.spatial_focus_ref, 'place:harbour');
  assert.equal(timelineOpenPlan(facetB).window, null, 'no validity → the window is left as it is');
  assert.throws(() => timelineOpenPlan({place_ref: ' '}), /verbatim/);
});

test('T24: the spatial focus names the facet the Places lens selects on open; a stale ref is null', () => {
  const store = openSession();
  const focused = store.setSpatialFocus('place:summit');
  assert.equal(focused.spatial_focus_ref, 'place:summit');
  assert.equal(validateSession(focused).valid, true);
  assert.equal(placeFocusFromSession(store.get(), facetsOfSubject), 'place:summit');

  const stale = store.setSpatialFocus('place:vanished');
  assert.equal(stale.spatial_focus_ref, 'place:vanished');
  assert.equal(placeFocusFromSession(store.get(), facetsOfSubject), null, 'a ref the reading does not disclose opens unselected, without error');

  store.setSpatialFocus(null);
  assert.equal(store.get().spatial_focus_ref, undefined);
  assert.equal(placeFocusFromSession(store.get(), facetsOfSubject), null);
});

test('T24: the setter needs an open session, as the other session setters do', () => {
  assert.throws(() => createDisclosureSessionStore().setSpatialFocus('place:summit'), /No DisclosureSession/);
});

test('round trip: place → timeline → place keeps subject, reading basis and selection, and lands on the same facet', () => {
  const store = openSession();
  const before = store.get();
  const placeSelection = selectionForPlace(before, facetA.place_ref);
  store.setSelection(placeSelection);
  const placed = store.get();
  assert.deepEqual(placed.selection.focus_refs, ['place:harbour']);
  assert.equal(placed.selection.source_ref, SOURCE, 'the source basis rides verbatim');

  // Open in Timeline: the window from the facet's validity, the place ref as spatial focus.
  const plan = timelineOpenPlan(facetA);
  store.setTimeWindow(plan.window);
  store.setSpatialFocus(plan.spatial_focus_ref);
  const timeline = store.openInInstrument('timeline');

  assert.equal(timeline.subject_ref, SUBJECT, 'the same subject');
  assert.equal(timeline.reading_ref, READING, 'the same reading basis');
  assert.equal(timeline.session_ref, placed.session_ref, 'the same session');
  assert.equal(timeline.selection.selection_ref, placed.selection.selection_ref, 'the same selection');
  assert.equal(timeline.selection.source_ref, SOURCE);
  assert.deepEqual(timeline.time_window, {from: '1850-03-04', to: '1852-06-30'}, 'the window equals the facet validity');
  assert.equal(validateSession(timeline).valid, true);

  // Reopen Places from the Timeline: the spatial focus lands it on the same facet.
  const reopened = store.openInInstrument('place');
  assert.equal(placeFocusFromSession(reopened, facetsOfSubject), 'place:harbour');
  assert.equal(reopened.subject_ref, SUBJECT);
  assert.equal(reopened.reading_ref, READING);
});

test('T24: with no declared focus the Places lens keeps its own remembered selection', () => {
  const store = openSession();
  assert.equal(openingPlaceSelection(null, facetsOfSubject, 'place:summit'), 'place:summit', 'no session: the remembered selection stands');
  assert.equal(openingPlaceSelection(store.get(), facetsOfSubject, 'place:summit'), 'place:summit', 'an undeclared focus leaves the remembered selection');
  assert.equal(openingPlaceSelection(store.get(), facetsOfSubject, null), null);
});

test('T24: a declared spatial focus governs the opening; a stale one opens unselected, not on the remembered selection', () => {
  const store = openSession();
  store.setSpatialFocus('place:summit');
  assert.equal(openingPlaceSelection(store.get(), facetsOfSubject, 'place:harbour'), 'place:summit');
  store.setSpatialFocus('place:vanished');
  assert.equal(openingPlaceSelection(store.get(), facetsOfSubject, 'place:harbour'), null, 'a stale declared focus opens unselected');
});

test('T24: a selection that names a disclosed place is the focus on open (Journey or Canvas selection)', () => {
  const store = openSession();
  store.setSelection(selectionForPlace(store.get(), 'place:harbour'));
  assert.equal(openingPlaceSelection(store.get(), facetsOfSubject, 'place:summit'), 'place:harbour');
  store.setSelection({...store.get().selection, focus_refs: ['whole:not-a-place']});
  assert.equal(openingPlaceSelection(store.get(), facetsOfSubject, 'place:summit'), null, 'a focus that is not a disclosed place opens unselected');
});
