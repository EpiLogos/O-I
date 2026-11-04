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

test("the presentation parameters are the owner's own fields: sound, level, scale, cadence and the instrument's named refusal", () => {
  const owned = controllerReading({muted: false, presentation_level: {value: 2}, presentation_units_per_metre: 120, presentation_mode: 'domain-follow'});
  owned.instrument = {acting: owned.instrument.acting, cadence: {playing: true, rate: 12, source: '12 ticks/s'}, refusal: {operation: 'lens', reason: 'L1′ is already acting'}};
  const {parameters} = announceInstrument(owned);
  assert.deepEqual(parameters, {muted: false, level: 2, scale: {unitsPerMetre: 120, mode: 'domain-follow'},
    cadence: {rate: 12, playing: true, source: '12 ticks/s'}, refusal: 'lens: L1′ is already acting'});
  const held = controllerReading({});
  held.instrument = {acting: held.instrument.acting, cadence: {playing: false, rate: 12, source: '12 ticks/s'}, refusal: null};
  assert.equal(announceInstrument(held).parameters.cadence.rate, 0, 'a held cadence reads rate 0, not the last rate');
  const noScene = announceInstrument(controllerReading({instrument: null}));
  assert.equal(noScene.parameters.cadence, null, 'no scene: no cadence reading, never a default');
});

// O-I #855 round 6d: the Torus's session carries what QL's torus-state names beside it — the M2 condition's maqām (with its pitches or the
// owner's words for its absence), the lens's material and the twelve classes — as the owner gave them, so the shell can say the maqām is
// absent before it is chosen. An owner that names none of them announces none.
test('the Torus session carries the owner\'s maqām, material and classes as torus-state gives them, and none an owner does not name', () => {
  const torus = {settings: {tuning: 'logic'}, steps_per_second: 2.5, band: 'rhythm', fundamental_hz: 130.81, map_hz: 130.81, figure: 'torus', comma_cents: 0,
    notes: [{key: {row: 0, column: 42}}], resident_tunings: ['logic', 'sky'], carrier: {drive: 'pulse'},
    maqam: {name: 'Kirdan', coordinate: '#2-4.3-0-4', role: 'tonic', tonic_hz: 196, tuning: 'bimba-spelled24-tet', standing: 'source-held', pitches_hz: null, absent: 'no Bimba spelling'},
    material: {absent: 'no lens names a surface here'}, classes: {absent: 'this scene holds no maqam voices: its event admits none'}};
  const named = announceInstrument(controllerReading({instrument: {...controllerReading().instrument, torus}})).parameters.torus;
  assert.deepEqual([named.maqam, named.material, named.classes], [torus.maqam, torus.material, torus.classes]);
  assert.equal(named.notes, 1, 'the notes as their count, as before');
  const {maqam: _m, material: _t, classes: _c, ...before} = torus;
  const none = announceInstrument(controllerReading({instrument: {...controllerReading().instrument, torus: before}})).parameters.torus;
  for (const key of ['maqam', 'material', 'classes']) assert.equal(key in none, false, `${key}: not named, not announced`);
});

// O-I 856: where the Torus is heard from is announced as the controller reads it — Receiver On or Off, the owner's context and its refusal —
// and never the place, nor the gains the owner hears each voice by.
test('Receiver is announced as On or Off, the owner\'s context and its refusal: never a place', () => {
  const heard = controllerReading({receiver: {on: true, context: 'personal', gains: [{mode_ref: 'scene:logic/0', gain: 0.25}], law: 'the law', refusal: null}});
  assert.deepEqual(announceInstrument(heard).parameters.receiver, {on: true, context: 'personal', refusal: null});
  const refused = controllerReading({receiver: {on: false, context: 'world', gains: null, law: null, refusal: 'no torus here'}});
  assert.deepEqual(announceInstrument(refused).parameters.receiver, {on: false, context: 'world', refusal: 'no torus here'});
  assert.equal('receiver' in announceInstrument(controllerReading()).parameters, false, 'a reading without one announces none');
  assert.doesNotMatch(JSON.stringify(announceInstrument(heard)), /at_metres|gains/);
});
