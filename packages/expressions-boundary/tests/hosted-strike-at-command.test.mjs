// The owner's strike at points of the torus reaches the frame (O-I #790; DLW §21.2 "What strikes the Torus": "A touch | The point of
// the surface you touch", "A note in a clip | Its key's point, as the clip plays"). A shell-side player, or the M3 clock, strikes the
// torus at points through one validated `strike-at` stage command, which the frame runs as the native field's own strike at points
// (controller.playAt, #771). It travels the channel the Jankó's chords travel: admitted while the frame is concealed, refused before
// the owner when malformed. The point's bounds are the owner's (instrument-session.mjs strikeAt: 1..64 points, each angle on the
// sampled sheet [0, 2π)); the amplitude is the frame's played-strike bound, (0, 1].
import test from 'node:test';
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readStageRequest, readStageResult, stageRequestMessage, stageReplyMessage, CHANNEL_VERSION} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const TAU = 2 * Math.PI;
const strike = {command: 'strike-at', points: [{theta: 0.5, phi: 1.25}, {theta: 2, phi: 6.2}], amplitude: 0.35};

test('a strike at points reads as one exact strike-at command: 1..64 points on the sheet, one amplitude in (0, 1]', () => {
  assert.deepEqual(readStageRequest(stageRequestMessage(4, strike)), {req: 4, command: strike});
  assert.deepEqual(readStageRequest(stageRequestMessage(5, {...strike, points: [{theta: 0, phi: 0}]})).command.points, [{theta: 0, phi: 0}]);
  const sixtyFour = Array.from({length: 64}, (_, i) => ({theta: i * TAU / 64, phi: (63 - i) * TAU / 64}));
  assert.equal(readStageRequest(stageRequestMessage(6, {...strike, points: sixtyFour})).command.points.length, 64, 'an act holds up to 64 points');
  assert.equal(readStageRequest(stageRequestMessage(7, {...strike, amplitude: 1})).command.amplitude, 1);
});

test('a malformed strike at points is refused before anything is posted', () => {
  const just = Math.nextDown ? Math.nextDown(TAU) : TAU - 1e-12;
  assert.ok(readStageRequest(stageRequestMessage(1, {...strike, points: [{theta: just, phi: 0}]})), 'the last angle below 2π is on the sheet');
  const refused = [
    {...strike, points: []}, {...strike, points: Array.from({length: 65}, () => ({theta: 1, phi: 1}))},
    {...strike, points: [{theta: TAU, phi: 1}]}, {...strike, points: [{theta: 1, phi: -0.1}]}, {...strike, points: [{theta: NaN, phi: 1}]},
    {...strike, points: [{theta: 1}]}, {...strike, points: [{theta: 1, phi: 1, amplitude: [0.3, 0]}]}, {...strike, points: [[1, 1]]},
    {...strike, points: {theta: 1, phi: 1}}, {...strike, amplitude: 0}, {...strike, amplitude: 1.5}, {...strike, amplitude: NaN},
    {...strike, action: 'play'}, {command: 'strike-at', points: strike.points},
  ];
  for (const command of refused) assert.equal(stageRequestMessage(1, command), null, JSON.stringify(command));
});

test('the host admits a strike at points while the frame is concealed, and the owner\'s answer settles it', async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => false});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}});
  const sent = host.stageCommand(strike);
  const posted = (await wire.observe()).filter(d => d.command === 'strike-at').at(-1);
  assert.deepEqual(posted.points, strike.points, 'posted while concealed, the points exactly as given');
  assert.equal(posted.amplitude, 0.35);
  await deliver({v: CHANNEL_VERSION, kind: 'host-command-result', command: 'strike-at', req: posted.req, ok: false,
    error: 'The field is not running: resume it, then play'});
  assert.deepEqual(await sent, {ok: false, error: 'The field is not running: resume it, then play'}, 'the owner\'s refusal is named');
  assert.throws(() => host.stageCommand({command: 'strike-at', points: [], amplitude: 0.3}), /Unknown Expressions stage command/);
});

