// Lane-2 T19–T22 — chronology navigation identity (pure proofs).
//   T19  an event opens its source at the passage the reading discloses for it; a source
//        without a passage opens at its top with no invented anchor; the bridge carries a
//        passage only when the reading makes it unambiguous.
//   T20  event → relation → endpoint → back returns to the same event, with the subject and
//        selection carried by ref at every hop; a derived relation is named, never opened.
//   T21  "Show on the globe" offers the event's one located place with the event's own
//        validity as the window; zero or several places are named, never chosen between.
//   T22  a crossing planned on one session refuses by name once the session has drifted,
//        and the status line discloses the subject, reading basis and window verbatim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {validateReading} from '../src/techne/contract.ts';
import {createDisclosureSessionStore, sessionCrossingIdentity} from '../src/techne/session.ts';
import {groundSelection} from '../src/techne/m0m5/reading.ts';
import {provingReading, PROVING_SUBJECT_REF} from '../src/techne/m0m5/journey/proving-reading.ts';
import {timeAxisProjection} from '../src/techne/m0m5/timeline/timeAxis.ts';
import {
  isLocatableSelector,
  evidenceAnchorOf,
  evidenceControlOf,
  evidenceOpenPlan,
  trailFromEvent,
  currentHop,
  originEvent,
  openRelation,
  openEndpoint,
  backTrail,
  eventWindowOf,
  showOnGlobeOf,
  axisEventOf,
  handoffRefusal,
  handoffDisclosure,
} from '../src/techne/m0m5/timeline/navigationIdentity.ts';

