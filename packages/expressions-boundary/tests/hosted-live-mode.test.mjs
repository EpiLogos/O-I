// The hosted 'live' cut (ticket T-LIVE-TORUS-INSTRUMENT leg 2): the frame presents its M1 body full-stage for Live mode, and
// announces the owner's instrument reading. The reader carries a valid reading and its determinants, carries a refused reading
// as its named fault, and never guesses a value. The existing cuts are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readHostedState, readHostedInstrument, isHostedAppMode, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const base = (extra = {}) => ({hostMode: 'live', sceneIndex: 0, sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}, ...extra});

// The owner-shaped ql.instrument-reading/v1 (ql-musical-family.test.mjs fixture).
const ownerReading = () => ({
  schema: 'ql.instrument-reading/v1', standing: 'following', reason: null,
  identity: {event_ref: 'controlled:occasion', subject_ref: 'controlled:subject', registry_revision: 'controlled:registry',
    geometry_ref: 'controlled:geometry', material_ref: 'controlled:material', model_ref: 'controlled:model'},
  acknowledged: {generation: '4', samples_elapsed: '245760'}, presented: {generation: '4', samples_elapsed: '245760'},
  audio: {schema: 'ql.native-audio-receipt/v1', device_epoch: 0, device_sample_rate: 48000, native_origin: '0',
    context_origin_seconds: 0.5, observed_context_seconds: 0.61, target_context_seconds: 5.62, status: 'scheduled', muted: true,
    presentation_gain: 0.1, scheduled_blocks: 30, discarded_blocks: 0, reason: null, interval: null,
    standing: 'native PCM scheduled on a browser audio graph; not proof of physical speaker output'},
  available: true, held: false, in_flight: false, queued_blocks: 3, queued_bytes: 4096,
  coalesced_presentation_frames: 0, views: 1, disposed: false,
  playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'test'},
});
const parameters = () => ({muted: true, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'},
  cadence: {rate: 1, playing: true, source: '1 tick/s'}, refusal: null});
const determinants = () => ({lens: {lens12: 3, label: 'L1′'}, contextFrame: 2,
  harmonic: {selection: 'canonical-basis', index: 4}, rna: true});

test("'live' is an admitted hosted cut, and the reader keeps it as the frame's cut", () => {
  assert.equal(isHostedAppMode('live'), true);
  assert.equal(isHostedAppMode('audio'), false, 'the shell cut name is not a hosted cut');
  assert.equal(readHostedState(base())?.hostMode, 'live');
});

test('a live cut without a named sceneCount or a bare cut is still refused, as before', () => {
  assert.equal(readHostedState({hostMode: 'live'}), null);
  assert.equal(readHostedState({hostMode: 'nara', sceneCount: 1}), null);
});

test("the host stands the frame in 'live' and re-posts the cut; the document and selection are retained", async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000, mode: 'expressions'});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: base({hostMode: 'expressions', selection: [{id: 'entity:one', name: 'Kept'}]})});
  const selected = host.getState();
  host.setMode('live');
  host.setMode('expressions');
  host.setMode('live');
  assert.deepEqual(host.getState(), selected, 'the cut change keeps the reading');
  const cuts = (await wire.observe()).filter(d => d.kind === 'host-mode').map(d => d.mode);
  // The constructor announces the opening cut; each setMode posts its own host-mode.
  assert.deepEqual(cuts, ['expressions', 'live', 'expressions', 'live'], 'every cut change is posted as host-mode');
});

test('an announced instrument is carried: the owner reading parses through the shell reader, with its determinants', () => {
  const state = readHostedState(base({instrument: {reading: ownerReading(), determinants: determinants(), parameters: parameters()}}));
  assert.ok(state, 'the announcement is admitted');
  assert.equal(state.instrument.ok, true);
  assert.equal(state.instrument.reading.standing, 'following');
  assert.equal(state.instrument.reading.identity.event_ref, 'controlled:occasion');
  assert.deepEqual(state.instrument.determinants, determinants());
  assert.deepEqual(state.instrument.parameters, parameters());
});

test('an announcement with no instrument carries none (the shell withdraws)', () => {
  assert.equal('instrument' in readHostedState(base()), false);
});

test('a reading the owner does not produce is carried as its named refusal, never as a plausible state', () => {
  const bad = readHostedState(base({instrument: {reading: {...ownerReading(), standing: 'guessing'}, determinants: null, parameters: parameters()}}));
  assert.ok(bad, 'the rest of the state is still admitted');
  assert.equal(bad.instrument.ok, false);
  assert.match(bad.instrument.fault, /standing/);
  assert.equal(readHostedInstrument({reading: {}}).ok, false);
  assert.equal(readHostedInstrument('nope').ok, false);
});

test('determinants are exact or refused: out-of-range or missing values are never guessed', () => {
  const refused = (d, pattern) => {
    const instrument = readHostedInstrument({reading: ownerReading(), determinants: d, parameters: parameters()});
    assert.equal(instrument.ok, false, JSON.stringify(d));
    assert.match(instrument.fault, pattern);
  };
  refused({...determinants(), lens: {lens12: 12, label: 'L6'}}, /lens12/);
  refused({...determinants(), contextFrame: 0}, /contextFrame/);
  refused({...determinants(), contextFrame: 8}, /contextFrame/);
  refused({...determinants(), harmonic: {selection: 'canonical-basis', index: 8}}, /harmonic/);
  refused({...determinants(), rna: 'yes'}, /rna/);
  refused({lens: {lens12: 1, label: 'L0'}}, /determinants/);
  const selectedRow = readHostedInstrument({reading: ownerReading(), determinants: {...determinants(), harmonic: {selection: 'selected-source-row'}}, parameters: parameters()});
  assert.equal(selectedRow.ok, true);
  assert.deepEqual(selectedRow.determinants.harmonic, {selection: 'selected-source-row'});
  const none = readHostedInstrument({reading: ownerReading(), determinants: null, parameters: parameters()});
  assert.equal(none.ok, true);
  assert.equal(none.determinants, null, 'a reading with no scene carries no determinants: the macro rows say so');
});

