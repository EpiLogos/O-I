import test from 'node:test';
import assert from 'node:assert/strict';
import { beats, sceneTitle } from '../src/techne/journey/beats.ts';
import { assertReading } from '../src/techne/adapter.ts';
import { loadFixtureReadings } from '../src/techne/fixtures/load-fixtures.mjs';

const readings = await loadFixtureReadings();
const representative = readings.find((reading) => reading.reading_ref === 'ql.techne:reading:fixture:representative-subject@1');
const absentFacets = readings.find((reading) => reading.reading_ref === 'ql.techne:reading:fixture:absent-facets@1');
const developmentDay = readings.find((reading) => reading.reading_ref === 'ql.techne:reading:fixture:development-day@1');

test('the representative fixture yields exactly one beat, with the scene ref, expression ref and revision verbatim', () => {
  const model = beats(representative);
  assert.equal(model.beats.length, 1);
  assert.equal(model.unavailableReason, undefined);
  const beat = model.beats[0];
  assert.equal(beat.scene_ref, 'oi:expression:l5-techne-constellation/scene/opening');
  assert.equal(beat.expression_ref, 'oi:expression:l5-techne-constellation');
  assert.equal(beat.revision, '3');
  assert.equal(beat.title, 'opening', 'the display title is the scene_ref tail, never a replacement for the ref');
  assert.equal(sceneTitle(beat.scene_ref), 'opening');
});

test('the beat frame carries the reading’s own facets: day_ref, place name, source ref and selector unit', () => {
  const { beats: beatList } = beats(representative);
  const frame = beatList[0].frame;
  assert.equal(frame.subject_ref, representative.subject.subject_ref, 'the subject frame is the reading’s subject, verbatim');
  assert.deepEqual(
    frame.temporal.map((facet) => facet.kind),
    ['occurrence', 'day'],
    'the temporal frame is exactly the reading’s occurrence/day facets — receipt and now stay with the timeline',
  );
  const day = frame.temporal.find((facet) => facet.kind === 'day');
  assert.equal(day.day_ref, 'central:day:control:root:2026-09-15');
  const occurrence = frame.temporal.find((facet) => facet.kind === 'occurrence');
  assert.equal(occurrence.instant, '2026-09-16T09:30:00+01:00');
  assert.deepEqual(frame.places, [{
    place_ref: 'place:fixture:royal-observatory-greenwich',
    names: ['Royal Observatory, Greenwich'],
    precision: 'approximate',
  }]);
  assert.equal(frame.sources.length, 1);
  assert.equal(frame.sources[0].source_ref, 'central:source:control:root:Control/user/civil-time-policy.json');
  assert.equal(frame.sources[0].selector.unit, 'text_span');
  assert.equal(frame.sources[0].selector.start, 0);
  assert.equal(frame.sources[0].selector.end, 741);
});

test('a reading with no Expression bindings yields zero beats and the honest unavailable reason', () => {
  for (const reading of [absentFacets, developmentDay]) {
    const model = beats(reading);
    assert.deepEqual(model.beats, []);
    assert.match(model.unavailableReason, /no Expression/i);
  }
  assert.equal(
    beats(absentFacets).unavailableReason,
    absentFacets.disclosure.instruments.find((entry) => entry.instrument === 'journey').reason,
    'the owner disclosure’s own journey reason is preferred verbatim',
  );
});

test('bindings without scene refs are data, not errors: zero beats and a derived reason', () => {
  const reading = assertReading({
    ...absentFacets,
    expressions: [{ expression_ref: 'oi:expression:unscened', revision: '1', scene_ref: null, composition_ref: null, profile_ref: null }],
    disclosure: {
      ...absentFacets.disclosure,
      instruments: absentFacets.disclosure.instruments.map((entry) => (
        entry.instrument === 'journey' ? { instrument: 'journey', available: true } : entry
      )),
    },
  });
  const model = beats(reading);
  assert.deepEqual(model.beats, []);
  assert.equal(model.unavailableReason, 'bound Expressions disclose no scene refs');
});

test('multiple scene-bearing bindings become ordered beats in binding order, refs untouched', () => {
  const reading = assertReading({
    ...representative,
    expressions: [
      { expression_ref: 'oi:expression:l5-techne-constellation', revision: '3', scene_ref: 'oi:expression:l5-techne-constellation/scene/opening', composition_ref: null, profile_ref: null },
      { expression_ref: 'oi:expression:l5-techne-constellation', revision: '3', scene_ref: 'oi:expression:l5-techne-constellation/scene/refrain', composition_ref: null, profile_ref: null },
      { expression_ref: 'oi:expression:other', revision: '7', scene_ref: 'oi:expression:other/scene/coda', composition_ref: null, profile_ref: null },
    ],
  });
  const model = beats(reading);
  assert.deepEqual(model.beats.map((beat) => beat.scene_ref), [
    'oi:expression:l5-techne-constellation/scene/opening',
    'oi:expression:l5-techne-constellation/scene/refrain',
    'oi:expression:other/scene/coda',
  ]);
  assert.deepEqual(model.beats.map((beat) => beat.revision), ['3', '3', '7']);
});