// O-I #809: a strike lands at the sample the player chooses. The Jankó's chord and a strike at points may name the owner's sample cursor
// (`at_samples_elapsed`, QL instrument-session.mjs strike/strikeAt): the exact decimal every native cursor is, so a u64 never rounds. The
// player reads the owner's audio clock first (`audio-clock`): where the owner's rendered sound stands, at its rate, how far ahead it
// renders and in what blocks. That answer carries the clock; it travels while the frame is concealed, as the strikes do.
const clock = {samples_elapsed: '480000', sample_rate: 48000, lookahead_seconds: 0.5, block_frames: 8192};

test('a strike names the sample it lands at: janko and strike-at carry an exact cursor, or none', () => {
  const chord = {command: 'janko', action: 'play', pitch_classes: [0, 4, 7], amplitude: 0.35};
  for (const command of [{...chord, at_samples_elapsed: '504000'}, {...strike, at_samples_elapsed: '0'},
    {...strike, at_samples_elapsed: '18446744073709551615'}, chord, strike]) {
    assert.deepEqual(readStageRequest(stageRequestMessage(9, command)), {req: 9, command}, JSON.stringify(command));
  }
  for (const at of [504000, '0504000', '', '-1', '1e6', '18446744073709551616', null, true]) {
    assert.equal(stageRequestMessage(1, {...chord, at_samples_elapsed: at}), null, `janko at ${JSON.stringify(at)}`);
    assert.equal(stageRequestMessage(1, {...strike, at_samples_elapsed: at}), null, `strike-at at ${JSON.stringify(at)}`);
  }
});

test('the owner\'s audio clock is read through the frame: its answer carries the clock, exactly, or nothing is read', () => {
  assert.deepEqual(readStageRequest(stageRequestMessage(3, {command: 'audio-clock'})), {req: 3, command: {command: 'audio-clock'}});
  assert.equal(stageRequestMessage(3, {command: 'audio-clock', at_samples_elapsed: '1'}), null);
  assert.deepEqual(readStageResult(stageReplyMessage(3, {ok: true, clock}, {command: 'audio-clock'})), {req: 3, ok: true, clock});
  assert.deepEqual(readStageResult(stageReplyMessage(4, {ok: true}, strike)), {req: 4, ok: true});
  for (const bad of [{...clock, samples_elapsed: 480000}, {...clock, samples_elapsed: '048'}, {...clock, sample_rate: 0},
    {...clock, sample_rate: 48000.5}, {...clock, lookahead_seconds: 0}, {...clock, lookahead_seconds: 2}, {...clock, block_frames: 0},
    {...clock, block_frames: 9000}, {...clock, extra: 1}, 'clock']) {
    assert.equal(readStageResult({v: 1, kind: 'host-command-result', command: 'audio-clock', req: 5, ok: true, clock: bad}), null, JSON.stringify(bad));
  }
});

test('the host reads the owner\'s audio clock while the frame is concealed, and settles with the clock the frame answered', async t => {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(),
    handshakeTimeoutMs: 1000, mode: 'live', isPresented: () => false});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'live', sceneIndex: 0, sceneCount: 1,
    nativeScene: {expression_ref: 'expression:kept', revision: 3, scene_ref: 'scene:one'}}});
  const read = host.stageCommand({command: 'audio-clock'});
  const posted = (await wire.observe()).filter(d => d.command === 'audio-clock').at(-1);
  assert.ok(posted, 'posted while concealed');
  await deliver(stageReplyMessage(posted.req, {ok: true, clock}, {command: 'audio-clock'}));
  assert.deepEqual(await read, {ok: true, clock});
  const timed = host.stageCommand({...strike, at_samples_elapsed: '504000'});
  const sent = (await wire.observe()).filter(d => d.command === 'strike-at').at(-1);
  assert.equal(sent.at_samples_elapsed, '504000', 'the cursor travels exactly');
  await deliver(stageReplyMessage(sent.req, {ok: true}, strike));
  assert.deepEqual(await timed, {ok: true});
});