// The seam itself: the frame's composer output, fed through the boundary's announcement reader, is the owner's value end to end.
import {announceInstrument} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/ql/instrumentAnnouncement.mjs';
test('the frame composes its announcement and the boundary carries it unchanged: the owner reading and its determinants reach the shell', () => {
  const basis = {event_ref: 'event:owner', subject_ref: 'subject:owner', registry_revision: 'registry:owner',
    geometry_ref: 'geometry:owner', material_ref: 'material:owner', model_ref: 'model:owner', generation: '4', samples_elapsed: '245760'};
  const controller = {schema: 'oi.native-expression-reading/v1', status: 'following', reason: null, muted: true,
    presentation_level: {value: 1}, presentation_units_per_metre: 120, presentation_mode: 'domain-follow',
    playback_policy: {blockFrames: 8192, leadSeconds: 0.5, lookaheadSeconds: 0.5, owner: 'owner policy'},
    native: {event_ref: 'event:owner', subject_ref: 'subject:owner', reason: null,
      acknowledged: {generation: '4', samples_elapsed: '245760'}, presented: {generation: '4', samples_elapsed: '245760'},
      audio: {schema: 'ql.native-audio-receipt/v1', native: basis, device_epoch: 0, device_sample_rate: 48000, native_origin: '0',
        context_origin_seconds: 0.5, observed_context_seconds: 0.61, target_context_seconds: 5.62, status: 'scheduled', muted: true,
        presentation_gain: 0.1, scheduled_blocks: 30, discarded_blocks: 0, reason: null, interval: null,
        standing: 'native PCM scheduled on a browser audio graph; not proof of physical speaker output'},
      available: true, held: false, in_flight: false, queued_blocks: 3, queued_bytes: 4096, coalesced_presentation_frames: 0,
      views: 1, disposed: false},
    instrument: {acting: {m1: {lens12: 3, lens: 'L1′', context_frame: 2}, harmonic: {source: {selection: 'canonical-basis', index: 4}}, m3: {rna: true}},
      cadence: {playing: true, rate: 1, source: '1 tick/s'}, refusal: null}};
  const announced = announceInstrument(controller);
  const state = readHostedState(base({instrument: announced}));
  assert.equal(state.instrument.ok, true, JSON.stringify(state.instrument));
  assert.equal(state.instrument.reading.standing, 'following');
  assert.equal(state.instrument.reading.identity.model_ref, 'model:owner');
  assert.deepEqual(state.instrument.determinants, {lens: {lens12: 3, label: 'L1′'}, contextFrame: 2, harmonic: {selection: 'canonical-basis', index: 4}, rna: true});
  assert.deepEqual(state.instrument.parameters, {muted: true, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: {rate: 1, playing: true, source: '1 tick/s'}, refusal: null});
});

test('the owner parameters are carried exact: sound, level, scale, cadence and the named refusal', () => {
  const carried = readHostedInstrument({reading: ownerReading(), determinants: null, parameters: {...parameters(),
    muted: false, level: 2.5, scale: {unitsPerMetre: null, mode: 'manual'}, cadence: null, refusal: 'determinant: lens is already acting'}});
  assert.equal(carried.ok, true);
  assert.deepEqual(carried.parameters, {muted: false, level: 2.5, scale: {unitsPerMetre: null, mode: 'manual'}, cadence: null, refusal: 'determinant: lens is already acting'});
});

test('parameters are exact or refused: a missing, out-of-range or unknown owner value is named, never defaulted', () => {
  const refused = (p, pattern) => {
    const instrument = readHostedInstrument({reading: ownerReading(), determinants: null, parameters: p});
    assert.equal(instrument.ok, false, JSON.stringify(p));
    assert.match(instrument.fault, pattern);
  };
  refused(undefined, /parameters/);
  refused({...parameters(), muted: 'no'}, /muted/);
  refused({...parameters(), level: 5}, /level/);
  refused({...parameters(), level: null}, /level/);
  refused({...parameters(), scale: {unitsPerMetre: 0, mode: 'domain-follow'}}, /unitsPerMetre/);
  refused({...parameters(), scale: {unitsPerMetre: 120, mode: 'guessing'}}, /mode/);
  refused({...parameters(), cadence: {rate: 13, playing: true, source: 'x'}}, /cadence/);
  refused({...parameters(), refusal: 7}, /refusal/);
});

test('the frame says when its cut presents the instrument — an announced instrument is not a drawn one (seen on screen 15 Oct)', () => {
  // The one frame keeps its instrument session open in every cut, so the shell reads the cut's own word, not the announcement.
  assert.equal(readHostedState(base({presentsInstrument: true}))?.presentsInstrument, true);
  assert.equal(readHostedState(base({hostMode: 'expressions', presentsInstrument: false}))?.presentsInstrument, false);
  assert.equal(readHostedState(base())?.presentsInstrument, undefined, 'absent is valid: a frame that has not said draws nothing of its own');
  assert.equal(readHostedState(base({presentsInstrument: 'yes'})), null, 'a non-boolean refuses the reading, like every flag here');
});