// The bridge is vendored TypeScript; compile it the way the bridge's own carry test does.
const compiled = await build({
  stdin: {
    contents: "export {bundleFromTechneReadings} from '../expressions-app/vendor/research-canvas/packages/desktop-api/src/techneBundle.ts';",
    resolveDir: fileURLToPath(new URL('.', import.meta.url)),
    loader: 'ts',
  },
  alias: {'@research-canvas/schema': fileURLToPath(new URL('../expressions-app/vendor/research-canvas/packages/schema/src/index.ts', import.meta.url))},
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const {bundleFromTechneReadings} = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

const GREENWICH = 'place:fixture:royal-observatory-greenwich';
const AUTHORED = 'ql.techne:facet:tb0:authored';
const VALID = 'ql.techne:facet:tb0:valid';
const RECEIVED = 'ql.techne:facet:tb0:received';

/** The proving reading with one subject→place LOCATED_AT relation added (its place is a disclosed facet). */
function locatedReading(places = [GREENWICH]) {
  const reading = structuredClone(provingReading());
  reading.whole.relations = [
    ...(reading.whole.relations ?? []),
    ...places.map(to => ({relation: 'LOCATED_AT', from_ref: PROVING_SUBJECT_REF, to_ref: to, origin: 'native', origin_ref: null})),
  ];
  return reading;
}

function storeOn(reading) {
  const store = createDisclosureSessionStore();
  return {store, session: store.setSelection(groundSelection(reading, 'timeline'))};
}

const relationProps = (bundle, facetRef) => bundle.relationships.find(row => row.targetGraphNodeId === facetRef && row.properties.temporal_kind)?.properties;

test('T19 the bridge carries the one unambiguous passage on its facet, and nothing for a facet without one', () => {
  const reading = provingReading();
  assert.equal(validateReading(reading).valid, true, 'the proving reading is a valid contract reading');
  const bundle = bundleFromTechneReadings([reading]);
  assert.deepEqual(relationProps(bundle, AUTHORED).temporal_provenance_selector, {unit: 'text_span', start: 0, end: 1200, anchor_ref: null},
    'the authored facet carries the text_span its source discloses, verbatim');
  assert.equal('temporal_provenance_selector' in relationProps(bundle, RECEIVED), false,
    'a facet whose source discloses no passage carries no selector (never a placeholder)');
});

test('T19 two facets from one source, or two candidate passages, carry no passage by guessing', () => {
  const twoFacets = structuredClone(provingReading());
  twoFacets.temporal.push({facet_ref: 'ql.techne:facet:tb0:second', kind: 'occurrence', instant: '2026-09-17T00:00:00+01:00', precision: 'day', source_ref: PROVING_SUBJECT_REF});
  assert.equal('temporal_provenance_selector' in relationProps(bundleFromTechneReadings([twoFacets]), AUTHORED), false);

  const twoPassages = structuredClone(provingReading());
  twoPassages.provenance.push({source_ref: PROVING_SUBJECT_REF, native_owner: 'central', selector: {unit: 'text_span', start: 1300, end: 1400}});
  assert.equal('temporal_provenance_selector' in relationProps(bundleFromTechneReadings([twoPassages]), AUTHORED), false);
});

test('T19 an event opens at its passage; a source without one opens at its top with no invented anchor', () => {
  const bundle = bundleFromTechneReadings([provingReading()]);
  const authored = evidenceAnchorOf(relationProps(bundle, AUTHORED));
  assert.equal(authored.state, 'passage');
  assert.deepEqual(authored.selector, {unit: 'text_span', start: 0, end: 1200, anchor_ref: null});
  assert.deepEqual(evidenceControlOf(authored), {present: true, label: 'Open source at its passage'});
  assert.deepEqual(evidenceOpenPlan(authored), {source_ref: PROVING_SUBJECT_REF, selector: authored.selector});

  const top = evidenceAnchorOf(relationProps(bundle, RECEIVED));
  assert.equal(top.state, 'top');
  assert.equal(top.source_ref, 'central:source:control:root:.central/source-change-horizon.json');
  assert.equal(evidenceControlOf(top).present, false, 'no passage: the anchor control is absent, with its reason');
  assert.equal(evidenceOpenPlan(top).selector, null, 'the top is opened with no selector');
});

test('T19 a shape the contract would refuse is never read as a passage', () => {
  assert.equal(isLocatableSelector({unit: 'text_span', start: 5, end: 2}), false);
  assert.equal(isLocatableSelector({unit: 'text_span', start: -1, end: 2}), false);
  assert.equal(isLocatableSelector({unit: 'other', kind: 'techne-temporal-facet', value: AUTHORED}), false);
  assert.equal(isLocatableSelector({unit: 'timestamp_range', from: '2026-09-16T00:00:00Z', to: '2026-09-17T00:00:00Z'}), true);
  assert.equal(isLocatableSelector({unit: 'image_region', x: 0, y: 0, width: 10, height: 10}), true);
  assert.equal(evidenceAnchorOf({temporal_source_ref: 'src:x', temporal_provenance_selector: {unit: 'other'}}).state, 'top');
  assert.equal(evidenceAnchorOf({}).state, 'absent');
});

test('T20 event → relation → endpoint → back returns to the same event, with subject and selection kept by ref', () => {
  const reading = provingReading();
  const {session} = storeOn(reading);
  const identity = sessionCrossingIdentity(session);
  const origin = trailFromEvent(AUTHORED, reading.subject.subject_ref, session.selection.selection_ref);
  const relation = {relation_ref: 'native:relation:supersedes', from_ref: reading.subject.subject_ref, to_ref: 'central:source:other', origin: 'native'};

  const onRelation = openRelation(origin, relation);
  assert.equal(onRelation.ok, true);
  const onEndpoint = openEndpoint(onRelation.trail, 'to');
  assert.equal(onEndpoint.ok, true);
  assert.equal(currentHop(onEndpoint.trail).ref, 'central:source:other');

  for (const hop of onEndpoint.trail.hops) {
    assert.equal(hop.subject_ref, reading.subject.subject_ref, 'subject_ref is byte-equal at every hop');
    assert.equal(hop.selection_ref, session.selection.selection_ref, 'selection_ref is byte-equal at every hop');
  }

  const back1 = backTrail(onEndpoint.trail);
  assert.equal(currentHop(back1).kind, 'relation');
  const back2 = backTrail(back1);
  assert.equal(currentHop(back2).kind, 'event');
  assert.equal(originEvent(back2).ref, AUTHORED, 'the round trip lands on the same event');
  assert.equal(backTrail(back2), back2, 'back from the origin event keeps the event; it is never popped');
  assert.equal(sessionCrossingIdentity(session).session_ref, identity.session_ref, 'the session is untouched by the traversal');
});

test('T20 a derived relation is named as derived and never opened as a native relation', () => {
  const origin = trailFromEvent(AUTHORED, PROVING_SUBJECT_REF, 'sel');
  const derived = openRelation(origin, {relation_ref: null, from_ref: PROVING_SUBJECT_REF, to_ref: 'x'});
  assert.deepEqual(derived, {ok: false, reason: 'derived (no native relation_ref disclosed)'});
});

test('T20 a relation must touch the event it is opened from, and an endpoint must follow a relation', () => {
  const origin = trailFromEvent(AUTHORED, PROVING_SUBJECT_REF, 'sel');
  assert.equal(openRelation(origin, {relation_ref: 'r', from_ref: 'a', to_ref: 'b'}).ok, false);
  assert.equal(openEndpoint(origin, 'from').ok, false, 'an endpoint cannot open from an event');
});

test('T21 an event whose subject is LOCATED_AT one disclosed place offers that place with the event\'s own validity', () => {
  const reading = locatedReading();
  const {session} = storeOn(reading);
  const axis = timeAxisProjection(reading, session);
  const event = axisEventOf(axis, AUTHORED);
  assert.deepEqual(showOnGlobeOf(reading, reading.subject.subject_ref, event), {
    state: 'offer',
    place_ref: GREENWICH,
    window: {from: '2026-09-16T00:00:00+01:00', to: '2026-09-16T00:00:00+01:00'},
  });
});

test('T21 the window of an interval event is its own bounds, and an unbounded event has no window', () => {
  const reading = locatedReading();
  const axis = timeAxisProjection(reading, storeOn(reading).session);
  assert.equal(eventWindowOf(axisEventOf(axis, 'ql.techne:facet:tb0:run')).from, '2026-09-15T09:10:00+01:00');
  assert.equal(eventWindowOf(axisEventOf(axis, VALID)).from, '2026-09-16T00:00:00+01:00');
  assert.equal(eventWindowOf(axisEventOf(axis, VALID)).to, null);
  assert.equal(eventWindowOf(axisEventOf(axis, 'ql.techne:facet:tb0:day')), null, 'a continuity facet discloses no bound');
  assert.equal(eventWindowOf(undefined), null);
});

test('T21 no location, an undisclosed located place, or several located places are named, never flown to', () => {
  const plain = provingReading();
  const none = showOnGlobeOf(plain, plain.subject.subject_ref, undefined);
  assert.equal(none.state, 'absent');
  assert.equal(none.reason, "No location is disclosed for this event's subject.");

  const undisclosed = locatedReading(['place:fixture:not-a-facet']);
  assert.equal(showOnGlobeOf(undisclosed, undisclosed.subject.subject_ref, undefined).state, 'absent');

  const several = locatedReading([GREENWICH, 'place:fixture:avalon']);
  const severalCarry = showOnGlobeOf(several, several.subject.subject_ref, undefined);
  assert.equal(severalCarry.state, 'absent');
  assert.match(severalCarry.reason, /More than one place/);
});

test('T22 a crossing planned on the open session proceeds; a drifted session refuses by name and is not re-targeted', () => {
  const reading = provingReading();
  const {store, session} = storeOn(reading);
  const planned = sessionCrossingIdentity(session);
  assert.equal(handoffRefusal(planned, store.get()), null, 'the same session may cross');

  store.setTimeWindow({from: '2026-01-01T00:00:00+00:00', to: null});
  assert.match(handoffRefusal(planned, store.get()), /window or actual selection\/instrument changed/, 'a window moved since planning refuses');

  const fresh = createDisclosureSessionStore();
  const replaced = fresh.setSelection(groundSelection(reading, 'place'));
  assert.match(handoffRefusal(planned, replaced), /changed since this crossing was planned; it was not re-targeted/,
    'another session never silently receives the crossing');

  assert.match(handoffRefusal(planned, null), /No Technē session is open/);
});

test('T22 a session on another reading or snapshot refuses in the owner words', () => {
  const reading = provingReading();
  const {session} = storeOn(reading);
  const planned = sessionCrossingIdentity(session);
  assert.equal(handoffRefusal(planned, {...session, reading_ref: 'ql.techne:reading:other@1'}), 'This DisclosureSession discloses another native reading');
  const revisedSelection = {...session, selection: {...session.selection, snapshot_revision: 'rev-9'}};
  assert.match(handoffRefusal({...planned, snapshot_revision: null}, revisedSelection), /source snapshot changed/);
});

test('T22 the status line discloses the subject, reading basis and window exactly as the session holds them', () => {
  const reading = provingReading();
  const {store, session} = storeOn(reading);
  assert.equal(handoffDisclosure(session),
    `Subject ${PROVING_SUBJECT_REF} · reading basis ${reading.reading_ref}, revision not disclosed · window none set`);
  const windowed = store.setTimeWindow({from: '2026-09-15T00:00:00+01:00', to: null});
  assert.match(handoffDisclosure(windowed), /window 2026-09-15T00:00:00\+01:00 to open$/);
});
