// The frame's announcement of the native instrument (ticket T-LIVE-TORUS-INSTRUMENT leg 2). Every value the announcement carries is
// the owner's own: the controller's status, the native basis's identity refs, the session's cursors and receipt, and the scene's acting
// determinants. Nothing is composed from a default. Absent when no native session is open.
import test from 'node:test';
import assert from 'node:assert/strict';
import {announceInstrument} from '../src/native-field/ql/instrumentAnnouncement.mjs';

const basis = {event_ref: 'event:owner', subject_ref: 'subject:owner', registry_revision: 'registry:owner',
  geometry_ref: 'geometry:owner', material_ref: 'material:owner', model_ref: 'model:owner', generation: '4', samples_elapsed: '245760'};
const controllerReading = (over = {}) => ({
  schema: 'oi.native-expression-reading/v1', status: 'following', reason: null,
  playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'owner policy'},
  native: {instance_ref: 'instance:owner', event_ref: 'event:owner', subject_ref: 'subject:owner', reason: null,
    acknowledged: {generation: '4', samples_elapsed: '245760'}, presented: {generation: '4', samples_elapsed: '245760'},
    audio: {schema: 'ql.native-audio-receipt/v1', native: basis, device_epoch: 0, device_sample_rate: 48000},
    available: true, held: false, in_flight: false, queued_blocks: 3, queued_bytes: 4096, coalesced_presentation_frames: 0,
    views: 1, disposed: false},
  instrument: {schema: 'oi.scene-instrument-reading/v1', acting: {
    m1: {lens12: 3, lens: 'L1′', context_frame: 2}, harmonic: {source: {selection: 'canonical-basis', index: 4}, ratio: [3, 2]},
    m3: {rna: true, sequence: 'AUG', codon_ref: 'codon:1'}}},
  ...over,
});

test('no native session open: nothing is announced, so the shell withdraws the reading', () => {
  assert.equal(announceInstrument(controllerReading({native: null})), undefined);
  assert.equal(announceInstrument(null), undefined);
});

test("the reading is the owner's: standing from the controller, identity from the native basis, cursors and receipt unchanged", () => {
  const {reading} = announceInstrument(controllerReading());
  assert.equal(reading.schema, 'ql.instrument-reading/v1');
  assert.equal(reading.standing, 'following');
  assert.deepEqual(reading.identity, {event_ref: 'event:owner', subject_ref: 'subject:owner', registry_revision: 'registry:owner',
    geometry_ref: 'geometry:owner', material_ref: 'material:owner', model_ref: 'model:owner'});
  assert.deepEqual(reading.acknowledged, {generation: '4', samples_elapsed: '245760'});
  assert.equal(reading.audio.device_sample_rate, 48000);
  assert.equal(reading.queued_blocks, 3);
  assert.deepEqual(reading.playback_policy, {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'owner policy'});
});

test('a native basis with no identity refs leaves them absent: the boundary refuses them by name, nothing is invented', () => {
  const {reading} = announceInstrument(controllerReading({native: {...controllerReading().native, audio: {native: null}}}));
  assert.equal(reading.identity.registry_revision, undefined);
  assert.equal(reading.identity.event_ref, 'event:owner', 'the session carries its own event ref');
});

test("the determinants are the scene's acting M1 state, verbatim", () => {
  const {determinants} = announceInstrument(controllerReading());
  assert.deepEqual(determinants, {lens: {lens12: 3, label: 'L1′'}, contextFrame: 2, harmonic: {selection: 'canonical-basis', index: 4}, rna: true});
  const row = announceInstrument(controllerReading({instrument: {acting: {
    m1: {lens12: 0, lens: 'L0', context_frame: 7}, harmonic: {source: {selection: 'selected-source-row'}}, m3: {rna: false}}}}));
  assert.deepEqual(row.determinants.harmonic, {selection: 'selected-source-row'});
  assert.equal(row.determinants.rna, false);
});

test('a session with no scene carries no determinants: the macro rows say so', () => {
  const {reading, determinants} = announceInstrument(controllerReading({instrument: null}));
  assert.equal(determinants, null);
  assert.equal(reading.standing, 'following', 'the reading itself is still announced');
});
